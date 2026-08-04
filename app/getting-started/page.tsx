import Link from "next/link";

const BENEFITS = [
  {
    title: "No bulk export exists",
    body: "Most distributors give you no way to export your catalog metadata at all — switching normally means re-typing every title, ISRC, and credit by hand, one release at a time.",
  },
  {
    title: "One wrong ISRC breaks stream history",
    body: "Get a single character wrong and you can lose accumulated stream counts and playlist placements when you move to a new distributor. Nothing here re-types an ISRC after you've confirmed it once.",
  },
  {
    title: "Pay once, not every month",
    body: "No ongoing AI cost after import, so a one-time price is viable — the opposite of the subscription every distributor already locks you into.",
  },
  {
    title: "We never touch your distributor accounts",
    body: "No shared logins, no automation against any distributor's site, no custody of your master audio files. You click every \"upload\" yourself, on their site, in your own browser.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Import your catalog",
    body: "Upload a screenshot, a CSV/Excel export, or a PDF release sheet — one release at a time, or a whole catalog in one CSV. AI extracts titles, ISRCs, and credits where needed; plain deterministic parsing handles CSV/Excel with no AI involved at all.",
    cta: { href: "/import", label: "Start importing" },
  },
  {
    n: "2",
    title: "Confirm what was extracted",
    body: "Before anything is saved, you see the extracted data next to the source and can fix anything misread — this is the last moment AI is involved for that record. Nothing reaches your permanent catalog until you confirm it.",
  },
  {
    n: "3",
    title: "Attach files",
    body: "Add artwork, and point the tool at your audio files on your own computer — it verifies they exist and are named right, but never uploads or stores the audio itself. Attach files from each album's page after importing.",
  },
  {
    n: "4",
    title: "Run a catalog health check",
    body: "Deterministic checks — missing or duplicate ISRCs, missing lyrics, undersized artwork, gaps in a tracklist — catch problems before they become a rejected upload on the new distributor's site.",
    cta: { href: "/health", label: "View catalog health" },
  },
  {
    n: "5",
    title: "Generate an export pack",
    body: "Pick your target distributor from an album's page. If they support bulk CSV, you get a ready-to-upload file; otherwise a reference sheet arranged in the exact order their form asks for fields, so it's copy-paste instead of hunt-and-peck.",
  },
  {
    n: "6",
    title: "Track your migration",
    body: "As you manually complete each step on the new distributor's actual site, mark it here — imported, files attached, health-checked, export pack generated, uploaded, verified. Nothing is auto-detected; every status is you reporting something you actually did.",
    cta: { href: "/migrations", label: "Open migration tracker" },
  },
];

export default function GettingStartedPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-10">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Getting started</h1>
          <p className="mt-1 text-neutral-600">
            A permanent, distributor-independent copy of your catalog — here's how to build it.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Why this matters
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-lg border border-neutral-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-neutral-900">{b.title}</h3>
                <p className="mt-1 text-sm text-neutral-600">{b.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Your six steps
          </h2>
          <ol className="space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-lg border border-neutral-200 bg-white p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-medium text-white">
                    {s.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-neutral-900">{s.title}</h3>
                    <p className="mt-1 text-sm text-neutral-600">{s.body}</p>
                    {s.cta && (
                      <Link
                        href={s.cta.href}
                        className="mt-2 inline-block text-sm font-medium text-neutral-900 underline"
                      >
                        {s.cta.label} →
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-neutral-700">Ready to bring in your first release?</p>
          <Link
            href="/import"
            className="mt-3 inline-block rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
          >
            Import your first release
          </Link>
        </div>
      </div>
    </main>
  );
}
