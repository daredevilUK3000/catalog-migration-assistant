"use client";

import { useInView } from "@/lib/useInView";

const TRACKS = [
  { title: "A happy sad song", isrc: "QT6FJ2681571" },
  { title: "A thousand songs", isrc: "QT6FJ2681572" },
  { title: "Beautiful Day", isrc: "QT6FJ2681573" },
  { title: "Buena Onda", isrc: "QT6FJ2681574" },
];

export default function ImportVisual() {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);

  return (
    <div ref={ref} className="relative w-full max-w-md mx-auto">
      <div className="relative rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
        {/* Fake screenshot with real, clearly visible content */}
        <div className="p-4">
          <div className="h-3 w-2/3 bg-gray-200 rounded mb-2" />
          <div className="h-2 w-1/3 bg-gray-200 rounded mb-3" />
          <div className="space-y-2">
            {TRACKS.map((t) => (
              <div key={t.title} className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-700 truncate">
                  {t.title}
                </span>
                <span className="text-[10px] font-mono text-gray-400 shrink-0">
                  {t.isrc}
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* Scan line */}
        <div
          className={`absolute left-0 right-0 h-8 bg-gradient-to-b from-transparent via-brass-bright/50 to-transparent ${
            inView ? "animate-[scan_2.4s_ease-in-out_1]" : ""
          }`}
          style={{ top: inView ? undefined : "-2rem" }}
        />
      </div>

      {/* Structured output rows resolving below */}
      <div
        className={`mt-4 rounded-lg border border-brass/30 bg-ink-deep p-3 font-mono text-xs text-brass-bright transition-all duration-700 delay-[1400ms] ${
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
