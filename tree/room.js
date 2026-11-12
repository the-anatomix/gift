// 집: 넓은 거실(가운데 트리), 동쪽에 주방과 방 한 칸. 바닥, 바깥 벽 네 면, 방 사이 벽, 창과 문.
// 남쪽 벽의 현관문을 나서면 눈 쌓인 마당이고, 위로는 사다리로 올라가는 2층과 3층이 있다(1층과 같은 넓이의 한 칸짜리 층).
// 층마다 묶음이 따로 있어서, 내가 있는 층만 보이게 한다(showFloor).
// 방(침실)으로 들어가는 두 곳에는 미닫이문이, 현관에는 여닫이문이 달려 있어서 사람이 다가오면 열리고 지나가면 닫힌다.
// 바깥 벽은 카메라 쪽 두 면을 숨길 수 있게 따로 묶는다. 방 사이 벽은 내려다볼 때 낮게만 보이고, 1인칭에서는 천장까지 보인다.
import { THREE, M, put, rbox, cyl, ball } from './kit.js';
import { NX, NZ, CELL, X0, Z0, X1, Z1, GZ1, YARD, LEVELS, FLOOR_H, LADDERS, zoneOf, centerOf, hatchCell } from './path.js';
import { WALLS, FLOORS } from './catalog.js';

export const WALL_H = 2.7;
export const LOW_H = 0.95; // 방 사이 벽이 내려다볼 때 보이는 높이
// 현관문: 남쪽 벽에서 뚫린 자리의 가운데 x 와 너비
export const FRONT = { x: X0 + (YARD.door[0] + YARD.door[1] + 1) / 2 * CELL, w: (YARD.door[1] - YARD.door[0] + 1) * CELL };
// 마당에 처음부터 서 있는 것들이 차지하는 칸: 나무 두 그루(2 × 2 칸), 가로등
const YARD_TREES = [[26, 23], [1, 21]], YARD_LAMP = [7, 22];
const yardSolid = (i, j) => YARD_TREES.some(([a, b]) => (i === a || i === a + 1) && (j === b || j === b + 1)) || (i === YARD_LAMP[0] && j === YARD_LAMP[1]);
export const C = {
  slab: 0xB98F66, base: 0x8A5F3F, white: 0xFFF8EA,
  rug: 0xC8443A, rugIn: 0xF3E2C3, night: 0x27335E, moon: 0xFFF2C2,
  pine: 0x2F7D56, pine2: 0x3A9163, trunk: 0x7A5137, pot: 0xC8443A, potRim: 0xF3E2C3,
  door: 0xA8754B, knob: 0xE7B441, frame: 0x7A5137,
};

// 방 배치 (칸 번호). 거실 i 0~19, 그 옆 한 줄(i 20)이 벽, 동쪽 위가 주방(j 0~8), 한 줄(j 9)이 벽, 아래가 방(j 10~17).
// 벽 줄에서 문으로 뚫린 칸은 지나다닐 수 있다.
export const PLAN = {
  living: { i0: 0, i1: 19, j0: 0, j1: 17 },
  kitchen: { i0: 21, i1: 29, j0: 0, j1: 8 },
  bed: { i0: 21, i1: 29, j0: 10, j1: 17 },
  wallI: 20, wallJ: 9,
  doorsI: [[3, 5], [12, 14]],   // i 20 줄에서 뚫린 j 범위: 거실↔주방, 거실↔방
  doorsJ: [[24, 26]],           // j 9 줄에서 뚫린 i 범위: 주방↔방
};
const inAny = (v, list) => list.some(([a, b]) => v >= a && v <= b);
// 바닥 칸 (i, j) 가 방 사이 벽인지
export function wallCell(i, j) {
  if (i >= NX || j >= NZ) return false; // 마당과 2층에는 방 사이 벽이 없다
  if (i === PLAN.wallI) return !inAny(j, PLAN.doorsI);
  if (j === PLAN.wallJ && i > PLAN.wallI) return !inAny(i, PLAN.doorsJ);
  return false;
}
// 그 자리가 어느 방인지 ('living' | 'kitchen' | 'bed' | null = 벽이나 문턱)
export function roomOf(i, j) {
  for (const k of ['living', 'kitchen', 'bed']) { const r = PLAN[k]; if (i >= r.i0 && i <= r.i1 && j >= r.j0 && j <= r.j1) return k; }
  return null;
}

// 나무 마루 무늬 (그림 한 장을 그려서 바닥에 입힌다)
function floorTexture(tones, rx, rz) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const rows = 12, h = 512 / rows;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 160;
    while (x < 512) {
      const w = 130 + rnd() * 110;
      g.fillStyle = tones[Math.floor(rnd() * tones.length)];
      g.fillRect(x, r * h, w, h);
      g.fillStyle = 'rgba(90,56,36,.28)';
      g.fillRect(x + w - 1.5, r * h, 1.5, h);
      x += w;
    }
    g.fillStyle = 'rgba(90,56,36,.22)';
    g.fillRect(0, r * h, 512, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, rz);
  return t;
}
// 주방 타일 (두 색 바둑판)
function tileTexture(a, b, rx, rz) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? a : b; g.fillRect(x * 64, y * 64, 64, 64); }
  g.strokeStyle = 'rgba(90,56,36,.18)'; g.lineWidth = 2;
  for (const v of [0, 64, 128]) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, 128); g.moveTo(0, v); g.lineTo(128, v); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, rz);
  return t;
}

// 바깥 벽 한 면. 아래 턱(항상 보임)과 위쪽(숨길 수 있음)으로 나눈다. 벽 안쪽 면이 방 안을 본다.
// side: 'n'(z = Z0) 's'(z = Z1) 'w'(x = X0) 'e'(x = X1). at(v) = 벽을 따라 방 안 좌표 v 가 벽에서는 어디인지.
// gap = [v0, v1]: 문으로 뚫어 둘 범위(방 안 좌표). 그 위는 문 높이부터 벽이 이어진다.
function wall(scene, side, mats, gap = null) {
  const T = 0.14, long = side === 'n' || side === 's';
  const L = (long ? X1 - X0 : Z1 - Z0) + T * 2, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const g = new THREE.Group(), upper = new THREE.Group();
  g.add(upper); scene.add(g);
  let at;
  if (side === 'n') { g.position.set(cx, 0, Z0 - T / 2); at = (x) => x - cx; }
  if (side === 's') { g.position.set(cx, 0, Z1 + T / 2); g.rotation.y = Math.PI; at = (x) => cx - x; }
  if (side === 'w') { g.position.set(X0 - T / 2, 0, cz); g.rotation.y = Math.PI / 2; at = (z) => cz - z; }
  if (side === 'e') { g.position.set(X1 + T / 2, 0, cz); g.rotation.y = -Math.PI / 2; at = (z) => z - cz; }
  // 벽을 따라 a ~ b 를 채우는 토막들 (문 자리는 비운다)
  const [ga, gb] = gap ? [at(gap[0]), at(gap[1])].sort((p, q) => p - q) : [0, 0];
  const spans = (a, b) => (gap ? [[a, ga], [gb, b]] : [[a, b]]);
  for (const [a, b] of spans(-L / 2, L / 2)) {
    put(rbox(b - a, 0.16, T, 0.03), C.base, (a + b) / 2, 0.08, 0, g);
    put(rbox(b - a, WALL_H - 0.16, T, 0.04), mats.wall, (a + b) / 2, 0.16 + (WALL_H - 0.16) / 2, 0, upper);
  }
  for (const [a, b] of spans(-L / 2 + T, L / 2 - T)) {
    put(new THREE.BoxGeometry(b - a, 0.62, 0.03), mats.panel, (a + b) / 2, 0.16 + 0.31, T / 2, upper, false);
    put(new THREE.BoxGeometry(b - a, 0.05, 0.05), C.base, (a + b) / 2, 0.8, T / 2 + 0.01, upper, false);
  }
  if (gap) put(new THREE.BoxGeometry(gb - ga, WALL_H - FRONT_H, T), mats.wall, (ga + gb) / 2, (WALL_H + FRONT_H) / 2, 0, upper, false);
  return { g, upper, front: T / 2, at, T };
}

function windowOn(w, v) {
  const x = w.at(v), z = w.front;
  put(rbox(1.5, 1.2, 0.08, 0.03), C.white, x, 1.62, z, w.upper);
  put(new THREE.BoxGeometry(1.3, 1.0, 0.02), new THREE.MeshBasicMaterial({ color: C.night }), x, 1.62, z + 0.035, w.upper, false);
  const moon = put(new THREE.CircleGeometry(0.13, 20), new THREE.MeshBasicMaterial({ color: C.moon }), x + 0.36, 1.86, z + 0.047, w.upper, false);
  moon.receiveShadow = false;
  // 창밖 눈송이
  const dots = [[-0.5, 0.3], [-0.3, -0.2], [-0.1, 0.36], [0.05, -0.05], [0.2, -0.34], [0.5, -0.1], [-0.52, -0.36], [0.38, -0.3], [-0.2, 0.1], [0.12, 0.22]];
  const snow = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  for (const [dx, dy] of dots) put(new THREE.CircleGeometry(0.022, 8), snow, x + dx, 1.62 + dy, z + 0.046, w.upper, false);
  put(new THREE.BoxGeometry(0.05, 1.0, 0.03), C.white, x, 1.62, z + 0.05, w.upper, false);
  put(new THREE.BoxGeometry(1.3, 0.05, 0.03), C.white, x, 1.62, z + 0.05, w.upper, false);
  put(rbox(1.66, 0.07, 0.2, 0.02), C.white, x, 1.0, z + 0.07, w.upper);
}

function wreathOn(w, v) {
  const x = w.at(v), z = w.front + 0.06;
  const ring = put(new THREE.TorusGeometry(0.3, 0.1, 8, 16), M(C.pine, true), x, 1.7, z, w.upper);
  ring.scale.z = 0.6;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    put(ball(0.045, 10, 8), C.pot, x + Math.cos(a) * 0.3, 1.7 + Math.sin(a) * 0.3, z + 0.07, w.upper, false);
  }
  put(rbox(0.26, 0.12, 0.06, 0.03), C.pot, x, 1.42, z + 0.07, w.upper, false);
}

// 현관문: 벽에 뚫린 자리의 문틀과, 한쪽 모서리를 축으로 마당 쪽으로 열리는 문짝. 벽 윗부분과 같이 숨는다.
const FRONT_H = 2.1;
function frontDoor(w) {
  const x = w.at(FRONT.x), half = FRONT.w / 2, T = w.T;
  for (const s of [-1, 1]) put(new THREE.BoxGeometry(0.07, FRONT_H, T + 0.06), C.frame, x + s * (half - 0.035), FRONT_H / 2, 0, w.upper);
  put(new THREE.BoxGeometry(FRONT.w, 0.08, T + 0.06), C.frame, x, FRONT_H + 0.04, 0, w.upper, false);
  const hinge = new THREE.Group();
  hinge.position.set(x - half + 0.07, 0, -T / 2 + 0.02);
  w.upper.add(hinge);
  const lw = FRONT.w - 0.14;
  put(rbox(lw, FRONT_H - 0.04, 0.06, 0.02), 0xB5523F, lw / 2, FRONT_H / 2, 0, hinge);
  for (const y of [0.55, 1.45]) for (const s of [-1, 1]) put(new THREE.BoxGeometry(lw - 0.24, 0.62, 0.012), 0xA3432F, lw / 2, y, s * 0.032, hinge, false); // 널판 무늬
  for (const s of [-1, 1]) put(ball(0.045, 10, 8), C.knob, lw - 0.1, 1.02, s * 0.06, hinge, false);
  const wr = put(new THREE.TorusGeometry(0.17, 0.06, 8, 16), M(C.pine, true), lw / 2, 1.6, -0.05, hinge, false); wr.scale.z = 0.6; // 바깥쪽의 리스
  return { cx: FRONT.x, cz: Z1 + T / 2, open: 0, set(o) { hinge.rotation.y = o * 1.75; } };
}

function pictureOn(w, v) {
  const x = w.at(v), z = w.front;
  put(rbox(0.9, 0.7, 0.05, 0.02), C.frame, x, 1.7, z + 0.02, w.upper);
  put(new THREE.BoxGeometry(0.76, 0.56, 0.02), new THREE.MeshBasicMaterial({ color: 0xDCEBE3 }), x, 1.7, z + 0.05, w.upper, false);
  const hill = put(new THREE.CircleGeometry(0.3, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xFFFFFF }), x - 0.08, 1.42, z + 0.062, w.upper, false);
  hill.scale.set(1.2, 0.7, 1);
  put(new THREE.CircleGeometry(0.12, 3), new THREE.MeshBasicMaterial({ color: C.pine }), x + 0.2, 1.62, z + 0.064, w.upper, false).rotation.z = Math.PI / 2;
}

// 트리 치수. 장식과 전구가 이 값을 보고 겉면 자리를 구한다. 트리는 (0, 0) 에 서 있다.
export const TREE = {
  tiers: [ // y0 = 층 아랫면 높이, r = 아랫면 반지름, h = 층 높이
    { y0: 0.42, r: 1.08, h: 1.0 },
    { y0: 1.0, r: 0.88, h: 0.9 },
    { y0: 1.52, r: 0.66, h: 0.8 },
    { y0: 1.98, r: 0.44, h: 0.7 },
  ],
  top: 2.68,
  reach: 1.15, // 이 반지름 안의 바닥 칸은 걸어 들어갈 수도, 가구를 놓을 수도 없다
};
// 바닥 칸 (i, j) 가 트리 자리인지
export function treeBlocked(i, j) {
  return Math.hypot(X0 + (i + 0.5) * CELL, Z0 + (j + 0.5) * CELL) < TREE.reach;
}
// 처음부터 막혀 있는 칸(걸어갈 수 없다): 아무것도 없는 곳, 트리 자리, 방 사이 벽, 마당의 나무와 가로등, 위층의 사다리 구멍
export const fixedCell = (i, j) => zoneOf(i, j) === null || treeBlocked(i, j) || wallCell(i, j) || yardSolid(i, j) || hatchCell(i, j);
// 가구를 놓을 수 없는 칸: 막힌 칸, 그리고 늘 비워 둬야 하는 칸(사다리 앞과 올라선 자리, 현관 문턱)
export const noBuild = (i, j) => fixedCell(i, j) || j === YARD.wall
  || LADDERS.some((L) => (i === L.a[0] && j === L.a[1]) || (i === L.b[0] && j === L.b[1]));
// 높이 y 에서 트리 겉면까지의 반지름 (층이 겹치는 곳은 바깥쪽 층)
export function surfaceR(y) {
  let r = 0;
  for (const t of TREE.tiers) if (y >= t.y0 && y <= t.y0 + t.h) r = Math.max(r, t.r * (1 - (y - t.y0) / t.h));
  return r;
}

function buildTree(scene) {
  const g = new THREE.Group(), cones = [];
  scene.add(g);
  put(cyl(0.36, 0.3, 0.3, 14), C.pot, 0, 0.15, 0, g);
  put(cyl(0.39, 0.39, 0.06, 14), C.potRim, 0, 0.31, 0, g);
  put(cyl(0.12, 0.14, 0.5, 10), C.trunk, 0, 0.5, 0, g);
  TREE.tiers.forEach((t, k) => {
    const m = put(new THREE.ConeGeometry(t.r, t.h, 11, 1), M(k % 2 ? C.pine2 : C.pine, true), 0, t.y0 + t.h / 2, 0, g);
    m.rotation.y = k * 0.5;
    cones.push(m);
  });
  return { g, cones };
}

// 방 사이 벽: 벽 줄을 따라 이어진 칸끼리 한 토막으로 만든다. 낮은 부분은 늘 보이고, 윗부분은 1인칭에서만 보인다.
function innerWalls(scene, mats) {
  const T = 0.16, tops = [];
  const seg = (xa, xb, za, zb) => { // 바닥에서 본 네모 (xa~xb, za~zb) 자리에 벽 한 토막
    const lx = xb - xa, lz = zb - za, x = (xa + xb) / 2, z = (za + zb) / 2;
    put(rbox(lx, LOW_H, lz, 0.03), mats.wall, x, LOW_H / 2, z, scene);
    put(new THREE.BoxGeometry(lx + 0.02, 0.06, lz + 0.02), C.base, x, LOW_H + 0.03, z, scene, false);
    const top = put(new THREE.BoxGeometry(lx, WALL_H - LOW_H - 0.06, lz), mats.wall, x, (WALL_H + LOW_H + 0.06) / 2, z, scene, false);
    top.visible = false; tops.push(top);
  };
  // i 줄 (거실과 동쪽 방들 사이): j 를 따라 벽인 칸을 묶는다
  const xi = X0 + (PLAN.wallI + 0.5) * CELL;
  for (let j = 0; j < NZ;) {
    if (!wallCell(PLAN.wallI, j)) { j++; continue; }
    let k = j; while (k < NZ && wallCell(PLAN.wallI, k)) k++;
    seg(xi - T / 2, xi + T / 2, Z0 + j * CELL, Z0 + k * CELL);
    j = k;
  }
  // j 줄 (주방과 방 사이). 첫 토막은 i 줄 벽에 붙인다
  const zj = Z0 + (PLAN.wallJ + 0.5) * CELL;
  for (let i = PLAN.wallI + 1; i < NX;) {
    if (!wallCell(i, PLAN.wallJ)) { i++; continue; }
    let k = i; while (k < NX && wallCell(k, PLAN.wallJ)) k++;
    seg(i === PLAN.wallI + 1 ? xi : X0 + i * CELL, X0 + k * CELL, zj - T / 2, zj + T / 2);
    i = k;
  }
  return tops;
}

// 방으로 들어가는 미닫이문. 사람이 다가오면 벽을 따라 옆으로 밀려 열린다.
// 방 사이 벽처럼 낮은 부분은 늘 보이고, 문짝 윗부분과 문 위의 벽은 1인칭에서만 보인다(tops 에 넣는다).
// along = 'z' (i 줄 벽에 난 문: z 를 따라 놓인다) | 'x' (j 줄 벽에 난 문). a0 ~ a1 = 문이 뚫린 범위, fix = 벽 가운데의 자리
const DOOR_H = 2.02, DOOR_NEAR = 1.35; // 문 높이, 문이 열리는 거리(문 한가운데에서)
function slidingDoor(scene, tops, mats, along, a0, a1, fix) {
  const T = 0.16, len = a1 - a0, mid = (a0 + a1) / 2;
  const g = new THREE.Group(), leaf = new THREE.Group();
  // 묶음 안에서는 문이 x 를 따라 놓이고 +x 쪽으로 열린다. side = 방 안쪽이 묶음의 어느 쪽(z)인지
  const side = along === 'z' ? -1 : 1;
  g.position.set(along === 'z' ? fix : mid, 0, along === 'z' ? mid : fix);
  if (along === 'z') g.rotation.y = -Math.PI / 2;
  scene.add(g);
  const eyeOnly = (m) => { m.visible = false; tops.push(m); return m; };
  // 문틀: 양쪽 기둥과 위쪽 가로대, 문 위의 벽
  for (const s of [-1, 1]) {
    put(new THREE.BoxGeometry(0.06, LOW_H + 0.06, T + 0.04), C.frame, s * (len / 2 - 0.03), (LOW_H + 0.06) / 2, 0, g);
    eyeOnly(put(new THREE.BoxGeometry(0.06, DOOR_H - LOW_H - 0.06, T + 0.04), C.frame, s * (len / 2 - 0.03), (DOOR_H + LOW_H + 0.06) / 2, 0, g, false));
  }
  eyeOnly(put(new THREE.BoxGeometry(len, 0.07, T + 0.04), C.frame, 0, DOOR_H + 0.035, 0, g, false));
  eyeOnly(put(new THREE.BoxGeometry(len, WALL_H - DOOR_H - 0.07, T), mats.wall, 0, (WALL_H + DOOR_H + 0.07) / 2, 0, g, false));
  // 문짝이 다니는 길 (문 자리와 열렸을 때의 자리)
  const z = side * (T / 2 + 0.035);
  put(new THREE.BoxGeometry(len * 2, 0.012, 0.07), C.base, len / 2, 0.006, z, g, false);
  // 문짝: 아랫부분(늘 보임)과 윗부분(1인칭에서만)
  leaf.position.z = z; g.add(leaf);
  const w = len - 0.08, paper = new THREE.MeshBasicMaterial({ color: 0xEADDC4 }); // 창호지는 빛을 머금은 듯 밝게
  put(rbox(w, LOW_H - 0.03, 0.05, 0.015), C.door, 0, 0.015 + (LOW_H - 0.03) / 2, 0, leaf);
  put(new THREE.BoxGeometry(w - 0.24, LOW_H - 0.3, 0.056), 0xBE8A5C, 0, 0.5, 0, leaf, false);            // 아래 널판
  put(new THREE.BoxGeometry(w, 0.05, 0.07), C.frame, 0, LOW_H + 0.01, 0, leaf, false);                    // 가운데 띠
  for (const s of [-1, 1]) put(new THREE.BoxGeometry(0.03, 0.2, 0.02), C.knob, -w / 2 + 0.1, 0.78, s * 0.034, leaf, false); // 손잡이
  eyeOnly(put(rbox(w, DOOR_H - LOW_H - 0.05, 0.05, 0.015), C.door, 0, (DOOR_H + LOW_H) / 2 + 0.01, 0, leaf, false));
  eyeOnly(put(new THREE.BoxGeometry(w - 0.24, DOOR_H - LOW_H - 0.3, 0.056), paper, 0, (DOOR_H + LOW_H) / 2 + 0.01, 0, leaf, false)); // 창호지
  for (const k of [-1, 0, 1]) eyeOnly(put(new THREE.BoxGeometry(0.025, DOOR_H - LOW_H - 0.3, 0.06), C.frame, k * (w - 0.24) / 3, (DOOR_H + LOW_H) / 2 + 0.01, 0, leaf, false));
  eyeOnly(put(new THREE.BoxGeometry(w - 0.24, 0.025, 0.06), C.frame, 0, (DOOR_H + LOW_H) / 2 + 0.01, 0, leaf, false));
  // cx, cz = 문 한가운데(방 안 좌표). open = 0(닫힘) ~ 1(다 열림)
  return { leaf, len, cx: along === 'z' ? fix : mid, cz: along === 'z' ? mid : fix, open: 0, set(o) { leaf.position.x = o * len; } };
}

// 마당: 눈 쌓인 땅, 현관에서 대문까지의 디딤돌, 울타리와 대문, 나무 두 그루, 가로등
const SNOW = 0xF2F6FB;
function pine(g, x, z, s) {
  put(cyl(0.09 * s, 0.11 * s, 0.4 * s, 8), C.trunk, x, 0.2 * s, z, g);
  put(new THREE.ConeGeometry(0.62 * s, 1.0 * s, 9), M(C.pine, true), x, 0.85 * s, z, g);
  put(new THREE.ConeGeometry(0.46 * s, 0.85 * s, 9), M(C.pine2, true), x, 1.42 * s, z, g);
  put(new THREE.ConeGeometry(0.25 * s, 0.3 * s, 9), SNOW, x, 1.8 * s, z, g, false);
}
function buildYard(scene) {
  const g = new THREE.Group(); scene.add(g);
  const xa = X0 - 0.3, xb = X1 + 0.3, za = Z1 + 0.14, zb = GZ1 + 0.3, W = xb - xa, cx = (xa + xb) / 2;
  // 따뜻한 조명 아래에서도 눈이 하얗게 보이도록 푸른빛을 조금 스스로 낸다
  const snow = new THREE.MeshLambertMaterial({ color: 0xE6EEFF, emissive: 0x1C2A44 });
  put(new THREE.BoxGeometry(W, 0.2, zb - za), snow, cx, -0.1, (za + zb) / 2, g, false);
  // 집 벽 밑에 쌓인 눈 (벽 줄은 걸어갈 수 없다). 현관 앞만 비어 있다
  const zs = Z1 + 0.14 + 0.17;
  for (const [a, b] of [[xa + 0.05, FRONT.x - FRONT.w / 2 - 0.08], [FRONT.x + FRONT.w / 2 + 0.08, xb - 0.05]]) put(rbox(b - a, 0.3, 0.36, 0.12), snow, (a + b) / 2, 0.06, zs, g);
  put(new THREE.BoxGeometry(0.84, 0.03, 0.44), 0x9C4A3A, FRONT.x, 0.015, Z1 + 0.42, g, false); // 발판
  for (let z = Z1 + 1.05, k = 0; z < GZ1 - 0.1; z += 0.72, k++) put(cyl(0.26, 0.28, 0.03, 12), 0xC9C2B8, FRONT.x + (k % 2 ? 0.07 : -0.07), 0.016, z, g, false); // 디딤돌
  // 울타리: 서·동·남쪽. 남쪽은 현관 맞은편에 대문 자리를 비운다
  const post = (x, z, h = 0.62) => put(new THREE.BoxGeometry(0.08, h, 0.08), C.white, x, h / 2, z, g, false);
  const rail = (x0, z0, x1, z1) => { for (const y of [0.22, 0.48]) put(new THREE.BoxGeometry(Math.abs(x1 - x0) + 0.05, 0.05, Math.abs(z1 - z0) + 0.05), C.white, (x0 + x1) / 2, y, (z0 + z1) / 2, g, false); };
  const fx0 = xa + 0.1, fx1 = xb - 0.1, fz0 = Z1 + 0.5, fz1 = zb - 0.1, gate = [FRONT.x - 0.65, FRONT.x + 0.65];
  for (const x of [fx0, fx1]) { for (let z = fz0; z <= fz1 + 1e-3; z += 0.6) post(x, z); rail(x, fz0, x, fz1); }
  for (let x = fx0 + 0.6; x < fx1 - 0.3; x += 0.6) if (x < gate[0] - 0.2 || x > gate[1] + 0.2) post(x, fz1);
  rail(fx0, fz1, gate[0], fz1); rail(gate[1], fz1, fx1, fz1);
  for (const x of gate) { post(x, fz1, 0.95); put(ball(0.09, 10, 8), SNOW, x, 0.98, fz1, g, false); } // 대문 기둥
  for (const [i, j] of YARD_TREES) pine(g, X0 + (i + 1) * CELL, Z0 + (j + 1) * CELL, 1.25);
  // 가로등
  const [lx, lz] = centerOf(YARD_LAMP[0], YARD_LAMP[1]);
  put(cyl(0.1, 0.13, 0.08, 10), 0x2B2420, lx, 0.04, lz, g);
  put(cyl(0.025, 0.035, 1.7, 8), 0x2B2420, lx, 0.9, lz, g);
  put(ball(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: 0xFFE2A8 }), lx, 1.82, lz, g, false);
  put(new THREE.ConeGeometry(0.17, 0.12, 10), 0x2B2420, lx, 1.98, lz, g, false);
  return g;
}

// 사다리 하나: 아래층 바닥(묶음의 y = 0)에서 위층 바닥까지, 손잡이는 조금 더 위로. 위층의 구멍 서쪽 끝에 기댄다
function ladder(parent, L) {
  const lad = new THREE.Group(), run = 0.34, lean = Math.atan(run / FLOOR_H), len = FLOOR_H / Math.cos(lean) + 0.55;
  lad.position.set(X0 + L.top[0] * CELL - run, 0, Z0 + (L.foot[1] + 0.5) * CELL); lad.rotation.z = -lean;
  parent.add(lad);
  for (const s of [-1, 1]) put(new THREE.BoxGeometry(0.05, len, 0.05), C.frame, 0, len / 2, s * 0.2, lad);
  for (let h = 0.3; h < len - 0.6; h += 0.3) put(cyl(0.018, 0.018, 0.4, 6), C.door, 0, h, 0, lad, false).rotation.x = Math.PI / 2;
  return lad;
}
// 위층 하나(lv = 1: 2층, 2: 3층): 마루, 바깥 벽 네 면과 창, 아래층에서 올라오는 구멍, 다음 층으로 가는 사다리, 천장
function buildUpper(scene, lv, mats, floorMat) {
  const W = X1 - X0, D = Z1 - Z0, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const g = new THREE.Group();
  g.position.y = lv * FLOOR_H; g.visible = false;
  scene.add(g);
  put(rbox(W + 0.5, 0.24, D + 0.5, 0.08), C.slab, cx, -0.13, cz, g);
  put(new THREE.BoxGeometry(W, 0.02, D), floorMat, cx, -0.005, cz, g, false);
  const walls = { n: wall(g, 'n', mats), s: wall(g, 's', mats), w: wall(g, 'w', mats), e: wall(g, 'e', mats) };
  for (const v of lv === 1 ? [-2.4, 1.2, 4.8, 8.6] : [-1.2, 3.6, 8.4]) windowOn(walls.n, v);
  for (const v of lv === 1 ? [-2.4, 2.4] : [0.4]) windowOn(walls.w, v);
  windowOn(walls.e, -1.9); windowOn(walls.e, 2.6);
  windowOn(walls.s, -1.6); windowOn(walls.s, 6.2); pictureOn(walls.s, 2.4);
  if (lv === 2) { wreathOn(walls.n, 1.2); pictureOn(walls.w, -2.2); pictureOn(walls.w, 3.0); }
  // 아래층에서 올라오는 구멍과 그 위로 나온 사다리 손잡이
  const dn = LADDERS[lv - 1], hx = X0 + (dn.foot[0] + 0.5) * CELL, hz = Z0 + (dn.foot[1] + 0.5) * CELL;
  put(new THREE.BoxGeometry(CELL, 0.012, CELL), new THREE.MeshBasicMaterial({ color: 0x2B2420 }), hx, 0.012, hz, g, false);
  for (const s of [-1, 1]) {
    put(new THREE.BoxGeometry(CELL + 0.08, 0.05, 0.05), C.base, hx, 0.03, hz + s * (CELL / 2 + 0.01), g, false);
    put(new THREE.BoxGeometry(0.05, 0.5, 0.05), C.frame, hx + CELL / 2 - 0.08, 0.25, hz + s * 0.2, g, false).rotation.z = -0.12;
  }
  put(new THREE.BoxGeometry(0.05, 0.05, CELL + 0.08), C.base, hx - CELL / 2 - 0.01, 0.03, hz, g, false);
  if (lv < LEVELS - 1) ladder(g, LADDERS[lv]);
  const ceil = put(new THREE.PlaneGeometry(W + 0.3, D + 0.3), new THREE.MeshLambertMaterial({ color: 0xFFF6E6 }), cx, WALL_H, cz, g, false);
  ceil.rotation.x = Math.PI / 2; ceil.receiveShadow = false; ceil.visible = false;
  return { g, walls, ceil };
}

export function buildRoom(world) {
  const scene = new THREE.Group(); // 1층과 마당의 묶음
  world.add(scene);
  const W = X1 - X0, D = Z1 - Z0, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const xw = X0 + PLAN.wallI * CELL;             // 거실 바닥이 끝나는 곳 (벽 줄의 서쪽 모서리)
  const zw = Z0 + (PLAN.wallJ + 0.5) * CELL;     // 주방과 방의 바닥이 갈리는 곳 (벽 줄 가운데)
  // 바닥: 밑판, 거실 마루(바꿀 수 있다), 주방 타일, 방 카펫
  put(rbox(W + 0.5, 0.24, D + 0.5, 0.08), C.slab, cx, -0.13, cz, scene);
  const lw = xw - X0, wood = (tones) => floorTexture(tones, lw / 3, D / 3);
  const floorMat = new THREE.MeshLambertMaterial({ map: wood(FLOORS[0].tones) });
  put(new THREE.BoxGeometry(lw, 0.02, D), floorMat, X0 + lw / 2, -0.005, cz, scene, false);
  const ew = X1 - xw;
  put(new THREE.BoxGeometry(ew, 0.02, zw - Z0), new THREE.MeshLambertMaterial({ map: tileTexture('#F4EDE0', '#CFE0D4', ew, zw - Z0) }), xw + ew / 2, -0.005, (Z0 + zw) / 2, scene, false);
  put(new THREE.BoxGeometry(ew, 0.02, Z1 - zw), new THREE.MeshLambertMaterial({ color: 0xC9B8D6 }), xw + ew / 2, -0.005, (zw + Z1) / 2, scene, false);

  // 트리 밑 러그
  put(cyl(1.75, 1.75, 0.02, 40), C.rug, 0, 0.012, 0, scene, false);
  put(cyl(1.5, 1.5, 0.022, 40), C.rugIn, 0, 0.013, 0, scene, false);
  put(cyl(1.38, 1.38, 0.024, 40), C.rug, 0, 0.014, 0, scene, false);

  // 벽 (벽지를 바꿀 수 있게 재질을 따로 둔다)
  const mats = { wall: new THREE.MeshLambertMaterial({ color: WALLS[0].wall }), panel: new THREE.MeshLambertMaterial({ color: WALLS[0].panel }) };
  const walls = { n: wall(scene, 'n', mats), s: wall(scene, 's', mats, [FRONT.x - FRONT.w / 2, FRONT.x + FRONT.w / 2]), w: wall(scene, 'w', mats), e: wall(scene, 'e', mats) };
  // 거실
  windowOn(walls.n, -2.1); windowOn(walls.n, 0.3); wreathOn(walls.n, 2.6); pictureOn(walls.n, 4.6);
  windowOn(walls.w, -1.9); pictureOn(walls.w, 0.2); pictureOn(walls.w, 2.4);
  pictureOn(walls.s, 1.2); windowOn(walls.s, 3.8);
  // 주방과 방
  windowOn(walls.n, 8.6); windowOn(walls.e, -1.9);
  windowOn(walls.s, 8.6); pictureOn(walls.e, 3.0);
  const inner = innerWalls(scene, mats);
  // 방(침실)의 문 두 곳: 거실 쪽, 주방 쪽
  const [dj0, dj1] = PLAN.doorsI[1], [di0, di1] = PLAN.doorsJ[0];
  const doors = [
    slidingDoor(scene, inner, mats, 'z', Z0 + dj0 * CELL, Z0 + (dj1 + 1) * CELL, X0 + (PLAN.wallI + 0.5) * CELL),
    slidingDoor(scene, inner, mats, 'x', X0 + di0 * CELL, X0 + (di1 + 1) * CELL, Z0 + (PLAN.wallJ + 0.5) * CELL),
    frontDoor(walls.s), // 현관문 (마당으로)
  ];
  buildYard(scene);
  ladder(scene, LADDERS[0]);

  const tree = buildTree(scene);
  let floorId = FLOORS[0].id;
  // 천장: 내려다볼 때는 없고, 1인칭으로 볼 때만 보인다. 사다리가 올라가는 자리에는 구멍이 보인다
  const ceil = put(new THREE.PlaneGeometry(W + 0.3, D + 0.3), new THREE.MeshLambertMaterial({ color: 0xFFF6E6 }), cx, WALL_H, cz, scene, false);
  ceil.rotation.x = Math.PI / 2; ceil.receiveShadow = false; ceil.visible = false;
  const hole = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(CELL + 0.1, CELL + 0.1), new THREE.MeshBasicMaterial({ color: 0x2B2420 })); m.position.z = 0.004; return m; };
  { const h = hole(), L = LADDERS[0]; h.position.x = X0 + (L.foot[0] + 0.5) * CELL - cx; h.position.y = Z0 + (L.foot[1] + 0.5) * CELL - cz; ceil.add(h); }
  // 위층들 (바닥재는 1층 거실과 같이 바뀐다)
  const upMat = new THREE.MeshLambertMaterial({ map: floorTexture(FLOORS[0].tones, W / 3, D / 3) });
  const floors = [{ g: scene, walls, ceil }];
  for (let lv = 1; lv < LEVELS; lv++) {
    const f = buildUpper(world, lv, mats, upMat);
    if (lv < LEVELS - 1) { const h = hole(), L = LADDERS[lv]; h.position.x = X0 + (L.foot[0] + 0.5) * CELL - cx; h.position.y = Z0 + (L.foot[1] + 0.5) * CELL - cz; f.ceil.add(h); }
    floors.push(f);
  }
  return {
    ceil, walls, inner, tree: tree.g, cones: tree.cones, doors, floors, g0: scene,
    // 층 lv 만 보이게 한다 (0 = 1층과 마당)
    showFloor(lv) { floors.forEach((f, k) => { f.g.visible = k === lv; }); },
    // 문을 움직인다. people = 방에 있는 사람들({ x, z }). 가까이(NEAR 안에) 누가 있으면 열리고, 없으면 닫힌다. 움직였으면 true
    tickDoors(dt, people) {
      let moved = false;
      for (const d of doors) {
        const want = people.some((p) => Math.hypot(p.x - d.cx, p.z - d.cz) < DOOR_NEAR) ? 1 : 0;
        if (d.open === want) continue;
        d.open += (want - d.open) * Math.min(1, dt * 10);
        if (Math.abs(want - d.open) < 0.004) d.open = want;
        d.set(d.open);
        moved = true;
      }
      return moved;
    },
    setWall(id) { const w = WALLS.find((x) => x.id === id) || WALLS[0]; mats.wall.color.setHex(w.wall); mats.panel.color.setHex(w.panel); },
    setFloor(id) {
      const f = FLOORS.find((x) => x.id === id) || FLOORS[0];
      if (f.id === floorId) return;
      floorId = f.id;
      for (const [m, tex] of [[floorMat, wood(f.tones)], [upMat, floorTexture(f.tones, W / 3, D / 3)]]) { const old = m.map; m.map = tex; m.needsUpdate = true; if (old) old.dispose(); }
    },
  };
}
