interface Option {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * Drop-in replacement for a row of toggle buttons (e.g. Source type:
 * Screenshot / PDF / CSV-Excel). Keep the same onChange wiring you
 * already have — this only changes how the options render.
 */
export default function SegmentedControl({
  options,
  value,
  onChange,
}: SegmentedControlProps) {
  return (
    <div className="inline-flex rounded-md border border-ink/15 bg-ink/[0.02] p-1 gap-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`focus-ring rounded px-4 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-ink text-paper" : "text-ink/60 hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
