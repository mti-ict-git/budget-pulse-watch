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
    await this.initializeAI();
    
    const settings = await loadSettings();
    
    if (settings.ocr.provider === 'openai' && this.openAI) {
      return await this.extractWithOpenAI(imageBuffer, mimeType, settings);
    } else if (settings.ocr.provider === 'gemini' && this.genAI) {
      // Note: Gemini currently only supports images, not PDFs
      if (mimeType === 'application/pdf') {
        throw new Error('PDF processing is only supported with OpenAI provider. Please switch to OpenAI in settings or convert PDF to image.');
      }
      return await this.extractWithGemini(imageBuffer, mimeType, settings);
    } else {
      throw new Error('OCR service not properly configured');
    }
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
          partNumber?: string;
          description?: string;
          quantity?: number;
          unitPrice?: number;
          totalPrice?: number;
          currency?: string;
        }> = {};
        
        if (item.partNumber && typeof item.partNumber === 'string') {
          cleanedItem.partNumber = item.partNumber.trim();
        }
        
        if (item.description && typeof item.description === 'string') {
          cleanedItem.description = item.description.trim();
        }
        
        if (item.currency && typeof item.currency === 'string') {
          cleanedItem.currency = item.currency.trim();
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