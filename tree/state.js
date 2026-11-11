// 방의 상태(놓인 가구, 트리 장식, 전구, 벽지·바닥)와 그것을 바꾸는 규칙. 화면과 상관없는 계산만 둔다.
// 모든 변화는 apply(S, op) 한 곳을 지난다. 저장해 둔 방을 다시 열 때도, 나중에 상대가 보낸 변화도 같은 길로 들어온다.
//   { t: 'put', id, k, i, j, r }   가구 놓기 (i, j = 차지하는 칸 중 가장 작은 칸, r = 0~3 돌린 횟수)
//   { t: 'move', id, i, j, r }     가구 옮기기·돌리기
//   { t: 'del', id }               가구 치우기
//   { t: 'orn', id, k, x, y, z }   트리 장식 달기 (트리 겉면 위의 자리)
//   { t: 'ornDel', id }            트리 장식 떼기
//   { t: 'lights', set, blink }    전구 색 묶음과 깜빡임
//   { t: 'wall', v } / { t: 'floor', v }
import { N } from './path.js';
import { FURNITURE, ORNAMENTS, LIGHT_SETS, BLINKS, WALLS, FLOORS, MAX_ITEMS, MAX_ORNS } from './catalog.js';

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

export function makeState() {
  return { items: new Map(), orns: new Map(), lights: { set: 'off', blink: 'on' }, wall: WALLS[0].id, floor: FLOORS[0].id };
}

// 그 자리에 놓을 수 있는지. fixed(i, j) = 트리처럼 처음부터 막힌 칸. ignoreId = 옮기는 중인 자기 자신.
// avoid = 아바타가 서 있는 칸들(가구로 사람을 덮지 않게).
// 러그와 가구는 겹쳐 놓을 수 있고, 같은 종류끼리만 겹치지 못한다.
export function canPlace(S, it, fixed, ignoreId = null, avoid = []) {
  const f = F[it.k];
  if (!f || !isInt(it.i) || !isInt(it.j) || ![0, 1, 2, 3].includes(it.r)) return false;
  const mine = new Set();
  for (const [i, j] of cellsOf(it)) {
    if (i < 0 || j < 0 || i >= N || j >= N || fixed(i, j)) return false;
    if (f.solid && avoid.some(([a, b]) => a === i && b === j)) return false;
    mine.add(j * N + i);
  }
  for (const o of S.items.values()) {
    if (o.id === ignoreId || F[o.k].solid !== f.solid) continue;
    for (const [i, j] of cellsOf(o)) if (mine.has(j * N + i)) return false;
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
    case 'del': return S.items.delete(op.id);
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
    case 'wall': if (!has(WALLS, op.v)) return false; S.wall = op.v; return true;
    case 'floor': if (!has(FLOORS, op.v)) return false; S.floor = op.v; return true;
    default: return false;
  }
}

// 저장용 모양. 다시 열 때는 ops() 로 풀어서 apply 에 하나씩 넣는다.
export function serialize(S) {
  return {
    v: 1,
    items: [...S.items.values()].map((o) => [o.id, o.k, o.i, o.j, o.r]),
    orns: [...S.orns.values()].map((o) => [o.id, o.k, o.x, o.y, o.z]),
    lights: [S.lights.set, S.lights.blink], wall: S.wall, floor: S.floor,
  };
}
export function ops(data) {
  const out = [];
  if (!data || typeof data !== 'object' || data.v !== 1) return out;
  const rows = (a) => (Array.isArray(a) ? a.filter(Array.isArray) : []);
  for (const [id, k, i, j, r] of rows(data.items)) out.push({ t: 'put', id, k, i, j, r });
  for (const [id, k, x, y, z] of rows(data.orns)) out.push({ t: 'orn', id, k, x, y, z });
  if (Array.isArray(data.lights)) out.push({ t: 'lights', set: data.lights[0], blink: data.lights[1] });
  out.push({ t: 'wall', v: data.wall }, { t: 'floor', v: data.floor });
  return out;
}
