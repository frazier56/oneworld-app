export const DEFAULT_EVENT_TIMEZONE = "America/Chicago";

export const EVENT_TIME_ZONES = [
  { value: "America/Bogota", label: "Colombia Time (COT) - Bogota / Medellin" },
  { value: "America/Chicago", label: "Central Time (CT) - Chicago / Dallas" },
  { value: "America/New_York", label: "Eastern Time (ET) - Atlanta / New York" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT) - Los Angeles" },
  { value: "America/Denver", label: "Mountain Time (MT) - Denver" },
  { value: "America/Phoenix", label: "Arizona Time (MST) - Phoenix" },
  { value: "America/Panama", label: "Panama Time (EST) - Panama City" },
  { value: "America/Mexico_City", label: "Mexico City Time (CT)" },
  { value: "Europe/Madrid", label: "Spain Time (CET/CEST) - Madrid" },
  { value: "UTC", label: "UTC" },
] as const;

export function normalizeEventTimeZone(timeZone?: string | null) {
  if (!timeZone) return DEFAULT_EVENT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_EVENT_TIMEZONE;
  }
}

export function timeZoneAbbreviation(timeZone?: string | null, date: Date = new Date()) {
  const safeZone = normalizeEventTimeZone(timeZone);
  if (safeZone === "America/Bogota") return "COT";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone,
    timeZoneName: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(date);

  return parts.find(part => part.type === "timeZoneName")?.value || safeZone;
}

export function utcIsoToZonedParts(iso: string | null | undefined, timeZone?: string | null) {
  if (!iso) return { date: "", time: "" };
  const date = new Date(iso);
  const safeZone = normalizeEventTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value || 0);
  const localAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return localAsUtc - date.getTime();
}

export function zonedDateTimeToUtcIso(dateValue: string, timeValue: string, timeZone?: string | null) {
  const safeZone = normalizeEventTimeZone(timeZone);
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const localAsUtc = new Date(Date.UTC(year, month - 1, day, hour || 0, minute || 0, 0));
  let offset = getTimeZoneOffsetMs(localAsUtc, safeZone);
  let utc = new Date(localAsUtc.getTime() - offset);
  const correctedOffset = getTimeZoneOffsetMs(utc, safeZone);
  if (correctedOffset !== offset) {
    utc = new Date(localAsUtc.getTime() - correctedOffset);
  }
  return utc.toISOString();
}

export function formatEventDateTimeRange(
  startIso?: string | null,
  endIso?: string | null,
  timeZone?: string | null,
  locale: string = "en-US",
) {
  if (!startIso) {
    return { date: "Date TBD", time: "Time TBD", line: "Date TBD" };
  }

  const safeZone = normalizeEventTimeZone(timeZone);
  const startDate = new Date(startIso);
  const endDate = endIso ? new Date(endIso) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  const date = startDate.toLocaleDateString(locale, {
    timeZone: safeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const startTime = startDate.toLocaleTimeString(locale, {
    timeZone: safeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime = endDate.toLocaleTimeString(locale, {
    timeZone: safeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  const zone = timeZoneAbbreviation(safeZone, startDate);
  const time = `${startTime} - ${endTime} ${zone}`;
  return { date, time, line: `${date} · ${time}` };
}
