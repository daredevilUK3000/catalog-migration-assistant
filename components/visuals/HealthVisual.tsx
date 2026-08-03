"use client";

import { useInView } from "@/lib/useInView";

export default function HealthVisual() {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);

  const rows = [
    { label: "All ISRCs valid", ok: true },
    { label: "3 tracks missing lyrics", ok: false },
    { label: "2 duplicate ISRCs", ok: false },
    { label: "Catalog ready for migration", ok: true },
  ];

  return (
    <div ref={ref} className="w-full max-w-md mx-auto">
      <div className="rounded-lg border border-[var(--paper-warm)]/20 bg-[var(--ink-deep)] p-5">
        {/* Needle gauge */}
        <div className="relative h-24 mb-4">
          <svg viewBox="0 0 200 100" className="w-full h-full">
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="var(--paper-warm)"
              strokeOpacity="0.15"
              strokeWidth="8"
            />
            <path
              d="M 20 90 A 80 80 0 0 1 100 10"
              fill="none"
              stroke="var(--brass)"
              strokeWidth="8"
            />
            <line
              x1="100"
              y1="90"
              x2="100"
              y2="25"
              stroke="var(--brass-bright)"
              strokeWidth="3"
              strokeLinecap="round"
              style={{
                transformOrigin: "100px 90px",
                transform: inView ? "rotate(28deg)" : "rotate(-55deg)",
                transition: "transform 1.1s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            />
            <circle cx="100" cy="90" r="5" fill="var(--brass-bright)" />
          </svg>
        </div>

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className="flex items-center gap-2 text-sm text-[var(--paper)] transition-all duration-500"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateX(0)" : "translateX(-8px)",
                transitionDelay: `${300 + i * 150}ms`,
              }}
            >
              <span
                className={
                  r.ok
                    ? "text-[var(--brass-bright)]"
                    : "text-[var(--rust)]"
                }
              >
                {r.ok ? "✓" : "⚠"}
              </span>
              {r.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
