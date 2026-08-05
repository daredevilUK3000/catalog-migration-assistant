"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BuyButton from "./BuyButton";

const CLIPS = Array.from(
  { length: 12 },
  (_, i) => `/billing-videos/clip-${String(i + 1).padStart(2, "0")}.mp4`
);

const CLIP_DURATION_MS = 6000;

export default function BillingHero({
  isPremium,
  productName,
  priceLabel,
  purchasedAtLabel,
  success,
  canceled,
}: {
  isPremium: boolean;
  productName: string;
  priceLabel: string;
  // Pre-formatted server-side with a fixed locale, not a raw Date/ISO
  // string — formatting it here with toLocaleDateString() would run again
  // on the client during hydration using the browser's locale, which can
  // disagree with the server's and throw a hydration mismatch.
  purchasedAtLabel: string | null;
  success: boolean;
  canceled: boolean;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % CLIPS.length);
    }, CLIP_DURATION_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative min-h-[560px] w-full overflow-hidden bg-ink-deep sm:h-[70dvh] sm:min-h-[460px] sm:max-h-[720px]">
      {/* Cross-fading video layers — same pattern as the homepage Hero */}
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

      {/* Overlay gradient for legibility — a touch heavier than the homepage
          hero since this page needs the price/CTA to read clearly, not just
          a headline. */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-deep via-ink-deep/75 to-ink-deep/55" />
      <div className="absolute inset-0 bg-ink-deep/35" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 py-20 text-center">
        {canceled && !isPremium && (
          <p className="mb-6 inline-block rounded-full border border-paper/20 bg-paper/5 px-4 py-1.5 text-sm text-paper/70">
            Checkout canceled — no charge was made.
          </p>
        )}
        {success && isPremium && (
          <p className="mb-6 inline-block rounded-full border border-brass/40 bg-brass/10 px-4 py-1.5 text-sm text-brass-bright">
            Thanks — your purchase is confirmed.
          </p>
        )}

        {/* The live Stripe product name is already "Own Your Music — Full
            Access" — don't append a suffix here or it duplicates. */}
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-brass-bright sm:text-sm">
          {productName}
        </p>

        {isPremium ? (
          <>
            <h1 className="font-display text-4xl font-bold leading-[1.05] text-paper sm:text-6xl">
              You own it. All of it.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-paper/75 sm:text-lg">
              Export Pack generation, Migration Report PDFs, and full catalog health scoring are
              permanently unlocked on this account — for every album you add, now or later.
            </p>
            {purchasedAtLabel && (
              <p className="mt-3 font-mono text-xs text-paper/40">Purchased {purchasedAtLabel}</p>
            )}
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/health"
                className="focus-ring rounded-md bg-brass px-6 py-3 text-sm font-semibold text-ink-deep transition-colors hover:bg-brass-bright"
              >
                Go to Catalog health
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl font-bold leading-[1.05] text-paper sm:text-6xl">
              Own your entire catalog.
              <br className="hidden sm:block" />
              Forever.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-paper/75 sm:text-lg">
              One payment unlocks every export, every report, every insight — for every album you
              ever add. No subscription, no recurring charge, no per-album fee.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3">
              <BuyButton priceLabel={priceLabel} className="px-8 py-4 text-base" />
              <p className="font-mono text-xs text-paper/40">
                Secure checkout via Stripe · 14-day refund guarantee
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
