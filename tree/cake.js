// 케이크 한 판의 모양. 방 상태(state.js 의 cakes)에 맞춰 다시 차린다. 작업대·탁자·손 어디에 둘지는 app.js 가 정한다.
// 크림 색, 올린 장식(딸기·체리·초콜릿·별·트리·초), 켜진 촛불, 먹고 남은 조각.
import { THREE, M, L, put, cyl, ball, bake } from './kit.js';
import { CREAMS, CAKE } from './catalog.js';

const lit = (hex) => new THREE.MeshBasicMaterial({ color: hex });
const FLAME = lit(0xFFD166), FLAME_IN = lit(0xFFF6D0);
const STAR = (() => { // 작은 별 (모든 케이크가 같이 쓴다)
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + Math.PI / 2, r = k % 2 ? 0.022 : 0.05; if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  return new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: false });
})();
const CANDLE = [0xD23A30, 0x3E9A7E, 0xF2B544, 0x4F6FB8];

// 두 점을 잇는 가는 막대 (꼭지 같은 것)
const rod = (g, a, b, r, col) => {
  const A = new THREE.Vector3(...a), V = new THREE.Vector3(...b).sub(A), m = put(cyl(r, r, V.length(), 5), col, A.x + V.x / 2, A.y + V.y / 2, A.z + V.z / 2, g, false);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V.normalize());
  return m;
};
const WHIP = 0xFFFAF2;
// 장식 밑에 짠 생크림 한 덩이
const dollop = (g, r = 0.042) => { put(ball(r, 8, 4), WHIP, 0, r * 0.3, 0, g, false).scale.y = 0.5; put(ball(r * 0.6, 7, 4), WHIP, 0, r * 0.62, 0, g, false).scale.y = 0.6; };
const BERRY = [[0, 0], [0.012, 0.003], [0.027, 0.022], [0.038, 0.048], [0.04, 0.064], [0.034, 0.08], [0.02, 0.09], [0, 0.092]].map(([x, y]) => new THREE.Vector2(x, y));
const B = {
  // 딸기: 생크림 위에 비스듬히 앉은 통통한 딸기. 씨와 꼭지 잎, 반짝이는 점
  berry(g) {
    dollop(g);
    const t = new THREE.Group(); t.position.y = 0.022; t.rotation.set(0.22, 0, -0.18); g.add(t);
    put(new THREE.LatheGeometry(BERRY, 10), 0xE23B2E, 0, 0, 0, t, false);
    for (const [y, r, n, o] of [[0.03, 0.03, 5, 0], [0.05, 0.039, 6, 0.5], [0.07, 0.039, 5, 0.2]]) for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + o; put(new THREE.OctahedronGeometry(0.0042), 0xF8E39A, Math.cos(a) * r, y, Math.sin(a) * r, t, false); } // 씨
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, leaf = put(new THREE.ConeGeometry(0.011, 0.034, 4), M(0x3E9A7E, true), Math.cos(a) * 0.014, 0.091, Math.sin(a) * 0.014, t, false); leaf.rotation.set(0, -a, -Math.PI / 2 + 0.25, 'YXZ'); leaf.scale.z = 0.5; } // 꼭지 잎
    put(cyl(0.004, 0.005, 0.016, 5), 0x4F8A4E, 0, 0.1, 0, t, false);
    put(ball(0.006, 5, 3), L(0xFFE9E4), 0.024, 0.066, 0.026, t, false);
  },
  // 체리: 꼭지가 이어진 두 알, 잎 하나
  cherry(g) {
    dollop(g, 0.034);
    for (const s of [-1, 1]) {
      put(ball(0.026, 10, 7), 0xB81E2A, 0.026 * s, 0.04, 0.004 * s, g, false);
      put(ball(0.0055, 5, 3), L(0xFFD9D9), 0.026 * s + 0.009, 0.054, 0.017, g, false);
      rod(g, [0.026 * s, 0.064, 0.004 * s], [0.012 * s, 0.092, 0], 0.003, 0x6B8F3A); rod(g, [0.012 * s, 0.092, 0], [0, 0.112, -0.004], 0.003, 0x6B8F3A);
    }
    const leaf = put(ball(0.018, 6, 3), M(0x3E9A7E, true), 0.014, 0.114, -0.004, g, false); leaf.scale.set(1.3, 0.2, 0.7); leaf.rotation.z = 0.4;
  },
  // 초콜릿: 칸이 나뉜 판초콜릿 한 조각이 크림에 비스듬히 꽂혔다
  choco(g) {
    dollop(g, 0.036);
    const t = new THREE.Group(); t.position.set(0, 0.046, 0); t.rotation.set(0.5, 0.4, 0.15); g.add(t);
    put(new THREE.BoxGeometry(0.078, 0.014, 0.054), 0x5A3824, 0, 0, 0, t, false);
    for (const x of [-0.025, 0, 0.025]) for (const z of [-0.013, 0.013]) put(new THREE.BoxGeometry(0.02, 0.006, 0.021), 0x6E452C, x, 0.009, z, t, false);
    put(new THREE.BoxGeometry(0.012, 0.002, 0.012), L(0x9A6B48), -0.025, 0.0125, -0.013, t, false);
  },
  // 별: 크림에 꽂은 금빛 별 과자
  star(g) {
    dollop(g, 0.03);
    const m = new THREE.Mesh(STAR, M(0xE9B93A)); m.position.set(0, 0.066, -0.007); g.add(m);
    for (const z of [0.009, -0.009]) { const i = new THREE.Mesh(STAR, M(0xF8DC7A)); i.scale.set(0.55, 0.55, 0.2); i.position.set(0, 0.066, z - 0.0015); g.add(i); }
    put(ball(0.005, 5, 3), L(0xFFFBE0), 0.012, 0.084, 0.012, g, false);
  },
  // 작은 트리: 세 층 잎에 눈과 방울, 꼭대기 별
  tree(g) {
    put(cyl(0.009, 0.011, 0.024, 6), 0x7A5137, 0, 0.012, 0, g, false);
    [[0.046, 0.05, 0.045, 0x2F7D56], [0.037, 0.046, 0.074, 0x35895E], [0.027, 0.044, 0.102, 0x3E9A6A]].forEach(([r, h, y, col], k) => {
      put(new THREE.ConeGeometry(r, h, 8), M(col, true), 0, y, 0, g, false).rotation.y = k * 0.5;
      for (let i = 0; i < 3; i++) { const a = i * 2.094 + k * 1.1; put(ball(0.0065, 5, 3), i % 2 ? 0xD23A30 : WHIP, Math.cos(a) * r * 0.78, y - h * 0.32, Math.sin(a) * r * 0.78, g, false); }
    });
    put(new THREE.OctahedronGeometry(0.012), L(0xFFD166), 0, 0.134, 0, g, false);
  },
};
// 장식은 종류마다 한 번만 빚어 두고(같은 색끼리 한 덩어리) 케이크마다 그 모양을 나눠 쓴다
const made = new Map();
const topOf = (k) => {
  let g = made.get(k);
  if (!g) { g = new THREE.Group(); B[k](g); bake(g, 0, false); g.traverse((m) => { if (m.geometry) m.geometry.userData.shared = true; }); made.set(k, g); }
  return g.clone();
};
const keep = (geo) => geo === STAR || geo.userData.shared; // 여럿이 나눠 쓰는 모양은 치우지 않는다
// 가장자리에 짠 크림 한 송이와 옆으로 흘러내린 크림 (모든 케이크가 모양을 나눠 쓴다)
const SWIRL = new THREE.LatheGeometry([[0.031, 0], [0.034, 0.008], [0.027, 0.019], [0.02, 0.023], [0.022, 0.03], [0.014, 0.039], [0.009, 0.043], [0, 0.058]].map(([x, y]) => new THREE.Vector2(x, y)), 9);
const DRIP = new THREE.SphereGeometry(0.02, 7, 5);
SWIRL.userData.shared = DRIP.userData.shared = true;
const JAM = 0xD4574E;

// 장식 하나의 자리가 같으면 늘 같은 초가 되도록, 초는 자리 순서로 번호를 매긴다(불은 번호가 낮은 초부터 켜진다)
const byPlace = (a, b) => a[1] - b[1] || a[2] - b[2];

const TAU = Math.PI * 2, SLICE = TAU / CAKE.slices;
const SPONGE = 0xE8C48A;
// 케이크 몸통 (먹은 만큼 잘라낸다). [이름, 반지름, 높이, y]
const BODY = [['sponge', CAKE.r, 0.16, 1.035], ['jam', CAKE.r + 0.002, 0.016, 1.04], ['topCream', CAKE.r + 0.012, 0.05, CAKE.y - 0.025], ['band', CAKE.r + 0.006, 0.03, 0.97]];
const thetaOf = (x, z) => (Math.atan2(x, z) + TAU) % TAU; // CylinderGeometry 의 θ 와 같다 (x = r·sin θ, z = r·cos θ)

// 케이크 하나의 모양을 새로 만든다. 어디에도 붙이지 않는다(작업대·탁자·손 어디에 둘지는 app.js 가 정한다).
// 좌표는 작업대 기준 그대로다: 접시가 y ≈ 0.945, 케이크 윗면이 CAKE.y.
export function makeCakeView() {
  const v = { root: new THREE.Group(), tops: new THREE.Group(), cream: new THREE.MeshLambertMaterial({ color: CREAMS[0].hex }), left: CAKE.slices, dots: [] };
  put(cyl(0.38, 0.38, 0.02, 24), 0xFFFAF2, 0, 0.945, 0, v.root);                  // 접시
  put(cyl(0.06, 0.12, 0.05, 12), 0xFFFAF2, 0, 0.92, 0, v.root, false);
  put(new THREE.TorusGeometry(0.372, 0.006, 4, 24), 0xE9B93A, 0, 0.956, 0, v.root, false).rotation.x = Math.PI / 2; // 접시의 금테
  v.sponge = put(cyl(CAKE.r, CAKE.r, 0.16, 28), SPONGE, 0, 1.035, 0, v.root);      // 빵
  v.jam = put(cyl(CAKE.r + 0.002, CAKE.r + 0.002, 0.016, 28), JAM, 0, 1.04, 0, v.root, false);        // 빵 사이의 잼
  v.topCream = put(cyl(CAKE.r + 0.012, CAKE.r + 0.012, 0.05, 28), v.cream, 0, CAKE.y - 0.025, 0, v.root); // 위 크림
  v.band = put(cyl(CAKE.r + 0.006, CAKE.r + 0.006, 0.03, 28), v.cream, 0, 0.97, 0, v.root, false);      // 아래 크림 띠
  for (let k = 0; k < 12; k++) { // 가장자리 크림 방울
    const a = (k / 12) * TAU, x = Math.cos(a) * (CAKE.r - 0.02), z = Math.sin(a) * (CAKE.r - 0.02);
    const m = put(SWIRL, v.cream, x, CAKE.y - 0.002, z, v.root, false); m.rotation.y = k * 1.3;
    m.userData.theta = thetaOf(x, z); v.dots.push(m);
  }
  for (let k = 0; k < 9; k++) { // 옆으로 흘러내린 크림
    const a = (k / 9) * TAU + 0.3 + (k % 3) * 0.11, len = 1.2 + ((k * 7) % 5) * 0.35, R = CAKE.r + 0.008, x = Math.cos(a) * R, z = Math.sin(a) * R;
    const m = put(DRIP, v.cream, x, CAKE.y - 0.046 - 0.011 * len, z, v.root, false); m.scale.set(0.9, len, 0.5); m.rotation.y = -a + Math.PI / 2;
    m.userData.theta = thetaOf(x, z); v.dots.push(m);
  }
  // 자른 면 두 장 (θ = 0 쪽과 남은 케이크가 시작하는 쪽). 빵 색 면 위에 얇은 크림 줄
  v.cuts = [0, 1].map(() => {
    const p = new THREE.Group();
    put(new THREE.BoxGeometry(CAKE.r, 0.16, 0.004), SPONGE, CAKE.r / 2, 1.035, 0, p, false);
    put(new THREE.BoxGeometry(CAKE.r, 0.016, 0.006), JAM, CAKE.r / 2, 1.04, 0, p, false);
    put(new THREE.BoxGeometry(CAKE.r + 0.012, 0.05, 0.006), v.cream, (CAKE.r + 0.012) / 2, CAKE.y - 0.025, 0, p, false);
    p.visible = false; v.root.add(p);
    return p;
  });
  // 누를 수 있는 윗면 (보이지 않는다. 어디를 눌렀는지 재는 데 쓴다)
  v.top = new THREE.Mesh(new THREE.CircleGeometry(CAKE.r, 24), new THREE.MeshBasicMaterial({ visible: false }));
  v.top.rotation.x = -Math.PI / 2; v.top.position.y = CAKE.y;
  v.root.add(v.top, v.tops);
  v.tops.position.y = CAKE.y;
  return v;
}

// 남은 조각 수에 맞게 몸통을 다시 깎는다
function slice(v, left) {
  v.left = left;
  const cut = (CAKE.slices - left) * SLICE, part = left < CAKE.slices;
  for (const [k, r, h] of BODY) {
    const m = v[k];
    m.geometry.dispose();
    m.geometry = part ? new THREE.CylinderGeometry(r, r, h, Math.max(4, Math.round(28 * (TAU - cut) / TAU)), 1, false, cut, TAU - cut) : cyl(r, r, h, 28);
    m.visible = left > 0;
  }
  for (const d of v.dots) d.visible = d.userData.theta >= cut;
  // 자른 면: 묶음의 +x 가 (sin θ, 0, cos θ) 를 향하게 돌린다
  v.cuts.forEach((p, i) => { p.visible = part && left > 0; p.rotation.y = (i ? cut : 0) - Math.PI / 2; });
}

// 케이크 모양 v 를 cake = { cream, tops, lit, left } 에 맞춘다
export function dressCake(v, cake) {
  v.cream.color.setHex((CREAMS[cake.cream] || CREAMS[0]).hex);
  const left = Math.max(0, Math.min(CAKE.slices, cake.left ?? CAKE.slices));
  if (left !== v.left) slice(v, left);
  for (const o of [...v.tops.children]) { v.tops.remove(o); o.traverse((m) => { if (m.geometry && !keep(m.geometry)) m.geometry.dispose(); }); }
  const order = cake.tops.filter((t) => t[0] === 'candle').sort(byPlace);
  cake.tops.forEach((t) => {
    const o = t[0] === 'candle' ? new THREE.Group() : topOf(t[0]);
    o.position.set(t[1], 0, t[2]);
    if (t[0] === 'candle') {
      const n = order.indexOf(t);
      put(cyl(0.012, 0.012, 0.13, 8), CANDLE[n % CANDLE.length], 0, 0.065, 0, o, false);
      for (const y of [0.035, 0.075, 0.115]) put(cyl(0.0128, 0.0128, 0.009, 8), WHIP, 0, y, 0, o, false).rotation.z = 0.25; // 흰 줄무늬
      put(cyl(0.018, 0.02, 0.008, 8), 0xE9B93A, 0, 0.004, 0, o, false);                                      // 받침
      put(cyl(0.0018, 0.0018, 0.014, 4), 0x3A2A22, 0, 0.136, 0, o, false);                                    // 심지
      if (n < cake.lit) { // 불꽃
        put(new THREE.ConeGeometry(0.018, 0.05, 8), FLAME, 0, 0.16, 0, o, false).userData.flame = true;
        put(ball(0.008, 6, 5), FLAME_IN, 0, 0.145, 0, o, false);
      }
    }
    v.tops.add(o);
  });
}
// 촛불이 일렁이게 한다
export function flicker(v, t) {
  if (!v) return;
  v.tops.traverse((m) => { if (m.userData.flame) { m.scale.y = 1 + 0.18 * Math.sin(t * 13 + m.parent.position.x * 40); m.rotation.z = 0.12 * Math.sin(t * 7 + m.parent.position.z * 30); } });
}
// 케이크 윗면에서 누른 자리 (케이크 가운데가 0, 0). ray = 화면에서 쏜 선. 먹은 쪽을 눌렀으면 null
export function pickTop(v, ray) {
  if (!v) return null;
  const hit = ray.intersectObject(v.top, false)[0];
  if (!hit) return null;
  const p = v.root.worldToLocal(hit.point.clone());
  if (thetaOf(p.x, p.z) < (CAKE.slices - v.left) * SLICE) return null;
  return { x: Math.round(p.x * 1000) / 1000, z: Math.round(p.z * 1000) / 1000 };
}
// 케이크 모양을 치운다 (같이 쓰는 별 모양과 색 재질은 남긴다)
export function disposeCakeView(v) {
  if (!v) return;
  if (v.root.parent) v.root.parent.remove(v.root);
  v.root.traverse((m) => { if (m.geometry && !keep(m.geometry)) m.geometry.dispose(); });
  v.cream.dispose(); v.top.material.dispose();
}
