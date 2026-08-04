import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Drop-in replacement for raw <div className="border rounded ..."> content
 * containers. Purely visual — wrap existing content as-is.
 */
export default function Card({ className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-ink/10 bg-white shadow-sm shadow-ink/[0.03] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
