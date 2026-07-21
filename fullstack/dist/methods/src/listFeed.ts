import { auth } from '@mindstudio-ai/agent';
import { Posts, type PostCategory } from './tables/posts';
import { PostComments } from './tables/postComments';
import { Users } from './tables/users';
import { matchesScope } from './common/locationScope';

const MAX_FEED_ITEMS = 100;

export async function listFeed(input: { scope?: 'city' | 'region' | 'country'; category?: PostCategory; search?: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const me = await Users.get(userId);
  const loc = me?.location;
  const scope = input.scope ?? 'country';
  const q = input.search?.trim().toLowerCase();

  const all = await Posts.filter(() => true);
  const inScope = loc?.country ? all.filter((p) => p.location && matchesScope(p.location, loc, scope)) : all;
  const filtered = inScope
    .filter((p) => !input.category || p.category === input.category)
    .filter((p) => !q || p.caption.toLowerCase().includes(q) || (p.location?.city ?? '').toLowerCase().includes(q))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_FEED_ITEMS);

  const authorIds = [...new Set(filtered.map((p) => p.userId))];
  const authors = authorIds.length ? await Promise.all(authorIds.map((id) => Users.get(id))) : [];
  const authorById = new Map(authors.filter(Boolean).map((u) => [u!.id, u!]));

  const postIds = new Set(filtered.map((p) => p.id));
  const allComments = postIds.size ? await PostComments.filter((c) => postIds.has(c.postId)) : [];
  const commentCountByPost = new Map<string, number>();
  for (const c of allComments) commentCountByPost.set(c.postId, (commentCountByPost.get(c.postId) ?? 0) + 1);

  return {
    scope,
    hasLocation: !!loc?.country,
    items: filtered.map((p) => {
      const author = authorById.get(p.userId);
      return {
        id: p.id,
        userId: p.userId,
        photoUrl: p.photoUrl,
        caption: p.caption,
        category: p.category,
        location: p.location ?? null,
        createdAt: p.createdAt,
        likeCount: p.likedBy?.length ?? 0,
        likedByMe: (p.likedBy ?? []).includes(userId),
        commentCount: commentCountByPost.get(p.id) ?? 0,
        authorName: author?.displayName || null,
        authorGender: author?.gender ?? null,
        authorPhotoUrl: author?.photoUrl || null,
      };
    }),
  };
}
