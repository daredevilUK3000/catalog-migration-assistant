"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { ExtractedAlbumDraft } from "@/types/catalog";
import ConfirmAlbumForm from "./ConfirmAlbumForm";

type Step = "upload" | "confirm" | "done";
type UploadMethod = "screenshot" | "pdf" | "csv";

const METHOD_LABEL: Record<UploadMethod, string> = {
  screenshot: "Screenshot",
  pdf: "PDF",
  csv: "CSV / Excel",
};

const METHOD_HELP: Record<UploadMethod, string> = {
  screenshot: "A screenshot of one release from your distributor's dashboard.",
  pdf: "A release sheet or export PDF for one release.",
  csv: "A spreadsheet listing one or more releases — needs Album, Artist, and Track Title columns (a few common header spellings are recognized). No AI involved; parsing is plain and deterministic.",
};

const ACCEPT_BY_METHOD: Record<UploadMethod, string> = {
  screenshot: "image/jpeg,image/png,image/gif,image/webp",
  pdf: "application/pdf",
  csv: ".csv,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const ENDPOINT_BY_METHOD: Record<UploadMethod, string> = {
  screenshot: "/api/import/screenshot",
  pdf: "/api/import/pdf",
  csv: "/api/import/csv",
};

const FIELD_NAME_BY_METHOD: Record<UploadMethod, string> = {
  screenshot: "image",
  pdf: "file",
  csv: "file",
};

export default function ImportPage() {
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
    <main className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Import releases</h1>
          <p className="mt-1 text-neutral-600">
            {step === "done"
              ? "Done — see the results below."
              : "Nothing is saved to your catalog until you confirm it below."}
          </p>
        </div>

        {step === "upload" && (
          <form
            onSubmit={handleExtract}
            className="max-w-md space-y-4 rounded-lg border border-neutral-200 bg-white p-6"
          >
            <div>
              <span className="block text-sm font-medium text-neutral-700">Source type</span>
              <div className="mt-1 flex gap-2">
                {(Object.keys(METHOD_LABEL) as UploadMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => selectMethod(m)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                      method === m
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 text-neutral-700"
                    }`}
                  >
                    {METHOD_LABEL[m]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-neutral-500">{METHOD_HELP[method]}</p>
            </div>

            <div>
              <label htmlFor="source-file" className="block text-sm font-medium text-neutral-700">
                File
              </label>
              <input
                ref={fileInputRef}
                id="source-file"
                type="file"
                accept={ACCEPT_BY_METHOD[method]}
                className="mt-1 block w-full text-sm text-neutral-600 file:mr-4 file:rounded-md file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
              />
            </div>
            {extractError && <p className="text-sm text-red-600">{extractError}</p>}
            <button
              type="submit"
              disabled={extracting}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {extracting ? "Working…" : method === "csv" ? "Parse file" : "Extract album data"}
            </button>
          </form>
        )}

        {step === "confirm" && draft && (
          <div className={method === "screenshot" ? "grid grid-cols-1 gap-8 lg:grid-cols-2" : ""}>
            {method === "screenshot" && sourcePreviewUrl && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-neutral-700">Source screenshot</h2>
                {/* Local blob preview — next/image's remote-domain rules don't apply, and
                    don't help here, so a plain <img> is the right tool. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sourcePreviewUrl}
                  alt="Uploaded screenshot"
                  className="w-full rounded-lg border border-neutral-200 object-contain"
                />
              </div>
            )}

            <div className={method === "screenshot" ? "" : "max-w-2xl"}>
              {method === "pdf" && sourcePreviewUrl && (
                <a
                  href={sourcePreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-4 inline-block text-sm font-medium text-neutral-900 underline"
                >
                  View source PDF ↗
                </a>
              )}

              {method === "csv" && queueIndex === 0 && csvWarnings.length > 0 && (
                <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
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
          <div className="max-w-md space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
            {savedAlbums.length === 0 ? (
              <p className="text-neutral-900">No releases were saved.</p>
            ) : (
              <>
                <p className="text-neutral-900">
                  {savedAlbums.length === 1
                    ? "Album saved to your catalog."
                    : `${savedAlbums.length} albums saved to your catalog.`}
                </p>
                <ul className="space-y-1">
                  {savedAlbums.map((album) => (
                    <li key={album.id} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-900">
                        {album.title} — {album.artist}
                      </span>
                      <Link
                        href={`/albums/attach?id=${album.id}`}
                        className="font-medium text-neutral-900 underline"
                      >
                        Attach files
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
            >
              Import another
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
