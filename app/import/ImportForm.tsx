"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { ExtractedAlbumDraft } from "@/types/catalog";
import ConfirmAlbumForm from "./ConfirmAlbumForm";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SegmentedControl from "@/components/ui/SegmentedControl";
import {
  type UploadMethod,
  METHOD_LABEL,
  ACCEPT_BY_METHOD,
  ENDPOINT_BY_METHOD,
  FIELD_NAME_BY_METHOD,
} from "@/lib/importSource";

type Step = "upload" | "confirm" | "done";

const METHOD_HELP: Record<UploadMethod, string> = {
  screenshot: "A screenshot of one release from your distributor's dashboard.",
  pdf: "A release sheet or export PDF for one release.",
  csv: "A spreadsheet listing one or more releases — needs Album, Artist, and Track Title columns (a few common header spellings are recognized). No AI involved; parsing is plain and deterministic.",
};

export default function ImportForm() {
  const [step, setStep] = useState<Step>("upload");
  const [method, setMethod] = useState<UploadMethod>("screenshot");
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queue holds the *remaining* releases for a multi-release source
  // (CSV/Excel). Empty for single-release sources (screenshot, PDF), which
  // just set `draft` directly. `queueIndex + 1 + queue.length` is invariant
  // across advances, so it doubles as "N of M" batch progress.
  const [queue, setQueue] = useState<ExtractedAlbumDraft[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [csvWarnings, setCsvWarnings] = useState<string[]>([]);
  const [draft, setDraft] = useState<ExtractedAlbumDraft | null>(null);
  const [savedAlbums, setSavedAlbums] = useState<{ id: string; title: string; artist: string }[]>(
    []
  );

  const batchTotal = queueIndex + 1 + queue.length;

  function selectMethod(next: UploadMethod) {
    setMethod(next);
    setExtractError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleExtract(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setExtractError("Choose a file to import.");
      return;
    }

    setExtracting(true);
    setExtractError(null);

    try {
      const formData = new FormData();
      formData.append(FIELD_NAME_BY_METHOD[method], file);

      const res = await fetch(ENDPOINT_BY_METHOD[method], { method: "POST", body: formData });
      const body = await res.json();

      if (!res.ok) {
        setExtractError(body.error ?? "Import failed.");
        return;
      }

      if (method === "csv") {
        const albums = body.albums as ExtractedAlbumDraft[];
        setQueue(albums.slice(1));
        setQueueIndex(0);
        setCsvWarnings((body.warnings as string[]) ?? []);
        setDraft(albums[0]);
        setSourcePreviewUrl(null);
      } else {
        setQueue([]);
        setQueueIndex(0);
        setCsvWarnings([]);
        setSourcePreviewUrl(URL.createObjectURL(file));
        setDraft(body as ExtractedAlbumDraft);
      }
      setStep("confirm");
    } catch {
      setExtractError("Could not reach the extraction service.");
    } finally {
      setExtracting(false);
    }
  }

  function advanceQueueOrFinish(saved: { id: string; title: string; artist: string } | null) {
    setSavedAlbums((prev) => (saved ? [...prev, saved] : prev));
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      setDraft(next);
      setQueue(rest);
      setQueueIndex((i) => i + 1);
    } else {
      setStep("done");
    }
  }

  function reset() {
    if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
    setStep("upload");
    setSourcePreviewUrl(null);
    setDraft(null);
    setQueue([]);
    setQueueIndex(0);
    setCsvWarnings([]);
    setExtractError(null);
    setSavedAlbums([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main className="min-h-screen bg-paper px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader
          title="Import releases"
          description={
            step === "done"
              ? "Done — see the results below."
              : "Nothing is saved to your catalog until you confirm it below."
          }
        />

        {step === "upload" && (
          <Card className="max-w-md p-6">
            <form onSubmit={handleExtract} className="space-y-4">
              <div>
                <span className="block text-sm font-medium text-ink/70">Source type</span>
                <div className="mt-1">
                  <SegmentedControl
                    options={(Object.keys(METHOD_LABEL) as UploadMethod[]).map((m) => ({
                      value: m,
                      label: METHOD_LABEL[m],
                    }))}
                    value={method}
                    onChange={(v) => selectMethod(v as UploadMethod)}
                  />
                </div>
                <p className="mt-2 text-xs text-ink/50">{METHOD_HELP[method]}</p>
              </div>

              <div>
                <label htmlFor="source-file" className="block text-sm font-medium text-ink/70">
                  File
                </label>
                <input
                  ref={fileInputRef}
                  id="source-file"
                  type="file"
                  accept={ACCEPT_BY_METHOD[method]}
                  className="mt-1 block w-full text-sm text-ink/60 file:mr-4 file:rounded-md file:border-0 file:bg-brass file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink-deep"
                />
              </div>
              {extractError && <p className="text-sm text-rust">{extractError}</p>}
              <Button type="submit" disabled={extracting}>
                {extracting ? "Working…" : method === "csv" ? "Parse file" : "Extract album data"}
              </Button>
            </form>
          </Card>
        )}

        {step === "confirm" && draft && (
          <div className={method === "screenshot" ? "grid grid-cols-1 gap-8 lg:grid-cols-2" : ""}>
            {method === "screenshot" && sourcePreviewUrl && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-ink/70">Source screenshot</h2>
                {/* Local blob preview — next/image's remote-domain rules don't apply, and
                    don't help here, so a plain <img> is the right tool. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sourcePreviewUrl}
                  alt="Uploaded screenshot"
                  className="w-full rounded-lg border border-ink/10 object-contain"
                />
              </div>
            )}

            <div className={method === "screenshot" ? "" : "max-w-2xl"}>
              {method === "pdf" && sourcePreviewUrl && (
                <a
                  href={sourcePreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-4 inline-block text-sm font-medium text-ink underline"
                >
                  View source PDF ↗
                </a>
              )}

              {method === "csv" && queueIndex === 0 && csvWarnings.length > 0 && (
                <div className="mb-4 rounded border border-rust/30 bg-rust/10 p-3 text-sm text-rust">
                  <p className="font-medium">{csvWarnings.length} row(s) skipped:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {csvWarnings.slice(0, 10).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {csvWarnings.length > 10 && <li>…and {csvWarnings.length - 10} more.</li>}
                  </ul>
                </div>
              )}

              <ConfirmAlbumForm
                key={queueIndex}
                initialDraft={draft}
                progressLabel={batchTotal > 1 ? `Release ${queueIndex + 1} of ${batchTotal}` : undefined}
                onConfirmed={(albumId, title, artist) =>
                  advanceQueueOrFinish({ id: albumId, title, artist })
                }
                onSkip={batchTotal > 1 ? () => advanceQueueOrFinish(null) : undefined}
                onBack={batchTotal <= 1 ? () => setStep("upload") : undefined}
              />
            </div>
          </div>
        )}

        {step === "done" && (
          <Card className="max-w-md space-y-4 p-6">
            {savedAlbums.length === 0 ? (
              <p className="text-ink">No releases were saved.</p>
            ) : (
              <>
                <p className="text-ink">
                  {savedAlbums.length === 1
                    ? "Album saved to your catalog."
                    : `${savedAlbums.length} albums saved to your catalog.`}
                </p>
                <ul className="space-y-1">
                  {savedAlbums.map((album) => (
                    <li key={album.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink">
                        {album.title} — {album.artist}
                      </span>
                      <Link
                        href={`/albums/attach?id=${album.id}`}
                        className="font-medium text-ink underline"
                      >
                        Attach files
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Button type="button" variant="secondary" onClick={reset}>
              Import another
            </Button>
          </Card>
        )}
      </div>
    </main>
  );
}
