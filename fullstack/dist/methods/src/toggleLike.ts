import { auth } from '@mindstudio-ai/agent';
import { Posts } from './tables/posts';

export async function toggleLike(input: { postId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const post = await Posts.get(input.postId);
  if (!post) throw new Error('That post no longer exists.');

  const likedBy = post.likedBy ?? [];
  const liked = !likedBy.includes(userId);
  const nextLikedBy = liked ? [...likedBy, userId] : likedBy.filter((id) => id !== userId);

  await Posts.update(input.postId, { likedBy: nextLikedBy });
  return { liked, likeCount: nextLikedBy.length };
}
