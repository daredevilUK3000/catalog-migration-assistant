"use client";

import { useInView } from "@/lib/useInView";

export default function TrackerVisual() {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);
  const stages = ["Imported", "Files", "Health", "Packed", "Uploaded", "Verified"];
  const activeIndex = 4;

  return (
    <div ref={ref} className="w-full max-w-md mx-auto">
      <div className="relative pt-2">
        {/* Rail */}
        <div className="absolute left-0 right-0 top-[26px] h-[3px] bg-ink/10 rounded-full" />
        <div
          className="absolute left-0 top-[26px] h-[3px] bg-brass rounded-full transition-all duration-1000 ease-out"
          style={{
            width: inView ? `${(activeIndex / (stages.length - 1)) * 100}%` : "0%",
          }}
        />

        <div className="relative flex justify-between">
          {stages.map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-2 w-full">
              <div
                className={`h-[26px] w-[26px] rounded-full border-2 flex items-center justify-center text-[10px] font-mono transition-all duration-500 ${
                  i <= activeIndex
                    ? "bg-brass border-brass text-ink-deep"
                    : "bg-white border-ink/15 text-ink/30"
                }`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {i <= activeIndex ? "●" : ""}
              </div>
              <span
                className={`text-[10px] text-center leading-tight ${
                  i <= activeIndex ? "text-ink" : "text-ink/40"
                }`}
              >
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
