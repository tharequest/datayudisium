import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { loadFull } from '@/lib/sheet';
import { buildFullWorkbook } from '@/lib/export';

export const dynamic = 'force-dynamic';

// Hanya admin: berisi SEMUA kolom sheet (termasuk data orang tua dan link Drive).
export async function GET(req) {
  if (!getSession(req)) return NextResponse.json({ error: 'Sesi berakhir. Silakan login lagi.' }, { status: 401 });
  const s = await getSettings();
  if (!s.sheetUrl) return NextResponse.json({ error: 'Link spreadsheet belum diatur.' }, { status: 400 });
  try {
    const buf = buildFullWorkbook(await loadFull(s.sheetUrl));
    const name = `Data-Lengkap-Yudisium-FMIPA-Periode-${s.periode}-${String(s.tahunAjar).replace('/', '-')}.xlsx`.replace(/\s+/g, '-');
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
