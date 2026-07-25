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

function makeNoiseBuffer(ac: AudioContext, dur: number, kind: 'white' | 'pink' = 'white'): AudioBuffer {
  const n = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, n, ac.sampleRate);
  const data = buffer.getChannelData(0);
  if (kind === 'white') {
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Paul Kellet pink-noise approximation — warmer, more paper-like than white.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    data[i] = pink * 0.11;
  }
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

/**
 * Playing-card flip: fingertip flick → air/paper whoosh → crisp flap → soft felt land.
 * Slight randomization each play so repeats don't sound identical.
 */
function playCardFlip(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const rate = 0.96 + Math.random() * 0.08;
  const master = 0.9 + Math.random() * 0.15;

  // 1) Nail / fingertip flick — sharp high transient.
  {
    const src = ac.createBufferSource();
    src.buffer = makeNoiseBuffer(ac, 0.035);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2800 * rate;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 5200 * rate;
    bp.Q.value = 3.5;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22 * master, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
    src.connect(hp);
    hp.connect(bp);
    bp.connect(gain);
    gain.connect(ac.destination);
    src.start(now);
    src.stop(now + 0.04);
  }

  // 2) Card body whoosh — pink noise with falling band + light flutter.
  {
    const t0 = now + 0.012;
    const dur = 0.14;
    const src = ac.createBufferSource();
    src.buffer = makeNoiseBuffer(ac, dur + 0.02, 'pink');

    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(2800 * rate, t0);
    bp.frequency.exponentialRampToValueAtTime(700 * rate, t0 + dur);

    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(6500, t0);
    lp.frequency.exponentialRampToValueAtTime(1800, t0 + dur);

    // Amplitude flutter ≈ card spinning through air.
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 38 + Math.random() * 10;
    lfoGain.gain.value = 0.45;
    const base = ac.createGain();
    base.gain.setValueAtTime(0.0001, t0);
    base.gain.exponentialRampToValueAtTime(0.2 * master, t0 + 0.015);
    base.gain.linearRampToValueAtTime(0.12 * master, t0 + 0.06);
    base.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const flutter = ac.createGain();
    flutter.gain.value = 1;
    lfo.connect(lfoGain);
    lfoGain.connect(flutter.gain);

    src.connect(bp);
    bp.connect(lp);
    lp.connect(flutter);
    flutter.connect(base);
    base.connect(ac.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.02);
  }

  // 3) Crisp paper/plastic flap as the face finishes turning.
  {
    const t0 = now + 0.085 + Math.random() * 0.012;
    const src = ac.createBufferSource();
    src.buffer = makeNoiseBuffer(ac, 0.04, 'pink');
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1900 * rate, t0);
    bp.frequency.exponentialRampToValueAtTime(1100 * rate, t0 + 0.03);
    bp.Q.value = 4.5;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.28 * master, t0 + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.038);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(ac.destination);
    src.start(t0);
    src.stop(t0 + 0.045);

    // Short harmonic "tick" of stiff card stock.
    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980 * rate, t0);
    osc.frequency.exponentialRampToValueAtTime(420 * rate, t0 + 0.04);
    og.gain.setValueAtTime(0.07 * master, t0);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
    osc.connect(og);
    og.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.05);
  }

  // 4) Soft felt / table land under the flap.
  {
    const t0 = now + 0.1;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160 * rate, t0);
    osc.frequency.exponentialRampToValueAtTime(55 * rate, t0 + 0.09);
    gain.gain.setValueAtTime(0.09 * master, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.11);

    const src = ac.createBufferSource();
    src.buffer = makeNoiseBuffer(ac, 0.06, 'pink');
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 450;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.06 * master, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
    src.connect(lp);
    lp.connect(ng);
    ng.connect(ac.destination);
    src.start(t0);
    src.stop(t0 + 0.08);
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
function playCoinJingle(intensity = 1): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const bases = [2650, 3100, 2480, 3400, 2900, 3600, 2750, 3250, 3000, 3500];
  const count = Math.min(bases.length, Math.round(8 * intensity));

  for (let i = 0; i < count; i++) {
    const jitter = Math.random() * 0.018;
    const when = now + i * (0.034 / Math.min(intensity, 1.4)) + jitter;
    const level = 0.07 * intensity * (1 - i * 0.06);
    coinClink(ac, when, bases[i]! * (0.97 + Math.random() * 0.06), Math.max(level, 0.02));
  }

  // Soft pouch / pile settle under the jingle.
  noiseBurst(0.12, 0.035 * intensity, 900);
}

/**
 * Special win for clearing all 7 cards — triumphant rise + shimmer + big coin rain.
 * Distinct from a normal mid-round cash out.
 */
function playMaxWin(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  // Ascending major fanfare (C5 → E5 → G5 → C6 → E6).
  const fanfare = [
    { f: 523.25, d: 0, g: 0.55, dur: 0.16 },
    { f: 659.25, d: 0.1, g: 0.6, dur: 0.16 },
    { f: 783.99, d: 0.2, g: 0.65, dur: 0.16 },
    { f: 1046.5, d: 0.32, g: 0.7, dur: 0.22 },
    { f: 1318.5, d: 0.48, g: 0.55, dur: 0.35 },
  ];

  for (const n of fanfare) {
    for (const [type, mul, gMul] of [
      ['sine', 1, 1],
      ['triangle', 2, 0.35],
      ['sine', 3, 0.18],
    ] as const) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(n.f * mul, now + n.d);
      const g = Math.max(n.g * gMul * 0.2, 0.001);
      gain.gain.setValueAtTime(0.0001, now + n.d);
      gain.gain.exponentialRampToValueAtTime(g, now + n.d + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.d + n.dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now + n.d);
      osc.stop(now + n.d + n.dur + 0.03);
    }
  }

  // Bright sparkle / shimmer over the top note.
  {
    const t0 = now + 0.45;
    for (let i = 0; i < 7; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const when = t0 + i * 0.045;
      osc.type = 'sine';
      osc.frequency.value = 2400 + i * 280 + Math.random() * 120;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.045, when + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(when);
      osc.stop(when + 0.14);
    }
  }

  // Bigger coin rain than a normal cash out.
  window.setTimeout(() => playCoinJingle(1.45), 280);
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

  /** Cleared the full board (last card win) — bigger than a mid-round cash out. */
  maxWin() {
    playMaxWin();
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
