let actx: AudioContext | null = null;
let muted = false;

export const isMuted = () => muted;
export const setMuted = (m: boolean) => { muted = m; };

export function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, delay = 0) {
  if (muted) return;
  actx ||= new AudioContext();
  if (actx.state === 'suspended') void actx.resume();
  const t = actx.currentTime + delay;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination);
  o.start(t);
  o.stop(t + dur);
}

// Creates the AudioContext inside a click gesture so later sounds aren't blocked.
export const unlockAudio = () => tone(0.001, 0.001);

export const sfx = {
  tick: () => tone(1000, 0.05),
  turn: () => { tone(523, 0.1); tone(784, 0.18, 'square', 0.06, 0.1); },
  blip: () => tone(440, 0.08, 'triangle', 0.12),
  drum: () => { for (let i = 0; i < 6; i++) tone(110, 0.08, 'sawtooth', 0.08, i * 0.15); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.06, i * 0.12)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.05, i * 0.18)),
};
