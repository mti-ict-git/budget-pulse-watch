import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { authService } from '@/services/authService';
import { toast } from '@/hooks/use-toast';

interface OCRSourceRef {
  FileID: number;
  OriginalFileName: string;
}

interface RescanProposal {
  index: number;
  action: 'update' | 'add';
  matchReason: string;
  existing?: { ItemName: string; PurchaseCostCode?: string | null };
  scanned: {
    partNumber?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    purchaseCostCode?: string;
  };
}

interface RescanPreview {
  extractedData: {
    prfNo?: string;
    department?: string;
    totalAmount?: number;
    confidence?: number;
    items?: RescanProposal['scanned'][];
  };
  proposals: RescanProposal[];
  preservedItems: Array<{ PRFItemID: number; ItemName: string }>;
  warnings: string[];
}

interface OCRRescanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prfId: number;
  prfNo: string;
  file: OCRSourceRef | null;
  onApplied?: () => void;
}

export function OCRRescanDialog({ open, onOpenChange, prfId, prfNo, file, onApplied }: OCRRescanDialogProps) {
  const [preview, setPreview] = useState<RescanPreview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [updateHeader, setUpdateHeader] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !file) return;
    let active = true;
    setLoading(true);
    setPreview(null);
    setSelected(new Set());
    setUpdateHeader(false);
    setError(null);
    fetch(`/api/ocr-prf/rescan/${prfId}/file/${file.FileID}/preview`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
    })
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok || !body.success) throw new Error(body.message || 'OCR rescan failed');
        if (!active) return;
        const next = body.data as RescanPreview;
        setPreview(next);
        setSelected(new Set(next.proposals.map((proposal) => proposal.index)));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'OCR rescan failed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, file, prfId]);

  const toggle = (index: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const apply = async () => {
    if (!file || !preview) return;
    setApplying(true);
    setError(null);
    try {
      const response = await fetch(`/api/ocr-prf/rescan/${prfId}/file/${file.FileID}/apply`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({
          extractedData: preview.extractedData,
          selectedIndexes: Array.from(selected),
          updateHeader,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || 'Failed to apply OCR rescan');
      toast({
        title: 'PRF updated from OCR source',
        description: `${body.data.updatedItemCount} updated, ${body.data.addedItemCount} added, ${body.data.preservedItemCount} preserved.`,
      });
      onOpenChange(false);
      onApplied?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to apply OCR rescan');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !applying && onOpenChange(next)}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Rescan Preview — PRF {prfNo}
          </DialogTitle>
          <DialogDescription>
            Review the OCR proposal. Existing items that are not found remain unchanged.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-12">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Reading {file?.OriginalFileName} with AI...
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : preview ? (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-4">
              <div><span className="text-muted-foreground">Scanned PRF</span><p className="font-medium">{preview.extractedData.prfNo || '-'}</p></div>
              <div><span className="text-muted-foreground">Department</span><p className="font-medium">{preview.extractedData.department || '-'}</p></div>
              <div><span className="text-muted-foreground">Amount</span><p className="font-medium">{Number(preview.extractedData.totalAmount || 0).toLocaleString('id-ID')}</p></div>
              <div><span className="text-muted-foreground">Confidence</span><p className="font-medium">{Math.round(Number(preview.extractedData.confidence || 0) * 100)}%</p></div>
            </div>

            {preview.warnings.length > 0 && (
              <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>{preview.warnings.join(' • ')}</AlertDescription></Alert>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={updateHeader} onChange={(event) => setUpdateHeader(event.target.checked)} />
              Also update safe header fields
            </label>

            <div className="overflow-x-auto rounded-lg border">
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
                  {preview.proposals.map((proposal) => (
                    <TableRow key={proposal.index}>
                      <TableCell><input type="checkbox" checked={selected.has(proposal.index)} onChange={() => toggle(proposal.index)} /></TableCell>
                      <TableCell><Badge variant={proposal.action === 'add' ? 'default' : 'secondary'}>{proposal.action === 'add' ? 'Add' : `Update · ${proposal.matchReason}`}</Badge></TableCell>
                      <TableCell>{proposal.existing?.ItemName || 'New item'}</TableCell>
                      <TableCell>{proposal.scanned.description || proposal.scanned.partNumber || '-'}</TableCell>
                      <TableCell>{proposal.existing?.PurchaseCostCode || <span className="text-destructive">Blank</span>}</TableCell>
                      <TableCell>{proposal.scanned.purchaseCostCode || <span className="text-destructive">Blank</span>}</TableCell>
                      <TableCell className="text-right">{(Number(proposal.scanned.quantity || 1) * Number(proposal.scanned.unitPrice || 0)).toLocaleString('id-ID')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {preview.preservedItems.length > 0 && (
              <Alert><CheckCircle className="h-4 w-4" /><AlertDescription>{preview.preservedItems.length} existing item(s) will remain unchanged.</AlertDescription></Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={applying} onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={applying || selected.size === 0} onClick={apply}>
                {applying ? 'Applying...' : `Approve & Update ${selected.size} Item(s)`}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
