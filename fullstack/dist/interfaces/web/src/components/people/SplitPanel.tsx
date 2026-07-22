import { useStore } from '../../lib/store';
import { Avatar } from './Avatar';
import { IconX, IconCheck } from '../icons';
import { moneyExact } from '../../lib/format';
import type { RosterMember, TripExpense } from '../../lib/types';

// The docked "who owes what" panel — Split the Bill. Lives in the same slot
// as PeoplePanel/DetailPanel (governed by splitOpen the way peopleOpen
// governs PeoplePanel). Waypoint never moves money: each row is either your
// own share (a "Mark as paid" button) or, if you're the owner, anyone's
// share (so cash/venmo-outside-the-app still gets tracked honestly).
export function SplitPanel() {
  // Already filtered server-side (getTripBundle never includes 'removed'
  // rows) — select as-is. A fresh .filter() array on every render breaks
  // useSyncExternalStore's stable-snapshot contract and loops infinitely.
  const expenses = useStore((s) => s.expenses);
  const roster = useStore((s) => s.roster);
  const closeSplit = useStore((s) => s.closeSplit);
  const myId = useStore((s) => s.profile?.id ?? null);
  const markPaid = useStore((s) => s.markPaid);
  const isOwner = roster.find((m) => m.userId === myId)?.role === 'owner';

  const memberFor = (userId: string): RosterMember | undefined => roster.find((m) => m.userId === userId);

  return (
    <div className="wp-people" role="dialog" aria-label="Split the bill">
      <div className="wp-people-head">
        <h2>Split the bill</h2>
        <button className="wp-icon-btn" onClick={closeSplit} aria-label="Close">
          <IconX size={17} stroke={1.8} />
        </button>
      </div>

      {expenses.length === 0 ? (
        <p className="wp-people-lede">Nothing split yet — it happens automatically when a booking confirms on a trip with companions.</p>
      ) : (
        <div className="wp-people-list">
          {expenses.map((e) => (
            <ExpenseCard key={e.id} expense={e} myId={myId} isOwner={isOwner} memberFor={memberFor} markPaid={markPaid} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpenseCard({
  expense,
  myId,
  isOwner,
  memberFor,
  markPaid,
}: {
  expense: TripExpense;
  myId: string | null;
  isOwner: boolean;
  memberFor: (userId: string) => RosterMember | undefined;
  markPaid: (id: string) => Promise<void>;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{expense.title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{moneyExact(expense.amountCents)} total</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {expense.owedBy.map((userId) => {
          const member = memberFor(userId);
          const paid = expense.paidBy.includes(userId);
          const isMe = userId === myId;
          const canSettle = isMe || isOwner;
          return (
            <div key={userId} className="wp-member">
              {member ? <Avatar member={member} size={28} /> : <span style={{ width: 28, height: 28 }} />}
              <div className="wp-member-meta">
                <div className="wp-member-name">{member?.displayName || member?.email || 'A companion'}</div>
                <div className="wp-member-sub">{moneyExact(expense.perPersonCents)} owed</div>
              </div>
              {paid ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)' }}>
                  <IconCheck size={14} stroke={2} /> Paid
                </span>
              ) : canSettle ? (
                <button className="wp-ghost-btn" onClick={() => markPaid(expense.id)}>
                  <span>Mark as paid</span>
                </button>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Unpaid</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
