import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { ExtractedPRFData } from './ocrService';

export interface ReviewIssue {
  id: string;
  code: string;
  message: string;
  severity: 'warning' | 'error';
  page?: number;
  itemIndex?: number;
  field?: string;
}
export interface SourcePage { page: number; role: string; nativeText: string; ocrText: string; }
export interface UploadExtraction {
  extractedData: ExtractedPRFData;
  method: 'llm' | 'local';
  reviewIssues: ReviewIssue[];
  sourcePages?: SourcePage[];
  parserVersion?: string;
  debug?: unknown;
}
export class UploadError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}
const script = path.resolve(__dirname, '../../scripts/prf_parser/worker.py');
let running = 0;

export function runLocalWorker(args: string[], timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.PRF_PARSER_PYTHON || 'python3', [script, ...args], {
      shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe']
    });
    const chunks: Buffer[] = []; let size = 0; let settled = false;
    const finish = (error?: Error, result?: string) => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve(result || '');
    };
    const stop = () => {
      try { if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { /* already exited */ }
    };
    const timer = setTimeout(() => { stop(); finish(new UploadError('Local processing timed out. Try a smaller PDF or the LLM method.', 504, 'LOCAL_TIMEOUT')); }, timeoutMs);
    child.on('error', () => finish(new UploadError('Local parser runtime is unavailable. Ask an administrator to check Python, Poppler and Tesseract.', 503, 'LOCAL_UNAVAILABLE')));
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 12 * 1024 * 1024) { stop(); finish(new UploadError('Local extraction output exceeds the supported size.', 422, 'LOCAL_OUTPUT_LIMIT')); }
      else chunks.push(chunk);
    });
    child.stderr.on('data', () => { /* No document contents or secrets in logs. */ });
    child.on('close', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      try {
        const value = JSON.parse(text) as { error?: { message?: string } };
        if (value.error) finish(new UploadError(value.error.message || 'Local extraction failed.', 422, 'LOCAL_EXTRACTION_FAILED'));
        else finish(undefined, text);
      } catch { finish(new UploadError('Local parser returned an invalid response. Check its installed dependencies.', 503, 'LOCAL_INVALID_RESPONSE')); }
    });
  });
}
export async function parseLocalPDF(buffer: Buffer, mimeType: string): Promise<UploadExtraction> {
  if (mimeType !== 'application/pdf' || !buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) {
    throw new UploadError('The local method supports PDF files only. Select the LLM method for images.', 422, 'LOCAL_PDF_ONLY');
  }
  if (running >= 2) throw new UploadError('The local parser is busy. Please retry shortly.', 429, 'LOCAL_BUSY');
  running++;
  let folder: string | undefined;
  try {
    folder = await fs.mkdtemp(path.join(os.tmpdir(), 'prf-local-'));
    const input = path.join(folder, 'document.pdf'); await fs.writeFile(input, buffer, { mode: 0o600 });
    const result = JSON.parse(await runLocalWorker([input])) as UploadExtraction;
    if (!result.extractedData || !Array.isArray(result.extractedData.items) || !Array.isArray(result.reviewIssues)) {
      throw new UploadError('The local parser returned incomplete data.', 422, 'LOCAL_INVALID_DATA');
    }
    return result;
  } finally { running--; if (folder) await fs.rm(folder, { recursive: true, force: true }); }
}
