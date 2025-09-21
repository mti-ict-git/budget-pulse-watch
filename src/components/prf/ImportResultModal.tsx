import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Copy
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImportError {
  row: number;
  field: string;
  message: string;
  data?: unknown;
  prfNo?: string;
}

interface ImportWarning {
  row: number;
  message: string;
  data?: unknown;
  prfNo?: string;
}

interface PRFDetail {
  prfNo: string;
  prfId: number;
  itemCount: number;
}

interface FailedPRF {
  prfNo: string;
  reason: string;
  rows: number[];
}

interface ImportResult {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  totalPRFs?: number;
  successfulPRFs?: number;
  failedPRFs?: number;
  prfDetails?: {
    successful: PRFDetail[];
    failed: FailedPRF[];
  };
}

interface ImportResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ImportResult | null;
  filename?: string;
}

export function ImportResultModal({ 
  open, 
  onOpenChange, 
  result, 
  filename 
}: ImportResultModalProps) {
  const { toast } = useToast();

  if (!result) return null;

  const handleCopyFailedPRFs = () => {
    if (!result.prfDetails?.failed) return;
    
    const failedPRFNumbers = result.prfDetails.failed.map(prf => prf.prfNo).join(', ');
    navigator.clipboard.writeText(failedPRFNumbers);
    toast({
      title: "Copied to clipboard",
      description: `${result.prfDetails.failed.length} failed PRF numbers copied`,
    });
  };

  const handleDownloadReport = () => {
    const reportData = {
      filename,
      timestamp: new Date().toISOString(),
      summary: {
        totalRecords: result.totalRecords,
        importedRecords: result.importedRecords,
        skippedRecords: result.skippedRecords,
        totalPRFs: result.totalPRFs,
        successfulPRFs: result.successfulPRFs,
        failedPRFs: result.failedPRFs,
      },
      successful: result.prfDetails?.successful || [],
      failed: result.prfDetails?.failed || [],
      errors: result.errors,
      warnings: result.warnings,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Report downloaded",
      description: "Import report has been downloaded as JSON file",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Results
            {result.success ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Success
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Partial Success
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {filename && `File: ${filename} • `}
            Import completed with detailed results below
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {result.totalRecords}
              </div>
              <div className="text-sm text-blue-600">Total Records</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {result.importedRecords}
              </div>
              <div className="text-sm text-green-600">Imported</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {result.skippedRecords}
              </div>
              <div className="text-sm text-yellow-600">Skipped</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {result.errors?.length || 0}
              </div>
              <div className="text-sm text-red-600">Errors</div>
            </div>
          </div>

          {/* PRF Summary */}
          {result.totalPRFs !== undefined && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">PRF Summary</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Total PRFs:</span> {result.totalPRFs}
                </div>
                <div className="text-green-600">
                  <span className="font-medium">Successful:</span> {result.successfulPRFs}
                </div>
                <div className="text-red-600">
                  <span className="font-medium">Failed:</span> {result.failedPRFs}
                </div>
              </div>
            </div>
          )}

          <ScrollArea className="h-[300px] w-full">
            <div className="space-y-4">
              {/* Successful PRFs */}
              {result.prfDetails?.successful && result.prfDetails.successful.length > 0 && (
                <div>
                  <h3 className="font-semibold text-green-600 mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Successfully Imported PRFs ({result.prfDetails.successful.length})
                  </h3>
                  <div className="space-y-2">
                    {result.prfDetails.successful.map((prf, index) => (
                      <div key={index} className="bg-green-50 p-2 rounded border-l-4 border-green-400">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">PRF {prf.prfNo}</span>
                          <Badge variant="outline" className="text-green-600">
                            {prf.itemCount} items
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Failed PRFs */}
              {result.prfDetails?.failed && result.prfDetails.failed.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-red-600 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Failed PRFs ({result.prfDetails.failed.length})
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyFailedPRFs}
                      className="text-xs"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy PRF Numbers
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {result.prfDetails.failed.map((prf, index) => (
                      <div key={index} className="bg-red-50 p-2 rounded border-l-4 border-red-400">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium">PRF {prf.prfNo}</span>
                            <div className="text-sm text-red-600 mt-1">{prf.reason}</div>
                          </div>
                          <Badge variant="outline" className="text-red-600">
                            Rows: {prf.rows.join(', ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <div>
                  <h3 className="font-semibold text-yellow-600 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Warnings ({result.warnings.length})
                  </h3>
                  <div className="space-y-2">
                    {result.warnings.map((warning, index) => (
                      <div key={index} className="bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
                        <div className="text-sm">
                          <span className="font-medium">Row {warning.row}{warning.prfNo ? ` (PRF: ${warning.prfNo})` : ''}:</span> {warning.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors && result.errors.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Errors ({result.errors.length})
                  </h3>
                  <div className="space-y-2">
                    {result.errors.map((error, index) => (
                      <div key={index} className="bg-red-50 p-2 rounded border-l-4 border-red-400">
                        <div className="text-sm">
                          <span className="font-medium">Row {error.row}{error.prfNo ? ` (PRF: ${error.prfNo})` : ''} ({error.field}):</span> {error.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator />

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleDownloadReport}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Report
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}