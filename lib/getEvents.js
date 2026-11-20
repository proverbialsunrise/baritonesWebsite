import ical from 'node-ical';

const DEFAULT_CALENDAR_ID = 'bearded.baritones@gmail.com';
const DEFAULT_TIMEZONE = 'America/Toronto';
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

const eventsCache = new Map();

export function clearEventsCache() {
  eventsCache.clear();
}

function ordinalSuffix(day) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function textOf(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'val' in value) {
    return String(value.val ?? '');
  }
  return '';
}

export function formatEventDate(date, timeZone = DEFAULT_TIMEZONE) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  const parts = formatter.formatToParts(date);
  const partMap = new Map(parts.map((part) => [part.type, part.value]));

  const weekday = partMap.get('weekday');
  const month = partMap.get('month');
  const day = partMap.get('day');
  const year = partMap.get('year');
  const hour = partMap.get('hour');
  const minute = partMap.get('minute');
  const dayPeriod = partMap.get('dayPeriod')?.toLowerCase() ?? '';
  const timeZoneName = partMap.get('timeZoneName') ?? '';

  if (!weekday || !month || !day || !year || !hour || !minute) {
    return '';
  }

  const dayNum = Number(day);
  return `${weekday} ${month} ${day}${ordinalSuffix(dayNum)}, ${year} - ${hour}:${minute}${dayPeriod} ${timeZoneName}`.trim();
}

export function parseCalendarEvents(icsText, { timeZone = DEFAULT_TIMEZONE, now = Date.now() } = {}) {
  const parsed = ical.parseICS(icsText);
  const events = [];

  for (const entry of Object.values(parsed)) {
    if (!entry || entry.type !== 'VEVENT') continue;

    const summary = textOf(entry.summary);
    if (/rehearsal/i.test(summary)) continue;

    const start = entry.start instanceof Date ? entry.start : entry.start ? new Date(entry.start) : null;
    if (start && !Number.isNaN(start.getTime()) && start.getTime() < now) {
      continue;
    }

    events.push({
      summary,
      location: textOf(entry.location),
      start,
      dateString: start ? formatEventDate(start, timeZone) : '',
    });
  }

  events.sort((a, b) => (a.start?.getTime() ?? Infinity) - (b.start?.getTime() ?? Infinity));
  return events;
}

export async function getEvents({
  calendarId = process.env.CALENDAR_ID || DEFAULT_CALENDAR_ID,
  timeZone = process.env.TIMEZONE || DEFAULT_TIMEZONE,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  fetchImpl = fetch,
  now = Date.now(),
} = {}) {
  const cacheKey = `${calendarId}|${timeZone}`;
  const cached = eventsCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < cacheTtlMs) {
    return cached.events;
  }

  const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;

  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) {
      throw new Error(`Calendar fetch failed with status ${response.status}`);
    }

    const icsText = await response.text();
    const events = parseCalendarEvents(icsText, { timeZone, now });
    eventsCache.set(cacheKey, { events, fetchedAt: now });
    return events;
  } catch (err) {
    if (cached) {
      console.warn('Failed to refresh calendar events, serving cached data:', err);
      return cached.events;
    }
    throw err;
  }
}
