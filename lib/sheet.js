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

// C = Cumlaude, S = Sangat Memuaskan, M = Memuaskan, N = Tanpa Predikat
const predikat = (t) => (/pujian|cum/i.test(t) ? 'C' : /sangat/i.test(t) ? 'S' : /memuaskan/i.test(t) ? 'M' : 'N');

const toNumber = (s) => {
  let n = parseFloat(clean(s).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};

async function fetchGrid(p) {
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
  const head = (grid.shift() || []).map(clean);
  return { head, grid };
}

function columns(head) {
  const h = head.map((x) => x.toLowerCase());
  const find = (fn) => h.findIndex(fn);
  const c = {
    nama: find((x) => x === 'nama' || (x.startsWith('nama') && !/ayah|ibu|orang/.test(x))),
    nim: find((x) => x === 'nim' || x.startsWith('nim')),
    prodi: find((x) => x.includes('program studi') || x === 'prodi'),
    judul: find((x) => x.includes('judul')),
    ipk: find((x) => x === 'ipk' || x.startsWith('ipk')),
    toefl: find((x) => x.includes('toefl') || x.includes('tutep') || x.includes('skor')),
    pred: find((x) => x.includes('predikat')),
    foto: find((x) => x.startsWith('foto') || x.includes('pas foto')),
  };
  if (c.nama < 0 || c.nim < 0) {
    throw new Error('Kolom "Nama" dan "NIM" tidak ditemukan di baris pertama sheet ini. Cek apakah gid-nya sheet jawaban form.');
  }
  return c;
}

const cellAt = (r, i) => (i >= 0 ? r[i] ?? '' : '');
const nimOf = (r, c) => clean(cellAt(r, c.nim)).toUpperCase().replace(/\s/g, '');

/**
 * Baca sheet Google Form (Form Responses) -> daftar peserta untuk dashboard.
 * Kolom dicari lewat nama header, jadi urutan kolom boleh berubah antar periode.
 * Duplikat NIM: yang dipakai submit paling bawah (terbaru).
 */
export async function loadRows(url, { fresh = false } = {}) {
  const p = parseSheetUrl(url);
  if (!p) throw new Error('Link spreadsheet tidak valid.');
  const key = `${p.id}:${p.gid}`;
  if (!fresh && cache.key === key && Date.now() - cache.at < TTL) return cache.rows;

  const { head, grid } = await fetchGrid(p);
  const c = columns(head);

  const map = new Map();
  for (const r of grid) {
    const nim = nimOf(r, c);
    const nama = clean(cellAt(r, c.nama));
    if (!nim || !nama) continue;
    let ipk = toNumber(cellAt(r, c.ipk));
    if (ipk != null && ipk > 4 && ipk <= 40) ipk = ipk / 10; // salah ketik "29,5" -> 2,95
    const toefl = parseInt(clean(cellAt(r, c.toefl)), 10);
    map.delete(nim);
    map.set(nim, {
      nama: titleCase(nama),
      nim,
      prodi: clean(cellAt(r, c.prodi)).replace(/^S1\s+/i, ''),
      judul: clean(cellAt(r, c.judul)),
      ipk,
      toefl: Number.isNaN(toefl) ? null : toefl,
      pr: predikat(cellAt(r, c.pred)),
      foto: driveId(cellAt(r, c.foto)),
    });
  }
  const rows = [...map.values()];
  cache = { key, at: Date.now(), rows };
  return rows;
}

/**
 * Semua kolom sheet apa adanya (termasuk data orang tua dan semua link Drive).
 * HANYA dipakai oleh export admin. Duplikat NIM: ambil yang terbaru.
 */
export async function loadFull(url) {
  const p = parseSheetUrl(url);
  if (!p) throw new Error('Link spreadsheet tidak valid.');
  const { head, grid } = await fetchGrid(p);
  const c = columns(head);

  const map = new Map();
  for (const r of grid) {
    const nim = nimOf(r, c);
    if (!nim || !clean(cellAt(r, c.nama))) continue;
    map.delete(nim);
    map.set(nim, r);
  }

  const keep = head.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
  const rows = [...map.values()].map((r) =>
    keep.map((i) => {
      const v = String(r[i] ?? '').trim();
      if (i === c.pred && predikat(v) === 'N') return 'Tanpa Predikat';
      if (i === c.ipk || i === c.toefl) {
        const n = toNumber(v);
        if (n != null) return i === c.ipk && n > 4 && n <= 40 ? n / 10 : n;
      }
      return v;
    })
  );
  return { head: keep.map((i) => head[i]), rows, nimCol: keep.indexOf(c.nim) };
}
