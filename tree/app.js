// 놀자방 · 트리 같이 꾸미기
// 1단계: 거실, 비스듬히 내려다보는 카메라, 아바타 걷기와 고르기
// 2단계: 가구 놓기·옮기기, 벽지·바닥, 트리 장식과 전구
// 정적 파일만 쓴다.
import { THREE } from './kit.js';
import { Grid, NX, NZ, CELL, X0, Z0, X1, Z1, cellOf, centerOf } from './path.js';
import { buildRoom, WALL_H, TREE, fixedCell, surfaceR } from './room.js';
import { makeAvatar, cleanLook, DEFAULT_LOOK, GENDERS, OUTFITS, BODY_R, SPEED } from './avatar.js';
import { FURNITURE, ORNAMENTS, LIGHT_SETS, BLINKS, WALLS, FLOORS, MAX_ITEMS, MAX_ORNS, STARTER, STARTER_EAST } from './catalog.js';
import { makeState, apply, canPlace, footprint, cellsOf, kindOf, serialize, ops, stampOf, syncOf, guestWins, newCake } from './state.js';
import { buildItem } from './furniture.js';
import { buildOrnament, buildLights } from './decor.js';
import { makeDuo, ROOM_RE, CAP, ECAP } from './duo.js';
import { makePlay } from './play.js';
import { dressCake, flicker, pickTop } from './cake.js';

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
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
// 해는 집 한가운데를 비춘다. 그림자는 집 전체를 덮는다.
const CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2, SH = Math.max(X1 - X0, Z1 - Z0) / 2 + 1.5;
sun.position.set(CX + 2.5, 9, CZ + 4.5); sun.target.position.set(CX, 0, CZ); scene.add(sun.target);
sun.shadow.camera.left = -SH; sun.shadow.camera.right = SH; sun.shadow.camera.top = SH; sun.shadow.camera.bottom = -SH;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 30;
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
// 같이 꾸미는 방: 주소의 #r=방이름-열쇠(같이 꾸미기) 또는 #v=방이름(구경).
// cur = 이 기기가 지금 들어가 있는 방 { id, mine(내가 만든 방인지), key(꾸밀 수 있는 열쇠), view(구경으로 들어왔는지) }.
// 방마다 따로 저장한다(혼자 꾸민 내 방은 ROOM_KEY, 같이 꾸미는 방은 ROOM_KEY-방이름). 구경하는 방은 저장하지 않는다.
let cur = store.get(CUR_KEY);
if (!cur || typeof cur !== 'object' || !ROOM_RE.test(cur.id || '')) cur = null;
else cur = { id: cur.id, mine: cur.mine === true, key: typeof cur.key === 'string' ? cur.key : '', view: cur.view === true };
{
  const m = /^#r=([a-z0-9]{6,20})(?:-([a-z0-9]{4,12}))?$/.exec(location.hash), v = /^#v=([a-z0-9]{6,20})$/.exec(location.hash);
  const id = m ? m[1] : v ? v[1] : null;
  if (id && (!cur || cur.id !== id)) { // 다른 방의 링크로 들어옴
    if (cur) store.del(ROOM_KEY + '-' + cur.id);
    cur = { id, mine: false, key: m ? m[2] || '' : '', view: !m };
    store.set(CUR_KEY, cur);
  } else if (m && cur && cur.view) { // 구경하던 방의 꾸미기 링크를 받음
    cur = { id, mine: false, key: m[2] || '', view: false };
    store.set(CUR_KEY, cur);
  }
  if (cur) history.replaceState(null, '', location.pathname + location.search + (cur.view ? '#v=' + cur.id : '#r=' + cur.id + (cur.key ? '-' + cur.key : ''))); // 들어가 있던 방으로
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
const saveSoon = () => { clearTimeout(saveK); if (cur && cur.view) return; saveK = setTimeout(() => store.set(slot(), serialize(S)), 300); }; // 구경하는 방은 내 기기에 남기지 않는다

// 걸을 수 있는 칸을 다시 계산한다 (트리 + 놓인 가구)
function rebuildGrid() {
  grid.b.fill(0);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) if (fixedCell(i, j)) grid.block(i, j);
  for (const it of S.items.values()) if (kindOf(it.k).solid) for (const [i, j] of cellsOf(it)) grid.block(i, j);
  if (!grid.fits(me.x, me.z, BODY_R)) { // 내 자리에 가구가 놓였으면 가까운 빈칸으로 비켜선다
    const [i, j] = cellOf(me.x, me.z), c = grid.nearestFree(i, j, me.x, me.z);
    if (c) me.place(...centerOf(c[0], c[1]));
  }
  if (me.path.length) { const [tx, tz] = me.path[me.path.length - 1]; const f = me.onArrive; me.stop(); if (goTo(tx, tz)) me.onArrive = f; }
}
function seat(g, it) {
  const [w, d] = footprint(it.k, it.r);
  g.position.set(X0 + (it.i + w / 2) * CELL, 0, Z0 + (it.j + d / 2) * CELL);
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
  if (from === 'me' && !canEdit && !(op && op.t === 'cakeBlow')) { toast('구경하는 중에는 꾸밀 수 없어요'); return false; } // 촛불 불기는 구경하는 사람도 된다
  const wasLit = op && typeof op.t === 'string' && op.t.startsWith('cake') && S.cakes.get(op.id) ? S.cakes.get(op.id).lit : 0;
  // 내가 들고 있는 가구를 친구가 옮기거나 치웠으면 손에서 내려놓는다
  const taken = from === 'peer' && ghost && ghost.id && op && ghost.id === op.id && (op.t === 'del' || op.t === 'move');
  if (!apply(S, op, fixedCell)) return false;
  if (taken) ghost = null;
  if (op.t === 'put') {
    const g = buildItem(op.k);
    g.userData.item = op.id;
    seat(g, S.items.get(op.id));
    itemsG.add(g); itemObj.set(op.id, g);
    if (op.k === 'cake') dressCake(g, newCake());
  } else if (op.t.startsWith('cake')) {
    const k = S.cakes.get(op.id) || newCake();
    dressCake(itemObj.get(op.id), k);
    if (from !== 'load') {
      play.refresh(op.id);
      if (wasLit > 0 && k.lit === 0 && op.t === 'cakeBlow') celebrate(); // 마지막 촛불이 꺼졌다
    }
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
  if (mode === 'play' && play.id === op.id && (op.t === 'del' || op.t === 'move')) setMode(null); // 놀던 가구를 친구가 옮기거나 치움
  S.at = Date.now();
  saveSoon();
  if (taken) ghostEnd(); else { if (ghost) ghostPaint(); paintPanels(); }
  if (from === 'me') duo.op(op);
  return true;
}

// 방을 통째로 바꾼다 (저장된 방을 열 때, 친구의 방을 받아올 때). fromPeer = 친구에게서 받은 방(받는 순간 둘이 같다)
function loadRoom(data, fromPeer = false) {
  if (mode === 'play') setMode(null);
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
const Z_MAX = 6;                 // 방 전체 보기의 몇 배까지 당길 수 있는지
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
  camera.position.set(CX + Math.sin(a) * ch * 40, LOOK_Y + Math.sin(ELEV) * 40, CZ + Math.cos(a) * ch * 40); // 집 한가운데를 중심으로 돈다
  camera.lookAt(CX, LOOK_Y, CZ);
  camera.updateMatrixWorld();
}

// 화면 크기나 아래 판 높이가 바뀌면 다시 잰다
function measure(snap = true) {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  aimCamera(yawOf(yawK)); // 집이 정사각형이 아니라서 보는 방향마다 차지하는 범위가 다르다
  camera.matrixWorld.extractBasis(vR, vU, vF);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const x of [X0 - 0.3, X1 + 0.3]) for (const z of [Z0 - 0.3, Z1 + 0.3]) for (const y of [-0.25, Math.max(WALL_H, TREE.top) + 0.15]) {
    vP.set(x, y, z).sub(camera.position);
    const u = vP.dot(vR), v = vP.dot(vU);
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  view.ext = { u0, u1, v0, v1 };
  view.top = $('top').getBoundingClientRect().bottom + 6;
  view.bottom = h - $('bottom').getBoundingClientRect().top + 6;
  view.sFit = Math.max((u1 - u0) / Math.max(60, w - 12), (v1 - v0) / Math.max(60, h - view.top - view.bottom));
  view.zDef = clamp(TARGET_PXU * view.sFit, 1, Z_MAX);
  if (view.zDef < 1.25) view.zDef = 1; // 집 전체가 거의 그 크기로 들어오면 전체를 보여 준다
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
  for (const m of room.inner) m.visible = usingEye(); // 방 사이 벽의 윗부분
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
  measure(false);
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
  if (inside && (hit.x < X0 || hit.x > X1 || hit.z < Z0 || hit.z > Z1)) return null;
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
  for (const a of [me, ...others.values()]) for (const dx of [-BODY_R, BODY_R]) for (const dz of [-BODY_R, BODY_R]) {
    const c = cellOf(a.x + dx, a.z + dz);
    if (!out.some(([i, j]) => i === c[0] && j === c[1])) out.push(c);
  }
  return out;
}
// 아바타에게서 가까운 순서로, 놓을 수 있는 첫 자리
function findSpot(k, r) {
  const [w, d] = footprint(k, r), avoid = myCells();
  let best = null, bestD = Infinity;
  for (let j = 0; j <= NZ - d; j++) for (let i = 0; i <= NX - w; i++) {
    const dist = Math.hypot(X0 + (i + w / 2) * CELL - me.x, Z0 + (j + d / 2) * CELL - me.z);
    if (dist < bestD && canPlace(S, { k, i, j, r }, fixedCell, null, avoid)) { bestD = dist; best = [i, j]; }
  }
  return best;
}
function ghostPaint() {
  const [w, d] = footprint(ghost.k, ghost.r);
  seat(ghost.g, ghost);
  ghost.g.position.y = 0.1;
  ghost.ok = canPlace(S, ghost, fixedCell, ghost.id, myCells());
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
  ghost.i = clamp(Math.round((x - X0) / CELL - w / 2), 0, NX - w);
  ghost.j = clamp(Math.round((z - Z0) / CELL - d / 2), 0, NZ - d);
  ghostPaint();
}
function ghostTurn() {
  if (!ghost) return;
  const [w0, d0] = footprint(ghost.k, ghost.r), cx = ghost.i + w0 / 2, cz = ghost.j + d0 / 2;
  ghost.r = (ghost.r + 1) % 4;
  const [w, d] = footprint(ghost.k, ghost.r);
  ghost.i = clamp(Math.round(cx - w / 2), 0, NX - w); ghost.j = clamp(Math.round(cz - d / 2), 0, NZ - d);
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
// 트리 옆(화면에서 오른쪽 앞)에 가서 선다. 트리를 가리지 않는 자리. 사람마다 자리가 다르다(겹치지 않게).
const TREE_SIDES = [1.0, -1.0, 1.9, -1.9, 2.75, -2.75, 3.14, 1.45];
function standByTree() {
  const a = yawOf(yawK) + TREE_SIDES[mySlot % TREE_SIDES.length]; // 사람마다 다른 쪽에 선다
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

/* ───────── 여럿이 같이 ───────── */
const others = new Map();         // 다른 사람들의 아바타 (이름 → 아바타)
let canEdit = !(cur && cur.view), mySlot = 0; // 내가 꾸밀 수 있는지(구경이면 false), 트리 옆에서 내 자리
let sentAt = 0, sentX = Infinity, sentZ = Infinity; // 친구에게 마지막으로 알린 내 자리
let manualUrl = null;             // 공유도 복사도 안 되는 브라우저에서 직접 복사하게 보여 줄 링크
const okXZ = (x, z) => typeof x === 'number' && typeof z === 'number' && x >= X0 && x <= X1 && z >= Z0 && z <= Z1; // 집 안의 자리인지 (NaN 은 걸러진다)
// 방의 지문: 두 사람의 방이 같은지 견주는 짧은 글자 (놓은 순서가 달라도 같은 방이면 같게 나온다)
function roomHash() {
  const d = serialize(S), byId = (a, b) => (a[0] < b[0] ? -1 : 1);
  // 케이크 장식은 올린 순서가 사람마다 다를 수 있어 자리 순으로 맞춰서 견준다
  const cakes = d.cakes.map(([id, cream, lit, tops]) => [id, cream, lit, tops.map((t) => t.join(',')).sort()]).sort(byId);
  const txt = JSON.stringify([d.items.sort(byId), d.orns.sort(byId), d.lights, d.wall, d.floor, cakes]);
  let h = 5381;
  for (let k = 0; k < txt.length; k++) h = ((h << 5) + h + txt.charCodeAt(k)) | 0;
  return (h >>> 0).toString(36) + '.' + d.items.length + '.' + d.orns.length;
}
// 친구가 보낸 생김새가 아는 값일 때만 받는다 (아니면 null)
function okLook(lk) {
  const c = cleanLook(lk);
  return lk && typeof lk === 'object' && c.gender === lk.gender && c.outfit === lk.outfit ? c : null;
}
const okId = (id) => typeof id === 'string' && /^[a-z0-9]{1,8}$/.test(id);
// 한 사람의 아바타를 만들거나 고친다. 돌려주는 값 = 받아들인 { look, pos }
function setPeer(id, lk, pos) {
  if (!okId(id)) return null;
  const c = okLook(lk);
  let a = others.get(id);
  if (!a) { a = makeAvatar(c || DEFAULT_LOOK); a.place(-1.75, 2.25); a.turnTo(1, 1); a.root.rotation.y = a.face; scene.add(a.root); others.set(id, a); }
  else if (c) a.setLook(c);
  if (Array.isArray(pos) && okXZ(pos[0], pos[1])) { a.stop(); a.place(pos[0], pos[1]); }
  sentX = Infinity; // 내 자리도 다시 알린다
  if (ghost) ghostPaint();
  dirty = true;
  return { look: a.look, pos: [r3(a.x), r3(a.z)] };
}
function dropPeer(id) {
  const a = others.get(id);
  if (!a) return;
  scene.remove(a.root);
  a.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  others.delete(id);
  dirty = true;
  if (ghost) ghostPaint();
}
// 누군가와 같은 자리에 겹쳐 서 있으면 내가 옆으로 비켜선다
function stepAside() {
  for (const a of others.values()) if (Math.hypot(me.x - a.x, me.z - a.z) < 0.6) { goTo(a.x - 1.0 - 0.4 * mySlot, a.z + 0.5); return; }
}
// 꾸밀 수 있는 사람인지에 따라 탭을 보이거나 숨긴다
function paintRole() {
  for (const m of ['furn', 'tree', 'paint']) document.querySelector(`#tabs button[data-m="${m}"]`).hidden = !canEdit;
  $('tabs').style.gridTemplateColumns = `repeat(${canEdit ? 6 : 3}, 1fr)`;
  if (!canEdit && (mode === 'furn' || mode === 'tree' || mode === 'paint')) setMode(null);
}
const FX = { dart: 'number', fire: 'number', music: 'string' };
const duo = makeDuo({
  snapshot: () => ({ state: serialize(S), look, pos: [r3(me.x), r3(me.z)], mine: !!(cur && cur.mine) }),
  hash: roomHash,
  // 손님이 가져온 방을 쓸지 (주인이 묻는다)
  preferPeer: (state, mine) => guestWins({ at: stampOf(state), sync: syncOf(state), mine }, { at: S.at, sync: S.sync, mine: !!(cur && cur.mine) }),
  adopt(state) { loadRoom(state, true); saveSoon(); },
  synced() { if (S.sync !== S.at) { S.sync = S.at; saveSoon(); } }, // 지금 서로의 방이 같다
  setRole(edit, slot) { canEdit = edit; mySlot = slot; paintRole(); },
  peerCount: () => others.size,
  // 주인이 새로 온 사람에게 알려 줄 명단 (그 사람 빼고, 나 포함)
  roster: (except) => [{ id: 'h', look, pos: [r3(me.x), r3(me.z)] }, ...[...others].filter(([id]) => id !== except).map(([id, a]) => ({ id, look: a.look, pos: [r3(a.x), r3(a.z)] }))],
  // 손님이 받은 명단대로 맞춘다
  setRoster(list) {
    const keep = new Set();
    for (const p of list.slice(0, 16)) if (p && okId(p.id) && p.id !== duo.me && setPeer(p.id, p.look, p.pos)) keep.add(p.id);
    for (const id of [...others.keys()]) if (!keep.has(id)) dropPeer(id);
    stepAside();
  },
  peerJoin: (id, m) => setPeer(id, m.look, m.pos) || { look: DEFAULT_LOOK, pos: [0, 0] },
  peerGone: (id) => dropPeer(id),
  peersGone() { for (const id of [...others.keys()]) dropPeer(id); },
  peerOp: (op) => dispatch(op, 'peer'),
  peerLook(id, lk) { const c = okLook(lk), a = others.get(id); if (!a || !c) return null; a.setLook(c); dirty = true; return c; },
  peerPos(id, x, z) {
    const a = others.get(id);
    if (!a || !okXZ(x, z)) return false;
    if (Math.hypot(x - a.x, z - a.z) > 3) a.place(x, z); // 너무 멀어졌으면 바로 옮긴다
    a.walk([[x, z]]);
    return true;
  },
  peerFx(m) { if (!m || typeof m.v !== FX[m.k] || String(m.v).length > 20) return false; play.peerFx(m); return true; },
  peerSay(id, text) { const t = cleanSay(text); if (!t || !others.has(id)) return null; said(id, t); return t; },
  status: () => paintDuo(),
  toast: (m) => toast(m),
});

// 친구 초대: 처음이면 지금 방을 같이 꾸미는 방으로 만들고, 링크를 보낸다. edit = 같이 꾸미기 링크(아니면 구경 링크)
async function invite(edit = true) {
  if (!cur) {
    const id = duo.create();
    cur = { id, mine: true, key: duo.key, view: false };
    store.set(CUR_KEY, cur);
    store.set(slot(), serialize(S));
    history.replaceState(null, '', location.pathname + location.search + '#r=' + id + '-' + cur.key);
  }
  const url = duo.inviteUrl(edit && canEdit);
  manualUrl = null;
  const text = edit && canEdit ? '우리 트리 같이 꾸미자 🎄 눌러서 들어와' : '우리 방 구경 와 🎄 눌러서 들어와';
  try { if (navigator.share) { await navigator.share({ title: '트리 같이 꾸미기', text, url }); return; } }
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
  solo: ['친구들이랑 같이 놀기', `링크를 보내면 친구가 이 방에 들어와요. 같이 꾸미는 사람은 ${ECAP}명까지, 구경까지 모두 ${CAP}명까지.`, ''],
  connecting: ['연결하는 중…', '', '연결 중'],
  waiting: ['친구를 기다리는 중이에요', '링크를 받은 친구가 들어오면 바로 같이 놀아요. 방은 계속 저장돼요.', '친구 기다리는 중'],
  on: ['', '', ''],
  lost: ['연결이 끊겼어요', '방은 그대로예요. 혼자 이어서 꾸밀 수 있어요.', '연결 끊김'],
  full: ['이 방은 지금 꽉 찼어요', '', '방이 찼어요'],
  away: ['방 주인이 지금 없어요', '주인이 방을 열면 구경할 수 있어요. 가끔 다시 가 볼게요.', '주인 없음'],
};
function paintDuo() {
  const m = duo.mode;
  let [main, sub, chip] = DUO_TEXT[m];
  if (m === 'on') {
    main = canEdit ? `${duo.count}명이 같이 있어요 👫` : `구경하는 중이에요 (${duo.count}명이 있어요)`;
    sub = canEdit ? '서로 놓은 것이 바로 보여요.' : '돌아다니고 놀 수 있어요. 방을 꾸미는 것은 꾸미는 사람만 할 수 있어요.';
    chip = canEdit ? `같이 노는 중 · ${duo.count}명` : `구경 중 · ${duo.count}명`;
  }
  $('duoMain').textContent = main; $('duoSub').textContent = sub;
  const share = m === 'solo' || m === 'waiting' || m === 'on';
  $('duoInvite').hidden = !(share && canEdit);
  $('duoInviteV').hidden = !share;
  $('duoRetry').hidden = !(m === 'lost' || m === 'away');
  $('duoLeave').hidden = m === 'solo';
  $('duoLeave').textContent = cur && cur.mine ? '혼자 놀기' : '내 방으로 가기';
  if (!share) manualUrl = null;
  $('duoUrlRow').hidden = !manualUrl;
  if (manualUrl) $('duoUrl').value = manualUrl;
  const net = $('net');
  net.hidden = !chip; net.textContent = chip; net.dataset.m = m;
  document.querySelector('#tabs button[data-m="duo"]').classList.toggle('live', m === 'on');
  if (mode === 'duo') measure(false);
}
$('duoInvite').addEventListener('click', () => invite(true));
$('duoInviteV').addEventListener('click', () => invite(false));
$('duoRetry').addEventListener('click', () => duo.retry());
$('duoLeave').addEventListener('click', leaveRoom);
$('duoUrl').addEventListener('focus', (e) => e.target.select());

// 촛불을 다 껐을 때: 모두의 화면에 축하가 쏟아진다
function celebrate() {
  toast('메리 크리스마스! 🎉');
  const box = $('party');
  for (let k = 0; k < 28; k++) {
    const e = document.createElement('i');
    e.textContent = ['🎉', '✨', '🎄', '⭐', '❄️', '🎁'][k % 6];
    e.style.left = (4 + Math.random() * 92) + '%';
    e.style.animationDelay = (Math.random() * 0.7) + 's';
    e.style.fontSize = (20 + Math.random() * 18) + 'px';
    box.appendChild(e);
    setTimeout(() => e.remove(), 3400);
  }
}

/* ───────── 놀이 (다트, TV, 마시멜로, 오르골, 케이크) ───────── */
const play = makePlay({
  key, store, toast: (m) => toast(m),
  itemObj: (id) => itemObj.get(id),
  hasKind: (k) => { for (const it of S.items.values()) if (it.k === k) return true; return false; },
  aspect: () => eye.aspect,
  cake: (id) => S.cakes.get(id) || newCake(),
  canEdit: () => canEdit,
  op: (o) => dispatch(o),
  // 화면에서 누른 자리가 케이크 윗면의 어디인지
  pickCake(id, px, py) { const g = itemObj.get(id); if (!g) return null; aimRay(px, py); return pickTop(g, ray); },
  // 놀이 중 카메라 자리. inside = 방 안으로 당겨 둔다(벽 뒤로 나가지 않게)
  setPose(p) {
    if (p && p.inside) { p.pos[0] = clamp(p.pos[0], X0 + 0.25, X1 - 0.25); p.pos[2] = clamp(p.pos[2], Z0 + 0.25, Z1 - 0.25); }
    pose = p; applyPov(); dirty = true;
  },
  fx: (m) => duo.fx(m),
  resized: () => { if (mode === 'play') measure(false); },
  close: () => setMode(null),
});
// 놀 수 있는 가구를 누르면: 그 앞으로 걸어가서 놀이를 연다
function startPlay(id) {
  const it = S.items.get(id), kind = it && kindOf(it.k).play, g = itemObj.get(id);
  if (!kind || !g) return false;
  const open = () => { if (S.items.has(id) && mode === null) { setMode('play'); if (!play.start(id, kind)) setMode(null); } };
  g.updateMatrixWorld();
  // 여럿이 같은 가구 앞에 모일 때 겹치지 않게 사람마다 조금씩 옆으로 선다
  const p = g.localToWorld(new THREE.Vector3(0.45 - 0.5 * ((mySlot + 1) >> 1) * (mySlot % 2 ? 1 : -1), 0, kindOf(it.k).d * CELL / 2 + 0.5));
  if (Math.hypot(p.x - me.x, p.z - me.z) < 0.4 || !goTo(p.x, p.z)) open(); else me.onArrive = open;
  return true;
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
  if (mode === 'play') { play.tap(e.clientX, e.clientY); return; }
  if (mode === null) { const id = pickItem(e.clientX, e.clientY); if (id && startPlay(id)) return; } // 놀 수 있는 가구
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
  const step = SPEED * push * dt;
  const nx = clamp(me.x + dx * step, X0 + BODY_R, X1 - BODY_R), nz = clamp(me.z + dz * step, Z0 + BODY_R, Z1 - BODY_R);
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

/* ───────── 채팅: 말풍선과 지난 말 ───────── */
const SAY_MAX = 60, SAY_SHOW = 5.5;  // 한 번에 보낼 수 있는 글자 수, 말풍선이 떠 있는 시간(초)
const bubbles = new Map();           // 누구('me' 또는 이름) → { el, until }
let sayAt = 0;
// 받은 글을 다듬는다: 글만, 한 줄로, 정해진 길이까지
function cleanSay(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SAY_MAX);
}
const nameOf = (who) => (who === 'me' ? '나' : who === 'h' ? '방장' : '친구' + (parseInt(who.slice(1), 36) || ''));
// 누가 말했다: 말풍선을 띄우고 지난 말에 적는다
function said(who, text) {
  let b = bubbles.get(who);
  if (!b) { b = { el: document.createElement('div'), until: 0 }; b.el.className = 'bub'; $('bubbles').appendChild(b.el); bubbles.set(who, b); }
  b.el.textContent = text; b.until = clock + SAY_SHOW;
  const log = $('chatLog'), ln = document.createElement('div'), nm = document.createElement('b');
  if (log.firstElementChild && log.firstElementChild.classList.contains('none')) log.textContent = '';
  ln.className = 'ln' + (who === 'me' ? ' me' : ''); nm.textContent = nameOf(who);
  ln.append(nm, ' ' + text);
  log.appendChild(ln);
  while (log.childElementCount > 40) log.firstElementChild.remove();
  log.scrollTop = log.scrollHeight;
  if (mode !== 'chat' && who !== 'me') document.querySelector('#tabs button[data-m="chat"]').classList.add('new'); // 안 읽은 말이 있다는 표시
}
function say(raw) {
  const text = cleanSay(raw);
  if (!text) return false;
  if (clock - sayAt < 0.6) { toast('조금 천천히 보내 주세요'); return false; }
  sayAt = clock;
  said('me', text);
  duo.say(text);
  return true;
}
$('chatForm').addEventListener('submit', (e) => { e.preventDefault(); const i = $('chatIn'); if (say(i.value)) i.value = ''; });
// 말풍선을 말한 사람 머리 위에 붙인다
const bv = new THREE.Vector3();
function placeBubbles() {
  for (const [who, b] of bubbles) {
    const a = who === 'me' ? me : others.get(who);
    if (!a || clock > b.until || (who === 'me' && usingEye())) { if (b.el.style.display !== 'none') b.el.style.display = 'none'; if (!a && who !== 'me') { b.el.remove(); bubbles.delete(who); } continue; }
    bv.set(a.x, 1.72, a.z).project(cam());
    if (bv.z > 1 || bv.z < -1) { b.el.style.display = 'none'; continue; } // 카메라 뒤
    b.el.style.display = '';
    b.el.style.transform = `translate(${(bv.x + 1) / 2 * window.innerWidth}px, ${(1 - bv.y) / 2 * window.innerHeight}px) translate(-50%, -100%)`;
  }
}
// 폰 키보드가 올라오면 아래 판을 키보드 위로 올린다
if (window.visualViewport) {
  const lift2 = () => { const vv = window.visualViewport, d = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); $('bottom').style.transform = d > 40 ? `translateY(${-d}px)` : ''; };
  window.visualViewport.addEventListener('resize', lift2); window.visualViewport.addEventListener('scroll', lift2);
}
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

const PANELS = { furn: 'furn', tree: 'treeP', paint: 'paint', look: 'look', duo: 'duoP', play: 'playP', chat: 'chatP' };
function setMode(m) {
  if (m === mode) m = null; // 같은 탭을 다시 누르면 닫는다
  if (ghost) ghostCancel();
  const was = mode;
  if (was === 'play') play.stop();
  mode = m;
  $('tabs').hidden = m === 'play'; $('tools').hidden = m === 'play'; // 놀이 중에는 놀이 판만 보인다
  for (const k in PANELS) $(PANELS[k]).hidden = k !== m;
  for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-pressed', String(b.dataset.m === m));
  itemsG.visible = m !== 'tree'; // 트리를 꾸밀 때는 가구가 트리를 가리지 않게 잠깐 숨긴다
  if (m === 'tree') { standByTree(); toast('트리를 눌러 장식을 달아요'); }
  if (m === 'look') { me.stop(); me.onArrive = null; faceCamera(); }
  if (m === 'chat') { document.querySelector('#tabs button[data-m="chat"]').classList.remove('new'); const l = $('chatLog'); l.scrollTop = l.scrollHeight; }
  if (was === 'chat') $('chatIn').blur();
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
  for (const a of others.values()) if (a.step(dt) || a.blend > 0.01) dirty = true;
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
  for (const id of S.cakes.keys()) { const c = S.cakes.get(id); if (c.lit > 0 && itemObj.has(id)) flicker(itemObj.get(id), clock); }
  placeBubbles();
  play.tick(dt);

  if (dirty) { renderer.shadowMap.needsUpdate = true; dirty = false; }
  renderer.render(scene, cam());
  frames++;
}

/* ───────── 시작 ───────── */
{
  const saved = cur && cur.view ? null : store.get(slot()); // 지난번에 꾸민 방 (구경하는 방은 주인에게서 받는다)
  loadRoom(saved);
  // 처음 시작하는 내 방에는 놀 수 있는 가구를 놓아 둔다. 꾸민 것으로 치지 않는다(at 은 0 그대로).
  // 주방과 방의 기본 가구는 거실만 있던 때(v 1)에 꾸민 방을 열 때도 더해 준다.
  // window.__bare 는 자동 검사에서 빈 방으로 시작할 때만 쓴다.
  if (!window.__bare) {
    if (!saved && !cur) STARTER.forEach(([k, i, j, r], n) => dispatch({ t: 'put', id: 'base' + n, k, i, j, r }, 'load'));
    if ((!saved && !cur) || (saved && saved.v === 1)) STARTER_EAST.forEach(([k, i, j, r], n) => dispatch({ t: 'put', id: 'east' + n, k, i, j, r }, 'load'));
  }
}
addEventListener('resize', () => measure());
addEventListener('orientationchange', () => setTimeout(measure, 200));
faceCamera(); me.root.rotation.y = me.face; // 처음에는 화면 쪽을 본다
showWalls();
paintPanels();
if (savedLook) measure(); else setMode('look'); // 처음 온 사람은 캐릭터부터 고른다
applyPov();
addEventListener('hashchange', () => location.reload()); // 다른 방 링크를 열면 새로 시작한다
paintRole();
if (cur) duo.start(cur.id, { key: cur.key, want: cur.view ? 'view' : 'edit' }); else paintDuo();
view.snap = true; updateView(0);
requestAnimationFrame(frame);
const loading = $('loading');
if (loading) { loading.classList.add('done'); setTimeout(() => loading.remove(), 500); }

// 자동 검사가 쓰는 창구
window.__duo = {
  get mode() { return duo.mode; }, get role() { return duo.role; }, get room() { return duo.room; }, get mine() { return cur ? cur.mine : null; },
  get canEdit() { return canEdit; }, get count() { return duo.count; }, get me() { return duo.me; }, get editors() { return duo.editors; }, get slot() { return mySlot; },
  get others() { return [...others].map(([id, a]) => ({ id, x: a.x, z: a.z, look: a.look, moving: a.moving })); },
  say, cleanSay, get bubbles() { return [...bubbles].filter(([, b]) => b.el.style.display !== 'none').map(([who, b]) => { const r = b.el.getBoundingClientRect(); return { who, text: b.el.textContent, x: r.left + r.width / 2, y: r.bottom }; }); },
  get chatLog() { return [...document.querySelectorAll('#chatLog .ln')].map((l) => l.textContent); },
  get other() { const a = others.values().next().value; return a ? { x: a.x, z: a.z, look: a.look, moving: a.moving } : null; },
  inviteUrl: (edit) => duo.inviteUrl(edit !== false && canEdit), invite, leaveRoom, hash: roomHash, feed: (m, pid) => duo.feed(m, pid),
  rawOp: (op) => duo.op(op), // 화면의 막음을 건너뛰고 변화를 보내 본다 (주인이 걸러 내는지 검사용)
  rawSay: (t) => duo.say(t),
};
window.__play = Object.assign(play.test, {
  start: (id) => startPlay(id), // 가구 앞으로 걸어가서 연다
  open(id) { const it = S.items.get(id); if (mode !== null) setMode(null); setMode('play'); return play.start(id, kindOf(it.k).play); }, // 걷지 않고 바로 연다
  close: () => setMode(null), peerFx: (m) => play.peerFx(m),
});
Object.defineProperties(window.__play, { on: { get: () => play.on }, posed: { get: () => !!pose } });
window.__tree = {
  NX, NZ, CELL, HALF: 4, box: { x0: X0, x1: X1, z0: Z0, z1: Z1 }, grid, me, room, S, goTo, screenOf, floorAt, turnView, lowerQuality, setLook, zoomBy, dispatch, setMode,
  ghostNew, ghostPick, ghostMoveTo, ghostTurn, ghostDone, ghostCancel, ghostRemove, surfaceR, serialize: () => serialize(S),
  setZoomMul(m) { setZoomMul(m); },
  openLook(on) { if ((mode === 'look') !== on) setMode('look'); },
  // 트리 겉면의 한 점(높이 y, 둘레 각 a)이 화면에서 어디인지
  treePoint(y, a) { const r = surfaceR(y) * 0.93; return screenOf(Math.sin(a) * r, Math.cos(a) * r, y); },
  cakeTops: (id) => { const g = itemObj.get(id); return g && g.userData.cake ? g.userData.cake.tops.children.length : -1; },
  snapView() { view.snap = true; updateView(0); }, // 화면이 자리를 잡는 움직임을 바로 끝낸다 (검사에서 누를 자리를 구하기 전에)
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
