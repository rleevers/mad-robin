import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const handler = async (event) => {
  const slug = event.queryStringParameters?.slug;

  if (!slug) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "slug is required" }),
    };
  }

  try {
    const { data: inventory, error } = await supabase
      .from("event_inventory")
      .select("capacity")
      .eq("event_slug", slug)
      .single();

    if (error || !inventory) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ status: "unavailable" }),
      };
    }

    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const [{ data: confirmed }, { data: pending }] = await Promise.all([
      supabase
        .from("orders")
        .select("total_tickets")
        .eq("event_slug", slug)
        .eq("status", "confirmed"),
      supabase
        .from("orders")
        .select("total_tickets")
        .eq("event_slug", slug)
        .eq("status", "pending")
        .gte("created_at", thirtyMinsAgo),
    ]);

    const ticketsSold =
      [...(confirmed ?? []), ...(pending ?? [])].reduce(
        (sum, o) => sum + o.total_tickets,
        0
      );

    const total = inventory.capacity;
    const remaining = total - ticketsSold;

    let status;
    if (remaining <= 0) {
      status = "sold_out";
    } else if (remaining <= 10 || remaining / total <= 0.15) {
      status = "low";
    } else {
      status = "available";
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ remaining: Math.max(0, remaining), total, status }),
    };
  } catch (err) {
    console.error("event-availability error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
