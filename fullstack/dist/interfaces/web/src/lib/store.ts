import { create } from 'zustand';
import { api } from './api';
import { voice, type VoiceState } from './voice';
import type {
  Trip,
  TripNode,
  TripSummary,
  User,
  Message,
  PendingAction,
  CallTurn,
  StreamEvent,
  NodeKind,
  RosterMember,
  InviteResult,
} from './types';

// A member is "present" if we heard from them within this window. The grace
// window (not a single poll) keeps a dropped 4s poll from strobing a marker off.
export const PRESENCE_WINDOW_MS = 10_000;
export function isPresent(m: RosterMember): boolean {
  return !!m.lastSeenAt && Date.now() - m.lastSeenAt < PRESENCE_WINDOW_MS;
}

let toastSeq = 0;
export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'danger';
  text: string;
}

interface CallState {
  open: boolean;
  sessionId: string | null;
  target: string;
  nodeId: string | null;
  status: 'dialing' | 'connected' | 'in_progress' | 'ended' | 'failed';
  subStatus: string;
  transcript: CallTurn[];
  outcome: string | null;
}

const emptyCall: CallState = {
  open: false,
  sessionId: null,
  target: '',
  nodeId: null,
  status: 'dialing',
  subStatus: '',
  transcript: [],
  outcome: null,
};

interface StoreState {
  // data
  loading: boolean;
  profile: User | null;
  trips: TripSummary[];
  activeTripId: string | null;
  trip: Trip | null;
  messages: Message[];
  pendingActions: PendingAction[];
  // shared trips
  roster: RosterMember[];
  peopleOpen: boolean;
  inviteBusy: boolean;
  lastInvite: InviteResult | null;
  // conversation runtime
  thinking: boolean;
  streamingReply: string | null;
  status: string;
  ghosts: NodeKind[];
  // board
  selectedNodeId: string | null;
  pan: { nodeId: string | null; seq: number };
  gatePress: { id: string | null; seq: number };
  // call
  call: CallState;
  // voice + ui
  voiceState: VoiceState;
  micActive: boolean;
  theme: 'light' | 'dark';
  toasts: Toast[];
  // actions
  bootstrap: () => Promise<void>;
  setTheme: (t: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setVoiceState: (s: VoiceState) => void;
  toggleMic: () => void;
  selectNode: (id: string | null) => void;
  newTrip: () => void;
  switchTrip: (id: string) => Promise<void>;
  send: (text: string, source: 'voice' | 'chat') => Promise<void>;
  approve: (actionId: string) => Promise<void>;
  decline: (actionId: string) => Promise<void>;
  triggerDisruption: () => Promise<void>;
  dismissCall: () => void;
  pushToast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: number) => void;
  applyStreamEvent: (e: StreamEvent) => void;
  refreshTripList: (trip: Trip | null | undefined) => void;
  // shared trips
  openPeople: () => void;
  closePeople: () => void;
  invite: (email: string) => Promise<InviteResult | null>;
  clearLastInvite: () => void;
  setMemberApproval: (collaboratorId: string, canApprove: boolean) => Promise<void>;
  removeMember: (collaboratorId: string) => Promise<void>;
  claimByToken: (token: string) => Promise<boolean>;
  pollSync: () => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  loading: true,
  profile: null,
  trips: [],
  activeTripId: null,
  trip: null,
  messages: [],
  pendingActions: [],
  roster: [],
  peopleOpen: false,
  inviteBusy: false,
  lastInvite: null,
  thinking: false,
  streamingReply: null,
  status: '',
  ghosts: [],
  selectedNodeId: null,
  pan: { nodeId: null, seq: 0 },
  gatePress: { id: null, seq: 0 },
  call: emptyCall,
  voiceState: 'idle',
  micActive: false,
  theme: 'light',
  toasts: [],

  bootstrap: async () => {
    try {
      const b = await api.getBootstrap();
      if (!b.authenticated) {
        set({ loading: false, profile: null });
        return;
      }
      set({
        loading: false,
        profile: b.user ?? null,
        trips: b.trips ?? [],
        activeTripId: b.activeTripId ?? null,
        trip: b.trip ?? null,
        messages: b.messages ?? [],
        pendingActions: (b.pendingActions ?? []).filter((a) => a.status === 'pending'),
        roster: b.roster ?? [],
      });
    } catch (err) {
      console.error('bootstrap failed', err);
      set({ loading: false });
    }
  },

  setTheme: (t) => {
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.add('theme-transition');
    get().setTheme(next);
    window.setTimeout(() => document.documentElement.classList.remove('theme-transition'), 300);
  },

  setVoiceState: (s) => set({ voiceState: s, micActive: s === 'listening' }),
  toggleMic: () => {
    if (!voice.recognitionSupported) {
      get().pushToast('info', 'Voice needs a browser with a microphone. You can type instead.');
      return;
    }
    voice.toggleListening();
  },

  // Selecting a node reclaims the docked slot from the People panel.
  selectNode: (id) => set({ selectedNodeId: id, peopleOpen: id ? false : get().peopleOpen }),

  newTrip: () =>
    set({
      activeTripId: null,
      trip: null,
      messages: [],
      pendingActions: [],
      roster: [],
      peopleOpen: false,
      selectedNodeId: null,
      ghosts: [],
      streamingReply: null,
      status: '',
      thinking: false,
    }),

  switchTrip: async (id) => {
    if (get().activeTripId === id) return;
    set({ activeTripId: id, selectedNodeId: null, ghosts: [], streamingReply: null, status: '', peopleOpen: false, roster: [] });
    try {
      const b = await api.getTrip({ tripId: id });
      set({
        trip: b.trip,
        messages: b.messages,
        pendingActions: (b.pendingActions ?? []).filter((a) => a.status === 'pending'),
        roster: b.roster ?? [],
      });
    } catch (err) {
      console.error('switchTrip failed', err);
      get().pushToast('danger', 'Could not open that trip.');
    }
  },

  send: async (text, source) => {
    const trimmed = text.trim();
    if (!trimmed || get().thinking) return;
    const { activeTripId, selectedNodeId } = get();

    // If a confirm-gate is open, a spoken/typed "yes" or "no" resolves it
    // directly — but only for someone who can actually approve. A companion
    // without approval rights saying "yes" falls through to a normal turn, and
    // Waypoint replies honestly that it's flagged for the owner.
    const gate = get().pendingActions[get().pendingActions.length - 1];
    const canApprove = myCanApprove(get().roster);
    if (gate && !get().call.open && canApprove) {
      if (isAffirmative(trimmed)) {
        set((s) => ({ gatePress: { id: gate.id, seq: s.gatePress.seq + 1 } }));
        get().approve(gate.id);
        return;
      }
      if (isNegative(trimmed)) {
        get().decline(gate.id);
        return;
      }
    }
    // Optimistic user message
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      tripId: activeTripId || 'new',
      role: 'user',
      text: trimmed,
      source,
      status: 'complete',
    };
    set((s) => ({ messages: [...s.messages, optimistic], thinking: true, streamingReply: '', status: '' }));

    try {
      const res = await api.converse(
        { tripId: activeTripId || undefined, text: trimmed, source, focusNodeId: selectedNodeId },
        {
          stream: true,
          onToken: (t) => set({ streamingReply: t }),
          onStreamData: (e) => get().applyStreamEvent(e as StreamEvent),
          onStreamError: (err) => console.error('stream error', err),
        },
      );
      // Finalize: agent message + authoritative trip
      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        tripId: res.tripId,
        role: 'agent',
        text: res.reply,
        source: 'chat',
        status: 'complete',
      };
      set((s) => ({
        messages: [...s.messages, agentMsg],
        streamingReply: null,
        thinking: false,
        status: '',
        ghosts: [],
        trip: res.trip ?? s.trip,
        activeTripId: res.tripId,
      }));
      get().refreshTripList(res.trip);
      if (source === 'voice') voice.speak(res.reply);
    } catch (err: any) {
      console.error('converse failed', err);
      set({ thinking: false, streamingReply: null, status: '', ghosts: [] });
      get().pushToast('danger', "I hit a snag on that one. Mind trying again?");
    }
  },

  approve: async (actionId) => {
    const action = get().pendingActions.find((a) => a.id === actionId);
    if (!action) return;
    // Optimistically remove the gate.
    set((s) => ({ pendingActions: s.pendingActions.filter((a) => a.id !== actionId) }));
    try {
      if (action.kind === 'place_call') {
        const res = await api.approveAction({ actionId });
        const sessionId = res.callSessionId!;
        set({
          call: {
            open: true,
            sessionId,
            target: action.payload?.target || 'the airline',
            nodeId: action.nodeId,
            status: 'dialing',
            subStatus: 'Connecting',
            transcript: [],
            outcome: null,
          },
        });
        await api.runCall(
          { tripId: action.tripId, callSessionId: sessionId },
          { stream: true, onStreamData: (e) => get().applyStreamEvent(e as StreamEvent), onStreamError: (err) => console.error(err) },
        );
      } else {
        const res = await api.approveAction({ actionId });
        if (res.trip) set({ trip: res.trip });
        get().refreshTripList(res.trip);
        get().pushToast('success', bookedToast(action));
      }
    } catch (err) {
      console.error('approve failed', err);
      // Restore the gate so the traveler can retry.
      set((s) => ({ pendingActions: [...s.pendingActions, action] }));
      get().pushToast('danger', 'That did not go through, and nothing was charged. Want to try again?');
    }
  },

  decline: async (actionId) => {
    set((s) => ({ pendingActions: s.pendingActions.filter((a) => a.id !== actionId) }));
    try {
      await api.declineAction({ actionId });
    } catch (err) {
      console.error('decline failed', err);
    }
  },

  triggerDisruption: async () => {
    const { activeTripId, trip } = get();
    if (!activeTripId || !trip) return;
    if (trip.status === 'disrupted') {
      get().pushToast('info', 'This trip is already being handled.');
      return;
    }
    set({ thinking: true, status: 'Checking your flights' });
    try {
      const res = await api.reportDisruption(
        { tripId: activeTripId },
        { stream: true, onStreamData: (e) => get().applyStreamEvent(e as StreamEvent) },
      );
      if (res.trip) set({ trip: res.trip });
      if (res.ok) {
        const msg: Message = { id: `agent-${Date.now()}`, tripId: activeTripId, role: 'agent', text: res.message, source: 'system', status: 'complete' };
        set((s) => ({ messages: [...s.messages, msg] }));
        voice.speak(res.message);
      }
    } catch (err) {
      console.error('disruption failed', err);
      get().pushToast('danger', 'Could not reach the airline just now.');
    } finally {
      set({ thinking: false, status: '' });
    }
  },

  dismissCall: () => set({ call: { ...emptyCall } }),

  pushToast: (kind, text) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }));
    window.setTimeout(() => get().dismissToast(id), kind === 'danger' ? 6000 : 4200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  applyStreamEvent: (e) => {
    switch (e.type) {
      case 'status':
        set({ status: e.text });
        break;
      case 'trip_created':
        set((s) => ({
          trip: e.trip,
          activeTripId: e.trip.id,
          trips: [tripToSummary(e.trip), ...s.trips.filter((t) => t.id !== e.trip.id)],
        }));
        break;
      case 'ghost':
        set((s) => ({
          ghosts: e.on ? Array.from(new Set([...s.ghosts, e.kind])) : s.ghosts.filter((k) => k !== e.kind),
        }));
        break;
      case 'node':
        set((s) => {
          if (!s.trip) return {};
          const exists = s.trip.nodes.some((n) => n.id === e.node.id);
          const nodes = exists ? s.trip.nodes.map((n) => (n.id === e.node.id ? e.node : n)) : [...s.trip.nodes, e.node];
          return {
            trip: { ...s.trip, nodes },
            ghosts: s.ghosts.filter((k) => k !== e.node.kind),
            pan: e.op === 'add' ? { nodeId: e.node.id, seq: s.pan.seq + 1 } : s.pan,
          };
        });
        break;
      case 'edge':
        set((s) => {
          if (!s.trip) return {};
          if (e.op === 'remove') return { trip: { ...s.trip, edges: s.trip.edges.filter((x) => x.id !== e.edge.id) } };
          const exists = s.trip.edges.some((x) => x.id === e.edge.id);
          const edges = exists ? s.trip.edges.map((x) => (x.id === e.edge.id ? e.edge : x)) : [...s.trip.edges, e.edge];
          return { trip: { ...s.trip, edges } };
        });
        break;
      case 'working':
        set((s) => (s.trip ? { trip: { ...s.trip, nodes: s.trip.nodes.map((n) => (n.id === e.nodeId ? { ...n, working: e.on } : n)) } } : {}));
        break;
      case 'gate':
        set((s) => (s.pendingActions.some((a) => a.id === e.action.id) ? {} : { pendingActions: [...s.pendingActions, e.action] }));
        break;
      case 'call_turn':
        set((s) => ({ call: { ...s.call, transcript: [...s.call.transcript, e.turn], subStatus: e.subStatus, status: 'in_progress' } }));
        break;
      case 'call_status':
        set((s) => ({ call: { ...s.call, status: e.status, subStatus: e.subStatus, outcome: e.outcome ?? s.call.outcome } }));
        if (e.status === 'ended') {
          // Let the glass dissolve and give way to the board.
          window.setTimeout(() => set((s) => ({ call: { ...s.call, open: false } })), 1700);
        }
        break;
    }
  },

  // internal helper exposed on the store
  refreshTripList: (trip: Trip | null | undefined) => {
    if (!trip) return;
    set((s) => {
      const summary = tripToSummary(trip);
      const others = s.trips.filter((t) => t.id !== trip.id);
      return { trips: [summary, ...others] };
    });
  },

  // ---- Shared trips ----

  openPeople: () => set({ peopleOpen: true, selectedNodeId: null }),
  closePeople: () => set({ peopleOpen: false, lastInvite: null }),

  invite: async (email) => {
    const { activeTripId } = get();
    if (!activeTripId) return null;
    set({ inviteBusy: true });
    try {
      const result = await api.createInvite({ tripId: activeTripId, email });
      set({ inviteBusy: false, lastInvite: result, roster: result.roster });
      return result;
    } catch (err: any) {
      console.error('invite failed', err);
      set({ inviteBusy: false });
      get().pushToast('danger', err?.message || 'Could not create that invite.');
      return null;
    }
  },

  clearLastInvite: () => set({ lastInvite: null }),

  setMemberApproval: async (collaboratorId, canApprove) => {
    const { activeTripId, roster } = get();
    if (!activeTripId) return;
    // Optimistic.
    set({ roster: roster.map((m) => (m.id === collaboratorId ? { ...m, canApprove } : m)) });
    try {
      const res = await api.setApproval({ tripId: activeTripId, collaboratorId, canApprove });
      set({ roster: res.roster });
      const who = res.roster.find((m) => m.id === collaboratorId);
      const name = who?.displayName || 'They';
      get().pushToast('success', canApprove ? `${name} can now approve bookings.` : `${name} can no longer approve.`);
    } catch (err: any) {
      console.error('setApproval failed', err);
      set({ roster }); // revert
      get().pushToast('danger', err?.message || 'Could not change approval.');
    }
  },

  removeMember: async (collaboratorId) => {
    const { activeTripId, roster } = get();
    if (!activeTripId) return;
    const prev = roster;
    set({ roster: roster.filter((m) => m.id !== collaboratorId) });
    try {
      const res = await api.removeCollaborator({ tripId: activeTripId, collaboratorId });
      set({ roster: res.roster });
    } catch (err: any) {
      console.error('removeMember failed', err);
      set({ roster: prev }); // revert
      get().pushToast('danger', err?.message || 'Could not remove that person.');
    }
  },

  claimByToken: async (token) => {
    try {
      const b = await api.claimInvite({ inviteToken: token });
      set((s) => ({
        activeTripId: b.tripId,
        trip: b.trip,
        messages: b.messages,
        pendingActions: (b.pendingActions ?? []).filter((a) => a.status === 'pending'),
        roster: b.roster ?? [],
        trips: b.trip ? [tripToSummary(b.trip), ...s.trips.filter((t) => t.id !== b.tripId)] : s.trips,
        selectedNodeId: null,
      }));
      get().pushToast('success', "You're on the trip.");
      return true;
    } catch (err: any) {
      console.error('claim failed', err);
      get().pushToast('danger', err?.message || 'That invite link is no longer valid.');
      return false;
    }
  },

  // The live poll. Records our presence, and — only when the trip actually
  // changed and we're idle — folds in another person's fresh board + messages.
  pollSync: async () => {
    const { activeTripId, trip, selectedNodeId } = get();
    if (!activeTripId || !trip) return;
    try {
      const res = await api.syncTrip({
        tripId: activeTripId,
        sinceVersion: trip.version,
        focusNodeId: selectedNodeId,
      });
      // Roster (presence) always refreshes.
      set({ roster: res.roster });
      // Only apply a fresh bundle when we're not mid-turn or in a call, to avoid
      // clobbering optimistic/streaming state. Our own turns update state directly.
      const s = get();
      if (res.changed && !s.thinking && !s.call.open && res.trip.version > (s.trip?.version ?? 0)) {
        set({
          trip: res.trip,
          messages: res.messages,
          pendingActions: (res.pendingActions ?? []).filter((a) => a.status === 'pending'),
        });
        get().refreshTripList(res.trip);
      }
    } catch (err) {
      // Silent — a dropped poll is fine; the next one recovers.
    }
  },
}));

function isAffirmative(t: string): boolean {
  return /^(yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|sounds good|book it|confirm(ed)?|call( them| the airline)?|rebook( it)?|please do)\b/i.test(
    t.trim(),
  );
}
function isNegative(t: string): boolean {
  return /^(no|nope|not yet|nah|cancel|don'?t|hold on|wait|never ?mind)\b/i.test(t.trim());
}

// My membership on the active trip (or null if I'm not in the roster yet).
export function myMember(roster: RosterMember[]): RosterMember | null {
  return roster.find((m) => m.isYou) || null;
}
// Whether the current viewer may clear a confirm-gate. Owner (or promoted
// companion) → true. Absent roster (solo/legacy) → true, since a lone traveler
// is always their own approver.
export function myCanApprove(roster: RosterMember[]): boolean {
  const me = myMember(roster);
  if (!me) return roster.length === 0;
  return me.role === 'owner' || me.canApprove;
}
// Members actively present on a given node right now (excluding me).
export function presenceOnNode(roster: RosterMember[], nodeId: string): RosterMember[] {
  return roster.filter((m) => !m.isYou && m.focusNodeId === nodeId && isPresent(m));
}

function tripToSummary(t: Trip): TripSummary {
  return {
    id: t.id,
    title: t.title,
    destination: t.destination,
    startDate: t.startDate,
    endDate: t.endDate,
    status: t.status,
    version: t.version,
    nodeCount: t.nodes.length,
    updatedAt: t.updated_at,
  };
}

function bookedToast(action: PendingAction): string {
  if (action.kind === 'rebook') return "You're rebooked. Your board is updated.";
  if (action.kind === 'book_hotel') return 'Hotel confirmed. You are all set.';
  return 'Booked. You are all set.';
}

// Wire the voice engine's callbacks into the store once.
voice.onStateChange = (s) => useStore.getState().setVoiceState(s);
voice.onResult = (text) => useStore.getState().send(text, 'voice');

export function selectNodeById(nodes: TripNode[], id: string | null): TripNode | null {
  if (!id) return null;
  return nodes.find((n) => n.id === id) || null;
}
