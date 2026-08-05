import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { isPremiumUserId } from "@/lib/auth/premium";
import { getStripeClient } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (await isPremiumUserId(userId)) {
    return NextResponse.json({ error: "You've already purchased Own Your Music." }, { status: 400 });
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId || !priceId.startsWith("price_")) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_ID is misconfigured — expected a Price ID (starts with \"price_\")." },
      { status: 500 }
    );
  }

  // Real Supabase Auth session only — DEV_USER_ID has no session/email to
  // prefill, Stripe Checkout just collects the email itself in that case.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const stripe = getStripeClient();
  const origin = request.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: userId,
    customer_email: user?.email,
    // Guarantees a Customer is attached to the resulting charge, so
    // charge.refunded / charge.dispute.created webhooks can map back to a
    // profiles row via stripe_customer_id.
    customer_creation: "always",
    metadata: { user_id: userId },
    success_url: `${origin}/billing?success=1`,
    cancel_url: `${origin}/billing?canceled=1`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
