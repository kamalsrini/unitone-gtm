import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Auth is "configured" only once Google credentials are present in the environment.
// Until then the app stays fully public (unchanged) so deploying this never breaks it.
const configured = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? "unitone-gtm-placeholder-set-AUTH_SECRET-in-vercel",
  providers: configured ? [Google] : [],
  pages: { signIn: "/signin" },
  callbacks: {
    authorized({ auth }) {
      // Phase 1: anyone who signs in with Google gets full access.
      // Phase 2 (per-user) hooks in here later, e.g. allowlist auth?.user?.email.
      if (!configured) return true; // not set up yet -> app stays public
      return !!auth?.user;
    },
  },
});

export const authConfigured = configured;
