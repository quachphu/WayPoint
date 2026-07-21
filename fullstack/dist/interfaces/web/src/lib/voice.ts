// Voice engine with two backing paths behind one small interface, so the UI is
// identical regardless of the engine:
//
//  1. Vocal Bridge (preferred) — full-duplex agent voice. The backend mints a
//     short-lived connection token (the browser never sees the API key), the
//     Vocal Bridge agent handles STT/TTS and turn-taking, and hands each user
//     query to our orchestrator via the AI-agent query channel, so voice and
//     chat run through the exact same converse pipeline
//     (docs/03_API_INTEGRATION.md §2.2–2.5).
//  2. Web Speech API — browser-native fallback when the integration isn't
//     configured or the connection fails, so voice still completes.
//
// Degrades cleanly to text when neither is available (e.g. the preview iframe).

import { VocalBridge, ConnectionState, type TokenResponse } from '@vocalbridgeai/sdk';

// 'connecting' is distinct from 'ready' — 'ready' is the passive, pre-tap
// "breathing" invite state (front door), while 'connecting' is what fires
// the instant a tap starts a Vocal Bridge session, so there's always a
// visible reaction to the tap instead of a beat where nothing on screen
// changes and the orb reads as frozen.
export type VoiceState = 'idle' | 'ready' | 'connecting' | 'listening' | 'speaking';

type StateCb = (s: VoiceState) => void;
type ResultCb = (text: string) => void;
type QueryCb = (text: string) => Promise<string>;
// The live token endpoint returns `livekit_url` (the SDK's `url` is optional in
// practice), so accept either and normalize before handing it to the SDK.
type MintedToken = Omit<TokenResponse, 'url'> & { url?: string; livekit_url?: string };
type TokenMint = () => Promise<{ enabled: boolean; token?: MintedToken }>;

class VoiceEngine {
  private recognition: any = null;
  private synth: SpeechSynthesis | null = null;
  private state: VoiceState = 'idle';
  private wantListening = false;
  private vb: VocalBridge | null = null;
  private mintToken: TokenMint | null = null;
  private vbDisabled = false; // set once the token endpoint or connect says no
  private speakTimer: number | null = null;
  // Guards against two overlapping startVocalBridge() calls (e.g. the front-
  // door orb and another voice trigger tapped close together) — without
  // this, a second call could hit its own failure and null out `this.vb`
  // while the first call was still `await`ing connect(), so the first call's
  // very next line (`this.vb.setMicrophoneEnabled`) threw on a null `this.vb`
  // even though its own connection had just succeeded.
  private vbConnecting: Promise<boolean> | null = null;
  // True only when the traveler explicitly pressed the orb to mute — NOT
  // while the SDK transiently mutes the mic during TTS playback to avoid
  // echo. Only this flag should ever stop the mic from re-arming itself;
  // otherwise every agent reply would leave the conversation dead until the
  // traveler clicks again, defeating hands-free back-and-forth entirely.
  private userMuted = false;
  // Both Vocal Bridge (WebRTC getUserMedia) and the Web Speech fallback need a
  // secure context — browsers block the mic on plain http://<lan-ip>. Served
  // over http://localhost or https this is true; over a raw LAN IP it's false,
  // which is the #1 reason "voice does nothing" on someone else's machine.
  private secure = true;
  onStateChange: StateCb | null = null;
  onResult: ResultCb | null = null; // browser path: recognized text → store.send
  onQuery: QueryCb | null = null; // vocal bridge path: agent query → reply text
  recognitionSupported = false;
  speechSupported = false;

  constructor() {
    if (typeof window === 'undefined') return;
    this.secure = window.isSecureContext !== false;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.speechSupported = 'speechSynthesis' in window;
    this.synth = this.speechSupported ? window.speechSynthesis : null;
    if (SR) {
      this.recognitionSupported = true;
      const r = new SR();
      r.continuous = false;
      r.interimResults = false;
      r.lang = 'en-US';
      r.onresult = (e: any) => {
        const text = Array.from(e.results)
          .map((res: any) => res[0]?.transcript || '')
          .join(' ')
          .trim();
        if (text) this.onResult?.(text);
      };
      r.onend = () => {
        this.wantListening = false;
        this.setState('idle');
      };
      r.onerror = () => {
        this.wantListening = false;
        this.setState('idle');
      };
      this.recognition = r;
    }
  }

  // Wire the backend token minter. Until this is called (post-auth), only the
  // browser path is considered.
  configureVocalBridge(mint: TokenMint) {
    this.mintToken = mint;
  }

  // Whether pressing the orb can do anything at all. On an insecure origin the
  // mic is blocked for every engine, so neither path can run.
  get available(): boolean {
    if (!this.secure) return false;
    return this.recognitionSupported || (!this.vbDisabled && !!this.mintToken);
  }

  // Why the orb can't do anything, so the UI can give an actionable message
  // instead of a generic "voice needs a mic".
  get unavailableReason(): 'insecure' | 'unsupported' | null {
    if (this.available) return null;
    if (!this.secure) return 'insecure';
    return 'unsupported';
  }

  private vbActive(): boolean {
    return !!this.vb && this.vb.state !== ConnectionState.Disconnected;
  }

  private setState(s: VoiceState) {
    this.state = s;
    this.onStateChange?.(s);
  }

  getState() {
    return this.state;
  }

  ready(on: boolean) {
    if (this.state === 'listening' || this.state === 'speaking') return;
    this.setState(on ? 'ready' : 'idle');
  }

  // Vocal Bridge owns the audio; we approximate the orb's "speaking" beat from
  // agent transcript entries so the mascot perks up while the agent talks.
  // The SDK exposes no "playback actually finished" event, so this is a
  // rough estimate — it must err toward re-arming the mic too LATE, not too
  // early. A 9s hard cap was cutting off any reply longer than ~26 words
  // (e.g. a multi-part "what's your departure city, dates, travelers,
  // budget?" question) mid-sentence: the mic reopened, picked up trailing
  // TTS audio or silence as a "turn," and the agent moved on before the
  // traveler ever got to answer — reported as "it skipped the date and
  // went to the next question."
  private markSpeaking(text: string) {
    this.setState('speaking');
    if (this.speakTimer) window.clearTimeout(this.speakTimer);
    const ms = Math.min(20000, Math.max(1400, text.split(/\s+/).length * 420));
    this.speakTimer = window.setTimeout(() => {
      if (this.state !== 'speaking') return;
      // Proactively re-arm the mic rather than only trusting the SDK's own
      // isMicrophoneEnabled bookkeeping — some TTS playback paths mute the
      // local track for echo cancellation without ever re-publishing it, which
      // otherwise silently strands the session and forces a manual re-click
      // for every single turn. A traveler-initiated mute is the only thing
      // allowed to keep it off.
      if (this.vbActive() && !this.userMuted) {
        void this.vb!.setMicrophoneEnabled(true).catch((err) => console.error('[voice] mic re-arm failed:', err));
        this.setState('listening');
      } else {
        this.setState(this.vb?.isMicrophoneEnabled ? 'listening' : 'idle');
      }
    }, ms);
  }

  private async startVocalBridge(): Promise<boolean> {
    if (this.vbConnecting) return this.vbConnecting;
    this.vbConnecting = this.doStartVocalBridge();
    try {
      return await this.vbConnecting;
    } finally {
      this.vbConnecting = null;
    }
  }

  private async doStartVocalBridge(): Promise<boolean> {
    try {
      if (!this.vb) {
        const vb = new VocalBridge({
          auth: {
            tokenProvider: async () => {
              const r = await this.mintToken!();
              if (!r.enabled || !r.token) throw new Error('Vocal Bridge not configured');
              const t = r.token;
              return { ...t, url: t.url ?? t.livekit_url ?? '' } as TokenResponse;
            },
          },
          participantName: 'Traveler',
        });
        vb.on('connectionStateChanged', (s) => {
          if (s === ConnectionState.Connecting || s === ConnectionState.WaitingForAgent) {
            this.setState('connecting');
          } else if (s === ConnectionState.Connected) {
            this.setState(vb.isMicrophoneEnabled ? 'listening' : 'idle');
          } else if (s === ConnectionState.Disconnected) {
            this.setState('idle');
          }
        });
        vb.on('microphoneChanged', (on) => {
          if (vb.state === ConnectionState.Connected && this.state !== 'speaking') {
            this.setState(on ? 'listening' : 'idle');
          }
        });
        vb.on('transcript', (t) => {
          if (t.role === 'agent') this.markSpeaking(t.text);
        });
        vb.on('error', (e) => console.error('[voice] vocal bridge error:', e.code, e.message));
        // Bring-your-own-agent: the VB runtime asks us, we ask the orchestrator,
        // the return value is spoken back automatically (docs/03 §2.5).
        vb.onAIAgentQuery(async (q) => (this.onQuery ? await this.onQuery(q) : ''));
        this.vb = vb;
      }
      // Captured once and used for the rest of this call — reading `this.vb`
      // again after the `await`s below would reflect whatever the *latest*
      // call left it as, not necessarily this one's own instance.
      const vb = this.vb;
      if (vb.state === ConnectionState.Disconnected) {
        this.setState('connecting');
        await vb.connect();
      }
      await vb.setMicrophoneEnabled(true);
      this.setState('listening');
      return true;
    } catch (err) {
      console.error('[voice] Vocal Bridge unavailable, falling back to browser speech:', err);
      this.vbDisabled = true;
      const dead = this.vb;
      this.vb = null;
      try {
        await dead?.disconnect();
      } catch {
        /* noop */
      }
      return false;
    }
  }

  // App → agent client action: tells the agent what the user just did on the
  // board so the next spoken turn has it in context (docs/03 §2.4).
  sendBoardSelection(nodeId: string) {
    if (this.vbActive() && this.vb!.state === ConnectionState.Connected) {
      this.vb!.sendAction('board_node_selected', { node_id: nodeId }).catch((err) =>
        console.error('[voice] board_node_selected failed:', err),
      );
    }
  }

  async startListening(): Promise<boolean> {
    // Stop any speech so the two never overlap.
    this.stopSpeaking();
    if (!this.secure) {
      console.error(
        '[voice] microphone blocked: this page is not a secure context. ' +
          'Open the app at http://localhost:5173 or over HTTPS (a raw http://<lan-ip> URL blocks the mic).',
      );
      return false;
    }
    this.userMuted = false;
    if (!this.vbDisabled && this.mintToken) {
      // Set synchronously, before any await, so the tap gets a visible
      // reaction on the very same frame instead of waiting on the token
      // mint + connect round trip.
      this.setState('connecting');
      if (await this.startVocalBridge()) return true;
      console.warn('[voice] Vocal Bridge did not start — using browser speech if available.');
    }
    if (!this.recognition) {
      // Neither path is available — don't leave the orb stuck showing
      // "connecting" with nothing actually happening.
      this.setState('idle');
      return false;
    }
    try {
      this.wantListening = true;
      this.recognition.start();
      this.setState('listening');
      return true;
    } catch {
      // start() throws if already started — treat as already listening.
      return this.state === 'listening';
    }
  }

  stopListening() {
    if (this.vbActive()) {
      // Stay connected for the session; just close the mic. This is the one
      // deliberate, traveler-initiated mute — it's the only thing that should
      // stop the automatic re-arm in markSpeaking from turning the mic back on.
      this.userMuted = true;
      void this.vb!.setMicrophoneEnabled(false);
      this.setState('idle');
      return;
    }
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch {
      /* noop */
    }
    this.setState('idle');
  }

  toggleListening() {
    if (this.state === 'listening') this.stopListening();
    else void this.startListening();
  }

  speak(text: string, onDone?: () => void) {
    // Vocal Bridge voices its own replies — never double-speak.
    if (this.vbActive()) {
      onDone?.();
      return;
    }
    if (!this.synth || !text) {
      onDone?.();
      return;
    }
    this.synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').trim());
    u.rate = 1.03;
    u.pitch = 1;
    u.onstart = () => this.setState('speaking');
    u.onend = () => {
      this.setState('idle');
      onDone?.();
    };
    u.onerror = () => {
      this.setState('idle');
      onDone?.();
    };
    this.synth.speak(u);
  }

  stopSpeaking() {
    try {
      this.synth?.cancel();
    } catch {
      /* noop */
    }
    if (this.state === 'speaking') this.setState('idle');
  }
}

export const voice = new VoiceEngine();
