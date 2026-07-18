import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useStore } from '../../lib/store';
import { presenceColorForId } from '../../lib/presence';
import { timeOfDay, moneyShort } from '../../lib/format';
import { IconArrowLeft, IconMessage2, IconSend2, IconSparkles, IconUsers, IconX } from '../icons';
import { avatarForUser } from '../../lib/onboardingOptions';
import { MASCOT_SENDER_ID, type ChatTicket, type ConversationSummary, type FlightOffer } from '../../lib/types';

// Renders a real scannable QR code client-side (no external service call) —
// the ticket's confirmation code + flight details, encoded as JSON.
function QrCode({ value, size = 84 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch((err) => console.error('[qr] generation failed', err));
    return () => {
      cancelled = true;
    };
  }, [value, size]);
  if (!src) return <div style={{ width: size, height: size, background: 'var(--surface-2)', borderRadius: 8, flexShrink: 0 }} />;
  return <img src={src} width={size} height={size} alt="Ticket QR code" style={{ borderRadius: 8, flexShrink: 0 }} />;
}

function FlightOfferCard({ offer, onBook, booking }: { offer: FlightOffer; onBook: () => void; booking: boolean }) {
  return (
    <div className="mt-2 w-[280px] rounded-xl border p-3" style={{ borderColor: 'var(--border-warm)', background: 'var(--surface)' }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-space text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Flight</div>
          <div className="font-display text-sm font-semibold text-[var(--text)]">{offer.carrier}</div>
        </div>
        <div className="font-display text-base font-bold" style={{ color: 'var(--live)' }}>
          {moneyShort(offer.priceCents)}
        </div>
      </div>
      <div className="font-space mt-2 grid grid-cols-3 gap-2 text-xs text-[var(--text-2)]">
        <div>
          <div className="text-[var(--text-3)]">Flight</div>
          {offer.flightNumber}
        </div>
        <div>
          <div className="text-[var(--text-3)]">From</div>
          {offer.origin}
        </div>
        <div>
          <div className="text-[var(--text-3)]">To</div>
          {offer.destination}
        </div>
      </div>
      <button
        onClick={onBook}
        disabled={booking}
        className="font-display mt-3 w-full rounded-lg py-2 text-xs font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-60"
        style={{ background: 'var(--live)' }}
      >
        {booking ? 'Booking…' : 'Book this flight'}
      </button>
    </div>
  );
}

function TicketCard({ ticket }: { ticket: ChatTicket }) {
  const qrPayload = JSON.stringify({
    ref: ticket.bookingRef,
    flight: ticket.offer.flightNumber,
    from: ticket.offer.origin,
    to: ticket.offer.destination,
  });
  return (
    <div className="mt-2 flex w-[300px] items-center gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-warm)', background: 'var(--surface)' }}>
      <div className="min-w-0 flex-1">
        <div className="font-space text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Ticket</div>
        <div className="font-display truncate text-sm font-semibold text-[var(--text)]">
          {ticket.offer.carrier} {ticket.offer.flightNumber}
        </div>
        <div className="font-space truncate text-xs text-[var(--text-2)]">
          {ticket.offer.origin} → {ticket.offer.destination}
        </div>
        <div className="font-space mt-1 text-xs text-[var(--text-3)]">Confirmation {ticket.bookingRef}</div>
        {ticket.bookedByName && <div className="font-space text-xs text-[var(--text-3)]">Booked by {ticket.bookedByName}</div>}
      </div>
      <QrCode value={qrPayload} />
    </div>
  );
}

function conversationTitle(c: ConversationSummary): string {
  if (c.type === 'group') return c.title || c.participants.map((p) => p.displayName || 'Someone').join(', ');
  return c.participants[0]?.displayName || 'A fellow traveler';
}

// A direct chat shows the other person's real photo (or gender default) —
// a group doesn't have one shared photo, so it keeps a generic group icon.
function conversationAvatar(c: ConversationSummary): string | null {
  return c.type === 'direct' ? avatarForUser(c.participants[0]) : null;
}

function timeAgo(ms: number): string {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function ConversationList() {
  const conversations = useStore((s) => s.conversations);
  const openConversationById = useStore((s) => s.openConversationById);

  if (conversations.length === 0) {
    return <p className="font-space p-4 text-sm text-[var(--text-3)]">No chats yet — message someone from People nearby.</p>;
  }
  return (
    <div className="flex flex-col overflow-y-auto">
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => openConversationById(c.id)}
          className="flex items-center gap-2.5 border-b border-[var(--border-warm)] px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--surface-2)]"
        >
          {conversationAvatar(c) ? (
            <img src={conversationAvatar(c)!} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" style={{ background: 'var(--surface-2)' }} />
          ) : (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: 'var(--live)' }}
            >
              <IconUsers size={16} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-space truncate text-sm font-medium text-[var(--text)]">{conversationTitle(c)}</div>
            <div className="font-space truncate text-xs text-[var(--text-3)]">{c.lastMessagePreview || 'Say hello'}</div>
          </div>
          <div className="font-space shrink-0 text-[11px] text-[var(--text-3)]">{timeAgo(c.lastMessageAt)}</div>
        </button>
      ))}
    </div>
  );
}

// A full-screen takeover once a specific conversation is open — the small
// dock popup is fine for a quick glance at the list, but a real conversation
// (especially a group one, where knowing who said what matters) needs the
// same real estate and message-attribution the trip-planning chat gets.
function ConversationScreen() {
  const conversation = useStore((s) => s.activeConversation);
  const messages = useStore((s) => s.conversationMessages);
  const sendConversationMessage = useStore((s) => s.sendConversationMessage);
  const closeConversation = useStore((s) => s.closeConversation);
  const planTripInChat = useStore((s) => s.planTripInChat);
  const bookFlightInChat = useStore((s) => s.bookFlightInChat);
  const [text, setText] = useState('');
  const [planning, setPlanning] = useState(false);
  const [bookingIds, setBookingIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (!conversation) return null;
  const isGroup = conversation.type === 'group';

  const submit = () => {
    if (!text.trim()) return;
    sendConversationMessage(text);
    setText('');
  };

  const nameFor = (senderId: string) => conversation.participants.find((p) => p.id === senderId)?.displayName || 'A fellow traveler';

  // The mascot searches real (or simulated-fallback) flights and posts them
  // as bookable cards right here in the chat — everyone in the thread sees
  // the same options and the same resulting ticket once someone books.
  const planTrip = async (destination: string, originCity?: string) => {
    setPlanning(true);
    await planTripInChat(destination, originCity);
    setPlanning(false);
  };

  const bookFlight = async (messageId: string) => {
    setBookingIds((prev) => new Set(prev).add(messageId));
    await bookFlightInChat(messageId);
    setBookingIds((prev) => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--canvas)', zIndex: 999500 }}>
      <div className="flex items-center gap-3 border-b border-[var(--border-warm)] px-5 py-4" style={{ background: 'var(--surface)' }}>
        <button className="icon-btn shrink-0" onClick={closeConversation} aria-label="Back to chats">
          <IconArrowLeft size={18} />
        </button>
        {!isGroup ? (
          <img
            src={avatarForUser(conversation.participants[0])}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            style={{ background: 'var(--surface-2)' }}
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: 'var(--live)' }}>
            <IconUsers size={18} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-display truncate text-base font-semibold text-[var(--text)]">{conversationTitle(conversation)}</div>
          {isGroup && (
            <div className="font-space truncate text-xs text-[var(--text-3)]">{conversation.participants.length} people</div>
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col overflow-y-auto px-5 py-6">
        {messages.map((m, i) => {
          const isMascot = m.senderId === MASCOT_SENDER_ID;
          const mine = !isMascot && conversation.participants.find((p) => p.id === m.senderId)?.isMe;
          const prev = messages[i - 1];
          const showHeader = (isMascot || isGroup) && !mine && prev?.senderId !== m.senderId;
          const color = isMascot ? 'var(--live)' : presenceColorForId(m.senderId);
          return (
            <div key={m.id} className="mb-3 flex flex-col" style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {showHeader && (
                <div className="font-space mb-1 ml-1 flex items-center gap-2 text-xs font-semibold" style={{ color }}>
                  {isMascot && <IconSparkles size={12} />}
                  {isMascot ? 'Waypoint' : nameFor(m.senderId)}
                  <span className="font-normal text-[var(--text-3)]">{timeOfDay(m.createdAt)}</span>
                </div>
              )}
              <div
                className="font-space max-w-[75%] rounded-2xl px-4 py-2.5 text-sm"
                style={
                  mine
                    ? { background: 'var(--live)', color: 'var(--on-accent)' }
                    : isMascot
                      ? { background: 'var(--live-tint)', color: 'var(--text)', border: '1px solid color-mix(in oklch, var(--live) 30%, transparent)' }
                      : { background: `color-mix(in oklch, ${color} 14%, var(--surface-2))`, color: 'var(--text)' }
                }
              >
                {m.text}
              </div>
              {isMascot && m.tripSuggestion && (
                <button
                  onClick={() => planTrip(m.tripSuggestion!.destination, m.tripSuggestion!.originCity)}
                  disabled={planning}
                  className="font-display mt-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-60"
                  style={{ background: 'var(--live)' }}
                >
                  {planning ? 'Looking up flights…' : 'Plan this trip'}
                </button>
              )}
              {isMascot && m.flightOffer && (
                <FlightOfferCard offer={m.flightOffer} booking={bookingIds.has(m.id)} onBook={() => bookFlight(m.id)} />
              )}
              {isMascot && m.ticket && <TicketCard ticket={m.ticket} />}
              {!isGroup && !isMascot && (
                <div className="font-space mt-1 text-[11px] text-[var(--text-3)]" style={{ marginRight: mine ? 2 : 0, marginLeft: mine ? 0 : 2 }}>
                  {timeOfDay(m.createdAt)}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="mx-auto flex w-full max-w-[820px] items-center gap-2 border-t border-[var(--border-warm)] px-5 py-4" style={{ background: 'var(--surface)' }}>
        <input
          className="field font-space flex-1"
          placeholder="Say something…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
        <button className="icon-btn shrink-0" onClick={submit} aria-label="Send" style={{ color: 'var(--live)' }}>
          <IconSend2 size={20} />
        </button>
      </div>
    </div>
  );
}

export function ChatDock() {
  const open = useStore((s) => s.conversationsPanelOpen);
  const toggle = useStore((s) => s.toggleConversationsPanel);
  const conversation = useStore((s) => s.activeConversation);
  const conversations = useStore((s) => s.conversations);

  if (conversation) return <ConversationScreen />;

  return (
    <div className="fixed bottom-6 left-6 z-[999998] flex flex-col items-start">
      {open && (
        <div
          className="mb-3 flex h-[440px] w-[340px] flex-col overflow-hidden rounded-2xl border border-[var(--border-warm)] shadow-[var(--shadow-3)]"
          style={{ background: 'var(--surface)' }}
        >
          <div className="flex items-center gap-2 border-b border-[var(--border-warm)] px-4 py-3">
            <span className="font-display flex-1 truncate text-sm font-semibold text-[var(--text)]">Chats</span>
            <button className="icon-btn" onClick={toggle} aria-label="Close">
              <IconX size={16} />
            </button>
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            <ConversationList />
          </div>
        </div>
      )}
      <button
        onClick={toggle}
        className="relative flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-150 ease-out active:scale-[0.95]"
        style={{ background: 'var(--live)' }}
        aria-label="Toggle chats"
      >
        <IconMessage2 size={20} />
        {conversations.length > 0 && !open && (
          <span
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: 'var(--live-deep)' }}
          >
            {conversations.length}
          </span>
        )}
      </button>
    </div>
  );
}
