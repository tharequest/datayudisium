import { NextResponse } from 'next/server';
import { COOKIE_NAME, configured, cookieOptions, safeEqual, sameOrigin, sessionTtlMs, sign } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Pembatas percobaan login sederhana (per instance): 5 kali gagal / 15 menit per IP
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX = 5;

export async function POST(req) {
  if (!configured()) {
    return NextResponse.json(
      { error: 'Login admin belum dikonfigurasi. Isi ADMIN_USERNAME, ADMIN_PASSWORD, dan SESSION_SECRET (min. 16 karakter) di Environment Variables.' },
      { status: 500 }
    );
  }
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Origin tidak diizinkan.' }, { status: 403 });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const a = attempts.get(ip) || { n: 0, t: now };
  if (now - a.t > WINDOW) { a.n = 0; a.t = now; }
  if (a.n >= MAX) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' }, { status: 429 });
  }

  let body = {};
  try { body = await req.json(); } catch { /* body kosong */ }
  const okUser = safeEqual(body.username ?? '', process.env.ADMIN_USERNAME);
  const okPass = safeEqual(body.password ?? '', process.env.ADMIN_PASSWORD);

  if (!(okUser && okPass)) {
    a.n += 1;
    attempts.set(ip, a);
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: 'Username atau password salah.' }, { status: 401 });
  }

  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, sign({ u: 'admin', iat: now, exp: now + sessionTtlMs() }), cookieOptions());
  return res;
}
