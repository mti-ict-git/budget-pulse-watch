import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

/** One PDF page for page-by-page OCR: a PNG data URL and the page's own text layer (empty for scans). */
export interface RenderedPdfPage {
  image: string;
  nativeText: string;
}

/** Thrown when a PDF has more pages than page-by-page OCR handles; the caller sends the whole PDF instead. */
export class PdfRenderLimitError extends Error {
  constructor(readonly pages: number, readonly maxPages: number) {
    super(`PDF has ${pages} pages; page rendering is limited to ${maxPages}, so whole-document extraction is required`);
    this.name = 'PdfRenderLimitError';
  }
}

interface RunResult {
  stdout: string;
}

const run = (command: string, args: string[], timeoutMs: number): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        const detail = (stderr || '').trim().split('\n').slice(-2).join(' ').slice(0, 300);
        reject(new Error(`${command} failed${error.killed ? ` (timed out after ${timeoutMs} ms)` : ''}: ${detail || error.message}`));
        return;
      }
      resolve({ stdout });
    });
  });

/** pdfinfo output → page count. */
export const parsePageCount = (pdfinfoOutput: string): number => {
  const match = /^Pages:\s+(\d+)\s*$/m.exec(pdfinfoOutput);
  if (!match) throw new Error('pdfinfo did not report a page count');
  return Number.parseInt(match[1], 10);
};

/** pdftoppm names pages page-1.png or page-01.png depending on the page count; returns them in page order. */
export const orderPageImages = (fileNames: string[]): string[] =>
  fileNames
    .map((name) => ({ name, page: /^page-(\d+)\.png$/.exec(name) }))
    .filter((f): f is { name: string; page: RegExpExecArray } => f.page !== null)
    .sort((a, b) => Number(a.page[1]) - Number(b.page[1]))
    .map((f) => f.name);

/** Trims the layout text from pdftotext: no trailing spaces, no form feeds, no runs of blank lines. */
export const cleanLayoutText = (text: string): string =>
  text
    .replace(/\f/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Renders PDF pages with poppler (pdfinfo, pdftoppm, pdftotext), which ships in the backend image.
 * 144 dpi matches the previous pdf.js scale 2. The text keeps the page layout (columns aligned by spaces).
 * Temporary files go to a private directory that is always removed.
 */
export const renderPdfWithPoppler = async (
  pdfBuffer: Buffer,
  maxPages: number,
  options: { dpi?: number; timeoutMs?: number } = {}
): Promise<RenderedPdfPage[]> => {
  const dpi = options.dpi ?? 144;
  const timeoutMs = options.timeoutMs ?? 45_000;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pomon-pdf-'));
  try {
    const pdfPath = path.join(dir, 'input.pdf');
    await fs.writeFile(pdfPath, pdfBuffer);

    const pages = parsePageCount((await run('pdfinfo', [pdfPath], timeoutMs)).stdout);
    if (pages < 1) throw new Error('PDF has no pages');
    if (pages > maxPages) throw new PdfRenderLimitError(pages, maxPages);

    await run('pdftoppm', ['-png', '-r', String(dpi), pdfPath, path.join(dir, 'page')], timeoutMs);
    const images = orderPageImages(await fs.readdir(dir));
    if (images.length !== pages) throw new Error(`pdftoppm produced ${images.length} of ${pages} pages`);

    const out: RenderedPdfPage[] = [];
    for (let i = 0; i < images.length; i++) {
      const png = await fs.readFile(path.join(dir, images[i]));
      const pageNo = String(i + 1);
      const text = await run('pdftotext', ['-layout', '-enc', 'UTF-8', '-f', pageNo, '-l', pageNo, pdfPath, '-'], timeoutMs);
      out.push({ image: `data:image/png;base64,${png.toString('base64')}`, nativeText: cleanLayoutText(text.stdout) });
    }
    return out;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};
