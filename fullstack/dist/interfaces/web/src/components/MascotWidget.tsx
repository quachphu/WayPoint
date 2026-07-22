import { useEffect } from 'react';
import { useStore } from '../lib/store';
import { speak } from '../lib/tts';
import { IconCircleCheck, IconLoader2, IconMicrophone } from './icons';

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--live)', animation: `typing-dot 1.1s ease-in-out ${i * 0.15}s infinite` }}
        />
      ))}
    </span>
  );
}

// A persistent, always-on-top helper (bottom-right, z-index 999999 — above
// everything else in the app, Clippy-style) that jumps straight into voice
// planning from anywhere. Shares VoiceOrb's tap-to-talk behavior rather than
// its own text composer — there's no typed path to the AI anymore, this is
// just a second, always-reachable voice trigger. Keeps bobbing continuously
// so the app never feels static, even at rest — and switches to a livelier,
// faster wiggle plus a "thinking" speech bubble whenever it's actually doing
// something in the background (scouting nearby places), so that work is
// visible even if the map card itself is scrolled out of view.
export function MascotWidget() {
  const voiceState = useStore((s) => s.voiceState);
  const tapMascot = useStore((s) => s.tapMascot);
  const scanning = useStore((s) => s.placesScanning);
  const updateMessage = useStore((s) => s.placesUpdateMessage);
  const dismissPlacesUpdate = useStore((s) => s.dismissPlacesUpdate);

  useEffect(() => {
    if (scanning) speak('Scouting spots near you.');
  }, [scanning]);

  useEffect(() => {
    if (scanning || !updateMessage) return;
    let cancelled = false;
    // The bubble stays up for exactly as long as the mascot takes to say the
    // line, not a fixed guessed duration — dismiss it the moment speech
    // actually ends (store's own timeout is just a safety-net cap).
    speak(updateMessage).finally(() => {
      if (!cancelled) dismissPlacesUpdate();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateMessage]);

  const perked = voiceState === 'listening' || voiceState === 'speaking';
  const connecting = voiceState === 'connecting';

  return (
    <div className="fixed bottom-5 right-5 flex flex-col items-end" style={{ zIndex: 999999 }}>
      {scanning && (
        <div
          className="font-space mb-2 mr-1 flex items-center gap-1.5 rounded-full border border-[var(--border-warm)] px-3 py-1.5 text-xs text-[var(--text-2)] shadow-md"
          style={{ background: 'var(--surface)' }}
        >
          Scouting spots near you
          <TypingDots />
        </div>
      )}
      {!scanning && updateMessage && (
        <div
          className="font-space mb-2 mr-1 flex max-w-[220px] items-center gap-1.5 rounded-full border border-[var(--border-warm)] px-3 py-1.5 text-xs text-[var(--text-2)] shadow-md"
          style={{ background: 'var(--surface)' }}
        >
          <IconCircleCheck size={13} style={{ color: 'var(--live)', flexShrink: 0 }} />
          {updateMessage}
        </div>
      )}
      {!scanning && !updateMessage && (
        <div
          className="font-space mb-2 mr-1 flex items-center gap-1.5 rounded-full border border-[var(--border-warm)] px-3 py-1.5 text-xs text-[var(--text-2)] shadow-md"
          style={{ background: 'var(--surface)' }}
        >
          <IconMicrophone size={13} style={{ color: 'var(--live)', flexShrink: 0 }} />
          {voiceState === 'connecting' ? 'Connecting…' : perked ? 'Tap to stop' : 'Tap to talk'}
        </div>
      )}

      <button
        onClick={tapMascot}
        aria-label={scanning ? 'Talk to Waypoint (scouting nearby places)' : connecting ? 'Connecting to Waypoint' : perked ? 'Stop talking to Waypoint' : 'Talk to Waypoint'}
        title={scanning ? 'Scouting nearby places…' : connecting ? 'Connecting…' : perked ? 'Tap to stop' : 'Talk to Waypoint'}
        className="relative block"
        style={{ animation: scanning || connecting ? 'mascot-search 0.9s ease-in-out infinite' : 'mascot-float 3.2s ease-in-out infinite' }}
      >
        <img
          src={perked ? '/mascot/orb-listening.webp' : '/mascot/orb-idle.webp'}
          alt=""
          width={92}
          height={92}
          draggable={false}
          className="object-contain"
          style={{ filter: 'drop-shadow(0 8px 22px color-mix(in oklch, var(--live) 50%, transparent))' }}
        />
        {connecting && (
          <span
            className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full shadow-md"
            style={{ background: 'var(--surface)' }}
            aria-hidden
          >
            <IconLoader2 size={15} className="wp-spin" style={{ color: 'var(--live)' }} />
          </span>
        )}
      </button>
    </div>
  );
}
