import { useEffect, useRef, useState } from 'react';
import { useStore, myCanApprove } from '../lib/store';
import { moneyExact, weekdayShort, timeOfDay, dateRange, durationLabel } from '../lib/format';
import { shortName, presenceVar } from '../lib/presence';
import { KindIcon, IconPhone, IconHourglassLow } from './icons';
import type { PendingAction, NodeKind } from '../lib/types';

interface GateView {
  eyebrow: string;
  iconKind: NodeKind | 'phone';
  tileVoice: boolean;
  title: string;
  rows: { l: string; v: string }[];
  note: string | null;
  charge: string | null;
  affirm: string;
}

function buildView(a: PendingAction): GateView {
  const p = a.payload || {};
  if (a.kind === 'place_call') {
    return {
      eyebrow: 'Confirm call',
      iconKind: 'phone',
      tileVoice: true,
      title: a.summary,
      rows: [],
      note: 'Waypoint opens every call by identifying itself as an AI assistant.',
      charge: null,
      affirm: 'Call the airline',
    };
  }
  if (a.kind === 'rebook') {
    const o = p.newOffer || {};
    const delta = p.fareDeltaCents || 0;
    const rows = [
      { l: 'New departure', v: o.departAt ? `${weekdayShort(o.departAt)}, ${timeOfDay(o.departAt)}` : '' },
      { l: 'Arrives', v: o.arriveAt ? timeOfDay(o.arriveAt) : '' },
    ].filter((r) => r.v);
    const charge =
      delta > 0
        ? `${moneyExact(delta)} more will be charged to your card.`
        : delta < 0
          ? `You will be refunded ${moneyExact(Math.abs(delta))}.`
          : 'No change in fare.';
    return { eyebrow: 'Confirm change', iconKind: 'flight', tileVoice: false, title: a.summary, rows, note: null, charge, affirm: 'Rebook it' };
  }
  // book_flight / book_hotel
  const o = p.offer || {};
  if (a.kind === 'book_hotel') {
    return {
      eyebrow: 'Confirm booking',
      iconKind: 'hotel',
      tileVoice: false,
      title: `Book ${o.name || 'this hotel'}`,
      rows: [
        { l: 'Dates', v: dateRange(o.checkIn, o.checkOut) },
        { l: 'Neighborhood', v: o.neighborhood },
        { l: 'Rating', v: o.rating ? `${o.rating} / 5` : '' },
        { l: 'Nightly', v: o.nightlyCents ? `${moneyExact(o.nightlyCents)} / night` : '' },
        { l: 'Nights', v: String(o.nights || '') },
        { l: 'Cancellation', v: o.cancellable == null ? '' : o.cancellable ? 'Free cancellation' : 'Non-refundable' },
        { l: 'Total', v: moneyExact(o.totalCents) },
      ].filter((r) => r.v),
      note: null,
      charge: `${moneyExact(o.totalCents)} will be charged to your card.`,
      affirm: 'Book it',
    };
  }
  const stopsLabel = o.stops == null ? '' : o.stops === 0 ? 'Nonstop' : `${o.stops} stop${o.stops === 1 ? '' : 's'}`;
  return {
    eyebrow: 'Confirm booking',
    iconKind: 'flight',
    tileVoice: false,
    title: `Book ${o.carrier || ''} ${o.flightNumber || ''}`.trim() || 'Book this flight',
    rows: [
      { l: 'Route', v: o.origin && o.destination ? `${o.origin} → ${o.destination}` : '' },
      { l: 'Departs', v: o.departAt ? `${weekdayShort(o.departAt)}, ${timeOfDay(o.departAt)}` : '' },
      { l: 'Arrives', v: o.arriveAt ? timeOfDay(o.arriveAt) : '' },
      { l: 'Duration', v: [o.durationMin ? durationLabel(o.durationMin) : '', stopsLabel].filter(Boolean).join(' · ') },
      { l: 'Cabin', v: [o.cabin, o.fareBrand].filter(Boolean).join(' · ') },
      { l: 'Fare', v: moneyExact(o.priceCents) },
    ].filter((r) => r.v),
    note: null,
    charge: `${moneyExact(o.priceCents)} will be charged to your card.`,
    affirm: 'Book it',
  };
}

export function ConfirmGate() {
  const pending = useStore((s) => s.pendingActions);
  const callOpen = useStore((s) => s.call.open);
  const approve = useStore((s) => s.approve);
  const decline = useStore((s) => s.decline);
  const gatePress = useStore((s) => s.gatePress);
  const roster = useStore((s) => s.roster);
  const myId = useStore((s) => s.profile?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [ripple, setRipple] = useState(false);
  const lastSeq = useRef(gatePress.seq);
  const affirmRef = useRef<HTMLButtonElement>(null);

  const action = pending[pending.length - 1];
  const canApprove = myCanApprove(roster);

  const runApprove = async (viaVoice: boolean) => {
    if (busy || !action) return;
    if (viaVoice) {
      setRipple(true);
      setTimeout(() => setRipple(false), 440);
    }
    setBusy(true);
    if (viaVoice) await new Promise((r) => setTimeout(r, 360)); // let the ripple read before it resolves
    await approve(action.id);
    setBusy(false);
  };

  // Focus the affirmative on open so Enter confirms; Escape declines.
  useEffect(() => {
    if (!action || callOpen || !canApprove) return;
    const t = setTimeout(() => affirmRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') decline(action.id);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action?.id, callOpen]);

  // A spoken/typed "yes" drives the button press through the same path as a click.
  useEffect(() => {
    if (gatePress.seq !== lastSeq.current) {
      lastSeq.current = gatePress.seq;
      if (action && gatePress.id === action.id && !callOpen) runApprove(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatePress.seq]);

  if (!action || callOpen) return null;

  // A companion without approval rights never gets the blocking scrim. If the
  // pending request is one they made, show a quiet, non-blocking bar with a way
  // to cancel it; otherwise the node's held badge already tells the story.
  if (!canApprove) {
    const mine = action.requestedBy?.userId === myId;
    if (!mine) return null;
    const owner = shortName(roster.find((m) => m.role === 'owner') || null, 'the owner');
    return (
      <div className="gate-held-bar" role="status">
        <span className="gate-held-icon">
          <IconHourglassLow size={16} />
        </span>
        <span className="gate-held-text">
          Waiting for {owner} to approve · <b>{action.summary}</b>
        </span>
        <button className="gate-held-cancel" onClick={() => decline(action.id)}>
          Cancel request
        </button>
      </div>
    );
  }

  const v = buildView(action);
  const req = action.requestedBy;

  return (
    <div
      className="gate-scrim"
      onClick={() => {
        setNudge(true);
        setTimeout(() => setNudge(false), 200);
      }}
    >
      <div className="gate" style={nudge ? { animation: 'settle 180ms var(--ease-settle)' } : undefined} onClick={(e) => e.stopPropagation()}>
        {req && (
          <div className="gate__requested">
            <span className="gate__requested-dot" style={{ background: presenceVar(req.color) }} />
            Requested by {req.name}
          </div>
        )}
        <div className="gate__eyebrow">{v.eyebrow}</div>
        <div className="gate__head">
          <div
            className="gate__tile"
            style={v.tileVoice ? { background: 'var(--accent-voice-tint)', color: 'var(--accent-voice)' } : undefined}
          >
            {v.iconKind === 'phone' ? <IconPhone size={20} /> : <KindIcon kind={v.iconKind} size={20} />}
          </div>
          <div className="gate__action">{v.title}</div>
        </div>

        {v.rows.length > 0 && (
          <div className="gate__sum">
            {v.rows.map((r) => (
              <div className="gate__li" key={r.l}>
                <span>{r.l}</span>
                <b>{r.v}</b>
              </div>
            ))}
          </div>
        )}

        {v.note && <div className="gate__charge">{v.note}</div>}
        {v.charge && <div className="gate__charge">{v.charge}</div>}

        <div className="gate__btns">
          <button className="btn btn--ghost" onClick={() => decline(action.id)} disabled={busy}>
            Not yet
          </button>
          <button
            ref={affirmRef}
            className="btn btn--primary"
            onClick={() => runApprove(false)}
            disabled={busy}
            style={{ minWidth: 128, position: 'relative', overflow: 'hidden', background: busy ? 'var(--accent-strong)' : undefined }}
          >
            <span className={`gate__ripple${ripple ? ' go' : ''}`} />
            {busy ? <span className="spinner" style={{ width: 18, height: 18 }} /> : v.affirm}
          </button>
        </div>
      </div>
    </div>
  );
}
