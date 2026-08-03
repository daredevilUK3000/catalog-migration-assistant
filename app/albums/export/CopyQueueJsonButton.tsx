"use client";

import { useState } from "react";

export default function CopyQueueJsonButton({ json }: { json: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCopy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not access the clipboard — select the text below and copy it manually.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
      >
        {copied ? "Copied!" : "Copy JSON"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
