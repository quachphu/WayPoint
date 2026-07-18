import type { ReactNode } from 'react';
import { useStore } from '../lib/store';
import { auth } from '../lib/api';
import { monthDay } from '../lib/format';
import type { TripSummary } from '../lib/types';
import { avatarForUser } from '../lib/onboardingOptions';
import { PeopleNearby } from './social/PeopleNearby';
import { LocationMap } from './social/LocationMap';

// A believable, reliably-loading cover photo per trip — seeded by id so the
// same trip always gets the same image, without depending on real per-
// destination photography we don't have.
function coverUrl(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/500`;
}

function daysUntil(startDate: number | null): number | null {
  if (startDate == null) return null;
  const ms = startDate - Date.now();
  return Math.ceil(ms / 86400000);
}

// A short, honest trip-length label derived from the actual dates — no
// fabricated "vibe" tags we have no data to back up.
function lengthLabel(start: number | null, end: number | null): string | null {
  if (start == null || end == null) return null;
  const nights = Math.round((end - start) / 86400000);
  if (nights <= 0) return null;
  if (nights <= 2) return 'Weekend';
  if (nights <= 4) return 'Long weekend';
  if (nights <= 8) return 'Getaway';
  return 'Extended trip';
}

function displayName(profile: { displayName?: string; email: string | null } | null): string {
  if (!profile) return 'there';
  if (profile.displayName) return profile.displayName;
  const local = profile.email?.split('@')[0] ?? 'there';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="font-space inline-flex items-center rounded-full border border-[var(--border-warm-strong)] bg-[var(--surface)]/70 px-3 py-1 text-xs font-medium text-[var(--text-2)] backdrop-blur-sm">
      {children}
    </span>
  );
}

function HeroCard({ trip, memberCount, onOpen }: { trip: TripSummary; memberCount: number | null; onOpen: () => void }) {
  const until = daysUntil(trip.startDate);
  const length = lengthLabel(trip.startDate, trip.endDate);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-[var(--shadow-3)]">
      <img
        src={coverUrl(trip.id)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />

      <div className="relative flex min-h-[380px] flex-col justify-end p-8 sm:p-10">
        <div className="font-space mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
          <span>Next on the calendar</span>
          <span className="opacity-50">•</span>
          <span style={{ color: 'var(--live-gold)' }}>{trip.destination || 'Trip'} crew</span>
        </div>
        <h2 className="font-space text-[clamp(1.75rem,4.5vw,3rem)] italic leading-[1.05] text-white">{trip.title}</h2>
        {trip.destination && <p className="font-space mt-2 text-lg italic text-white/80">{trip.destination}</p>}

        <div className="mt-5 flex flex-wrap gap-2">
          {until != null && until >= 0 && <Tag>{until === 0 ? 'Today' : until === 1 ? 'Tomorrow' : `In ${until} days`}</Tag>}
          {(trip.startDate || trip.endDate) && <Tag>{[monthDay(trip.startDate), monthDay(trip.endDate)].filter(Boolean).join(' – ')}</Tag>}
          {memberCount != null && <Tag>{memberCount} member{memberCount === 1 ? '' : 's'}</Tag>}
          {length && <Tag>{length}</Tag>}
        </div>

        <button
          onClick={onOpen}
          className="font-display mt-7 inline-flex w-fit items-center gap-1.5 rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-lg transition-transform duration-150 ease-out active:scale-[0.97]"
          style={{ background: 'var(--live)' }}
        >
          Open planning →
        </button>
      </div>
    </div>
  );
}

function GroupCard({ trip, onOpen }: { trip: TripSummary; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group relative flex h-64 flex-col justify-end overflow-hidden rounded-xl border border-[var(--border-warm)] p-5 text-left shadow-[var(--shadow-1)] transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <img
        src={coverUrl(trip.id)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity duration-150 group-hover:opacity-80"
        draggable={false}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
      <div className="relative">
        <div className="font-space text-xs font-semibold uppercase tracking-wide text-white/60">{trip.status}</div>
        <div className="font-space mt-1 text-xl italic leading-tight text-white">{trip.title}</div>
        {trip.destination && <div className="font-space mt-1 text-sm text-white/70">{trip.destination}</div>}
      </div>
    </button>
  );
}

export function Home() {
  const profile = useStore((s) => s.profile);
  const trips = useStore((s) => s.trips);
  const roster = useStore((s) => s.roster);
  const activeTripId = useStore((s) => s.activeTripId);
  const openPlanning = useStore((s) => s.openPlanning);
  const openNewPlanning = useStore((s) => s.openNewPlanning);
  const openProfile = useStore((s) => s.openProfile);

  const now = Date.now();
  const upcoming = [...trips].filter((t) => t.startDate != null && t.startDate >= now).sort((a, b) => a.startDate! - b.startDate!);
  const hero = upcoming[0] ?? trips[0] ?? null;
  const others = trips.filter((t) => t.id !== hero?.id);

  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--canvas)' }}>
      <div className="mx-auto flex max-w-[min(1720px,94vw)] gap-8 px-6 py-8 sm:px-10 xl:gap-12 xl:px-16 xl:py-12">
        <aside className="hidden w-80 shrink-0 lg:block xl:w-96">
          <div className="sticky top-8">
            <PeopleNearby />
            <LocationMap />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
        <div className="mb-8 flex items-center justify-between xl:mb-12">
          <button
            className="flex items-center gap-2 rounded-full py-1 pr-3 transition-colors duration-150 hover:bg-[var(--surface-2)]"
            onClick={openProfile}
          >
            <img src={avatarForUser(profile)} alt="" width={26} height={26} className="rounded-full object-cover" draggable={false} />
            <span className="font-space text-[15px] text-[var(--text-2)]">
              Hi, <em className="not-italic font-semibold" style={{ color: 'var(--live)' }}>{displayName(profile)}</em>
            </span>
          </button>
          <button className="font-space text-xs font-medium uppercase tracking-wide text-[var(--text-2)] hover:text-[var(--text)]" onClick={() => auth.logout()}>
            Sign out
          </button>
        </div>

        {hero ? (
          <HeroCard trip={hero} memberCount={hero.id === activeTripId ? roster.length : null} onOpen={() => openPlanning(hero.id)} />
        ) : (
          <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-warm-strong)] p-10 text-center xl:min-h-[58vh]">
            <img src="/mascot/orb-idle.webp" alt="" width={96} height={96} className="object-contain xl:h-[120px] xl:w-[120px]" draggable={false} />
            <p className="font-space mt-6 max-w-sm text-base text-[var(--text-2)] xl:text-lg">No trips yet — start one and Waypoint will plan it with you.</p>
            <button
              onClick={openNewPlanning}
              className="font-display mt-6 rounded-lg px-7 py-3.5 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] xl:text-base"
              style={{ background: 'var(--live)' }}
            >
              Plan your first trip
            </button>
          </div>
        )}

        {(others.length > 0 || hero) && (
          <div className="mt-12">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-space text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">Other groups</span>
              <button className="font-space text-xs font-semibold underline underline-offset-2" style={{ color: 'var(--live)' }} onClick={openNewPlanning}>
                + New group
              </button>
            </div>
            {others.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {others.map((t) => (
                  <GroupCard key={t.id} trip={t} onOpen={() => openPlanning(t.id)} />
                ))}
              </div>
            ) : (
              <p className="font-space text-sm text-[var(--text-3)]">Just this one for now.</p>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
