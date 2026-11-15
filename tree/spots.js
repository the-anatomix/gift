// 테마 소품: 층 테마(catalog.js 의 THEMES)마다 그곳다운 가구와 할 수 있는 일을 더한다. 가구 탭에서 누구나 어느 층에든 놓을 수 있다.
//   카페   : 에스프레소 머신(커피 내리기 놀이 → 내린 커피를 들고 마신다), 디저트 진열장(꺼내 먹기), 카페 탁자, 카페 의자(앉기), 메뉴판
//   산장   : 흔들의자(앉기), 무쇠 난로(코코아 따르기), 장작 더미
//   파티룸 : 풍선 다발, 파티 폭죽(터뜨리기)
//   서재   : 독서 책상(짧은 이야기 읽기), 지구본(돌리기)
//   찜질방 : 불가마(찜질하기), 찜질 매트(눕기), 매점(구운 계란·식혜), 안마의자(앉으면 덜덜 떨린다)
//   젤리방 : 젤리 기계(젤리 꺼내 먹기), 큰 곰젤리, 젤리 방석(앉기), 젤리 트램펄린(통통 뛰기)
//   (노래방 기계·미러볼·스피커는 karaoke.js)
// 앉기·눕기는 catalog.js 의 sit·lie 표시로 app.js 의 lieDown 이 한다. 꺼내 먹는 것은 food.js 의 take 로 손에 든다.
// 방의 상태(state.js)는 건드리지 않는다. 눌러서 바로 하는 일(폭죽·지구본·불가마·트램펄린)은 놀이 소식 { k: 'use', v: '일:가구id' } 로 친구에게도 보인다.
// 이야기와 지구본의 말은 직접 지은 글이다.
import { THREE, M, T, E, put, rbox, cbox, cyl, ball, pool } from './kit.js';
import { kindOf } from './state.js';
import { FLOOR_DX } from './path.js';
import { addShape } from './furniture.js';
import { sfx } from './sfx.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const WOOD = 0xB8743F, WOOD_D = 0x7A4A2B, CREAM = 0xFFF4E0, STEEL = 0xC9CED3, INK = 0x2B2420;
const glass = (hex = 0xCFE9FF, op = 0.22) => new THREE.MeshLambertMaterial({ color: hex, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
const GLASS = glass();
const jellies = new Map();
const jellyMat = (hex) => { if (!jellies.has(hex)) jellies.set(hex, new THREE.MeshLambertMaterial({ color: hex, transparent: true, opacity: 0.84, emissive: hex, emissiveIntensity: 0.16 })); return jellies.get(hex); };
// 글자가 든 판 (직접 그린 그림). 같은 글은 한 번만 그린다
const signs = new Map();
function sign(key, w, h, draw) {
  if (!signs.has(key)) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle'; draw(x, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    signs.set(key, new THREE.MeshBasicMaterial({ map: t }));
  }
  return signs.get(key);
}
const FONT = '"Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif';
const own = (g) => { const o = new THREE.Group(); o.userData.own = true; g.add(o); return o; };

/* ───────── 카페 ───────── */
// 추출구·잔 자리·그라인더 (가구 기준). 커피 내리기 놀이가 쓴다
const BREW = { spout: [0.2, 0.985, 0.15], cup: [0.2, 0.86, 0.15], grinder: [-0.27, 1.02, 0.02] };
addShape('espresso', (g) => { // 2 × 1: 원목 바 위의 에스프레소 머신과 그라인더, 잔 더미
  put(cbox(0.96, 0.8, 0.46, 0.02), T(0x6B452B, 'wood'), 0, 0.4, 0, g);
  put(cbox(1.0, 0.045, 0.5, 0.015), 0xEFE6D8, 0, 0.822, 0, g);
  for (const x of [-0.24, 0.24]) put(box(0.4, 0.5, 0.01), 0x5A3824, x, 0.42, 0.232, g, false);
  put(cbox(0.5, 0.36, 0.32, 0.03), STEEL, 0.2, 1.03, -0.05, g);                           // 머신 몸
  put(box(0.46, 0.1, 0.01), INK, 0.2, 1.12, 0.112, g, false);                              // 앞 판
  for (const [x, col] of [[0.06, 0x7CFF9A], [0.14, 0xFFD166], [0.34, 0xFF7A6B]]) put(ball(0.012, 6, 5), E(col, 0.6), x, 1.12, 0.12, g, false);
  put(cyl(0.022, 0.022, 0.012, 10), 0xFFFAF2, 0.24, 1.12, 0.118, g, false).rotation.x = Math.PI / 2; // 압력계
  put(cbox(0.5, 0.03, 0.34, 0.01), 0x8E949A, 0.2, 1.225, -0.05, g, false);                 // 잔 데우는 윗판
  for (const [x, z] of [[0.06, -0.08], [0.16, -0.02], [0.3, -0.1]]) { put(cyl(0.035, 0.028, 0.05, 10), 0xFFFAF2, x, 1.265, z, g, false); }
  put(cyl(0.04, 0.04, 0.03, 12), 0x8E949A, 0.2, 1.0, 0.13, g, false);                       // 추출구
  put(cyl(0.034, 0.03, 0.03, 12), INK, 0.2, 0.972, 0.15, g, false);                         // 포터필터
  put(cyl(0.01, 0.01, 0.14, 6), INK, 0.2, 0.972, 0.24, g, false).rotation.x = Math.PI / 2;
  put(cbox(0.36, 0.02, 0.18, 0.006), 0x8E949A, 0.2, 0.853, 0.15, g, false);                 // 물받이
  const wand = put(cyl(0.007, 0.007, 0.18, 6), STEEL, 0.41, 0.95, 0.12, g, false); wand.rotation.z = 0.25; // 스팀 봉
  put(cyl(0.045, 0.04, 0.09, 10), STEEL, 0.43, 0.89, 0.15, g, false);                       // 우유 피처
  put(cbox(0.16, 0.2, 0.18, 0.02), INK, -0.27, 0.945, 0, g);                                // 그라인더
  put(new THREE.CylinderGeometry(0.08, 0.035, 0.14, 12, 1, true), GLASS, -0.27, 1.115, 0, g, false);
  put(cyl(0.07, 0.035, 0.09, 12), 0x4A2C1A, -0.27, 1.09, 0, g, false);                      // 원두
  put(cyl(0.085, 0.085, 0.012, 12), INK, -0.27, 1.19, 0, g, false);
  put(cbox(0.14, 0.012, 0.12, 0.004), 0x8A5F3F, -0.02, 0.851, 0.14, g, false);              // 넉박스 옆 나무 쟁반
  for (const [x, z] of [[-0.05, 0.14], [0.01, 0.15]]) put(cyl(0.026, 0.02, 0.04, 10), 0xFFFAF2, x, 0.877, z, g, false);
  g.userData.brew = BREW;
  pool(g, 0, 0.02, 1.3, 0.8);
});
addShape('dessert', (g) => { // 2 × 1: 유리 진열장 안의 케이크·마카롱·크루아상
  put(cbox(0.96, 0.5, 0.46, 0.02), 0xF6E3D0, 0, 0.25, 0, g);
  put(box(0.98, 0.03, 0.48), 0xD98A7A, 0, 0.515, 0, g, false);
  put(box(0.92, 0.012, 0.4), CREAM, 0, 0.536, 0, g, false);
  put(box(0.9, 0.012, 0.3), CREAM, 0, 0.8, -0.04, g, false);                                // 위 선반
  put(box(0.98, 0.03, 0.48), 0xD98A7A, 0, 1.08, 0, g, false);                               // 지붕
  put(box(0.9, 0.012, 0.02), E(0xFFF1C9, 0.7), 0, 1.058, 0.18, g, false);                   // 진열장 등
  for (const sx of [-1, 1]) put(box(0.02, 0.54, 0.46), 0xD98A7A, 0.48 * sx, 0.8, 0, g, false);
  put(new THREE.PlaneGeometry(0.94, 0.52), GLASS, 0, 0.8, 0.232, g, false);
  put(box(0.94, 0.52, 0.01), 0xF1D9C4, 0, 0.8, -0.225, g, false);
  // 아래 칸: 조각 케이크 셋, 위 칸: 마카롱과 크루아상
  [[-0.3, 0xFFF6EE, 0xE23B2E], [0, 0x7B4A2D, 0xFFF6EE], [0.3, 0xF7B6C2, 0xFFD166]].forEach(([x, cream, top]) => {
    put(cyl(0.1, 0.1, 0.008, 14), 0xFFFAF2, x, 0.546, 0.02, g, false);
    put(cyl(0.085, 0.085, 0.07, 14), 0xE8C48A, x, 0.585, 0.02, g, false); put(cyl(0.088, 0.088, 0.02, 14), cream, x, 0.63, 0.02, g, false);
    put(ball(0.018, 6, 5), top, x, 0.652, 0.02, g, false);
  });
  [0xF7A9C0, 0xB7E3B0, 0xFFE08A, 0xD7BFF2].forEach((c, k) => { const m = put(ball(0.034, 10, 6), c, -0.36 + k * 0.085, 0.826, 0, g, false); m.scale.y = 0.55; });
  for (const x of [0.12, 0.3]) { const m = put(ball(0.05, 8, 6), 0xE0A458, x, 0.83, 0, g, false); m.scale.set(1.5, 0.6, 0.8); }
  put(new THREE.PlaneGeometry(0.5, 0.12), sign('dessert', 256, 64, (x) => { x.fillStyle = '#FFF4E0'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#9A4A3C'; x.font = `bold 34px ${FONT}`; x.fillText('오늘의 디저트', 128, 34); }), 0, 0.3, 0.236, g, false);
  pool(g, 0, 0.02, 1.3, 0.8);
});
addShape('cafetable', (g) => { // 2 × 2: 둥근 원목 탁자 (윗면 0.725)
  put(cyl(0.44, 0.44, 0.04, 20), T(WOOD, 'wood'), 0, 0.705, 0, g);
  put(cyl(0.4, 0.4, 0.02, 20), WOOD_D, 0, 0.676, 0, g, false);
  put(cyl(0.045, 0.06, 0.64, 10), INK, 0, 0.35, 0, g);
  put(cyl(0.24, 0.27, 0.03, 16), INK, 0, 0.015, 0, g);
  const deco = own(g); g.userData.deco = deco; // 윗면의 소품 (케이크를 올려놓으면 숨긴다)
  put(cyl(0.03, 0.04, 0.09, 8), 0xFFFAF2, 0, 0.77, -0.02, deco, false);                    // 작은 꽃병
  put(cyl(0.004, 0.004, 0.1, 5), 0x3E9A7E, 0, 0.86, -0.02, deco, false);
  put(ball(0.028, 8, 6), 0xE8776A, 0, 0.92, -0.02, deco, false);
  put(box(0.09, 0.004, 0.09), CREAM, 0.16, 0.728, 0.1, deco, false).rotation.y = 0.5;       // 냅킨
  pool(g, 0, 0, 1.1, 1.1);
});
addShape('cafechair', (g) => { // 1 × 1: 등받이가 있는 나무 의자 (앉는 판 0.45)
  put(cbox(0.4, 0.04, 0.4, 0.012), T(WOOD, 'wood'), 0, 0.43, 0.0, g);
  put(cyl(0.17, 0.17, 0.03, 12), 0xC8443A, 0, 0.462, 0.0, g, false).scale.set(1, 1, 1);     // 방석
  for (const a of [-1, 1]) for (const b of [-1, 1]) put(cyl(0.02, 0.016, 0.42, 6), WOOD_D, 0.16 * a, 0.21, 0.16 * b, g);
  for (const a of [-1, 1]) put(cyl(0.018, 0.018, 0.5, 6), WOOD_D, 0.17 * a, 0.69, -0.18, g);
  put(cbox(0.4, 0.12, 0.03, 0.01), T(WOOD, 'wood'), 0, 0.88, -0.18, g);
  put(box(0.36, 0.03, 0.02), WOOD_D, 0, 0.68, -0.18, g, false);
  pool(g, 0, 0, 0.6, 0.6);
});
addShape('menu', (g) => { // 1 × 1: 세워 두는 칠판 메뉴판
  for (const s of [-1, 1]) { const b = put(cbox(0.42, 0.74, 0.03, 0.01), T(WOOD_D, 'wood'), 0, 0.37, 0.1 * s, g); b.rotation.x = -0.26 * s; }
  const m = put(new THREE.PlaneGeometry(0.36, 0.6), sign('menu', 216, 360, (x, w, h) => {
    x.fillStyle = '#26332C'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#FFE9A8'; x.font = `bold 40px ${FONT}`; x.fillText('MENU', w / 2, 44);
    x.strokeStyle = '#FFE9A8'; x.lineWidth = 3; x.beginPath(); x.moveTo(30, 76); x.lineTo(w - 30, 76); x.stroke();
    x.fillStyle = '#FFFAF2'; x.font = `bold 27px ${FONT}`;
    ['아메리카노', '카페라떼', '아이스커피', '핫초코'].forEach((t, k) => x.fillText(t, w / 2, 122 + k * 50));
    x.fillStyle = '#F7A9C0'; x.font = `bold 23px ${FONT}`; x.fillText('+ 오늘의 디저트', w / 2, 326);
  }), 0, 0.39, 0.118, g, false);
  m.rotation.x = -0.26;
  pool(g, 0, 0, 0.6, 0.5);
});

/* ───────── 산장 ───────── */
addShape('rocker', (root) => { // 2 × 2: 흔들의자 (앉는 판 0.46). 누가 앉으면 앞뒤로 흔들린다 (몸 전체가 한 묶음: userData.rock)
  const g = own(root); root.userData.rock = g;
  const W = T(0x8A5A34, 'wood');
  for (const s of [-1, 1]) {
    const r = put(new THREE.TorusGeometry(0.9, 0.022, 6, 14, 0.9), W, 0.3 * s, 0.93, 0.02, g); r.rotation.set(0, Math.PI / 2, 0); r.rotation.z = -Math.PI / 2 - 0.45; // 바닥의 굽은 다리
    for (const z of [-0.26, 0.28]) put(cyl(0.022, 0.022, 0.4, 6), W, 0.3 * s, 0.24, z, g);
    put(cbox(0.06, 0.03, 0.62, 0.01), W, 0.33 * s, 0.66, 0.04, g);                           // 팔걸이
    put(cyl(0.02, 0.02, 0.22, 6), W, 0.33 * s, 0.55, 0.3, g, false);
    put(cyl(0.024, 0.024, 0.74, 6), W, 0.3 * s, 0.82, -0.3, g).rotation.x = -0.14;
  }
  put(cbox(0.62, 0.04, 0.6, 0.012), W, 0, 0.44, 0.02, g);
  for (let k = 0; k < 5; k++) put(box(0.07, 0.6, 0.016), W, -0.22 + k * 0.11, 0.84, -0.305, g, false).rotation.x = -0.14; // 등받이 살
  put(cbox(0.66, 0.07, 0.04, 0.012), W, 0, 1.17, -0.35, g).rotation.x = -0.14;
  put(cbox(0.5, 0.05, 0.46, 0.02), T(0xC8443A, 'plaid'), 0, 0.475, 0.04, g, false);         // 방석
  put(cbox(0.3, 0.03, 0.5, 0.012), T(CREAM, 'knit'), 0.33, 0.69, 0.02, g, false);           // 걸쳐 둔 담요
  pool(root, 0, 0, 1.0, 1.1);
});
addShape('potbelly', (g) => { // 1 × 1: 주전자가 올라간 무쇠 난로 (코코아)
  const IRON = 0x33302E;
  for (const a of [-1, 1]) for (const b of [-1, 1]) put(cyl(0.02, 0.014, 0.12, 6), IRON, 0.12 * a, 0.06, 0.12 * b, g);
  put(cyl(0.19, 0.21, 0.5, 14), IRON, 0, 0.37, 0, g);
  put(cyl(0.21, 0.21, 0.03, 14), 0x4A4642, 0, 0.635, 0, g, false);
  put(cyl(0.2, 0.2, 0.03, 14), 0x4A4642, 0, 0.125, 0, g, false);
  put(cbox(0.2, 0.2, 0.02, 0.008), 0x4A4642, 0, 0.36, 0.2, g, false);                       // 문
  put(box(0.14, 0.12, 0.01), E(0xFF9A3C, 1), 0, 0.36, 0.212, g, false);                     // 불빛이 비치는 창
  for (const x of [-0.045, 0, 0.045]) put(box(0.008, 0.12, 0.012), IRON, x, 0.36, 0.216, g, false);
  put(cyl(0.055, 0.055, 1.95, 8), IRON, 0, 1.62, -0.11, g);                                 // 연통
  put(cyl(0.065, 0.065, 0.04, 8), 0x4A4642, 0, 1.2, -0.11, g, false);
  const k = 0xC8443A;                                                                        // 빨간 주전자
  put(ball(0.085, 12, 8), k, 0.02, 0.72, 0.05, g).scale.y = 0.8;
  put(cyl(0.03, 0.03, 0.02, 8), k, 0.02, 0.79, 0.05, g, false); put(ball(0.014, 6, 5), INK, 0.02, 0.81, 0.05, g, false);
  put(cyl(0.012, 0.02, 0.1, 6), k, 0.11, 0.75, 0.05, g, false).rotation.z = -0.9;
  put(new THREE.TorusGeometry(0.06, 0.008, 5, 10, Math.PI), INK, 0.02, 0.78, 0.05, g, false);
  pool(g, 0, 0, 0.7, 0.7, { hex: 0xFF9A3C, op: 0.16, add: true });
});
addShape('logpile', (g) => { // 2 × 1: 쌓아 둔 장작
  const rows = [[-0.3, -0.1, 0.1, 0.3], [-0.2, 0, 0.2], [-0.1, 0.1]];
  rows.forEach((xs, r) => xs.forEach((x, k) => {
    const y = 0.1 + r * 0.17, col = (r + k) % 2 ? 0x7A4A2B : 0x8A5A34;
    put(cyl(0.095, 0.095, 0.4, 9), T(col, 'wood'), x * 1.05, y, 0, g).rotation.x = Math.PI / 2;
    put(cyl(0.08, 0.08, 0.004, 9), 0xE3C59A, x * 1.05, y, 0.202, g, false).rotation.x = Math.PI / 2; // 자른 면
    put(cyl(0.035, 0.035, 0.005, 7), 0xC9A06C, x * 1.05, y, 0.204, g, false).rotation.x = Math.PI / 2;
  }));
  for (const s of [-1, 1]) put(box(0.03, 0.5, 0.36), WOOD_D, 0.45 * s, 0.25, 0, g);          // 받침대
  pool(g, 0, 0.02, 1.2, 0.7);
});

/* ───────── 파티룸 ───────── */
addShape('balloons', (g) => { // 1 × 1: 선물 추에 묶은 풍선 다발 (살랑살랑 흔들린다)
  put(cbox(0.18, 0.16, 0.18, 0.02), 0xD9577E, 0, 0.08, 0, g); put(box(0.19, 0.03, 0.19), 0xFFD166, 0, 0.08, 0, g, false);
  const sway = own(g); sway.position.y = 0.16;
  [[0, 1.62, 0, 0xE8483B], [-0.2, 1.42, 0.06, 0x4FA3D9], [0.2, 1.46, -0.05, 0xF2C94C], [0.03, 1.3, 0.16, 0x6FD08C], [-0.06, 1.34, -0.17, 0xB98BE8]].forEach(([x, y, z, col]) => {
    const len = Math.hypot(x, y, z), s = put(cyl(0.004, 0.004, len, 4), 0xFFFAF2, x / 2, y / 2, z / 2, sway, false);
    s.rotation.set(Math.atan2(z, y), 0, -Math.atan2(x, y));
    put(ball(0.17, 12, 10), col, x, y + 0.16, z, sway).scale.y = 1.18;
    put(new THREE.ConeGeometry(0.025, 0.04, 6), col, x, y - 0.02, z, sway, false);
  });
  g.userData.live = (t, dt, st) => { const p = st.ph ?? (st.ph = Math.random() * 6); sway.rotation.set(Math.sin(t * 0.9 + p) * 0.045, 0, Math.sin(t * 0.7 + p * 1.7) * 0.05); };
  pool(g, 0, 0, 0.5, 0.5);
});
const POP_AT = [0, 1.0, 0.06];
addShape('popper', (g) => { // 1 × 1: 받침대 위의 큰 파티 폭죽 (누르면 터진다)
  put(cyl(0.16, 0.19, 0.04, 12), 0x9B52B5, 0, 0.02, 0, g);
  put(cyl(0.025, 0.025, 0.42, 6), 0xFFD166, 0, 0.24, 0, g);
  const c = own(g); c.position.set(0, 0.46, 0); c.rotation.x = 0.28;
  put(new THREE.ConeGeometry(0.17, 0.5, 14, 1, true), new THREE.MeshLambertMaterial({ color: 0xF2B544, side: THREE.DoubleSide }), 0, 0.25, 0, c).rotation.x = Math.PI;
  for (const [y, r, col] of [[0.12, 0.09, 0xE8483B], [0.26, 0.135, 0x4FA3D9], [0.4, 0.172, 0xD9577E]]) put(new THREE.TorusGeometry(r, 0.012, 5, 14), col, 0, y, 0, c, false).rotation.x = Math.PI / 2;
  put(cyl(0.004, 0.004, 0.2, 4), 0xFFFAF2, 0, -0.1, 0, c, false); put(ball(0.02, 6, 5), 0xE8483B, 0, -0.2, 0, c, false); // 당기는 끈
  g.userData.live = (t, dt, st) => { st.kick = Math.max(0, (st.kick || 0) - dt * 3); c.scale.setScalar(1 + 0.25 * Math.sin(st.kick * Math.PI) * st.kick); };
  pool(g, 0, 0, 0.5, 0.5);
});

/* ───────── 서재 ───────── */
addShape('readdesk', (g) => { // 2 × 1: 책이 펼쳐진 독서 책상 (윗면 0.72)
  put(cbox(0.98, 0.04, 0.48, 0.012), T(0x6B452B, 'wood'), 0, 0.7, 0, g);
  put(box(0.9, 0.1, 0.42), 0x5B3B23, 0, 0.63, 0, g, false);
  for (const a of [-1, 1]) for (const b of [-1, 1]) put(cbox(0.05, 0.6, 0.05, 0.01), 0x5B3B23, 0.43 * a, 0.3, 0.19 * b, g);
  for (const x of [-0.2, 0.2]) put(ball(0.014, 6, 5), 0xE7B441, x, 0.63, 0.214, g, false);    // 서랍 손잡이
  for (const s of [-1, 1]) { const pg = put(box(0.16, 0.012, 0.22), 0xFFFAF2, -0.06 + 0.082 * s, 0.735, 0.04, g, false); pg.rotation.z = 0.12 * s; } // 펼친 책
  put(box(0.34, 0.008, 0.24), 0x8C2F2A, -0.06, 0.724, 0.04, g, false);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) put(box(0.11, 0.002, 0.008), 0x9A8F84, -0.06 + 0.082 * s, 0.743 + 0.004, -0.03 + k * 0.04, g, false).rotation.z = 0.12 * s; // 글줄
  [[0x4F6FB8, 0.2], [0x3E9A7E, 0.18], [0xE7B441, 0.16]].forEach(([c, w], k) => put(box(w, 0.035, 0.14), c, 0.31, 0.738 + k * 0.036, -0.1, g, false).rotation.y = 0.2 - k * 0.25); // 쌓아 둔 책
  put(cyl(0.05, 0.06, 0.016, 10), 0x2F5A49, -0.38, 0.728, -0.12, g, false);                   // 초록 갓의 책상 등
  put(cyl(0.008, 0.008, 0.22, 6), 0xE7B441, -0.38, 0.84, -0.12, g, false);
  const sh = put(cyl(0.05, 0.05, 0.16, 10), 0x2F7D56, -0.34, 0.95, -0.1, g, false); sh.rotation.z = Math.PI / 2;
  put(box(0.14, 0.006, 0.07), E(0xFFE9A8, 0.9), -0.34, 0.922, -0.1, g, false);
  put(cyl(0.022, 0.026, 0.045, 8), INK, 0.2, 0.745, 0.14, g, false);                          // 잉크병과 깃펜
  const q = put(new THREE.ConeGeometry(0.014, 0.2, 5), 0xFFFAF2, 0.215, 0.85, 0.14, g, false); q.rotation.z = -0.3;
  pool(g, 0, 0.02, 1.3, 0.8);
});
addShape('globe', (g) => { // 1 × 1: 받침대 위의 지구본 (누르면 돈다)
  put(cyl(0.15, 0.18, 0.04, 12), T(WOOD_D, 'wood'), 0, 0.02, 0, g);
  put(cyl(0.025, 0.035, 0.62, 8), T(WOOD_D, 'wood'), 0, 0.33, 0, g);
  const tilt = own(g); tilt.position.y = 0.9; tilt.rotation.z = 0.4;
  put(new THREE.TorusGeometry(0.235, 0.012, 5, 16, Math.PI), 0xE7B441, 0, 0, 0, tilt, false).rotation.z = -Math.PI / 2;
  const spin = own(tilt);
  put(ball(0.2, 18, 14), 0x4F8FD0, 0, 0, 0, spin);
  for (const [a, b, r, sx] of [[0.4, 0.5, 0.075, 1.5], [1.6, 0.2, 0.06, 1.2], [2.6, -0.3, 0.08, 1.6], [3.9, 0.4, 0.07, 1.8], [4.6, -0.5, 0.05, 1.3], [5.5, 0.1, 0.055, 1.1], [0.9, -0.7, 0.045, 1.4]]) {
    const m = put(ball(r, 7, 5), 0x6FBF73, Math.cos(a) * Math.cos(b) * 0.178, Math.sin(b) * 0.178, Math.sin(a) * Math.cos(b) * 0.178, spin, false); m.scale.set(sx, 1, 1); m.lookAt(0, 0, 0);
  }
  put(ball(0.07, 8, 5), 0xFFFFFF, 0, 0.165, 0, spin, false).scale.y = 0.4;                     // 북극의 눈
  g.userData.live = (t, dt, st) => { st.vel = Math.max(0.25, (st.vel || 0.25) - dt * 5 * Math.max(0.3, (st.vel || 0) / 6)); spin.rotation.y += st.vel * dt; };
  pool(g, 0, 0, 0.5, 0.5);
});

/* ───────── 찜질방 ───────── */
addShape('kiln', (g) => { // 3 × 3: 황토 불가마. 둥근 지붕과 아치 문, 문 안쪽의 불빛
  const CLAY = 0xC9905A, CLAY_D = 0xA8703F;
  put(cyl(0.74, 0.74, 0.16, 20), 0x8C8378, 0, 0.08, 0, g);                                   // 돌 기단
  const dome = put(new THREE.SphereGeometry(0.72, 20, 12, 0, TAU, 0, Math.PI / 2), T(CLAY, 'fabric'), 0, 0.16, 0, g); dome.scale.y = 1.25;
  for (let k = 0; k < 9; k++) { const a = k / 9 * TAU + 0.3; put(ball(0.09, 6, 4), k % 2 ? 0x9A9086 : 0x7F776E, Math.cos(a) * 0.7, 0.2, Math.sin(a) * 0.7, g, false).scale.y = 0.7; }
  put(cbox(0.5, 0.74, 0.16, 0.03), CLAY_D, 0, 0.5, 0.66, g);                                  // 문틀
  put(box(0.36, 0.6, 0.02), INK, 0, 0.46, 0.742, g, false);
  put(box(0.3, 0.26, 0.012), E(0xFF7A2E, 1), 0, 0.3, 0.75, g, false);                         // 안쪽 불빛
  put(box(0.3, 0.26, 0.012), E(0xFFB04A, 0.7), 0, 0.56, 0.75, g, false);
  put(new THREE.PlaneGeometry(0.5, 0.18), sign('kiln', 256, 92, (x) => { x.fillStyle = '#5B3920'; x.fillRect(0, 0, 256, 92); x.strokeStyle = '#E7B441'; x.lineWidth = 6; x.strokeRect(6, 6, 244, 80); x.fillStyle = '#FFE9A8'; x.font = `bold 44px ${FONT}`; x.fillText('불가마 85℃', 128, 49); }), 0, 1.0, 0.72, g, false).rotation.x = -0.32;
  put(cyl(0.07, 0.09, 0.2, 8), CLAY_D, 0.1, 1.1, -0.1, g);                                     // 굴뚝
  pool(g, 0, 0.5, 1.9, 1.9);
  pool(g, 0, 0.95, 0.7, 0.5, { hex: 0xFF8A3C, op: 0.22, add: true });
});
addShape('jjimmat', (g) => { // 2 × 4: 찜질 매트와 나무 베개, 발치의 수건 (한 사람이 눕는다. 윗면 0.09)
  put(cbox(0.94, 0.05, 1.92, 0.02), 0xB98A52, 0, 0.035, 0, g);
  put(cbox(0.86, 0.04, 1.84, 0.015), T(0xE9D3A0, 'fabric'), 0, 0.07, 0, g, false);
  for (let k = 0; k < 5; k++) put(box(0.86, 0.004, 0.012), 0xCFB37A, 0, 0.092, -0.6 + k * 0.32, g, false); // 누빔 줄
  put(cbox(0.34, 0.09, 0.15, 0.03), T(WOOD, 'wood'), 0, 0.135, -0.76, g);                     // 나무 베개
  put(cbox(0.3, 0.05, 0.2, 0.02), 0xF7C8A0, 0.24, 0.115, 0.78, g, false);                     // 접어 둔 수건
  put(cbox(0.3, 0.05, 0.2, 0.02), 0xFFFAF2, 0.24, 0.16, 0.78, g, false);
});
addShape('snackbar', (g) => { // 2 × 1: 찜질방 매점. 구운 계란 바구니와 식혜 통
  put(cbox(0.96, 0.78, 0.46, 0.02), T(0xD9A45C, 'wood'), 0, 0.39, 0, g);
  put(cbox(1.0, 0.04, 0.5, 0.012), 0xF2E3C4, 0, 0.8, 0, g);
  put(box(0.9, 0.14, 0.01), 0xC8443A, 0, 0.62, 0.233, g, false); put(box(0.9, 0.14, 0.01), 0xFFF4E0, 0, 0.47, 0.233, g, false);
  put(cyl(0.16, 0.12, 0.09, 12), 0xB8743F, -0.26, 0.865, 0.04, g);                            // 계란 바구니
  for (const [x, y, z] of [[-0.31, 0.92, 0.02], [-0.22, 0.92, 0.0], [-0.27, 0.92, 0.1], [-0.2, 0.925, 0.09], [-0.265, 0.965, 0.05]]) put(ball(0.045, 8, 6), 0xB07A45, x, y, z, g, false).scale.y = 1.25;
  put(cyl(0.11, 0.11, 0.04, 14), 0xC8443A, 0.24, 0.84, 0, g, false);                           // 식혜 통
  put(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 14, 1, true), GLASS, 0.24, 1.01, 0, g, false);
  put(cyl(0.092, 0.092, 0.22, 14), 0xF3EBD2, 0.24, 0.97, 0, g, false);
  put(cyl(0.11, 0.11, 0.03, 14), 0xC8443A, 0.24, 1.175, 0, g, false);
  put(cyl(0.012, 0.012, 0.05, 6), STEEL, 0.24, 0.88, 0.115, g, false).rotation.x = Math.PI / 2;
  for (const x of [0.0, 0.06]) put(cyl(0.028, 0.024, 0.07, 10), GLASS, x, 0.855, 0.16, g, false);
  put(new THREE.PlaneGeometry(0.8, 0.2), sign('snack', 320, 80, (x) => { x.fillStyle = '#FFF4E0'; x.fillRect(0, 0, 320, 80); x.fillStyle = '#C8443A'; x.font = `bold 40px ${FONT}`; x.fillText('매점 · 구운 계란 · 식혜', 160, 42, 300); }), 0, 0.26, 0.236, g, false);
  pool(g, 0, 0.02, 1.3, 0.8);
});
addShape('massage', (g) => { // 2 × 2: 안마의자 (앉는 판 0.48. 누가 앉으면 덜덜 떨린다)
  const LEA = 0x4A3B36, LEA_L = 0x6B564E;
  put(cbox(0.8, 0.16, 0.86, 0.04), 0x2B2420, 0, 0.1, 0, g);
  const b = own(g);
  put(cbox(0.56, 0.24, 0.6, 0.06), LEA_L, 0, 0.36, 0.08, b);
  const back = put(cbox(0.6, 0.9, 0.22, 0.08), LEA, 0, 0.82, -0.3, b); back.rotation.x = -0.2;
  put(cbox(0.4, 0.2, 0.1, 0.05), LEA_L, 0, 1.16, -0.3, b, false).rotation.x = -0.2;           // 머리 받침
  for (const y of [0.66, 0.84]) for (const x of [-0.11, 0.11]) put(ball(0.05, 8, 6), LEA_L, x, y, -0.18 - (y - 0.66) * 0.2, b, false); // 등을 두드리는 볼
  for (const s of [-1, 1]) {
    put(cbox(0.16, 0.42, 0.74, 0.06), LEA, 0.36 * s, 0.43, 0.04, b);                           // 팔 감싸개
    put(cbox(0.18, 0.4, 0.3, 0.05), LEA, 0.15 * s, 0.24, 0.47, b);                             // 다리 감싸개
  }
  put(box(0.1, 0.012, 0.16), E(0x7CE0FF, 0.7), 0.36, 0.646, 0.2, b, false);                    // 조작판
  g.userData.buzz = b;
  pool(g, 0, 0, 1.1, 1.2);
});

/* ───────── 젤리방 ───────── */
const JELLY = [0xE2485A, 0x5CCB7A, 0xF2C94C, 0xB98BE8, 0xFF9F5A];
addShape('jellybar', (g) => { // 2 × 1: 투명 통에 젤리가 가득한 젤리 기계
  put(cbox(0.96, 0.7, 0.46, 0.03), 0xFFFAF2, 0, 0.35, 0, g);
  for (let k = 0; k < 6; k++) put(box(0.08, 0.7, 0.008), k % 2 ? 0xF7A9C0 : 0xB7E3D8, -0.4 + k * 0.16, 0.35, 0.233, g, false); // 줄무늬
  put(cbox(1.0, 0.04, 0.5, 0.015), 0xF7A9C0, 0, 0.72, 0, g);
  put(cbox(0.96, 0.06, 0.16, 0.015), 0xFFFAF2, 0, 0.77, 0.14, g, false);                       // 받침 쟁반
  JELLY.slice(0, 4).forEach((col, k) => {
    const x = -0.345 + k * 0.23;
    put(new THREE.CylinderGeometry(0.095, 0.095, 0.5, 12, 1, true), GLASS, x, 1.04, -0.06, g, false);
    put(cyl(0.1, 0.1, 0.03, 12), 0xFFFAF2, x, 1.3, -0.06, g, false); put(cyl(0.1, 0.085, 0.06, 12), 0xF7A9C0, x, 0.77, -0.06, g, false);
    for (let n = 0; n < 9; n++) { const a = n * 2.4, r = 0.02 + (n % 3) * 0.022; put(ball(0.036, 7, 5), jellyMat(col), x + Math.cos(a) * r, 0.83 + n * 0.042, -0.06 + Math.sin(a) * r, g, false); }
    put(box(0.03, 0.03, 0.06), STEEL, x, 0.8, 0.05, g, false);                                  // 나오는 곳
  });
  put(new THREE.PlaneGeometry(0.7, 0.16), sign('jelly', 280, 64, (x) => { x.fillStyle = '#FFE1EF'; x.fillRect(0, 0, 280, 64); x.fillStyle = '#C0528A'; x.font = `bold 40px ${FONT}`; x.fillText('젤리 가게', 140, 34); }), 0, 1.42, -0.06, g, false);
  put(box(0.74, 0.2, 0.02), 0xF7A9C0, 0, 1.42, -0.075, g, false);
  pool(g, 0, 0.02, 1.3, 0.8);
});
function gummyBear(g, col) { // 말랑한 큰 곰젤리 (직접 지은 모양: 둥근 몸과 머리, 짧은 팔다리)
  const m = jellyMat(col), b = new THREE.Group(); g.add(b);
  put(ball(0.19, 14, 10), m, 0, 0.3, 0, b).scale.set(1, 1.12, 0.8);
  put(ball(0.165, 14, 10), m, 0, 0.62, 0, b).scale.set(1, 0.92, 0.82);
  put(ball(0.07, 8, 6), m, 0, 0.59, 0.12, b, false).scale.set(1, 0.75, 0.7);                  // 주둥이
  for (const s of [-1, 1]) {
    put(ball(0.06, 8, 6), m, 0.12 * s, 0.77, 0, b, false).scale.z = 0.6;                       // 귀
    put(ball(0.075, 8, 6), m, 0.19 * s, 0.38, 0.05, b, false).scale.set(0.8, 1.15, 0.8);       // 팔
    put(ball(0.085, 8, 6), m, 0.11 * s, 0.08, 0.06, b, false).scale.set(0.9, 0.9, 1.1);        // 다리
    put(ball(0.016, 6, 5), INK, 0.06 * s, 0.65, 0.132, b, false);
  }
  put(ball(0.03, 8, 6), 0xFFFFFF, -0.07, 0.72, 0.1, b, false).scale.set(1, 0.6, 0.3);         // 반짝이
  g.userData.live = (t, dt, st) => { const p = st.ph ?? (st.ph = Math.random() * 6), w = Math.sin(t * 2.2 + p) * 0.02; b.scale.set(1 - w, 1 + w, 1 - w); };
  pool(g, 0, 0, 0.55, 0.5);
}
[['jellybear', JELLY[0]], ['jellybear2', JELLY[1]], ['jellybear3', JELLY[2]]].forEach(([k, c]) => addShape(k, (g) => gummyBear(g, c)));
addShape('jellycube', (g) => { // 1 × 1: 말랑한 젤리 방석 (앉는 판 0.32)
  const o = new THREE.Group(); g.add(o);
  put(rbox(0.42, 0.32, 0.42, 0.09), jellyMat(JELLY[3]), 0, 0.16, 0, o);
  put(ball(0.04, 8, 6), 0xFFFFFF, -0.11, 0.3, 0.13, o, false).scale.set(1.4, 0.3, 0.8);
  g.userData.live = (t, dt, st) => { const p = st.ph ?? (st.ph = Math.random() * 6), w = Math.sin(t * 1.8 + p) * 0.015; o.scale.set(1 + w, 1 - w, 1 + w); };
  pool(g, 0, 0, 0.55, 0.55);
});
addShape('jellypad', (g) => { // 2 × 2: 젤리 트램펄린 (밟고 올라가 통통 뛴다)
  put(new THREE.TorusGeometry(0.46, 0.035, 6, 20), 0xFFFAF2, 0, 0.035, 0, g).rotation.x = Math.PI / 2;
  const o = new THREE.Group(); g.add(o);
  const d = put(new THREE.SphereGeometry(0.44, 18, 8, 0, TAU, 0, Math.PI / 2), jellyMat(JELLY[4]), 0, 0.02, 0, o); d.scale.y = 0.34;
  put(ball(0.07, 8, 6), 0xFFFFFF, -0.16, 0.14, 0.14, o, false).scale.set(1.5, 0.25, 0.9);
  g.userData.live = (t, dt, st) => { st.kick = Math.max(0, (st.kick || 0) - dt * 2.2); const k = st.kick, w = Math.sin(k * 9) * k * 0.5; o.scale.set(1 + w * 0.2, 1 - w, 1 + w * 0.2); };
});

/* ───────── 이야기 (독서 책상) ───────── */
const STORIES = [
  { title: '눈사람의 목도리', pages: [
    '첫눈이 온 날, 마당에 눈사람 하나가 태어났어요. 눈사람은 추운 줄도 모르고 창문 안의 트리만 바라보았지요.',
    '"저 불빛은 얼마나 따뜻할까?" 눈사람이 중얼거리자, 지나가던 아이가 제 빨간 목도리를 풀어 둘러 주었어요.',
    '그날 밤 눈사람은 처음으로 따뜻함이 무엇인지 알았어요. 녹을까 봐 걱정도 됐지만, 웃음이 먼저 났답니다.',
    '봄이 와서 눈사람은 떠났지만, 목도리는 울타리에 걸려 다음 겨울을 기다리고 있대요. — 끝 —'] },
  { title: '트리 꼭대기의 별', pages: [
    '트리 꼭대기의 별은 혼자서는 올라갈 수 없었어요. 아무리 반짝여도 키가 닿지 않았거든요.',
    '한 사람이 발판이 되어 주고, 또 한 사람이 손을 뻗었어요. 둘이 힘을 모으자 별이 제자리를 찾았지요.',
    '별은 그때 알았어요. 가장 높은 곳의 빛도 누군가의 어깨 덕분이라는 걸요.',
    '그래서 별은 밤마다 방 안을 골고루 비춘답니다. 받쳐 준 사람도, 달아 준 사람도 똑같이요. — 끝 —'] },
  { title: '곰젤리의 겨울잠', pages: [
    '곰젤리는 겨울잠을 자고 싶었지만, 너무 말랑해서 눕기만 하면 통통 튀어 올랐어요.',
    '"코코아 한 잔이면 잠이 올 거야." 산장 난로 위의 주전자가 보글보글 속삭였어요.',
    '따뜻한 코코아를 한 모금, 두 모금. 곰젤리의 눈이 스르르 감겼어요.',
    '지금도 젤리방 어딘가에서 곰젤리 하나가 쿨쿨 자고 있을지 몰라요. 살살 걸어 주세요. — 끝 —'] },
];
const PLACES = ['핀란드 로바니에미 · 산타 마을이 있는 곳이에요', '노르웨이 트롬쇠 · 오로라가 춤추는 곳이에요', '대한민국 부산 · 겨울 바다가 반짝여요', '캐나다 옐로나이프 · 눈과 오로라의 도시예요',
  '일본 삿포로 · 눈 축제가 열려요', '스위스 체르마트 · 눈 덮인 산골 마을이에요', '호주 시드니 · 한여름의 크리스마스예요', '아이슬란드 레이캬비크 · 온천 위로 눈이 내려요'];
// 커피 내리기: 고를 수 있는 것, 추출 눈금(0 ~ max)에서 맛있는 구간(ok)과 가장 맛있는 구간(best)
const DRINKS = [{ id: 'americano', name: '아메리카노', col: 0x3A2416 }, { id: 'latte', name: '카페라떼', col: 0xC9A27A }, { id: 'icecoffee', name: '아이스', col: 0x4A2C1A }, { id: 'cocoa', name: '핫초코', col: 0x6B3F22 }];
const BREWING = { grind: 5, max: 1.25, ok: [0.56, 0.9], best: [0.68, 0.8], speed: 0.24 };
const USES = { pop: '🎉 폭죽 터뜨리기', spin: '🌍 지구본 돌리기', kiln: '♨️ 불가마 찜질하기', bounce: '🟣 통통 뛰기' };
const ID_RE = /^[\w-]{1,24}$/;

// K (app.js 가 준다): play, food, S(), itemObj(id), me, avatar(pid), others(), myId(), approach(id, then), walkTo(x, z, then), mode(), act(id), fx(m), online(),
//   toast, close(), setPose(p), busy(), level(), levelOfCell(i), measure(), dirty()
export function makeSpots(K) {
  const $ = (id) => document.getElementById(id);
  const portrait = () => window.innerWidth < window.innerHeight;
  const v3 = new THREE.Vector3();
  const world = (g, x, y, z) => { g.updateMatrixWorld(); const p = g.localToWorld(v3.set(x, y, z)); return [p.x, p.y, p.z]; };
  const quit = { label: '그만하기', id: 'playQuit', fn: () => K.close() };
  const rnd = (a) => (Math.random() - 0.5) * a;
  let clock = 0;

  /* ───────── 꺼내 먹기: 디저트 진열장, 무쇠 난로, 찜질방 매점, 젤리 기계 ───────── */
  const serveOf = (c) => { const it = K.S().items.get(c.id); return it ? kindOf(it.k) : null; };
  function hand(kind) { // 꺼내 든다
    if (K.busy()) { K.toast('들고 있는 것을 내려놓고 꺼내요'); return false; }
    return K.food.take(kind);
  }
  const serve = {
    start(c) {
      const f = serveOf(c);
      if (!f || !f.serve) return false;
      if (f.serve.length === 1) { if (hand(f.serve[0]) && f.id === 'potbelly') { sfx('pour'); K.toast('☕ 주전자에서 코코아를 따랐어요! 마시기 단추를 눌러요'); } return false; } // 하나뿐이면 바로 꺼낸다
      serve.paint(c);
    },
    paint(c) {
      const f = serveOf(c); if (!f) return;
      K.play.panel(`${f.icon} ${f.name}`, '꺼낼 것을 골라요. 손에 들고 한 입씩 먹어요.', [
        ...f.serve.map((k) => { const x = K.food.info(k); return { label: `${x.icon} ${x.name}`, chip: true, id: 'serve-' + k, fn: () => { K.close(); hand(k); } }; }),
        { label: '닫기', id: 'playQuit', fn: () => K.close() }]);
    },
    tick() {}, tap() {}, stop() {},
  };
  K.play.add('serve', serve);

  /* ───────── 커피 내리기 (에스프레소 머신) ───────── */
  // 마실 것을 고르고 → 원두를 갈고(단추를 여러 번) → 추출 눈금이 맛있는 구간에 왔을 때 멈춘다 → 내린 잔을 들고 간다
  const bar = document.createElement('div'); bar.id = 'brewBar'; bar.hidden = true;
  bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', '추출 눈금');
  bar.style.cssText = 'position:relative;height:18px;margin:2px 4px 6px;border-radius:9px;background:#EADCC8;overflow:hidden;flex:none';
  { const pct = (v) => (v / BREWING.max * 100).toFixed(1) + '%';
    const z = (id, a, b, col) => { const d = document.createElement('div'); d.id = id; d.style.cssText = `position:absolute;top:0;bottom:0;left:${pct(a)};width:${pct(b - a)};background:${col}`; bar.appendChild(d); };
    z('brewOk', BREWING.ok[0], BREWING.ok[1], '#BFE3B0'); z('brewBest', BREWING.best[0], BREWING.best[1], '#5FBF73');
    const f = document.createElement('div'); f.id = 'brewFill'; f.style.cssText = 'position:absolute;top:3px;bottom:3px;left:0;width:0;border-radius:6px;background:#6B3F22;opacity:.85'; bar.appendChild(f); }
  $('playBtns').parentNode.insertBefore(bar, $('playBtns'));
  const STREAM = new THREE.MeshBasicMaterial({ color: 0x4A2C1A });
  const coffee = {
    start(c) {
      c.drink = DRINKS[0]; c.m = new THREE.Group(); c.g.add(c.m);
      const [cx, cy, cz] = BREW.cup;
      const ice = () => c.drink.id === 'icecoffee';
      c.cup = new THREE.Group(); c.cup.position.set(cx, cy, cz); c.m.add(c.cup);
      c.mug = put(new THREE.CylinderGeometry(0.04, 0.034, 0.07, 14, 1, true), new THREE.MeshLambertMaterial({ color: 0xFFFAF2, side: THREE.DoubleSide }), 0, 0.035, 0, c.cup, false);
      c.tall = put(new THREE.CylinderGeometry(0.036, 0.03, 0.1, 14, 1, true), glass(0xDDF1F7, 0.4), 0, 0.05, 0, c.cup, false);
      c.liq = put(cyl(0.032, 0.028, 1, 14), new THREE.MeshLambertMaterial({ color: c.drink.col }), 0, 0, 0, c.cup, false);
      c.stream = put(cyl(0.004, 0.004, 1, 5), STREAM, BREW.spout[0], 0, BREW.spout[2], c.m, false); c.stream.visible = false;
      c.ice = ice;
      const d = portrait() ? 1.5 : 1.25;
      K.setPose({ pos: world(c.g, 0.05, 1.32, d), at: world(c.g, 0.05, 0.96, 0), fov: portrait() ? 50 : 38 });
      coffee.reset(c);
    },
    reset(c) { c.phase = 'menu'; c.ground = 0; c.heat = 0; c.q = null; c.t = 0; coffee.dress(c); coffee.paint(c); },
    dress(c) { // 잔 모양과 음료 색·높이
      const tall = c.ice(); c.mug.visible = !tall; c.tall.visible = tall;
      c.liq.material.color.setHex(c.drink.col);
      const h = (tall ? 0.09 : 0.06) * clamp(c.heat / BREWING.best[1], 0, 1.05);
      c.liq.visible = h > 0.002; c.liq.scale.y = Math.max(0.002, h); c.liq.position.y = 0.004 + h / 2;
      const top = BREW.cup[1] + 0.004 + h, len = BREW.spout[1] - 0.03 - top;
      c.stream.scale.y = Math.max(0.01, len); c.stream.position.y = top + len / 2;
      $('brewFill').style.width = (clamp(c.heat / BREWING.max, 0, 1) * 100).toFixed(1) + '%';
      K.dirty();
    },
    paint(c) {
      bar.hidden = c.phase !== 'brew' && c.phase !== 'done';
      if (c.phase === 'menu') K.play.panel('☕ 커피 내리기', '마실 것을 고르고 원두를 갈아요.', [
        ...DRINKS.map((d) => ({ label: d.name, chip: true, id: 'drink-' + d.id, on: c.drink === d, fn: () => { c.drink = d; coffee.dress(c); coffee.paint(c); } })),
        { label: '⚙️ 원두 갈기', main: true, id: 'playGo', fn: () => coffee.grind(c) }, quit]);
      else if (c.phase === 'grind') K.play.panel(`원두 가는 중 ${'●'.repeat(c.ground)}${'○'.repeat(BREWING.grind - c.ground)}`, '단추를 여러 번 눌러 원두를 곱게 갈아요. 드르륵!', [{ label: '⚙️ 드르륵', main: true, id: 'playGo', fn: () => coffee.grind(c) }, quit]);
      else if (c.phase === 'brew') K.play.panel(`${c.drink.name} 내리는 중…`, '눈금이 초록 칸에 왔을 때 멈추면 가장 맛있어요.', [{ label: '✋ 멈추기', main: true, id: 'playGo', fn: () => coffee.halt(c) }, quit]);
      else {
        const Q = { perfect: ['완벽한 한 잔이에요 ✨', '향도 맛도 딱 좋아요.'], good: ['맛있게 내렸어요 ☕', '초록 칸 한가운데에서 멈추면 더 맛있어요.'], weak: ['조금 연해요 💧', '조금 더 내리면 진해져요. 그래도 마실 만해요.'], bitter: ['조금 써요 😖', '너무 오래 내렸어요. 그래도 마실 만해요.'] }[c.q];
        K.play.panel(Q[0], Q[1], [{ label: `☕ ${c.drink.name} 들고 가기`, main: true, id: 'playGo', fn: () => coffee.take(c) }, { label: '다시 내리기', id: 'playAgain', fn: () => coffee.reset(c) }, quit]);
      }
      K.measure();
    },
    grind(c) {
      if (c.phase !== 'menu' && c.phase !== 'grind') return;
      c.phase = 'grind'; c.ground++; sfx('grind'); c.shake = 0.3;
      if (c.ground >= BREWING.grind) { c.phase = 'brew'; c.heat = 0; c.snd = 0; sfx('brew'); }
      coffee.paint(c);
    },
    halt(c) {
      if (c.phase !== 'brew') return;
      const h = c.heat, B = BREWING;
      c.q = h < B.ok[0] ? 'weak' : h > B.ok[1] ? 'bitter' : h >= B.best[0] && h <= B.best[1] ? 'perfect' : 'good';
      c.phase = 'done'; c.stream.visible = false; sfx(c.q === 'perfect' ? 'hooray' : 'cupDown');
      coffee.paint(c);
    },
    take(c) {
      const d = c.drink, q = c.q;
      K.close();
      if (hand(d.id)) K.toast(q === 'perfect' ? `✨ 완벽한 ${d.name}! 마시기 단추를 눌러요` : `☕ ${d.name}${/[가-힣]$/.test(d.name) && (d.name.charCodeAt(d.name.length - 1) - 0xAC00) % 28 ? '을' : '를'} 들었어요. 마시기 단추를 눌러요`);
    },
    tick(c, dt) {
      c.t += dt;
      if (c.shake > 0) { c.shake = Math.max(0, c.shake - dt); c.m.position.x = Math.sin(c.t * 70) * 0.004 * (c.shake / 0.3); K.dirty(); }
      if (c.phase !== 'brew') return;
      c.heat += dt * BREWING.speed * (1 + 0.18 * Math.sin(c.t * 3.1));
      c.stream.visible = true;
      if ((c.snd += dt) > 1.15) { c.snd = 0; sfx('brew'); }
      if (Math.random() < dt * 8) { const [x, y, z] = world(c.g, BREW.cup[0] + rnd(0.03), BREW.cup[1] + 0.1, BREW.cup[2]); K.food.spark(x, y, z, 0xFFFFFF, rnd(0.04), 0.18, rnd(0.04), 0.8, -0.04); } // 김
      coffee.dress(c);
      if (c.heat >= BREWING.max) coffee.halt(c);
    },
    tap() {},
    stop(c) { bar.hidden = true; c.g.remove(c.m); c.m.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); },
  };
  K.play.add('coffee', coffee);

  /* ───────── 책 읽기 (독서 책상) ───────── */
  let lastBook = -1;
  const read = {
    start(c) {
      c.book = lastBook = (lastBook + 1) % STORIES.length; c.page = 0;
      K.setPose({ pos: world(c.g, -0.06, portrait() ? 1.75 : 1.45, portrait() ? 0.75 : 0.62), at: world(c.g, -0.06, 0.74, 0.02), fov: portrait() ? 52 : 40 });
      sfx('page'); read.paint(c);
    },
    paint(c) {
      const s = STORIES[c.book], n = s.pages.length;
      K.play.panel(`📖 ${s.title} (${c.page + 1}/${n})`, s.pages[c.page], [
        ...(c.page > 0 ? [{ label: '◀ 앞 장', id: 'readPrev', fn: () => read.turn(c, -1) }] : []),
        ...(c.page < n - 1 ? [{ label: '다음 장 ▶', main: true, id: 'playGo', fn: () => read.turn(c, 1) }] : [{ label: '📚 다른 책 읽기', main: true, id: 'playGo', fn: () => { c.book = lastBook = (c.book + 1) % STORIES.length; c.page = 0; sfx('page'); read.paint(c); } }]),
        { label: '덮기', id: 'playQuit', fn: () => K.close() }]);
    },
    turn(c, d) { c.page = clamp(c.page + d, 0, STORIES[c.book].pages.length - 1); sfx('page'); read.paint(c); },
    tick() {}, tap() {}, stop() {},
  };
  K.play.add('read', read);

  /* ───────── 눌러서 바로 하는 일: 폭죽, 지구본, 불가마, 트램펄린 ───────── */
  const live = new Map();   // 가구 id → 움직임 상태 (userData.live 가 쓴다)
  const stOf = (id) => { let s = live.get(id); if (!s) { s = {}; live.set(id, s); } return s; };
  const sweat = new Map();  // 찜질하는 사람(나는 'me') → 남은 시간
  const hops = [];          // 트램펄린에서 뛸 때 { id, at(다음에 뛸 때), left, mine }
  const cool = new Map();   // 가구 id → 다시 쓸 수 있을 때
  const rocked = new Set(); // 흔들의자에 앉아 같이 기울어진 사람들
  const avatarOf = (who) => (who === 'me' ? K.me : K.avatar(who));
  const CONFETTI = [0xE8483B, 0x4FA3D9, 0xF2C94C, 0x6FD08C, 0xD9577E, 0xFFFFFF];
  // 그 일이 벌어지는 모습 (나와 친구 화면 모두). who = 한 사람('me' 또는 친구 id)
  function show(use, id, who) {
    const g = K.itemObj(id), far = who === 'me' ? null : g;
    if (!g) return false;
    if (use === 'pop') {
      const [x, y, z] = world(g, ...POP_AT);
      stOf(id).kick = 1; sfx('popper', far);
      for (let k = 0; k < 44; k++) K.food.spark(x + rnd(0.1), y + Math.random() * 0.2, z + rnd(0.1), CONFETTI[k % CONFETTI.length], rnd(2.2), 2.2 + Math.random() * 2.4, rnd(2.2), 1.4 + Math.random() * 0.9, 3.6);
    } else if (use === 'spin') { stOf(id).vel = 16; sfx('whoosh', far); }
    else if (use === 'kiln') { sweat.set(who, 5); sfx('sweat', far); }
    else if (use === 'bounce') hops.push({ id, at: clock, left: 3, who });
    else return false;
    K.dirty();
    return true;
  }
  function use(id) {
    const it = K.S().items.get(id), f = it && kindOf(it.k);
    if (!f || !USES[f.use] || !K.itemObj(id)) return false;
    const go = () => {
      if (K.mode() !== null || !K.itemObj(id) || (cool.get(id) || 0) > clock) return;
      cool.set(id, clock + ({ pop: 1.6, spin: 3.4, kiln: 5.5, bounce: 4.4 })[f.use]);
      show(f.use, id, 'me');
      if (K.online()) K.fx({ k: 'use', v: f.use + ':' + id });
      if (f.use === 'pop') { K.act('cheer'); K.toast('🎉 펑! 색종이가 쏟아져요'); }
      else if (f.use === 'spin') { const p = PLACES[Math.floor(Math.random() * PLACES.length)]; setTimeout(() => K.toast('🌍 ' + p), 2600); }
      else if (f.use === 'kiln') { K.toast('♨️ 불가마 앞에서 땀을 쭉 빼는 중…'); setTimeout(() => K.toast('😌 아~ 시원하다! 매점에서 식혜 한 잔 어때요?'), 5000); }
      else if (f.use === 'bounce') K.toast('🟣 통~ 통~ 통~ 말랑말랑해요');
    };
    if (f.use === 'bounce') { const g = K.itemObj(id), [x, , z] = world(g, 0, 0, 0); K.walkTo(x + K.levelOfCell(it.i) * FLOOR_DX, z, go); } // 트램펄린은 그 위로 올라가서 뛴다
    else K.approach(id, go);
    return true;
  }

  function tick(dt) {
    clock += dt;
    const S = K.S();
    // 스스로 움직이는 소품 (풍선·지구본·곰젤리 …)
    for (const [id] of S.items) { const g = K.itemObj(id); if (g && g.visible && g.userData.live) g.userData.live(clock, dt, stOf(id)); }
    if (live.size > 140) for (const id of [...live.keys()]) if (!S.items.has(id)) live.delete(id);
    // 안마의자: 누가 앉아 있으면 덜덜 떨린다
    const seated = new Set();
    for (const a of [K.me, ...K.others().values()]) if (a.rest && a.rest.sit) seated.add(a.rest.id);
    for (const id of seated) {
      const g = K.itemObj(id), b = g && g.userData.buzz;
      if (!b) continue;
      b.position.set(Math.sin(clock * 61) * 0.004, Math.sin(clock * 47) * 0.003, 0); b.userData.on = true; K.dirty();
      if (K.me.rest && K.me.rest.id === id && (cool.get('hum') || 0) <= clock) { cool.set('hum', clock + 0.78); sfx('hum'); }
    }
    // 흔들의자: 앉은 사람과 함께 앞뒤로 흔들린다 (바닥에 닿은 곳을 축으로). 일어나면 천천히 멈춘다
    for (const [id, it] of S.items) {
      if (it.k !== 'rocker') continue;
      const g = K.itemObj(id), r = g && g.userData.rock; if (!r) continue;
      const st = stOf(id), on = seated.has(id);
      st.amp = clamp((st.amp || 0) + (on ? dt * 0.8 : -dt * 0.9), 0, 1);
      if (!st.amp && !r.rotation.x) continue;
      const ang = 0.085 * st.amp * Math.sin(clock * 2.3 + (st.ph ?? (st.ph = Math.random() * 6)));
      r.rotation.x = ang; K.dirty();
      for (const a of [K.me, ...K.others().values()]) {
        if (!a.rest || a.rest.id !== id) continue;
        const y = kindOf(it.k).rise + 0.02; g.updateMatrixWorld();
        g.localToWorld(v3.set(0, y * Math.cos(ang), y * Math.sin(ang)));
        a.rest.pos[0] = v3.x; a.rest.pos[1] = v3.y; a.rest.pos[2] = v3.z;
        a.root.rotation.order = 'YXZ'; a.root.rotation.x = ang; a.root.position.set(v3.x, v3.y, v3.z); rocked.add(a);
      }
    }
    for (const a of rocked) { const it = a.rest && S.items.get(a.rest.id); if (!it || it.k !== 'rocker') { a.root.rotation.x = 0; rocked.delete(a); } }
    for (const [id, it] of S.items) if (it.k === 'massage' && !seated.has(id)) { const g = K.itemObj(id), b = g && g.userData.buzz; if (b && b.userData.on) { b.userData.on = false; b.position.set(0, 0, 0); } }
    // 불가마 찜질: 머리에서 땀방울이 떨어진다
    for (const [who, left] of sweat) {
      const a = avatarOf(who);
      if (!a || left <= 0) { sweat.delete(who); continue; }
      sweat.set(who, left - dt);
      if (a.root.visible && Math.random() < dt * 14) { a.parts.head.getWorldPosition(v3); K.food.spark(v3.x + rnd(0.3), v3.y + 0.1 + rnd(0.2), v3.z + rnd(0.3), 0xBFE9FF, rnd(0.3), 0.5, rnd(0.3), 0.7, 3); }
    }
    // 트램펄린: 세 번 뛴다
    for (let k = hops.length - 1; k >= 0; k--) {
      const h = hops[k];
      if (clock < h.at) continue;
      const g = K.itemObj(h.id);
      if (!g || h.left <= 0) { hops.splice(k, 1); continue; }
      h.left--; h.at = clock + 1.36; stOf(h.id).kick = 1; sfx('boing', h.who === 'me' ? null : g);
      if (h.who === 'me') K.act('jump');
    }
  }

  return {
    use, tick,
    // 그 가구로 할 수 있는 일의 이름 (없으면 null)
    label(it) {
      const f = kindOf(it.k);
      if (f.play === 'serve') return f.serve.length === 1 ? '☕ 코코아 따르기' : `${f.icon} ${f.id === 'dessert' ? '디저트 고르기' : f.id === 'jellybar' ? '젤리 꺼내기' : '간식 고르기'}`;
      return USES[f.use] || null;
    },
    // 친구가 한 것 { k: 'use', v: '일:가구id' }
    peerFx(m, who) {
      const v = m && m.v;
      if (typeof v !== 'string' || v.length > 40 || !K.avatar(who)) return false;
      const [u, id, more] = v.split(':'), it = K.S().items.get(id);
      if (more !== undefined || !ID_RE.test(id || '') || !it || kindOf(it.k).use !== u) return false;
      return show(u, id, who);
    },
    test: {
      STORIES, PLACES, DRINKS, BREWING, USES,
      get brew() { const c = K.play.cur; return c && c.kind === 'coffee' ? { phase: c.phase, ground: c.ground, heat: c.heat, q: c.q, drink: c.drink.id, stream: c.stream.visible, bar: !bar.hidden } : null; },
      setHeat(h) { const c = K.play.cur; if (c && c.kind === 'coffee') { c.heat = h; coffee.dress(c); } },
      get reading() { const c = K.play.cur; return c && c.kind === 'read' ? { book: c.book, page: c.page } : null; },
      stateOf: (id) => ({ ...stOf(id) }), rockOf: (id) => { const g = K.itemObj(id); return g && g.userData.rock ? g.userData.rock.rotation.x : null; }, get sweating() { return [...sweat.keys()]; }, get hops() { return hops.length; },
      show,
    },
  };
}
