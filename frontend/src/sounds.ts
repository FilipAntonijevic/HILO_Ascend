/** Lightweight procedural SFX via Web Audio API (no asset files). */

type Tone = {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
};

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call from a click handler so mobile browsers unlock audio. */
export function unlockAudio(): void {
  getCtx();
}

function playTones(tones: Tone[], master = 0.18): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  for (const t of tones) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.setValueAtTime(t.freq, now + (t.delay ?? 0));
    if (t.slideTo != null) {
      osc.frequency.linearRampToValueAtTime(t.slideTo, now + (t.delay ?? 0) + t.dur);
    }
    const g = (t.gain ?? 1) * master;
    gain.gain.setValueAtTime(0.0001, now + (t.delay ?? 0));
    gain.gain.exponentialRampToValueAtTime(Math.max(g, 0.001), now + (t.delay ?? 0) + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (t.delay ?? 0) + t.dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now + (t.delay ?? 0));
    osc.stop(now + (t.delay ?? 0) + t.dur + 0.02);
  }
}

function noiseBurst(dur: number, gainLevel = 0.12, filterFreq = 1200): void {
  const ac = getCtx();
  if (!ac) return;
  const n = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, n, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);

  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 0.8;
  const gain = ac.createGain();
  const now = ac.currentTime;
  gain.gain.setValueAtTime(gainLevel, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start(now);
  src.stop(now + dur + 0.02);
}

export const sfx = {
  click() {
    playTones(
      [
        { freq: 920, dur: 0.045, type: 'triangle', gain: 0.7 },
        { freq: 1400, dur: 0.03, type: 'sine', gain: 0.35, delay: 0.01 },
      ],
      0.12,
    );
  },

  cardFlip() {
    noiseBurst(0.09, 0.1, 1800);
    playTones(
      [
        { freq: 280, dur: 0.08, type: 'triangle', gain: 0.45, slideTo: 420 },
        { freq: 520, dur: 0.1, type: 'sine', gain: 0.25, delay: 0.04, slideTo: 260 },
      ],
      0.14,
    );
  },

  cashOut() {
    playTones(
      [
        { freq: 523.25, dur: 0.12, type: 'sine', gain: 0.7 },
        { freq: 659.25, dur: 0.12, type: 'sine', gain: 0.7, delay: 0.09 },
        { freq: 783.99, dur: 0.14, type: 'sine', gain: 0.75, delay: 0.18 },
        { freq: 1046.5, dur: 0.22, type: 'triangle', gain: 0.55, delay: 0.28 },
      ],
      0.16,
    );
  },

  bust() {
    playTones(
      [
        { freq: 180, dur: 0.22, type: 'sawtooth', gain: 0.55, slideTo: 70 },
        { freq: 110, dur: 0.28, type: 'square', gain: 0.35, delay: 0.05, slideTo: 55 },
      ],
      0.14,
    );
    noiseBurst(0.18, 0.08, 400);
  },

  /** Mult / poker hand connects on the board. */
  bonus() {
    playTones(
      [
        { freq: 660, dur: 0.1, type: 'sine', gain: 0.55 },
        { freq: 880, dur: 0.1, type: 'sine', gain: 0.6, delay: 0.07 },
        { freq: 1175, dur: 0.12, type: 'triangle', gain: 0.65, delay: 0.14 },
        { freq: 1568, dur: 0.18, type: 'sine', gain: 0.5, delay: 0.22 },
        { freq: 2093, dur: 0.12, type: 'triangle', gain: 0.25, delay: 0.3 },
      ],
      0.15,
    );
  },
};
