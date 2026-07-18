import { mindstudio } from '@mindstudio-ai/agent';

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

// A cheap, fast classifier — not the main orchestrator model — since this
// runs on every chat message and just needs a yes/no plus a place name.
export async function detectTripMention(text: string): Promise<{ destination: string } | null> {
  try {
    const { content } = await mindstudio.generateText({
      message: `A message from a group chat between friends: "${text}"

Does this message express real intent to actually take a trip somewhere specific (not just mentioning a place in passing, a memory, or something unrelated to travel)? If yes, extract the destination as a clean place name (city and/or country). Return JSON only: {"hasTripMention": boolean, "destination": string|null}`,
      modelOverride: { model: 'gemini-3-flash', temperature: 0.1, maxResponseTokens: 150 },
      structuredOutputType: 'json',
      structuredOutputExample: '{"hasTripMention":true,"destination":"Paris"}',
    } as any);
    const parsed = safeParse(content);
    if (parsed?.hasTripMention && parsed?.destination) return { destination: String(parsed.destination) };
    return null;
  } catch (err) {
    console.error('[trip-mention] detection failed:', err);
    return null;
  }
}
