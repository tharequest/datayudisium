'use client';

import { useEffect, useState } from 'react';

const post = (url, body) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

export default function AdminClient() {
  const [phase, setPhase] = useState('checking'); // checking | login | panel
  const [cred, setCred] = useState({ username: '', password: '' });
  const [form, setForm] = useState({ sheetUrl: '', periode: '', tahunAjar: '' });
  const [storage, setStorage] = useState('');
  const [msg, setMsg] = useState(null); // { type: 'ok' | 'err', text }
  const [busy, setBusy] = useState(false);

  async function loadSettings() {
    const r = await fetch('/api/admin/settings', { cache: 'no-store' });
    if (r.status === 401) return false;
    const j = await r.json();
    setForm({ sheetUrl: j.settings.sheetUrl || '', periode: j.settings.periode || '', tahunAjar: j.settings.tahunAjar || '' });
    setStorage(j.storage);
    return true;
  }

  function backToLogin(text) {
    setCred({ username: '', password: '' });
    setMsg(text ? { type: 'err', text } : null);
    setPhase('login');
  }

  useEffect(() => {
    // Refresh atau Back/Forward = wajib login lagi.
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    const forceLogin = nav && (nav.type === 'reload' || nav.type === 'back_forward');

    (async () => {
      if (forceLogin) {
        await post('/api/auth/logout');
        backToLogin();
        return;
      }
      const s = await (await fetch('/api/auth/session', { cache: 'no-store' })).json();
      if (s.authenticated && (await loadSettings())) setPhase('panel');
      else backToLogin();
    })();

    // Halaman dipulihkan dari cache Back/Forward (bfcache): logout paksa.
    const onShow = (e) => {
      if (e.persisted) {
        post('/api/auth/logout');
        backToLogin();
      }
    };
    // Meninggalkan halaman admin (pindah halaman, refresh, tutup tab) = logout.
    const onHide = () => navigator.sendBeacon?.('/api/auth/logout');
    window.addEventListener('pageshow', onShow);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await post('/api/auth/login', cred);
    const j = await r.json().catch(() => ({}));
    if (r.ok && (await loadSettings())) {
      setCred({ username: '', password: '' });
      setPhase('panel');
    } else {
      setMsg({ type: 'err', text: j.error || 'Login gagal.' });
    }
    setBusy(false);
  }

  async function logout() {
    await post('/api/auth/logout');
    backToLogin();
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
      cache: 'no-store',
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) backToLogin(j.error);
    else if (r.ok) setMsg({ type: 'ok', text: `Tersimpan. Dashboard sekarang menampilkan ${j.count} peserta (periode ${j.settings.periode}, TA ${j.settings.tahunAjar}).` });
    else setMsg({ type: 'err', text: j.error || 'Gagal menyimpan.' });
    setBusy(false);
  }

  if (phase === 'checking') return <main className="adm"><p className="mu">Memeriksa sesi…</p></main>;

  if (phase === 'login') {
    return (
      <main className="adm">
        <form className="card" onSubmit={login} autoComplete="off">
          <h1>Login admin</h1>
          <label>Username
            <input value={cred.username} onChange={(e) => setCred({ ...cred, username: e.target.value })} autoComplete="off" required />
          </label>
          <label>Password
            <input type="password" value={cred.password} onChange={(e) => setCred({ ...cred, password: e.target.value })} autoComplete="new-password" required />
          </label>
          {msg && <div className={msg.type === 'ok' ? 'ok' : 'err'} role="alert">{msg.text}</div>}
          <button className="btn pri" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
          <a className="mu" href="/">Kembali ke dashboard</a>
        </form>
      </main>
    );
  }

  return (
    <main className="adm">
      <form className="card wide" onSubmit={save}>
        <div className="row">
          <h1>Pengaturan data yudisium</h1>
          <button type="button" className="btn" onClick={logout}>Logout</button>
        </div>
        {storage === 'none' && (
          <div className="err" role="alert">
            Penyimpanan belum aktif, jadi perubahan tidak bisa disimpan. Hubungkan Upstash Redis ke project ini di Vercel (langkah ada di README), lalu redeploy.
          </div>
        )}
        <label>Link Google Spreadsheet (sheet jawaban form)
          <input value={form.sheetUrl} onChange={(e) => setForm({ ...form, sheetUrl: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/…/edit?gid=…" required />
        </label>
        <p className="mu small">Buka sheet jawabannya, salin link dari address bar (termasuk bagian gid). Akses harus "Anyone with the link: Viewer".</p>
        <div className="two">
          <label>Periode
            <input value={form.periode} onChange={(e) => setForm({ ...form, periode: e.target.value })} placeholder="I" required />
          </label>
          <label>Tahun ajar
            <input value={form.tahunAjar} onChange={(e) => setForm({ ...form, tahunAjar: e.target.value })} placeholder="2026/2027" required />
          </label>
        </div>
        {msg && <div className={msg.type === 'ok' ? 'ok' : 'err'} role="alert">{msg.text}</div>}
        <div className="row">
          <button className="btn pri" disabled={busy}>{busy ? 'Memeriksa link…' : 'Simpan'}</button>
          <a className="mu" href="/">Lihat dashboard</a>
        </div>
      </form>
    </main>
  );
}
