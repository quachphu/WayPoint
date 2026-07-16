import type { Node, Edge } from '@xyflow/react';
import type { Trip, NodeKind } from './types';

export const NODE_W = 244;
export const NODE_H = 104;

// Chronological layout: left-to-right on wide screens (gentle vertical zig so it
// doesn't read as a rigid ruler), top-to-bottom on narrow screens.
export function buildFlow(
  trip: Trip | null,
  ghosts: NodeKind[],
  selectedNodeId: string | null,
  vertical: boolean,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const real = trip?.nodes ?? [];

  const colW = NODE_W + 118;
  const rowH = NODE_H + 56;
  const place = (i: number) =>
    vertical ? { x: (i % 2) * 36, y: i * rowH } : { x: i * colW, y: (i % 2) * 72 };

  real.forEach((n, i) => {
    nodes.push({
      id: n.id,
      type: 'waypoint',
      position: place(i),
      data: { node: n, selected: n.id === selectedNodeId },
      draggable: false,
      selectable: true,
    });
  });

  ghosts.forEach((kind, gi) => {
    const i = real.length + gi;
    nodes.push({
      id: `ghost-${kind}`,
      type: 'ghost',
      position: place(i),
      data: { kind },
      draggable: false,
      selectable: false,
    });
  });

  (trip?.edges ?? []).forEach((e) => {
    edges.push({
      id: e.id,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      label: e.label,
      className: e.state === 'working' ? 'edge-working' : '',
      labelBgPadding: [8, 5],
      labelBgBorderRadius: 6,
    });
  });

  return { nodes, edges };
}
