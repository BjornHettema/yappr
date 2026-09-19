import { NextResponse } from "next/server";

const COOKIE_NAME = "yappr_access";

export async function POST(req: Request) {
  const passcode = process.env.SITE_PASSCODE;
  if (!passcode) {
    return NextResponse.json({ error: "Access gate is not configured." }, { status: 500 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || code !== passcode) {
    return NextResponse.json({ error: "That code is not correct." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, passcode, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
