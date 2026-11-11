"""Local PRF parser v2. Never writes input PDFs or connects to Pomon.

Keep the frozen native parser's accepted values. Recover missing fields from
visible FreeText annotations and bounded native geometry. All recovery carries
provenance; source row numbers remain distinct from inferred internal order.
"""
from pathlib import Path
import re
import pdfplumber
from pdfminer.utils import decode_text
from baseline_native import extract as baseline_extract, number

PART = re.compile(r'\d{4}-\d{2}-\d{6}')
CODE = re.compile(r'(?=[A-Za-z0-9.-]*[A-Za-z])(?=[A-Za-z0-9.-]*\d)[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*|\d{5,}\.\d{4}')

def literal_code(value):
    value = (value or '').strip()
    return value if CODE.fullmatch(value) else None

def annotations(page):
    out = []
    for a in page.annots:
        data = a['data']
        if getattr(data.get('Subtype'), 'name', '') != 'FreeText':
            continue
        # Invisible, Hidden and NoView annotations are not source evidence.
        if int(data.get('F', 0)) & (1 | 2 | 32):
            continue
        value = data.get('Contents', b'')
        value = decode_text(value) if isinstance(value, bytes) else str(value)
        value = value.replace('\xa0', ' ').strip()
        if value:
            out.append({'text': value, 'bbox': [a[k] for k in ('x0', 'top', 'x1', 'bottom')]})
    return out

def columns(table):
    data = table.extract()
    if not data or not any('Item Description' in (x or '') for x in data[0]):
        return None
    h = data[0]
    return data, {
        'description': next(i for i,x in enumerate(h) if 'Item Description' in (x or '')),
        'qty': next(i for i,x in enumerate(h) if x == 'Qty'),
        'uom': next(i for i,x in enumerate(h) if x == 'UOM'),
        'currency': next(i for i,x in enumerate(h) if re.sub(r'\s', '', x or '') == 'Currency'),
        'unit_price': next(i for i,x in enumerate(h) if 'Estimate/Quote' in (x or '')),
        'total': next(i for i,x in enumerate(h) if 'Total Price' in (x or '')),
        'gl': next(i for i,x in enumerate(h) if 'General Ledger' in (x or '')),
    }

def overlay_missing(row, rowbox, header_cells, annots):
    result = list(row)
    evidence = []
    for a in annots:
        x0, top, x1, bottom = a['bbox']
        if not rowbox[1] <= (top + bottom)/2 <= rowbox[3]:
            continue
        cx = (x0+x1)/2
        matches = [i for i,c in enumerate(header_cells) if c and c[0] <= cx <= c[2]]
        if len(matches) != 1:
            continue
        i = matches[0]
        if not result[i]:
            result[i] = a['text']
            evidence.append({'column': i, 'method': 'visible_freetext_annotation', **a})
    return result, evidence

def anchor_y(page, table, ri, ci):
    rb = table.rows[ri].cells[0]
    box = table.rows[0].cells[ci]
    matches = [w for w in page.extract_words() if box[0]-1 <= w['x0'] and w['x1'] <= box[2]+1
               and rb[1] <= (w['top']+w['bottom'])/2 <= rb[3] and number(w['text']) is not None]
    return (matches[-1]['top']+matches[-1]['bottom'])/2 if matches else None

def row_words(page, table, ri, ci, y):
    rb = table.rows[ri].cells[0]
    box = table.rows[0].cells[ci]
    return [w for w in page.extract_words() if box[0]-1 <= (w['x0']+w['x1'])/2 <= box[2]+1
            and rb[1] <= (w['top']+w['bottom'])/2 <= rb[3]
            and abs((w['top']+w['bottom'])/2-y) <= max(5, w['height'])]

def recovered_gl(page, table, ri, ci, raw):
    direct = literal_code(raw)
    if direct:
        return direct, 'native_literal_code'
    rb = table.rows[ri].cells[0]
    box = table.rows[0].cells[ci]
    ym = (rb[1]+rb[3])/2
    found = []
    for w in page.extract_words():
        if not (box[0]-1 <= w['x0'] and w['x1'] <= box[2]+1 and box[3] < w['top'] < table.bbox[3]):
            continue
        if not literal_code(w['text']):
            continue
        wy = (w['top']+w['bottom'])/2
        same_row = rb[1] <= wy <= rb[3]
        barriers = [e for e in page.edges if e['orientation']=='h' and e['x0']<=box[0]+2 and e['x1']>=box[2]-2
                    and min(ym,wy) < e['top'] < max(ym,wy)]
        if same_row or not barriers:
            found.append(w['text'])
    found = sorted(set(found))
    return (found[0], 'column_geometry_merged_cell') if len(found)==1 else (None, None)

def outside_total(page, table, ci):
    """Read an explicit TOTAL anchor and its value; never substitute item sum."""
    box = table.rows[0].cells[ci]
    candidates = []
    for w in page.extract_words():
        if w['text'].upper() != 'TOTAL' or w['top'] < table.bbox[1]:
            continue
        # Footer totals are in/under the item table, and before approval text.
        if w['top'] > table.bbox[3] + page.height*.10:
            continue
        cy = (w['top']+w['bottom'])/2
        words = [v for v in page.extract_words() if box[0]-3 <= (v['x0']+v['x1'])/2 <= box[2]+3
                 and abs((v['top']+v['bottom'])/2-cy) <= max(5,w['height'])]
        text = ' '.join(v['text'] for v in sorted(words, key=lambda v:v['x0']))
        amount = number(text)
        if amount is not None:
            candidates.append({'value': amount, 'method': 'explicit_total_anchor_geometry', 'literal': text,
                               'bbox': [box[0], cy-w['height'], box[2], cy+w['height']]})
    unique = {c['value'] for c in candidates}
    return candidates[-1] if len(unique)==1 else None

def header_evidence(page, annots):
    hits = page.search(r'PRF\s*No\s*:?', regex=True)
    if hits:
        hit=hits[0]; x0=hit['x1']; x1=page.width*.75
        y0=max(0,hit['top']-page.height*.065); y1=min(page.height*.25,hit['bottom']+page.height*.002)
    else:
        x0=page.width*.35; x1=page.width*.75; y0=page.height*.03; y1=page.height*.17
    found=[]
    for a in annots:
        bx=a['bbox'];cx=(bx[0]+bx[2])/2;cy=(bx[1]+bx[3])/2
        if x0<=cx<=x1 and y0<=cy<=y1 and re.fullmatch(r'\d{5}',a['text']):
            found.append({'value':a['text'],'method':'visible_freetext_annotation','bbox':bx})
    for w in page.extract_words():
        if x0<=w['x0']<=x1 and y0<=w['top']<=y1 and re.fullmatch(r'\d{5}',w['text']):
            found.append({'value':w['text'],'method':'native_header_text','bbox':[w['x0'],w['top'],w['x1'],w['bottom']]})
    unique=sorted(set(x['value'] for x in found))
    return {'candidates':found,'resolved_number':unique[0] if len(unique)==1 else None,'conflict':len(unique)>1}

def extract(path):
    result = baseline_extract(path)
    existing = result['items']
    repairs=[]; added=[]; printed_total_fallbacks=[]
    result['header_evidence'] = None
    for item in existing:
        # Only extend literal grammar when the baseline left a GL empty.
        if not item['gl'] and literal_code(item['gl_raw']):
            item['gl']=literal_code(item['gl_raw']);item['gl_method']='native_literal_code'
            repairs.append({'page':item['page'],'row':item['row'],'field':'gl','method':'native_literal_code'})
    with pdfplumber.open(path) as doc:
        for pn,page in enumerate(doc.pages,1):
            annots=annotations(page)
            if pn==1:
                result['header_evidence']=header_evidence(page,annots)
            page_added=[]
            for table in page.find_tables():
                spec=columns(table)
                if spec is None:
                    continue
                data, c=spec
                last_number=0
                for ri, raw in enumerate(data[1:],1):
                    rb=table.rows[ri].cells[0]
                    if not rb:
                        continue
                    row,evidence=overlay_missing(raw,rb,table.rows[0].cells,annots)
                    source_no=int(row[0]) if row[0] and row[0].isdigit() else None
                    if source_no is not None:
                        last_number=source_no
                    matches=[x for x in existing if x['page']==pn and x['row']==source_no]
                    if matches:
                        continue
                    if not row[c['description']] or not row[1] or not PART.fullmatch(row[1]):
                        continue
                    price=number(row[c['unit_price']]);total=number(row[c['total']])
                    if price is None or total is None:
                        continue
                    qty=number(row[c['qty']]);uom=row[c['uom']] or None;description=row[c['description']]
                    numeric_recovery=[]
                    if qty is None:
                        y=anchor_y(page,table,ri,c['unit_price'])
                        if y is None:
                            continue
                        qwords=row_words(page,table,ri,c['qty'],y)
                        quantities=sorted(set(number(w['text']) for w in qwords if number(w['text']) is not None))
                        if len(quantities)!=1:
                            continue
                        qty=quantities[0]
                        numeric_recovery.append({'field':'qty','method':'native_numeric_column_at_price_baseline','raw':row[c['qty']]})
                        spill=[s for s in (row[c['qty']] or '').splitlines() if number(s) is None]
                        if spill:
                            description+=('' if description.endswith('-') else ' ')+' '.join(spill)
                        if uom and not re.fullmatch(r'[A-Za-z]{1,12}',uom):
                            units=[w['text'] for w in row_words(page,table,ri,c['uom'],y) if re.fullmatch(r'[A-Za-z]{1,12}',w['text'])]
                            if len(set(units))==1:
                                old_uom=uom;uom=units[0]
                                spill=[s for s in old_uom.splitlines() if s.strip()!=uom]
                                if spill:description+=('' if spill[0].startswith(':') else ' ')+' '.join(spill)
                    # Recovery requires independently printed price, total and quantity arithmetic.
                    if qty is None or abs(qty*price-total)>.005:
                        continue
                    inferred=source_no is None
                    row_no=source_no if source_no is not None else last_number+1
                    last_number=row_no
                    gl,method=recovered_gl(page,table,ri,c['gl'],row[c['gl']])
                    item={'row':row_no,'source_row_number':source_no,'row_number_inferred':inferred,
                          'part_number':row[1],'gl_raw':row[c['gl']] or None,'description':description,'qty':qty,
                          'uom':uom,'currency':row[c['currency']],'unit_price':price,'total':total,'gl':gl,'gl_method':method,
                          'page':pn,'recovery_evidence':evidence+numeric_recovery,
                          'review_flags':['source_row_number_blank'] if inferred else []}
                    if any(x['page']==pn and x['row']==row_no for x in existing+added+page_added):
                        item['review_flags'].append('inferred_row_number_conflict')
                    page_added.append(item)
                    repairs.append({'page':pn,'row':row_no,'field':'item','method':'annotations_and_native_geometry' if evidence else 'native_item_signature','row_number_inferred':inferred})
                if result['printed_total'] is None:
                    fallback=outside_total(page,table,c['total'])
                    if fallback:
                        printed_total_fallbacks.append({'page':pn,**fallback})
            added.extend(page_added)
    result['items']=sorted(existing+added,key=lambda x:(x['page'],x['row']))
    if result['printed_total'] is None and len({x['value'] for x in printed_total_fallbacks})==1:
        result['printed_total']=printed_total_fallbacks[-1]['value']
        result['total_recovery']=printed_total_fallbacks[-1]
    result['repairs']=repairs
    result['parser_version']='2'
    return result

def resolve_header(native_result, frozen_ocr_header):
    direct=native_result['header_evidence']
    old=frozen_ocr_header.get('resolved_number')
    if direct['conflict']:
        return {'number':None,'method':'conflicting_pdf_header_values','review_required':True,'evidence':direct}
    if direct['resolved_number']:
        value=direct['resolved_number']
        return {'number':value,'method':'pdf_header_evidence','review_required':bool(old and old!=value),'ocr_number':old,'evidence':direct}
    return {'number':old,'method':'frozen_ocr' if old else 'not_read','review_required':False,'evidence':direct}
