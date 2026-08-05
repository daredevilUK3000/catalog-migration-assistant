import Link from "next/link";
import { redirect } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import BuyButton from "./BuyButton";

// Reads live purchase state and (for unpurchased users) a live Stripe price
// — must not be prerendered as static build-time HTML.
export const dynamic = "force-dynamic";

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

  let priceLabel = "$49";
  let productName = "Own Your Music";

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
    const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    if (price.unit_amount == null) {
      throw new Error("Stripe price has no unit_amount configured.");
    }

    priceLabel = (price.unit_amount / 100).toLocaleString(undefined, {
      style: "currency",
      currency: price.currency.toUpperCase(),
      minimumFractionDigits: price.unit_amount % 100 === 0 ? 0 : 2,
    });

    const product = price.product;
    if (product && typeof product !== "string" && !product.deleted) {
      productName = product.name;
    }
  }

  return (
    <main className="min-h-screen bg-paper px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Billing"
          description="One-time purchase. No subscription, no recurring charge."
        />

        {canceled === "1" && !isPremium && (
          <Card className="border-ink/15 p-4">
            <p className="text-sm text-ink/70">Checkout canceled — no charge was made.</p>
          </Card>
        )}

        <Card className="space-y-4 p-8">
          {isPremium ? (
            <>
              <p className="text-lg font-semibold text-ink">You own {productName}.</p>
              {profile?.purchased_at && (
                <p className="text-sm text-ink/60">
                  Purchased {new Date(profile.purchased_at).toLocaleDateString()}
                </p>
              )}
              {success === "1" && (
                <p className="text-sm text-brass">Thanks — your purchase is confirmed.</p>
              )}
              <p className="text-sm text-ink/60">
                Full access to Export Pack generation, Migration Report PDFs, and full catalog
                health scoring across every album.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-ink">{productName}</p>
              <p className="text-ink/70">
                Full access to Export Pack generation, Migration Report PDFs, and full catalog
                health scoring across every album — permanently, for a single payment.
              </p>
              <BuyButton priceLabel={priceLabel} />
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
    </main>
  );
}
