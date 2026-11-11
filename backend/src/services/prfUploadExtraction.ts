import { loadSettings } from '../routes/settingsRoutes';
import { ocrService, normalizeOCRHeader } from './ocrService';
import { parseLocalPDF, UploadError, type UploadExtraction } from './localPRFParser';
import { reviewIssues } from './prfUploadReview';

// Upload only. Existing rescan routes deliberately keep using ocrService.
export async function extractUpload(buffer: Buffer, mimeType: string, debug = false): Promise<UploadExtraction> {
  const settings = await loadSettings();
  if (!settings.ocr.enabled) throw new UploadError('Document processing is disabled in Settings.', 503, 'PROCESSING_DISABLED');
  let result: UploadExtraction;
  if (settings.ocr.uploadMethod === 'local') result = await parseLocalPDF(buffer, mimeType);
  else {
    if (!await ocrService.isEnabled()) throw new UploadError('Configure the LLM provider and API key in Settings.', 503, 'LLM_NOT_CONFIGURED');
    const extraction = debug ? await ocrService.extractPRFDataWithDebug(buffer,mimeType) : { extractedData: await ocrService.extractPRFData(buffer,mimeType), debug: undefined };
    result = { ...extraction, method: 'llm', reviewIssues: [] };
  }
  if ((result.extractedData.items?.length || 0) > 200) throw new UploadError('This upload exceeds the 200-item preview limit. Split the source document before processing.', 422, 'ITEM_LIMIT');
  result.extractedData = normalizeOCRHeader(result.extractedData);
  result.reviewIssues = reviewIssues(result.extractedData, result.reviewIssues);
  return result;
}
