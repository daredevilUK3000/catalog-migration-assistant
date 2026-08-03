"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Album,
  MigrationRecord,
  DistributorProfile,
  MigrationStatus,
  TakedownStatus,
} from "@/types/catalog";

const STATUS_STEPS: { value: MigrationStatus; label: string }[] = [
  { value: "imported", label: "Imported" },
  { value: "files_attached", label: "Files attached" },
  { value: "health_checked", label: "Health checked" },
  { value: "export_pack_generated", label: "Export pack generated" },
  { value: "uploaded", label: "Uploaded" },
  { value: "verified", label: "Verified" },
];

const TAKEDOWN_STEPS: { value: TakedownStatus; label: string }[] = [
  { value: "not_requested", label: "Not requested" },
  { value: "requested", label: "Requested" },
  { value: "processing", label: "Processing" },
  { value: "cleared", label: "Cleared" },
];

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MigrationRow({
  album,
  records,
  profiles,
}: {
  album: Album;
  records: MigrationRecord[];
  profiles: DistributorProfile[];
}) {
  return (
    <div className="space-y-4">
      <p className="font-medium text-neutral-900">
        {album.title} <span className="font-normal text-neutral-500">— {album.artist}</span>
      </p>

      {records.map((record) => (
        <MigrationRecordControls key={record.id} record={record} profiles={profiles} />
      ))}

      {profiles.length > 0 && (
        <StartMigrationForm albumId={album.id} profiles={profiles} hasExisting={records.length > 0} />
      )}
    </div>
  );
}

function StartMigrationForm({
  albumId,
  profiles,
  hasExisting,
}: {
  albumId: string;
  profiles: DistributorProfile[];
  hasExisting: boolean;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceSlug, setSourceSlug] = useState("");
  const [targetSlug, setTargetSlug] = useState("");

  async function handleStart(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!targetSlug) {
      setError("Choose a target distributor.");
      return;
    }

    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/migrations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          album_id: albumId,
          target_distributor_slug: targetSlug,
          source_distributor_slug: sourceSlug || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not start tracking this migration.");
        return;
      }
      setSourceSlug("");
      setTargetSlug("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <form
      onSubmit={handleStart}
      className={`flex flex-wrap items-end gap-3 ${hasExisting ? "border-t border-neutral-100 pt-4" : ""}`}
    >
      <label className="text-sm">
        <span className="block text-neutral-700">Source (optional)</span>
        <select
          value={sourceSlug}
          onChange={(e) => setSourceSlug(e.target.value)}
          className="mt-1 rounded border border-neutral-300 px-2 py-1.5"
        >
          <option value="">—</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.display_name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="block text-neutral-700">Target</span>
        <select
          value={targetSlug}
          onChange={(e) => setTargetSlug(e.target.value)}
          className="mt-1 rounded border border-neutral-300 px-2 py-1.5"
        >
          <option value="" disabled>
            Choose…
          </option>
          {profiles.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.display_name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={starting}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {starting ? "Starting…" : hasExisting ? "Track another target" : "Start tracking"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

function MigrationRecordControls({
  record,
  profiles,
}: {
  record: MigrationRecord;
  profiles: DistributorProfile[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceName = profiles.find((p) => p.id === record.source_distributor_id)?.display_name;
  const targetName = profiles.find((p) => p.id === record.target_distributor_id)?.display_name;
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.value === record.status);

  async function update(fields: { status?: MigrationStatus; takedown_status?: TakedownStatus }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/migrations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, ...fields }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Update failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  const uploadedAt = formatDate(record.uploaded_at);
  const verifiedAt = formatDate(record.verified_at);

  return (
    <div className="space-y-2 border-t border-neutral-100 pt-4">
      <p className="text-sm text-neutral-700">
        {sourceName ?? "Unknown source"} →{" "}
        <span className="font-medium">{targetName ?? "Unknown target"}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_STEPS.map((step, i) => (
          <button
            key={step.value}
            type="button"
            disabled={saving}
            onClick={() => update({ status: step.value })}
            className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 ${
              step.value === record.status
                ? "bg-neutral-900 text-white"
                : i <= currentStepIndex
                  ? "bg-neutral-200 text-neutral-700"
                  : "bg-neutral-100 text-neutral-400"
            }`}
          >
            {step.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-neutral-500">Takedown at source:</span>
        <select
          value={record.takedown_status}
          disabled={saving}
          onChange={(e) => update({ takedown_status: e.target.value as TakedownStatus })}
          className="rounded border border-neutral-300 px-2 py-1"
        >
          {TAKEDOWN_STEPS.map((step) => (
            <option key={step.value} value={step.value}>
              {step.label}
            </option>
          ))}
        </select>
      </label>

      {(uploadedAt || verifiedAt) && (
        <p className="text-xs text-neutral-500">
          {uploadedAt && `Uploaded ${uploadedAt}`}
          {uploadedAt && verifiedAt && " · "}
          {verifiedAt && `Verified ${verifiedAt}`}
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
