"""Pure parsers for Pronto PO E001 screens (Lines, Line Detail, Approval Status).

No Playwright here, so the logic can be unit-tested offline against captured screen data.
DOM facts these parsers rely on (verified on Pronto Xi 2026-11-11 at 1280x800):
- Lines grid headers: Seq, Item Code, Ordered, Unit, In Transit, Received, Backorder, Item Price,
  Item Price ( Original ), Discount, Line Total, Supp Code, GL Account, Notes, Note Description,
  Item Description. Note lines have Item Code "Note Line".
- Line Detail panel: ``label.card-field`` elements with ``name="x:<col>,y:<row>"``. Labels end with
  ":"; values carry the ``sunken`` class. Several label/value pairs can share one row, and a value
  can continue on following rows in the same column (e.g. Item Desc on y:18..20).
- Approval Status grid headers: Approval User, Date Time, Status, Comment.
"""

import re
from datetime import datetime
from typing import Dict, List, Optional, Sequence, Tuple

_XY_RX = re.compile(r"x:(\d+)\s*,\s*y:(\d+)")
_PART_CODE_RX = re.compile(r"^\d{4}-\d{2}-\d{6}$")


def parse_number(raw: Optional[str]) -> Optional[float]:
    if raw is None:
        return None
    s = str(raw).strip().replace(",", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_pronto_datetime(raw: Optional[str]) -> Optional[str]:
    """'10-SEP-2026 08:52:28' -> '2026-09-10T08:52:28' (Pronto local time, no zone)."""
    if not raw:
        return None
    s = re.sub(r"\s+", " ", str(raw).strip())
    for fmt in ("%d-%b-%Y %H:%M:%S", "%d-%b-%Y %H:%M", "%d-%b-%Y"):
        try:
            return datetime.strptime(s.title(), fmt).strftime("%Y-%m-%dT%H:%M:%S")
        except ValueError:
            continue
    return None


def pair_card_fields(fields: Sequence[Tuple[str, str, str]]) -> Dict[str, str]:
    """Turn Pronto card fields into {label: value}.

    ``fields`` holds (name_attr, class_attr, text) per ``label.card-field``. A value belongs to the
    nearest label on its left in the same row. A value with no label on its left continues the
    label that last owned that value column (multi-line values such as Item Desc).
    """
    labels: Dict[int, List[Tuple[int, str]]] = {}
    values: List[Tuple[int, int, str]] = []
    for name_attr, cls, text in fields:
        m = _XY_RX.search(name_attr or "")
        if not m:
            continue
        x, y = int(m.group(1)), int(m.group(2))
        t = (text or "").replace("\xa0", " ").strip()
        if t.endswith(":"):
            labels.setdefault(y, []).append((x, t.rstrip(":").strip()))
        elif "sunken" in (cls or ""):
            values.append((y, x, t))

    out: Dict[str, str] = {}
    owner_by_col: Dict[int, str] = {}
    for y, x, t in sorted(values):
        left = [lab for lab in labels.get(y, []) if lab[0] < x]
        key = max(left)[1] if left else owner_by_col.get(x)
        if not key:
            continue
        owner_by_col[x] = key
        if not t:
            out.setdefault(key, "")
            continue
        out[key] = f"{out[key]} {t}".strip() if out.get(key) else t
    return out


def _rows_to_dicts(headers: Sequence[str], rows: Sequence[Sequence[str]]) -> List[Dict[str, str]]:
    keys = [re.sub(r"\s+", " ", h or "").strip() for h in headers]
    out: List[Dict[str, str]] = []
    for r in rows:
        vals = [(v or "").strip() for v in r]
        if not any(vals):
            continue
        out.append({keys[i] if i < len(keys) and keys[i] else f"col_{i}": vals[i] for i in range(len(vals))})
    return out


def parse_po_lines(headers: Sequence[str], rows: Sequence[Sequence[str]]) -> List[Dict[str, object]]:
    lines: List[Dict[str, object]] = []
    for row in _rows_to_dicts(headers, rows):
        code = row.get("Item Code", "")
        is_note = code.lower() == "note line"
        seq = parse_number(row.get("Seq"))
        if seq is None:
            continue
        lines.append(
            {
                "seq": seq,
                "item_code": "" if is_note else code,
                "is_note": is_note,
                "ordered": parse_number(row.get("Ordered")),
                "unit": row.get("Unit", ""),
                "received": parse_number(row.get("Received")),
                "item_price": parse_number(row.get("Item Price")),
                "line_total": parse_number(row.get("Line Total")),
                "supp_code": row.get("Supp Code", ""),
                "gl_account": row.get("GL Account", ""),
                "note_description": row.get("Note Description", ""),
                "item_description": row.get("Item Description", ""),
            }
        )
    return lines


def apply_line_detail(line: Dict[str, object], detail: Dict[str, str]) -> Dict[str, object]:
    """Merge Line Detail fields (Req'n No, full Item Desc, GL Acct) into a parsed line."""
    merged = dict(line)
    req_no = (detail.get("Req'n No") or "").strip()
    if req_no:
        merged["req_no"] = req_no
    desc = (detail.get("Item Desc") or "").strip()
    if desc:
        merged["item_description"] = desc
    gl = (detail.get("GL Acct") or "").strip()
    if gl and not merged.get("gl_account"):
        merged["gl_account"] = gl
    return merged


def is_item_line(line: Dict[str, object]) -> bool:
    code = str(line.get("item_code") or "")
    return not line.get("is_note") and bool(_PART_CODE_RX.match(code))


def parse_approval_rows(headers: Sequence[str], rows: Sequence[Sequence[str]]) -> List[Dict[str, object]]:
    entries: List[Dict[str, object]] = []
    for idx, row in enumerate(_rows_to_dicts(headers, rows)):
        user = row.get("Approval User", "")
        raw_dt = row.get("Date Time", "")
        status = row.get("Status", "")
        if not (user or raw_dt or status):
            continue
        entries.append(
            {
                "line_no": idx + 1,
                "approval_user": user,
                "action_at_raw": raw_dt,
                "action_at": parse_pronto_datetime(raw_dt),
                "status": status,
                "comment": row.get("Comment", ""),
            }
        )
    return entries


def items_for_requisition(
    po_lines: Dict[str, Dict[str, object]], requisition_no: str
) -> Dict[str, Dict[str, object]]:
    """Collect item lines across the original and split POs that belong to one requisition.

    A line belongs to the requisition when its Line Detail ``Req'n No`` equals it. Lines without a
    captured Req'n No are only trusted on the PO that carries the requisition's own number.
    Returns {item_code: {item_code, original_po, split_po, quantity, unit, unit_price, line_total,
    gl_account, description, seq}}.
    """
    req = str(requisition_no).strip()
    out: Dict[str, Dict[str, object]] = {}
    for po, payload in po_lines.items():
        if not isinstance(payload, dict) or not payload.get("found"):
            continue
        for line in payload.get("lines") or []:
            if not isinstance(line, dict) or not is_item_line(line):
                continue
            line_req = str(line.get("req_no") or "").strip()
            if line_req and line_req != req:
                continue
            if not line_req and str(po) != req:
                continue
            code = str(line["item_code"])
            ordered = line.get("ordered")
            qty = int(round(ordered)) if isinstance(ordered, float) and abs(ordered - round(ordered)) < 1e-9 else None
            out[code] = {
                "item_code": code,
                "original_po": req,
                "split_po": str(po) if str(po) != req else "",
                "quantity": qty,
                "unit": line.get("unit") or "",
                "unit_price": line.get("item_price"),
                "line_total": line.get("line_total"),
                "gl_account": line.get("gl_account") or "",
                "description": line.get("item_description") or "",
                "seq": line.get("seq"),
            }
    return out
