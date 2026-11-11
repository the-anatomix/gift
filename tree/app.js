// 놀자방 · 트리 같이 꾸미기
// 1단계: 거실, 비스듬히 내려다보는 카메라, 아바타 걷기. 정적 파일만 쓴다.
import { THREE } from './kit.js';
import { Grid, HALF, N, CELL } from './path.js';
import { buildRoom, WALL_H, TREE } from './room.js';
import { makeAvatar, BODY_R } from './avatar.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');

/* ───────── 렌더러 ───────── */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
} catch (e) {
  window.__fallback();
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // 무언가 움직였을 때만 그림자를 다시 그린다

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);

/* ───────── 조명: 따뜻한 저녁 거실 ───────── */
scene.add(new THREE.HemisphereLight(0xFFEFD8, 0xB98F66, 1.35));
const sun = new THREE.DirectionalLight(0xFFDDB0, 1.9);
sun.position.set(2.5, 8, 4.5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
const SH = HALF + 1.2;
sun.shadow.camera.left = -SH; sun.shadow.camera.right = SH; sun.shadow.camera.top = SH; sun.shadow.camera.bottom = -SH;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 20;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
scene.add(sun);
const glow = new THREE.PointLight(0xFFC27A, 2.2, 6, 1.6); // 트리 둘레의 은은한 빛
glow.position.set(0, 1.3, 0);
scene.add(glow);

/* ───────── 방과 아바타 ───────── */
const grid = new Grid();
const room = buildRoom(scene, grid);
const me = makeAvatar();
me.place(1.75, 1.75);
me.turnTo(1, 1); me.root.rotation.y = me.face; // 처음에는 화면 쪽을 본다
me.mark(true);
scene.add(me.root);

// 누른 자리 표시
const pin = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 24), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0 }));
pin.rotation.x = -Math.PI / 2; pin.position.y = 0.03;
scene.add(pin);
let pinT = 0;

/* ───────── 카메라: 네 방향 중 하나에서 비스듬히 ───────── */
const ELEV = 0.62;               // 내려다보는 각도 (라디안)
const LOOK_Y = 0.95;
let yawK = 0;                    // 0~3, 90도씩
let yaw = Math.PI / 4;           // 지금 각도 (돌릴 때 부드럽게 따라간다)
const yawOf = (k) => Math.PI / 4 + k * Math.PI / 2;
let fit = { s: 0.02, cu: 0, cv: 0 };

function aimCamera(a) {
  const ch = Math.cos(ELEV);
  camera.position.set(Math.sin(a) * ch * 30, LOOK_Y + Math.sin(ELEV) * 30, Math.cos(a) * ch * 30);
  camera.lookAt(0, LOOK_Y, 0);
  camera.updateMatrixWorld();
}

// 방 전체가 위 막대와 아래 판 사이에 들어오도록 크기를 맞춘다
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  aimCamera(yawOf(0));
  const right = new THREE.Vector3(), up = new THREE.Vector3(), p = new THREE.Vector3();
  camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  const E = HALF + 0.3;
  for (const x of [-E, E]) for (const z of [-E, E]) for (const y of [-0.25, Math.max(WALL_H, TREE.top) + 0.15]) {
    p.set(x, y, z).sub(camera.position);
    const u = p.dot(right), v = p.dot(up);
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  const top = $('top').getBoundingClientRect().bottom + 6;
  const bottom = h - $('bottom').getBoundingClientRect().top + 6;
  const side = 6;
  const s = Math.max((u1 - u0) / Math.max(60, w - side * 2), (v1 - v0) / Math.max(60, h - top - bottom));
  fit = { s, cu: (u0 + u1) / 2, cv: (v0 + v1) / 2 + s * (top - bottom) / 2 };
  camera.left = fit.cu - s * w / 2; camera.right = fit.cu + s * w / 2;
  camera.top = fit.cv + s * h / 2; camera.bottom = fit.cv - s * h / 2;
  camera.updateProjectionMatrix();
  aimCamera(yaw);
  dirty = true;
}

// 카메라 쪽 벽 두 면은 숨긴다
function showWalls() {
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  room.walls.w.upper.visible = dx > 0.02;
  room.walls.e.upper.visible = dx < -0.02;
  room.walls.n.upper.visible = dz > 0.02;
  room.walls.s.upper.visible = dz < -0.02;
}

function turnView(dir = 1) {
  yawK = (yawK + dir + 4) % 4;
  toast(['앞에서', '오른쪽에서', '뒤에서', '왼쪽에서'][yawK] + ' 보는 중');
}

/* ───────── 걷기 ───────── */
let dirty = true; // 그림자를 다시 그려야 하는지
function goTo(x, z) {
  const pts = grid.route(me.x, me.z, x, z);
  if (!pts || !pts.length) return false;
  me.walk(pts);
  const [tx, tz] = pts[pts.length - 1];
  pin.position.x = tx; pin.position.z = tz; pinT = 1;
  return true;
}

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
function floorAt(px, py) {
  ndc.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(ground, hit)) return null;
  if (Math.abs(hit.x) > HALF || Math.abs(hit.z) > HALF) return null;
  return { x: hit.x, z: hit.z };
}
function screenOf(x, z, y = 0) {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight };
}

// 누르기: 손가락을 거의 움직이지 않고 뗐을 때만 걷는다
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || down.id !== e.pointerId) return;
  const far = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10;
  down = null;
  if (far) return;
  const p = floorAt(e.clientX, e.clientY);
  if (p) goTo(p.x, p.z);
});
canvas.addEventListener('pointercancel', () => { down = null; });

// 키보드: 방향키·WASD 는 화면 기준으로 걷는다
const keys = new Set();
const KEY = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (KEY[e.code]) { keys.add(KEY[e.code]); e.preventDefault(); }
  else if (e.code === 'KeyQ') turnView(-1);
  else if (e.code === 'KeyE') turnView(1);
});
addEventListener('keyup', (e) => { if (KEY[e.code]) keys.delete(KEY[e.code]); });
addEventListener('blur', () => keys.clear());

function keyWalk(dt) {
  const f = (keys.has('u') ? 1 : 0) - (keys.has('d') ? 1 : 0), r = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
  if (!f && !r) return false;
  me.stop(); pinT = Math.min(pinT, 0.2);
  // 화면 위쪽 = 카메라가 보는 쪽, 화면 오른쪽 = 그 오른쪽
  let dx = -Math.sin(yaw) * f + Math.cos(yaw) * r, dz = -Math.cos(yaw) * f - Math.sin(yaw) * r;
  const len = Math.hypot(dx, dz); dx /= len; dz /= len;
  me.turnTo(dx, dz);
  const step = 2.3 * dt, lim = HALF - BODY_R;
  const nx = Math.max(-lim, Math.min(lim, me.x + dx * step)), nz = Math.max(-lim, Math.min(lim, me.z + dz * step));
  const ox = me.x, oz = me.z;
  if (grid.fits(nx, nz, BODY_R)) me.place(nx, nz);
  else if (grid.fits(nx, me.z, BODY_R)) me.place(nx, me.z);
  else if (grid.fits(me.x, nz, BODY_R)) me.place(me.x, nz);
  return Math.hypot(me.x - ox, me.z - oz) > 1e-5;
}

/* ───────── 화면 ───────── */
let toastK = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastK); toastK = setTimeout(() => t.classList.remove('on'), 1600);
}
$('turn').addEventListener('click', () => turnView(1));

/* ───────── 느린 기기에서는 화질을 낮춘다 ───────── */
let quality = 'high', slowSum = 0, slowN = 0;
function lowerQuality() {
  if (quality === 'low') return;
  quality = 'low';
  renderer.setPixelRatio(1);
  sun.shadow.mapSize.set(512, 512);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  resize();
}

/* ───────── 그리기 ───────── */
let last = performance.now(), frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = now - last; last = now;
  const dt = Math.min(0.05, raw / 1000);
  if (quality !== 'low' && raw < 250) { slowSum += raw; if (++slowN >= 45) { if (slowSum / slowN > 36) lowerQuality(); slowSum = 0; slowN = 0; } }

  // 카메라 돌리기
  let dy = yawOf(yawK) - yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  if (Math.abs(dy) > 1e-4) { yaw += dy * Math.min(1, dt * 9); if (Math.abs(dy) < 2e-3) yaw = yawOf(yawK); aimCamera(yaw); showWalls(); dirty = true; }

  // 걷기
  const byKey = keyWalk(dt);
  const moved = byKey ? (me.animate(dt, true), true) : me.step(dt);
  if (moved || me.blend > 0.01) dirty = true;

  if (pinT > 0) { pinT = Math.max(0, pinT - dt * (me.path.length ? 0.6 : 3)); pin.material.opacity = Math.min(1, pinT * 1.4) * 0.9; pin.scale.setScalar(1 + (1 - pinT) * 0.5); }

  if (dirty) { renderer.shadowMap.needsUpdate = true; dirty = false; }
  renderer.render(scene, camera);
  frames++;
}

addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
resize(); showWalls();
requestAnimationFrame(frame);
const loading = $('loading');
if (loading) { loading.classList.add('done'); setTimeout(() => loading.remove(), 500); }

// 자동 검사와 다음 단계(가구·둘이 같이)가 쓰는 창구
window.__tree = {
  N, CELL, HALF, grid, me, room, goTo, screenOf, floorAt, turnView, lowerQuality,
  get frames() { return frames; }, get yawK() { return yawK; }, get quality() { return quality; },
  get turning() { return Math.abs(Math.atan2(Math.sin(yawOf(yawK) - yaw), Math.cos(yawOf(yawK) - yaw))) > 1e-3; },
  get walls() { return Object.fromEntries(Object.entries(room.walls).map(([k, w]) => [k, w.upper.visible])); },
};
