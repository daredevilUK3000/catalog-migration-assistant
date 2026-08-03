"use client";

import { useState } from "react";

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
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className={
          albumId
            ? "text-neutral-900 underline disabled:opacity-50"
            : "rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        }
      >
        {generating ? "Generating…" : label}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </span>
  );
}
