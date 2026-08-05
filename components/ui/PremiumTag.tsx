/**
 * Inline marker for a premium-gated action (Export Pack, Migration Report
 * PDF, full multi-album Catalog Health) — purely informational, the actual
 * enforcement is server-side (see lib/auth/premium.ts). Distinct from the
 * catalog-locked upsell banners: this marks *which* controls are part of
 * the paid feature set, regardless of whether the viewer has unlocked them.
 */
export default function PremiumTag({ unlocked }: { unlocked: boolean }) {
  return (
    <span
      className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        unlocked ? "bg-brass/15 text-brass" : "bg-ink/[0.06] text-ink/40"
      }`}
      title={
        unlocked
          ? "Included in your Own Your Music purchase"
          : "Premium feature — part of Own Your Music ($49, one-time)"
      }
    >
      {unlocked ? "✓ Premium" : "Premium"}
    </span>
  );
}
