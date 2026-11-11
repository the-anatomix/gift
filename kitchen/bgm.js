// 편지가 나올 때 흐르는 잔잔한 오르골 소리. 음원 파일 없이 이 자리에서 직접 연주한다(직접 지은 짧은 곡).
// 봉투를 누른 뒤에만 소리가 나고, 편지를 넣으면 잦아든다.
let ctx = null, master = null, timer = 0, next = 0, step = 0, on = false, muted = false;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const EIGHTH = 0.39; // 여덟 마디, 3/4 박자
const BARS = [ // 바장조: F, C/E, Dm, Bb, F/A, Gm, C, F
  [53, 60, 65, 69, 65, 60], [52, 60, 67, 72, 67, 60], [50, 57, 62, 65, 62, 57], [46, 53, 58, 62, 58, 53],
  [53, 57, 60, 65, 60, 57], [55, 58, 62, 67, 62, 58], [48, 55, 60, 64, 60, 55], [53, 60, 65, 69, 72, 77],
];
const TUNE = { 0: 81, 4: 84, 6: 79, 12: 77, 16: 81, 18: 74, 24: 77, 28: 84, 30: 82, 36: 79, 40: 76, 42: 77 }; // 윗선율 (칸 번호: 음)

function note(m, t, peak, len) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  g.connect(master);
  for (const [mul, vol, type] of [[1, 1, 'sine'], [2, 0.28, 'sine'], [4, 0.07, 'triangle']]) {
    const o = ctx.createOscillator(), v = ctx.createGain();
    o.type = type; o.frequency.value = hz(m) * mul; v.gain.value = vol;
    o.connect(v); v.connect(g); o.start(t); o.stop(t + len + 0.05);
  }
}
function schedule() {
  while (next < ctx.currentTime + 0.35) {
    const s = step % 48;
    note(BARS[(s / 6) | 0][s % 6], next, s % 6 === 0 ? 0.11 : 0.075, 1.7);
    if (TUNE[s]) note(TUNE[s], next, 0.15, 2.6);
    next += EIGHTH; step++;
  }
}
function setup() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0;
  const delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(); // 은은한 울림
  delay.delayTime.value = 0.29; fb.gain.value = 0.32; wet.gain.value = 0.22;
  master.connect(ctx.destination); master.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ctx.destination);
  return true;
}
export const bgm = {
  get playing() { return on; }, get muted() { return muted; },
  play() {
    if (on || muted) return;
    try {
      if (!ctx && !setup()) return;
      if (ctx.state === 'suspended') ctx.resume();
      on = true; step = 0; next = ctx.currentTime + 0.12;
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.6);
      schedule(); timer = setInterval(schedule, 110);
    } catch (_) { on = false; }
  },
  stop() {
    if (!on) return;
    on = false; clearInterval(timer);
    try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5); } catch (_) { /* 무시 */ }
  },
  setMuted(v) { muted = !!v; if (muted) this.stop(); },
};
document.addEventListener('visibilitychange', () => { if (document.hidden) bgm.stop(); });
window.__bgm = bgm;
