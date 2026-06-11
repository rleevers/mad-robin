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
