"""Pure parsers for Pronto PO M094 (Approve/Review Requisitions) screens.

No Playwright here, so the logic can be unit-tested offline against captured screen data.
Screens these parsers read (seen on Pronto Xi 2026-11-26, account itmt):
- Immediate Action Req'd list. Headers include Order No, Supplier, Whse, Due, User, Cost Category,
  Req Total, Currency, Local Value, Auth, Group, Type, Action, Buyer, Stock Group, Priority.
  Pronto shortens some headers when columns are narrow (e.g. "Order ...", "C...", "Au..."), so
  headers are matched by prefix.
- Next Action By card: Name, User, Hierarchy. "Requisition:" card field holds the order number.
- Approval Status card: Approval User, Date Time, Status, Comment (parsed by pronto_po_parse).
"""

import re
from typing import Dict, List, Optional, Sequence, Tuple

from pronto_po_parse import parse_number, parse_pronto_datetime

# (output key, accepted header names; the first one is the full Pronto header)
_QUEUE_COLUMNS = [
    ("orderNo", ["Order No"]),
    ("supplier", ["Supplier"]),
    ("warehouse", ["Whse"]),
    ("due", ["Due"]),
    ("requestUser", ["User"]),
    ("costCategory", ["Cost Category"]),
    ("reqTotal", ["Req Total"]),
    ("currency", ["Currency"]),
    ("localValue", ["Local Value"]),
    ("auth", ["Auth"]),
    ("group", ["Group"]),
    ("action", ["Action"]),
    ("buyer", ["Buyer"]),
    ("stockGroup", ["Stock Group"]),
    ("priority", ["Priority"]),
]


def _clean(value: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\xa0", " ")).strip()


def _header_candidates(header: str) -> List[str]:
    """Output keys a (possibly shortened) Pronto header can stand for; an exact name wins."""
    h = _clean(header)
    if not h:
        return []
    shortened = h.endswith("...") or h.endswith("…")
    stem = re.sub(r"(\.\.\.|…)$", "", h).strip().lower()
    exact = [key for key, names in _QUEUE_COLUMNS if any(stem == n.lower() for n in names)]
    if exact or not shortened or not stem:
        return exact
    return [key for key, names in _QUEUE_COLUMNS if any(n.lower().startswith(stem) for n in names)]


def _resolve_headers(headers: Sequence[str]) -> List[Optional[str]]:
    """Exact headers are mapped first; a shortened header (e.g. "C..." after "Cost Category")
    then takes the first column it can stand for that is still free."""
    candidates = [_header_candidates(h) for h in headers]
    keys: List[Optional[str]] = [None] * len(headers)
    used = set()
    for i, h in enumerate(headers):
        if candidates[i] and not re.search(r"(\.\.\.|…)$", _clean(h)) and candidates[i][0] not in used:
            keys[i] = candidates[i][0]
            used.add(keys[i])
    for i, h in enumerate(headers):
        if keys[i] is None:
            free = [k for k in candidates[i] if k not in used]
            if free:
                keys[i] = free[0]
                used.add(free[0])
    return keys


def parse_queue_rows(headers: Sequence[str], rows: Sequence[Sequence[str]]) -> List[Dict[str, object]]:
    """Immediate Action list rows -> queue entries. Rows without a numeric order number are skipped."""
    keys = _resolve_headers(headers)
    out: List[Dict[str, object]] = []
    seen = set()
    for row in rows:
        rec: Dict[str, object] = {}
        for i, raw in enumerate(row):
            key = keys[i] if i < len(keys) else None
            if key:
                rec[key] = _clean(raw)
        order_no = str(rec.get("orderNo") or "")
        if not order_no.isdigit() or order_no in seen:
            continue
        seen.add(order_no)
        for key in ("reqTotal", "localValue"):
            rec[key] = parse_number(str(rec.get(key) or "")) if rec.get(key) else None
        rec["dueDate"] = (parse_pronto_datetime(str(rec.get("due") or "")) or "")[:10] or None
        out.append(rec)
    return out


def parse_next_action_rows(headers: Sequence[str], rows: Sequence[Sequence[str]]) -> List[Dict[str, str]]:
    """Next Action By rows -> [{name, user, hierarchy}], empty rows skipped, duplicates removed."""
    idx = {_clean(h).lower(): i for i, h in enumerate(headers)}

    def cell(row: Sequence[str], name: str) -> str:
        i = idx.get(name)
        return _clean(row[i]) if i is not None and i < len(row) else ""

    out: List[Dict[str, str]] = []
    seen = set()
    for row in rows:
        entry = {"name": cell(row, "name"), "user": cell(row, "user"), "hierarchy": cell(row, "hierarchy")}
        if not (entry["name"] or entry["user"]):
            continue
        key = (entry["name"], entry["user"], entry["hierarchy"])
        if key in seen:
            continue
        seen.add(key)
        out.append(entry)
    return out


def card_value(fields: Dict[str, str], label: str) -> str:
    """Value of a card field by label, ignoring case and a trailing dot or colon."""
    want = label.strip().rstrip(":.").lower()
    for k, v in fields.items():
        if k.strip().rstrip(":.").lower() == want:
            return _clean(v)
    return ""


def label_value(fields: Sequence[Tuple[str, str, str]], label: str) -> str:
    """Value right of a bold "Label:" card field in the same row, for read-only labels that have
    no "sunken" class (e.g. PRAS User Information on PO M094: "User:" at x:5 then "itmt" at x:11)."""
    want = label.strip().rstrip(":").lower()
    parsed = []
    for name_attr, cls, text in fields:
        m = re.search(r"x:(\d+)\s*,\s*y:(\d+)", name_attr or "")
        if m:
            parsed.append((int(m.group(2)), int(m.group(1)), _clean(text)))
    for y, x, text in parsed:
        if text.endswith(":") and text.rstrip(":").strip().lower() == want:
            right = sorted((x2, t) for y2, x2, t in parsed if y2 == y and x2 > x)
            if right and not right[0][1].endswith(":"):
                return right[0][1]
    return ""
