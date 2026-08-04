"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

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
      <Button type="button" onClick={handleRun} disabled={running}>
        {running ? "Checking…" : "Run health check"}
      </Button>
      {error && <p className="mt-2 max-w-xs text-sm text-rust">{error}</p>}
    </div>
  );
}
