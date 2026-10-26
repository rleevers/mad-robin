// Shared "is this event over?" rule. An event counts as past only once its
// whole calendar day has elapsed (in UTC), so a gig still shows on the day it
// happens rather than vanishing at midnight. Because the site is statically
// built, this is evaluated at build time — past events archive themselves on
// the next deploy. Keep this in sync with pastEventSlugs() in astro.config.mjs.
export function isEventPast(date: Date, now: Date = new Date()): boolean {
  const eventDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return eventDay < today;
}

type EventData = {
  title: string;
  date: Date;
  startTime?: string;
  endTime?: string;
  venue: string;
  address?: string;
  description: string;
  tiers?: { name: string; price: number }[];
};

// UK offset ("+00:00" GMT / "+01:00" BST) for a local date and time, so
// schema.org dates carry a timezone as Google expects.
function londonOffset(day: string, time: string): string {
  const tz =
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "longOffset" })
      .formatToParts(new Date(`${day}T${time}:00Z`))
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  return tz === "GMT" ? "+00:00" : tz.slice(3);
}

// Events with no end time are assumed to run two hours, matching the
// calendar links in CalendarButtons.astro.
export function eventEndTime(startTime: string, endTime?: string): string {
  if (endTime) return endTime;
  const [h, m] = startTime.split(":").map(Number);
  return `${String(h + 2).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// schema.org Event for Google's event rich results. `site` is Astro.site.
export function eventJsonLd(slug: string, data: EventData, site: URL) {
  const day = data.date.toISOString().split("T")[0];
  const at = (time: string) => `${day}T${time}:00${londonOffset(day, time)}`;
  const pageUrl = new URL(`/events/${slug}/`, site).href;
  const band = {
    "@type": "MusicGroup",
    name: "Mad Robin Ceilidh Band",
    url: site.href,
  };
  // Without a street address, fall back to the venue name, taking the town
  // from its last comma-separated part ("St James' Community Hall, Exeter").
  const venueParts = data.venue.split(",").map((s) => s.trim());
  const address = data.address
    ? { "@type": "PostalAddress", streetAddress: data.address, addressCountry: "GB" }
    : {
        "@type": "PostalAddress",
        streetAddress: venueParts[0],
        ...(venueParts.length > 1 ? { addressLocality: venueParts.at(-1) } : {}),
        addressCountry: "GB",
      };

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: data.title,
    startDate: data.startTime ? at(data.startTime) : day,
    endDate: data.startTime ? at(eventEndTime(data.startTime, data.endTime)) : day,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: data.venue, address },
    image: [new URL("/images/dancing-couples1-siyi.jpg", site).href],
    description: data.description,
    performer: band,
    organizer: band,
    ...(data.tiers?.length
      ? {
          offers: data.tiers.map((t) => ({
            "@type": "Offer",
            name: t.name,
            price: t.price.toFixed(2),
            priceCurrency: "GBP",
            availability: "https://schema.org/InStock",
            url: pageUrl,
          })),
        }
      : {}),
    url: pageUrl,
  };
}
