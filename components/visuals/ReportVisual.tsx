"use client";

import { useInView } from "@/lib/useInView";

export default function ReportVisual() {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);

  const rows = [
    "12 albums, 148 tracks",
    "3 open issues flagged",
    "Confidence score: 91%",
    "Ready to hand to your next distributor",
  ];

  return (
    <div ref={ref} className="w-full max-w-md mx-auto">
      <div className="relative">
        {/* Stacked pages behind the top sheet */}
        <div className="absolute -right-2 -top-2 h-full w-full rounded-lg bg-paper-warm/50 rotate-2" />
        <div className="absolute -right-1 -top-1 h-full w-full rounded-lg bg-paper-warm/80 rotate-1" />
        <div className="relative rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-ink/40">
              Migration Report
            </span>
            <span className="rounded bg-rust/10 px-1.5 py-0.5 text-[10px] font-mono text-rust">
              PDF
            </span>
          </div>
          <div className="space-y-2.5">
            {rows.map((r, i) => (
              <div
                key={r}
                className="flex items-center gap-2 text-sm text-ink/80 transition-all duration-500"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? "translateX(0)" : "translateX(-8px)",
                  transitionDelay: `${300 + i * 150}ms`,
                }}
              >
                <span className="text-brass">✓</span>
                {r}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
