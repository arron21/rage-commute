import { CensorMode, CustomAudioClip, SwearWordEntry } from './types';
import { SWEAR_DICTIONARY } from './constants';
import { getAllStoredAudioClips, saveAudioClipToDB, deleteAudioClipFromDB } from './storage';

export class SwearAudioManager {
  private ctx: AudioContext | null = null;
  private customClips: CustomAudioClip[] = [];
  private folderAudioUrls: { name: string; url: string }[] = [];
  private censorMode: CensorMode = 'uncensored';
  private muted: boolean = false;
  private lastSwearIndex: number = -1;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  async init(): Promise<void> {
    this.customClips = await getAllStoredAudioClips();
    await this.loadStaticFolderManifest();
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private async loadStaticFolderManifest(): Promise<void> {
    try {
      const baseUrl = import.meta.env.BASE_URL || './';
      const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const res = await fetch(`${normalizedBase}audio/swears/manifest.json`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.files)) {
          this.folderAudioUrls = data.files.map((filename: string) => ({
            name: filename.replace(/\.[^/.]+$/, '').toUpperCase(),
            url: `${normalizedBase}audio/swears/${filename}`,
          }));
        }
      }
    } catch {
      // Ignore if manifest is absent
    }
  }

  setCensorMode(mode: CensorMode): void {
    this.censorMode = mode;
  }

  getCensorMode(): CensorMode {
    return this.censorMode;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  getCustomClips(): CustomAudioClip[] {
    return this.customClips;
  }

  getStaticFolderCount(): number {
    return this.folderAudioUrls.length;
  }

  async addUploadedFiles(files: FileList | File[], customLabel?: string): Promise<CustomAudioClip[]> {
    const added: CustomAudioClip[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|webm)$/i)) {
        continue;
      }
      const cleanName = customLabel || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').toUpperCase();
      const clip = await saveAudioClipToDB({
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        label: cleanName ? `${cleanName}!` : 'CUSTOM SWEAR!',
        blob: file,
        enabled: true,
        createdAt: Date.now(),
      });
      this.customClips.unshift(clip);
      added.push(clip);
    }
    return added;
  }

  async removeClip(id: string): Promise<void> {
    const idx = this.customClips.findIndex((c) => c.id === id);
    if (idx !== -1) {
      URL.revokeObjectURL(this.customClips[idx].url);
      this.customClips.splice(idx, 1);
    }
    await deleteAudioClipFromDB(id);
  }

  public unlockAudioOnGesture(): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  async startRecording(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordedChunks = [];
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      let chosenMime = '';
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        for (const m of mimeTypes) {
          if (MediaRecorder.isTypeSupported(m)) {
            chosenMime = m;
            break;
          }
        }
      }
      this.mediaRecorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };
      this.mediaRecorder.start();
      return true;
    } catch (e) {
      console.warn('Microphone access denied or unavailable:', e);
      return false;
    }
  }

  async stopRecording(customLabel: string): Promise<CustomAudioClip | null> {
    if (!this.mediaRecorder) return null;
    return new Promise((resolve) => {
      const recorder = this.mediaRecorder!;
      const mimeType = recorder.mimeType || 'audio/webm';
      const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      recorder.onstop = async () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const label = (customLabel.trim() || `MIC RAGE #${this.customClips.length + 1}`).toUpperCase();
        const saved = await saveAudioClipToDB({
          id: `mic_${Date.now()}`,
          name: `${label}.${ext}`,
          label: label.endsWith('!') ? label : `${label}!`,
          blob,
          enabled: true,
          createdAt: Date.now(),
        });
        this.customClips.unshift(saved);
        this.mediaRecorder = null;
        resolve(saved);
      };
      recorder.stop();
    });
  }

  previewClip(clip: CustomAudioClip): void {
    if (this.muted) return;
    const audio = new Audio(clip.url);
    audio.volume = 0.9;
    audio.play().catch(() => {});
  }

  /**
   * Triggers strictly when the player successfully clears an obstacle!
   * Picks a random swear entry + plays custom audio (if available & not in TV Bleep mode)
   * or expressive synthesized rage + bleeps.
   */
  triggerObstacleClearSwear(comboCount: number): {
    wordEntry: SwearWordEntry;
    displayText: string;
    usedCustomAudio: boolean;
  } {
    // Pick a random dictionary entry (avoiding immediate repeat)
    let idx = Math.floor(Math.random() * SWEAR_DICTIONARY.length);
    if (idx === this.lastSwearIndex && SWEAR_DICTIONARY.length > 1) {
      idx = (idx + 1) % SWEAR_DICTIONARY.length;
    }
    this.lastSwearIndex = idx;
    const entry = SWEAR_DICTIONARY[idx];

    const enabledCustom = this.customClips.filter((c) => c.enabled);
    const hasCustomOrStatic = enabledCustom.length > 0 || this.folderAudioUrls.length > 0;

    let displayText = entry.uncensored;
    if (this.censorMode === 'bleep') {
      displayText = entry.bleeped;
    } else if (this.censorMode === 'corporate') {
      displayText = entry.corporate;
    }

    if (!this.muted) {
      if (this.censorMode === 'bleep') {
        // Classic comedy 1000Hz TV Censor Bleep with angry vocal grunt underneath!
        this.playTvCensorBleep(comboCount);
      } else if (hasCustomOrStatic && this.censorMode === 'uncensored') {
        // Play user's uploaded custom swear audio or static folder audio!
        if (enabledCustom.length > 0) {
          const clip = enabledCustom[Math.floor(Math.random() * enabledCustom.length)];
          displayText = clip.label || displayText;
          this.playAudioUrl(clip.url, comboCount);
        } else {
          const folderClip = this.folderAudioUrls[Math.floor(Math.random() * this.folderAudioUrls.length)];
          displayText = `${folderClip.name}!`;
          this.playAudioUrl(folderClip.url, comboCount);
        }
        return { wordEntry: entry, displayText, usedCustomAudio: true };
      } else {
        // Expressive synthesized vocal shout + comic impact!
        this.playSynthRageShout(comboCount, entry.severity);
      }
    }

    return { wordEntry: entry, displayText, usedCustomAudio: false };
  }

  private playAudioUrl(url: string, comboCount: number): void {
    try {
      const audio = new Audio(url);
      audio.volume = 0.95;
      // Slight pitch/playback boost as rage combo escalates, without distorting the clip
      audio.playbackRate = Math.min(1.22, 1.0 + Math.min(comboCount, 10) * 0.015);
      audio.play().catch(() => {
        this.playSynthRageShout(comboCount, 2);
      });
    } catch {
      this.playSynthRageShout(comboCount, 2);
    }
  }

  private playTvCensorBleep(comboCount: number): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // 1. Classic 1000Hz Broadcast Censor Bleep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const pitchBoost = Math.min(comboCount * 18, 180);
    osc.frequency.setValueAtTime(1000 + pitchBoost, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.01);
    gain.gain.setValueAtTime(0.32, now + 0.24);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.27);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);

    // 2. Muffled angry voice formant burst at the start/end of the bleep
    this.playAngryFormantBurst(now, 0.07, 170 + pitchBoost * 0.4, 0.18);
  }

  private playSynthRageShout(comboCount: number, severity: number): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const baseFreq = 165 + Math.min(comboCount * 12, 140) + severity * 20;

    // Multi-syllable frustrated cartoon commuter bark/yell
    this.playAngryFormantBurst(now, 0.12, baseFreq, 0.26);
    this.playAngryFormantBurst(now + 0.14, 0.18, baseFreq * 1.18, 0.28);

    // Comic impact punch
    const punchOsc = ctx.createOscillator();
    const punchGain = ctx.createGain();
    punchOsc.type = 'triangle';
    punchOsc.frequency.setValueAtTime(140, now);
    punchOsc.frequency.exponentialRampToValueAtTime(45, now + 0.11);
    punchGain.gain.setValueAtTime(0.25, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    punchOsc.connect(punchGain);
    punchGain.connect(ctx.destination);
    punchOsc.start(now);
    punchOsc.stop(now + 0.12);
  }

  private playAngryFormantBurst(startTime: number, duration: number, freq: number, vol: number): void {
    const ctx = this.ensureContext();
    const saw = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(freq, startTime);
    saw.frequency.linearRampToValueAtTime(freq * 1.25, startTime + duration * 0.4);
    saw.frequency.linearRampToValueAtTime(freq * 0.85, startTime + duration);

    // Vocal formant bandpass
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, startTime);
    filter.Q.setValueAtTime(3.2, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    saw.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    saw.start(startTime);
    saw.stop(startTime + duration + 0.01);
  }

  playJumpSound(isDoubleJump: boolean): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const startF = isDoubleJump ? 340 : 220;
    const endF = isDoubleJump ? 680 : 480;
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(endF, now + 0.11);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playSlideSound(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playCoffeePickup(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.06); // A5

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playRageDashSound(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Siren / steam whistle burst
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(820, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.45);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.47);
  }

  playCrashMeltdownSound(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Rapid triple bleep meltdown + crash thud
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.13;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'square';
      osc.frequency.setValueAtTime(i === 1 ? 1050 : 980, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.11);
    }
  }
}
