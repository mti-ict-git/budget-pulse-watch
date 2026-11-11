import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select as AppSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Eye, AlertCircle, Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { authService } from '@/services/authService';

interface Item {
  rowNo?: number; sourceRowNo?: number | null; sourcePage?: number; sourceItemIndex?: number;
  partNumber?: string; description?: string; quantity?: number; unitPrice?: number; totalPrice?: number;
  currency?: string; uom?: string; purchaseCostCode?: string; coaid?: number; budgetYear?: number;
  status?: string; isStruckThrough?: boolean;
}
interface ExtractedPRFData {
  prfNo?: string; requestedBy?: string; department?: string; dateRaised?: string; dateRequired?: string;
  proposedSupplier?: string; totalAmount?: number; items?: Item[]; semanticTitle?: string;
  projectDescription?: string; rawProjectDescription?: string; projectArea?: string; projectId?: string;
  referenceDrawingNumber?: string; generalLedgerCode?: string; requestFor?: string; sourceNotes?: string;
  exchangeRateToIDR?: number; confidence?: number;
}
interface ReviewIssue { id: string; message: string; itemIndex?: number; field?: string; page?: number; severity: string; }
interface Preview {
  extractedData: ExtractedPRFData; previewToken: string; expiresAt: string; method: 'local' | 'llm';
  reviewIssues: ReviewIssue[]; sourcePages?: Array<{page: number; role: string; nativeText: string; ocrText: string}>;
}
interface CreatedPRFData {
  prf: { PRFID: number; PRFNo: string; RequestedBy: string; Department: string; TotalAmount: number; Status: string };
  items: Array<{ItemID: number; PartNumber?: string; Description: string; Quantity: number; UnitPrice: number; TotalPrice: number; Currency: string}>;
  extractedData: ExtractedPRFData; ocrConfidence?: number; uploadId: string; originalFilename: string;
  savedFilePath: string | null; attachmentWarning?: string;
}
interface Props { onPRFCreated?: (data: CreatedPRFData) => void; onPreviewData?: (data: ExtractedPRFData) => void; }
const validDate = (v?: string) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v);
const numeric = (value: string) => value === '' ? undefined : Number(value);
const money = (v?: number) => v === undefined ? 'Not read' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(v);

export default function OCRUpload({ onPRFCreated, onPreviewData }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [data, setData] = useState<ExtractedPRFData | null>(null);
  const [phase, setPhase] = useState<'idle'|'extracting'|'saving'>('idle');
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [method, setMethod] = useState<'local'|'llm'>('llm');
  const controller = useRef<AbortController | null>(null);
  const busy = phase !== 'idle';
  useEffect(() => {
    const request = new AbortController();
    fetch('/api/upload/ocr/status', { headers: authService.getAuthHeaders(), signal: request.signal })
      .then(r => r.json()).then(v => { if (!request.signal.aborted) setMethod(v.method === 'local' ? 'local' : 'llm'); })
      .catch(() => { /* The preview endpoint remains authoritative. */ });
    return () => { request.abort(); controller.current?.abort(); };
  }, []);
  const sourceUrl = useMemo(() => file ? URL.createObjectURL(file) : '', [file]);
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  const clearPreview = useCallback(() => { setPreview(null); setData(null); setReviewed(false); setError(''); }, []);
  const onDrop = useCallback((accepted: File[]) => { if (accepted[0]) { setFile(accepted[0]); clearPreview(); } }, [clearPreview]);
  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop, noClick: true, noKeyboard: true, disabled: busy, maxFiles: 1, maxSize: 100 * 1024 * 1024,
    accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg','.jpeg'], 'image/png': ['.png'], 'image/gif': ['.gif'], 'image/bmp': ['.bmp'], 'image/webp': ['.webp'] },
    onDropRejected: () => { setFile(null); clearPreview(); setError('Choose one supported PDF or image, up to 100 MB. The local method accepts PDF only.'); }
  });
  const edit = (field: keyof ExtractedPRFData, value: string | number | undefined) => { setData(old => old ? { ...old, [field]: value } : old); setReviewed(false); };
  const editItem = (index: number, field: keyof Item, value: string | number | undefined) => {
    setData(old => old ? { ...old, items: old.items?.map((item,i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') updated.totalPrice = updated.quantity === undefined || updated.unitPrice === undefined ? undefined : updated.quantity * updated.unitPrice;
      return updated;
    }) } : old); setReviewed(false);
  };
  const previewExtraction = async () => {
    if (!file || busy) return;
    clearPreview(); setPhase('extracting');
    const request = new AbortController(); controller.current = request;
    try {
      const body = new FormData(); body.append('document', file);
      const response = await fetch('/api/ocr-prf/preview-extraction', { method: 'POST', headers: { Authorization: `Bearer ${authService.getToken()}` }, body, signal: request.signal });
      const value = await response.json();
      if (request.signal.aborted) return;
      if (!response.ok || !value.success) throw new Error(value.message || 'Unable to extract this document.');
      const result = value.data as Preview;
      const editable = { ...result.extractedData, items: result.extractedData.items?.map((item, i) => ({ ...item, sourceItemIndex: i })) };
      setPreview(result); setData(editable); setMethod(result.method); onPreviewData?.(editable);
    } catch (e) { if (!request.signal.aborted) setError(e instanceof Error ? e.message : 'Extraction failed. Your file is retained for retry.'); }
    finally { if (!request.signal.aborted) setPhase('idle'); }
  };
  const save = async () => {
    if (!file || !data || !preview || !reviewed || busy) return;
    setPhase('saving'); setError('');
    try {
      const body = new FormData(); body.append('document', file); body.append('previewToken', preview.previewToken);
      body.append('reviewedData', JSON.stringify(data));
      body.append('acknowledgedReviewIds', JSON.stringify(['document-reviewed', ...preview.reviewIssues.filter(x => x.severity === 'warning').map(x => x.id)]));
      const response = await fetch('/api/ocr-prf/create-from-document', { method: 'POST', headers: { Authorization: `Bearer ${authService.getToken()}` }, body });
      const value = await response.json();
      if (!response.ok || !value.success) throw new Error(value.message || 'Unable to save the PRF. Your edits are retained.');
      onPRFCreated?.(value.data);
      toast({ title: 'PRF saved', description: value.data.attachmentWarning || `PRF ${value.data.prf.PRFNo} was created from the reviewed preview.` });
      setFile(null); clearPreview();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed. Your edits are retained.'); }
    finally { setPhase('idle'); }
  };
  const sum = data?.items?.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0) || 0;
  const needsUSD = data?.items?.some(item => item.currency === 'USD');
  const valid = Boolean(data?.prfNo?.trim() && data?.requestedBy?.trim() && data?.department?.trim() && data.items?.length
    && validDate(data.dateRaised) && validDate(data.dateRequired) && data.totalAmount !== undefined && Math.abs(sum - data.totalAmount) <= .01
    && data.items.every(x => x.description?.trim() && x.purchaseCostCode?.trim() && x.quantity !== undefined && Number.isInteger(x.quantity) && x.quantity > 0 && x.unitPrice !== undefined && x.unitPrice >= 0 && ['IDR','USD'].includes(x.currency || '') && x.status !== 'Cancelled' && !x.isStruckThrough)
    && new Set(data.items.map(x => x.currency)).size === 1 && (!needsUSD || (data.exchangeRateToIDR || 0) > 0));
  const headerField = (field: keyof ExtractedPRFData, label: string, type = 'text') => (
    <div className="space-y-1"><Label htmlFor={`upload-${field}`}>{label}</Label><Input id={`upload-${field}`} type={type}
      value={typeof data?.[field] === 'string' || typeof data?.[field] === 'number' ? String(data[field]) : ''}
      maxLength={({ prfNo: 50, requestedBy: 200, department: 100, proposedSupplier: 200, projectArea: 100, semanticTitle: 200, requestFor: 500 } as Partial<Record<keyof ExtractedPRFData,number>>)[field] || 1000}
      aria-invalid={Boolean(data && ((['prfNo','requestedBy','department'].includes(field) && !data[field]) || (field === 'dateRaised' && !validDate(data.dateRaised)) || (field === 'dateRequired' && !validDate(data.dateRequired))))}
      aria-describedby={!valid ? 'upload-validation-hint' : undefined}
      disabled={busy} onChange={e => edit(field, type === 'number' ? numeric(e.target.value) : e.target.value)} /></div>
  );
  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>Upload PRF</CardTitle><CardDescription>
      Method: {method === 'local' ? 'Local PDF parser v2 — no cloud upload' : 'LLM — configured AI provider'}. Change the method in Settings. Existing-PDF rescan still uses the LLM method.
    </CardDescription></CardHeader><CardContent className="space-y-4">
      <div {...getRootProps({ role: undefined })} className={`rounded-lg border-2 border-dashed p-6 text-center ${isDragActive ? 'border-primary bg-muted' : 'border-border'}`}>
        <input {...getInputProps({ 'aria-label': 'PRF source document' })} />
        <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="mb-3 text-sm">Drop one document here, or choose a file. Up to 100 MB; local processing accepts PDF only.</p>
        <Button type="button" variant="outline" onClick={open} disabled={busy}>Choose document</Button>
      </div>
      {file && <div className="flex flex-wrap items-center justify-between gap-3"><span className="min-w-0 break-all text-sm">{file.name} · {(file.size/1024/1024).toFixed(2)} MB</span>
        <div className="flex gap-2"><Button variant="outline" onClick={() => { setFile(null); clearPreview(); }} disabled={busy}>Remove</Button>
        <Button onClick={previewExtraction} disabled={busy || !file}><Eye className="mr-2 h-4 w-4" />{preview ? 'Run extraction again' : 'Preview extraction'}</Button></div></div>}
      {busy && <div className="flex min-h-10 items-center gap-3 text-sm" role="status" aria-live="polite"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />{phase === 'saving' ? 'Saving reviewed PRF…' : 'Extracting document…'}
        {phase === 'extracting' && <Button variant="ghost" onClick={() => { controller.current?.abort(); setPhase('idle'); }}>Cancel</Button>}</div>}
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    </CardContent></Card>
    {data && preview && <Card><CardHeader><CardTitle>Review before saving</CardTitle><CardDescription>Correct the extracted fields, compare the source and acknowledge all warnings. Nothing is saved until you select Save reviewed PRF.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2"><Badge variant="secondary">{preview.method === 'local' ? 'Local parser v2' : 'LLM'}</Badge><Badge variant="outline">{data.items?.length || 0} included items</Badge><Badge variant="outline">{preview.reviewIssues.length} review flags</Badge></div>
        {preview.reviewIssues.length > 0 && <Alert><AlertCircle className="h-4 w-4" /><AlertDescription><details open><summary className="cursor-pointer font-medium">Fields and source details to review</summary><ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5">{preview.reviewIssues.map(issue => <li key={issue.id}>{issue.page ? `Page ${issue.page}: ` : ''}{issue.message}</li>)}</ul></details></AlertDescription></Alert>}
        <Tabs defaultValue="fields"><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="fields">Fields and items</TabsTrigger><TabsTrigger value="document">Source document</TabsTrigger><TabsTrigger value="text">Source text</TabsTrigger></TabsList>
          <TabsContent value="fields" className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">{headerField('prfNo','PR number *')}{headerField('requestedBy','Requested by *')}{headerField('department','Department *')}{headerField('semanticTitle','PRF title')}{headerField('dateRaised','Date raised (YYYY-MM-DD)')}{headerField('dateRequired','Date required (YYYY-MM-DD)')}{headerField('proposedSupplier','Proposed supplier')}{headerField('projectArea','Project area')}{headerField('requestFor','Required for')}{headerField('totalAmount','Reviewed total *','number')}
              {needsUSD && headerField('exchangeRateToIDR','USD to IDR exchange rate *','number')}
            </div>
            <p className="text-sm text-muted-foreground">Original printed total: {money(preview.extractedData.totalAmount)} · Included item sum: {money(sum)} <Button variant="link" className="h-auto p-0" onClick={() => edit('totalAmount',sum)} disabled={busy}>Use item sum as reviewed total</Button></p>
            <div className="space-y-3">{data.items?.map((item,index) => <section key={item.sourceItemIndex ?? index} className="space-y-3 rounded-lg border p-4" aria-label={`Item ${index+1}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><strong className="text-sm">Item {item.rowNo ?? index+1}</strong>{item.sourcePage && <Badge variant="outline">Page {item.sourcePage}</Badge>}{preview.reviewIssues.some(x => x.itemIndex === item.sourceItemIndex) && <Badge variant="secondary">Review required</Badge>}{(item.status === 'Cancelled' || item.isStruckThrough) && <Badge variant="destructive">Cancellation proposed — reconcile or remove</Badge>}</div>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setData(old => old ? {...old,items:old.items?.filter((_,i) => i!==index)} : old); setReviewed(false); }} aria-label={`Remove item ${index+1} from preview`}><Trash2 className="mr-1 h-4 w-4" />Remove</Button></div>
              <div className="grid gap-3 md:grid-cols-2">{(['partNumber','purchaseCostCode','quantity','unitPrice'] as const).map(field => <div className="space-y-1" key={field}><Label htmlFor={`item-${index}-${field}`}>{({partNumber:'Part number',purchaseCostCode:'GL code *',quantity:'Quantity *',unitPrice:'Unit price *'})[field]}</Label><Input id={`item-${index}-${field}`} type={field==='quantity'||field==='unitPrice'?'number':'text'} value={item[field] ?? ''} disabled={busy} onChange={e => editItem(index,field,field==='quantity'||field==='unitPrice'?numeric(e.target.value):e.target.value)} /></div>)}
                <div className="space-y-1 md:col-span-2"><Label htmlFor={`item-${index}-description`}>Description *</Label><Textarea className="min-h-20 resize-none" maxLength={1000} id={`item-${index}-description`} value={item.description || ''} disabled={busy} onChange={e => editItem(index,'description',e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor={`item-${index}-currency`}>Currency *</Label><AppSelect value={item.currency || ''} onValueChange={v => editItem(index,'currency',v)} disabled={busy}><SelectTrigger id={`item-${index}-currency`}><SelectValue placeholder="Select currency" /></SelectTrigger><SelectContent><SelectItem value="IDR">IDR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></AppSelect></div><p className="self-end text-sm">Line total: {money(item.totalPrice)}</p>
              </div></section>)}</div>
            <div className="space-y-1"><Label htmlFor="upload-source-notes">Document notes</Label><Textarea id="upload-source-notes" maxLength={1500} className="min-h-24 resize-none" value={data.sourceNotes || ''} disabled={busy} onChange={e => edit('sourceNotes',e.target.value)} /></div>
          </TabsContent>
          <TabsContent value="document"><a href={sourceUrl} target="_blank" rel="noreferrer" className="mb-3 inline-block text-sm text-primary underline">Open original document in a new tab</a>{file?.type === 'application/pdf' ? <iframe src={sourceUrl} title="Original PRF PDF" className="h-[65vh] min-h-80 w-full rounded border" /> : <img src={sourceUrl} alt="Original PRF source" className="max-h-[65vh] w-full object-contain" />}</TabsContent>
          <TabsContent value="text" className="space-y-3">{preview.sourcePages?.length ? preview.sourcePages.map(page => <details key={page.page} className="rounded border p-3"><summary className="cursor-pointer">Page {page.page} · {page.role}</summary><p className="mt-3 text-sm font-medium">Native text</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">{page.nativeText}</pre><p className="mt-3 text-sm font-medium">OCR text — verify image notes</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">{page.ocrText}</pre></details>) : <p className="text-sm text-muted-foreground">Compare the LLM extraction with the original source document.</p>}</TabsContent>
        </Tabs>
        <div className="flex items-start gap-3 rounded-lg border p-4"><Checkbox id="reviewed-upload" checked={reviewed} disabled={busy} onCheckedChange={v => setReviewed(v === true)} /><Label htmlFor="reviewed-upload" className="leading-relaxed">I checked the original document, highlighted fields, cancellations, notes and changes in this preview.</Label></div>
        {!valid && <p id="upload-validation-hint" className="text-sm text-destructive" role="status">Complete the required fields with valid dates and whole-number quantities, reconcile cancelled rows, and match the reviewed total to the included item sum before saving.</p>}
        <Button className="min-w-48" disabled={busy || !reviewed || !valid} onClick={save}>{phase==='saving'?<Loader2 className="mr-2 h-4 w-4 animate-spin" />:<Save className="mr-2 h-4 w-4" />}Save reviewed PRF</Button>
      </CardContent></Card>}
  </div>;
}
