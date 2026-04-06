import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import yaml from "@rollup/plugin-yaml";

export default defineConfig({
  site: "https://madrobinceilidh.co.uk",
  integrations: [
    sitemap({
      filter: (page) =>
        // Exclude admin and hidden pages until activated
        !page.includes("/admin") &&
        !page.includes("/success") &&
        !page.includes("/404"),
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
