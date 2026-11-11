// 방의 상태(놓인 가구, 트리 장식, 전구, 벽지·바닥)와 그것을 바꾸는 규칙. 화면과 상관없는 계산만 둔다.
// 모든 변화는 apply(S, op) 한 곳을 지난다. 저장해 둔 방을 다시 열 때도, 나중에 상대가 보낸 변화도 같은 길로 들어온다.
//   { t: 'put', id, k, i, j, r }   가구 놓기 (i, j = 차지하는 칸 중 가장 작은 칸, r = 0~3 돌린 횟수)
//   { t: 'move', id, i, j, r }     가구 옮기기·돌리기
//   { t: 'del', id }               가구 치우기
//   { t: 'orn', id, k, x, y, z }   트리 장식 달기 (트리 겉면 위의 자리)
//   { t: 'ornDel', id }            트리 장식 떼기
//   { t: 'lights', set, blink }    전구 색 묶음과 깜빡임
//   { t: 'wall', v } / { t: 'floor', v }
// 케이크(케이크 작업대 가구 id 마다 하나):
//   { t: 'cakeCream', id, v }        크림 색 (CREAMS 의 번호)
//   { t: 'cakeTop', id, k, x, z }    장식 올리기 (케이크 가운데가 0, 0)
//   { t: 'cakeClear', id }           장식 다 치우기
//   { t: 'cakeLit', id, n }          초 n 개에 불 켜기 (0 이면 다 끄기)
//   { t: 'cakeBlow', id }            촛불 하나 불어서 끄기 (구경하는 사람도 할 수 있다)
import { NX, NZ } from './path.js';
import { FURNITURE, ORNAMENTS, LIGHT_SETS, BLINKS, WALLS, FLOORS, MAX_ITEMS, MAX_ORNS, CREAMS, TOPPINGS, CAKE } from './catalog.js';

const F = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));
const has = (list, id) => typeof id === 'string' && list.some((x) => x.id === id);
const isInt = Number.isInteger;
const okId = (id) => typeof id === 'string' && /^[a-z0-9]{1,16}$/.test(id);
const okNum = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

export const kindOf = (k) => F[k];
export function footprint(k, r) { const f = F[k]; return r % 2 ? [f.d, f.w] : [f.w, f.d]; }
export function cellsOf(it) {
  const [w, d] = footprint(it.k, it.r), out = [];
  for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) out.push([it.i + a, it.j + b]);
  return out;
}

// 케이크 하나의 상태. cream = 크림 색 번호, tops = [[장식, x, z], …], lit = 불이 켜진 초의 개수
export const newCake = () => ({ cream: 0, tops: [], lit: 0 });
export const candles = (c) => c.tops.filter((t) => t[0] === 'candle').length;
// 그 가구(케이크 작업대)의 케이크. 아직 손대지 않았으면 make 일 때 새로 만든다.
function cakeOf(S, id, make) {
  const it = S.items.get(id);
  if (!it || it.k !== 'cake') return null;
  let c = S.cakes.get(id);
  if (!c && make) { c = newCake(); S.cakes.set(id, c); }
  return c || null;
}

export function makeState() {
  // at = 마지막으로 꾸민 때(ms, 한 번도 안 꾸몄으면 0).
  // sync = 친구의 방과 똑같다고 마지막으로 확인했을 때의 at (한 번도 맞춘 적 없으면 0). at > sync 면 헤어진 뒤 혼자 꾸민 것이다.
  return { items: new Map(), orns: new Map(), cakes: new Map(), lights: { set: 'off', blink: 'on' }, wall: WALLS[0].id, floor: FLOORS[0].id, at: 0, sync: 0 };
}

// 그 자리에 놓을 수 있는지. fixed(i, j) = 트리처럼 처음부터 막힌 칸. ignoreId = 옮기는 중인 자기 자신.
// avoid = 아바타가 서 있는 칸들(가구로 사람을 덮지 않게).
// 러그와 가구는 겹쳐 놓을 수 있고, 같은 종류끼리만 겹치지 못한다.
export function canPlace(S, it, fixed, ignoreId = null, avoid = []) {
  const f = F[it.k];
  if (!f || !isInt(it.i) || !isInt(it.j) || ![0, 1, 2, 3].includes(it.r)) return false;
  const mine = new Set();
  for (const [i, j] of cellsOf(it)) {
    if (i < 0 || j < 0 || i >= NX || j >= NZ || fixed(i, j)) return false;
    if (f.solid && avoid.some(([a, b]) => a === i && b === j)) return false;
    mine.add(j * NX + i);
  }
  for (const o of S.items.values()) {
    if (o.id === ignoreId || F[o.k].solid !== f.solid) continue;
    for (const [i, j] of cellsOf(o)) if (mine.has(j * NX + i)) return false;
  }
  return true;
}

// 바꿨으면 true. 규칙에 어긋나면 아무것도 바꾸지 않고 false.
export function apply(S, op, fixed) {
  if (!op || typeof op !== 'object') return false;
  switch (op.t) {
    case 'put': {
      if (!okId(op.id) || S.items.has(op.id) || S.items.size >= MAX_ITEMS) return false;
      const it = { id: op.id, k: op.k, i: op.i, j: op.j, r: op.r };
      if (!canPlace(S, it, fixed)) return false;
      S.items.set(it.id, it);
      return true;
    }
    case 'move': {
      const cur = S.items.get(op.id);
      if (!cur) return false;
      const it = { id: cur.id, k: cur.k, i: op.i, j: op.j, r: op.r };
      if (!canPlace(S, it, fixed, cur.id)) return false;
      S.items.set(it.id, it);
      return true;
    }
    case 'del': S.cakes.delete(op.id); return S.items.delete(op.id);
    case 'orn': {
      if (!okId(op.id) || S.orns.has(op.id) || S.orns.size >= MAX_ORNS || !has(ORNAMENTS, op.k)) return false;
      if (!okNum(op.x, -1.4, 1.4) || !okNum(op.z, -1.4, 1.4) || !okNum(op.y, 0.3, 3)) return false;
      S.orns.set(op.id, { id: op.id, k: op.k, x: op.x, y: op.y, z: op.z });
      return true;
    }
    case 'ornDel': return S.orns.delete(op.id);
    case 'lights': {
      if (!has(LIGHT_SETS, op.set) || !has(BLINKS, op.blink)) return false;
      S.lights = { set: op.set, blink: op.blink };
      return true;
    }
    case 'cakeCream': {
      if (!isInt(op.v) || op.v < 0 || op.v >= CREAMS.length) return false;
      const c = cakeOf(S, op.id, true);
      if (!c) return false;
      c.cream = op.v;
      return true;
    }
    case 'cakeTop': {
      if (!has(TOPPINGS, op.k) || !okNum(op.x, -CAKE.r, CAKE.r) || !okNum(op.z, -CAKE.r, CAKE.r) || Math.hypot(op.x, op.z) > CAKE.r) return false;
      const c = cakeOf(S, op.id, true);
      if (!c || c.tops.length >= CAKE.max) return false;
      c.tops.push([op.k, op.x, op.z]);
      return true;
    }
    case 'cakeClear': { const c = cakeOf(S, op.id, false); if (!c || (!c.tops.length && !c.lit)) return false; c.tops = []; c.lit = 0; return true; }
    case 'cakeLit': {
      const c = cakeOf(S, op.id, false);
      if (!c || !isInt(op.n) || op.n < 0 || op.n > candles(c) || op.n === c.lit) return false;
      c.lit = op.n;
      return true;
    }
    case 'cakeBlow': { const c = cakeOf(S, op.id, false); if (!c || c.lit <= 0) return false; c.lit--; return true; }
    case 'wall': if (!has(WALLS, op.v)) return false; S.wall = op.v; return true;
    case 'floor': if (!has(FLOORS, op.v)) return false; S.floor = op.v; return true;
    default: return false;
  }
}

// 저장용 모양. 다시 열 때는 ops() 로 풀어서 apply 에 하나씩 넣는다.
export function serialize(S) {
  return {
    v: 2, at: S.at, sync: S.sync, // v 1 = 거실만 있던 때의 방, v 2 = 주방과 방이 붙은 집 (칸 번호는 같다)
    items: [...S.items.values()].map((o) => [o.id, o.k, o.i, o.j, o.r]),
    orns: [...S.orns.values()].map((o) => [o.id, o.k, o.x, o.y, o.z]),
    cakes: [...S.cakes].map(([id, c]) => [id, c.cream, c.lit, c.tops.map((t) => [t[0], t[1], t[2]])]),
    lights: [S.lights.set, S.lights.blink], wall: S.wall, floor: S.floor,
  };
}
// 저장된 방이나 친구가 보낸 방의 때 표시. 모양이 이상하거나 터무니없는 값이면 0(꾸민 적 없음)으로 본다.
function stamp(data, k) {
  if (!data || typeof data !== 'object' || (data.v !== 1 && data.v !== 2) || !Array.isArray(data.items) || !Array.isArray(data.orns)) return 0;
  return okNum(data[k], 0, Date.now() + 600000) ? data[k] : 0;
}
export const stampOf = (data) => stamp(data, 'at');
export const syncOf = (data) => Math.min(stamp(data, 'sync'), stamp(data, 'at'));

// 둘이 만났을 때 손님의 방을 쓸지(true), 주인의 방을 쓸지(false).
// g, h = { at, sync, mine } (mine = 이 방을 만든 사람인지)
//   처음 온 기기(sync 0)는 상대의 방을 받는다. 둘 다 처음이면 방을 만든 사람 것.
//   헤어진 뒤 한쪽만 혼자 꾸몄으면 그쪽 것. 둘 다 혼자 꾸몄으면 더 최근 것. 아무도 안 꾸몄으면 주인 것.
export function guestWins(g, h) {
  const gNew = !g.sync, hNew = !h.sync;
  if (gNew && hNew) return !!g.mine && !h.mine;
  if (gNew) return false;
  if (hNew) return true;
  const gAlone = g.at > g.sync, hAlone = h.at > h.sync;
  if (gAlone !== hAlone) return gAlone;
  return gAlone && g.at > h.at;
}

export function ops(data) {
  const out = [];
  if (!data || typeof data !== 'object' || (data.v !== 1 && data.v !== 2)) return out;
  const rows = (a) => (Array.isArray(a) ? a.filter(Array.isArray) : []);
  for (const [id, k, i, j, r] of rows(data.items)) out.push({ t: 'put', id, k, i, j, r });
  for (const [id, k, x, y, z] of rows(data.orns)) out.push({ t: 'orn', id, k, x, y, z });
  for (const [id, cream, lit, tops] of rows(data.cakes)) {
    out.push({ t: 'cakeCream', id, v: cream });
    for (const [k, x, z] of rows(tops)) out.push({ t: 'cakeTop', id, k, x, z });
    if (lit) out.push({ t: 'cakeLit', id, n: lit });
  }
  if (Array.isArray(data.lights)) out.push({ t: 'lights', set: data.lights[0], blink: data.lights[1] });
  out.push({ t: 'wall', v: data.wall }, { t: 'floor', v: data.floor });
  return out;
}
