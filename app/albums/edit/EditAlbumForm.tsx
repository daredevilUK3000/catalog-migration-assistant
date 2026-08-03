"use client";

import { useState } from "react";
import type { Album, Track, Credit } from "@/types/catalog";

interface EditableCredit {
  key: string;
  role: string;
  name: string;
  split_percent: string;
}

interface EditableTrack {
  key: string;
  id?: string;
  title: string;
  isrc: string;
  lyrics_plain: string;
  lyrics_synced: string;
  credits: EditableCredit[];
}

interface EditableAlbum {
  title: string;
  artist: string;
  release_date: string;
  upc: string;
  genre: string;
  source_distributor: string;
  tracks: EditableTrack[];
}

function creditsToEditable(credits: Credit[]): EditableCredit[] {
  return credits.map((c) => ({
    key: crypto.randomUUID(),
    role: c.role,
    name: c.name,
    split_percent: c.split_percent != null ? String(c.split_percent) : "",
  }));
}

function stateFromData(album: Album, tracks: Track[]): EditableAlbum {
  return {
    title: album.title,
    artist: album.artist,
    release_date: album.release_date ?? "",
    upc: album.upc ?? "",
    genre: album.genre ?? "",
    source_distributor: album.source_distributor ?? "",
    tracks: tracks.map((t) => ({
      key: crypto.randomUUID(),
      id: t.id,
      title: t.title,
      isrc: t.isrc ?? "",
      lyrics_plain: t.lyrics_plain ?? "",
      lyrics_synced: t.lyrics_synced ?? "",
      credits: creditsToEditable(t.credits),
    })),
  };
}

export default function EditAlbumForm({ album, tracks }: { album: Album; tracks: Track[] }) {
  const [state, setState] = useState<EditableAlbum>(() => stateFromData(album, tracks));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function updateField<K extends keyof Omit<EditableAlbum, "tracks">>(
    field: K,
    value: EditableAlbum[K]
  ) {
    setState((prev) => ({ ...prev, [field]: value }));
    setSavedAt(null);
  }

  function updateTrack<K extends keyof Omit<EditableTrack, "key" | "id" | "credits">>(
    trackKey: string,
    field: K,
    value: EditableTrack[K]
  ) {
    setState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.key === trackKey ? { ...t, [field]: value } : t)),
    }));
    setSavedAt(null);
  }

  function moveTrack(trackKey: string, direction: -1 | 1) {
    setState((prev) => {
      const index = prev.tracks.findIndex((t) => t.key === trackKey);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.tracks.length) return prev;
      const nextTracks = [...prev.tracks];
      [nextTracks[index], nextTracks[target]] = [nextTracks[target], nextTracks[index]];
      return { ...prev, tracks: nextTracks };
    });
    setSavedAt(null);
  }

  function removeTrack(track: EditableTrack) {
    if (track.id && !window.confirm(`Remove "${track.title || "this track"}" from the release?`)) {
      return;
    }
    setState((prev) => ({ ...prev, tracks: prev.tracks.filter((t) => t.key !== track.key) }));
    setSavedAt(null);
  }

  function addTrack() {
    setState((prev) => ({
      ...prev,
      tracks: [
        ...prev.tracks,
        { key: crypto.randomUUID(), title: "", isrc: "", lyrics_plain: "", lyrics_synced: "", credits: [] },
      ],
    }));
    setSavedAt(null);
  }

  function updateCredit(
    trackKey: string,
    creditKey: string,
    field: "role" | "name" | "split_percent",
    value: string
  ) {
    setState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.key === trackKey
          ? {
              ...t,
              credits: t.credits.map((c) => (c.key === creditKey ? { ...c, [field]: value } : c)),
            }
          : t
      ),
    }));
    setSavedAt(null);
  }

  function addCredit(trackKey: string) {
    setState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.key === trackKey
          ? {
              ...t,
              credits: [...t.credits, { key: crypto.randomUUID(), role: "", name: "", split_percent: "" }],
            }
          : t
      ),
    }));
    setSavedAt(null);
  }

  function removeCredit(trackKey: string, creditKey: string) {
    setState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.key === trackKey ? { ...t, credits: t.credits.filter((c) => c.key !== creditKey) } : t
      ),
    }));
    setSavedAt(null);
  }

  async function handleSave() {
    if (!state.title.trim() || !state.artist.trim()) {
      setError("Title and artist are required.");
      return;
    }
    if (state.tracks.length === 0 || state.tracks.some((t) => !t.title.trim())) {
      setError("Every track needs a title, and there must be at least one track.");
      return;
    }
    for (const track of state.tracks) {
      if (track.credits.some((c) => !c.role.trim() || !c.name.trim())) {
        setError(`Every credit on "${track.title}" needs a role and a name.`);
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/albums/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          album_id: album.id,
          title: state.title,
          artist: state.artist,
          release_date: state.release_date || null,
          upc: state.upc || null,
          genre: state.genre || null,
          source_distributor: state.source_distributor || null,
          tracks: state.tracks.map((t) => ({
            id: t.id,
            title: t.title,
            isrc: t.isrc || null,
            lyrics_plain: t.lyrics_plain || null,
            lyrics_synced: t.lyrics_synced || null,
            credits: t.credits.map((c) => ({
              role: c.role,
              name: c.name,
              split_percent: c.split_percent === "" ? undefined : Number(c.split_percent),
            })),
          })),
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "Save failed.");
        return;
      }

      // Resync from the authoritative saved state — new tracks now have
      // real ids, deleted ones are gone, positions reflect the final order.
      setState(stateFromData(body.album as Album, body.tracks as Track[]));
      setSavedAt(Date.now());
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-sm font-medium text-neutral-700">Album details</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Title" value={state.title} onChange={(v) => updateField("title", v)} />
          <Field label="Artist" value={state.artist} onChange={(v) => updateField("artist", v)} />
          <Field
            label="Release date"
            value={state.release_date}
            onChange={(v) => updateField("release_date", v)}
            placeholder="YYYY-MM-DD"
          />
          <Field label="UPC" value={state.upc} onChange={(v) => updateField("upc", v)} />
          <Field label="Genre" value={state.genre} onChange={(v) => updateField("genre", v)} />
          <Field
            label="Source distributor"
            value={state.source_distributor}
            onChange={(v) => updateField("source_distributor", v)}
            placeholder="e.g. DistroKid"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-700">Tracks</h2>
        <button type="button" onClick={addTrack} className="text-sm font-medium text-neutral-900 underline">
          + Add track
        </button>
      </div>

      <ul className="space-y-4">
        {state.tracks.map((track, index) => (
          <li key={track.key} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <span className="text-xs text-neutral-500">Track {index + 1}</span>
                <input
                  value={track.title}
                  onChange={(e) => updateTrack(track.key, "title", e.target.value)}
                  placeholder="Track title"
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 font-medium"
                />
              </div>
              <div className="flex shrink-0 items-center gap-1 pt-5 text-neutral-500">
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
                  disabled={index === state.tracks.length - 1}
                  aria-label={`Move ${track.title || "track"} down`}
                  className="px-1 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeTrack(track)}
                  aria-label={`Remove ${track.title || "track"}`}
                  className="px-1 text-red-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <label className="block text-sm">
              <span className="text-neutral-700">ISRC</span>
              <input
                value={track.isrc}
                onChange={(e) => updateTrack(track.key, "isrc", e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
              />
            </label>

            <label className="block text-sm">
              <span className="text-neutral-700">Lyrics</span>
              <textarea
                value={track.lyrics_plain}
                onChange={(e) => updateTrack(track.key, "lyrics_plain", e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
              />
            </label>

            <label className="block text-sm">
              <span className="text-neutral-700">Synced lyrics (LRC format, optional)</span>
              <textarea
                value={track.lyrics_synced}
                onChange={(e) => updateTrack(track.key, "lyrics_synced", e.target.value)}
                rows={2}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-700">Credits</span>
                <button
                  type="button"
                  onClick={() => addCredit(track.key)}
                  className="text-xs font-medium text-neutral-900 underline"
                >
                  + Add credit
                </button>
              </div>
              {track.credits.map((credit) => (
                <div key={credit.key} className="flex items-center gap-2">
                  <input
                    value={credit.role}
                    onChange={(e) => updateCredit(track.key, credit.key, "role", e.target.value)}
                    placeholder="Role (e.g. Producer)"
                    className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <input
                    value={credit.name}
                    onChange={(e) => updateCredit(track.key, credit.key, "name", e.target.value)}
                    placeholder="Name"
                    className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <input
                    value={credit.split_percent}
                    onChange={(e) =>
                      updateCredit(track.key, credit.key, "split_percent", e.target.value)
                    }
                    placeholder="Split %"
                    inputMode="decimal"
                    className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeCredit(track.key, credit.key)}
                    aria-label="Remove credit"
                    className="px-1 text-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {savedAt && !error && <p className="text-sm text-emerald-700">Saved.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
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
