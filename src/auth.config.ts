import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Edge-safe Auth.js config. Contains NO database or Node-only deps so it can be
 * imported by middleware (which runs on the edge runtime). The Credentials
 * provider with its bcrypt/Prisma `authorize` lives in `auth.ts`.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    // Route protection for middleware. Returning false redirects to signIn.
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const isProtected =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/tickets") ||
        pathname.startsWith("/admin");
      if (isProtected) return isLoggedIn;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.teamId = user.teamId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.teamId = (token.teamId as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
