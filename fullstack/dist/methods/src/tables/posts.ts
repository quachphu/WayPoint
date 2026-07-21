import { db } from '@mindstudio-ai/agent';

export type PostCategory = 'cafe' | 'hangout' | 'events' | 'outdoors' | 'nightlife' | 'art_culture' | 'food';

export const POST_CATEGORIES: PostCategory[] = ['cafe', 'hangout', 'events', 'outdoors', 'nightlife', 'art_culture', 'food'];

// A traveler's shared photo — "Posting photos and trip updates is coming
// soon" (see MascotWidget.tsx) is the feature this table backs.
export interface Post {
  userId: string;
  photoUrl: string; // data URI, same self-uploaded pattern as User.photoUrl
  caption: string;
  category: PostCategory;
  // Snapshot of the author's location at post time (same shape as
  // User.location minus updatedAt) — lets the feed scope by city/region/
  // country the same way People Nearby does, without a join back to Users.
  location?: {
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
  };
  likedBy: string[];
  createdAt: number;
}

export const Posts = db.defineTable<Post>('posts');
