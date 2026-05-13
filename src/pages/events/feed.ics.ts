import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

function icsDate(date: Date, time: string): string {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const da = String(date.getUTCDate()).padStart(2, "0");
  const [h, m] = time.split(":").map(Number);
  return `${y}${mo}${da}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
}

function escapeIcs(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const result: string[] = [line.slice(0, 75)];
  let i = 75;
  while (i < line.length) {
    result.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return result.join("\r\n");
}

export const GET: APIRoute = async () => {
  const events = await getCollection("events");
  const sorted = events.sort(
    (a, b) => a.data.date.getTime() - b.data.date.getTime()
  );

  const vevents = sorted.map((event) => {
    const { title, date, venue, address, description, ticketPrice, ticketLink, startTime } =
      event.data;

    const start = startTime ?? "19:30";
    const [startH, startM] = start.split(":").map(Number);
    const endTime = `${String(startH + 2).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;

    const location = [venue, address].filter(Boolean).join(", ");

    const descParts = [escapeIcs(description)];
    if (ticketPrice) descParts.push(`Tickets: ${escapeIcs(ticketPrice)}`);
    if (ticketLink) descParts.push(`Book: ${ticketLink}`);

    return [
      "BEGIN:VEVENT",
      foldLine(`UID:${event.id}@madrobinceilidh.co.uk`),
      `DTSTART:${icsDate(date, start)}`,
      `DTEND:${icsDate(date, endTime)}`,
      foldLine(`SUMMARY:${escapeIcs(title)}`),
      foldLine(`LOCATION:${escapeIcs(location)}`),
      foldLine(`DESCRIPTION:${descParts.join("\\n")}`),
      "URL:https://madrobinceilidh.co.uk/#events",
      "END:VEVENT",
    ].join("\r\n");
  });

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mad Robin Ceilidh Band//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Mad Robin Ceilidh Band",
    "X-WR-CALDESC:Upcoming gigs and events from Mad Robin Ceilidh Band",
    ...vevents,
    "END:VCALENDAR",
  ];

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar;charset=utf-8",
      "Content-Disposition": "attachment; filename=mad-robin-events.ics",
    },
  });
};
