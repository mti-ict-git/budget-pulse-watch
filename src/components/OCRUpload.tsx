import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, Eye, CheckCircle, AlertCircle, Loader2, Download, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ExtractedPRFData {
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

interface OCRPreviewResult {
  extractedData: ExtractedPRFData;
  uploadId: string;
  originalFilename: string;
  suggestions: {
    prfNoGenerated: boolean;
    missingFields: string[];
    confidence: number;
  };
}

interface CreatedPRFData {
  prf: {
    PRFID: number;
    PRFNo: string;
    RequestedBy: string;
    Department: string;
    TotalAmount: number;
    Status: string;
  };
  items: Array<{
    ItemID: number;
    PartNumber?: string;
    Description: string;
    Quantity: number;
    UnitPrice: number;
    TotalPrice: number;
    Currency: string;
  }>;
  extractedData: ExtractedPRFData;
  ocrConfidence: number;
  uploadId: string;
  originalFilename: string;
  savedFilePath: string;
}

interface OCRUploadProps {
  onPRFCreated?: (prfData: CreatedPRFData) => void;
  onPreviewData?: (data: ExtractedPRFData) => void;
}

const OCRUpload: React.FC<OCRUploadProps> = ({ onPRFCreated, onPreviewData }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<ExtractedPRFData | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRPreviewResult | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      setExtractedData(null);
      setOcrResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const handlePreviewExtraction = async () => {
    if (!uploadedFile) return;

    setIsProcessing(true);
    setUploadProgress(0);
    setPreviewMode(true);

    try {
      const formData = new FormData();
      formData.append('document', uploadedFile);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/ocr-prf/preview-extraction', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();

      if (result.success) {
        setExtractedData(result.data.extractedData);
        setOcrResult(result.data);
        onPreviewData?.(result.data.extractedData);
        toast({
          title: "OCR Extraction Complete",
          description: `Document processed with ${Math.round((result.data.extractedData.confidence || 0) * 100)}% confidence`,
        });
      } else {
        throw new Error(result.message || 'OCR extraction failed');
      }
    } catch (error) {
      console.error('Preview extraction failed:', error);
      
      // Handle rate limiting specifically
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract data from document';
      const isRateLimit = errorMessage.includes('429') || errorMessage.includes('Quota exceeded') || errorMessage.includes('RATE_LIMIT_EXCEEDED');
      
      if (isRateLimit) {
        toast({
          title: "API Rate Limit Exceeded",
          description: "Google AI quota exhausted. Please wait 1 hour and try again, or use the Manual tab for now.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Extraction Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleCreatePRF = async () => {
    if (!uploadedFile) return;

    setIsProcessing(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('document', uploadedFile);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 8, 85));
      }, 300);

      const response = await fetch('/api/ocr-prf/create-from-document', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();

      if (result.success) {
        onPRFCreated?.(result.data);
        toast({
          title: "PRF Created Successfully",
          description: `PRF ${result.data.prf.PRFNo} has been created from the uploaded document`,
        });
        
        // Reset form
        setUploadedFile(null);
        setExtractedData(null);
        setOcrResult(null);
        setPreviewMode(false);
      } else {
        throw new Error(result.message || 'PRF creation failed');
      }
    } catch (error) {
      console.error('PRF creation failed:', error);
      toast({
        title: "PRF Creation Failed",
        description: error instanceof Error ? error.message : 'Failed to create PRF from document',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'bg-gray-500';
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getConfidenceText = (confidence?: number) => {
    if (!confidence) return 'Unknown';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload PRF Document
          </CardTitle>
          <CardDescription>
            Upload a PRF document (image or PDF) to extract data using OCR and create a new PRF automatically.
          </CardDescription>
          
          <Alert className="mt-4">
             <Info className="h-4 w-4" />
             <AlertDescription>
               <strong>Note:</strong> OCR processing uses Google AI which has usage limits. If you encounter rate limit errors, 
               please wait 1 hour and try again, or use the <strong>Manual</strong> tab as an alternative.
             </AlertDescription>
           </Alert>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            {isDragActive ? (
              <p className="text-blue-600">Drop the PRF document here...</p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  Drag & drop a PRF document here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  Supports: JPEG, PNG, GIF, BMP, WebP, PDF (max 10MB)
                </p>
              </div>
            )}
          </div>

          {uploadedFile && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">{uploadedFile.name}</span>
                  <Badge variant="secondary">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handlePreviewExtraction}
                    disabled={isProcessing}
                    variant="outline"
                    size="sm"
                  >
                    {isProcessing && previewMode ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    Preview Extraction
                  </Button>
                  <Button
                    onClick={handleCreatePRF}
                    disabled={isProcessing}
                    size="sm"
                  >
                    {isProcessing && !previewMode ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Create PRF
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isProcessing && uploadProgress > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Processing document...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extracted Data Preview */}
      {extractedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Extracted Data Preview
              </span>
              <Badge className={getConfidenceColor(extractedData.confidence)}>
                {getConfidenceText(extractedData.confidence)} Confidence
              </Badge>
            </CardTitle>
            <CardDescription>
              Review the extracted data before creating the PRF. You can manually correct any errors after creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="items">Items</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">PRF No</label>
                    <p className="text-sm text-gray-900">{extractedData.prfNo || 'Not detected'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Requested By</label>
                    <p className="text-sm text-gray-900">{extractedData.requestedBy || 'Not detected'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Department</label>
                    <p className="text-sm text-gray-900">{extractedData.department || 'Not detected'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Total Amount</label>
                    <p className="text-sm text-gray-900">{formatCurrency(extractedData.totalAmount)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Date Raised</label>
                    <p className="text-sm text-gray-900">{extractedData.dateRaised || 'Not detected'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Date Required</label>
                    <p className="text-sm text-gray-900">{extractedData.dateRequired || 'Not detected'}</p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="items" className="space-y-4">
                {extractedData.items && extractedData.items.length > 0 ? (
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {extractedData.items.map((item, index) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="font-medium">Part Number:</span> {item.partNumber || 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Quantity:</span> {item.quantity || 'N/A'}
                            </div>
                            <div className="col-span-2">
                              <span className="font-medium">Description:</span> {item.description || 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Unit Price:</span> {formatCurrency(item.unitPrice)}
                            </div>
                            <div>
                              <span className="font-medium">Total Price:</span> {formatCurrency(item.totalPrice)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No items were detected in the document. You can add items manually after creating the PRF.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
              
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Project Description</label>
                    <p className="text-sm text-gray-900">{extractedData.projectDescription || 'Not detected'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Project ID</label>
                    <p className="text-sm text-gray-900">{extractedData.projectId || 'Not detected'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">General Ledger Code</label>
                    <p className="text-sm text-gray-900">{extractedData.generalLedgerCode || 'Not detected'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Proposed Supplier</label>
                    <p className="text-sm text-gray-900">{extractedData.proposedSupplier || 'Not detected'}</p>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Budgeted</label>
                      <p className="text-sm text-gray-900">
                        {extractedData.budgeted !== undefined ? (extractedData.budgeted ? 'Yes' : 'No') : 'Not detected'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Under ICT Control</label>
                      <p className="text-sm text-gray-900">
                        {extractedData.underICTControl !== undefined ? (extractedData.underICTControl ? 'Yes' : 'No') : 'Not detected'}
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OCRUpload;