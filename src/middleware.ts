import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge middleware uses the DB-free config; the `authorized` callback decides
// which routes require a session.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  // The `authorized` callback in auth.config handles redirects; nothing else
  // to do here for now.
  void req;
});

export const config = {
  // Skip Next internals and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
