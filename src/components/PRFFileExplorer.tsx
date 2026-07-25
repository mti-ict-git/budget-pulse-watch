import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Upload,
  FileText,
  Download,
  Trash2,
  MoreVertical,
  FolderOpen,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/utils';
import FilePreviewModal from './FilePreviewModal';
import { authService } from '@/services/authService';

interface PRFFile {
  FileID: number;
  PRFID: number;
  OriginalFileName: string;
  FilePath: string;
  SharedPath?: string;
  FileSize: number;
  FileType: string;
  MimeType: string;
  UploadDate: string;
  UploadedBy: number;
  IsOriginalDocument: boolean;
  Description?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

interface PRFFileExplorerProps {
  prfId: number;
  prfNo: string;
  readonly?: boolean;
}

interface RescanProposal {
  index: number;
  action: 'update' | 'add';
  matchReason: 'item-code' | 'name-quantity' | 'position' | 'new';
  existingItemId?: number;
  existing?: {
    ItemName: string;
    ItemCode?: string | null;
    Quantity: number;
    UnitPrice: number;
    PurchaseCostCode?: string | null;
  };
  scanned: {
    partNumber?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    purchaseCostCode?: string;
    budgetYear?: number;
  };
}

interface RescanPreview {
  extractedData: {
    prfNo?: string;
    projectDescription?: string;
    department?: string;
    totalAmount?: number;
    confidence?: number;
    items?: RescanProposal['scanned'][];
  };
  proposals: RescanProposal[];
  preservedItems: Array<{ PRFItemID: number; ItemName: string; PurchaseCostCode?: string | null }>;
  warnings: string[];
}

const PRFFileExplorer: React.FC<PRFFileExplorerProps> = ({ prfId, prfNo, readonly = false }) => {
  const [files, setFiles] = useState<PRFFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<PRFFile | null>(null);
  const [rescanDialogOpen, setRescanDialogOpen] = useState(false);
  const [rescanFile, setRescanFile] = useState<PRFFile | null>(null);
  const [rescanPreview, setRescanPreview] = useState<RescanPreview | null>(null);
  const [rescanLoading, setRescanLoading] = useState(false);
  const [rescanApplying, setRescanApplying] = useState(false);
  const [selectedRescanIndexes, setSelectedRescanIndexes] = useState<Set<number>>(new Set());
  const [updateHeaderFromOCR, setUpdateHeaderFromOCR] = useState(false);

  // Fetch files for this PRF
  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/prf-files/${prfId}`);
      const data = await response.json();
      
      if (data.success) {
        setFiles(data.data);
      } else {
        setError(data.message || 'Failed to fetch files');
      }
    } catch (err) {
      setError('Network error while fetching files');
      console.error('Error fetching files:', err);
    } finally {
      setLoading(false);
    }
  }, [prfId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Handle file upload
  const handleFileUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setUploadProgress('Preparing upload...');
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('description', description);

      setUploadProgress('Uploading file...');
      const response = await fetch(`/api/prf-files/${prfId}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        setUploadProgress('File uploaded successfully!');
        setUploadDialogOpen(false);
        setSelectedFile(null);
        setDescription('');
        await fetchFiles(); // Refresh file list
        
        setTimeout(() => setUploadProgress(null), 3000);
      } else {
        setError(data.message || 'Upload failed');
      }
    } catch (err) {
      setError('Network error during upload');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  // Handle file preview
  const handlePreviewFile = (file: PRFFile) => {
    setPreviewFile(file);
    setPreviewModalOpen(true);
  };

  const handleRescanFile = async (file: PRFFile) => {
    setRescanFile(file);
    setRescanPreview(null);
    setSelectedRescanIndexes(new Set());
    setUpdateHeaderFromOCR(false);
    setRescanDialogOpen(true);
    setRescanLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ocr-prf/rescan/${prfId}/file/${file.FileID}/preview`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || 'OCR rescan failed');
      const preview = body.data as RescanPreview;
      setRescanPreview(preview);
      setSelectedRescanIndexes(new Set(preview.proposals.map((proposal) => proposal.index)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR rescan failed');
      setRescanDialogOpen(false);
    } finally {
      setRescanLoading(false);
    }
  };

  const toggleRescanProposal = (index: number) => {
    setSelectedRescanIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleApplyRescan = async () => {
    if (!rescanFile || !rescanPreview) return;
    setRescanApplying(true);
    setError(null);
    try {
      const response = await fetch(`/api/ocr-prf/rescan/${prfId}/file/${rescanFile.FileID}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          extractedData: rescanPreview.extractedData,
          selectedIndexes: Array.from(selectedRescanIndexes),
          updateHeader: updateHeaderFromOCR,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || 'Failed to apply OCR rescan');
      setUploadProgress(
        `OCR rescan applied: ${body.data.updatedItemCount} updated, ${body.data.addedItemCount} added, ${body.data.preservedItemCount} preserved.`
      );
      setRescanDialogOpen(false);
      setTimeout(() => setUploadProgress(null), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply OCR rescan');
    } finally {
      setRescanApplying(false);
    }
  };

  // Handle file download
  const handleDownloadFile = (file: PRFFile) => {
    const link = document.createElement('a');
    link.href = `/api/prf-files/${prfId}/${file.FileID}/download`;
    link.download = file.OriginalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle file deletion
  const handleDeleteFile = async (fileId: number) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const response = await fetch(`/api/prf-files/file/${fileId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchFiles(); // Refresh file list
      } else {
        setError(data.message || 'Failed to delete file');
      }
    } catch (err) {
      setError('Network error during deletion');
      console.error('Delete error:', err);
    }
  };

  // Get file type icon
  const getFileIcon = (fileType: string, mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return '🖼️';
    }
    
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'xls':
      case 'xlsx':
        return '📊';
      case 'txt':
        return '📃';
      default:
        return '📎';
    }
  };

  // Get storage status badge
  const getStorageStatus = (file: PRFFile) => {
    if (file.SharedPath) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Stored
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3 mr-1" />
          Local Only
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            PRF Files - {prfNo}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading files...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            PRF Files - {prfNo}
            <Badge variant="outline">{files.length} files</Badge>
          </CardTitle>
          
          {!readonly && (
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload File
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload File to PRF {prfNo}</DialogTitle>
                  <DialogDescription>
                    Upload additional documents related to this PRF. Files will be stored in the shared network folder.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file-upload">Select File</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="mt-1"
                    />
                    {selectedFile && (
                      <p className="text-sm text-gray-600 mt-1">
                        Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of this file..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUploadDialogOpen(false);
                        setSelectedFile(null);
                        setDescription('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleFileUpload}
                      disabled={!selectedFile || uploading}
                    >
                      {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert className="mb-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {uploadProgress && (
          <Alert className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{uploadProgress}</AlertDescription>
          </Alert>
        )}
        
        {files.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No files uploaded yet</p>
            {!readonly && (
              <p className="text-sm">Upload documents to get started</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Description</TableHead>
                  {!readonly && <TableHead className="w-[50px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.FileID}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {getFileIcon(file.FileType, file.MimeType)}
                        </span>
                        <div>
                          <p className="font-medium">{file.OriginalFileName}</p>
                          {file.IsOriginalDocument && (
                            <Badge variant="secondary" className="text-xs">
                              OCR Source
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {file.FileType.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatBytes(file.FileSize)}</TableCell>
                    <TableCell>{getStorageStatus(file)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{formatDate(file.UploadDate)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-gray-600 max-w-xs truncate">
                        {file.Description || '-'}
                      </p>
                    </TableCell>
                    {!readonly && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handlePreviewFile(file)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadFile(file)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            {file.IsOriginalDocument && (
                              <DropdownMenuItem onClick={() => handleRescanFile(file)}>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Rescan with AI
                              </DropdownMenuItem>
                            )}
                            {!file.IsOriginalDocument && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteFile(file.FileID)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {files.some(f => f.SharedPath) && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Shared Folder:</strong> Files are stored in{' '}
                  <code className="bg-blue-100 px-1 rounded">
                    \\mbma.com\shared\PR_Document\PT Merdeka Tsingshan Indonesia\{prfNo}
                  </code>
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <FilePreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        file={previewFile ? {
          id: previewFile.FileID.toString(),
          filename: previewFile.OriginalFileName,
          originalName: previewFile.OriginalFileName,
          fileSize: previewFile.FileSize,
          mimeType: previewFile.MimeType,
          uploadedAt: previewFile.UploadDate
        } : null}
        prfId={prfId.toString()}
      />

      <Dialog open={rescanDialogOpen} onOpenChange={(open) => !rescanApplying && setRescanDialogOpen(open)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Rescan Preview — PRF {prfNo}
            </DialogTitle>
            <DialogDescription>
              Review and select item changes. Existing items not found by OCR are preserved automatically.
            </DialogDescription>
          </DialogHeader>

          {rescanLoading ? (
            <div className="flex items-center justify-center gap-3 py-12">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Reading {rescanFile?.OriginalFileName} with AI...
            </div>
          ) : rescanPreview ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4 rounded-lg border p-4 text-sm">
                <div><span className="text-muted-foreground">Scanned PRF</span><p className="font-medium">{rescanPreview.extractedData.prfNo || '-'}</p></div>
                <div><span className="text-muted-foreground">Department</span><p className="font-medium">{rescanPreview.extractedData.department || '-'}</p></div>
                <div><span className="text-muted-foreground">Amount</span><p className="font-medium">{Number(rescanPreview.extractedData.totalAmount || 0).toLocaleString('id-ID')}</p></div>
                <div><span className="text-muted-foreground">Confidence</span><p className="font-medium">{Math.round(Number(rescanPreview.extractedData.confidence || 0) * 100)}%</p></div>
              </div>

              {rescanPreview.warnings.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{rescanPreview.warnings.join(' • ')}</AlertDescription>
                </Alert>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={updateHeaderFromOCR}
                  onChange={(event) => setUpdateHeaderFromOCR(event.target.checked)}
                />
                Also update safe header fields (title, department, amount, vendor, required-for)
              </label>

              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Use</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Existing item</TableHead>
                      <TableHead>AI scanned item</TableHead>
                      <TableHead>Existing cost code</TableHead>
                      <TableHead>Scanned cost code</TableHead>
                      <TableHead className="text-right">Scanned total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rescanPreview.proposals.map((proposal) => (
                      <TableRow key={proposal.index}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedRescanIndexes.has(proposal.index)}
                            onChange={() => toggleRescanProposal(proposal.index)}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={proposal.action === 'add' ? 'default' : 'secondary'}>
                            {proposal.action === 'add' ? 'Add' : `Update · ${proposal.matchReason}`}
                          </Badge>
                        </TableCell>
                        <TableCell>{proposal.existing?.ItemName || 'New item'}</TableCell>
                        <TableCell>{proposal.scanned.description || proposal.scanned.partNumber || '-'}</TableCell>
                        <TableCell>{proposal.existing?.PurchaseCostCode || <span className="text-destructive">Blank</span>}</TableCell>
                        <TableCell>{proposal.scanned.purchaseCostCode || <span className="text-destructive">Blank</span>}</TableCell>
                        <TableCell className="text-right">
                          {(Number(proposal.scanned.quantity || 1) * Number(proposal.scanned.unitPrice || 0)).toLocaleString('id-ID')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {rescanPreview.preservedItems.length > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {rescanPreview.preservedItems.length} existing item(s) not found by OCR will remain unchanged.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRescanDialogOpen(false)} disabled={rescanApplying}>
                  Cancel
                </Button>
                <Button onClick={handleApplyRescan} disabled={rescanApplying || selectedRescanIndexes.size === 0}>
                  {rescanApplying ? 'Applying...' : `Approve & Update ${selectedRescanIndexes.size} Item(s)`}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PRFFileExplorer;
