import { SESSION_COOKIE, verifySessionToken } from "@judilen/auth";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
    const exempt = request.nextUrl.pathname.startsWith("/api/cron/")
      || request.nextUrl.pathname.startsWith("/api/webhooks/communications/")
      || request.nextUrl.pathname === "/api/integrations/vk/callback";
    if (mutating && !exempt) {
      const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
      if (process.env.NODE_ENV === "production" && !configured) {
        return NextResponse.json({ title: "APP_URL is required", status: 500 }, { status: 500 });
      }
      const allowedOrigin = new URL(configured ?? request.nextUrl.origin).origin;
      if (request.headers.get("origin") !== allowedOrigin) {
        return NextResponse.json({ title: "Недопустимый источник запроса", status: 403 }, { status: 403 });
      }
    }
    return NextResponse.next();
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  if (!session) return NextResponse.redirect(loginUrl);
  if (request.nextUrl.pathname.startsWith("/admin") && session.role === "client") {
    return NextResponse.redirect(new URL("/cabinet/trips", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/cabinet/:path*", "/admin/:path*", "/oplata/:path*"]
};
