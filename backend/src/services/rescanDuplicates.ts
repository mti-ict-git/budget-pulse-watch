/**
 * Duplicate detection for OCR rescan.
 *
 * An earlier scan can leave a misread copy of an item next to the corrected one (PRF 54123: 9 items
 * stored twice, once without item code and with a misread GL, once corrected). On rescan the OCR
 * matches the corrected copy, and the misread copy is left as "not found by OCR". This module
 * points such leftovers at the item they duplicate, so the reviewer can remove them.
 */

export type RescanDuplicateCandidate = {
  PRFItemID: number;
  ItemName: string;
  Description?: string | null;
  Quantity: number;
  UnitPrice: number;
  Status?: string | null;
};

export type LikelyDuplicate = {
  PRFItemID: number;
  ItemName: string;
  similarity: number;
};

const tokens = (value: string): Set<string> =>
  new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 1)
  );

/** Share of words two item texts have in common (Jaccard, 0 to 1). */
export const itemTextSimilarity = (a: string, b: string): number => {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return shared / (left.size + right.size - shared);
};

/** Names this close, with the same quantity and a near price, are treated as the same item. */
export const DUPLICATE_MIN_SIMILARITY = 0.3;
/** A misread price differs a little (6,300,000 for 6,600,000); a different item usually differs more. */
export const DUPLICATE_MAX_PRICE_DIFFERENCE = 0.1;

const itemText = (item: RescanDuplicateCandidate) => `${item.ItemName || ''} ${item.Description || ''}`;
const isCancelled = (item: RescanDuplicateCandidate) => (item.Status || '').toLowerCase() === 'cancelled';

const nearPrice = (a: number, b: number): boolean => {
  const left = Number(a) || 0;
  const right = Number(b) || 0;
  if (left === right) return true;
  const larger = Math.max(Math.abs(left), Math.abs(right));
  return larger > 0 && Math.abs(left - right) / larger <= DUPLICATE_MAX_PRICE_DIFFERENCE;
};

/**
 * For each item not found by OCR, the item it most likely duplicates among the items the OCR did
 * find. Each counterpart is used once, best match first. Cancelled items are never paired.
 */
export const findLikelyDuplicates = (
  unmatched: RescanDuplicateCandidate[],
  matched: RescanDuplicateCandidate[]
): Map<number, LikelyDuplicate> => {
  const pairs: Array<{ from: RescanDuplicateCandidate; to: RescanDuplicateCandidate; similarity: number }> = [];
  for (const from of unmatched) {
    if (isCancelled(from)) continue;
    for (const to of matched) {
      if (isCancelled(to) || to.PRFItemID === from.PRFItemID) continue;
      if (Number(from.Quantity) !== Number(to.Quantity) || !nearPrice(from.UnitPrice, to.UnitPrice)) continue;
      const similarity = itemTextSimilarity(itemText(from), itemText(to));
      if (similarity >= DUPLICATE_MIN_SIMILARITY) pairs.push({ from, to, similarity });
    }
  }
  pairs.sort((a, b) => b.similarity - a.similarity);
  const result = new Map<number, LikelyDuplicate>();
  const usedTargets = new Set<number>();
  for (const pair of pairs) {
    if (result.has(pair.from.PRFItemID) || usedTargets.has(pair.to.PRFItemID)) continue;
    usedTargets.add(pair.to.PRFItemID);
    result.set(pair.from.PRFItemID, {
      PRFItemID: pair.to.PRFItemID,
      ItemName: pair.to.ItemName,
      similarity: Math.round(pair.similarity * 100) / 100
    });
  }
  return result;
};
