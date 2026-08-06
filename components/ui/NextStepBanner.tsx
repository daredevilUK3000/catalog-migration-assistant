import Link from "next/link";
import { TOTAL_WORKFLOW_STEPS } from "@/lib/workflowSteps";

interface NextStepBannerProps {
  /** The step number the user is moving TO next (1-indexed into WORKFLOW_STEPS). */
  step: number;
  title: string;
  description?: string;
  cta: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
}

/**
 * Bold, dark, brass-accented banner used at the end of every workflow stage
 * to say exactly what to do next — deliberately styled to stand out against
 * every page it's dropped into (paper-colored or plain neutral) rather than
 * blend in like the rest of the UI. Pairs with the "Step N of 5" eyebrow set
 * via stepEyebrow() on each page's own header, so the numbering is
 * consistent end to end. See lib/workflowSteps.ts for the step registry.
 */
export default function NextStepBanner({
  step,
  title,
  description,
  cta,
  secondaryCta,
}: NextStepBannerProps) {
  return (
    <div className="next-step-glow relative overflow-hidden rounded-xl border border-brass/40 bg-ink-deep px-6 py-6 shadow-lg shadow-ink-deep/30 sm:px-8 sm:py-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(650px circle at 0% 0%, rgb(var(--brass-rgb) / 0.18), transparent 60%)",
        }}
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brass text-lg font-bold text-ink-deep shadow-md shadow-brass/40">
            {step}
          </span>
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-brass-bright">
              Next · Step {step} of {TOTAL_WORKFLOW_STEPS}
            </p>
            <h2 className="mt-1 font-display text-xl font-bold leading-snug text-paper sm:text-2xl">
              {title}
            </h2>
            {description && <p className="mt-2 max-w-xl text-sm text-paper/70">{description}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4 sm:pl-4">
          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className="focus-ring text-sm font-medium text-paper/60 underline decoration-paper/30 underline-offset-4 hover:text-paper"
            >
              {secondaryCta.label}
            </Link>
          )}
          <Link
            href={cta.href}
            className="focus-ring inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-brass px-5 py-3 text-sm font-semibold text-ink-deep transition-colors hover:bg-brass-bright"
          >
            {cta.label}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
