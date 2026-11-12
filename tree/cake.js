// 케이크 한 판의 모양. 방 상태(state.js 의 cakes)에 맞춰 다시 차린다. 작업대·탁자·손 어디에 둘지는 app.js 가 정한다.
// 크림 색, 올린 장식(딸기·체리·초콜릿·별·트리·초), 켜진 촛불, 먹고 남은 조각.
import { THREE, M, put, cyl, ball } from './kit.js';
import { CREAMS, CAKE } from './catalog.js';

const lit = (hex) => new THREE.MeshBasicMaterial({ color: hex });
const FLAME = lit(0xFFD166), FLAME_IN = lit(0xFFF6D0);
const STAR = (() => { // 작은 별 (모든 케이크가 같이 쓴다)
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + Math.PI / 2, r = k % 2 ? 0.022 : 0.05; if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  return new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: false });
})();
const CANDLE = [0xD23A30, 0x3E9A7E, 0xF2B544, 0x4F6FB8];

const B = {
  berry(g) { put(new THREE.ConeGeometry(0.04, 0.07, 10), 0xE23B2E, 0, 0.035, 0, g, false).rotation.x = Math.PI; put(ball(0.016, 6, 5), 0x3E9A7E, 0, 0.072, 0, g, false).scale.set(1.6, 0.5, 1.6); },
  cherry(g) { for (const s of [-1, 1]) put(ball(0.024, 10, 8), 0xB81E2A, 0.02 * s, 0.024, 0, g, false); put(cyl(0.003, 0.003, 0.07, 5), 0x5E3F28, 0, 0.06, 0, g, false); },
  choco(g) { const m = put(new THREE.BoxGeometry(0.07, 0.018, 0.05), 0x5A3824, 0, 0.03, 0, g, false); m.rotation.set(0.5, 0.4, 0); },
  star(g) { const m = new THREE.Mesh(STAR, M(0xE9B93A)); m.position.set(0, 0.055, -0.007); g.add(m); },
  tree(g) { put(new THREE.ConeGeometry(0.04, 0.1, 8), M(0x2F7D56, true), 0, 0.06, 0, g, false); put(cyl(0.008, 0.008, 0.02, 6), 0x7A5137, 0, 0.01, 0, g, false); put(ball(0.012, 6, 5), 0xE9B93A, 0, 0.115, 0, g, false); },
};

// 장식 하나의 자리가 같으면 늘 같은 초가 되도록, 초는 자리 순서로 번호를 매긴다(불은 번호가 낮은 초부터 켜진다)
const byPlace = (a, b) => a[1] - b[1] || a[2] - b[2];

const TAU = Math.PI * 2, SLICE = TAU / CAKE.slices;
const SPONGE = 0xE8C48A;
// 케이크 몸통 (먹은 만큼 잘라낸다). [이름, 반지름, 높이, y]
const BODY = [['sponge', CAKE.r, 0.16, 1.035], ['topCream', CAKE.r + 0.012, 0.05, CAKE.y - 0.025], ['band', CAKE.r + 0.006, 0.03, 0.97]];
const thetaOf = (x, z) => (Math.atan2(x, z) + TAU) % TAU; // CylinderGeometry 의 θ 와 같다 (x = r·sin θ, z = r·cos θ)

// 케이크 하나의 모양을 새로 만든다. 어디에도 붙이지 않는다(작업대·탁자·손 어디에 둘지는 app.js 가 정한다).
// 좌표는 작업대 기준 그대로다: 접시가 y ≈ 0.945, 케이크 윗면이 CAKE.y.
export function makeCakeView() {
  const v = { root: new THREE.Group(), tops: new THREE.Group(), cream: new THREE.MeshLambertMaterial({ color: CREAMS[0].hex }), left: CAKE.slices, dots: [] };
  put(cyl(0.38, 0.38, 0.02, 24), 0xFFFAF2, 0, 0.945, 0, v.root);                  // 접시
  put(cyl(0.06, 0.12, 0.05, 12), 0xFFFAF2, 0, 0.92, 0, v.root, false);
  v.sponge = put(cyl(CAKE.r, CAKE.r, 0.16, 28), SPONGE, 0, 1.035, 0, v.root);      // 빵
  v.topCream = put(cyl(CAKE.r + 0.012, CAKE.r + 0.012, 0.05, 28), v.cream, 0, CAKE.y - 0.025, 0, v.root); // 위 크림
  v.band = put(cyl(CAKE.r + 0.006, CAKE.r + 0.006, 0.03, 28), v.cream, 0, 0.97, 0, v.root, false);      // 아래 크림 띠
  for (let k = 0; k < 12; k++) { // 가장자리 크림 방울
    const a = (k / 12) * TAU, x = Math.cos(a) * (CAKE.r - 0.02), z = Math.sin(a) * (CAKE.r - 0.02);
    const m = put(ball(0.03, 8, 6), v.cream, x, CAKE.y + 0.01, z, v.root, false);
    m.userData.theta = thetaOf(x, z); v.dots.push(m);
  }
  // 자른 면 두 장 (θ = 0 쪽과 남은 케이크가 시작하는 쪽). 빵 색 면 위에 얇은 크림 줄
  v.cuts = [0, 1].map(() => {
    const p = new THREE.Group();
    put(new THREE.BoxGeometry(CAKE.r, 0.16, 0.004), SPONGE, CAKE.r / 2, 1.035, 0, p, false);
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
  for (const o of [...v.tops.children]) { v.tops.remove(o); o.traverse((m) => { if (m.geometry && m.geometry !== STAR) m.geometry.dispose(); }); }
  const order = cake.tops.filter((t) => t[0] === 'candle').sort(byPlace);
  cake.tops.forEach((t) => {
    const o = new THREE.Group();
    o.position.set(t[1], 0, t[2]);
    if (t[0] === 'candle') {
      const n = order.indexOf(t);
      put(cyl(0.012, 0.012, 0.13, 8), CANDLE[n % CANDLE.length], 0, 0.065, 0, o, false);
      if (n < cake.lit) { // 불꽃
        put(new THREE.ConeGeometry(0.018, 0.05, 8), FLAME, 0, 0.16, 0, o, false).userData.flame = true;
        put(ball(0.008, 6, 5), FLAME_IN, 0, 0.145, 0, o, false);
      }
    } else B[t[0]](o);
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
  v.root.traverse((m) => { if (m.geometry && m.geometry !== STAR) m.geometry.dispose(); });
  v.cream.dispose(); v.top.material.dispose();
}
