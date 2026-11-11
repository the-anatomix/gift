// 놀자방 · 트리 같이 꾸미기
// 1단계: 거실, 비스듬히 내려다보는 카메라, 아바타 걷기와 고르기
// 2단계: 가구 놓기·옮기기, 벽지·바닥, 트리 장식과 전구
// 정적 파일만 쓴다.
import { THREE } from './kit.js';
import { Grid, HALF, N, CELL, cellOf } from './path.js';
import { buildRoom, WALL_H, TREE, treeBlocked, surfaceR } from './room.js';
import { makeAvatar, cleanLook, DEFAULT_LOOK, GENDERS, OUTFITS, BODY_R, SPEED } from './avatar.js';
import { FURNITURE, ORNAMENTS, LIGHT_SETS, BLINKS, WALLS, FLOORS, MAX_ITEMS, MAX_ORNS } from './catalog.js';
import { makeState, apply, canPlace, footprint, cellsOf, kindOf, serialize, ops } from './state.js';
import { buildItem } from './furniture.js';
import { buildOrnament, buildLights } from './decor.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* 기억하지 못해도 논다 */ } },
};

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
const glow = new THREE.PointLight(0xFFC27A, 1.6, 6, 1.6); // 트리 둘레의 은은한 빛. 전구를 켜면 더 밝아진다
glow.position.set(0, 1.3, 0);
scene.add(glow);

/* ───────── 방, 아바타, 방 상태 ───────── */
const LOOK_KEY = 'nolja-tree-look', ROOM_KEY = 'nolja-tree-room';
const savedLook = store.get(LOOK_KEY);
let look = savedLook ? cleanLook(savedLook) : DEFAULT_LOOK;

const grid = new Grid();
const room = buildRoom(scene);
const me = makeAvatar(look);
me.place(1.75, 2.25);
me.mark(true);
scene.add(me.root);

const S = makeState();
const itemsG = new THREE.Group(), ornG = new THREE.Group();
scene.add(itemsG, ornG);
const itemObj = new Map(), ornObj = new Map();
const bulbs = buildLights(scene);
const pops = [];                 // 방금 단 장식이 톡 튀어나오는 몸짓
const myTag = Math.random().toString(36).slice(2, 5).padEnd(3, '0');
let seq = 0;
const newId = () => myTag + (seq++).toString(36);

let dirty = true;                // 그림자를 다시 그려야 하는지
let saveK = 0;
const saveSoon = () => { clearTimeout(saveK); saveK = setTimeout(() => store.set(ROOM_KEY, serialize(S)), 300); };

// 걸을 수 있는 칸을 다시 계산한다 (트리 + 놓인 가구)
function rebuildGrid() {
  grid.b.fill(0);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (treeBlocked(i, j)) grid.block(i, j);
  for (const it of S.items.values()) if (kindOf(it.k).solid) for (const [i, j] of cellsOf(it)) grid.block(i, j);
  if (me.path.length) { const [tx, tz] = me.path[me.path.length - 1]; const f = me.onArrive; me.stop(); if (goTo(tx, tz)) me.onArrive = f; }
}
function seat(g, it) {
  const [w, d] = footprint(it.k, it.r);
  g.position.set((it.i + w / 2) * CELL - HALF, 0, (it.j + d / 2) * CELL - HALF);
  g.rotation.y = it.r * Math.PI / 2;
}
function dropObj(map, id, parent, own) {
  const g = map.get(id);
  if (!g) return;
  parent.remove(g); map.delete(id);
  if (own) g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); // 장식은 도형을 나눠 쓰므로 지우지 않는다
}

// 방의 모든 변화는 여기를 지난다 (3단계에서 상대에게 보내는 것도 여기서 한다)
function dispatch(op, quiet = false) {
  if (!apply(S, op, treeBlocked)) return false;
  if (op.t === 'put') {
    const g = buildItem(op.k);
    g.userData.item = op.id;
    seat(g, S.items.get(op.id));
    itemsG.add(g); itemObj.set(op.id, g);
  } else if (op.t === 'move') seat(itemObj.get(op.id), S.items.get(op.id));
  else if (op.t === 'del') dropObj(itemObj, op.id, itemsG, true);
  else if (op.t === 'orn') {
    const g = buildOrnament(S.orns.get(op.id));
    g.userData.orn = op.id;
    ornG.add(g); ornObj.set(op.id, g);
    if (!quiet) { g.scale.setScalar(0.01); pops.push({ g, t: 0 }); }
  } else if (op.t === 'ornDel') dropObj(ornObj, op.id, ornG, false);
  else if (op.t === 'lights') { bulbs.set(S.lights.set, S.lights.blink); glow.intensity = bulbs.on ? 2.6 : 1.6; }
  else if (op.t === 'wall') room.setWall(S.wall);
  else if (op.t === 'floor') room.setFloor(S.floor);
  if (op.t === 'put' || op.t === 'move' || op.t === 'del') rebuildGrid();
  dirty = true;
  if (!quiet) { saveSoon(); paintPanels(); }
  return true;
}

// 누른 자리 표시
const pin = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 24), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0 }));
pin.rotation.x = -Math.PI / 2; pin.position.y = 0.045;
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
let mode = null;                 // null(걷기) | 'furn'(가구) | 'tree'(트리) | 'paint'(벽·바닥) | 'look'(캐릭터)
// ext: 방 전체가 차지하는 범위(카메라 가로·세로축), sFit: 방 전체가 들어오는 축척(px 당 길이)
// zMul: 사람이 조절한 배율, tMul: 트리 꾸밀 때의 배율
const view = { ext: { u0: -1, u1: 1, v0: -1, v1: 1 }, sFit: 0.02, top: 0, bottom: 0, zDef: 1, zMul: 1, tMul: 1, z: 1, cu: 0, cv: 0, snap: true };
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
  edges();
}

function zoomGoal() {
  if (mode === 'tree') {
    // 트리가 위 막대와 아래 판 사이에 꽉 차게
    const w = window.innerWidth, h = window.innerHeight;
    const s = Math.max(2.7 / Math.max(60, w - 16), 3.2 / Math.max(60, h - view.top - view.bottom));
    return (view.sFit / s) * view.tMul;
  }
  let z = clamp(view.zDef * view.zMul, 1, Z_MAX);
  if (mode === 'look') z = Math.max(z, Math.min(Z_MAX, 105 * view.sFit)); // 고르는 동안은 아바타가 크게 보이게
  return z;
}
function setZoomMul(m) { view.zMul = clamp(m, 1 / view.zDef, Z_MAX / view.zDef); }
function zoomBy(f) {
  if (mode === 'tree') { view.tMul = clamp(view.tMul * f, 0.6, 2.4); return; }
  setZoomMul(view.zMul * f);
  if (f < 1 && zoomGoal() <= 1.001) toast('방 전체 보기');
}

// 방이 화면보다 크면 아바타를 따라가고, 화면에 다 들어오면 가운데에 둔다. 트리를 꾸밀 때는 트리를 가운데에 둔다.
function updateView(dt) {
  const w = window.innerWidth, h = window.innerHeight, e = view.ext, side = 6, tree = mode === 'tree';
  const zg = zoomGoal();
  view.z = view.snap ? zg : view.z + (zg - view.z) * Math.min(1, dt * 8);
  if (Math.abs(zg - view.z) < 1e-3) view.z = zg;
  const s = view.sFit / view.z;
  camera.matrixWorld.extractBasis(vR, vU, vF);
  if (tree) vP.set(0, 1.42, 0); else vP.set(me.x, 0.75, me.z);
  vP.sub(camera.position);
  let cu = vP.dot(vR), cv = vP.dot(vU) + s * (view.top - view.bottom) / 2;
  if (!tree) {
    const lo = e.u0 + s * (w / 2 - side), hi = e.u1 - s * (w / 2 - side);
    cu = lo > hi ? (e.u0 + e.u1) / 2 : clamp(cu, lo, hi);
    const vlo = e.v0 + s * (h / 2 - view.bottom), vhi = e.v1 - s * (h / 2 - view.top);
    cv = vlo > vhi ? (e.v0 + e.v1) / 2 + s * (view.top - view.bottom) / 2 : clamp(cv, vlo, vhi);
  }
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
  if (mode === 'tree') standByTree();
}
const faceCamera = () => me.turnTo(Math.sin(yawOf(yawK)), Math.cos(yawOf(yawK)));

/* ───────── 걷기 ───────── */
function goTo(x, z) {
  const pts = grid.route(me.x, me.z, x, z);
  me.onArrive = null;
  if (!pts || !pts.length) return false;
  me.walk(pts);
  const [tx, tz] = pts[pts.length - 1];
  pin.position.x = tx; pin.position.z = tz; pinT = 1;
  return true;
}

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
function aimRay(px, py) {
  ndc.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
// 화면의 한 점이 가리키는 바닥 자리. inside = true 면 방 안일 때만.
function floorAt(px, py, inside = true) {
  aimRay(px, py);
  if (!ray.ray.intersectPlane(ground, hit)) return null;
  if (inside && (Math.abs(hit.x) > HALF || Math.abs(hit.z) > HALF)) return null;
  return { x: hit.x, z: hit.z };
}
function screenOf(x, z, y = 0) {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight };
}
// 누른 것이 딸린 묶음(가구·장식)의 이름표를 찾는다
function tagOf(obj, key) {
  for (let o = obj; o; o = o.parent) if (o.userData[key]) return o.userData[key];
  return null;
}

/* ───────── 가구 놓기 ───────── */
// ghost = 지금 들고 있는 가구. id 가 있으면 이미 놓여 있던 것을 옮기는 중.
let ghost = null;
const plate = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 1), new THREE.MeshBasicMaterial({ color: 0x5BE08A, transparent: true, opacity: 0.55, depthWrite: false }));
plate.visible = false; plate.position.y = 0.05;
scene.add(plate);

// 아바타가 서 있는 칸들 (가구로 덮지 않게)
function myCells() {
  const out = [];
  for (const dx of [-BODY_R, BODY_R]) for (const dz of [-BODY_R, BODY_R]) {
    const c = cellOf(me.x + dx, me.z + dz);
    if (!out.some(([i, j]) => i === c[0] && j === c[1])) out.push(c);
  }
  return out;
}
// 아바타에게서 가까운 순서로, 놓을 수 있는 첫 자리
function findSpot(k, r) {
  const [w, d] = footprint(k, r), avoid = myCells();
  let best = null, bestD = Infinity;
  for (let j = 0; j <= N - d; j++) for (let i = 0; i <= N - w; i++) {
    const dist = Math.hypot((i + w / 2) * CELL - HALF - me.x, (j + d / 2) * CELL - HALF - me.z);
    if (dist < bestD && canPlace(S, { k, i, j, r }, treeBlocked, null, avoid)) { bestD = dist; best = [i, j]; }
  }
  return best;
}
function ghostPaint() {
  const [w, d] = footprint(ghost.k, ghost.r);
  seat(ghost.g, ghost);
  ghost.g.position.y = 0.1;
  ghost.ok = canPlace(S, ghost, treeBlocked, ghost.id, myCells());
  plate.visible = true;
  plate.scale.set(w * CELL, 1, d * CELL);
  plate.position.x = ghost.g.position.x; plate.position.z = ghost.g.position.z;
  plate.material.color.setHex(ghost.ok ? 0x5BE08A : 0xFF6A5C);
  dirty = true;
}
function ghostNew(k) {
  ghostCancel();
  if (S.items.size >= MAX_ITEMS) { toast('가구를 더 놓을 수 없어요. 몇 개 치워 주세요'); return; }
  const spot = findSpot(k, 0);
  if (!spot) { toast('놓을 자리가 없어요'); return; }
  const g = buildItem(k);
  scene.add(g);
  ghost = { k, r: 0, i: spot[0], j: spot[1], id: null, g, ok: true };
  ghostPaint(); paintPanels(); measure(false);
}
function ghostPick(id) {
  ghostCancel();
  const it = S.items.get(id);
  ghost = { k: it.k, r: it.r, i: it.i, j: it.j, id, g: itemObj.get(id), ok: true };
  ghostPaint(); paintPanels(); measure(false);
}
function ghostMoveTo(x, z) {
  const [w, d] = footprint(ghost.k, ghost.r);
  ghost.i = clamp(Math.round((x + HALF) / CELL - w / 2), 0, N - w);
  ghost.j = clamp(Math.round((z + HALF) / CELL - d / 2), 0, N - d);
  ghostPaint();
}
function ghostTurn() {
  if (!ghost) return;
  const [w0, d0] = footprint(ghost.k, ghost.r), cx = ghost.i + w0 / 2, cz = ghost.j + d0 / 2;
  ghost.r = (ghost.r + 1) % 4;
  const [w, d] = footprint(ghost.k, ghost.r);
  ghost.i = clamp(Math.round(cx - w / 2), 0, N - w); ghost.j = clamp(Math.round(cz - d / 2), 0, N - d);
  ghostPaint();
}
function ghostEnd() { ghost = null; plate.visible = false; dirty = true; paintPanels(); measure(false); }
function ghostDone() {
  if (!ghost) return;
  if (!ghost.ok) { toast('여기에는 놓을 수 없어요'); return; }
  const { k, i, j, r, id, g } = ghost;
  if (id) dispatch({ t: 'move', id, i, j, r });
  else { scene.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); dispatch({ t: 'put', id: newId(), k, i, j, r }); }
  ghostEnd();
}
function ghostCancel() {
  if (!ghost) return;
  if (ghost.id) seat(ghost.g, S.items.get(ghost.id)); // 원래 자리로
  else { scene.remove(ghost.g); ghost.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  ghostEnd();
}
function ghostRemove() {
  if (!ghost) return;
  const id = ghost.id;
  if (!id) { ghostCancel(); return; }
  ghost = null;
  dispatch({ t: 'del', id });
  ghostEnd();
}
function pickItem(px, py) {
  aimRay(px, py);
  const hits = ray.intersectObjects(itemsG.children, true);
  return hits.length ? tagOf(hits[0].object, 'item') : null;
}

/* ───────── 트리 꾸미기 ───────── */
let tool = ORNAMENTS[0].id; // 고른 장식. 'cut' 이면 떼기
// 트리 옆(화면에서 오른쪽 앞)에 가서 선다. 트리를 가리지 않는 자리.
function standByTree() {
  const a = yawOf(yawK) + 1.0;
  if (goTo(Math.sin(a) * 1.95, Math.cos(a) * 1.95)) me.onArrive = () => me.turnTo(-me.x, -me.z);
  else me.turnTo(-me.x, -me.z);
}
const r3 = (v) => Math.round(v * 1000) / 1000;
function treeTap(px, py) {
  aimRay(px, py);
  if (tool === 'cut') {
    const hits = ray.intersectObjects(ornG.children, true);
    const id = hits.length ? tagOf(hits[0].object, 'orn') : null;
    if (id) dispatch({ t: 'ornDel', id });
    return;
  }
  const hits = ray.intersectObjects(room.cones, false);
  if (!hits.length) return;
  if (S.orns.size >= MAX_ORNS) { toast('장식을 더 달 수 없어요. 몇 개 떼어 주세요'); return; }
  const p = hits[0].point;
  dispatch({ t: 'orn', id: newId(), k: tool, x: r3(p.x), y: r3(p.y), z: r3(p.z) });
}

/* ───────── 누르기 ───────── */
// 손가락 하나를 거의 움직이지 않고 뗐을 때가 "누르기". 두 손가락은 크게·작게 보기.
// 가구를 들고 있을 때는 누르거나 끄는 자리로 가구가 따라온다.
const touches = new Map();
let tap = null, pinch = 0;
const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
function ghostAt(px, py) { const p = floorAt(px, py, false); if (p) ghostMoveTo(p.x, p.z); }
canvas.addEventListener('pointerdown', (e) => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 1) { tap = { x: e.clientX, y: e.clientY, id: e.pointerId }; if (ghost) ghostAt(e.clientX, e.clientY); }
  else { tap = null; pinch = touches.size === 2 ? spread() : 0; }
});
canvas.addEventListener('pointermove', (e) => {
  const t = touches.get(e.pointerId);
  if (!t) return;
  t.x = e.clientX; t.y = e.clientY;
  if (touches.size === 2 && pinch > 0) { const d = spread(); if (d > 0) { zoomBy(d / pinch); pinch = d; } }
  else if (touches.size === 1 && ghost && tap && tap.id === e.pointerId) ghostAt(e.clientX, e.clientY);
});
function lift(e, ok) {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = 0;
  const t = tap;
  if (!t || t.id !== e.pointerId) return;
  tap = null;
  if (ghost || !ok || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) return;
  if (mode === 'tree') { treeTap(e.clientX, e.clientY); return; }
  if (mode === 'furn') { const id = pickItem(e.clientX, e.clientY); if (id) { ghostPick(id); return; } }
  const p = floorAt(e.clientX, e.clientY);
  if (p) goTo(p.x, p.z);
}
canvas.addEventListener('pointerup', (e) => lift(e, true));
canvas.addEventListener('pointercancel', (e) => lift(e, false));
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

// 키보드: 방향키·WASD 는 화면 기준으로 걷는다
const keys = new Set();
const KEY = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (KEY[e.code]) { keys.add(KEY[e.code]); e.preventDefault(); }
  else if (e.code === 'KeyQ') turnView(-1);
  else if (e.code === 'KeyE') turnView(1);
  else if (ghost && e.code === 'KeyR') ghostTurn();
  else if (ghost && e.code === 'Enter') { ghostDone(); e.preventDefault(); }
  else if (ghost && e.code === 'Escape') ghostCancel();
  else if (ghost && (e.code === 'Delete' || e.code === 'Backspace')) ghostRemove();
});
addEventListener('keyup', (e) => { if (KEY[e.code]) keys.delete(KEY[e.code]); });
addEventListener('blur', () => keys.clear());

function keyWalk(dt) {
  if (mode === 'tree') return false; // 트리를 꾸미는 동안은 트리 옆에 서 있는다
  const f = (keys.has('u') ? 1 : 0) - (keys.has('d') ? 1 : 0), r = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
  if (!f && !r) return false;
  me.stop(); me.onArrive = null; pinT = Math.min(pinT, 0.2);
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
  const moved = Math.hypot(me.x - ox, me.z - oz) > 1e-5;
  if (moved && ghost) ghostPaint(); // 내가 선 칸이 바뀌면 놓을 수 있는지도 달라진다
  return moved;
}

/* ───────── 화면: 아래 탭과 판 ───────── */
let toastK = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastK); toastK = setTimeout(() => t.classList.remove('on'), 1800);
}
$('turn').addEventListener('click', () => turnView(1));
$('zin').addEventListener('click', () => zoomBy(1.35));
$('zout').addEventListener('click', () => zoomBy(1 / 1.35));

const PANELS = { furn: 'furn', tree: 'treeP', paint: 'paint', look: 'look' };
function setMode(m) {
  if (m === mode) m = null; // 같은 탭을 다시 누르면 닫는다
  if (ghost) ghostCancel();
  const was = mode;
  mode = m;
  for (const k in PANELS) $(PANELS[k]).hidden = k !== m;
  for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-pressed', String(b.dataset.m === m));
  itemsG.visible = m !== 'tree'; // 트리를 꾸밀 때는 가구가 트리를 가리지 않게 잠깐 숨긴다
  if (m === 'tree') { standByTree(); toast('트리를 눌러 장식을 달아요'); }
  if (m === 'look') { me.stop(); me.onArrive = null; faceCamera(); }
  if (was === 'look') store.set(LOOK_KEY, look);
  paintPanels();
  dirty = true;
  measure(false);
}
for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => setMode(b.dataset.m));
let hinted = !!savedLook; // 처음 온 사람에게만 걷는 법을 한 번 알려 준다
$('lookDone').addEventListener('click', () => { setMode(null); if (!hinted) { hinted = true; toast('바닥을 누르면 그 자리로 걸어가요'); } });

// 고르는 단추 만들기
function picks(box, list, cls, onPick) {
  for (const it of list) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.dataset.v = it.id;
    if (it.icon) { const i = document.createElement('b'); i.textContent = it.icon; b.append(i, it.name); } else b.textContent = it.name;
    if (it.css) { b.style.setProperty('--c', it.css); b.setAttribute('aria-label', it.name); b.title = it.name; b.textContent = ''; }
    b.addEventListener('click', () => onPick(it.id));
    box.appendChild(b);
  }
}
const css = (hex) => '#' + hex.toString(16).padStart(6, '0');
picks($('pickGender'), GENDERS, 'chip', (v) => setLook({ gender: v }));
picks($('pickOutfit'), OUTFITS, 'chip', (v) => setLook({ outfit: v }));
picks($('furnList'), FURNITURE, 'pick', (v) => ghostNew(v));
picks($('ornList'), [...ORNAMENTS, { id: 'cut', name: '떼기', icon: '✂️' }], 'pick', (v) => { tool = v; paintPanels(); if (v === 'cut') toast('뗄 장식을 눌러요'); });
picks($('lightList'), LIGHT_SETS, 'chip', (v) => dispatch({ t: 'lights', set: v, blink: S.lights.blink }));
picks($('blinkList'), BLINKS, 'chip', (v) => dispatch({ t: 'lights', set: S.lights.set, blink: v }));
picks($('wallList'), WALLS.map((w) => ({ id: w.id, name: w.name, css: css(w.wall) })), 'sw', (v) => dispatch({ t: 'wall', v }));
picks($('floorList'), FLOORS.map((f) => ({ id: f.id, name: f.name, css: f.tones[0] })), 'sw', (v) => dispatch({ t: 'floor', v }));
$('gTurn').addEventListener('click', ghostTurn);
$('gDone').addEventListener('click', ghostDone);
$('gCancel').addEventListener('click', ghostCancel);
$('gDel').addEventListener('click', ghostRemove);

// 옆으로 미는 목록: "전체 보기"로 펼치면 여러 줄로 한 번에 보인다. 접어 두었을 때는 더 있다는 것을 오른쪽 끝을 흐리게 해서 알린다.
const OPEN_KEY = 'nolja-tree-open';
const opened = new Set((Array.isArray(store.get(OPEN_KEY)) ? store.get(OPEN_KEY) : []).filter((x) => typeof x === 'string'));
function edges() {
  for (const box of document.querySelectorAll('.scroll')) box.classList.toggle('more-right', !box.classList.contains('open') && box.scrollWidth - box.clientWidth - box.scrollLeft > 4);
}
for (const b of document.querySelectorAll('.more')) {
  const box = $(b.dataset.list);
  const paint = () => { const on = opened.has(box.id); box.classList.toggle('open', on); b.textContent = on ? '접기' : '전체 보기'; b.setAttribute('aria-expanded', String(on)); };
  b.addEventListener('click', () => { if (!opened.delete(box.id)) opened.add(box.id); store.set(OPEN_KEY, [...opened]); paint(); measure(false); });
  paint();
}
for (const box of document.querySelectorAll('.scroll')) {
  box.addEventListener('scroll', edges, { passive: true });
  // 마우스 휠을 굴리면 옆으로 넘긴다 (PC 에는 옆으로 미는 손짓이 없다)
  box.addEventListener('wheel', (e) => {
    if (box.classList.contains('open') || box.scrollWidth <= box.clientWidth) return;
    e.preventDefault(); box.scrollLeft += e.deltaY || e.deltaX;
  }, { passive: false });
}

const press = (sel, v) => { for (const b of document.querySelectorAll(sel)) b.setAttribute('aria-pressed', String(b.dataset.v === v)); };
function paintPanels() {
  press('#pickGender .chip', look.gender); press('#pickOutfit .chip', look.outfit);
  press('#ornList .pick', tool);
  press('#lightList .chip', S.lights.set); press('#blinkList .chip', S.lights.blink);
  press('#wallList .sw', S.wall); press('#floorList .sw', S.floor);
  $('furnBar').hidden = !ghost; $('furnRow').hidden = !!ghost; $('furnHint').hidden = !!ghost;
  if (ghost) { $('furnName').textContent = kindOf(ghost.k).name; $('gDel').hidden = !ghost.id; }
  $('ornCount').textContent = S.orns.size ? `장식 ${S.orns.size}개` : '';
}
function setLook(patch) {
  look = cleanLook({ ...look, ...patch });
  me.setLook(look);
  paintPanels();
  store.set(LOOK_KEY, look);
  dirty = true;
}

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
let last = performance.now(), frames = 0, clock = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = now - last; last = now;
  const dt = Math.min(0.05, raw / 1000);
  clock += dt;
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
  if (ghost) ghost.g.position.y = 0.1 + Math.sin(clock * 5) * 0.025; // 들고 있는 가구는 살짝 떠서 흔들린다
  for (let k = pops.length - 1; k >= 0; k--) {
    const p = pops[k]; p.t += dt * 5;
    const s = p.t >= 1 ? 1 : 1 + 0.35 * Math.sin(p.t * Math.PI) - (1 - p.t) * (1 - p.t);
    p.g.scale.setScalar(Math.max(0.01, s));
    if (p.t >= 1) pops.splice(k, 1);
  }
  bulbs.tick(clock);

  if (dirty) { renderer.shadowMap.needsUpdate = true; dirty = false; }
  renderer.render(scene, camera);
  frames++;
}

/* ───────── 시작 ───────── */
rebuildGrid();
for (const op of ops(store.get(ROOM_KEY))) dispatch(op, true); // 지난번에 꾸민 방
if (!grid.fits(me.x, me.z, BODY_R)) { // 내 자리에 가구가 있으면 가까운 빈칸으로
  const [i, j] = cellOf(me.x, me.z), c = grid.nearestFree(i, j, me.x, me.z);
  if (c) me.place(-HALF + (c[0] + 0.5) * CELL, -HALF + (c[1] + 0.5) * CELL);
}
addEventListener('resize', () => measure());
addEventListener('orientationchange', () => setTimeout(measure, 200));
faceCamera(); me.root.rotation.y = me.face; // 처음에는 화면 쪽을 본다
showWalls();
paintPanels();
if (savedLook) measure(); else setMode('look'); // 처음 온 사람은 캐릭터부터 고른다
view.snap = true; updateView(0);
requestAnimationFrame(frame);
const loading = $('loading');
if (loading) { loading.classList.add('done'); setTimeout(() => loading.remove(), 500); }

// 자동 검사와 다음 단계(둘이 같이)가 쓰는 창구
window.__tree = {
  N, CELL, HALF, grid, me, room, S, goTo, screenOf, floorAt, turnView, lowerQuality, setLook, zoomBy, dispatch, setMode,
  ghostNew, ghostPick, ghostMoveTo, ghostTurn, ghostDone, ghostCancel, ghostRemove, surfaceR, serialize: () => serialize(S),
  setZoomMul(m) { setZoomMul(m); },
  openLook(on) { if ((mode === 'look') !== on) setMode('look'); },
  // 트리 겉면의 한 점(높이 y, 둘레 각 a)이 화면에서 어디인지
  treePoint(y, a) { const r = surfaceR(y) * 0.93; return screenOf(Math.sin(a) * r, Math.cos(a) * r, y); },
  get yaw() { return yaw; }, get mode() { return mode; }, get tool() { return tool; }, set tool(v) { tool = v; paintPanels(); },
  get ghost() { return ghost ? { k: ghost.k, i: ghost.i, j: ghost.j, r: ghost.r, id: ghost.id, ok: ghost.ok } : null; },
  get look() { return look; }, get lookOpen() { return mode === 'look'; }, get bulbsOn() { return bulbs.on; },
  get itemsShown() { return itemsG.visible; }, get itemObjs() { return itemObj.size; }, get ornObjs() { return ornObj.size; },
  get frames() { return frames; }, get yawK() { return yawK; }, get quality() { return quality; },
  get view() { return { z: view.z, goal: zoomGoal(), pxu: view.z / view.sFit, whole: mode !== 'tree' && zoomGoal() <= 1.001, top: view.top, bottom: view.bottom, settled: Math.abs(view.z - zoomGoal()) < 1e-3 }; },
  get turning() { return Math.abs(Math.atan2(Math.sin(yawOf(yawK) - yaw), Math.cos(yawOf(yawK) - yaw))) > 1e-3; },
  get walls() { return Object.fromEntries(Object.entries(room.walls).map(([k, w]) => [k, w.upper.visible])); },
};
