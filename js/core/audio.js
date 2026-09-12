// Audio system: pronunciation via Web Speech API (speechSynthesis, British English),
// with Web Audio API generated sound effects.
// Per spec: click-to-speak, stop previous on new, preload voices, TTS fallback is inherent.
import { Store } from './store.js';

let voices = [];
let preferredVoice = null;

function loadVoices() {
  if (typeof speechSynthesis === 'undefined') return;
  voices = speechSynthesis.getVoices() || [];
  // Prefer a British English voice.
  preferredVoice =
    voices.find((v) => /en-GB/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0] ||
    null;
  if (voices.length === 0) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }
}

if (typeof speechSynthesis !== 'undefined') {
  loadVoices();
}

let audioCtx = null;
function getCtx() {
  if (audioCtx) return audioCtx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  } catch (e) {
    audioCtx = null;
  }
  return audioCtx;
}

function beep(freq, start, dur, type = 'sine', gain = 0.05) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.02);
}

export const Audio = {
  // Preload: ensure voices are loaded (speechSynthesis can't truly preload audio,
  // but we warm the voice cache so first click is instant).
  preload() {
    loadVoices();
  },

  speak(text, opts = {}) {
    const settings = Store.getSettings();
    if (!settings.wordAudio) return;
    if (typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel(); // stop previous immediately
      const u = new SpeechSynthesisUtterance(text);
      if (preferredVoice) u.voice = preferredVoice;
      u.lang = (preferredVoice && preferredVoice.lang) || 'en-GB';
      u.rate = opts.rate || 0.95;
      u.pitch = 1;
      speechSynthesis.speak(u);
    } catch (e) {
      /* TTS fallback: if anything fails we simply no-op (no network needed). */
    }
  },

  sfx(type) {
    const settings = Store.getSettings();
    if (!settings.sfx) return;
    switch (type) {
      case 'click':
        beep(520, 0, 0.05, 'triangle', 0.04);
        break;
      case 'correct':
        beep(660, 0, 0.12, 'sine', 0.06);
        beep(880, 0.1, 0.16, 'sine', 0.06);
        break;
      case 'wrong':
        beep(180, 0, 0.22, 'sawtooth', 0.05);
        break;
      case 'win':
        beep(523, 0, 0.12, 'sine', 0.06);
        beep(659, 0.12, 0.12, 'sine', 0.06);
        beep(784, 0.24, 0.18, 'sine', 0.06);
        break;
      default:
        break;
    }
  },
};
