import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { presenceVar } from '../lib/presence';
import { dateRange } from '../lib/format';
import type { PublicRecap } from '../lib/types';

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return '?';
  return parts.length === 1 ? parts[0][0]!.toUpperCase() : (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}

// A standalone, genuinely public page — rendered by App.tsx BEFORE any
// sign-in gate, since a recap is meant to reach someone who may never have
// a Waypoint account ("the person you traveled with"). See getRecap.ts for
// the one unauthenticated endpoint this relies on.
export function RecapPage({ token }: { token: string }) {
  const [recap, setRecap] = useState<PublicRecap | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api
      .getRecap({ token })
      .then((res) => {
        if (!cancelled) setRecap(res.recap);
      })
      .catch(() => {
        if (!cancelled) setRecap(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (recap === undefined) {
    return (
      <div className="welcome">
        <div className="welcome-glow" />
        <div className="welcome-inner">
          <span className="spinner" style={{ width: 24, height: 24, color: 'var(--accent-voice)' }} />
        </div>
      </div>
    );
  }

  if (!recap) {
    return (
      <div className="welcome">
        <div className="welcome-glow" />
        <div className="welcome-inner">
          <h1 className="font-display" style={{ fontSize: 22 }}>
            That recap isn't here anymore
          </h1>
          <p className="welcome-sub" style={{ marginTop: 8 }}>The link may be old, or mistyped.</p>
          <a className="btn btn--primary" style={{ marginTop: 20, textDecoration: 'none' }} href="/">
            Open Waypoint
          </a>
        </div>
      </div>
    );
  }

  const dates = dateRange(recap.startDate, recap.endDate);

  return (
    <div className="welcome" style={{ alignItems: 'flex-start', overflowY: 'auto', padding: '48px 20px' }}>
      <div className="welcome-glow" />
      <div
        className="welcome-inner"
        style={{ maxWidth: 560, width: '100%', margin: '0 auto', textAlign: 'left', alignItems: 'stretch' }}
      >
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-warm)',
            borderRadius: 'var(--r-xl)',
            boxShadow: 'var(--shadow-3)',
            padding: 36,
          }}
        >
          <div className="font-space" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            {dates || 'A trip with Waypoint'}
          </div>
          <h1 className="font-display" style={{ fontSize: 32, lineHeight: 1.15, marginTop: 6 }}>
            {recap.title}
          </h1>
          <div className="font-space" style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4 }}>
            {recap.destination}
          </div>

          {recap.companions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
              <div style={{ display: 'flex' }}>
                {recap.companions.map((c, i) => (
                  <span
                    key={i}
                    className="wp-avatar"
                    style={{
                      width: 30,
                      height: 30,
                      fontSize: 12,
                      background: presenceVar(c.color),
                      marginLeft: i === 0 ? 0 : -8,
                      boxShadow: '0 0 0 2px var(--surface)',
                    }}
                    title={c.name}
                  >
                    <span className="wp-avatar-initials">{initialsFor(c.name)}</span>
                  </span>
                ))}
              </div>
              <span className="font-space" style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                {recap.companions.map((c) => c.name).join(', ')}
              </span>
            </div>
          )}

          {recap.photoUrls.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
              {recap.photoUrls.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  style={{ flex: 1, height: 120, objectFit: 'cover', borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }}
                />
              ))}
            </div>
          )}

          <p className="font-space" style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--text)', marginTop: 22 }}>
            {recap.narrative}
          </p>

          {recap.disruptionLine && (
            <div
              style={{
                marginTop: 18,
                padding: '14px 16px',
                borderRadius: 'var(--r-md)',
                background: 'var(--accent-voice-tint)',
                border: '1px solid color-mix(in oklch, var(--accent-voice) 30%, transparent)',
                fontSize: 14,
                lineHeight: 1.5,
                color: 'var(--text)',
              }}
            >
              {recap.disruptionLine}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <a href="/" className="font-space" style={{ fontSize: 13.5, color: 'var(--accent-voice)', fontWeight: 600, textDecoration: 'none' }}>
            Plan your own trip with Waypoint →
          </a>
        </div>
      </div>
    </div>
  );
}
