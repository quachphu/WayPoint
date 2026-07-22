// A hard confirmation gate for voice-sourced actions that create or rename a
// trip. Vocal Bridge's own server-side agent has been observed fabricating
// entire coherent-sounding turns with no real speech input at all — not
// mis-hearing, inventing (e.g. "Set the trip name to 'Tokyo Drift' for the
// current Tokyo trip planning session..." from a traveler who said nothing).
// Client-side text heuristics (regexes matching known fabricated phrasing)
// kept losing this game since fabricated content varies arbitrarily turn to
// turn. The one thing that can't be fabricated by a single bad turn is a
// SECOND, genuine affirmative turn — so voice-triggered trip creation/rename
// now always requires one. Typed text has no such fabrication risk (there is
// no server-side "AI agent" reformulating what you type), so this gate is
// never applied to source: 'chat'.
//
// In-memory, single-process store — acceptable here since it only needs to
// survive a few seconds between a traveler's two consecutive spoken turns,
// not real durable state; a server restart just means the next fabricated
// turn (if any) needs re-confirming again, same as a genuine one would.
const pending = new Map<string, { kind: string; payload: string; expiresAt: number }>();
const TTL_MS = 90_000;

export function setPendingVoiceConfirm(userId: string, kind: string, payload: string) {
  pending.set(userId, { kind, payload, expiresAt: Date.now() + TTL_MS });
}

// Consumes the pending entry (always removed once read) if present, matches
// this exact kind, and hasn't expired — otherwise null.
export function takePendingVoiceConfirm(userId: string, kind: string): string | null {
  const p = pending.get(userId);
  if (!p) return null;
  pending.delete(userId);
  if (p.expiresAt < Date.now() || p.kind !== kind) return null;
  return p.payload;
}

export function isAffirmative(text: string): boolean {
  return /^\s*(yes|yeah|yep|yup|sure|ok(ay)?|do it|go ahead|please do|confirm|let'?s do it|sounds good|correct|start it)\b/i.test(
    text.trim(),
  );
}
