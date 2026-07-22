import { db } from '@mindstudio-ai/agent';

// Single-row state for the app's own disposable inbox (mail.tm). One shared
// inbox for the whole app, not per-user — travelers forward confirmations to
// this one address, and the poller matches the sender against a registered
// user's account email to know whose trip to attach it to.
export interface MailInboxState {
  address: string;
  password: string;
  token: string;
  tokenExpiresAt: number;
  // Timestamp (unix ms) of the newest message already processed — more
  // robust than tracking a message id, since mail.tm's list ordering isn't
  // guaranteed and a plain "later than X" comparison is dedupe-safe either way.
  lastSeenAt: number;
}

export const MailInboxState = db.defineTable<MailInboxState>('mail_inbox_state');
