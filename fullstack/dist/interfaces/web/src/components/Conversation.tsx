import { StickToBottom } from 'use-stick-to-bottom';
import { useStore } from '../lib/store';
import { VoiceOrb } from './VoiceOrb';
import { IconMicrophone } from './icons';
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

function InputBar() {
  const thinking = useStore((s) => s.thinking);
  const hasTrip = useStore((s) => !!s.activeTripId);
  const voiceState = useStore((s) => s.voiceState);

  const label =
    voiceState === 'connecting'
      ? 'Connecting…'
      : thinking
        ? 'Thinking…'
        : hasTrip
          ? 'Tap to talk to Waypoint'
          : "Tap to talk — tell me where you're headed";

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 14, borderTop: '1px solid var(--border)' }}>
      <VoiceOrb size={44} />
      <span className="font-space" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {label}
      </span>
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
