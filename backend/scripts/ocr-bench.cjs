// OCR evaluation bench (read-only). Runs the OCR extraction on real PRF source PDFs and scores it
// against the reviewed items stored in the database, with the PDF text layer as tie-breaker.
// It never writes to the database. It calls the AI provider configured in Settings (real cost).
//
// Usage (inside the backend container, with this build's dist):
//   NODE_PATH=/app/node_modules node scripts/ocr-bench.cjs --dist <dist dir> --count 20 --models gpt-4o,gpt-4o-mini --out results.json
//   Optional: --prf 54123,52726 to add specific PRFs.
const fs = require('fs');
const path = require('path');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const dist = path.resolve(arg('dist', path.join(__dirname, '..', 'dist')));
const count = Number(arg('count', '20'));
const models = arg('models', 'gpt-4o').split(',').map((s) => s.trim()).filter(Boolean);
const outFile = arg('out', 'ocr-bench-results.json');
const source = arg('source', 'files'); // files | rescan
const extraPrfs = (arg('prf', '') || '').split(',').map((s) => s.trim()).filter(Boolean);

const sql = require('mssql');
const { OCRService, normalizeOCRHeader } = require(path.join(dist, 'services/ocrService'));
const { loadSettings } = require(path.join(dist, 'routes/settingsRoutes'));
const { connectDatabase } = require(path.join(dist, 'config/database'));
const { crossCheckItemNumbers, numbersInText } = require(path.join(dist, 'services/ocrCrossCheck'));
const { extractPdfText } = require(path.join(dist, 'services/pdfPageRenderer'));

// USD per 1M tokens (input, output); approximate list prices for the cost estimate only.
const PRICE = { 'gpt-4o': [2.5, 10], 'gpt-4o-mini': [0.15, 0.6] };

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1));
const jaccard = (a, b) => {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / (A.size + B.size - n);
};
const money = (v) => Math.round(Number(v) * 100) / 100;
const code = (s) => String(s ?? '').replace(/\s+/g, '').toUpperCase();

/** Pairs extracted items with stored items: same part number first, then the most similar description. */
const matchItems = (truth, got) => {
  const used = new Set();
  const pairs = [];
  truth.forEach((t, ti) => {
    let best = -1, bestScore = 0;
    got.forEach((g, gi) => {
      if (used.has(gi)) return;
      const sameCode = t.ItemCode && g.partNumber && norm(t.ItemCode) === norm(g.partNumber);
      const score = sameCode ? 2 : jaccard(`${t.ItemName} ${t.Description || ''}`, g.description);
      if (score > bestScore) { bestScore = score; best = gi; }
    });
    if (best >= 0 && bestScore >= 0.3) { used.add(best); pairs.push([ti, best]); }
  });
  return { pairs, missed: truth.length - pairs.length, extra: got.length - pairs.length };
};

(async () => {
  const e = process.env;
  const pool = await sql.connect({
    server: e.DB_SERVER, database: e.DB_NAME, user: e.DB_USER, password: e.DB_PASSWORD, port: +e.DB_PORT || 1433,
    options: { encrypt: e.DB_ENCRYPT === 'true', trustServerCertificate: e.DB_TRUST_CERT === 'true' }
  });
  const docs = (await pool.request().query(`
    SELECT f.PRFID, p.PRFNo, p.RequestedAmount, f.FilePath, f.SharedPath, f.OriginalFileName, f.FileID,
           (SELECT COUNT(*) FROM PRFItems i WHERE i.PRFID = p.PRFID AND ISNULL(i.Status,'') <> 'Cancelled') AS ItemCount
      FROM PRFFiles f JOIN PRF p ON p.PRFID = f.PRFID
     WHERE f.IsOriginalDocument = 1 AND (f.MimeType = 'application/pdf' OR f.FileType = 'pdf')
       AND EXISTS (SELECT 1 FROM PRFItems i WHERE i.PRFID = p.PRFID)
     ORDER BY f.FileID DESC`)).recordset;
  // Half the sample: the PRFs with the most items (long tables, several pages); half: the latest.
  const byItems = [...docs].sort((a, b) => b.ItemCount - a.ItemCount).slice(0, Math.ceil(count / 2));
  const seen = new Set();
  const picked = [];
  if (source === 'rescan') {
    // Ground truth: the item list after a reviewed rescan of that exact file (PRFOCRRescanAudit).
    const audits = (await pool.request().query(`
      SELECT a.PRFID, p.PRFNo, p.RequestedAmount, f.FilePath, f.SharedPath, f.OriginalFileName, f.FileID,
             a.AfterSnapshot, a.PreservedItemCount
        FROM PRFOCRRescanAudit a JOIN PRF p ON p.PRFID = a.PRFID JOIN PRFFiles f ON f.FileID = a.FileID
       WHERE a.RescanAuditID IN (SELECT MAX(RescanAuditID) FROM PRFOCRRescanAudit GROUP BY PRFID)
         AND (f.MimeType = 'application/pdf' OR f.FileType = 'pdf')`)).recordset
      .map((a) => ({ ...a, truth: (JSON.parse(a.AfterSnapshot).items || []).filter((i) => i.Status !== 'Cancelled') }))
      .sort((a, b) => b.truth.length - a.truth.length);
    for (const d of audits) {
      if (picked.length >= count) break;
      const file = [d.SharedPath, d.FilePath].find((c) => c && fs.existsSync(c));
      if (file) picked.push({ ...d, file });
    }
  }
  for (const d of source === 'rescan' ? [] : [...docs.filter((x) => extraPrfs.includes(String(x.PRFNo))), ...byItems, ...docs]) {
    if (seen.has(d.PRFID) || picked.length >= count) continue;
    const file = [d.SharedPath, d.FilePath].find((c) => c && fs.existsSync(c));
    if (!file) continue;
    seen.add(d.PRFID);
    picked.push({ ...d, file });
  }

  await connectDatabase(); // the app's own pool, used by loadSettings
  const settings = await loadSettings();
  const service = new OCRService();
  await service.initializeAI();
  const usage = { prompt: 0, completion: 0, calls: 0 };
  const create = service.openAI.chat.completions.create.bind(service.openAI.chat.completions);
  service.openAI.chat.completions.create = async (req) => {
    const r = await create(req);
    usage.prompt += r.usage?.prompt_tokens || 0;
    usage.completion += r.usage?.completion_tokens || 0;
    usage.calls++;
    return r;
  };

  const results = [];
  for (const model of models) {
    const before = { ...usage };
    for (const d of picked) {
      const buf = fs.readFileSync(d.file);
      const text = await extractPdfText(buf);
      const pdfNumbers = numbersInText(text);
      const truth = d.truth || (await pool.request().input('id', sql.Int, d.PRFID).query(
        "SELECT ItemName, Description, ItemCode, Quantity, UnitPrice, PurchaseCostCode FROM PRFItems WHERE PRFID = @id AND ISNULL(Status,'') <> 'Cancelled' ORDER BY PRFItemID")).recordset;
      const row = { prf: d.PRFNo, model, items: truth.length, pdfPages: Number((/^Pages:\s+(\d+)/m.exec(require('child_process').execFileSync('pdfinfo', [d.file]).toString()) || [])[1] || 0) };
      const t0 = Date.now();
      try {
        const variant = { ...settings, ocr: { ...settings.ocr, provider: 'openai', model } };
        const res = await service.runProvider('openai', buf, 'application/pdf', variant);
        const data = normalizeOCRHeader(res.extractedData);
        const got = (data.items || []).filter((x) => x.status !== 'Cancelled' && !x.isStruckThrough);
        const { pairs, missed, extra } = matchItems(truth, got);
        let qty = 0, price = 0, gl = 0, wrong = [];
        for (const [ti, gi] of pairs) {
          const t = truth[ti], g = got[gi];
          if (Number(g.quantity) === Number(t.Quantity)) qty++;
          const gp = money(g.unitPrice), tp = money(t.UnitPrice);
          // The stored value can be wrong (see Phase 22): the PDF text decides when they differ.
          const priceOk = gp === tp || (pdfNumbers.size >= 5 && pdfNumbers.has(gp) && !pdfNumbers.has(tp));
          if (priceOk) price++; else wrong.push(gi);
          if (code(g.purchaseCostCode) && code(g.purchaseCostCode) === code(t.PurchaseCostCode)) gl++;
        }
        const flags = crossCheckItemNumbers({ ...data, items: got }, text).filter((x) => x.itemIndex !== undefined).map((x) => x.itemIndex);
        Object.assign(row, {
          mode: res.debug?.mode, renderer: res.debug?.pdf?.renderer, pages: res.debug?.pdf?.renderedPages,
          extracted: got.length, matched: pairs.length, missed: Math.max(0, missed - (d.PreservedItemCount || 0)), extra, qtyOk: qty, priceOk: price, glOk: gl,
          totalOk: money(data.totalAmount) === money(d.RequestedAmount) || (pdfNumbers.has(money(data.totalAmount)) && !pdfNumbers.has(money(d.RequestedAmount))),
          wrongPrices: wrong.length,
          flaggedWrong: wrong.filter((gi) => flags.includes(gi)).length,
          flaggedRight: flags.filter((gi) => !wrong.includes(gi)).length,
          textLayer: pdfNumbers.size >= 5,
          warnings: (data.extractionWarnings || []).map((w) => w.code),
          glSample: pairs.slice(0, 3).map(([ti, gi]) => `${truth[ti].PurchaseCostCode} | ${got[gi].purchaseCostCode}`),
          seconds: Math.round((Date.now() - t0) / 1000)
        });
      } catch (err) {
        Object.assign(row, { error: String(err.code || err.message).slice(0, 120), seconds: Math.round((Date.now() - t0) / 1000) });
      }
      results.push(row);
      console.log(JSON.stringify(row));
    }
    const p = usage.prompt - before.prompt, c = usage.completion - before.completion;
    const [pi, po] = PRICE[model] || [0, 0];
    results.push({ summary: model, calls: usage.calls - before.calls, promptTokens: p, completionTokens: c, usd: Math.round(((p * pi + c * po) / 1e6) * 100) / 100 });
    console.log(JSON.stringify(results[results.length - 1]));
  }
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  process.exit(0);
})().catch((err) => { console.error('BENCH FAILED', err.message); process.exit(1); });
