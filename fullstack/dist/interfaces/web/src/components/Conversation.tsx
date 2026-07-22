import { useRef, useState } from 'react';
import { StickToBottom } from 'use-stick-to-bottom';
import { useStore } from '../lib/store';
import { VoiceOrb } from './VoiceOrb';
import { IconMicrophone, IconPaperclip, IconSend2 } from './icons';
import { initials, presenceVar } from '../lib/presence';
import type { Message } from '../lib/types';

function Bubble({ m, myId }: { m: Message; myId: string | null }) {
  if (m.role === 'user') {
    // On a shared trip, another person's message is attributed: their name in
    // their presence color with a small avatar. My own message stays as "user".
    const fromOther = !!m.authorId && m.authorId !== myId;
    if (fromOther) {
      const color = presenceVar(m.authorColor);
      return (
        <div className="msg other">
          <span className="msg-avatar" style={{ background: color }}>
            {initials({ displayName: m.authorName || null, email: '' })}
          </span>
          <div className="msg-other-body">
            <div className="msg-who" style={{ color }}>
              {m.authorName || 'Someone'}
            </div>
            <div className="msg-other-text">
              {m.source === 'voice' && <IconMicrophone className="mic" size={14} />}
              {m.text}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={`msg user`}>
        {m.source === 'voice' && <IconMicrophone className="mic" size={14} />}
        {m.text}
      </div>
    );
  }
  if (m.source === 'system') {
    return <div className="msg system">{m.text}</div>;
  }
  return (
    <div className="msg agent">
      <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
    </div>
  );
}

// Upload a flight/hotel confirmation (PDF, or a photo of a printed one) and
// have it parsed straight onto the board — the "or drop it into chat" half of
// the ticket-import feature (the other half is the mail.tm forwarding address
// shown below, see fullstack/src/roadmap/ticket-import.md).
function ImportButton() {
  const importDocument = useStore((s) => s.importDocument);
  const thinking = useStore((s) => s.thinking);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importDocument(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        aria-label="Import a confirmation"
        title="Import a flight/hotel confirmation (PDF or photo)"
        disabled={thinking}
        onClick={() => inputRef.current?.click()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          cursor: thinking ? 'default' : 'pointer',
          opacity: thinking ? 0.5 : 1,
        }}
      >
        <IconPaperclip size={16} stroke={1.5} />
      </button>
    </>
  );
}

// The one concise follow-up question an ambiguous import leaves open (a
// missing field, or which trip it belongs to) — answered here rather than
// through the general chat/voice turn so it resolves deterministically.
function ImportClarification() {
  const question = useStore((s) => s.pendingImportQuestion);
  const resolveImportAnswer = useStore((s) => s.resolveImportAnswer);
  const thinking = useStore((s) => s.thinking);
  const [answer, setAnswer] = useState('');

  if (!question) return null;

  const submit = () => {
    if (!answer.trim() || thinking) return;
    resolveImportAnswer(answer);
    setAnswer('');
  };

  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 14px 10px' }}>
      <input
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Type your answer…"
        disabled={thinking}
        style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13 }}
      />
      <button
        type="button"
        aria-label="Send answer"
        disabled={thinking || !answer.trim()}
        onClick={submit}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          cursor: thinking || !answer.trim() ? 'default' : 'pointer',
          opacity: thinking || !answer.trim() ? 0.5 : 1,
        }}
      >
        <IconSend2 size={16} />
      </button>
    </div>
  );
}

function InputBar() {
  const thinking = useStore((s) => s.thinking);
  const hasTrip = useStore((s) => !!s.activeTripId);
  const voiceState = useStore((s) => s.voiceState);
  const importEmailAddress = useStore((s) => s.importEmailAddress);

  const label =
    voiceState === 'connecting'
      ? 'Connecting…'
      : thinking
        ? 'Thinking…'
        : hasTrip
          ? 'Tap to talk to Waypoint'
          : "Tap to talk — tell me where you're headed";

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <ImportClarification />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 14 }}>
        <VoiceOrb size={44} />
        <span className="font-space" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <ImportButton />
      </div>
      {importEmailAddress && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)', paddingBottom: 10 }}>
          or forward a confirmation to <span style={{ fontFamily: 'monospace' }}>{importEmailAddress}</span>
        </div>
      )}
    </div>
  );
}

export function Conversation() {
  const messages = useStore((s) => s.messages);
  const thinking = useStore((s) => s.thinking);
  const streamingReply = useStore((s) => s.streamingReply);
  const status = useStore((s) => s.status);
  const myId = useStore((s) => s.profile?.id ?? null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        className="no-select"
        style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}
      >
        Conversation
      </div>

      <StickToBottom className="conv-scroll" resize="smooth" initial="instant">
        <StickToBottom.Content className="conv-content">
          {messages.map((m) => (
            <Bubble key={m.id} m={m} myId={myId} />
          ))}

          {thinking && streamingReply ? (
            <div className="msg agent">
              <span style={{ whiteSpace: 'pre-wrap' }}>{streamingReply}</span>
              {status && <div style={{ fontSize: 12, color: 'var(--accent-voice)', marginTop: 6 }}>{status}</div>}
            </div>
          ) : thinking ? (
            <div className="msg agent" style={{ padding: 0, background: 'transparent' }}>
              <span className="typing">
                <span />
                <span />
                <span />
              </span>
              {status && <span style={{ fontSize: 12, color: 'var(--accent-voice)', marginLeft: 4 }}>{status}</span>}
            </div>
          ) : null}
        </StickToBottom.Content>
      </StickToBottom>

      <InputBar />
    </div>
  );
}
