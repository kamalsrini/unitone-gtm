import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { auth, signOut } from "@/auth";

export const metadata: Metadata = {
  title: "UnitOne GTM Engine",
  description: "Signal-based outbound GTM — 5-layer pipeline, live monitoring.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-line bg-ink/70 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://unitone.ai/images/unitone-icon.png" alt="UnitOne" className="h-8 w-auto" />
              <span className="text-lg font-semibold tracking-tight text-white">UnitOne <span className="font-normal text-muted">GTM Engine</span></span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-muted hover:text-white">Dashboard</Link>
              <Link href="/architecture" className="rounded-lg px-3 py-1.5 text-muted hover:text-white">Architecture</Link>
              <Link href="/campaigns/new" className="btn-primary ml-1">+ New Campaign</Link>
              {session?.user && (
                <form action={async () => { "use server"; await signOut({ redirectTo: "/signin" }); }} className="ml-2 flex items-center gap-2">
                  <span className="hidden text-xs text-muted lg:inline">{session.user.email}</span>
                  <button type="submit" className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-white">Sign out</button>
                </form>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-7">{children}</main>
        <footer className="mx-auto max-w-7xl px-5 py-8 text-xs text-muted/70">
          UnitOne GTM Engine · 5-layer signal-based outbound · deployed on Vercel
        </footer>
      </body>
    </html>
  );
}
