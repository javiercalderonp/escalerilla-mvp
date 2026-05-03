import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const session = req.auth;
  const { pathname } = req.nextUrl;

  const isLoggedIn = !!session?.user;
  const isAdmin = session?.user?.role === "admin";

  if (pathname.startsWith("/admin")) {
    if (!isAdmin) {
      return Response.redirect(new URL("/", req.nextUrl));
    }
    return;
  }

  const playerRoutes = ["/mi-perfil", "/disponibilidad"];
  if (playerRoutes.some((r) => pathname.startsWith(r))) {
    if (!isLoggedIn) {
      return Response.redirect(new URL("/login", req.nextUrl));
    }
    return;
  }

  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
    if (!isLoggedIn) {
      return Response.redirect(new URL("/login", req.nextUrl));
    }
    return;
  }
});

export const config = {
  matcher: [
    "/mi-perfil/:path*",
    "/disponibilidad/:path*",
    "/admin/:path*",
    "/onboarding",
    "/onboarding/:path*",
  ],
};
