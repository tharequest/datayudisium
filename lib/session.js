import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE_NAME = 'yud_admin';

const secret = () => process.env.SESSION_SECRET || '';

export function configured() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && secret().length >= 16);
}

export function sessionTtlMs() {
  return (Number(process.env.SESSION_MINUTES) || 30) * 60 * 1000;
}

// Session cookie: tanpa maxAge, jadi hilang saat browser ditutup.
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verify(token) {
  if (!token || !configured()) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret()).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p.exp || Date.now() > p.exp) return null;
    return p;
  } catch {
    return null;
  }
}

export function getSession(request) {
  return verify(request.cookies.get(COOKIE_NAME)?.value);
}

// Bandingkan dua string tanpa bocor waktu (hash dulu supaya panjang sama).
export function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // cookie SameSite=Strict sudah menahan CSRF lintas-situs
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}
