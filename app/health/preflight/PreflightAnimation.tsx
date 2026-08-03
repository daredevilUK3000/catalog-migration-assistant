"use client";

import { useEffect, useState } from "react";
import type { PreflightStep, ScoreBand } from "@/lib/migrationScore";
import { SCORE_FRAMING_NOTE } from "@/lib/migrationScore";
import { ScoreBadge, ScoreProgressBar } from "../scoreDisplay";

const STEP_DELAY_MS = 550;
const COUNT_UP_TICK_MS = 20;

export default function PreflightAnimation({
  steps,
  finalScore,
  finalBand,
  weakestLabel,
}: {
  steps: PreflightStep[];
  finalScore: number;
  finalBand: ScoreBand;
  weakestLabel?: string;
}) {
  const [doneCount, setDoneCount] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const running = doneCount < steps.length;

  // Advances one step at a time — each item shows as "checking…" for one
  // tick, then resolves, before the next item appears.
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setDoneCount((n) => n + 1), STEP_DELAY_MS);
    return () => clearTimeout(t);
  }, [running, doneCount]);

  useEffect(() => {
    if (running) return;
    const t = setTimeout(() => setShowScore(true), STEP_DELAY_MS);
    return () => clearTimeout(t);
  }, [running]);

  // Counts the score up rather than popping straight to the final number.
  useEffect(() => {
    if (!showScore || displayScore >= finalScore) return;
    const step = Math.max(1, Math.round(finalScore / 25));
    const t = setTimeout(() => setDisplayScore((n) => Math.min(finalScore, n + step)), COUNT_UP_TICK_MS);
    return () => clearTimeout(t);
  }, [showScore, displayScore, finalScore]);

  return (
    <div className="space-y-6">
      <ul className="space-y-3 rounded-lg border border-neutral-200 bg-white p-6">
        {steps.slice(0, doneCount + (running ? 1 : 0)).map((step, i) => {
          const resolved = i < doneCount;
          return (
            <li key={step.key} className="preflight-step-enter flex items-start gap-3 text-sm">
              <span className="mt-0.5 w-4 shrink-0 text-center">
                {!resolved ? (
                  <span className="inline-block animate-spin text-neutral-400">◐</span>
                ) : step.ok ? (
                  <span className="text-emerald-600">✓</span>
                ) : (
                  <span className="text-amber-600">⚠</span>
                )}
              </span>
              <span>
                <span className="font-medium text-neutral-900">{step.label}</span>
                {resolved && <span className="text-neutral-500"> — {step.detail}</span>}
                {!resolved && <span className="text-neutral-400"> — checking…</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {showScore && (
        <div className="preflight-step-enter space-y-3 rounded-lg border border-neutral-200 bg-white p-6">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-semibold text-neutral-900">{displayScore}%</span>
            <ScoreBadge band={finalBand} />
          </div>
          <ScoreProgressBar score={displayScore} band={finalBand} />
          {weakestLabel && <p className="text-sm text-neutral-500">Weakest album: {weakestLabel}</p>}
          <p className="text-xs text-neutral-500">{SCORE_FRAMING_NOTE}</p>
        </div>
      )}
    </div>
  );
}
