import { createClient } from "@supabase/supabase-js";

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

  const { slug, password, order_id, checked_in } = body;

  if (!password || password !== process.env.DOOR_LIST_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorised" }) };
  }

  if (!slug || !order_id || !Number.isInteger(checked_in) || checked_in < 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request" }) };
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ checked_in })
    .eq("id", order_id)
    .eq("event_slug", slug)
    .select("id");

  if (error) {
    console.error("door-checkin error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to update check-in" }) };
  }

  if (!data?.length) {
    return { statusCode: 404, body: JSON.stringify({ error: "Order not found" }) };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};
