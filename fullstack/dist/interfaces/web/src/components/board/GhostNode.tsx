import { Handle, Position } from '@xyflow/react';
import { IconLoader2 } from '../icons';
import type { NodeKind } from '../../lib/types';

const LABELS: Record<NodeKind, string> = {
  flight: 'Searching flights',
  hotel: 'Searching hotels',
  activity: 'Finding things to do',
  ground: 'Finding transport',
};

export function GhostNode({ data }: any) {
  const kind: NodeKind = data.kind;
  return (
    <div className="ghost-node no-select">
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="g-label">
        <IconLoader2 size={14} className="spin-ico" /> {LABELS[kind] || 'Working'}
      </div>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
