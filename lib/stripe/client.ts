import Stripe from "stripe";

/**
 * Stripe client factory — mirrors the admin Supabase client convention
 * (lib/supabase/admin.ts): a fresh instance per call, server-side only,
 * never exposed to the browser.
 */
export function getStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}
