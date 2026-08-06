"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SegmentedControl from "@/components/ui/SegmentedControl";

type Mode = "skip_existing" | "overwrite_all";

interface PreviewResult {
  total_albums: number;
  will_update: number;
  will_skip: number;
  already_set_count: number;
  overwrite_examples: { album_title: string; existing_genre: string }[];
}

interface ApplyResult {
  updated: number;
  skipped: number;
}

type Phase = "form" | "preview" | "done";

const MODE_OPTIONS = [
  { value: "skip_existing", label: "Skip albums that already have a genre" },
  { value: "overwrite_all", label: "Apply to all, including already-set" },
];

/**
 * Catalog-wide bulk-apply for a single Album field (genre) — sibling to
 * SetDefaultSongwriterPanel, but scoped to the whole catalog only. Genre is
 * one value per album (not per track), so there's no meaningful "just this
 * album" scope the way songwriter credits have — editing one album's genre
 * is already what the per-album Edit form is for.
 */
export default function SetDefaultGenrePanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [genre, setGenre] = useState("");
  const [mode, setMode] = useState<Mode>("skip_existing");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setPhase("form");
    setGenre("");
    setMode("skip_existing");
    setPreview(null);
    setResult(null);
    setError(null);
  }

  async function callApi(dryRun: boolean) {
    const res = await fetch("/api/albums/bulk-apply-genre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genre: genre.trim(), mode, dry_run: dryRun }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error ?? "Request failed.");
    }
    return body;
  }

  async function handlePreview() {
    if (!genre.trim()) {
      setError("Enter a genre first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = await callApi(true);
      setPreview(body as PreviewResult);
      setPhase("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const body = await callApi(false);
      setResult(body as ApplyResult);
      setPhase("done");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  const trigger = (
    <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)}>
      Set default genre
    </Button>
  );

  if (!open) {
    return trigger;
  }

  return (
    <div className="relative inline-block">
      {trigger}
      <Card className="absolute right-0 z-20 mt-2 w-[26rem] space-y-4 p-5">
        {phase === "form" && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-ink">Set default genre across your catalog</h3>
              <p className="mt-1 text-xs text-ink/50">
                Fills in the Primary Genre field every distributor's form asks for — one less thing
                to type per album when you get to their site.
              </p>
            </div>
            <label className="block text-sm">
              <span className="text-ink/70">Genre</span>
              <input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. Pop"
                autoFocus
                className="mt-1 w-full rounded border border-ink/20 px-2 py-1.5"
              />
            </label>
            <div>
              <span className="mb-1.5 block text-sm text-ink/70">Existing genres</span>
              <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={(v) => setMode(v as Mode)} />
            </div>
            {error && <p className="text-sm text-rust">{error}</p>}
            <div className="flex items-center gap-3">
              <Button type="button" onClick={handlePreview} disabled={loading}>
                {loading ? "Checking…" : "Preview"}
              </Button>
              <button type="button" onClick={reset} className="text-sm text-ink/50 underline">
                Cancel
              </button>
            </div>
          </>
        )}

        {phase === "preview" && preview && (
          <>
            <h3 className="text-sm font-semibold text-ink">Confirm before applying</h3>
            <p className="text-sm text-ink/70">
              This will set genre to <span className="font-medium text-ink">{genre.trim()}</span> on{" "}
              <span className="font-medium text-ink">{preview.will_update}</span> of{" "}
              {preview.total_albums} album{preview.total_albums === 1 ? "" : "s"}.
            </p>
            {mode === "skip_existing" && preview.will_skip > 0 && (
              <p className="text-sm text-ink/60">
                {preview.will_skip} album{preview.will_skip === 1 ? "" : "s"} already{" "}
                {preview.will_skip === 1 ? "has" : "have"} a genre set and will be left unchanged.
              </p>
            )}
            {mode === "overwrite_all" && preview.already_set_count > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-rust">
                  {preview.already_set_count} album{preview.already_set_count === 1 ? "" : "s"} already{" "}
                  {preview.already_set_count === 1 ? "has" : "have"} a different genre — this will
                  overwrite {preview.already_set_count === 1 ? "it" : "them"}:
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-rust/20 bg-rust/[0.04] p-2 text-xs text-ink/70">
                  {preview.overwrite_examples.map((ex, i) => (
                    <li key={i}>
                      "{ex.album_title}" — currently: {ex.existing_genre}
                    </li>
                  ))}
                  {preview.already_set_count > preview.overwrite_examples.length && (
                    <li className="text-ink/50">
                      …and {preview.already_set_count - preview.overwrite_examples.length} more
                    </li>
                  )}
                </ul>
              </div>
            )}
            {error && <p className="text-sm text-rust">{error}</p>}
            <div className="flex items-center gap-3">
              <Button type="button" onClick={handleConfirm} disabled={loading}>
                {loading
                  ? "Applying…"
                  : `Apply to ${preview.will_update} album${preview.will_update === 1 ? "" : "s"}`}
              </Button>
              <button
                type="button"
                onClick={() => setPhase("form")}
                className="text-sm text-ink/50 underline"
              >
                Back
              </button>
            </div>
          </>
        )}

        {phase === "done" && result && (
          <>
            <h3 className="text-sm font-semibold text-ink">Applied</h3>
            <p className="text-sm text-ink/70">
              Set the genre on {result.updated} album{result.updated === 1 ? "" : "s"}
              {result.skipped > 0 && ` · ${result.skipped} already-set album${result.skipped === 1 ? "" : "s"} left unchanged`}
              .
            </p>
            <p className="text-sm text-ink/70">
              Every export pack generated from here on will include it automatically.
            </p>
            <Button type="button" variant="secondary" onClick={reset}>
              Close
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
