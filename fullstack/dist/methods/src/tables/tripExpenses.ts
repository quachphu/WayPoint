import { db } from '@mindstudio-ai/agent';

// A cost split among a shared trip's companions, created automatically when
// the owner confirms a booking on a trip with active companions. Waypoint
// never moves money itself — this tracks who owes what and who's settled;
// "paying" is each person's own in-app action (see markExpensePaid.ts).
export interface TripExpense {
  tripId: string;
  nodeId: string;
  title: string; // node.title at creation time, so display never needs a join
  amountCents: number;
  owedBy: string[]; // companion userIds who owe a share (the owner already paid, so they're excluded)
  paidBy: string[]; // subset of owedBy who've marked their share settled
  perPersonCents: number;
  status: 'open' | 'settled' | 'removed'; // 'removed' = owner excluded this item via conversation (adjustSplit)
  createdBy: string; // owner userId
}

export const TripExpenses = db.defineTable<TripExpense>('trip_expenses');
