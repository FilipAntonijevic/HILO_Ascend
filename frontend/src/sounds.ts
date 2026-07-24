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

function makeNoiseBuffer(ac: AudioContext, dur: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, n, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function noiseBurst(dur: number, gainLevel = 0.12, filterFreq = 1200): void {
  const ac = getCtx();
  if (!ac) return;
  const src = ac.createBufferSource();
  src.buffer = makeNoiseBuffer(ac, dur);
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

/** Paper/card whoosh with a soft slap — reads as a playing-card flip. */
function playCardFlip(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  // Air / paper rustle while the card turns.
  {
    const src = ac.createBufferSource();
    src.buffer = makeNoiseBuffer(ac, 0.16);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.55;
    bp.frequency.setValueAtTime(3200, now);
    bp.frequency.exponentialRampToValueAtTime(900, now + 0.14);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 600;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    src.connect(bp);
    bp.connect(hp);
    hp.connect(gain);
    gain.connect(ac.destination);
    src.start(now);
    src.stop(now + 0.17);
  }

  // Soft edge snap as the card finishes the flip.
  {
    const t0 = now + 0.07;
    const src = ac.createBufferSource();
    src.buffer = makeNoiseBuffer(ac, 0.05);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 2.2;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.14, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(ac.destination);
    src.start(t0);
    src.stop(t0 + 0.06);
  }

  // Quiet body thud on the table.
  {
    const t0 = now + 0.085;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.07);
    gain.gain.setValueAtTime(0.08, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.09);
  }
}

/** Single metallic coin ping with inharmonic partials. */
function coinClink(ac: AudioContext, when: number, baseFreq: number, gainLevel: number): void {
  const partials = [
    { mul: 1, g: 1, type: 'sine' as OscillatorType },
    { mul: 2.54, g: 0.45, type: 'triangle' as OscillatorType },
    { mul: 5.43, g: 0.22, type: 'sine' as OscillatorType },
    { mul: 8.17, g: 0.1, type: 'sine' as OscillatorType },
  ];

  for (const p of partials) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = p.type;
    osc.frequency.setValueAtTime(baseFreq * p.mul, when);
    const g = Math.max(gainLevel * p.g, 0.001);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(g, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.12 + p.g * 0.08);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(when);
    osc.stop(when + 0.25);
  }

  // Tiny bright noise tick for the metal strike.
  const src = ac.createBufferSource();
  src.buffer = makeNoiseBuffer(ac, 0.03);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = baseFreq * 3.2;
  bp.Q.value = 4;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(gainLevel * 0.35, when);
  ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.028);
  src.connect(bp);
  bp.connect(ng);
  ng.connect(ac.destination);
  src.start(when);
  src.stop(when + 0.04);
}

/** Cascading coin jingle for cash out. */
function playCoinJingle(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const bases = [2650, 3100, 2480, 3400, 2900, 3600, 2750, 3250];

  for (let i = 0; i < bases.length; i++) {
    const jitter = Math.random() * 0.018;
    const when = now + i * 0.038 + jitter;
    const level = 0.07 * (1 - i * 0.07);
    coinClink(ac, when, bases[i]! * (0.97 + Math.random() * 0.06), Math.max(level, 0.02));
  }

  // Soft pouch / pile settle under the jingle.
  noiseBurst(0.12, 0.035, 900);
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
    playCardFlip();
  },

  cashOut() {
    playCoinJingle();
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
