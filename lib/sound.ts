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

export function playWhistle(kind: WhistleKey) {
  switch (kind) {
    case "friendly":
      tone(620, 0, 0.55, { peak: 0.28, glide: 40 });
      tone(310, 0, 0.55, { peak: 0.08 });
      break;
    case "happy":
      tone(700, 0, 0.18, { peak: 0.28 });
      tone(780, 0.22, 0.2, { peak: 0.28 });
      break;
    case "high":
      tone(1000, 0, 0.3, { peak: 0.22, glide: 80 });
      break;
    case "deep":
      tone(340, 0, 0.7, { peak: 0.3, glide: -30 });
      tone(170, 0, 0.7, { peak: 0.1 });
      break;
  }
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
