import { NextResponse } from 'next/server';
import { getSession, sameOrigin } from '@/lib/session';
import { getSettings, saveSettings, storageMode } from '@/lib/settings';
import { clearCache, loadRows, parseSheetUrl } from '@/lib/sheet';

export const dynamic = 'force-dynamic';

const unauthorized = () => NextResponse.json({ error: 'Sesi berakhir. Silakan login lagi.' }, { status: 401 });

export async function GET(req) {
  if (!getSession(req)) return unauthorized();
  return NextResponse.json({ settings: await getSettings(), storage: storageMode() });
}

export async function PUT(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Origin tidak diizinkan.' }, { status: 403 });
  if (!getSession(req)) return unauthorized();

  let b = {};
  try { b = await req.json(); } catch { /* kosong */ }
  const sheetUrl = String(b.sheetUrl || '').trim();
  const periode = String(b.periode || '').trim();
  const tahunAjar = String(b.tahunAjar || '').trim();

  if (!parseSheetUrl(sheetUrl)) {
    return NextResponse.json({ error: 'Link harus berupa link Google Sheets (docs.google.com/spreadsheets/d/...).' }, { status: 400 });
  }
  if (!/^[A-Za-z0-9 ]{1,20}$/.test(periode)) {
    return NextResponse.json({ error: 'Periode wajib diisi (maks. 20 karakter, contoh: I atau 2).' }, { status: 400 });
  }
  if (!/^\d{4}\/\d{4}$/.test(tahunAjar)) {
    return NextResponse.json({ error: 'Tahun ajar harus berformat 2026/2027.' }, { status: 400 });
  }

  // Tes dulu: link yang tidak bisa dibaca tidak akan disimpan, jadi dashboard publik tidak rusak.
  let rows;
  try {
    rows = await loadRows(sheetUrl, { fresh: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  try {
    const settings = await saveSettings({ sheetUrl, periode, tahunAjar });
    clearCache();
    return NextResponse.json({ ok: true, settings, count: rows.length });
  } catch (e) {
    if (e.message === 'NO_STORAGE') {
      return NextResponse.json(
        { error: 'Penyimpanan belum aktif. Hubungkan Upstash Redis ke project di Vercel (lihat README), lalu redeploy.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan.' }, { status: 500 });
  }
}
