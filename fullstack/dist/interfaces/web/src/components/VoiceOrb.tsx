import { useStore } from '../lib/store';

// One continuous voice orb — the sun-drop mascot. idle / ready / listening /
// speaking states are driven by the store's voiceState. The mascot swaps to its
// perked-up render while listening or speaking. Pass `faceless` for calm modes
// (the call layer / gate) where the face fades out and only the glow remains.
export function VoiceOrb({
  size = 56,
  dim = false,
  forceReady = false,
  faceless = false,
}: {
  size?: number;
  dim?: boolean;
  forceReady?: boolean;
  faceless?: boolean;
}) {
  const storeState = useStore((s) => s.voiceState);
  const toggle = useStore((s) => s.toggleMic);
  // The front-door orb gently breathes ("ready") to invite a first word.
  const state = forceReady && storeState === 'idle' ? 'ready' : storeState;
  const perked = state === 'listening' || state === 'speaking';
  const src = perked ? '/mascot/orb-listening.webp' : '/mascot/orb-idle.webp';
  return (
    <button
      className={`orb${dim ? ' dim' : ''}${faceless ? ' faceless' : ''}`}
      data-state={state}
      style={{ width: size, height: size }}
      onClick={toggle}
      aria-label="Talk to Waypoint"
      title="Talk to Waypoint"
    >
      <span className="orb__glow" />
      <span className="orb__ring" />
      <span className="orb__ring" />
      {/* faceless fallback: a plain sunny gradient blob for calm modes */}
      <span className="orb__blob" />
      <img className="orb__face" src={src} alt="" draggable={false} width={size} height={size} />
    </button>
  );
}
