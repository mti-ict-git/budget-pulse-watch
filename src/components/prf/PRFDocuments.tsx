import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  RefreshCw, 
  FolderOpen, 
  FileText, 
  Download, 
  Eye, 
  AlertCircle, 
  CheckCircle, 
  Folder,
  HardDrive,
  Clock
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import FilePreviewModal from '@/components/FilePreviewModal';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';

interface PRFDocument {
  FileID: number;
  PRFID: number;
  OriginalFileName: string;
  FilePath: string;
  SharedPath: string | null;
  FileSize: number;
  FileType: string;
  MimeType: string;
  UploadDate: string;
  UploadedBy: number;
  IsOriginalDocument: boolean;
  Description: string | null;
}

interface FolderScanResult {
  prfNo: string;
  folderPath: string;
  documents: {
    fileName: string;
    filePath: string;
    fileSize: number;
    fileType: string;
    mimeType: string;
    lastModified: string;
  }[];
  totalFiles: number;
  totalSize: number;
}

interface PRFDocumentsProps {
  prfId: number;
  prfNo: string;
  onDocumentUpdate?: () => void;
}

const PRFDocuments: React.FC<PRFDocumentsProps> = ({ prfId, prfNo, onDocumentUpdate }) => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<PRFDocument[]>([]);
  const [folderScanResult, setFolderScanResult] = useState<FolderScanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<PRFDocument | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, [prfId]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/prf-documents/documents/${prfId}`, {
        headers: authService.getAuthHeaders(),
      });
      const result = await response.json();
      
      if (result.success) {
        setDocuments(result.data);
      } else {
        throw new Error(result.message || 'Failed to load documents');
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: "Error Loading Documents",
        description: error instanceof Error ? error.message : 'Failed to load documents',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const scanFolder = async () => {
    setIsScanning(true);
    try {
      const response = await fetch(`/api/prf-documents/scan-folder/${prfNo}`, {
        headers: authService.getAuthHeaders(),
      });
      const result = await response.json();
      
      if (result.success) {
        setFolderScanResult(result.data);
        toast({
          title: "Folder Scanned Successfully",
          description: `Found ${result.data.totalFiles} files in folder ${prfNo}`,
        });
      } else {
        throw new Error(result.message || 'Failed to scan folder');
      }
    } catch (error) {
      console.error('Error scanning folder:', error);
      toast({
        title: "Error Scanning Folder",
        description: error instanceof Error ? error.message : 'Failed to scan folder',
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const syncFolder = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to sync folders.",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch(`/api/prf-documents/sync-folder/${prfNo}`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ userId: user.id }),
      });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Folder Synced Successfully",
          description: `Synced ${result.data.insertedFiles} files from folder ${prfNo}`,
        });
        
        // Reload documents and clear scan result
        await loadDocuments();
        setFolderScanResult(null);
        onDocumentUpdate?.();
      } else {
        throw new Error(result.message || 'Failed to sync folder');
      }
    } catch (error) {
      console.error('Error syncing folder:', error);
      toast({
        title: "Error Syncing Folder",
        description: error instanceof Error ? error.message : 'Failed to sync folder',
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (['pdf'].includes(type)) return <FileText className="h-4 w-4 text-red-500" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(type)) return <Eye className="h-4 w-4 text-blue-500" />;
    if (['doc', 'docx'].includes(type)) return <FileText className="h-4 w-4 text-blue-600" />;
    if (['xls', 'xlsx'].includes(type)) return <FileText className="h-4 w-4 text-green-600" />;
    return <FileText className="h-4 w-4 text-gray-500" />;
  };

  const handleDocumentView = (document: PRFDocument) => {
    setSelectedDocument(document);
    setShowPreview(true);
  };

  const handleDocumentDownload = async (doc: PRFDocument) => {
    try {
      const link = document.createElement('a');
      link.href = `/api/prf-documents/download/${doc.FileID}`;
      link.download = doc.OriginalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Download Started",
        description: `Downloading ${doc.OriginalFileName}`,
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Download Failed",
        description: `Failed to download ${doc.OriginalFileName}`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">PRF Documents</h3>
          <p className="text-sm text-muted-foreground">
            Documents for PRF {prfNo}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={scanFolder}
            disabled={isScanning}
          >
            {isScanning ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FolderOpen className="h-4 w-4 mr-2" />
            )}
            Scan Folder
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDocuments}
            disabled={isLoading}
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Folder Scan Results */}
      {folderScanResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Folder Scan Results
            </CardTitle>
            <CardDescription>
              Found {folderScanResult.totalFiles} files in {folderScanResult.folderPath}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">
                    {folderScanResult.totalFiles} files
                  </Badge>
                  <Badge variant="outline">
                    {formatFileSize(folderScanResult.totalSize)}
                  </Badge>
                </div>
                <Button
                  onClick={syncFolder}
                  disabled={isSyncing}
                  size="sm"
                >
                  {isSyncing ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Sync to Database
                </Button>
              </div>
              
              {folderScanResult.documents.length > 0 && (
                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {folderScanResult.documents.slice(0, 10).map((doc, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        {getFileIcon(doc.fileType)}
                        <span className="flex-1 truncate">{doc.fileName}</span>
                        <span className="text-muted-foreground">
                          {formatFileSize(doc.fileSize)}
                        </span>
                      </div>
                    ))}
                    {folderScanResult.documents.length > 10 && (
                      <div className="text-sm text-muted-foreground text-center pt-2">
                        ... and {folderScanResult.documents.length - 10} more files
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Synced Documents
          </CardTitle>
          <CardDescription>
            Documents stored in database for this PRF
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading documents...</span>
            </div>
          ) : documents.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No documents found. Use "Scan Folder" to find documents in the network folder.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.FileID}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                >
                  {getFileIcon(doc.FileType)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {doc.OriginalFileName}
                      </span>
                      {doc.IsOriginalDocument && (
                        <Badge variant="secondary" className="text-xs">
                          OCR Source
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{formatFileSize(doc.FileSize)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(doc.UploadDate).toLocaleDateString()}
                      </span>
                      {doc.Description && (
                        <span className="truncate">{doc.Description}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDocumentView(doc)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDocumentDownload(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false);
          setSelectedDocument(null);
        }}
        file={selectedDocument ? {
          id: selectedDocument.FileID.toString(),
          filename: selectedDocument.OriginalFileName,
          originalName: selectedDocument.OriginalFileName,
          fileSize: selectedDocument.FileSize,
          mimeType: selectedDocument.MimeType,
          uploadedAt: selectedDocument.UploadDate
        } : null}
        prfId={prfId.toString()}
      />
    </div>
  );
};

export default PRFDocuments;