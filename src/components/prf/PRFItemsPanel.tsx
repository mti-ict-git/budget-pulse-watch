import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, Edit, Maximize2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PRFItem } from '@/types/prfItem';
import { downloadPrfItems } from '@/lib/exportPrfItems';
import { toast } from '@/hooks/use-toast';

interface PanelPRF {
  id: string;
  prfNo: string;
  description: string;
  amount: number;
  progress: string;
  items?: PRFItem[];
}

interface Props {
  closing?: boolean;
  expanded?: boolean;
  onExpand?: () => void;
  prfs: PanelPRF[];
  allItems: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onEdit: (item: PRFItem, prfStatus: string) => void;
  statusBadge: (status: string) => ReactNode;
  formatCurrency: (amount: number) => string;
  getCOAName: (id: number) => string;
}

function Specifications({ value }: { value: string }) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return <dl>{Object.entries(parsed).map(([key, entry]) => <div key={key}><dt>{key}</dt><dd>{typeof entry === 'object' ? JSON.stringify(entry) : String(entry ?? '')}</dd></div>)}</dl>;
    }
  } catch { /* Legacy specifications can be plain text. */ }
  return <p>{value}</p>;
}

export function PRFItemsPanel({ closing = false, expanded = false, onExpand, prfs, allItems, loading, error, onClose, onRetry, onEdit, statusBadge, formatCurrency, getCOAName }: Props) {
  const [exporting, setExporting] = useState(false);
  const exportPending = useRef(false);
  const count = prfs.reduce((total, prf) => total + (prf.items?.length ?? 0), 0);
  const first = prfs[0];
  const Metadata = expanded ? 'div' : 'details';

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (expanded || event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]')) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable=true]')) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, expanded]);

  const exportItems = async () => {
    if (loading || error || !count || exportPending.current) return;
    exportPending.current = true;
    setExporting(true);
    try {
      await downloadPrfItems(prfs, getCOAName);
      toast({ title: 'Export started', description: `${count} items from ${prfs.length} PRF${prfs.length === 1 ? '' : 's'} prepared for download.` });
    } catch {
      toast({ title: 'Export failed', description: 'Unable to create the Excel file. Please try again.', variant: 'destructive' });
    } finally {
      exportPending.current = false;
      setExporting(false);
    }
  };

  return (
    <aside id="prf-items-panel" className={`merdeka-prf-items-panel ${closing ? 'is-closing' : ''}`} {...(closing ? { inert: '' } : {})} aria-hidden={closing || undefined} aria-label="PRF item panel" aria-busy={loading}>
      <header className="merdeka-items-heading">
        <div className="merdeka-items-title-row"><h2>{allItems ? 'All items on this page' : `PRF ${first.prfNo}`}</h2><div className="merdeka-items-heading-actions"><Button className="merdeka-items-export" variant="outline" size="sm" onClick={exportItems} disabled={loading || !!error || count === 0 || closing || exporting} aria-busy={exporting} title={allItems ? 'Export all items on this page' : 'Export items for this PRF'}><Download className="h-3.5 w-3.5" />{exporting ? 'Exporting…' : 'Export Excel'}</Button>{!expanded && <><Button variant="ghost" size="sm" aria-label="Expand items to modal" title="Expand items to modal" onClick={onExpand}><Maximize2 className="h-4 w-4" /></Button><Button variant="ghost" size="sm" aria-label="Close item panel" onClick={onClose}><X className="h-4 w-4" /></Button></>}</div></div>
        <p>{allItems ? `${prfs.length} PRFs · ${count} items` : first.description}</p>
        <div className="merdeka-items-summary"><div><span>Requested amount</span><strong>{formatCurrency(prfs.reduce((total, prf) => total + prf.amount, 0))}</strong></div><div><span>{allItems ? 'Items' : 'Status'}</span><div>{allItems ? count : statusBadge(first.progress)}</div></div></div>
        <span role="status" className="sr-only">{allItems ? 'All items on this page' : `Items for PRF ${first.prfNo}`}, {count} items</span>
      </header>
      {error ? <div className="merdeka-data-error" role="alert">Unable to refresh items: {error}<Button variant="outline" size="sm" onClick={onRetry}>Retry</Button></div> : loading ? <div className="merdeka-items-loading" role="status"><RefreshCw className="h-4 w-4 animate-spin" />Refreshing items...</div> : (
        <div className="merdeka-items-scroll" role="region" aria-label="PRF items table" tabIndex={0}>
          <table className="merdeka-items-table">
            <thead><tr><th>{expanded ? 'Item / Description' : 'Item / Part No'}</th>{expanded && <><th>Part number</th><th>Cost code</th><th>Original / Split PO</th></>}<th>Qty</th><th>Unit price</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{prfs.map(prf => <Fragment key={prf.id}>
              {allItems && <tr className="merdeka-items-group"><th colSpan={expanded ? 9 : 6}>{prf.prfNo} <span>{prf.description}</span></th></tr>}
              {prf.items?.map((item, index) => {
                const description = item.Description?.trim();
                const name = item.ItemName?.trim() || 'Unnamed item';
                const code = item.ItemCode?.trim() || description?.match(/^part:\s*(.+)$/i)?.[1]?.trim();
                const showDescription = description && description.toLowerCase() !== name.toLowerCase() && description.toLowerCase() !== `part: ${code ?? ''}`.toLowerCase();
                const hasDetails = showDescription || item.Specifications || item.Notes || item.PickedUpBy || item.OriginalPONumber || item.SplitPONumber || item.COAID || item.BudgetYear;
                return <tr key={item.PRFItemID ?? item.ItemID ?? `${prf.id}-${index}`}>
                  <td><div className="merdeka-items-name">{name}</div>{!expanded && code && <div className="merdeka-items-meta">Part: {code}</div>}{!expanded && item.PurchaseCostCode && <div className="merdeka-items-meta">Cost: {item.PurchaseCostCode}</div>}
                    {hasDetails && <Metadata className="merdeka-item-metadata">{!expanded && <summary>More details</summary>}
                      {showDescription && <p>{description}</p>}
                      {!expanded && (item.OriginalPONumber || item.SplitPONumber) && <p>PO: {item.OriginalPONumber}{item.SplitPONumber && ` → ${item.SplitPONumber} (Split)`}</p>}
                      {!!item.COAID && <p>COA: {getCOAName(item.COAID)} (ID: {item.COAID})</p>}
                      {!!item.BudgetYear && <p>Budget year: {item.BudgetYear}</p>}
                      {item.Specifications && (expanded ? <div><strong>Specifications</strong><Specifications value={item.Specifications} /></div> : <details><summary>Specifications</summary><Specifications value={item.Specifications} /></details>)}
                      {item.PickedUpBy && <p>Picked up by: {item.PickedUpBy}{item.PickedUpDate && ` on ${new Date(item.PickedUpDate).toLocaleDateString()}`}</p>}
                      {item.Notes && <p>Note: {item.Notes}</p>}
                    </Metadata>}
                  </td>
                  {expanded && <><td>{code || '—'}</td><td>{item.PurchaseCostCode || '—'}</td><td><div>{item.OriginalPONumber || '—'}</div><div className="merdeka-items-meta">Split: {item.SplitPONumber || '—'}</div></td></>}
                  <td className="merdeka-item-number">{item.Quantity}</td><td className="merdeka-item-number">{formatCurrency(item.UnitPrice)}</td><td className="merdeka-item-number">{formatCurrency(item.TotalPrice ?? item.UnitPrice * item.Quantity)}</td><td>{statusBadge(prf.progress)}</td><td><Button size="sm" variant="outline" aria-label={`Edit item ${name}`} onClick={() => onEdit(item, prf.progress)}><Edit className="h-3 w-3" /></Button></td>
                </tr>;
              })}
            </Fragment>)}</tbody>
          </table>
        </div>
      )}
      <footer className="merdeka-items-footer">{count} {count === 1 ? 'item' : 'items'} · Scroll items independently · Escape to close</footer>
    </aside>
  );
}
