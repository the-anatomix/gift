// 케이크 작업대 위의 케이크. 방 상태(state.js 의 cakes)에 맞춰 모양을 다시 차린다.
// 크림 색, 올린 장식(딸기·체리·초콜릿·별·트리·초), 켜진 촛불.
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

// 가구 묶음 g(케이크 작업대)에 케이크를 차린다. cake = { cream, tops, lit }
export function dressCake(g, cake) {
  let c = g.userData.cake;
  if (!c) {
    c = g.userData.cake = { root: new THREE.Group(), tops: new THREE.Group(), cream: new THREE.MeshLambertMaterial({ color: CREAMS[0].hex }) };
    g.add(c.root);
    put(cyl(0.38, 0.38, 0.02, 24), 0xFFFAF2, 0, 0.945, 0, c.root);                  // 접시
    put(cyl(0.06, 0.12, 0.05, 12), 0xFFFAF2, 0, 0.92, 0, c.root, false);
    put(cyl(CAKE.r, CAKE.r, 0.16, 28), 0xE8C48A, 0, 1.035, 0, c.root);              // 빵
    put(cyl(CAKE.r + 0.012, CAKE.r + 0.012, 0.05, 28), c.cream, 0, CAKE.y - 0.025, 0, c.root); // 위 크림
    put(cyl(CAKE.r + 0.006, CAKE.r + 0.006, 0.03, 28), c.cream, 0, 0.97, 0, c.root, false);    // 아래 크림 띠
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; put(ball(0.03, 8, 6), c.cream, Math.cos(a) * (CAKE.r - 0.02), CAKE.y + 0.01, Math.sin(a) * (CAKE.r - 0.02), c.root, false); } // 가장자리 크림 방울
    // 누를 수 있는 윗면 (보이지 않는다. 어디를 눌렀는지 재는 데 쓴다)
    c.top = new THREE.Mesh(new THREE.CircleGeometry(CAKE.r, 24), new THREE.MeshBasicMaterial({ visible: false }));
    c.top.rotation.x = -Math.PI / 2; c.top.position.y = CAKE.y;
    c.root.add(c.top, c.tops);
    c.tops.position.y = CAKE.y;
  }
  c.cream.color.setHex((CREAMS[cake.cream] || CREAMS[0]).hex);
  for (const o of [...c.tops.children]) { c.tops.remove(o); o.traverse((m) => { if (m.geometry && m.geometry !== STAR) m.geometry.dispose(); }); }
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
    c.tops.add(o);
  });
}
// 촛불이 일렁이게 한다
export function flicker(g, t) {
  const c = g.userData.cake;
  if (!c) return;
  c.tops.traverse((m) => { if (m.userData.flame) { m.scale.y = 1 + 0.18 * Math.sin(t * 13 + m.parent.position.x * 40); m.rotation.z = 0.12 * Math.sin(t * 7 + m.parent.position.z * 30); } });
}
// 케이크 윗면에서 누른 자리 (케이크 가운데가 0, 0). ray = 화면에서 쏜 선
export function pickTop(g, ray) {
  const c = g.userData.cake;
  if (!c) return null;
  const hit = ray.intersectObject(c.top, false)[0];
  if (!hit) return null;
  const p = c.root.worldToLocal(hit.point.clone());
  return { x: Math.round(p.x * 1000) / 1000, z: Math.round(p.z * 1000) / 1000 };
}
