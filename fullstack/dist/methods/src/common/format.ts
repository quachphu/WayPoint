// All Waypoint times are stored as "naive local" unix ms (midnight of the day
// plus the wall-clock offset), and formatted in UTC so they round-trip exactly
// as authored. This keeps the app's closed world consistent without a real
// timezone database.
const TZ = 'UTC';

export function moneyShort(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}

export function moneyExact(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function timeOfDay(ms: number): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(new Date(ms));
}

export function weekdayShort(ms: number): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ }).format(new Date(ms));
}

export function monthDay(ms: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: TZ }).format(new Date(ms));
}

export function dateRange(start: number | null, end: number | null): string {
  if (!start) return '';
  if (!end) return monthDay(start);
  return `${monthDay(start)} – ${monthDay(end)}`;
}

export function durationLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
