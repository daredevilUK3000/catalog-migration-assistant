"use client";

import { useInView } from "@/lib/useInView";
import { TapePerforation } from "@/components/BackgroundShapes";

const PROMISES = [
  {
    title: "Secure checkout via Stripe",
    body: "Payment is handled entirely by Stripe on their own hosted page — your card details never touch our servers.",
  },
  {
    title: "14-day refund guarantee",
    body: "If it doesn't work as advertised, you get your money back. No subscription tricks, no retention flow — see the Terms of Service.",
  },
  {
    title: "One payment. Yours forever.",
    body: "No recurring charge, no expiry, no per-album fee. Every album you add later is covered by the same purchase.",
  },
];

export default function BillingTrust() {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);

  return (
    <section className="relative bg-ink text-paper overflow-hidden">
      <TapePerforation className="absolute top-0 left-0 w-full h-6 text-paper" />
      <div
        ref={ref}
        className={`reveal ${inView ? "in-view" : ""} mx-auto max-w-6xl px-6 py-24`}
      >
        <p className="text-xs uppercase tracking-[0.25em] font-mono text-brass-bright mb-4 text-center">
          Why trust this purchase
        </p>
        <h2 className="font-display text-3xl md:text-5xl font-semibold text-center max-w-2xl mx-auto leading-tight">
          You&rsquo;re not just buying software — you&rsquo;re buying peace of mind.
        </h2>

        <div className="mt-16 grid md:grid-cols-3 gap-8">
          {PROMISES.map((p) => (
            <div
              key={p.title}
              className="rounded-lg border border-paper/12 bg-ink-deep/40 p-6"
            >
              <h3 className="font-display text-xl font-semibold mb-2 text-brass-bright">
                {p.title}
              </h3>
              <p className="text-sm leading-relaxed opacity-75">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
      <TapePerforation className="absolute bottom-0 left-0 w-full h-6 text-paper rotate-180" />
    </section>
  );
}
