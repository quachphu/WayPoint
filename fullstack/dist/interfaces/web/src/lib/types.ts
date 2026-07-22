// Frontend mirror of the backend domain types.

export type NodeKind = 'flight' | 'hotel' | 'activity' | 'ground';
export type NodeStatus = 'proposed' | 'confirmed' | 'disrupted' | 'failed' | 'cancelled';
export type EdgeMode = 'flight' | 'drive' | 'walk' | 'transit';

// Who asked for something on a shared trip (companion attribution). Absent for
// the owner's own actions.
export interface RequestedBy {
  userId: string;
  name: string;
  color: string;
}

export interface TripNode {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle?: string;
  start: number | null;
  end: number | null;
  location: string;
  status: NodeStatus;
  working: boolean;
  bookingRef: string | null;
  costCents: number | null;
  dependsOn: string[];
  detail?: Record<string, any>;
  requestedBy?: RequestedBy | null;
  // 1-based day of the trip (Day 1, Day 2, ...) driving the swimlane the node
  // renders in. Null/absent = not yet scheduled to a specific day.
  dayIndex?: number | null;
  // Best-effort real photo (Wikimedia), hotel/activity only. Null = no match.
  imageUrl?: string | null;
}

export interface TripEdge {
  id: string;
  from: string;
  to: string;
  mode: EdgeMode;
  label: string;
  state: 'default' | 'working';
  durationMin?: number | null;
  distanceKm?: number | null;
}

export type TripStatus = 'planning' | 'confirmed' | 'disrupted' | 'complete';

export interface Trip {
  id: string;
  userId: string;
  title: string;
  destination: string;
  origin?: string;
  startDate: number | null;
  endDate: number | null;
  status: TripStatus;
  nodes: TripNode[];
  edges: TripEdge[];
  version: number;
  created_at?: number;
  updated_at?: number;
}

export interface TripSummary {
  id: string;
  title: string;
  destination: string;
  startDate: number | null;
  endDate: number | null;
  status: TripStatus;
  version: number;
  nodeCount: number;
  updatedAt?: number;
}

export interface Message {
  id: string;
  tripId: string;
  role: 'user' | 'agent';
  text: string;
  source: 'voice' | 'chat' | 'system';
  status: 'streaming' | 'complete';
  created_at?: number;
  // Shared-trip attribution: set on another person's user messages.
  authorId?: string | null;
  authorName?: string | null;
  authorColor?: string | null;
}

export type ActionKind = 'book_flight' | 'book_hotel' | 'book_activity' | 'place_call' | 'rebook';

export interface PendingAction {
  id: string;
  tripId: string;
  nodeId: string | null;
  kind: ActionKind;
  summary: string;
  payload: Record<string, any>;
  status: 'pending' | 'approved' | 'executed' | 'declined' | 'expired';
  resolvedAt: number | null;
  requestedBy?: RequestedBy | null;
}

// A person on a trip (owner or companion), enriched with name + presence color.
export interface RosterMember {
  id: string;
  userId: string | null;
  email: string;
  displayName: string | null;
  role: 'owner' | 'companion';
  canApprove: boolean;
  presenceColor: string;
  status: 'invited' | 'active';
  focusNodeId: string | null;
  lastSeenAt: number | null;
  isYou: boolean;
}

export interface CallTurn {
  speaker: 'waypoint' | 'venue';
  text: string;
  at: number;
}

export interface CallSession {
  id: string;
  tripId: string;
  nodeId: string;
  // Who Waypoint is calling — a venue on the traveler's behalf, or the
  // traveler themselves ("Waypoint Calls You").
  kind: 'to_venue' | 'to_traveler';
  target: string;
  goal: string;
  disclosureLine: string;
  status: 'dialing' | 'connected' | 'in_progress' | 'ended' | 'failed';
  subStatus: string;
  transcript: CallTurn[];
  outcome: string | null;
  consentBasis: string;
  context: Record<string, any>;
  startedAt: number;
  endedAt: number | null;
}

export interface UserLocation {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
  updatedAt: number;
}

export type Gender = 'male' | 'female' | 'lgbtq+';

export interface User {
  id: string;
  email: string | null;
  roles: string[];
  displayName?: string;
  phone?: string;
  homeAirport?: string;
  preferences?: { seat?: 'window' | 'aisle'; nonstopPreferred?: boolean; hotelStyle?: string; notes?: string };
  callConsent?: boolean;
  callConsentAt?: number;
  location?: UserLocation;
  gender?: Gender;
  dateOfBirth?: string;
  hobbies?: string[];
  profession?: string;
  favoriteGames?: string[];
  favoriteMusic?: string[];
  languages?: string[];
  photoUrl?: string;
  profileComplete?: boolean;
  recapOptIn?: boolean;
}

export type LocationScope = 'city' | 'region' | 'country';

export interface NearbyUser {
  id: string;
  displayName: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  gender: Gender | null;
  photoUrl: string | null;
  age: number | null;
  isBirthdayToday: boolean;
  profession: string | null;
  hobbies: string[];
  favoriteGames: string[];
  favoriteMusic: string[];
  languages: string[];
  sharedInterestCount: number;
  recommended: boolean;
  friendStatus: FriendStatus;
  friendRequestId: string | null;
}

export type FriendStatus = 'none' | 'pending_outgoing' | 'pending_incoming' | 'friends';

export interface FriendRequestSummary {
  id: string;
  fromUserId: string;
  displayName: string | null;
  gender: Gender | null;
  photoUrl: string | null;
  createdAt: number;
}

// Every accepted friend, location-independent (unlike NearbyUser's
// friendStatus, which only covers people in the current location scope).
export interface FriendSummary {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  gender: Gender | null;
}

// The public, shareable shape of a finished trip's story — served by the
// one genuinely unauthenticated endpoint in the app (getRecap).
export interface PublicRecap {
  title: string;
  destination: string;
  startDate: number | null;
  endDate: number | null;
  narrative: string;
  disruptionLine: string | null;
  companions: { name: string; color: string }[];
  photoUrls: string[];
}

export interface ConversationSummary {
  id: string;
  type: 'direct' | 'group';
  title: string | null;
  lastMessageAt: number;
  lastMessagePreview: string | null;
  participants: { id: string; displayName: string | null; gender: Gender | null; photoUrl: string | null }[];
}

export interface ConversationParticipant {
  id: string;
  displayName: string | null;
  gender: Gender | null;
  photoUrl: string | null;
  isMe: boolean;
}

export interface TripSuggestion {
  destination: string;
  originCity?: string;
}

export interface FlightOffer {
  id: string;
  source: 'sabre' | 'simulated';
  carrier: string;
  carrierCode: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departAt: number;
  arriveAt: number;
  durationMin: number;
  stops: number;
  priceCents: number;
  fareBrand: string;
  cabin: string;
}

export interface ChatTicket {
  bookingRef: string;
  costCents: number;
  offer: FlightOffer;
  bookedBy: string;
  bookedByName?: string;
}

export interface ConversationMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
  tripSuggestion?: TripSuggestion | null;
  flightOffer?: FlightOffer | null;
  ticket?: ChatTicket | null;
}

// senderId value for a mascot-authored message (trip suggestions) — not a
// real user, so it won't appear in a conversation's participants list.
export const MASCOT_SENDER_ID = 'waypoint-ai';

export interface TrendingPlace {
  name: string;
  category: 'restaurant' | 'cafe' | 'attraction' | 'shop' | 'activity';
  blurb: string;
  lat: number;
  lng: number;
}

export type PostCategory = 'cafe' | 'hangout' | 'events' | 'outdoors' | 'nightlife' | 'art_culture' | 'food';

export interface PostLocation {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
}

// A feed item is the post plus everything the viewer needs to render it —
// author snapshot and viewer-relative like/comment state — same "enriched
// view, not raw row" shape as NearbyUser.
export interface FeedItem {
  id: string;
  userId: string;
  photoUrl: string;
  caption: string;
  category: PostCategory;
  location: PostLocation | null;
  createdAt: number;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  authorName: string | null;
  authorGender: Gender | null;
  authorPhotoUrl: string | null;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: number;
  authorName: string | null;
  authorGender: Gender | null;
  authorPhotoUrl: string | null;
}

// A cost split among a shared trip's companions (Split the Bill). Waypoint
// never moves money — this tracks who owes what and who's settled.
export interface TripExpense {
  id: string;
  tripId: string;
  nodeId: string;
  title: string;
  amountCents: number;
  owedBy: string[];
  paidBy: string[];
  perPersonCents: number;
  status: 'open' | 'settled' | 'removed';
  createdBy: string;
}

export interface TripBundle {
  trip: Trip | null;
  messages: Message[];
  pendingActions: PendingAction[];
  activeCall: CallSession | null;
  roster?: RosterMember[];
  expenses?: TripExpense[];
}

export interface Bootstrap {
  authenticated: boolean;
  user?: User | null;
  trips?: TripSummary[];
  activeTripId?: string | null;
  trip?: Trip | null;
  messages?: Message[];
  pendingActions?: PendingAction[];
  activeCall?: CallSession | null;
  roster?: RosterMember[];
  // The app's shared disposable-inbox address (mail.tm) — forward a
  // confirmation here and it's parsed onto the traveler's board automatically.
  importEmailAddress?: string | null;
  expenses?: TripExpense[];
}

// The live poll result. `changed:false` means the trip is unchanged since the
// caller's version — only the roster (with presence) came back.
export type SyncResult =
  | { changed: false; version: number; roster: RosterMember[] }
  | {
      changed: true;
      version: number;
      roster: RosterMember[];
      trip: Trip;
      messages: Message[];
      pendingActions: PendingAction[];
      activeCall: CallSession | null;
      expenses: TripExpense[];
    };

export interface InviteResult {
  ok: boolean;
  invitePath: string;
  collaboratorId: string;
  email: string;
  tripTitle: string;
  invitedByName: string | null;
  roster: RosterMember[];
}

// Connection credentials minted server-side for a Vocal Bridge voice session
// (shape mirrors the SDK's TokenResponse).
export interface VoiceToken {
  // The live token endpoint returns `livekit_url`; the SDK reads
  // `url || livekit_url`, so either is accepted. Both optional to match reality.
  url?: string;
  livekit_url?: string;
  token: string;
  room_name: string;
  participant_identity: string;
  expires_in: number;
  agent_mode?: string;
}

// Structured stream events emitted by converse / reportDisruption / runCall.
export type StreamEvent =
  | { type: 'status'; text: string }
  | { type: 'trip_created'; trip: Trip }
  | { type: 'ghost'; kind: NodeKind; on: boolean }
  | { type: 'node'; op: 'add' | 'update'; node: TripNode }
  | { type: 'edge'; op: 'add' | 'update' | 'remove'; edge: TripEdge }
  | { type: 'working'; nodeId: string; on: boolean }
  | { type: 'gate'; action: PendingAction }
  | { type: 'call_turn'; turn: CallTurn; subStatus: string; callSessionId: string }
  | { type: 'call_status'; status: CallSession['status']; subStatus: string; outcome?: string; callSessionId: string };
