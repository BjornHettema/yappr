import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "yappr_access";

/**
 * Lightweight early-access gate. This is NOT real authentication — it's a
 * shared passcode to keep the public URL from being spammed by strangers
 * while OPENAI_API_KEY is footing the bill for every call. Set
 * SITE_PASSCODE in the deployment's environment to turn it on; leaving it
 * unset (e.g. local dev) disables the gate entirely.
 */
export function middleware(request: NextRequest) {
  const passcode = process.env.SITE_PASSCODE;
  if (!passcode) {
    return NextResponse.next();
  }

  if (request.cookies.get(COOKIE_NAME)?.value === passcode) {
    return NextResponse.next();
  }

  const next = request.nextUrl.pathname + request.nextUrl.search;
  const url = request.nextUrl.clone();
  url.pathname = "/enter";
  url.search = "";
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|enter|api/access).*)"],
};
