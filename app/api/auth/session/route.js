import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  return NextResponse.json({ authenticated: Boolean(getSession(req)) });
}
