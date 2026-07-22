import { auth, mindstudio } from '@mindstudio-ai/agent';
import { Users } from './tables/users';
import { setPendingVoiceConfirm, takePendingVoiceConfirm, isAffirmative } from './common/voiceConfirm';

// The mascot's ambient, pre-trip conversation — tapping it no longer redirects
// straight into trip planning. This decides, per utterance, whether the
// traveler actually wants to plan a trip (in which case the caller hands off
// into the real converse() pipeline) or is just asking something general
// (recommendations, what to do nearby, travel tips) — in which case it
// answers directly and the conversation just continues.
//
// This whole method is one leg of a live Vocal Bridge voice turn
// (onAIAgentQuery: (query) => Promise<string>) — VB has no "still working,
// hang on" mechanism for that contract (confirmed against the SDK: it's a
// single request/response, no turnId is even exposed to the handler to defer
// with). Measured against this project's actual model backend: a plain
// generateText call typically resolves in 2-5s, but a real search-grounded
// generateWithSearch call consistently took 9-20+ seconds in testing — a tax
// that essentially never paid off (the fast path almost always would have
// produced the same real-sounding answer anyway; see the "Lineage Coffee"
// case in the commit history of this investigation, where a genuine, correct
// local recommendation came from the fast path after search timed out).
// Given VB gave up and spoke its own "can't connect to agent" fallback
// during that wait, live search was doing more harm than good in a real-time
// voice turn and has been dropped from this path — the fast path alone,
// still instructed to answer like someone who's actually seen real local
// reviews and recommendations, is what actually ships a working feature here.
const CLASSIFY_TIMEOUT_MS = 6000;
const ANSWER_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function safeParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Defaults to 'chat' on any failure/timeout — safer than guessing 'plan_trip',
// since a wrong 'chat' guess just means one more spoken turn, while a wrong
// 'plan_trip' guess wipes into a blank trip unexpectedly.
async function classifyIntent(text: string): Promise<'plan_trip' | 'chat'> {
  try {
    const { content } = await withTimeout(
      mindstudio.generateText({
        message: `A traveler just said this to a travel app's voice mascot: "${text}"

Is this a request to plan/book an actual trip (a real destination, dates, "let's go somewhere", booking a flight/hotel), or is it just a general question or casual conversation (recommendations, what to do nearby, travel tips, hanging out, small talk) with no real trip being planned yet?

Return JSON {"intent": "plan_trip" | "chat"}.`,
        modelOverride: { model: 'gemini-3-flash', temperature: 0.1, maxResponseTokens: 200 },
        structuredOutputType: 'json',
        structuredOutputExample: '{"intent":"chat"}',
      } as any),
      CLASSIFY_TIMEOUT_MS,
      'classify',
    );
    const parsed = safeParse(content);
    return parsed?.intent === 'plan_trip' ? 'plan_trip' : 'chat';
  } catch (err) {
    console.error('[askMascot] intent classification failed/slow:', err);
    return 'chat';
  }
}

export async function askMascot(input: { text: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  const text = (input.text || '').trim();
  if (!text) return { intent: 'chat' as const, reply: "Sorry, I didn't catch that.", seedText: null };

  // A pending "did you want to plan a trip?" from the traveler's last turn
  // takes priority — see common/voiceConfirm.ts for why this hard gate
  // exists. Only a genuine affirmative here actually hands off into trip
  // creation; anything else (a clear no, or an unrelated new remark) never
  // silently creates anything.
  const pendingSeed = takePendingVoiceConfirm(userId, 'plan_trip');
  if (pendingSeed != null) {
    if (isAffirmative(text)) {
      return { intent: 'plan_trip' as const, reply: "Let's get that planned.", seedText: pendingSeed };
    }
    // Not a clear yes — don't act on the stale ask; fall through and
    // classify this new utterance fresh instead of silently dropping it.
  }

  const intent = await classifyIntent(text);

  if (intent === 'plan_trip') {
    setPendingVoiceConfirm(userId, 'plan_trip', text);
    return { intent: 'chat' as const, reply: `I heard: "${text}" — want me to start planning that?`, seedText: null };
  }

  const me = await Users.get(userId);
  const areaLabel = [me?.location?.city, me?.location?.region, me?.location?.country].filter(Boolean).join(', ');
  const areaClause = areaLabel ? ` The traveler is near ${areaLabel} right now — weight the answer toward that area if the question is about "nearby"/"around here".` : '';

  const prompt = `You are Waypoint, a travel companion mascot having a quick spoken conversation (not planning a trip yet). The traveler asked: "${text}"${areaClause}

Answer like someone who genuinely knows the area — real, specific, well-regarded places by name when relevant (the kind of spot real local reviews and recommendations point to), not generic filler. Only state something as fact if you're actually confident about it; say so plainly if you're not sure rather than guessing.

Answer in ONE short spoken sentence — natural, no markdown, no lists, no emojis, no em dashes, no citations.`;

  try {
    const { content } = await withTimeout(
      mindstudio.generateText({
        message: prompt,
        modelOverride: { model: 'gemini-3-flash', temperature: 0.5, maxResponseTokens: 300 },
      } as any),
      ANSWER_TIMEOUT_MS,
      'answer',
    );
    const reply = (content || '').trim() || "I'm not sure about that one — want to just plan a trip instead?";
    return { intent: 'chat' as const, reply, seedText: null };
  } catch (err) {
    console.error('[askMascot] answer failed/slow:', err);
    return { intent: 'chat' as const, reply: "I couldn't get to that just now — mind asking again?", seedText: null };
  }
}
