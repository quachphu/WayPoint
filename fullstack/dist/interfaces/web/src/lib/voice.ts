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

export type VoiceState = 'idle' | 'ready' | 'listening' | 'speaking';

type StateCb = (s: VoiceState) => void;
type ResultCb = (text: string) => void;
type QueryCb = (text: string) => Promise<string>;
type TokenMint = () => Promise<{ enabled: boolean; token?: TokenResponse }>;

class VoiceEngine {
  private recognition: any = null;
  private synth: SpeechSynthesis | null = null;
  private state: VoiceState = 'idle';
  private wantListening = false;
  private vb: VocalBridge | null = null;
  private mintToken: TokenMint | null = null;
  private vbDisabled = false; // set once the token endpoint or connect says no
  private speakTimer: number | null = null;
  onStateChange: StateCb | null = null;
  onResult: ResultCb | null = null; // browser path: recognized text → store.send
  onQuery: QueryCb | null = null; // vocal bridge path: agent query → reply text
  recognitionSupported = false;
  speechSupported = false;

  constructor() {
    if (typeof window === 'undefined') return;
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

  // Whether pressing the orb can do anything at all.
  get available(): boolean {
    return this.recognitionSupported || (!this.vbDisabled && !!this.mintToken);
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
  private markSpeaking(text: string) {
    this.setState('speaking');
    if (this.speakTimer) window.clearTimeout(this.speakTimer);
    const ms = Math.min(9000, Math.max(1400, text.split(/\s+/).length * 340));
    this.speakTimer = window.setTimeout(() => {
      if (this.state !== 'speaking') return;
      this.setState(this.vb?.isMicrophoneEnabled ? 'listening' : 'idle');
    }, ms);
  }

  private async startVocalBridge(): Promise<boolean> {
    try {
      if (!this.vb) {
        const vb = new VocalBridge({
          auth: {
            tokenProvider: async () => {
              const r = await this.mintToken!();
              if (!r.enabled || !r.token) throw new Error('Vocal Bridge not configured');
              return r.token;
            },
          },
          participantName: 'Traveler',
        });
        vb.on('connectionStateChanged', (s) => {
          if (s === ConnectionState.Connecting || s === ConnectionState.WaitingForAgent) {
            this.setState('ready');
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
      if (this.vb.state === ConnectionState.Disconnected) {
        this.setState('ready');
        await this.vb.connect();
      }
      await this.vb.setMicrophoneEnabled(true);
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
    if (!this.vbDisabled && this.mintToken) {
      if (await this.startVocalBridge()) return true;
    }
    if (!this.recognition) return false;
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
      // Stay connected for the session; just close the mic.
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
