/**
 * Decides whether an OCR rescan preview is clean enough to apply without a person reviewing it.
 *
 * Bulk rescan applies clean previews with the default decisions and leaves the rest for review in
 * the rescan dialog. A preview is clean only when applying it can do nothing but update existing
 * rows that the OCR matched: no warnings, no new rows, no existing rows left unmatched, and no
 * row proposed as cancelled.
 */

export type AutoApplyPreview = {
  proposals: Array<{ action: 'update' | 'add'; scanned: { status?: string; isStruckThrough?: boolean } }>;
  preservedItems: unknown[];
  warnings: string[];
};

export type AutoApplyDecision = {
  eligible: boolean;
  /** Why the preview needs review; empty when eligible. */
  blockers: string[];
};

export const rescanAutoApplyDecision = (preview: AutoApplyPreview): AutoApplyDecision => {
  const blockers: string[] = [];
  if (preview.proposals.length === 0) blockers.push('The OCR found no item rows.');
  if (preview.warnings.length > 0) blockers.push(`${preview.warnings.length} warning(s) need review.`);
  const added = preview.proposals.filter((proposal) => proposal.action === 'add').length;
  if (added > 0) blockers.push(`${added} new row(s) would be added.`);
  if (preview.preservedItems.length > 0) {
    blockers.push(`${preview.preservedItems.length} existing row(s) were not found by OCR.`);
  }
  const cancelled = preview.proposals.filter(
    (proposal) => proposal.scanned.status === 'Cancelled' || proposal.scanned.isStruckThrough
  ).length;
  if (cancelled > 0) blockers.push(`${cancelled} row(s) look cancelled.`);
  return { eligible: blockers.length === 0, blockers };
};
