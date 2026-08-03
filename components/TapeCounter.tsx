"use client";

import { useEffect, useState } from "react";
import { useInView } from "@/lib/useInView";

interface TapeCounterProps {
  value: number;
  label: string;
  digits?: number;
}

/**
 * Renders a value as individual mechanical-counter digits (like an analog
 * reel-to-reel tape deck's footage counter), counting up from zero the
 * first time it scrolls into view.
 */
export default function TapeCounter({ value, label, digits }: TapeCounterProps) {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  const [display, setDisplay] = useState(0);

  const padded = String(value).padStart(digits ?? String(value).length, "0");

  useEffect(() => {
    if (!inView) return;
    const duration = 900;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [inView, value]);

  const displayPadded = String(display).padStart(digits ?? String(value).length, "0");

  return (
    <div ref={ref} className="flex flex-col items-center gap-2">
      <div className="flex gap-1" aria-hidden="true">
        {displayPadded.split("").map((d, i) => (
          <span
            key={i}
            className="tape-digit text-2xl sm:text-3xl font-mono font-semibold px-2 py-1"
          >
            {d}
          </span>
        ))}
      </div>
      <span className="sr-only">{value}</span>
      <span className="text-xs uppercase tracking-[0.2em] text-[var(--paper-warm)]/70 font-medium">
        {label}
      </span>
    </div>
  );
}
