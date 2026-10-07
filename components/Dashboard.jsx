'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const PR = { C: 'Cumlaude', S: 'Sangat Memuaskan', M: 'Memuaskan', N: 'Tanpa Predikat' };

export default function Dashboard({ initial }) {
  const [data, setData] = useState(initial);
  const [q, setQ] = useState('');
  const [fp, setFp] = useState('');
  const [fr, setFr] = useState('');
  const [sort, setSort] = useState({ k: 'nama', d: 1 });
  const [busy, setBusy] = useState(false);
  const [stamp, setStamp] = useState('');
  const [sel, setSel] = useState(null); // NIM peserta yang dipilih
  const [imgErr, setImgErr] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState('');
  const cardRef = useRef(null);
  const { rows, periode, tahunAjar, error, fetchedAt } = data;

  useEffect(() => {
    if (fetchedAt) setStamp(new Date(fetchedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }));
  }, [fetchedAt]);

  const hasJudul = useMemo(() => rows.some((r) => r.judul), [rows]);
  const prodiList = useMemo(() => [...new Set(rows.map((r) => r.prodi).filter(Boolean))].sort(), [rows]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const L = rows.filter(
      (r) => (!fp || r.prodi === fp) && (!fr || r.pr === fr) && (!s || `${r.nama} ${r.nim} ${r.judul}`.toLowerCase().includes(s))
    );
    const { k, d } = sort;
    return [...L].sort((a, b) => {
      const x = a[k];
      const y = b[k];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'id')) * d;
    });
  }, [rows, q, fp, fr, sort]);

  const n = list.length;
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  const ipks = list.map((r) => r.ipk).filter((v) => v != null);
  const toefls = list.map((r) => r.toefl).filter((v) => v != null);
  const cum = list.filter((r) => r.pr === 'C').length;
  const byProdi = Object.entries(
    list.reduce((m, r) => {
      const k = r.prodi || '-';
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...byProdi.map((x) => x[1]));

  const cols = [
    ['No', null],
    ['Nama', 'nama'],
    ['NIM', 'nim'],
    ['Program Studi', 'prodi'],
    ...(hasJudul ? [['Judul Tugas Akhir', 'judul']] : []),
    ['IPK', 'ipk'],
    ['TOEFL', 'toefl'],
    ['Predikat', 'pr'],
  ];

  const picked = useMemo(() => rows.find((r) => r.nim === sel) || null, [rows, sel]);

  function pick(r) {
    setImgErr(false);
    setSel(r.nim);
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const toggleSort = (k) => setSort((s) => ({ k, d: s.k === k ? -s.d : 1 }));

  async function refresh() {
    setBusy(true);
    try {
      const r = await fetch('/api/data', { cache: 'no-store' });
      setData(await r.json());
    } catch {
      setData((d) => ({ ...d, error: 'Gagal memuat ulang data.' }));
    }
    setBusy(false);
  }

  // Export = sheet penuh (semua kolom, termasuk data orang tua dan link Drive),
  // hanya untuk peserta yang lolos filter yang sedang tampil. File dibuat di server.
  async function exportXlsx() {
    setExporting(true);
    setExportErr('');
    try {
      const r = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nims: list.map((x) => x.nim) }),
        cache: 'no-store',
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || 'Gagal membuat file Excel.');
      }
      const name = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || 'Peserta-Yudisium-FMIPA.xlsx';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await r.blob());
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setExportErr(e.message);
    }
    setExporting(false);
  }

  return (
    <main className="w">
      <header className="top">
        <div>
          <h1>Peserta Yudisium FMIPA UNTAN</h1>
          <p className="sub">
            Periode {periode}, tahun ajar {tahunAjar}
            {stamp ? `. Data diambil ${stamp}` : ''}
          </p>
        </div>
        <div className="acts">
          <button className="btn" onClick={refresh} disabled={busy}>{busy ? 'Memuat…' : 'Muat ulang'}</button>
          <button className="btn pri" onClick={exportXlsx} disabled={!n || exporting}>{exporting ? 'Menyiapkan…' : `Export Excel (${n})`}</button>
        </div>
      </header>

      {(error || exportErr) && <div className="err" role="alert">{error || exportErr}</div>}

      <section className="stats">
        <div className="hero"><b>{n}</b><span>peserta yudisium</span></div>
        <div className="k"><b>{avg(ipks).toFixed(2)}</b><span>rata-rata IPK</span></div>
        <div className="k"><b>{cum}</b><span>lulus cumlaude</span></div>
        <div className="k"><b>{Math.round(avg(toefls))}</b><span>rata-rata TOEFL/TUTEP</span></div>
      </section>

      <section className="cd" ref={cardRef}>
        <h2>Peserta per program studi</h2>
        <div className={picked ? 'split' : ''}>
          <div>
            {byProdi.length === 0 && <p className="mu">Belum ada data.</p>}
            {byProdi.map(([k, v]) => (
              <div className="br" key={k}>
                <span>{k}</span>
                <i style={{ width: `${(v / max) * 100}%` }} />
                <b>{v}</b>
              </div>
            ))}
            {!picked && n > 0 && <p className="mu small hint">Klik nama peserta di tabel untuk menampilkan fotonya di sini.</p>}
          </div>
          {picked && (
            <aside className="pf" aria-live="polite">
              {picked.foto && !imgErr ? (
                <img
                  key={picked.nim}
                  src={`https://drive.google.com/thumbnail?id=${picked.foto}&sz=w600`}
                  alt={`Foto ${picked.nama}`}
                  referrerPolicy="no-referrer"
                  onError={() => setImgErr(true)}
                />
              ) : (
                <div className="noimg">
                  {picked.foto
                    ? 'Foto tidak bisa ditampilkan. Pastikan folder upload foto di Google Drive dibagikan "Anyone with the link".'
                    : 'Peserta ini belum mengunggah foto.'}
                </div>
              )}
              <div className="pi">
                <b>{picked.nama}</b>
                <span>{picked.nim}</span>
                <span>{picked.prodi}</span>
                <span>
                  IPK {picked.ipk == null ? '-' : picked.ipk.toFixed(2)}
                  {`, ${PR[picked.pr] || PR.N}`}
                </span>
                <button className="btn" onClick={() => setSel(null)}>Tutup</button>
              </div>
            </aside>
          )}
        </div>
      </section>

      <div className="tb">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, NIM, atau judul" aria-label="Cari peserta" />
        <select value={fp} onChange={(e) => setFp(e.target.value)} aria-label="Filter program studi">
          <option value="">Semua prodi</option>
          {prodiList.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={fr} onChange={(e) => setFr(e.target.value)} aria-label="Filter predikat">
          <option value="">Semua predikat</option>
          {Object.entries(PR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="tw">
        <table>
          <thead>
            <tr>
              {cols.map(([label, k]) => (
                <th key={label} onClick={k ? () => toggleSort(k) : undefined} className={k ? 'sortable' : ''}>
                  {label}{k && sort.k === k ? (sort.d > 0 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={r.nim} className={r.nim === sel ? 'on' : ''}>
                <td>{i + 1}</td>
                <td><button className="nm" onClick={() => pick(r)}>{r.nama}</button></td>
                <td>{r.nim}</td>
                <td>{r.prodi}</td>
                {hasJudul && <td className="jd">{r.judul}</td>}
                <td className="num">{r.ipk == null ? '-' : r.ipk.toFixed(2)}</td>
                <td className="num">{r.toefl ?? '-'}</td>
                <td><span className={`bd ${r.pr || 'N'}`}>{PR[r.pr] || PR.N}</span></td>
              </tr>
            ))}
            {!n && !error && (
              <tr><td colSpan={cols.length} className="mu">Tidak ada peserta yang cocok dengan filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="ft">Menampilkan {n} dari {rows.length} peserta. <a href="/admin">Admin</a></p>
    </main>
  );
}
