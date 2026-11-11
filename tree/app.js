// 놀자방 · 트리 같이 꾸미기
// 1단계: 거실, 비스듬히 내려다보는 카메라, 아바타 걷기와 고르기
// 2단계: 가구 놓기·옮기기, 벽지·바닥, 트리 장식과 전구
// 정적 파일만 쓴다.
import { THREE } from './kit.js';
import { Grid, HALF, N, CELL, cellOf } from './path.js';
import { buildRoom, WALL_H, TREE, treeBlocked, surfaceR } from './room.js';
import { makeAvatar, cleanLook, DEFAULT_LOOK, GENDERS, OUTFITS, BODY_R, SPEED } from './avatar.js';
import { FURNITURE, ORNAMENTS, LIGHT_SETS, BLINKS, WALLS, FLOORS, MAX_ITEMS, MAX_ORNS } from './catalog.js';
import { makeState, apply, canPlace, footprint, cellsOf, kindOf, serialize, ops, stampOf, syncOf, guestWins } from './state.js';
import { buildItem } from './furniture.js';
import { buildOrnament, buildLights } from './decor.js';
import { makeDuo, ROOM_RE } from './duo.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* 기억하지 못해도 논다 */ } },
  del(k) { try { localStorage.removeItem(k); } catch (_) { /* 무시 */ } },
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
// 저장 이름. ?ns=이름 은 자동 검사에서 한 브라우저 안의 두 사람을 가르는 데만 쓴다.
const NS = (new URLSearchParams(location.search).get('ns') || '').replace(/[^a-z0-9]/g, '').slice(0, 8);
const key = (k) => 'nolja-tree-' + k + (NS ? '.' + NS : '');
const LOOK_KEY = key('look'), ROOM_KEY = key('room'), CUR_KEY = key('cur'), POV_KEY = key('pov');
// 같이 꾸미는 방: 주소의 #r=방이름. cur = 이 기기가 지금 들어가 있는 방 { id, mine(내가 만든 방인지) }.
// 방마다 따로 저장한다(혼자 꾸민 내 방은 ROOM_KEY, 같이 꾸미는 방은 ROOM_KEY-방이름).
let cur = store.get(CUR_KEY);
if (!cur || typeof cur !== 'object' || !ROOM_RE.test(cur.id || '')) cur = null;
{
  const m = /^#r=([a-z0-9]{6,20})$/.exec(location.hash);
  if (m && (!cur || cur.id !== m[1])) { // 다른 방의 링크로 들어옴
    if (cur) store.del(ROOM_KEY + '-' + cur.id);
    cur = { id: m[1], mine: false };
    store.set(CUR_KEY, cur);
  } else if (!m && cur) history.replaceState(null, '', location.pathname + location.search + '#r=' + cur.id); // 들어가 있던 방으로
}
const slot = () => (cur ? ROOM_KEY + '-' + cur.id : ROOM_KEY);
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
const saveSoon = () => { clearTimeout(saveK); saveK = setTimeout(() => store.set(slot(), serialize(S)), 300); };

// 걸을 수 있는 칸을 다시 계산한다 (트리 + 놓인 가구)
function rebuildGrid() {
  grid.b.fill(0);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (treeBlocked(i, j)) grid.block(i, j);
  for (const it of S.items.values()) if (kindOf(it.k).solid) for (const [i, j] of cellsOf(it)) grid.block(i, j);
  if (!grid.fits(me.x, me.z, BODY_R)) { // 내 자리에 가구가 놓였으면 가까운 빈칸으로 비켜선다
    const [i, j] = cellOf(me.x, me.z), c = grid.nearestFree(i, j, me.x, me.z);
    if (c) me.place(-HALF + (c[0] + 0.5) * CELL, -HALF + (c[1] + 0.5) * CELL);
  }
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

// 방의 모든 변화는 여기를 지난다. from = 'me'(내가 함) | 'peer'(친구가 함) | 'load'(저장된 방을 여는 중)
function dispatch(op, from = 'me') {
  // 내가 들고 있는 가구를 친구가 옮기거나 치웠으면 손에서 내려놓는다
  const taken = from === 'peer' && ghost && ghost.id && op && ghost.id === op.id && (op.t === 'del' || op.t === 'move');
  if (!apply(S, op, treeBlocked)) return false;
  if (taken) ghost = null;
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
    if (from !== 'load') { g.scale.setScalar(0.01); pops.push({ g, t: 0 }); }
  } else if (op.t === 'ornDel') dropObj(ornObj, op.id, ornG, false);
  else if (op.t === 'lights') { bulbs.set(S.lights.set, S.lights.blink); glow.intensity = bulbs.on ? 2.6 : 1.6; }
  else if (op.t === 'wall') room.setWall(S.wall);
  else if (op.t === 'floor') room.setFloor(S.floor);
  if (op.t === 'put' || op.t === 'move' || op.t === 'del') rebuildGrid();
  dirty = true;
  if (from === 'load') return true;
  S.at = Date.now();
  saveSoon();
  if (taken) ghostEnd(); else { if (ghost) ghostPaint(); paintPanels(); }
  if (from === 'me') duo.op(op);
  return true;
}

// 방을 통째로 바꾼다 (저장된 방을 열 때, 친구의 방을 받아올 때). fromPeer = 친구에게서 받은 방(받는 순간 둘이 같다)
function loadRoom(data, fromPeer = false) {
  if (ghost) ghostCancel();
  for (const id of [...itemObj.keys()]) dropObj(itemObj, id, itemsG, true);
  for (const id of [...ornObj.keys()]) dropObj(ornObj, id, ornG, false);
  pops.length = 0;
  Object.assign(S, makeState());
  bulbs.set(S.lights.set, S.lights.blink); glow.intensity = 1.6;
  room.setWall(S.wall); room.setFloor(S.floor);
  for (const op of ops(data)) dispatch(op, 'load');
  S.at = stampOf(data);
  S.sync = fromPeer ? S.at : syncOf(data);
  rebuildGrid();
  paintPanels();
  dirty = true;
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
  $('stick').style.bottom = (view.bottom + 6) + 'px';
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
  if (usingEye()) { if (!pose) fpFov = clamp(fpFov / f, 40, 85); return; }
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
  dirty = true;
  room.ceil.visible = usingEye();
  if (usingEye()) { for (const k in room.walls) room.walls[k].upper.visible = true; return; } // 1인칭에서는 네 면과 천장이 다 보인다
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  room.walls.w.upper.visible = dx > 0.02;
  room.walls.e.upper.visible = dx < -0.02;
  room.walls.n.upper.visible = dz > 0.02;
  room.walls.s.upper.visible = dz < -0.02;
  dirty = true;
}

function turnView(dir = 1) {
  if (usingEye()) { if (!pose) fy += dir * Math.PI / 4; return; } // 1인칭에서는 고개를 돌린다
  yawK = (yawK + dir + 4) % 4;
  toast(['앞에서', '오른쪽에서', '뒤에서', '왼쪽에서'][yawK] + ' 보는 중');
  if (mode === 'tree') standByTree();
}
const faceCamera = () => me.turnTo(Math.sin(yawOf(yawK)), Math.cos(yawOf(yawK)));

/* ───────── 1인칭으로 보기 ───────── */
// fp = 1인칭을 골랐는지. 캐릭터를 고를 때는 내 모습이 보여야 하므로 잠깐 내려다보는 시점으로 돌아간다.
// pose = 놀이(다트·TV …) 중에 고정된 카메라 자리 { pos: [x, y, z], at: [x, y, z], fov }
const eye = new THREE.PerspectiveCamera(70, 1, 0.05, 80);
const EYE_H = 1.18;              // 눈높이
let fp = store.get(POV_KEY) === 'fp';
let fy = Math.PI, fpitch = -0.08, fpFov = 70; // 보는 방향: 바닥에서 (-sin fy, -cos fy) 쪽, fpitch 만큼 위로
let pose = null;
const joy = { x: 0, y: 0 };      // 조이스틱 (-1 ~ 1)
function usingEye() { return !!pose || (fp && mode !== 'look'); }
const cam = () => (usingEye() ? eye : camera);
function updateEye() {
  const w = window.innerWidth, h = window.innerHeight;
  if (pose) { eye.position.set(pose.pos[0], pose.pos[1], pose.pos[2]); eye.fov = pose.fov || 60; eye.lookAt(pose.at[0], pose.at[1], pose.at[2]); }
  else {
    const c = Math.cos(fpitch);
    eye.position.set(me.x, EYE_H, me.z);
    eye.fov = Math.min(95, fpFov * (w < h ? 1.25 : 1)); // 세로 화면은 좌우가 좁으니 조금 더 넓게 본다
    eye.lookAt(me.x - Math.sin(fy) * c, EYE_H + Math.sin(fpitch), me.z - Math.cos(fy) * c);
  }
  // 보는 가운데가 위 막대와 아래 판 사이의 한가운데에 오게 한다
  const d = (view.bottom - view.top) / 2;
  if (d >= 0) eye.setViewOffset(w, h + 2 * d, 0, 2 * d, w, h); else eye.setViewOffset(w, h - 2 * d, 0, 0, w, h);
  eye.updateMatrixWorld();
}
// 벽, 내 아바타, 단추를 지금 시점에 맞춘다
function applyPov() {
  const e = usingEye();
  me.root.visible = !e;
  showWalls();
  $('pov').setAttribute('aria-pressed', String(fp));
  $('pov').setAttribute('aria-label', fp ? '내려다보기' : '1인칭으로 보기');
  $('turn').hidden = e;
  $('stick').hidden = !(e && !pose && mode !== 'tree');
  if ($('stick').hidden) { joy.x = joy.y = 0; }
  if (e) updateEye();
}
function setPov(on) {
  fp = !!on;
  store.set(POV_KEY, fp ? 'fp' : 'iso');
  if (fp) { fy = Math.atan2(me.x, me.z); fpitch = -0.06; } // 처음에는 방 한가운데(트리) 쪽을 본다
  applyPov();
  if (fp && mode === 'tree') lookAtTree();
  toast(fp ? '1인칭으로 보는 중. 화면을 끌어서 둘러봐요' : '내려다보는 중');
}
function lookAtTree() { fy = Math.atan2(me.x, me.z); fpitch = 0.06; }

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
  ray.setFromCamera(ndc, cam());
}
// 화면의 한 점이 가리키는 바닥 자리. inside = true 면 방 안일 때만.
function floorAt(px, py, inside = true) {
  aimRay(px, py);
  if (!ray.ray.intersectPlane(ground, hit)) return null;
  if (inside && (Math.abs(hit.x) > HALF || Math.abs(hit.z) > HALF)) return null;
  return { x: hit.x, z: hit.z };
}
function screenOf(x, z, y = 0) {
  const v = new THREE.Vector3(x, y, z).project(cam());
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

// 나와 친구가 서 있는 칸들 (가구로 사람을 덮지 않게)
function myCells() {
  const out = [];
  for (const a of other ? [me, other] : [me]) for (const dx of [-BODY_R, BODY_R]) for (const dz of [-BODY_R, BODY_R]) {
    const c = cellOf(a.x + dx, a.z + dz);
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
  ghost = null;
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
// 트리 옆(화면에서 오른쪽 앞)에 가서 선다. 트리를 가리지 않는 자리. 손님으로 들어온 사람은 왼쪽 앞에 선다(둘이 겹치지 않게).
function standByTree() {
  const a = yawOf(yawK) + (duo.role === 'guest' ? -1.0 : 1.0);
  const face = () => { me.turnTo(-me.x, -me.z); if (fp) lookAtTree(); };
  const d = fp ? 3.2 : 1.95; // 1인칭에서는 트리가 한눈에 들어오게 좀 더 떨어져 선다
  if (goTo(Math.sin(a) * d, Math.cos(a) * d)) me.onArrive = face; else face();
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

/* ───────── 둘이 같이 ───────── */
let other = null;                 // 친구 아바타
let sentAt = 0, sentX = Infinity, sentZ = Infinity; // 친구에게 마지막으로 알린 내 자리
let manualUrl = null;             // 공유도 복사도 안 되는 브라우저에서 직접 복사하게 보여 줄 링크
const okPos = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= HALF;
// 방의 지문: 두 사람의 방이 같은지 견주는 짧은 글자 (놓은 순서가 달라도 같은 방이면 같게 나온다)
function roomHash() {
  const d = serialize(S), byId = (a, b) => (a[0] < b[0] ? -1 : 1);
  const txt = JSON.stringify([d.items.sort(byId), d.orns.sort(byId), d.lights, d.wall, d.floor]);
  let h = 5381;
  for (let k = 0; k < txt.length; k++) h = ((h << 5) + h + txt.charCodeAt(k)) | 0;
  return (h >>> 0).toString(36) + '.' + d.items.length + '.' + d.orns.length;
}
// 친구가 보낸 생김새가 아는 값일 때만 받는다 (아니면 null)
function okLook(lk) {
  const c = cleanLook(lk);
  return lk && typeof lk === 'object' && c.gender === lk.gender && c.outfit === lk.outfit ? c : null;
}
function setPeer(lk, pos) {
  const c = okLook(lk);
  if (!other) { other = makeAvatar(c || DEFAULT_LOOK); other.place(-1.75, 2.25); other.turnTo(1, 1); other.root.rotation.y = other.face; scene.add(other.root); }
  else if (c) other.setLook(c);
  if (Array.isArray(pos) && okPos(pos[0]) && okPos(pos[1])) { other.stop(); other.place(pos[0], pos[1]); }
  // 같은 자리에 겹쳐 서 있으면 들어온 쪽이 옆으로 비켜선다
  if (duo.role === 'guest' && Math.hypot(me.x - other.x, me.z - other.z) < 0.6) goTo(other.x - 1.0, other.z + 0.5);
  sentX = Infinity; // 내 자리도 다시 알린다
  if (ghost) ghostPaint();
  dirty = true;
}
const duo = makeDuo({
  snapshot: () => ({ state: serialize(S), look, pos: [r3(me.x), r3(me.z)], mine: !!(cur && cur.mine) }),
  hash: roomHash,
  // 손님이 가져온 방을 쓸지 (주인이 묻는다)
  preferPeer: (state, mine) => guestWins({ at: stampOf(state), sync: syncOf(state), mine }, { at: S.at, sync: S.sync, mine: !!(cur && cur.mine) }),
  adopt(state) { loadRoom(state, true); saveSoon(); },
  synced() { if (S.sync !== S.at) { S.sync = S.at; saveSoon(); } }, // 지금 둘의 방이 같다
  hasPeer: () => !!other,
  peerJoin(m) { setPeer(m.look, m.pos); },
  peerOp: (op) => dispatch(op, 'peer'),
  peerLook(lk) { const c = okLook(lk); if (other && c) { other.setLook(c); dirty = true; } },
  peerPos(x, z) {
    if (!other || !okPos(x) || !okPos(z)) return;
    if (Math.hypot(x - other.x, z - other.z) > 3) other.place(x, z); // 너무 멀어졌으면 바로 옮긴다
    other.walk([[x, z]]);
  },
  peerGone() {
    if (!other) return;
    scene.remove(other.root);
    other.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    other = null; dirty = true;
    if (ghost) ghostPaint();
  },
  status: () => paintDuo(),
  toast: (m) => toast(m),
});

// 친구 초대: 처음이면 지금 방을 같이 꾸미는 방으로 만들고, 링크를 보낸다
async function invite() {
  if (!cur) {
    const id = duo.create();
    cur = { id, mine: true };
    store.set(CUR_KEY, cur);
    store.set(slot(), serialize(S));
    history.replaceState(null, '', location.pathname + location.search + '#r=' + id);
  }
  const url = duo.inviteUrl();
  manualUrl = null;
  try { if (navigator.share) { await navigator.share({ title: '트리 같이 꾸미기', text: '우리 트리 같이 꾸미자 🎄 눌러서 들어와', url }); return; } }
  catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요. 친구에게 붙여 보내세요'); return; } catch (_) { /* 아래로 */ }
  manualUrl = url; paintDuo();
}
// 방에서 나가기: 내가 만든 방이면 지금 모습 그대로 혼자 이어서 꾸미고, 친구 방이면 내 방으로 돌아간다
function leaveRoom() {
  if (!cur) return;
  clearTimeout(saveK);
  if (cur.mine) store.set(ROOM_KEY, serialize(S));
  store.del(slot()); store.del(CUR_KEY);
  cur = null;
  duo.leave();
  history.replaceState(null, '', location.pathname + location.search);
  location.reload();
}
const DUO_TEXT = {
  solo: ['친구랑 같이 꾸미기', '링크를 보내면 친구가 이 방에 들어와요. 딱 두 명까지.', ''],
  connecting: ['연결하는 중…', '', '연결 중'],
  waiting: ['친구를 기다리는 중이에요', '링크를 받은 친구가 들어오면 바로 같이 꾸며요. 방은 계속 저장돼요.', '친구 기다리는 중'],
  on: ['친구와 같이 꾸미는 중이에요 👫', '서로 놓은 것이 바로 보여요.', '같이 노는 중'],
  lost: ['연결이 끊겼어요', '방은 그대로예요. 혼자 이어서 꾸밀 수 있어요.', '연결 끊김'],
  full: ['이 방에는 이미 두 명이 있어요', '', '방이 찼어요'],
};
function paintDuo() {
  const m = duo.mode, [main, sub, chip] = DUO_TEXT[m];
  $('duoMain').textContent = main; $('duoSub').textContent = sub;
  $('duoInvite').hidden = !(m === 'solo' || m === 'waiting');
  $('duoInvite').textContent = m === 'solo' ? '친구 초대하기' : '링크 다시 보내기';
  $('duoRetry').hidden = m !== 'lost';
  $('duoLeave').hidden = m === 'solo';
  $('duoLeave').textContent = cur && cur.mine ? '혼자 놀기' : '내 방으로 가기';
  if (m !== 'waiting') manualUrl = null;
  $('duoUrlRow').hidden = !manualUrl;
  if (manualUrl) $('duoUrl').value = manualUrl;
  const net = $('net');
  net.hidden = !chip; net.textContent = chip; net.dataset.m = m;
  document.querySelector('#tabs button[data-m="duo"]').classList.toggle('live', m === 'on');
  if (mode === 'duo') measure(false);
}
$('duoInvite').addEventListener('click', invite);
$('duoRetry').addEventListener('click', () => duo.retry());
$('duoLeave').addEventListener('click', leaveRoom);
$('duoUrl').addEventListener('focus', (e) => e.target.select());

/* ───────── 누르기 ───────── */
// 손가락 하나를 거의 움직이지 않고 뗐을 때가 "누르기". 두 손가락은 크게·작게 보기.
// 가구를 들고 있을 때는 누르거나 끄는 자리로 가구가 따라온다.
const touches = new Map();
let tap = null, pinch = 0;
const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
function ghostAt(px, py) { const p = floorAt(px, py, false); if (p) ghostMoveTo(p.x, p.z); }
canvas.addEventListener('pointerdown', (e) => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 1) { tap = { x: e.clientX, y: e.clientY, id: e.pointerId }; if (ghost && !usingEye()) ghostAt(e.clientX, e.clientY); }
  else { tap = null; pinch = touches.size === 2 ? spread() : 0; }
});
canvas.addEventListener('pointermove', (e) => {
  const t = touches.get(e.pointerId);
  if (!t) return;
  const mx = e.clientX - t.x, my = e.clientY - t.y;
  t.x = e.clientX; t.y = e.clientY;
  if (touches.size === 2 && pinch > 0) { const d = spread(); if (d > 0) { zoomBy(d / pinch); pinch = d; } }
  else if (touches.size !== 1) return;
  else if (usingEye()) { if (!pose) { fy += mx * 0.005; fpitch = clamp(fpitch + my * 0.004, -1.0, 0.9); } } // 1인칭: 끌어서 둘러본다
  else if (ghost && tap && tap.id === e.pointerId) ghostAt(e.clientX, e.clientY);
});
function lift(e, ok) {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = 0;
  const t = tap;
  if (!t || t.id !== e.pointerId) return;
  tap = null;
  const still = ok && Math.hypot(e.clientX - t.x, e.clientY - t.y) <= 10;
  if (ghost) { if (still && usingEye()) ghostAt(e.clientX, e.clientY); return; } // 1인칭에서는 누른 자리로 가구가 온다
  if (!still) return;
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
  if (pose) return false;           // 놀이 중에는 걷지 않는다
  const f = (keys.has('u') ? 1 : 0) - (keys.has('d') ? 1 : 0) - joy.y, r = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0) + joy.x;
  const push = Math.min(1, Math.hypot(f, r)); // 조이스틱을 살짝 밀면 천천히 걷는다
  if (push < 0.15) return false;
  me.stop(); me.onArrive = null; pinT = Math.min(pinT, 0.2);
  // 화면 위쪽 = 카메라가 보는 쪽, 화면 오른쪽 = 그 오른쪽 (1인칭에서는 내가 보는 쪽)
  const ya = usingEye() ? fy : yaw;
  let dx = -Math.sin(ya) * f + Math.cos(ya) * r, dz = -Math.cos(ya) * f - Math.sin(ya) * r;
  const len = Math.hypot(dx, dz); dx /= len; dz /= len;
  me.turnTo(dx, dz);
  const step = SPEED * push * dt, lim = HALF - BODY_R;
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
$('pov').addEventListener('click', () => setPov(!fp));
// 조이스틱: 1인칭에서 걷는 데 쓴다
{
  const st = $('stick'), knob = st.firstElementChild;
  let id = null;
  const move = (e) => {
    const r = st.getBoundingClientRect(), R = r.width / 2;
    let x = (e.clientX - r.left - R) / (R * 0.7), y = (e.clientY - r.top - R) / (R * 0.7);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    joy.x = x; joy.y = y;
    knob.style.transform = `translate(${x * R * 0.55}px, ${y * R * 0.55}px)`;
  };
  const end = (e) => { if (e.pointerId !== id) return; id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  st.addEventListener('pointerdown', (e) => { id = e.pointerId; try { st.setPointerCapture(id); } catch (_) { /* 무시 */ } move(e); e.preventDefault(); });
  st.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
}
$('zin').addEventListener('click', () => zoomBy(1.35));
$('zout').addEventListener('click', () => zoomBy(1 / 1.35));

const PANELS = { furn: 'furn', tree: 'treeP', paint: 'paint', look: 'look', duo: 'duoP' };
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
  applyPov();
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
  duo.look(look);
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
  if (other && (other.step(dt) || other.blend > 0.01)) dirty = true;
  // 내 자리를 친구에게 알린다 (1초에 열 번까지, 움직였을 때만)
  if (duo.mode === 'on' && clock - sentAt > 0.1 && (Math.abs(me.x - sentX) > 0.004 || Math.abs(me.z - sentZ) > 0.004)) {
    sentAt = clock; sentX = me.x; sentZ = me.z;
    duo.pos(r3(me.x), r3(me.z));
  }
  updateView(dt);
  if (usingEye()) updateEye();

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
  renderer.render(scene, cam());
  frames++;
}

/* ───────── 시작 ───────── */
loadRoom(store.get(slot())); // 지난번에 꾸민 방
addEventListener('resize', () => measure());
addEventListener('orientationchange', () => setTimeout(measure, 200));
faceCamera(); me.root.rotation.y = me.face; // 처음에는 화면 쪽을 본다
showWalls();
paintPanels();
if (savedLook) measure(); else setMode('look'); // 처음 온 사람은 캐릭터부터 고른다
applyPov();
addEventListener('hashchange', () => location.reload()); // 다른 방 링크를 열면 새로 시작한다
if (cur) duo.start(cur.id); else paintDuo();
view.snap = true; updateView(0);
requestAnimationFrame(frame);
const loading = $('loading');
if (loading) { loading.classList.add('done'); setTimeout(() => loading.remove(), 500); }

// 자동 검사가 쓰는 창구
window.__duo = {
  get mode() { return duo.mode; }, get role() { return duo.role; }, get room() { return duo.room; }, get mine() { return cur ? cur.mine : null; },
  get other() { return other ? { x: other.x, z: other.z, look: other.look, moving: other.moving } : null; },
  inviteUrl: () => duo.inviteUrl(), invite, leaveRoom, hash: roomHash, feed: (m) => duo.feed(m),
};
window.__tree = {
  N, CELL, HALF, grid, me, room, S, goTo, screenOf, floorAt, turnView, lowerQuality, setLook, zoomBy, dispatch, setMode,
  ghostNew, ghostPick, ghostMoveTo, ghostTurn, ghostDone, ghostCancel, ghostRemove, surfaceR, serialize: () => serialize(S),
  setZoomMul(m) { setZoomMul(m); },
  openLook(on) { if ((mode === 'look') !== on) setMode('look'); },
  // 트리 겉면의 한 점(높이 y, 둘레 각 a)이 화면에서 어디인지
  treePoint(y, a) { const r = surfaceR(y) * 0.93; return screenOf(Math.sin(a) * r, Math.cos(a) * r, y); },
  setPov, lookTo(dx, dz) { fy = Math.atan2(-dx, -dz); }, get pov() { return fp ? 'fp' : 'iso'; }, get eyeOn() { return usingEye(); }, get meShown() { return me.root.visible; },
  get look3() { return { fy, fpitch, x: eye.position.x, y: eye.position.y, z: eye.position.z }; },
  get yaw() { return yaw; }, get mode() { return mode; }, get tool() { return tool; }, set tool(v) { tool = v; paintPanels(); },
  get ghost() { return ghost ? { k: ghost.k, i: ghost.i, j: ghost.j, r: ghost.r, id: ghost.id, ok: ghost.ok } : null; },
  get look() { return look; }, get lookOpen() { return mode === 'look'; }, get bulbsOn() { return bulbs.on; },
  get itemsShown() { return itemsG.visible; }, get itemObjs() { return itemObj.size; }, get ornObjs() { return ornObj.size; },
  get frames() { return frames; }, get yawK() { return yawK; }, get quality() { return quality; },
  get view() { return { z: view.z, goal: zoomGoal(), pxu: view.z / view.sFit, whole: mode !== 'tree' && zoomGoal() <= 1.001, top: view.top, bottom: view.bottom, settled: Math.abs(view.z - zoomGoal()) < 1e-3 }; },
  get turning() { return Math.abs(Math.atan2(Math.sin(yawOf(yawK) - yaw), Math.cos(yawOf(yawK) - yaw))) > 1e-3; },
  get walls() { return Object.fromEntries(Object.entries(room.walls).map(([k, w]) => [k, w.upper.visible])); },
};
