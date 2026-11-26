import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Eye, RefreshCw, Sparkles, Square } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { authService } from '@/services/authService';
import { OCRRescanDialog } from './OCRRescanDialog';
import { defaultApplyBody, isOcrReadableDocument, type RescanPreview } from './ocrRescan';

/** Most PRFs one bulk rescan may scan, to keep AI cost and server load bounded. */
export const BULK_RESCAN_LIMIT = 20;

type RowStatus = 'waiting' | 'scanning' | 'applied' | 'review' | 'skipped' | 'failed' | 'stopped';

interface SourceFile {
  FileID: number;
  OriginalFileName: string;
  IsOriginalDocument: boolean;
}

interface BulkRow {
  prfId: number;
  prfNo: string;
  status: RowStatus;
  message?: string;
  file?: SourceFile;
  preview?: RescanPreview;
}

interface StoredDocument extends SourceFile {
  MimeType?: string | null;
  FileType?: string | null;
}

interface BulkRescanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prfs: Array<{ prfId: number; prfNo: string }>;
  /** Called after the batch, or a reviewed PRF, changed PRF data. */
  onApplied?: () => void;
}

const STATUS_LABEL: Record<RowStatus, string> = {
  waiting: 'Waiting',
  scanning: 'Scanning…',
  applied: 'Applied',
  review: 'Needs review',
  skipped: 'Skipped',
  failed: 'Failed',
  stopped: 'Not scanned',
};

const statusVariant = (status: RowStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'applied') return 'default';
  if (status === 'failed') return 'destructive';
  if (status === 'review') return 'secondary';
  return 'outline';
};

const readJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return { success: false, message: `Server returned ${response.status}` };
  }
};

/**
 * Rescans the original document of several PRFs one after another. A clean result (only updates
 * to matched rows, no warnings) is applied with the default decisions; anything else is left for
 * review in the normal rescan dialog.
 */
export function BulkRescanDialog({ open, onOpenChange, prfs, onApplied }: BulkRescanDialogProps) {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [reviewRow, setReviewRow] = useState<BulkRow | null>(null);
  const stopRequested = useRef(false);

  useEffect(() => {
    if (!open) return;
    setRows(prfs.slice(0, BULK_RESCAN_LIMIT).map((prf) => ({ ...prf, status: 'waiting' })));
    setStarted(false);
    setReviewRow(null);
    stopRequested.current = false;
  }, [open, prfs]);

  const updateRow = (prfId: number, patch: Partial<BulkRow>) => {
    setRows((current) => current.map((row) => (row.prfId === prfId ? { ...row, ...patch } : row)));
  };

  const findSourceFile = async (prfId: number): Promise<SourceFile | null> => {
    const response = await fetch(`/api/prf-documents/documents/${prfId}`, { headers: authService.getAuthHeaders() });
    const body = await readJson(response);
    if (!response.ok || !body.success) throw new Error(body.message || 'Failed to load documents');
    const source = (body.data as StoredDocument[]).find((doc) => doc.IsOriginalDocument && isOcrReadableDocument(doc));
    return source
      ? { FileID: source.FileID, OriginalFileName: source.OriginalFileName, IsOriginalDocument: true }
      : null;
  };

  const rescanOne = async (row: BulkRow): Promise<boolean> => {
    updateRow(row.prfId, { status: 'scanning', message: undefined });
    try {
      const file = await findSourceFile(row.prfId);
      if (!file) {
        updateRow(row.prfId, { status: 'skipped', message: 'No original PDF or image document.' });
        return false;
      }
      const previewResponse = await fetch(`/api/ocr-prf/rescan/${row.prfId}/file/${file.FileID}/preview`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
      });
      const previewBody = await readJson(previewResponse);
      if (!previewResponse.ok || !previewBody.success) {
        updateRow(row.prfId, { status: 'failed', file, message: previewBody.message || 'OCR rescan failed' });
        return false;
      }
      const preview = previewBody.data as RescanPreview;
      if (!preview.autoApply?.eligible) {
        updateRow(row.prfId, {
          status: 'review',
          file,
          preview,
          message: preview.autoApply?.blockers.join(' ') || 'Needs review.',
        });
        return false;
      }
      const applyResponse = await fetch(`/api/ocr-prf/rescan/${row.prfId}/file/${file.FileID}/apply`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(defaultApplyBody(preview)),
      });
      const applyBody = await readJson(applyResponse);
      if (!applyResponse.ok || !applyBody.success) {
        updateRow(row.prfId, { status: 'review', file, preview, message: applyBody.message || 'Apply failed; review it.' });
        return false;
      }
      updateRow(row.prfId, {
        status: 'applied',
        file,
        preview: undefined,
        message: `${applyBody.data.updatedItemCount} row(s) updated.`,
      });
      return true;
    } catch (error) {
      updateRow(row.prfId, { status: 'failed', message: error instanceof Error ? error.message : 'OCR rescan failed' });
      return false;
    }
  };

  const start = async () => {
    setStarted(true);
    setRunning(true);
    stopRequested.current = false;
    let applied = 0;
    for (const row of rows) {
      if (stopRequested.current) {
        updateRow(row.prfId, { status: 'stopped' });
        continue;
      }
      if (await rescanOne(row)) applied++;
    }
    setRunning(false);
    if (applied > 0) onApplied?.();
  };

  const counts = rows.reduce<Record<RowStatus, number>>(
    (acc, row) => ({ ...acc, [row.status]: acc[row.status] + 1 }),
    { waiting: 0, scanning: 0, applied: 0, review: 0, skipped: 0, failed: 0, stopped: 0 }
  );
  const done = rows.length - counts.waiting - counts.scanning;
  const skippedByLimit = Math.max(0, prfs.length - BULK_RESCAN_LIMIT);

  return (
    <Dialog open={open} onOpenChange={(next) => !running && onOpenChange(next)}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Bulk AI Rescan — {rows.length} PRF
          </DialogTitle>
          <DialogDescription>
            Each PRF's original document is read with AI, one at a time. A clean result (it only updates rows the
            OCR matched, with no warnings) is applied automatically and recorded in the rescan audit. Anything else
            is marked Needs review and is not changed until you review it.
          </DialogDescription>
        </DialogHeader>

        {skippedByLimit > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Only the first {BULK_RESCAN_LIMIT} selected PRFs are included; {skippedByLimit} are left out. Run another batch for the rest.
            </AlertDescription>
          </Alert>
        )}

        {started && (
          <div className="space-y-2">
            <Progress value={rows.length ? (done / rows.length) * 100 : 0} />
            <p className="text-sm text-muted-foreground">
              {done} of {rows.length} done · {counts.applied} applied · {counts.review} need review · {counts.skipped} skipped · {counts.failed} failed
              {counts.stopped ? ` · ${counts.stopped} not scanned` : ''}
            </p>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PRF</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.prfId}>
                  <TableCell className="font-medium">{row.prfNo}</TableCell>
                  <TableCell className="max-w-48 truncate text-sm">{row.file?.OriginalFileName || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)} className="whitespace-nowrap">
                      {row.status === 'scanning' && <RefreshCw className="mr-1 h-3 w-3 animate-spin" />}
                      {row.status === 'applied' && <CheckCircle className="mr-1 h-3 w-3" />}
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md text-sm text-muted-foreground">{row.message || ''}</TableCell>
                  <TableCell>
                    {row.status === 'review' && row.preview && row.file && (
                      <Button size="sm" variant="outline" disabled={running} onClick={() => setReviewRow(row)}>
                        <Eye className="mr-1 h-4 w-4" />
                        Review
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end gap-2">
          {running ? (
            <Button variant="outline" onClick={() => { stopRequested.current = true; }}>
              <Square className="mr-2 h-4 w-4" />
              Stop after current PRF
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          )}
          {!started && (
            <Button onClick={start} disabled={rows.length === 0}>
              <Sparkles className="mr-2 h-4 w-4" />
              Start rescan ({rows.length})
            </Button>
          )}
        </div>

        {/* Rendered inside the bulk dialog so a click in it does not dismiss the bulk dialog. */}
        <OCRRescanDialog
          open={reviewRow !== null}
          onOpenChange={(next) => { if (!next) setReviewRow(null); }}
          prfId={reviewRow?.prfId ?? 0}
          prfNo={reviewRow?.prfNo ?? ''}
          file={reviewRow?.file ?? null}
          initialPreview={reviewRow?.preview ?? null}
          onApplied={() => {
            if (reviewRow) updateRow(reviewRow.prfId, { status: 'applied', preview: undefined, message: 'Applied after review.' });
            onApplied?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
