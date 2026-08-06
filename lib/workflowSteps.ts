// The five destinations of the guided catalog-migration workflow, in order.
// Single source of truth for step numbering — used both for the "Step N of
// 5" orientation label on each page's header and for the bold NextStepBanner
// shown when a step's action is complete, so the two never drift apart.
export interface WorkflowStep {
  n: number;
  label: string;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { n: 1, label: "Import" },
  { n: 2, label: "Attach files" },
  { n: 3, label: "Catalog health" },
  { n: 4, label: "Export pack" },
  { n: 5, label: "Migration tracker" },
];

export const TOTAL_WORKFLOW_STEPS = WORKFLOW_STEPS.length;

/** e.g. "Step 2 of 5 · Attach files" — for a page's PageHeader eyebrow. */
export function stepEyebrow(n: number): string {
  const step = WORKFLOW_STEPS.find((s) => s.n === n);
  return `Step ${n} of ${TOTAL_WORKFLOW_STEPS}${step ? ` · ${step.label}` : ""}`;
}
