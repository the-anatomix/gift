// 트리 장식과 전구. 장식은 트리 겉면의 한 점에 달리고, 바깥쪽이 +z 다.
import { THREE } from './kit.js';
import { TREE, surfaceR } from './room.js';
import { LIGHT_SETS } from './catalog.js';

// 반짝이는 재질 (같은 색은 하나를 나눠 쓴다)
const shiny = new Map();
function P(hex, shine = 70) {
  let m = shiny.get(hex);
  if (!m) { m = new THREE.MeshPhongMaterial({ color: hex, shininess: shine, specular: 0x777777 }); shiny.set(hex, m); }
  return m;
}
const RED = 0xD23A30, GOLD = 0xE9B93A, WHITE = 0xFFFAF2;

// 도형은 한 번만 만들어 모든 장식이 나눠 쓴다 (그래서 장식을 뗄 때 도형을 지우지 않는다)
const G = {
  ball: new THREE.SphereGeometry(0.085, 14, 10),
  cap: new THREE.CylinderGeometry(0.02, 0.024, 0.03, 8),
  seg: new THREE.CylinderGeometry(0.02, 0.02, 0.046, 8),
  hook: new THREE.TorusGeometry(0.04, 0.02, 6, 6, Math.PI / 2),
  loop: new THREE.SphereGeometry(0.06, 10, 8),
  knot: new THREE.SphereGeometry(0.03, 8, 6),
  tail: new THREE.BoxGeometry(0.035, 0.11, 0.015),
  bell: new THREE.CylinderGeometry(0.025, 0.08, 0.11, 12),
  rim: new THREE.TorusGeometry(0.078, 0.014, 6, 14),
  clap: new THREE.SphereGeometry(0.024, 8, 6),
  star: (() => {
    const s = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + Math.PI / 2, r = k % 2 ? 0.045 : 0.105;
      if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
  })(),
};
function add(g, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
const bauble = (hex) => (g) => { add(g, G.ball, P(hex), 0, -0.03, 0.05); add(g, G.cap, P(GOLD), 0, 0.06, 0.05); };

const B = {
  red: bauble(RED), gold: bauble(GOLD), blue: bauble(0x3E78D6), silver: bauble(0xE4E8EE),
  star(g) { add(g, G.star, P(GOLD), 0, 0, 0.02); },
  cane(g) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) add(c, G.seg, P(k % 2 ? WHITE : RED), 0, -0.1 + k * 0.046, 0);
    add(c, G.hook, P(WHITE), 0.04, 0.073, 0).rotation.z = Math.PI / 2;
    add(c, G.hook, P(RED), 0.04, 0.073, 0);
    c.position.set(-0.02, 0, 0.05); c.rotation.z = 0.2;
    g.add(c);
  },
  bow(g) {
    for (const s of [-1, 1]) {
      add(g, G.loop, P(RED), 0.06 * s, 0, 0.04).scale.set(1.25, 0.8, 0.5);
      add(g, G.tail, P(RED), 0.035 * s, -0.075, 0.04).rotation.z = 0.35 * s;
    }
    add(g, G.knot, P(0xB82E26), 0, 0, 0.06);
  },
  bell(g) {
    add(g, G.bell, P(GOLD), 0, -0.01, 0.07);
    add(g, G.rim, P(GOLD), 0, -0.065, 0.07).rotation.x = Math.PI / 2;
    add(g, G.clap, P(0xB8862A), 0, -0.088, 0.07);
    add(g, G.knot, P(RED), 0, 0.058, 0.07);
  },
};

// 다른 모듈이 장식 모양을 더한다 (어드벤트 달력에서 풀리는 특별 장식: advent.js). fn(g, add, P) 로 그린다
export function addOrnament(k, fn) { B[k] = (g) => fn(g, add, P); }
// 장식 하나. o = { k, x, y, z } (트리 겉면 위의 점)
export function buildOrnament(o) {
  const g = new THREE.Group();
  B[o.k](g);
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
  box.visible = false;
  scene.add(box);
  let blink = 'on', on = false;
  return {
    get on() { return on; },
    set(setId, blinkId) {
      const s = LIGHT_SETS.find((x) => x.id === setId) || LIGHT_SETS[0];
      on = s.colors.length > 0; box.visible = on; blink = blinkId;
      if (on) base.forEach((c, gi) => c.setHex(s.colors[gi % s.colors.length]));
    },
    // t = 흐른 시간(초). 묶음마다 밝기를 정한다.
    tick(t) {
      if (!on) return;
      for (let gi = 0; gi < GROUPS; gi++) {
        let b = 1;
        if (blink === 'slow') b = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.8 + gi * Math.PI / 2));
        else if (blink === 'twinkle') b = Math.sin(t * 9 + gi * 2.1) * Math.sin(t * 5.3 + gi * 4.7) > 0 ? 1 : 0.45;
        mats[gi].color.copy(base[gi]).multiplyScalar(b);
      }
    },
  };
}

export { TREE };
