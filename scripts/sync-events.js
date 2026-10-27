import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function syncEvents() {
  const eventsDir = join(__dirname, "../src/content/events");

  let files;
  try {
    files = await readdir(eventsDir);
  } catch (err) {
    console.error("[sync-events] Could not read events directory:", err.message);
    process.exit(0);
  }

  const markdownFiles = files.filter((f) => f.endsWith(".md"));
  let failed = 0;

  for (const file of markdownFiles) {
    const slug = file.replace(".md", "");
    const content = await readFile(join(eventsDir, file), "utf-8");

    const capacityMatch = content.match(/^capacity:\s*(\d+)/m);
    if (!capacityMatch) continue;

    const capacity = parseInt(capacityMatch[1], 10);

    const { error } = await supabase
      .from("event_inventory")
      .upsert({ event_slug: slug, capacity }, { onConflict: "event_slug" });

    if (error) {
      console.error(`[sync-events] Failed to sync ${slug}:`, error.message);
      failed++;
    } else {
      console.log(`[sync-events] Synced: ${slug} (capacity: ${capacity})`);
    }
  }

  // Fail the deploy rather than publish events whose tickets can't be sold
  // (e.g. Supabase paused). The previous deploy stays live meanwhile.
  if (failed > 0) {
    throw new Error(`${failed} event(s) failed to sync to Supabase`);
  }
}

syncEvents().catch((err) => {
  console.error("[sync-events] Fatal error:", err.message);
  process.exit(1);
});
