// 가구 모양. 도형만으로 만든다. 바닥 자리 한가운데가 (0, 0), 앞쪽이 +z, 바닥이 y = 0.
// 차지하는 칸 수는 catalog.js 의 FURNITURE 와 맞춘다(한 칸 0.5).
import { THREE, M, put, rbox, cyl, ball } from './kit.js';
import { DART, TV } from './catalog.js';

// TV 화면 재질: 모든 TV 가 같이 쓴다. 무엇을 비출지는 play.js 가 정한다.
export const TV_MAT = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

const lit = (hex) => new THREE.MeshBasicMaterial({ color: hex }); // 스스로 빛나 보이는 색
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
function feet(g, x, z, y = 0.06) {
  for (const a of [-1, 1]) for (const b of [-1, 1]) put(cyl(0.04, 0.03, y * 2, 8), DARK, x * a, y, z * b, g);
}
function gift(g, w, h, box, band) {
  put(rbox(w, h, w, 0.03), box, 0, h / 2, 0, g);
  put(new THREE.BoxGeometry(w + 0.012, h + 0.008, 0.07), band, 0, h / 2, 0, g, false);
  put(new THREE.BoxGeometry(0.07, h + 0.008, w + 0.012), band, 0, h / 2, 0, g, false);
  for (const s of [-1, 1]) put(ball(0.06, 10, 8), band, 0.055 * s, h + 0.035, 0, g).scale.set(1.1, 0.7, 0.7);
  put(ball(0.03, 8, 6), band, 0, h + 0.03, 0, g);
}

const B = {
  sofa(g) { // 4 × 2
    const c = 0x4E8F73, c2 = 0x458268, c3 = 0x5FA586;
    put(rbox(1.9, 0.26, 0.86, 0.06), c, 0, 0.25, 0.02, g);
    put(rbox(1.9, 0.62, 0.24, 0.08), c, 0, 0.52, -0.33, g);
    for (const s of [-1, 1]) {
      put(rbox(0.24, 0.5, 0.86, 0.08), c2, 0.83 * s, 0.42, 0.02, g);
      put(rbox(0.68, 0.12, 0.56, 0.05), c3, 0.36 * s, 0.43, 0.08, g);
    }
    put(rbox(0.3, 0.3, 0.12, 0.05), RED, -0.5, 0.62, -0.15, g).rotation.x = -0.25;
    feet(g, 0.82, 0.34);
  },
  chair(g) { // 2 × 2
    const c = 0xD9A441, c2 = 0xC9933A, c3 = 0xE8BC62;
    put(rbox(0.9, 0.26, 0.84, 0.06), c, 0, 0.25, 0.02, g);
    put(rbox(0.9, 0.62, 0.22, 0.08), c, 0, 0.52, -0.32, g);
    for (const s of [-1, 1]) put(rbox(0.2, 0.48, 0.84, 0.07), c2, 0.36 * s, 0.41, 0.02, g);
    put(rbox(0.5, 0.12, 0.56, 0.05), c3, 0, 0.43, 0.08, g);
    feet(g, 0.36, 0.33);
  },
  fire(g) { // 4 × 2 (몸통은 뒤쪽에 붙어 있다)
    put(rbox(1.9, 0.06, 0.92, 0.02), 0x8C8478, 0, 0.03, 0.02, g);
    put(rbox(1.8, 1.3, 0.55, 0.04), 0xB5523F, 0, 0.71, -0.2, g);
    put(new THREE.BoxGeometry(0.9, 0.72, 0.06), 0x2B2420, 0, 0.44, 0.065, g, false);
    for (const s of [-1, 1]) put(cyl(0.06, 0.06, 0.5, 8), WOOD_D, 0, 0.12, 0.14 + 0.07 * s, g).rotation.z = Math.PI / 2;
    put(new THREE.ConeGeometry(0.16, 0.42, 7), lit(0xF28C28), -0.07, 0.36, 0.14, g, false);
    put(new THREE.ConeGeometry(0.12, 0.3, 6), lit(0xFFD166), 0.1, 0.3, 0.17, g, false);
    put(new THREE.ConeGeometry(0.08, 0.2, 6), lit(0xFFF1B8), -0.02, 0.25, 0.2, g, false);
    put(rbox(2.0, 0.1, 0.72, 0.03), CREAM, 0, 1.41, -0.14, g);
    // 벽난로 위 풀장식과 양말
    put(rbox(1.7, 0.09, 0.14, 0.04), M(0x2F7D56, true), 0, 1.5, 0.1, g);
    for (const x of [-0.6, -0.2, 0.2, 0.6]) put(ball(0.04, 8, 6), RED, x, 1.52, 0.17, g, false);
    for (const s of [-1, 1]) {
      put(rbox(0.13, 0.24, 0.05, 0.02), s < 0 ? RED : GREEN, 0.5 * s, 1.2, 0.1, g);
      put(rbox(0.16, 0.07, 0.06, 0.02), CREAM, 0.5 * s, 1.32, 0.1, g, false);
      put(rbox(0.2, 0.09, 0.05, 0.02), s < 0 ? RED : GREEN, 0.5 * s + 0.04, 1.08, 0.1, g, false);
    }
  },
  table(g) { // 3 × 2
    put(rbox(1.4, 0.07, 0.9, 0.03), WOOD, 0, 0.43, 0, g);
    for (const a of [-1, 1]) for (const b of [-1, 1]) put(cyl(0.04, 0.035, 0.4, 8), WOOD_D, 0.6 * a, 0.2, 0.36 * b, g);
    put(cyl(0.17, 0.13, 0.025, 16), 0xFFFAF2, -0.32, 0.478, 0.02, g);
    for (const [x, z] of [[-0.37, 0.0], [-0.27, 0.07], [-0.3, -0.05]]) put(cyl(0.045, 0.045, 0.02, 10), 0xC98A4B, x, 0.5, z, g, false);
    put(cyl(0.06, 0.05, 0.11, 12), RED, 0.28, 0.52, 0.12, g);
    put(cyl(0.05, 0.05, 0.01, 12), 0x6B4630, 0.28, 0.576, 0.12, g, false);
    put(cyl(0.035, 0.035, 0.14, 10), CREAM, 0.45, 0.535, -0.2, g);
    put(new THREE.ConeGeometry(0.02, 0.06, 6), lit(0xFFD166), 0.45, 0.635, -0.2, g, false);
  },
  shelf(g) { // 3 × 1
    put(new THREE.BoxGeometry(1.45, 1.5, 0.04), WOOD_D, 0, 0.75, -0.19, g);
    for (const s of [-1, 1]) put(rbox(0.05, 1.5, 0.42, 0.02), WOOD_D, 0.7 * s, 0.75, 0, g);
    for (const y of [0.04, 0.5, 0.96, 1.48]) put(new THREE.BoxGeometry(1.4, 0.04, 0.4), WOOD, 0, y, 0, g);
    const cols = [RED, GREEN, 0x4F6FB8, GOLD, CREAM, 0x8A6BBE];
    let n = 3;
    for (const y of [0.06, 0.52, 0.98]) {
      let x = -0.64;
      while (x < 0.5) {
        n = (n * 13 + 7) % 97;
        const w = 0.06 + (n % 4) * 0.015, h = 0.26 + (n % 5) * 0.03;
        put(new THREE.BoxGeometry(w, h, 0.26), cols[n % cols.length], x + w / 2, y + h / 2, 0.02, g, false);
        x += w + 0.008;
        if (n % 6 === 0) x += 0.14; // 빈칸
      }
    }
    put(ball(0.09, 10, 8), 0xFFFAF2, 0.52, 1.07, 0.02, g, false); // 책 사이 장식
  },
  giftR(g) { gift(g, 0.38, 0.32, RED, GOLD); },
  giftG(g) { gift(g, 0.34, 0.44, GREEN, CREAM); },
  plant(g) {
    put(cyl(0.15, 0.11, 0.2, 12), 0xB5523F, 0, 0.1, 0, g);
    put(ball(0.2, 8, 6), M(0x2F7D56, true), 0, 0.36, 0, g).scale.set(1, 0.7, 1);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      put(ball(0.085, 8, 6), RED, Math.cos(a) * 0.1, 0.47, Math.sin(a) * 0.1, g).scale.set(1.2, 0.45, 0.8);
    }
    put(ball(0.035, 8, 6), GOLD, 0, 0.5, 0, g, false);
  },
  lamp(g) {
    put(cyl(0.14, 0.16, 0.04, 14), DARK, 0, 0.02, 0, g);
    put(cyl(0.018, 0.018, 1.25, 8), 0xC9A24B, 0, 0.65, 0, g);
    put(cyl(0.12, 0.22, 0.28, 14), lit(0xFFE2A8), 0, 1.36, 0, g, false);
  },
  snowman(g) {
    const w = 0xFFFAF2;
    put(ball(0.2, 14, 10), w, 0, 0.19, 0, g);
    put(ball(0.15, 14, 10), w, 0, 0.48, 0, g);
    put(ball(0.115, 14, 10), w, 0, 0.7, 0, g);
    put(new THREE.ConeGeometry(0.025, 0.1, 8), 0xF28C28, 0, 0.7, 0.15, g, false).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) put(ball(0.015, 6, 6), 0x2B2420, 0.04 * s, 0.735, 0.1, g, false);
    for (const y of [0.44, 0.52]) put(ball(0.018, 6, 6), 0x2B2420, 0, y, 0.148, g, false);
    put(new THREE.TorusGeometry(0.11, 0.035, 8, 16), RED, 0, 0.6, 0, g).rotation.x = Math.PI / 2;
    put(cyl(0.11, 0.11, 0.02, 14), 0x2B2420, 0, 0.8, 0, g);
    put(cyl(0.075, 0.075, 0.11, 14), 0x2B2420, 0, 0.865, 0, g);
  },
  dart(g) { // 다트판: 세워 둔 대에 걸려 있다. 칸과 숫자는 catalog.js 의 DART 대로 그린다
    put(cyl(0.2, 0.22, 0.04, 14), DARK, 0, 0.02, -0.06, g);
    put(cyl(0.025, 0.025, 1.56, 8), WOOD_D, 0, 0.8, -0.06, g);
    const rim = put(cyl(DART.out + 0.012, DART.out + 0.012, 0.06, 36), 0x2B2420, 0, DART.y, -0.012, g);
    rim.rotation.x = Math.PI / 2;
    const face = put(new THREE.CircleGeometry(DART.out, 48), new THREE.MeshLambertMaterial({ map: dartTexture() }), 0, DART.y, DART.z - 0.016, g, false);
    face.receiveShadow = false;
  },
  tv(g) { // 3 × 1, 낮은 장 위의 TV
    put(rbox(1.4, 0.42, 0.42, 0.03), WOOD, 0, 0.27, 0, g);
    for (const s of [-1, 1]) { put(new THREE.BoxGeometry(0.6, 0.3, 0.02), WOOD_D, 0.33 * s, 0.27, 0.21, g, false); put(ball(0.02, 8, 6), GOLD, 0.08 * s, 0.27, 0.225, g, false); }
    feet(g, 0.62, 0.15, 0.03);
    put(cyl(0.06, 0.1, 0.05, 12), 0x2B2420, 0, 0.505, -0.02, g);
    put(rbox(TV.w + 0.1, TV.h + 0.1, 0.06, 0.02), 0x2B2420, 0, TV.y, -0.02, g);
    put(new THREE.PlaneGeometry(TV.w, TV.h), TV_MAT, 0, TV.y, TV.z, g, false).receiveShadow = false;
  },
  music(g) { // 작은 탁자 위의 오르골 (나팔이 달린 상자)
    put(cyl(0.16, 0.18, 0.03, 14), WOOD_D, 0, 0.015, 0, g);
    put(cyl(0.035, 0.05, 0.5, 8), WOOD_D, 0, 0.27, 0, g);
    put(cyl(0.21, 0.21, 0.04, 18), WOOD, 0, 0.53, 0, g);
    put(rbox(0.26, 0.14, 0.22, 0.02), RED, 0, 0.62, 0, g);
    put(new THREE.BoxGeometry(0.265, 0.02, 0.225), GOLD, 0, 0.62, 0, g, false);
    const horn = put(new THREE.ConeGeometry(0.17, 0.3, 16, 1, true), new THREE.MeshLambertMaterial({ color: GOLD, side: THREE.DoubleSide }), 0.05, 0.86, 0.03, g);
    horn.rotation.set(0.25, 0, Math.PI - 0.4);
    put(cyl(0.012, 0.012, 0.1, 6), GOLD, 0.16, 0.62, 0, g, false).rotation.z = Math.PI / 2;
    put(ball(0.022, 8, 6), DARK, 0.21, 0.62, 0, g, false);
  },
  cake(g) { // 3 × 2, 케이크 작업대. 케이크 자체는 cake.js 가 올린다
    put(rbox(1.4, 0.8, 0.9, 0.04), 0xE9DCC3, 0, 0.42, 0, g);
    put(rbox(1.48, 0.07, 0.98, 0.03), WOOD, 0, 0.86, 0, g);
    for (const s of [-1, 1]) { put(new THREE.BoxGeometry(0.6, 0.6, 0.02), 0xF6EEDD, 0.34 * s, 0.42, 0.455, g, false); put(ball(0.02, 8, 6), GOLD, 0.1 * s, 0.5, 0.47, g, false); }
    put(rbox(0.3, 0.02, 0.2, 0.008), RED, -0.52, 0.905, 0.28, g, false);      // 행주
    put(cyl(0.05, 0.04, 0.1, 10), 0xFFFAF2, 0.55, 0.945, -0.28, g);            // 컵
    put(cyl(0.012, 0.012, 0.2, 6), WOOD_D, 0.56, 1.02, -0.27, g, false).rotation.z = 0.3; // 거품기 자루
  },
  counter(g) { // 2 × 1, 조리대 (뒤쪽 벽에 붙인다)
    put(rbox(0.98, 0.82, 0.46, 0.03), 0xE9DCC3, 0, 0.43, 0, g);
    put(rbox(1.0, 0.06, 0.5, 0.02), WOOD, 0, 0.87, 0, g);
    for (const s of [-1, 1]) { put(new THREE.BoxGeometry(0.44, 0.62, 0.02), 0xF6EEDD, 0.24 * s, 0.43, 0.235, g, false); put(ball(0.018, 8, 6), GOLD, 0.06 * s, 0.5, 0.25, g, false); }
    put(cyl(0.09, 0.07, 0.12, 12), 0xFFFAF2, -0.28, 0.96, 0, g);              // 그릇
    put(ball(0.05, 8, 6), RED, 0.2, 0.94, 0.05, g, false); put(ball(0.05, 8, 6), 0xE7A13A, 0.3, 0.94, -0.03, g, false); // 과일
  },
  stove(g) { // 2 × 1, 오븐과 가스레인지
    put(rbox(0.98, 0.84, 0.46, 0.03), 0xD9D0C3, 0, 0.44, 0, g);
    put(new THREE.BoxGeometry(0.7, 0.4, 0.02), 0x2B2420, 0, 0.36, 0.235, g, false);
    put(new THREE.BoxGeometry(0.5, 0.22, 0.01), lit(0xF7B25A), 0, 0.36, 0.247, g, false); // 오븐 안 불빛
    put(cyl(0.012, 0.012, 0.6, 6), 0x8C8478, 0, 0.6, 0.26, g, false).rotation.z = Math.PI / 2;
    for (const x of [-0.24, 0.24]) { put(cyl(0.11, 0.11, 0.02, 14), 0x2B2420, x, 0.875, 0, g, false); put(ball(0.025, 8, 6), RED, x, 0.74, 0.24, g, false); }
    put(cyl(0.13, 0.11, 0.1, 14), 0xC8443A, -0.24, 0.94, 0, g);                // 냄비
  },
  fridge(g) { // 2 × 1, 키 큰 냉장고
    put(rbox(0.92, 1.75, 0.46, 0.04), 0xEEF2F4, 0, 0.9, 0, g);
    put(new THREE.BoxGeometry(0.9, 0.012, 0.01), 0xB9C2C8, 0, 1.15, 0.232, g, false);
    for (const y of [0.75, 1.4]) put(cyl(0.014, 0.014, 0.26, 6), 0x8C8478, 0.36, y, 0.25, g, false);
    put(rbox(0.16, 0.12, 0.012, 0.004), RED, -0.2, 1.45, 0.236, g, false);     // 냉장고 자석 쪽지
  },
  bed(g) { // 3 × 4, 머리맡이 뒤쪽(-z)
    put(rbox(1.42, 0.3, 1.94, 0.05), WOOD_D, 0, 0.17, 0, g);
    put(rbox(1.36, 0.2, 1.86, 0.08), 0xFFFAF2, 0, 0.4, 0.02, g);
    put(rbox(1.42, 0.9, 0.1, 0.04), WOOD, 0, 0.5, -0.94, g);                   // 머리판
    put(rbox(1.38, 0.14, 1.2, 0.06), RED, 0, 0.5, 0.34, g);                    // 이불
    put(rbox(1.38, 0.15, 0.22, 0.06), 0xFFFAF2, 0, 0.5, -0.3, g, false);       // 이불 접은 단
    for (const s of [-1, 1]) put(rbox(0.5, 0.14, 0.34, 0.07), 0xFFFAF2, 0.35 * s, 0.55, -0.66, g); // 베개
    feet(g, 0.62, 0.86, 0.03);
  },
  closet(g) { // 3 × 1, 옷장
    put(rbox(1.42, 1.8, 0.46, 0.04), WOOD, 0, 0.92, 0, g);
    for (const s of [-1, 1]) { put(new THREE.BoxGeometry(0.66, 1.6, 0.02), 0xD8B085, 0.35 * s, 0.94, 0.235, g, false); put(cyl(0.014, 0.014, 0.22, 6), GOLD, 0.06 * s, 0.95, 0.255, g, false); }
    put(rbox(1.48, 0.06, 0.5, 0.02), WOOD_D, 0, 1.85, 0, g);
  },
  stand(g) { // 1 × 1, 협탁과 작은 등
    put(rbox(0.42, 0.44, 0.4, 0.03), WOOD, 0, 0.24, 0, g);
    put(new THREE.BoxGeometry(0.34, 0.14, 0.02), WOOD_D, 0, 0.3, 0.205, g, false); put(ball(0.018, 8, 6), GOLD, 0, 0.3, 0.22, g, false);
    put(cyl(0.05, 0.07, 0.03, 10), DARK, 0, 0.475, 0, g); put(cyl(0.012, 0.012, 0.16, 6), 0xC9A24B, 0, 0.56, 0, g);
    put(cyl(0.07, 0.11, 0.14, 12), lit(0xFFE2A8), 0, 0.7, 0, g, false);
  },
  rug(g) { // 3 × 2, 밟고 지나갈 수 있다
    put(rbox(1.45, 0.016, 0.95, 0.007), 0x4F6FB8, 0, 0.028, 0, g, false);
    put(new THREE.BoxGeometry(1.22, 0.018, 0.72), CREAM, 0, 0.029, 0, g, false);
    put(new THREE.BoxGeometry(1.08, 0.02, 0.58), 0x4F6FB8, 0, 0.03, 0, g, false);
  },
};

export function buildItem(k) {
  const g = new THREE.Group();
  B[k](g);
  return g;
}
