"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SegmentedControl from "@/components/ui/SegmentedControl";

type Mode = "skip_existing" | "overwrite_all";

interface PreviewResult {
  total_tracks: number;
  will_update: number;
  will_skip: number;
  already_credited_count: number;
  overwrite_examples: {
    album_title: string;
    track_title: string;
    position: number;
    existing_names: string;
  }[];
}

interface ApplyResult {
  updated: number;
  skipped: number;
  issues_resolved: number;
}

type Phase = "form" | "preview" | "done";

const MODE_OPTIONS = [
  { value: "skip_existing", label: "Skip already-credited tracks" },
  { value: "overwrite_all", label: "Apply to all, including credited" },
];

export default function SetDefaultSongwriterPanel({
  scope,
  albumId,
  compact = false,
}: {
  scope: "catalog" | "album";
  albumId?: string;
  /** Renders as an inline text link (matches Edit / Attach files row) instead
   * of a full Button — used for the per-album placement. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [mode, setMode] = useState<Mode>("skip_existing");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setPhase("form");
    setName("");
    setRole("");
    setMode("skip_existing");
    setPreview(null);
    setResult(null);
    setError(null);
  }

  async function callApi(dryRun: boolean) {
    const res = await fetch("/api/credits/bulk-apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        album_id: albumId ?? null,
        name: name.trim(),
        role: role.trim(),
        mode,
        dry_run: dryRun,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error ?? "Request failed.");
    }
    return body;
  }

  async function handlePreview() {
    if (!name.trim()) {
      setError("Enter a songwriter name first.");
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

  const trigger = compact ? (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="text-ink underline hover:text-brass"
    >
      Set songwriter
    </button>
  ) : (
    <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)}>
      Set default songwriter
    </Button>
  );

  if (!open) {
    return trigger;
  }

  return (
    <div className="relative inline-block">
      {trigger}
      <Card
        className={`absolute right-0 z-20 mt-2 space-y-4 p-5 ${compact ? "w-96" : "w-[26rem]"}`}
      >
        {phase === "form" && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Set default songwriter{scope === "album" ? " for this album" : " across your catalog"}
              </h3>
              <p className="mt-1 text-xs text-ink/50">
                Plain data entry, no AI — applies the same credit to every track in scope, all at
                once.
              </p>
            </div>
            <label className="block text-sm">
              <span className="text-ink/70">Songwriter name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jordan Lee"
                autoFocus
                className="mt-1 w-full rounded border border-ink/20 px-2 py-1.5"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink/70">Role (optional)</span>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Songwriter"
                className="mt-1 w-full rounded border border-ink/20 px-2 py-1.5"
              />
            </label>
            <div>
              <span className="mb-1.5 block text-sm text-ink/70">Existing credits</span>
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
              This will set <span className="font-medium text-ink">{name.trim()}</span> as{" "}
              {role.trim() || "Songwriter"} on{" "}
              <span className="font-medium text-ink">{preview.will_update}</span> of{" "}
              {preview.total_tracks} track{preview.total_tracks === 1 ? "" : "s"}.
            </p>
            {mode === "skip_existing" && preview.will_skip > 0 && (
              <p className="text-sm text-ink/60">
                {preview.will_skip} track{preview.will_skip === 1 ? "" : "s"} already{" "}
                {preview.will_skip === 1 ? "has" : "have"} a songwriter credit and will be left
                unchanged.
              </p>
            )}
            {mode === "overwrite_all" && preview.already_credited_count > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-rust">
                  {preview.already_credited_count} track{preview.already_credited_count === 1 ? "" : "s"}{" "}
                  already {preview.already_credited_count === 1 ? "has" : "have"} a different
                  songwriter credit — this will overwrite {preview.already_credited_count === 1 ? "it" : "them"}:
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-rust/20 bg-rust/[0.04] p-2 text-xs text-ink/70">
                  {preview.overwrite_examples.map((ex, i) => (
                    <li key={i}>
                      "{ex.album_title}" track {ex.position}. "{ex.track_title}" — currently:{" "}
                      {ex.existing_names || "—"}
                    </li>
                  ))}
                  {preview.already_credited_count > preview.overwrite_examples.length && (
                    <li className="text-ink/50">
                      …and {preview.already_credited_count - preview.overwrite_examples.length} more
                    </li>
                  )}
                </ul>
              </div>
            )}
            {error && <p className="text-sm text-rust">{error}</p>}
            <div className="flex items-center gap-3">
              <Button type="button" onClick={handleConfirm} disabled={loading}>
                {loading ? "Applying…" : `Apply to ${preview.will_update} track${preview.will_update === 1 ? "" : "s"}`}
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
              Set the songwriter credit on {result.updated} track{result.updated === 1 ? "" : "s"}
              {result.skipped > 0 && ` · ${result.skipped} already-credited track${result.skipped === 1 ? "" : "s"} left unchanged`}
              .
            </p>
            <p className="text-sm text-ink/70">
              Catalog health updated automatically — {result.issues_resolved} missing-credit issue
              {result.issues_resolved === 1 ? "" : "s"} resolved.
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
