import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Paperclip
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from '@/hooks/use-toast';
import { authService } from '@/services/authService';

interface AdditionalFile {
  id: string;
  file: File;
  description: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  uploadedFileId?: number;
}

interface AdditionalFileUploadProps {
  prfId: number;
  prfNo: string;
  onUploadComplete?: (files: AdditionalFile[]) => void;
  className?: string;
}

interface UploadedFileResponse {
  originalName: string;
  file: {
    FileID: number;
    FileName: string;
    FilePath: string;
    FileSize: number;
    MimeType: string;
  };
}

interface UploadErrorResponse {
  fileName: string;
  error: string;
}

interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    uploaded: UploadedFileResponse[];
    errors: UploadErrorResponse[];
  };
}

const AdditionalFileUpload: React.FC<AdditionalFileUploadProps> = ({
  prfId,
  prfNo,
  onUploadComplete,
  className = ""
}) => {
  const [files, setFiles] = useState<AdditionalFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: AdditionalFile[] = acceptedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      description: '',
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true
  });

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const updateFileDescription = (fileId: string, description: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, description } : f
    ));
  };

  const uploadFile = async (file: AdditionalFile): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file.file);
    formData.append('description', file.description || 'Additional document');

    try {
      // Update status to uploading
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'uploading', progress: 0 } : f
      ));

      const response = await fetch(`/api/prf-files/${prfId}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { 
            ...f, 
            status: 'success', 
            progress: 100,
            uploadedFileId: result.data.file.FileID
          } : f
        ));

        toast({
          title: "File Uploaded",
          description: `${file.file.name} has been uploaded successfully.`
        });
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { 
          ...f, 
          status: 'error', 
          progress: 0,
          error: errorMessage
        } : f
      ));

      toast({
        title: "Upload Failed",
        description: `Failed to upload ${file.file.name}: ${errorMessage}`,
        variant: "destructive"
      });
    }
  };

  const uploadAllFiles = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
      toast({
        title: "No Files to Upload",
        description: "Please add some files before uploading.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      pendingFiles.forEach(fileItem => {
        formData.append('files', fileItem.file);
        formData.append('descriptions', fileItem.description || 'Additional document');
      });

      const response = await fetch(`/api/prf-files/${prfId}/upload-multiple`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result: UploadResponse = await response.json();
      
      if (result.success) {
        // Update successful uploads
        if (result.data.uploaded && result.data.uploaded.length > 0) {
          result.data.uploaded.forEach((upload: UploadedFileResponse) => {
            const originalFile = pendingFiles.find(f => f.file.name === upload.originalName);
            if (originalFile) {
              setFiles(prev => prev.map(f => 
                f.id === originalFile.id ? { 
                  ...f, 
                  status: 'success', 
                  progress: 100,
                  uploadedFileId: upload.file.FileID
                } : f
              ));
            }
          });
        }

        // Update failed uploads
        if (result.data.errors && result.data.errors.length > 0) {
          result.data.errors.forEach((error: UploadErrorResponse) => {
            const originalFile = pendingFiles.find(f => f.file.name === error.fileName);
            if (originalFile) {
              setFiles(prev => prev.map(f => 
                f.id === originalFile.id ? { 
                  ...f, 
                  status: 'error', 
                  progress: 0,
                  error: error.error
                } : f
              ));
            }
          });
        }

        const successCount = result.data.uploaded?.length || 0;
        const errorCount = result.data.errors?.length || 0;

        if (successCount > 0) {
          const successfulUploads = files.filter(f => f.status === 'success');
          if (onUploadComplete) {
            onUploadComplete(successfulUploads);
          }

          if (errorCount > 0) {
            toast({
              title: "Partial Upload Success",
              description: `${successCount} files uploaded successfully. ${errorCount} files failed.`,
              variant: "default"
            });
          } else {
            toast({
              title: "Upload Complete",
              description: `Successfully uploaded ${successCount} additional files to PRF ${prfNo}.`
            });
          }
        } else {
          throw new Error('No files were uploaded successfully');
        }
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error during batch upload:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : 'Failed to upload files',
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'xls':
      case 'xlsx':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'bmp':
      case 'webp':
        return <FileText className="h-4 w-4 text-purple-500" />;
      default:
        return <Paperclip className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (file: AdditionalFile) => {
    switch (file.status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'uploading':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Uploading
          </Badge>
        );
      case 'success':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Uploaded
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          Additional Files for PRF {prfNo}
        </CardTitle>
        <CardDescription>
          Upload additional supporting documents that will be stored alongside your PRF in the shared folder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Drag and Drop Area */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
            }
          `}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          {isDragActive ? (
            <p className="text-blue-600 font-medium">Drop the files here...</p>
          ) : (
            <div>
              <p className="text-gray-600 font-medium mb-2">
                Drag & drop files here, or click to select
              </p>
              <p className="text-sm text-gray-500">
                Supports PDF, images, Word, Excel, and text files (max 10MB each)
              </p>
            </div>
          )}
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Files to Upload ({files.length})</h3>
              <Button 
                onClick={uploadAllFiles}
                disabled={isUploading || files.every(f => f.status !== 'pending')}
                className="flex items-center gap-2"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload All
              </Button>
            </div>

            <div className="space-y-3">
              {files.map((file) => (
                <div key={file.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      {getFileIcon(file.file.name)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.file.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(file.file.size)}
                        </p>
                      </div>
                      {getStatusBadge(file)}
                    </div>
                    {file.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {file.status === 'uploading' && (
                    <div className="mb-3">
                      <Progress value={file.progress} className="h-2" />
                    </div>
                  )}

                  {file.status === 'error' && file.error && (
                    <Alert className="mb-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-red-600">
                        {file.error}
                      </AlertDescription>
                    </Alert>
                  )}

                  {file.status === 'pending' && (
                    <div className="space-y-2">
                      <Label htmlFor={`description-${file.id}`}>
                        Description (optional)
                      </Label>
                      <Textarea
                        id={`description-${file.id}`}
                        value={file.description}
                        onChange={(e) => updateFileDescription(file.id, e.target.value)}
                        placeholder="Brief description of this document..."
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Summary */}
        {files.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Upload Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Files:</span>
                <span className="ml-2 font-medium">{files.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Pending:</span>
                <span className="ml-2 font-medium text-yellow-600">
                  {files.filter(f => f.status === 'pending').length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Uploaded:</span>
                <span className="ml-2 font-medium text-green-600">
                  {files.filter(f => f.status === 'success').length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Failed:</span>
                <span className="ml-2 font-medium text-red-600">
                  {files.filter(f => f.status === 'error').length}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdditionalFileUpload;