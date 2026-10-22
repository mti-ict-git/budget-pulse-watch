import { useCallback, useEffect, useState } from 'react';
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
  IsOriginalDocument?: boolean;
}

interface RescanProposal {
  index: number;
  action: 'update' | 'add';
  matchReason: string;
  existing?: { PRFItemID?: number; ItemName: string; Description?: string | null; ItemCode?: string | null; PurchaseCostCode?: string | null; Status?: string | null };
  scanned: {
    partNumber?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    purchaseCostCode?: string;
    status?: 'Active' | 'Cancelled';
    statusReason?: string;
    isStruckThrough?: boolean;
  };
}

interface RescanPreview {
  previewToken: string;
  extractedData: {
    prfNo?: string;
    rawProjectDescription?: string;
    projectArea?: string;
    projectDescription?: string;
    semanticTitle?: string;
    requestFor?: string;
    department?: string;
    totalAmount?: number;
    confidence?: number;
    items?: RescanProposal['scanned'][];
  };
  proposals: RescanProposal[];
  preservedItems: Array<{ PRFItemID: number; ItemName: string; Description?: string | null; ItemCode?: string | null; PurchaseCostCode?: string | null; Status?: string | null }>;
  warnings: string[];
  totals: {
    documentTotal: number;
    extractedItemsTotal: number;
    activeItemsTotal: number;
    cancelledItemsTotal: number;
    documentItemVariance: number;
  };
}

type ProposalAction = 'update' | 'keep' | 'add' | 'ignore';
type PreservedAction = 'keep' | 'cancel';

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
  const [proposalActions, setProposalActions] = useState<Record<number, ProposalAction>>({});
  const [preservedActions, setPreservedActions] = useState<Record<number, PreservedAction>>({});
  const [updateHeader, setUpdateHeader] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshingPreview, setRefreshingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRefreshRequired, setPreviewRefreshRequired] = useState(false);

  const getDefaultProposalAction = (proposal: RescanProposal): ProposalAction => {
    const isCancelled = proposal.scanned.status === 'Cancelled' || proposal.scanned.isStruckThrough;
    if (proposal.action === 'add') {
      return isCancelled ? 'ignore' : 'add';
    }
    return isCancelled ? 'keep' : 'update';
  };

  const isPreviewTokenError = (message: string): boolean => {
    const normalized = message.trim().toLowerCase();
    return normalized.includes('preview expired')
      || normalized.includes('preview token')
      || normalized.includes('jwt expired')
      || normalized.includes('refresh preview');
  };

  const loadPreview = useCallback(async (preserveCurrentPreview: boolean) => {
    if (!file) return;

    if (preserveCurrentPreview) {
      setRefreshingPreview(true);
    } else {
      setLoading(true);
      setPreview(null);
      setProposalActions({});
      setPreservedActions({});
      setUpdateHeader(false);
    }

    setError(null);
    setPreviewRefreshRequired(false);

    try {
      const response = await fetch(`/api/ocr-prf/rescan/${prfId}/file/${file.FileID}/preview`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.message || 'OCR rescan failed');
      }

      const next = body.data as RescanPreview;
      setPreview(next);
      setProposalActions(
        Object.fromEntries(next.proposals.map((proposal) => [proposal.index, getDefaultProposalAction(proposal)]))
      );
      setPreservedActions(
        Object.fromEntries(next.preservedItems.map((item) => [item.PRFItemID, 'keep']))
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'OCR rescan failed');
    } finally {
      setLoading(false);
      setRefreshingPreview(false);
    }
  }, [file, prfId]);

  useEffect(() => {
    if (!open || !file) return;
    void loadPreview(false);
  }, [open, file, loadPreview]);

  const setProposalAction = (index: number, action: ProposalAction) => {
    setProposalActions((current) => ({ ...current, [index]: action }));
  };

  const setPreservedAction = (prfItemId: number, action: PreservedAction) => {
    setPreservedActions((current) => ({ ...current, [prfItemId]: action }));
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
          previewToken: preview.previewToken,
          proposalDecisions: preview.proposals.map((proposal) => ({
            index: proposal.index,
            action: proposalActions[proposal.index] ?? getDefaultProposalAction(proposal),
          })),
          preservedItemDecisions: preview.preservedItems.map((item) => ({
            prfItemId: item.PRFItemID,
            action: preservedActions[item.PRFItemID] ?? 'keep',
          })),
          updateHeader,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || 'Failed to apply OCR rescan');
      toast({
        title: 'PRF updated from AI scan',
        description: `${body.data.updatedItemCount} updated, ${body.data.addedItemCount} added, ${body.data.cancelledItemCount || 0} cancelled, ${body.data.preservedItemCount} preserved.`,
      });
      onOpenChange(false);
      onApplied?.();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Failed to apply OCR rescan';
      const requiresRefresh = isPreviewTokenError(message);
      setPreviewRefreshRequired(requiresRefresh);
      setError(
        requiresRefresh
          ? 'Preview OCR sudah kedaluwarsa atau tidak lagi valid. Klik Refresh preview lalu apply lagi.'
          : message
      );
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
            Review the AI proposal from {file?.IsOriginalDocument ? 'the OCR Source' : 'the selected alternative document'}.
            You can decide per item whether to update from OCR, keep the existing value, add a new row, ignore a scanned row, or mark an unmatched existing item as cancelled.
          </DialogDescription>
        </DialogHeader>

        {loading && !preview ? (
          <div className="flex items-center justify-center gap-3 py-12">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Reading {file?.OriginalFileName} with AI...
          </div>
        ) : preview ? (
          <div className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{error}</span>
                  {previewRefreshRequired ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={refreshingPreview || applying}
                      onClick={() => {
                        void loadPreview(true);
                      }}
                    >
                      {refreshingPreview ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh preview
                        </>
                      )}
                    </Button>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-4">
              <div><span className="text-muted-foreground">Scanned PRF</span><p className="font-medium">{preview.extractedData.prfNo || '-'}</p></div>
              <div><span className="text-muted-foreground">Department</span><p className="font-medium">{preview.extractedData.department || '-'}</p></div>
              <div><span className="text-muted-foreground">Amount</span><p className="font-medium">{Number(preview.extractedData.totalAmount || 0).toLocaleString('id-ID')}</p></div>
              <div><span className="text-muted-foreground">Confidence</span><p className="font-medium">{Math.round(Number(preview.extractedData.confidence || 0) * 100)}%</p></div>
            </div>

            <div className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-2">
              <div><span className="text-muted-foreground">Raw Project Description/Area</span><p className="font-medium">{preview.extractedData.rawProjectDescription || '-'}</p></div>
              <div><span className="text-muted-foreground">Project Area</span><p className="font-medium">{preview.extractedData.projectArea || '-'}</p></div>
              <div><span className="text-muted-foreground">Proposed Title</span><p className="font-medium">{preview.extractedData.semanticTitle || '-'}</p></div>
              <div><span className="text-muted-foreground">Required For</span><p className="font-medium">{preview.extractedData.requestFor || '-'}</p></div>
              <div className="md:col-span-2"><span className="text-muted-foreground">Proposed Description</span><p className="font-medium">{preview.extractedData.projectDescription || '-'}</p></div>
            </div>

            <div className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-4">
              <div><span className="text-muted-foreground">Document total</span><p className="font-medium">{Number(preview.totals.documentTotal).toLocaleString('id-ID')}</p></div>
              <div><span className="text-muted-foreground">Extracted row total</span><p className="font-medium">{Number(preview.totals.extractedItemsTotal).toLocaleString('id-ID')}</p></div>
              <div><span className="text-muted-foreground">Cancelled rows</span><p className="font-medium text-destructive">− {Number(preview.totals.cancelledItemsTotal).toLocaleString('id-ID')}</p></div>
              <div><span className="text-muted-foreground">Active budget total</span><p className="font-semibold text-primary">{Number(preview.totals.activeItemsTotal).toLocaleString('id-ID')}</p></div>
            </div>

            {preview.warnings.length > 0 && (
              <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>{preview.warnings.join(' • ')}</AlertDescription></Alert>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={updateHeader} onChange={(event) => setUpdateHeader(event.target.checked)} />
                Also update safe header fields{preview.totals.cancelledItemsTotal > 0 ? ' (amount uses active budget total)' : ''}
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || refreshingPreview || applying}
                onClick={() => {
                  void loadPreview(true);
                }}
              >
                {refreshingPreview ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing preview...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh preview
                  </>
                )}
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Decision</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Existing item</TableHead>
                    <TableHead>AI scanned item</TableHead>
                    <TableHead>Part / Item code</TableHead>
                    <TableHead>Existing cost code</TableHead>
                    <TableHead>Scanned cost code</TableHead>
                    <TableHead>Existing status</TableHead>
                    <TableHead>AI status proposal</TableHead>
                    <TableHead className="text-right">Scanned total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.proposals.map((proposal) => (
                    <TableRow key={proposal.index}>
                      <TableCell>
                        <select
                          className="w-full rounded border bg-background px-2 py-1 text-sm"
                          value={proposalActions[proposal.index] ?? getDefaultProposalAction(proposal)}
                          onChange={(event) => setProposalAction(proposal.index, event.target.value as ProposalAction)}
                        >
                          {proposal.action === 'add' ? (
                            <>
                              <option value="add">Add from OCR</option>
                              <option value="ignore">Ignore OCR row</option>
                            </>
                          ) : (
                            <>
                              <option value="update">Update from OCR</option>
                              <option value="keep">Keep existing</option>
                            </>
                          )}
                        </select>
                      </TableCell>
                      <TableCell><Badge variant={proposal.action === 'add' ? 'default' : 'secondary'}>{proposal.action === 'add' ? 'Add' : `Update · ${proposal.matchReason}`}</Badge></TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{proposal.existing?.ItemName || 'New item'}</div>
                          {proposal.existing?.Description && proposal.existing.Description !== proposal.existing.ItemName ? (
                            <div className="text-xs text-muted-foreground">{proposal.existing.Description}</div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{proposal.scanned.description || proposal.scanned.partNumber || '-'}</div>
                          <div className="text-xs text-muted-foreground">
                            Qty {Number(proposal.scanned.quantity || 1).toLocaleString('id-ID')} x {Number(proposal.scanned.unitPrice || 0).toLocaleString('id-ID')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{proposal.existing?.ItemCode || '-'}</div>
                          <div className="text-xs text-muted-foreground">{proposal.scanned.partNumber || '-'}</div>
                        </div>
                      </TableCell>
                      <TableCell>{proposal.existing?.PurchaseCostCode || <span className="text-destructive">Blank</span>}</TableCell>
                      <TableCell>{proposal.scanned.purchaseCostCode || <span className="text-destructive">Blank</span>}</TableCell>
                      <TableCell>{proposal.existing?.Status || (proposal.action === 'add' ? 'New item' : '-')}</TableCell>
                      <TableCell>
                        {proposal.scanned.status === 'Cancelled' || proposal.scanned.isStruckThrough ? (
                          <div className="space-y-1">
                            <Badge variant="destructive">Cancelled</Badge>
                            <p className="max-w-48 text-xs text-muted-foreground">{proposal.scanned.statusReason || 'Visible strikethrough detected'}</p>
                          </div>
                        ) : (
                          <Badge variant="outline">No status change</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{(Number(proposal.scanned.quantity || 1) * Number(proposal.scanned.unitPrice || 0)).toLocaleString('id-ID')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {preview.preservedItems.length > 0 && (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Existing item(s) not found by OCR
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-40">Decision</TableHead>
                        <TableHead>Existing item</TableHead>
                        <TableHead>Part / Item code</TableHead>
                        <TableHead>Cost code</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.preservedItems.map((item) => (
                        <TableRow key={item.PRFItemID}>
                          <TableCell>
                            <select
                              className="w-full rounded border bg-background px-2 py-1 text-sm"
                              value={preservedActions[item.PRFItemID] ?? 'keep'}
                              onChange={(event) => setPreservedAction(item.PRFItemID, event.target.value as PreservedAction)}
                            >
                              <option value="keep">Keep existing</option>
                              <option value="cancel">Mark Cancelled</option>
                            </select>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div>{item.ItemName}</div>
                              {item.Description && item.Description !== item.ItemName ? (
                                <div className="text-xs text-muted-foreground">{item.Description}</div>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{item.ItemCode || '-'}</TableCell>
                          <TableCell>{item.PurchaseCostCode || <span className="text-destructive">Blank</span>}</TableCell>
                          <TableCell>{item.Status || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={applying} onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={applying || refreshingPreview || previewRefreshRequired} onClick={apply}>
                {applying ? 'Applying...' : 'Apply Rescan Decisions'}
              </Button>
            </div>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{error}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={refreshingPreview || applying || !file}
                onClick={() => {
                  void loadPreview(false);
                }}
              >
                {refreshingPreview || loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh preview
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
