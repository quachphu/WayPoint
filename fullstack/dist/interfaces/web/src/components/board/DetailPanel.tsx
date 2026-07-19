import { useStore } from '../../lib/store';
import { KindIcon, IconX } from '../icons';
import { timeOfDay, weekdayShort, dateRange, moneyExact, durationLabel } from '../../lib/format';
import { presenceVar } from '../../lib/presence';
import type { TripNode } from '../../lib/types';

function statusChip(n: TripNode) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    proposed: { label: 'Proposed', color: 'var(--text-secondary)', bg: 'var(--surface-2)' },
    confirmed: { label: 'Confirmed', color: 'var(--accent)', bg: 'var(--accent-tint)' },
    disrupted: { label: 'Delayed', color: 'var(--accent-voice)', bg: 'var(--accent-voice-tint)' },
    failed: { label: 'Needs attention', color: 'var(--danger)', bg: 'var(--surface-2)' },
    cancelled: { label: 'Cancelled', color: 'var(--text-secondary)', bg: 'var(--surface-2)' },
  };
  return map[n.status] || map.proposed;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{label}</span>
      <span style={{ fontWeight: 500, fontSize: 14, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function DetailPanel() {
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const trip = useStore((s) => s.trip);
  const selectNode = useStore((s) => s.selectNode);
  const node = trip?.nodes.find((n) => n.id === selectedNodeId) || null;
  if (!node) return null;

  const chip = statusChip(node);
  const d = node.detail || {};
  const alternatives: any[] = d.alternatives || [];
  const incomingEdge = trip?.edges.find((e) => e.to === node.id);

  return (
    <div className="detail-panel">
      <div key={node.id} className="detail-fade">
      {node.imageUrl && (
        <img
          src={node.imageUrl}
          alt=""
          style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 'var(--r-lg)', marginBottom: 16 }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <div className="gate__tile" style={{ background: 'var(--surface-2)' }}>
          <KindIcon kind={node.kind} size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.2 }}>{node.title}</div>
          <span
            style={{
              display: 'inline-block',
              marginTop: 8,
              fontSize: 12,
              fontWeight: 500,
              color: chip.color,
              background: chip.bg,
              padding: '3px 9px',
              borderRadius: 999,
            }}
          >
            {chip.label}
          </span>
        </div>
        <button className="icon-btn" onClick={() => selectNode(null)} aria-label="Close">
          <IconX size={18} />
        </button>
      </div>

      {node.requestedBy && (
        <div className="wp-requested-chip">
          <span className="wp-requested-dot" style={{ background: presenceVar(node.requestedBy.color) }} />
          Requested by {node.requestedBy.name}
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        {node.kind === 'flight' && (
          <>
            <Row label="Route" value={d.carrier ? node.title : null} />
            <Row label="Departs" value={node.start ? `${weekdayShort(node.start)}, ${timeOfDay(node.start)}` : null} />
            <Row label="Arrives" value={node.end ? timeOfDay(node.end) : null} />
            <Row label="Flight" value={d.carrier ? `${d.carrier} ${d.flightNumber || ''}` : node.subtitle} />
            <Row label="Duration" value={d.durationMin ? durationLabel(d.durationMin) : null} />
            <Row label="Stops" value={d.stops != null ? (d.stops === 0 ? 'Nonstop' : `${d.stops} stop${d.stops === 1 ? '' : 's'}`) : null} />
            <Row label="Cabin" value={[d.cabin, d.fareBrand].filter(Boolean).join(' · ') || null} />
          </>
        )}
        {node.kind === 'hotel' && (
          <>
            <Row label="Dates" value={dateRange(node.start, node.end)} />
            <Row label="Neighborhood" value={d.neighborhood} />
            <Row label="Address" value={d.address} />
            <Row label="Rating" value={d.rating ? `${d.rating} / 5` : null} />
            <Row label="Nightly" value={d.nightlyCents != null ? `${moneyExact(d.nightlyCents)} / night` : null} />
            <Row label="Nights" value={d.nights ? String(d.nights) : null} />
            <Row label="Cancellation" value={d.cancellable == null ? null : d.cancellable ? 'Free cancellation' : 'Non-refundable'} />
          </>
        )}
        {node.kind === 'activity' && (
          <>
            <Row label="Where" value={node.location} />
            {d.blurb && (
              <div style={{ padding: '12px 0', fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{d.blurb}</div>
            )}
          </>
        )}
        <Row label="Cost" value={node.costCents != null ? moneyExact(node.costCents) : null} />
        <Row label="Confirmation" value={node.bookingRef} />
        {incomingEdge && node.kind !== 'flight' && (
          <Row
            label="Getting here"
            value={
              incomingEdge.distanceKm != null
                ? `${incomingEdge.label} (${incomingEdge.distanceKm} km)`
                : incomingEdge.label
            }
          />
        )}
      </div>

      {node.status === 'disrupted' && alternatives.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>Options found</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alternatives.map((a, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-lg)',
                  padding: '12px 14px',
                  fontSize: 14,
                }}
              >
                <div style={{ fontWeight: 500 }}>
                  {a.carrier} {a.flightNumber}
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: 3 }}>
                  {a.depart} → {a.arrive} · {a.durationLabel}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.source && (
        <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-tertiary)' }}>
          {d.source === 'sabre' ? 'Live inventory via Sabre' : 'Simulated inventory'}
        </div>
      )}
      </div>
    </div>
  );
}
