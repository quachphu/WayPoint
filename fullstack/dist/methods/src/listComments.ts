import { auth } from '@mindstudio-ai/agent';
import { PostComments } from './tables/postComments';
import { Users } from './tables/users';

export async function listComments(input: { postId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const comments = await PostComments.filter((c) => c.postId === input.postId);
  comments.sort((a, b) => a.createdAt - b.createdAt);

  const authorIds = [...new Set(comments.map((c) => c.userId))];
  const authors = authorIds.length ? await Promise.all(authorIds.map((id) => Users.get(id))) : [];
  const authorById = new Map(authors.filter(Boolean).map((u) => [u!.id, u!]));

  return {
    comments: comments.map((c) => {
      const author = authorById.get(c.userId);
      return {
        id: c.id,
        postId: c.postId,
        userId: c.userId,
        text: c.text,
        createdAt: c.createdAt,
        authorName: author?.displayName || null,
        authorGender: author?.gender ?? null,
        authorPhotoUrl: author?.photoUrl || null,
      };
    }),
  };
}
