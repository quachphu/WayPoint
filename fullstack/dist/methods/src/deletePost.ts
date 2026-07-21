import { auth } from '@mindstudio-ai/agent';
import { Posts } from './tables/posts';
import { PostComments } from './tables/postComments';

export async function deletePost(input: { postId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const post = await Posts.get(input.postId);
  if (!post) return { ok: true };
  if (post.userId !== userId) throw new Error('Only the author can delete this post.');

  const comments = await PostComments.filter((c) => c.postId === input.postId);
  await Promise.all(comments.map((c) => PostComments.remove(c.id)));
  await Posts.remove(input.postId);
  return { ok: true };
}
