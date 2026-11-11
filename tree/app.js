// 놀자방 · 트리 같이 꾸미기
// 1단계: 거실, 비스듬히 내려다보는 카메라, 아바타 걷기와 고르기. 정적 파일만 쓴다.
import { THREE } from './kit.js';
import { Grid, HALF, N, CELL } from './path.js';
import { buildRoom, WALL_H, TREE } from './room.js';
import { makeAvatar, cleanLook, DEFAULT_LOOK, GENDERS, OUTFITS, BODY_R, SPEED } from './avatar.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 90);

/* ───────── 조명: 따뜻한 저녁 거실 ───────── */
scene.add(new THREE.HemisphereLight(0xFFEFD8, 0xB98F66, 1.35));
const sun = new THREE.DirectionalLight(0xFFDDB0, 1.9);
sun.position.set(2.5, 9, 4.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const SH = HALF + 1.2;
sun.shadow.camera.left = -SH; sun.shadow.camera.right = SH; sun.shadow.camera.top = SH; sun.shadow.camera.bottom = -SH;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 22;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
scene.add(sun);
const glow = new THREE.PointLight(0xFFC27A, 2.2, 6, 1.6); // 트리 둘레의 은은한 빛
glow.position.set(0, 1.3, 0);
scene.add(glow);

/* ───────── 내 생김새 (이 기기에 기억해 둔다) ───────── */
const LOOK_KEY = 'nolja-tree-look';
let look = DEFAULT_LOOK, lookSaved = false;
try { const v = JSON.parse(localStorage.getItem(LOOK_KEY)); if (v) { look = cleanLook(v); lookSaved = true; } } catch (_) { /* 저장소를 못 쓰면 기본 생김새 */ }

/* ───────── 방과 아바타 ───────── */
const grid = new Grid();
const room = buildRoom(scene, grid);
const me = makeAvatar(look);
me.place(1.75, 2.25);
me.mark(true);
scene.add(me.root);

// 누른 자리 표시
const pin = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 24), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0 }));
pin.rotation.x = -Math.PI / 2; pin.position.y = 0.035;
scene.add(pin);
let pinT = 0;

/* ───────── 카메라: 네 방향 중 하나에서 비스듬히, 아바타를 따라간다 ───────── */
const ELEV = 0.62;               // 내려다보는 각도 (라디안)
const LOOK_Y = 0.95;
const TARGET_PXU = 58;           // 처음 배율: 방 1 이 화면에서 이만큼(px)은 되게. 방 전체가 이보다 크게 들어오면 전체를 보여 준다
const Z_MAX = 4;                 // 방 전체 보기의 몇 배까지 당길 수 있는지
let yawK = 0;                    // 0~3, 90도씩
let yaw = Math.PI / 4;           // 지금 각도 (돌릴 때 부드럽게 따라간다)
const yawOf = (k) => Math.PI / 4 + k * Math.PI / 2;
let lookOpen = false;            // 캐릭터 고르는 중
// ext: 방 전체가 차지하는 범위(카메라 가로·세로축), sFit: 방 전체가 들어오는 축척(px 당 길이)
const view = { ext: { u0: -1, u1: 1, v0: -1, v1: 1 }, sFit: 0.02, top: 0, bottom: 0, zDef: 1, zMul: 1, z: 1, cu: 0, cv: 0, snap: true };
const vR = new THREE.Vector3(), vU = new THREE.Vector3(), vF = new THREE.Vector3(), vP = new THREE.Vector3();

function aimCamera(a) {
  const ch = Math.cos(ELEV);
  camera.position.set(Math.sin(a) * ch * 34, LOOK_Y + Math.sin(ELEV) * 34, Math.cos(a) * ch * 34);
  camera.lookAt(0, LOOK_Y, 0);
  camera.updateMatrixWorld();
}

// 화면 크기나 아래 판 높이가 바뀌면 다시 잰다
function measure(snap = true) {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  aimCamera(yawOf(0));
  camera.matrixWorld.extractBasis(vR, vU, vF);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  const E = HALF + 0.3;
  for (const x of [-E, E]) for (const z of [-E, E]) for (const y of [-0.25, Math.max(WALL_H, TREE.top) + 0.15]) {
    vP.set(x, y, z).sub(camera.position);
    const u = vP.dot(vR), v = vP.dot(vU);
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  view.ext = { u0, u1, v0, v1 };
  view.top = $('top').getBoundingClientRect().bottom + 6;
  view.bottom = h - $('bottom').getBoundingClientRect().top + 6;
  view.sFit = Math.max((u1 - u0) / Math.max(60, w - 12), (v1 - v0) / Math.max(60, h - view.top - view.bottom));
  view.zDef = clamp(TARGET_PXU * view.sFit, 1, Z_MAX);
  setZoomMul(view.zMul);
  aimCamera(yaw);
  if (snap) view.snap = true;
  updateView(0);
}

function zoomGoal() {
  let z = clamp(view.zDef * view.zMul, 1, Z_MAX);
  if (lookOpen) z = Math.max(z, Math.min(Z_MAX, 105 * view.sFit)); // 고르는 동안은 아바타가 크게 보이게
  return z;
}
function setZoomMul(m) { view.zMul = clamp(m, 1 / view.zDef, Z_MAX / view.zDef); }

// 방이 화면보다 크면 아바타를 따라가고, 화면에 다 들어오면 가운데에 둔다
function updateView(dt) {
  const w = window.innerWidth, h = window.innerHeight, e = view.ext, side = 6;
  const zg = zoomGoal();
  view.z = view.snap ? zg : view.z + (zg - view.z) * Math.min(1, dt * 8);
  if (Math.abs(zg - view.z) < 1e-3) view.z = zg;
  const s = view.sFit / view.z;
  camera.matrixWorld.extractBasis(vR, vU, vF);
  vP.set(me.x, 0.75, me.z).sub(camera.position);
  let cu = vP.dot(vR), cv = vP.dot(vU) + s * (view.top - view.bottom) / 2;
  const lo = e.u0 + s * (w / 2 - side), hi = e.u1 - s * (w / 2 - side);
  cu = lo > hi ? (e.u0 + e.u1) / 2 : clamp(cu, lo, hi);
  const vlo = e.v0 + s * (h / 2 - view.bottom), vhi = e.v1 - s * (h / 2 - view.top);
  cv = vlo > vhi ? (e.v0 + e.v1) / 2 + s * (view.top - view.bottom) / 2 : clamp(cv, vlo, vhi);
  const k = view.snap ? 1 : Math.min(1, dt * 7);
  view.cu += (cu - view.cu) * k; view.cv += (cv - view.cv) * k;
  view.snap = false;
  camera.left = view.cu - s * w / 2; camera.right = view.cu + s * w / 2;
  camera.top = view.cv + s * h / 2; camera.bottom = view.cv - s * h / 2;
  camera.updateProjectionMatrix();
}

// 카메라 쪽 벽 두 면은 숨긴다
function showWalls() {
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  room.walls.w.upper.visible = dx > 0.02;
  room.walls.e.upper.visible = dx < -0.02;
  room.walls.n.upper.visible = dz > 0.02;
  room.walls.s.upper.visible = dz < -0.02;
  dirty = true;
}

function turnView(dir = 1) {
  yawK = (yawK + dir + 4) % 4;
  toast(['앞에서', '오른쪽에서', '뒤에서', '왼쪽에서'][yawK] + ' 보는 중');
}
function zoomBy(f) {
  setZoomMul(view.zMul * f);
  if (f < 1 && zoomGoal() <= 1.001) toast('방 전체 보기');
}
const faceCamera = () => me.turnTo(Math.sin(yawOf(yawK)), Math.cos(yawOf(yawK)));

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

// 누르기: 손가락 하나를 거의 움직이지 않고 뗐을 때만 걷는다. 두 손가락은 크게·작게 보기.
const touches = new Map();
let tap = null, pinch = 0;
const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
canvas.addEventListener('pointerdown', (e) => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 1) tap = { x: e.clientX, y: e.clientY, id: e.pointerId };
  else { tap = null; pinch = touches.size === 2 ? spread() : 0; }
});
canvas.addEventListener('pointermove', (e) => {
  const t = touches.get(e.pointerId);
  if (!t) return;
  t.x = e.clientX; t.y = e.clientY;
  if (touches.size === 2 && pinch > 0) { const d = spread(); if (d > 0) { setZoomMul(view.zMul * d / pinch); pinch = d; } }
});
function lift(e, walk) {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = 0;
  const t = tap;
  if (!t || t.id !== e.pointerId) return;
  tap = null;
  if (!walk || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) return;
  const p = floorAt(e.clientX, e.clientY);
  if (p) goTo(p.x, p.z);
}
canvas.addEventListener('pointerup', (e) => lift(e, true));
canvas.addEventListener('pointercancel', (e) => lift(e, false));
canvas.addEventListener('wheel', (e) => { e.preventDefault(); setZoomMul(view.zMul * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

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
  const step = SPEED * dt, lim = HALF - BODY_R;
  const nx = clamp(me.x + dx * step, -lim, lim), nz = clamp(me.z + dz * step, -lim, lim);
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
$('zin').addEventListener('click', () => zoomBy(1.35));
$('zout').addEventListener('click', () => zoomBy(1 / 1.35));

// 캐릭터 고르기: 누르는 대로 방 안의 아바타가 바뀐다
function chips(box, list, key) {
  for (const it of list) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = it.name; b.dataset.k = key; b.dataset.v = it.id;
    b.addEventListener('click', () => setLook({ [key]: it.id }));
    box.appendChild(b);
  }
}
chips($('pickGender'), GENDERS, 'gender');
chips($('pickOutfit'), OUTFITS, 'outfit');
function paintLook() {
  for (const b of document.querySelectorAll('#look .chip')) b.setAttribute('aria-pressed', String(look[b.dataset.k] === b.dataset.v));
}
function setLook(patch) {
  look = cleanLook({ ...look, ...patch });
  me.setLook(look);
  paintLook();
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch (_) { /* 기억하지 못해도 고른 대로 논다 */ }
  dirty = true;
}
function openLook(on) {
  lookOpen = on;
  $('look').hidden = !on; $('panel').hidden = on;
  if (on) { me.stop(); faceCamera(); paintLook(); }
  else { try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch (_) { /* 무시 */ } }
  measure(false);
}
$('lookOpen').addEventListener('click', () => openLook(true));
$('lookDone').addEventListener('click', () => openLook(false));

/* ───────── 느린 기기에서는 화질을 낮춘다 ───────── */
let quality = 'high', slowSum = 0, slowN = 0;
function lowerQuality() {
  if (quality === 'low') return;
  quality = 'low';
  renderer.setPixelRatio(1);
  sun.shadow.mapSize.set(1024, 1024);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  measure(false);
  dirty = true;
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
  if (Math.abs(dy) > 1e-4) { yaw += dy * Math.min(1, dt * 9); if (Math.abs(dy) < 2e-3) yaw = yawOf(yawK); aimCamera(yaw); showWalls(); }

  // 걷기
  const byKey = keyWalk(dt);
  const moved = byKey ? (me.animate(dt, true), true) : me.step(dt);
  if (moved || me.blend > 0.01) dirty = true;
  updateView(dt);

  if (pinT > 0) { pinT = Math.max(0, pinT - dt * (me.path.length ? 0.6 : 3)); pin.material.opacity = Math.min(1, pinT * 1.4) * 0.9; pin.scale.setScalar(1 + (1 - pinT) * 0.5); }

  if (dirty) { renderer.shadowMap.needsUpdate = true; dirty = false; }
  renderer.render(scene, camera);
  frames++;
}

addEventListener('resize', () => measure());
addEventListener('orientationchange', () => setTimeout(measure, 200));
faceCamera(); me.root.rotation.y = me.face; // 처음에는 화면 쪽을 본다
showWalls();
if (lookSaved) measure(); else openLook(true); // 처음 온 사람은 캐릭터부터 고른다
view.snap = true; updateView(0);
requestAnimationFrame(frame);
const loading = $('loading');
if (loading) { loading.classList.add('done'); setTimeout(() => loading.remove(), 500); }

// 자동 검사와 다음 단계(가구·둘이 같이)가 쓰는 창구
window.__tree = {
  N, CELL, HALF, grid, me, room, goTo, screenOf, floorAt, turnView, lowerQuality, setLook, openLook, zoomBy,
  setZoomMul(m) { setZoomMul(m); },
  get look() { return look; }, get lookOpen() { return lookOpen; },
  get frames() { return frames; }, get yawK() { return yawK; }, get quality() { return quality; },
  get view() { return { z: view.z, goal: zoomGoal(), pxu: view.z / view.sFit, whole: zoomGoal() <= 1.001, top: view.top, bottom: view.bottom, settled: Math.abs(view.z - zoomGoal()) < 1e-3 }; },
  get turning() { return Math.abs(Math.atan2(Math.sin(yawOf(yawK) - yaw), Math.cos(yawOf(yawK) - yaw))) > 1e-3; },
  get walls() { return Object.fromEntries(Object.entries(room.walls).map(([k, w]) => [k, w.upper.visible])); },
};
