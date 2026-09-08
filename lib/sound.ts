import type { WhistleKey } from "./parts";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

function tone(freq: number, start: number, duration: number, opts?: { type?: OscillatorType; peak?: number; glide?: number }) {
  const ac = getCtx();
  if (!ac) return;
  const { type = "sine", peak = 0.25, glide = 0 } = opts ?? {};
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  const t0 = ac.currentTime + start;
  osc.frequency.setValueAtTime(freq, t0);
  if (glide) osc.frequency.linearRampToValueAtTime(freq + glide, t0 + duration);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.04, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/* ------------------------------------------------------------------ whistle */

/**
 * A steam whistle is an organ pipe with a boiler behind it. The first version
 * here was a bare sine, which is why it sounded like a microwave. Four things
 * do the actual work:
 *
 *  - breath. The pipe is blown by escaping steam, so a good part of what you
 *    hear is filtered noise — loudest in the instant the valve cracks open,
 *    and still hissing after the tone has stopped.
 *  - beating. A whistle is several pipes sounding together, never quite in
 *    tune with each other. That slow roughness is the metallic part of it.
 *  - pressure. The pitch swoops up as the pipe fills and sags as the valve
 *    shuts. A whistle never starts or stops squarely.
 *  - distance. It's a big noise made outdoors, so it needs a tail.
 */

/** An open flue pipe: strong fundamental over a gently falling harmonic series. */
let pipeWave: PeriodicWave | null = null;
function getPipeWave(ac: AudioContext): PeriodicWave {
  if (!pipeWave) {
    const real = new Float32Array([0, 1, 0.38, 0.22, 0.12, 0.07, 0.04, 0.025, 0.015]);
    pipeWave = ac.createPeriodicWave(real, new Float32Array(real.length));
  }
  return pipeWave;
}

let noiseBuf: AudioBuffer | null = null;
function getNoise(ac: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    const len = Math.floor(ac.sampleRate * 2);
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/**
 * Shared whistle bus: a dry path and a reverb path into one soft limiter, so
 * five stacked pipes plus steam can't clip a phone speaker.
 */
let bus: { dry: GainNode; wet: GainNode } | null = null;
function getBus(ac: AudioContext) {
  if (!bus) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 12;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(ac.destination);

    // open countryside: no early reflections to speak of, just a soft tail
    const len = Math.floor(ac.sampleRate * 1.5);
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
    }
    const verb = ac.createConvolver();
    verb.buffer = ir;

    const dry = ac.createGain();
    dry.gain.value = 1;
    dry.connect(comp);
    const wet = ac.createGain();
    wet.gain.value = 0.32;
    wet.connect(verb).connect(comp);
    bus = { dry, wet };
  }
  return bus;
}

interface Blast {
  /** fundamental of the lowest pipe, Hz */
  base: number;
  /** the other pipes, as ratios of the base — a chord, not a harmonic series */
  chime: number[];
  /** how long the valve is held open, seconds */
  hold: number;
  breath: number;
  peak: number;
}

function blast(s: Blast, at: number) {
  const ac = getCtx();
  if (!ac) return;
  const { dry, wet } = getBus(ac);

  const t0 = ac.currentTime + at + 0.02;
  const attack = 0.075;
  const release = 0.34;
  const off = t0 + attack + s.hold; // the valve shuts here
  const stop = off + release + 0.4;

  // ---- one amplitude shape for all the pipes
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(s.peak, t0 + attack);
  amp.gain.setValueAtTime(s.peak, off);
  amp.gain.exponentialRampToValueAtTime(0.0001, off + release);
  amp.connect(dry);
  amp.connect(wet);

  // ---- movement: a player's vibrato plus a slower drift in boiler pressure
  const vib = ac.createOscillator();
  vib.frequency.value = 5.1 + Math.random() * 0.9;
  const vibAmt = ac.createGain();
  vibAmt.gain.value = 5.5; // cents
  vib.connect(vibAmt);
  const drift = ac.createOscillator();
  drift.frequency.value = 0.55;
  const driftAmt = ac.createGain();
  driftAmt.gain.value = 4;
  drift.connect(driftAmt);
  // and a touch of the same wobble in the loudness
  const tremAmt = ac.createGain();
  tremAmt.gain.value = s.peak * 0.07;
  vib.connect(tremAmt).connect(amp.gain);
  for (const o of [vib, drift]) {
    o.start(t0);
    o.stop(stop);
  }

  // ---- the pipes
  const weights = s.chime.map((_, i) => (i === 0 ? 1 : 0.55 / Math.sqrt(i + 1)));
  const norm = weights.reduce((a, b) => a + b, 0);
  s.chime.forEach((ratio, i) => {
    const osc = ac.createOscillator();
    osc.setPeriodicWave(getPipeWave(ac));
    osc.frequency.value = s.base * ratio;

    // each pipe sits a few cents off its neighbours — the slow beating between
    // them is most of what makes a chime sound like metal rather than a synth
    const cents = [0, -7, 6, -4, 9][i % 5];
    osc.detune.setValueAtTime(cents - 95, t0); // flat until the pipe fills
    osc.detune.linearRampToValueAtTime(cents, t0 + attack * 1.6);
    osc.detune.setValueAtTime(cents, off);
    osc.detune.linearRampToValueAtTime(cents - 210, off + release); // valve shuts
    vibAmt.connect(osc.detune);
    driftAmt.connect(osc.detune);

    const g = ac.createGain();
    g.gain.value = weights[i] / norm;
    osc.connect(g).connect(amp);
    osc.start(t0);
    osc.stop(stop);
  });

  // ---- steam
  const n = ac.createBufferSource();
  n.buffer = getNoise(ac);
  n.loop = true;
  const body = ac.createBiquadFilter(); // breath coloured by the pipe
  body.type = "bandpass";
  body.frequency.value = s.base * 2.1;
  body.Q.value = 1.1;
  const air = ac.createBiquadFilter(); // and the bright hiss on top
  air.type = "highpass";
  air.frequency.value = 2600;

  const nAmp = ac.createGain();
  nAmp.gain.setValueAtTime(0.0001, t0);
  nAmp.gain.exponentialRampToValueAtTime(s.breath * 2.4, t0 + 0.025); // valve cracks
  nAmp.gain.exponentialRampToValueAtTime(s.breath, t0 + attack + 0.1);
  nAmp.gain.setValueAtTime(s.breath, off);
  // steam keeps escaping for a moment after the tone has gone
  nAmp.gain.exponentialRampToValueAtTime(0.0001, off + release + 0.25);
  n.connect(body).connect(nAmp);
  n.connect(air).connect(nAmp);
  nAmp.connect(dry);
  nAmp.connect(wet);
  n.start(t0, Math.random() * 1.5);
  n.stop(stop);
}

const WHISTLE_BLASTS: Record<WhistleKey, { at: number; blast: Blast }[]> = {
  // the classic British two-tone hooter — a fifth, held long
  friendly: [
    { at: 0, blast: { base: 392, chime: [1, 1.5], hold: 1.15, breath: 0.055, peak: 0.26 } },
  ],
  // two cheerful toots, the second held a little longer
  happy: [
    { at: 0, blast: { base: 466, chime: [1, 1.5], hold: 0.22, breath: 0.06, peak: 0.24 } },
    { at: 0.42, blast: { base: 466, chime: [1, 1.5], hold: 0.34, breath: 0.06, peak: 0.24 } },
  ],
  // a small sharp pip: more air than pipe
  high: [
    { at: 0, blast: { base: 740, chime: [1, 1.5], hold: 0.26, breath: 0.085, peak: 0.2 } },
  ],
  // a big five-chime minor — the kind you feel as much as hear
  deep: [
    {
      at: 0,
      blast: { base: 156, chime: [1, 1.19, 1.5, 2, 2.38], hold: 1.7, breath: 0.07, peak: 0.24 },
    },
  ],
};

export function playWhistle(kind: WhistleKey) {
  for (const b of WHISTLE_BLASTS[kind]) blast(b.blast, b.at);
}

/** Short wooden clunk for a part snapping into place. */
export function playClunk() {
  const ac = getCtx();
  if (!ac) return;
  tone(320, 0, 0.09, { type: "triangle", peak: 0.3, glide: -120 });
  tone(640, 0.01, 0.07, { type: "sine", peak: 0.12 });
}

export function playChuff(volume = 0.5) {
  const ac = getCtx();
  if (!ac) return;
  const bufferSize = Math.floor(ac.sampleRate * 0.09);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 170;
  filter.Q.value = 0.7;
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
}

let unlocked = false;

/**
 * iOS/Safari keeps the AudioContext muted until a sound is actually started
 * from inside a user gesture — resuming alone isn't enough. Call this from
 * pointer/click handlers.
 */
export function primeAudio() {
  const ac = getCtx();
  if (!ac || unlocked) return;
  const buffer = ac.createBuffer(1, 1, 22050);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.connect(ac.destination);
  try {
    src.start(0);
    unlocked = true;
  } catch {
    // will be retried on the next gesture
  }
}
