import { auth } from '@mindstudio-ai/agent';
import { Users } from './tables/users';

// Mints a short-lived Vocal Bridge connection token so the browser never holds
// the API key (docs/03_API_INTEGRATION.md §2.2). Returns { enabled: false }
// when the integration isn't configured or the mint fails — the frontend then
// falls back to browser speech, mirroring the Sabre simulated-inventory
// pattern: the experience always completes, and the real reason is logged.
export async function getVoiceToken() {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const apiKey = process.env.VOCAL_BRIDGE_API_KEY;
  if (!apiKey) {
    console.error('[vocalbridge] VOCAL_BRIDGE_API_KEY not set; voice falls back to browser speech');
    return { enabled: false as const };
  }

  const headers: Record<string, string> = {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  };
  // Account-scoped keys must name the agent; agent-scoped keys don't.
  if (process.env.VOCAL_BRIDGE_AGENT_ID) headers['X-Agent-Id'] = process.env.VOCAL_BRIDGE_AGENT_ID;

  const user = await Users.get(userId);
  const res = await fetch('https://vocalbridgeai.com/api/v1/token', {
    method: 'POST',
    headers,
    body: JSON.stringify({ participant_name: user?.displayName || 'Traveler' }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[vocalbridge] token mint failed ${res.status}: ${body.slice(0, 240)}`);
    return { enabled: false as const };
  }
  const token = await res.json();
  return { enabled: true as const, token };
}
