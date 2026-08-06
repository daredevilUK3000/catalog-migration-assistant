"use client";

import { useMemo, useRef, useState } from "react";
import type { ExtractedAlbumDraft } from "@/types/catalog";
import {
  type UploadMethod,
  METHOD_LABEL,
  ACCEPT_BY_METHOD,
  ENDPOINT_BY_METHOD,
  FIELD_NAME_BY_METHOD,
} from "@/lib/importSource";

interface EditableTrack {
  key: string;
  title: string;
  isrc: string;
}

interface EditableDraft {
  title: string;
  artist: string;
  release_date: string;
  upc: string;
  genre: string;
  source_distributor: string;
  tracks: EditableTrack[];
}

function draftFromExtraction(extracted: ExtractedAlbumDraft): EditableDraft {
  const sorted = [...extracted.tracks].sort((a, b) => a.position - b.position);
  return {
    title: extracted.title,
    artist: extracted.artist,
    release_date: extracted.release_date ?? "",
    upc: extracted.upc ?? "",
    genre: extracted.genre ?? "",
    source_distributor: "",
    tracks: sorted.map((t) => ({
      key: crypto.randomUUID(),
      title: t.title,
      isrc: t.isrc ?? "",
    })),
  };
}

/** Fills a blank header field from a later file's extraction; a value
 * already captured (from this file or an earlier one in the same import)
 * is never silently overwritten. */
function fillBlank(current: string, incoming: string | undefined): string {
  return current.trim() ? current : (incoming ?? "").trim();
}

/** Folds one or more additionally-extracted releases into the draft
 * already being built: header fields only fill in gaps, tracks append in
 * extraction order (position continues from wherever the draft's track
 * list currently ends — final ordering is still whatever the confirm
 * table shows after any manual reordering). Multiple `extras` happens
 * when the added file is a multi-row CSV/Excel sheet; every row's tracks
 * are folded into this one album rather than spawning separate albums,
 * since splitting into multiple albums here is explicitly out of scope. */
function mergeExtractionIntoDraft(prev: EditableDraft, extras: ExtractedAlbumDraft[]): EditableDraft {
  let merged = { ...prev };
  const newTracks: EditableTrack[] = [];
  for (const extra of extras) {
    merged = {
      ...merged,
      title: fillBlank(merged.title, extra.title),
      artist: fillBlank(merged.artist, extra.artist),
      release_date: fillBlank(merged.release_date, extra.release_date),
      upc: fillBlank(merged.upc, extra.upc),
      genre: fillBlank(merged.genre, extra.genre),
    };
    const sorted = [...extra.tracks].sort((a, b) => a.position - b.position);
    for (const t of sorted) {
      newTracks.push({ key: crypto.randomUUID(), title: t.title, isrc: t.isrc ?? "" });
    }
  }
  return { ...merged, tracks: [...merged.tracks, ...newTracks] };
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

/** Flags tracks that share a normalized title or a non-empty ISRC with
 * another row in the draft — the signal for "a re-uploaded file
 * re-captured a track already here" (e.g. a retried screenshot). Purely a
 * presentation-layer check recomputed from current state, so resolving one
 * (editing or removing a row) clears the flag immediately rather than
 * leaving a stale warning behind. */
function computeDuplicateKeys(tracks: EditableTrack[]): Set<string> {
  const byTitle = new Map<string, string[]>();
  const byIsrc = new Map<string, string[]>();
  for (const t of tracks) {
    const title = normalizeTitle(t.title);
    if (title) {
      const list = byTitle.get(title) ?? [];
      list.push(t.key);
      byTitle.set(title, list);
    }
    const isrc = t.isrc.trim().toLowerCase();
    if (isrc) {
      const list = byIsrc.get(isrc) ?? [];
      list.push(t.key);
      byIsrc.set(isrc, list);
    }
  }
  const duplicates = new Set<string>();
  for (const list of [...byTitle.values(), ...byIsrc.values()]) {
    if (list.length > 1) list.forEach((k) => duplicates.add(k));
  }
  return duplicates;
}

/** One release's editable confirm table. Manages its own draft state
 * (initialized once from `initialDraft`) and owns the save call — reused by
 * every import path (screenshot, PDF, CSV/Excel), which all funnel into the
 * same ExtractedAlbumDraft shape and the same /api/import/confirm route.
 * Give this a `key` prop that changes per release (e.g. a queue index) so
 * React remounts it with fresh state instead of trying to reconcile props
 * into stale local edits. */
export default function ConfirmAlbumForm({
  initialDraft,
  progressLabel,
  onConfirmed,
  onSkip,
  onBack,
}: {
  initialDraft: ExtractedAlbumDraft;
  progressLabel?: string;
  onConfirmed: (albumId: string, title: string, artist: string) => void;
  onSkip?: () => void;
  onBack?: () => void;
}) {
  const [draft, setDraft] = useState<EditableDraft>(() => draftFromExtraction(initialDraft));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // "Add another file to this import" — a second (or third...) extraction
  // that appends into this same draft rather than starting a new album.
  const [addOpen, setAddOpen] = useState(false);
  const [addMethod, setAddMethod] = useState<UploadMethod>("screenshot");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [filesCombined, setFilesCombined] = useState(1);
  const [extraWarnings, setExtraWarnings] = useState<string[]>([]);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  const duplicateKeys = useMemo(() => computeDuplicateKeys(draft.tracks), [draft.tracks]);

  async function handleAddFile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = addFileInputRef.current?.files?.[0];
    if (!file) {
      setAddError("Choose a file to add.");
      return;
    }

    setAddLoading(true);
    setAddError(null);

    try {
      const formData = new FormData();
      formData.append(FIELD_NAME_BY_METHOD[addMethod], file);

      const res = await fetch(ENDPOINT_BY_METHOD[addMethod], { method: "POST", body: formData });
      const body = await res.json();

      if (!res.ok) {
        setAddError(body.error ?? "Import failed.");
        return;
      }

      // CSV/Excel can list several releases in one sheet; every row's
      // tracks fold into this one album (splitting into separate albums
      // here is out of scope — see mergeExtractionIntoDraft).
      const albums: ExtractedAlbumDraft[] =
        addMethod === "csv" ? (body.albums as ExtractedAlbumDraft[]) : [body as ExtractedAlbumDraft];

      setDraft((prev) => mergeExtractionIntoDraft(prev, albums));
      if (addMethod === "csv" && Array.isArray(body.warnings) && body.warnings.length > 0) {
        setExtraWarnings((prev) => [...prev, ...(body.warnings as string[])]);
      }
      setFilesCombined((n) => n + 1);
      setAddOpen(false);
      if (addFileInputRef.current) addFileInputRef.current.value = "";
    } catch {
      setAddError("Could not reach the extraction service.");
    } finally {
      setAddLoading(false);
    }
  }

  function updateField<K extends keyof Omit<EditableDraft, "tracks">>(
    field: K,
    value: EditableDraft[K]
  ) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function updateTrack(key: string, field: "title" | "isrc", value: string) {
    setDraft((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.key === key ? { ...t, [field]: value } : t)),
    }));
  }

  function moveTrack(key: string, direction: -1 | 1) {
    setDraft((prev) => {
      const index = prev.tracks.findIndex((t) => t.key === key);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.tracks.length) return prev;
      const tracks = [...prev.tracks];
      [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
      return { ...prev, tracks };
    });
  }

  function removeTrack(key: string) {
    setDraft((prev) => ({ ...prev, tracks: prev.tracks.filter((t) => t.key !== key) }));
  }

  function addTrack() {
    setDraft((prev) => ({
      ...prev,
      tracks: [...prev.tracks, { key: crypto.randomUUID(), title: "", isrc: "" }],
    }));
  }

  async function handleConfirm() {
    if (!draft.title.trim() || !draft.artist.trim()) {
      setSaveError("Title and artist are required.");
      return;
    }
    if (draft.tracks.length === 0 || draft.tracks.some((t) => !t.title.trim())) {
      setSaveError("Every track needs a title, and there must be at least one track.");
      return;
    }
    if (
      duplicateKeys.size > 0 &&
      !window.confirm(
        `${duplicateKeys.size} track${duplicateKeys.size === 1 ? "" : "s"} highlighted below look like possible duplicates (same title or ISRC as another row). Save anyway?`
      )
    ) {
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          artist: draft.artist,
          release_date: draft.release_date || null,
          upc: draft.upc || null,
          genre: draft.genre || null,
          source_distributor: draft.source_distributor || null,
          tracks: draft.tracks.map((t) => ({ title: t.title, isrc: t.isrc || null })),
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setSaveError(body.error ?? "Save failed.");
        return;
      }

      onConfirmed(body.album_id as string, draft.title, draft.artist);
    } catch {
      setSaveError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {progressLabel && (
        <p className="text-sm font-medium text-neutral-500">{progressLabel}</p>
      )}

      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-sm font-medium text-neutral-700">Album details</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Title" value={draft.title} onChange={(v) => updateField("title", v)} />
          <Field
            label="Artist"
            value={draft.artist}
            onChange={(v) => updateField("artist", v)}
          />
          <Field
            label="Release date"
            value={draft.release_date}
            onChange={(v) => updateField("release_date", v)}
            placeholder="YYYY-MM-DD"
          />
          <Field label="UPC" value={draft.upc} onChange={(v) => updateField("upc", v)} />
          <Field label="Genre" value={draft.genre} onChange={(v) => updateField("genre", v)} />
          <Field
            label="Source distributor"
            value={draft.source_distributor}
            onChange={(v) => updateField("source_distributor", v)}
            placeholder="e.g. DistroKid"
          />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-neutral-700">Tracks</h2>
            {filesCombined > 1 && (
              <p className="text-xs text-neutral-500">Combined from {filesCombined} files.</p>
            )}
          </div>
          <button
            type="button"
            onClick={addTrack}
            className="text-sm font-medium text-neutral-900 underline"
          >
            + Add track
          </button>
        </div>

        {duplicateKeys.size > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            {duplicateKeys.size} track{duplicateKeys.size === 1 ? "" : "s"} highlighted below{" "}
            {duplicateKeys.size === 1 ? "looks" : "look"} like possible duplicates (same title or
            ISRC as another row) — likely a retried or overlapping file. Review and edit or remove
            before saving.
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="w-8 pb-2">#</th>
              <th className="pb-2">Title</th>
              <th className="pb-2">ISRC</th>
              <th className="w-24 pb-2" />
            </tr>
          </thead>
          <tbody>
            {draft.tracks.map((track, index) => {
              const isDuplicate = duplicateKeys.has(track.key);
              return (
              <tr
                key={track.key}
                className={`border-t border-neutral-100 ${isDuplicate ? "bg-amber-50" : ""}`}
              >
                <td className="py-2 text-neutral-500">{index + 1}</td>
                <td className="py-2 pr-2">
                  <input
                    value={track.title}
                    onChange={(e) => updateTrack(track.key, "title", e.target.value)}
                    className={`w-full rounded border px-2 py-1 ${isDuplicate ? "border-amber-400" : "border-neutral-300"}`}
                  />
                  {isDuplicate && (
                    <p className="mt-1 text-xs text-amber-700">
                      ⚠ Possible duplicate — same title or ISRC as another row
                    </p>
                  )}
                </td>
                <td className="py-2 pr-2">
                  <input
                    value={track.isrc}
                    onChange={(e) => updateTrack(track.key, "isrc", e.target.value)}
                    className="w-full rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
                  />
                </td>
                <td className="whitespace-nowrap py-2 text-right text-neutral-500">
                  <button
                    type="button"
                    onClick={() => moveTrack(track.key, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${track.title || "track"} up`}
                    className="px-1 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTrack(track.key, 1)}
                    disabled={index === draft.tracks.length - 1}
                    aria-label={`Move ${track.title || "track"} down`}
                    className="px-1 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTrack(track.key)}
                    aria-label={`Remove ${track.title || "track"}`}
                    className="px-1 text-red-600"
                  >
                    ✕
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700">Add another file to this import</h2>
          {!addOpen && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="text-sm font-medium text-neutral-900 underline"
            >
              + Add another file
            </button>
          )}
        </div>

        {addOpen && (
          <form onSubmit={handleAddFile} className="space-y-3">
            <p className="text-xs text-neutral-500">
              Its tracks are appended to the list above — reorder or edit as needed before saving.
              Album details already filled in are kept; this only fills fields still blank.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(METHOD_LABEL) as UploadMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAddMethod(m)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    addMethod === m
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-300 text-neutral-600"
                  }`}
                >
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
            <input
              ref={addFileInputRef}
              type="file"
              accept={ACCEPT_BY_METHOD[addMethod]}
              className="block w-full text-sm text-neutral-600 file:mr-4 file:rounded-md file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
            />
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={addLoading}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {addLoading ? "Extracting…" : "Extract & append"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  setAddError(null);
                }}
                className="text-sm text-neutral-500 underline"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {extraWarnings.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-medium">{extraWarnings.length} row(s) skipped while adding files:</p>
            <ul className="mt-1 list-disc pl-5">
              {extraWarnings.slice(0, 10).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {extraWarnings.length > 10 && <li>…and {extraWarnings.length - 10} more.</li>}
            </ul>
          </div>
        )}
      </div>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      <div className="flex gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
          >
            Back
          </button>
        )}
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 disabled:opacity-50"
          >
            Skip this release
          </button>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Confirm & save"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-700">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
      />
    </label>
  );
}
