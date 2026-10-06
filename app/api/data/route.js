import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';
import { loadRows } from '@/lib/sheet';

export const dynamic = 'force-dynamic';

// Publik. Sengaja TIDAK mengirim link spreadsheet ke browser pengunjung.
export async function GET() {
  const s = await getSettings();
  const base = { periode: s.periode, tahunAjar: s.tahunAjar, fetchedAt: new Date().toISOString() };
  if (!s.sheetUrl) {
    return NextResponse.json({ ...base, rows: [], error: 'Link spreadsheet belum diatur. Admin dapat mengaturnya di /admin.' });
  }
  try {
    return NextResponse.json({ ...base, rows: await loadRows(s.sheetUrl), error: null });
  } catch (e) {
    return NextResponse.json({ ...base, rows: [], error: e.message });
  }
}
