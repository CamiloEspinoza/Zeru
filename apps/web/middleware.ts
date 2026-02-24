import { NextRequest, NextResponse } from "next/server";

// Routes accessible without authentication
const PUBLIC_ROUTES = ["/login", "/register", "/"];
// Auth-only routes that should redirect to dashboard when logged in
const AUTH_ONLY_ROUTES = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;
  const isPublic = PUBLIC_ROUTES.some((r) =>
    r === "/" ? pathname === "/" : pathname.startsWith(r)
  );
  const isAuthOnly = AUTH_ONLY_ROUTES.some((r) => pathname.startsWith(r));

  if (!token && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?redirect=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from login/register, but allow them to view the landing page
  if (token && isAuthOnly) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/dashboard";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp|.*\\.ico).*)",
  ],
};
