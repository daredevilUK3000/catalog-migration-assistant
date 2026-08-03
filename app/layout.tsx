import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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
    <html lang="en">
      <body>
        <nav className="border-b border-neutral-200 bg-white px-6 py-3">
          <div className="mx-auto flex max-w-5xl items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
