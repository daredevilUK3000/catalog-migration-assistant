"use client";

import { ReactNode } from "react";
import { useInView } from "@/lib/useInView";

interface FeatureSectionProps {
  eyebrow: string;
  title: string;
  description: string;
  visual: ReactNode;
  reverse?: boolean;
  tint: "ink" | "paper" | "forest";
}

const tintClasses: Record<FeatureSectionProps["tint"], string> = {
  ink: "bg-ink text-paper",
  paper: "bg-paper text-ink",
  forest: "bg-forest text-paper",
};

export default function FeatureSection({
  eyebrow,
  title,
  description,
  visual,
  reverse,
  tint,
}: FeatureSectionProps) {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);

  return (
    <section className={`relative overflow-hidden ${tintClasses[tint]}`}>
      <div
        ref={ref}
        className={`reveal ${inView ? "in-view" : ""} mx-auto max-w-6xl px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center ${
          reverse ? "md:[&>*:first-child]:order-2" : ""
        }`}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.25em] font-mono opacity-60 mb-3">
            {eyebrow}
          </p>
          <h3 className="font-display text-3xl md:text-4xl font-semibold leading-tight mb-4">
            {title}
          </h3>
          <p className="text-base md:text-lg opacity-80 max-w-md leading-relaxed">
            {description}
          </p>
        </div>
        <div>{visual}</div>
      </div>
    </section>
  );
}
