import { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "neutral";

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
}

const tones: Record<Tone, string> = {
  success: "bg-brass/15 text-brass border-brass/30",
  warning: "bg-rust/10 text-rust border-rust/30",
  danger: "bg-rust/15 text-rust border-rust/40",
  neutral: "bg-ink/[0.05] text-ink/60 border-ink/15",
};

export default function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium font-mono ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
