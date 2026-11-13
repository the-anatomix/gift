// 놀자방 · 트리 같이 꾸미기
// 1단계: 거실, 비스듬히 내려다보는 카메라, 아바타 걷기와 고르기
// 2단계: 가구 놓기·옮기기, 벽지·바닥, 트리 장식과 전구
// 정적 파일만 쓴다.
import { THREE } from './kit.js';
import { Grid, NX, NZ, CELL, X0, Z0, X1, Z1, GX, GZ, GX1, GZ1, LEVELS, FLOOR_H, FLOOR_DX, LADDERS, cellOf, centerOf, levelOf, levelOfCell, zoneOf, toWorld } from './path.js';
import { buildRoom, WALL_H, TREE, FRONT, fixedCell, noBuild, surfaceR } from './room.js';
import { makeWardrobe, HOST_OUTFIT } from './costume.js';
import { makeFly } from './fly.js';
import { makeAvatar, cleanLook, DEFAULT_LOOK, GENDERS, OUTFITS, FACES, ACTS, BODY_R, SPEED } from './avatar.js';
import { FURNITURE, ORNAMENTS, LIGHT_SETS, BLINKS, WALLS, FLOORS, MAX_ITEMS, MAX_ORNS, STARTER, STARTER_EAST, STARTER_UP, CAKE } from './catalog.js';
import { makeState, apply, setLockFree, canPlace, footprint, cellsOf, kindOf, serialize, ops, stampOf, syncOf, guestWins, newCake, benchOf, cakesList, cakeAtBench, cakeOnTable, sendHome, notesList } from './state.js';
import { buildItem } from './furniture.js';
import { buildOrnament, buildLights } from './decor.js';
import { makeDuo, ROOM_RE, CAP, ECAP, DOOR } from './duo.js';
import { buildOutside } from './door.js';
import { makeMedia } from './media.js';
import { makePlay } from './play.js';
import { makeBook } from './book.js';
import { makeParty } from './party.js';
import { makeSnow } from './snow.js';
import { makeCoop } from './coop.js';
import { makeGames } from './games.js';
import { makeSky } from './sky.js';
import { makeMaster, can, LOCK, FIRE } from './master.js';
import { makeAdvent } from './advent.js';
import { makeGift } from './gift.js';
import { makeFoodPlay } from './food.js';
import { makeCheers } from './cheers.js';
import { sfx, sfxOp, sfxWalk, mountSfxUI } from './sfx.js';
import { makeCakeView, dressCake, flicker, pickTop, disposeCakeView } from './cake.js';

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
// 해는 집과 마당의 한가운데를 비춘다. 그림자는 집과 마당 전체를 덮는다.
const CX = (X0 + X1) / 2, CZ = (Z0 + GZ1) / 2, SH = Math.max(X1 - X0, GZ1 - Z0) / 2 + 3;
sun.position.set(CX + 5, 18, CZ + 9); sun.target.position.set(CX, 0, CZ); scene.add(sun.target);
sun.shadow.camera.left = -SH; sun.shadow.camera.right = SH; sun.shadow.camera.top = SH; sun.shadow.camera.bottom = -SH;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 46; // 3층 꼭대기에서 마당 끝까지
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
scene.add(sun);
const glow = new THREE.PointLight(0xFFC27A, 1.6, 6, 1.6); // 트리 둘레의 은은한 빛. 전구를 켜면 더 밝아진다
const snowG = new THREE.Group(); scene.add(snowG); // 마당 눈덩이. 위층에 있을 때는 숨긴다
glow.position.set(0, 1.3, 0);
scene.add(glow);

/* ───────── 방, 아바타, 방 상태 ───────── */
// 저장 이름. ?ns=이름 은 자동 검사에서 한 브라우저 안의 두 사람을 가르는 데만 쓴다.
const NS = (new URLSearchParams(location.search).get('ns') || '').replace(/[^a-z0-9]/g, '').slice(0, 8);
const key = (k) => 'nolja-tree-' + k + (NS ? '.' + NS : '');
const LOOK_KEY = key('look'), ROOM_KEY = key('room'), CUR_KEY = key('cur'), POV_KEY = key('pov'), DEV_KEY = key('dev');
// 기기마다 만든 이름: 방장이 들인 친구와 내보낸 사람을 가리는 데 쓴다
let dev = store.get(DEV_KEY);
if (typeof dev !== 'string' || !/^[a-z0-9]{6,24}$/.test(dev)) { dev = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join(''); store.set(DEV_KEY, dev); }
// 같이 꾸미는 방: 주소의 #r=방이름-열쇠(같이 꾸미기) 또는 #v=방이름(구경).
// cur = 이 기기가 지금 들어가 있는 방 { id, mine(내가 만든 방인지), key(꾸밀 수 있는 열쇠), view(구경으로 들어왔는지) }.
// 방마다 따로 저장한다(혼자 꾸민 내 방은 ROOM_KEY, 같이 꾸미는 방은 ROOM_KEY-방이름). 구경하는 방은 저장하지 않는다.
let cur = store.get(CUR_KEY);
if (!cur || typeof cur !== 'object' || !ROOM_RE.test(cur.id || '')) cur = null;
else {
  const devs = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && /^[a-z0-9]{6,24}$/.test(x)).slice(-60) : []);
  // banned = 내가 방장일 때 내보낸 사람들 (기기 이름). friends 는 예전에 쓰던 것(들인 친구)이라 지금은 보지 않는다
  cur = { id: cur.id, mine: cur.mine === true, key: typeof cur.key === 'string' ? cur.key : '', view: cur.view === true, friends: devs(cur.friends), banned: devs(cur.banned) };
}
{
  const m = /^#r=([a-z0-9]{6,20})(?:-([a-z0-9]{4,12}))?$/.exec(location.hash), v = /^#v=([a-z0-9]{6,20})$/.exec(location.hash);
  const id = m ? m[1] : v ? v[1] : null;
  if (id && (!cur || cur.id !== id)) { // 다른 방의 링크로 들어옴
    if (cur) store.del(ROOM_KEY + '-' + cur.id);
    cur = { id, mine: false, key: m ? m[2] || '' : '', view: !m, friends: [], banned: [] };
    store.set(CUR_KEY, cur);
  } else if (m && cur && cur.view) { // 구경하던 방의 꾸미기 링크를 받음
    cur = { id, mine: false, key: m[2] || '', view: false, friends: cur.friends, banned: cur.banned };
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
scene.add(itemsG); room.g0.add(ornG); // 트리 장식과 전구는 1층의 것
const itemObj = new Map(), ornObj = new Map();
const bulbs = buildLights(room.g0);
const pops = [];                 // 방금 단 장식이 톡 튀어나오는 몸짓
const myTag = Math.random().toString(36).slice(2, 5).padEnd(3, '0');
let seq = 0;
const newId = () => myTag + (seq++).toString(36);

let dirty = true;                // 그림자를 다시 그려야 하는지
let saveK = 0;
// 기기에 남기는 모양. up = 마당과 2층의 기본 가구를 이미 놓아 본 방이라는 표시
const forDisk = () => ({ ...serialize(S), up: 1 });
const saveSoon = () => { clearTimeout(saveK); if (cur && cur.view) return; saveK = setTimeout(() => store.set(slot(), forDisk()), 300); }; // 구경하는 방은 내 기기에 남기지 않는다

// 걸을 수 있는 칸을 다시 계산한다 (트리 + 놓인 가구)
function rebuildGrid() {
  grid.b.fill(0);
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) if (fixedCell(i, j)) grid.block(i, j);
  for (const it of S.items.values()) if (kindOf(it.k).solid) for (const [i, j] of cellsOf(it)) grid.block(i, j);
  if (!grid.fits(me.x, me.z, BODY_R)) { // 내 자리에 가구가 놓였으면 가까운 빈칸으로 비켜선다
    const [i, j] = cellOf(me.x, me.z), c = grid.nearestFree(i, j, me.x, me.z);
    if (c) me.place(...centerOf(c[0], c[1]));
  }
  if (me.path.length) { const [tx, tz] = me.path[me.path.length - 1]; const f = me.onArrive; me.stop(); if (goTo(tx, tz)) me.onArrive = f; }
}
function seat(g, it) {
  const [w, d] = footprint(it.k, it.r), p = toWorld(X0 + (it.i + w / 2) * CELL, Z0 + (it.j + d / 2) * CELL); // 2층에 놓인 가구는 위로 올라간다
  g.position.set(p[0], p[1], p[2]);
  g.rotation.y = it.r * Math.PI / 2;
}
function dropObj(map, id, parent, own) {
  const g = map.get(id);
  if (!g) return;
  parent.remove(g); map.delete(id);
  for (const v of cakeObj.values()) if (v.root.parent === g) g.remove(v.root); // 그 위에 놓인 케이크 모양은 따로 다룬다(syncCakes)
  if (own) g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); // 장식은 도형을 나눠 쓰므로 지우지 않는다
}

const MK_OPS = ['put', 'orn', 'lights', 'wall', 'floor'];
// 방의 모든 변화는 여기를 지난다. from = 'me'(내가 함) | 'peer'(친구가 함) | 'load'(저장된 방을 여는 중)
function dispatch(op, from = 'me') {
  if (from === 'load') { setLockFree(true); try { return dispatch(op, 'load2'); } finally { setLockFree(false); } }
  if (from === 'load2') from = 'load';
  else if (from === 'me' && op && MK_OPS.includes(op.t) && can(LOCK)) op = { ...op, mk: 1 }; // 마스터키: 어드벤트 잠금 없이 (state.js 의 locked)
  if (op && op.t === 'cakeSet' && from !== 'load') return false; // 저장된 방을 풀 때만 쓰는 변화
  if (from === 'me' && !canEdit && op && op.t === 'star' && op.on === true) from = 'view'; // 꼭대기 별 달기는 구경하는 사람도 된다 (coop.js)
  if (from === 'me' && !canEdit && op && (op.t === 'gift' || op.t === 'giftOpen')) from = 'mine'; // 트리 밑 선물은 구경하는 사람도 두고 연다 (gift.js)
  if (from === 'me' && !canEdit && op && op.t === 'snowman') { canEdit = true; try { return dispatch(op, from); } finally { canEdit = false; } } // 마당에서 같이 만든 눈사람은 구경하는 사람도 놓는다 (snowman.js)
  if (from === 'me' && !canEdit && !(op && (op.t === 'cakeBlow' || op.t === 'cakeEat' || op.t === 'note' || op.t === 'best'))) { toast('구경하는 중에는 꾸밀 수 없어요'); return false; } // 촛불 불기, 케이크 먹기, 방명록 남기기, 이 방 최고 기록은 구경하는 사람도 된다
  const wasLit = op && typeof op.t === 'string' && op.t.startsWith('cake') && S.cakes.get(op.id) ? S.cakes.get(op.id).lit : 0;
  // 내가 들고 있는 가구를 친구가 옮기거나 치웠으면 손에서 내려놓는다
  const taken = from === 'peer' && ghost && ghost.id && op && ghost.id === op.id && (op.t === 'del' || op.t === 'move');
  if (!apply(S, op, noBuild)) return false;
  if (taken) ghost = null;
  if (op.t === 'snowman') { const g = buildItem('snowman'); g.userData.item = op.id; seat(g, S.items.get(op.id)); itemsG.add(g); itemObj.set(op.id, g); paintLevels(); rebuildGrid(); } // 마당에서 같이 만든 눈사람: 보통 가구 눈사람으로 놓인다
  let eaten = false; // 이번에 케이크를 다 먹었는지
  if (op.t === 'put') {
    const g = buildItem(op.k);
    g.userData.item = op.id;
    seat(g, S.items.get(op.id));
    itemsG.add(g); itemObj.set(op.id, g);
    if (op.k === 'cake') syncCakes();
    paintLevels();
  } else if (op.t.startsWith('cake')) {
    const k = S.cakes.get(op.id);
    eaten = op.t === 'cakeEat' && (!k || k.gone);
    syncCakes(op.id);
    if (from !== 'load') {
      play.refresh(op.id);
      if (wasLit > 0 && k && k.lit === 0 && op.t === 'cakeBlow') celebrate(); // 마지막 촛불이 꺼졌다
    }
  } else if (op.t === 'move') { seat(itemObj.get(op.id), S.items.get(op.id)); paintLevels(); }
  else if (op.t === 'del') { dropObj(itemObj, op.id, itemsG, true); syncCakes(); } // 치운 탁자 위의 케이크는 작업대로 돌아가 있다
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
  if (op.t === 'move' || op.t === 'del') restCheck(op.id); // 누워 있던 침대가 옮겨지거나 치워졌으면 일어난다
  dirty = true;
  if (op.t === 'adv') advent.onOp(op, from); else if (op.t.startsWith('gift')) gift.onOp(op, from); // 어드벤트 달력, 트리 밑 선물
  if (from === 'load') return true;
  sfxOp(op, from, (o) => itemObj.get(o.id)); // 효과음 (sfx.js)
  if (op.t === 'note' || op.t === 'noteDel' || op.t === 'best') book.onOp(op, from); // 방명록과 이 방 최고 기록
  coop.onOp(op, from); // 꼭대기 별, 둘이 든 큰 가구 (coop.js)
  if (mode === 'play' && play.id === op.id && (op.t === 'del' || op.t === 'move')) setMode(null); // 놀던 가구를 친구가 옮기거나 치움
  // 꾸미던 케이크를 누가 들고 갔거나, 케이크가 놓인 탁자를 옮기거나 치움
  if (mode === 'play' && play.kind === 'cake' && (((op.t === 'cakeTake' || op.t === 'cakeDrop' || eaten) && play.id === op.id) || ((op.t === 'del' || op.t === 'move') && play.spot === op.id))) setMode(null);
  if (eaten) toast('케이크를 다 먹었어요! 오븐에서 새로 구울 수 있어요 🍰');
  S.at = Date.now();
  saveSoon();
  if (taken) ghostEnd(); else { if (ghost) ghostPaint(); paintPanels(); }
  if (from === 'me') duo.op(op);
  if (from === 'view') duo.op(op); // 구경하는 사람이 단 별
  if (from === 'mine') duo.op(op); // 구경하는 사람이 둔 선물
  return true;
}

// 방을 통째로 바꾼다 (저장된 방을 열 때, 친구의 방을 받아올 때). fromPeer = 친구에게서 받은 방(받는 순간 둘이 같다)
function loadRoom(data, fromPeer = false) {
  if (mode === 'play') setMode(null);
  if (ghost) ghostCancel();
  for (const v of cakeObj.values()) disposeCakeView(v);
  cakeObj.clear();
  for (const id of [...itemObj.keys()]) dropObj(itemObj, id, itemsG, true);
  for (const id of [...ornObj.keys()]) dropObj(ornObj, id, ornG, false);
  pops.length = 0;
  Object.assign(S, makeState());
  bulbs.set(S.lights.set, S.lights.blink); glow.intensity = 1.6;
  room.setWall(S.wall); room.setFloor(S.floor);
  // 예전에 놓은 가구가 지금은 비워 둬야 하는 칸(사다리 앞, 현관)에 걸려 있으면 가까운 자리로 옮겨 놓는다
  // (그 칸만 아니면 놓을 수 있었던 가구만 옮긴다. 격자 밖이거나 다른 가구와 겹치는 것은 예전처럼 버린다)
  for (const op of ops(data)) if (!dispatch(op, 'load') && op.t === 'put' && !S.items.has(op.id) && canPlace(S, op, fixedCell) && !canPlace(S, op, noBuild)) {
    const spot = findSpot(op.k, op.r, X0 + op.i * CELL, Z0 + op.j * CELL, []);
    if (spot) dispatch({ ...op, i: spot[0], j: spot[1] }, 'load');
  }
  S.at = stampOf(data);
  S.sync = fromPeer ? S.at : syncOf(data);
  if (!fromPeer) for (const [id, c] of [...S.cakes]) if (c.by) sendHome(S, id); // 저장해 둔 방을 열 때는 아무도 케이크를 들고 있지 않다
  syncCakes();
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
  // 내가 있는 층이 차지하는 범위: 집 한 층, 1층이면 마당까지
  const y0 = myLv * FLOOR_H, boxes = [[Z0 - 0.3, Z1 + 0.3, Math.max(WALL_H, myLv ? 0 : TREE.top) + 0.15]];
  if (!myLv) boxes.push([Z1, GZ1 + 0.45, 1.6]);
  for (const [za, zb, top] of boxes) for (const x of [X0 - 0.45, X1 + 0.45]) for (const z of [za, zb]) for (const y of [y0 - 0.25, y0 + top]) {
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
  $('act').style.bottom = (view.bottom + 8) + 'px';
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
  if (mode === 'emo') z = Math.max(z, Math.min(Z_MAX, 84 * view.sFit));   // 표정과 행동이 보이게
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
  if (tree) vP.set(0, 1.42, 0); else vP.set(me.root.position.x, me.root.position.y + 0.75, me.root.position.z);
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
  paintLevels();
  for (const m of room.inner) m.visible = usingEye(); // 방 사이 벽의 윗부분
  const dx = Math.sin(yaw), dz = Math.cos(yaw), e = usingEye(); // 1인칭에서는 네 면과 천장이 다 보인다
  for (const f of room.floors) {
    f.ceil.visible = e;
    f.walls.w.upper.visible = e || dx > 0.02;
    f.walls.e.upper.visible = e || dx < -0.02;
    f.walls.n.upper.visible = e || dz > 0.02;
    f.walls.s.upper.visible = e || dz < -0.02;
  }
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
// fp = 1인칭을 골랐는지. 캐릭터를 고르거나 표정·행동을 고를 때는 내 모습이 보여야 하므로 잠깐 내려다보는 시점으로 돌아간다.
// pose = 놀이(다트·TV …) 중에 고정된 카메라 자리 { pos: [x, y, z], at: [x, y, z], fov }
const eye = new THREE.PerspectiveCamera(70, 1, 0.05, 80);
const EYE_H = 1.18;              // 눈높이
let fp = store.get(POV_KEY) === 'fp';
let fy = Math.PI, fpitch = -0.08, fpFov = 70; // 보는 방향: 바닥에서 (-sin fy, -cos fy) 쪽, fpitch 만큼 위로
let pose = null;
const joy = { x: 0, y: 0 };      // 조이스틱 (-1 ~ 1)
function usingEye() { return !!pose || (fp && mode !== 'look' && mode !== 'emo'); }
const cam = () => (usingEye() ? eye : camera);
function updateEye() {
  const w = window.innerWidth, h = window.innerHeight;
  if (pose) { eye.position.set(pose.pos[0], pose.pos[1], pose.pos[2]); eye.fov = pose.fov || 60; eye.lookAt(pose.at[0], pose.at[1], pose.at[2]); }
  else {
    // 눈은 내 머리 자리에 (2층이면 위에, 누워 있으면 베개 위에)
    const c = Math.cos(fpitch), p = me.root.position, r = me.rest;
    const ex = r ? r.head[0] : p.x, ey = r ? r.head[1] + 0.32 : p.y + EYE_H, ez = r ? r.head[2] : p.z;
    eye.position.set(ex, ey, ez);
    eye.fov = Math.min(95, fpFov * (w < h ? 1.25 : 1)); // 세로 화면은 좌우가 좁으니 조금 더 넓게 본다
    eye.lookAt(ex - Math.sin(fy) * c, ey + Math.sin(fpitch), ez - Math.cos(fy) * c);
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
  if (fp) { fy = Math.atan2(me.root.position.x, me.root.position.z); fpitch = -0.06; } // 처음에는 방 한가운데(트리) 쪽을 본다
  applyPov();
  if (fp && mode === 'tree') lookAtTree();
  toast(fp ? '1인칭으로 보는 중. 화면을 끌어서 둘러봐요' : '내려다보는 중');
}
function lookAtTree() { fy = Math.atan2(me.x, me.z); fpitch = 0.06; }

/* ───────── 층: 1층(과 마당), 2층, 3층 ───────── */
// 내가 있는 층만 보인다: 그 층의 바닥과 벽, 그 층에 놓인 가구, 그 층에 있는 사람. myLv = 내가 있는 층(0 = 1층)
let myLv = 0;
const floorOf = (a) => (a.fly ? a.level : clamp(Math.round(a.root.position.y / FLOOR_H), 0, LEVELS - 1)); // 나는 사람은 발밑의 층으로 친다 (fly.js) // 사다리를 반쯤 오르면 위층으로 친다
function paintLevels() {
  room.showFloor(myLv);
  for (const [id, g] of itemObj) { const it = S.items.get(id); g.visible = !it || levelOfCell(it.i) === myLv; }
  if (ghost) ghost.g.visible = true;
  for (const a of others.values()) a.root.visible = floorOf(a) === myLv;
  glow.visible = myLv === 0;
  snowG.visible = myLv === 0;
  dirty = true;
}

/* ───────── 걷기 ───────── */
function goTo(x, z) {
  if (fly.on && fly.goTo(x, z)) return true; // 나는 중에는 그쪽으로 날아간다 (fly.js)
  if (me.hop) return false; // 사다리를 타는 중에는 끝까지 간다
  const pts = grid.route(me.x, me.z, x, z);
  me.onArrive = null;
  if (!pts || !pts.length) return false;
  if (me.rest) getUp();
  me.walk(pts);
  const [tx, tz] = pts[pts.length - 1], w = toWorld(tx, tz);
  pin.position.set(w[0], w[1] + 0.045, w[2]); pinT = 1;
  return true;
}

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
const upPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function aimRay(px, py) {
  ndc.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, cam());
}
// 화면의 한 점이 가리키는 바닥 자리(격자의 자리): 내가 있는 층의 바닥에서 잰다. inside = true 면 집 안(1층이면 마당까지)일 때만.
function floorAt(px, py, inside = true) {
  aimRay(px, py);
  if (myLv) { // 위층
    upPlane.constant = -myLv * FLOOR_H;
    if (!ray.ray.intersectPlane(upPlane, hit)) return null;
    if (inside && (hit.x < X0 || hit.x > X1 || hit.z < Z0 || hit.z > Z1)) return null;
    return { x: clamp(hit.x, X0, X1 - 1e-3) + myLv * FLOOR_DX, z: hit.z };
  }
  if (!ray.ray.intersectPlane(ground, hit)) return null;
  if (inside && (hit.x < X0 || hit.x > X1 || hit.z < Z0 || hit.z > GZ1)) return null;
  return { x: Math.min(hit.x, X1 - 1e-3), z: hit.z }; // 집 동쪽 밖은 격자에서 위층 자리라서 넘어가지 않게 한다
}
// 격자의 자리 (x, z), 바닥에서 높이 y 인 점이 화면의 어디인지
function screenOf(x, z, y = 0) {
  const w = toWorld(x, z), v = new THREE.Vector3(w[0], w[1] + y, w[2]).project(cam());
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
// (x, z) 에서 가까운 순서로, 놓을 수 있는 첫 자리 (같은 층에서 찾는다). 기본은 내 옆
function findSpot(k, r, x = me.x, z = me.z, avoid = myCells()) {
  const [w, d] = footprint(k, r), lv = levelOf(x);
  let best = null, bestD = Infinity;
  for (let j = 0; j <= GZ - d; j++) for (let i = 0; i <= GX - w; i++) {
    if (levelOfCell(i) !== lv) continue;
    const dist = Math.hypot(X0 + (i + w / 2) * CELL - x, Z0 + (j + d / 2) * CELL - z);
    if (dist < bestD && canPlace(S, { k, i, j, r }, noBuild, null, avoid)) { bestD = dist; best = [i, j]; }
  }
  return best;
}
function ghostPaint() {
  const [w, d] = footprint(ghost.k, ghost.r);
  seat(ghost.g, ghost);
  ghost.y = ghost.g.position.y; // 놓일 바닥의 높이 (2층이면 위)
  ghost.g.position.y = ghost.y + 0.1;
  ghost.g.visible = true;
  ghost.ok = canPlace(S, ghost, noBuild, ghost.id, myCells());
  plate.visible = true;
  plate.scale.set(w * CELL, 1, d * CELL);
  plate.position.set(ghost.g.position.x, ghost.y + 0.05, ghost.g.position.z);
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
  ghost = { k, r: 0, i: spot[0], j: spot[1], id: null, g, ok: true }; sfx('lift');
  ghostPaint(); paintPanels(); measure(false);
}
function ghostPick(id) {
  ghostCancel();
  const it = S.items.get(id);
  ghost = { k: it.k, r: it.r, i: it.i, j: it.j, id, g: itemObj.get(id), ok: true }; sfx('lift');
  ghostPaint(); paintPanels(); measure(false);
}
function ghostMoveTo(x, z) {
  const [w, d] = footprint(ghost.k, ghost.r);
  ghost.i = clamp(Math.round((x - X0) / CELL - w / 2), 0, GX - w);
  ghost.j = clamp(Math.round((z - Z0) / CELL - d / 2), 0, GZ - d);
  ghostPaint();
}
function ghostTurn() {
  if (!ghost) return;
  sfx('turn');
  const [w0, d0] = footprint(ghost.k, ghost.r), cx = ghost.i + w0 / 2, cz = ghost.j + d0 / 2;
  ghost.r = (ghost.r + 1) % 4;
  const [w, d] = footprint(ghost.k, ghost.r);
  ghost.i = clamp(Math.round(cx - w / 2), 0, GX - w); ghost.j = clamp(Math.round(cz - d / 2), 0, GZ - d);
  ghostPaint();
}
function ghostEnd() { ghost = null; plate.visible = false; dirty = true; paintPanels(); paintLevels(); measure(false); }
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
const okXZ = (x, z) => typeof x === 'number' && typeof z === 'number' && x >= X0 && x <= GX1 && z >= Z0 && z <= GZ1; // 격자 안의 자리인지 (NaN 은 걸러진다)
// 방의 지문: 두 사람의 방이 같은지 견주는 짧은 글자 (놓은 순서가 달라도 같은 방이면 같게 나온다)
function roomHash() {
  const d = serialize(S), byId = (a, b) => (a[0] < b[0] ? -1 : 1);
  // 케이크 장식은 올린 순서가 사람마다 다를 수 있어 자리 순으로 맞춰서 견준다
  const cakes = d.cakes.map((r) => [r[0], r[1], r[2], r[3].map((t) => t.join(',')).sort(), r[4] || '', r[5] || '', ...r.slice(6)]).sort(byId);
  const txt = JSON.stringify([d.items.sort(byId), d.orns.sort(byId), d.lights, d.wall, d.floor, cakes, d.notes.sort(byId), Object.keys(d.best).sort().map((k) => [k, ...d.best[k]])]);
  let h = 5381;
  for (let k = 0; k < txt.length; k++) h = ((h << 5) + h + txt.charCodeAt(k)) | 0;
  return (h >>> 0).toString(36) + '.' + d.items.length + '.' + d.orns.length;
}
// 친구가 보낸 생김새가 아는 값일 때만 받는다 (아니면 null)
function okLook(lk, id) {
  let c = cleanLook(lk);
  if (c.outfit === HOST_OUTFIT && id !== 'h') c = { ...c, outfit: 'basic' }; // 비행 슈트는 방장 것만 받는다
  return lk && typeof lk === 'object' && c.gender === lk.gender && cleanLook(lk).outfit === lk.outfit && (lk.face === undefined || c.face === lk.face) ? c : null; // 표정이 없던 때의 것도 받는다
}
const okId = (id) => typeof id === 'string' && /^[a-z0-9]{1,8}$/.test(id);
// 한 사람의 아바타를 만들거나 고친다. 돌려주는 값 = 받아들인 { look, pos }
const okPj = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
function setPeer(id, lk, pos, pj) {
  if (!okId(id)) return null;
  const c = okLook(lk, id);
  let a = others.get(id);
  if (!a) { a = makeAvatar(c || DEFAULT_LOOK); a.place(-1.75, 2.25); a.turnTo(1, 1); a.root.rotation.y = a.face; scene.add(a.root); others.set(id, a); }
  else if (c) a.setLook(c);
  if (Array.isArray(pos) && okXZ(pos[0], pos[1])) { a.stop(); a.place(pos[0], pos[1]); }
  if (okPj(pj)) a.pj = pj; // 소리·영상을 직접 걸 때 쓰는 이름
  sentX = Infinity; tellLie = true; // 내 자리도(누워 있으면 그것도) 다시 알린다
  if (ghost) ghostPaint();
  dirty = true;
  media.refresh();
  return { look: a.look, pos: [r3(a.x), r3(a.z)], pj: a.pj || '' };
}
function dropPeer(id) {
  const a = others.get(id);
  if (!a) return;
  let had = false;
  for (const [cid, c] of [...S.cakes]) if (c.by === id) { sendHome(S, cid); had = true; } // 들고 있던 케이크는 작업대로 돌아간다
  if (had) syncCakes();
  scene.remove(a.root);
  a.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  others.delete(id);
  dirty = true;
  if (ghost) ghostPaint();
  media.refresh();
}
// 누군가와 같은 자리에 겹쳐 서 있으면 내가 옆으로 비켜선다
function stepAside() {
  for (const a of others.values()) if (Math.hypot(me.x - a.x, me.z - a.z) < 0.6) { goTo(a.x - 1.0 - 0.4 * mySlot, a.z + 0.5); return; }
}
// 꾸밀 수 있는 사람인지에 따라 탭을 보이거나 숨긴다
function paintRole() {
  for (const m of ['furn', 'tree', 'paint']) document.querySelector(`#tabs button[data-m="${m}"]`).hidden = !canEdit;
  $('tabs').style.gridTemplateColumns = `repeat(${[...$('tabs').children].filter((b) => !b.hidden).length}, 1fr)`; // 보이는 탭 수만큼 (마스터 탭이 있으면 하나 더)
  if (!canEdit && (mode === 'furn' || mode === 'tree' || mode === 'paint')) setMode(null);
}
const FX = { dart: 'number', fire: 'number', music: 'string', act: 'string', lie: 'string', show: 'string' };
FX.fly = 'string'; // 방장의 비행 슈트 (fly.js)
FX.snow = FX.hit = 'string'; // 마당 눈싸움 (snow.js)
FX.prop = FX.climb = FX.heavy = FX.help = 'string'; // 받쳐 주기·별 달기·큰 가구 둘이 들기 (coop.js)
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
  roster: (except) => [{ id: 'h', look, pos: [r3(me.x), r3(me.z)], pj: duo.pj() }, ...[...others].filter(([id]) => id !== except).map(([id, a]) => ({ id, look: a.look, pos: [r3(a.x), r3(a.z)], pj: a.pj || '' }))],
  // 손님이 받은 명단대로 맞춘다
  setRoster(list) {
    const keep = new Set();
    for (const p of list.slice(0, 16)) if (p && okId(p.id) && p.id !== duo.me && setPeer(p.id, p.look, p.pos, p.pj)) keep.add(p.id);
    for (const id of [...others.keys()]) if (!keep.has(id)) dropPeer(id);
    tidyCarry();
    stepAside();
  },
  peerJoin: (id, m) => setPeer(id, m.look, m.pos, m.pj) || { look: DEFAULT_LOOK, pos: [0, 0], pj: '' },
  peerGone: (id) => dropPeer(id),
  peersGone() { for (const id of [...others.keys()]) dropPeer(id); },
  peerOp: (op) => dispatch(op, 'peer'),
  peerLook(id, lk) { const c = okLook(lk, id), a = others.get(id); if (!a || !c) return null; a.setLook(c); dirty = true; return c; },
  peerPos(id, x, z) {
    const a = others.get(id);
    if (!a || !okXZ(x, z)) return false;
    const far = Math.hypot(x - a.x, z - a.z);
    if (a.rest && far < 0.05) return true; // 누운 채 그대로다
    if (levelOf(x) === a.level && far > 3) a.place(x, z); // 너무 멀어졌으면 바로 옮긴다 (층이 바뀌었으면 사다리를 탄다)
    a.walk([[x, z]]);
    return true;
  },
  peerFx(m, id) {
    if (m && m.k === 'bell') { if (duo.role !== 'host') ding(false); return false; } // 초인종 소식은 방장만 전한다
    if (m && m.k === 'gm') return games.peerFx(m, id); // 같이 놀기 (games.js)
    if (m && m.k === 'food') return food.peerFx(m, id); // 냉장고와 먹기 (food.js)
    if (m && m.k === 'cheers') return cheers.peerFx(m, id); // 건배 (cheers.js)
    if (m && (m.k === 'team' || m.k === 'ball' || m.k === 'made')) return snow.peerFx(m, id); // 눈싸움 팀전·눈사람 (소식이 길어서 snow.js 가 따로 살핀다)
    if (m && m.k === 'mk') return master.peerFx(m, id); // 마스터가 나눠 주는 권한 (master.js)
    if (m && m.k === 'show' && typeof m.v === 'string' && /^sky:(auto|day|dusk|night)$/.test(m.v)) return sky.peerFx(m, id); // 하늘을 낮·노을·밤으로 (마스터 판)
    if (m && m.k === 'show' && typeof m.v === 'string' && m.v.startsWith('fire:') && m.v.length <= 64) return sky.peerFx(m, id); // 글자·길이·예약이 붙은 불꽃놀이 (값이 길어서 아래의 20자 검사보다 먼저)
    if (!m || typeof m.v !== FX[m.k] || String(m.v).length > 20) return false;
    if (m.k === 'act' && games.quiet(id)) return true; // 술래에게는 숨은 사람의 행동이 안 보인다
    if (m.k === 'fly') return fly.peerFx(m, id); // 방장이 날고 있는 높이 (fly.js)
    if (m.k === 'act') { const a = others.get(id); if (a && ACT_SFX[m.v]) sfx(ACT_SFX[m.v], a); return !!(a && a.act(m.v)); } // 그 사람이 한 행동
    if (m.k === 'lie') { // 그 사람이 침대에 누웠거나('침대:자리') 일어났다('')
      const a = others.get(id);
      if (!a) return false;
      if (!m.v) { a.rise(); dirty = true; return true; }
      const [bid, side] = m.v.split(':'), r = lieSpot(bid, side === '1' ? 1 : 0);
      if (!r) return false;
      a.lie(r); dirty = true;
      return true;
    }
    if (m.k === 'show' && m.v === 'fire') return sky.peerFx(m, id); // 크리스마스 불꽃놀이 (sky.js)
    if (m.k === 'show') return party.peerFx(m, id); // 점등식·단체 사진
    if (m.k === 'snow' || m.k === 'hit') return snow.peerFx(m, id); // 마당 눈싸움
    if (m.k === 'prop' || m.k === 'climb' || m.k === 'heavy' || m.k === 'help') return coop.peerFx(m, id); // 협동 놀이
    play.peerFx(m);
    return true;
  },
  // 초인종과 입장
  dev: () => dev,
  banned: (d) => !!cur && cur.banned.includes(d),
  ban(d) { if (!cur) return; cur.friends = cur.friends.filter((x) => x !== d); if (!cur.banned.includes(d)) cur.banned.push(d); store.set(CUR_KEY, cur); },
  bell: (again) => ding(again),
  admitted() { // 문이 열렸다: 걸어 들어간 다음에 방에 들어선다
    if (!outside.shown) { comeIn(); return; }
    paintDoor('문이 열렸어요!', '');
    outside.open(comeIn);
  },
  peerSay(id, text) { const t = cleanSay(text); if (!t || !others.has(id)) return null; said(id, t); return t; },
  status: () => paintDuo(),
  toast: (m) => toast(m),
});

/* ───────── 보이스와 TV 같이 보기 (사람끼리 직접 주고받는 소리와 영상) ───────── */
const media = makeMedia({
  peer: () => duo.peer(),
  targets: () => [...others].map(([id, a]) => ({ id, pj: a.pj || '' })),
  whoIs: (pj) => { for (const [id, a] of others) if (a.pj === pj) return id; return null; },
  voice: () => paintPeople(),
  tv: (stream, id) => play.remoteTv(stream, id),
  toast: (m) => toast(m),
});
function paintMic() {
  const b = $('mic'), can = duo.mode === 'on' && media.can;
  b.hidden = !can;
  b.setAttribute('aria-pressed', String(media.micOn));
  b.setAttribute('aria-label', media.micOn ? '마이크 끄기' : '마이크 켜기');
  if (!can && media.micOn) media.setMic(false);
}
$('mic').addEventListener('click', async () => { const on = await media.setMic(!media.micOn); paintMic(); toast(on ? '마이크를 켰어요. 방 사람들에게 목소리가 들려요' : '마이크를 껐어요'); });

/* ───────── 초인종과 입장 ───────── */
const outside = buildOutside(scene);
let ac2 = null, lookLater = false;
// 딩동 소리. again = 다시 누른 것(알림 글은 한 번만)
function ding(again) {
  if (!again) toast(duo.role === 'host' ? '딩동! 친구가 초인종을 눌렀어요' : '딩동! 누가 초인종을 눌렀어요');
  try {
    if (!ac2) ac2 = new (window.AudioContext || window.webkitAudioContext)();
    if (ac2.state === 'suspended') ac2.resume().catch(() => {});
    [[659.25, 0], [523.25, 0.32]].forEach(([f, at]) => {
      const o = ac2.createOscillator(), g = ac2.createGain(), t0 = ac2.currentTime + at;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o.connect(g); g.connect(ac2.destination); o.start(t0); o.stop(t0 + 1);
    });
  } catch (_) { /* 소리를 못 내도 알림 글은 보인다 */ }
}
function paintDoor(main, sub) {
  $('doorMain').textContent = main; $('doorSub').textContent = sub;
  const m = duo.mode;
  $('bell').hidden = m !== 'door' || outside.opening;
  $('bell').textContent = duo.rang ? '🔔 다시 누르기' : '🔔 초인종 누르기';
  $('doorHome').hidden = !(m === 'denied' || (m === 'door' && duo.rang)) || outside.opening;
  if (mode === 'door') measure(false);
}
// 문 앞 장면을 보이거나 걷는다. 연결 상태가 바뀔 때마다 불린다.
function syncDoor() {
  const m = duo.mode, at = DOOR && (m === 'door' || m === 'denied');
  if (at && mode !== 'door') {
    if (mode === 'look') lookLater = true; // 처음 온 사람의 캐릭터 고르기는 들어간 다음에 한다
    if (mode !== null) setMode(null);
    outside.show(true);
    mode = 'door';
    for (const k in PANELS) $(PANELS[k]).hidden = k !== 'door';
    $('tabs').hidden = true; $('tools').hidden = true;
    pose = outside.pose();
    applyPov(); measure(false);
  } else if (!at && mode === 'door' && !outside.opening) leaveDoor();
  if (mode !== 'door' || outside.opening) return;
  if (m === 'denied') paintDoor('지금은 들어갈 수 없어요', duo.why === 'kick' ? '방장이 방에서 내보냈어요.' : duo.why === 'ban' ? '이 방에는 다시 들어갈 수 없어요.' : '방장이 문을 열어 주지 않았어요.');
  else if (duo.rang) paintDoor('딩동! 문을 열어 줄 때까지 기다려요', '방장이 문을 열어 주면 들어가요.');
  else paintDoor('친구네 집 앞이에요', '초인종을 눌러 주세요.');
}
function leaveDoor() {
  outside.show(false);
  pose = null; mode = null;
  for (const k in PANELS) $(PANELS[k]).hidden = true;
  $('tabs').hidden = false; $('tools').hidden = false;
  applyPov(); paintPanels(); measure(false);
  dirty = true;
}
function ring() { if (duo.mode !== 'door' || outside.opening) return; ding(true); duo.knock(); syncDoor(); }
// 문을 지나 방 안 현관 앞에 선다
function comeIn() {
  if (me.rest) getUp();
  me.stop(); me.place(FRONT.x, 4.3); me.turnTo(0, -1); me.root.rotation.y = me.face;
  fy = 0; fpitch = -0.05;
  if (mode === 'door') leaveDoor();
  duo.enter();
  if (lookLater) { lookLater = false; setMode('look'); }
}
$('bell').addEventListener('click', ring);
$('doorHome').addEventListener('click', () => leaveRoom());
// 방장: 문 앞에서 기다리는 사람들과 방 안의 사람들
function paintPeople() {
  const box = $('knock'), list = $('duoPeople');
  box.textContent = ''; list.textContent = '';
  const row = (text, btns) => {
    const r = document.createElement('div'), h = document.createElement('div');
    r.className = 'row'; h.className = 'hint'; h.textContent = text; r.appendChild(h);
    for (const [label, fn, main, id] of btns) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (main ? ' main' : ''); b.textContent = label; b.dataset.pid = id; b.addEventListener('click', fn); r.appendChild(b); }
    return r;
  };
  for (const k of duo.knocks) box.appendChild(row(`🔔 ${k.want === 'view' ? '구경하러 온' : '같이 꾸미러 온'} 친구가 문 앞에 있어요`, [['들어오게 하기', () => duo.admit(k.id), true, k.id], ['돌려보내기', () => duo.deny(k.id), false, k.id]]));
  const was = box.hidden;
  box.hidden = !duo.knocks.length;
  if (was !== box.hidden) measure(false); // 아래 판 높이가 바뀌었다
  const role = new Map(duo.people.map((p) => [p.id, p.edit])), talking = new Set(media.voices);
  for (const id of others.keys()) {
    const btns = [];
    if (talking.has(id)) btns.push([media.isMuted(id) ? '🔊 소리 켜기' : '🔇 소리 끄기', () => { media.mute(id, !media.isMuted(id)); paintPeople(); }, false, id]);
    if (duo.role === 'host') btns.push(['내보내기', () => duo.kick(id), false, id]);
    list.appendChild(row(`${nameOf(id)}${talking.has(id) ? ' 🎤' : ''}${role.has(id) ? (role.get(id) ? ' · 같이 꾸미는 중' : ' · 구경 중') : ''}`, btns));
  }
  list.hidden = !others.size;
  $('duoPeopleRow').hidden = !others.size;
  if (mode === 'duo') measure(false);
}

// 친구 초대: 처음이면 지금 방을 같이 꾸미는 방으로 만들고, 링크를 보낸다. edit = 같이 꾸미기 링크(아니면 구경 링크)
async function invite(edit = true) {
  if (!cur) {
    const id = duo.create();
    cur = { id, mine: true, key: duo.key, view: false, friends: [], banned: [] };
    store.set(CUR_KEY, cur);
    store.set(slot(), forDisk());
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
  if (cur.mine) store.set(ROOM_KEY, forDisk());
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
  door: ['친구네 집 앞이에요', '초인종을 눌러 주세요.', '문 앞'],
  denied: ['들어갈 수 없어요', '', '들어갈 수 없음'],
};
function paintDuo() {
  const m = duo.mode;
  syncDoor(); paintPeople();
  if (m !== 'on') tidyCarry(); // 끊겼거나 혼자가 됐으면 남이 들던 케이크는 작업대로
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
  paintMic();
  if (m === 'on') { media.refresh(); play.reshare(); } else if (m !== 'door') { media.stop(); play.unshare(); }
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
  toast('메리 크리스마스! 🎉'); sfx('hooray');
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
const hasKind = (k) => { for (const it of S.items.values()) if (it.k === k) return true; return false; };
// 케이크가 올라가 있지 않은 작업대 (나에게서 가까운 것부터). 새 케이크를 구우면 여기에 나온다
function freeBench() {
  let best = null, bestD = Infinity;
  for (const it of S.items.values()) {
    if (it.k !== 'cake' || cakeAtBench(S, it.id)) continue;
    const d = Math.hypot(X0 + (it.i + 1.5) * CELL - me.x, Z0 + (it.j + 1) * CELL - me.z);
    if (d < bestD) { bestD = d; best = it.id; }
  }
  return best;
}
const play = makePlay({
  key, store, toast: (m) => toast(m),
  itemObj: (id) => itemObj.get(id),
  hasKind: (k) => hasKind(k),
  aspect: () => eye.aspect,
  // 화면의 한 점이 가구 앞 세워진 면(가구 기준 at 을 지나고 앞을 보는 면)의 어디인지 → 가구 기준 { x, y }
  pointOn(g, px, py, at) {
    g.updateMatrixWorld();
    const p0 = g.localToWorld(new THREE.Vector3(at[0], at[1], at[2])), n = new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld);
    aimRay(px, py);
    const hitP = ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, p0), new THREE.Vector3());
    if (!hitP) return null;
    const l = g.worldToLocal(hitP);
    return { x: l.x, y: l.y };
  },
  // 내가 넣은 TV 영상을 방 사람들에게 보낸다 (null 이면 그만)
  canShare: () => duo.mode === 'on' && media.can,
  shareTv: (stream) => media.setTv(stream),
  cake: (id) => S.cakes.get(id) || newCake(),
  // 케이크가 지금 놓인 곳: g = 작업대나 탁자, top = 그 가구에서 잰 케이크 윗면 높이
  cakeSpot(id) {
    const c = S.cakes.get(id) || newCake(), t = !c.by && c.on ? itemObj.get(c.on) : null, b = benchOf(id, c);
    return t ? { id: c.on, g: t, top: kindOf(S.items.get(c.on).k).holds + (CAKE.y - CAKE.base) * CAKE.onTable } : { id: b, g: itemObj.get(b), top: CAKE.y };
  },
  // 한 조각 먹는다 (구경하는 사람도 된다)
  eat(id) { if (!dispatch({ t: 'cakeEat', id })) return false; doAct('eat'); return true; },
  munch(text) { doAct('eat'); toast(text); },
  // 새 케이크를 구워 올릴 수 있는 빈 작업대 (없으면 null), 굽기
  bakeTarget: () => freeBench(),
  bake() { const home = freeBench(), old = home && S.cakes.get(home); return !!home && dispatch({ t: 'cakeBake', id: old && old.gone ? home : newId(), home }); },
  carry(id) { if (!dispatch({ t: 'cakeTake', id, by: duo.me })) { if (canEdit) toast(carried() ? '케이크는 한 번에 하나만 들 수 있어요' : '지금은 들 수 없어요'); return; } toast('케이크를 들었어요. 탁자나 작업대를 누르면 내려놓아요'); },
  canEdit: () => canEdit,
  op: (o) => dispatch(o),
  // 화면에서 누른 자리가 케이크 윗면의 어디인지
  pickCake(id, px, py) { const v = cakeObj.get(id); if (!v) return null; aimRay(px, py); return pickTop(v, ray); },
  // 놀이 중 카메라 자리. inside = 방 안으로 당겨 둔다(벽 뒤로 나가지 않게)
  setPose(p) {
    if (p && p.inside) { // 놀이 가구가 있는 곳(집 안·마당·2층) 안으로
      const it = S.items.get(play.spot), zone = it ? zoneOf(it.i, it.j) : 'house';
      p.pos[0] = clamp(p.pos[0], X0 + 0.25, X1 - 0.25);
      p.pos[2] = zone === 'yard' ? clamp(p.pos[2], Z1 + 0.4, GZ1 - 0.1) : clamp(p.pos[2], Z0 + 0.25, Z1 - 0.25);
    }
    pose = p; applyPov(); dirty = true;
  },
  fx: (m) => duo.fx(m),
  resized: () => { if (mode === 'play') measure(false); },
  close: () => setMode(null),
  bestLine: (k) => book.bestLine(k), record: (k, v) => book.record(k, v), // 이 방 최고 기록 (book.js)
});
// 방명록과 이 방 최고 기록 (방명록 가구는 play 의 놀이 하나로 더해진다)
const book = makeBook({
  key, store, toast: (m) => toast(m), op: (o) => dispatch(o), canEdit: () => canEdit, newId,
  defName: () => nameOf(duo.me), notes: () => notesList(S), best: () => S.best, play, close: () => setMode(null),
});
/* ───────── 점등식과 단체 사진 (party.js) ───────── */
const hemi = scene.children.find((o) => o.isHemisphereLight), BRIGHT = [hemi.intensity, sun.intensity];
// 방 밝기(room)와 트리 둘레 빛(tree)을 원래의 몇 배로 한다. setBright(1, 1) 이면 정확히 원래대로.
// 빛의 세기만 바뀌어서 그림자는 다시 그리지 않아도 된다(dirty 를 켜지 않는다).
function setBright(room, tree) { hemi.intensity = BRIGHT[0] * room; sun.intensity = BRIGHT[1] * room; glow.intensity = (bulbs.on ? 2.6 : 1.6) * tree; }
const party = makeParty({
  canvas, toast: (m) => toast(m), fx: (m) => duo.fx(m), canEdit: () => canEdit,
  mayLead: (id) => duo.role !== 'host' || duo.people.some((p) => p.id === id && p.edit), // 방장은 꾸미는 사람의 점등식만 받아 전한다
  bright: setBright, lightsOn: () => bulbs.on, lightUp: () => dispatch({ t: 'lights', set: 'multi', blink: S.lights.blink }),
  hasMusic: () => hasKind('music'), song: (id) => play.song(id),
});
// 마당 눈싸움 (snow.js)
const snow = makeSnow({
  scene: snowG, me, others: () => others, myId: () => duo.me, mode: () => mode, ghost: () => !!ghost, eye: () => usingEye(),
  ray(px, py) { aimRay(px, py); return ray.ray; },
  fx: (m) => duo.fx(m), toast: (m) => toast(m), dirty: () => { dirty = true; },
  // 팀전과 눈사람 (snowteam.js, snowman.js)
  online: () => duo.mode === 'on', name: (id) => nameOf(id), newId: () => newId(), op: (o) => dispatch(o),
  canPut: (i, j, avoid) => canPlace(S, { k: 'snowman', i, j, r: 0 }, noBuild, null, avoid),
});
// 협동 놀이: 꼭대기 별 달기(한 명이 받치고 한 명이 올라가 단다), 큰 가구 둘이 들기 (coop.js)
const coop = makeCoop({
  g0: room.g0, me, S, grid, others: () => others, myId: () => duo.me, mode: () => mode, setMode: (m) => setMode(m),
  ghost: () => (ghost ? { id: ghost.id } : null), ghostPick: (id) => ghostPick(id), ghostCancel: () => ghostCancel(),
  itemObj: (id) => itemObj.get(id), op: (o) => dispatch(o), canEdit: () => canEdit, goTo: (x, z) => goTo(x, z),
  fx: (m) => duo.fx(m), toast: (m) => toast(m), dirty: () => { dirty = true; }, nameOf: (id) => nameOf(id), key, store,
  treeGlow: () => glow.intensity / (bulbs.on ? 2.6 : 1.6), actBottom: () => $('act').style.bottom,
});
// 같이 놀기: 숨바꼭질, 몰래 산타 (games.js)
const games = makeGames({
  me, others: () => others, myId: () => duo.me, online: () => duo.mode === 'on', canEdit: () => canEdit, nameOf: (id) => nameOf(id),
  items: () => S.items, orns: () => S.orns, orn: (id) => ornObj.get(id), screenOf, eye: () => usingEye(),
  caster(px, py) { aimRay(px, py); return ray; },
  fx: (m) => duo.fx(m), toast: (m) => toast(m), dirty: () => { dirty = true; },
});
// 의상과 방장의 비행 슈트 (costume.js, fly.js). 방장 = 방을 만든 사람(혼자 노는 내 방 포함)
const isHost = () => duo.role === 'host' || (!duo.role && (!cur || cur.mine));
const fly = makeFly({
  me, others: () => others, grid, fixed: fixedCell, isHost, look: () => look, setLook: (p) => setLook(p),
  online: () => duo.mode === 'on', fx: (m) => duo.fx(m), toast: (m) => toast(m), dirty: () => { dirty = true; },
  // 날 수 없는 때: 걷기 화면이 아닐 때, 같이 놀기·눈싸움·눈 뭉치 굴리기 중, 케이크를 들었을 때, 누웠을 때, 사다리를 타는 중
  busy: () => !(mode === null || mode === 'chat' || mode === 'emo') || !!ghost || !!pose || !!me.rest || !!me.hop || me.hold || me.push
    || games.on || snow.on || !!(window.__snow && window.__snow.team && window.__snow.team.on),
});
// 창밖 낮과 밤, 눈 날씨, 크리스마스 자정 카운트다운과 불꽃놀이 (sky.js). 조명 바탕값 BRIGHT 를 하늘이 정하고, 점등식은 그 위에 곱한다
const sky = makeSky({
  scene, hemi, sun, glow, room, bright: BRIGHT, front: FRONT,
  cam: () => cam(), eye: () => usingEye(), level: () => myLv, height: () => canvas.height,
  canFire: () => can(FIRE),
  busy: () => party.on === 'light', canEdit: () => canEdit, isHost: () => duo.role === 'host' || (!duo.role && (!cur || cur.mine)), fx: (m) => duo.fx(m), toast: (m) => toast(m),
  mayLead: (id) => duo.role !== 'host' || duo.people.some((p) => p.id === id && p.edit), // isHost: 방장(혼자 노는 내 방 포함)은 아무 날에나 불꽃놀이
  resized: () => { if (mode === 'tree') measure(false); },
});
// 어드벤트 달력 (advent.js): 달력 가구는 play 의 놀이 하나로 더해진다
const advent = makeAdvent({
  key, store, toast: (m) => toast(m), op: (o) => dispatch(o), load: (o) => dispatch(o, 'load'), canEdit: () => canEdit, defName: () => nameOf(duo.me),
  S: () => S, play, close: () => setMode(null), itemObj: (id) => itemObj.get(id), scene, dirty: () => { dirty = true; },
  findSpot: (k, r, x, z) => findSpot(k, r, x, z, []),
});
// 숨은 마스터키 (master.js): 제목을 일곱 번 누른다
const master = makeMaster({
  toast: (m) => toast(m), sky: { time: () => sky.time, setTime: (v) => sky.setTime(v) }, changed: () => { advent.repaint(); dirty = true; },
  scene, ray(px, py) { aimRay(px, py); return ray.ray; }, shown: () => myLv === 0,
  fx: (m) => duo.fx(m), myId: () => duo.me, others: () => [...others.keys()], nameOf: (id) => nameOf(id), setMode: (m) => setMode(m), mode: () => mode,
  resized: () => { if (mode === 'master') measure(false); },
});
// 트리 밑 선물 (gift.js): 판은 setMode('gift') 로 연다
const gift = makeGift({
  key, store, toast: (m) => toast(m), op: (o) => dispatch(o), canEdit: () => canEdit, newId, defName: () => nameOf(duo.me),
  S: () => S, g0: room.g0, me, mode: () => mode, setMode: (m) => setMode(m), act: (id) => doAct(id), dirty: () => { dirty = true; },
  ray(px, py) { aimRay(px, py); return ray.ray; },
  resized: () => { if (mode === 'gift') measure(false); },
  cakeEaten(id) { // 선물에 케이크 한 조각을 담았다
    syncCakes(id);
    const c = S.cakes.get(id);
    if (mode === 'play' && play.kind === 'cake' && play.id === id) { if (!c || c.gone) setMode(null); else play.refresh(id); }
  },
});
// 냉장고와 먹기 (food.js): 판은 setMode('fridge') 로 연다
const food = makeFoodPlay({
  scene, me, avatar: (id) => others.get(id), itemObj: (id) => itemObj.get(id), S: () => S, approach: (id, then) => approach(id, then),
  mode: () => mode, setMode: (m) => setMode(m), act: (id) => doAct(id), fx: (m) => duo.fx(m), online: () => duo.mode === 'on',
  toast: (m) => toast(m), dirty: () => { dirty = true; }, busy: () => !!carried(),
  ray(px, py) { aimRay(px, py); return ray.ray; },
  resized: () => { if (mode === 'fridge') measure(false); },
});
// 건배 (cheers.js), 효과음 (sfx.js): 소리는 내가 선 곳에서 듣고, 켜고 끄는 단추는 "같이" 판에 둔다
const cheers = makeCheers({ food, me, others: () => others, fx: (m) => duo.fx(m), online: () => duo.mode === 'on', toast: (m) => toast(m), dirty: () => { dirty = true; } });
sfx.listen(() => me); mountSfxUI($('duoP'));
const ACT_SFX = { clap: 'clap', jump: 'jump', cheer: 'whoosh', dance: 'whoosh' };
// 놀 수 있는 가구를 누르면: 그 앞으로 걸어가서 놀이를 연다
// 가구 앞으로 걸어가서 then 을 한다 (이미 앞에 있거나 갈 수 없으면 바로)
function approach(id, then) {
  const it = S.items.get(id), g = itemObj.get(id);
  g.updateMatrixWorld();
  // 여럿이 같은 가구 앞에 모일 때 겹치지 않게 사람마다 조금씩 옆으로 선다
  const p = g.localToWorld(new THREE.Vector3(0.45 - 0.5 * ((mySlot + 1) >> 1) * (mySlot % 2 ? 1 : -1), 0, kindOf(it.k).d * CELL / 2 + 0.5));
  const x = p.x + levelOfCell(it.i) * FLOOR_DX; // 위층 가구는 격자에서 옆으로 밀려 있다
  if (Math.hypot(x - me.x, p.z - me.z) < 0.4 || !goTo(x, p.z)) then(); else me.onArrive = then;
}
// id = 누른 가구. cakeId 가 있으면 그 가구(탁자) 위에 놓인 케이크로 논다
function startPlay(id, cakeId = null) {
  const it = S.items.get(id), kind = cakeId ? 'cake' : it && kindOf(it.k).play, g = itemObj.get(id);
  if (!kind || !g) return false;
  if (kind === 'cake' && !cakeId) cakeId = cakeAtBench(S, id); // 작업대 위에 있는 케이크
  if (kind === 'cake' && !cakeId) return false;
  if (kind === 'bake' && !canEdit) { toast('구경하는 중에는 케이크를 구울 수 없어요'); return true; }
  if (kind === 'bake' && !freeBench()) { toast(hasKind('cake') ? '작업대가 비어 있어야 새 케이크를 구울 수 있어요. 케이크를 탁자로 옮기거나 다 먹으면 비어요' : '케이크 작업대가 있어야 구울 수 있어요'); return true; }
  const pid = cakeId || id;
  approach(id, () => { if (S.items.has(id) && (!cakeId || cakeObj.has(cakeId)) && mode === null) { setMode('play'); if (!play.start(pid, kind)) setMode(null); } });
  return true;
}

/* ───────── 케이크 들고 다니기 ───────── */
// 케이크는 작업대 위(기본), 누군가의 손(by), 탁자 위(on) 중 한 곳에 있다. 방의 상태라서 모두에게 같게 보인다.
// 작업대의 케이크를 옮기거나 다 먹으면 오븐에서 새로 구울 수 있어서, 케이크는 여러 개일 수 있다(케이크마다 모양 하나: cakeObj).
const carried = () => { for (const [id, c] of S.cakes) if (c.by === duo.me && !c.gone) return id; return null; }; // 내가 든 케이크
const cakeOn = (tid) => cakeOnTable(S, tid);
const avatarOf = (pid) => (pid === duo.me ? me : others.get(pid));
// 케이크 모양을 방 상태에 맞춘다: 없어진 것은 지우고, 새로 생긴 것은 만들고, changed(없으면 전부)는 다시 차린다
function syncCakes(changed) {
  const list = cakesList(S), live = new Set(list.map(([id]) => id));
  for (const [id, v] of [...cakeObj]) if (!live.has(id)) { disposeCakeView(v); cakeObj.delete(id); }
  for (const [id, c] of list) {
    let v = cakeObj.get(id);
    if (!v) { v = makeCakeView(); v.root.userData.cakeRoot = true; cakeObj.set(id, v); dressCake(v, c); }
    else if (changed === undefined || changed === id) dressCake(v, c);
  }
  seatCakes(list);
}
// 케이크 모양을 지금 있어야 할 곳(작업대·손·탁자)에 붙인다
function seatCakes(list = cakesList(S)) {
  const held = new Set();
  for (const [id, c] of list) {
    const v = cakeObj.get(id);
    if (!v) continue;
    const a = c.by ? avatarOf(c.by) : null, t = !c.by && c.on ? itemObj.get(c.on) : null;
    let parent = itemObj.get(benchOf(id, c)), y = 0, z = 0, sc = 1;
    if (a) { parent = a.root; sc = CAKE.inHand; y = 0.64 - CAKE.base * sc; z = 0.43; held.add(a); }
    else if (t) { parent = t; sc = CAKE.onTable; y = kindOf(S.items.get(c.on).k).holds - CAKE.base * sc; }
    if (!parent) { if (v.root.parent) v.root.parent.remove(v.root); continue; }
    if (v.root.parent !== parent) parent.add(v.root);
    v.root.position.set(0, y, z); v.root.scale.setScalar(sc);
  }
  for (const a of [me, ...others.values()]) a.hold = held.has(a);
  for (const [id, g] of itemObj) if (g.userData.deco) g.userData.deco.visible = !cakeOn(id); // 케이크가 놓인 탁자의 소품은 치워 둔다
  paintCarry();
  dirty = true;
}
// 방에 없는 사람이 들고 있다고 적힌 케이크는 작업대로 돌려놓는다 (누가 나갔을 때, 연결이 끊겼을 때)
function tidyCarry() {
  const here = new Set([duo.me, ...others.keys()]);
  for (const [id, c] of [...S.cakes]) if (c.by && !here.has(c.by)) sendHome(S, id);
  syncCakes();
}
function paintCarry() {
  const el = $('carryP'), was = el.hidden;
  el.hidden = !(carried() && mode === null);
  if (was !== el.hidden) measure(false); // 아래 판 높이가 바뀌었다
}
function putDown(on) { const id = carried(); return !!id && dispatch({ t: 'cakeDrop', id, by: duo.me, on }); }
$('carryBack').addEventListener('click', () => { if (putDown(null)) toast('케이크를 작업대에 돌려놓았어요'); else if (carried()) toast('작업대에 이미 다른 케이크가 있어요. 탁자에 올려놓아 보세요'); });
// 케이크와 얽힌 가구를 눌렀을 때. 여기서 처리했으면 true
function cakeTap(id) {
  const it = S.items.get(id), mine = carried();
  if (!it) return false;
  const holds = !!kindOf(it.k).holds;
  if (mine) { // 들고 있을 때: 탁자나 그 케이크의 작업대를 누르면 가서 내려놓는다
    const home = benchOf(mine, S.cakes.get(mine));
    if (id !== home && !holds) return false;
    if (holds && cakeOn(id)) { toast('그 탁자에는 이미 케이크가 있어요'); return true; }
    if (!holds && cakeAtBench(S, id)) { toast('작업대에 이미 다른 케이크가 있어요. 탁자에 올려놓아 보세요'); return true; }
    approach(id, () => { if (carried() === mine && S.items.has(id) && putDown(holds ? id : null)) toast(holds ? '케이크를 탁자에 올려놓았어요' : '케이크를 작업대에 돌려놓았어요'); });
    return true;
  }
  if (holds) { const cid = cakeOn(id); return !!cid && startPlay(id, cid); } // 탁자 위의 케이크로 논다 (촛불 켜기·불기, 먹기, 다시 들기)
  if (it.k === 'cake') {
    const cid = cakeAtBench(S, id);
    if (cid) return startPlay(id, cid);
    // 작업대가 비어 있다: 케이크가 어디 갔는지 알려 준다
    const away = cakesList(S).filter(([x, c]) => benchOf(x, c) === id);
    if (away.some(([, c]) => c.by)) toast('친구가 케이크를 들고 다니는 중이에요');
    else if (away.length) toast('케이크는 탁자 위에 있어요. 탁자를 눌러 보세요. 새 케이크는 오븐에서 구워요');
    else toast('작업대가 비어 있어요. 오븐에서 새 케이크를 구워 보세요');
    return true;
  }
  return false;
}

/* ───────── 침대에 눕기 ───────── */
// 누운 자리: 침대(가구 id)의 왼쪽(side 0)이나 오른쪽(1) 베개. pos = 발끝, head = 머리(1인칭 눈이 놓이는 곳), 모두 세상 좌표
function lieSpot(id, side) {
  const it = S.items.get(id), g = itemObj.get(id);
  if (!it || !g || !kindOf(it.k).lie) return null;
  g.updateMatrixWorld();
  const x = side ? 0.35 : -0.35, p = g.localToWorld(new THREE.Vector3(x, 0.4, 0.455)), h = g.localToWorld(new THREE.Vector3(x, 0.52, -0.6));
  return { id, side, pos: [p.x, p.y, p.z], head: [h.x, h.y, h.z], ry: g.rotation.y };
}
let tellLie = false; // 새로 온 사람에게 내가 누워 있다는 것을 다시 알려야 하는지
function paintLie() {
  const el = $('lieP'), was = el.hidden;
  el.hidden = !(me.rest && mode === null);
  if (was !== el.hidden) measure(false);
}
// 침대를 눌렀을 때: 발치로 걸어가서 빈 베개 쪽에 눕는다
function lieDown(id) {
  const it = S.items.get(id);
  if (!it || !kindOf(it.k).lie) return false;
  if (me.rest && me.rest.id === id) return true;
  if (carried()) { toast('케이크를 들고는 누울 수 없어요'); return true; }
  approach(id, () => {
    if (mode !== null || carried()) return;
    const taken = [...others.values()].filter((a) => a.rest && a.rest.id === id).map((a) => a.rest.side);
    const side = [0, 1].find((k) => !taken.includes(k));
    const r = side === undefined ? null : lieSpot(id, side);
    if (!r) { if (S.items.has(id)) toast('침대에 누울 자리가 없어요'); return; }
    me.lie(r);
    if (fp) { fy = r.ry; fpitch = 0.45; } // 1인칭: 발치 쪽 천장을 올려다본다
    duo.fx({ k: 'lie', v: id + ':' + side });
    paintLie(); dirty = true;
    toast('침대에 누웠어요 😴 걸으면 일어나요'); sfx('bed');
  });
  return true;
}
function getUp() {
  if (!me.rise()) return;
  duo.fx({ k: 'lie', v: '' });
  paintLie(); dirty = true;
}
// 침대가 옮겨졌으면 누운 사람도 따라가고, 치워졌으면 일어난다
function restCheck(id) {
  for (const a of [me, ...others.values()]) {
    if (!a.rest || a.rest.id !== id) continue;
    const r = lieSpot(id, a.rest.side);
    if (r) a.lie(r); else if (a === me) getUp(); else a.rise();
  }
}
$('lieUp').addEventListener('click', getUp);

/* ───────── 그 앞에서 스페이스바: 가까이 있는 것으로 할 수 있는 일 ───────── */
const PLAY_LABEL = { dart: '🎯 다트 하기', tv: '📺 TV 보기', fire: '🔥 마시멜로 굽기', music: '🎶 오르골 틀기', bake: '🍳 케이크 굽기', guest: '📖 방명록 쓰기' };
{ // 도구 단추 🎁: 트리 앞 스페이스바가 별 달기에 쓰일 때도 선물 판을 열 수 있게
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn'; b.id = 'giftBtn'; b.textContent = '🎁'; b.title = '트리 밑 선물'; b.setAttribute('aria-label', '트리 밑 선물');
  b.addEventListener('click', () => { if (mode === 'gift') setMode(null); else if (mode === null || PANELS[mode]) gift.open(); });
  $('tools').insertBefore(b, $('snap') || null);
}
PLAY_LABEL.advent = '🗓️ 어드벤트 달력'; // advent.js
// 냉장고: 앞으로 가서 문을 열고 먹을 것을 고른다 (food.js)
function snack(id) {
  const it = S.items.get(id);
  if (!it || !kindOf(it.k).snack) return false;
  return food.open(id);
}
// 옷장: 앞으로 가서 옷을 갈아입는다 (캐릭터 고르기 판이 열린다)
function dress(id) {
  const it = S.items.get(id);
  if (!it || !kindOf(it.k).dress) return false;
  approach(id, () => { if (mode === null) setMode('look'); });
  return true;
}
// 가구를 눌렀을 때(또는 그 앞에서 스페이스바): 케이크 내려놓기·먹기, 놀이, 눕기, 간식, 옷 갈아입기
const useItem = (id) => cakeTap(id) || startPlay(id) || lieDown(id) || snack(id) || dress(id);
// 그 가구로 지금 할 수 있는 일의 이름 (없으면 null)
function actionOf(it) {
  const f = kindOf(it.k), mine = carried();
  if (mine && f.holds) return cakeOn(it.id) ? null : '🎂 케이크 내려놓기';
  if (mine && it.id === benchOf(mine, S.cakes.get(mine))) return cakeAtBench(S, it.id) ? null : '🎂 작업대에 두기';
  if (f.holds) return cakeOn(it.id) ? '🍰 케이크 먹기·꾸미기' : null;
  if (it.k === 'cake') return cakeAtBench(S, it.id) ? '🎂 케이크 꾸미기·먹기' : null;
  if (f.play) return f.play === 'bake' && !canEdit ? null : PLAY_LABEL[f.play] || null;
  if (f.lie) return '🛏️ 눕기';
  if (f.snack) return food.labelOf(it.k);
  if (f.dress) return '👕 옷 갈아입기';
  return null;
}
// 사다리 L 을 타고 올라가거나(up) 내려간다
function climb(L, up) {
  const c = up ? L.b : L.a;
  return goTo(...centerOf(c[0], c[1]));
}
// 지금 서 있는 자리에서 할 수 있는 일 { label, run }. 누워 있으면 일어나기, 사다리 옆이면 오르내리기, 아니면 가장 가까운(바라보는) 가구
function nearAction() {
  if (mode !== null || ghost || me.hop || fly.on) return null; // 나는 중에는 쉰다 (fly.js)
  { const g = games.action(); if (g) return g; } // 같이 놀기 중에 할 수 있는 일 (찾았다·옷장·슬쩍)
  if (me.rest) return { label: '🛏️ 일어나기', run: getUp };
  { const c = cheers.action(); if (c) return c; } // 마실 것을 든 친구가 가까이 있으면 건배 (cheers.js)
  { const f = food.action(); if (f) return f; } // 손에 든 것 먹기·마시기 (food.js)
  // 트리 앞에서는: 진행 중인 놀이(위) > 별 달기 협동 > 트리 밑 선물. 혼자라서 별을 못 다는 때(weak)는 선물이 먼저이고, 선물은 도구 단추 🎁 로도 연다
  const starHint = coop.near();
  if (starHint && !starHint.weak) return starHint; // 받쳐 주기·별 달기·같이 들기 (coop.js)
  const [ci, cj] = cellOf(me.x, me.z), by = (c) => Math.abs(ci - c[0]) <= 1 && Math.abs(cj - c[1]) <= 1;
  for (const L of LADDERS) {
    if (by(L.a)) return { label: `🪜 ${L.lv + 2}층으로 올라가기`, run: () => climb(L, true) };
    if (by(L.b)) return { label: `🪜 ${L.lv + 1}층으로 내려가기`, run: () => climb(L, false) };
  }
  { const g = gift.near() || starHint; if (g) return g; } // 트리 앞: 트리 밑 선물 (gift.js), 아니면 혼자서는 별에 손이 닿지 않는다는 안내
  let best = null, bestS = Infinity;
  const fx = Math.sin(me.face), fz = Math.cos(me.face);
  for (const it of S.items.values()) {
    if (levelOfCell(it.i) !== me.level) continue;
    const [w, d] = footprint(it.k, it.r), x0 = X0 + it.i * CELL, z0 = Z0 + it.j * CELL, x1 = x0 + w * CELL, z1 = z0 + d * CELL;
    const dist = Math.hypot(me.x - clamp(me.x, x0, x1), me.z - clamp(me.z, z0, z1));
    if (dist > 0.8) continue;
    const label = actionOf(it);
    if (!label) continue;
    const dx = (x0 + x1) / 2 - me.x, dz = (z0 + z1) / 2 - me.z, score = dist - 0.3 * (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1);
    if (score < bestS) { bestS = score; best = { label, run: () => useItem(it.id) }; }
  }
  return best;
}
// 스페이스바: 놀이 중이면 그 놀이의 큰 단추(던지기, 굽기, 불기, 먹기 …), 아니면 가까이 있는 것
function pressSpace() {
  if (mode === 'play') { if (play.kind === 'tv') return; const b = $('playGo') || $('playEat'); if (b) b.click(); return; }
  const a = nearAction();
  if (a) a.run();
}
// 할 수 있는 일이 있으면 화면에 단추로도 보여 준다 (폰에서는 이 단추를 누른다)
let actLabel = null;
function paintAct() {
  const a = nearAction(), label = a ? a.label : null;
  if (label === actLabel) return;
  actLabel = label;
  const el = $('act');
  el.hidden = !label;
  if (label) el.textContent = label + (matchMedia('(pointer: fine)').matches ? ' · 스페이스' : '');
}
$('act').addEventListener('click', () => { const a = nearAction(); if (a) a.run(); paintAct(); });

/* ───────── 누르기 ───────── */
// 손가락 하나를 거의 움직이지 않고 뗐을 때가 "누르기". 두 손가락은 크게·작게 보기.
// 가구를 들고 있을 때는 누르거나 끄는 자리로 가구가 따라온다.
const touches = new Map();
let tap = null, pinch = 0;
const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
function ghostAt(px, py) { const p = floorAt(px, py, false); if (p) ghostMoveTo(p.x, p.z); }
canvas.addEventListener('pointerdown', (e) => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 1) { tap = { x: e.clientX, y: e.clientY, id: e.pointerId }; if (ghost && !usingEye()) ghostAt(e.clientX, e.clientY); if (mode === 'play') play.move(e.clientX, e.clientY); }
  else { tap = null; pinch = touches.size === 2 ? spread() : 0; }
});
canvas.addEventListener('pointermove', (e) => {
  if (mode === 'play') play.move(e.clientX, e.clientY); // 다트 겨냥 (마우스는 누르지 않고 움직여도 된다)
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
  if (mode === 'play' && ok && play.kind === 'dart') { play.tap(e.clientX, e.clientY); return; } // 다트는 겨냥하며 끌다가 떼면 날아간다
  if (!still) return;
  if (mode === 'door') { aimRay(e.clientX, e.clientY); if (outside.hitBell(ray)) ring(); return; } // 초인종
  if (mode === 'play') { play.tap(e.clientX, e.clientY); return; }
  if (snow.tap(e.clientX, e.clientY)) return; // 눈싸움 모드: 걸어가는 대신 눈덩이를 던진다
  if (games.tap(e.clientX, e.clientY)) return; // 숨바꼭질: 술래가 숨은 사람을 누름
  if (mode === null && master.tap(e.clientX, e.clientY)) return; // 숨은 열쇠 (master.js)
  if ((mode === null || mode === 'gift') && gift.tap(e.clientX, e.clientY)) return; // 트리 밑 선물 상자
  if (mode === 'fridge' && food.tap(e.clientX, e.clientY)) return; // 열린 냉장고 안의 음식
  if (mode === null && !fly.on) { const id = pickItem(e.clientX, e.clientY); if (id && useItem(id)) return; } // 케이크 내려놓기, 놀 수 있는 가구, 침대, 냉장고
  if (mode === 'tree') { treeTap(e.clientX, e.clientY); return; }
  if (mode === 'furn') { const id = pickItem(e.clientX, e.clientY); if (id && coop.heavyPick(id)) return; } // 큰 가구는 친구가 있으면 둘이 든다 (coop.js)
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
  else if (e.code === 'Space') { // 그 앞에서 스페이스바: 놀이를 시작하거나 그 일을 한다
    e.preventDefault();
    if (e.repeat) return;
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) document.activeElement.blur(); // 눌러 둔 단추가 같이 눌리지 않게
    pressSpace();
  }
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
  if (me.hop) return false;         // 사다리를 타는 중
  const f = (keys.has('u') ? 1 : 0) - (keys.has('d') ? 1 : 0) - joy.y, r = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0) + joy.x;
  const push = Math.min(1, Math.hypot(f, r)); // 조이스틱을 살짝 밀면 천천히 걷는다
  if (push < 0.15) return false;
  if (me.rest) getUp();
  me.stop(); me.onArrive = null; pinT = Math.min(pinT, 0.2);
  // 화면 위쪽 = 카메라가 보는 쪽, 화면 오른쪽 = 그 오른쪽 (1인칭에서는 내가 보는 쪽)
  const ya = usingEye() ? fy : yaw;
  let dx = -Math.sin(ya) * f + Math.cos(ya) * r, dz = -Math.cos(ya) * f - Math.sin(ya) * r;
  const len = Math.hypot(dx, dz); dx /= len; dz /= len;
  me.turnTo(dx, dz);
  if (fly.on) return fly.push(dx, dz, push, dt); // 나는 중 (fly.js)
  { // 사다리 앞(위)에서 사다리 쪽으로 밀면 오르내린다
    const [ci, cj] = cellOf(me.x, me.z), at = (c) => ci === c[0] && cj === c[1];
    for (const L of LADDERS) if ((at(L.a) && dx > 0.6) || (at(L.b) && dx < -0.6)) { const c = at(L.a) ? L.b : L.a; me.walk([centerOf(c[0], c[1])]); return false; }
  }
  const step = SPEED * push * dt;
  const nx = clamp(me.x + dx * step, X0 + BODY_R, GX1 - BODY_R), nz = clamp(me.z + dz * step, Z0 + BODY_R, GZ1 - BODY_R);
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
  if (who !== 'me' && games.muffle(who)) return; // 술래에게는 숨은 사람의 말이 "어디선가 소리"로만
  let b = bubbles.get(who);
  if (!b) { b = { el: document.createElement('div'), until: 0 }; b.el.className = 'bub'; $('bubbles').appendChild(b.el); bubbles.set(who, b); }
  b.el.textContent = text; b.until = clock + SAY_SHOW; sfx('pop', who === 'me' ? null : others.get(who));
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
    if (!a || clock > b.until || (who === 'me' && usingEye()) || (who !== 'me' && !a.root.visible)) { if (b.el.style.display !== 'none') b.el.style.display = 'none'; if (!a && who !== 'me') { b.el.remove(); bubbles.delete(who); } continue; }
    bv.set(a.root.position.x, a.root.position.y + (a.rest ? 1.0 : 1.72), a.root.position.z).project(cam());
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

const PANELS = { master: 'masterP', furn: 'furn', tree: 'treeP', paint: 'paint', look: 'look', duo: 'duoP', play: 'playP', chat: 'chatP', door: 'doorP', emo: 'emoP' };
PANELS.gift = 'giftP'; // 트리 밑 선물 (gift.js)
PANELS.fridge = 'fridgeP'; // 냉장고 (food.js)
const cakeObj = new Map(); // 케이크 id → 모양 (cake.js 의 makeCakeView)
function setMode(m) {
  if (mode === 'door') return; // 문 앞에서는 탭을 쓸 수 없다
  if (m === mode) m = null; // 같은 탭을 다시 누르면 닫는다
  if (ghost) ghostCancel();
  const was = mode;
  if (was === 'play') play.stop();
  mode = m;
  $('tabs').hidden = m === 'play'; $('tools').hidden = m === 'play'; // 놀이 중에는 놀이 판만 보인다
  for (const k in PANELS) $(PANELS[k]).hidden = k !== m;
  if ($('giftBtn')) $('giftBtn').hidden = m !== null && m !== 'gift'; // 판이 열려 있을 때는 도구 줄이 두 줄이 되지 않게 숨긴다 (폰에서 판이 방을 가린다)
  for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-pressed', String(b.dataset.m === m));
  $('emo').setAttribute('aria-pressed', String(m === 'emo'));
  itemsG.visible = m !== 'tree'; // 트리를 꾸밀 때는 가구가 트리를 가리지 않게 잠깐 숨긴다
  if (m === 'tree') { standByTree(); toast('트리를 눌러 장식을 달아요'); }
  if (m === 'look') { me.stop(); me.onArrive = null; faceCamera(); }
  if (m === 'chat') { document.querySelector('#tabs button[data-m="chat"]').classList.remove('new'); const l = $('chatLog'); l.scrollTop = l.scrollHeight; }
  if (was === 'chat') $('chatIn').blur();
  if (was === 'look') store.set(LOOK_KEY, look);
  paintPanels(); paintCarry(); paintLie(); paintAct();
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
const wardrobe = makeWardrobe({ $, picks, look: () => look, setLook: (p) => setLook(p), isHost, toast: (m) => toast(m), measure: () => measure(false) }); // 옷·색·소품 고르기 (costume.js)
picks($('faceList'), FACES, 'pick', (v) => setLook({ face: v }));
picks($('actList'), ACTS, 'pick', (v) => doAct(v));
$('emo').addEventListener('click', () => setMode('emo'));
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
  press('#pickGender .chip', look.gender); wardrobe.paint(); press('#faceList .pick', look.face);
  press('#ornList .pick', tool);
  press('#lightList .chip', S.lights.set); press('#blinkList .chip', S.lights.blink);
  press('#wallList .sw', S.wall); press('#floorList .sw', S.floor);
  $('furnBar').hidden = !ghost; $('furnRow').hidden = !!ghost; $('furnHint').hidden = !!ghost;
  if (ghost) { $('furnName').textContent = kindOf(ghost.k).name; $('gDel').hidden = !ghost.id; }
  $('ornCount').textContent = S.orns.size ? `장식 ${S.orns.size}개` : '';
}
// 행동을 한다: 걷던 것을 멈추고 그 몸짓을 하며, 친구들에게도 알린다
function doAct(id) {
  me.stop(); me.onArrive = null;
  if (!me.act(id)) return false;
  if (ACT_SFX[id]) sfx(ACT_SFX[id]);
  duo.fx({ k: 'act', v: id });
  dirty = true;
  return true;
}
function setLook(patch) {
  look = wardrobe.allow(cleanLook({ ...look, ...patch }), look);
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
let last = performance.now(), frames = 0, clock = 0, actAt = 0;
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

  // 걷기 (나는 중이면 fly.js 가 높이와 자리를 옮긴다)
  fly.tick(dt);
  const byKey = keyWalk(dt);
  const moved = byKey ? (me.animate(dt, true), true) : me.step(dt);
  if (moved || me.blend > 0.01 || me.doing) dirty = true;
  for (const a of others.values()) if (a.step(dt) || a.blend > 0.01 || a.doing) dirty = true;
  { const lv = floorOf(me); if (lv !== myLv) { myLv = lv; if (ghost) ghostCancel(); measure(false); paintLevels(); toast(`${lv + 1}층이에요`); } } // 사다리를 반쯤 올랐을 때 위층으로 바뀐다
  for (const a of others.values()) { const v = floorOf(a) === myLv; if (a.root.visible !== v) { a.root.visible = v; dirty = true; } } // 같은 층에 있는 사람만 보인다
  if (clock - actAt > 0.15) { actAt = clock; paintAct(); }
  // 내 자리를 친구에게 알린다 (1초에 열 번까지, 움직였을 때만)
  if (duo.mode === 'on' && clock - sentAt > 0.1 && (Math.abs(me.x - sentX) > 0.004 || Math.abs(me.z - sentZ) > 0.004)) {
    sentAt = clock; sentX = me.x; sentZ = me.z;
    duo.pos(r3(me.x), r3(me.z));
    if (tellLie) { tellLie = false; if (me.rest) duo.fx({ k: 'lie', v: me.rest.id + ':' + me.rest.side }); }
  }
  updateView(dt);
  if (usingEye()) updateEye();

  if (pinT > 0) { pinT = Math.max(0, pinT - dt * (me.path.length ? 0.6 : 3)); pin.material.opacity = Math.min(1, pinT * 1.4) * 0.9; pin.scale.setScalar(1 + (1 - pinT) * 0.5); }
  if (ghost) ghost.g.position.y = ghost.y + 0.1 + Math.sin(clock * 5) * 0.025; // 들고 있는 가구는 살짝 떠서 흔들린다
  for (let k = pops.length - 1; k >= 0; k--) {
    const p = pops[k]; p.t += dt * 5;
    const s = p.t >= 1 ? 1 : 1 + 0.35 * Math.sin(p.t * Math.PI) - (1 - p.t) * (1 - p.t);
    p.g.scale.setScalar(Math.max(0.01, s));
    if (p.t >= 1) pops.splice(k, 1);
  }
  bulbs.tick(clock);
  if (room.tickDoors(dt, [me, ...others.values()])) dirty = true; // 방문: 누가 다가오면 열린다
  { const p = outside.tick(dt); if (p && outside.opening) pose = p; } // 문이 열려 걸어 들어가는 동안의 카메라 (다 들어간 뒤에는 건드리지 않는다)
  for (const [id, v] of cakeObj) { const c = S.cakes.get(id); if (c && c.lit > 0) flicker(v, clock); }
  placeBubbles();
  play.tick(dt);
  party.tick();
  snow.tick(dt);
  coop.tick(dt);
  games.tick();
  sky.tick(dt);
  advent.tick(dt); gift.tick(dt); food.tick(dt); cheers.tick(dt); sfxWalk(dt, me, others.values());

  if (dirty) { renderer.shadowMap.needsUpdate = true; dirty = false; }
  renderer.render(scene, cam());
  party.shot(); // 단체 사진: 방금 그린 화면을 같은 그림 안에서 찍는다
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
    // 마당과 2층의 기본 가구: 새 방, 그리고 마당·2층이 없던 때에 꾸민 방(up 표시가 없다)을 처음 열 때
    if ((!saved && !cur) || (saved && !saved.up)) STARTER_UP.forEach(([k, i, j, r], n) => dispatch({ t: 'put', id: 'up' + n, k, i, j, r }, 'load'));
    advent.starter(saved, !!cur); // 어드벤트 달력이 없던 때에 꾸민 방에도 달력을 하나 놓는다
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
window.__media = { get can() { return media.can; }, get micOn() { return media.micOn; }, get tvOn() { return media.tvOn; }, get voices() { return media.voices; }, get tvFrom() { return media.tvFrom; }, isMuted: (id) => media.isMuted(id), audioOf: (id) => media.audioOf(id), setMic: (on) => media.setMic(on) };
window.__door = { get shown() { return outside.shown; }, get opening() { return outside.opening; }, ring, bellPoint: () => outside.bellPoint(), get dev() { return dev; } };
window.__duo = {
  get mode() { return duo.mode; }, get role() { return duo.role; }, get room() { return duo.room; }, get mine() { return cur ? cur.mine : null; },
  get knocks() { return duo.knocks; }, get people() { return duo.people; }, get why() { return duo.why; }, get rang() { return duo.rang; },
  admit: (id) => duo.admit(id), deny: (id) => duo.deny(id), kick: (id) => duo.kick(id),
  get canEdit() { return canEdit; }, get count() { return duo.count; }, get me() { return duo.me; }, get editors() { return duo.editors; }, get slot() { return mySlot; },
  get others() { return [...others].map(([id, a]) => ({ id, x: a.x, z: a.z, look: a.look, moving: a.moving, acting: a.acting, hold: a.hold, lying: a.rest ? { id: a.rest.id, side: a.rest.side } : null, level: floorOf(a), shown: a.root.visible, climbing: a.climbing })); },
  say, cleanSay, get bubbles() { return [...bubbles].filter(([, b]) => b.el.style.display !== 'none').map(([who, b]) => { const r = b.el.getBoundingClientRect(); return { who, text: b.el.textContent, x: r.left + r.width / 2, y: r.bottom }; }); },
  get chatLog() { return [...document.querySelectorAll('#chatLog .ln')].map((l) => l.textContent); },
  get other() { const a = others.values().next().value; return a ? { x: a.x, z: a.z, look: a.look, moving: a.moving } : null; },
  inviteUrl: (edit) => duo.inviteUrl(edit !== false && canEdit), invite, leaveRoom, hash: roomHash, feed: (m, pid) => duo.feed(m, pid),
  rawOp: (op) => duo.op(op), // 화면의 막음을 건너뛰고 변화를 보내 본다 (주인이 걸러 내는지 검사용)
  rawSay: (t) => duo.say(t),
};
window.__play = Object.assign(play.test, {
  start: (id) => startPlay(id), // 가구 앞으로 걸어가서 연다
  open(id) { const it = S.items.get(id), kind = kindOf(it.k).play; if (mode !== null) setMode(null); setMode('play'); const ok = play.start(kind === 'cake' ? cakeAtBench(S, id) : id, kind); if (!ok) setMode(null); return ok; }, // 걷지 않고 바로 연다
  close: () => setMode(null), peerFx: (m) => play.peerFx(m),
});
Object.defineProperties(window.__play, { on: { get: () => play.on }, posed: { get: () => !!pose }, id: { get: () => play.id }, spot: { get: () => play.spot } });
window.__sky = sky.test;
window.__master = { get on() { return master.on; }, get given() { return master.test.given; }, key: master.test.key };
window.__food = food.test; window.__cheers = cheers.test;
window.__party = Object.assign(party.test, { bright: () => ({ hemi: hemi.intensity, sun: sun.intensity, glow: glow.intensity }) });
window.__tree = {
  NX, NZ, GX, GZ, CELL, HALF: 4, box: { x0: X0, x1: X1, z0: Z0, z1: Z1 }, LEVELS, FLOOR_H, FLOOR_DX, LADDERS, FRONT, toWorld, grid, me, room, S, goTo, screenOf, floorAt, turnView, lowerQuality, setLook, zoomBy, dispatch, setMode,
  ghostNew, ghostPick, ghostMoveTo, ghostTurn, ghostDone, ghostCancel, ghostRemove, surfaceR, serialize: () => serialize(S),
  setZoomMul(m) { setZoomMul(m); },
  doAct, carried, putDown, cakeTap, useItem, lieDown, getUp, climb, pressSpace, nearAction: () => { const a = nearAction(); return a ? a.label : null; },
  get level() { return myLv; }, get lying() { return me.rest ? { id: me.rest.id, side: me.rest.side } : null; },
  itemShown: (id) => { const g = itemObj.get(id); return !!g && g.visible; }, cakes: () => cakesList(S).map(([id, c]) => ({ id, ...c })), freeBench,
  cakeAt(id) { const cv = cakeObj.get(id), c = S.cakes.get(id), g = itemObj.get(benchOf(id, c || newCake())), p = cv && cv.root.parent; return cv ? { by: (c && c.by) || null, on: (c && c.on) || null, left: c ? c.left : CAKE.slices, where: p === g ? 'island' : p === me.root ? 'me' : p && p.userData.item ? 'item:' + p.userData.item : [...others].some(([, a]) => a.root === p) ? 'peer:' + [...others].find(([, a]) => a.root === p)[0] : '?', scale: cv.root.scale.x, deco: c && c.on && itemObj.get(c.on) && itemObj.get(c.on).userData.deco ? itemObj.get(c.on).userData.deco.visible : null } : null; },
  openLook(on) { if ((mode === 'look') !== on) setMode('look'); },
  // 트리 겉면의 한 점(높이 y, 둘레 각 a)이 화면에서 어디인지
  treePoint(y, a) { const r = surfaceR(y) * 0.93; return screenOf(Math.sin(a) * r, Math.cos(a) * r, y); },
  cakeTops: (id) => { const v = cakeObj.get(id); return v ? v.tops.children.length : -1; },
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
