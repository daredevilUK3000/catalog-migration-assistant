"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteAlbumButton({
  albumId,
  title,
  trackCount,
}: {
  albumId: string;
  title: string;
  trackCount: number;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const trackPhrase = trackCount > 0 ? ` and its ${trackCount} track${trackCount === 1 ? "" : "s"}` : "";
    if (!window.confirm(`Delete "${title}"${trackPhrase}? This can't be undone.`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/albums/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ album_id: albumId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Delete failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <span>
      {/* Plain button, not <Button> — sits inline in a row of plain text
          links (Preflight, Edit, Attach files, Export pack); Button's pill
          padding would look out of place next to those. */}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="text-rust underline disabled:opacity-50"
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="mt-1 text-sm text-rust">{error}</p>}
    </span>
  );
}
