"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunHealthCheckButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/health/run", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Health check failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleRun}
        disabled={running}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {running ? "Checking…" : "Run health check"}
      </button>
      {error && <p className="mt-2 max-w-xs text-sm text-red-600">{error}</p>}
    </div>
  );
}
