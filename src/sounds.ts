/* Auction sound effects, synthesised with Web Audio (no audio files to ship).
   Played from the operator console: browsers only allow audio in a window the user has
   clicked or typed in, and both windows share the laptop's speakers / HDMI output anyway. */

const KEY = "spl-auction-sound";

export const soundOn = (): boolean => {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
};
export const setSoundOn = (on: boolean) => {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* storage blocked: stays on for this session */ }
};

/** Offsets (ms) of each step of the random-draw roll: fast at first, slowing down. Shared with the projector animation. */
export const DRAW_STEPS: number[] = (() => {
  const out: number[] = [];
  let t = 0, gap = 60;
  for (let k = 0; k < 14; k++) { out.push(Math.round(t)); t += gap; gap *= 1.12; }
  return out;
})();
export const DRAW_END = DRAW_STEPS[DRAW_STEPS.length - 1] + 220;

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = "sine", vol = 0.3, endFreq?: number) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function bell(c: AudioContext, freq: number, at: number) {
  tone(c, freq, at, 1.1, "sine", 0.35);
  tone(c, freq * 2.76, at, 0.5, "sine", 0.08);
  tone(c, freq * 5.4, at, 0.25, "sine", 0.04);
}

/** Gavel strike: a short filtered noise crack over a low thump. */
function gavel(c: AudioContext, at: number, vol = 0.9) {
  const len = Math.floor(c.sampleRate * 0.12);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1800;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start(at);
  tone(c, 140, at, 0.2, "sine", vol * 0.9, 55);
}

export type Sound = "bid" | "once" | "twice" | "sold" | "unsold" | "draw";

export function play(s: Sound) {
  if (!soundOn()) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.02;
  switch (s) {
    case "bid":
      tone(c, 880, t, 0.12, "triangle", 0.22);
      tone(c, 1320, t + 0.06, 0.18, "triangle", 0.18);
      break;
    case "once":
      bell(c, 660, t);
      break;
    case "twice":
      bell(c, 660, t);
      bell(c, 660, t + 0.3);
      break;
    case "sold":
      gavel(c, t); gavel(c, t + 0.22); gavel(c, t + 0.44, 1);
      for (const f of [523, 659, 784, 1047]) tone(c, f, t + 0.65, 0.9, "triangle", 0.12);
      break;
    case "unsold":
      tone(c, 392, t, 0.25, "triangle", 0.2);
      tone(c, 294, t + 0.22, 0.45, "triangle", 0.2);
      break;
    case "draw":
      for (const ms of DRAW_STEPS) tone(c, 1200, t + ms / 1000, 0.04, "square", 0.06);
      bell(c, 880, t + DRAW_END / 1000);
      break;
  }
}
