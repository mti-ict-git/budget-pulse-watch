"""Read-only pdfplumber prototype: native text/tables and GL geometry; no OCR or LLM."""
from pathlib import Path
import pdfplumber,json,re,time,hashlib,statistics
ROOT=Path(__file__).resolve().parent

def number(v):
 if not v:return None
 s=re.sub(r'(?i)rp|idr|\s','',v)
 if not re.fullmatch(r'[\d.,]+',s):return None
 if ',' in s and '.' in s:
  last=max(s.rfind(','),s.rfind('.'))
  if len(s)-last-1 in (1,2):s=s[:last].replace(',','').replace('.','')+'.'+s[last+1:]
  else:s=s.replace(',','').replace('.','')
 elif s.count('.')>1 or s.count(',')>1:s=s.replace(',','').replace('.','')
 elif ',' in s or '.' in s:
  sep=',' if ',' in s else '.'
  s=s.replace(sep,'' if len(s.rsplit(sep,1)[1])==3 else '.')
 try:return float(s)
 except ValueError:return None

def extract(path):
 items=[];totals=[];baseline=[];headers=[];gl_candidates=[]
 with pdfplumber.open(path) as doc:
  for pn,p in enumerate(doc.pages,1):
   text=p.extract_text() or '';headers.append(text[:text.find('Estimate/Quote')])
   for table in p.find_tables():
    data=table.extract()
    if not data or not any('Item Description' in (x or '') for x in data[0]):continue
    h=data[0];di=next(i for i,x in enumerate(h) if 'Item Description' in (x or ''))
    qi=next(i for i,x in enumerate(h) if x=='Qty');ui=next(i for i,x in enumerate(h) if x=='UOM')
    ci=next(i for i,x in enumerate(h) if re.sub(r'\s','',x or '')=='Currency');pi=next(i for i,x in enumerate(h) if 'Estimate/Quote' in (x or ''))
    ti=next(i for i,x in enumerate(h) if 'Total Price' in (x or ''));gi=next(i for i,x in enumerate(h) if 'General Ledger' in (x or ''))
    glbox=table.rows[0].cells[gi];gx0,gx1=glbox[0],glbox[2]
    words=[w for w in p.extract_words() if w['x0']>=gx0-1 and w['x1']<=gx1+1 and w['top']>glbox[3] and w['bottom']<=table.bbox[3] and re.fullmatch(r'(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9.]+',w['text'])]
    gl_candidates.extend(w['text'] for w in words)
    for ri,r in enumerate(data):
     if len(r)==9 and r[0] and r[0].isdigit():baseline.append(r)
     if r[ti] and number(r[ti]) is not None and (any('TOTAL' in (x or '').upper() for x in r) or (ri==len(data)-1 and not (r[0] or '').isdigit())):totals.append(number(r[ti]))
     if not r[0] or not r[0].isdigit():continue
     if not r[di] or number(r[qi]) is None:continue
     rb=table.rows[ri].cells[0];ym=(rb[1]+rb[3])/2
     raw_code=r[gi] or None
     code_tokens=re.findall(r'(?<![A-Za-z0-9.-])(?=[A-Za-z0-9.]*[A-Za-z])(?=[A-Za-z0-9.]*\d)[A-Za-z0-9.]+(?![A-Za-z0-9.-])',raw_code or '')
     code_tokens+=re.findall(r'(?<![A-Za-z0-9.])\d{5,}\.\d{4}(?![A-Za-z0-9.])',raw_code or '')
     code=code_tokens[0] if len(set(code_tokens))==1 else None;method='native_cell' if code else None
     if not code:
      candidates=[]
      for w in words:
       wm=(w['top']+w['bottom'])/2
       if rb[1]<=wm<=rb[3]:candidates.append(w['text']);continue
       for cell in table.cells:
        if abs(cell[0]-gx0)<2 and abs(cell[2]-gx1)<2 and cell[1]<=ym<=cell[3] and cell[1]<=wm<=cell[3]:candidates.append(w['text']);break
      # Recover open merged GL regions using horizontal separators, including absent right border.
      for w in words:
       wm=(w['top']+w['bottom'])/2
       barriers=[e for e in p.edges if e['orientation']=='h' and e['x0']<=gx0+2 and e['x1']>=gx1-2 and min(ym,wm)<e['top']<max(ym,wm)]
       if not barriers:candidates.append(w['text'])
      unique=sorted(set(candidates))
      if len(unique)==1:code=unique[0];method='column_geometry_merged_cell'
     items.append({'row':int(r[0]),'part_number':r[1] or None,'gl_raw':raw_code,'description':r[di],'qty':number(r[qi]),'uom':r[ui] or None,'currency':r[ci],'unit_price':number(r[pi]),'total':number(r[ti]),'gl':code,'gl_method':method,'page':pn})
  # Cross-page carry is explicitly labelled as inferred and must be visually checked.
  for pn in range(2,len(doc.pages)+1):
   prev=[x for x in items if x['page']==pn-1];cur=[x for x in items if x['page']==pn]
   codes=set(x['gl'] for x in prev if x['gl'])
   if prev and cur and len(codes)==1 and all(x['gl'] for x in prev) and not any(x['gl'] for x in cur) and min(x['row'] for x in cur)==max(x['row'] for x in prev)+1:
    for x in cur:x['gl']=next(iter(codes));x['gl_method']='cross_page_inference_requires_visual_review'
  native_pr=any(re.search(r'\b'+re.escape(path.stem)+r'\b',h) for h in headers)
 return {'items':items,'printed_total':totals[-1] if totals else None,'baseline_rows':len(baseline),'baseline_gl_rows':sum(bool(r[8]) for r in baseline),'native_pr_number_found':native_pr,'pages':len(doc.pages),'gl_candidates':sorted(set(gl_candidates))}
