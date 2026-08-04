import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const base =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-brass text-ink-deep hover:bg-brass-bright",
  secondary:
    "bg-transparent border border-ink/20 text-ink hover:bg-ink/[0.04] hover:border-ink/35",
  ghost: "bg-transparent text-ink/70 hover:text-ink hover:bg-ink/[0.04]",
};

/**
 * Drop-in replacement for raw <button className="..."> elements.
 * Keep all existing onClick/type/disabled/form props — this only changes
 * appearance, never behavior.
 */
export default function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
