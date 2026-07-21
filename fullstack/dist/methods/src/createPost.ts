import { auth } from '@mindstudio-ai/agent';
import { Posts, POST_CATEGORIES, type PostCategory } from './tables/posts';
import { Users } from './tables/users';

const MAX_CAPTION_LEN = 500;

export async function createPost(input: { photoUrl: string; caption?: string; category: PostCategory }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  if (!input.photoUrl) throw new Error('A photo is required.');
  if (!POST_CATEGORIES.includes(input.category)) throw new Error('Not a valid category.');

  const me = await Users.get(userId);
  const post = await Posts.push({
    userId,
    photoUrl: input.photoUrl,
    caption: (input.caption ?? '').trim().slice(0, MAX_CAPTION_LEN),
    category: input.category,
    location: me?.location
      ? {
          city: me.location.city,
          region: me.location.region,
          country: me.location.country,
          countryCode: me.location.countryCode,
          lat: me.location.lat,
          lng: me.location.lng,
        }
      : undefined,
    likedBy: [],
    createdAt: Date.now(),
  } as any);

  return {
    post: {
      id: post.id,
      userId,
      photoUrl: post.photoUrl,
      caption: post.caption,
      category: post.category,
      location: post.location ?? null,
      createdAt: post.createdAt,
      likeCount: 0,
      likedByMe: false,
      commentCount: 0,
      authorName: me?.displayName || null,
      authorGender: me?.gender ?? null,
      authorPhotoUrl: me?.photoUrl || null,
    },
  };
}
