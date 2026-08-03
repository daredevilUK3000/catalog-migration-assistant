import type { Metadata } from "next";
import { Big_Shoulders, Inter, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const bigShoulders = Big_Shoulders({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Catalog Migration Assistant",
  description: "Own your catalog. Switch distributors in hours, not weeks.",
};

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/import", label: "Import" },
  { href: "/health", label: "Catalog health" },
  { href: "/migrations", label: "Migration tracker" },
] as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bigShoulders.variable} ${inter.variable} ${plexMono.variable}`}
    >
      <body className="font-sans" style={{ fontFamily: "var(--font-body)" }}>
        <nav className="sticky top-0 z-50 border-b border-[var(--paper)]/10 bg-[var(--ink-deep)]/90 backdrop-blur-sm px-6 py-3">
          <div className="mx-auto flex max-w-6xl items-center gap-8">
            <Link
              href="/"
              className="font-display font-bold text-[var(--paper)] tracking-wide"
              style={{ fontFamily: "var(--font-display)" }}
            >
              CMA
            </Link>
            <div className="flex items-center gap-6">
              {NAV_LINKS.slice(1).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="focus-ring text-sm font-medium text-[var(--paper)]/70 hover:text-[var(--brass-bright)] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
