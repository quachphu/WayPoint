import { auth, mindstudio } from '@mindstudio-ai/agent';

// Lets the mascot speak a line aloud (onboarding "getting to know you" beat,
// map-scouting cues) via xAI's TTS API, instead of only displaying text.
export async function textToSpeech(input: { text: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  const trimmed = input.text?.trim();
  if (!trimmed) return { audioDataUrl: null };

  try {
    const { audioDataUrl } = await mindstudio.textToSpeech({ text: trimmed, voiceId: 'eve' });
    return { audioDataUrl };
  } catch (err) {
    console.error('[tts] textToSpeech failed:', err);
    return { audioDataUrl: null };
  }
}
