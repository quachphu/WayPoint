// The one branded splash moment — a warm, sunny welcome led by the mascot.
export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="welcome">
      <div className="welcome-glow" />
      <div className="welcome-inner">
        <img className="welcome-mascot" src="/mascot/orb-idle.webp" alt="Waypoint" draggable={false} width={128} height={128} />
        <h1 className="font-display welcome-title">Where are we headed?</h1>
        <p className="welcome-sub">
          Your sunny little travel buddy. It plans the trip, books it, and picks up the phone when a flight falls
          apart. Just say the word.
        </p>
        <button className="btn btn--primary welcome-cta" onClick={onStart}>
          Get started
        </button>
      </div>
    </div>
  );
}
