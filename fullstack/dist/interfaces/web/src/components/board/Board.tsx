import { useEffect, useMemo, useRef } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, useReactFlow } from '@xyflow/react';
import { useStore } from '../../lib/store';
import { buildFlow, NODE_W, NODE_H } from '../../lib/layout';
import { WaypointNode } from './WaypointNode';
import { GhostNode } from './GhostNode';

const nodeTypes = { waypoint: WaypointNode, ghost: GhostNode };

function BoardInner({ vertical }: { vertical: boolean }) {
  const trip = useStore((s) => s.trip);
  const ghosts = useStore((s) => s.ghosts);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const selectNode = useStore((s) => s.selectNode);
  const pan = useStore((s) => s.pan);
  const { nodes, edges } = useMemo(
    () => buildFlow(trip, ghosts, selectedNodeId, vertical),
    [trip, ghosts, selectedNodeId, vertical],
  );
  const rf = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);
  const fittedTrip = useRef<string | null>(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Fit the whole trip into view when a trip first loads (or changes).
  useEffect(() => {
    if (trip && trip.nodes.length && fittedTrip.current !== trip.id) {
      fittedTrip.current = trip.id;
      const t = setTimeout(() => rf.fitView({ padding: 0.25, duration: reduce ? 0 : 500, maxZoom: 1 }), 80);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, trip?.nodes.length]);

  // Follow the build, but only pan when a newly-added node is actually off-screen.
  // Recentering on every event (or mid-read) is nauseating.
  useEffect(() => {
    if (!pan.nodeId) return;
    const n = nodes.find((x) => x.id === pan.nodeId);
    const wrap = wrapRef.current;
    if (!n || !wrap) return;
    const t = setTimeout(() => {
      try {
        const vp = rf.getViewport();
        const W = wrap.clientWidth;
        const H = wrap.clientHeight;
        const sx = n.position.x * vp.zoom + vp.x;
        const sy = n.position.y * vp.zoom + vp.y;
        const nodeW = NODE_W * vp.zoom;
        const nodeH = NODE_H * vp.zoom;
        const pad = 48;
        const onScreen = sx >= pad && sy >= pad && sx + nodeW <= W - pad && sy + nodeH <= H - pad;
        if (!onScreen) {
          rf.setCenter(n.position.x + NODE_W / 2, n.position.y + NODE_H / 2, {
            zoom: Math.min(1, Math.max(0.72, vp.zoom)),
            duration: reduce ? 0 : 450,
          });
        }
      } catch {
        /* noop */
      }
    }, 40);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pan.seq]);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, n) => n.type === 'waypoint' && selectNode(n.id)}
      onPaneClick={() => selectNode(null)}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      proOptions={{ hideAttribution: true }}
      minZoom={0.5}
      maxZoom={1.5}
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
      panOnScroll
      selectionOnDrag={false}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--border-strong)" />
    </ReactFlow>
    </div>
  );
}

export function Board({ vertical = false }: { vertical?: boolean }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ReactFlowProvider>
        <BoardInner vertical={vertical} />
      </ReactFlowProvider>
    </div>
  );
}
