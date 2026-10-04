// Tiny synthesized sound effects (no asset files). The school bell is the game's signature sound (GDD §17).
let ctx: AudioContext | null = null;
let muted = (() => { try { return localStorage.getItem('dacka.muted') === '1'; } catch { return false; } })();

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, vol = 0.15, type: OscillatorType = 'sine') {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

// background music: public/audio/bgm.mp3 (by Paul Yudin), looping quietly; the mute button covers it too
let music: HTMLAudioElement | null = null;
function startMusic() {
  if (muted) return;
  try {
    music ??= Object.assign(new Audio(`${import.meta.env.BASE_URL}audio/bgm.mp3`), { loop: true, volume: 0.28 });
    void music.play().catch(() => { /* blocked until the first click; retried then */ });
  } catch { /* audio unavailable */ }
}
function stopMusic() { music?.pause(); }

export const sfx = {
  /** starts the background music (call from a click/keypress so the browser allows it) */
  music: startMusic,
  /** school bell: ding-dong, twice */
  bell() { [0, 0.5].forEach((s) => { tone(988, s, 0.9, 0.12, 'triangle'); tone(784, s + 0.25, 1.0, 0.12, 'triangle'); }); },
  click() { tone(1200, 0, 0.05, 0.05, 'square'); },
  discover() { [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.35, 0.1)); },
  success() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.5, 0.12, 'triangle')); },
  friend() { [659, 880].forEach((f, i) => tone(f, i * 0.1, 0.4, 0.1)); },
  warn() { tone(196, 0, 0.35, 0.12, 'sawtooth'); tone(185, 0.12, 0.35, 0.1, 'sawtooth'); },
  isMuted: () => muted,
  toggle() {
    muted = !muted;
    try { localStorage.setItem('dacka.muted', muted ? '1' : '0'); } catch { /* ignore */ }
    if (muted) stopMusic(); else { sfx.click(); startMusic(); }
    return muted;
  },
};
