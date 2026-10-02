/** Every timestamp in the app is displayed in Malaysia time (UTC+08:00). */
export const APP_TIME_ZONE = "Asia/Kuala_Lumpur";
export const APP_TIME_ZONE_LABEL = "UTC+08:00";

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** e.g. "25 Aug 2026, 01:19" */
export function formatDateTime(value: string | number | Date): string {
  return toDate(value).toLocaleString("en-GB", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** e.g. "25 Aug 2026, 01:19 (UTC+08:00)" */
export function formatDateTimeWithZone(value: string | number | Date): string {
  return `${formatDateTime(value)} (${APP_TIME_ZONE_LABEL})`;
}

/** e.g. "25 Aug 2026" */
export function formatDate(value: string | number | Date): string {
  return toDate(value).toLocaleDateString("en-GB", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** e.g. "01:19" */
export function formatTime(value: string | number | Date): string {
  return toDate(value).toLocaleTimeString("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Every searchable text form of a timestamp, all in UTC+08:00. */
export function searchableDateForms(value: string | number | Date): string {
  const date = toDate(value);
  const iso = new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString();
  return [formatDateTime(date), formatDate(date), formatTime(date), iso, iso.slice(0, 10)].join(" ");
}
