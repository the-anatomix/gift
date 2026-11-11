// 만들 때 나는 효과음. 음원 파일 없이 이 자리에서 소리를 만들어 낸다.
// 소리 끄기는 위쪽 막대의 버튼으로 한다(설정은 저장하지 않는다).
let ctx = null, muted = false;
const last = {}, played = {};
function ac() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(f0, f1, dur, vol, type = 'sine', at = 0) { // 높이가 f0 에서 f1 로 바뀌는 짧은 음
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.03);
}
let noiseBuf = null;
function noise(dur, vol, freq, type = 'lowpass', at = 0) { // 걸러 낸 잡음 (써는 소리, 말랑한 소리)
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(ctx.destination); s.start(t, Math.random() * 0.3, dur + 0.02);
}
const SOUNDS = {
  knead() { noise(0.12, 0.22, 260 + Math.random() * 220); tone(150 + Math.random() * 40, 95, 0.1, 0.12); },   // 반죽: 말랑
  cut() { noise(0.06, 0.45, 2400, 'highpass'); tone(180, 70, 0.11, 0.5, 'triangle'); },                      // 자르기: 탁
  oven() { tone(110, 60, 0.22, 0.3, 'triangle'); noise(0.18, 0.1, 700); },                                     // 오븐 문
  ding() { tone(1568, 1568, 1.0, 0.26); tone(2349, 2349, 0.7, 0.12); },                                        // 다 구워짐: 띵
  dip() { tone(520, 170, 0.15, 0.32); noise(0.08, 0.06, 900); },                                               // 초콜릿에 퐁당
  plop() { tone(300, 640, 0.09, 0.26); tone(720, 320, 0.12, 0.16, 'sine', 0.08); },                            // 꺼낼 때 방울
  tick() { tone(1500 + Math.random() * 900, 1100, 0.035, 0.11, 'triangle'); },                                 // 토핑: 톡
  perfect() { [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, f, 0.24, 0.2, 'triangle', i * 0.07)); },      // PERFECT
  good() { [784, 988].forEach((f, i) => tone(f, f, 0.18, 0.16, 'triangle', i * 0.08)); },                      // GOOD
  pack() { tone(380, 920, 0.13, 0.24); noise(0.05, 0.16, 3200, 'highpass', 0.11); tone(1568, 1568, 0.3, 0.14, 'triangle', 0.16); }, // 포장 완료
};
const GAP = { knead: 150, tick: 55 }; // 문지르는 동안 너무 잦지 않게
export const sfx = {
  get muted() { return muted; }, played,
  play(name) {
    if (muted || document.hidden || !SOUNDS[name]) return;
    const now = performance.now();
    if (GAP[name] && now - (last[name] || 0) < GAP[name]) return;
    last[name] = now; played[name] = (played[name] || 0) + 1;
    try { if (ac()) SOUNDS[name](); } catch (_) { /* 소리를 못 내도 조작은 그대로 */ }
  },
  setMuted(v) { muted = !!v; },
};
// 첫 손가락 입력 때 소리 장치를 깨워 둔다 (브라우저는 사용자가 누른 뒤에만 소리를 허락한다)
addEventListener('pointerdown', () => { if (!muted) { try { ac(); } catch (_) { /* 무시 */ } } }, { once: true });
window.__sfx = sfx;
