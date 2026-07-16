// Browser-native voice engine (Web Speech API), abstracted behind a small
// interface so the UI is identical regardless of the backing engine. Degrades
// cleanly to text when speech recognition is unavailable (e.g. the preview
// iframe, or unsupported browsers).

export type VoiceState = 'idle' | 'ready' | 'listening' | 'speaking';

type StateCb = (s: VoiceState) => void;
type ResultCb = (text: string) => void;

class VoiceEngine {
  private recognition: any = null;
  private synth: SpeechSynthesis | null = null;
  private state: VoiceState = 'idle';
  private wantListening = false;
  onStateChange: StateCb | null = null;
  onResult: ResultCb | null = null;
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

  startListening() {
    if (!this.recognition) return false;
    // Stop any speech so the two never overlap.
    this.stopSpeaking();
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
    else this.startListening();
  }

  speak(text: string, onDone?: () => void) {
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
