"use client";

import { useEffect, useState } from "react";
import TapeCounter from "./TapeCounter";

const CLIPS = Array.from(
  { length: 9 },
  (_, i) => `/hero-videos/clip-${String(i + 1).padStart(2, "0")}.mp4`
);

const CLIP_DURATION_MS = 7000;
const FACT_DURATION_MS = 6000;

// Rotating fact pairs for the tape-counter strip. The "0 logins shared"
// stat stays fixed as a permanent brand promise — only these two slots
// rotate. Sources noted for the real-world figures since they're public
// claims: Spotify Newsroom Q1 2026 earnings release (co-CEO Gustav
// Söderström), and the widely-cited under-1,000-streams figure.
const FACTS: { a: { value: number; label: string; digits: number }; b: { value: number; label: string; digits: number } }[] = [
  {
    a: { value: 31, label: "Albums in this catalog", digits: 2 },
    b: { value: 742, label: "Songs in this catalog", digits: 3 },
  },
  {
    a: { value: 60000, label: "New songs added worldwide, daily", digits: 5 },
    b: { value: 250, label: "Million tracks on Spotify alone", digits: 3 },
  },
  {
    a: { value: 87, label: "% of songs with under 1,000 streams", digits: 2 },
    b: { value: 1, label: "Wrong ISRC digit needed to join them", digits: 1 },
  },
];

export default function Hero() {
  const [active, setActive] = useState(0);
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % CLIPS.length);
    }, CLIP_DURATION_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % FACTS.length);
    }, FACT_DURATION_MS);
    return () => clearInterval(id);
  }, []);

  const fact = FACTS[factIndex];

  return (
    <section className="relative h-[70dvh] min-h-[420px] max-h-[640px] sm:max-h-[720px] lg:h-[92dvh] lg:max-h-none w-full overflow-hidden bg-ink-deep">
      {/* Cross-fading video layers */}
      {CLIPS.map((src, i) => (
        <video
          key={src}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1500ms] ease-in-out ${
            i === active ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* Overlay gradient for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-deep via-ink-deep/50 to-ink-deep/30" />
      <div className="absolute inset-0 bg-ink-deep/25" />

      {/* Headline content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
        <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-brass-bright font-mono mb-4">
          Catalog Migration Assistant
        </p>
        <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold text-paper leading-[1.05] max-w-4xl">
          Own your catalog.
          <br />
          Switch distributors in hours, not weeks.
        </h1>
        <p className="mt-6 max-w-xl text-paper/75 text-base sm:text-lg">
          Import from any distributor, validate your metadata, and generate what
          the next one needs — without ever handing over a login.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/import"
            className="focus-ring rounded-md bg-brass px-6 py-3 text-sm font-semibold text-ink-deep hover:bg-brass-bright transition-colors"
          >
            Import a release
          </a>
          <a
            href="/health"
            className="focus-ring rounded-md border border-paper/30 px-6 py-3 text-sm font-semibold text-paper hover:bg-paper/10 transition-colors"
          >
            Catalog health
          </a>
        </div>
      </div>

      {/* Tape-counter stat strip */}
      <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-paper/10 bg-ink-deep/70 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-6 py-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          <div key={factIndex} className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 fact-fade-in">
            <TapeCounter value={fact.a.value} label={fact.a.label} digits={fact.a.digits} />
            <TapeCounter value={fact.b.value} label={fact.b.label} digits={fact.b.digits} />
          </div>
          <TapeCounter value={0} label="Logins shared" digits={1} />
        </div>
        <p className="text-center text-[10px] text-paper/30 pb-2 font-mono">
          Global figures: Spotify, Q1 2026
        </p>
      </div>
    </section>
  );
}
