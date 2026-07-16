import { useStore } from '../lib/store';
import { IconCircleCheck, IconAlertTriangle, IconInfoCircle } from './icons';

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className="toast" onClick={() => dismiss(t.id)}>
          <span
            className="ico"
            style={{
              color: t.kind === 'success' ? 'var(--success)' : t.kind === 'danger' ? 'var(--danger)' : 'var(--text-secondary)',
            }}
          >
            {t.kind === 'success' ? (
              <IconCircleCheck size={18} />
            ) : t.kind === 'danger' ? (
              <IconAlertTriangle size={18} />
            ) : (
              <IconInfoCircle size={18} />
            )}
          </span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
