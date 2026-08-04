import type { Metadata } from "next";
import { Big_Shoulders, Inter, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import LogoMark from "@/components/LogoMark";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
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
  title: "OwnYourMusic",
  description: "Own your catalog. Switch distributors in hours, not weeks.",
};

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/import", label: "Import" },
  { href: "/health", label: "Catalog health" },
  { href: "/migrations", label: "Migration tracker" },
] as const;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Real session only — DEV_USER_ID is a silent local-dev fallback baked
  // into data access (lib/auth/currentUser.ts), not something the nav
  // should pretend is a logged-in user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${bigShoulders.variable} ${inter.variable} ${plexMono.variable}`}
    >
      <body className="font-sans" style={{ fontFamily: "var(--font-body)" }}>
        <nav className="sticky top-0 z-50 border-b border-paper/10 bg-ink-deep/90 backdrop-blur-sm px-6 py-6">
          <div className="mx-auto flex max-w-6xl items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-4 font-display font-bold text-paper tracking-wide text-6xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <LogoMark size={128} />
              OwnYourMusic
            </Link>
            <div className="flex items-center gap-6">
              {NAV_LINKS.slice(1).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="focus-ring text-sm font-medium text-paper/70 hover:text-brass-bright transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-4">
              {user ? (
                <>
                  <span className="text-sm text-paper/60">{user.email}</span>
                  <SignOutButton />
                </>
              ) : (
                <Link
                  href="/login"
                  className="focus-ring text-sm font-medium text-paper/70 hover:text-brass-bright transition-colors"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
