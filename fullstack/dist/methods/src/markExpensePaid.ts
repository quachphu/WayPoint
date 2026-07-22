import { auth } from '@mindstudio-ai/agent';
import { TripExpenses } from './tables/tripExpenses';
import { assertTripAccess } from './common/collaborators';
import { recordEvents } from './common/tripState';

// Each companion marks their OWN share paid — Waypoint never moves money
// itself, this just tracks the honest state (see common/expenses.ts).
export async function markExpensePaid(input: { expenseId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const expense = await TripExpenses.get(input.expenseId);
  if (!expense) throw new Error('That expense is no longer available.');
  await assertTripAccess(expense.tripId, userId);

  if (!expense.owedBy.includes(userId)) throw new Error('This one is not on your tab.');
  if (expense.paidBy.includes(userId)) return { ok: true, expense };

  const paidBy = [...expense.paidBy, userId];
  const status = paidBy.length === expense.owedBy.length ? ('settled' as const) : expense.status;
  const updated = await TripExpenses.update(expense.id, { paidBy, status });

  await recordEvents(expense.tripId, userId, [{ kind: 'expense_updated', payload: { expenseId: expense.id } }]);
  return { ok: true, expense: updated };
}
