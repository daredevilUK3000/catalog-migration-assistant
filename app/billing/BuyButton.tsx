"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function BuyButton({ priceLabel }: { priceLabel: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        setError(body.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button type="button" onClick={handleBuy} disabled={loading}>
        {loading ? "Redirecting…" : `Buy Own Your Music — ${priceLabel}`}
      </Button>
      {error && <p className="mt-2 text-sm text-rust">{error}</p>}
    </div>
  );
}
