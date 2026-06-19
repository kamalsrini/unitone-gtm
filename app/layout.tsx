import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "UnitOne GTM Engine",
  description: "Signal-based outbound GTM — 5-layer pipeline, live monitoring.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-line bg-ink/70 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent2 font-bold text-white">U1</span>
              <span className="font-semibold tracking-tight">UnitOne <span className="text-muted">GTM Engine</span></span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-muted hover:text-white">Dashboard</Link>
              <Link href="/architecture" className="rounded-lg px-3 py-1.5 text-muted hover:text-white">Architecture</Link>
              <Link href="/campaigns/new" className="btn-primary ml-1">+ New Campaign</Link>
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
