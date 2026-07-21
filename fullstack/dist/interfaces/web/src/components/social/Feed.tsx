import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useStore } from '../../lib/store';
import { api } from '../../lib/api';
import { resizeImageFile } from '../../lib/imageResize';
import { avatarForUser } from '../../lib/onboardingOptions';
import { IconCamera, IconHeart, IconHeartFilled, IconLoader2, IconMapPin, IconMessage2, IconPlus, IconSearch, IconX } from '../icons';
import type { FeedItem, PostCategory, PostComment } from '../../lib/types';

const CATEGORIES: { value: PostCategory; label: string; emoji: string }[] = [
  { value: 'cafe', label: 'Cafe', emoji: '☕' },
  { value: 'hangout', label: 'Hangout', emoji: '🎉' },
  { value: 'events', label: 'Events', emoji: '📅' },
  { value: 'outdoors', label: 'Outdoors', emoji: '🌤️' },
  { value: 'nightlife', label: 'Nightlife', emoji: '🌃' },
  { value: 'art_culture', label: 'Art & Culture', emoji: '🎨' },
  { value: 'food', label: 'Food', emoji: '🍽️' },
];
const CATEGORY_LABEL: Record<PostCategory, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])) as any;
const CATEGORY_EMOJI: Record<PostCategory, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.emoji])) as any;

// Client-side longest-edge cap for a feed photo — bigger than a profile
// avatar (480px) since these get shown large in the feed, still small
// enough to keep a data-URI row from ballooning.
const POST_PHOTO_MAX_DIM = 1080;

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString();
}

function friendlyName(name: string | null): string {
  return name || 'A fellow traveler';
}

function Composer({ onPosted, onCancel }: { onPosted: (post: FeedItem) => void; onCancel: () => void }) {
  const pushToast = useStore((s) => s.pushToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<PostCategory>('hangout');
  const [busy, setBusy] = useState(false);

  const onPhotoChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await resizeImageFile(file, POST_PHOTO_MAX_DIM));
    } catch (err: any) {
      pushToast('danger', err?.message || 'Could not read that photo.');
    }
  };

  const submit = async () => {
    if (!photo || busy) return;
    setBusy(true);
    try {
      const { post } = await api.createPost({ photoUrl: photo, caption, category });
      onPosted(post);
    } catch (err: any) {
      pushToast('danger', err?.message || 'Could not share that post.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-[var(--border-warm)] p-4" style={{ background: 'var(--surface)' }}>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onPhotoChosen} style={{ display: 'none' }} />
      {photo ? (
        <div className="relative mb-3 overflow-hidden rounded-xl">
          <img src={photo} alt="" className="max-h-72 w-full object-cover" />
          <button
            onClick={() => setPhoto(null)}
            className="icon-btn absolute right-2 top-2"
            style={{ background: 'var(--surface)' }}
            aria-label="Remove photo"
          >
            <IconX size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="font-space mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-warm)] py-8 text-sm text-[var(--text-2)] transition-colors duration-150 hover:border-[var(--live)]"
        >
          <IconCamera size={18} />
          Add a photo
        </button>
      )}
      <textarea
        className="field font-space w-full text-sm"
        rows={2}
        placeholder="What's happening here?"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`chip ${category === c.value ? 'selected' : ''}`}
            onClick={() => setCategory(c.value)}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="font-space rounded-full px-4 py-2 text-sm text-[var(--text-2)]">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!photo || busy}
          className="font-display flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
          style={{ background: 'var(--live)' }}
        >
          {busy && <IconLoader2 size={14} className="animate-spin" />}
          Post
        </button>
      </div>
    </div>
  );
}

function CommentThread({ postId }: { postId: string }) {
  const pushToast = useStore((s) => s.pushToast);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listComments({ postId })
      .then((res) => !cancelled && setComments(res.comments))
      .catch((err) => console.error('listComments failed', err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const { comment } = await api.addComment({ postId, text: trimmed });
      setComments((prev) => [...prev, comment]);
      setText('');
    } catch (err: any) {
      pushToast('danger', err?.message || 'Could not send that comment.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-[var(--border-warm)] px-4 py-3">
      {loading ? (
        <p className="font-space text-xs text-[var(--text-3)]">Loading comments…</p>
      ) : (
        <div className="mb-2 flex flex-col gap-2">
          {comments.length === 0 && <p className="font-space text-xs text-[var(--text-3)]">No comments yet.</p>}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <img src={avatarForUser({ gender: c.authorGender, photoUrl: c.authorPhotoUrl })} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
              <div className="font-space text-xs text-[var(--text-2)]">
                <span className="font-semibold text-[var(--text)]">{friendlyName(c.authorName)}</span> {c.text}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          className="field font-space flex-1 text-xs"
          placeholder="Add a comment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={sending}
        />
        <button onClick={send} disabled={!text.trim() || sending} className="icon-btn" style={{ color: 'var(--live)' }} aria-label="Send comment">
          {sending ? <IconLoader2 size={16} className="animate-spin" /> : <IconMessage2 size={16} />}
        </button>
      </div>
    </div>
  );
}

function PostCard({ item, onLikeToggled }: { item: FeedItem; onLikeToggled: (postId: string, liked: boolean, likeCount: number) => void }) {
  const pushToast = useStore((s) => s.pushToast);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const toggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    try {
      const { liked, likeCount } = await api.toggleLike({ postId: item.id });
      onLikeToggled(item.id, liked, likeCount);
    } catch (err: any) {
      pushToast('danger', err?.message || 'Could not update that like.');
    } finally {
      setLikeBusy(false);
    }
  };

  const locationLine = [item.location?.city, item.location?.region].filter(Boolean).join(', ');

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-warm)]" style={{ background: 'var(--surface)' }}>
      <div className="flex items-center gap-2.5 px-4 py-3">
        <img src={avatarForUser({ gender: item.authorGender, photoUrl: item.authorPhotoUrl })} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <div className="font-space truncate text-sm font-medium text-[var(--text)]">{friendlyName(item.authorName)}</div>
          <div className="font-space flex items-center gap-1 truncate text-xs text-[var(--text-3)]">
            {timeAgo(item.createdAt)}
            {locationLine && (
              <>
                <IconMapPin size={10} />
                {locationLine}
              </>
            )}
          </div>
        </div>
        <span className="font-space shrink-0 text-xs text-[var(--text-3)]">
          {CATEGORY_EMOJI[item.category]} {CATEGORY_LABEL[item.category]}
        </span>
      </div>
      <img src={item.photoUrl} alt="" className="aspect-[4/3] w-full object-cover" />
      {item.caption && <p className="font-space px-4 pt-3 text-sm text-[var(--text)]">{item.caption}</p>}
      <div className="flex items-center gap-4 px-4 py-3">
        <button onClick={toggleLike} className="flex items-center gap-1.5 text-sm text-[var(--text-2)]" aria-label={item.likedByMe ? 'Unlike' : 'Like'}>
          {item.likedByMe ? <IconHeartFilled size={18} style={{ color: 'var(--live)' }} /> : <IconHeart size={18} />}
          {item.likeCount}
        </button>
        <button onClick={() => setCommentsOpen((o) => !o)} className="flex items-center gap-1.5 text-sm text-[var(--text-2)]">
          <IconMessage2 size={18} />
          {item.commentCount}
        </button>
      </div>
      {commentsOpen && <CommentThread postId={item.id} />}
    </div>
  );
}

export function Feed() {
  const pushToast = useStore((s) => s.pushToast);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLocation, setHasLocation] = useState(true);
  const [category, setCategory] = useState<PostCategory | null>(null);
  const [search, setSearch] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .listFeed({ category: category ?? undefined, search: search.trim() || undefined })
      .then((res) => {
        setItems(res.items);
        setHasLocation(res.hasLocation);
      })
      .catch((err) => console.error('listFeed failed', err))
      .finally(() => setLoading(false));
  };

  useEffect(load, [category]);

  useEffect(() => {
    const id = window.setTimeout(load, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-lg font-semibold text-[var(--text)]">What's happening nearby</span>
        <button
          onClick={() => setComposerOpen((o) => !o)}
          className="font-space flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
          style={{ background: 'var(--live)' }}
        >
          <IconPlus size={16} />
          Post
        </button>
      </div>

      {composerOpen && (
        <Composer
          onCancel={() => setComposerOpen(false)}
          onPosted={(post) => {
            setItems((prev) => [post, ...prev]);
            setComposerOpen(false);
            pushToast('success', 'Posted!');
          }}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1" style={{ minWidth: 180 }}>
          <IconSearch size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            className="field font-space w-full text-sm"
            style={{ paddingLeft: 34 }}
            placeholder="Search a place or vibe…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button className={`chip ${category === null ? 'selected' : ''}`} onClick={() => setCategory(null)}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.value} className={`chip ${category === c.value ? 'selected' : ''}`} onClick={() => setCategory(c.value)}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {!hasLocation && !loading && (
        <p className="font-space text-sm text-[var(--text-3)]">Turn on location access to see what's happening near you.</p>
      )}
      {hasLocation && !loading && items.length === 0 && (
        <p className="font-space text-sm text-[var(--text-3)]">Nothing posted from here yet — be the first to share something.</p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <PostCard
            key={item.id}
            item={item}
            onLikeToggled={(postId, liked, likeCount) =>
              setItems((prev) => prev.map((p) => (p.id === postId ? { ...p, likedByMe: liked, likeCount } : p)))
            }
          />
        ))}
      </div>
    </div>
  );
}
