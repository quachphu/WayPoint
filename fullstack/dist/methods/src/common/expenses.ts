import { Trips } from '../tables/trips';
import { Messages } from '../tables/messages';
import { TripExpenses } from '../tables/tripExpenses';
import { buildRoster } from './collaborators';
import { recordEvents } from './tripState';
import { moneyExact } from './format';

// Everything a shared trip's companions might see for a node's cost. Called
// right after approveAction commits a real booking — must never throw and
// make an already-successful booking look failed to the caller just because
// this newer table hasn't been migrated yet on a given project.
export async function activeExpensesForTrip(tripId: string) {
  try {
    const rows = await TripExpenses.filter(
      (e, $) => e.tripId === $.tripId,
      { tripId }, // bindings: lifts closure var so filter compiles to SQL
    );
    return rows.filter((e) => e.status !== 'removed');
  } catch (err) {
    console.error('[expenses] trip_expenses unavailable (has the storage setup SQL been re-run?):', err);
    return [];
  }
}

// Called right after a booking confirms (see approveAction.ts). Fully
// opt-in by construction: a solo trip, or one where the owner is the only
// active member, never gets an expense row at all.
export async function maybeCreateSplit(tripId: string, nodeId: string | undefined, ownerId: string): Promise<void> {
  if (!nodeId) return;
  const trip = await Trips.get(tripId);
  const node = trip?.nodes.find((n) => n.id === nodeId);
  if (!trip || !node || !node.costCents) return;

  const existing = await TripExpenses.filter(
    (e, $) => e.nodeId === $.nodeId,
    { nodeId }, // bindings: lifts closure var so filter compiles to SQL
  );
  if (existing.length) return;

  const roster = await buildRoster(tripId, ownerId);
  const owedByMembers = roster.filter((m) => m.status === 'active' && m.userId && m.role !== 'owner');
  if (!owedByMembers.length) return;

  const owedBy = owedByMembers.map((m) => m.userId!);
  const perPersonCents = Math.round(node.costCents / (owedBy.length + 1));

  const expense = await TripExpenses.push({
    tripId,
    nodeId,
    title: node.title,
    amountCents: node.costCents,
    owedBy,
    paidBy: [],
    perPersonCents,
    status: 'open',
    createdBy: ownerId,
  });

  const names = owedByMembers.map((m) => m.displayName || 'a companion').join(', ');
  const text = `${node.title} is split ${owedBy.length + 1} ways — ${moneyExact(perPersonCents)} each for ${names}. They can settle up from the board.`;
  await Messages.push({ tripId, role: 'agent', text, source: 'system', status: 'complete' });

  // Metadata-only event: deriveTripState no-ops it, but recordEvents always
  // bumps trip.version, which is what makes the existing syncTrip poll ship
  // the new expense to every open tab, not just the one that booked it.
  await recordEvents(tripId, 'system', [{ kind: 'expense_updated', payload: { expenseId: expense.id } }]);
}

// The owner adjusting a split conversationally ("just split the hotel, I've
// got the flights") — flips status between 'open' (counted) and 'removed'
// (excluded but not deleted, so restoring doesn't need to recompute anything).
export async function adjustSplit(tripId: string, nodeId: string, action: 'remove' | 'restore'): Promise<{ ok: boolean; note: string }> {
  const rows = await TripExpenses.filter(
    (e, $) => e.tripId === $.tripId && e.nodeId === $.nodeId,
    { tripId, nodeId }, // bindings: lifts closure vars so filter compiles to SQL
  );
  const expense = rows[0];
  if (!expense) return { ok: false, note: 'No split exists for that item.' };

  const status = action === 'remove' ? 'removed' : expense.paidBy.length === expense.owedBy.length ? 'settled' : 'open';
  await TripExpenses.update(expense.id, { status });
  await recordEvents(tripId, 'agent:planner', [{ kind: 'expense_updated', payload: { expenseId: expense.id } }]);
  return { ok: true, note: action === 'remove' ? 'Removed from the split.' : 'Back in the split.' };
}
