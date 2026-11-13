// 가구 모양. 도형만으로 만든다. 바닥 자리 한가운데가 (0, 0), 앞쪽이 +z, 바닥이 y = 0.
// 차지하는 칸 수는 catalog.js 의 FURNITURE 와 맞춘다(한 칸 0.5).
import { THREE, M, T, L, put, rbox, cbox, cyl, ball, bake, pool, glowAt } from './kit.js';
import { DART, TV } from './catalog.js';

// TV 화면 재질: 모든 TV 가 같이 쓴다. 무엇을 비출지는 play.js 가 정한다.
export const TV_MAT = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

const lit = (hex) => L(hex); // 스스로 빛나 보이는 색 (같은 색은 하나를 나눠 쓴다)
const WOOD = 0xC99A6B, WOOD_D = 0x8A5F3F, DARK = 0x5A3824, CREAM = 0xF3E2C3, RED = 0xD23A30, GREEN = 0x3E9A7E, GOLD = 0xE7B441;

// 다트판 그림: 스무 칸(검정·크림), 2배·3배 칸(빨강·초록), 가운데, 테두리의 숫자. 한 번만 그려서 모든 다트판이 같이 쓴다.
let dartTex = null;
function dartTexture() {
  if (dartTex) return dartTex;
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), k = (S / 2) / DART.out, R = DART.R * k, mid = S / 2;
  g.fillStyle = '#1F1A17'; g.fillRect(0, 0, S, S);
  const wedge = (i, r0, r1, col) => { // 위(-y)에서 시계 방향으로 i 번째 칸
    const a0 = -Math.PI / 2 + (i - 0.5) * Math.PI / 10, a1 = a0 + Math.PI / 10;
    g.beginPath(); g.arc(mid, mid, r1 * R, a0, a1); g.arc(mid, mid, r0 * R, a1, a0, true); g.closePath(); g.fillStyle = col; g.fill();
  };
  for (let i = 0; i < 20; i++) {
    const dark = i % 2 === 0;
    wedge(i, DART.bull2, 1, dark ? '#2A2420' : '#F1E3C6');
    wedge(i, DART.t0, DART.t1, dark ? '#C8332B' : '#2F8F5F');
    wedge(i, DART.d0, 1, dark ? '#C8332B' : '#2F8F5F');
  }
  g.strokeStyle = '#B9AE9C'; g.lineWidth = 1.5; // 칸 사이 철사
  for (let i = 0; i < 20; i++) { const a = -Math.PI / 2 + (i - 0.5) * Math.PI / 10; g.beginPath(); g.moveTo(mid + Math.cos(a) * DART.bull2 * R, mid + Math.sin(a) * DART.bull2 * R); g.lineTo(mid + Math.cos(a) * R, mid + Math.sin(a) * R); g.stroke(); }
  for (const r of [DART.bull2, DART.t0, DART.t1, DART.d0, 1]) { g.beginPath(); g.arc(mid, mid, r * R, 0, 7); g.stroke(); }
  g.beginPath(); g.arc(mid, mid, DART.bull2 * R, 0, 7); g.fillStyle = '#2F8F5F'; g.fill(); g.stroke();
  g.beginPath(); g.arc(mid, mid, DART.bull * R, 0, 7); g.fillStyle = '#C8332B'; g.fill(); g.stroke();
  g.fillStyle = '#F6EEDD'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  DART.nums.forEach((n, i) => { const a = -Math.PI / 2 + i * Math.PI / 10, rr = (DART.R + (DART.out - DART.R) * 0.52) * k; g.fillText(String(n), mid + Math.cos(a) * rr, mid + Math.sin(a) * rr + 1); });
  dartTex = new THREE.CanvasTexture(c);
  dartTex.colorSpace = THREE.SRGBColorSpace; dartTex.anisotropy = 4;
  return dartTex;
}
// 러그 그림: 테두리 두 줄, 가운데 마름모와 눈꽃. 한 번만 그려서 모든 러그가 같이 쓴다.
let rugTex = null;
function rugTexture() {
  if (rugTex) return rugTex;
  const W = 256, H = 168, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#4F6FB8'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#F3E2C3'; g.fillRect(12, 12, W - 24, H - 24);
  g.fillStyle = '#C8443A'; g.fillRect(18, 18, W - 36, H - 36);
  g.fillStyle = '#F3E2C3'; g.fillRect(22, 22, W - 44, H - 44);
  g.fillStyle = '#4A69AF'; g.fillRect(28, 28, W - 56, H - 56);
  g.fillStyle = '#F3E2C3'; // 테두리의 작은 세모들
  for (let x = 4; x < W; x += 12) for (const y of [2, H - 10]) { g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x + 4, y); g.lineTo(x + 8, y + 8); g.fill(); }
  const diamond = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 1.25, y); g.lineTo(x, y + r); g.lineTo(x - r * 1.25, y); g.fill(); };
  diamond(W / 2, H / 2, 40, '#F3E2C3'); diamond(W / 2, H / 2, 33, '#C8443A'); diamond(W / 2, H / 2, 24, '#F3E2C3'); diamond(W / 2, H / 2, 17, '#5B7BC4');
  for (const x of [58, W - 58]) { diamond(x, H / 2, 20, '#F3E2C3'); diamond(x, H / 2, 13, '#5B7BC4'); }
  g.strokeStyle = '#F3E2C3'; g.lineWidth = 2.5; g.lineCap = 'round'; // 네 귀퉁이의 눈꽃
  for (const [x, y] of [[48, 44], [W - 48, 44], [48, H - 44], [W - 48, H - 44], [W / 2, 42], [W / 2, H - 42]]) for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(x - Math.cos(a) * 8, y - Math.sin(a) * 8); g.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); g.stroke(); }
  for (let k = 0; k < 2600; k++) { g.fillStyle = `rgba(${k % 2 ? '255,255,255' : '30,20,40'},${Math.random() * 0.07})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); } // 털 느낌
  rugTex = new THREE.CanvasTexture(c);
  rugTex.colorSpace = THREE.SRGBColorSpace; rugTex.anisotropy = 4;
  return rugTex;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const WD = (hex = WOOD) => T(hex, 'wood'), FB = (hex) => T(hex, 'fabric');
const BLACK = 0x2B2420, WHITE = 0xFFFAF2, METAL = 0x8C8478;
// 불빛 번짐: 등과 불 둘레의 옅은 빛 (kit.js 의 glowAt)
const halo = (g, x, y, z, r) => glowAt(g, x, y, z, r * 3.2);
// 작은 소품들
function mug(g, x, y, z, hex, fill = 0x6B4630) { // 손잡이 달린 컵
  put(cyl(0.05, 0.042, 0.1, 12), hex, x, y + 0.05, z, g);
  put(cyl(0.042, 0.042, 0.006, 12), fill, x, y + 0.099, z, g, false);
  put(new THREE.TorusGeometry(0.028, 0.009, 6, 10, Math.PI), hex, x + 0.05, y + 0.05, z, g, false).rotation.z = -Math.PI / 2;
}
function candle(g, x, y, z, h = 0.14, hex = CREAM) { // 초와 불꽃
  put(cyl(0.05, 0.06, 0.015, 10), GOLD, x, y + 0.008, z, g, false);
  put(cyl(0.03, 0.032, h, 10), hex, x, y + 0.015 + h / 2, z, g);
  put(new THREE.ConeGeometry(0.018, 0.055, 6), lit(0xFFD166), x, y + h + 0.05, z, g, false);
}
function knob(g, x, y, z, r = 0.02) { put(ball(r, 6, 4), GOLD, x, y, z, g, false); }
// 문짝: 얕게 파인 널판 무늬 (앞면 z 에 붙인다)
function door(g, x, y, z, w, h, face, inset) {
  put(box(w, h, 0.02), face, x, y, z, g, false);
  put(box(w - 0.1, h - 0.1, 0.012), inset, x, y, z + 0.008, g, false);
  put(box(w - 0.16, h - 0.16, 0.012), face, x, y, z + 0.012, g, false);
}
function feet(g, x, z, y = 0.06) {
  for (const a of [-1, 1]) for (const b of [-1, 1]) put(cyl(0.04, 0.03, y * 2, 8), DARK, x * a, y, z * b, g);
}
function gift(g, w, h, boxc, band) {
  put(cbox(w, h, w, 0.03), boxc, 0, h / 2, 0, g);
  put(cbox(w + 0.03, 0.08, w + 0.03, 0.02), boxc, 0, h - 0.03, 0, g);                 // 뚜껑
  put(box(w + 0.036, h + 0.014, 0.07), band, 0, h / 2 + 0.002, 0, g, false);
  put(box(0.07, h + 0.014, w + 0.036), band, 0, h / 2 + 0.002, 0, g, false);
  // 포장지 무늬: 앞뒤·양옆의 물방울
  const dot = boxc === RED ? 0xF6C9C2 : 0xBFE3D3;
  for (const s of [-1, 1]) for (const [a, b] of [[-0.3, 0.3], [0.3, 0.3], [-0.3, 0.62], [0.3, 0.62], [-0.3, 0.9]]) {
    const y = b * (h - 0.1), u = a * w;
    put(new THREE.CircleGeometry(0.022, 6), dot, u, y, s * (w / 2 + 0.002), g, false).rotation.y = s > 0 ? 0 : Math.PI;
    put(new THREE.CircleGeometry(0.022, 6), dot, s * (w / 2 + 0.002), y, u, g, false).rotation.y = s * Math.PI / 2;
  }
  // 리본: 고리 둘, 늘어진 끈 둘, 매듭
  for (const s of [-1, 1]) {
    const loop = put(new THREE.TorusGeometry(0.05, 0.02, 5, 8), band, 0.06 * s, h + 0.05, 0, g);
    loop.rotation.set(0, 0, 0.5 * s); loop.scale.set(1.15, 0.8, 1.5);
    put(box(0.05, 0.012, 0.13), band, 0.035 * s, h + 0.012, 0.09, g, false).rotation.y = 0.5 * s;
  }
  put(ball(0.032, 6, 4), band, 0, h + 0.035, 0, g);
  const tag = put(box(0.09, 0.004, 0.06), CREAM, w / 2 - 0.06, h + 0.014, -w / 2 + 0.07, g, false); tag.rotation.y = 0.5; // 이름표
  pool(g, 0, 0, 0.72, 0.72);
}

const B = {
  sofa(g) { // 4 × 2
    const c = 0x4E8F73, c2 = 0x458268, c3 = 0x5FA586, c4 = 0x3D7459;
    put(cbox(1.9, 0.26, 0.86, 0.06), FB(c), 0, 0.25, 0.02, g);
    put(box(1.86, 0.03, 0.82), c4, 0, 0.125, 0.02, g, false);                          // 아래 단
    put(cbox(1.9, 0.62, 0.24, 0.08), FB(c), 0, 0.52, -0.33, g);
    for (const s of [-1, 1]) {
      put(cbox(0.24, 0.5, 0.86, 0.08), FB(c2), 0.83 * s, 0.42, 0.02, g);
      put(cyl(0.13, 0.13, 0.84, 12), FB(c2), 0.83 * s, 0.62, 0.02, g).rotation.x = Math.PI / 2;   // 둥근 팔걸이
      put(cyl(0.095, 0.095, 0.012, 12), c4, 0.83 * s, 0.62, 0.446, g, false).rotation.x = Math.PI / 2; // 팔걸이 앞 단추판
      put(ball(0.022, 6, 4), GOLD, 0.83 * s, 0.62, 0.455, g, false);
      put(rbox(0.68, 0.13, 0.56, 0.055), FB(c3), 0.36 * s, 0.435, 0.08, g);           // 앉는 쿠션
      put(rbox(0.66, 0.4, 0.16, 0.07), FB(c3), 0.36 * s, 0.7, -0.2, g).rotation.x = -0.14; // 등 쿠션
      for (const [x, y] of [[-0.16, 0.76], [0.16, 0.76], [0, 0.62]]) put(ball(0.018, 5, 3), c4, 0.36 * s + x, y, -0.118 - (y - 0.7) * 0.14, g, false); // 등 쿠션 단추
    }
    put(box(0.012, 0.1, 0.54), c4, 0, 0.44, 0.08, g, false);                           // 쿠션 사이 솔기
    put(box(1.4, 0.012, 0.012), c4, 0, 0.372, 0.365, g, false);                        // 앞 솔기
    const p1 = put(cbox(0.3, 0.3, 0.12, 0.05), T(RED, 'knit'), -0.52, 0.66, -0.06, g); p1.rotation.set(-0.3, 0.25, 0.08);
    put(box(0.1, 0.1, 0.006), CREAM, -0.52, 0.665, 0.004, g, false).rotation.set(-0.3, 0.25, 0.86); // 쿠션의 마름모 무늬
    const p2 = put(cbox(0.26, 0.26, 0.1, 0.045), FB(CREAM), 0.5, 0.64, -0.06, g); p2.rotation.set(-0.3, -0.3, -0.1);
    // 팔걸이에 걸친 담요
    put(cbox(0.3, 0.03, 0.5, 0.012), T(CREAM, 'plaid'), 0.83, 0.755, 0.06, g, false);
    put(box(0.02, 0.3, 0.5), T(CREAM, 'plaid'), 0.965, 0.6, 0.06, g, false);
    for (let k = 0; k < 6; k++) put(box(0.012, 0.05, 0.03), CREAM, 0.966, 0.43, -0.16 + k * 0.088, g, false); // 담요 술
    for (const a of [-1, 1]) for (const b of [-1, 1]) put(cyl(0.045, 0.03, 0.12, 8), WD(DARK), 0.82 * a, 0.06, 0.34 * b, g);
    pool(g, 0, 0.02, 2.5, 1.4);
  },
  chair(g) { // 2 × 2
    const c = 0xD9A441, c2 = 0xC9933A, c3 = 0xE8BC62, c4 = 0xB07E2C;
    put(cbox(0.9, 0.26, 0.84, 0.06), FB(c), 0, 0.25, 0.02, g);
    put(box(0.86, 0.03, 0.8), c4, 0, 0.125, 0.02, g, false);
    put(cbox(0.9, 0.62, 0.22, 0.08), FB(c), 0, 0.52, -0.32, g);
    put(cbox(0.74, 0.16, 0.2, 0.07), FB(c), 0, 0.84, -0.32, g);                        // 머리 받침
    for (const s of [-1, 1]) {
      put(cbox(0.2, 0.48, 0.84, 0.07), FB(c2), 0.36 * s, 0.41, 0.02, g);
      put(cyl(0.11, 0.11, 0.82, 12), FB(c2), 0.36 * s, 0.6, 0.02, g).rotation.x = Math.PI / 2;
      put(cyl(0.08, 0.08, 0.012, 12), c4, 0.36 * s, 0.6, 0.436, g, false).rotation.x = Math.PI / 2;
      put(ball(0.02, 6, 4), DARK, 0.36 * s, 0.6, 0.445, g, false);
    }
    put(rbox(0.5, 0.13, 0.56, 0.055), FB(c3), 0, 0.435, 0.08, g);
    put(cbox(0.5, 0.38, 0.14, 0.06), FB(c3), 0, 0.68, -0.2, g).rotation.x = -0.14;
    for (const x of [-0.12, 0.12]) put(ball(0.018, 5, 3), c4, x, 0.72, -0.125, g, false);
    put(cbox(0.24, 0.22, 0.09, 0.04), T(RED, 'knit'), 0.02, 0.6, -0.04, g).rotation.set(-0.32, 0.2, 0.1); // 작은 쿠션
    put(cbox(0.5, 0.03, 0.26, 0.012), T(GREEN, 'knit'), 0, 0.925, -0.32, g, false);    // 등에 걸친 뜨개 담요
    put(box(0.5, 0.2, 0.014), T(GREEN, 'knit'), 0, 0.83, -0.438, g, false);
    for (const a of [-1, 1]) for (const b of [-1, 1]) put(cyl(0.045, 0.03, 0.12, 8), WD(DARK), 0.36 * a, 0.06, 0.33 * b, g);
    pool(g, 0, 0.02, 1.4, 1.35);
  },
  fire(g) { // 4 × 2 (몸통은 뒤쪽에 붙어 있다)
    const BR = T(0xFFFFFF, 'brick'), ST = T(0x8C8478, 'stone');
    put(cbox(1.9, 0.06, 0.92, 0.02), ST, 0, 0.03, 0.02, g);
    put(cbox(1.8, 1.3, 0.55, 0.04), BR, 0, 0.71, -0.2, g);
    for (const s of [-1, 1]) put(box(0.2, 1.16, 0.06), BR, 0.74 * s, 0.64, 0.09, g);   // 앞으로 나온 벽돌 기둥
    put(box(1.68, 0.14, 0.06), ST, 0, 1.2, 0.09, g);                                   // 불구멍 위 돌 띠
    put(new THREE.BoxGeometry(0.9, 0.72, 0.06), BLACK, 0, 0.44, 0.065, g, false);
    const arch = put(cyl(0.45, 0.45, 0.06, 20, 1), BLACK, 0, 0.8, 0.065, g, false); arch.rotation.x = Math.PI / 2; arch.scale.y = 1; arch.scale.z = 0.42; // 둥근 윗머리
    put(new THREE.TorusGeometry(0.47, 0.035, 6, 16, Math.PI), ST, 0, 0.8, 0.1, g, false).scale.y = 0.44; // 아치 돌 테
    for (const s of [-1, 1]) put(box(0.07, 0.74, 0.05), ST, 0.485 * s, 0.43, 0.1, g, false);
    put(box(0.86, 0.02, 0.2), 0x3A2E28, 0, 0.07, 0.17, g, false);                      // 재 받침
    for (const s of [-1, 1]) { // 장작과 받침쇠
      const lg = put(cyl(0.06, 0.06, 0.5, 8), WD(WOOD_D), 0, 0.14, 0.14 + 0.07 * s, g); lg.rotation.z = Math.PI / 2;
      for (const e of [-1, 1]) put(cyl(0.05, 0.05, 0.004, 8), 0xD9B285, 0.252 * e, 0.14, 0.14 + 0.07 * s, g, false).rotation.z = Math.PI / 2;
      put(box(0.025, 0.2, 0.025), BLACK, 0.33 * s, 0.17, 0.25, g, false); put(ball(0.028, 6, 4), GOLD, 0.33 * s, 0.285, 0.25, g, false);
    }
    const top = put(cyl(0.055, 0.055, 0.44, 8), WD(0x9A6A45), 0.02, 0.235, 0.14, g); top.rotation.set(0, 0.35, Math.PI / 2);
    put(box(0.5, 0.03, 0.16), lit(0xE8622A), 0, 0.085, 0.15, g, false);                // 달아오른 숯
    put(new THREE.ConeGeometry(0.16, 0.42, 7), lit(0xF28C28), -0.07, 0.36, 0.14, g, false);
    put(new THREE.ConeGeometry(0.12, 0.3, 6), lit(0xFFD166), 0.1, 0.3, 0.17, g, false);
    put(new THREE.ConeGeometry(0.08, 0.2, 6), lit(0xFFF1B8), -0.02, 0.25, 0.2, g, false);
    put(new THREE.ConeGeometry(0.07, 0.22, 6), lit(0xF28C28), 0.2, 0.26, 0.12, g, false);
    put(cbox(2.0, 0.1, 0.72, 0.03), CREAM, 0, 1.41, -0.14, g);
    put(box(1.9, 0.05, 0.64), 0xE3CFAC, 0, 1.335, -0.14, g, false);                    // 선반 밑 몰딩
    for (const s of [-1, 1]) put(box(0.1, 0.16, 0.1), CREAM, 0.74 * s, 1.26, 0.13, g, false); // 선반 받침
    // 벽난로 위 풀장식과 양말
    put(cbox(1.7, 0.09, 0.14, 0.04), M(0x2F7D56, true), 0, 1.5, 0.1, g);
    for (let k = 0; k < 9; k++) { const x = -0.8 + k * 0.2; put(new THREE.ConeGeometry(0.07, 0.16, 5), M(k % 2 ? 0x3A9163 : 0x2F7D56, true), x, 1.5, 0.15, g, false).rotation.set(Math.PI / 2 + 0.5, 0, (k % 3 - 1) * 0.5); }
    for (const x of [-0.6, -0.2, 0.2, 0.6]) put(ball(0.04, 6, 4), RED, x, 1.52, 0.17, g, false);
    for (const x of [-0.4, 0, 0.4]) put(ball(0.03, 6, 4), GOLD, x, 1.5, 0.19, g, false);
    [[-0.5, RED], [0, CREAM], [0.5, GREEN]].forEach(([x, col]) => {
      put(cbox(0.13, 0.24, 0.05, 0.02), T(col, 'knit'), x, 1.2, 0.15, g);
      put(cbox(0.16, 0.07, 0.06, 0.02), col === CREAM ? RED : WHITE, x, 1.32, 0.15, g, false);
      put(cbox(0.2, 0.09, 0.05, 0.02), T(col, 'knit'), x + 0.04, 1.08, 0.15, g, false);
      put(box(0.012, 0.06, 0.012), GOLD, x - 0.05, 1.37, 0.15, g, false);              // 거는 고리
    });
    // 선반 위: 초 둘, 작은 시계, 액자
    candle(g, -0.82, 1.46, -0.22, 0.16, RED); candle(g, 0.82, 1.46, -0.22, 0.12, WHITE);
    put(cbox(0.2, 0.2, 0.08, 0.03), WD(WOOD_D), -0.3, 1.56, -0.28, g); put(cyl(0.07, 0.07, 0.01, 14), WHITE, -0.3, 1.57, -0.236, g, false).rotation.x = Math.PI / 2;
    put(box(0.008, 0.05, 0.004), BLACK, -0.3, 1.59, -0.228, g, false); put(box(0.035, 0.008, 0.004), BLACK, -0.285, 1.57, -0.228, g, false);
    put(box(0.22, 0.28, 0.03), GOLD, 0.34, 1.6, -0.3, g).rotation.x = -0.12; put(box(0.17, 0.23, 0.01), 0xDCEBE3, 0.34, 1.6, -0.283, g, false).rotation.x = -0.12;
    put(ball(0.045, 6, 4), 0x2F7D56, 0.34, 1.58, -0.276, g, false).scale.set(1, 1.3, 0.2);
    // 부지깽이 걸이
    put(cyl(0.05, 0.06, 0.02, 8), BLACK, 0.86, 0.07, 0.36, g, false);
    for (const dx of [-0.02, 0.02]) put(cyl(0.008, 0.008, 0.5, 5), BLACK, 0.86 + dx, 0.32, 0.36, g, false).rotation.z = dx * 4;
    pool(g, 0, 0.02, 2.4, 1.3);
    pool(g, 0, 0.62, 1.5, 0.9, { hex: 0xFF9A3C, op: 0.4, add: true });                 // 불빛이 바닥에 번진다
    halo(g, 0, 0.36, 0.22, 0.42);
  },
  table(g) { // 3 × 2
    put(cbox(1.4, 0.07, 0.9, 0.03), WD(WOOD), 0, 0.43, 0, g);
    put(box(1.24, 0.07, 0.74), WD(WOOD_D), 0, 0.365, 0, g, false);                     // 상판 밑 틀
    for (const a of [-1, 1]) for (const b of [-1, 1]) put(cyl(0.045, 0.03, 0.4, 8), WD(WOOD_D), 0.6 * a, 0.2, 0.36 * b, g);
    for (const a of [-1, 1]) put(box(0.03, 0.03, 0.72), WD(WOOD_D), 0.6 * a, 0.12, 0, g, false);
    put(box(1.2, 0.03, 0.03), WD(WOOD_D), 0, 0.12, 0, g, false);                       // 다리 사이 가로대
    const deco = new THREE.Group(); g.add(deco); g.userData.deco = deco; deco.userData.own = true; // 윗면의 소품 (케이크를 올려놓으면 숨긴다)
    put(box(0.36, 0.004, 0.92), T(RED, 'plaid'), 0, 0.467, 0, deco, false);            // 가운데 깔개
    for (const s of [-1, 1]) put(box(0.36, 0.05, 0.004), T(RED, 'plaid'), 0, 0.445, 0.452 * s, deco, false);
    put(cyl(0.17, 0.13, 0.025, 16), 0xFFFAF2, -0.42, 0.478, 0.04, deco);
    put(cyl(0.172, 0.172, 0.006, 16), RED, -0.42, 0.486, 0.04, deco, false);
    put(cyl(0.15, 0.15, 0.008, 16), 0xFFFAF2, -0.42, 0.488, 0.04, deco, false);
    for (const [x, z] of [[-0.47, 0.02], [-0.37, 0.09], [-0.4, -0.03]]) { put(cyl(0.045, 0.045, 0.02, 10), 0xC98A4B, x, 0.5, z, deco, false); put(cyl(0.012, 0.012, 0.022, 6), 0x5A3824, x + 0.012, 0.501, z + 0.01, deco, false); put(cyl(0.01, 0.01, 0.022, 6), 0x5A3824, x - 0.016, 0.501, z - 0.008, deco, false); }
    mug(deco, 0.4, 0.465, 0.14, RED);
    for (const [x, z] of [[0.385, 0.13], [0.415, 0.15]]) put(box(0.022, 0.014, 0.022), WHITE, x, 0.57, z, deco, false); // 마시멜로
    mug(deco, 0.5, 0.465, -0.1, GREEN);
    candle(deco, 0, 0.47, -0.16, 0.14);
    put(ball(0.05, 6, 4), 0x2F7D56, 0, 0.5, 0.1, deco, false).scale.set(1.5, 0.5, 1);  // 호랑가시 잎과 열매
    for (const [x, z] of [[-0.02, 0.1], [0.025, 0.09], [0, 0.125]]) put(ball(0.018, 5, 3), RED, x, 0.53, z, deco, false);
    put(box(0.2, 0.025, 0.14), 0x4F6FB8, -0.36, 0.48, -0.26, deco, false).rotation.y = 0.3; // 책
    put(box(0.19, 0.008, 0.13), 0xFFF8EA, -0.36, 0.483, -0.257, deco, false).rotation.y = 0.3;
    pool(g, 0, 0, 1.9, 1.4);
  },
  shelf(g) { // 3 × 1
    put(new THREE.BoxGeometry(1.45, 1.5, 0.04), WD(WOOD_D), 0, 0.75, -0.19, g);
    for (const s of [-1, 1]) put(cbox(0.05, 1.5, 0.42, 0.02), WD(WOOD_D), 0.7 * s, 0.75, 0, g);
    for (const y of [0.04, 0.5, 0.96, 1.48]) put(new THREE.BoxGeometry(1.4, 0.04, 0.4), WD(WOOD), 0, y, 0, g);
    put(cbox(1.5, 0.06, 0.46, 0.02), WD(WOOD_D), 0, 1.53, 0, g);                       // 윗몰딩
    put(box(1.46, 0.07, 0.02), WD(WOOD_D), 0, 0.035, 0.205, g, false);                 // 아래 걸레받이
    const cols = [RED, GREEN, 0x4F6FB8, GOLD, CREAM, 0x8A6BBE, 0xC96F4A, 0x3D7459];
    let n = 3;
    const rows = [0.06, 0.52, 0.98];
    rows.forEach((y, ri) => {
      let x = -0.64;
      const end = ri === 2 ? 0.34 : ri === 1 ? 0.2 : 0.5;
      while (x < end) {
        n = (n * 13 + 7) % 97;
        const w = 0.06 + (n % 4) * 0.015, h = 0.26 + (n % 5) * 0.03, col = cols[n % cols.length];
        const lean = n % 11 === 0 ? 0.16 : 0;
        const b = put(new THREE.BoxGeometry(w, h, 0.26), col, x + w / 2 + lean * h / 2, y + h / 2, 0.02, g, false); b.rotation.z = -lean;
        if (!lean) { // 책등의 띠와 제목 칸
          put(new THREE.PlaneGeometry(w, 0.016), col === GOLD || col === CREAM ? DARK : GOLD, x + w / 2, y + h - 0.05, 0.1515, g, false);
          if (n % 3 === 0) put(new THREE.PlaneGeometry(w - 0.02, 0.07), CREAM, x + w / 2, y + h * 0.45, 0.1515, g, false);
          put(new THREE.PlaneGeometry(w - 0.012, 0.24), 0xFFF8EA, x + w / 2, y + h + 0.002, 0.02, g, false).rotation.x = -Math.PI / 2; // 종이 윗면
        }
        x += w + 0.008 + lean * h;
        if (n % 6 === 0) x += 0.14; // 빈칸
      }
    });
    // 책 사이 소품: 눈 구슬, 작은 화분, 눕힌 책 더미와 액자, 꼭대기의 작은 트리와 상자
    put(cyl(0.07, 0.08, 0.04, 12), WD(DARK), 0.52, 1.0, 0.02, g, false);
    put(ball(0.09, 12, 10), 0xE8F4FA, 0.52, 1.1, 0.02, g, false);
    put(new THREE.ConeGeometry(0.035, 0.09, 6), 0x2F7D56, 0.52, 1.08, 0.02, g, false);
    put(cyl(0.06, 0.045, 0.09, 10), 0xB5523F, 0.42, 0.565, 0.04, g, false);
    for (let k = 0; k < 5; k++) { const a = k * 1.26; put(ball(0.05, 5, 3), M(0x3A9163, true), 0.42 + Math.cos(a) * 0.045, 0.65 + (k % 2) * 0.03, 0.04 + Math.sin(a) * 0.045, g, false).scale.set(0.7, 1.3, 0.7); }
    [[0x4F6FB8, 0.24], [RED, 0.21], [CREAM, 0.19]].forEach(([c, w], k) => put(box(w, 0.045, 0.2), c, 0.56, 0.545 + k * 0.047, 0.02, g, false).rotation.y = (k - 1) * 0.12);
    put(box(0.16, 0.2, 0.02), GOLD, 0.56, 0.79, -0.02, g, false).rotation.x = -0.15; put(box(0.12, 0.16, 0.012), 0xF7C9B8, 0.56, 0.79, -0.006, g, false).rotation.x = -0.15;
    put(new THREE.ConeGeometry(0.1, 0.24, 7), M(0x2F7D56, true), -0.45, 1.7, 0, g); put(cyl(0.02, 0.02, 0.04, 6), DARK, -0.45, 1.58, 0, g, false); put(ball(0.022, 5, 3), GOLD, -0.45, 1.83, 0, g, false);
    put(cbox(0.3, 0.16, 0.24, 0.02), 0x8A6BBE, 0.36, 1.64, 0, g); put(box(0.305, 0.03, 0.245), CREAM, 0.36, 1.66, 0, g, false);
    put(cyl(0.05, 0.04, 0.11, 10), WHITE, 0, 1.615, 0.04, g, false); for (const dx of [-0.015, 0.02]) put(cyl(0.006, 0.006, 0.16, 5), dx < 0 ? RED : 0x4F6FB8, dx, 1.7, 0.04, g, false).rotation.z = dx * 12; // 연필꽂이
    pool(g, 0, 0.02, 1.85, 0.8);
  },
  giftR(g) { gift(g, 0.38, 0.32, RED, GOLD); },
  giftG(g) { gift(g, 0.34, 0.44, GREEN, CREAM); },
  plant(g) {
    put(cyl(0.17, 0.17, 0.015, 12), 0x9C4A3A, 0, 0.008, 0, g, false);                  // 받침 접시
    put(cyl(0.15, 0.11, 0.2, 12), 0xB5523F, 0, 0.1, 0, g);
    put(cyl(0.165, 0.165, 0.04, 12), 0xC46650, 0, 0.19, 0, g);                         // 화분 테
    put(cyl(0.152, 0.13, 0.05, 12), GOLD, 0, 0.1, 0, g, false);                        // 금박 띠
    put(cyl(0.14, 0.14, 0.01, 12), 0x4A3423, 0, 0.207, 0, g, false);                   // 흙
    put(cyl(0.02, 0.025, 0.2, 6), 0x5E7A3A, 0, 0.3, 0, g, false);
    const leaf = (a, r, y, len, wid, col, tilt, flat) => { // 뾰족한 잎 한 장: 줄기에서 바깥으로
      const p = new THREE.Group(); p.rotation.y = a; g.add(p);
      const m = put(new THREE.ConeGeometry(wid, len, 4), flat ? M(col, true) : col, r + len / 2, y, 0, p, r > 0.08);
      m.rotation.z = -Math.PI / 2 - tilt; m.scale.set(0.28, 1, 1);
    };
    for (let k = 0; k < 7; k++) leaf((k / 7) * Math.PI * 2, 0.02, 0.33, 0.24, 0.085, k % 2 ? 0x2F7D56 : 0x3A9163, 0.12, true);
    for (let k = 0; k < 6; k++) leaf((k / 6) * Math.PI * 2 + 0.3, 0.015, 0.43, 0.2, 0.075, k % 2 ? RED : 0xC02E28, -0.08, false);
    for (let k = 0; k < 5; k++) leaf((k / 5) * Math.PI * 2 + 0.9, 0.01, 0.48, 0.12, 0.05, 0xE2483C, -0.3, false);
    for (let k = 0; k < 5; k++) { const a = k * 1.26; put(ball(0.018, 5, 3), GOLD, Math.cos(a) * 0.025, 0.5, Math.sin(a) * 0.025, g, false); }
    put(ball(0.02, 5, 3), 0x9BC25A, 0, 0.51, 0, g, false);
    pool(g, 0, 0, 0.7, 0.7);
  },
  lamp(g) {
    put(cyl(0.14, 0.16, 0.04, 14), WD(DARK), 0, 0.02, 0, g);
    put(cyl(0.09, 0.13, 0.03, 14), 0xC9A24B, 0, 0.055, 0, g, false);
    put(cyl(0.018, 0.018, 1.25, 8), 0xC9A24B, 0, 0.65, 0, g);
    for (const y of [0.34, 0.9]) put(ball(0.032, 6, 4), 0xB8862A, 0, y, 0, g, false);  // 기둥 마디
    put(cyl(0.12, 0.22, 0.28, 14, 1, true), lit(0xFFE2A8), 0, 1.36, 0, g, false);
    put(cyl(0.118, 0.118, 0.004, 14), lit(0xFFF4D8), 0, 1.5, 0, g, false);
    put(new THREE.TorusGeometry(0.22, 0.012, 5, 16), GOLD, 0, 1.222, 0, g, false).rotation.x = Math.PI / 2;
    put(new THREE.TorusGeometry(0.12, 0.01, 5, 16), GOLD, 0, 1.5, 0, g, false).rotation.x = Math.PI / 2;
    put(ball(0.05, 6, 4), lit(0xFFF6DC), 0, 1.32, 0, g, false);                        // 전구
    put(ball(0.02, 5, 3), GOLD, 0, 1.53, 0, g, false);
    put(cyl(0.003, 0.003, 0.16, 4), GOLD, 0.1, 1.16, 0.06, g, false); put(ball(0.014, 5, 3), GOLD, 0.1, 1.08, 0.06, g, false); // 당기는 줄
    pool(g, 0, 0, 0.7, 0.7);
    pool(g, 0, 0, 1.2, 1.2, { hex: 0xFFC46B, op: 0.3, add: true });
    halo(g, 0, 1.36, 0, 0.34);
  },
  snowman(g) {
    const w = 0xFFFAF2;
    put(cyl(0.24, 0.26, 0.03, 12), 0xF2F6FB, 0, 0.012, 0, g, false);                   // 발밑 눈
    put(ball(0.2, 14, 10), w, 0, 0.19, 0, g).scale.y = 0.94;
    put(ball(0.15, 14, 10), w, 0, 0.48, 0, g).scale.y = 0.95;
    put(ball(0.115, 14, 10), w, 0, 0.7, 0, g);
    put(new THREE.ConeGeometry(0.025, 0.1, 8), 0xF28C28, 0, 0.7, 0.15, g, false).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) put(ball(0.015, 5, 3), 0x2B2420, 0.04 * s, 0.735, 0.1, g, false);
    for (let k = -2; k <= 2; k++) put(ball(0.008, 5, 4), 0x2B2420, k * 0.018, 0.668 + Math.abs(k) * 0.006, 0.107 - Math.abs(k) * 0.003, g, false); // 웃는 입
    for (const s of [-1, 1]) put(ball(0.02, 5, 3), 0xF7B6B0, 0.07 * s, 0.7, 0.088, g, false).scale.set(1, 0.6, 0.4); // 볼
    for (const y of [0.4, 0.47, 0.54]) put(ball(0.018, 5, 3), 0x2B2420, 0, y, 0.15 - Math.abs(y - 0.47) * 0.25, g, false);
    put(new THREE.TorusGeometry(0.11, 0.035, 8, 16), T(RED, 'knit'), 0, 0.6, 0, g).rotation.x = Math.PI / 2;
    put(cbox(0.07, 0.2, 0.03, 0.012), T(RED, 'knit'), 0.07, 0.5, 0.125, g, false).rotation.z = 0.15; // 늘어진 목도리
    for (const k of [0, 1, 2]) put(box(0.012, 0.03, 0.01), CREAM, 0.065 + k * 0.022, 0.39, 0.127, g, false);
    for (const s of [-1, 1]) { // 나뭇가지 팔
      const a = put(cyl(0.01, 0.014, 0.2, 5), WD(WOOD_D), 0.185 * s, 0.56, 0, g); a.rotation.z = -1.0 * s;
      put(cyl(0.006, 0.008, 0.06, 4), WOOD_D, 0.25 * s, 0.63, 0.012, g, false).rotation.z = -0.3 * s;
      put(cyl(0.006, 0.008, 0.06, 4), WOOD_D, 0.262 * s, 0.6, -0.012, g, false).rotation.z = -1.5 * s;
    }
    put(cyl(0.11, 0.11, 0.02, 14), 0x2B2420, 0, 0.8, 0, g);
    put(cyl(0.075, 0.075, 0.11, 14), 0x2B2420, 0, 0.865, 0, g);
    put(cyl(0.078, 0.078, 0.03, 14), RED, 0, 0.83, 0, g, false);                       // 모자 띠
    put(ball(0.022, 5, 3), 0x2F7D56, 0.06, 0.835, 0.05, g, false).scale.set(1.6, 0.6, 1); put(ball(0.012, 5, 4), RED, 0.068, 0.845, 0.062, g, false);
    pool(g, 0, 0, 0.75, 0.75);
  },
  dart(g) { // 다트판: 세워 둔 대에 걸려 있다. 칸과 숫자는 catalog.js 의 DART 대로 그린다
    put(cyl(0.2, 0.22, 0.04, 14), WD(DARK), 0, 0.02, -0.06, g);
    put(cyl(0.12, 0.17, 0.03, 14), WD(WOOD_D), 0, 0.055, -0.06, g, false);
    put(cyl(0.025, 0.025, 1.56, 8), WD(WOOD_D), 0, 0.8, -0.06, g);
    put(cbox(0.46, 0.46, 0.03, 0.02), WD(WOOD), 0, DART.y, -0.058, g).rotation.z = Math.PI / 4; // 판 뒤 나무 받침
    const rim = put(cyl(DART.out + 0.012, DART.out + 0.012, 0.06, 36), 0x2B2420, 0, DART.y, -0.012, g);
    rim.rotation.x = Math.PI / 2;
    const face = put(new THREE.CircleGeometry(DART.out, 48), new THREE.MeshLambertMaterial({ map: dartTexture() }), 0, DART.y, DART.z - 0.016, g, false);
    face.receiveShadow = false;
    // 대에 달린 화살 꽂이와 점수 적는 판
    put(box(0.3, 0.02, 0.07), WD(WOOD), 0, 0.72, -0.03, g, false);
    [[-0.09, RED], [0, GOLD], [0.09, 0x4F6FB8]].forEach(([x, c]) => {
      put(cyl(0.006, 0.006, 0.12, 5), METAL, x, 0.79, -0.02, g, false);
      put(new THREE.ConeGeometry(0.022, 0.06, 4), c, x, 0.87, -0.02, g, false).rotation.x = Math.PI;
    });
    put(box(0.2, 0.14, 0.012), 0x33423A, 0, 0.55, -0.035, g, false); put(box(0.22, 0.16, 0.008), WD(WOOD), 0, 0.55, -0.042, g, false);
    for (const [x, y, w] of [[-0.04, 0.58, 0.08], [0.02, 0.55, 0.12], [-0.02, 0.52, 0.06]]) put(box(w, 0.008, 0.002), WHITE, x, y, -0.028, g, false);
    pool(g, 0, -0.04, 0.7, 0.7);
  },
  tv(g) { // 3 × 1, 낮은 장 위의 TV
    put(cbox(1.4, 0.42, 0.42, 0.03), WD(WOOD), 0, 0.27, 0, g);
    put(box(1.44, 0.03, 0.46), WD(WOOD_D), 0, 0.485, 0, g, false);                     // 장의 윗판
    for (const s of [-1, 1]) { door(g, 0.34 * s, 0.27, 0.212, 0.6, 0.3, WD(WOOD_D), DARK); knob(g, 0.08 * s, 0.27, 0.238); }
    feet(g, 0.62, 0.15, 0.03);
    put(cyl(0.06, 0.1, 0.05, 12), 0x2B2420, 0, 0.525, -0.02, g);
    put(box(0.4, 0.014, 0.2), 0x2B2420, 0, 0.507, -0.02, g, false);                    // TV 발판
    put(cbox(TV.w + 0.1, TV.h + 0.1, 0.06, 0.02), 0x2B2420, 0, TV.y, -0.02, g);
    put(box(TV.w + 0.02, 0.02, 0.01), 0x4A423C, 0, TV.y - TV.h / 2 - 0.035, 0.012, g, false);
    put(ball(0.008, 5, 4), lit(0x7CFF9A), TV.w / 2 - 0.02, TV.y - TV.h / 2 - 0.035, 0.016, g, false); // 전원 불
    put(new THREE.PlaneGeometry(TV.w, TV.h), TV_MAT, 0, TV.y, TV.z, g, false).receiveShadow = false;
    // 장 위: 게임기와 조종기, 작은 화분, 리모컨
    put(cbox(0.2, 0.04, 0.14, 0.012), WHITE, -0.5, 0.52, 0.1, g, false); put(box(0.08, 0.004, 0.004), lit(0x6FD0FF), -0.5, 0.52, 0.171, g, false);
    put(cbox(0.11, 0.025, 0.06, 0.01), 0x3A3F4A, -0.28, 0.513, 0.14, g, false).rotation.y = 0.4;
    put(cyl(0.045, 0.035, 0.07, 8), 0xB5523F, 0.55, 0.535, 0.08, g, false);
    for (let k = 0; k < 4; k++) put(ball(0.04, 5, 3), M(k % 2 ? 0x3A9163 : 0x2F7D56, true), 0.55 + Math.cos(k * 1.6) * 0.03, 0.6 + (k % 2) * 0.03, 0.08 + Math.sin(k * 1.6) * 0.03, g, false).scale.set(0.7, 1.2, 0.7);
    put(box(0.04, 0.012, 0.12), BLACK, 0.3, 0.507, 0.14, g, false).rotation.y = -0.3;
    pool(g, 0, 0.02, 1.8, 0.8);
  },
  music(g) { // 작은 탁자 위의 오르골 (나팔이 달린 상자)
    put(cyl(0.16, 0.18, 0.03, 14), WD(WOOD_D), 0, 0.015, 0, g);
    put(cyl(0.035, 0.05, 0.5, 8), WD(WOOD_D), 0, 0.27, 0, g);
    put(ball(0.055, 6, 4), WD(WOOD_D), 0, 0.2, 0, g, false).scale.y = 0.7;
    put(cyl(0.21, 0.21, 0.04, 18), WD(WOOD), 0, 0.53, 0, g);
    put(cyl(0.2, 0.2, 0.004, 18), CREAM, 0, 0.552, 0, g, false);                       // 레이스 깔개
    put(cbox(0.26, 0.14, 0.22, 0.02), RED, 0, 0.62, 0, g);
    put(new THREE.BoxGeometry(0.265, 0.02, 0.225), GOLD, 0, 0.62, 0, g, false);
    for (const a of [-1, 1]) for (const b of [-1, 1]) put(box(0.03, 0.142, 0.03), GOLD, 0.118 * a, 0.62, 0.098 * b, g, false); // 모서리 금장
    put(cyl(0.085, 0.085, 0.008, 16), BLACK, -0.03, 0.694, 0, g, false); put(cyl(0.03, 0.03, 0.01, 10), GOLD, -0.03, 0.695, 0, g, false); // 돌아가는 판
    const horn = put(new THREE.ConeGeometry(0.17, 0.3, 16, 1, true), new THREE.MeshLambertMaterial({ color: GOLD, side: THREE.DoubleSide }), 0.05, 0.86, 0.03, g);
    horn.rotation.set(0.25, 0, Math.PI - 0.4);
    put(cyl(0.012, 0.012, 0.1, 6), GOLD, 0.16, 0.62, 0, g, false).rotation.z = Math.PI / 2;
    put(ball(0.022, 6, 4), DARK, 0.21, 0.62, 0, g, false);
    put(box(0.07, 0.07, 0.004), CREAM, 0, 0.62, 0.113, g, false).rotation.z = Math.PI / 4; // 앞면의 무늬
    put(ball(0.016, 5, 3), GOLD, 0, 0.62, 0.118, g, false);
    pool(g, 0, 0, 0.7, 0.7);
  },
  cake(g) { // 3 × 2, 케이크 작업대. 케이크 자체는 cake.js 가 올린다
    const body = 0xE9DCC3, face = 0xF6EEDD, line = 0xD5C4A4;
    put(cbox(1.4, 0.8, 0.9, 0.04), body, 0, 0.42, 0, g);
    put(box(1.36, 0.08, 0.86), 0x8A7A66, 0, 0.04, 0, g, false);                        // 걸레받이
    put(cbox(1.48, 0.07, 0.98, 0.03), WD(WOOD), 0, 0.86, 0, g);
    for (const s of [-1, 1]) {
      door(g, 0.34 * s, 0.36, 0.455, 0.6, 0.5, face, line); knob(g, 0.1 * s, 0.44, 0.482);
      put(box(0.6, 0.12, 0.02), face, 0.34 * s, 0.73, 0.455, g, false); put(cyl(0.01, 0.01, 0.16, 6), GOLD, 0.34 * s, 0.73, 0.475, g, false).rotation.z = Math.PI / 2; // 서랍
      door(g, 0.34 * s, 0.42, -0.455, 0.6, 0.62, face, line);
    }
    put(cyl(0.012, 0.012, 0.5, 6), METAL, -0.715, 0.66, 0, g, false).rotation.x = Math.PI / 2; // 옆의 수건걸이
    put(box(0.012, 0.3, 0.26), T(RED, 'plaid'), -0.722, 0.52, 0.02, g, false);
    put(cbox(0.3, 0.02, 0.2, 0.008), T(RED, 'plaid'), -0.52, 0.905, 0.28, g, false);      // 행주
    put(cyl(0.05, 0.04, 0.1, 10), 0xFFFAF2, 0.55, 0.945, -0.28, g);            // 컵
    put(cyl(0.012, 0.012, 0.2, 6), WOOD_D, 0.56, 1.02, -0.27, g, false).rotation.z = 0.3; // 거품기 자루
    put(cyl(0.006, 0.006, 0.18, 5), METAL, 0.535, 1.02, -0.29, g, false).rotation.z = -0.25;
    // 밀가루 자루, 밀대, 달걀, 뿌리는 가루 병
    put(cbox(0.14, 0.2, 0.1, 0.03), 0xF4EBDD, -0.58, 0.995, -0.3, g); put(box(0.08, 0.06, 0.004), RED, -0.58, 1.0, -0.248, g, false);
    const pin = put(cyl(0.028, 0.028, 0.3, 8), WD(WOOD), 0.5, 0.925, 0.36, g, false); pin.rotation.set(0, 0.3, Math.PI / 2);
    for (const e of [-1, 1]) put(cyl(0.012, 0.012, 0.07, 6), WOOD_D, 0.5 + 0.175 * e, 0.925, 0.36 - 0.054 * e, g, false).rotation.set(0, 0.3, Math.PI / 2);
    for (const [x, z] of [[-0.6, 0.06], [-0.55, 0.11]]) put(ball(0.03, 6, 4), 0xF7E6CF, x, 0.92, z, g, false).scale.y = 1.25;
    [[0xF2B544, 0.6], [0xF7B6C2, 0.52]].forEach(([c, x]) => { put(cyl(0.03, 0.03, 0.08, 8), c, x, 0.935, 0.08, g, false); put(cyl(0.032, 0.032, 0.02, 8), WHITE, x, 0.985, 0.08, g, false); });
    pool(g, 0, 0, 1.9, 1.4);
  },
  counter(g) { // 2 × 1, 조리대 (뒤쪽 벽에 붙인다)
    const face = 0xF6EEDD, line = 0xD5C4A4;
    put(cbox(0.98, 0.82, 0.46, 0.03), 0xE9DCC3, 0, 0.43, 0, g);
    put(box(0.96, 0.08, 0.42), 0x8A7A66, 0, 0.04, 0, g, false);
    put(cbox(1.0, 0.06, 0.5, 0.02), WD(WOOD), 0, 0.87, 0, g);
    put(box(1.0, 0.2, 0.02), 0xF4EDE0, 0, 1.0, -0.24, g, false);                       // 뒤 타일 턱
    for (let k = -2; k <= 2; k++) put(box(0.004, 0.2, 0.004), 0xD9CDB8, k * 0.2, 1.0, -0.229, g, false);
    for (const s of [-1, 1]) { door(g, 0.24 * s, 0.37, 0.235, 0.44, 0.5, face, line); knob(g, 0.06 * s, 0.46, 0.262, 0.018); put(box(0.44, 0.1, 0.02), face, 0.24 * s, 0.72, 0.235, g, false); put(cyl(0.009, 0.009, 0.14, 6), GOLD, 0.24 * s, 0.72, 0.255, g, false).rotation.z = Math.PI / 2; }
    put(cyl(0.1, 0.06, 0.08, 12), 0xFFFAF2, -0.3, 0.94, 0.02, g);                      // 과일 그릇
    put(ball(0.045, 6, 4), RED, -0.33, 0.985, 0.03, g, false); put(ball(0.045, 6, 4), 0xE7A13A, -0.26, 0.985, 0.0, g, false); put(ball(0.04, 6, 4), 0x9BC25A, -0.3, 1.0, 0.05, g, false);
    put(cbox(0.3, 0.02, 0.22, 0.008), WD(0xD9B285), 0.2, 0.91, 0.06, g, false);        // 도마와 빵, 칼
    put(new THREE.CapsuleGeometry(0.05, 0.12, 3, 8), 0xC98A4B, 0.17, 0.955, 0.06, g, false).rotation.z = Math.PI / 2;
    put(box(0.012, 0.004, 0.14), 0xD8DDE2, 0.31, 0.922, 0.05, g, false).rotation.y = 0.2; put(box(0.016, 0.014, 0.07), DARK, 0.29, 0.925, 0.15, g, false).rotation.y = 0.2;
    for (const [x, c] of [[0.36, 0xF2B544], [0.44, 0xC8443A]]) { put(cyl(0.035, 0.035, 0.1, 8), 0xE8F0F2, x, 0.95, -0.16, g, false); put(cyl(0.03, 0.03, 0.06, 8), c, x, 0.935, -0.16, g, false); put(cyl(0.037, 0.037, 0.02, 8), WOOD_D, x, 1.008, -0.16, g, false); } // 양념 병
    pool(g, 0, 0.02, 1.3, 0.8);
  },
  stove(g) { // 2 × 1, 오븐과 가스레인지
    put(cbox(0.98, 0.84, 0.46, 0.03), 0xD9D0C3, 0, 0.44, 0, g);
    put(box(0.96, 0.08, 0.42), 0x6E655C, 0, 0.04, 0, g, false);
    put(box(0.98, 0.016, 0.46), 0x2B2420, 0, 0.866, 0, g, false);                      // 검은 윗판
    put(box(0.98, 0.14, 0.03), 0xC9C0B2, 0, 0.94, -0.215, g, false);                   // 뒤 턱
    put(new THREE.BoxGeometry(0.7, 0.4, 0.02), 0x2B2420, 0, 0.36, 0.235, g, false);
    put(new THREE.BoxGeometry(0.5, 0.22, 0.01), lit(0xF7B25A), 0, 0.36, 0.247, g, false); // 오븐 안 불빛
    for (const y of [0.31, 0.41]) put(box(0.5, 0.006, 0.004), 0x7A4A20, 0, y, 0.253, g, false); // 오븐 안 석쇠
    put(cyl(0.012, 0.012, 0.6, 6), 0x8C8478, 0, 0.6, 0.26, g, false).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) put(box(0.02, 0.02, 0.04), 0x8C8478, 0.28 * s, 0.6, 0.245, g, false);
    put(box(0.9, 0.12, 0.012), 0xC9C0B2, 0, 0.74, 0.232, g, false);                    // 손잡이 판
    for (const x of [-0.24, 0.24]) {
      put(cyl(0.11, 0.11, 0.02, 14), 0x2B2420, x, 0.875, 0, g, false);
      put(new THREE.TorusGeometry(0.075, 0.012, 5, 14), 0x5A534C, x, 0.888, 0, g, false).rotation.x = Math.PI / 2;
      for (let k = 0; k < 4; k++) put(box(0.1, 0.012, 0.014), 0x5A534C, x + Math.cos(k * Math.PI / 2) * 0.07, 0.892, Math.sin(k * Math.PI / 2) * 0.07, g, false).rotation.y = -k * Math.PI / 2;
    }
    for (const x of [-0.36, -0.24, 0.24, 0.36]) { put(cyl(0.025, 0.025, 0.03, 8), Math.abs(x) > 0.3 ? 0x4A423C : RED, x, 0.74, 0.25, g, false).rotation.x = Math.PI / 2; put(box(0.006, 0.03, 0.004), WHITE, x, 0.74, 0.267, g, false); }
    put(cyl(0.13, 0.11, 0.1, 14), 0xC8443A, -0.24, 0.95, 0, g);                // 냄비
    put(cyl(0.135, 0.135, 0.016, 14), 0xB03A31, -0.24, 1.005, 0, g, false); put(ball(0.022, 5, 3), BLACK, -0.24, 1.03, 0, g, false);
    for (const s of [-1, 1]) put(box(0.05, 0.016, 0.03), BLACK, -0.24 + 0.15 * s, 0.975, 0, g, false);
    put(cyl(0.11, 0.09, 0.03, 14), 0x3A3F4A, 0.24, 0.915, 0, g, false);                // 프라이팬과 달걀
    put(box(0.2, 0.016, 0.03), BLACK, 0.4, 0.92, 0.07, g, false).rotation.y = -0.4;
    put(cyl(0.06, 0.06, 0.006, 10), WHITE, 0.235, 0.932, 0.005, g, false).scale.set(1.15, 1, 0.9); put(ball(0.022, 6, 4), 0xF2B544, 0.245, 0.936, 0, g, false).scale.y = 0.5;
    pool(g, 0, 0.02, 1.3, 0.8);
  },
  fridge(g) { // 2 × 1, 키 큰 냉장고
    put(cbox(0.92, 1.75, 0.46, 0.04), 0xEEF2F4, 0, 0.9, 0, g);
    put(box(0.88, 0.06, 0.4), 0x9AA3A8, 0, 0.03, 0, g, false);
    put(cbox(0.88, 0.56, 0.02, 0.008), 0xF7FAFB, 0, 1.45, 0.232, g, false);            // 윗문(냉동)
    put(cbox(0.88, 1.04, 0.02, 0.008), 0xF7FAFB, 0, 0.62, 0.232, g, false);            // 아랫문
    put(new THREE.BoxGeometry(0.9, 0.012, 0.01), 0xB9C2C8, 0, 1.15, 0.232, g, false);
    for (const [y, h] of [[0.9, 0.36], [1.34, 0.26]]) { put(cyl(0.014, 0.014, h, 6), 0x8C8478, 0.36, y, 0.265, g, false); for (const e of [-1, 1]) put(box(0.02, 0.02, 0.03), 0x8C8478, 0.36, y + e * (h / 2 - 0.02), 0.25, g, false); }
    put(cbox(0.16, 0.12, 0.012, 0.004), RED, -0.2, 1.45, 0.246, g, false);     // 냉장고 자석 쪽지
    put(box(0.14, 0.17, 0.006), 0xFFF8EA, -0.16, 0.86, 0.245, g, false).rotation.z = 0.06; // 아이 그림
    put(new THREE.ConeGeometry(0.04, 0.09, 3), 0x2F7D56, -0.16, 0.87, 0.249, g, false).scale.z = 0.1; put(box(0.1, 0.012, 0.002), 0x4F6FB8, -0.16, 0.8, 0.249, g, false);
    [[-0.3, 1.02, GOLD], [-0.12, 0.96, GREEN], [-0.05, 1.5, 0x4F6FB8], [-0.34, 1.6, GOLD], [0.08, 1.3, RED]].forEach(([x, y, c]) => put(cyl(0.022, 0.022, 0.012, 8), c, x, y, 0.247, g, false).rotation.x = Math.PI / 2);
    put(box(0.1, 0.08, 0.006), 0xBFE3D3, 0.08, 1.24, 0.245, g, false);
    // 위에 올려 둔 것: 과자 상자, 바구니
    put(box(0.18, 0.24, 0.1), 0xE7A13A, -0.25, 1.9, -0.05, g).rotation.y = 0.2; put(box(0.12, 0.1, 0.004), WHITE, -0.24, 1.92, 0.003, g, false).rotation.y = 0.2;
    put(cyl(0.13, 0.1, 0.12, 10), WD(0xB98F66), 0.2, 1.84, -0.02, g); put(ball(0.05, 5, 3), RED, 0.17, 1.91, 0, g, false); put(ball(0.05, 5, 3), 0x9BC25A, 0.24, 1.91, -0.04, g, false);
    pool(g, 0, 0.02, 1.25, 0.8);
  },
  bed(g) { // 3 × 4, 머리맡이 뒤쪽(-z)
    put(cbox(1.42, 0.3, 1.94, 0.05), WD(WOOD_D), 0, 0.17, 0, g);
    put(cbox(1.36, 0.2, 1.86, 0.08), 0xFFFAF2, 0, 0.4, 0.02, g);
    put(cbox(1.42, 0.9, 0.1, 0.04), WD(WOOD), 0, 0.5, -0.94, g);                   // 머리판
    put(cbox(1.1, 0.5, 0.02, 0.01), WD(0xD8B085), 0, 0.64, -0.885, g, false);          // 머리판 안쪽 널
    put(cbox(1.5, 0.06, 0.14, 0.02), WD(WOOD_D), 0, 0.97, -0.94, g, false);
    for (const s of [-1, 1]) { put(cyl(0.05, 0.05, 1.0, 8), WD(WOOD_D), 0.7 * s, 0.5, -0.94, g); put(ball(0.065, 6, 4), WD(WOOD_D), 0.7 * s, 1.04, -0.94, g, false); }
    put(cbox(1.42, 0.3, 0.07, 0.03), WD(WOOD), 0, 0.36, 0.955, g);                     // 발판
    put(cbox(1.38, 0.14, 1.2, 0.06), T(RED, 'plaid'), 0, 0.5, 0.34, g);                    // 이불
    for (const s of [-1, 1]) put(box(0.02, 0.2, 1.18), T(RED, 'plaid'), 0.7 * s, 0.4, 0.34, g, false); // 옆으로 늘어진 이불
    [[-0.3, 0.2, 0.3], [0.25, 0.5, 0.26], [-0.1, 0.72, 0.3], [0.38, 0.05, 0.22]].forEach(([x, z, r]) => put(ball(r, 8, 4), T(RED, 'plaid'), x, 0.545, z, g, false).scale.set(1, 0.16, 0.55)); // 이불 주름
    put(cbox(1.38, 0.15, 0.22, 0.06), 0xFFFAF2, 0, 0.5, -0.3, g, false);       // 이불 접은 단
    for (const s of [-1, 1]) {
      put(cbox(0.5, 0.14, 0.34, 0.07), 0xFFFAF2, 0.35 * s, 0.55, -0.66, g); // 베개
      put(box(0.03, 0.1, 0.3), 0xF3D9D2, 0.35 * s + 0.24 * s, 0.55, -0.66, g, false);  // 베갯잇 끝단
    }
    put(cbox(1.3, 0.07, 0.36, 0.03), T(GREEN, 'knit'), 0, 0.595, 0.7, g, false);       // 발치에 갠 담요
    for (let k = 0; k < 9; k++) put(box(0.02, 0.05, 0.012), CREAM, -0.6 + k * 0.15, 0.56, 0.885, g, false);
    // 곰 인형
    const bear = 0xB98F66;
    put(ball(0.07, 6, 4), bear, 0, 0.66, -0.8, g, false); put(ball(0.055, 6, 4), bear, 0, 0.75, -0.78, g, false);
    for (const s of [-1, 1]) { put(ball(0.022, 5, 3), bear, 0.04 * s, 0.795, -0.78, g, false); put(ball(0.008, 4, 4), BLACK, 0.02 * s, 0.76, -0.729, g, false); put(ball(0.028, 5, 3), bear, 0.065 * s, 0.67, -0.76, g, false); }
    put(ball(0.022, 5, 3), CREAM, 0, 0.74, -0.735, g, false); put(box(0.07, 0.02, 0.02), RED, 0, 0.705, -0.745, g, false);
    feet(g, 0.62, 0.86, 0.03);
    pool(g, 0, 0, 1.95, 2.5);
  },
  closet(g) { // 3 × 1, 옷장
    put(cbox(1.42, 1.8, 0.46, 0.04), WD(WOOD), 0, 0.92, 0, g);
    put(box(1.38, 0.08, 0.42), WD(WOOD_D), 0, 0.04, 0, g, false);
    for (const s of [-1, 1]) {
      put(new THREE.BoxGeometry(0.66, 1.6, 0.02), WD(0xD8B085), 0.35 * s, 0.94, 0.235, g, false).userData.sw = 1;
      for (const [y, h] of [[1.36, 0.62], [0.56, 0.74]]) { put(box(0.5, h, 0.012), 0xB98A5E, 0.35 * s, y, 0.243, g, false); put(box(0.44, h - 0.06, 0.012), WD(0xDDB98E), 0.35 * s, y, 0.247, g, false).userData.sw = 1; } // 문짝의 파인 널
      put(cyl(0.014, 0.014, 0.22, 6), GOLD, 0.06 * s, 0.95, 0.262, g, false);
      for (const e of [-1, 1]) put(box(0.02, 0.02, 0.03), GOLD, 0.06 * s, 0.95 + e * 0.09, 0.25, g, false);
    }
    put(box(0.008, 1.6, 0.006), WOOD_D, 0, 0.94, 0.246, g, false);                     // 두 문 사이
    put(cbox(1.48, 0.06, 0.5, 0.02), WD(WOOD_D), 0, 1.85, 0, g);
    put(box(1.44, 0.04, 0.48), WD(WOOD), 0, 1.8, 0, g, false);
    // 위에 올려 둔 여행 가방과 모자 상자
    put(cbox(0.5, 0.18, 0.32, 0.03), WD(0x9A5F3C), -0.35, 1.97, 0, g); for (const x of [-0.15, 0.15]) put(box(0.03, 0.184, 0.326), DARK, -0.35 + x, 1.97, 0, g, false); put(box(0.12, 0.02, 0.02), DARK, -0.35, 1.97, 0.17, g, false);
    put(cyl(0.16, 0.16, 0.14, 14), 0xF7B6C2, 0.35, 1.95, 0, g); put(cyl(0.168, 0.168, 0.04, 14), CREAM, 0.35, 2.02, 0, g, false); put(box(0.34, 0.03, 0.03), RED, 0.35, 2.045, 0, g, false);
    pool(g, 0, 0.02, 1.8, 0.8);
  },
  stand(g) { // 1 × 1, 협탁과 작은 등
    put(cbox(0.42, 0.36, 0.4, 0.03), WD(WOOD), 0, 0.28, 0, g);
    put(box(0.44, 0.03, 0.42), WD(WOOD_D), 0, 0.455, 0, g, false);
    for (const a of [-1, 1]) for (const b of [-1, 1]) put(cyl(0.022, 0.016, 0.1, 6), WD(WOOD_D), 0.17 * a, 0.05, 0.16 * b, g, false);
    put(new THREE.BoxGeometry(0.34, 0.14, 0.02), WD(WOOD_D), 0, 0.34, 0.205, g, false); put(ball(0.018, 6, 4), GOLD, 0, 0.34, 0.222, g, false);
    put(box(0.34, 0.1, 0.012), DARK, 0, 0.18, 0.2, g, false);                          // 아래 빈 칸
    put(cyl(0.05, 0.07, 0.03, 10), DARK, -0.06, 0.485, -0.04, g); put(cyl(0.012, 0.012, 0.16, 6), 0xC9A24B, -0.06, 0.57, -0.04, g);
    put(cyl(0.07, 0.11, 0.14, 12, 1, true), lit(0xFFE2A8), -0.06, 0.71, -0.04, g, false);
    put(cyl(0.068, 0.068, 0.004, 12), lit(0xFFF4D8), -0.06, 0.78, -0.04, g, false);
    put(new THREE.TorusGeometry(0.11, 0.008, 5, 14), GOLD, -0.06, 0.642, -0.04, g, false).rotation.x = Math.PI / 2;
    put(box(0.14, 0.022, 0.1), 0x4F6FB8, 0.1, 0.481, 0.1, g, false).rotation.y = -0.3; // 읽던 책
    put(box(0.13, 0.008, 0.09), 0xFFF8EA, 0.1, 0.484, 0.102, g, false).rotation.y = -0.3;
    put(cyl(0.035, 0.035, 0.03, 10), RED, 0.12, 0.5, -0.1, g, false).rotation.x = Math.PI / 2; put(cyl(0.028, 0.028, 0.032, 10), WHITE, 0.12, 0.5, -0.099, g, false).rotation.x = Math.PI / 2; // 자명종
    pool(g, 0, 0, 0.72, 0.72);
    halo(g, -0.06, 0.71, -0.04, 0.2);
  },
  guest(g) { // 1 × 1, 방명록: 비스듬한 받침대 위에 펼친 책과 펜 (앞쪽 +z 에서 읽는다)
    put(cyl(0.15, 0.18, 0.04, 14), WD(WOOD_D), 0, 0.02, 0, g);
    put(cyl(0.09, 0.13, 0.03, 12), WD(WOOD), 0, 0.055, 0, g, false);
    put(cyl(0.035, 0.045, 0.78, 8), WD(WOOD_D), 0, 0.43, -0.02, g);
    put(ball(0.06, 6, 4), WD(WOOD_D), 0, 0.3, -0.02, g, false).scale.y = 0.7;
    const top = new THREE.Group(); // 앞으로 기울어진 책 받침
    top.position.set(0, 0.84, 0); top.rotation.x = 0.42; g.add(top);
    put(cbox(0.46, 0.04, 0.34, 0.015), WD(WOOD), 0, 0, 0, top);
    put(new THREE.BoxGeometry(0.46, 0.035, 0.025), WD(WOOD_D), 0, 0.03, 0.17, top, false); // 책이 미끄러지지 않게 막는 턱
    for (const s of [-1, 1]) { // 펼친 책: 표지와 가운데로 살짝 휘어 드는 종이
      put(new THREE.BoxGeometry(0.2, 0.012, 0.27), RED, 0.1 * s, 0.026, 0, top, false);
      const pg = put(new THREE.BoxGeometry(0.185, 0.014, 0.25), 0xFFF8EA, 0.095 * s, 0.038, 0, top, false);
      pg.rotation.z = -0.07 * s;
      for (let k = 0; k < 4; k++) put(new THREE.BoxGeometry(k === 3 ? 0.07 : 0.12, 0.002, 0.006), 0x9A8B7A, 0.1 * s - (k === 3 ? 0.025 : 0), 0.047, -0.08 + k * 0.045, top, false); // 적힌 글줄
    }
    put(new THREE.BoxGeometry(0.012, 0.02, 0.26), GOLD, 0, 0.04, 0, top, false); // 책등의 금박 끈
    put(box(0.02, 0.004, 0.1), RED, -0.03, 0.03, 0.2, top, false);                     // 갈피끈
    put(cyl(0.03, 0.035, 0.04, 8), 0x33423A, -0.19, 0.04, -0.13, top, false);          // 잉크병
    const pen = new THREE.Group(); // 펜: 오른쪽 종이 위에 비스듬히 놓였다. 촉이 앞(+z)
    pen.position.set(0.12, 0.056, 0.01); pen.rotation.y = 0.45; top.add(pen);
    put(cyl(0.008, 0.008, 0.17, 6), DARK, 0, 0, 0, pen, false).rotation.x = Math.PI / 2;
    put(new THREE.ConeGeometry(0.008, 0.025, 6), GOLD, 0, 0, 0.097, pen, false).rotation.x = Math.PI / 2;
    pool(g, 0, 0, 0.7, 0.7);
  },
  rug(g) { // 3 × 2, 밟고 지나갈 수 있다
    put(cbox(1.45, 0.016, 0.95, 0.007), 0x4F6FB8, 0, 0.028, 0, g, false);
    const top = put(new THREE.PlaneGeometry(1.43, 0.93), new THREE.MeshLambertMaterial({ map: rugTexture() }), 0, 0.0375, 0, g, false);
    top.rotation.x = -Math.PI / 2;
    for (const s of [-1, 1]) for (let k = 0; k < 16; k++) put(box(0.05, 0.008, 0.022), CREAM, s * 0.745, 0.026, -0.43 + k * 0.0573, g, false); // 양 끝의 술
  },
};

export function buildItem(k) {
  const g = new THREE.Group();
  B[k](g);
  bake(g); // 같은 종류의 재질끼리 한 덩어리로 합친다 (kit.js)
  return g;
}
