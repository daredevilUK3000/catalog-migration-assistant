interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * The icon mark: a vinyl-groove badge with a departure arrow, echoing the
 * VinylRings background shape already used on the landing page. Pair with
 * the live "OwnYourMusic" text (already styled in Big Shoulders via the
 * nav) — this component is icon-only, deliberately not a rasterized
 * wordmark, so the text always renders crisp in the real brand font.
 */
export default function LogoMark({ size = 40, className = "" }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="OwnYourMusic"
    >
      <rect width="200" height="200" rx="36" fill="#0a1112" />
      <circle cx="100" cy="100" r="72" fill="#10191a" stroke="#c89b3c" strokeOpacity="0.25" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="60" fill="none" stroke="#c89b3c" strokeOpacity="0.4" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="48" fill="none" stroke="#c89b3c" strokeOpacity="0.55" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="36" fill="none" stroke="#e0b559" strokeOpacity="0.7" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="24" fill="#e0b559" />
      <circle cx="100" cy="100" r="6" fill="#0a1112" />
      <path d="M 128 72 L 152 48" stroke="#e0b559" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M 152 48 L 152 64 M 152 48 L 136 48"
        stroke="#e0b559"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
