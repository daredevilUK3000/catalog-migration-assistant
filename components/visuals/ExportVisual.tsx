"use client";

import { useInView } from "@/lib/useInView";

export default function ExportVisual() {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);
  const targets = ["Ditto", "TuneCore", "CD Baby", "LANDR"];

  return (
    <div ref={ref} className="w-full max-w-md mx-auto">
      <div className="flex items-center gap-3">
        {/* Master reel */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="h-16 w-16 rounded-full border-4 border-brass flex items-center justify-center bg-ink">
            <div className="h-4 w-4 rounded-full bg-brass-bright" />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-ink/60">
            Master
          </span>
        </div>

        {/* Connecting lines */}
        <svg
          className="flex-1 h-24 min-w-[60px]"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {targets.map((_, i) => {
            const y = 12 + i * 26;
            return (
              <path
                key={i}
                d={`M 0 50 L 100 ${y}`}
                stroke="var(--brass)"
                strokeOpacity="0.4"
                strokeWidth="2"
                fill="none"
                strokeDasharray="140"
                strokeDashoffset={inView ? 0 : 140}
                style={{
                  transition: `stroke-dashoffset 0.8s ease ${i * 0.12}s`,
                }}
              />
            );
          })}
        </svg>

        {/* Target chips */}
        <div className="flex flex-col gap-2 shrink-0">
          {targets.map((t, i) => (
            <div
              key={t}
              className="rounded border border-ink/15 bg-white px-3 py-1 text-xs font-medium shadow-sm transition-all duration-500"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateX(0)" : "translateX(8px)",
                transitionDelay: `${300 + i * 130}ms`,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
