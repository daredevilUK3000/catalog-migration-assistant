"use client";

import { useInView } from "@/lib/useInView";

export default function ImportVisual() {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);

  return (
    <div ref={ref} className="relative w-full max-w-md mx-auto">
      <div className="relative rounded-lg border border-[var(--ink)]/15 bg-white shadow-lg overflow-hidden">
        {/* Fake screenshot */}
        <div className="p-4 space-y-2">
          <div className="h-3 w-2/3 bg-[var(--ink)]/10 rounded" />
          <div className="h-2 w-1/3 bg-[var(--ink)]/10 rounded" />
          <div className="mt-3 space-y-1.5">
            {["A happy sad song", "A thousand songs", "Beautiful Day", "Buena Onda"].map(
              (t) => (
                <div key={t} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[var(--ink)]/10" />
                  <div className="h-2 flex-1 bg-[var(--ink)]/10 rounded" />
                  <div className="h-2 w-16 bg-[var(--ink)]/10 rounded font-mono" />
                </div>
              )
            )}
          </div>
        </div>
        {/* Scan line */}
        <div
          className={`absolute left-0 right-0 h-8 bg-gradient-to-b from-transparent via-[var(--brass-bright)]/40 to-transparent ${
            inView ? "animate-[scan_2.4s_ease-in-out_1]" : ""
          }`}
          style={{ top: inView ? undefined : "-2rem" }}
        />
      </div>

      {/* Structured output rows resolving below */}
      <div
        className={`mt-4 rounded-lg border border-[var(--brass)]/30 bg-[var(--ink-deep)] p-3 font-mono text-xs text-[var(--brass-bright)] transition-all duration-700 delay-[1400ms] ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        <div>{'{ "title": "A happy sad song",'}</div>
        <div className="pl-4">{'"isrc": "QT6FJ2681571" }'}</div>
      </div>

      <style jsx>{`
        @keyframes scan {
          0% {
            top: -2rem;
          }
          100% {
            top: 100%;
          }
        }
      `}</style>
    </div>
  );
}
