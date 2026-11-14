// 효과음. 음원 파일 없이 WebAudio 로 직접 만들어 낸다.
//   tick()    : 카운트다운 "삑"
//   shutter() : 셔터 "찰칵" (짧은 잡음 두 번 + 낮은 툭)
let ac = null, on = true;

function ctx() {
  if (!on) return null;
  if (!ac) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { ac = new C(); } catch (_) { return null; }
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}
function tone(a, f, t, len, vol, type = 'sine') {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + len + 0.02);
}
function noise(a, t, len, vol, hp) {
  const n = Math.floor(a.sampleRate * len), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination); s.start(t);
}

export const sfx = {
  get on() { return on; },
  toggle() { on = !on; return on; },
  unlock() { ctx(); }, // 첫 터치 때 불러 소리를 열어 둔다
  tick() { const a = ctx(); if (a) tone(a, 880, a.currentTime, 0.12, 0.18); },
  shutter() {
    const a = ctx(); if (!a) return;
    const t = a.currentTime;
    noise(a, t, 0.045, 0.5, 2200);
    noise(a, t + 0.085, 0.07, 0.42, 1400);
    tone(a, 150, t, 0.09, 0.25, 'triangle');
  },
};
