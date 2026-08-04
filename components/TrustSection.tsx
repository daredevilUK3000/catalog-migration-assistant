"use client";

import { useInView } from "@/lib/useInView";
import { TapePerforation } from "./BackgroundShapes";

const PROMISES = [
  {
    title: "Never logs into your distributor",
    body: "Every upload happens by your own hand, on the distributor's own site. Nothing here automates a login or a submission.",
  },
  {
    title: "You confirm every extraction",
    body: "Nothing is saved to your catalog until you've checked it against the source — especially ISRCs, where one wrong character breaks stream history.",
  },
  {
    title: "Your catalog, permanently",
    body: "Once imported, your catalog is portable, structured data you own — independent of any distributor or AI service.",
  },
  {
    title: "Your masters never leave your computer",
    body: "Your master audio files stay on your own computer. We verify they exist and are correctly matched to your catalog — we just never store or upload them ourselves.",
  },
];

export default function TrustSection() {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);

  return (
    <section className="relative bg-[var(--ink)] text-[var(--paper)] overflow-hidden">
      <TapePerforation className="absolute top-0 left-0 w-full h-6 text-[var(--paper)]" />
      <div
        ref={ref}
        className={`reveal ${inView ? "in-view" : ""} mx-auto max-w-6xl px-6 py-24`}
      >
        <p className="text-xs uppercase tracking-[0.25em] font-mono text-[var(--brass-bright)] mb-4 text-center">
          Human in the loop, always
        </p>
        <h2 className="font-display text-3xl md:text-5xl font-semibold text-center max-w-2xl mx-auto leading-tight">
          You stay in control of every account, every step.
        </h2>

        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {PROMISES.map((p) => (
            <div
              key={p.title}
              className="rounded-lg border border-[var(--paper)]/12 bg-[var(--ink-deep)]/40 p-6"
            >
              <h3 className="font-display text-xl font-semibold mb-2 text-[var(--brass-bright)]">
                {p.title}
              </h3>
              <p className="text-sm leading-relaxed opacity-75">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
      <TapePerforation className="absolute bottom-0 left-0 w-full h-6 text-[var(--paper)] rotate-180" />
    </section>
  );
}
