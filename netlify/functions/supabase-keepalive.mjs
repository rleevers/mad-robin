import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Supabase pauses free projects after a week without database activity,
// which silently breaks ticket sales and the door list between gigs. This
// runs daily (see netlify.toml) and makes one cheap query to keep it awake.
export const handler = async () => {
  const { error } = await supabase
    .from("event_inventory")
    .select("event_slug", { count: "exact", head: true });

  if (error) {
    console.error("supabase-keepalive error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
