import { useState } from "react";
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
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ValidationError {
  row: number;
  field: string;
  message: string;
  data?: unknown;
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

interface ImportResult {
  success: boolean;
  message: string;
  data?: {
    imported: number;
    skipped: number;
    errors: string[];
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
  
  // Import options
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidationResult(null);
      setImportResult(null);
    }
  };

  const validateFile = async () => {
    if (!file) return;

    setIsValidating(true);
    setValidationResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/import/prf/validate', {
        method: 'POST',
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

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/import/prf/bulk', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      const result = await response.json();
      setImportResult(result);
    } catch (error) {
      setImportResult({
        success: false,
        message: 'Failed to import file. Please try again.',
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
    setSkipDuplicates(true);
    setUpdateExisting(false);
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
      <DialogContent className="max-w-2xl">
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
            <Label htmlFor="file">Select Excel File</Label>
            <Input
              id="file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              disabled={isValidating || isImporting}
            />
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">PRF Data</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Valid Records:</span>
                        <Badge variant="outline" className="text-green-600">
                          {validationResult.data.prfValidation.validRecords}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Invalid Records:</span>
                        <Badge variant="outline" className="text-red-600">
                          {validationResult.data.prfValidation.invalidRecords}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {validationResult.data.budgetValidation && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Budget Data</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Valid Records:</span>
                          <Badge variant="outline" className="text-green-600">
                            {validationResult.data.budgetValidation.validRecords}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Invalid Records:</span>
                          <Badge variant="outline" className="text-red-600">
                            {validationResult.data.budgetValidation.invalidRecords}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {validationResult.data?.prfValidation.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-red-600">Validation Errors:</h4>
                  <ul className="text-sm text-red-600 space-y-1">
                    {validationResult.data.prfValidation.errors.slice(0, 5).map((error, index) => (
                      <li key={index}>• Row {error.row}: {error.message}</li>
                    ))}
                    {validationResult.data.prfValidation.errors.length > 5 && (
                      <li>... and {validationResult.data.prfValidation.errors.length - 5} more errors</li>
                    )}
                  </ul>
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
              {importResult.data && (
                <div className="mt-2 text-sm space-y-1">
                  <div>Imported: {importResult.data.imported} records</div>
                  <div>Skipped: {importResult.data.skipped} records</div>
                  {importResult.data.errors.length > 0 && (
                    <div>Errors: {importResult.data.errors.length}</div>
                  )}
                </div>
              )}
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
    </Dialog>
  );
}