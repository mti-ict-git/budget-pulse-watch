// Offline tests for OCR rescan duplicate detection. Data is PRF 54123 as stored on 2026-11-25:
// 9 items saved twice, once misread by an early scan (no item code, GL AMINB043) and once corrected.
const test = require('node:test');
const assert = require('node:assert/strict');
const { findLikelyDuplicates, itemTextSimilarity } = require('../dist/services/rescanDuplicates');

const item = (PRFItemID, ItemName, Quantity, UnitPrice, Status = 'Pending') => ({ PRFItemID, ItemName, Quantity, UnitPrice, Status });

// The early, misread copies (not found by OCR on rescan).
const stale = [
  item(16960, 'Cable Belden 7814A F/UTP Cat6 1000 feet Black', 2, 2500000),
  item(16961, 'CCTV UNV UNIVIEW IPC3232SB-ADZK-I0 Dome Indoor 2MP Varifocal', 4, 3000000),
  item(16962, 'CCTV, OUTDOOR, UNIV, IPC3222B-ADZK-G, 2MP VARIFOCAL, UNIVIEW', 2, 3000000),
  item(16963, 'Access Point Indoor Ruij AP-RAP8L4', 2, 3500000),
  item(16964, 'Switch Ruiji Type RG-CS83-4GT4XS-P', 1, 9000000),
  item(16966, 'PDU6G INDOORACK 6 Outlet 16A Germany Socket Power Distribution', 1, 340000),
  item(16967, 'UPS APC SMC1000I-2UC 1000VA Smart UPS', 1, 6300000),
  item(16968, 'Mikrotik SFP Transceiver SFP 1G-BD-SM-10KM', 1, 335000),
  item(16969, 'OTB mini 4 Core SC|RSOF 10 Best 4C (Include Pigtail Single Mode SC/UPC)', 1, 125000),
];

// The items the OCR matched on rescan: the corrected copies plus the items that were only stored once.
const matched = [
  item(16965, 'Box PVC TIBOX T-1212/7.5 W125xH125xD75mm IP66', 6, 114100),
  item(16970, 'CONNECTOR, COMMS, RJ45, CAT6, STP, BELDEN, P/100', 1, 587829),
  item(16971, 'PANEL, ELEC, BX, OUTDOOR, 800X600X30MM', 1, 4500000),
  item(16972, 'CONDUIT, CLIPSAL, 20MM DIA, PVC, PKG/100EA', 100, 17500),
  item(16973, 'SOCK, CLIPSAL, 20MM, 100PCS/PACK', 1, 45000),
  item(16974, 'CLAMP, PIPE, SADLE, CONDT CLIPSAL, 20MM, PVC', 1, 75000),
  item(16975, 'CABLE, FLEXIBEL, SPIRAL, 20MM, CLIPSAL', 1, 750000),
  item(16976, 'BOX, ELEC, T-DOS, 3 WAY, 20MM, CLIPSAL', 2, 12000),
  item(16977, 'GLAND, CABLE, PG48, 46.2MM', 2, 26000),
  item(16978, 'Shroud 25mm Cable Gland Plastic', 2, 18000),
  item(16980, 'Cable Belden 7814A F/UTP CAT6 1000 feet Black', 2, 2500000),
  item(16981, 'CCTV UNV UNIVIEW IPC3232SB-ADZK-I0 Dome Indoor 2MP Varifocal', 4, 3000000),
  item(16982, 'CCTV, OUTDOOR, UNV, IPC2322LB-ADZK-G, 2MP VARIFOCAL', 2, 3000000),
  item(16983, 'Access Point Indoor Ruiji RG-AP840-L', 2, 3500000),
  item(16984, 'Switch Ruiji Type RG-CS83-24GT4XS-P', 1, 9000000),
  item(16985, 'PDU6G INDORACK 6 Outlet 16A Germany Socket Power Distribution', 1, 340000),
  item(16986, 'POWER SUPPLY, SMART-UPS C, SMC1000I-2UC, 230V', 1, 6600000),
  item(16987, 'Mikrobits SFP Transceiver SFP-1G-BD-SM-10KM', 1, 335000),
  item(16988, 'OTB mini 4 Core SC|Roset FO Besi 4C (include Pigtail Single Mode SC/UPC)', 1, 125000),
];

test('PRF 54123: every stale copy points at its corrected copy', () => {
  const result = findLikelyDuplicates(stale, matched);
  const expected = { 16960: 16980, 16961: 16981, 16962: 16982, 16963: 16983, 16964: 16984, 16966: 16985, 16967: 16986, 16968: 16987, 16969: 16988 };
  assert.equal(result.size, 9);
  for (const [from, to] of Object.entries(expected)) assert.equal(result.get(Number(from))?.PRFItemID, to, `item ${from}`);
});

test('an item with a different quantity, a far price or a different name is not a duplicate', () => {
  const others = [item(1, 'Cable Belden 7814A F/UTP Cat6 1000 feet Black', 2, 2500000)];
  assert.equal(findLikelyDuplicates([item(2, 'Cable Belden 7814A F/UTP Cat6 1000 feet Black', 3, 2500000)], others).size, 0);
  assert.equal(findLikelyDuplicates([item(3, 'Cable Belden 7814A F/UTP Cat6 1000 feet Black', 2, 3500000)], others).size, 0);
  assert.equal(findLikelyDuplicates([item(4, 'Laptop Dell Latitude 5440', 2, 2500000)], others).size, 0);
});

test('cancelled items are never paired, and each counterpart is used once', () => {
  const target = [item(1, 'Switch Ruiji RG-CS83-24GT4XS-P', 1, 9000000)];
  assert.equal(findLikelyDuplicates([item(2, 'Switch Ruiji RG-CS83-24GT4XS-P', 1, 9000000, 'Cancelled')], target).size, 0);
  assert.equal(findLikelyDuplicates([item(2, 'Switch Ruiji RG-CS83-24GT4XS-P', 1, 9000000)], [{ ...target[0], Status: 'Cancelled' }]).size, 0);
  const two = findLikelyDuplicates([item(2, 'Switch Ruiji RG-CS83-24GT4XS-P', 1, 9000000), item(3, 'Switch Ruiji RG-CS83-24GT4XS', 1, 9000000)], target);
  assert.equal(two.size, 1);
  assert.equal(two.get(2)?.PRFItemID, 1); // the closer name wins
});

test('similarity is word overlap', () => {
  assert.equal(itemTextSimilarity('a b', ''), 0);
  assert.equal(itemTextSimilarity('UPS APC', 'ups apc'), 1);
});
