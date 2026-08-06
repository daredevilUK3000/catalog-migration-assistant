"use client";

import { useState } from "react";
import Link from "next/link";
import LogoMark from "./LogoMark";
import SignOutButton from "./SignOutButton";

const NAV_LINKS = [
  { href: "/import", label: "Import" },
  { href: "/health", label: "Catalog health" },
  { href: "/albums/export-all", label: "Export packs" },
  { href: "/migrations", label: "Migration tracker" },
  { href: "/billing", label: "Billing" },
] as const;

export default function NavBar({
  userEmail,
  isPremium = false,
}: {
  userEmail: string | null;
  isPremium?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Only ever shown alongside userEmail below (i.e. already known signed in)
  // — no separate "signed in" check needed here.
  const premiumChip = isPremium ? (
    <span className="rounded-full bg-brass/20 px-2.5 py-1 text-xs font-semibold text-brass-bright">
      ✓ Premium
    </span>
  ) : (
    <Link
      href="/billing"
      className="focus-ring rounded-full bg-brass px-2.5 py-1 text-xs font-semibold text-ink-deep transition-colors hover:bg-brass-bright"
    >
      Upgrade
    </Link>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-paper/10 bg-ink-deep/90 backdrop-blur-sm px-4 sm:px-6 py-4 sm:py-6">
      <div className="mx-auto flex max-w-6xl items-center gap-4 sm:gap-8">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3 font-display font-bold text-paper tracking-wide text-xl sm:text-2xl lg:text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <LogoMark className="h-9 w-9 shrink-0 sm:h-11 sm:w-11 lg:h-12 lg:w-12" />
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
              {premiumChip}
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
                {premiumChip}
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
