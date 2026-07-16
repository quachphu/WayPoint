import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { TripNode } from '../../lib/types';
import { KindIcon, IconLoader2, IconCheck, IconHourglassLow } from '../icons';
import { timeOfDay, weekdayShort, moneyShort } from '../../lib/format';
import { useStore, myCanApprove } from '../../lib/store';
import { shortName } from '../../lib/presence';
import { PresenceCluster } from '../people/PresenceCluster';

function metaLine(n: TripNode): string {
  if (n.kind === 'flight') {
    const when = n.start ? `${weekdayShort(n.start)} ${timeOfDay(n.start)}` : '';
    return [when, n.subtitle].filter(Boolean).join(' · ');
  }
  if (n.kind === 'hotel') return n.subtitle || '';
  return n.subtitle || (n.start ? weekdayShort(n.start) : 'Activity');
}

function statusLabel(n: TripNode): { text: string; color: string } | null {
  if (n.working) return null;
  if (n.status === 'disrupted') return { text: 'Delayed', color: 'var(--accent-voice)' };
  if (n.status === 'failed') return { text: 'Needs attention', color: 'var(--danger)' };
  return null; // proposed + confirmed stay quiet
}

export const WaypointNode = memo(({ data }: any) => {
  const node: TripNode = data.node;
  const selected: boolean = data.selected;
  const prevWorking = useRef(node.working);
  const prevStatus = useRef(node.status);
  const [resolving, setResolving] = useState(false);
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    const stoppedWorking = prevWorking.current && !node.working;
    const becameConfirmed = prevStatus.current !== 'confirmed' && node.status === 'confirmed';
    // Celebrate only a genuine resolution to confirmed (a booking or a rebooking),
    // never a call that ended with the flight still delayed.
    const resolvedToConfirmed = (stoppedWorking || becameConfirmed) && node.status === 'confirmed';
    prevWorking.current = node.working;
    prevStatus.current = node.status;
    if (resolvedToConfirmed) {
      setResolving(true);
      setShowCheck(true);
      const t1 = setTimeout(() => setResolving(false), 240);
      const t2 = setTimeout(() => setShowCheck(false), 1600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [node.working, node.status]);

  // Shared-trip state: a gate on this node that the current viewer can't clear
  // shows as a quiet "held" badge (waiting on a human — NOT the working glow).
  const roster = useStore((s) => s.roster);
  const pendingActions = useStore((s) => s.pendingActions);
  const gate = pendingActions.find((a) => a.nodeId === node.id && a.status === 'pending');
  const canApprove = myCanApprove(roster);
  const held = !!gate && !canApprove && !node.working;
  const ownerName = shortName(roster.find((m) => m.role === 'owner') || null, 'the owner');

  const sl = statusLabel(node);
  const kicker = kickerLabel(node);
  // The "Booked" stamp springs on only for a genuinely confirmed node.
  const showStamp = node.status === 'confirmed' && !node.working;
  return (
    <div
      className={`wp-node no-select${selected ? ' selected' : ''}${node.working ? ' working' : ''}${resolving ? ' resolving' : ''}${held ? ' held' : ''}`}
      data-status={node.status}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <PresenceCluster nodeId={node.id} />
      {showStamp && (
        <img
          className={`wp-node__stamp${resolving ? ' pop' : ''}`}
          src="/mascot/stamp-booked.webp"
          alt="Booked"
          width={54}
          height={54}
        />
      )}
      <div className="wp-node__row">
        <span className="wp-node__chip" data-status={node.status}>
          {node.working ? <IconLoader2 size={20} className="spin-ico" /> : <KindIcon kind={node.kind} />}
        </span>
        <div className="wp-node__headings">
          {kicker && <div className="wp-node__kicker">{kicker}</div>}
          <div className="wp-node__title">{node.title}</div>
        </div>
      </div>
      <div className="wp-node__meta">{metaLine(node) || (node.costCents != null ? moneyShort(node.costCents) : '')}</div>
      {node.working ? (
        <div className="wp-node__work">
          <span className="wp-node__work-dot" /> Working on it
        </div>
      ) : held ? (
        <div className="wp-node__held">
          <IconHourglassLow size={14} /> Waiting for {ownerName}
        </div>
      ) : showCheck ? (
        <div className="wp-node__work" style={{ color: 'var(--success)' }}>
          <IconCheck size={14} /> Done
        </div>
      ) : null}
      {sl && !held && (
        <span className="wp-node__status" style={{ color: sl.color }}>
          {sl.text}
        </span>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
});

// The small uppercase kicker above the title (the node's kind + a hint).
function kickerLabel(n: TripNode): string {
  if (n.kind === 'flight') return 'Flight';
  if (n.kind === 'hotel') return 'Stay';
  if (n.kind === 'activity') return 'Plan';
  return 'Stop';
}
