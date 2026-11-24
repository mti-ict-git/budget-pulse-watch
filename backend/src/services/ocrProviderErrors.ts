import { UploadError } from './localPRFParser';

export type OcrProvider = 'openai' | 'gemini';

export type OcrProviderErrorCode =
  | 'PROVIDER_NO_CREDIT'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_AUTH'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_FAILED';

const PROVIDER_NAME: Record<OcrProvider, string> = { openai: 'OpenAI', gemini: 'Google Gemini' };

const MESSAGES: Record<OcrProviderErrorCode, (name: string) => string> = {
  PROVIDER_NO_CREDIT: (n) =>
    `The AI provider (${n}) has no credit or quota left. Ask an administrator to top up the account or switch the OCR provider in Settings, then try again. You can also choose the local method for PDFs with a text layer.`,
  PROVIDER_RATE_LIMITED: (n) => `The AI provider (${n}) is receiving too many requests. Wait a minute and try again.`,
  PROVIDER_AUTH: (n) => `The AI provider (${n}) rejected the API key. Ask an administrator to check the OCR settings.`,
  PROVIDER_TIMEOUT: (n) => `The AI provider (${n}) did not answer in time. Try again.`,
  PROVIDER_UNAVAILABLE: (n) => `The AI provider (${n}) is unavailable right now. Try again later, or choose the local method for PDFs with a text layer.`,
  PROVIDER_FAILED: (n) => `Document extraction with ${n} failed. Retry, or choose another method in Settings.`,
};

/** A failure of the external AI provider, with a message a PRF user can act on. Routes return it as JSON. */
export class OcrProviderError extends UploadError {
  constructor(
    readonly provider: OcrProvider,
    readonly providerCode: OcrProviderErrorCode,
    readonly detail: string
  ) {
    super(MESSAGES[providerCode](PROVIDER_NAME[provider]), 503, providerCode);
    this.name = 'OcrProviderError';
  }

  /** Worth trying the other provider: the problem is this provider's account or availability, not the document. */
  get providerSide(): boolean {
    return this.providerCode !== 'PROVIDER_FAILED';
  }
}

interface ErrorLike {
  status?: unknown;
  code?: unknown;
  type?: unknown;
  name?: unknown;
  message?: unknown;
  error?: { type?: unknown; code?: unknown };
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Maps OpenAI SDK and Google Generative AI errors to a code. OpenAI reports an empty balance as HTTP 429
 * with code/type `insufficient_quota`; Gemini reports exhausted quota as HTTP 429 `RESOURCE_EXHAUSTED`.
 */
export const classifyProviderError = (provider: OcrProvider, error: unknown): OcrProviderError => {
  if (error instanceof OcrProviderError) return error;
  const e = (error && typeof error === 'object' ? error : {}) as ErrorLike;
  const message = text(e.message) || String(error);
  const status = typeof e.status === 'number' ? e.status : Number(/\[(\d{3})[^\]]*\]/.exec(message)?.[1] ?? NaN);
  const codes = [e.code, e.type, e.error?.code, e.error?.type].map(text).join(' ').toLowerCase();
  const lower = `${codes} ${message.toLowerCase()}`;
  const name = text(e.name);

  let code: OcrProviderErrorCode = 'PROVIDER_FAILED';
  const perMinute = /per minute|per_minute|perminute|requests per|tokens per|rate limit/.test(lower);
  if (/insufficient_quota|no credits remaining|billing/.test(lower) || (/resource_exhausted|quota/.test(lower) && !perMinute)) code = 'PROVIDER_NO_CREDIT';
  else if (status === 429 || perMinute) code = 'PROVIDER_RATE_LIMITED';
  else if (status === 401 || status === 403 || /invalid_api_key|api key not valid|permission_denied/.test(lower)) code = 'PROVIDER_AUTH';
  else if (/timeout|timed out|aborterror/i.test(`${name} ${message}`)) code = 'PROVIDER_TIMEOUT';
  else if ((Number.isFinite(status) && status >= 500) || /APIConnectionError|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed|overloaded|unavailable/i.test(`${name} ${message}`)) code = 'PROVIDER_UNAVAILABLE';

  return new OcrProviderError(provider, code, message.slice(0, 500));
};
