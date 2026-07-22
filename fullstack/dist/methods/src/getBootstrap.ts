import { auth, db } from '@mindstudio-ai/agent';
import { Users } from './tables/users';
import { Trips } from './tables/trips';
import { getTripBundle, tripSummary, DEMO_OWNER } from './common/trips';
import {
  ensureOwnerRow,
  claimInvitesByEmail,
  listAccessibleTrips,
  buildRoster,
} from './common/collaborators';
import { currentInboxAddress } from './common/mailInbox';

// One call hydrates the whole app: the traveler, the trips they own or are a
// companion on, and the active trip's full state (board, messages, pending
// gates, latest call, and the collaborator roster).
export async function getBootstrap() {
  const userId = auth.userId;
  if (!userId) return { authenticated: false as const };

  const user = await Users.get(userId);

  // Claim any outstanding invites addressed to this traveler's email, so a
  // shared trip appears in their list even without following the link.
  if (user?.email) await claimInvitesByEmail(userId, user.email);

  let trips = await listAccessibleTrips(userId);

  // First traveler to open a freshly-seeded app claims the demo trips.
  if (trips.length === 0) {
    const demo = await Trips.filter((t, $) => t.userId === $.owner, { owner: DEMO_OWNER }); // bindings: lifts closure var so filter compiles to SQL
    if (demo.length) {
      await db.batch(...demo.map((t) => Trips.update(t.id, { userId })));
      // Give each claimed demo trip an owner collaborator row so sharing works.
      for (const t of demo) await ensureOwnerRow(t.id, userId);
      // Give the claiming traveler sensible defaults so the demo agent behaves well.
      if (user && !user.homeAirport) {
        await Users.update(userId, {
          homeAirport: 'LAX',
          preferences: { seat: 'window', nonstopPreferred: true, hotelStyle: 'boutique' },
        });
      }
      trips = await listAccessibleTrips(userId);
    }
  }

  const active = trips[0] || null;
  const bundle = active ? await getTripBundle(active.id) : null;
  const roster = active ? await buildRoster(active.id, userId) : [];
  const freshUser = user ? await Users.get(userId) : null;

  // Best-effort — a mail.tm hiccup shouldn't fail the whole bootstrap; the
  // import-by-email hint just won't show for this load.
  const importEmailAddress = await currentInboxAddress();

  return {
    authenticated: true as const,
    user: freshUser || user || null,
    trips: trips.map(tripSummary),
    activeTripId: active?.id ?? null,
    trip: bundle?.trip ?? null,
    messages: bundle?.messages ?? [],
    pendingActions: bundle?.pendingActions ?? [],
    activeCall: bundle?.activeCall ?? null,
    roster,
    importEmailAddress,
    expenses: bundle?.expenses ?? [],
  };
}
