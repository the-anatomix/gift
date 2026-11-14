// 쪽지 접는 소리, 도장 소리, 펼칠 때 종소리. 음원 파일 없이 이 자리에서 만들어 낸다.
// 소리 끄기는 위쪽 버튼으로 한다(설정은 저장하지 않는다).
let ctx = null, muted = false;
const played = {};
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
function noise(dur, vol, freq, type = 'bandpass', at = 0) { // 걸러 낸 잡음 (종이 스치는 소리)
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(freq * 1.8, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(ctx.destination); s.start(t, Math.random() * 0.2, dur + 0.02);
}
const SOUNDS = {
  fold() { noise(0.28, 0.2, 2200); noise(0.07, 0.16, 5200, 'highpass', 0.24); },                                 // 종이 접기: 스윽, 착
  seal() { tone(170, 62, 0.16, 0.5, 'triangle'); noise(0.05, 0.2, 900, 'lowpass'); tone(1318, 1318, 0.5, 0.12, 'sine', 0.1); }, // 도장: 쿵, 띵
  tap() { tone(520, 420, 0.06, 0.12, 'triangle'); },                                                            // 잠긴 쪽지를 눌렀을 때
  open() { noise(0.3, 0.16, 1800); [784, 988, 1175, 1568].forEach((f, i) => tone(f, f, 0.5, 0.15, 'sine', 0.22 + i * 0.09)); }, // 펼치기: 스윽 + 종
  done() { tone(880, 880, 0.12, 0.16); tone(1318, 1318, 0.3, 0.14, 'sine', 0.1); },                              // 이뤘어요
};
export const sfx = {
  get muted() { return muted; }, played,
  play(name) {
    if (muted || document.hidden || !SOUNDS[name]) return;
    played[name] = (played[name] || 0) + 1;
    try { if (ac()) SOUNDS[name](); } catch (_) { /* 소리를 못 내도 쪽지는 그대로 */ }
  },
  setMuted(v) { muted = !!v; },
};
// 첫 손가락 입력 때 소리 장치를 깨워 둔다 (브라우저는 사용자가 누른 뒤에만 소리를 허락한다)
addEventListener('pointerdown', () => { if (!muted) { try { ac(); } catch (_) { /* 무시 */ } } }, { once: true });
