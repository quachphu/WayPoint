import { useState, useRef, useEffect } from 'react';
import { useStore, isPresent, myMember } from '../../lib/store';
import { Avatar } from './Avatar';
import { memberLabel, lastSeenLabel, presenceVar } from '../../lib/presence';
import { IconX, IconLink, IconMessage2, IconMail, IconDots, IconCheck, IconLoader2 } from '../icons';
import type { RosterMember } from '../../lib/types';

// The docked People panel: an invite composer over the collaborator roster.
// Lives in the same slot as node-detail; the board stays visible behind it.
export function PeoplePanel() {
  const roster = useStore((s) => s.roster);
  const closePeople = useStore((s) => s.closePeople);
  const invite = useStore((s) => s.invite);
  const inviteBusy = useStore((s) => s.inviteBusy);
  const me = myMember(roster);
  const isOwner = me?.role === 'owner';

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const active = roster.filter((m) => m.status === 'active');
  const pending = roster.filter((m) => m.status === 'invited');

  const submit = async () => {
    const value = email.trim();
    if (!value) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setEmailError('That does not look like an email address.');
      return;
    }
    setEmailError('');
    const res = await invite(value);
    if (res) setEmail('');
  };

  return (
    <div className="wp-people" role="dialog" aria-label="People on this trip">
      <div className="wp-people-head">
        <h2>People</h2>
        <button className="wp-icon-btn" onClick={closePeople} aria-label="Close">
          <IconX size={17} stroke={1.8} />
        </button>
      </div>

      <div className="wp-people-compose">
        <p className="wp-people-lede">
          Bring someone onto this trip. They can see the board and suggest ideas, only approvers can book.
        </p>
        <div className="wp-invite-row">
          <input
            className={`wp-input ${emailError ? 'has-error' : ''}`}
            type="email"
            inputMode="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button className="wp-btn-primary" onClick={submit} disabled={inviteBusy || !email.trim()}>
            {inviteBusy ? <IconLoader2 size={16} className="wp-spin" /> : 'Invite'}
          </button>
        </div>
        <div className={`wp-invite-error ${emailError ? 'show' : ''}`}>{emailError || '\u00A0'}</div>
        <InviteReady />
      </div>

      <div className="wp-people-list">
        <div className="wp-people-label">On this trip</div>
        {active.map((m) => (
          <MemberRow key={m.id} member={m} isOwnerViewer={!!isOwner} />
        ))}
        {pending.length > 0 && <div className="wp-people-label">Invited</div>}
        {pending.map((m) => (
          <MemberRow key={m.id} member={m} isOwnerViewer={!!isOwner} />
        ))}
      </div>
    </div>
  );
}

// The delivery card that appears after an invite is minted. Because the backend
// can't cold-send, the owner delivers via their own channel: copy link, email,
// or text. Reserved space so it doesn't reflow the composer.
function InviteReady() {
  const lastInvite = useStore((s) => s.lastInvite);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [lastInvite?.collaboratorId]);

  if (!lastInvite) return null;

  const url = `${window.location.origin}${lastInvite.invitePath}`;
  const subject = `Join "${lastInvite.tripTitle}" on Waypoint`;
  const body = `I'm planning ${lastInvite.tripTitle} on Waypoint and added you. Open this to see the board and help plan:\n\n${url}`;
  const mailto = `mailto:${encodeURIComponent(lastInvite.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const sms = `sms:?&body=${encodeURIComponent(body)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="wp-invite-ready">
      <div className="wp-invite-ready-head">
        Invite ready for <strong>{lastInvite.email}</strong>. Send it your way:
      </div>
      <div className="wp-invite-actions">
        <button className="wp-ghost-btn" onClick={copy}>
          {copied ? <IconCheck size={15} stroke={2} /> : <IconLink size={15} stroke={1.7} />}
          <span>{copied ? 'Copied' : 'Copy link'}</span>
        </button>
        <a className="wp-ghost-btn" href={mailto}>
          <IconMail size={15} stroke={1.7} />
          <span>Email</span>
        </a>
        <a className="wp-ghost-btn" href={sms}>
          <IconMessage2 size={15} stroke={1.7} />
          <span>Text</span>
        </a>
      </div>
    </div>
  );
}

function MemberRow({ member, isOwnerViewer }: { member: RosterMember; isOwnerViewer: boolean }) {
  const setMemberApproval = useStore((s) => s.setMemberApproval);
  const removeMember = useStore((s) => s.removeMember);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const present = isPresent(member);
  const isPending = member.status === 'invited';
  // Owner can manage everyone except the owner row (themselves).
  const canManage = isOwnerViewer && member.role !== 'owner';

  const subline = isPending
    ? 'Invited · not joined yet'
    : present && member.focusNodeId
      ? 'Looking at the board'
      : present
        ? 'On the board'
        : lastSeenLabel(member.lastSeenAt) || 'Not here right now';

  const tag = member.role === 'owner' ? 'Owner' : member.canApprove ? 'Can approve' : 'Can suggest';

  return (
    <div className={`wp-member ${isPending ? 'is-pending' : ''}`}>
      <Avatar member={member} size={32} present={present} />
      <div className="wp-member-meta">
        <div className="wp-member-name">
          {memberLabel(member)}
          {!isPending && <span className="wp-member-tag">{tag}</span>}
        </div>
        <div className="wp-member-sub" style={present && member.presenceColor ? { color: presenceVar(member.presenceColor) } : undefined}>
          {present && !isPending && <span className="wp-live-dot" style={{ background: presenceVar(member.presenceColor) }} />}
          {subline}
        </div>
      </div>
      {canManage && (
        <div className="wp-member-menu-wrap" ref={menuRef}>
          <button className="wp-icon-btn wp-member-kebab" onClick={() => setMenuOpen((o) => !o)} aria-label="Manage">
            <IconDots size={17} stroke={1.8} />
          </button>
          {menuOpen && (
            <div className="wp-menu wp-member-menu">
              {!isPending && (
                <button
                  className="wp-menu-item"
                  onClick={() => {
                    setMemberApproval(member.id, !member.canApprove);
                    setMenuOpen(false);
                  }}
                >
                  {member.canApprove
                    ? `Stop ${firstName(member)} approving`
                    : `Let ${firstName(member)} approve bookings`}
                </button>
              )}
              <button
                className="wp-menu-item wp-menu-danger"
                onClick={() => {
                  removeMember(member.id);
                  setMenuOpen(false);
                }}
              >
                {isPending ? 'Revoke invite' : `Remove ${firstName(member)}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function firstName(m: RosterMember): string {
  if (m.displayName) return m.displayName.split(/\s+/)[0];
  if (m.email) return m.email.split('@')[0];
  return 'them';
}
