import * as XLSX from 'xlsx';

/** Bangun file .xlsx berisi semua kolom; semua link http(s) dibuat bisa diklik. */
export function buildFullWorkbook({ head, rows }) {
  const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
  rows.forEach((r, ri) =>
    r.forEach((v, ci) => {
      if (typeof v === 'string' && /^https?:\/\//.test(v)) {
        ws[XLSX.utils.encode_cell({ r: ri + 1, c: ci })] = { t: 's', v, l: { Target: v } };
      }
    })
  );
  ws['!cols'] = head.map((h, ci) => {
    const longest = Math.max(String(h).length, ...rows.slice(0, 60).map((r) => String(r[ci] ?? '').length));
    return { wch: Math.min(60, Math.max(10, longest)) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Lengkap');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
