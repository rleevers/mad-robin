import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { event_slug, event_title, event_venue, tickets, buyer_name, buyer_email } = body;

  if (!event_slug || !event_title || !event_venue || !tickets?.length || !buyer_name || !buyer_email) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  const totalTickets = tickets.reduce((sum, t) => sum + t.quantity, 0);

  if (
    totalTickets < 1 ||
    totalTickets > 8 ||
    tickets.some((t) => !Number.isInteger(t.quantity) || t.quantity < 1)
  ) {
    return { statusCode: 400, body: JSON.stringify({ error: "Quantity must be between 1 and 8" }) };
  }

  try {
    // Check availability (pricing columns may not exist until the migration runs)
    let { data: inventory, error: invErr } = await supabase
      .from("event_inventory")
      .select("capacity, tiers, early_bird_until")
      .eq("event_slug", event_slug)
      .single();

    if (invErr) {
      ({ data: inventory, error: invErr } = await supabase
        .from("event_inventory")
        .select("capacity")
        .eq("event_slug", event_slug)
        .single());
    }

    if (invErr || !inventory) {
      return { statusCode: 404, body: JSON.stringify({ error: "Event not found" }) };
    }

    // Price tickets from the synced tier list, never from the client. Early bird
    // applies through the end of the deadline day (date-only, parsed as UTC
    // midnight, hence +24h) plus an hour's grace for buyers who loaded the page
    // just before it passed.
    const trustedTiers =
      Array.isArray(inventory.tiers) && inventory.tiers.length ? inventory.tiers : null;
    let pricedTickets = tickets;
    if (trustedTiers) {
      const ebEnds = inventory.early_bird_until
        ? Date.parse(inventory.early_bird_until) + 25 * 60 * 60 * 1000
        : 0;
      const earlyBird = Date.now() < ebEnds;
      pricedTickets = [];
      for (const t of tickets) {
        const tier = trustedTiers.find((x) => x.name === t.name);
        if (!tier) {
          return { statusCode: 400, body: JSON.stringify({ error: `Unknown ticket type: ${t.name}` }) };
        }
        const price = earlyBird && tier.earlyBirdPrice != null ? tier.earlyBirdPrice : tier.price;
        pricedTickets.push({ name: tier.name, quantity: t.quantity, price });
      }
    }

    const totalAmount = pricedTickets.reduce((sum, t) => sum + t.price * t.quantity, 0);

    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const [{ data: confirmed }, { data: pending }] = await Promise.all([
      supabase.from("orders").select("total_tickets").eq("event_slug", event_slug).eq("status", "confirmed"),
      supabase.from("orders").select("total_tickets").eq("event_slug", event_slug).eq("status", "pending").gte("created_at", thirtyMinsAgo),
    ]);

    const ticketsSold = [...(confirmed ?? []), ...(pending ?? [])].reduce((sum, o) => sum + o.total_tickets, 0);
    const remaining = inventory.capacity - ticketsSold;

    if (remaining < totalTickets) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: "Not enough tickets available", remaining: Math.max(0, remaining) }),
      };
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100),
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      metadata: { event_slug },
    });

    // Reserve tickets
    const { error: orderErr } = await supabase.from("orders").insert({
      event_slug,
      event_title,
      event_venue,
      stripe_payment_intent_id: paymentIntent.id,
      buyer_name,
      buyer_email,
      tickets: pricedTickets,
      total_tickets: totalTickets,
      status: "pending",
    });

    if (orderErr) {
      await stripe.paymentIntents.cancel(paymentIntent.id);
      throw orderErr;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };
  } catch (err) {
    console.error("create-checkout error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
