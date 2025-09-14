import React, { useState, useEffect } from 'react';
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
  Eye
} from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/utils';
import FilePreviewModal from '../../../src/components/FilePreviewModal';

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

  // Fetch files for this PRF
  const fetchFiles = async () => {
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
  };

  useEffect(() => {
    fetchFiles();
  }, [prfId]);

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
    </Card>
  );
};

export default PRFFileExplorer;