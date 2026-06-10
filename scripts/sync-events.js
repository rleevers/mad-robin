import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function frontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  try {
    return parseYaml(match[1]);
  } catch {
    return null;
  }
}

function toDateString(value) {
  const s = value instanceof Date ? value.toISOString() : String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

async function syncEvents() {
  const eventsDir = join(__dirname, "../src/content/events");

  let files;
  try {
    files = await readdir(eventsDir);
  } catch (err) {
    console.error("[sync-events] Could not read events directory:", err.message);
    process.exit(0);
  }

  for (const file of files.filter((f) => f.endsWith(".md"))) {
    const slug = file.replace(".md", "");
    const data = frontmatter(await readFile(join(eventsDir, file), "utf-8"));
    if (!data || !Number.isInteger(data.capacity)) continue;

    const tiers = Array.isArray(data.tiers)
      ? data.tiers.map((t) => ({
          name: String(t.name),
          price: Number(t.price),
          earlyBirdPrice: t.earlyBirdPrice != null ? Number(t.earlyBirdPrice) : null,
        }))
      : null;
    const earlyBirdUntil =
      data.earlyBirdUntil != null ? toDateString(data.earlyBirdUntil) : null;

    let { error } = await supabase
      .from("event_inventory")
      .upsert(
        { event_slug: slug, capacity: data.capacity, tiers, early_bird_until: earlyBirdUntil },
        { onConflict: "event_slug" }
      );

    if (error) {
      // Pricing columns may not exist yet — keep the build green with the legacy shape
      console.error(`[sync-events] Full sync failed for ${slug} (${error.message}); retrying capacity only`);
      ({ error } = await supabase
        .from("event_inventory")
        .upsert({ event_slug: slug, capacity: data.capacity }, { onConflict: "event_slug" }));
    }

    if (error) {
      console.error(`[sync-events] Failed to sync ${slug}:`, error.message);
    } else {
      console.log(
        `[sync-events] Synced: ${slug} (capacity: ${data.capacity}` +
          (tiers ? `, ${tiers.length} tiers` : "") +
          (earlyBirdUntil ? `, early bird until ${earlyBirdUntil}` : "") +
          ")"
      );
    }
  }
}

syncEvents().catch((err) => {
  console.error("[sync-events] Fatal error:", err.message);
  process.exit(0);
});
