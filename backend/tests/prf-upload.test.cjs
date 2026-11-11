// Offline contract tests: no production SQL, provider calls or shared-folder writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const db = require('../dist/config/database');
let method = 'llm'; let llmCalls = 0; let modelCreates = 0; let rollback = 0; let commits = 0; let failItems = false;
const settings = { ocr: { enabled: true, provider: 'openai', uploadMethod: 'llm' }, general: { sharedFolderPath: '' } };
const llmData = { prfNo: '12345', requestedBy: 'Requester', department: 'HR / ICT', totalAmount: 20,
  items: [{ partNumber: '1234-03-123456', description: 'Cable', quantity: 2, unitPrice: 10, totalPrice: 20, currency: 'IDR', purchaseCostCode: 'GL-6250' }] };
const rawLoad = Module._load;
const mockSettings = { loadSettings: async () => ({ ...settings, ocr: { ...settings.ocr, uploadMethod: method } }) };
class Transaction { async begin() {} async commit() { commits++; } async rollback() { rollback++; } }
Module._load = function(name, parent, main) {
  if (name === '../middleware/auth') return { authenticateToken: (req,res,next) => { req.user = { UserID: Number(req.headers['x-test-user'] || 1), Username: 'tester', Role: 'Admin' }; next(); }, requireContentManager: (_q,_s,next) => next() };
  if (name === '../models/PRF') return { PRFModel: { findByPRFNo: async () => null, create: async (data,user,tx) => { modelCreates++; assert.ok(tx instanceof Transaction); assert.equal(data.Items[0].ItemCode,'1234-03-123456'); if (failItems) throw new Error('simulated item failure'); return { PRFID: modelCreates, PRFNo: data.PRFNo }; } } };
  if (name === '../models/PRFFiles') return { PRFFilesModel: { create: async () => ({ FileID: 1 }) } };
  if (name === '../services/sharedStorageService') return { getSharedStorageService: () => ({ copyFileToSharedStorage: async () => ({ success: false }) }) };
  if (name === './settingsRoutes' || name === '../routes/settingsRoutes') return mockSettings;
  if (name === 'mssql' && parent?.filename.endsWith('ocrPrfRoutes.js')) return { ...rawLoad.apply(this, arguments), Transaction };
  return rawLoad.apply(this, arguments);
};
const llm = require('../dist/services/ocrService').ocrService;
llm.isEnabled = async () => true;
llm.extractPRFData = async () => { llmCalls++; return structuredClone(llmData); };
const review = require('../dist/services/prfUploadReview');
const local = require('../dist/services/localPRFParser');
const dispatch = require('../dist/services/prfUploadExtraction');
db.getPool = () => ({});
const router = require('../dist/routes/ocrPrfRoutes').default;
Module._load = rawLoad;
const express = require('express');
const app = express(); app.use(express.json()); app.use('/api/ocr-prf', router);
let server, base;
test.before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening',r)); base=`http://127.0.0.1:${server.address().port}`; });
test.after(() => new Promise(r => server.close(r)));
const file = Buffer.from('%PDF-fixture-for-mocked-LLM');
const post = async (route, fields = {}, bytes = file, user = 1) => {
  const form = new FormData(); form.append('document',new Blob([bytes],{type:'application/pdf'}),'PRF.pdf');
  for (const [k,v] of Object.entries(fields)) form.append(k,typeof v === 'string' ? v : JSON.stringify(v));
  const response = await fetch(base+route,{method:'POST',headers:{'x-test-user':String(user)},body:form});
  return { status:response.status, body:await response.json() };
};
test('review validation rejects incomplete, inconsistent or unreviewed financial fields', () => {
  assert.equal(review.validateReviewedData(llmData).items.length,1);
  for (const change of [{prfNo:'x'.repeat(51)},{dateRaised:'2026-02-31'},{items:[{...llmData.items[0],quantity:1.5}]},{prfNo:''},{totalAmount:21},{items:[]},{items:[{...llmData.items[0],purchaseCostCode:''}]},{items:[{...llmData.items[0],quantity:0}]},{items:[{...llmData.items[0],totalPrice:19}]},{items:[{...llmData.items[0],currency:'USD'}]},{items:[{...llmData.items[0],status:'Cancelled'}]}]) assert.throws(()=>review.validateReviewedData({...llmData,...change}),local.UploadError);
  assert.equal(review.validateReviewedData({...llmData,items:[{...llmData.items[0],currency:'USD'}],exchangeRateToIDR:16000}).exchangeRateToIDR,16000);
});
test('preview binding, acknowledgments, single-save lock, replay and expiry', () => {
  const extraction={method:'local',extractedData:llmData,reviewIssues:[{id:'flag',code:'test',message:'check',severity:'warning'}]};
  const {token}=review.createUploadPreview(extraction,1,file);
  assert.throws(()=>review.acquireUploadPreview(token,2,file,llmData,['document-reviewed','flag']));
  assert.throws(()=>review.acquireUploadPreview(token,1,Buffer.from('other'),llmData,['document-reviewed','flag']));
  assert.throws(()=>review.acquireUploadPreview(token,1,file,llmData,['document-reviewed']));
  const lease=review.acquireUploadPreview(token,1,file,llmData,['document-reviewed','flag']);
  assert.throws(()=>review.acquireUploadPreview(token,1,file,llmData,['document-reviewed','flag']));
  review.finishUploadPreview(lease.preview,{success:true});
  assert.deepEqual(review.acquireUploadPreview(token,1,file,llmData,['document-reviewed','flag']).replay,{success:true});
  const other=review.createUploadPreview(extraction,1,file);const now=Date.now;Date.now=()=>now()+16*60*1000;
  try { assert.throws(()=>review.acquireUploadPreview(other.token,1,file,llmData,['document-reviewed','flag'])); } finally { Date.now=now; }
});
test('upload preview has no PRF write; save uses edited preview and no second LLM call; retry is idempotent', async () => {
  method='llm'; const before=modelCreates;const p=await post('/api/ocr-prf/preview-extraction');assert.equal(p.status,200);assert.equal(modelCreates,before);
  const calls=llmCalls; const data={...p.body.data.extractedData,semanticTitle:'Reviewed title'};
  const fields={previewToken:p.body.data.previewToken,reviewedData:data,acknowledgedReviewIds:['document-reviewed',...p.body.data.reviewIssues.map(x=>x.id)]};
  assert.equal((await post('/api/ocr-prf/create-from-document',fields,file,2)).status,409);
  assert.equal((await post('/api/ocr-prf/create-from-document',fields,Buffer.from('%PDF-other'))).status,409);
  assert.equal((await post('/api/ocr-prf/create-from-document')).status,409);
  const saved=await post('/api/ocr-prf/create-from-document',fields);assert.equal(saved.status,201);assert.equal(saved.body.data.extractedData.semanticTitle,'Reviewed title');assert.equal(llmCalls,calls);assert.equal(modelCreates,before+1);
  assert.equal((await post('/api/ocr-prf/create-from-document',fields)).status,201);assert.equal(modelCreates,before+1);assert.ok(commits>0);
});
test('failed item write rolls back; preview remains retryable', async () => {
  const p=await post('/api/ocr-prf/preview-extraction');const fields={previewToken:p.body.data.previewToken,reviewedData:p.body.data.extractedData,acknowledgedReviewIds:['document-reviewed',...p.body.data.reviewIssues.map(x=>x.id)]};
  failItems=true;const before=commits;assert.equal((await post('/api/ocr-prf/create-from-document',fields)).status,500);assert.equal(commits,before);assert.ok(rollback>0);
  failItems=false;assert.equal((await post('/api/ocr-prf/create-from-document',fields)).status,201);
});
test('local method never sends PDF or errors to LLM; unavailable runtime and image types fail explicitly', async () => {
  method='local'; const calls=llmCalls;
  await assert.rejects(()=>dispatch.extractUpload(Buffer.from('image'),'image/png'),e=>e.status===422);
  const python=process.env.PRF_PARSER_PYTHON;process.env.PRF_PARSER_PYTHON='/does-not-exist';
  try { await assert.rejects(()=>dispatch.extractUpload(Buffer.from('%PDF-x'),'application/pdf'),e=>e.status===503); } finally { if (python) process.env.PRF_PARSER_PYTHON=python; else delete process.env.PRF_PARSER_PYTHON; }
  assert.equal(llmCalls,calls);method='llm';
});
test('real local adapter recovers annotation item without cloud or PR-number fabrication', {skip:!process.env.PRF_TEST_PDF}, async () => {
  method='local';const calls=llmCalls;
  const result=await dispatch.extractUpload(fs.readFileSync(process.env.PRF_TEST_PDF),'application/pdf');
  assert.equal(result.method,'local');assert.equal(result.extractedData.items.length,2);assert.equal(result.extractedData.items[1].partNumber,'5895-03-259001');assert.equal(result.extractedData.prfNo,undefined);assert.equal(llmCalls,calls);assert.ok(result.reviewIssues.length);method='llm';
});
test('rescan handlers remain identical to pre-integration checkout', {skip:!process.env.PRF_ORIGINAL_REPO}, () => {
  const before=fs.readFileSync(path.join(process.env.PRF_ORIGINAL_REPO,'backend/src/routes/ocrPrfRoutes.ts'),'utf8');const after=fs.readFileSync(path.join(root,'src/routes/ocrPrfRoutes.ts'),'utf8');
  const marker="router.post('/rescan/";assert.equal(after.slice(after.indexOf(marker)),before.slice(before.indexOf(marker)));
});

test('model propagates one transaction to header and item writes, preserving full descriptions separately', async () => {
  const { PRFModel } = require('../dist/models/PRF');
  const original = db.executeQuery; const seen=[];const tx={fixture:true};
  db.executeQuery = async (query,params,transaction) => { seen.push({query,params,transaction});return {recordset:[query.includes('INSERT INTO PRF (')?{PRFID:42}:{}]}; };
  try {
    await PRFModel.create({PRFNo:'42',Title:'Fixture',Department:'HR / ICT',COAID:1,RequestedAmount:20,Items:[{ItemName:'Cable',Description:'Full specification',Quantity:2,UnitPrice:10,ItemCode:'1234-03-123456'}]},1,tx);
    assert.equal(seen.length,2);assert.ok(seen.every(x=>x.transaction===tx));assert.equal(seen[1].params.Description0,'Full specification');
  } finally { db.executeQuery=original; }
});
