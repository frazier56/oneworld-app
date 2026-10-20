/**
 * SPEECH CLIPS — the pure half of the shared microphone (overlay 48, 6 Oct 2026).
 * ============================================================================================
 * The microphone cuts what a person says into short clips AT THEIR OWN PAUSES, so a word is never
 * sliced in half, and each clip is written down by the server in the language actually spoken.
 * Everything here is plain arithmetic on samples — no browser APIs — so it is unit-tested.
 */

export const CLIP_RATE = 16000;

/** Average-down to 16 kHz mono. Speech needs nothing above 8 kHz, and it keeps every clip small. */
export function downsample(input: Float32Array, fromRate: number, toRate = CLIP_RATE): Float32Array {
  if (fromRate === toRate) return input;
  if (fromRate < toRate) return input; // never upsample — the server accepts 8–48 kHz
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  let pos = 0;
  for (let i = 0; i < out.length; i++) {
    const end = Math.min(input.length, Math.round((i + 1) * ratio));
    let sum = 0, n = 0;
    for (; pos < end; pos++) { sum += input[pos]; n++; }
    out[i] = n ? sum / n : 0;
  }
  return out;
}

/** 16-bit PCM WAV, mono. Exactly the one format the server accepts. */
export function encodeWav(samples: Float32Array, rate = CLIP_RATE): Uint8Array {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const dv = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); dv.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE");
  w(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, "data"); dv.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  const STEP = 0x8000;
  for (let i = 0; i < bytes.length; i += STEP) s += String.fromCharCode(...bytes.subarray(i, i + STEP));
  return btoa(s);
}

export function rms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return frame.length ? Math.sqrt(sum / frame.length) : 0;
}

/** The pause rules, in seconds. */
export const CUT = {
  preRoll: 0.35,      // kept before the first loud frame, so the first syllable survives
  pause: 0.7,         // a pause this long ends a clip…
  minClip: 1.5,       // …once the clip is at least this long
  softMax: 10,        // past this, the next short pause (0.25 s) ends it
  shortPause: 0.25,
  hardMax: 20,        // never longer than this (the server takes 30)
  minSpeech: 0.3,     // a clip with less real speech than this is a cough, not words
};

/**
 * Feed frames in; get finished clips out. Speech is "louder than the room": the noise floor tracks
 * the quiet moments, so a fan or street noise does not count as talking.
 */
export class ClipCutter {
  private pre: Float32Array[] = [];
  private preSec = 0;
  private clip: Float32Array[] = [];
  private clipSec = 0;
  private speechSec = 0;
  private quietSec = 0;
  private noise = 0.004;
  constructor(private rate: number) {}

  get inClip() { return this.clip.length > 0; }

  /** Returns the frame's loudness (0–1) and, when a pause ends one, a finished clip at the input rate. */
  push(frame: Float32Array): { level: number; clip: Float32Array | null } {
    const dt = frame.length / this.rate;
    const level = rms(frame);
    const threshold = Math.max(0.012, this.noise * 2.5);
    const loud = level > threshold;
    if (!loud) this.noise = Math.min(0.05, this.noise * 0.95 + level * 0.05);

    if (!this.inClip) {
      if (!loud) {
        this.pre.push(frame); this.preSec += dt;
        while (this.preSec - this.pre[0].length / this.rate >= CUT.preRoll) { this.preSec -= this.pre[0].length / this.rate; this.pre.shift(); }
        return { level, clip: null };
      }
      this.clip = [...this.pre]; this.clipSec = this.preSec; this.pre = []; this.preSec = 0;
      this.speechSec = 0; this.quietSec = 0;
    }
    this.clip.push(frame); this.clipSec += dt;
    if (loud) { this.speechSec += dt; this.quietSec = 0; } else this.quietSec += dt;

    const end =
      (this.quietSec >= CUT.pause && this.clipSec >= CUT.minClip) ||
      (this.clipSec >= CUT.softMax && this.quietSec >= CUT.shortPause) ||
      this.clipSec >= CUT.hardMax;
    return { level, clip: end ? this.take() : null };
  }

  /** Whatever is left when the person presses Stop. */
  flush(): Float32Array | null { return this.inClip ? this.take() : null; }

  private take(): Float32Array | null {
    const enough = this.speechSec >= CUT.minSpeech;
    const len = this.clip.reduce((n, f) => n + f.length, 0);
    const out = new Float32Array(len);
    let o = 0;
    for (const f of this.clip) { out.set(f, o); o += f.length; }
    this.clip = []; this.clipSec = 0; this.speechSec = 0; this.quietSec = 0;
    return enough ? out : null;
  }
}
