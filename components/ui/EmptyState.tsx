import { ReactNode } from "react";

interface EmptyStateProps {
  message: string;
  action?: ReactNode;
}

export default function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-ink/15 bg-ink/[0.02] px-6 py-10 text-center">
      <p className="text-ink/60">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
