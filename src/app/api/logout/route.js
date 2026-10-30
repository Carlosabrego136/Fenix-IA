import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/token';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
