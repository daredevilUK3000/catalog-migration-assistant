import Link from "next/link";
import { redirect } from "next/navigation";
import Card from "@/components/ui/Card";
import FeatureSection from "@/components/FeatureSection";
import ExportVisual from "@/components/visuals/ExportVisual";
import ReportVisual from "@/components/visuals/ReportVisual";
import HealthVisual from "@/components/visuals/HealthVisual";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import BuyButton from "./BuyButton";
import BillingHero from "./BillingHero";
import BillingTrust from "./BillingTrust";

// Reads live purchase state and (for unpurchased users) a live Stripe price
// — must not be prerendered as static build-time HTML.
export const dynamic = "force-dynamic";

const BUY_BUTTON_CLASS = "px-8 py-4 text-base";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const { success, canceled } = await searchParams;

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium, purchased_at")
    .eq("id", userId)
    .maybeSingle();

  const isPremium = Boolean(profile?.is_premium);
  // Fixed locale, formatted once on the server — BillingHero is a client
  // component, so re-formatting a raw date client-side during hydration
  // would use the browser's locale and could disagree with the server's.
  const purchasedAtLabel = profile?.purchased_at
    ? new Date(profile.purchased_at).toLocaleDateString("en-US")
    : null;

  // Display name is static copy, not something that needs a live fetch —
  // only the price amount does (see below). Matches the actual Stripe
  // product name, but isn't sourced from it, so there's nothing to
  // duplicate/diverge between the premium and non-premium states.
  const productName = "Own Your Music — Full Access";

  let priceLabel = "$49";

  // Fetched live every time the buy button needs to show a price — never
  // hardcode the amount. A Product ID (prod_...) here instead of a Price ID
  // (price_...) is the one bug that's already bitten this exact flow
  // elsewhere in this portfolio (showed "No price configured").
  if (!isPremium) {
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId || !priceId.startsWith("price_")) {
      throw new Error(
        `STRIPE_PRICE_ID must be a Price ID (starts with "price_") — got ${JSON.stringify(priceId)}. A Product ID (prod_...) won't resolve to an amount.`
      );
    }

    const stripe = getStripeClient();
    const price = await stripe.prices.retrieve(priceId);
    if (price.unit_amount == null) {
      throw new Error("Stripe price has no unit_amount configured.");
    }

    priceLabel = (price.unit_amount / 100).toLocaleString(undefined, {
      style: "currency",
      currency: price.currency.toUpperCase(),
      minimumFractionDigits: price.unit_amount % 100 === 0 ? 0 : 2,
    });
  }

  return (
    <main>
      <BillingHero
        isPremium={isPremium}
        productName={productName}
        priceLabel={priceLabel}
        purchasedAtLabel={purchasedAtLabel}
        success={success === "1"}
        canceled={canceled === "1"}
      />

      {/* ============================================================
          FEATURE SHOWCASE
          ============================================================ */}
      <FeatureSection
        tint="paper"
        eyebrow="Included · Export Pack"
        title="A ready-to-submit reference sheet for any distributor."
        description="Generate a field-by-field export pack mapped to exactly what your next distributor's upload form asks for — in the order it asks for it. Bulk CSV where it's supported, a copy-paste reference sheet where it isn't."
        visual={<ExportVisual />}
      />

      <FeatureSection
        tint="ink"
        reverse
        eyebrow="Included · Migration Report"
        title="A PDF paper trail for every migration, every album."
        description="A shareable, printable report of your catalog's readiness — issues found, confidence score, and what still needs attention — before you commit to a switch."
        visual={<ReportVisual />}
      />

      <FeatureSection
        tint="forest"
        eyebrow="Included · Catalog Health"
        title="Full confidence scoring, across your whole catalog."
        description="Free accounts see health for one album. Own Your Music unlocks deterministic validation — missing ISRCs, duplicate codes, artwork, credits — scored across every album you have, not just the first."
        visual={<HealthVisual />}
      />

      {/* ============================================================
          TRUST
          ============================================================ */}
      <BillingTrust />

      {/* ============================================================
          CLOSING CTA
          ============================================================ */}
      <section className="bg-paper px-6 py-20">
        <div className="mx-auto max-w-xl">
          <Card className="space-y-5 p-8 text-center sm:p-10">
            {isPremium ? (
              <>
                <p className="font-display text-2xl font-semibold text-ink">
                  Thanks for backing Own Your Music.
                </p>
                <p className="text-ink/60">
                  Everything above is live on your account right now — no further setup needed.
                </p>
                <Link
                  href="/health"
                  className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-brass px-6 py-3 text-sm font-semibold text-ink-deep transition-colors hover:bg-brass-bright"
                >
                  Go to Catalog health
                </Link>
              </>
            ) : (
              <>
                <p className="font-display text-3xl font-semibold text-ink">{priceLabel}</p>
                <p className="text-sm uppercase tracking-wide text-ink/40">One-time payment</p>
                <ul className="mx-auto max-w-xs space-y-2 text-left text-sm text-ink/70">
                  {[
                    "Export Pack generation, any distributor",
                    "Migration Report PDFs, unlimited",
                    "Full catalog health across every album",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <span className="mt-0.5 text-brass">✓</span>
                      {line}
                    </li>
                  ))}
                </ul>
                <BuyButton priceLabel={priceLabel} className={BUY_BUTTON_CLASS} />
                <p className="text-xs text-ink/40">
                  Refunds available within 14 days — see the{" "}
                  <Link href="/terms" className="underline hover:text-brass">
                    Terms of Service
                  </Link>
                  .
                </p>
              </>
            )}
          </Card>
        </div>
      </section>
    </main>
  );
}
