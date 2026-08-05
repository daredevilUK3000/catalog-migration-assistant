import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "./currentUser";

/**
 * Whether userId has purchased Own Your Music. A missing profiles row (never
 * purchased — rows are only created by the Stripe webhook on first
 * checkout.session.completed) is treated the same as is_premium = false.
 */
export async function isPremiumUserId(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data?.is_premium);
}

export type RequirePremiumResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401; error: string }
  | { ok: false; status: 402; error: string };

/**
 * Server-side gate for premium-only actions (Export Pack generation,
 * Migration Report PDF, full multi-album Catalog Health). Call this from
 * every route/page that performs one of those actions — hiding the button
 * in the UI is not enforcement on its own.
 */
export async function requirePremiumUserId(): Promise<RequirePremiumResult> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, status: 401, error: "Not signed in." };
  }

  if (!(await isPremiumUserId(userId))) {
    return {
      ok: false,
      status: 402,
      error: "This feature is part of Own Your Music ($49, one-time). Buy at /billing to unlock it.",
    };
  }

  return { ok: true, userId };
}
