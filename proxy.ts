import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The icons and manifest carry nothing private, and iOS needs them reachable
// to add the app to the home screen.
const PUBLIC_PATHS = [
  "/login",
  "/api/login",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
];

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const expected = process.env.SITE_PASSWORD;
  if (!expected) {
    // No password configured: leave the site open.
    return NextResponse.next();
  }

  const cookie = req.cookies.get("ltb_session")?.value;
  if (cookie === expected) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
