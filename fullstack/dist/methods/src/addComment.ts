import { auth } from '@mindstudio-ai/agent';
import { Posts } from './tables/posts';
import { PostComments } from './tables/postComments';
import { Users } from './tables/users';

const MAX_COMMENT_LEN = 500;

export async function addComment(input: { postId: string; text: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const text = input.text.trim().slice(0, MAX_COMMENT_LEN);
  if (!text) throw new Error('Comment cannot be empty.');

  const post = await Posts.get(input.postId);
  if (!post) throw new Error('That post no longer exists.');

  const [comment, me] = await Promise.all([
    PostComments.push({ postId: input.postId, userId, text, createdAt: Date.now() } as any),
    Users.get(userId),
  ]);

  return {
    comment: {
      id: comment.id,
      postId: comment.postId,
      userId,
      text: comment.text,
      createdAt: comment.createdAt,
      authorName: me?.displayName || null,
      authorGender: me?.gender ?? null,
      authorPhotoUrl: me?.photoUrl || null,
    },
  };
}
