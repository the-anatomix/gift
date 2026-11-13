// 트리 장식과 전구. 장식은 트리 겉면의 한 점에 달리고, 바깥쪽이 +z 다.
import { THREE, M, bake } from './kit.js';
import { TREE, surfaceR } from './room.js';
import { LIGHT_SETS } from './catalog.js';

// 장식 재질: 반짝이는 재질 하나를 모든 장식이 같이 쓴다. 색은 꼭짓점마다 들어 있다
const SHINY = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 80, specular: 0x888888 });
const RED = 0xD23A30, GOLD = 0xE9B93A, WHITE = 0xFFFAF2, GREEN = 0x2F8F5F, BLUE = 0x3E78D6, SILVER = 0xE4E8EE;

const starShape = (r0, r1) => {
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 2, r = k % 2 ? r0 : r1;
    if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
};
// 장식의 부품 도형. 종류마다 한 덩어리로 합칠 때만 쓴다
const G = {
  ball: new THREE.SphereGeometry(0.085, 14, 10),
  cap: new THREE.CylinderGeometry(0.02, 0.024, 0.03, 8),
  ring: new THREE.TorusGeometry(0.016, 0.005, 4, 8),
  band: new THREE.CylinderGeometry(0.0865, 0.0865, 0.022, 14, 1, true),
  thin: new THREE.CylinderGeometry(0.0862, 0.0862, 0.008, 14, 1, true),
  dot: new THREE.SphereGeometry(0.016, 8, 5),
  glint: new THREE.SphereGeometry(0.02, 6, 4),
  seg: new THREE.CylinderGeometry(0.02, 0.02, 0.031, 8),
  hook: new THREE.TorusGeometry(0.04, 0.02, 6, 6, Math.PI / 2),
  loop: new THREE.SphereGeometry(0.06, 10, 8),
  knot: new THREE.SphereGeometry(0.03, 8, 6),
  tail: new THREE.BoxGeometry(0.035, 0.11, 0.015),
  bell: new THREE.CylinderGeometry(0.025, 0.08, 0.11, 12),
  rim: new THREE.TorusGeometry(0.078, 0.014, 6, 14),
  clap: new THREE.SphereGeometry(0.024, 8, 6),
  leaf: new THREE.ConeGeometry(0.03, 0.08, 4),
  star: new THREE.ExtrudeGeometry(starShape(0.045, 0.105), { depth: 0.03, bevelEnabled: false }),
  starIn: new THREE.ExtrudeGeometry(starShape(0.026, 0.062), { depth: 0.012, bevelEnabled: false }),
};
function add(g, geo, hex, x, y, z) {
  const m = new THREE.Mesh(geo, M(hex));
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
// 방울: 꼭지와 고리, 가운데 띠나 물방울 무늬, 반짝이는 점
const bauble = (hex, trim, dots) => (g) => {
  add(g, G.ball, hex, 0, -0.03, 0.05); add(g, G.cap, GOLD, 0, 0.06, 0.05); add(g, G.ring, GOLD, 0, 0.085, 0.05);
  if (dots) for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; add(g, G.dot, trim, Math.cos(a) * 0.074, -0.03 + (k % 2 ? 0.022 : -0.022), 0.05 + Math.sin(a) * 0.074); }
  else { add(g, G.band, trim, 0, -0.03, 0.05); add(g, G.thin, WHITE, 0, -0.008, 0.05).scale.set(0.965, 1, 0.965); add(g, G.thin, WHITE, 0, -0.052, 0.05).scale.set(0.965, 1, 0.965); }
  add(g, G.glint, 0xFFFFFF, -0.03, 0.005, 0.122).scale.set(1, 1.5, 0.35);
};

const B = {
  red: bauble(RED, GOLD), gold: bauble(GOLD, RED), blue: bauble(BLUE, WHITE, true), silver: bauble(SILVER, BLUE),
  star(g) { add(g, G.star, GOLD, 0, 0, 0.02); add(g, G.starIn, 0xFFE9A8, 0, 0, 0.05); add(g, G.dot, WHITE, 0, 0, 0.066); add(g, G.ring, GOLD, 0, 0.115, 0.035); },
  cane(g) {
    const c = new THREE.Group();
    for (let k = 0; k < 6; k++) add(c, G.seg, k % 2 ? WHITE : RED, 0, -0.108 + k * 0.031, 0);
    add(c, G.hook, WHITE, 0.04, 0.073, 0).rotation.z = Math.PI / 2;
    add(c, G.hook, RED, 0.04, 0.073, 0);
    for (const s of [-1, 1]) add(c, G.leaf, GREEN, 0.025 * s, -0.01, 0.022).rotation.z = -1.1 * s; // 작은 리본
    add(c, G.dot, GOLD, 0, -0.01, 0.026);
    c.position.set(-0.02, 0, 0.05); c.rotation.z = 0.2;
    g.add(c);
  },
  bow(g) {
    for (const s of [-1, 1]) {
      add(g, G.loop, RED, 0.06 * s, 0, 0.04).scale.set(1.25, 0.8, 0.5);
      add(g, G.loop, 0xB82E26, 0.055 * s, 0, 0.052).scale.set(0.7, 0.4, 0.3);   // 접힌 안쪽
      add(g, G.tail, RED, 0.035 * s, -0.075, 0.04).rotation.z = 0.35 * s;
      add(g, G.thin, GOLD, 0.045 * s, -0.118, 0.04).scale.set(0.24, 1, 0.1);     // 끈 끝의 금빛 단
    }
    add(g, G.knot, 0xB82E26, 0, 0, 0.06);
    add(g, G.dot, GOLD, 0, 0, 0.088);
  },
  bell(g) {
    add(g, G.bell, GOLD, 0, -0.01, 0.07);
    add(g, G.rim, GOLD, 0, -0.065, 0.07).rotation.x = Math.PI / 2;
    add(g, G.clap, 0xB8862A, 0, -0.088, 0.07);
    add(g, G.knot, RED, 0, 0.058, 0.07);
    for (const s of [-1, 1]) { const l = add(g, G.leaf, GREEN, 0.04 * s, 0.062, 0.07); l.rotation.z = -1.2 * s; l.scale.z = 0.4; } // 호랑가시 잎
    add(g, G.glint, 0xFFFFFF, -0.022, -0.02, 0.118).scale.set(0.8, 1.6, 0.3);
  },
};
// 종류마다 부품을 한 덩어리로 합쳐 둔다(장식 하나 = 그리기 한 번). 모든 장식이 그 도형을 나눠 쓴다
const whole = new Map();
function wholeOf(k) {
  let geo = whole.get(k);
  if (!geo) { const g = new THREE.Group(); B[k](g); bake(g); geo = g.children[0].geometry; whole.set(k, geo); }
  return geo;
}

// 다른 모듈이 장식 모양을 더한다 (어드벤트 달력에서 풀리는 특별 장식: advent.js). fn(g, add, P) 로 그린다 (P 는 색을 그대로 돌려준다: 색은 add 가 꼭짓점에 넣는다)
export function addOrnament(k, fn) { B[k] = (g) => fn(g, add, (hex) => hex); }
// 장식 하나. o = { k, x, y, z } (트리 겉면 위의 점)
export function buildOrnament(o) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(wholeOf(o.k), SHINY));
  g.position.set(o.x, o.y, o.z);
  g.rotation.y = Math.atan2(o.x, o.z);
  return g;
}

// 전구: 트리를 감아 내려오는 줄. 네 묶음으로 나눠 묶음마다 색과 밝기를 바꾼다.
export function buildLights(scene) {
  const COUNT = 64, GROUPS = 4, TURNS = 5.5, Y0 = 0.56, Y1 = 2.52;
  const geo = new THREE.SphereGeometry(0.045, 8, 6), box = new THREE.Group(), mats = [], base = [];
  const m4 = new THREE.Matrix4();
  for (let gi = 0; gi < GROUPS; gi++) {
    const n = Math.ceil((COUNT - gi) / GROUPS), mat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const inst = new THREE.InstancedMesh(geo, mat, n);
    for (let k = 0; k < n; k++) {
      const u = (gi + k * GROUPS) / (COUNT - 1), y = Y1 - u * (Y1 - Y0), a = u * TURNS * Math.PI * 2, r = surfaceR(y) + 0.03;
      inst.setMatrixAt(k, m4.makeTranslation(Math.sin(a) * r, y, Math.cos(a) * r));
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.frustumCulled = false;
    box.add(inst); mats.push(mat); base.push(new THREE.Color());
  }
  // 전구를 잇는 줄과, 전구 둘레의 옅은 빛 번짐 (묶음마다 같은 색으로 따라 바뀐다)
  const pts = [];
  for (let k = 0; k <= 220; k++) { const u = k / 220, y = Y1 - u * (Y1 - Y0), a = u * TURNS * Math.PI * 2, r = surfaceR(y) + 0.022; pts.push(new THREE.Vector3(Math.sin(a) * r, y - 0.012 * Math.sin(u * COUNT * Math.PI), Math.cos(a) * r)); }
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.007, 3), M(0x1F4A36));
  box.add(wire);
  const glowGeo = new THREE.IcosahedronGeometry(0.075, 0), glows = [];
  box.children.filter((c) => c.isInstancedMesh).forEach((inst) => {
    const gm = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });
    const gl = new THREE.InstancedMesh(glowGeo, gm, inst.count);
    gl.instanceMatrix.copy(inst.instanceMatrix); gl.instanceMatrix.needsUpdate = true; gl.frustumCulled = false; gl.renderOrder = 3; gl.raycast = () => {};
    box.add(gl); glows.push(gm);
  });
  box.visible = false;
  scene.add(box);
  let blink = 'on', on = false;
  return {
    get on() { return on; },
    set(setId, blinkId) {
      const s = LIGHT_SETS.find((x) => x.id === setId) || LIGHT_SETS[0];
      on = s.colors.length > 0; box.visible = on; blink = blinkId;
      if (on) base.forEach((c, gi) => { c.setHex(s.colors[gi % s.colors.length]); glows[gi].color.copy(c); });
    },
    // t = 흐른 시간(초). 묶음마다 밝기를 정한다.
    tick(t) {
      if (!on) return;
      for (let gi = 0; gi < GROUPS; gi++) {
        let b = 1;
        if (blink === 'slow') b = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.8 + gi * Math.PI / 2));
        else if (blink === 'twinkle') b = Math.sin(t * 9 + gi * 2.1) * Math.sin(t * 5.3 + gi * 4.7) > 0 ? 1 : 0.45;
        mats[gi].color.copy(base[gi]).multiplyScalar(b);
        glows[gi].color.copy(mats[gi].color);
      }
    },
  };
}

export { TREE };
