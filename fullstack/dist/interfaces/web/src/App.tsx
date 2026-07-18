import { useEffect, useState } from 'react';
import { auth } from './lib/api';
import { useStore } from './lib/store';
import { Welcome } from './components/Welcome';
import { LoginFlow } from './components/auth/LoginFlow';
import { AppShell } from './components/AppShell';
import { Home } from './components/Home';
import { ConfirmGate } from './components/ConfirmGate';
import { Toasts } from './components/Toasts';
import { MascotWidget } from './components/MascotWidget';
import { ChatDock } from './components/social/ChatDock';
import { ProfileSetup } from './components/onboarding/ProfileSetup';
import { ProfilePage } from './components/profile/ProfilePage';

function CompletingSignIn() {
  return (
    <div className="welcome">
      <div className="welcome-glow" />
      <div className="welcome-inner">
        <span className="spinner" style={{ width: 24, height: 24, color: 'var(--accent-voice)' }} />
        <p className="welcome-sub" style={{ marginTop: 16 }}>Completing sign-in…</p>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="shell">
      <aside className="conv-col" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton" style={{ height: 40, width: '70%', alignSelf: 'flex-end' }} />
        <div className="skeleton" style={{ height: 64, width: '85%' }} />
        <div className="skeleton" style={{ height: 40, width: '55%', alignSelf: 'flex-end' }} />
      </aside>
      <main className="board-zone">
        <div className="titlebar">
          <div className="skeleton" style={{ height: 24, width: 200 }} />
        </div>
        <div
          className="board-canvas-wrap"
          style={{ backgroundImage: 'radial-gradient(var(--border-strong) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
        >
          <div className="skeleton" style={{ position: 'absolute', top: 80, left: 80, width: 236, height: 76 }} />
          <div className="skeleton" style={{ position: 'absolute', top: 200, left: 440, width: 236, height: 76 }} />
        </div>
      </main>
    </div>
  );
}

// Capture an invite token from a /join/:token link once, before anything
// navigates. Claimed after sign-in; the URL is cleaned afterward.
function readInviteToken(): string | null {
  const m = window.location.pathname.match(/^\/join\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [status, setStatus] = useState(auth.authStatus);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingClaim, setPendingClaim] = useState<string | null>(readInviteToken);
  const bootstrap = useStore((s) => s.bootstrap);
  const setTheme = useStore((s) => s.setTheme);
  const loading = useStore((s) => s.loading);
  const profile = useStore((s) => s.profile);
  const view = useStore((s) => s.view);
  const activeTripId = useStore((s) => s.activeTripId);
  const pollSync = useStore((s) => s.pollSync);
  const claimByToken = useStore((s) => s.claimByToken);

  // A pending invite nudges a logged-out visitor straight to sign-in.
  useEffect(() => {
    if (pendingClaim && !user) setShowLogin(true);
  }, [pendingClaim, user]);

  // Initialize theme from system preference.
  useEffect(() => {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    setTheme(dark ? 'dark' : 'light');
  }, [setTheme]);

  useEffect(
    () =>
      auth.onAuthStateChanged(() => {
        setUser(auth.currentUser);
        setStatus(auth.authStatus);
      }),
    [],
  );

  // Hydrate the store once we have an authenticated user, then claim any
  // pending invite by token (the email-match path already ran inside bootstrap).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      await bootstrap();
      if (cancelled) return;
      if (pendingClaim) {
        await claimByToken(pendingClaim);
        setPendingClaim(null);
        // Clean the /join/:token out of the URL.
        window.history.replaceState({}, '', '/');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Live sync + presence: poll while a trip is open and the tab is focused.
  useEffect(() => {
    if (!user || !activeTripId) return;
    const tick = () => {
      if (!document.hidden) pollSync();
    };
    const id = window.setInterval(tick, 4000);
    // Catch up immediately when the tab regains focus.
    const onVis = () => {
      if (!document.hidden) pollSync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeTripId]);

  if (status === 'authenticating') return <CompletingSignIn />;
  if (!user) {
    return showLogin ? <LoginFlow onBack={() => setShowLogin(false)} /> : <Welcome onStart={() => setShowLogin(true)} />;
  }

  if (!loading && profile && !profile.profileComplete) {
    return (
      <>
        <ProfileSetup />
        <Toasts />
      </>
    );
  }

  return (
    <>
      {loading ? <ShellSkeleton /> : view === 'home' ? <Home /> : view === 'profile' ? <ProfilePage /> : <AppShell />}
      <ConfirmGate />
      <Toasts />
      <ChatDock />
      <MascotWidget />
    </>
  );
}
