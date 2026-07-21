import { db } from '@mindstudio-ai/agent';

export interface PostComment {
  postId: string;
  userId: string;
  text: string;
  createdAt: number;
}

export const PostComments = db.defineTable<PostComment>('post_comments');
