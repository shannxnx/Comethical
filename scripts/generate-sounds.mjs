// Generates the small UI sound effects in assets/sounds as 16-bit mono WAV files.
// Synthesised here so the project ships no third-party audio. Run: npm run sounds
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 22050;
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/sounds');
mkdirSync(out, { recursive: true });

/** notes: [frequencyHz, startSec, durationSec, gain] */
function render(notes, totalSec) {
  const samples = new Float32Array(Math.ceil(totalSec * SAMPLE_RATE));
  for (const [freq, start, dur, gain] of notes) {
    const s0 = Math.floor(start * SAMPLE_RATE);
    const n = Math.floor(dur * SAMPLE_RATE);
    for (let i = 0; i < n && s0 + i < samples.length; i++) {
      const t = i / SAMPLE_RATE;
      const attack = Math.min(1, t / 0.008);
      const release = Math.exp(-4.5 * (t / dur));
      // Sine with a soft second harmonic for a rounded "game" tone.
      const v = Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t);
      samples[s0 + i] += v * gain * attack * release;
    }
  }
  return samples;
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const sounds = {
  // Rising major third: bright, short.
  correct: render([[659.25, 0, 0.12, 0.35], [830.61, 0.08, 0.2, 0.35]], 0.32),
  // Soft low two-note fall: gentle, not punishing.
  incorrect: render([[392.0, 0, 0.16, 0.3], [329.63, 0.12, 0.24, 0.3]], 0.4),
  // Arpeggio for streak milestones.
  milestone: render([[523.25, 0, 0.12, 0.3], [659.25, 0.08, 0.12, 0.3], [783.99, 0.16, 0.12, 0.3], [1046.5, 0.24, 0.3, 0.3]], 0.6),
};

for (const [name, samples] of Object.entries(sounds)) {
  writeFileSync(resolve(out, `${name}.wav`), toWav(samples));
}
console.log(`Wrote ${Object.keys(sounds).length} sounds to assets/sounds`);
