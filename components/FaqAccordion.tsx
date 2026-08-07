"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { useInView } from "@/lib/useInView";
import SegmentedControl from "@/components/ui/SegmentedControl";

type Category = "How it works" | "Trust & privacy" | "Distributors & migrating" | "Pricing & support";

interface FaqItem {
  category: Category;
  q: string;
  a: ReactNode;
}

const CATEGORIES: Category[] = [
  "How it works",
  "Trust & privacy",
  "Distributors & migrating",
  "Pricing & support",
];

const SUPPORT_EMAIL = "wearegamechangers@outlook.com";

const FAQ_ITEMS: FaqItem[] = [
  {
    category: "How it works",
    q: "What does OwnYourMusic actually do?",
    a: (
      <>
        It sits between distributors — never logging into or automating against either one. You
        import whatever catalog materials you already have, it structures and validates that data
        into one clean, distributor-independent master catalog you own permanently, then packages
        it back out into whatever your next distributor&rsquo;s form needs. You click every
        &ldquo;upload&rdquo; yourself, on their site.
      </>
    ),
  },
  {
    category: "How it works",
    q: "What can I actually import?",
    a: (
      <>
        Screenshots of distributor pages, CSV/Excel exports, PDF release sheets, whole album
        folders (artwork + audio), or plain text pasted from a distributor site. CSV/Excel and
        folders go through a plain, deterministic parser — no AI involved. Screenshots, PDFs, and
        pasted text go through AI extraction instead, since there&rsquo;s no fixed structure to
        parse. Either way, you land on the same editable confirm screen before anything is saved.{" "}
        <Link href="/import" className="underline hover:text-brass">
          Try it
        </Link>
        .
      </>
    ),
  },
  {
    category: "How it works",
    q: "One screenshot can't fit my whole 20-track tracklist. What then?",
    a: (
      <>
        Use &ldquo;Add another file to this import&rdquo; on the confirm screen to combine several
        files into the same album, instead of starting the import over.
      </>
    ),
  },
  {
    category: "How it works",
    q: "What does the Catalog Health check actually look for?",
    a: (
      <>
        Deterministic, non-AI rules: missing or duplicate ISRCs, missing lyrics, undersized album
        artwork, and gaps in a tracklist. It checks the internal consistency of your own catalog
        data — it doesn&rsquo;t check what&rsquo;s actually live on any distributor&rsquo;s site,
        which is a different, harder problem.{" "}
        <Link href="/health" className="underline hover:text-brass">
          View catalog health
        </Link>
        .
      </>
    ),
  },
  {
    category: "Trust & privacy",
    q: "Do you ever log into my distributor accounts?",
    a: (
      <>
        No — never. Nothing here automates a login or a submission on DistroKid, Ditto Music, CD
        Baby, or anywhere else. Every upload happens by your own hand, on the distributor&rsquo;s
        own site.
      </>
    ),
  },
  {
    category: "Trust & privacy",
    q: "What happens to my actual master audio files?",
    a: (
      <>
        They&rsquo;re never uploaded to or stored on our servers. You point the tool at your files
        on your own computer; on Chromium-based browsers, the File System Access API verifies each
        expected file exists and reads its filename, size, and format without ever reading the
        audio itself. On other browsers, the same step is a manual self-attestation — you confirm a
        filename exists rather than the tool verifying it. Either way, only the filename and
        relative path are ever recorded against a track.
      </>
    ),
  },
  {
    category: "Trust & privacy",
    q: "Where does AI come in, and is my data still being processed by it later?",
    a: (
      <>
        Only once, during import — turning an unstructured screenshot, PDF, or pasted-text source
        into structured data, via a third-party AI provider. The moment you confirm a record on the
        confirm screen, it becomes ordinary structured data: searched, edited, validated, and
        exported using conventional deterministic code from then on, with zero further AI
        involvement or cost.
      </>
    ),
  },
  {
    category: "Trust & privacy",
    q: "Can I get my account and data deleted?",
    a: (
      <>
        Yes — email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-brass">
          {SUPPORT_EMAIL}
        </a>{" "}
        and mention &ldquo;Privacy Request&rdquo; in the subject line. See the{" "}
        <Link href="/privacy" className="underline hover:text-brass">
          Privacy Policy
        </Link>{" "}
        for the full detail on what&rsquo;s collected.
      </>
    ),
  },
  {
    category: "Distributors & migrating",
    q: "Which distributors are actually supported right now?",
    a: (
      <>
        DistroKid, Ditto Music, and CD Baby currently have a full field-by-field export pack,
        mapped from real submission-flow sources (saved form HTML for DistroKid, screenshots for
        Ditto, sourced documentation for CD Baby). eMastered and TuneCore are tracked in the
        Migration Tracker but don&rsquo;t have an export pack built yet. Adding a new distributor is
        an additive export profile, not a platform rebuild.
      </>
    ),
  },
  {
    category: "Distributors & migrating",
    q: "Does this bulk-upload a CSV to my new distributor for me?",
    a: (
      <>
        Not today, for any of the distributors currently configured — none of them currently
        expose a bulk import path this tool can target, so every export pack right now is a
        copy-paste reference sheet, arranged in the exact order the distributor&rsquo;s own form
        asks for fields. You still do the actual submitting yourself, on their site. If a
        distributor&rsquo;s export profile does support bulk CSV, the pack generates that file
        directly instead — the pipeline is built for both.
      </>
    ),
  },
  {
    category: "Distributors & migrating",
    q: "Will I lose my stream counts or playlist placements when I switch?",
    a: (
      <>
        We can&rsquo;t guarantee that either way — it depends on factors outside this tool&rsquo;s
        control, including how the platforms and distributors involved handle the transition. What
        the tool does control: catching a wrong ISRC before you ever paste it into the new
        distributor&rsquo;s form, since a single mistyped character is one of the most common ways
        stream-history continuity breaks.
      </>
    ),
  },
  {
    category: "Distributors & migrating",
    q: "What's the Takedown Batch Scheduler for?",
    a: (
      <>
        Preserving stream history usually means requesting a takedown from your old distributor
        alongside re-uploading elsewhere, and those clearance windows typically run 2–4 weeks. The
        Takedowns view under Migration Tracker lets you batch-request takedowns across many albums
        at once so those windows overlap instead of stacking one after another, with a running
        countdown shown per album.{" "}
        <Link href="/migrations" className="underline hover:text-brass">
          Open migration tracker
        </Link>
        .
      </>
    ),
  },
  {
    category: "Pricing & support",
    q: "How much does this cost?",
    a: (
      <>
        A one-time payment — see the{" "}
        <Link href="/billing" className="underline hover:text-brass">
          Billing
        </Link>{" "}
        page for the current price — not a subscription. That&rsquo;s a deliberate contrast with
        the distributor subscriptions this tool exists to get you out from under.
      </>
    ),
  },
  {
    category: "Pricing & support",
    q: "What do I get for free, and what needs Own Your Music?",
    a: (
      <>
        Free accounts can import, confirm, and run a health check on their most recently added
        album. Own Your Music unlocks full catalog health scoring across every album you have,
        Export Pack generation for any supported distributor, and unlimited Migration Report PDFs.
      </>
    ),
  },
  {
    category: "Pricing & support",
    q: "Can I get a refund?",
    a: (
      <>
        Yes, within 14 days of purchase, if the software doesn&rsquo;t work substantially as
        described or an unresolved technical issue prevents you from using it. Refunds
        generally aren&rsquo;t available for a simple change of mind, or once the migration you
        purchased it for has already completed successfully. Full conditions are in the{" "}
        <Link href="/terms" className="underline hover:text-brass">
          Terms of Service
        </Link>
        .
      </>
    ),
  },
  {
    category: "Pricing & support",
    q: "How do I get help, and who's actually behind this?",
    a: (
      <>
        Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-brass">
          {SUPPORT_EMAIL}
        </a>{" "}
        — we typically respond within 1–2 business days. OwnYourMusic is operated by Own Your
        Music, based in Limoges, France.
      </>
    ),
  },
];

function FaqRow({ item, index }: { item: FaqItem; index: number }) {
  const [open, setOpen] = useState(false);
  const panelId = `faq-panel-${index}`;

  return (
    <div className="rounded-lg border border-ink/10 bg-white shadow-sm shadow-ink/[0.03] overflow-hidden transition-colors hover:border-brass/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="focus-ring flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
            open ? "bg-brass text-ink-deep" : "bg-ink/[0.06] text-ink/50"
          }`}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex-1 font-display text-base font-semibold leading-snug text-ink sm:text-lg">
          {item.q}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 shrink-0 text-ink/40 transition-transform duration-300 ${
            open ? "rotate-45 text-brass" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <div
        id={panelId}
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="border-t border-ink/10 px-5 pb-5 pt-4 text-sm leading-relaxed text-ink/70 sm:px-6 sm:text-base">
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FaqAccordion() {
  const [filter, setFilter] = useState<"All" | Category>("All");
  const { ref, inView } = useInView<HTMLDivElement>(0.05);

  const visible = filter === "All" ? FAQ_ITEMS : FAQ_ITEMS.filter((i) => i.category === filter);

  return (
    <div ref={ref} className={`reveal ${inView ? "in-view" : ""}`}>
      <div className="mb-8 overflow-x-auto pb-1">
        <SegmentedControl
          options={[{ value: "All", label: "All" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
          value={filter}
          onChange={(v) => setFilter(v as "All" | Category)}
        />
      </div>

      <div className="space-y-3">
        {visible.map((item, i) => (
          <FaqRow key={item.q} item={item} index={i} />
        ))}
      </div>
    </div>
  );
}
