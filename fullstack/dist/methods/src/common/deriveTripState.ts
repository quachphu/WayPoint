import type { TripNode, TripEdge } from './types';

// The pure fold: given a trip's events in created_at order, derive the current
// board (nodes + edges). This is the single source of the board — the trip row's
// nodes/edges are just this function's cached output. Keeping it pure guarantees
// voice, chat, and the board all read from one truth.

interface FoldEvent {
  kind: string;
  payload: Record<string, any>;
}

export function deriveTripState(events: FoldEvent[]): { nodes: TripNode[]; edges: TripEdge[] } {
  const nodes: TripNode[] = [];
  const edges: TripEdge[] = [];
  const nodeById = new Map<string, TripNode>();
  const edgeById = new Map<string, TripEdge>();

  const patchNode = (id: string | undefined, patch: Partial<TripNode> & { detail?: Record<string, any> }) => {
    if (!id) return;
    const n = nodeById.get(id);
    if (!n) return;
    const { detail, ...rest } = patch;
    Object.assign(n, rest);
    if (detail) n.detail = { ...(n.detail || {}), ...detail };
  };

  for (const e of events) {
    const p = e.payload || {};
    switch (e.kind) {
      case 'node_proposed': {
        const node = p as TripNode;
        if (!node.id) break;
        if (!nodeById.has(node.id)) {
          const clone: TripNode = { ...node, dependsOn: node.dependsOn || [] };
          nodes.push(clone);
          nodeById.set(node.id, clone);
        } else {
          patchNode(node.id, node);
        }
        break;
      }
      // Same fold as node_proposed — a distinct event kind purely so the raw
      // log stays honest about provenance (imported vs. agent-proposed) even
      // though the derived board and rendered card are identical either way.
      case 'node_imported': {
        const node = p as TripNode;
        if (!node.id) break;
        if (!nodeById.has(node.id)) {
          const clone: TripNode = { ...node, dependsOn: node.dependsOn || [] };
          nodes.push(clone);
          nodeById.set(node.id, clone);
        } else {
          patchNode(node.id, node);
        }
        break;
      }
      case 'node_confirmed':
        patchNode(p.nodeId, {
          status: 'confirmed',
          working: false,
          bookingRef: p.bookingRef ?? null,
          costCents: p.costCents ?? null,
          detail: p.detail,
        });
        break;
      case 'node_updated':
        patchNode(p.nodeId, { ...(p.patch || {}), detail: p.detail });
        break;
      case 'node_disrupted':
        patchNode(p.nodeId, { status: 'disrupted', working: true, detail: p.detail });
        break;
      case 'delay_reported':
        patchNode(p.nodeId, { detail: p.detail });
        break;
      case 'node_working_started':
        patchNode(p.nodeId, { working: true });
        break;
      case 'node_working_ended':
        patchNode(p.nodeId, { working: false });
        break;
      case 'node_cancelled':
        patchNode(p.nodeId, { status: 'cancelled', working: false });
        break;
      case 'rebooked':
        patchNode(p.nodeId, { status: 'confirmed', working: false, ...(p.patch || {}), detail: p.detail });
        break;
      case 'edge_added': {
        const edge = p as TripEdge;
        if (edge.id && !edgeById.has(edge.id)) {
          const clone: TripEdge = { ...edge };
          edges.push(clone);
          edgeById.set(edge.id, clone);
        }
        break;
      }
      case 'edge_updated': {
        const ed = edgeById.get(p.edgeId);
        if (ed) Object.assign(ed, p.patch || {});
        break;
      }
      case 'edge_removed': {
        const idx = edges.findIndex((x) => x.id === p.edgeId);
        if (idx >= 0) {
          edges.splice(idx, 1);
          edgeById.delete(p.edgeId);
        }
        break;
      }
      default:
        // trip_created, call_started, call_ended and any metadata events don't change the board.
        break;
    }
  }

  return { nodes, edges };
}
