"use client";

import { useMemo, useState } from "react";
import { useInView } from "@/lib/useInView";

interface Segment {
  label: string;
  value: string;
  valid: boolean;
  hint: string;
}

function analyze(raw: string): { valid: boolean; segments: Segment[] } {
  const cleaned = raw.toUpperCase().replace(/[-\s]/g, "");
  const country = cleaned.slice(0, 2);
  const registrant = cleaned.slice(2, 5);
  const year = cleaned.slice(5, 7);
  const designation = cleaned.slice(7, 12);

  const segments: Segment[] = [
    {
      label: "Country",
      value: country,
      valid: /^[A-Z]{2}$/.test(country),
      hint: "2 letters",
    },
    {
      label: "Registrant",
      value: registrant,
      valid: /^[A-Z0-9]{3}$/.test(registrant),
      hint: "3 letters/digits",
    },
    {
      label: "Year",
      value: year,
      valid: /^\d{2}$/.test(year),
      hint: "2 digits",
    },
    {
      label: "Designation",
      value: designation,
      valid: /^\d{5}$/.test(designation),
      hint: "5 digits",
    },
  ];

  const valid = cleaned.length === 12 && segments.every((s) => s.valid);
  return { valid, segments };
}

export default function IsrcCheckerDemo() {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  const [value, setValue] = useState("QT6FJ2681571");
  const result = useMemo(() => analyze(value), [value]);
  const hasInput = value.trim().length > 0;

  return (
    <section className="bg-paper text-ink relative overflow-hidden">
      <div
        ref={ref}
        className={`reveal ${inView ? "in-view" : ""} mx-auto max-w-3xl px-6 py-20 md:py-28`}
      >
        <p className="text-xs uppercase tracking-[0.25em] font-mono opacity-60 mb-3 text-center">
          Try it yourself
        </p>
        <h2 className="font-display text-3xl md:text-4xl font-semibold text-center leading-tight">
          This is the one field a wrong character can cost you years of streams.
        </h2>
        <p className="mt-3 text-center text-sm opacity-60 max-w-lg mx-auto">
          Type an ISRC below and see exactly how the health check reads it —
          the same validation every import runs automatically.
        </p>

        <div className="mt-10 rounded-lg border border-ink/10 bg-white shadow-sm p-6 md:p-8">
          <label className="block text-xs uppercase tracking-wider font-mono opacity-50 mb-2">
            ISRC
          </label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. QT6FJ2681571"
            spellCheck={false}
            className="focus-ring w-full rounded-md border border-ink/15 bg-paper/40 px-4 py-3 font-mono text-lg tracking-wider uppercase outline-none"
          />

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {result.segments.map((s) => (
              <div
                key={s.label}
                className={`rounded-md border px-3 py-2 text-center transition-colors ${
                  !hasInput
                    ? "border-ink/10 bg-ink/[0.02]"
                    : s.valid
                    ? "border-brass/40 bg-brass/10"
                    : "border-rust/40 bg-rust/10"
                }`}
              >
                <div className="font-mono text-sm font-semibold min-h-[1.25rem]">
                  {s.value || "—"}
                </div>
                <div className="text-[10px] uppercase tracking-wide opacity-50 mt-1">
                  {s.label}
                </div>
                <div className="text-[10px] opacity-40">{s.hint}</div>
              </div>
            ))}
          </div>

          <div
            className={`mt-6 flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium ${
              !hasInput
                ? "bg-ink/[0.04] text-ink/50"
                : result.valid
                ? "bg-brass/15 text-ink"
                : "bg-rust/10 text-rust"
            }`}
          >
            <span>{!hasInput ? "—" : result.valid ? "✓" : "⚠"}</span>
            {!hasInput
              ? "Type or paste an ISRC to check it."
              : result.valid
              ? "Valid ISRC format — safe to migrate."
              : "Not a valid ISRC — this is exactly what the health check would flag before you ever upload it."}
          </div>
        </div>
      </div>
    </section>
  );
}
