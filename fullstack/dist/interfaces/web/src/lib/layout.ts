import type { Node, Edge } from '@xyflow/react';
import type { Trip, NodeKind, TripNode, TripEdge, EdgeMode } from './types';
import { monthDay } from './format';

export const NODE_W = 244;
export const NODE_H = 104;

const COL_W = NODE_W + 118;
const ROW_H = NODE_H + 56;
// Extra vertical gap between one day's lane and the next, on top of ROW_H, so
// lanes read as distinct rows rather than one continuous grid. Generous enough
// to clear a hotel/activity card's photo thumbnail, which grows the card taller
// than the plain NODE_H the layout otherwise assumes.
const LANE_GAP = 96;
const LANE_LABEL_X = -252;

type LaneKey = number | 'unscheduled';

// A trip's startDate/endDate are set once from the traveler's first message
// and often widen turn by turn as real flight/hotel dates come in (see
// backfillTripDates on the server) — so a node's OWN stored dayIndex can go
// stale relative to the trip's current startDate. A node with a real
// timestamp is recomputed fresh on every render instead of trusting that
// stored value, which makes the board self-heal instead of needing a
// migration whenever the trip's dates get pinned down later in the
// conversation. Only a dateless activity (no time to derive from) falls back
// to whatever day the model explicitly assigned it.
function effectiveDayIndex(n: TripNode, tripStartDate: number | null): LaneKey {
  if (n.start != null && tripStartDate != null) {
    const startOfDay = (ms: number) => Math.floor(ms / 86400000);
    return startOfDay(n.start) - startOfDay(tripStartDate) + 1;
  }
  return typeof n.dayIndex === 'number' ? n.dayIndex : 'unscheduled';
}

// Free-guess connector label for a pair the stored edges never covered — e.g.
// two nodes that only became adjacent after re-sorting into day/time order.
// Mirrors the server's transit.ts heuristic (real routing isn't available
// client-side); good enough as a last resort, never blocks rendering.
function fallbackEdgeLabel(prev: TripNode, next: TripNode): { mode: EdgeMode; label: string } {
  if (next.kind === 'flight') {
    const min = next.detail?.durationMin;
    return { mode: 'flight', label: min ? `${Math.round(min)}m flight` : 'flight' };
  }
  if (next.kind === 'activity' && prev.kind === 'activity') return { mode: 'walk', label: '12 min walk' };
  if (prev.kind === 'flight' && next.kind === 'hotel') return { mode: 'drive', label: '20 min drive' };
  if (next.kind === 'activity') return { mode: 'walk', label: '15 min walk' };
  return { mode: 'drive', label: '20 min drive' };
}

// Day-by-day swimlanes: each day of the trip is its own row (desktop) or
// section (narrow/vertical), with a label showing "Day N · date". Items with
// no resolvable day land in a trailing "Unscheduled" lane instead of
// vanishing. Connectors are rebuilt from the FINAL chronological order (day,
// then time-of-day) rather than rendered from the stored from/to directly —
// the stored edges only ever chained nodes in whatever order the agent
// proposed them, which stops matching the display order the moment a node's
// day changes (a backfilled flight/hotel, or two same-day activities proposed
// out of time order) and otherwise draws a connector that visually crosses
// lanes or points the wrong way. Each stored edge's real computed
// mode/label/duration is still reused wherever the pair is still adjacent.
export function buildFlow(
  trip: Trip | null,
  ghosts: NodeKind[],
  selectedNodeId: string | null,
  vertical: boolean,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const real = trip?.nodes ?? [];
  const tripStartDate = trip?.startDate ?? null;

  const byLane = new Map<LaneKey, { node: TripNode; order: number }[]>();
  real.forEach((n, order) => {
    const key = effectiveDayIndex(n, tripStartDate);
    if (!byLane.has(key)) byLane.set(key, []);
    byLane.get(key)!.push({ node: n, order });
  });

  const dayKeys = [...byLane.keys()].filter((k): k is number => typeof k === 'number').sort((a, b) => a - b);
  const laneKeys: LaneKey[] = byLane.has('unscheduled') ? [...dayKeys, 'unscheduled'] : dayKeys;

  // Sort every lane once (chronological within the day; undated items keep
  // arrival order at the end) — reused both for node placement and for the
  // flattened chronological sequence edges are derived from below.
  laneKeys.forEach((laneKey) => {
    byLane.get(laneKey)!.sort((a, b) => {
      const as = a.node.start ?? Infinity;
      const bs = b.node.start ?? Infinity;
      if (as !== bs) return as - bs;
      return a.order - b.order;
    });
  });

  laneKeys.forEach((laneKey, laneRank) => {
    const items = byLane.get(laneKey)!;
    const laneY = vertical ? undefined : laneRank * (ROW_H + LANE_GAP);
    const laneLabelText =
      laneKey === 'unscheduled'
        ? 'Unscheduled'
        : `Day ${laneKey}${tripStartDate ? ` · ${monthDay(tripStartDate + (laneKey - 1) * 86400000)}` : ''}`;

    if (vertical) {
      // Narrow screens: stack lanes top-to-bottom, each lane's own items also
      // stacked top-to-bottom beneath its label.
      const laneStartIndex = laneKeys.slice(0, laneRank).reduce((sum, k) => sum + byLane.get(k)!.length + 1, 0);
      nodes.push({
        id: `lane-${laneKey}`,
        type: 'dayLabel',
        position: { x: 0, y: laneStartIndex * ROW_H },
        data: { label: laneLabelText },
        draggable: false,
        selectable: false,
      });
      items.forEach(({ node: n }, i) => {
        nodes.push({
          id: n.id,
          type: 'waypoint',
          position: { x: 36, y: (laneStartIndex + 1 + i) * ROW_H },
          data: { node: n, selected: n.id === selectedNodeId },
          draggable: false,
          selectable: true,
        });
      });
    } else {
      nodes.push({
        id: `lane-${laneKey}`,
        type: 'dayLabel',
        position: { x: LANE_LABEL_X, y: laneY! },
        data: { label: laneLabelText },
        draggable: false,
        selectable: false,
      });
      items.forEach(({ node: n }, i) => {
        nodes.push({
          id: n.id,
          type: 'waypoint',
          position: { x: i * COL_W, y: laneY! },
          data: { node: n, selected: n.id === selectedNodeId },
          draggable: false,
          selectable: true,
        });
      });
    }
  });

  // Ghost "ai is thinking about a flight/hotel/activity" placeholders trail
  // after whichever lane was most recently active — the last real day, or
  // day 1 for a brand new trip — so they appear where the eye already is.
  const lastLaneRank = Math.max(laneKeys.length - 1, 0);
  const lastLaneItems = laneKeys.length ? byLane.get(laneKeys[lastLaneRank])!.length : 0;
  ghosts.forEach((kind, gi) => {
    const pos = vertical
      ? { x: 36, y: (real.length + laneKeys.length + gi) * ROW_H }
      : { x: (lastLaneItems + gi) * COL_W, y: lastLaneRank * (ROW_H + LANE_GAP) };
    nodes.push({
      id: `ghost-${kind}`,
      type: 'ghost',
      position: pos,
      data: { kind },
      draggable: false,
      selectable: false,
    });
  });

  // Stored edges (with their real computed transit data) indexed by
  // unordered node-pair, so a pair that's still adjacent after sorting keeps
  // its real drive/walk numbers regardless of which direction it was
  // originally chained in.
  const storedByPair = new Map<string, TripEdge>();
  (trip?.edges ?? []).forEach((e) => {
    const key = [e.from, e.to].sort().join('|');
    storedByPair.set(key, e);
  });

  // The one true reading order: every real node, lane by lane (day order),
  // chronological within each lane — exactly what's on screen, top to bottom
  // / left to right. Connectors follow this, not the original proposal order.
  const flattened = laneKeys.flatMap((k) => byLane.get(k)!.map((x) => x.node));
  for (let i = 0; i < flattened.length - 1; i++) {
    const a = flattened[i];
    const b = flattened[i + 1];
    const stored = storedByPair.get([a.id, b.id].sort().join('|'));
    const fallback = stored ? null : fallbackEdgeLabel(a, b);
    edges.push({
      id: stored?.id ?? `derived-${a.id}-${b.id}`,
      source: a.id,
      target: b.id,
      type: 'smoothstep',
      label: stored?.label ?? fallback!.label,
      className: stored?.state === 'working' ? 'edge-working' : '',
      labelBgPadding: [8, 5],
      labelBgBorderRadius: 6,
    });
  }

  return { nodes, edges };
}
