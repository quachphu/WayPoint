import { createClient, platform, auth, analytics, type InvokeOptions } from './msclient';
import type {
  Bootstrap,
  TripBundle,
  Trip,
  TripSummary,
  User,
  SyncResult,
  RosterMember,
  InviteResult,
  VoiceToken,
  LocationScope,
  NearbyUser,
  ConversationSummary,
  ConversationParticipant,
  ConversationMessage,
  TrendingPlace,
  FriendRequestSummary,
  PostCategory,
  FeedItem,
  PostComment,
} from './types';

type Opts = InvokeOptions;

export const api = createClient<{
  getBootstrap(): Promise<Bootstrap>;
  listTrips(): Promise<{ trips: TripSummary[] }>;
  getTrip(input: { tripId: string }): Promise<TripBundle>;
  createTrip(input: { text?: string }): Promise<{ trip: Trip }>;
  updateProfile(input: {
    displayName?: string;
    homeAirport?: string;
    phone?: string;
    preferences?: User['preferences'];
    callConsent?: boolean;
    gender?: User['gender'];
    dateOfBirth?: string;
    hobbies?: string[];
    profession?: string;
    favoriteGames?: string[];
    favoriteMusic?: string[];
    languages?: string[];
    photoUrl?: string | null;
    profileComplete?: boolean;
    recapOptIn?: boolean;
  }): Promise<{ user: User; welcomeMessage?: string }>;
  deleteAccount(): Promise<{ ok: boolean }>;
  textToSpeech(input: { text: string }): Promise<{ audioDataUrl: string | null }>;
  converse(
    input: { tripId?: string; text: string; source?: 'voice' | 'chat'; focusNodeId?: string | null },
    opts?: Opts,
  ): Promise<{ tripId: string; created: boolean; reply: string; version: number; trip: Trip }>;
  approveAction(
    input: { actionId: string },
    opts?: Opts,
  ): Promise<{ ok: boolean; kind: string; callSessionId?: string; tripId: string; version?: number; trip?: Trip; expenses?: import('./types').TripExpense[] }>;
  declineAction(input: { actionId: string }): Promise<{ ok: boolean; actionId: string }>;
  reportDisruption(
    input: { tripId: string; nodeId?: string; description?: string },
    opts?: Opts,
  ): Promise<{ ok: boolean; message: string; tripId: string; version: number; trip: Trip }>;
  getVoiceToken(): Promise<{ enabled: boolean; token?: VoiceToken }>;
  importDocument(
    input: { tripId?: string; fileDataUrl: string; fileName: string },
    opts?: Opts,
  ): Promise<{ ok: boolean; tripId: string | null; reply: string; needsClarification: boolean; importId?: string }>;
  resolveImport(
    input: { importId: string; answer: string },
    opts?: Opts,
  ): Promise<{ ok: boolean; tripId: string | null; reply: string; needsClarification: boolean; importId?: string }>;
  checkImportInbox(): Promise<{ imported: number }>;
  runCall(
    input: { tripId: string; callSessionId: string },
    opts?: Opts,
  ): Promise<{ ok: boolean; outcome: string; callSessionId: string; actionId: string | null; tripId: string; version: number }>;
  answerTravelerCall(input: { callSessionId: string }, opts?: Opts): Promise<{ ok: boolean; outcome: string }>;
  declineTravelerCall(input: { callSessionId: string }): Promise<{ ok: boolean }>;
  markExpensePaid(input: { expenseId: string }): Promise<{ ok: boolean; expense: import('./types').TripExpense }>;
  getNodeWalletFiles(input: { tripId: string; nodeId: string }): Promise<{ icsDataUrl: string; passPreviewDataUrl: string }>;
  // Shared trips
  createInvite(input: { tripId: string; email: string }): Promise<InviteResult>;
  claimInvite(input: { inviteToken: string }): Promise<TripBundle & { ok: boolean; tripId: string; roster: RosterMember[] }>;
  syncTrip(input: { tripId: string; sinceVersion?: number; focusNodeId?: string | null }): Promise<SyncResult>;
  setApproval(input: { tripId: string; collaboratorId: string; canApprove: boolean }): Promise<{ ok: boolean; roster: RosterMember[] }>;
  removeCollaborator(input: { tripId: string; collaboratorId: string }): Promise<{ ok: boolean; roster: RosterMember[] }>;
  // People nearby + direct/group messaging
  setLocation(input: {
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
  }): Promise<{ user: User }>;
  listNearbyUsers(input: { scope: LocationScope }): Promise<{ scope: LocationScope; hasLocation: boolean; users: NearbyUser[] }>;
  startConversation(input: { userIds: string[]; title?: string }): Promise<{ conversation: ConversationSummary }>;
  listConversations(): Promise<{ conversations: ConversationSummary[] }>;
  getConversation(input: {
    conversationId: string;
  }): Promise<{ conversation: { id: string; type: 'direct' | 'group'; title: string | null; participants: ConversationParticipant[] }; messages: ConversationMessage[] }>;
  sendDirectMessage(input: { conversationId: string; text: string }): Promise<{ message: ConversationMessage; suggestionMessage?: ConversationMessage | null }>;
  sendFriendRequest(input: { toUserId: string }): Promise<{ request: { id: string; status: string } }>;
  respondToFriendRequest(input: { requestId: string; accept: boolean }): Promise<{ request: { id: string; status: string } }>;
  listFriendRequests(): Promise<{ requests: FriendRequestSummary[] }>;
  listFriends(): Promise<{ friends: import('./types').FriendSummary[] }>;
  askMascot(input: { text: string }): Promise<{ intent: 'plan_trip' | 'chat'; reply: string; seedText: string | null }>;
  getRecap(input: { token: string }): Promise<{ recap: import('./types').PublicRecap | null }>;
  searchTripOptionsInChat(input: { conversationId: string; destination: string; originCity?: string }): Promise<{ messages: ConversationMessage[] }>;
  bookFlightFromChat(input: { conversationId: string; messageId: string }): Promise<{ message: ConversationMessage }>;
  getTrendingPlaces(input: { city?: string; region?: string; country?: string; lat: number; lng: number }): Promise<{ places: TrendingPlace[]; scanned: boolean; freshlyScanned?: boolean; added?: number }>;
  // Social feed — posting photos/trip updates
  createPost(input: { photoUrl: string; caption?: string; category: PostCategory }): Promise<{ post: FeedItem }>;
  listFeed(input?: { scope?: LocationScope; category?: PostCategory; search?: string }): Promise<{ scope: LocationScope; hasLocation: boolean; items: FeedItem[] }>;
  toggleLike(input: { postId: string }): Promise<{ liked: boolean; likeCount: number }>;
  addComment(input: { postId: string; text: string }): Promise<{ comment: PostComment }>;
  listComments(input: { postId: string }): Promise<{ comments: PostComment[] }>;
  deletePost(input: { postId: string }): Promise<{ ok: boolean }>;
}>();

export { platform, auth, analytics };
