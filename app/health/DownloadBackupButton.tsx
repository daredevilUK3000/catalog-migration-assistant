"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function DownloadBackupButton() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/export/backup");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Backup failed.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? "catalog-backup.json";

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <span>
      <Button type="button" variant="secondary" onClick={handleDownload} disabled={downloading}>
        {downloading ? "Preparing…" : "Download backup"}
      </Button>
      {error && <p className="mt-1 text-sm text-rust">{error}</p>}
    </span>
  );
}
