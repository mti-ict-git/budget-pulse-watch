import * as XLSX from 'xlsx';
import type { PRFItem } from '@/types/prfItem';

export interface ItemExportPRF {
  id: string;
  prfNo: string;
  description: string;
  amount: number;
  progress: string;
  items?: PRFItem[];
}

export function buildPrfItemsWorkbook(prfs: ItemExportPRF[], getCOAName: (id: number) => string) {
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.json_to_sheet(prfs.map(prf => ({
    'PRF number': prf.prfNo,
    'Description': prf.description,
    'Requested amount': prf.amount,
    'PRF status': prf.progress,
    'Item count': prf.items?.length ?? 0,
  })));
  summary['!cols'] = [{ wch: 18 }, { wch: 64 }, { wch: 22 }, { wch: 25 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, summary, 'PRFs');
  const rows = prfs.flatMap(prf => (prf.items ?? []).map(item => ({
    'PRF number': prf.prfNo,
    'Item ID': item.PRFItemID ?? item.ItemID ?? '',
    'Item name': item.ItemName,
    'Description': item.Description ?? '',
    'Part number': item.ItemCode?.trim() || item.Description?.trim().match(/^part:\s*(.+)$/i)?.[1]?.trim() || '',
    'Cost code': item.PurchaseCostCode ?? '',
    'Original PO': item.OriginalPONumber ?? '',
    'Split PO': item.SplitPONumber ?? '',
    'Quantity': item.Quantity,
    'Unit price': item.UnitPrice,
    'Total': item.TotalPrice ?? item.UnitPrice * item.Quantity,
    'PRF status': prf.progress,
    'Item status': item.Status ?? '',
    'COA ID': item.COAID ?? '',
    'COA name': item.COAID ? getCOAName(item.COAID) : '',
    'Budget year': item.BudgetYear ?? '',
    'Picked up by': item.PickedUpBy ?? '',
    'Pickup date': item.PickedUpDate ? String(item.PickedUpDate) : '',
    'Notes': item.Notes ?? '',
    'Specifications': item.Specifications ?? '',
  })));
  const items = XLSX.utils.json_to_sheet(rows);
  items['!cols'] = [18, 12, 52, 60, 24, 24, 20, 20, 12, 20, 20, 24, 24, 12, 32, 14, 26, 30, 60, 70].map(wch => ({ wch }));
  if (rows.length) {
    items['!autofilter'] = { ref: items['!ref']! };
    for (let row = 2; row <= rows.length + 1; row++) {
      for (const col of ['J', 'K']) {
        const cell = items[`${col}${row}`];
        if (cell?.t === 'n') cell.z = '#,##0.00';
      }
    }
  }
  XLSX.utils.book_append_sheet(workbook, items, 'PRF Items');
  return workbook;
}

export async function buildStyledPrfItemsWorkbook(prfs: ItemExportPRF[], getCOAName: (id: number) => string) {
  // Load the styled writer only when export is requested.
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'MTI ICT PO Monitoring';
  workbook.created = new Date();
  const source = buildPrfItemsWorkbook(prfs, getCOAName);
  const count = prfs.reduce((total, prf) => total + (prf.items?.length ?? 0), 0);
  for (const name of source.SheetNames) {
    const data = XLSX.utils.sheet_to_json<(string | number)[]>(source.Sheets[name], { header: 1, defval: '' });
    const headers = data[0].map(String);
    const sheet = workbook.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: 4, xSplit: 1, topLeftCell: 'B5', showGridLines: false }],
      properties: { defaultRowHeight: 28, tabColor: { argb: name === 'PRFs' ? 'FF2563EB' : 'FF2A9D8F' } },
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:4' },
    });
    sheet.mergeCells(1, 1, 1, headers.length);
    const title = sheet.getCell('A1');
    title.value = name === 'PRFs' ? 'MTI | Purchase Request Summary' : 'MTI | Purchase Request Items';
    title.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    title.alignment = { vertical: 'middle', indent: 1 };
    sheet.getRow(1).height = 38;
    sheet.mergeCells(2, 1, 2, headers.length);
    const subtitle = sheet.getCell('A2');
    subtitle.value = `${prfs.length} PRF${prfs.length === 1 ? '' : 's'} · ${count} item${count === 1 ? '' : 's'} | Exported ${new Date().toLocaleString('en-GB')} | Loaded selection only`;
    subtitle.font = { name: 'Calibri', size: 11, color: { argb: 'FF475569' } };
    subtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    subtitle.alignment = { vertical: 'middle', indent: 1 };
    sheet.getRow(2).height = 28;
    sheet.getRow(3).height = 10;
    sheet.addTable({
      name: name === 'PRFs' ? 'PRFSummary' : 'PRFItems', ref: 'A4', headerRow: true,
      style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: headers.map(name => ({ name, filterButton: true })), rows: data.slice(1),
    });
    const widths = source.Sheets[name]['!cols'] ?? [];
    sheet.columns.forEach((column, index) => { column.width = widths[index]?.wch ?? 22; });
    sheet.getRow(4).height = 32;
    sheet.getRow(4).eachCell(cell => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    for (let row = 5; row <= data.length + 3; row++) {
      let lines = 1;
      sheet.getRow(row).eachCell({ includeEmpty: true }, (cell, col) => {
        cell.font = { name: 'Calibri', size: 11, bold: false, color: { argb: 'FF182433' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: row % 2 ? 'FFFFFFFF' : 'FFF1F5F9' } };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
        cell.alignment = { vertical: 'top', wrapText: true };
        const label = headers[col - 1];
        if (typeof cell.value === 'number') {
          cell.alignment = { vertical: 'top', horizontal: 'right' };
          cell.numFmt = ['Unit price', 'Total', 'Requested amount'].includes(label) ? '#,##0.00;[Red](#,##0.00);"—"' : Number.isInteger(cell.value) ? '#,##0' : '#,##0.00####';
        }
        lines = Math.max(lines, Math.ceil(String(cell.value ?? '').length / Math.max(1, sheet.getColumn(col).width! - 2)));
      });
      sheet.getRow(row).height = Math.min(90, Math.max(28, lines * 15 + 8));
    }
    sheet.headerFooter.oddFooter = '&LMTI ICT PO Monitoring&RPage &P of &N';
  }
  return workbook;
}

export async function downloadPrfItems(prfs: ItemExportPRF[], getCOAName: (id: number) => string) {
  const scope = prfs.length === 1 ? prfs[0].prfNo.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Current_Page';
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const workbook = await buildStyledPrfItemsWorkbook(prfs, getCOAName);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `PRF_Items_${scope}_${timestamp}.xlsx`;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
}
