import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { clock } from '../lib/format';

export function CallLayer() {
  const call = useStore((s) => s.call);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);

  // Timer runs while the call is live.
  useEffect(() => {
    if (!call.open) return;
    setElapsed(0);
    const start = Date.now();
    const id = window.setInterval(() => {
      if (call.status !== 'ended') setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.sessionId, call.open]);

  // Keep the transcript pinned to the newest turn.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [call.transcript.length]);

  if (!call.open) return null;
  const ended = call.status === 'ended';

  return (
    <div className={`call-layer${ended ? ' ending' : ''}`}>
      <div className="call-status">
        <span className="call-dot" style={ended ? { animation: 'none', opacity: 0.5 } : undefined} />
        <span>{ended ? 'Call ended' : `On the line with ${call.target}`}</span>
        {!ended && <span className="mono-tnum" style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary)' }}>{clock(elapsed)}</span>}
      </div>
      <div className="call-sub">{ended ? call.outcome || 'Wrapping up' : call.subStatus}</div>

      <div className="call-transcript" ref={scrollRef}>
        {call.transcript.map((t, i) => (
          <div key={i} className={`call-turn ${t.speaker === 'waypoint' ? 'wp' : 'venue'}`}>
            {t.speaker === 'venue' && <div className="who">{call.target}</div>}
            {t.text}
          </div>
        ))}
        {!ended && call.transcript.length > 0 && call.transcript[call.transcript.length - 1].speaker === 'waypoint' && (
          <div className="call-turn venue" style={{ opacity: 0.7 }}>
            <div className="who">{call.target}</div>
            <span className="typing" style={{ padding: 0 }}>
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
