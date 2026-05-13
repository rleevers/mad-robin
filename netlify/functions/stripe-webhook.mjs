import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export const handler = async (event) => {
  const sig = event.headers["stripe-signature"];

  let stripeEvent;
  try {
    // event.body must be the raw string — do NOT JSON.parse before this
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === "payment_intent.succeeded") {
    const paymentIntent = stripeEvent.data.object;

    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*")
      .eq("stripe_payment_intent_id", paymentIntent.id)
      .single();

    if (fetchErr || !order) {
      console.error("Order not found for PaymentIntent:", paymentIntent.id);
      return { statusCode: 200, body: JSON.stringify({ received: true }) };
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("stripe_payment_intent_id", paymentIntent.id);

    if (updateErr) {
      console.error("Failed to confirm order:", updateErr);
      return { statusCode: 500, body: "Failed to update order" };
    }

    const totalAmount = (paymentIntent.amount / 100).toFixed(2);

    try {
      await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to: order.buyer_email,
        subject: `Your tickets — ${order.event_title}`,
        html: buildEmail({ order, totalAmount }),
      });
    } catch (emailErr) {
      console.error("Email send failed:", emailErr);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

function buildEmail({ order, totalAmount }) {
  const ticketRows = order.tickets
    .map(
      (t) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e8e0d4;color:#2d3a2d;">
          ${t.quantity}&times; ${t.name}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #e8e0d4;text-align:right;font-weight:700;color:#2d3a2d;">
          &pound;${(t.price * t.quantity).toFixed(2)}
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf6f0;font-family:Georgia,serif;">
  <div style="max-width:580px;margin:0 auto;padding:40px 20px;">

    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="margin:0;font-size:26px;color:#c23b22;letter-spacing:0.02em;">Mad Robin</h1>
      <p style="margin:6px 0 0;color:#5a6b5a;font-size:14px;">Live Ceilidh &amp; Early English Music</p>
    </div>

    <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #d4d9d2;">
      <h2 style="margin:0 0 6px;color:#2d3a2d;font-size:22px;">You&rsquo;re booked in!</h2>
      <p style="margin:0 0 24px;color:#5a6b5a;">Hi ${order.buyer_name} &mdash; we&rsquo;ll see you on the dance floor.</p>

      <p style="margin:0 0 4px;font-weight:700;color:#2d3a2d;">${order.event_title}</p>
      <p style="margin:0 0 20px;color:#5a6b5a;font-size:14px;">${order.event_venue}</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${ticketRows}
        <tr>
          <td style="padding:14px 0 0;font-weight:700;color:#2d3a2d;">Total paid</td>
          <td style="padding:14px 0 0;text-align:right;font-weight:700;font-size:20px;color:#c23b22;">
            &pound;${totalAmount}
          </td>
        </tr>
      </table>

      <div style="background:#f5ece0;border-radius:8px;padding:16px;margin:24px 0;">
        <p style="margin:0;font-size:14px;color:#5a6b5a;">
          <strong style="color:#2d3a2d;">At the door:</strong> Just tell us your name &mdash; no need to print anything.
        </p>
      </div>

      <p style="margin:0;font-size:13px;color:#8a9a88;">
        Questions? Reply to this email or contact us at
        <a href="mailto:madrobinband@gmail.com" style="color:#c23b22;">madrobinband@gmail.com</a>
      </p>
    </div>

    <p style="text-align:center;color:#8a9a88;font-size:12px;margin-top:24px;">
      Mad Robin Ceilidh Band &middot; Exeter, Devon &middot;
      <a href="https://madrobinband.co.uk" style="color:#8a9a88;">madrobinband.co.uk</a>
    </p>
  </div>
</body>
</html>`;
}
