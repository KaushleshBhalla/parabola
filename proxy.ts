import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "parabola_session";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
