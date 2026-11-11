"""JSON-only local upload adapter. PDF contents are data, never instructions."""
import csv, io, json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from datetime import datetime
import pdfplumber
from PIL import Image
from parser_v2 import extract, annotations

MAX_PAGES = 20

def issue(code, message, page=None, index=None, field=None):
    return {k:v for k,v in {'id':f'{code}:{page or 0}:{index if index is not None else "doc"}:{field or ""}',
        'code':code,'message':message,'severity':'warning','page':page,'itemIndex':index,'field':field}.items() if v is not None}

def date(value):
    if not value:return None
    for fmt in ['%d-%b-%y','%d-%b-%Y']:
        try:return datetime.strptime(value,fmt).strftime('%Y-%m-%d')
        except ValueError:pass
    return None

def parse(path):
    with pdfplumber.open(path) as doc:
        if len(doc.pages)>MAX_PAGES:raise ValueError('PDF exceeds the 20-page local processing limit.')
        if not any(p.chars for p in doc.pages):raise ValueError('This PDF has no native text. Use the LLM method or manual entry for scanned documents.')
    result=extract(Path(path));items=[];flags=[];pages=[];notes=[];first_words=[];first_image=None
    for i,x in enumerate(result['items']):
        items.append({'rowNo':x['row'],'sourceRowNo':x.get('source_row_number',x['row']),
            'partNumber':x['part_number'],'description':x['description'],'quantity':x['qty'],'uom':x['uom'],
            'unitPrice':x['unit_price'],'totalPrice':x['total'],'currency':x['currency'],
            'purchaseCostCode':x['gl'],'sourcePage':x['page']})
        if x.get('row_number_inferred'):flags.append(issue('inferred_row','The printed row number is blank; the displayed order is inferred.',x['page'],i,'rowNo'))
        if x['gl_method']=='cross_page_inference_requires_visual_review':flags.append(issue('shared_gl','GL is carried from the previous page. Confirm its scope.',x['page'],i,'purchaseCostCode'))
    flags.append(issue('visual_review','Check cancellation marks, source specifications and image notes against the PDF; the local parser does not approve their meaning.'))
    pdftoppm=os.environ.get('PRF_PDFTOPPM') or shutil.which('pdftoppm')
    tesseract=os.environ.get('PRF_TESSERACT') or shutil.which('tesseract')
    if not pdftoppm or not tesseract:raise RuntimeError('Local OCR requires Poppler (pdftoppm) and Tesseract with eng and ind language data.')
    with tempfile.TemporaryDirectory(prefix='prf-ocr-') as folder, pdfplumber.open(path) as doc:
        for pn,p in enumerate(doc.pages,1):
            prefix=str(Path(folder)/f'p{pn}')
            subprocess.run([pdftoppm,'-f',str(pn),'-l',str(pn),'-r','200','-singlefile','-png',path,prefix],check=True,timeout=35,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
            proc=subprocess.run([tesseract,prefix+'.png','stdout','-l','eng+ind','--psm','3','tsv'],check=True,capture_output=True,text=True,timeout=35)
            words=[w for w in csv.DictReader(io.StringIO(proc.stdout),delimiter='\t',quoting=csv.QUOTE_NONE) if w.get('text','').strip()]
            if pn==1:
                first_words=words;first_image=Image.open(prefix+'.png').copy()
            lines={}
            for w in words:lines.setdefault(tuple(w[k] for k in ['block_num','par_num','line_num']),[]).append(w['text'])
            text='\n'.join(' '.join(w) for w in lines.values())
            native=p.extract_text() or ''
            role='items' if any(x['sourcePage']==pn for x in items) else 'attachment'
            pages.append({'page':pn,'role':role,'nativeText':native[:40000],'ocrText':text[:40000]})
            for line in text.splitlines():
                if re.search(r'(?i)^(?:note\s*:|point\s+\d|account\s*:)|stock\s+warehouse',line):notes.append({'page':pn,'text':line[:1500]})
            # Compare fully formed part codes in the item column, not catalog pictures.
            for table in p.find_tables():
                rows=table.extract()
                if not rows or not any('Item Description' in (v or '') for v in rows[0]):continue
                partbox=table.rows[0].cells[1]
                for ri,row in enumerate(rows[1:],1):
                    rb=table.rows[ri].cells[0]
                    if not rb:continue
                    for i,item in enumerate(items):
                        if item['sourcePage']!=pn or item['partNumber']!=row[1]:continue
                        candidates={w['text'] for w in words if re.fullmatch(r'\d{4}-\d{2}-\d{6}',w['text'])
                            and partbox[0] <= (int(w['left'])+int(w['width'])/2)*72/200 <= partbox[2]
                            and rb[1] <= (int(w['top'])+int(w['height'])/2)*72/200 <= rb[3]}
                        if candidates and candidates!={item['partNumber']}:
                            flags.append(issue('part_number_conflict',f'Native part code {item["partNumber"]} differs from OCR {", ".join(sorted(candidates))}. Verify the printed value.',pn,i,'partNumber'))
    first=pages[0]['nativeText']
    def capture(pattern):
        m=re.search(pattern,first,re.I|re.M);return m.group(1).strip() if m else None
    requested=capture(r'Requested By:\s*(.*?)\s*PRF No:')
    department=capture(r'Department:\s*(.*?)\s*Date Raised:')
    supplier=capture(r'Proposed Supplier:\s*(.*?)\s*Date Required:')
    purpose=None;area=None;project=None;drawing=None
    with pdfplumber.open(path) as doc:
        for p in doc.pages:
            for table in p.extract_tables():
                for row in table:
                    for value in row:
                        if not value:continue
                        for pattern,target in [(r'Project Description/Area\s*\]?\s*:\s*(.*)','area'),(r'Project ID\s*:\s*(.*)','project'),(r'Reference Drawing Number\]?\s*:\s*(.*)','drawing')]:
                            m=re.search(pattern,value,re.I)
                            if m:
                                if target=='area':area=m.group(1).strip()
                                elif target=='project':project=m.group(1).strip()
                                else:drawing=m.group(1).strip()
                    if len(row)>2 and not row[0] and row[2] and re.match(r'(?i)^(?:PRF\s+For\b|For\b|FOR\b)',row[2].strip()):purpose=row[2].strip()
    # Direct visible PDF header evidence wins; no filename-derived PR number.
    header=result['header_evidence'];pr=header['resolved_number']
    # Some FreeText boxes include many empty trailing lines. Their geometric centre
    # falls below the header, although the first printed line is in the PR field.
    if not pr and not header['conflict']:
        with pdfplumber.open(path) as doc:
            p=doc.pages[0];hits=p.search(r'PRF\s*No\s*:?',regex=True)
            if hits:
                h=hits[0];left=h['x1'];right=p.width*.75;top=max(0,h['top']-p.height*.065);bottom=min(p.height*.25,h['bottom']+p.height*.002)
                direct={a['text'] for a in annotations(p) if re.fullmatch(r'\d{5}',a['text'])
                    and left<=(a['bbox'][0]+a['bbox'][2])/2<=right and top<=a['bbox'][1]<=bottom}
                if len(direct)==1:pr=next(iter(direct))

    if not pr:
        # OCR candidate must be within the same PR-label geometry used by regression.
        with pdfplumber.open(path) as doc:
            p=doc.pages[0];hits=p.search(r'PRF\s*No\s*:?',regex=True)
            if hits:
                h=hits[0];x0=h['x1'];x1=p.width*.75;y0=max(0,h['top']-p.height*.065);y1=min(p.height*.25,h['bottom']+p.height*.002)
            else:x0=p.width*.35;x1=p.width*.75;y0=p.height*.03;y1=p.height*.17
        groups={}
        for w in first_words:
            if not (x0<=int(w['left'])*72/200<=x1 and y0<=int(w['top'])*72/200<=y1):continue
            groups.setdefault(tuple(w[k] for k in ['block_num','par_num','line_num']),[]).append(w)
        candidates=[]
        for line in groups.values():
            digits=''.join(w['text'] for w in sorted(line,key=lambda w:int(w['left'])) if w['text'].isdigit())
            if re.fullmatch(r'\d{5}',digits):candidates.append(digits)
        with tempfile.TemporaryDirectory(prefix='prf-header-') as folder:
            target=str(Path(folder)/'header.png')
            first_image.crop(tuple(int(v*200/72) for v in [x0,y0,x1,y1])).save(target)
            proc=subprocess.run([tesseract,target,'stdout','--psm','6','-l','eng','-c','tessedit_char_whitelist=0123456789'],capture_output=True,text=True,check=True,timeout=20)
            candidates+=re.findall(r'(?<!\d)\d{5}(?!\d)',proc.stdout.replace(' ',''))
        if len(set(candidates))==1 and not header['conflict']:pr=candidates[0]
        if not pr:flags.append(issue('missing_pr_number','Enter the PR number from the PDF; it was not read automatically.',1,field='prfNo'))
    codes=sorted(set(x['purchaseCostCode'] for x in items if x.get('purchaseCostCode')))
    data={k:v for k,v in {'prfNo':pr,'requestedBy':requested,'department':department,
        'dateRaised':date(capture(r'Date Raised:\s*(\d{1,2}-[A-Za-z]{3}-\d{2,4})')),
        'dateRequired':date(capture(r'Date Required:\s*(\d{1,2}-[A-Za-z]{3}-\d{2,4})')),
        'proposedSupplier':supplier,'totalAmount':result['printed_total'],'items':items,
        'rawProjectDescription':area,'projectArea':area,'projectId':project,'referenceDrawingNumber':drawing,
        'requestFor':purpose,'generalLedgerCode':codes[0] if len(codes)==1 else None,
        'sourceNotes':'\n'.join(f'Page {n["page"]}: {n["text"]}' for n in notes)}.items() if v is not None}
    if len(data.get('sourceNotes',''))>1500:
        data['sourceNotes']=data['sourceNotes'][:1500]
        flags.append(issue('notes_summary_limit','The notes summary was shortened. Review the complete native/OCR source text before saving.',field='sourceNotes'))
    return {'extractedData':data,'reviewIssues':flags,'sourcePages':pages,'method':'local','parserVersion':'2'}

if __name__=='__main__':
    try:
        if sys.argv[1:]==['--check']:
            import importlib.metadata
            ready=bool((os.environ.get('PRF_PDFTOPPM') or shutil.which('pdftoppm')) and (os.environ.get('PRF_TESSERACT') or shutil.which('tesseract')))
            if ready:
                langs=subprocess.run([os.environ.get('PRF_TESSERACT') or shutil.which('tesseract'),'--list-langs'],capture_output=True,text=True,check=True,timeout=10).stdout.splitlines()
                ready=all(x in langs for x in ['eng','ind'])
            print(json.dumps({'ready':ready,'pdfplumber':importlib.metadata.version('pdfplumber')}))
        else:print(json.dumps(parse(sys.argv[1]),ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error':{'code':'LOCAL_PARSER_FAILED','message':str(e)[:500]}}));sys.exit(2)
