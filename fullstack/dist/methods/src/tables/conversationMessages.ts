import { db } from '@mindstudio-ai/agent';
import type { FlightOffer } from '../common/types';

export interface ConversationMessage {
  conversationId: string;
  senderId: string; // a real userId, or MASCOT_SENDER_ID for a mascot-authored suggestion
  text: string;
  // Present only on a mascot-authored trip suggestion — lets the client
  // render a "Plan this trip" button instead of a plain bubble.
  tripSuggestion?: {
    destination: string;
    originCity?: string;
  };
  // A presented flight option — the client renders this as a bookable card.
  flightOffer?: FlightOffer;
  // The result of booking a flightOffer message — the client renders this as
  // a ticket with a real QR code (encoding the confirmation code + flight).
  ticket?: {
    bookingRef: string;
    costCents: number;
    offer: FlightOffer;
    bookedBy: string; // userId who tapped "Book this flight" — everyone in the chat still sees it
  };
}

export const MASCOT_SENDER_ID = 'waypoint-ai';

export const ConversationMessages = db.defineTable<ConversationMessage>('conversation_messages');
