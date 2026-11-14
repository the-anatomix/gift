// 효과음. 소리 파일 없이 WebAudio 로 그 자리에서 만들어 낸다(용량 0, 저작권 걱정 없음).
// 쓰는 법: import { sfx } from './sfx.js';  sfx('bite');               내가 낸 소리
//                                            sfx('bite', 아바타나 물체);  남이 낸 소리(거리에 따라 작게, 다른 층이면 더 작게)
// - 첫 누르기·키 입력 뒤에만 소리가 난다(브라우저 자동 재생 정책). 그 전의 요청은 기록만 하고 버린다. 소리가 2초쯤 없으면 소리 장치를 재워 두었다가 다음 소리에 깨운다
// - 같은 소리는 잠깐(GAP) 안에 다시 내지 않고, 한꺼번에 울리는 소리 수도 제한한다(VOICES)
// - 켜고 끄기와 음량은 기기에 기억한다(localStorage 'tree.sfx'). 단추는 mountSfxUI 가 "같이" 판에 넣는다
// - 기존 소리(오르골 play.js, 점등식 party.js, 불꽃놀이 sky.js, 초인종 app.js, 보이스·TV media.js)는 저마다 따로 내고 여기서 건드리지 않는다
// - 검사: window.__sfx.log 에 요청된 소리가 쌓인다 { n(이름), v(들리는 크기 0~1), far(남의 소리), played(실제로 냈는지) }
import { levelOf } from './path.js';

const KEY = 'tree.sfx', VOICES = 10, LOG_MAX = 400;
const conf = (() => { try { const c = JSON.parse(localStorage.getItem(KEY)); if (c && typeof c === 'object') return { on: c.on !== false, vol: Math.max(0, Math.min(1, Number(c.vol) || 0)) }; } catch (_) { /* 기억이 없으면 처음 값 */ } return { on: true, vol: 0.7 }; })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(conf)); } catch (_) { /* 기억하지 못해도 소리는 난다 */ } };

let ac = null, master = null, hiss = null, unlocked = false, ear = null;
const last = new Map(), ends = [], log = [];

function ctx() {
  if (ac || !unlocked) return ac;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor(); // 여러 소리가 겹쳐도 찢어지지 않게
    master = ac.createGain(); master.gain.value = conf.vol;
    master.connect(comp); comp.connect(ac.destination);
    hiss = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); // 바람·바삭·쉬익 소리의 바탕(1초)
    const d = hiss.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (_) { ac = null; }
  return ac;
}
function unlock() { unlocked = true; } // 소리 장치는 첫 소리를 낼 때 만든다
for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, { capture: true, passive: true });

/* ───────── 소리의 재료 ───────── */
// 음 하나: f → f2 로 미끄러지며 d 초 동안 사그라든다
function tone(o, t, f, d, v = 0.3, type = 'sine', f2 = 0, a = 0.006) {
  const osc = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + t;
  osc.type = type; osc.frequency.setValueAtTime(f, t0);
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  osc.connect(g); g.connect(o); osc.start(t0); osc.stop(t0 + d + 0.03);
}
// 걸러 낸 잡음: type(lowpass·bandpass·highpass) 을 f → f2 로 움직이며 d 초
function noise(o, t, d, v = 0.2, type = 'bandpass', f = 1000, f2 = 0, q = 1, a = 0.004) {
  const src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(), t0 = ac.currentTime + t;
  src.buffer = hiss; src.loop = true;
  fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t0);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + Math.min(a, d * 0.5)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  src.connect(fl); fl.connect(g); g.connect(o); src.start(t0, Math.random() * 0.5); src.stop(t0 + d + 0.03);
}
const N = { C6: 1046.5, E6: 1318.5, G6: 1568, C7: 2093, E7: 2637, G7: 3136 };
const chime = (o, t, fs, gap = 0.07, d = 0.5, v = 0.16) => fs.forEach((f, i) => { tone(o, t + i * gap, f, d, v); tone(o, t + i * gap, f * 2.01, d * 0.6, v * 0.25); });
const thud = (o, t, f = 140, v = 0.5) => { tone(o, t, f, 0.15, v, 'sine', f * 0.45); noise(o, t, 0.06, v * 0.35, 'lowpass', 600); };
const crunch = (o, t, v = 0.3) => { noise(o, t, 0.05, v, 'bandpass', 1900, 0, 0.8); noise(o, t + 0.015, 0.08, v * 0.7, 'lowpass', 750); };
const gulp = (o, t, v = 0.3) => { tone(o, t, 310, 0.07, v, 'sine', 170); tone(o, t + 0.075, 230, 0.09, v * 0.9, 'sine', 430); };
const clink = (o, t, v = 0.3) => { for (const [f, d, k] of [[2637, 0.7, 1], [3520, 0.5, 0.6], [4699, 0.35, 0.35], [6272, 0.2, 0.2]]) tone(o, t, f * (1 + (Math.random() - 0.5) * 0.01), d, v * k, 'sine', 0, 0.002); noise(o, t, 0.02, v * 0.5, 'highpass', 5000); };

// 이름 → [만드는 법(o, 크기), 길이(초), 다시 낼 수 있을 때까지(초)]
const S = {
  // 단추·판
  tap: [(o) => tone(o, 0, 700, 0.05, 0.1, 'triangle', 940), 0.06, 0.05],
  pop: [(o) => tone(o, 0, 820, 0.07, 0.12, 'sine', 1300), 0.08, 0.08],
  // 걷기·사다리·문
  step: [(o) => { noise(o, 0, 0.045, 0.1, 'lowpass', 380); tone(o, 0, 95, 0.05, 0.12, 'sine', 60); }, 0.06, 0.12],
  ladder: [(o) => { tone(o, 0, 330, 0.05, 0.16, 'triangle', 210); noise(o, 0, 0.03, 0.08, 'bandpass', 1400); }, 0.06, 0.1],
  door: [(o) => { tone(o, 0, 170, 0.35, 0.07, 'sawtooth', 250); noise(o, 0, 0.3, 0.05, 'bandpass', 900, 1500, 3); thud(o, 0.38, 110, 0.3); }, 0.6, 0.5],
  // 가구
  lift: [(o) => { tone(o, 0, 230, 0.11, 0.18, 'triangle', 440); noise(o, 0, 0.08, 0.05, 'bandpass', 900, 1800); }, 0.12, 0.1],
  place: [(o) => thud(o, 0, 150, 0.5), 0.16, 0.08],
  turn: [(o) => { noise(o, 0, 0.1, 0.12, 'bandpass', 1100, 2600, 2); tone(o, 0.08, 520, 0.03, 0.1, 'triangle'); }, 0.12, 0.08],
  remove: [(o) => { tone(o, 0, 430, 0.15, 0.16, 'triangle', 170); noise(o, 0.02, 0.12, 0.08, 'bandpass', 2000, 600); }, 0.17, 0.08],
  paint: [(o) => { noise(o, 0, 0.28, 0.14, 'bandpass', 700, 2600, 1.5, 0.05); }, 0.3, 0.15],
  // 트리
  orn: [(o) => { tone(o, 0, 1568, 0.4, 0.16); tone(o, 0, 2349, 0.3, 0.07); tone(o, 0, 4186, 0.12, 0.03); }, 0.4, 0.06],
  ornOff: [(o) => tone(o, 0, 1250, 0.09, 0.12, 'sine', 700), 0.1, 0.06],
  lights: [(o) => chime(o, 0, [N.E6, N.G6, N.C7, N.E7], 0.055, 0.3, 0.1), 0.5, 0.2],
  star: [(o) => { chime(o, 0, [N.C6, N.E6, N.G6, N.C7, N.E7], 0.09, 0.8, 0.16); noise(o, 0.3, 0.9, 0.04, 'highpass', 6000, 0, 1, 0.3); }, 1.3, 1],
  starOff: [(o) => chime(o, 0, [N.G6, N.E6, N.C6], 0.08, 0.3, 0.1), 0.5, 0.3],
  // 선물·달력·방명록
  gift: [(o) => { thud(o, 0, 180, 0.3); tone(o, 0.08, N.G6, 0.3, 0.1); }, 0.4, 0.2],
  giftOpen: [(o) => { for (let i = 0; i < 4; i++) noise(o, i * 0.07, 0.06, 0.14, 'highpass', 2500 + i * 500); tone(o, 0.3, 420, 0.08, 0.25, 'sine', 900); chime(o, 0.4, [N.C6, N.G6, N.C7, N.E7], 0.07, 0.6, 0.14); }, 1.2, 0.6],
  advent: [(o) => { noise(o, 0, 0.16, 0.16, 'highpass', 1800, 4500); thud(o, 0.14, 240, 0.2); chime(o, 0.22, [N.E6, N.G6, N.C7], 0.08, 0.5, 0.13); }, 0.9, 0.4],
  note: [(o) => { for (let i = 0; i < 3; i++) noise(o, i * 0.09, 0.07, 0.07, 'bandpass', 3200 + i * 300, 0, 4); }, 0.3, 0.3],
  // 눈
  snowScoop: [(o) => { noise(o, 0, 0.09, 0.2, 'lowpass', 1100); noise(o, 0.1, 0.11, 0.16, 'lowpass', 800); }, 0.22, 0.15],
  snowThrow: [(o) => noise(o, 0, 0.2, 0.16, 'bandpass', 500, 1700, 1.2, 0.05), 0.2, 0.1],
  snowHit: [(o) => { noise(o, 0, 0.2, 0.3, 'lowpass', 1600, 250); tone(o, 0, 120, 0.1, 0.25, 'sine', 70); }, 0.2, 0.08],
  snowRoll: [(o) => { noise(o, 0, 0.1, 0.1, 'lowpass', 900); noise(o, 0.06, 0.06, 0.06, 'bandpass', 2200, 0, 3); }, 0.14, 0.28],
  snowman: [(o) => { thud(o, 0, 130, 0.3); chime(o, 0.12, [N.C6, N.E6, N.G6, N.C7], 0.09, 0.6, 0.14); }, 0.9, 0.5],
  // 케이크 굽기·꾸미기
  pour: [(o) => { noise(o, 0, 0.55, 0.12, 'bandpass', 520, 300, 2, 0.08); for (let i = 0; i < 3; i++) tone(o, 0.08 + i * 0.15, 240 - i * 25, 0.09, 0.14, 'sine', 150); }, 0.6, 0.4],
  whisk: [(o) => { for (let i = 0; i < 6; i++) { noise(o, i * 0.085, 0.05, 0.11, 'bandpass', 2400 + (i % 2) * 700, 0, 3); tone(o, i * 0.085, 900 + (i % 2) * 200, 0.025, 0.04, 'triangle'); } }, 0.55, 0.4],
  ovenOn: [(o) => { tone(o, 0, 1200, 0.025, 0.14, 'square'); tone(o, 0.05, 105, 0.6, 0.1, 'sawtooth', 120, 0.15); noise(o, 0.05, 0.6, 0.03, 'lowpass', 400, 0, 1, 0.2); }, 0.7, 0.4],
  ovenDing: [(o) => { tone(o, 0, 2093, 1.1, 0.26, 'sine', 0, 0.002); tone(o, 0, 4186, 0.5, 0.08, 'sine', 0, 0.002); tone(o, 0, 6271, 0.2, 0.03); }, 1.1, 0.5],
  sizzle: [(o) => { noise(o, 0, 0.7, 0.1, 'highpass', 4200, 0, 1, 0.05); for (let i = 0; i < 5; i++) noise(o, Math.random() * 0.6, 0.02, 0.12, 'highpass', 6000); }, 0.7, 0.4],
  cream: [(o) => { noise(o, 0, 0.24, 0.14, 'bandpass', 560, 240, 2.5, 0.04); tone(o, 0, 190, 0.2, 0.1, 'sine', 115, 0.04); }, 0.25, 0.1],
  top: [(o) => { tone(o, 0, 540, 0.08, 0.2, 'sine', 250); noise(o, 0, 0.03, 0.05, 'lowpass', 900); }, 0.09, 0.06],
  dough: [(o) => { noise(o, 0, 0.16, 0.16, 'lowpass', 320, 140, 1, 0.03); tone(o, 0, 120, 0.14, 0.16, 'sine', 78, 0.02); }, 0.2, 0.12],
  sauce: [(o) => { noise(o, 0, 0.22, 0.13, 'bandpass', 760, 320, 3, 0.05); tone(o, 0.02, 240, 0.12, 0.05, 'sine', 150, 0.03); }, 0.25, 0.12],
  sprinkle: [(o) => { for (let i = 0; i < 5; i++) noise(o, i * 0.035, 0.03, 0.09, 'highpass', 3200 + (i % 3) * 600, 0, 1); }, 0.22, 0.12],
  wipe: [(o) => noise(o, 0, 0.3, 0.12, 'bandpass', 1500, 500, 1.5, 0.05), 0.3, 0.2],
  candle: [(o) => { noise(o, 0, 0.13, 0.14, 'highpass', 3200, 5200); noise(o, 0.12, 0.25, 0.05, 'bandpass', 700, 400, 1, 0.05); }, 0.4, 0.1],
  blow: [(o) => { noise(o, 0, 0.45, 0.2, 'bandpass', 1000, 480, 0.9, 0.09); }, 0.45, 0.2],
  hooray: [(o) => { chime(o, 0, [N.C6, N.E6, N.G6, N.C7], 0.1, 0.5, 0.15); chime(o, 0.42, [N.E7, N.G7], 0.1, 0.9, 0.12); }, 1.4, 1],
  carry: [(o) => { tone(o, 0, 260, 0.1, 0.14, 'triangle', 390); tone(o, 0.05, 1900, 0.06, 0.05); }, 0.12, 0.2],
  setDown: [(o) => { thud(o, 0, 200, 0.28); tone(o, 0.01, 1700, 0.05, 0.06); }, 0.16, 0.2],
  // 먹기·마시기
  bite: [(o) => { crunch(o, 0, 0.3); for (const t of [0.24, 0.44]) noise(o, t, 0.07, 0.09, 'lowpass', 600); }, 0.5, 0.25],
  crisp: [(o) => { for (let i = 0; i < 4; i++) noise(o, i * 0.035 + Math.random() * 0.01, 0.025, 0.26 - i * 0.04, 'highpass', 3000 + Math.random() * 2500); noise(o, 0, 0.08, 0.14, 'bandpass', 1500); for (const t of [0.26, 0.45]) crunch(o, t, 0.1); }, 0.55, 0.25],
  soft: [(o) => { noise(o, 0, 0.09, 0.14, 'lowpass', 700); tone(o, 0, 260, 0.08, 0.1, 'sine', 180); for (const t of [0.25, 0.45]) noise(o, t, 0.07, 0.06, 'lowpass', 500); }, 0.5, 0.25],
  cheese: [(o) => { crunch(o, 0, 0.16); tone(o, 0.05, 280, 0.42, 0.1, 'sine', 640, 0.1); tone(o, 0.05, 283, 0.42, 0.06, 'triangle', 655, 0.1); tone(o, 0.48, 900, 0.03, 0.1, 'triangle'); }, 0.55, 0.25],
  lick: [(o) => { noise(o, 0, 0.16, 0.1, 'bandpass', 1800, 3200, 3, 0.05); }, 0.2, 0.25],
  snap: [(o) => { tone(o, 0, 1500, 0.03, 0.26, 'square', 700, 0.001); noise(o, 0, 0.025, 0.2, 'highpass', 3000); noise(o, 0.2, 0.07, 0.07, 'lowpass', 600); }, 0.3, 0.25],
  peel: [(o) => { noise(o, 0, 0.3, 0.12, 'bandpass', 2600, 1200, 4, 0.06); }, 0.3, 0.25],
  gulp: [(o) => { gulp(o, 0, 0.3); gulp(o, 0.36, 0.22); }, 0.55, 0.25],
  slurp: [(o) => { noise(o, 0, 0.3, 0.12, 'bandpass', 1300, 3400, 5, 0.06); gulp(o, 0.34, 0.22); }, 0.5, 0.25],
  straw: [(o) => { noise(o, 0, 0.28, 0.1, 'bandpass', 900, 1500, 6, 0.05); tone(o, 0, 180, 0.28, 0.05, 'sawtooth', 220, 0.05); gulp(o, 0.32, 0.2); }, 0.5, 0.25],
  fizz: [(o) => { noise(o, 0, 0.9, 0.1, 'highpass', 5500, 0, 1, 0.03); for (let i = 0; i < 7; i++) tone(o, Math.random() * 0.6, 2500 + Math.random() * 3000, 0.02, 0.04); }, 0.9, 0.3],
  cupDown: [(o) => { tone(o, 0, 1250, 0.05, 0.12, 'sine', 0, 0.002); thud(o, 0, 210, 0.2); }, 0.16, 0.2],
  glassDown: [(o) => { tone(o, 0, 2400, 0.16, 0.1, 'sine', 0, 0.002); tone(o, 0, 3650, 0.08, 0.04); thud(o, 0, 230, 0.12); }, 0.18, 0.2],
  ahh: [(o) => noise(o, 0, 0.4, 0.08, 'bandpass', 1300, 700, 1.2, 0.1), 0.4, 0.3],
  // 냉장고·와인
  fridgeOpen: [(o) => { noise(o, 0, 0.07, 0.2, 'lowpass', 350); tone(o, 0, 85, 0.1, 0.25, 'sine', 60); tone(o, 0.03, 900, 0.03, 0.05, 'triangle'); tone(o, 0.1, 60, 0.5, 0.05, 'sawtooth', 0, 0.1); }, 0.6, 0.2],
  fridgeShut: [(o) => { thud(o, 0, 95, 0.45); noise(o, 0, 0.03, 0.12, 'bandpass', 1800); }, 0.16, 0.2],
  cellarOpen: [(o) => { tone(o, 0, 1100, 0.03, 0.1, 'triangle'); noise(o, 0.02, 0.2, 0.06, 'bandpass', 800, 1300, 3); for (const [t, f] of [[0.12, 2900], [0.2, 3400]]) tone(o, t, f, 0.25, 0.05); }, 0.45, 0.2],
  cellarShut: [(o) => { thud(o, 0, 120, 0.3); tone(o, 0.01, 2700, 0.14, 0.05); }, 0.16, 0.2],
  cork: [(o) => { noise(o, 0, 0.12, 0.05, 'bandpass', 2500, 0, 6); tone(o, 0.12, 520, 0.09, 0.6, 'sine', 110, 0.002); noise(o, 0.12, 0.05, 0.4, 'bandpass', 1100, 0, 0.8, 0.002); noise(o, 0.18, 0.9, 0.09, 'highpass', 5200, 0, 1, 0.05); }, 1.1, 0.5],
  wine: [(o) => { noise(o, 0, 0.95, 0.07, 'bandpass', 650, 1500, 3, 0.1); for (let i = 0; i < 5; i++) { tone(o, 0.05 + i * 0.17, 330 + i * 45, 0.07, 0.16, 'sine', 240 + i * 45); tone(o, 0.12 + i * 0.17, 250 + i * 45, 0.07, 0.1, 'sine', 420 + i * 45); } }, 1.0, 0.5],
  clink: [(o) => clink(o, 0, 0.32), 0.7, 0.15],
  cheers: [(o) => { clink(o, 0, 0.34); clink(o, 0.07, 0.16); chime(o, 0.12, [N.E7, N.G7], 0.08, 0.5, 0.05); }, 0.8, 0.5],
  // 방 안 놀이·몸짓
  dart: [(o) => noise(o, 0, 0.14, 0.14, 'bandpass', 900, 2600, 1.5, 0.03), 0.15, 0.1],
  clack: [(o) => { tone(o, 0, 1900, 0.03, 0.18, 'sine', 1500, 0.001); noise(o, 0, 0.015, 0.12, 'bandpass', 3200); }, 0.04, 0.05], // 당구공끼리 딱 (gameroom.js)
  dartHit: [(o) => { tone(o, 0, 190, 0.09, 0.4, 'sine', 90, 0.002); noise(o, 0, 0.03, 0.25, 'bandpass', 2200); }, 0.1, 0.08],
  clap: [(o) => { for (const t of [0, 0.19, 0.38]) { noise(o, t, 0.035, 0.26, 'bandpass', 1500, 0, 0.7, 0.002); noise(o, t, 0.02, 0.1, 'highpass', 4000); } }, 0.45, 0.3],
  jump: [(o) => { tone(o, 0, 300, 0.14, 0.14, 'sine', 620); thud(o, 0.5, 120, 0.25); }, 0.65, 0.3],
  whoosh: [(o) => noise(o, 0, 0.25, 0.1, 'bandpass', 600, 1800, 1.2, 0.08), 0.25, 0.2],
  seat: [(o) => { noise(o, 0, 0.1, 0.1, 'lowpass', 520, 220, 1, 0.03); tone(o, 0.02, 210, 0.08, 0.08, 'triangle', 150); tone(o, 0.11, 96, 0.13, 0.12, 'sine', 68); }, 0.25, 0.3], // 접이식 의자: 삐걱 하고 내려앉는다
  bed: [(o) => { noise(o, 0, 0.25, 0.14, 'lowpass', 700, 300, 1, 0.05); tone(o, 0.03, 110, 0.14, 0.14, 'sine', 70); }, 0.25, 0.3],
  cloth: [(o) => { noise(o, 0, 0.14, 0.1, 'bandpass', 1800, 900, 1.5, 0.04); noise(o, 0.16, 0.12, 0.08, 'bandpass', 1200, 2200, 1.5, 0.04); }, 0.3, 0.3],
  // 비행 슈트의 빛줄기 (beam.js), 루돌프 썰매 (sleigh.js)
  beam: [(o) => { tone(o, 0, 240, 0.09, 0.16, 'triangle', 980); tone(o, 0.07, 1500, 0.3, 0.18, 'sawtooth', 320, 0.004); tone(o, 0.07, 2250, 0.22, 0.07, 'sine', 700); noise(o, 0.07, 0.28, 0.1, 'bandpass', 2600, 800, 2, 0.01); }, 0.45, 0.3],
  beamHit: [(o) => { noise(o, 0, 0.09, 0.14, 'highpass', 4200); chime(o, 0.01, [N.G7, N.E7, N.C7], 0.045, 0.28, 0.06); }, 0.4, 0.25],
  bells: [(o) => { for (const [t, f] of [[0, 3520], [0.025, 4186], [0.13, 3729], [0.155, 4435]]) { tone(o, t, f, 0.17, 0.07, 'sine', 0, 0.002); tone(o, t, f * 1.52, 0.09, 0.03, 'sine', 0, 0.002); } noise(o, 0, 0.03, 0.04, 'highpass', 6000); }, 0.35, 0.3],
  sleighOn: [(o) => { noise(o, 0, 0.4, 0.09, 'bandpass', 500, 1700, 1.2, 0.1); chime(o, 0.05, [N.C6, N.E6, N.G6, N.C7], 0.08, 0.5, 0.1); }, 0.9, 0.6],
};
export const SFX_NAMES = Object.keys(S);
// 효과음 설정 (다른 소리가 따를 때 쓴다: 좌석에 앉아 듣는 스크린 소리)
export const sfxHear = () => (conf.on ? conf.vol : 0);

// 소리가 난 곳 → 들리는 크기(0~1). 가까우면 1, 멀수록 작게, 다른 층이면 더 작게
function nearness(src) {
  const me = ear && ear();
  if (!me || !src) return 1;
  let x, z, lv;
  if (src.matrixWorld && typeof src.updateWorldMatrix === 'function') { src.updateWorldMatrix(true, false); x = src.matrixWorld.elements[12]; z = src.matrixWorld.elements[14]; lv = levelOf(x); } // 물체(three.js)
  else if (Number.isFinite(src.x) && Number.isFinite(src.z)) { x = src.x; z = src.z; lv = Number.isInteger(src.level) ? src.level : levelOf(x); }
  else return 0.6;
  if (lv !== me.level) return 0.12;
  const d = Math.hypot(x - me.x, z - me.z);
  return Math.max(0.1, Math.min(1, 1 / (1 + (d / 2.4) * (d / 2.4))));
}

// 소리가 한동안 없으면 소리 장치를 재운다 (켜 둔 채로 두면 조용할 때도 기기가 계속 일한다)
let napT = 0;
function nap() {
  const now = performance.now() / 1000;
  if (!ac || ac.state !== 'running') return;
  if (ends.some((t) => t > now - 1)) { napT = setTimeout(nap, 1500); return; }
  ac.suspend().catch(() => {});
}

// 소리를 낸다. src 가 있으면 남이(또는 떨어진 곳에서) 낸 소리, vol 은 덧곱하는 크기
export function sfx(name, src = null, vol = 1) {
  const def = S[name];
  if (!def) return false;
  const k = (src ? nearness(src) * 0.8 : 1) * vol, now = performance.now() / 1000;
  const rec = { n: name, v: +k.toFixed(3), far: !!src, played: false };
  log.push(rec); if (log.length > LOG_MAX) log.shift();
  if (!conf.on || conf.vol <= 0 || k < 0.03) return false;
  const key = src ? name + '~' : name; // 내 소리와 남의 소리는 따로 센다
  if (now - (last.get(key) || -9) < def[2]) return false; // 같은 소리가 겹쳐 시끄럽지 않게
  for (let i = ends.length - 1; i >= 0; i--) if (ends[i] <= now) ends.splice(i, 1);
  if (ends.length >= VOICES) return false;
  last.set(key, now);
  rec.played = true; // 낼 차례가 됐다 (아직 화면을 누르지 않았으면 실제 소리는 나지 않는다)
  const a = ctx();
  if (!a) return false;
  if (a.state !== 'running') a.resume().catch(() => {}); // 쉬고 있었으면 깨운다 (예약해 둔 소리는 깨어나면서 난다)
  clearTimeout(napT); napT = setTimeout(nap, (def[1] + 2) * 1000);
  try {
    const g = a.createGain(); g.gain.value = k; g.connect(master);
    def[0](g);
    ends.push(now + def[1]);
    setTimeout(() => { try { g.disconnect(); } catch (_) { /* 이미 끊겼다 */ } }, (def[1] + 1.5) * 1000);
  } catch (_) { return false; }
  return true;
}
sfx.listen = (fn) => { ear = fn; };
sfx.setOn = (on) => { conf.on = !!on; save(); paint(); };
sfx.setVol = (v) => { conf.vol = Math.max(0, Math.min(1, Number(v) || 0)); if (master) master.gain.value = conf.vol; save(); paint(); };
Object.defineProperties(sfx, { on: { get: () => conf.on }, vol: { get: () => conf.vol } });

/* ───────── 방의 변화(dispatch 를 지난 op)에 맞는 소리. app.js 가 한 줄로 부른다 ───────── */
const OPS = {
  put: 'place', move: 'place', del: 'remove', orn: 'orn', ornDel: 'ornOff', lights: 'lights', wall: 'paint', floor: 'paint',
  pzTop: 'top', pzBake: 'ovenDing', pzClear: 'wipe', pzTake: 'carry', pzDrop: 'setDown',
  cakeCream: 'cream', cakeTop: 'top', cakeClear: 'wipe', cakeLit: 'candle', cakeBlow: 'blow', cakeTake: 'carry', cakeDrop: 'setDown', cakeBake: 'ovenDing', cakeEat: 'bite',
  note: 'note', adv: 'advent', gift: 'gift', giftOpen: 'giftOpen', snowman: 'snowman',
};
// from = 'me' 따위(내가 한 일) 또는 'peer'(친구가 한 일). where(op) → 그 일이 일어난 곳(물체나 { x, z }), 모르면 null
export function sfxOp(op, from, where) {
  if (!op || from === 'load') return;
  const name = op.t === 'star' ? (op.on ? 'star' : 'starOff') : op.t === 'pz' ? { dough: 'dough', sauce: 'sauce', cheese: 'sprinkle' }[op.a] : OPS[op.t];
  if (!name) return;
  if (from !== 'peer') { sfx(name); return; }
  sfx(name, (where && where(op)) || {});
}

/* ───────── 걷는 소리와 사다리 (app.js 의 frame 이 부른다) ───────── */
const walk = new WeakMap();
export function sfxWalk(dt, me, others) {
  const one = (a, mine) => {
    let w = walk.get(a); if (!w) { w = { t: 0, r: 0 }; walk.set(a, w); }
    if (a.hop && a.hop.on) { if ((w.r -= dt) <= 0) { w.r = 0.28; sfx('ladder', mine ? null : a, mine ? 0.8 : 0.6); } w.t = 0.1; return; }
    w.r = 0;
    if (!a.moving || a.fly || a.rest || (a.root && !a.root.visible)) { w.t = 0.12; return; }
    if ((w.t -= dt) <= 0) { w.t = 0.29; sfx('step', mine ? null : a, mine ? 0.55 : 0.4); } // 발걸음은 살짝만
  };
  one(me, true);
  if (others) for (const a of others) one(a, false);
}

/* ───────── 단추 누름: 화면의 모든 단추에 가볍게. 따로 소리가 나는 단추는 뺀다 ───────── */
const BTN = { gTurn: null, gDone: null, gDel: null, act: null, playGo: null, playEat: null, sfxOn: null, bell: null };
document.addEventListener('click', (e) => {
  const b = e.target && e.target.closest && e.target.closest('button, [role=button], #tabs button');
  if (!b || b.disabled) return;
  if (b.classList.contains('fd')) return; // 냉장고에서 꺼내는 소리가 따로 난다
  const n = b.id in BTN ? BTN[b.id] : 'tap';
  if (n) sfx(n);
}, true);

/* ───────── 켜고 끄기 단추와 음량 ("같이" 판 맨 아래 줄) ───────── */
let ui = null;
function paint() {
  if (!ui) return;
  ui.btn.setAttribute('aria-pressed', String(conf.on));
  ui.btn.textContent = conf.on && conf.vol > 0 ? '🔊 효과음 켬' : '🔇 효과음 끔';
  ui.range.value = String(Math.round(conf.vol * 100));
  ui.range.disabled = !conf.on;
}
export function mountSfxUI(parent) {
  if (ui || !parent) return;
  const st = document.createElement('style');
  st.textContent = `#sfxRow{gap:10px}#sfxOn{flex:none;min-width:118px}#sfxOn[aria-pressed=false]{color:var(--sub)}
#sfxVol{flex:1;min-width:0;height:44px;margin:0;accent-color:var(--choc)}`;
  document.head.appendChild(st);
  const row = document.createElement('div'); row.className = 'row'; row.id = 'sfxRow';
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.id = 'sfxOn'; btn.setAttribute('aria-label', '효과음 켜고 끄기');
  const range = document.createElement('input'); range.type = 'range'; range.id = 'sfxVol'; range.min = '0'; range.max = '100'; range.step = '5'; range.setAttribute('aria-label', '효과음 크기');
  btn.addEventListener('click', () => { sfx.setOn(!conf.on); if (conf.on && conf.vol <= 0) sfx.setVol(0.7); sfx('pop'); });
  range.addEventListener('input', () => sfx.setVol(Number(range.value) / 100));
  range.addEventListener('change', () => sfx('orn'));
  row.append(btn, range); parent.appendChild(row);
  ui = { btn, range };
  paint();
}

window.__sfx = {
  log, names: SFX_NAMES,
  get on() { return conf.on; }, get vol() { return conf.vol; }, get unlocked() { return unlocked; }, get state() { return ac ? ac.state : null; },
  get voices() { const now = performance.now() / 1000; return ends.filter((t) => t > now).length; },
  clear() { log.length = 0; last.clear(); ends.length = 0; },
  heard: (n) => log.filter((r) => r.n === n).length,
  setOn: sfx.setOn, setVol: sfx.setVol, play: sfx,
};
