import { useState } from 'react';
import { api, auth } from '../../lib/api';

export function LoginFlow({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const ready = validEmail && password.length >= 6 && !busy && (mode === 'signin' || consent);

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') await auth.signup(email.trim(), password);
      else await auth.login(email.trim(), password);
      if (consent) {
        try {
          await api.updateProfile({ callConsent: true });
        } catch {
          /* non-fatal */
        }
      }
      // auth.onAuthStateChanged fires in App and swaps to the app shell.
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="welcome auth">
      <div className="welcome-glow" />
      <div className="auth-card">
        <div className="welcome-brand no-select" style={{ marginBottom: 20 }}>
          <img src="/mascot/orb-idle.webp" alt="" width={28} height={28} style={{ objectFit: 'contain' }} />
          Waypoint
        </div>
        <h2 className="auth-title">{mode === 'signin' ? 'Hey, welcome back' : "Let's get you set up"}</h2>
        <p className="auth-sub">
          {mode === 'signin' ? 'Sign in with your email and password.' : 'Create an account with your email and a password.'}
        </p>
        <input
          className="field"
          style={{ height: 48, marginTop: 20 }}
          type="email"
          inputMode="email"
          autoFocus
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="field"
          style={{ height: 48, marginTop: 10 }}
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          placeholder={mode === 'signin' ? 'Password' : 'Password (6+ characters)'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {mode === 'signup' && (
          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span className="consent-box" aria-hidden />
            <span>Waypoint can call airlines, hotels, and venues on my behalf. (required)</span>
          </label>
        )}
        {error && <div className="auth-err">{error}</div>}
        <button className="btn btn--primary" style={{ width: '100%', marginTop: 18 }} disabled={!ready} onClick={submit}>
          {busy ? <span className="spinner" style={{ width: 18, height: 18 }} /> : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <button
          className="auth-link"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError('');
          }}
        >
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
        <button className="auth-link" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
