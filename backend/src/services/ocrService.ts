import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { loadSettings, AppSettings } from '../routes/settingsRoutes';
import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { createRequire } from 'module';

export interface ExtractedPRFData {
  prfNo?: string;
  requestedBy?: string;
  department?: string;
  dateRaised?: string;
  dateRequired?: string;
  proposedSupplier?: string;
  totalAmount?: number;
  items?: Array<{
    rowNo?: number | string;
    partNumber?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    currency?: string;
    purchaseCostCode?: string;
    coaid?: number | string;
    budgetYear?: number | string;
  }>;
  projectDescription?: string;
  projectId?: string;
  referenceDrawingNumber?: string;
  generalLedgerCode?: string;
  budgeted?: boolean;
  underICTControl?: boolean;
  receivedPRDate?: string;
  entryDate?: string;
  status?: string;
  confidence?: number;
  requestFor?: string; // Auto-extracted from item descriptions
}

export type OCRExtractionMode = 'image' | 'pdf-single' | 'pdf-pages';

export interface OCRPdfDebug {
  renderedPages: number;
  maxPages: number;
  itemsPerPage: number[];
  mergedItems: number;
  usedFallback: boolean;
  fallbackReason?: string;
}

export interface OCRExtractionDebug {
  mode: OCRExtractionMode;
  openaiJsonRepairAttempts: number;
  pdf?: OCRPdfDebug;
}

export interface OCRExtractionResult {
  extractedData: ExtractedPRFData;
  debug: OCRExtractionDebug;
}

export class OCRService {
  private genAI: GoogleGenerativeAI | null = null;
  private openAI: OpenAI | null = null;

  private async initializeAI() {
    try {
      const settings = await loadSettings();
      
      if (settings.ocr.provider === 'openai' && settings.ocr.openaiApiKey) {
        this.openAI = new OpenAI({
          apiKey: settings.ocr.openaiApiKey
        });
      }
      
      if (settings.ocr.provider === 'gemini' && settings.ocr.geminiApiKey) {
        this.genAI = new GoogleGenerativeAI(settings.ocr.geminiApiKey);
      }
    } catch (error) {
      console.error('Failed to initialize AI services:', error);
    }
  }

  async testConnection(apiKey?: string, provider?: 'gemini' | 'openai'): Promise<{ success: boolean; message: string }> {
    try {
      const settings = await loadSettings();
      
      if (provider === 'openai' || (!provider && settings.ocr.provider === 'openai')) {
        const keyToTest = apiKey || settings.ocr.openaiApiKey;
        if (!keyToTest) {
          return { success: false, message: 'OpenAI API key not provided' };
        }
        return await this.testOpenAIConnection(keyToTest, settings);
      } else {
        const keyToTest = apiKey || settings.ocr.geminiApiKey;
        if (!keyToTest) {
          return { success: false, message: 'Gemini API key not provided' };
        }
        return await this.testGeminiConnection(keyToTest, settings);
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async testGeminiConnection(apiKey: string, settings: AppSettings): Promise<{ success: boolean; message: string }> {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: settings.ocr.model || 'gemini-1.5-flash' });
      
      const result = await model.generateContent('Test connection');
      const response = await result.response;
      
      if (response.text()) {
        return { success: true, message: 'Gemini API connection successful' };
      } else {
        return { success: false, message: 'Gemini API returned empty response' };
      }
    } catch (error) {
      return {
        success: false,
        message: `Gemini API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async testOpenAIConnection(apiKey: string, settings: AppSettings): Promise<{ success: boolean; message: string }> {
    try {
      const openAI = new OpenAI({ apiKey });
      const modelName = settings.ocr.model || 'gpt-4o-mini';
      
      const response = await openAI.chat.completions.create({
        model: modelName,
        messages: [{
          role: 'user',
          content: 'Test connection'
        }],
        max_tokens: 10
      });
      
      const text = response.choices[0]?.message?.content || '';
      if (text) {
        return { success: true, message: 'OpenAI API connection successful' };
      } else {
        return { success: false, message: 'OpenAI API returned empty response' };
      }
    } catch (error) {
      return {
        success: false,
        message: `OpenAI API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async getApiKey(): Promise<string | null> {
    try {
      const settings = await loadSettings();
      return settings.ocr.provider === 'openai' ? settings.ocr.openaiApiKey || null : settings.ocr.geminiApiKey || null;
    } catch (error) {
      console.error('Failed to load API key:', error);
      return null;
    }
  }

  async extractPRFData(imageBuffer: Buffer, mimeType: string): Promise<ExtractedPRFData> {
    const res = await this.extractPRFDataWithDebug(imageBuffer, mimeType);
    return res.extractedData;
  }

  async extractPRFDataWithDebug(imageBuffer: Buffer, mimeType: string): Promise<OCRExtractionResult> {
    await this.initializeAI();
    
    const settings = await loadSettings();
    
    if (settings.ocr.provider === 'openai' && this.openAI) {
      if (mimeType === 'application/pdf') {
        return await this.extractPdfWithOpenAIByPages(imageBuffer, settings);
      }
      const debugState = { openaiJsonRepairAttempts: 0 };
      const extractedData = await this.extractWithOpenAI(imageBuffer, mimeType, settings, debugState);
      return {
        extractedData,
        debug: {
          mode: 'image',
          openaiJsonRepairAttempts: debugState.openaiJsonRepairAttempts
        }
      };
    } else if (settings.ocr.provider === 'gemini' && this.genAI) {
      // Note: Gemini currently only supports images, not PDFs
      if (mimeType === 'application/pdf') {
        throw new Error('PDF processing is only supported with OpenAI provider. Please switch to OpenAI in settings or convert PDF to image.');
      }
      const extractedData = await this.extractWithGemini(imageBuffer, mimeType, settings);
      return {
        extractedData,
        debug: {
          mode: 'image',
          openaiJsonRepairAttempts: 0
        }
      };
    } else {
      throw new Error('OCR service not properly configured');
    }
  }

  private parseJsonLenient(raw: string): ExtractedPRFData {
    const direct = raw.trim();
    const jsonMatch = direct.match(/\{[\s\S]*\}/);
    const extracted = (jsonMatch ? jsonMatch[0] : direct).trim();
    const extractedNoNulls = extracted.split('\u0000').join('').trim();

    const candidates = [
      direct,
      extracted,
      extractedNoNulls,
      extractedNoNulls.replace(/,\s*([}\]])/g, '$1').trim(),
      extractedNoNulls.replace(/}\s*{/g, '},{').replace(/,\s*([}\]])/g, '$1').trim()
    ];

    for (const c of candidates) {
      try {
        return JSON.parse(c) as ExtractedPRFData;
      } catch {
        continue;
      }
    }

    throw new Error('No valid JSON found in OCR response');
  }

  private async repairWithOpenAI(
    rawOutput: string,
    settings: AppSettings,
    debugState?: { openaiJsonRepairAttempts: number }
  ): Promise<string> {
    if (debugState) {
      debugState.openaiJsonRepairAttempts += 1;
    }
    const modelName = settings.ocr.model || 'gpt-4o-mini';
    const repairResponse = await this.openAI!.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'user',
          content:
            'Fix and return ONLY a valid JSON object for this PRF extraction output. Do not add any extra text.\n\n' +
            rawOutput
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0
    });
    return repairResponse.choices[0]?.message?.content || '';
  }

  private async renderPdfPagesToPngDataUrls(pdfBuffer: Buffer, maxPages: number): Promise<string[]> {
    const tmpDir = path.join(process.cwd(), 'temp', 'ocr-pdf-render');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpPdfPath = path.join(tmpDir, `ocr-${Date.now()}-${Math.random().toString(16).slice(2)}.pdf`);
    await fs.writeFile(tmpPdfPath, pdfBuffer);

    const requireFunc = createRequire(__filename);
    let pdfJsScriptPath: string | null = null;
    let pdfWorkerScriptPath: string | null = null;
    try {
      pdfJsScriptPath = requireFunc.resolve('pdfjs-dist/legacy/build/pdf.min.mjs');
      pdfWorkerScriptPath = requireFunc.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
    } catch {
      void 0;
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1600, height: 2200, deviceScaleFactor: 2 });
      await page.goto('about:blank');

      let workerSrc: string | null = null;
      if (pdfJsScriptPath && pdfWorkerScriptPath) {
        await page.addScriptTag({ path: pdfJsScriptPath, type: 'module' });
        const workerContent = await fs.readFile(pdfWorkerScriptPath, 'utf-8');
        workerSrc = await page.evaluate((content: string) => {
          const blob = new Blob([content], { type: 'application/javascript' });
          return URL.createObjectURL(blob);
        }, workerContent);
      } else {
        await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.js' });
        await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.js' });
        workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.js';
      }

      const dataUrls = await page.evaluate(
        async (pdfBase64: string, max: number, workerSrcUrl: string) => {
          const pdfjsLib = (globalThis as unknown as { pdfjsLib?: unknown }).pdfjsLib;
          if (!pdfjsLib) throw new Error('pdfjsLib not loaded');
          const lib = pdfjsLib as unknown as {
            GlobalWorkerOptions: { workerSrc: string };
            getDocument: (arg: unknown) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<unknown> }> };
          };
          lib.GlobalWorkerOptions.workerSrc = workerSrcUrl;

          const atobFn = (globalThis as unknown as { atob?: (s: string) => string }).atob;
          if (!atobFn) throw new Error('atob not available');
          const binaryString = atobFn(pdfBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

          const doc = await lib.getDocument({ data: bytes }).promise;
          const total = doc.numPages;
          const take = Math.min(total, max);
          const out: string[] = [];
          for (let pageNo = 1; pageNo <= take; pageNo++) {
            const p = (await doc.getPage(pageNo)) as unknown as {
              getViewport: (opts: { scale: number }) => { width: number; height: number };
              render: (opts: { canvasContext: unknown; viewport: unknown }) => { promise: Promise<unknown> };
            };
            const viewport = p.getViewport({ scale: 2.0 });
            const dom = (globalThis as unknown as { document?: { createElement: (tag: string) => unknown } }).document;
            if (!dom) throw new Error('document not available');
            const canvas = dom.createElement('canvas') as unknown as {
              width: number;
              height: number;
              getContext: (kind: '2d') => unknown;
              toDataURL: (type: 'image/png') => string;
            };
            const ctx = canvas.getContext('2d') as unknown as Record<string, unknown> | null;
            if (!ctx) throw new Error('canvas context not available');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            await p.render({ canvasContext: ctx, viewport }).promise;
            out.push(canvas.toDataURL('image/png'));
          }
          return out;
        },
        pdfBuffer.toString('base64'),
        maxPages,
        workerSrc || ''
      );

      return dataUrls;
    } finally {
      await browser.close();
      try {
        await fs.unlink(tmpPdfPath);
      } catch {
        void 0;
      }
    }
  }

  private mergePageExtractions(pages: ExtractedPRFData[]): ExtractedPRFData {
    const merged: ExtractedPRFData = { confidence: 0.5, items: [] };
    const takeFirst = <T>(get: (d: ExtractedPRFData) => T | undefined): T | undefined => {
      for (const p of pages) {
        const v = get(p);
        if (v !== undefined && v !== null && (typeof v !== 'string' || v.trim().length > 0)) return v;
      }
      return undefined;
    };

    merged.prfNo = takeFirst((d) => d.prfNo);
    merged.requestedBy = takeFirst((d) => d.requestedBy);
    merged.department = takeFirst((d) => d.department);
    merged.proposedSupplier = takeFirst((d) => d.proposedSupplier);
    merged.projectDescription = takeFirst((d) => d.projectDescription);
    merged.projectId = takeFirst((d) => d.projectId);
    merged.referenceDrawingNumber = takeFirst((d) => d.referenceDrawingNumber);
    merged.generalLedgerCode = takeFirst((d) => d.generalLedgerCode);
    merged.requestFor = takeFirst((d) => d.requestFor);
    merged.budgeted = takeFirst((d) => d.budgeted);
    merged.underICTControl = takeFirst((d) => d.underICTControl);
    merged.dateRaised = takeFirst((d) => d.dateRaised);
    merged.dateRequired = takeFirst((d) => d.dateRequired);
    merged.receivedPRDate = takeFirst((d) => d.receivedPRDate);
    merged.entryDate = takeFirst((d) => d.entryDate);
    merged.status = takeFirst((d) => d.status);

    const amounts = pages
      .map((p) => p.totalAmount)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
    if (amounts.length > 0) {
      merged.totalAmount = Math.max(...amounts);
    }

    const allItems = pages.flatMap((p) => (p.items || []).filter((it) => it && (it.description || it.partNumber)));
    const seen = new Set<string>();
    const deduped: NonNullable<ExtractedPRFData['items']> = [];
    for (const it of allItems) {
      const rowNo = typeof it.rowNo === 'number' ? it.rowNo : typeof it.rowNo === 'string' ? Number.parseInt(it.rowNo.trim(), 10) : Number.NaN;
      const desc = typeof it.description === 'string' ? it.description.trim().toLowerCase() : '';
      const part = typeof it.partNumber === 'string' ? it.partNumber.trim().toLowerCase() : '';
      const qty = typeof it.quantity === 'number' ? it.quantity : '';
      const price = typeof it.unitPrice === 'number' ? it.unitPrice : '';
      const code = typeof it.purchaseCostCode === 'string' ? it.purchaseCostCode.trim().toLowerCase() : '';
      const key = Number.isInteger(rowNo) && rowNo > 0 ? `row|${rowNo}` : `${part}|${desc}|${qty}|${price}|${code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(it);
    }
    merged.items = deduped;

    const confs = pages
      .map((p) => p.confidence)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1);
    if (confs.length > 0) {
      merged.confidence = Math.max(...confs);
    }

    return this.validateAndCleanData(merged);
  }

  private async extractPdfWithOpenAIByPages(pdfBuffer: Buffer, settings: AppSettings): Promise<OCRExtractionResult> {
    const maxPagesRaw = process.env.OCR_PDF_MAX_PAGES || '';
    const maxPagesParsed = maxPagesRaw ? Number.parseInt(maxPagesRaw, 10) : Number.NaN;
    const maxPages = Number.isInteger(maxPagesParsed) && maxPagesParsed > 0 ? maxPagesParsed : 6;

    const debugState = { openaiJsonRepairAttempts: 0 };

    let images: string[] = [];
    try {
      images = await this.renderPdfPagesToPngDataUrls(pdfBuffer, maxPages);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      console.warn('PDF page rendering failed, falling back to single-pass PDF OCR:', error);
      const extractedData = await this.extractWithOpenAI(pdfBuffer, 'application/pdf', settings, debugState);
      return {
        extractedData,
        debug: {
          mode: 'pdf-single',
          openaiJsonRepairAttempts: debugState.openaiJsonRepairAttempts,
          pdf: {
            renderedPages: 0,
            maxPages,
            itemsPerPage: [],
            mergedItems: Array.isArray(extractedData.items) ? extractedData.items.length : 0,
            usedFallback: true,
            fallbackReason: reason
          }
        }
      };
    }

    const modelName = settings.ocr.model || 'gpt-4o-mini';
    const pages: ExtractedPRFData[] = [];
    const itemsPerPage: number[] = [];
    for (let i = 0; i < images.length; i++) {
      const pageNumber = i + 1;
      const totalPages = images.length;
      const pagePrompt = `This is page ${pageNumber} of ${totalPages} for a Purchase Request Form (PRF).
Extract PRF fields in JSON format. If a field is not present on this page, use null.
For items, extract ONLY the item rows visible on this page. Extract EVERY row shown on this page; do not stop early.
If the table has a "No." / numbering column, always extract it as rowNo and keep the original number for each row.
Keep description concise (max 80 characters). Do not include URLs in description.

Return ONLY a valid JSON object with this structure:
{
  "prfNo": "string or null",
  "requestedBy": "string or null",
  "department": "string or null",
  "dateRaised": "string or null",
  "dateRequired": "string or null",
  "proposedSupplier": "string or null",
  "totalAmount": number or null,
  "items": [
    {
      "rowNo": number or null,
      "partNumber": "string or null",
      "description": "string or null",
      "quantity": number or null,
      "unitPrice": number or null,
      "totalPrice": number or null,
      "currency": "string or null",
      "purchaseCostCode": "string or null"
    }
  ],
  "projectDescription": "string or null",
  "projectId": "string or null",
  "referenceDrawingNumber": "string or null",
  "generalLedgerCode": "string or null",
  "requestFor": "string or null",
  "budgeted": boolean or null,
  "underICTControl": boolean or null,
  "receivedPRDate": "string or null",
  "entryDate": "string or null",
  "status": "string or null",
  "confidence": number
}

CRITICAL: For Cost Code / General Ledger Code / Project #, extract from the rightmost column of the items table. Valid examples: AMITOMTI9.6250, 12710806.6250, MTIRMRAD496328. Do not return amounts.`;

      const resp = await this.openAI!.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: pagePrompt },
              { type: 'image_url', image_url: { url: images[i] } }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 8000,
        temperature: 0
      });

      const text = resp.choices[0]?.message?.content || '';
      let extracted: ExtractedPRFData;
      try {
        extracted = this.parseJsonLenient(text);
      } catch {
        const repaired = await this.repairWithOpenAI(text, settings, debugState);
        extracted = this.parseJsonLenient(repaired);
      }
      const cleaned = this.validateAndCleanData(extracted);
      pages.push(cleaned);
      itemsPerPage.push(Array.isArray(cleaned.items) ? cleaned.items.length : 0);
    }

    const merged = this.mergePageExtractions(pages);
    return {
      extractedData: merged,
      debug: {
        mode: 'pdf-pages',
        openaiJsonRepairAttempts: debugState.openaiJsonRepairAttempts,
        pdf: {
          renderedPages: images.length,
          maxPages,
          itemsPerPage,
          mergedItems: Array.isArray(merged.items) ? merged.items.length : 0,
          usedFallback: false
        }
      }
    };
  }

  private async extractWithGemini(imageBuffer: Buffer, mimeType: string, settings: AppSettings): Promise<ExtractedPRFData> {
    try {
      const model = this.genAI!.getGenerativeModel({ model: settings.ocr.model || 'gemini-1.5-flash' });
      
      const prompt = `Analyze this Purchase Request Form (PRF) document and extract the following information in JSON format.
Be very careful to extract exact values as they appear in the document.

Please extract:
1. PRF No (Purchase Request Form number)
2. Requested By (person who requested)
3. Department
4. Date Raised/Date Requested
5. Date Required
6. Proposed Supplier
7. Total Amount (convert to number)
8. Items list with:
   - Part Number/Part #
   - Item Description
   - Quantity (Qty)
   - Unit of Measure (UOM)
   - Currency
   - Unit Price
   - Total Price
   - Cost Code/General Ledger Code (CRITICAL: Extract the specific cost code for THIS item from the rightmost column. Each item may have a different cost code. Look for alphanumeric codes like 'MTIRMRAD496328' in the 'General Ledger Code/Project #' column for each individual item row)
9. Project Description/Area (if not explicitly provided, generate a concise description based on the item descriptions)
10. Project ID
11. Reference Drawing Number
12. Cost Code/General Ledger Code (CRITICAL: Extract cost codes from the rightmost column of the items table. Cost codes can be alphanumeric (e.g., 'MTIRMRAD496328') or numeric (e.g., '12710806.6250'). DO NOT use total amounts, subtotals, or summary values from the bottom of the form)
   - Extract cost codes from the rightmost column of the items table, not total amounts
   - Cost codes appear in individual item rows, not in summary totals
   - Look for cost codes in the "General Ledger Code/Project #" column (typically the last column)
   - Cost codes can be alphanumeric strings like "MTIRMRAD496328" or numeric like "12710806.6250"
   - Avoid extracting values that appear in summary/total sections at the bottom of the form
   - Focus on the far-right side of each item row in the table
13. Budgeted (Yes/No checkbox)
14. Under ICT Control (Yes/No checkbox)
15. Received PR date
16. Entry date
17. Any status information
18. Request For (extract from item descriptions any text that starts with 'FOR' or 'For'. But if For pattern not found, you have to make conclution from the item description).

IMPORTANT INSTRUCTIONS:
- If Project Description/Area is not explicitly filled in the form, automatically generate a brief, professional description based on the item descriptions
- Look for 'FOR' or 'For' text in item descriptions and extract it as 'Request For' information
- The generated project description should summarize what the items are for in 1-2 sentences
- CRITICAL: For Cost Code/General Ledger Code, extract codes from the rightmost column of the items table. Cost codes can be alphanumeric (e.g., 'MTIRMRAD496328') or numeric (e.g., '12710806.6250'). DO NOT use total amounts, subtotals, or summary values from the bottom of the form
- Cost codes can be alphanumeric strings or numeric values that appear in individual item rows, not summary totals

Return ONLY a valid JSON object with this structure:
{
  "prfNo": "string",
  "requestedBy": "string",
  "department": "string",
  "dateRaised": "YYYY-MM-DD or original format",
  "dateRequired": "YYYY-MM-DD or original format",
  "proposedSupplier": "string",
  "totalAmount": number,
  "items": [
    {
      "partNumber": "string",
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number,
      "currency": "string",
      "purchaseCostCode": "string", // Cost code specific to this item
      "coaid": number, // Chart of Accounts ID if available
      "budgetYear": number // Budget year for this item
    }
  ],
  "projectDescription": "string", // Auto-generate if not explicitly provided
  "projectId": "string",
  "referenceDrawingNumber": "string", // This represents the cost code
  "requestFor": "string", // Extract 'FOR' text from item descriptions
  "budgeted": boolean,
  "underICTControl": boolean,
  "receivedPRDate": "string",
  "entryDate": "string",
  "status": "string",
  "confidence": number (0-1, your confidence in the extraction)
}

If a field is not found or unclear, use null for that field.
For dates, try to convert to YYYY-MM-DD format if possible, otherwise keep original format.
For amounts, extract only the numeric value without currency symbols.`;

      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType
        }
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      
      // Clean up the response to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in OCR response');
      }
      
      const extractedData = JSON.parse(jsonMatch[0]) as ExtractedPRFData;
      
      // Validate and clean the extracted data
      return this.validateAndCleanData(extractedData);
      
    } catch (error) {
      console.error('Gemini OCR extraction failed:', error);
      throw new Error(`Gemini OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractWithOpenAI(
    imageBuffer: Buffer,
    mimeType: string,
    settings: AppSettings,
    debugState?: { openaiJsonRepairAttempts: number }
  ): Promise<ExtractedPRFData> {
    try {
      const modelName = settings.ocr.model || 'gpt-4o-mini';
      
      const prompt = `Analyze this Purchase Request Form (PRF) document and extract the following information in JSON format.
Be very careful to extract exact values as they appear in the document.

Please extract:
1. PRF No (Purchase Request Form number, Number Only, e.g. 33155)
2. Requested By (person who requested)
3. Department
4. Date Raised/Date Requested
5. Date Required
6. Proposed Supplier
7. Total Amount (convert to number)
8. Items list with:
   - Part Number/Part #
   - Item Description
   - Quantity (Qty)
   - Unit of Measure (UOM)
   - Currency
   - Unit Price
   - Total Price
   - Cost Code / General Ledger Code / Project # (CRITICAL: extract from the rightmost column "General Ledger Code/Project #")
     - If the same code applies to all items (single code shown for the whole table), repeat it for every item in purchaseCostCode
     - If each row has its own code, extract each row's code into purchaseCostCode
9. Project Description/Area (if not explicitly provided, generate a concise description based on the item descriptions)
10. Project ID
11. Reference Drawing Number
12. Cost Code/General Ledger Code (CRITICAL: Extract cost codes from the rightmost column of the items table. Cost codes can be alphanumeric (e.g., 'MTIRMRAD496328') or numeric (e.g., '12710806.6250'). DO NOT use total amounts, subtotals, or summary values from the bottom of the form)
   - Extract cost codes from the rightmost column of the items table, not total amounts
   - Cost codes appear in individual item rows, not in summary totals
   - Look for cost codes in the "General Ledger Code/Project #" column (typically the last column)
   - Cost codes can be alphanumeric strings like "MTIRMRAD496328" or numeric like "12710806.6250"
   - Avoid extracting values that appear in summary/total sections at the bottom of the form
   - Focus on the far-right side of each item row in the table
13. Budgeted (Yes/No checkbox)
14. Under ICT Control (Yes/No checkbox)
15. Received PR date
16. Entry date
17. Any status information
18. Request For (extract from item descriptions any text that starts with 'FOR' or 'For'. But if For pattern not found, you have to make conclution from the item description).

IMPORTANT INSTRUCTIONS:
- If Project Description/Area is not explicitly filled in the form, automatically generate a brief, professional description based on the item descriptions
- Look for 'FOR' or 'For' text in item descriptions and extract it as 'Request For' information
- The generated project description should summarize what the items are for in 1-2 sentences
- CRITICAL: For Cost Code/General Ledger Code, extract codes from the rightmost column of the items table. This may be a single code for all rows or unique per row. Always output per-row in items[].purchaseCostCode.
- Valid code formats include alphanumeric codes and mixed codes with dot suffix like "AMITOMTI9.6250" as well as numeric codes like "12710806.6250". Do not output currency amounts.

Return ONLY a valid JSON object with this structure:
{
  "prfNo": "string",
  "requestedBy": "string",
  "department": "string",
  "dateRaised": "YYYY-MM-DD or original format",
  "dateRequired": "YYYY-MM-DD or original format",
  "proposedSupplier": "string",
  "totalAmount": number,
  "items": [
    {
      "partNumber": "string",
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number,
      "currency": "string",
      "purchaseCostCode": "string"
    }
  ],
  "projectDescription": "string", // Auto-generate if not explicitly provided
  "projectId": "string",
  "referenceDrawingNumber": "string",
  "generalLedgerCode": "string", // if there is a single shared code for all items, set it here too
  "requestFor": "string", // Extract 'FOR' text from item descriptions
  "budgeted": boolean,
  "underICTControl": boolean,
  "receivedPRDate": "string",
  "entryDate": "string",
  "status": "string",
  "confidence": number (0-1, your confidence in the extraction)
}

If a field is not found or unclear, use null for that field.
For dates, try to convert to YYYY-MM-DD format if possible, otherwise keep original format.
For amounts, extract only the numeric value without currency symbols.
For projectDescription: if not explicitly provided in the form, generate a brief description based on item descriptions.
For requestFor: look for text starting with 'FOR' or 'For' in item descriptions and extract it.`;

      // Determine content type based on file type
      let contentItem: {
        type: 'file';
        file: {
          filename: string;
          file_data: string;
        };
      } | {
        type: 'image_url';
        image_url: {
          url: string;
        };
      };
      
      if (mimeType === 'application/pdf') {
        // For PDF files, use file type
        contentItem = {
          type: 'file' as const,
          file: {
            filename: 'document.pdf',
            file_data: `data:application/pdf;base64,${imageBuffer.toString('base64')}`
          }
        };
      } else {
        // For images, use image_url type
        contentItem = {
          type: 'image_url' as const,
          image_url: {
            url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`
          }
        };
      }

      const response = await this.openAI!.chat.completions.create({
        model: modelName,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            contentItem
          ]
        }],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        temperature: 0
      });
      
      const text = response.choices[0]?.message?.content || '';

      let extractedData: ExtractedPRFData;
      try {
        extractedData = this.parseJsonLenient(text);
      } catch {
        const repaired = await this.repairWithOpenAI(text, settings, debugState);
        extractedData = this.parseJsonLenient(repaired);
      }
      
      // Validate and clean the extracted data
      return this.validateAndCleanData(extractedData);
      
    } catch (error) {
      console.error('OpenAI OCR extraction failed:', error);
      throw new Error(`OpenAI OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateAndCleanData(data: ExtractedPRFData): ExtractedPRFData {
    // Clean and validate the extracted data
    const cleaned: ExtractedPRFData = {
      confidence: data.confidence || 0.5
    };

    // Clean string fields
    if (data.prfNo && typeof data.prfNo === 'string') {
      cleaned.prfNo = data.prfNo.trim();
    }
    
    if (data.requestedBy && typeof data.requestedBy === 'string') {
      cleaned.requestedBy = data.requestedBy.trim();
    }
    
    if (data.department && typeof data.department === 'string') {
      cleaned.department = data.department.trim();
    }
    
    if (data.proposedSupplier && typeof data.proposedSupplier === 'string') {
      cleaned.proposedSupplier = data.proposedSupplier.trim();
    }
    
    if (data.projectDescription && typeof data.projectDescription === 'string') {
      cleaned.projectDescription = data.projectDescription.trim();
    }
    
    if (data.projectId && typeof data.projectId === 'string') {
      cleaned.projectId = data.projectId.trim();
    }
    
    if (data.referenceDrawingNumber && typeof data.referenceDrawingNumber === 'string') {
      cleaned.referenceDrawingNumber = data.referenceDrawingNumber.trim();
    }
    
    if (data.generalLedgerCode && typeof data.generalLedgerCode === 'string') {
      const trimmedCode = data.generalLedgerCode.trim();
      // Validate cost code format - should be alphanumeric, not pure numbers
      if (this.isValidCostCode(trimmedCode)) {
        cleaned.generalLedgerCode = trimmedCode;
      } else {
        console.warn(`Invalid cost code format detected: '${trimmedCode}' - appears to be a numeric amount rather than a cost code`);
        // Don't set the cost code if it appears to be a numeric amount
      }
    }
    
    if (data.status && typeof data.status === 'string') {
      cleaned.status = data.status.trim();
    }
    
    if (data.requestFor && typeof data.requestFor === 'string') {
      cleaned.requestFor = data.requestFor.trim();
    }

    // Clean date fields
    if (data.dateRaised) {
      cleaned.dateRaised = this.cleanDate(data.dateRaised);
    }
    
    if (data.dateRequired) {
      cleaned.dateRequired = this.cleanDate(data.dateRequired);
    }
    
    if (data.receivedPRDate) {
      cleaned.receivedPRDate = this.cleanDate(data.receivedPRDate);
    }
    
    if (data.entryDate) {
      cleaned.entryDate = this.cleanDate(data.entryDate);
    }

    // Clean numeric fields
    if (data.totalAmount !== undefined && data.totalAmount !== null) {
      const amount = typeof data.totalAmount === 'string' 
        ? parseFloat(String(data.totalAmount).replace(/[^\d.-]/g, ''))
        : Number(data.totalAmount);
      
      if (!isNaN(amount)) {
        cleaned.totalAmount = amount;
      }
    }

    // Clean boolean fields
    if (data.budgeted !== undefined && data.budgeted !== null) {
      cleaned.budgeted = Boolean(data.budgeted);
    }
    
    if (data.underICTControl !== undefined && data.underICTControl !== null) {
      cleaned.underICTControl = Boolean(data.underICTControl);
    }

    // Clean items array
    if (data.items && Array.isArray(data.items)) {
      cleaned.items = data.items.map(item => {
        const cleanedItem: Partial<{
          rowNo?: number;
          partNumber?: string;
          description?: string;
          quantity?: number;
          unitPrice?: number;
          totalPrice?: number;
          currency?: string;
          purchaseCostCode?: string;
          coaid?: number;
          budgetYear?: number;
        }> = {};

        if (item.rowNo !== undefined && item.rowNo !== null) {
          const parsed = typeof item.rowNo === 'string'
            ? Number.parseInt(String(item.rowNo).replace(/[^\d-]/g, ''), 10)
            : Number(item.rowNo);
          if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0) {
            cleanedItem.rowNo = parsed;
          }
        }
        
        if (item.partNumber && typeof item.partNumber === 'string') {
          cleanedItem.partNumber = item.partNumber.trim();
        }
        
        if (item.description && typeof item.description === 'string') {
          cleanedItem.description = item.description.trim();
        }
        
        if (item.currency && typeof item.currency === 'string') {
          cleanedItem.currency = item.currency.trim();
        }
        
        if (item.purchaseCostCode && typeof item.purchaseCostCode === 'string') {
          const trimmed = item.purchaseCostCode.trim();
          if (this.isValidCostCode(trimmed)) {
            cleanedItem.purchaseCostCode = trimmed;
          }
        }

        if (item.coaid !== undefined && item.coaid !== null) {
          const parsed = typeof item.coaid === 'string'
            ? Number.parseInt(String(item.coaid).replace(/[^\d-]/g, ''), 10)
            : Number(item.coaid);
          if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0) {
            cleanedItem.coaid = parsed;
          }
        }

        if (item.budgetYear !== undefined && item.budgetYear !== null) {
          const parsed = typeof item.budgetYear === 'string'
            ? Number.parseInt(String(item.budgetYear).replace(/[^\d-]/g, ''), 10)
            : Number(item.budgetYear);
          if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100) {
            cleanedItem.budgetYear = parsed;
          }
        }

        if (item.quantity !== undefined && item.quantity !== null) {
          const qty = typeof item.quantity === 'string' 
            ? parseFloat(String(item.quantity).replace(/[^\d.-]/g, ''))
            : Number(item.quantity);
          
          if (!isNaN(qty)) {
            cleanedItem.quantity = qty;
          }
        }
        
        if (item.unitPrice !== undefined && item.unitPrice !== null) {
          const price = typeof item.unitPrice === 'string' 
            ? parseFloat(String(item.unitPrice).replace(/[^\d.-]/g, ''))
            : Number(item.unitPrice);
          
          if (!isNaN(price)) {
            cleanedItem.unitPrice = price;
          }
        }
        
        if (item.totalPrice !== undefined && item.totalPrice !== null) {
          const total = typeof item.totalPrice === 'string' 
            ? parseFloat(String(item.totalPrice).replace(/[^\d.-]/g, ''))
            : Number(item.totalPrice);
          
          if (!isNaN(total)) {
            cleanedItem.totalPrice = total;
          }
        }
        
        return cleanedItem;
      }).filter(item => item.description || item.partNumber); // Only keep items with some content
    }

    const items = cleaned.items ?? [];
    const itemCodes = items
      .map((it) => it.purchaseCostCode)
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim());
    const uniqueCodes = Array.from(new Set<string>(itemCodes));

    if (uniqueCodes.length === 1) {
      cleaned.generalLedgerCode = uniqueCodes[0];
      if (items.length > 0) {
        cleaned.items = items.map((it) => ({
          ...it,
          purchaseCostCode: it.purchaseCostCode || uniqueCodes[0]
        }));
      }
    } else if (uniqueCodes.length > 1) {
      cleaned.generalLedgerCode = undefined;
    } else if (cleaned.generalLedgerCode && items.length > 0) {
      cleaned.items = items.map((it) => ({
        ...it,
        purchaseCostCode: it.purchaseCostCode || cleaned.generalLedgerCode
      }));
    }

    return cleaned;
  }

  private cleanDate(dateStr: string): string {
    if (!dateStr) return '';
    
    // Try to parse and format the date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }
    
    // If parsing fails, return the original string trimmed
    return String(dateStr).trim();
  }

  private isValidCostCode(code: string): boolean {
    if (!code || code.length === 0) return false;
    
    // Remove any whitespace and common separators
    const cleanCode = code.replace(/[\s,-]/g, '');
    
    // Reject obvious non-cost-code patterns
    if (this.isLikelyNotCostCode(cleanCode)) {
      return false;
    }
    
    // Check for valid cost code patterns
    return this.matchesCostCodePattern(cleanCode);
  }

  private isLikelyNotCostCode(code: string): boolean {
    // Very small numbers (1-3 digits) are likely quantities, not cost codes
    if (/^\d{1,3}$/.test(code)) {
      return true;
    }
    
    // Common non-cost-code patterns (but exclude valid numeric cost codes)
    const nonCostCodePatterns = [
      /^\d{1,2}$/, // Single/double digits (quantities)
      /^\d{1,3}(,\d{3})*$/, // Formatted numbers with commas (amounts)
      /^(yes|no|n\/a|tbd|pending)$/i, // Common form values
    ];
    
    // Check for obvious price patterns (small decimal amounts)
    if (/^\d+\.\d+$/.test(code)) {
      const numValue = parseFloat(code);
      // Small decimal amounts (< 10000) are likely prices, not cost codes
      if (numValue < 10000) return true;
    }
    
    return nonCostCodePatterns.some(pattern => pattern.test(code));
  }

  private matchesCostCodePattern(code: string): boolean {
    // Must be at least 3 characters
    if (code.length < 3) return false;
    
    // Valid cost code patterns
    const costCodePatterns = [
      /^[A-Z]{2,}[A-Z0-9]+$/i, // Letters followed by alphanumeric (MTIRMRAD496328)
      /^[A-Z]+\d+$/i, // Letters followed by numbers (ABC123)
      /^\d+[A-Z]+$/i, // Numbers followed by letters (123ABC)
      /^[A-Z0-9]+-[A-Z0-9]+$/i, // Alphanumeric with dash (PROJECT-001)
      /^[A-Z]{1,4}\d{3,}$/i, // 1-4 letters + 3+ digits (MT123456)
      /^[A-Z]+[A-Z0-9]*\d+\.\d{4}$/i, // Mixed alphanumeric with decimal suffix (AMITOMTI9.6250)
      /^\d{6,}\.\d{4}$/i, // Numeric cost codes with decimal (12710806.6250)
      /^\d{8,}$/i, // Long numeric cost codes (12710806)
    ];
    
    // Check if it matches any valid pattern
    return costCodePatterns.some(pattern => pattern.test(code));
  }

  async isEnabled(): Promise<boolean> {
    try {
      const settings = await loadSettings();
      const hasApiKey = settings.ocr.provider === 'openai' 
        ? !!settings.ocr.openaiApiKey 
        : !!settings.ocr.geminiApiKey;
      return settings.ocr.enabled && hasApiKey;
    } catch (error) {
      return false;
    }
  }
}

export const ocrService = new OCRService();
