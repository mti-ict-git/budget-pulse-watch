import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { loadSettings, AppSettings } from '../routes/settingsRoutes';
import fs from 'fs/promises';
import path from 'path';

export interface ExtractedPRFData {
  prfNo?: string;
  requestedBy?: string;
  department?: string;
  dateRaised?: string;
  dateRequired?: string;
  proposedSupplier?: string;
  totalAmount?: number;
  items?: Array<{
    partNumber?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    currency?: string;
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
}

export class OCRService {
  private genAI: GoogleGenerativeAI | null = null;
  private openAI: OpenAI | null = null;

  constructor() {
    this.initializeAI();
  }

  private async initializeAI() {
    try {
      const settings = await loadSettings();
      if (settings.ocr.enabled) {
        const provider = settings.ocr.provider || 'gemini';
        
        if (provider === 'gemini' && settings.ocr.geminiApiKey) {
          this.genAI = new GoogleGenerativeAI(settings.ocr.geminiApiKey);
          this.openAI = null;
        } else if (provider === 'openai' && settings.ocr.openaiApiKey) {
          this.openAI = new OpenAI({ apiKey: settings.ocr.openaiApiKey });
          this.genAI = null;
        }
      }
    } catch (error) {
      console.error('Failed to initialize OCR service:', error);
    }
  }

  async testConnection(apiKey?: string, provider?: 'gemini' | 'openai'): Promise<{ success: boolean; message: string }> {
    try {
      const settings = await loadSettings();
      const testProvider = provider || settings.ocr.provider || 'gemini';
      const keyToTest = apiKey || (testProvider === 'openai' ? settings.ocr.openaiApiKey : settings.ocr.geminiApiKey);
      
      if (!keyToTest) {
        return {
          success: false,
          message: 'No API key provided'
        };
      }

      if (testProvider === 'gemini') {
        return await this.testGeminiConnection(keyToTest, settings);
      } else if (testProvider === 'openai') {
        return await this.testOpenAIConnection(keyToTest, settings);
      } else {
        return {
          success: false,
          message: 'Unsupported provider'
        };
      }
    } catch (error) {
      console.error('OCR API test failed:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  private async testGeminiConnection(apiKey: string, settings: AppSettings): Promise<{ success: boolean; message: string }> {
    try {
      const modelName = settings.ocr.model || 'gemini-1.5-flash';
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // Simple test prompt
      const result = await model.generateContent('Hello, this is a test. Please respond with "API key is working".');
      const response = await result.response;
      const text = response.text();
      
      if (text.toLowerCase().includes('api key is working')) {
        return { success: true, message: 'Gemini API key is valid and working' };
      } else {
        return { success: true, message: 'Gemini API key is valid but response was unexpected' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Gemini API test failed' 
      };
    }
  }

  private async testOpenAIConnection(apiKey: string, settings: AppSettings): Promise<{ success: boolean; message: string }> {
    try {
      const modelName = settings.ocr.model || 'gpt-4o-mini';
      const openai = new OpenAI({ apiKey });
      
      // Simple test prompt
      const response = await openai.chat.completions.create({
        model: modelName,
        messages: [{
          role: 'user',
          content: 'Hello, this is a test. Please respond with "API key is working".'
        }],
        max_tokens: 50
      });
      
      const text = response.choices[0]?.message?.content || '';
      
      if (text.toLowerCase().includes('api key is working')) {
        return { success: true, message: 'OpenAI API key is valid and working' };
      } else {
        return { success: true, message: 'OpenAI API key is valid but response was unexpected' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'OpenAI API test failed' 
      };
    }
  }

  private async getApiKey(): Promise<string | null> {
    try {
      const settings = await loadSettings();
      const provider = settings.ocr.provider || 'gemini';
      return provider === 'openai' ? settings.ocr.openaiApiKey || null : settings.ocr.geminiApiKey || null;
    } catch {
      return null;
    }
  }

  async extractPRFData(imageBuffer: Buffer, mimeType: string): Promise<ExtractedPRFData> {
    await this.initializeAI();
    
    const settings = await loadSettings();
    const provider = settings.ocr.provider || 'gemini';
    
    if (provider === 'gemini') {
      if (!this.genAI) {
        throw new Error('Gemini OCR service not initialized. Please configure Gemini API key in settings.');
      }
      return await this.extractWithGemini(imageBuffer, mimeType, settings);
    } else if (provider === 'openai') {
      if (!this.openAI) {
        throw new Error('OpenAI OCR service not initialized. Please configure OpenAI API key in settings.');
      }
      return await this.extractWithOpenAI(imageBuffer, mimeType, settings);
    } else {
      throw new Error('Unsupported OCR provider. Please configure a valid provider in settings.');
    }
  }

  private async extractWithGemini(imageBuffer: Buffer, mimeType: string, settings: AppSettings): Promise<ExtractedPRFData> {
    try {
      const modelName = settings.ocr.model || 'gemini-1.5-flash';
      const model = this.genAI!.getGenerativeModel({ model: modelName });
      
      const prompt = `
Analyze this Purchase Request Form (PRF) document and extract the following information in JSON format.
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
9. Project Description/Area
10. Project ID
11. Reference Drawing Number
12. General Ledger Code/Project #
13. Budgeted (Yes/No checkbox)
14. Under ICT Control (Yes/No checkbox)
15. Received PR date
16. Entry date
17. Any status information

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
      "currency": "string"
    }
  ],
  "projectDescription": "string",
  "projectId": "string",
  "referenceDrawingNumber": "string",
  "generalLedgerCode": "string",
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
`;

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

  private async extractWithOpenAI(imageBuffer: Buffer, mimeType: string, settings: AppSettings): Promise<ExtractedPRFData> {
    try {
      const modelName = settings.ocr.model || 'gpt-4o-mini';
      
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
9. Project Description/Area
10. Project ID
11. Reference Drawing Number
12. General Ledger Code/Project #
13. Budgeted (Yes/No checkbox)
14. Under ICT Control (Yes/No checkbox)
15. Received PR date
16. Entry date
17. Any status information

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
      "currency": "string"
    }
  ],
  "projectDescription": "string",
  "projectId": "string",
  "referenceDrawingNumber": "string",
  "generalLedgerCode": "string",
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

      const response = await this.openAI!.chat.completions.create({
        model: modelName,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`
              }
            }
          ]
        }],
        max_tokens: 2000,
        temperature: 0.1
      });
      
      const text = response.choices[0]?.message?.content || '';
      
      // Clean up the response to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in OCR response');
      }
      
      const extractedData = JSON.parse(jsonMatch[0]) as ExtractedPRFData;
      
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
      cleaned.generalLedgerCode = data.generalLedgerCode.trim();
    }
    if (data.status && typeof data.status === 'string') {
      cleaned.status = data.status.trim();
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
    if (data.totalAmount && !isNaN(Number(data.totalAmount))) {
      cleaned.totalAmount = Number(data.totalAmount);
    }

    // Clean boolean fields
    if (typeof data.budgeted === 'boolean') {
      cleaned.budgeted = data.budgeted;
    }
    if (typeof data.underICTControl === 'boolean') {
      cleaned.underICTControl = data.underICTControl;
    }

    // Clean items array
    if (Array.isArray(data.items)) {
      cleaned.items = data.items.map(item => ({
        partNumber: item.partNumber ? String(item.partNumber).trim() : undefined,
        description: item.description ? String(item.description).trim() : undefined,
        quantity: item.quantity && !isNaN(Number(item.quantity)) ? Number(item.quantity) : undefined,
        unitPrice: item.unitPrice && !isNaN(Number(item.unitPrice)) ? Number(item.unitPrice) : undefined,
        totalPrice: item.totalPrice && !isNaN(Number(item.totalPrice)) ? Number(item.totalPrice) : undefined,
        currency: item.currency ? String(item.currency).trim() : undefined
      })).filter(item => 
        // Keep items that have at least a description or part number
        item.description || item.partNumber
      );
    }

    return cleaned;
  }

  private cleanDate(dateStr: string): string {
    if (!dateStr) return '';
    
    // Try to parse and format the date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
    
    // If parsing fails, return the original string
    return String(dateStr).trim();
  }

  async isEnabled(): Promise<boolean> {
    try {
      const settings = await loadSettings();
      const provider = settings.ocr.provider || 'gemini';
      const hasApiKey = provider === 'openai' ? !!settings.ocr.openaiApiKey : !!settings.ocr.geminiApiKey;
      return settings.ocr.enabled && hasApiKey;
    } catch {
      return false;
    }
  }
}

export const ocrService = new OCRService();