import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/contact", label: "Contact" },
] as const;

export default function Footer() {
  return (
    <footer className="bg-ink-deep text-paper/60 border-t border-paper/10">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <span className="font-display text-base text-paper">
            OwnYourMusic
          </span>
          <span>Own your catalog. Switch in hours, not weeks.</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm border-t border-paper/10 pt-6">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="focus-ring text-paper/60 transition-colors hover:text-brass-bright"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
