import { MailInboxState } from '../tables/mailInboxState';
import { Users } from '../tables/users';
import { runImport } from './importPipeline';

// A free, anonymous disposable inbox (mail.tm) that this app polls for new
// mail instead of receiving a webhook — no domain, no personal email, no
// public URL needed. One shared inbox for the whole app; travelers forward
// confirmations to it, and the sender's address is matched against a
// registered Waypoint account to know whose trip to attach the import to.
//
// Confirm the exact response shape against mail.tm's current docs at build
// time (same caveat already applied elsewhere to third-party APIs) — this
// codes against its documented Hydra-collection list format
// (`hydra:member`) with graceful fallbacks if that shifts.

const BASE = 'https://api.mail.tm';
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // refresh well before any plausible JWT expiry

function randomToken(len: number): string {
  return Array.from({ length: len }, () => Math.random().toString(36)[2] || '0').join('');
}

async function mailFetch(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(BASE + path, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`mail.tm ${path} -> ${res.status}: ${body.slice(0, 300)}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.arrayBuffer();
}

async function createAccount(): Promise<{ address: string; password: string }> {
  const domains = await mailFetch('/domains');
  const domain = (domains?.['hydra:member'] ?? domains?.member ?? [])[0]?.domain;
  if (!domain) throw new Error('mail.tm returned no available domain');
  // No dot (or other punctuation) in the local-part — verified live that
  // mail.tm silently strips punctuation from what you send, so the address
  // it actually stores can differ from the one requested. Read the address
  // back from its own response rather than trusting the request echo.
  const requested = `waypoint${randomToken(12)}@${domain}`;
  const password = randomToken(20);
  const created = await mailFetch('/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: requested, password }),
  });
  return { address: created.address || requested, password };
}

async function mintToken(address: string, password: string): Promise<string> {
  const res = await mailFetch('/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password }),
  });
  return res.token;
}

async function getState() {
  const rows = await MailInboxState.filter(() => true);
  return rows[0] ?? null;
}

export async function ensureInboxAccount(): Promise<{ address: string; token: string }> {
  const existing = await getState();
  if (existing && existing.tokenExpiresAt > Date.now()) {
    return { address: existing.address, token: existing.token };
  }
  if (existing) {
    try {
      const token = await mintToken(existing.address, existing.password);
      await MailInboxState.update(existing.id, { token, tokenExpiresAt: Date.now() + TOKEN_TTL_MS });
      return { address: existing.address, token };
    } catch (err) {
      console.error('[mailInbox] token refresh failed, recreating account:', err);
    }
  }
  const { address, password } = await createAccount();
  const token = await mintToken(address, password);
  await MailInboxState.push({ address, password, token, tokenExpiresAt: Date.now() + TOKEN_TTL_MS, lastSeenAt: Date.now() });
  console.error(`[mailInbox] created inbox ${address} — forward confirmations here`);
  return { address, token };
}

interface InboxMessage {
  id: string;
  from: { address: string; name?: string };
  createdAt: string;
}

interface InboxAttachment {
  id: string;
  filename: string;
  contentType: string;
  downloadUrl: string;
}

async function listNewMessages(token: string, sinceMs: number): Promise<InboxMessage[]> {
  const data = await mailFetch('/messages', { headers: { Authorization: `Bearer ${token}` } });
  const all: InboxMessage[] = data?.['hydra:member'] ?? data?.member ?? [];
  return all.filter((m) => Date.parse(m.createdAt) > sinceMs).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

async function fetchFullMessage(token: string, id: string): Promise<{ from: string; attachments: InboxAttachment[] } | null> {
  try {
    const full = await mailFetch(`/messages/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    return { from: full?.from?.address || '', attachments: full?.attachments ?? [] };
  } catch (err) {
    console.error('[mailInbox] fetching message failed:', err);
    return null;
  }
}

async function downloadAttachment(token: string, downloadUrl: string): Promise<string> {
  const res = await fetch(downloadUrl.startsWith('http') ? downloadUrl : BASE + downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`mail.tm attachment download -> ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

// Checks the inbox for anything new since the last poll, matches each
// message's sender against a registered user, and runs every attachment
// through the same import pipeline the browser-upload path uses. Never
// creates data for a sender that isn't a known Waypoint account.
export async function pollAndImport(): Promise<{ imported: number }> {
  const state = await getState();
  const { address, token } = await ensureInboxAccount();
  const sinceMs = state?.lastSeenAt ?? 0;

  let messages: InboxMessage[];
  try {
    messages = await listNewMessages(token, sinceMs);
  } catch (err) {
    console.error('[mailInbox] listing messages failed:', err);
    return { imported: 0 };
  }
  if (!messages.length) return { imported: 0 };

  let imported = 0;
  let latestSeenAt = sinceMs;

  for (const m of messages) {
    latestSeenAt = Math.max(latestSeenAt, Date.parse(m.createdAt));
    const full = await fetchFullMessage(token, m.id);
    if (!full) continue;

    const senderEmail = (full.from || m.from?.address || '').trim().toLowerCase();
    const matches = await Users.filter(
      (u, $) => (u.email || '').trim().toLowerCase() === $.senderEmail,
      { senderEmail }, // bindings: lifts closure var so filter compiles to SQL
    );
    const user = matches[0];
    if (!user) {
      console.error(`[mailInbox] dropping message from unrecognized sender: ${senderEmail}`);
      continue;
    }

    for (const att of full.attachments) {
      try {
        const base64 = await downloadAttachment(token, att.downloadUrl);
        await runImport({
          userId: user.id,
          senderEmail,
          base64,
          mimeType: att.contentType || 'application/octet-stream',
          fileName: att.filename || 'attachment',
        });
        imported++;
      } catch (err) {
        console.error('[mailInbox] importing attachment failed:', err);
      }
    }
  }

  const finalState = await getState();
  if (finalState) await MailInboxState.update(finalState.id, { lastSeenAt: latestSeenAt });
  return { imported };
}

export async function currentInboxAddress(): Promise<string | null> {
  try {
    const { address } = await ensureInboxAccount();
    return address;
  } catch (err) {
    console.error('[mailInbox] could not resolve inbox address:', err);
    return null;
  }
}
