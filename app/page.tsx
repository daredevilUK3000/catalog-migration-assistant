import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-3xl font-semibold text-neutral-900">
          Catalog Migration Assistant
        </h1>
        <p className="text-neutral-600">
          The full v0 pipeline is live: import, file attachment, catalog
          health, export packs, and the migration tracker.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/import"
            className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Import a release
          </Link>
          <Link
            href="/health"
            className="inline-block rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
          >
            Catalog health
          </Link>
          <Link
            href="/migrations"
            className="inline-block rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
          >
            Migration tracker
          </Link>
        </div>
      </div>
    </main>
  );
}
