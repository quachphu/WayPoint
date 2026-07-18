import { db } from '@mindstudio-ai/agent';

// A direct (1:1) or group chat between users — distinct from the per-trip
// planning chat with the AI agent (see tables/messages.ts). Participant ids
// live directly on the row (schemaless storage), so "conversations for me"
// is just a filter on participantIds.includes(userId).
export interface Conversation {
  type: 'direct' | 'group';
  title?: string; // group chats only; direct chats derive a name client-side
  participantIds: string[];
  createdBy: string;
  lastMessageAt: number;
  lastMessagePreview?: string;
}

export const Conversations = db.defineTable<Conversation>('conversations');
