import { db } from '@mindstudio-ai/agent';

// The unified conversation. A voice utterance and a typed message are the same
// kind of record; source marks origin so the UI can show a mic glyph.
export interface Message {
  tripId: string;
  role: 'user' | 'agent';
  text: string;
  source: 'voice' | 'chat' | 'system';
  status: 'streaming' | 'complete';
  // Who sent it, for shared trips. Only set on user messages; the frontend
  // attributes another person's messages by name + presence color. A message
  // with no author (or authored by the viewer) renders as before.
  authorId?: string;
  authorName?: string;
  authorColor?: string;
}

export const Messages = db.defineTable<Message>('messages');
