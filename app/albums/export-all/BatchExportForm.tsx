"use client";

import { useMemo, useState } from "react";
import type { DistributorProfile } from "@/types/catalog";
import type { ScoreBand } from "@/lib/migrationScore";
import { BAND_LABEL } from "@/lib/migrationScore";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

export interface BatchExportAlbum {
  id: string;
  title: string;
  artist: string;
  trackCount: number;
  band: ScoreBand;
  score: number;
  alreadyGenerated: boolean;
  upToDate: boolean;
}

const BAND_TONE: Record<ScoreBand, "success" | "warning" | "danger"> = {
  ready: "success",
  needs_attention: "warning",
  not_ready: "danger",
};

export default function BatchExportForm({
  albums,
  profiles,
  selectedDistributorSlug,
}: {
  albums: BatchExportAlbum[];
  profiles: DistributorProfile[];
  selectedDistributorSlug: string | null;
}) {
  const [regenerateAll, setRegenerateAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => defaultSelection(albums, false));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ generated: number; skipped: number } | null>(null);

  function defaultSelection(list: BatchExportAlbum[], regen: boolean): Set<string> {
    return new Set(
      list.filter((a) => a.band === "ready" && (regen || !a.upToDate)).map((a) => a.id)
    );
  }

  function toggleRegenerateAll(next: boolean) {
    setRegenerateAll(next);
    setSelected(defaultSelection(albums, next));
  }

  function toggleAlbum(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const readyCount = useMemo(() => albums.filter((a) => a.band === "ready").length, [albums]);

  async function handleGenerate() {
    if (!selectedDistributorSlug || selected.size === 0) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/export/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          album_ids: [...selected],
          distributor_slug: selectedDistributorSlug,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Batch generation failed.");
        return;
      }

      const generated = Number(res.headers.get("X-Generated-Count") ?? selected.size);
      const skipped = Number(res.headers.get("X-Skipped-Count") ?? 0);

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? "export-packs.zip";

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(blobUrl);

      setResult({ generated, skipped });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex-1 text-sm">
            <span className="block text-ink/70">Target distributor</span>
            <select
              name="distributor"
              defaultValue={selectedDistributorSlug ?? ""}
              className="mt-1 w-full rounded border border-ink/20 px-2 py-1.5"
            >
              <option value="" disabled>
                Choose a distributor…
              </option>
              {profiles.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">View albums</Button>
        </form>
      </Card>

      {selectedDistributorSlug && (
        <>
          <Card className="space-y-3 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink/70">
                {readyCount} of {albums.length} album{albums.length === 1 ? "" : "s"} are Ready to
                Migrate. Ready albums are checked by default; toggle any other album to include it
                anyway.
              </p>
              <label className="flex items-center gap-2 text-sm text-ink/70">
                <input
                  type="checkbox"
                  checked={regenerateAll}
                  onChange={(e) => toggleRegenerateAll(e.target.checked)}
                  className="h-4 w-4"
                />
                Regenerate all (include already up-to-date packs)
              </label>
            </div>
          </Card>

          <ul className="space-y-2">
            {albums.map((album) => (
              <li key={album.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <label className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(album.id)}
                      onChange={() => toggleAlbum(album.id)}
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">
                        {album.title} <span className="font-normal text-ink/50">— {album.artist}</span>
                      </p>
                      <p className="text-sm text-ink/50">
                        {album.trackCount} track{album.trackCount === 1 ? "" : "s"} · {album.score}%
                      </p>
                    </div>
                  </label>
                  <div className="flex shrink-0 items-center gap-2">
                    {album.upToDate && (
                      <Badge tone="neutral">Already generated · up to date</Badge>
                    )}
                    {album.alreadyGenerated && !album.upToDate && (
                      <Badge tone="warning">Catalog data changed since last generated</Badge>
                    )}
                    <Badge tone={BAND_TONE[album.band]}>{BAND_LABEL[album.band]}</Badge>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <Card className="space-y-3 p-6">
            <Button type="button" onClick={handleGenerate} disabled={generating || selected.size === 0}>
              {generating
                ? `Generating ${selected.size} export pack${selected.size === 1 ? "" : "s"}…`
                : `Generate ${selected.size} export pack${selected.size === 1 ? "" : "s"}`}
            </Button>
            <p className="text-xs text-ink/50">
              Downloads as a single zip — one reference sheet (or CSV, for distributors that support
              bulk import) per album. This also starts or advances each album's Migration tracker
              status the same way clicking "Start tracking" does.
            </p>
            {error && <p className="text-sm text-rust">{error}</p>}
            {result && (
              <p className="text-sm text-ink/70">
                Generated {result.generated} pack{result.generated === 1 ? "" : "s"}
                {result.skipped > 0 && ` · ${result.skipped} skipped`}. Check your downloads for the
                zip.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
