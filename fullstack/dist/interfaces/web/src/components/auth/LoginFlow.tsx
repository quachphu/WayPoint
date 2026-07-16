import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { api, auth } from '../../lib/api';

function CodeInput({ onComplete, status }: { onComplete: (code: string) => void; status: 'idle' | 'verifying' | 'error' }) {
  const [vals, setVals] = useState<string[]>(['', '', '', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);
  useEffect(() => {
    if (status === 'error') {
      setVals(['', '', '', '', '', '']);
      const t = setTimeout(() => refs.current[0]?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [status]);

  const commit = (next: string[]) => {
    setVals(next);
    if (next.every((x) => x)) onComplete(next.join(''));
  };

  const onChange = (i: number, raw0: string) => {
    const raw = raw0.replace(/\D/g, '');
    const next = [...vals];
    next[i] = raw.slice(-1);
    if (raw && i < 5) refs.current[i + 1]?.focus();
    commit(next);
  };
  const onKeyDown = (i: number, key: string) => {
    if (key === 'Backspace' && !vals[i] && i > 0) {
      refs.current[i - 1]?.focus();
      const next = [...vals];
      next[i - 1] = '';
      setVals(next);
    }
  };
  const onPaste = (e: ClipboardEvent) => {
    const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!t) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    t.split('').forEach((c, idx) => (next[idx] = c));
    refs.current[Math.min(t.length, 6) - 1]?.focus();
    commit(next);
  };

  return (
    <div className={`code-boxes${status === 'error' ? ' err' : ''}`} onPaste={onPaste}>
      {vals.map((v, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`digit${v ? ' filled' : ''}${status === 'error' ? '' : v ? ' ok-typing' : ''}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={v}
          disabled={status === 'verifying'}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e.key)}
        />
      ))}
    </div>
  );
}

export function LoginFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [vid, setVid] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cstatus, setCStatus] = useState<'idle' | 'verifying' | 'error'>('idle');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const sendCode = async () => {
    if (!validEmail || busy) return;
    setBusy(true);
    setError('');
    try {
      const { verificationId } = await auth.sendEmailCode(email.trim());
      setVid(verificationId);
      setStep('code');
      setCStatus('idle');
      setCooldown(30);
    } catch (e: any) {
      setError(e?.code === 'rate_limited' ? 'Too many attempts. Give it a minute.' : 'Could not send a code to that address.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    setCStatus('verifying');
    setError('');
    try {
      await auth.verifyEmailCode(vid, code);
      if (consent) {
        try {
          await api.updateProfile({ callConsent: true });
        } catch {
          /* non-fatal */
        }
      }
      // auth.onAuthStateChanged fires in App and swaps to the app shell.
    } catch (e: any) {
      setCStatus('error');
      setError(
        e?.code === 'invalid_code'
          ? "That code didn't match. Try again."
          : e?.code === 'verification_expired'
            ? 'That code expired. Send a new one.'
            : e?.code === 'max_attempts_exceeded'
              ? 'Too many tries. Send a new code.'
              : 'Could not verify that code.',
      );
    }
  };

  return (
    <div className="welcome auth">
      <div className="welcome-glow" />
      <div className="auth-card">
        {step === 'email' ? (
          <>
            <div className="welcome-brand no-select" style={{ marginBottom: 20 }}>
              <img src="/mascot/orb-idle.webp" alt="" width={28} height={28} style={{ objectFit: 'contain' }} />
              Waypoint
            </div>
            <h2 className="auth-title">Hey, let's get you in</h2>
            <p className="auth-sub">Sign in or make an account with a code sent to your email.</p>
            <input
              className="field"
              style={{ height: 48, marginTop: 20 }}
              type="email"
              inputMode="email"
              autoFocus
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCode()}
            />
            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="consent-box" aria-hidden />
              <span>Waypoint can call airlines, hotels, and venues on my behalf.</span>
            </label>
            {error && <div className="auth-err">{error}</div>}
            <button className="btn btn--primary" style={{ width: '100%', marginTop: 18 }} disabled={!validEmail || busy} onClick={sendCode}>
              {busy ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Send code'}
            </button>
            <button className="auth-link" onClick={onBack}>
              Back
            </button>
          </>
        ) : (
          <>
            <div className="welcome-brand no-select" style={{ marginBottom: 20 }}>
              <img src="/mascot/orb-idle.webp" alt="" width={28} height={28} style={{ objectFit: 'contain' }} />
              Waypoint
            </div>
            <h2 className="auth-title">Enter your code</h2>
            <p className="auth-sub">
              Sent to {email} ·{' '}
              <button
                className="auth-inline-link"
                onClick={() => {
                  setStep('email');
                  setCStatus('idle');
                  setError('');
                }}
              >
                Edit
              </button>
            </p>
            <div style={{ margin: '24px 0 8px' }}>
              <CodeInput onComplete={verify} status={cstatus} />
            </div>
            <div style={{ minHeight: 22 }}>
              {error ? (
                <div className="auth-err" style={{ textAlign: 'center' }}>
                  {error}
                </div>
              ) : cstatus === 'verifying' ? (
                <div className="auth-sub" style={{ textAlign: 'center' }}>
                  Verifying…
                </div>
              ) : null}
            </div>
            <button className="auth-link" disabled={cooldown > 0} onClick={sendCode} style={{ opacity: cooldown > 0 ? 0.5 : 1 }}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
