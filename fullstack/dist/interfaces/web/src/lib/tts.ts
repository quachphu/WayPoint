import { api } from './api';

// Lets the mascot actually speak its lines (xAI TTS) instead of only
// displaying them. Cached per exact string so a static line (e.g. "Scouting
// spots near you", repeated on every re-check) only ever costs one API call
// per session — only genuinely new text (the personalized welcome message,
// "found N new spots") triggers fresh generation.
const cache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;

// Resolves once the audio actually finishes playing (not on a guessed
// duration) — true if it played, false if TTS was unavailable/failed, so
// callers that pace a UI transition off of this know whether to fall back to
// their own timing estimate instead.
export async function speak(text: string): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) return false;
  try {
    let audioDataUrl = cache.get(trimmed);
    if (!audioDataUrl) {
      const res = await api.textToSpeech({ text: trimmed });
      if (!res.audioDataUrl) return false;
      audioDataUrl = res.audioDataUrl;
      cache.set(trimmed, audioDataUrl);
    }
    currentAudio?.pause();
    const audio = new Audio(audioDataUrl);
    currentAudio = audio;
    await audio.play();
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      audio.addEventListener('ended', done, { once: true });
      audio.addEventListener('error', done, { once: true });
      // Safety net only — in case neither event ever fires, don't hang forever.
      setTimeout(done, 15000);
    });
    return true;
  } catch (err) {
    // Autoplay restrictions or a flaky TTS call shouldn't break the visual
    // flow — the text is already on screen either way.
    console.error('[tts] speak failed', err);
    return false;
  }
}
