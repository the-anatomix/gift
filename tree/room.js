// 거실: 바닥, 벽 네 면, 창, 가운데 트리. 벽은 카메라 쪽 두 면을 숨길 수 있게 따로 묶는다.
import { THREE, M, put, rbox, cyl, ball } from './kit.js';
import { N, CELL, HALF, cellOf } from './path.js';

export const WALL_H = 2.7;
export const C = {
  slab: 0xB98F66, wall: 0xF3E6D0, panel: 0xD8BE9A, base: 0x8A5F3F, white: 0xFFF8EA,
  rug: 0xC8443A, rugIn: 0xF3E2C3, night: 0x27335E, moon: 0xFFF2C2,
  pine: 0x2F7D56, pine2: 0x3A9163, trunk: 0x7A5137, pot: 0xC8443A, potRim: 0xF3E2C3,
  door: 0xA8754B, knob: 0xE7B441, frame: 0x7A5137,
};

// 나무 마루 무늬 (그림 한 장을 그려서 바닥에 입힌다)
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const tones = ['#D9B285', '#D2A978', '#DDB98E', '#CDA472'];
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
  return t;
}

// 벽 한 면. 아래 턱(항상 보임)과 위쪽(숨길 수 있음)으로 나눈다.
// side: 'n'(z = -HALF) 's'(z = +HALF) 'w'(x = -HALF) 'e'(x = +HALF)
function wall(scene, side) {
  const T = 0.14, L = N * CELL + T * 2;
  const g = new THREE.Group(), upper = new THREE.Group();
  g.add(upper); scene.add(g);
  const off = HALF + T / 2;
  if (side === 'n') g.position.z = -off;
  if (side === 's') { g.position.z = off; g.rotation.y = Math.PI; }
  if (side === 'w') { g.position.x = -off; g.rotation.y = Math.PI / 2; }
  if (side === 'e') { g.position.x = off; g.rotation.y = -Math.PI / 2; }
  // 벽 안쪽 면이 +z 를 보도록 만든다
  put(rbox(L, 0.16, T, 0.03), C.base, 0, 0.08, 0, g);
  put(rbox(L, WALL_H - 0.16, T, 0.04), C.wall, 0, 0.16 + (WALL_H - 0.16) / 2, 0, upper);
  put(new THREE.BoxGeometry(L - T * 2, 0.62, 0.03), C.panel, 0, 0.16 + 0.31, T / 2, upper, false);
  put(new THREE.BoxGeometry(L - T * 2, 0.05, 0.05), C.base, 0, 0.8, T / 2 + 0.01, upper, false);
  return { g, upper, front: T / 2 };
}

function windowOn(w, x) {
  const z = w.front;
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

function wreathOn(w, x) {
  const z = w.front + 0.06;
  const ring = put(new THREE.TorusGeometry(0.3, 0.1, 8, 16), M(C.pine, true), x, 1.7, z, w.upper);
  ring.scale.z = 0.6;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    put(ball(0.045, 10, 8), C.pot, x + Math.cos(a) * 0.3, 1.7 + Math.sin(a) * 0.3, z + 0.07, w.upper, false);
  }
  put(rbox(0.26, 0.12, 0.06, 0.03), C.pot, x, 1.42, z + 0.07, w.upper, false);
}

function doorOn(w, x) {
  const z = w.front;
  put(rbox(1.06, 2.02, 0.06, 0.03), C.frame, x, 1.17, z, w.upper);
  put(rbox(0.9, 1.9, 0.06, 0.03), C.door, x, 1.13, z + 0.03, w.upper);
  put(ball(0.05, 10, 8), C.knob, x + 0.32, 1.1, z + 0.09, w.upper, false);
}

function pictureOn(w, x) {
  const z = w.front;
  put(rbox(0.9, 0.7, 0.05, 0.02), C.frame, x, 1.7, z + 0.02, w.upper);
  put(new THREE.BoxGeometry(0.76, 0.56, 0.02), new THREE.MeshBasicMaterial({ color: 0xDCEBE3 }), x, 1.7, z + 0.05, w.upper, false);
  const hill = put(new THREE.CircleGeometry(0.3, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xFFFFFF }), x - 0.08, 1.42, z + 0.062, w.upper, false);
  hill.scale.set(1.2, 0.7, 1);
  put(new THREE.CircleGeometry(0.12, 3), new THREE.MeshBasicMaterial({ color: C.pine }), x + 0.2, 1.62, z + 0.064, w.upper, false).rotation.z = Math.PI / 2;
}

// 트리. 장식을 달 때 쓸 수 있게 층마다 치수를 남긴다.
export const TREE = {
  tiers: [ // y0 = 층 아랫면 높이, r = 아랫면 반지름, h = 층 높이
    { y0: 0.42, r: 1.08, h: 1.0 },
    { y0: 1.0, r: 0.88, h: 0.9 },
    { y0: 1.52, r: 0.66, h: 0.8 },
    { y0: 1.98, r: 0.44, h: 0.7 },
  ],
  top: 2.68,
  reach: 1.15, // 이 반지름 안의 바닥 칸은 걸어 들어갈 수 없다
};

function buildTree(scene) {
  const g = new THREE.Group();
  scene.add(g);
  put(cyl(0.36, 0.3, 0.3, 14), C.pot, 0, 0.15, 0, g);
  put(cyl(0.39, 0.39, 0.06, 14), C.potRim, 0, 0.31, 0, g);
  put(cyl(0.12, 0.14, 0.5, 10), C.trunk, 0, 0.5, 0, g);
  TREE.tiers.forEach((t, k) => {
    const m = put(new THREE.ConeGeometry(t.r, t.h, 11, 1), M(k % 2 ? C.pine2 : C.pine, true), 0, t.y0 + t.h / 2, 0, g);
    m.rotation.y = k * 0.5;
  });
  return g;
}

export function buildRoom(scene, grid) {
  // 바닥
  put(rbox(N * CELL + 0.5, 0.24, N * CELL + 0.5, 0.08), C.slab, 0, -0.13, 0, scene);
  const tex = floorTexture();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(N * CELL / 3, N * CELL / 3);
  const floor = put(new THREE.BoxGeometry(N * CELL, 0.02, N * CELL), new THREE.MeshLambertMaterial({ map: tex }), 0, -0.005, 0, scene, false);

  // 러그
  put(cyl(1.75, 1.75, 0.02, 40), C.rug, 0, 0.012, 0, scene, false);
  put(cyl(1.5, 1.5, 0.022, 40), C.rugIn, 0, 0.013, 0, scene, false);
  put(cyl(1.38, 1.38, 0.024, 40), C.rug, 0, 0.014, 0, scene, false);

  // 벽
  const walls = { n: wall(scene, 'n'), s: wall(scene, 's'), w: wall(scene, 'w'), e: wall(scene, 'e') };
  windowOn(walls.n, -2.1);
  windowOn(walls.n, 0.3);
  wreathOn(walls.n, 2.6);
  windowOn(walls.w, 1.9);
  pictureOn(walls.w, -0.2);
  pictureOn(walls.w, -2.4);
  doorOn(walls.s, 2.2);
  pictureOn(walls.s, -1.2);
  windowOn(walls.e, -1.6);
  pictureOn(walls.e, 1.4);

  // 트리와 그 자리(걸어 들어갈 수 없는 칸)
  const tree = buildTree(scene);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -HALF + (i + 0.5) * CELL, z = -HALF + (j + 0.5) * CELL;
    if (Math.hypot(x, z) < TREE.reach) grid.block(i, j);
  }
  return { walls, tree, floor, cellOf };
}
