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

// background music: public/audio/bgm.mp3 (by Paul Yudin), looping quietly. Off unless you turn it on (its own
// button); the mute button silences it too
let musicOn = (() => { try { return localStorage.getItem('dacka.music') === '1'; } catch { return false; } })();
let music: HTMLAudioElement | null = null;
function startMusic() {
  if (muted || !musicOn) return;
  try {
    music ??= Object.assign(new Audio(`${import.meta.env.BASE_URL}audio/bgm.mp3`), { loop: true, volume: 0.28 });
    void music.play().catch(() => { /* blocked until the first click; retried then */ });
  } catch { /* audio unavailable */ }
}
function stopMusic() { music?.pause(); }

export const sfx = {
  /** starts the background music (call from a click/keypress so the browser allows it) */
  music: startMusic,
  /** wakes the sound engine up inside a tap, so phone browsers let later sounds play */
  unlock() { ac(); },
  /** silences the music while the game is paused */
  pauseMusic: stopMusic,
  /** school bell: ding-dong, twice */
  bell() { [0, 0.5].forEach((s) => { tone(988, s, 0.9, 0.12, 'triangle'); tone(784, s + 0.25, 1.0, 0.12, 'triangle'); }); },
  click() { tone(1200, 0, 0.05, 0.05, 'square'); },
  discover() { [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.35, 0.1)); },
  success() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.5, 0.12, 'triangle')); },
  friend() { [659, 880].forEach((f, i) => tone(f, i * 0.1, 0.4, 0.1)); },
  warn() { tone(196, 0, 0.35, 0.12, 'sawtooth'); tone(185, 0.12, 0.35, 0.1, 'sawtooth'); },
  /** an old desk phone ringing: one short trill */
  ring() { for (let i = 0; i < 10; i++) tone(i % 2 ? 840 : 960, i * 0.045, 0.05, 0.05, 'square'); },
  /** a little hop (the corridor run) */
  hop() { tone(520, 0, 0.12, 0.08, 'triangle'); tone(780, 0.06, 0.12, 0.06, 'triangle'); },
  /** bumping into something */
  bump() { tone(140, 0, 0.22, 0.16, 'square'); tone(90, 0.05, 0.25, 0.12, 'sine'); },
  isMuted: () => muted,
  musicOn: () => musicOn,
  /** turns the background music on or off (remembered) */
  toggleMusic() {
    musicOn = !musicOn;
    try { localStorage.setItem('dacka.music', musicOn ? '1' : '0'); } catch { /* ignore */ }
    if (musicOn) startMusic(); else stopMusic();
    return musicOn;
  },
  toggle() {
    muted = !muted;
    try { localStorage.setItem('dacka.muted', muted ? '1' : '0'); } catch { /* ignore */ }
    if (muted) stopMusic(); else { sfx.click(); startMusic(); }
    return muted;
  },
};
