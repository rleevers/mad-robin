import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const events = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/events" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    venue: z.string(),
    address: z.string().optional(),
    description: z.string(),
    ticketLink: z.string().url().optional(),
    ticketPrice: z.string().optional(),
    image: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const testimonials = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/testimonials" }),
  schema: z.object({
    clientName: z.string(),
    eventType: z.enum([
      "Wedding",
      "Corporate",
      "Private Party",
      "Public Ceilidh",
      "Other",
    ]),
    venue: z.string().optional(),
    date: z.coerce.date().optional(),
    photo: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const gallery = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/gallery" }),
  schema: z.object({
    image: z.string(),
    alt: z.string(),
    caption: z.string().optional(),
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
    role: z.string().optional(),
    photo: z.string().optional(),
    sortOrder: z.number().default(0),
    isCaller: z.boolean().default(false),
  }),
});

const faq = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/faq" }),
  schema: z.object({
    question: z.string(),
    category: z
      .enum(["General", "Booking", "On the Day", "Music"])
      .default("General"),
    sortOrder: z.number().default(0),
  }),
});

const packages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/packages" }),
  schema: z.object({
    name: z.string(),
    startingPrice: z.string(),
    features: z.array(z.string()),
    popular: z.boolean().default(false),
    sortOrder: z.number().default(0),
  }),
});

export const collections = {
  events,
  testimonials,
  gallery,
  members,
  faq,
  packages,
};
