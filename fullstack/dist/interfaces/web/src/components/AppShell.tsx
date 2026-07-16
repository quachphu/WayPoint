import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { auth } from '../lib/api';
import { Board } from './board/Board';
import { DetailPanel } from './board/DetailPanel';
import { Conversation } from './Conversation';
import { CallLayer } from './CallLayer';
import { VoiceOrb } from './VoiceOrb';
import { Facepile } from './people/Facepile';
import { PeoplePanel } from './people/PeoplePanel';
import { dateRange } from '../lib/format';
import {
  IconPlus,
  IconMoon,
  IconSun,
  IconChevronDown,
  IconClockHour4,
  IconArrowUp,
  IconUsers,
} from './icons';

function useIsMobile(bp = 880) {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < bp);
  useEffect(() => {
    const on = () => setM(window.innerWidth < bp);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [bp]);
  return m;
}

const STARTERS = [
  'Plan a weekend in San Francisco',
  'Find me a flight to New York next Friday',
  'Two nights in Seattle, I love good coffee',
];

function FrontDoor() {
  const send = useStore((s) => s.send);
  const [text, setText] = useState('');
  const submit = (t: string) => {
    const v = t.trim();
    if (v) send(v, 'chat');
  };
  return (
    <div className="frontdoor">
      <TopBar minimal />
      <div className="frontdoor-inner">
        <VoiceOrb size={92} forceReady />
        <h1 className="font-display frontdoor-title">Where are we headed?</h1>
        <p className="frontdoor-sub">Say it or type it, I'll sort the rest.</p>
        <div className="frontdoor-input">
          <input
            className="field"
            style={{ height: 52, paddingRight: 52 }}
            autoFocus
            placeholder="Plan a weekend in…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                submit(text);
                setText('');
              }
            }}
          />
          <button
            className="btn btn--primary"
            style={{ position: 'absolute', right: 6, top: 6, width: 40, height: 40, padding: 0 }}
            onClick={() => {
              submit(text);
              setText('');
            }}
            aria-label="Send"
          >
            <IconArrowUp size={20} />
          </button>
        </div>
        <div className="frontdoor-starters">
          {STARTERS.map((s) => (
            <button key={s} className="starter-chip" onClick={() => submit(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Menu() {
  const trips = useStore((s) => s.trips);
  const activeTripId = useStore((s) => s.activeTripId);
  const switchTrip = useStore((s) => s.switchTrip);
  const newTrip = useStore((s) => s.newTrip);
  const openPeople = useStore((s) => s.openPeople);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener('mousedown', on);
    return () => document.removeEventListener('mousedown', on);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Trips">
        <IconChevronDown size={18} />
      </button>
      {open && (
        <div className="menu-pop">
          <div className="menu-label">Your trips</div>
          {trips.length === 0 && <div className="menu-empty">No trips yet</div>}
          {trips.map((t) => (
            <button
              key={t.id}
              className={`menu-item${t.id === activeTripId ? ' active' : ''}`}
              onClick={() => {
                switchTrip(t.id);
                setOpen(false);
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
            </button>
          ))}
          <div className="menu-divider" />
          {activeTripId && (
            <button
              className="menu-item"
              onClick={() => {
                openPeople();
                setOpen(false);
              }}
            >
              <IconUsers size={16} /> Manage people
            </button>
          )}
          <button
            className="menu-item"
            onClick={() => {
              newTrip();
              setOpen(false);
            }}
          >
            <IconPlus size={16} /> New trip
          </button>
          <button className="menu-item" onClick={() => auth.logout()}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function TopBar({ minimal = false }: { minimal?: boolean }) {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const trip = useStore((s) => s.trip);
  const newTrip = useStore((s) => s.newTrip);
  const triggerDisruption = useStore((s) => s.triggerDisruption);

  return (
    <div className="titlebar no-select">
      <div style={{ minWidth: 0, flex: 1 }}>
        {trip && !minimal ? (
          <>
            <div className="font-display titlebar-name">{trip.title}</div>
            <div className="titlebar-meta">
              {[dateRange(trip.startDate, trip.endDate), `${trip.nodes.length} stop${trip.nodes.length === 1 ? '' : 's'}`]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </>
        ) : (
          <div className="titlebar-brand">
            <img src="/mascot/orb-idle.webp" alt="" width={26} height={26} style={{ objectFit: 'contain' }} />
            Waypoint
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {trip && !minimal && <Facepile />}
        {trip && trip.status === 'confirmed' && !minimal && (
          <button className="pill-btn" onClick={triggerDisruption} title="Demo: simulate a flight delay">
            <IconClockHour4 size={16} /> Simulate a delay
          </button>
        )}
        {!minimal && (
          <button className="icon-btn" onClick={newTrip} aria-label="New trip" title="New trip">
            <IconPlus size={18} />
          </button>
        )}
        <button className="icon-btn" onClick={toggleTheme} aria-label="Theme">
          {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>
        <Menu />
      </div>
    </div>
  );
}

function SplitShell() {
  const mobile = useIsMobile();
  if (mobile) {
    return (
      <div className="shell-mobile">
        <div className="board-zone">
          <TopBar />
          <div className="board-canvas-wrap">
            <Board vertical />
            <DockedPanel />
            <CallLayer />
          </div>
        </div>
        <div className="conv-mobile">
          <Conversation />
        </div>
      </div>
    );
  }
  return (
    <div className="shell">
      <aside className="conv-col">
        <Conversation />
      </aside>
      <main className="board-zone">
        <TopBar />
        <div className="board-canvas-wrap">
          <Board />
          <DockedPanel />
          <CallLayer />
        </div>
      </main>
    </div>
  );
}

// The right-docked slot is shared: People takes precedence when open, otherwise
// the node-detail panel. Both cross-fade in the same position.
function DockedPanel() {
  const peopleOpen = useStore((s) => s.peopleOpen);
  return peopleOpen ? <PeoplePanel /> : <DetailPanel />;
}

export function AppShell() {
  const trip = useStore((s) => s.trip);
  const activeTripId = useStore((s) => s.activeTripId);
  const atFrontDoor = !activeTripId && !trip;
  return atFrontDoor ? <FrontDoor /> : <SplitShell />;
}
