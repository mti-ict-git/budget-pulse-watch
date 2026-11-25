/** Shared types and default decisions for the OCR rescan dialog and bulk rescan. */

export interface RescanProposal {
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

export interface RescanPreview {
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
  preservedItems: Array<{
    PRFItemID: number; ItemName: string; Description?: string | null; ItemCode?: string | null; PurchaseCostCode?: string | null; Status?: string | null;
    /** Set when this leftover is most likely a duplicate of an item the OCR did find. */
    likelyDuplicateOf?: { PRFItemID: number; ItemName: string; similarity: number };
  }>;
  warnings: string[];
  /** Whether bulk rescan may apply this preview without review, and why not. */
  autoApply?: { eligible: boolean; blockers: string[] };
  totals: {
    documentTotal: number;
    extractedItemsTotal: number;
    activeItemsTotal: number;
    cancelledItemsTotal: number;
    documentItemVariance: number;
  };
}

export type ProposalAction = 'update' | 'keep' | 'add' | 'ignore';
export type PreservedAction = 'keep' | 'cancel' | 'remove';

/** The decision the dialog preselects for a scanned row. */
export const getDefaultProposalAction = (proposal: RescanProposal): ProposalAction => {
  const isCancelled = proposal.scanned.status === 'Cancelled' || proposal.scanned.isStruckThrough;
  if (proposal.action === 'add') {
    return isCancelled ? 'ignore' : 'add';
  }
  return isCancelled ? 'keep' : 'update';
};

/** The decision the dialog preselects for an existing row the OCR did not find. */
export const getDefaultPreservedAction = (item: RescanPreview['preservedItems'][number]): PreservedAction =>
  item.likelyDuplicateOf ? 'remove' : 'keep';

/** Apply payload that takes every default decision, as bulk rescan does for a clean preview. */
export const defaultApplyBody = (preview: RescanPreview) => ({
  previewToken: preview.previewToken,
  proposalDecisions: preview.proposals.map((proposal) => ({
    index: proposal.index,
    action: getDefaultProposalAction(proposal),
  })),
  preservedItemDecisions: preview.preservedItems.map((item) => ({
    prfItemId: item.PRFItemID,
    action: getDefaultPreservedAction(item),
  })),
  updateHeader: false,
});

const OCR_FILE_TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];

/** Whether a stored PRF document can be read by the AI scan (PDF or image). */
export const isOcrReadableDocument = (doc: { MimeType?: string | null; FileType?: string | null }): boolean => {
  const mimeType = (doc.MimeType || '').toLowerCase();
  const fileType = (doc.FileType || '').toLowerCase().replace(/^\./, '');
  return mimeType === 'application/pdf' || mimeType.startsWith('image/') || OCR_FILE_TYPES.includes(fileType);
};
