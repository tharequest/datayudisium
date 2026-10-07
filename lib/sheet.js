const TTL = 30_000; // cache 30 detik per instance supaya Google tidak dihajar tiap pengunjung
let cache = { key: '', at: 0, rows: null };

export function clearCache() {
  cache = { key: '', at: 0, rows: null };
}

export function parseSheetUrl(url) {
  const s = String(url || '');
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/.exec(s);
  if (!m) return null;
  const g = /[?#&]gid=(\d+)/.exec(s);
  return { id: m[1], gid: g ? g[1] : '0' };
}

function parseCsv(t) {
  const rows = [];
  let row = [];
  let f = '';
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') { f += '"'; i++; } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  row.push(f);
  rows.push(row);
  return rows;
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const titleCase = (s) =>
  s === s.toUpperCase() && /[A-Z]/.test(s)
    ? s.toLowerCase().replace(/(^|[\s.'’-])([a-z])/g, (m, a, b) => a + b.toUpperCase())
    : s;
// Ambil ID file dari link Google Drive (open?id=..., /file/d/.../view, uc?id=...)
const driveId = (u) => {
  const m = /[?&]id=([\w-]{10,})/.exec(u) || /\/d\/([\w-]{10,})/.exec(u);
  return m ? m[1] : '';
};
const predikat = (t) => (/pujian|cum/i.test(t) ? 'C' : /sangat/i.test(t) ? 'S' : /memuaskan/i.test(t) ? 'M' : '');

/**
 * Baca sheet Google Form (Form Responses) -> daftar peserta.
 * Kolom dicari lewat nama header, jadi urutan kolom boleh berubah antar periode.
 * Duplikat NIM: yang dipakai submit paling bawah (terbaru).
 */
export async function loadRows(url, { fresh = false } = {}) {
  const p = parseSheetUrl(url);
  if (!p) throw new Error('Link spreadsheet tidak valid.');
  const key = `${p.id}:${p.gid}`;
  if (!fresh && cache.key === key && Date.now() - cache.at < TTL) return cache.rows;

  let res;
  try {
    res = await fetch(`https://docs.google.com/spreadsheets/d/${p.id}/export?format=csv&gid=${p.gid}`, {
      cache: 'no-store',
      redirect: 'follow',
    });
  } catch {
    throw new Error('Gagal menghubungi Google Sheets.');
  }
  const text = res.ok ? (await res.text()).replace(/^\uFEFF/, '') : '';
  if (!res.ok || /^\s*</.test(text)) {
    throw new Error('Spreadsheet tidak bisa dibaca. Pastikan akses dibagikan ke "Anyone with the link" (Viewer) dan link/gid-nya benar.');
  }

  const grid = parseCsv(text);
  const head = (grid.shift() || []).map((h) => clean(h).toLowerCase());
  const find = (fn) => head.findIndex(fn);
  const iNama = find((x) => x === 'nama' || (x.startsWith('nama') && !/ayah|ibu|orang/.test(x)));
  const iNim = find((x) => x === 'nim' || x.startsWith('nim'));
  const iProdi = find((x) => x.includes('program studi') || x === 'prodi');
  const iJudul = find((x) => x.includes('judul'));
  const iIpk = find((x) => x === 'ipk' || x.startsWith('ipk'));
  const iToefl = find((x) => x.includes('toefl') || x.includes('tutep') || x.includes('skor'));
  const iPred = find((x) => x.includes('predikat'));
  const iFoto = find((x) => x.startsWith('foto') || x.includes('pas foto'));
  if (iNama < 0 || iNim < 0) {
    throw new Error('Kolom "Nama" dan "NIM" tidak ditemukan di baris pertama sheet ini. Cek apakah gid-nya sheet jawaban form.');
  }
  const cell = (r, i) => (i >= 0 ? r[i] ?? '' : '');

  const map = new Map();
  for (const r of grid) {
    const nim = clean(cell(r, iNim)).toUpperCase().replace(/\s/g, '');
    const nama = clean(cell(r, iNama));
    if (!nim || !nama) continue;
    let ipk = parseFloat(clean(cell(r, iIpk)).replace(',', '.'));
    if (Number.isNaN(ipk)) ipk = null;
    else if (ipk > 4 && ipk <= 40) ipk = ipk / 10; // salah ketik "29,5" -> 2,95
    const toefl = parseInt(clean(cell(r, iToefl)), 10);
    map.delete(nim);
    map.set(nim, {
      nama: titleCase(nama),
      nim,
      prodi: clean(cell(r, iProdi)).replace(/^S1\s+/i, ''),
      judul: clean(cell(r, iJudul)),
      ipk,
      toefl: Number.isNaN(toefl) ? null : toefl,
      pr: predikat(cell(r, iPred)),
      foto: driveId(cell(r, iFoto)),
    });
  }
  const rows = [...map.values()];
  cache = { key, at: Date.now(), rows };
  return rows;
}
