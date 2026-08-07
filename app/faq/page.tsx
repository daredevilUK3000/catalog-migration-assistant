import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/ui/Card";
import FaqAccordion from "@/components/FaqAccordion";
import { VinylRings, WaveformLine } from "@/components/BackgroundShapes";

export const metadata: Metadata = {
  title: "FAQ — OwnYourMusic",
  description: "Answers to what OwnYourMusic does, what it never does, and how migrating your catalog actually works.",
};

const LINK_BUTTON_PRIMARY =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-colors bg-brass text-ink-deep hover:bg-brass-bright";

export default function FaqPage() {
  return (
    <main>
      <section className="relative overflow-hidden bg-ink text-paper">
        <VinylRings className="ambient-spin pointer-events-none absolute -top-24 -right-24 w-[420px] h-[420px] text-paper" />
        <WaveformLine className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-20 text-paper" />
        <div className="relative mx-auto max-w-4xl px-6 py-20 md:py-28 text-center">
          <p className="mb-4 text-xs uppercase tracking-[0.25em] font-mono text-brass-bright">
            Frequently asked
          </p>
          <h1 className="font-display text-4xl md:text-6xl font-semibold leading-tight">
            Predictable questions, straight answers.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base md:text-lg text-paper/70">
            No guessing here — every answer below reflects what OwnYourMusic actually does today,
            grounded in the same Terms, Privacy Policy, and product docs the app itself runs on.
          </p>
        </div>
      </section>

      <section className="bg-paper px-6 py-16 md:py-20">
        <div className="mx-auto max-w-3xl">
          <FaqAccordion />
        </div>
      </section>

      <section className="bg-paper px-6 pb-20">
        <div className="mx-auto max-w-3xl">
          <Card className="space-y-4 p-8 text-center sm:p-10">
            <p className="font-display text-xl font-semibold text-ink sm:text-2xl">
              Still have a question?
            </p>
            <p className="text-ink/60">
              Walk through the whole pipeline step by step, or reach out directly — either way,
              you&rsquo;ll get an answer, not a guess.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              <Link href="/getting-started" className={LINK_BUTTON_PRIMARY}>
                Read Getting Started
              </Link>
              <Link
                href="/contact"
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-ink/20 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brass hover:text-brass"
              >
                Contact support
              </Link>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
