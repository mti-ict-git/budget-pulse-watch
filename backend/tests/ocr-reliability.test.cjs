// Offline tests for OCR reliability: provider error mapping, provider fallback, model defaults and
// the poppler page renderer helpers. No AI provider, database or poppler binaries are used.
const test = require('node:test');
const assert = require('node:assert/strict');
const settingsRoutes = require('../dist/routes/settingsRoutes');
const { classifyProviderError, OcrProviderError } = require('../dist/services/ocrProviderErrors');
const { OCRService, resolveOcrModel } = require('../dist/services/ocrService');
const { parsePageCount, orderPageImages, cleanLayoutText, PdfRenderLimitError } = require('../dist/services/pdfPageRenderer');

const apiError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

test('OpenAI without credit is PROVIDER_NO_CREDIT with an actionable message', () => {
  for (const e of [
    apiError(429, '429 You have no credits remaining. Add credits to continue using the API', { code: 'insufficient_quota', type: 'insufficient_quota' }),
    apiError(429, 'You exceeded your current quota, please check your plan and billing details.')
  ]) {
    const r = classifyProviderError('openai', e);
    assert.ok(r instanceof OcrProviderError);
    assert.equal(r.code, 'PROVIDER_NO_CREDIT');
    assert.equal(r.status, 503);
    assert.match(r.message, /OpenAI\) has no credit/);
    assert.equal(r.providerSide, true);
  }
});

test('rate limits, keys, timeouts and outages are told apart', () => {
  const cases = [
    ['openai', apiError(429, 'Rate limit reached for gpt-4o on tokens per min (TPM)'), 'PROVIDER_RATE_LIMITED'],
    ['gemini', new Error('[GoogleGenerativeAI Error]: [429 Too Many Requests] Quota exceeded for quota metric requests per minute'), 'PROVIDER_RATE_LIMITED'],
    ['gemini', new Error('[GoogleGenerativeAI Error]: [429 Too Many Requests] Resource has been exhausted (e.g. check quota).'), 'PROVIDER_NO_CREDIT'],
    ['openai', apiError(401, 'Incorrect API key provided', { code: 'invalid_api_key' }), 'PROVIDER_AUTH'],
    ['gemini', new Error('[GoogleGenerativeAI Error]: [400 Bad Request] API key not valid. Please pass a valid API key.'), 'PROVIDER_AUTH'],
    ['openai', Object.assign(new Error('Request timed out.'), { name: 'APIConnectionTimeoutError' }), 'PROVIDER_TIMEOUT'],
    ['openai', apiError(503, 'The server is overloaded'), 'PROVIDER_UNAVAILABLE'],
    ['openai', Object.assign(new Error('Connection error.'), { name: 'APIConnectionError' }), 'PROVIDER_UNAVAILABLE'],
    ['openai', new SyntaxError('Unexpected token } in JSON'), 'PROVIDER_FAILED']
  ];
  for (const [provider, error, code] of cases) assert.equal(classifyProviderError(provider, error).code, code, error.message);
  assert.equal(classifyProviderError('openai', new SyntaxError('x')).providerSide, false);
});

test('retired Gemini 1.x models map to the current default', () => {
  assert.equal(resolveOcrModel('gemini', 'gemini-1.5-flash'), 'gemini-2.5-flash');
  assert.equal(resolveOcrModel('gemini', ''), 'gemini-2.5-flash');
  assert.equal(resolveOcrModel('gemini', 'gemini-2.0-flash'), 'gemini-2.0-flash');
  assert.equal(resolveOcrModel('openai', null), 'gpt-4o-mini');
  assert.equal(resolveOcrModel('openai', 'gpt-4o'), 'gpt-4o');
});

test('poppler helpers: page count, page order, layout text', () => {
  assert.equal(parsePageCount('Title: x\nPages:           10\nEncrypted: no\n'), 10);
  assert.throws(() => parsePageCount('Title: x'));
  assert.deepEqual(orderPageImages(['page-10.png', 'input.pdf', 'page-2.png', 'page-01.png']), ['page-01.png', 'page-2.png', 'page-10.png']);
  assert.equal(cleanLayoutText('  A   1  \n\n\n\nB\f'), 'A   1\n\nB');
  assert.equal(new PdfRenderLimitError(10, 6).name, 'PdfRenderLimitError');
});

// Provider fallback, with stubbed settings and providers.
const withService = async (settings, setup, run) => {
  const original = settingsRoutes.loadSettings;
  settingsRoutes.loadSettings = async () => settings;
  try {
    const service = new OCRService();
    service.initializeAI = async () => setup(service);
    return await run(service);
  } finally {
    settingsRoutes.loadSettings = original;
  }
};
const noCredit = () => { throw classifyProviderError('openai', apiError(429, 'You have no credits remaining', { code: 'insufficient_quota' })); };
const settingsFor = (over = {}) => ({ ocr: { provider: 'openai', model: 'gpt-4o', openaiApiKey: 'x', geminiApiKey: 'y', ...over } });

test('no fallback unless OCR_PROVIDER_FALLBACK=true: the no-credit error reaches the user', async () => {
  delete process.env.OCR_PROVIDER_FALLBACK;
  await withService(settingsFor(), (s) => { s.openAI = {}; s.genAI = {}; s.extractWithOpenAI = noCredit; }, async (s) => {
    await assert.rejects(s.extractPRFDataWithDebug(Buffer.from('x'), 'image/png'), (e) => e.code === 'PROVIDER_NO_CREDIT');
  });
});

test('with OCR_PROVIDER_FALLBACK=true, no credit at OpenAI falls back to Gemini with its default model', async () => {
  process.env.OCR_PROVIDER_FALLBACK = 'true';
  try {
    let geminiModel;
    await withService(settingsFor(), (s) => {
      s.openAI = {}; s.genAI = {};
      s.extractWithOpenAI = noCredit;
      s.extractWithGemini = async (_b, _m, settings) => { geminiModel = settings.ocr.model; return { prfNo: '55943', items: [] }; };
    }, async (s) => {
      const r = await s.extractPRFDataWithDebug(Buffer.from('x'), 'application/pdf');
      assert.equal(r.extractedData.prfNo, '55943');
      assert.equal(r.debug.provider, 'gemini');
      assert.deepEqual(r.debug.fallbackFrom, { provider: 'openai', code: 'PROVIDER_NO_CREDIT' });
      assert.equal(r.debug.mode, 'pdf-single');
    });
    assert.equal(geminiModel, 'gemini-2.5-flash');
  } finally {
    delete process.env.OCR_PROVIDER_FALLBACK;
  }
});

test('fallback is skipped without a key for the other provider, and for document errors', async () => {
  process.env.OCR_PROVIDER_FALLBACK = 'true';
  try {
    await withService(settingsFor({ geminiApiKey: '' }), (s) => { s.openAI = {}; s.genAI = null; s.extractWithOpenAI = noCredit; }, async (s) => {
      await assert.rejects(s.extractPRFDataWithDebug(Buffer.from('x'), 'image/png'), (e) => e.code === 'PROVIDER_NO_CREDIT');
    });
    let geminiCalled = false;
    await withService(settingsFor(), (s) => {
      s.openAI = {}; s.genAI = {};
      s.extractPdfWithOpenAIByPages = async () => { throw new Error('PDF pages contain conflicting PRF numbers'); };
      s.extractWithGemini = async () => { geminiCalled = true; return { items: [] }; };
    }, async (s) => {
      await assert.rejects(s.extractPRFDataWithDebug(Buffer.from('x'), 'application/pdf'), /conflicting PRF numbers/);
    });
    assert.equal(geminiCalled, false);
  } finally {
    delete process.env.OCR_PROVIDER_FALLBACK;
  }
});

test('missing key for the configured provider is a clear configuration error', async () => {
  await withService(settingsFor({ openaiApiKey: '' }), (s) => { s.openAI = null; s.genAI = {}; }, async (s) => {
    await assert.rejects(s.extractPRFDataWithDebug(Buffer.from('x'), 'image/png'), (e) => e.code === 'OCR_NOT_CONFIGURED' && e.status === 503);
  });
});

test('Gemini rejects PDFs over the inline size limit before calling the provider', async () => {
  await withService(settingsFor({ provider: 'gemini', model: 'gemini-1.5-flash' }), (s) => {
    s.openAI = null; s.genAI = {}; s.extractWithGemini = async () => assert.fail('should not call Gemini');
  }, async (s) => {
    await assert.rejects(s.extractPRFDataWithDebug(Buffer.alloc(19 * 1024 * 1024), 'application/pdf'), (e) => e.code === 'FILE_TOO_LARGE_FOR_PROVIDER' && e.status === 413);
  });
});
