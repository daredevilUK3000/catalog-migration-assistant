"use client";

import { useInView } from "@/lib/useInView";

const STEPS = [
  {
    n: "01",
    title: "Import once",
    body: "Upload a screenshot, CSV, or folder from your current distributor. AI extracts titles, ISRCs, and credits — you confirm it before anything is saved.",
  },
  {
    n: "02",
    title: "Validate automatically",
    body: "Duplicate ISRCs, missing lyrics, undersized artwork — flagged by deterministic rules, not AI guesswork, before they become a rejected upload.",
  },
  {
    n: "03",
    title: "Export in their format",
    body: "Bulk import where the new distributor supports it. Where it doesn't, you're never hunting for data or retyping an ISRC by hand — just paste, paste, paste, straight down their form.",
  },
];

const OLD_WAY = [
  "Open each release page on your old distributor, one at a time",
  "Manually copy titles, ISRCs, and credits into a spreadsheet",
  "Re-type every field into the new distributor's upload form",
  "Hope you didn't mistype an ISRC and break your stream history",
];

const NEW_WAY = [
  "Screenshot each release page — no manual typing",
  "AI structures it, you confirm it once per album",
  "Get a ready-to-paste packet, formatted for your new distributor",
  "ISRCs are never re-typed by hand after the first confirm",
];

export default function HowItWorksSection() {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);

  return (
    <section className="bg-paper text-ink relative overflow-hidden">
      <div
        ref={ref}
        className={`reveal ${inView ? "in-view" : ""} mx-auto max-w-6xl px-6 py-20 md:py-28`}
      >
        <p className="text-xs uppercase tracking-[0.25em] font-mono opacity-60 mb-3 text-center">
          How switching actually works
        </p>
        <h2 className="font-display text-3xl md:text-5xl font-semibold text-center max-w-3xl mx-auto leading-tight">
          Your catalog, extracted once. Every distributor after that is just an export.
        </h2>

        {/* 3-step process — numbered because it genuinely is a sequence */}
        <div className="mt-16 grid md:grid-cols-3 gap-8">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <span className="font-mono text-5xl font-bold text-brass/30">
                {s.n}
              </span>
              <h3 className="font-display text-xl font-semibold mt-2 mb-2">
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed opacity-75 max-w-xs">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Before / after comparison */}
        <div className="mt-20 grid md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-rust/25 bg-rust/[0.04] p-6">
            <p className="text-xs uppercase tracking-[0.2em] font-mono text-rust mb-4">
              Without this tool
            </p>
            <ul className="space-y-3 text-sm leading-relaxed">
              {OLD_WAY.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-rust">–</span>
                  <span className="opacity-80">{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-brass/30 bg-brass/[0.06] p-6">
            <p className="text-xs uppercase tracking-[0.2em] font-mono text-ink mb-4">
              With Catalog Migration Assistant
            </p>
            <ul className="space-y-3 text-sm leading-relaxed">
              {NEW_WAY.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-brass font-semibold">✓</span>
                  <span className="opacity-90">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-10 text-center text-sm opacity-60 max-w-xl mx-auto">
          A 30-album, 750-song catalog takes roughly a weekend to fully capture and
          package — not weeks of manual re-entry, and never a shared login.
        </p>
      </div>
    </section>
  );
}
