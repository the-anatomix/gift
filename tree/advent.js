// 어드벤트 달력 (12월 1일 ~ 25일). 매일 한 칸씩 열면 그 방에 그날의 특별한 것이 풀린다.
//   달력은 벽에 붙여 두는 얇은 가구(catalog.js 의 'advent')다. 누르거나 그 앞에서 스페이스바를 누르면 아래 판에 1~25 칸이 열린다.
//   12월 d 일이 되면 d 번 칸을 열 수 있다(지나간 날 칸도). 12월이 아니면 새로 열 수 없고 12월 1일까지 남은 날을 보여 준다.
//   칸을 여는 것은 방의 상태(state.js 의 { t: 'adv', d, name, at })라서 저장도, 같이 있는 사람에게 전하는 것도 다른 변화와 같은 길로 간다.
//   꾸밀 수 있는 사람만 연다. 열면 모두의 화면에 작은 연출(상자가 열리고 반짝이)과 알림이 뜬다.
//   풀린 것(catalog.js 에서 day 가 붙은 가구·장식·전구·벽지·바닥)은 고르는 목록에 🔒 로 보이다가 풀리면 쓸 수 있다.
// 이 파일에는 특별 가구·장식의 모양도 있다(furniture.js·decor.js 에 더한다).
// app.js 가 넘겨주는 창구 K:
//   key, store, toast, op(변화) → 받아들였는지, load(변화) → 저장된 방을 열 듯 조용히 넣기, canEdit(), defName(), S() → 방의 상태,
//   play → play.js 가 만든 것, close(), itemObj(id) → 가구 모양, scene, dirty(), findSpot(k, r, x, z) → 놓을 수 있는 칸
import { THREE, M, put, rbox, cyl, ball } from './kit.js';
import { X0, Z0, CELL } from './path.js';
import { ADVENT, ADVENT_LISTS, NOTE, STARTER_UP } from './catalog.js';
import { cleanWords, lockDay } from './state.js';
import { addShape } from './furniture.js';
import { addOrnament } from './decor.js';

// 지금 시각. 검사에서는 window.__now 로 날짜를 바꾼다 (날짜는 그 사람 기기의 현지 시간)
const now = () => (typeof window.__now === 'function' ? window.__now() : Date.now());
const $ = (id) => document.getElementById(id);
const DAY = 864e5;
function today() { const t = new Date(now()); return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() }; }
// 지금 열 수 있는 마지막 칸 (12월이 아니면 0. 26일부터는 25)
export function openTo() { const t = today(); return t.m === 11 ? Math.min(25, t.d) : 0; }
// 오늘부터 그해 12월 day 일까지 남은 날 (지났으면 0 이하)
export function daysTo(day) { const t = today(); return Math.round((new Date(t.y, 11, day) - new Date(t.y, t.m, t.d)) / DAY); }
const dLabel = (n) => (n > 0 ? `D-${n}` : 'D-day');
const prize = (d) => ADVENT[d - 1];

/* ───────── 특별 가구의 모양 (도형만으로. 앞쪽이 +z, 바닥이 y = 0) ───────── */
const lit = (hex) => new THREE.MeshBasicMaterial({ color: hex });
const RED = 0xD23A30, GREEN = 0x2F8F5F, GOLD = 0xE7B441, WHITE = 0xFFFAF2, WOOD = 0xC99A6B, WOOD_D = 0x8A5F3F, DARK = 0x2B2420, BROWN = 0x9A6A44;
function box(g, w, h, d, x, y, z, col, band) { // 리본 두른 선물 상자
  put(rbox(w, h, d, 0.02), col, x, y + h / 2, z, g);
  put(new THREE.BoxGeometry(w + 0.01, h + 0.006, Math.min(0.06, d * 0.25)), band, x, y + h / 2, z, g, false);
  put(new THREE.BoxGeometry(Math.min(0.06, w * 0.25), h + 0.006, d + 0.01), band, x, y + h / 2, z, g, false);
  for (const s of [-1, 1]) put(ball(0.045, 8, 6), band, x + 0.04 * s, y + h + 0.025, z, g).scale.set(1.1, 0.7, 0.7);
}
// 달력 판 그림: 5 × 5 칸. 연 칸에는 풀린 것의 그림, 오늘 열 수 있는 칸은 금빛 테. 모든 달력이 한 장을 같이 쓴다
const calCanvas = document.createElement('canvas');
calCanvas.width = 512; calCanvas.height = 600;
const calTex = new THREE.CanvasTexture(calCanvas);
calTex.colorSpace = THREE.SRGBColorSpace; calTex.anisotropy = 4;
const calMat = new THREE.MeshLambertMaterial({ map: calTex });
const DOORS = ['#C8443A', '#2F8F5F', '#E0AE3A', '#3E6FC4', '#B5523F'];
function drawCalendar(S) {
  const g = calCanvas.getContext('2d'), W = 512, top = 92, cw = 96, ch = 96, gap = 5, x0 = (W - (cw * 5 + gap * 4)) / 2, to = openTo();
  g.fillStyle = '#F6EEDD'; g.fillRect(0, 0, W, 600);
  g.fillStyle = '#C8443A'; g.fillRect(0, 0, W, 78);
  g.fillStyle = '#FFF4E0'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ADVENT 12', W / 2, 42);
  for (let k = 0; k < 25; k++) {
    const d = k + 1, x = x0 + (k % 5) * (cw + gap), y = top + Math.floor(k / 5) * (ch + gap), o = S && S.adv && S.adv.get(d);
    if (o) { // 연 칸: 문이 열려 안이 보인다
      g.fillStyle = '#FFFCF5'; g.fillRect(x, y, cw, ch);
      g.font = '50px sans-serif'; g.fillStyle = '#000'; g.fillText(prize(d).icon, x + cw / 2, y + ch / 2 + 6);
      g.font = 'bold 18px sans-serif'; g.fillStyle = '#8A7868'; g.fillText(String(d), x + 14, y + 14);
    } else {
      g.fillStyle = DOORS[(k * 3) % DOORS.length]; g.fillRect(x, y, cw, ch);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 6, y + 6, cw - 12, ch - 12);
      g.font = 'bold 40px sans-serif'; g.fillStyle = '#FFF8EA'; g.fillText(String(d), x + cw / 2, y + ch / 2 + 2);
      if (d <= to) { g.strokeStyle = '#FFD84A'; g.lineWidth = 8; g.strokeRect(x + 4, y + 4, cw - 8, ch - 8); } // 열 수 있는데 아직 안 연 칸
    }
  }
  calTex.needsUpdate = true;
}
drawCalendar(null);

addShape('advent', (g) => { // 2 × 1, 뒤쪽 벽에 붙여 세운 얇은 판. 앞(+z)에서 본다
  for (const s of [-1, 1]) put(cyl(0.025, 0.03, 0.86, 8), WOOD_D, 0.36 * s, 0.43, -0.2, g);
  put(rbox(0.96, 1.1, 0.05, 0.02), WOOD_D, 0, 1.38, -0.21, g);
  put(new THREE.PlaneGeometry(0.88, 1.03), calMat, 0, 1.36, -0.183, g, false).receiveShadow = false;
  put(rbox(1.02, 0.1, 0.12, 0.04), M(0x2F7D56, true), 0, 1.95, -0.19, g); // 위의 풀장식
  for (const x of [-0.4, -0.13, 0.13, 0.4]) put(ball(0.035, 8, 6), x % 0.26 ? GOLD : RED, x, 1.97, -0.12, g, false);
  for (const s of [-1, 1]) put(ball(0.06, 10, 8), RED, 0.07 * s, 2.0, -0.12, g).scale.set(1.2, 0.75, 0.6); // 리본
});
addShape('deer', (g) => { // 루돌프 인형: 앉아 있는 갈색 사슴, 빨간 코
  put(ball(0.2, 14, 10), BROWN, 0, 0.22, -0.02, g).scale.set(1, 0.95, 1.1);
  put(ball(0.11, 12, 8), 0xE9D3B4, 0, 0.22, 0.14, g).scale.set(1, 1.1, 0.5);
  for (const s of [-1, 1]) { put(cyl(0.05, 0.05, 0.16, 8), BROWN, 0.11 * s, 0.07, 0.15, g).rotation.x = Math.PI / 2; put(ball(0.05, 8, 6), DARK, 0.11 * s, 0.07, 0.24, g, false); }
  put(ball(0.14, 14, 10), BROWN, 0, 0.5, 0.03, g);
  put(ball(0.07, 10, 8), 0xE9D3B4, 0, 0.46, 0.15, g).scale.set(1.1, 0.8, 0.9);
  put(ball(0.035, 10, 8), lit(0xFF3B30), 0, 0.48, 0.22, g, false);
  for (const s of [-1, 1]) {
    put(ball(0.018, 6, 6), DARK, 0.05 * s, 0.55, 0.13, g, false);
    put(ball(0.04, 8, 6), BROWN, 0.13 * s, 0.58, 0, g).scale.set(1.4, 0.6, 0.5);
    const a = put(cyl(0.012, 0.016, 0.2, 6), 0xC9A06B, 0.07 * s, 0.7, -0.01, g); a.rotation.z = -0.4 * s;
    put(cyl(0.01, 0.012, 0.09, 6), 0xC9A06B, 0.13 * s, 0.75, -0.01, g, false).rotation.z = -1.1 * s;
  }
  put(new THREE.TorusGeometry(0.11, 0.025, 6, 14), RED, 0, 0.38, 0.02, g).rotation.x = Math.PI / 2 - 0.2; // 목도리
});
addShape('bigcane', (g) => { // 큰 사탕 지팡이: 빨강·하양 줄무늬
  put(cyl(0.16, 0.18, 0.05, 14), WOOD_D, 0, 0.025, 0, g);
  for (let k = 0; k < 9; k++) put(cyl(0.05, 0.05, 0.12, 12), k % 2 ? WHITE : RED, 0, 0.11 + k * 0.12, 0, g);
  for (let k = 0; k < 4; k++) {
    const t = put(new THREE.TorusGeometry(0.13, 0.05, 8, 6, Math.PI / 4), k % 2 ? RED : WHITE, 0.13, 1.09, 0, g);
    t.rotation.z = k * Math.PI / 4;
  }
  put(new THREE.TorusGeometry(0.06, 0.02, 6, 10), lit(0x5ED38A), 0, 0.7, 0, g).rotation.x = Math.PI / 2; // 작은 리본 고리
});
addShape('pile', (g) => { // 2 × 2, 선물 더미
  box(g, 0.42, 0.34, 0.42, -0.2, 0, -0.18, RED, GOLD);
  box(g, 0.36, 0.26, 0.36, 0.24, 0, -0.2, GREEN, WHITE);
  box(g, 0.3, 0.4, 0.3, 0.22, 0, 0.24, 0x3E6FC4, 0xDDE8FF);
  box(g, 0.26, 0.2, 0.26, -0.24, 0, 0.26, 0xE0AE3A, RED);
  box(g, 0.28, 0.22, 0.28, -0.16, 0.34, -0.16, 0xF19BB6, WHITE);
  box(g, 0.2, 0.18, 0.2, 0.22, 0.26, -0.2, WHITE, GREEN);
});
addShape('train', (g) => { // 3 × 1, 선로 위의 장난감 기차
  for (const s of [-1, 1]) put(new THREE.BoxGeometry(1.42, 0.02, 0.03), 0x8C8478, 0, 0.01, 0.09 * s, g, false);
  for (let k = 0; k < 9; k++) put(new THREE.BoxGeometry(0.05, 0.015, 0.3), WOOD_D, -0.64 + k * 0.16, 0.008, 0, g, false);
  const wheels = (x, col) => { for (const a of [-0.09, 0.09]) for (const s of [-1, 1]) put(cyl(0.05, 0.05, 0.03, 12), col, x + a, 0.065, 0.11 * s, g).rotation.x = Math.PI / 2; };
  // 기관차
  put(rbox(0.22, 0.24, 0.22, 0.02), RED, 0.5, 0.24, 0, g);
  put(cyl(0.085, 0.085, 0.26, 14), 0x2F3D6B, 0.29, 0.2, 0, g).rotation.z = Math.PI / 2;
  put(cyl(0.035, 0.05, 0.12, 10), DARK, 0.24, 0.34, 0, g);
  put(rbox(0.26, 0.04, 0.26, 0.01), DARK, 0.5, 0.38, 0, g);
  put(ball(0.035, 8, 6), lit(0xFFE08A), 0.16, 0.2, 0, g, false);
  for (const [y, r] of [[0.45, 0.04], [0.52, 0.05]]) put(ball(r, 8, 6), 0xF2F2F2, 0.24 + (y - 0.45), y, 0, g, false); // 김
  wheels(0.4, DARK);
  // 짐칸 둘
  put(rbox(0.32, 0.12, 0.22, 0.02), GREEN, -0.02, 0.15, 0, g); wheels(-0.02, DARK);
  box(g, 0.14, 0.12, 0.14, -0.06, 0.21, 0, GOLD, RED); box(g, 0.1, 0.09, 0.1, 0.08, 0.21, 0, RED, WHITE);
  put(rbox(0.32, 0.12, 0.22, 0.02), 0xE0AE3A, -0.48, 0.15, 0, g); wheels(-0.48, DARK);
  put(new THREE.ConeGeometry(0.08, 0.22, 7), M(0x2F7D56, true), -0.48, 0.32, 0, g);
});
addShape('flake', (g) => { // 눈 결정 조명: 대 위에 스스로 빛나는 눈 결정
  put(cyl(0.14, 0.16, 0.04, 14), DARK, 0, 0.02, 0, g);
  put(cyl(0.018, 0.018, 1.0, 8), 0xC9D6E0, 0, 0.52, 0, g);
  const f = new THREE.Group(); f.position.set(0, 1.18, 0.02); g.add(f);
  for (let k = 0; k < 3; k++) {
    put(new THREE.BoxGeometry(0.46, 0.035, 0.03), lit(0xCFEFFF), 0, 0, 0, f, false).rotation.z = k * Math.PI / 3;
    for (const s of [-1, 1]) for (const b of [-1, 1]) {
      const a = k * Math.PI / 3, br = put(new THREE.BoxGeometry(0.09, 0.022, 0.025), lit(0xFFFFFF), s * Math.cos(a) * 0.15, s * Math.sin(a) * 0.15, 0, f, false);
      br.rotation.z = a + b * 0.8;
    }
  }
  put(ball(0.05, 10, 8), lit(0xFFFFFF), 0, 0, 0.01, f, false);
  put(new THREE.CircleGeometry(0.3, 24), new THREE.MeshBasicMaterial({ color: 0x9FDFFF, transparent: true, opacity: 0.22, depthWrite: false }), 0, 0, -0.03, f, false);
});
addShape('ginger', (g) => { // 2 × 2, 낮은 받침 위의 진저브레드 집
  put(cyl(0.46, 0.46, 0.06, 20), WHITE, 0, 0.03, 0, g);
  put(rbox(0.56, 0.36, 0.46, 0.02), 0xB0703A, 0, 0.24, 0, g);
  for (const s of [-1, 1]) { const r = put(rbox(0.34, 0.04, 0.58, 0.015), WHITE, 0.15 * s, 0.53, 0, g); r.rotation.z = -0.72 * s; }
  put(rbox(0.12, 0.2, 0.02, 0.01), 0x6B4630, 0, 0.16, 0.235, g, false);
  for (const s of [-1, 1]) { put(new THREE.BoxGeometry(0.1, 0.09, 0.02), lit(0xFFD98A), 0.18 * s, 0.28, 0.235, g, false); put(new THREE.BoxGeometry(0.11, 0.015, 0.03), WHITE, 0.18 * s, 0.33, 0.24, g, false); }
  put(rbox(0.07, 0.16, 0.07, 0.01), 0xB0703A, 0.16, 0.66, -0.1, g);
  for (let k = 0; k < 6; k++) for (const s of [-1, 1]) put(ball(0.025, 8, 6), [RED, GREEN, GOLD][k % 3], 0.26 * s - 0.04 * k * s, 0.42 + 0.045 * k, 0.27, g, false);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) put(cyl(0.012, 0.012, 0.1, 6), k % 2 ? WHITE : RED, (0.3 + 0.05 * k) * s, 0.11, 0.3, g, false);
});
addShape('sled', (g) => { // 3 × 2, 선물을 실은 산타 썰매
  for (const s of [-1, 1]) {
    put(new THREE.BoxGeometry(1.3, 0.03, 0.04), GOLD, -0.05, 0.03, 0.3 * s, g);
    const c = put(new THREE.TorusGeometry(0.1, 0.02, 6, 10, Math.PI), GOLD, 0.6, 0.13, 0.3 * s, g); c.rotation.z = -Math.PI / 2;
    for (const x of [-0.45, 0.1]) put(cyl(0.015, 0.015, 0.14, 6), GOLD, x, 0.1, 0.3 * s, g, false);
  }
  put(rbox(1.1, 0.22, 0.7, 0.06), RED, -0.08, 0.27, 0, g);
  put(rbox(0.12, 0.42, 0.72, 0.05), RED, -0.6, 0.47, 0, g);
  put(new THREE.BoxGeometry(1.12, 0.03, 0.72), GOLD, -0.08, 0.39, 0, g, false);
  put(ball(0.24, 12, 10), 0x8C5A3A, -0.3, 0.55, 0, g).scale.set(1, 0.9, 1); // 선물 자루
  put(cyl(0.05, 0.08, 0.08, 8), 0x8C5A3A, -0.3, 0.8, 0, g);
  box(g, 0.18, 0.16, 0.18, 0.08, 0.38, -0.14, GREEN, GOLD);
  box(g, 0.16, 0.2, 0.16, 0.12, 0.38, 0.16, 0x3E6FC4, WHITE);
  box(g, 0.13, 0.12, 0.13, 0.3, 0.38, 0.0, GOLD, RED);
});

/* ───────── 특별 장식의 모양 (트리 겉면 위. 바깥쪽이 +z). 도형은 한 번만 만들어 나눠 쓴다 ───────── */
const OG = {
  bar: new THREE.BoxGeometry(0.2, 0.022, 0.02), twig: new THREE.BoxGeometry(0.06, 0.016, 0.016), dot: new THREE.SphereGeometry(0.018, 6, 5),
  head: new THREE.SphereGeometry(0.04, 10, 8), body: new THREE.SphereGeometry(0.055, 10, 8), limb: new THREE.CapsuleGeometry(0.018, 0.045, 3, 6),
  leg: new THREE.BoxGeometry(0.06, 0.12, 0.03), foot: new THREE.BoxGeometry(0.09, 0.045, 0.03), cuff: new THREE.BoxGeometry(0.08, 0.04, 0.04),
  cone: new THREE.ConeGeometry(0.055, 0.14, 7), hat: new THREE.ConeGeometry(0.06, 0.14, 12), brim: new THREE.TorusGeometry(0.055, 0.018, 6, 14), pom: new THREE.SphereGeometry(0.024, 8, 6),
  gem: new THREE.OctahedronGeometry(0.065), ice: new THREE.ConeGeometry(0.03, 0.2, 8), cap: new THREE.CylinderGeometry(0.02, 0.024, 0.03, 8),
  snow1: new THREE.SphereGeometry(0.05, 10, 8), snow2: new THREE.SphereGeometry(0.036, 10, 8), nose: new THREE.ConeGeometry(0.01, 0.04, 6), scarf: new THREE.TorusGeometry(0.034, 0.011, 6, 12),
  apple: new THREE.SphereGeometry(0.06, 12, 10), stem: new THREE.CylinderGeometry(0.006, 0.006, 0.035, 5), leaf: new THREE.SphereGeometry(0.022, 6, 5),
  dress: new THREE.ConeGeometry(0.05, 0.11, 10), halo: new THREE.TorusGeometry(0.03, 0.007, 6, 14), wing: new THREE.SphereGeometry(0.04, 8, 6),
  peng: new THREE.SphereGeometry(0.052, 10, 8), belly: new THREE.SphereGeometry(0.04, 10, 8), beak: new THREE.ConeGeometry(0.012, 0.035, 6),
  disc: new THREE.CircleGeometry(0.2, 24),
};
const shape = (pts, depth) => { const s = new THREE.Shape(); pts(s); return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); };
OG.heart = shape((s) => { s.moveTo(0, -0.07); s.bezierCurveTo(-0.11, 0.0, -0.06, 0.08, 0, 0.035); s.bezierCurveTo(0.06, 0.08, 0.11, 0.0, 0, -0.07); }, 0.03);
OG.moon = shape((s) => { s.absarc(0, 0, 0.08, Math.PI * 0.35, Math.PI * 1.65, false); s.absarc(0.035, 0, 0.065, Math.PI * 1.5, Math.PI * 0.5, true); }, 0.025);
OG.star = shape((s) => { for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + Math.PI / 2, r = k % 2 ? 0.075 : 0.18; if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } }, 0.045);
const glowMat = new THREE.MeshBasicMaterial({ color: 0xFFE27A, transparent: true, opacity: 0.35, depthWrite: false });

addOrnament('flake', (g, add, P) => { // 눈 결정
  for (let k = 0; k < 3; k++) {
    add(g, OG.bar, P(0xDDF2FF), 0, 0, 0.04).rotation.z = k * Math.PI / 3;
    for (const s of [-1, 1]) add(g, OG.dot, P(0xFFFFFF), s * Math.cos(k * Math.PI / 3) * 0.1, s * Math.sin(k * Math.PI / 3) * 0.1, 0.04);
  }
});
addOrnament('cookie', (g, add, P) => { // 진저브레드 쿠키 사람
  const c = P(0xB0703A, 20), w = P(0xFFFFFF);
  add(g, OG.head, c, 0, 0.06, 0.04).scale.z = 0.45;
  add(g, OG.body, c, 0, -0.02, 0.04).scale.set(0.9, 1, 0.4);
  for (const s of [-1, 1]) { add(g, OG.limb, c, 0.055 * s, 0.0, 0.04).rotation.z = 1.2 * s; add(g, OG.limb, c, 0.03 * s, -0.08, 0.04).rotation.z = 0.35 * s; }
  for (const y of [0.0, -0.035]) add(g, OG.dot, w, 0, y, 0.062).scale.setScalar(0.6);
  for (const s of [-1, 1]) add(g, OG.dot, P(0x2B2420), 0.015 * s, 0.07, 0.058).scale.setScalar(0.45);
});
addOrnament('sock', (g, add, P) => { // 크리스마스 양말
  add(g, OG.leg, P(0xD23A30), 0, 0, 0.04);
  add(g, OG.foot, P(0xD23A30), 0.02, -0.07, 0.04);
  add(g, OG.cuff, P(0xFFFAF2), 0, 0.07, 0.04);
});
addOrnament('cone', (g, add, P) => { // 솔방울
  const m = new THREE.MeshLambertMaterial({ color: 0x8A5A34, flatShading: true });
  add(g, OG.cone, m, 0, -0.03, 0.06).rotation.x = Math.PI;
  add(g, OG.cap, P(0x6B4630), 0, 0.05, 0.06);
});
addOrnament('hat', (g, add, P) => { // 산타 모자
  const h = add(g, OG.hat, P(0xD23A30), 0.01, 0.02, 0.06); h.rotation.z = -0.25;
  add(g, OG.brim, P(0xFFFAF2), 0, -0.05, 0.06).rotation.x = Math.PI / 2;
  add(g, OG.pom, P(0xFFFAF2), 0.035, 0.09, 0.06);
});
addOrnament('gem', (g, add, P) => { add(g, OG.gem, P(0x5FD3E8, 120), 0, -0.02, 0.06).scale.set(0.8, 1.25, 0.8); add(g, OG.cap, P(0xE9B93A), 0, 0.075, 0.06); });
addOrnament('icicle', (g, add, P) => { add(g, OG.ice, P(0xCFEFFF, 120), 0, -0.07, 0.04).rotation.x = Math.PI; add(g, OG.cap, P(0xE4E8EE), 0, 0.04, 0.04); });
addOrnament('kid', (g, add, P) => { // 꼬마 눈사람
  add(g, OG.snow1, P(0xFFFFFF), 0, -0.04, 0.06); add(g, OG.snow2, P(0xFFFFFF), 0, 0.04, 0.06);
  add(g, OG.nose, P(0xF28C28), 0, 0.04, 0.1).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) add(g, OG.dot, P(0x2B2420), 0.014 * s, 0.055, 0.09).scale.setScalar(0.45);
  add(g, OG.scarf, P(0xD23A30), 0, 0.01, 0.06).rotation.x = Math.PI / 2;
});
addOrnament('heart', (g, add, P) => { add(g, OG.heart, P(0xF06292), 0, 0, 0.02); });
addOrnament('apple', (g, add, P) => { add(g, OG.apple, P(0xD42A2A), 0, -0.02, 0.06).scale.y = 0.9; add(g, OG.stem, P(0x6B4630), 0, 0.045, 0.06); add(g, OG.leaf, P(0x3E9A4E), 0.02, 0.055, 0.06).scale.set(1.3, 0.5, 0.7); });
addOrnament('angel', (g, add, P) => { // 천사
  add(g, OG.dress, P(0xFFFAF2), 0, -0.04, 0.06);
  add(g, OG.head, P(0xF2CFA8), 0, 0.045, 0.06).scale.setScalar(0.75);
  add(g, OG.halo, P(0xE9B93A), 0, 0.09, 0.06).rotation.x = Math.PI / 2.4;
  for (const s of [-1, 1]) add(g, OG.wing, P(0xEAF4FF), 0.045 * s, 0.0, 0.035).scale.set(0.7, 1.1, 0.35);
});
addOrnament('penguin', (g, add, P) => { // 펭귄
  add(g, OG.peng, P(0x2B2B33), 0, 0, 0.05).scale.y = 1.3;
  add(g, OG.belly, P(0xFFFFFF), 0, -0.01, 0.075).scale.set(0.9, 1.2, 0.6);
  add(g, OG.beak, P(0xF2A23A), 0, 0.03, 0.11).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) add(g, OG.dot, P(0x111111), 0.018 * s, 0.045, 0.095).scale.setScalar(0.4);
});
addOrnament('moon', (g, add, P) => { add(g, OG.moon, P(0xFFE9A8), 0, 0, 0.02); });
addOrnament('king', (g) => { // 25일: 스스로 빛나는 큰 금별 (빛 무리를 두른다)
  const s = new THREE.Mesh(OG.star, new THREE.MeshBasicMaterial({ color: 0xFFD84A })); s.position.z = 0.03; g.add(s);
  const halo = new THREE.Mesh(OG.disc, glowMat); halo.position.z = 0.01; g.add(halo);
});

/* ───────── 판과 연출 ───────── */
const CSS = `
#advBox{display:flex;flex-direction:column;gap:6px;min-width:0}
#advGrid{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}
#advGrid button{min-height:46px;min-width:0;padding:0;border-radius:11px;border:1.5px solid var(--line);background:#fff;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:12px;font-weight:800;line-height:1.1;color:var(--sub)}
#advGrid button b{font-size:19px;font-weight:400;line-height:1.05}
#advGrid button.shut{background:#E9DCC7;color:#B4A390}
#advGrid button.ready{background:#C8443A;border-color:#FFD84A;color:#FFF4E0;box-shadow:0 0 0 2px #FFD84A;animation:advGlow 1.2s ease-in-out infinite alternate}
#advGrid button.done{background:#FFFCF5;color:var(--choc)}
#advGrid button.pop{animation:advPop .6s ease-out}
@keyframes advGlow{from{box-shadow:0 0 0 2px #FFD84A}to{box-shadow:0 0 0 4px #FFE98A,0 0 12px #FFD84A}}
@keyframes advPop{0%{transform:scale(.6) rotateY(90deg)}60%{transform:scale(1.15) rotateY(0)}100%{transform:scale(1)}}
#advShow{position:absolute;left:50%;top:34%;z-index:7;pointer-events:none;transform:translate(-50%,-50%);text-align:center;color:#FFF4E0;
  font-weight:900;text-shadow:0 3px 14px rgba(0,0,0,.6)}
#advShow b{display:block;font-size:76px;line-height:1.1;font-weight:400;animation:advRise 1.9s ease-out forwards}
#advShow span{display:block;font-size:17px;animation:advRise 1.9s ease-out forwards}
#advShow i{position:absolute;left:50%;top:40%;font-style:normal;font-size:20px;animation:advSpark 1.1s ease-out forwards}
@keyframes advRise{0%{transform:scale(.3);opacity:0}25%{transform:scale(1.12);opacity:1}75%{transform:scale(1);opacity:1}100%{transform:translateY(-20px);opacity:0}}
@keyframes advSpark{0%{transform:translate(-50%,-50%) scale(.4);opacity:1}100%{transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) scale(1);opacity:0}}
.pick.locked,.chip.locked{background:#EFE6D8;color:#A8988A;border-style:dashed}
.sw.locked{position:relative;filter:grayscale(.7) brightness(.85)}
.sw.locked::after{content:"🔒";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:16px}
/* 달력으로 늘어난 목록이 판을 너무 키우지 않게: 전구는 두 줄에, 벽지·바닥은 한 줄에, 펼친 목록은 더 촘촘히 */
#lightList{gap:5px}
#lightList .chip{padding:0 6px}
#wallList,#floorList{flex-wrap:wrap;gap:3px}
#wallList .sw,#floorList .sw{width:44px;height:44px}
#furnList.open,#ornList.open{grid-template-columns:repeat(auto-fill,minmax(50px,1fr));gap:5px}
#furnList.open .pick,#ornList.open .pick{min-height:52px;font-size:10.5px;gap:1px}
#furnList.open .pick b,#ornList.open .pick b{font-size:21px}
`;

export function makeAdvent(K) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const box = document.createElement('div');
  box.id = 'advBox'; box.hidden = true;
  const grid = document.createElement('div');
  grid.id = 'advGrid'; grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', '어드벤트 달력 칸');
  box.appendChild(grid);
  $('playP').insertBefore(box, $('playBtns'));
  const show = document.createElement('div');
  show.id = 'advShow'; show.setAttribute('aria-hidden', 'true');
  document.body.appendChild(show);
  const cells = [];
  for (let d = 1; d <= 25; d++) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.d = String(d);
    b.addEventListener('click', () => pick(d));
    grid.appendChild(b); cells.push(b);
  }
  const myName = () => cleanWords(K.store.get(K.key('name')), NOTE.name) || cleanWords(K.defName(), NOTE.name) || '친구';
  const opened = (d) => K.S().adv.get(d);
  const isOpen = () => K.play.kind === 'advent';

  // 칸 d 의 처지: 'done'(열었음) | 'ready'(오늘까지라서 열 수 있음) | 'shut'(아직)
  const stateOf = (d) => (opened(d) ? 'done' : d <= openTo() ? 'ready' : 'shut');
  function paintCells() {
    for (const b of cells) {
      const d = +b.dataset.d, st = stateOf(d), p = prize(d);
      b.className = st;
      b.textContent = '';
      const n = document.createElement('span'); n.textContent = String(d);
      if (st === 'done') { const i = document.createElement('b'); i.textContent = p.icon; b.append(i, n); b.setAttribute('aria-label', `12월 ${d}일: ${p.name} (열었어요)`); }
      else if (st === 'ready') { const i = document.createElement('b'); i.textContent = '🎁'; b.append(i, n); b.setAttribute('aria-label', `12월 ${d}일 칸 열기`); }
      else { b.append(n); b.setAttribute('aria-label', `12월 ${d}일 칸 (아직)`); }
    }
  }
  function paint() {
    box.hidden = false;
    paintCells();
    const to = openTo(), n = K.S().adv.size, ready = cells.filter((b) => b.className === 'ready').length;
    let sub;
    if (!to) sub = `12월 1일부터 열 수 있어요 (${dLabel(daysTo(1))}) · 하루에 한 칸씩, 열면 이 방에 특별한 것이 풀려요.`;
    else if (ready) sub = `오늘은 12월 ${today().d}일! 열 수 있는 칸 ${ready}개 · ${n}/25 열었어요${K.canEdit() ? '' : ' · 칸은 꾸미는 사람만 열어요'}`;
    else sub = n >= 25 ? '25칸을 모두 열었어요. 메리 크리스마스! 🎄' : `오늘 칸까지 다 열었어요 · ${n}/25 · 내일 또 와요!`;
    const btns = [];
    const next = cells.find((b) => b.className === 'ready');
    if (next && K.canEdit()) btns.push({ label: `🎁 ${next.dataset.d}일 칸 열기`, main: true, id: 'playGo', fn: () => pick(+next.dataset.d) });
    btns.push({ label: '닫기', id: 'playQuit', fn: () => K.close() });
    K.play.panel('🗓️ 어드벤트 달력', sub, btns);
  }
  // 칸을 눌렀다
  function pick(d) {
    const st = stateOf(d), p = prize(d), o = opened(d);
    if (st === 'done') { K.toast(`12월 ${d}일: ${p.icon} ${p.name} · ${o.name}님이 열었어요`); return false; }
    if (st === 'shut') { const n = daysTo(openTo() ? d : 1); K.toast(openTo() ? `12월 ${d}일에 열 수 있어요 (${dLabel(n)})` : `12월 1일부터 열 수 있어요 (${dLabel(n)})`); return false; }
    if (!K.canEdit()) { K.toast('달력 칸은 꾸미는 사람만 열 수 있어요'); return false; }
    return K.op({ t: 'adv', d, name: myName(), at: Math.round(now()) });
  }

  /* ───────── 연 순간의 연출 ───────── */
  // 화면 가운데: 풀린 것의 그림이 튀어 오르고 반짝이가 흩어진다
  function burst(p) {
    show.textContent = '';
    const i = document.createElement('b'), t = document.createElement('span');
    i.textContent = p.icon; t.textContent = p.name;
    show.append(i, t);
    for (let k = 0; k < 14; k++) {
      const s = document.createElement('i'), a = k / 14 * Math.PI * 2, r = 70 + Math.random() * 60;
      s.textContent = k % 3 ? '✨' : '⭐';
      s.style.setProperty('--x', Math.cos(a) * r + 'px'); s.style.setProperty('--y', Math.sin(a) * r + 'px');
      s.style.animationDelay = (0.15 + Math.random() * 0.25) + 's';
      show.appendChild(s);
    }
    clearTimeout(burst.k); burst.k = setTimeout(() => { show.textContent = ''; }, 2100);
  }
  // 달력 앞: 작은 상자의 뚜껑이 날아가고 반짝이가 튄다 (내가 있는 층에 달력이 있을 때)
  const fx = [];
  const sparkGeo = new THREE.OctahedronGeometry(0.03), lidGeo = new THREE.BoxGeometry(0.24, 0.06, 0.24), bodyGeo = new THREE.BoxGeometry(0.22, 0.18, 0.22);
  function popBox() {
    let g = null;
    for (const it of K.S().items.values()) if (it.k === 'advent') { const o = K.itemObj(it.id); if (o && o.visible) { g = o; break; } }
    if (!g) return;
    g.updateMatrixWorld();
    const at = g.localToWorld(new THREE.Vector3(0, 1.0, 0.35)), root = new THREE.Group();
    root.position.copy(at);
    const body = new THREE.Mesh(bodyGeo, M(RED)), lid = new THREE.Mesh(lidGeo, M(GOLD));
    body.position.y = 0.09; lid.position.y = 0.21;
    root.add(body, lid);
    const sparks = [];
    for (let k = 0; k < 16; k++) {
      const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: k % 2 ? 0xFFE27A : 0xFFFFFF, transparent: true }));
      const a = k / 16 * Math.PI * 2;
      m.position.y = 0.22; m.visible = false;
      root.add(m); sparks.push({ m, v: [Math.cos(a) * (0.6 + Math.random() * 0.5), 1.6 + Math.random() * 1.2, Math.sin(a) * (0.6 + Math.random() * 0.5)] });
    }
    K.scene.add(root);
    fx.push({ root, body, lid, sparks, t: 0 });
  }
  function tickFx(dt) {
    for (let k = fx.length - 1; k >= 0; k--) {
      const f = fx[k];
      f.t += dt;
      const t = f.t;
      f.root.scale.setScalar(Math.min(1, t / 0.2));
      f.body.rotation.z = t < 0.5 ? Math.sin(t * 40) * 0.08 : 0; // 들썩들썩
      if (t > 0.5) { const u = t - 0.5; f.lid.position.set(u * 0.4, 0.21 + u * 1.6 - u * u * 1.4, 0); f.lid.rotation.z = -u * 4; } // 뚜껑이 날아간다
      for (const s of f.sparks) {
        if (t < 0.5) continue;
        s.m.visible = true;
        s.v[1] -= 3.2 * dt;
        s.m.position.x += s.v[0] * dt; s.m.position.y += s.v[1] * dt; s.m.position.z += s.v[2] * dt;
        s.m.rotation.y += dt * 8;
        s.m.material.opacity = Math.max(0, 1 - (t - 0.5) / 1.3);
      }
      if (t > 1.2) f.root.scale.setScalar(Math.max(0.01, 1 - (t - 1.2) / 0.6));
      if (t > 1.85) { K.scene.remove(f.root); for (const s of f.sparks) s.m.material.dispose(); fx.splice(k, 1); }
      K.dirty();
    }
  }

  /* ───────── 고르는 목록의 🔒 ───────── */
  const LISTS = [['furn', 'furnList', '.pick'], ['orn', 'ornList', '.pick'], ['light', 'lightList', '.chip'], ['wall', 'wallList', '.sw'], ['floor', 'floorList', '.sw']];
  function paintLocks() {
    const S = K.S();
    for (const [kind, box, sel] of LISTS) {
      const el = $(box);
      if (!el) continue;
      for (const b of el.querySelectorAll(sel)) {
        const day = lockDay(S, ADVENT_LISTS[kind], b.dataset.v), was = b.classList.contains('locked');
        if (day && !was) {
          if (sel !== '.sw') b.dataset.html = b.innerHTML;
          b.classList.add('locked'); b.dataset.day = String(day); b.setAttribute('aria-disabled', 'true');
          const name = ADVENT_LISTS[kind].find((x) => x.id === b.dataset.v).name;
          if (sel === '.pick') b.innerHTML = `<b>🔒</b>12/${day}`;
          else if (sel === '.chip') b.textContent = `🔒 12/${day}`;
          b.title = `${name}: 어드벤트 달력 12월 ${day}일 칸을 열면 쓸 수 있어요`;
          b.setAttribute('aria-label', b.title);
        } else if (!day && was) {
          b.classList.remove('locked'); b.removeAttribute('aria-disabled'); delete b.dataset.day;
          if (b.dataset.html !== undefined) { b.innerHTML = b.dataset.html; delete b.dataset.html; }
          if (sel !== '.sw') { b.removeAttribute('aria-label'); b.removeAttribute('title'); }
          else { const it = ADVENT_LISTS[kind].find((x) => x.id === b.dataset.v); b.title = it.name; b.setAttribute('aria-label', it.name); }
        }
      }
    }
  }
  // 잠긴 것을 누르면 고르지 않고 언제 풀리는지 알려 준다 (단추 자신의 처리보다 먼저 가로챈다)
  document.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('.locked') : null;
    if (!b || !b.dataset.day) return;
    e.stopImmediatePropagation(); e.preventDefault();
    K.toast(`🔒 어드벤트 달력 12월 ${b.dataset.day}일 칸을 열면 쓸 수 있어요`);
  }, true);

  /* ───────── 오늘 열 칸이 있으면 달력 위에 별이 반짝인다 ───────── */
  const markMat = new THREE.MeshBasicMaterial({ color: 0xFFD84A }); // 도형은 달력마다 따로 (달력을 치우면 같이 지워진다)
  function marks(clock) {
    const want = cells.some((b) => b.className === 'ready');
    for (const it of K.S().items.values()) {
      if (it.k !== 'advent') continue;
      const g = K.itemObj(it.id);
      if (!g) continue;
      let m = g.userData.advMark;
      if (!m) { m = new THREE.Mesh(OG.star.clone(), markMat); m.scale.setScalar(0.7); m.position.set(0, 2.25, -0.15); g.add(m); g.userData.advMark = m; }
      if (m.visible !== want) { m.visible = want; K.dirty(); }
      if (want) { m.position.y = 2.25 + Math.sin(clock * 3) * 0.04; m.rotation.y = clock * 1.6; }
    }
  }

  /* ───────── 방의 변화 ───────── */
  let advRef = null, advN = -1, dayKey = '', clock = 0, sinceCheck = 1;
  function refresh() { advRef = K.S().adv; advN = advRef.size; drawCalendar(K.S()); paintCells(); paintLocks(); if (isOpen()) paint(); }
  function onOp(op, from) {
    refresh();
    if (from === 'load') return;
    const p = prize(op.d);
    const c = cells[op.d - 1];
    c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    burst(p); popBox();
    K.toast(from === 'me' ? `12월 ${op.d}일 칸을 열었어요: ${p.icon} ${p.name}` : `${op.name}님이 12월 ${op.d}일 칸을 열었어요: ${p.icon} ${p.name}`);
  }
  function tick(dt) {
    clock += dt; sinceCheck += dt;
    if (sinceCheck > 0.5) { // 날짜가 바뀌었는지, 방이 통째로 바뀌었는지 (저장된 방을 열거나 친구의 방을 받았을 때)
      sinceCheck = 0;
      const t = today(), key = `${t.y}-${t.m}-${t.d}`, S = K.S();
      if (S.adv !== advRef || S.adv.size !== advN || key !== dayKey) {
        const turned = dayKey && key !== dayKey;
        dayKey = key;
        refresh();
        const d = openTo();
        if (turned && d && t.d <= 25 && !opened(d) && K.S().items.size) setTimeout(() => K.toast(`🗓️ 12월 ${d}일! 어드벤트 달력의 오늘 칸을 열 수 있어요`), d === 25 ? 2600 : 0);
      }
    }
    marks(clock);
    tickFx(dt);
  }

  const kind = {
    start(c) { c.phase = 'advent'; refresh(); paint(); },
    paint() { paint(); },
    tick() {}, tap() {},
    stop() { box.hidden = true; },
  };
  K.play.add('advent', kind);

  // 달력이 없던 때에 꾸민 방(저장값에 adv 가 없다)을 처음 열 때, 그리고 새 방: 거실 북쪽 벽에 달력을 하나 놓는다.
  // 자리가 막혀 있으면 가까운 빈자리에 놓는다. 이미 달력이 있으면 그대로 둔다. 꾸민 것으로 치지 않는다.
  function starter(saved, inRoom) {
    if (window.__bare) return;
    const S = K.S();
    if ([...S.items.values()].some((it) => it.k === 'advent')) return;
    if (!((!saved && !inRoom) || (saved && typeof saved === 'object' && !Array.isArray(saved.adv)))) return;
    const [k, i, j, r] = STARTER_UP.find((x) => x[0] === 'advent');
    if (K.load({ t: 'put', id: 'advent0', k, i, j, r })) return;
    const spot = K.findSpot(k, r, X0 + (i + 1) * CELL, Z0 + (j + 0.5) * CELL);
    if (spot) K.load({ t: 'put', id: 'advent0', k, i: spot[0], j: spot[1], r });
  }

  window.__advent = { // 자동 검사가 쓰는 창구
    pick, openTo, daysTo, stateOf, myName,
    get shown() { return !box.hidden; },
    get cells() { return cells.map((b) => ({ d: +b.dataset.d, st: b.className.replace(' pop', ''), text: b.textContent })); },
    get show() { return show.textContent; }, get fx() { return fx.length; },
    get mark() { for (const it of K.S().items.values()) if (it.k === 'advent') { const g = K.itemObj(it.id); return !!(g && g.userData.advMark && g.userData.advMark.visible); } return null; },
    locks: () => [...document.querySelectorAll('.locked')].map((b) => ({ v: b.dataset.v, day: +b.dataset.day, list: b.parentElement.id })),
  };
  return { onOp, tick, starter, refresh };
}
