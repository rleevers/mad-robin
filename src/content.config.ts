import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const events = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/events" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    venue: z.string(),
    address: z.string().optional(),
    mapLink: z.string().url().optional(),
    description: z.string(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    sheetMusicPdf: z.string().optional(),
    ticketingEnabled: z.boolean().optional(),
    ticketUrl: z.string().url().optional(),
    capacity: z.number().int().positive().optional(),
    tiers: z.array(z.object({ name: z.string(), price: z.number() })).optional(),
  }),
});

const testimonials = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/testimonials" }),
  schema: z.object({
    clientName: z.string(),
    eventType: z
      .enum(["Wedding", "Corporate", "Private Party", "Public Ceilidh", "Other"])
      .optional(),
    venue: z.string().optional(),
    rating: z.number().int().min(1).max(5).optional(),
    source: z.string().optional(),
    featured: z.boolean().default(false),
    sortOrder: z.number().default(0),
  }),
});

const gallery = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/gallery" }),
  schema: z.object({
    title: z.string(),
    alt: z.string().optional(),
    image: z.string().optional(),
    video: z.string().optional(),
    category: z.enum([
      "Weddings",
      "Barn Dances",
      "Private",
      "Public",
    ]),
    sortOrder: z.number().default(0),
  }),
});

const members = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/members" }),
  schema: z.object({
    name: z.string(),
    instrument: z.string(),
    photo: z.string().optional(),
    sortOrder: z.number().default(0),
  }),
});

const faq = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/faq" }),
  schema: z.object({
    question: z.string(),
    sortOrder: z.number().default(0),
  }),
});

export const collections = {
  events,
  testimonials,
  gallery,
  members,
  faq,
};
