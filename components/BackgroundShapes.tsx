export function VinylRings({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 600 600"
      fill="none"
      aria-hidden="true"
    >
      {[280, 230, 180, 130, 80].map((r) => (
        <circle
          key={r}
          cx="300"
          cy="300"
          r={r}
          stroke="currentColor"
          strokeOpacity="0.08"
          strokeWidth="1.5"
        />
      ))}
      <circle cx="300" cy="300" r="18" fill="currentColor" fillOpacity="0.1" />
    </svg>
  );
}

export function TapePerforation({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 800 40"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {Array.from({ length: 40 }).map((_, i) => (
        <rect
          key={i}
          x={i * 20 + 4}
          y="16"
          width="8"
          height="8"
          rx="2"
          fill="currentColor"
          fillOpacity="0.12"
        />
      ))}
    </svg>
  );
}

export function WaveformLine({ className = "" }: { className?: string }) {
  const bars = Array.from({ length: 60 }, (_, i) =>
    Math.abs(Math.sin(i * 0.35) * 0.6 + Math.sin(i * 0.11) * 0.4)
  );
  return (
    <svg
      className={className}
      viewBox="0 0 600 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 10}
          y={50 - h * 45}
          width="4"
          height={h * 90}
          fill="currentColor"
          fillOpacity="0.1"
        />
      ))}
    </svg>
  );
}
