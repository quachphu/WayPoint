import { useEffect, useMemo, useState } from 'react';
import { speak } from '../../lib/tts';

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: 'var(--live)', animation: `typing-dot 1.1s ease-in-out ${i * 0.15}s infinite` }}
        />
      ))}
    </span>
  );
}

// Shown once, right after onboarding submits — a beat where the mascot
// "reads" the profile before landing on Home, closing the loop on filling
// out a whole form by visibly reacting to it instead of just redirecting.
// Each line stays up for exactly as long as its own spoken audio takes —
// not a guessed fixed duration — so the text is never cut off mid-sentence.
// The fallback durations only kick in if TTS is unavailable/fails.
export function LearningScreen({ welcomeMessage, onDone }: { welcomeMessage: string; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [fading, setFading] = useState(false);

  const lines = useMemo(() => ['Getting to know you.', welcomeMessage, 'Finished getting to know you.'], [welcomeMessage]);

  const fallbackDurations = useMemo(() => {
    // The personalized line gets real reading time, scaled to its length.
    const readMs = Math.min(6800, Math.max(3600, welcomeMessage.length * 65));
    return [2400, readMs, 2400];
  }, [welcomeMessage]);

  useEffect(() => {
    if (step >= lines.length) {
      onDone();
      return;
    }
    let cancelled = false;
    setFading(false);
    (async () => {
      const spoke = await speak(lines[step]);
      if (cancelled) return;
      // No audio at all (TTS down) — hold the fallback estimate instead of
      // instantly flashing past a line nobody had time to read.
      if (!spoke) await new Promise((r) => setTimeout(r, fallbackDurations[step]));
      if (cancelled) return;
      setFading(true);
      await new Promise((r) => setTimeout(r, 350)); // let the fade-out transition play
      if (!cancelled) setStep((s) => s + 1);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className="welcome auth">
      <div className="welcome-glow" />
      <div className="learning-inner">
        <img src="/mascot/orb-idle.webp" alt="" width={104} height={104} className="learning-mascot" />
        <div className={`learning-line ${fading ? 'is-fading' : ''}`} key={step}>
          {step === 0 && (
            <span className="flex items-center justify-center gap-2">
              Getting to know you
              <TypingDots />
            </span>
          )}
          {step === 1 && <span>{welcomeMessage}</span>}
          {step === 2 && <span>Finished getting to know you…</span>}
        </div>
        <div className="learning-dots">
          {lines.map((_, i) => (
            <span key={i} className={`learning-dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
