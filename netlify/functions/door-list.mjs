import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const handler = async (event) => {
  const { slug, password } = event.queryStringParameters ?? {};

  if (!password || password !== process.env.DOOR_LIST_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorised" }) };
  }

  if (!slug) {
    return { statusCode: 400, body: JSON.stringify({ error: "slug is required" }) };
  }

  let { data: orders, error } = await supabase
    .from("orders")
    .select("id, buyer_name, buyer_email, tickets, total_tickets, confirmed_at, checked_in")
    .eq("event_slug", slug)
    .eq("status", "confirmed")
    .order("buyer_name", { ascending: true });

  if (error) {
    // checked_in column may not exist until the migration runs
    ({ data: orders, error } = await supabase
      .from("orders")
      .select("id, buyer_name, buyer_email, tickets, total_tickets, confirmed_at")
      .eq("event_slug", slug)
      .eq("status", "confirmed")
      .order("buyer_name", { ascending: true }));
  }

  if (error) {
    console.error("door-list error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch orders" }) };
  }

  const totalTickets = orders.reduce((sum, o) => sum + o.total_tickets, 0);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orders, totalTickets }),
  };
};
