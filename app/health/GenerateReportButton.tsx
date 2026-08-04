"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function GenerateReportButton({
  albumId,
  label = "Generate report",
}: {
  albumId?: string;
  label?: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const url = albumId ? `/api/reports/pdf?album_id=${albumId}` : "/api/reports/pdf";
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Report generation failed.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? "migration-report.pdf";

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <span>
      {albumId ? (
        // Inline variant sits in a row of plain text links (Preflight, Edit,
        // Attach files, Export pack) — kept as a plain button rather than
        // <Button> so it matches those siblings instead of turning into a
        // pill that doesn't belong in that row.
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="text-ink underline hover:text-brass disabled:opacity-50"
        >
          {generating ? "Generating…" : label}
        </button>
      ) : (
        <Button type="button" variant="secondary" onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating…" : label}
        </Button>
      )}
      {error && <p className="mt-1 text-sm text-rust">{error}</p>}
    </span>
  );
}
