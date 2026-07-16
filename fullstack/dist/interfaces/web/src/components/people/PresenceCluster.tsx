import { useStore, presenceOnNode } from '../../lib/store';
import { Avatar } from './Avatar';

// The little cluster of other people looking at this node right now, pinned to
// the node's top-right (clear of the status gauge and any working glow). The
// frontmost viewer carries the live halo. Collapses gracefully past three.
export function PresenceCluster({ nodeId }: { nodeId: string }) {
  const roster = useStore((s) => s.roster);
  const here = presenceOnNode(roster, nodeId);
  if (here.length === 0) return null;

  const shown = here.slice(0, 3);
  const extra = here.length - shown.length;
  const names = here.map((m) => m.displayName || m.email.split('@')[0]).join(', ');

  return (
    <div className="wp-node-presence" title={`${names} ${here.length === 1 ? 'is' : 'are'} here`}>
      {shown.map((m, i) => (
        <span className="wp-node-presence-slot" key={m.id} style={{ zIndex: shown.length - i }}>
          <Avatar member={m} size={20} present={i === 0} />
        </span>
      ))}
      {extra > 0 && <span className="wp-node-presence-more">+{extra}</span>}
    </div>
  );
}
