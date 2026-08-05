"use client";

import { useState } from "react";
import Link from "next/link";
import LogoMark from "./LogoMark";
import SignOutButton from "./SignOutButton";

const NAV_LINKS = [
  { href: "/import", label: "Import" },
  { href: "/health", label: "Catalog health" },
  { href: "/migrations", label: "Migration tracker" },
  { href: "/billing", label: "Billing" },
] as const;

export default function NavBar({ userEmail }: { userEmail: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-paper/10 bg-ink-deep/90 backdrop-blur-sm px-4 sm:px-6 py-4 sm:py-6">
      <div className="mx-auto flex max-w-6xl items-center gap-4 sm:gap-8">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex min-w-0 items-center gap-2 sm:gap-4 font-display font-bold text-paper tracking-wide text-xl sm:text-3xl lg:text-6xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <LogoMark className="h-9 w-9 shrink-0 sm:h-14 sm:w-14 lg:h-32 lg:w-32" />
          <span className="truncate">OwnYourMusic</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="focus-ring text-sm font-medium text-paper/70 transition-colors hover:text-brass-bright"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto hidden items-center gap-4 md:flex">
          {userEmail ? (
            <>
              <span className="text-sm text-paper/60">{userEmail}</span>
              <SignOutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="focus-ring text-sm font-medium text-paper/70 transition-colors hover:text-brass-bright"
            >
              Sign in
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls="mobile-nav-panel"
          aria-label={open ? "Close menu" : "Open menu"}
          className="focus-ring ml-auto p-2 text-paper md:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div id="mobile-nav-panel" className="mx-auto flex max-w-6xl flex-col gap-4 pt-4 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="focus-ring text-base font-medium text-paper/80 transition-colors hover:text-brass-bright"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-4 border-t border-paper/10 pt-4">
            {userEmail ? (
              <>
                <span className="truncate text-sm text-paper/60">{userEmail}</span>
                <SignOutButton />
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="focus-ring text-sm font-medium text-paper/70 transition-colors hover:text-brass-bright"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
