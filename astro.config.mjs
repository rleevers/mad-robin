import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://madrobinceilidh.co.uk",
  integrations: [
    sitemap({
      filter: (page) =>
        // Exclude admin and hidden pages until activated
        !page.includes("/admin") &&
        !page.includes("/gallery") &&
        !page.includes("/events") &&
        !page.includes("/what-is-a-ceilidh") &&
        !page.includes("/success") &&
        !page.includes("/404"),
    }),
  ],
});
