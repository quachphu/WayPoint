import { useState } from 'react';
import { useStore } from '../../lib/store';
import { api } from '../../lib/api';
import { GENDER_OPTIONS, POPULAR_GAMES, POPULAR_MUSIC, COMMON_LANGUAGES } from '../../lib/onboardingOptions';
import { GenderPicker, TagInput, ChipPicker } from './FormWidgets';
import { LearningScreen } from './LearningScreen';
import type { Gender, User } from '../../lib/types';

export function ProfileSetup() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const [learning, setLearning] = useState<{ user: User; welcomeMessage: string } | null>(null);

  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [dob, setDob] = useState(profile?.dateOfBirth ?? '');
  const [hobbies, setHobbies] = useState<string[]>(profile?.hobbies ?? []);
  const [profession, setProfession] = useState(profile?.profession ?? '');
  const [games, setGames] = useState<string[]>(profile?.favoriteGames ?? []);
  const [customGames, setCustomGames] = useState<string[]>([]);
  const [music, setMusic] = useState<string[]>(profile?.favoriteMusic ?? []);
  const [customMusic, setCustomMusic] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(profile?.languages ?? []);
  const [customLanguages, setCustomLanguages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const ready = !!gender && name.trim().length > 0 && !!dob && hobbies.length > 0 && languages.length > 0 && !busy;

  // Deliberately bypasses the store's saveProfile (which would sync `profile`
  // immediately and flip App.tsx over to Home right away) — we want the
  // "getting to know you" animation to play out first, and only then land
  // on Home, so completing the form doesn't just abruptly redirect.
  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      const { user, welcomeMessage } = await api.updateProfile({
        gender: gender!,
        displayName: name.trim(),
        dateOfBirth: dob,
        hobbies,
        profession: profession.trim() || undefined,
        favoriteGames: [...games, ...customGames],
        favoriteMusic: [...music, ...customMusic],
        languages: [...languages, ...customLanguages],
        profileComplete: true,
      });
      setLearning({ user, welcomeMessage: welcomeMessage || `Loved learning a bit about you, ${user.displayName?.split(' ')[0] || 'traveler'}.` });
    } catch (err: any) {
      console.error('profile setup failed', err);
      setError(err?.message || 'Something went wrong saving your profile. Try again.');
      setBusy(false);
    }
  };

  if (learning) {
    return <LearningScreen welcomeMessage={learning.welcomeMessage} onDone={() => setProfile(learning.user)} />;
  }

  return (
    <div className="welcome auth">
      <div className="welcome-glow" />
      <div className="onboard-card">
        <div className="welcome-brand no-select" style={{ marginBottom: 12 }}>
          <img src="/mascot/orb-idle.webp" alt="" width={28} height={28} style={{ objectFit: 'contain' }} />
          Waypoint
        </div>
        <h2 className="auth-title">Let's set up your profile</h2>
        <p className="auth-sub">This is how other travelers will find and connect with you. Only your name and general area are ever shown publicly.</p>

        {/* Gender / identity — one big avatar preview that swaps with the dropdown choice. No boxed panel here, just centered on the card. */}
        <div className="flex flex-col items-center" style={{ marginTop: 28, marginBottom: 8 }}>
          <img
            key={gender ?? 'none'}
            src={gender ? GENDER_OPTIONS.find((g) => g.value === gender)!.avatar : '/mascot/orb-idle.webp'}
            alt=""
            width={168}
            height={168}
            className="onboard-avatar-lg"
          />
          <div className="onboard-label mt-5 mb-2 justify-center">I am…</div>
          <div className="w-[220px]">
            <GenderPicker value={gender} onChange={setGender} />
          </div>
          <p className="font-space mt-2 text-center text-xs text-[var(--text-3)]">Can't be changed later — choose carefully.</p>
        </div>

        {/* Name + date of birth, side by side */}
        <div className="onboard-row onboard-section">
          <div>
            <div className="onboard-label">Your name</div>
            <div className="onboard-hint">Real names help people recognize you faster.</div>
            <input className="field font-space" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <div className="onboard-label">Date of birth</div>
            <div className="onboard-hint">Shown as your age. Unlocks a birthday surprise every year.</div>
            <input className="field font-space" type="date" max={today} value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
        </div>

        {/* Hobbies */}
        <div className="onboard-section">
          <div className="onboard-label">Hobbies &amp; interests</div>
          <div className="onboard-hint">Press Enter to add. We'll use these to find spots near you that fit your vibe.</div>
          <TagInput tags={hobbies} onChange={setHobbies} placeholder="e.g. hiking, sushi, live music…" />
        </div>

        {/* Profession (optional) */}
        <div className="onboard-section">
          <div className="onboard-label">Profession <span className="text-[var(--text-3)] font-normal">(optional)</span></div>
          <input className="field font-space" value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="e.g. Software engineer" />
        </div>

        {/* Favorite games (optional) */}
        <div className="onboard-section">
          <div className="onboard-label">Favorite video games <span className="text-[var(--text-3)] font-normal">(optional)</span></div>
          <div className="onboard-hint">Helps us flag travelers nearby who game like you do.</div>
          <ChipPicker options={POPULAR_GAMES} selected={games} onChange={setGames} />
          <div className="mt-2">
            <TagInput tags={customGames} onChange={setCustomGames} placeholder="Don't see it? Add your own…" />
          </div>
        </div>

        {/* Favorite music (optional) */}
        <div className="onboard-section">
          <div className="onboard-label">Favorite music &amp; artists <span className="text-[var(--text-3)] font-normal">(optional)</span></div>
          <ChipPicker options={POPULAR_MUSIC} selected={music} onChange={setMusic} />
          <div className="mt-2">
            <TagInput tags={customMusic} onChange={setCustomMusic} placeholder="Don't see it? Add your own…" />
          </div>
        </div>

        {/* Languages */}
        <div className="onboard-section">
          <div className="onboard-label">Languages you speak</div>
          <ChipPicker options={COMMON_LANGUAGES} selected={languages} onChange={setLanguages} />
          <div className="mt-2">
            <TagInput tags={customLanguages} onChange={setCustomLanguages} placeholder="Don't see it? Add your own…" />
          </div>
        </div>

        {error && <div className="auth-err">{error}</div>}

        <button className="btn btn--primary" style={{ width: '100%', marginTop: 24 }} disabled={!ready} onClick={submit}>
          {busy ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Finish setting up'}
        </button>
      </div>
    </div>
  );
}
