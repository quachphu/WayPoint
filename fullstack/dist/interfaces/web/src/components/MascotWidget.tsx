import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { speak } from '../lib/tts';
import { IconCircleCheck, IconSend2, IconSparkles, IconX } from './icons';

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
// everything else in the app, Clippy-style) that can jump straight into
// planning a trip from anywhere. Keeps bobbing continuously so the app
// never feels static, even at rest — and switches to a livelier, faster
// wiggle plus a "thinking" speech bubble whenever it's actually doing
// something in the background (scouting nearby places), so that work is
// visible even if the map card itself is scrolled out of view.
export function MascotWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const openNewPlanning = useStore((s) => s.openNewPlanning);
  const send = useStore((s) => s.send);
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

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    openNewPlanning();
    await send(trimmed, 'chat');
    setBusy(false);
    setText('');
    setOpen(false);
  };

  return (
    <div className="fixed bottom-5 right-5 flex flex-col items-end" style={{ zIndex: 999999 }}>
      {open && (
        <div
          className="mb-3 w-[300px] overflow-hidden rounded-2xl border border-[var(--border-warm)] shadow-[var(--shadow-3)]"
          style={{ background: 'var(--surface)' }}
        >
          <div className="flex items-center gap-2 border-b border-[var(--border-warm)] px-4 py-3">
            <IconSparkles size={16} style={{ color: 'var(--live)' }} />
            <span className="font-display flex-1 text-sm font-semibold text-[var(--text)]">Need a hand?</span>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
              <IconX size={16} />
            </button>
          </div>
          <div className="p-4">
            <p className="font-space mb-3 text-sm text-[var(--text-2)]">Tell me where you want to go and I'll start planning.</p>
            <div className="flex items-center gap-2">
              <input
                className="field font-space flex-1 text-sm"
                placeholder="A weekend in Lisbon…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                disabled={busy}
                autoFocus
              />
              <button className="icon-btn" onClick={submit} aria-label="Send" disabled={busy} style={{ color: 'var(--live)' }}>
                <IconSend2 size={18} />
              </button>
            </div>
            <p className="font-space mt-3 text-xs text-[var(--text-3)]">Posting photos and trip updates is coming soon.</p>
          </div>
        </div>
      )}

      {!open && scanning && (
        <div
          className="font-space mb-2 mr-1 flex items-center gap-1.5 rounded-full border border-[var(--border-warm)] px-3 py-1.5 text-xs text-[var(--text-2)] shadow-md"
          style={{ background: 'var(--surface)' }}
        >
          Scouting spots near you
          <TypingDots />
        </div>
      )}
      {!open && !scanning && updateMessage && (
        <div
          className="font-space mb-2 mr-1 flex max-w-[220px] items-center gap-1.5 rounded-full border border-[var(--border-warm)] px-3 py-1.5 text-xs text-[var(--text-2)] shadow-md"
          style={{ background: 'var(--surface)' }}
        >
          <IconCircleCheck size={13} style={{ color: 'var(--live)', flexShrink: 0 }} />
          {updateMessage}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={scanning ? 'Waypoint assistant (scouting nearby places)' : 'Waypoint assistant'}
        title={scanning ? 'Scouting nearby places…' : undefined}
        className="block"
        style={{ animation: scanning ? 'mascot-search 0.9s ease-in-out infinite' : 'mascot-float 3.2s ease-in-out infinite' }}
      >
        <img
          src="/mascot/orb-idle.webp"
          alt=""
          width={92}
          height={92}
          draggable={false}
          className="object-contain"
          style={{ filter: 'drop-shadow(0 8px 22px color-mix(in oklch, var(--live) 50%, transparent))' }}
        />
      </button>
    </div>
  );
}
