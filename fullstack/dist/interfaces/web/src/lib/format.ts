// UTC-based formatting, matching the backend so times round-trip exactly.
const TZ = 'UTC';

// Coerce anything into a valid Date, or null if it can't be one.
// A formatting helper must never throw — an invalid date returns '' below,
// never a RangeError that white-screens the whole app.
function toDate(ms: number | null | undefined): Date | null {
  if (ms == null) return null;
  const n = typeof ms === 'number' ? ms : Number(ms);
  if (!Number.isFinite(n)) return null;
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function moneyShort(cents: number | null | undefined): string {
  if (cents == null) return '';
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}
export function moneyExact(cents: number | null | undefined): string {
  if (cents == null) return '';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function timeOfDay(ms: number | null): string {
  const d = toDate(ms);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(d);
}
export function weekdayShort(ms: number | null): string {
  const d = toDate(ms);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ }).format(d);
}
export function monthDay(ms: number | null): string {
  const d = toDate(ms);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: TZ }).format(d);
}
export function dateRange(start: number | null, end: number | null): string {
  const s = monthDay(start);
  const e = monthDay(end);
  if (!s) return e; // start invalid/missing — fall back to end (or '')
  if (!e) return s; // end invalid/missing — just the start
  return `${s} – ${e}`;
}
export function durationLabel(min: number): string {
  if (!Number.isFinite(min)) return '';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
