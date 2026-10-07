import { NextResponse } from 'next/server';
import { getSession, sameOrigin } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { loadFull } from '@/lib/sheet';
import { buildFullWorkbook } from '@/lib/export';

export const dynamic = 'force-dynamic';

const norm = (s) => String(s ?? '').toUpperCase().replace(/\s/g, '');

// Export dari dashboard: semua kolom sheet, difilter sesuai daftar NIM yang dikirim.
// Isi Environment Variable EXPORT_REQUIRES_LOGIN=true untuk mewajibkan login admin.
export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Origin tidak diizinkan.' }, { status: 403 });
  if (process.env.EXPORT_REQUIRES_LOGIN === 'true' && !getSession(req)) {
    return NextResponse.json({ error: 'Export hanya untuk admin. Login dulu di /admin.' }, { status: 401 });
  }
  const s = await getSettings();
  if (!s.sheetUrl) return NextResponse.json({ error: 'Link spreadsheet belum diatur.' }, { status: 400 });

  let body = {};
  try { body = await req.json(); } catch { /* kosong = semua peserta */ }
  const want = Array.isArray(body.nims) ? new Set(body.nims.map(norm)) : null;

  try {
    const full = await loadFull(s.sheetUrl);
    const rows = want ? full.rows.filter((r) => want.has(norm(r[full.nimCol]))) : full.rows;
    const buf = buildFullWorkbook({ head: full.head, rows });
    const name = `Peserta-Yudisium-FMIPA-Periode-${s.periode}-${String(s.tahunAjar).replace('/', '-')}.xlsx`.replace(/\s+/g, '-');
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
