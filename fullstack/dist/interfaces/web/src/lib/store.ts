import { create } from 'zustand';
import { api } from './api';
import { voice, type VoiceState } from './voice';
import { detectLocation } from './geo';
import { resizeImageFile } from './imageResize';
import type {
  Trip,
  TripNode,
  TripSummary,
  User,
  Message,
  PendingAction,
  CallTurn,
  CallSession,
  TripExpense,
  StreamEvent,
  NodeKind,
  RosterMember,
  InviteResult,
  LocationScope,
  NearbyUser,
  ConversationSummary,
  ConversationParticipant,
  ConversationMessage,
  FriendRequestSummary,
  FriendSummary,
} from './types';

// A member is "present" if we heard from them within this window. The grace
// window (not a single poll) keeps a dropped 4s poll from strobing a marker off.
export const PRESENCE_WINDOW_MS = 10_000;
export function isPresent(m: RosterMember): boolean {
  return !!m.lastSeenAt && Date.now() - m.lastSeenAt < PRESENCE_WINDOW_MS;
}

// Plain data-URL read, no resize — used for PDFs (resizeImageFile only
// handles images, via canvas re-encoding).
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read that file.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

let toastSeq = 0;
let placesUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'danger';
  text: string;
}

interface CallState {
  open: boolean;
  sessionId: string | null;
  // Who this call is with — a venue on the traveler's behalf (existing
  // disruption flow), or Waypoint calling the traveler themselves.
  kind: 'to_venue' | 'to_traveler';
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
  kind: 'to_venue',
  target: '',
  nodeId: null,
  status: 'dialing',
  subStatus: '',
  transcript: [],
  outcome: null,
};

// A freshly-placed "Waypoint Calls You" session, seen via getBootstrap/getTrip
// (initial load) or syncTrip (the ~4s heartbeat while a trip is open) — either
// way, opens the incoming-call UI instead of being applied as normal trip data.
function isRingingTravelerCall(call: CallSession | null | undefined): call is CallSession {
  return !!call && call.kind === 'to_traveler' && call.status === 'dialing';
}

function ringingCallState(call: CallSession): CallState {
  return {
    open: true,
    sessionId: call.id,
    kind: 'to_traveler',
    target: call.target,
    nodeId: call.nodeId,
    status: 'dialing',
    subStatus: call.subStatus || 'Ringing',
    transcript: [],
    outcome: null,
  };
}

interface StoreState {
  // data
  loading: boolean;
  profile: User | null;
  // 'home' is the groups dashboard shown right after sign-in; 'planning' is
  // the chat + board view for one open trip; 'profile' is the editable
  // account page.
  view: 'home' | 'planning' | 'profile';
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
  // split the bill
  expenses: TripExpense[];
  splitOpen: boolean;
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
  // True only while an ambient, pre-trip mascot conversation is in progress
  // (tapped the mascot with no trip open yet) — routes voice.onQuery to
  // askMascotTurn instead of the normal in-trip send() pipeline.
  mascotMode: boolean;
  askMascotTurn: (text: string) => Promise<string>;
  // The mascot's tap handler: stops an in-progress turn on a second tap
  // (some travelers don't want it to keep talking), otherwise starts
  // listening — in ambient mode (no trip open yet) rather than redirecting
  // into trip planning immediately.
  tapMascot: () => void;
  theme: 'light' | 'dark';
  toasts: Toast[];
  // actions
  bootstrap: () => Promise<void>;
  // Persists profile-edit fields and syncs the store's copy immediately so
  // the rest of the app (People Nearby, gating in App.tsx) sees it right
  // away. The onboarding flow deliberately does NOT use this — it calls
  // api.updateProfile directly and holds off on syncing `profile` until its
  // "getting to know you" animation finishes, via setProfile below.
  saveProfile: (input: Parameters<typeof api.updateProfile>[0]) => Promise<User>;
  setProfile: (u: User) => void;
  setTheme: (t: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setVoiceState: (s: VoiceState) => void;
  toggleMic: () => void;
  selectNode: (id: string | null) => void;
  newTrip: () => void;
  switchTrip: (id: string) => Promise<void>;
  goHome: () => void;
  openProfile: () => void;
  openPlanning: (id: string) => Promise<void>;
  openNewPlanning: () => void;
  // Returns the agent's spoken reply so the Vocal Bridge query channel can
  // voice it; the browser-speech path ignores the return value.
  send: (text: string, source: 'voice' | 'chat') => Promise<string>;
  // The app's shared disposable-inbox address (mail.tm) — shown near the
  // import button as "or forward a confirmation to <address>".
  importEmailAddress: string | null;
  // Set when an import (upload or forwarded email) needs one more answer
  // before it can create a node — a missing field, or which trip it's for.
  pendingImportId: string | null;
  pendingImportQuestion: string | null;
  importDocument: (file: File) => Promise<void>;
  resolveImportAnswer: (answer: string) => Promise<void>;
  approve: (actionId: string) => Promise<void>;
  decline: (actionId: string) => Promise<void>;
  triggerDisruption: () => Promise<void>;
  dismissCall: () => void;
  // "Waypoint Calls You" — answering/declining an incoming (not traveler-
  // approved) call, as opposed to approve()/decline() which resolve a
  // pending confirm-gate action.
  answerCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  pushToast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: number) => void;
  applyStreamEvent: (e: StreamEvent) => void;
  refreshTripList: (trip: Trip | null | undefined) => void;
  // shared trips
  openPeople: () => void;
  closePeople: () => void;
  invite: (email: string) => Promise<InviteResult | null>;
  clearLastInvite: () => void;
  // split the bill
  openSplit: () => void;
  closeSplit: () => void;
  markPaid: (expenseId: string) => Promise<void>;
  setMemberApproval: (collaboratorId: string, canApprove: boolean) => Promise<void>;
  removeMember: (collaboratorId: string) => Promise<void>;
  claimByToken: (token: string) => Promise<boolean>;
  pollSync: () => Promise<void>;
  // People nearby + direct/group messaging
  nearbyScope: LocationScope;
  nearbyUsers: NearbyUser[];
  nearbyLoading: boolean;
  nearbyHasLocation: boolean;
  setNearbyScope: (scope: LocationScope) => Promise<void>;
  loadNearby: () => Promise<void>;
  friendRequests: FriendRequestSummary[];
  loadFriendRequests: () => Promise<void>;
  sendFriendRequest: (toUserId: string) => Promise<void>;
  respondToFriendRequest: (requestId: string, accept: boolean) => Promise<void>;
  // Every friend, location-independent — backs the group-chat picker.
  friends: FriendSummary[];
  loadFriends: () => Promise<void>;
  groupPickerOpen: boolean;
  openGroupPicker: () => void;
  closeGroupPicker: () => void;
  conversations: ConversationSummary[];
  activeConversation: { id: string; type: 'direct' | 'group'; title: string | null; participants: ConversationParticipant[] } | null;
  conversationMessages: ConversationMessage[];
  conversationsPanelOpen: boolean;
  toggleConversationsPanel: () => void;
  loadConversations: () => Promise<void>;
  openConversationWith: (userIds: string[], title?: string) => Promise<void>;
  openConversationById: (id: string) => Promise<void>;
  closeConversation: () => void;
  sendConversationMessage: (text: string) => Promise<void>;
  planTripInChat: (destination: string, originCity?: string) => Promise<void>;
  bookFlightInChat: (messageId: string) => Promise<void>;
  // Whether Waypoint is currently scouting trending places for the
  // traveler's city — the mascot widget reacts to this globally, so it
  // stays visible even if the map card itself is scrolled out of view.
  placesScanning: boolean;
  setPlacesScanning: (v: boolean) => void;
  // Whether the location map card is expanded fullscreen — lifted up here
  // (rather than local state inside LocationMap) so Home can drop the
  // `sticky` class off the map's ancestor while fullscreen. `sticky`
  // always creates its own CSS stacking context, which otherwise caps the
  // fullscreen map's z-index to that subtree and lets later page content
  // paint over it regardless of the z-index value.
  mapFullscreen: boolean;
  setMapFullscreen: (v: boolean) => void;
  // A short-lived wrap-up line the mascot shows after every places check —
  // "found N new spots" or "that's everything so far" — so the search
  // feels acknowledged even when it turns up nothing new, not just silent.
  placesUpdateMessage: string | null;
  showPlacesUpdate: (message: string) => void;
  // Called once the mascot actually finishes speaking the update (or
  // immediately, if TTS wasn't available) — the bubble's visible time is
  // driven by that, not a fixed guessed duration (see MascotWidget.tsx).
  dismissPlacesUpdate: () => void;
}

export const useStore = create<StoreState>((set, get) => ({
  loading: true,
  profile: null,
  view: 'home',
  trips: [],
  activeTripId: null,
  trip: null,
  messages: [],
  pendingActions: [],
  roster: [],
  peopleOpen: false,
  expenses: [],
  splitOpen: false,
  nearbyScope: 'city',
  nearbyUsers: [],
  nearbyLoading: false,
  nearbyHasLocation: false,
  friendRequests: [],
  friends: [],
  groupPickerOpen: false,
  conversations: [],
  activeConversation: null,
  conversationMessages: [],
  conversationsPanelOpen: false,
  placesScanning: false,
  mapFullscreen: false,
  placesUpdateMessage: null,
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
  mascotMode: false,
  theme: 'light',
  toasts: [],
  importEmailAddress: null,
  pendingImportId: null,
  pendingImportQuestion: null,

  bootstrap: async () => {
    try {
      const b = await api.getBootstrap();
      if (!b.authenticated) {
        set({ loading: false, profile: null });
        return;
      }
      // Signed in: arm the Vocal Bridge path. The token is only minted when
      // the traveler first presses the orb, and voice falls back to browser
      // speech if the integration isn't configured.
      voice.configureVocalBridge(() => api.getVoiceToken());
      set({
        loading: false,
        profile: b.user ?? null,
        trips: b.trips ?? [],
        activeTripId: b.activeTripId ?? null,
        trip: b.trip ?? null,
        messages: b.messages ?? [],
        pendingActions: (b.pendingActions ?? []).filter((a) => a.status === 'pending'),
        roster: b.roster ?? [],
        importEmailAddress: b.importEmailAddress ?? null,
        expenses: b.expenses ?? [],
        // Reloading the page (or reopening the app) must drop the traveler
        // back into the conversation they left, not the home/trip-list
        // screen — getBootstrap already picks the most recently updated trip
        // as activeTripId specifically so this can resume it. Without this,
        // all the right data loads into the store but the view itself never
        // leaves its default 'home', so it LOOKS like nothing resumed even
        // though a reopen of the same trip would show everything intact.
        ...(b.activeTripId ? { view: 'planning' as const } : {}),
      });
      // A "Waypoint Calls You" session could already be ringing on load (the
      // call was placed while this tab was closed) — surface it immediately
      // rather than waiting for the next sync poll.
      if (isRingingTravelerCall(b.activeCall)) set({ call: ringingCallState(b.activeCall) });
      // Fire-and-forget: refresh "where I am" so people-nearby stays current
      // for anyone who's actually traveled since last time — but only when
      // the saved location is stale enough that it's worth re-asking. A
      // saved location less than LOCATION_REFRESH_MS old just re-triggers
      // the browser's geolocation prompt on every single sign-in/reload for
      // no reason, which reads as the app "not trusting" a location it
      // already has. Never blocks the initial render on a slow/denied
      // geolocation permission prompt either way.
      const LOCATION_REFRESH_MS = 6 * 60 * 60 * 1000; // 6 hours
      const savedAt = b.user?.location?.updatedAt;
      if (!savedAt || Date.now() - savedAt > LOCATION_REFRESH_MS) {
        detectLocation()
          .then((loc) => {
            if (!loc) return;
            return api.setLocation(loc).then(({ user }) => set((s) => (s.profile ? { profile: { ...s.profile, location: user.location } } : {})));
          })
          .catch((err) => console.error('[geo] could not save location', err));
      }
    } catch (err) {
      console.error('bootstrap failed', err);
      set({ loading: false });
    }
  },

  saveProfile: async (input) => {
    const { user } = await api.updateProfile(input);
    set({ profile: user });
    return user;
  },
  setProfile: (u) => set({ profile: u }),

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
    if (!voice.available) {
      get().pushToast(
        'info',
        voice.unavailableReason === 'insecure'
          ? 'Voice needs a secure page. Open Waypoint at http://localhost:5173 or over HTTPS — a raw http://<ip> URL blocks the mic.'
          : 'Voice needs a browser with a microphone to talk to Waypoint.',
      );
      return;
    }
    voice.toggleListening();
  },

  // Selecting a node reclaims the docked slot from the People panel, and tells
  // the voice agent what's in focus so the next spoken turn can reference it.
  selectNode: (id) => {
    if (id) voice.sendBoardSelection(id);
    set({ selectedNodeId: id, peopleOpen: id ? false : get().peopleOpen, splitOpen: id ? false : get().splitOpen });
  },

  newTrip: () =>
    set({
      activeTripId: null,
      trip: null,
      messages: [],
      pendingActions: [],
      roster: [],
      peopleOpen: false,
      expenses: [],
      splitOpen: false,
      selectedNodeId: null,
      ghosts: [],
      streamingReply: null,
      status: '',
      thinking: false,
    }),

  switchTrip: async (id) => {
    if (get().activeTripId === id) return;
    // Leaving whatever voice turn was in progress on the trip we're switching
    // away from — never leave it listening/speaking against a screen that's
    // no longer showing that conversation.
    void voice.stopAll();
    set({ activeTripId: id, selectedNodeId: null, ghosts: [], streamingReply: null, status: '', peopleOpen: false, splitOpen: false, roster: [] });
    try {
      const b = await api.getTrip({ tripId: id });
      set({
        trip: b.trip,
        messages: b.messages,
        pendingActions: (b.pendingActions ?? []).filter((a) => a.status === 'pending'),
        roster: b.roster ?? [],
        expenses: b.expenses ?? [],
      });
      if (isRingingTravelerCall(b.activeCall)) set({ call: ringingCallState(b.activeCall) });
    } catch (err) {
      console.error('switchTrip failed', err);
      get().pushToast('danger', 'Could not open that trip.');
    }
  },

  // Navigating back must stop whatever voice turn was in progress — otherwise
  // the agent keeps listening/talking against a trip that's no longer on
  // screen (the exact "it keeps talking after I go back" bug).
  goHome: () => {
    void voice.stopAll();
    set({ view: 'home', mascotMode: false });
  },
  openProfile: () => set({ view: 'profile' }),

  openPlanning: async (id) => {
    await get().switchTrip(id);
    set({ view: 'planning' });
  },

  openNewPlanning: () => {
    get().newTrip();
    set({ view: 'planning' });
  },

  // The mascot's ambient, pre-trip turn: ask the backend whether this is real
  // trip intent or just a general question. A "chat" reply is just spoken —
  // the conversation continues with no navigation. A "plan_trip" reply hands
  // off into the exact same trip-planning pipeline the in-trip orb uses,
  // seeded with what the traveler actually said, so nothing is lost.
  askMascotTurn: async (text) => {
    try {
      const res = await api.askMascot({ text });
      if (res.intent === 'plan_trip') {
        set({ mascotMode: false });
        get().openNewPlanning();
        const seed = res.seedText || text;
        const reply = await get().send(seed, 'voice');
        return reply || res.reply;
      }
      return res.reply;
    } catch (err) {
      console.error('askMascotTurn failed', err);
      return "Sorry, I hit a snag there.";
    }
  },

  tapMascot: () => {
    const { voiceState, activeTripId } = get();
    if (voiceState === 'listening' || voiceState === 'speaking' || voiceState === 'connecting') {
      void voice.stopAll();
      set({ mascotMode: false });
      return;
    }
    // Only ambient (no redirect) when there's no trip open yet — tapping the
    // persistent mascot while already deep in planning just resumes that
    // trip's conversation, same as before, instead of wiping it.
    if (!activeTripId) set({ mascotMode: true });
    get().toggleMic();
  },

  send: async (text, source) => {
    const trimmed = text.trim();
    if (!trimmed || get().thinking) return '';
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
        return 'On it.';
      }
      if (isNegative(trimmed)) {
        get().decline(gate.id);
        return "Okay, I won't.";
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
      // Finalize: agent message + authoritative trip. The orchestrator should
      // never hand back an empty reply, but an empty bubble (and, for voice,
      // dead silence from speak('')) reads as "the app is broken" rather than
      // "still working" — this is a last-resort backstop, not the real fix.
      const replyText = res.reply || "I made some updates — take a look at the board and let me know what's next.";
      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        tripId: res.tripId,
        role: 'agent',
        text: replyText,
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
      if (source === 'voice') voice.speak(replyText);
      return replyText;
    } catch (err: any) {
      console.error('converse failed', err);
      set({ thinking: false, streamingReply: null, status: '', ghosts: [] });
      get().pushToast('danger', "I hit a snag on that one. Mind trying again?");
      return 'I hit a snag on that one. Mind trying again?';
    }
  },

  importDocument: async (file) => {
    if (get().thinking) return;
    const { activeTripId } = get();
    const isImage = file.type.startsWith('image/');
    set({ thinking: true, status: 'Reading your document', pendingImportId: null, pendingImportQuestion: null });
    const importing: Message = {
      id: `tmp-${Date.now()}`,
      tripId: activeTripId || 'new',
      role: 'user',
      text: `Uploaded ${file.name}`,
      source: 'system',
      status: 'complete',
    };
    set((s) => ({ messages: [...s.messages, importing] }));

    try {
      const fileDataUrl = isImage ? await resizeImageFile(file, 2000, 0.9) : await readFileAsDataUrl(file);
      const res = await api.importDocument(
        { tripId: activeTripId || undefined, fileDataUrl, fileName: file.name },
        { stream: true, onStreamData: (e) => get().applyStreamEvent(e as StreamEvent), onStreamError: (err) => console.error(err) },
      );
      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        tripId: res.tripId || activeTripId || 'new',
        role: 'agent',
        text: res.reply,
        source: 'chat',
        status: 'complete',
      };
      set((s) => ({
        messages: [...s.messages, agentMsg],
        pendingImportId: res.needsClarification ? res.importId ?? null : null,
        pendingImportQuestion: res.needsClarification ? res.reply : null,
      }));
      if (res.tripId && res.tripId !== get().activeTripId) set({ activeTripId: res.tripId });
      get().refreshTripList(get().trip);
    } catch (err: any) {
      console.error('importDocument failed', err);
      get().pushToast('danger', String(err?.message || "Couldn't read that file."));
    } finally {
      set({ thinking: false, status: '' });
    }
  },

  resolveImportAnswer: async (answer) => {
    const { pendingImportId } = get();
    if (!pendingImportId || get().thinking) return;
    const trimmed = answer.trim();
    if (!trimmed) return;
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      tripId: get().activeTripId || 'new',
      role: 'user',
      text: trimmed,
      source: 'chat',
      status: 'complete',
    };
    set((s) => ({ messages: [...s.messages, optimistic], thinking: true }));
    try {
      const res = await api.resolveImport(
        { importId: pendingImportId, answer: trimmed },
        { stream: true, onStreamData: (e) => get().applyStreamEvent(e as StreamEvent) },
      );
      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        tripId: res.tripId || get().activeTripId || 'new',
        role: 'agent',
        text: res.reply,
        source: 'chat',
        status: 'complete',
      };
      set((s) => ({
        messages: [...s.messages, agentMsg],
        pendingImportId: res.needsClarification ? res.importId ?? null : null,
        pendingImportQuestion: res.needsClarification ? res.reply : null,
      }));
      if (res.tripId && res.tripId !== get().activeTripId) set({ activeTripId: res.tripId });
      get().refreshTripList(get().trip);
    } catch (err) {
      console.error('resolveImportAnswer failed', err);
      get().pushToast('danger', 'That did not go through — mind trying again?');
    } finally {
      set({ thinking: false });
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
            kind: 'to_venue',
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
        if (res.expenses) set({ expenses: res.expenses });
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

  answerCall: async () => {
    const { call } = get();
    if (!call.open || call.kind !== 'to_traveler' || !call.sessionId) return;
    set((s) => ({ call: { ...s.call, status: 'connected', subStatus: 'Connecting' } }));
    try {
      await api.answerTravelerCall(
        { callSessionId: call.sessionId },
        { stream: true, onStreamData: (e) => get().applyStreamEvent(e as StreamEvent), onStreamError: (err) => console.error(err) },
      );
    } catch (err) {
      console.error('answerCall failed', err);
      get().pushToast('danger', 'That call dropped — the update is on its way to your messages instead.');
      get().dismissCall();
    }
  },

  declineCall: async () => {
    const { call } = get();
    if (!call.open || call.kind !== 'to_traveler' || !call.sessionId) return;
    const sessionId = call.sessionId;
    get().dismissCall();
    try {
      await api.declineTravelerCall({ callSessionId: sessionId });
    } catch (err) {
      console.error('declineCall failed', err);
    }
  },

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
        // A traveler call is Waypoint speaking to the traveler directly, not a
        // transcript of two other parties — say it aloud. The airline call's
        // transcript has never been spoken and stays that way.
        if (get().call.kind === 'to_traveler') voice.speak(e.turn.text);
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

  openPeople: () => set({ peopleOpen: true, splitOpen: false, selectedNodeId: null }),
  closePeople: () => set({ peopleOpen: false, lastInvite: null }),

  openSplit: () => set({ splitOpen: true, peopleOpen: false, selectedNodeId: null }),
  closeSplit: () => set({ splitOpen: false }),

  markPaid: async (expenseId) => {
    try {
      const res = await api.markExpensePaid({ expenseId });
      set((s) => ({ expenses: s.expenses.map((e) => (e.id === expenseId ? res.expense : e)) }));
      get().pushToast('success', "Marked as paid — you're settled up.");
    } catch (err: any) {
      console.error('markPaid failed', err);
      get().pushToast('danger', err?.message || 'Could not mark that as paid.');
    }
  },

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
      const s = get();
      // A "Waypoint Calls You" session just started ringing — this IS the
      // mechanism that reaches an open tab (there's no push channel), so it
      // takes priority over the normal bundle-apply below for this tick.
      if (res.changed && !s.call.open && isRingingTravelerCall(res.activeCall)) {
        set({ call: ringingCallState(res.activeCall) });
        return;
      }
      // Only apply a fresh bundle when we're not mid-turn or in a call, to avoid
      // clobbering optimistic/streaming state. Our own turns update state directly.
      if (res.changed && !s.thinking && !s.call.open && res.trip.version > (s.trip?.version ?? 0)) {
        set({
          trip: res.trip,
          messages: res.messages,
          pendingActions: (res.pendingActions ?? []).filter((a) => a.status === 'pending'),
          expenses: res.expenses ?? [],
        });
        get().refreshTripList(res.trip);
      }
    } catch (err) {
      // Silent — a dropped poll is fine; the next one recovers.
    }
  },

  setNearbyScope: async (scope) => {
    set({ nearbyScope: scope });
    await get().loadNearby();
  },

  loadNearby: async () => {
    const prevUsers = get().nearbyUsers;
    set({ nearbyLoading: true });
    try {
      const res = await api.listNearbyUsers({ scope: get().nearbyScope });
      // The accepter's own client already gets a "you're now friends!"
      // toast (see respondToFriendRequest below), but that update never
      // reaches the requester — nothing else here polls, so this refresh
      // is the only place we can catch the pending -> friends transition
      // and let the requester know their request actually landed.
      for (const u of res.users) {
        const prev = prevUsers.find((p) => p.id === u.id);
        if (u.friendStatus === 'friends' && prev?.friendStatus === 'pending_outgoing') {
          get().pushToast('success', `${u.displayName || 'A fellow traveler'} accepted your friend request!`);
        }
      }
      set({ nearbyUsers: res.users, nearbyHasLocation: res.hasLocation, nearbyLoading: false });
    } catch (err) {
      console.error('loadNearby failed', err);
      set({ nearbyLoading: false });
    }
  },

  loadFriendRequests: async () => {
    try {
      const res = await api.listFriendRequests();
      set({ friendRequests: res.requests });
    } catch (err) {
      console.error('loadFriendRequests failed', err);
    }
  },

  sendFriendRequest: async (toUserId) => {
    try {
      await api.sendFriendRequest({ toUserId });
      await get().loadNearby();
      get().pushToast('success', 'Friend request sent.');
    } catch (err: any) {
      console.error('sendFriendRequest failed', err);
      get().pushToast('danger', err?.message || 'Could not send that request.');
    }
  },

  respondToFriendRequest: async (requestId, accept) => {
    try {
      await api.respondToFriendRequest({ requestId, accept });
      await Promise.all([get().loadNearby(), get().loadFriendRequests()]);
      if (accept) get().pushToast('success', "You're now friends!");
    } catch (err: any) {
      console.error('respondToFriendRequest failed', err);
      get().pushToast('danger', err?.message || 'Could not respond to that request.');
    }
  },

  loadFriends: async () => {
    try {
      const res = await api.listFriends();
      set({ friends: res.friends });
    } catch (err) {
      console.error('loadFriends failed', err);
    }
  },

  openGroupPicker: () => set({ groupPickerOpen: true }),
  closeGroupPicker: () => set({ groupPickerOpen: false }),

  toggleConversationsPanel: () => {
    const opening = !get().conversationsPanelOpen;
    set({ conversationsPanelOpen: opening });
    if (opening) {
      get().loadConversations();
      get().loadFriends();
    }
  },

  loadConversations: async () => {
    try {
      const res = await api.listConversations();
      set({ conversations: res.conversations });
    } catch (err) {
      console.error('loadConversations failed', err);
    }
  },

  openConversationWith: async (userIds, title) => {
    try {
      const { conversation } = await api.startConversation({ userIds, title });
      await get().openConversationById(conversation.id);
      await get().loadConversations();
    } catch (err) {
      console.error('openConversationWith failed', err);
      get().pushToast('danger', 'Could not start that chat.');
    }
  },

  openConversationById: async (id) => {
    try {
      const res = await api.getConversation({ conversationId: id });
      set({ activeConversation: res.conversation, conversationMessages: res.messages, conversationsPanelOpen: true });
    } catch (err) {
      console.error('openConversationById failed', err);
      get().pushToast('danger', 'Could not open that chat.');
    }
  },

  closeConversation: () => set({ activeConversation: null, conversationMessages: [] }),

  setPlacesScanning: (v) => set({ placesScanning: v }),

  setMapFullscreen: (v) => set({ mapFullscreen: v }),

  showPlacesUpdate: (message) => {
    if (placesUpdateTimeout) clearTimeout(placesUpdateTimeout);
    set({ placesUpdateMessage: message });
    // Safety-net only — MascotWidget dismisses this itself once it actually
    // finishes speaking the line, so this is just a cap in case that never
    // fires (TTS hung, tab backgrounded, etc.), not the primary timer.
    placesUpdateTimeout = setTimeout(() => set({ placesUpdateMessage: null }), 20000);
  },

  dismissPlacesUpdate: () => {
    if (placesUpdateTimeout) clearTimeout(placesUpdateTimeout);
    set({ placesUpdateMessage: null });
  },

  sendConversationMessage: async (text) => {
    const trimmed = text.trim();
    const conv = get().activeConversation;
    if (!trimmed || !conv) return;
    try {
      const { message, suggestionMessage } = await api.sendDirectMessage({ conversationId: conv.id, text: trimmed });
      set((s) => ({ conversationMessages: [...s.conversationMessages, message, ...(suggestionMessage ? [suggestionMessage] : [])] }));
      get().loadConversations();
    } catch (err) {
      console.error('sendConversationMessage failed', err);
      get().pushToast('danger', 'Message failed to send.');
    }
  },

  // The mascot acting as a ticket agent, right in the social chat — everyone
  // in the conversation sees the same option cards and ticket, since they're
  // just more messages in the shared thread.
  planTripInChat: async (destination, originCity) => {
    const conv = get().activeConversation;
    if (!conv) return;
    try {
      const { messages } = await api.searchTripOptionsInChat({ conversationId: conv.id, destination, originCity });
      set((s) => ({ conversationMessages: [...s.conversationMessages, ...messages] }));
      get().loadConversations();
    } catch (err: any) {
      console.error('planTripInChat failed', err);
      get().pushToast('danger', err?.message || 'Could not look up flights for that trip.');
    }
  },

  bookFlightInChat: async (messageId) => {
    const conv = get().activeConversation;
    if (!conv) return;
    // Guard the in-flight window: the server rejects a re-book once it's ticketed,
    // but two taps fired before the first response returns would both pass that
    // check. Ignore a second tap on the same offer while one is still pending.
    if (bookingInFlight.has(messageId)) return;
    bookingInFlight.add(messageId);
    try {
      const { message } = await api.bookFlightFromChat({ conversationId: conv.id, messageId });
      set((s) => ({ conversationMessages: [...s.conversationMessages, message] }));
      get().loadConversations();
    } catch (err: any) {
      console.error('bookFlightInChat failed', err);
      get().pushToast('danger', err?.message || 'Could not book that flight.');
    } finally {
      bookingInFlight.delete(messageId);
    }
  },
}));

// Offer message ids with a book request currently in flight, so a rapid second
// tap on the same "Book this flight" button can't double-submit before the
// server's idempotency guard has recorded the ticket.
const bookingInFlight = new Set<string>();

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
// Vocal Bridge hands each spoken query to the same converse pipeline chat
// uses; the returned reply is voiced by the agent (docs/03 §2.5). Vocal Bridge
// speaks the return value verbatim, so we must never hand it an empty string —
// that produces dead air and the traveler thinks voice is broken. A clipped or
// unheard utterance (empty query) gets a natural re-prompt, and a turn that
// arrives while a previous one is still running gets a brief hold instead of
// silence.
// The SDK's onAIAgentQuery gives us no turn id, so a redelivered/retried
// query (e.g. a brief Vocal Bridge reconnect) is indistinguishable from a
// genuinely new one at this layer — reprocessing it duplicated both the
// traveler's line and the agent's reply in the transcript. The same exact
// text arriving again within a few seconds is treated as a redelivery and
// gets the same in-flight/just-finished reply instead of re-running the
// whole pipeline (and re-touching the board) a second time.
const VOICE_DEDUP_WINDOW_MS = 4000;
let lastVoiceQuery: { text: string; at: number; replyPromise: Promise<string> } | null = null;

// A real traveler never describes themselves in the third person to a voice
// assistant ("User wants to plan a trip... They are starting a conversation
// after greeting."). Text shaped like that is the query-formulation layer
// talking about the turn instead of transcribing it — most often produced
// when the mic picks up silence, noise, or (see the echoCancellation fix in
// voice.ts) the agent's own TTS bleeding back in, and the pipeline still has
// to return *some* text. Catching it here stops it from being treated as a
// genuine spoken request (pushed into the trip, driving real board changes)
// even if the audio-side fix above doesn't fully eliminate the trigger.
const PHANTOM_QUERY_RE =
  /\b(the\s+)?(user|traveler)\s+(wants|want|is|are|just)\b|\bthey('re| are)\s+(starting|beginning)\s+a\s+conversation\b/i;

voice.onQuery = async (text) => {
  const q = text.trim();
  if (!q) return "Sorry, I didn't catch that — where would you like to go?";
  if (PHANTOM_QUERY_RE.test(q)) {
    console.warn('[voice] dropped a likely phantom (non-speech) query:', q);
    return "I'm here whenever you're ready — go ahead.";
  }
  if (lastVoiceQuery && lastVoiceQuery.text === q && Date.now() - lastVoiceQuery.at < VOICE_DEDUP_WINDOW_MS) {
    return lastVoiceQuery.replyPromise;
  }
  // Any turn with no trip open yet routes through the intent-checking (and,
  // per common/voiceConfirm.ts, confirmation-gated) askMascotTurn instead of
  // going straight into planning — not just when mascotMode is set. Gating
  // on mascotMode alone left a real gap: tapping "New Trip" sets
  // activeTripId to null without setting mascotMode, so the very next voice
  // turn (fabricated or not) fell straight into send()'s no-tripId path,
  // which creates a trip immediately with no confirmation at all — exactly
  // how "Trip to Paris" got created from a single fabricated turn nobody
  // confirmed.
  const noTripOpen = !useStore.getState().activeTripId;
  const replyPromise = useStore.getState().mascotMode || noTripOpen
    ? useStore.getState().askMascotTurn(q)
    : useStore
        .getState()
        .send(q, 'voice')
        .then((reply) => reply || 'One moment — I’m still working on that.');
  lastVoiceQuery = { text: q, at: Date.now(), replyPromise };
  return replyPromise;
};

// Browser-native SpeechRecognition path (voice.ts's FORCE_BROWSER_SPEECH),
// now the primary voice path. Unlike onQuery above, the SDK/browser API gives
// this callback no return value to auto-speak — it's fire-and-forget — so it
// must mirror onQuery's mascotMode routing itself, and (the bug this
// replaces) any ambient utterance with no trip open would otherwise fall
// straight into send()'s no-tripId path and silently create a trip from a
// casual remark.
voice.onResult = async (text) => {
  const q = text.trim();
  if (!q) return;
  if (PHANTOM_QUERY_RE.test(q)) {
    console.warn('[voice] dropped a likely phantom (non-speech) result:', q);
    return;
  }
  if (lastVoiceQuery && lastVoiceQuery.text === q && Date.now() - lastVoiceQuery.at < VOICE_DEDUP_WINDOW_MS) return;
  // Same gap as onQuery above: gate on "no trip open" too, not just
  // mascotMode, so a voice turn right after tapping "New Trip" (activeTripId
  // null, mascotMode still false) also goes through the confirmation-gated
  // askMascotTurn instead of straight into send()'s no-tripId auto-create.
  if (useStore.getState().mascotMode || !useStore.getState().activeTripId) {
    const replyPromise = useStore.getState().askMascotTurn(q);
    lastVoiceQuery = { text: q, at: Date.now(), replyPromise };
    const reply = await replyPromise;
    // askMascotTurn's plan_trip branch (if it fired) calls openNewPlanning(),
    // which sets a real activeTripId, and its own nested send() call already
    // spoke the reply — speaking again here would audibly cut off and
    // restart it. Only speak when we're still tripless afterward, meaning
    // the pure ambient "chat" branch ran and nothing else has spoken yet.
    if (!useStore.getState().activeTripId) voice.speak(reply);
    return;
  }
  const replyPromise = useStore
    .getState()
    .send(q, 'voice')
    .then((reply) => reply || 'One moment — I’m still working on that.');
  lastVoiceQuery = { text: q, at: Date.now(), replyPromise };
  await replyPromise; // send() already speaks its own reply for source 'voice'
};

export function selectNodeById(nodes: TripNode[], id: string | null): TripNode | null {
  if (!id) return null;
  return nodes.find((n) => n.id === id) || null;
}
