import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import LiveTicker from "@/components/LiveTicker";
import ConfettiLayer from "@/components/ConfettiLayer";

export const metadata: Metadata = {
  title: "WorldCup Pulse — the knockout, live",
  description:
    "Live knockout bracket, match pulse, player form and prediction reveals for the 2026 World Cup. Editorial takes, not tips.",
  openGraph: {
    title: "WorldCup Pulse",
    description: "The knockout bracket is the product. Live scores, form curves, hot takes.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A1410",
  width: "device-width",
  initialScale: 1,
};

const nav = [
  { href: "/", label: "Today" },
  { href: "/bracket", label: "Bracket" },
  { href: "/players", label: "Form" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Fonts load at runtime so builds never depend on font CDN access;
            stacks in globals.css degrade gracefully. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..900&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-40 glass">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="display text-lg font-black tracking-tight">
              <span className="text-signal">WORLDCUP</span>{" "}
              <span className="text-flood">PULSE</span>
            </Link>
            <nav className="flex items-center gap-1">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-full px-4 py-2.5 text-sm font-medium text-flood-dim transition-colors hover:bg-pitch-800 hover:text-flood"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        {/* bottom padding clears the thumb-reachable ticker on mobile */}
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 pb-32 pt-8 text-xs text-flood-dim/60">
          <p>
            Editorial context only. Market percentages describe what the odds imply — they are
            takes, not tips. No betting partners, no CTAs.
          </p>
        </footer>

        <LiveTicker />
        <ConfettiLayer />
      </body>
    </html>
  );
}
