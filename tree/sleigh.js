// 루돌프 썰매의 모양과 연출: 빨간 코가 빛나는 루돌프 한 마리가 끄는 썰매, 방울 소리, 뒤에 남는 반짝이 꼬리.
// 타고 내리는 규칙과 동기화는 fly.js(ride, 소식 'fly' 의 맨 앞 s)에 있고, 여기는 아바타의 fly.sled 를 보고 모양을 붙였다 뗄 뿐이다(방의 상태는 바꾸지 않는다).
// 같이 놀기의 "몰래 산타"(games.js)나 가구 "산타 썰매"(advent.js 의 sled)와는 상관없는 탈것이다.
// 그리기: 썰매와 루돌프를 한 덩어리로 합치고(bake), 코의 빛(구 + 빛 번짐)과 꼬리(점 묶음 하나)만 따로 그린다.
import { THREE, M, put, ball, cyl, rbox, cap, bake, glowAt, soft } from './kit.js';
import { sfx } from './sfx.js';

const C = { red: 0xC62F2A, dark: 0x8E1F1C, gold: 0xE2B33C, wood: 0x6B4630, fur: 0x9A6A44, belly: 0xD9B98E, horn: 0xEADBB8, sack: 0xB98452, green: 0x2F8F4E, black: 0x2B2420 };
const NOSE = new THREE.MeshBasicMaterial({ color: 0xFF3B2B });
const TRAIL_N = 44, TRAIL_LIFE = 1.2;
let trailMat = null;

function build() {
  const g = new THREE.Group(), car = new THREE.Group(), deer = new THREE.Group();
  // 썰매: 바닥과 옆판, 높은 등받이, 말려 올라간 앞판, 금색 테와 날
  put(rbox(0.8, 0.07, 1.25, 0.03), C.red, 0, 0.1, 0.05, car);
  for (const s of [-1, 1]) {
    put(rbox(0.06, 0.36, 1.25, 0.025), C.red, 0.4 * s, 0.28, 0.05, car);
    put(new THREE.BoxGeometry(0.075, 0.03, 1.27), C.gold, 0.4 * s, 0.47, 0.05, car, false);
    put(new THREE.BoxGeometry(0.045, 0.045, 1.7), C.gold, 0.34 * s, -0.14, 0.12, car);                     // 날
    const curl = put(new THREE.TorusGeometry(0.17, 0.023, 6, 10, Math.PI / 2), C.gold, 0.34 * s, 0.03, 0.97, car); curl.rotation.set(0, -Math.PI / 2, -Math.PI / 2);
    for (const z of [-0.35, 0.45]) put(cyl(0.02, 0.02, 0.22, 6), C.gold, 0.34 * s, -0.03, z, car, false);
  }
  put(rbox(0.86, 0.66, 0.07, 0.03), C.dark, 0, 0.43, -0.6, car);
  put(new THREE.BoxGeometry(0.88, 0.035, 0.085), C.gold, 0, 0.77, -0.6, car, false);
  put(rbox(0.8, 0.42, 0.07, 0.03), C.red, 0, 0.31, 0.7, car).rotation.x = 0.42;
  put(rbox(0.68, 0.07, 0.36, 0.03), C.wood, 0, 0.215, -0.04, car, false);                                   // 앉는 널
  put(ball(0.2, 12, 10), C.sack, 0.13, 0.44, -0.38, car).scale.set(1, 1.15, 0.9);                           // 선물 자루와 상자
  put(rbox(0.2, 0.18, 0.2, 0.02), C.green, -0.2, 0.36, -0.4, car);
  put(new THREE.BoxGeometry(0.21, 0.19, 0.04), C.gold, -0.2, 0.36, -0.4, car, false);
  for (const s of [-1, 1]) put(new THREE.BoxGeometry(0.012, 0.012, 0.98), C.wood, 0.17 * s, 0.5, 1.2, car, false).rotation.x = -0.06; // 고삐
  // 루돌프: 달리는 다리, 뿔, 방울 목걸이
  const D = 1.72;
  put(cap(0.17, 0.4, 10), C.fur, 0, 0.5, 0, deer).rotation.x = Math.PI / 2;
  put(ball(0.12, 10, 8), C.belly, 0, 0.42, 0.02, deer, false).scale.set(1, 0.7, 2.2);
  put(cyl(0.085, 0.11, 0.3, 10), C.fur, 0, 0.7, 0.3, deer).rotation.x = 0.55;
  put(ball(0.14, 12, 10), C.fur, 0, 0.87, 0.42, deer).scale.set(1, 0.95, 1.12);
  put(ball(0.085, 10, 8), C.belly, 0, 0.83, 0.55, deer).scale.set(1, 0.85, 1.1);
  put(ball(0.052, 10, 8), C.belly, 0, 0.56, -0.36, deer, false);                                             // 꼬리
  for (const s of [-1, 1]) {
    put(cyl(0, 0.04, 0.11, 6), C.fur, 0.13 * s, 0.97, 0.36, deer, false).rotation.z = -0.9 * s;            // 귀
    put(ball(0.018, 6, 5), C.black, 0.075 * s, 0.9, 0.53, deer, false);                                      // 눈
    put(cyl(0.014, 0.02, 0.24, 5), C.horn, 0.07 * s, 1.08, 0.38, deer, false).rotation.z = -0.35 * s;      // 뿔
    put(cyl(0.01, 0.014, 0.12, 5), C.horn, 0.13 * s, 1.12, 0.38, deer, false).rotation.z = -1.1 * s;
    put(cyl(0.01, 0.014, 0.1, 5), C.horn, 0.07 * s, 1.13, 0.43, deer, false).rotation.x = 0.8;
    put(cyl(0.04, 0.03, 0.4, 6), C.fur, 0.1 * s, 0.26, 0.24, deer).rotation.x = -0.6;                      // 앞다리는 앞으로
    put(cyl(0.04, 0.03, 0.4, 6), C.fur, 0.1 * s, 0.26, -0.24, deer).rotation.x = 0.6;                      // 뒷다리는 뒤로
    put(ball(0.036, 6, 5), C.black, 0.1 * s, 0.1, 0.36, deer, false); put(ball(0.036, 6, 5), C.black, 0.1 * s, 0.1, -0.36, deer, false); // 발굽
  }
  const collar = put(new THREE.TorusGeometry(0.105, 0.022, 6, 12), C.red, 0, 0.68, 0.28, deer, false); collar.rotation.x = Math.PI / 2 - 0.55;
  put(ball(0.035, 8, 6), C.gold, 0, 0.6, 0.36, deer, false);
  deer.position.set(0, -0.05, D);
  g.add(car, deer);
  bake(car); bake(deer);
  const nose = new THREE.Mesh(ball(0.05, 10, 8), NOSE); nose.position.set(0, 0.84, 0.645); nose.userData.keep = true; deer.add(nose);
  const halo = glowAt(deer, 0, 0.84, 0.66, 0.55, 0xFF4A32, 0.75);
  return { g, car, deer, nose, halo };
}
function makeTrail(scene) {
  if (!trailMat) trailMat = new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, vertexColors: true, map: soft(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(TRAIL_N * 3), col = new Float32Array(TRAIL_N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, trailMat); pts.frustumCulled = false; pts.renderOrder = 4; pts.raycast = () => {};
  scene.add(pts);
  return { pts, geo, pos, col, life: new Float32Array(TRAIL_N), tint: new Float32Array(TRAIL_N * 3), head: 0, acc: 0, live: 0 };
}
const TINTS = [[1, 0.86, 0.45], [1, 1, 1], [1, 0.6, 0.5], [0.7, 0.95, 1]];

// K = { scene, me, others(): Map(id → 아바타), dirty() }
export function makeSleigh(K) {
  const riders = new Map(); // 아바타 → { m: 모양, tr: 꼬리, t, bell, on }
  const v = new THREE.Vector3();
  function drop(a, st) {
    if (st.m) { a.root.remove(st.m.g); st.m.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); st.m = null; }
  }
  function one(a, mine, dt) {
    const want = !!(a.fly && a.fly.sled);
    let st = riders.get(a);
    if (!st) { if (!want) return; st = { m: null, tr: makeTrail(K.scene), t: 0, bell: 0.2, on: false }; riders.set(a, st); }
    if (want && !st.m) { st.m = build(); a.root.add(st.m.g); st.on = true; sfx('sleighOn', mine ? null : a); }
    if (!want && st.m) { drop(a, st); st.on = false; }
    st.t += dt;
    const tr = st.tr, shown = a.root.visible || mine;
    if (st.m) {
      const k = a.blend || 0, b = Math.sin(st.t * 9);
      st.m.deer.position.y = -0.05 + b * 0.035 * (0.3 + k); st.m.deer.rotation.x = Math.sin(st.t * 9 + 1) * 0.07 * (0.3 + k); // 달리는 듯 끄덕인다
      st.m.car.rotation.z = Math.sin(st.t * 2.1) * 0.025;
      const p = 0.5 + 0.12 * Math.sin(st.t * 5); st.m.halo.scale.set(p, p, 1);
      if (a.moving) { // 방울 소리와 반짝이
        if ((st.bell -= dt) <= 0) { st.bell = 0.56; sfx('bells', mine ? null : a, mine ? 0.8 : 1); }
        tr.acc += dt;
        while (tr.acc > 0.035) {
          tr.acc -= 0.035;
          const i = tr.head; tr.head = (tr.head + 1) % TRAIL_N;
          v.set((Math.random() - 0.5) * 0.7, 0.05 + Math.random() * 0.35, -0.75 - Math.random() * 0.3).applyEuler(a.root.rotation).add(a.root.position);
          tr.pos[i * 3] = v.x; tr.pos[i * 3 + 1] = v.y; tr.pos[i * 3 + 2] = v.z; tr.life[i] = TRAIL_LIFE;
          const c = TINTS[(Math.random() * TINTS.length) | 0]; tr.tint[i * 3] = c[0]; tr.tint[i * 3 + 1] = c[1]; tr.tint[i * 3 + 2] = c[2];
        }
      } else st.bell = Math.min(st.bell, 0.15);
    }
    let live = 0;
    for (let i = 0; i < TRAIL_N; i++) {
      if (tr.life[i] <= 0) continue;
      tr.life[i] -= dt; tr.pos[i * 3 + 1] -= dt * 0.22;
      const f = Math.max(0, tr.life[i] / TRAIL_LIFE), tw = f * (0.65 + 0.35 * Math.sin(st.t * 18 + i * 1.7));
      tr.col[i * 3] = tr.tint[i * 3] * tw; tr.col[i * 3 + 1] = tr.tint[i * 3 + 1] * tw; tr.col[i * 3 + 2] = tr.tint[i * 3 + 2] * tw;
      if (tr.life[i] > 0) live++;
    }
    tr.live = live; tr.pts.visible = shown && live > 0;
    if (live || st.m) { tr.geo.attributes.position.needsUpdate = true; tr.geo.attributes.color.needsUpdate = true; K.dirty(); }
    if (!st.m && !live) { K.scene.remove(tr.pts); tr.geo.dispose(); riders.delete(a); } // 내렸고 꼬리도 다 사라졌다
  }
  function tick(dt) {
    one(K.me, true, dt);
    const others = K.others();
    for (const a of others.values()) one(a, false, dt);
    for (const [a, st] of riders) if (a !== K.me && ![...others.values()].includes(a)) { drop(a, st); K.scene.remove(st.tr.pts); st.tr.geo.dispose(); riders.delete(a); } // 나간 사람
  }
  // 자동 검사가 쓰는 창구
  const info = (a) => { const st = riders.get(a); return st ? { on: !!st.m, attached: !!(st.m && st.m.g.parent === a.root), trail: st.tr.live, nose: !!(st.m && st.m.nose.material === NOSE), calls: st.m ? (() => { let n = 0; st.m.g.traverse((o) => { if (o.isMesh || o.isSprite) n++; }); return n + 1; })() : 0 } : null; };
  window.__sleigh = { get me() { return info(K.me); }, peer: (id) => { const a = K.others().get(id); return a ? info(a) : null; }, get riders() { return riders.size; } };
  return { tick };
}
