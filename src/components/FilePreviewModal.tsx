import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { X, Download, ExternalLink } from 'lucide-react';
import { formatBytes } from '../lib/utils';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    id: string;
    filename: string;
    originalName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
  } | null;
  prfId: string;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  prfId
}) => {
  if (!file) return null;

  const isImage = file.mimeType.startsWith('image/');
  const isPDF = file.mimeType === 'application/pdf';
  const isPreviewable = isImage || isPDF;

  const fileUrl = `/api/prf-documents/view/${file.id}`;
  const downloadUrl = `/api/prf-documents/download/${file.id}`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(fileUrl, '_blank');
  };

  const renderPreview = () => {
    if (isImage) {
      return (
        <div className="flex justify-center items-center bg-gray-50 rounded-lg p-4">
          <img
            src={fileUrl}
            alt={file.originalName}
            className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement!.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 text-gray-500">
                  <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                  </svg>
                  <p>Failed to load image</p>
                </div>
              `;
            }}
          />
        </div>
      );
    }

    if (isPDF) {
      return (
        <div className="bg-gray-50 rounded-lg p-4">
          <iframe
            src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
            className="w-full h-[60vh] rounded-lg border"
            title={file.originalName}
            onError={() => {
              // Fallback for PDF preview failure
              const iframe = document.querySelector('iframe');
              if (iframe && iframe.parentElement) {
                iframe.parentElement.innerHTML = `
                  <div class="flex flex-col items-center justify-center p-8 text-gray-500 h-[60vh]">
                    <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p class="mb-2">PDF preview not available</p>
                    <p class="text-sm">Click "Open in New Tab" to view the PDF</p>
                  </div>
                `;
              }
            }}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500 bg-gray-50 rounded-lg">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="mb-2">Preview not available</p>
        <p className="text-sm">File type: {file.mimeType}</p>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex-1">
            <DialogTitle className="text-lg font-semibold truncate pr-4">
              {file.originalName}
            </DialogTitle>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
              <span>{formatBytes(file.fileSize)}</span>
              <span>{file.mimeType}</span>
              <span>Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPDF && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInNewTab}
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open in New Tab
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="overflow-auto">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreviewModal;