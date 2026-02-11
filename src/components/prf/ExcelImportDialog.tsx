import { useState, useCallback } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authService } from "../../services/authService";
import { ImportResultModal } from "./ImportResultModal";

interface ValidationError {
  row: number;
  field: string;
  message: string;
  data?: unknown;
  prfNo?: string;
}

interface ValidationResult {
  success: boolean;
  message: string;
  data?: {
    prfValidation: {
      success: boolean;
      validRecords: number;
      invalidRecords: number;
      errors: ValidationError[];
    };
    budgetValidation?: {
      success: boolean;
      validRecords: number;
      invalidRecords: number;
      errors: ValidationError[];
    };
  };
}

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
  message: string;
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

export function ExcelImportDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [showResultModal, setShowResultModal] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [prfSearch, setPrfSearch] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedPrfSheet, setSelectedPrfSheet] = useState<string>("");
  const [selectedBudgetSheet, setSelectedBudgetSheet] = useState<string>("");
  
  // Import options
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);

  const fetchSheetNames = useCallback(async (theFile: File): Promise<void> => {
    const formData = new FormData();
    formData.append('file', theFile);
    const token = authService.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    try {
      const response = await fetch('/api/import/prf/sheets', { method: 'POST', headers, body: formData });
      const json = await response.json();
      const sheetsResponse: unknown = json?.data?.sheets ?? json?.sheets ?? [];
      const names: string[] = Array.isArray(sheetsResponse) ? sheetsResponse.filter((n): n is string => typeof n === 'string') : [];
      const lower = names.map((n) => n.toLowerCase());
      const prfIndex = lower.findIndex((n) => n.includes('prf'));
      const budgetIndex = lower.findIndex((n) => n.includes('budget'));
      setSheetNames(names);
      setSelectedPrfSheet(prfIndex >= 0 ? names[prfIndex] : names[0] ?? "");
      setSelectedBudgetSheet(budgetIndex >= 0 ? names[budgetIndex] : "");
    } catch {
      setSheetNames([]);
      setSelectedPrfSheet("");
      setSelectedBudgetSheet("");
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidationResult(null);
      setImportResult(null);
      setDropError(null);
      void fetchSheetNames(selectedFile);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setValidationResult(null);
      setImportResult(null);
      setDropError(null);
      void fetchSheetNames(acceptedFiles[0]);
      return;
    }
    if (fileRejections && fileRejections.length > 0) {
      const reason = fileRejections[0].errors[0]?.message || "Unsupported file type or size";
      setDropError(reason);
    }
  }, [fetchSheetNames]);

  const dropzoneAccept: Record<string, string[]> = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "application/vnd.ms-excel": [".xls"],
    "text/csv": [".csv"],
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: dropzoneAccept,
    multiple: false,
    maxSize: 100 * 1024 * 1024,
    disabled: isValidating || isImporting,
  });

  const validateFile = async () => {
    if (!file) return;

    setIsValidating(true);
    setValidationResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedPrfSheet) formData.append('prfSheetName', selectedPrfSheet);
      if (selectedBudgetSheet) formData.append('budgetSheetName', selectedBudgetSheet);

      const token = authService.getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/import/prf/validate', {
        method: 'POST',
        headers,
        body: formData,
      });

      const result = await response.json();
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        success: false,
        message: 'Failed to validate file. Please try again.',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const importFile = async () => {
    if (!file || !validationResult?.success) return;

    setIsImporting(true);
    setImportResult(null);
    setImportProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('skipDuplicates', skipDuplicates.toString());
      formData.append('updateExisting', updateExisting.toString());
      if (selectedPrfSheet) formData.append('prfSheetName', selectedPrfSheet);
      if (selectedBudgetSheet) formData.append('budgetSheetName', selectedBudgetSheet);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const token = authService.getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/import/prf/bulk', {
        method: 'POST',
        headers,
        body: formData,
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      const result = await response.json();
      
      // Ensure all required fields are present with defaults
      const normalizedResult: ImportResult = {
        success: result.success || false,
        message: result.message || 'Import completed',
        totalRecords: result.totalRecords || result.data?.totalRecords || 0,
        importedRecords: result.importedRecords || result.data?.importedRecords || 0,
        skippedRecords: result.skippedRecords || result.data?.skippedRecords || 0,
        errors: result.errors || result.data?.errors || [],
        warnings: result.warnings || result.data?.warnings || [],
        totalPRFs: result.totalPRFs || result.data?.totalPRFs,
        successfulPRFs: result.successfulPRFs || result.data?.successfulPRFs,
        failedPRFs: result.failedPRFs || result.data?.failedPRFs,
        prfDetails: result.prfDetails || result.data?.prfDetails,
      };
      
      setImportResult(normalizedResult);
      
      // Show result modal after successful import
      if (result.success) {
        setShowResultModal(true);
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: 'Failed to import file. Please try again.',
        totalRecords: 0,
        importedRecords: 0,
        skippedRecords: 0,
        errors: [],
        warnings: [],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetDialog = () => {
    setFile(null);
    setValidationResult(null);
    setImportResult(null);
    setImportProgress(0);
    setShowResultModal(false);
    setSkipDuplicates(true);
    setUpdateExisting(false);
    setSheetNames([]);
    setSelectedPrfSheet("");
    setSelectedBudgetSheet("");
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(resetDialog, 300); // Reset after dialog closes
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Import Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import PRF Data from Excel
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx, .xls, or .csv) containing PRF data to import into the system.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-2">
            <Label htmlFor="file">Upload Excel File</Label>
            <div
              {...getRootProps({
                className: `flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring ${
                  isDragActive ? "border-primary bg-primary/5" : "border-muted"
                } ${isValidating || isImporting ? "opacity-60 cursor-not-allowed" : ""}`,
              })}
              aria-label="Drag and drop Excel file here or click to browse"
            >
              <input {...getInputProps()} aria-label="Excel file input" />
              <Upload className="h-6 w-6 text-muted-foreground" />
              <div className="mt-2 text-sm">
                {isDragActive ? (
                  <span>Drop the file here...</span>
                ) : (
                  <span>Drag & drop your Excel file here, or click to browse</span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Accepted: .xlsx, .xls, .csv • Max 100MB</div>
            </div>

            <div className="mt-2">
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={isValidating || isImporting}
              />
            </div>

            {dropError && (
              <Alert className="border-red-200 bg-red-50">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{dropError}</AlertDescription>
                </div>
              </Alert>
            )}

            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </div>

          {/* Import Options */}
          {file && (
            <div className="space-y-3">
              <Label>Import Options</Label>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-6 space-y-2">
                    <Label htmlFor="prfSheet">PRF Data Sheet</Label>
                    <Select value={selectedPrfSheet} onValueChange={setSelectedPrfSheet}>
                      <SelectTrigger id="prfSheet">
                        <SelectValue placeholder="Select PRF sheet" />
                      </SelectTrigger>
                      <SelectContent>
                        {sheetNames.map((sheet) => (
                          <SelectItem key={`prf-${sheet}`} value={sheet}>{sheet}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-12 md:col-span-6 space-y-2">
                    <Label htmlFor="budgetSheet">Budget Data Sheet (optional)</Label>
                    <Select value={selectedBudgetSheet} onValueChange={setSelectedBudgetSheet}>
                      <SelectTrigger id="budgetSheet">
                        <SelectValue placeholder="Select Budget sheet" />
                      </SelectTrigger>
                      <SelectContent>
                        {sheetNames.map((sheet) => (
                          <SelectItem key={`budget-${sheet}`} value={sheet}>{sheet}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="skipDuplicates"
                    checked={skipDuplicates}
                    onCheckedChange={(checked) => setSkipDuplicates(checked === true)}
                    disabled={isValidating || isImporting}
                  />
                  <Label htmlFor="skipDuplicates" className="text-sm">
                    Skip duplicate PRF numbers
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="updateExisting"
                    checked={updateExisting}
                    onCheckedChange={(checked) => setUpdateExisting(checked === true)}
                    disabled={isValidating || isImporting}
                  />
                  <Label htmlFor="updateExisting" className="text-sm">
                    Update existing records
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Validation Section */}
          {file && !validationResult && (
            <div className="flex justify-center">
              <Button
                onClick={validateFile}
                disabled={isValidating}
                variant="outline"
              >
                {isValidating ? "Validating..." : "Validate File"}
              </Button>
            </div>
          )}

          {/* Validation Results */}
          {validationResult && (
            <div className="space-y-3">
              <Alert className={validationResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                <div className="flex items-center gap-2">
                  {validationResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className={validationResult.success ? "text-green-800" : "text-red-800"}>
                    {validationResult.message}
                  </AlertDescription>
                </div>
              </Alert>

              {validationResult.data && (
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-6 space-y-2">
                    <h4 className="font-medium">PRF Data</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Total Records:</span>
                        <Badge variant="outline">
                          {validationResult.data.prfValidation?.['totalRecords'] ?? 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Valid Records:</span>
                        <Badge variant="outline" className="text-green-600">
                          {validationResult.data.prfValidation?.['validRecords'] ?? validationResult.data.prfValidation?.['importedRecords'] ?? 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Invalid Records:</span>
                        <Badge variant="outline" className="text-red-600">
                          {validationResult.data.prfValidation?.['invalidRecords'] ?? validationResult.data.prfValidation?.['skippedRecords'] ?? 0}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {validationResult.data.budgetValidation && (
                    <div className="col-span-12 md:col-span-6 space-y-2">
                      <h4 className="font-medium">Budget Data</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Total Records:</span>
                          <Badge variant="outline">
                            {validationResult.data.budgetValidation?.['totalRecords'] ?? 0}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Valid Records:</span>
                          <Badge variant="outline" className="text-green-600">
                            {validationResult.data.budgetValidation?.['validRecords'] ?? validationResult.data.budgetValidation?.['importedRecords'] ?? 0}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Invalid Records:</span>
                          <Badge variant="outline" className="text-red-600">
                            {validationResult.data.budgetValidation?.['invalidRecords'] ?? validationResult.data.budgetValidation?.['skippedRecords'] ?? 0}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {validationResult.data?.prfValidation.errors.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-red-600">Validation Errors</h4>
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-6 space-y-2">
                      <div className="text-sm font-medium">Top Issues</div>
                      <div className="space-y-1 text-sm">
                        {(() => {
                          const totals: Record<string, number> = validationResult.data!.prfValidation.errors.reduce((acc: Record<string, number>, e) => {
                            const key = e.field || "Unknown";
                            acc[key] = (acc[key] || 0) + 1;
                            return acc;
                          }, {});
                          return Object.entries(totals)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 6)
                            .map(([field, count]) => (
                              <button
                                key={field}
                                className={`w-full flex justify-between rounded-md border px-2 py-1 ${selectedField === field ? "bg-red-50 border-red-300" : "border-muted"}`}
                                onClick={() => setSelectedField(selectedField === field ? null : field)}
                              >
                                <span>{field}</span>
                                <Badge variant="outline" className="text-red-600">{count}</Badge>
                              </button>
                            ));
                        })()}
                      </div>
                    </div>
                    <div className="col-span-12 md:col-span-6 space-y-2">
                      <div className="text-sm font-medium">Hints</div>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>Budget: use years 2020–2030</li>
                        <li>Date Submit: valid Excel date or ISO date</li>
                        <li>Submit By: non-empty text</li>
                        <li>PRF No: must contain digits</li>
                        <li>Amount: positive number</li>
                        <li>Description: non-empty text</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Error Details</div>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Filter by PRF No"
                        value={prfSearch}
                        onChange={(e) => setPrfSearch(e.target.value)}
                        className="h-8 w-48"
                      />
                      {selectedField && (
                        <Button variant="outline" size="sm" onClick={() => setSelectedField(null)}>Clear Field Filter</Button>
                      )}
                    </div>
                  </div>
                  <ScrollArea className="h-[360px] overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left">
                          <th className="py-2 pr-4">Row</th>
                          <th className="py-2 pr-4">PRF No</th>
                          <th className="py-2 pr-4">Field</th>
                          <th className="py-2">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const base = validationResult.data!.prfValidation.errors;
                          const filtered = base.filter(e => {
                            const fieldOk = selectedField ? e.field === selectedField : true;
                            const prfOk = prfSearch ? (e.prfNo || "").toLowerCase().includes(prfSearch.toLowerCase()) : true;
                            return fieldOk && prfOk;
                          });
                          const rows = showAllErrors ? filtered : filtered.slice(0, 50);
                          return rows.map((e, i) => (
                            <tr key={`${e.row}-${e.field}-${i}`} className="border-t">
                              <td className="py-2 pr-4">{e.row}</td>
                              <td className="py-2 pr-4">{e.prfNo || '-'}</td>
                              <td className="py-2 pr-4">{e.field}</td>
                              <td className="py-2">{e.message}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </ScrollArea>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowAllErrors((v) => !v)}>
                      {showAllErrors ? 'Show Fewer' : 'Show All'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      if (!validationResult?.data?.prfValidation?.errors) return;
                      const rows = validationResult.data.prfValidation.errors.map((e) => [e.row, e.prfNo ?? '', e.field, e.message]);
                      const header = ['Row', 'PRF No', 'Field', 'Message'];
                      const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'validation_errors.csv';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}>
                      Download CSV
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing data...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="w-full" />
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <Alert className={importResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <div className="flex items-center gap-2">
                {importResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className={importResult.success ? "text-green-800" : "text-red-800"}>
                  {importResult.message}
                </AlertDescription>
              </div>
              <div className="mt-2 text-sm space-y-1">
                <div>Imported: {importResult.importedRecords || 0} records</div>
                <div>Skipped: {importResult.skippedRecords || 0} records</div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div>Errors: {importResult.errors.length}</div>
                )}
                {importResult.success && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowResultModal(true)}
                    >
                      View Detailed Report
                    </Button>
                  </div>
                )}
              </div>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResult?.success ? "Close" : "Cancel"}
          </Button>
          {validationResult?.success && !importResult && (
            <Button
              onClick={importFile}
              disabled={isImporting}
            >
              {isImporting ? "Importing..." : "Import Data"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      
      {/* Import Result Modal */}
      <ImportResultModal
        open={showResultModal}
        onOpenChange={setShowResultModal}
        result={importResult}
        filename={file?.name}
      />
    </Dialog>
  );
}
