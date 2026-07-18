import { useRef, useState, type ChangeEvent } from 'react';
import { useStore } from '../../lib/store';
import { api, auth } from '../../lib/api';
import { GENDER_OPTIONS, POPULAR_GAMES, POPULAR_MUSIC, COMMON_LANGUAGES, avatarForUser } from '../../lib/onboardingOptions';
import { resizeImageFile } from '../../lib/imageResize';
import { TagInput, ChipPicker } from '../onboarding/FormWidgets';
import { IconArrowLeft, IconCamera, IconLock, IconTrash } from '../icons';

export function ProfilePage() {
  const profile = useStore((s) => s.profile);
  const goHome = useStore((s) => s.goHome);
  const saveProfile = useStore((s) => s.saveProfile);
  const setProfile = useStore((s) => s.setProfile);
  const pushToast = useStore((s) => s.pushToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile?.displayName ?? '');
  const [dob, setDob] = useState(profile?.dateOfBirth ?? '');
  const [hobbies, setHobbies] = useState<string[]>(profile?.hobbies ?? []);
  const [profession, setProfession] = useState(profile?.profession ?? '');
  const [games, setGames] = useState<string[]>(profile?.favoriteGames ?? []);
  const [music, setMusic] = useState<string[]>(profile?.favoriteMusic ?? []);
  const [languages, setLanguages] = useState<string[]>(profile?.languages ?? []);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(profile?.photoUrl);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const genderLabel = GENDER_OPTIONS.find((g) => g.value === profile?.gender)?.label ?? 'Not set';
  const ready = name.trim().length > 0 && !!dob && hobbies.length > 0 && languages.length > 0 && !busy;

  const pickPhoto = () => fileInputRef.current?.click();

  const onPhotoChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await resizeImageFile(file);
      const { user } = await api.updateProfile({ photoUrl: dataUrl });
      setPhotoUrl(user.photoUrl);
      setProfile(user);
      pushToast('success', 'Photo updated.');
    } catch (err: any) {
      console.error('photo upload failed', err);
      pushToast('danger', err?.message || 'Could not update your photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const clearPhoto = async () => {
    setPhotoBusy(true);
    try {
      const { user } = await api.updateProfile({ photoUrl: null });
      setPhotoUrl(undefined);
      setProfile(user);
    } catch (err: any) {
      console.error('clear photo failed', err);
      pushToast('danger', err?.message || 'Could not remove your photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await saveProfile({
        displayName: name.trim(),
        dateOfBirth: dob,
        hobbies,
        profession: profession.trim() || undefined,
        favoriteGames: games,
        favoriteMusic: music,
        languages,
      });
      pushToast('success', 'Profile updated.');
    } catch (err: any) {
      console.error('profile save failed', err);
      pushToast('danger', err?.message || 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await api.deleteAccount();
      await auth.logout();
    } catch (err: any) {
      console.error('delete account failed', err);
      pushToast('danger', err?.message || 'Could not delete your account.');
      setDeleting(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--canvas)' }}>
      <div className="mx-auto max-w-[820px] px-6 py-8 sm:px-10">
        <button
          onClick={goHome}
          className="font-space mb-6 flex items-center gap-1.5 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text)]"
        >
          <IconArrowLeft size={16} />
          Back
        </button>

        <div className="profile-card">
          <h2 className="auth-title">Your profile</h2>
          <p className="auth-sub">Update anything below — except gender, which is locked once set.</p>

          {/* Photo + locked gender */}
          <div className="onboard-section flex flex-col items-center" style={{ marginTop: 26 }}>
            <img src={avatarForUser({ gender: profile?.gender, photoUrl })} alt="" width={140} height={140} className="onboard-avatar-lg" style={{ width: 140, height: 140 }} />
            <div className="mt-4 flex gap-2">
              <button type="button" className="pill-btn" onClick={pickPhoto} disabled={photoBusy}>
                <IconCamera size={14} />
                {photoUrl ? 'Change photo' : 'Upload photo'}
              </button>
              {photoUrl && (
                <button type="button" className="pill-btn" onClick={clearPhoto} disabled={photoBusy}>
                  <IconTrash size={14} />
                  Remove
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPhotoChosen}
              style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
            />
            <p className="font-space mt-3 flex items-center gap-1.5 text-xs text-[var(--text-3)]">
              <IconLock size={12} />
              Gender: {genderLabel} — can't be changed
            </p>
          </div>

          {/* Name + date of birth, side by side */}
          <div className="onboard-row onboard-section">
            <div>
              <div className="onboard-label">Your name</div>
              <input className="field font-space" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <div className="onboard-label">Date of birth</div>
              <input className="field font-space" type="date" max={today} value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
          </div>

          <div className="onboard-section">
            <div className="onboard-label">Hobbies &amp; interests</div>
            <div className="onboard-hint">Feeds the spots Grok finds near you.</div>
            <TagInput tags={hobbies} onChange={setHobbies} placeholder="e.g. hiking, sushi, live music…" />
          </div>

          <div className="onboard-section">
            <div className="onboard-label">
              Profession <span className="text-[var(--text-3)] font-normal">(optional)</span>
            </div>
            <input className="field font-space" value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="e.g. Software engineer" />
          </div>

          <div className="onboard-section">
            <div className="onboard-label">
              Favorite video games <span className="text-[var(--text-3)] font-normal">(optional)</span>
            </div>
            <ChipPicker options={POPULAR_GAMES} selected={games} onChange={setGames} />
          </div>

          <div className="onboard-section">
            <div className="onboard-label">
              Favorite music &amp; artists <span className="text-[var(--text-3)] font-normal">(optional)</span>
            </div>
            <ChipPicker options={POPULAR_MUSIC} selected={music} onChange={setMusic} />
          </div>

          <div className="onboard-section">
            <div className="onboard-label">Languages you speak</div>
            <ChipPicker options={COMMON_LANGUAGES} selected={languages} onChange={setLanguages} />
          </div>

          <button className="btn btn--primary" style={{ width: '100%', marginTop: 24 }} disabled={!ready} onClick={save}>
            {busy ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Save changes'}
          </button>

          <div className="danger-zone">
            <div className="font-display text-sm font-semibold" style={{ color: 'var(--danger-c)' }}>
              Delete account
            </div>
            <p className="font-space mt-1 text-xs text-[var(--text-2)]">
              Permanently removes your login and profile. This can't be undone.
            </p>
            {!confirmDelete ? (
              <button
                type="button"
                className="font-space mt-3 rounded-lg border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: 'var(--danger-c)', color: 'var(--danger-c)' }}
                onClick={() => setConfirmDelete(true)}
              >
                Delete my account
              </button>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="font-space rounded-lg px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: 'var(--danger-c)' }}
                  onClick={deleteAccount}
                  disabled={deleting}
                >
                  {deleting ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Yes, permanently delete it'}
                </button>
                <button type="button" className="font-space rounded-lg border border-[var(--border-warm)] px-4 py-2 text-sm font-medium" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
