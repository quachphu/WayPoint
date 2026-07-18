import { useEffect, useRef, useState } from 'react';
import { GENDER_OPTIONS } from '../../lib/onboardingOptions';
import { IconX, IconChevronDown, IconCheck } from '../icons';
import type { Gender } from '../../lib/types';

// Shared between the onboarding form and the profile-edit page.

// A custom listbox instead of a native <select> — the browser renders a
// native select's open option list with OS colors that page CSS can't
// reliably override, which is exactly what made the picked value unreadable.
export function GenderPicker({ value, onChange }: { value: Gender | null; onChange: (g: Gender) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = GENDER_OPTIONS.find((g) => g.value === value);

  return (
    <div ref={ref} className="gender-picker">
      <button type="button" className="field gender-trigger" onClick={() => setOpen((o) => !o)}>
        <span style={{ color: selected ? 'var(--text)' : 'var(--text-3)' }}>{selected ? selected.label : 'Choose one…'}</span>
        <IconChevronDown size={16} style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 180ms var(--ease-settle)' }} />
      </button>
      {open && (
        <div className="gender-menu">
          {GENDER_OPTIONS.map((g) => (
            <button
              key={g.value}
              type="button"
              className={`gender-menu-item ${value === g.value ? 'selected' : ''}`}
              onClick={() => {
                onChange(g.value);
                setOpen(false);
              }}
            >
              <img src={g.avatar} alt="" width={22} height={22} style={{ borderRadius: '50%' }} />
              <span>{g.label}</span>
              {value === g.value && <IconCheck size={14} style={{ marginLeft: 'auto', color: 'var(--live)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState('');

  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setText('');
      return;
    }
    onChange([...tags, trimmed]);
    setText('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-warm)] p-2" style={{ background: 'var(--surface)' }}>
      {tags.map((t) => (
        <span key={t} className="chip selected">
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            aria-label={`Remove ${t}`}
            style={{ display: 'flex', color: 'var(--on-accent)' }}
          >
            <IconX size={12} />
          </button>
        </span>
      ))}
      <input
        className="font-space min-w-[120px] flex-1 border-none bg-transparent text-sm text-[var(--text)] outline-none"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(text);
          } else if (e.key === 'Backspace' && !text && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => text && add(text)}
      />
    </div>
  );
}

export function ChipPicker({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);
  };
  return (
    <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-[var(--border-warm)] p-3" style={{ background: 'var(--surface)' }}>
      {options.map((opt) => (
        <button key={opt} type="button" className={`chip ${selected.includes(opt) ? 'selected' : ''}`} onClick={() => toggle(opt)}>
          {opt}
        </button>
      ))}
    </div>
  );
}
