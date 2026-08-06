"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MigrationRecord, TakedownStatus } from "@/types/catalog";
import {
  estimateTakedown,
  formatTakedownEstimate,
  DEFAULT_TAKEDOWN_MIN_DAYS,
  DEFAULT_TAKEDOWN_MAX_DAYS,
} from "@/lib/takedownEstimate";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

export interface TakedownRow {
  record: MigrationRecord;
  albumTitle: string;
  albumArtist: string;
  sourceName: string | null;
  targetName: string;
}

type FilterValue = "all" | TakedownStatus;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "not_requested", label: "Not requested" },
  { value: "requested", label: "Requested" },
  { value: "processing", label: "Processing" },
  { value: "cleared", label: "Cleared" },
];

const STATUS_TONE: Record<TakedownStatus, "neutral" | "warning" | "success"> = {
  not_requested: "neutral",
  requested: "warning",
  processing: "warning",
  cleared: "success",
};

const STATUS_LABEL: Record<TakedownStatus, string> = {
  not_requested: "Not requested",
  requested: "Requested",
  processing: "Processing",
  cleared: "Cleared",
};

export default function TakedownTable({ rows }: { rows: TakedownRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [estMin, setEstMin] = useState(String(DEFAULT_TAKEDOWN_MIN_DAYS));
  const [estMax, setEstMax] = useState(String(DEFAULT_TAKEDOWN_MAX_DAYS));
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [rowLoading, setRowLoading] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string | null>>({});

  const counts = useMemo(() => {
    const c: Record<FilterValue, number> = {
      all: rows.length,
      not_requested: 0,
      requested: 0,
      processing: 0,
      cleared: 0,
    };
    for (const row of rows) c[row.record.takedown_status]++;
    return c;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const filtered = filter === "all" ? rows : rows.filter((r) => r.record.takedown_status === filter);
    // Oldest requested first — those closest to clearing surface at the top.
    return [...filtered].sort((a, b) => {
      const order: TakedownStatus[] = ["requested", "processing", "not_requested", "cleared"];
      const orderDiff = order.indexOf(a.record.takedown_status) - order.indexOf(b.record.takedown_status);
      if (orderDiff !== 0) return orderDiff;
      const aTime = a.record.requested_at ? new Date(a.record.requested_at).getTime() : 0;
      const bTime = b.record.requested_at ? new Date(b.record.requested_at).getTime() : 0;
      return aTime - bTime;
    });
  }, [rows, filter]);

  const eligibleForBatch = visibleRows.filter((r) => r.record.takedown_status === "not_requested");
  const allEligibleSelected =
    eligibleForBatch.length > 0 && eligibleForBatch.every((r) => selected.has(r.record.id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllEligible() {
    setSelected((prev) => {
      if (allEligibleSelected) {
        const next = new Set(prev);
        for (const r of eligibleForBatch) next.delete(r.record.id);
        return next;
      }
      const next = new Set(prev);
      for (const r of eligibleForBatch) next.add(r.record.id);
      return next;
    });
  }

  async function handleBatchRequest() {
    const min = Number(estMin);
    const max = Number(estMax);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
      setBatchError("Enter a valid day range (min ≤ max).");
      return;
    }
    if (
      !window.confirm(
        `Mark ${selected.size} album${selected.size === 1 ? "" : "s"} as takedown-requested, dated today?`
      )
    ) {
      return;
    }

    setBatchLoading(true);
    setBatchError(null);
    try {
      const res = await fetch("/api/migrations/takedown-batch-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_ids: [...selected],
          estimated_days_min: min,
          estimated_days_max: max,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setBatchError(body.error ?? "Request failed.");
        return;
      }
      setSelected(new Set());
      router.refresh();
    } catch {
      setBatchError("Could not reach the server.");
    } finally {
      setBatchLoading(false);
    }
  }

  async function advanceStatus(recordId: string, nextStatus: TakedownStatus) {
    setRowLoading((prev) => ({ ...prev, [recordId]: true }));
    setRowError((prev) => ({ ...prev, [recordId]: null }));
    try {
      const res = await fetch("/api/migrations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, takedown_status: nextStatus }),
      });
      const body = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [recordId]: body.error ?? "Update failed." }));
        return;
      }
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [recordId]: "Could not reach the server." }));
    } finally {
      setRowLoading((prev) => ({ ...prev, [recordId]: false }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? "border-ink bg-ink text-paper"
                : "border-ink/20 text-ink/60 hover:border-ink/40 hover:text-ink"
            }`}
          >
            {f.label} <span className="text-xs opacity-70">({counts[f.value]})</span>
          </button>
        ))}
      </div>

      {eligibleForBatch.length > 0 && (
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={allEligibleSelected}
                onChange={toggleAllEligible}
                className="h-4 w-4"
              />
              Select all not-yet-requested in view ({eligibleForBatch.length})
            </label>
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-3">
              <label className="text-sm text-ink/70">
                Estimated window (days):
                <input
                  type="number"
                  min={0}
                  value={estMin}
                  onChange={(e) => setEstMin(e.target.value)}
                  className="ml-2 w-16 rounded border border-ink/20 px-2 py-1"
                />
                <span className="mx-1">–</span>
                <input
                  type="number"
                  min={0}
                  value={estMax}
                  onChange={(e) => setEstMax(e.target.value)}
                  className="w-16 rounded border border-ink/20 px-2 py-1"
                />
              </label>
              <Button type="button" onClick={handleBatchRequest} disabled={batchLoading}>
                {batchLoading
                  ? "Applying…"
                  : `Mark ${selected.size} selected as Requested`}
              </Button>
              {batchError && <p className="text-sm text-rust">{batchError}</p>}
            </div>
          )}
        </Card>
      )}

      <ul className="space-y-3">
        {visibleRows.map(({ record, albumTitle, albumArtist, sourceName, targetName }) => {
          const status = record.takedown_status;
          const estimate =
            record.requested_at && record.estimated_days_min != null && record.estimated_days_max != null
              ? estimateTakedown(record.requested_at, record.estimated_days_min, record.estimated_days_max)
              : null;
          const loading = rowLoading[record.id] ?? false;

          return (
            <li key={record.id}>
              <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  {status === "not_requested" && (
                    <input
                      type="checkbox"
                      checked={selected.has(record.id)}
                      onChange={() => toggleRow(record.id)}
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {albumTitle} <span className="font-normal text-ink/50">— {albumArtist}</span>
                    </p>
                    <p className="text-sm text-ink/50">
                      {sourceName ?? "Unknown source"} → {targetName}
                    </p>
                    {estimate && (
                      <p className="mt-1 text-sm text-ink/70">{formatTakedownEstimate(estimate)}</p>
                    )}
                    {rowError[record.id] && (
                      <p className="mt-1 text-sm text-rust">{rowError[record.id]}</p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                  {status === "requested" && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={loading}
                      onClick={() => advanceStatus(record.id, "processing")}
                    >
                      {loading ? "…" : "Mark Processing"}
                    </Button>
                  )}
                  {status === "processing" && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={loading}
                      onClick={() => advanceStatus(record.id, "cleared")}
                    >
                      {loading ? "…" : "Mark Cleared"}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
