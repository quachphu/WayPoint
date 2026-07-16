// Shared domain types for Waypoint. The board (nodes + edges) is the derived
// view of the event log; offers are the normalized inventory shape that Sabre
// and the simulated generator both produce.

export type NodeKind = 'flight' | 'hotel' | 'activity' | 'ground';
export type NodeStatus = 'proposed' | 'confirmed' | 'disrupted' | 'failed' | 'cancelled';
export type EdgeMode = 'flight' | 'drive' | 'walk' | 'transit';

// Who asked for something on a shared trip. Stamped on companion-originated
// nodes and pending actions so the "Requested by [name]" chip never loses its
// origin. Null/absent for the owner's own actions (no chip).
export interface RequestedBy {
  userId: string;
  name: string;
  color: string; // presence color hex
}

export interface TripNode {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle?: string;
  start: number | null; // unix ms
  end: number | null; // unix ms
  location: string; // IATA or place label
  status: NodeStatus;
  working: boolean; // transient "agent is working on this"
  bookingRef: string | null;
  costCents: number | null;
  dependsOn: string[];
  detail?: Record<string, any>; // full offer/booking detail for the panel
  requestedBy?: RequestedBy | null; // set when a companion proposed this
}

export interface TripEdge {
  id: string;
  from: string;
  to: string;
  mode: EdgeMode;
  label: string; // "1h 15m flight", "20 min drive"
  state: 'default' | 'working';
}

export type OfferSource = 'sabre' | 'simulated';

export interface FlightOffer {
  id: string;
  source: OfferSource;
  carrier: string;
  carrierCode: string;
  flightNumber: string;
  origin: string; // IATA
  destination: string; // IATA
  departAt: number; // unix ms
  arriveAt: number; // unix ms
  durationMin: number;
  stops: number;
  priceCents: number;
  fareBrand: string;
  cabin: string;
  ttl: number | null; // offer expiry, unix ms
  raw?: Record<string, any>;
}

export interface HotelOffer {
  id: string;
  source: OfferSource;
  name: string;
  neighborhood: string;
  address: string;
  checkIn: number;
  checkOut: number;
  nights: number;
  nightlyCents: number;
  totalCents: number;
  rating: number; // 0-5
  cancellable: boolean;
  raw?: Record<string, any>;
}

export interface ActivitySuggestion {
  id: string;
  name: string;
  category: string;
  neighborhood: string;
  blurb: string;
  suggestedAt: number | null;
  sourceUrl: string | null;
}

// The JSON envelope the orchestrator model returns each turn (hand-rolled tool loop).
export type ToolAction =
  | 'searchFlights'
  | 'searchHotels'
  | 'suggestActivities'
  | 'proposeNode'
  | 'proposeBooking'
  | 'reportDisruption'
  | 'final';

export interface ToolCall {
  thought: string;
  action: ToolAction;
  args: Record<string, any>;
  reply: string | null;
}
