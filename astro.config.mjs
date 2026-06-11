import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import yaml from "@rollup/plugin-yaml";
import { readdirSync, readFileSync } from "node:fs";

// Slugs of events whose date has already passed (UTC calendar day). Past events
// are archived: kept reachable but dropped from the sitemap. Mirrors
// isEventPast() in src/lib/events.ts. Evaluated at build time, so events
// archive themselves on the next deploy.
function pastEventSlugs() {
  const dir = new URL("./src/content/events/", import.meta.url);
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const past = new Set();
  let files = [];
  try {
    files = readdirSync(dir);
  } catch {
    return past;
  }
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const m = readFileSync(new URL(file, dir), "utf-8").match(
      /^date:\s*["']?(\d{4})-(\d{2})-(\d{2})/m
    );
    if (!m) continue;
    if (Date.UTC(+m[1], +m[2] - 1, +m[3]) < todayUTC) {
      past.add(file.replace(/\.md$/, ""));
    }
  }
  return past;
}
const PAST_EVENTS = pastEventSlugs();

export default defineConfig({
  site: "https://madrobinband.co.uk",
  integrations: [
    sitemap({
      filter: (page) =>
        // Exclude admin and hidden pages until activated
        !page.includes("/admin") &&
        !page.includes("/success") &&
        !page.includes("/404") &&
        // Exclude archived (past) events
        ![...PAST_EVENTS].some((slug) =>
          page.replace(/\/$/, "").endsWith(`/events/${slug}`)
        ),
    }),
  ],
  vite: {
    plugins: [
      yaml(),
      {
        name: "admin-index-rewrite",
        configureServer(server) {
          // Rewrite /admin and /admin/ to /admin/index.html so that
          // Vite serves the static file from public/ instead of
          // Astro's 404 catch-all intercepting it.
          server.middlewares.use((req, _res, next) => {
            if (req.url === "/admin" || req.url === "/admin/") {
              req.url = "/admin/index.html";
            }
            next();
          });
        },
      },
    ],
  },
});
