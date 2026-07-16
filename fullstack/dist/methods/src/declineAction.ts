import { auth } from '@mindstudio-ai/agent';
import { PendingActions } from './tables/pendingActions';
import { assertTripAccess } from './common/collaborators';

// Decline (or cancel) a pending gate. An approver can decline anything; a
// companion without approval rights can still cancel a request they made
// themselves (the "Cancel request" affordance on their held state).
export async function declineAction(input: { actionId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  const action = await PendingActions.get(input.actionId);
  if (!action) throw new Error('That request is no longer available.');

  const access = await assertTripAccess(action.tripId, userId);
  const isRequester = action.requestedBy?.userId === userId;
  if (!access.canApprove && !isRequester) {
    throw new Error('Only the trip owner can decide on this.');
  }

  if (action.status === 'pending') {
    await PendingActions.update(action.id, { status: 'declined', resolvedAt: Date.now() });
  }
  return { ok: true, actionId: action.id };
}
