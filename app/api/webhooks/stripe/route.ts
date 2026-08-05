import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function revokePremiumByCustomerId(customerId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_premium: false })
    .eq("stripe_customer_id", customerId);
  if (error) {
    throw new Error(`Failed to revoke access: ${error.message}`);
  }
}

function customerIdOf(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe signature or webhook secret." }, { status: 400 });
  }

  // Raw body required — Stripe's signature is computed over the exact bytes
  // sent, so this must not go through request.json() first.
  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature.";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.user_id ?? null;
        const customerId = customerIdOf(session.customer);

        if (userId && session.payment_status === "paid") {
          const supabase = createAdminClient();
          const { error } = await supabase.from("profiles").upsert(
            {
              id: userId,
              is_premium: true,
              purchased_at: new Date().toISOString(),
              stripe_customer_id: customerId,
            },
            { onConflict: "id" }
          );
          if (error) {
            return NextResponse.json({ error: `Failed to record purchase: ${error.message}` }, { status: 500 });
          }
        }
        break;
      }

      // Refund policy published on /terms — a refund or a won dispute both
      // mean the purchase is reversed, so access is revoked the same way.
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const customerId = customerIdOf(charge.customer);
        if (customerId) {
          await revokePremiumByCustomerId(customerId);
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
        if (chargeId) {
          // Dispute payloads carry the charge id, not the customer id —
          // one extra lookup to resolve it.
          const charge = await stripe.charges.retrieve(chargeId);
          const customerId = customerIdOf(charge.customer);
          if (customerId) {
            await revokePremiumByCustomerId(customerId);
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
