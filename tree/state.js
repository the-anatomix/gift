// 방의 상태(놓인 가구, 트리 장식, 전구, 벽지·바닥)와 그것을 바꾸는 규칙. 화면과 상관없는 계산만 둔다.
// 모든 변화는 apply(S, op) 한 곳을 지난다. 저장해 둔 방을 다시 열 때도, 나중에 상대가 보낸 변화도 같은 길로 들어온다.
//   { t: 'put', id, k, i, j, r }   가구 놓기 (i, j = 차지하는 칸 중 가장 작은 칸, r = 0~3 돌린 횟수)
//   { t: 'move', id, i, j, r }     가구 옮기기·돌리기
//   { t: 'del', id }               가구 치우기
//   { t: 'orn', id, k, x, y, z }   트리 장식 달기 (트리 겉면 위의 자리)
//   { t: 'ornDel', id }            트리 장식 떼기
//   { t: 'lights', set, blink }    전구 색 묶음과 깜빡임
//   { t: 'wall', v } / { t: 'floor', v }
// 케이크: 작업대 가구 id 가 곧 그 작업대에 처음부터 있는 케이크의 id 다. 오븐에서 새로 구운 케이크는 따로 id 를 받고 home = 작업대.
//   { t: 'cakeCream', id, v }        크림 색 (CREAMS 의 번호)
//   { t: 'cakeTop', id, k, x, z }    장식 올리기 (케이크 가운데가 0, 0)
//   { t: 'cakeClear', id }           장식 다 치우기
//   { t: 'cakeLit', id, n }          초 n 개에 불 켜기 (0 이면 다 끄기)
//   { t: 'cakeBlow', id }            촛불 하나 불어서 끄기 (구경하는 사람도 할 수 있다)
//   { t: 'cakeTake', id, by }        케이크를 든다 (by = 드는 사람. 한 사람이 하나만 든다)
//   { t: 'cakeDrop', id, by, on }    내려놓는다 (on = 올려놓을 탁자 가구 id. 없으면 작업대로 돌아간다)
//   { t: 'cakeBake', id, home }      오븐에서 새 케이크를 구워 빈 작업대 home 에 올린다 (id = home 이면 다 먹은 처음 케이크를 다시 굽는다)
//   { t: 'cakeEat', id }             한 조각 먹기 (다 먹으면 케이크가 없어진다)
//   { t: 'cakeSet', id, c }          저장해 둔 케이크를 통째로 놓는다 (방을 다시 열 때만)
// 방명록과 이 방 최고 기록 (구경하는 사람도 남길 수 있다. 지우기는 꾸밀 수 있는 사람만)
//   { t: 'note', id, name, text, at }  한마디 남기기 (at = 남긴 때 ms). NOTE.max 개가 넘치면 가장 오래된 것부터 빠진다
//   { t: 'noteDel', id }               방명록 글 지우기
//   { t: 'best', k, v, name }          이 방 최고 기록 (k = 'dart' | 'fire'). 지금 기록보다 높을 때만 받는다
// 꼭대기 별 (coop.js. 한 명이 받치고 한 명이 올라가 단다. 구경하는 사람도 달 수 있다)
//   { t: 'star', on: true, by, name, help }  별을 단다 (by = 올라간 사람 id(방장이 보낸 사람과 맞춰 본다), name = 단 사람, help = 받친 사람 이름)
//   { t: 'star', on: false }                 별을 뗀다. S.star = { name, help } 또는 null(저장값에 없으면 안 달린 것)
// 어드벤트 달력 (advent.js). 칸을 열어야 풀리는 특별 가구·장식·전구·벽지·바닥(catalog.js 의 day)은 그 전에는 놓거나 고를 수 없다
//   { t: 'adv', d, name, at }          12월 d 일 칸을 연다 (name = 연 사람, at = 연 때 ms). 한 칸은 한 번만
// 트리 밑 선물 (gift.js). 구경하는 사람도 두고 열 수 있다. 치우기는 꾸밀 수 있는 사람만
//   { t: 'gift', id, to, from, text, wrap, at, cake }  선물 두기. cake = 한 조각 담을 케이크 id (그 케이크가 한 조각 줄어든다).
//                                       저장된 방을 열 때는 cake = true(이미 담긴 것), open = true 면 열린 선물
//   { t: 'giftOpen', id }              선물 열기 (몇 시부터 열 수 있는지는 화면에서 본다)
//   { t: 'giftDel', id }               선물 치우기
// 마당 눈사람 (구경하는 사람도 할 수 있다. 놓인 뒤에는 보통 가구 눈사람이라 'move'·'del' 로 옮기고 치운다. 저장도 가구로 한다)
//   { t: 'snowman', id, i, j }         같이 만든 눈사람을 마당 칸 (i, j) 에 놓는다. 방에 눈사람이 SNOWMEN 개 있으면 더 놓지 못한다
import { GX, GZ } from './path.js';
import { zoneOf } from './path.js';
import { SNOWMEN } from './catalog.js';
import { FURNITURE, ORNAMENTS, LIGHT_SETS, BLINKS, WALLS, FLOORS, MAX_ITEMS, MAX_ORNS, CREAMS, TOPPINGS, CAKE, NOTE, BEST } from './catalog.js';
import { GIFT, WRAPS } from './catalog.js';

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

// 케이크 하나의 상태. cream = 크림 색 번호, tops = [[장식, x, z], …], lit = 불이 켜진 초의 개수,
// by = 들고 있는 사람(없으면 null), on = 올려놓은 탁자(없으면 null), by·on 둘 다 없으면 제 작업대 위에 있다.
// home = 오븐에서 구운 케이크가 나온 작업대(처음 케이크는 null: id 가 곧 작업대), left = 남은 조각, gone = 다 먹은 처음 케이크(자리 표시만 남는다)
// 아직 S.cakes 에 없는 작업대에는 손대지 않은 처음 케이크가 놓여 있는 것으로 본다. 작업대·탁자·사람마다 케이크는 하나까지.
export const newCake = () => ({ cream: 0, tops: [], lit: 0, by: null, on: null, home: null, left: CAKE.slices, gone: false });
const okPid = (v) => typeof v === 'string' && /^[a-z0-9]{1,8}$/.test(v);
export const candles = (c) => c.tops.filter((t) => t[0] === 'candle').length;
export const benchOf = (id, c) => c.home || id;
const isBench = (S, id) => { const it = S.items.get(id); return !!it && it.k === 'cake'; };
const sits = (c) => !c.gone && !c.by && !c.on;
// 먹은 쪽: 케이크를 위에서 볼 때 θ = atan2(x, z) 가 0 부터 (먹은 조각 수 × 한 조각 각도) 까지
const eatenAt = (x, z, left) => (Math.atan2(x, z) + Math.PI * 2) % (Math.PI * 2) < (CAKE.slices - left) * Math.PI * 2 / CAKE.slices;
const okTop = (k, x, z) => has(TOPPINGS, k) && okNum(x, -CAKE.r, CAKE.r) && okNum(z, -CAKE.r, CAKE.r) && Math.hypot(x, z) <= CAKE.r;
// 그 케이크(처음 케이크면 작업대 id). 없거나 다 먹었으면 null. 처음 케이크를 아직 손대지 않았으면 make 일 때 새로 만든다.
function cakeOf(S, id, make) {
  let c = S.cakes.get(id);
  if (c) return c.gone ? null : c;
  if (!make || !isBench(S, id)) return null;
  c = newCake(); S.cakes.set(id, c);
  return c;
}
// 다 먹었거나 갈 곳이 없어진 케이크를 없앤다. 처음 케이크는 자리 표시를 남겨서 작업대에 다시 생기지 않게 한다.
function rmCake(S, id, c) { if (c.home) S.cakes.delete(id); else S.cakes.set(id, { ...newCake(), gone: true, left: 0 }); }
// 작업대 b 가 있고, self 말고 다른 케이크가 그 위에 없는지
function benchFree(S, b, self) {
  if (!isBench(S, b)) return false;
  if (!S.cakes.has(b)) return b === self; // 손대지 않은 처음 케이크가 놓여 있다
  for (const [id, c] of S.cakes) if (id !== self && sits(c) && benchOf(id, c) === b) return false;
  return true;
}
// 있는 케이크 모두 [id, 케이크] (손대지 않은 처음 케이크는 새 케이크 모양을 만들어 넣는다. 저장하지는 않는다)
export function cakesList(S) {
  const out = [];
  for (const [id, c] of S.cakes) if (!c.gone) out.push([id, c]);
  for (const it of S.items.values()) if (it.k === 'cake' && !S.cakes.has(it.id)) out.push([it.id, newCake()]);
  return out;
}
// 작업대 위에 놓인 케이크의 id (없으면 null)
export function cakeAtBench(S, b) {
  if (!isBench(S, b)) return null;
  if (!S.cakes.has(b)) return b;
  for (const [id, c] of S.cakes) if (sits(c) && benchOf(id, c) === b) return id;
  return null;
}
// 탁자 위에 놓인 케이크의 id (없으면 null)
export function cakeOnTable(S, t) {
  for (const [id, c] of S.cakes) if (!c.gone && !c.by && c.on === t) return id;
  return null;
}
// 든 사람이 떠났거나 탁자가 없어졌을 때: 케이크를 작업대로 돌려보낸다. 작업대가 없거나 이미 다른 케이크가 있으면 케이크를 없앤다.
export function sendHome(S, id) {
  const c = S.cakes.get(id);
  if (!c || c.gone || (!c.by && !c.on)) return false;
  c.by = null; c.on = null;
  if (!benchFree(S, benchOf(id, c), id)) rmCake(S, id, c);
  return true;
}
const liveCount = (S) => { let n = 0; for (const c of S.cakes.values()) if (!c.gone) n++; return n; };

// 방명록의 이름과 글: 글자 수(이모지도 한 글자) 안이고, 제어 문자·글 방향을 바꾸는 문자가 없고, 앞뒤 빈칸 없이 무언가 적혀 있어야 한다
const BAD_CH = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;
export const okWords = (v, max) => typeof v === 'string' && v.length <= max * 2 && [...v].length >= 1 && [...v].length <= max && !BAD_CH.test(v) && v.trim() === v;
// 화면에서 받은 글을 방명록에 맞게 다듬는다 (줄바꿈·제어 문자는 빈칸, 겹친 빈칸은 하나, 글자 수만큼 자른다)
export function cleanWords(v, max) {
  if (typeof v !== 'string') return '';
  return [...v.replace(new RegExp(BAD_CH.source, 'g'), ' ').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();
}
// 방명록 글을 최근 것부터 (같은 때면 id 순)
export const notesList = (S) => [...S.notes.values()].sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

export function makeState() {
  // at = 마지막으로 꾸민 때(ms, 한 번도 안 꾸몄으면 0).
  // sync = 친구의 방과 똑같다고 마지막으로 확인했을 때의 at (한 번도 맞춘 적 없으면 0). at > sync 면 헤어진 뒤 혼자 꾸민 것이다.
  // notes = 방명록 (id → { id, name, text, at }), best = 이 방 최고 기록 (놀이 → { v, name })
  // adv = 어드벤트 달력에서 연 칸 (d → { name, at }), gifts = 트리 밑 선물 (id → { id, to, from, text, wrap, at, cake, open })
  return { items: new Map(), orns: new Map(), cakes: new Map(), notes: new Map(), best: {}, lights: { set: 'off', blink: 'on' }, wall: WALLS[0].id, floor: FLOORS[0].id, at: 0, sync: 0, adv: new Map(), gifts: new Map() };
}

// 그 자리에 놓을 수 있는지. fixed(i, j) = 트리처럼 처음부터 막힌 칸. ignoreId = 옮기는 중인 자기 자신.
// avoid = 아바타가 서 있는 칸들(가구로 사람을 덮지 않게).
// 러그와 가구는 겹쳐 놓을 수 있고, 같은 종류끼리만 겹치지 못한다.
export function canPlace(S, it, fixed, ignoreId = null, avoid = []) {
  const f = F[it.k];
  if (!f || !isInt(it.i) || !isInt(it.j) || ![0, 1, 2, 3].includes(it.r)) return false;
  const mine = new Set();
  for (const [i, j] of cellsOf(it)) {
    if (i < 0 || j < 0 || i >= GX || j >= GZ || fixed(i, j)) return false;
    if (f.solid && avoid.some(([a, b]) => a === i && b === j)) return false;
    mine.add(j * GX + i);
  }
  for (const o of S.items.values()) {
    if (o.id === ignoreId || F[o.k].solid !== f.solid) continue;
    for (const [i, j] of cellsOf(o)) if (mine.has(j * GX + i)) return false;
  }
  return true;
}

// 어드벤트 달력: 그 목록의 id 가 칸을 열어야 풀리는 것인데 아직 안 열었으면 그 칸(12월 며칠), 아니면 0
export function lockDay(S, list, id) {
  const x = list.find((o) => o.id === id);
  return x && x.day && !(S.adv && S.adv.has(x.day)) ? x.day : 0;
}
// 아직 풀리지 않은 것을 놓거나 고르는 변화인지 (저장된 방을 열 때는 ops() 가 연 칸을 먼저 넣으므로 그대로 들어간다)
function locked(S, op) {
  switch (op.t) {
    case 'put': return !!lockDay(S, FURNITURE, op.k);
    case 'orn': return !!lockDay(S, ORNAMENTS, op.k);
    case 'lights': return !!lockDay(S, LIGHT_SETS, op.set);
    case 'wall': return !!lockDay(S, WALLS, op.v);
    case 'floor': return !!lockDay(S, FLOORS, op.v);
    default: return false;
  }
}
// 트리 밑 선물을 둔 차례대로 (같은 때면 id 순)
export const giftsList = (S) => [...S.gifts.values()].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

// 바꿨으면 true. 규칙에 어긋나면 아무것도 바꾸지 않고 false.
export function apply(S, op, fixed) {
  if (!op || typeof op !== 'object') return false;
  if (locked(S, op)) return false; // 어드벤트 달력에서 아직 풀지 않은 것
  switch (op.t) {
    case 'put': {
      if (!okId(op.id) || S.items.has(op.id) || S.cakes.has(op.id) || S.items.size >= MAX_ITEMS) return false;
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
    case 'del': {
      const it = S.items.get(op.id);
      if (!it) return false;
      S.items.delete(op.id);
      if (it.k === 'cake') { S.cakes.delete(op.id); for (const [id, c] of [...S.cakes]) if (c.home === op.id) S.cakes.delete(id); } // 작업대와 거기서 나온 케이크들
      for (const [id, c] of [...S.cakes]) if (c.on === op.id && !c.by) sendHome(S, id); // 치운 탁자 위의 케이크는 작업대로 돌아간다
      return true;
    }
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
      if (!okTop(op.k, op.x, op.z)) return false;
      const c = cakeOf(S, op.id, true);
      if (!c || c.tops.length >= CAKE.max || eatenAt(op.x, op.z, c.left)) return false;
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
    case 'cakeTake': {
      if (!okPid(op.by)) return false;
      for (const x of S.cakes.values()) if (x.by === op.by) return false; // 한 사람이 하나만 든다
      const c = cakeOf(S, op.id, true);
      if (!c || c.by) return false;
      c.by = op.by; c.on = null;
      return true;
    }
    case 'cakeDrop': {
      const c = cakeOf(S, op.id, false);
      if (!c || !c.by || c.by !== op.by) return false;
      let on = null;
      if (op.on !== undefined && op.on !== null) {
        const t = S.items.get(op.on);
        if (!t || !F[t.k].holds) return false;
        if (cakeOnTable(S, op.on)) return false; // 탁자 하나에 케이크 하나
        on = op.on;
      } else if (!benchFree(S, benchOf(op.id, c), op.id)) return false; // 작업대가 없거나 다른 케이크가 올라가 있다
      c.by = null; c.on = on;
      return true;
    }
    case 'cakeBake': {
      if (!isBench(S, op.home) || cakeAtBench(S, op.home)) return false;
      if (op.id === op.home) { // 다 먹은 처음 케이크를 다시 굽는다
        const c = S.cakes.get(op.home);
        if (!c || !c.gone) return false;
        S.cakes.set(op.home, newCake());
        return true;
      }
      if (!okId(op.id) || S.cakes.has(op.id) || S.items.has(op.id) || liveCount(S) >= CAKE.many) return false;
      S.cakes.set(op.id, { ...newCake(), home: op.home });
      return true;
    }
    case 'cakeEat': {
      const c = cakeOf(S, op.id, true);
      if (!c || c.lit || c.by || !(c.left > 0)) return false;
      c.left--;
      c.tops = c.tops.filter((t) => !eatenAt(t[1], t[2], c.left)); // 먹은 조각 위의 장식도 같이 먹었다
      if (!c.left) rmCake(S, op.id, c);
      return true;
    }
    case 'cakeSet': {
      const id = op.id, k = op.c;
      if (!okId(id) || !k || typeof k !== 'object' || Array.isArray(k)) return false;
      const nul = (v) => v === null || v === undefined || v === '';
      if (![undefined, null, false, true, 0, 1].includes(k.gone)) return false;
      const home = nul(k.home) ? null : k.home, by = nul(k.by) ? null : k.by, on = nul(k.on) ? null : k.on, gone = k.gone === true || k.gone === 1;
      if (home !== null ? !isBench(S, home) || S.items.has(id) : !isBench(S, id)) return false;
      if (gone) { if (home !== null) return false; S.cakes.set(id, { ...newCake(), gone: true, left: 0 }); return true; }
      const left = k.left === undefined ? CAKE.slices : k.left;
      if (!isInt(left) || left < 1 || left > CAKE.slices) return false;
      if (!isInt(k.cream) || k.cream < 0 || k.cream >= CREAMS.length) return false;
      if (!Array.isArray(k.tops) || k.tops.length > CAKE.max) return false;
      const tops = [];
      for (const t of k.tops) {
        if (!Array.isArray(t) || !okTop(t[0], t[1], t[2])) return false;
        if (!eatenAt(t[1], t[2], left)) tops.push([t[0], t[1], t[2]]); // 먹은 쪽의 장식은 버린다
      }
      const c = { cream: k.cream, tops, lit: 0, by, on, home, left, gone: false };
      const lt = k.lit === undefined ? 0 : k.lit;
      if (!isInt(lt) || lt < 0 || lt > candles(c)) return false;
      c.lit = lt;
      if (by !== null && on !== null) return false;
      if (by !== null) { if (!okPid(by)) return false; for (const [x, o] of S.cakes) if (x !== id && !o.gone && o.by === by) return false; }
      if (on !== null) { const t = S.items.get(on); if (!t || !F[t.k].holds) return false; const o = cakeOnTable(S, on); if (o && o !== id) return false; }
      if (by === null && on === null && !benchFree(S, benchOf(id, c), id)) return false;
      if (home !== null && !S.cakes.has(id) && liveCount(S) >= CAKE.many) return false;
      S.cakes.set(id, c);
      return true;
    }
    case 'note': {
      if (!okId(op.id) || S.notes.has(op.id) || !okWords(op.name, NOTE.name) || !okWords(op.text, NOTE.text) || !isInt(op.at) || op.at <= 0 || op.at > 1e13) return false;
      S.notes.set(op.id, { id: op.id, name: op.name, text: op.text, at: op.at });
      while (S.notes.size > NOTE.max) S.notes.delete(notesList(S).pop().id); // 가장 오래된 것부터 빠진다
      return true;
    }
    case 'noteDel': return S.notes.delete(op.id);
    case 'best': {
      const b = BEST[op.k];
      if (!Object.hasOwn(BEST, op.k) || !isInt(op.v) || op.v < 1 || op.v > b.top || !okWords(op.name, NOTE.name)) return false;
      const now = S.best[op.k];
      if (now && op.v <= now.v) return false; // 지금 기록보다 높아야 한다
      S.best[op.k] = { v: op.v, name: op.name };
      return true;
    }
    case 'star': { // 꼭대기 별 (S.star 가 없던 때의 방은 안 달린 것)
      if (op.on === false) { const had = !!S.star; S.star = null; return had; }
      if (op.on !== true || S.star || !okWords(op.name, NOTE.name) || !okWords(op.help, NOTE.name) || (op.by !== undefined && !okPid(op.by))) return false;
      S.star = { name: op.name, help: op.help };
      return true;
    }
    case 'adv': {
      if (!isInt(op.d) || op.d < 1 || op.d > 25 || S.adv.has(op.d) || !okWords(op.name, NOTE.name) || !isInt(op.at) || op.at <= 0 || op.at > 1e13) return false;
      S.adv.set(op.d, { name: op.name, at: op.at });
      return true;
    }
    case 'gift': {
      if (!okId(op.id) || S.gifts.has(op.id) || S.gifts.size >= GIFT.max || !okWords(op.to, GIFT.name) || !okWords(op.from, GIFT.name)) return false;
      if (!(op.text === '' || okWords(op.text, GIFT.text)) || !has(WRAPS, op.wrap) || !isInt(op.at) || op.at <= 0 || op.at > 1e13) return false;
      if (![undefined, null, '', true, false].includes(op.open)) return false;
      const packed = op.cake === true;
      if (!packed && ![undefined, null, '', false].includes(op.cake)) { // 케이크 한 조각을 담는다: 먹을 수 있는 케이크여야 한다
        const c = cakeOf(S, op.cake, false) || (isBench(S, op.cake) && !S.cakes.has(op.cake) ? newCake() : null);
        if (!c || c.lit || c.by || !(c.left > 0)) return false;
        if (!apply(S, { t: 'cakeEat', id: op.cake }, fixed)) return false;
      }
      S.gifts.set(op.id, { id: op.id, to: op.to, from: op.from, text: op.text, wrap: op.wrap, at: op.at, cake: packed || !!op.cake, open: op.open === true });
      return true;
    }
    case 'giftOpen': { const g = S.gifts.get(op.id); if (!g || g.open) return false; g.open = true; return true; }
    case 'giftDel': return S.gifts.delete(op.id);
    case 'snowman': { // 마당에서 같이 만든 눈사람: 마당 칸에만, 방에 눈사람이 SNOWMEN 개가 될 때까지
      if (!okId(op.id) || S.items.has(op.id) || S.cakes.has(op.id) || S.items.size >= MAX_ITEMS || zoneOf(op.i, op.j) !== 'yard') return false;
      let n = 0;
      for (const o of S.items.values()) if (o.k === 'snowman') n++;
      if (n >= SNOWMEN) return false;
      const it = { id: op.id, k: 'snowman', i: op.i, j: op.j, r: 0 };
      if (!canPlace(S, it, fixed)) return false;
      S.items.set(it.id, it);
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
    v: 2, at: S.at, sync: S.sync, // v 1 = 거실만 있던 때의 방, v 2 = 주방과 방이 붙은 집 (칸 번호는 같다)
    items: [...S.items.values()].map((o) => [o.id, o.k, o.i, o.j, o.r]),
    orns: [...S.orns.values()].map((o) => [o.id, o.k, o.x, o.y, o.z]),
    // [id, 크림, 켠 초, 장식] 뒤에, 들고 있거나 탁자에 올려놓았으면 [든 사람, 탁자] 가 붙는다.
    // 오븐에서 구웠거나 먹기 시작했거나 다 먹은 케이크는 [든 사람, 탁자, 작업대, 남은 조각, 다 먹었으면 1] 까지 붙는다
    cakes: [...S.cakes].map(([id, c]) => {
      const row = [id, c.cream, c.lit, c.tops.map((t) => [t[0], t[1], t[2]])];
      if (!c.home && !c.gone && c.left === CAKE.slices) return c.by || c.on ? [...row, c.by || '', c.on || ''] : row;
      return [...row, c.by || '', c.on || '', c.home || '', c.left, c.gone ? 1 : 0];
    }),
    lights: [S.lights.set, S.lights.blink], wall: S.wall, floor: S.floor,
    notes: [...S.notes.values()].map((o) => [o.id, o.name, o.text, o.at]), // 방명록 [id, 이름, 글, 남긴 때]
    best: Object.fromEntries(Object.entries(S.best).map(([k, b]) => [k, [b.v, b.name]])), // 이 방 최고 기록 { 놀이: [점수, 이름] }
    ...(S.star ? { star: [S.star.name, S.star.help] } : {}), // 꼭대기 별 [단 사람, 받친 사람] (안 달렸으면 없다)
    adv: [...S.adv].sort((a, b) => a[0] - b[0]).map(([d, o]) => [d, o.name, o.at]), // 어드벤트 달력에서 연 칸 [날, 연 사람, 연 때]. 이 항목이 없으면 달력이 없던 때의 방
    gifts: giftsList(S).map((g) => [g.id, g.to, g.from, g.text, g.wrap, g.at, g.cake ? 1 : 0, g.open ? 1 : 0]), // 트리 밑 선물 [id, 받는 사람, 보낸 사람, 편지, 포장, 둔 때, 케이크, 열림]
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
  for (const [d, name, at] of rows(data.adv)) out.push({ t: 'adv', d, name, at }); // 연 칸을 먼저: 거기서 풀린 가구·장식을 놓을 수 있게
  for (const [id, k, i, j, r] of rows(data.items)) out.push({ t: 'put', id, k, i, j, r });
  for (const [id, k, x, y, z] of rows(data.orns)) out.push({ t: 'orn', id, k, x, y, z });
  // 케이크는 한 줄에 cakeSet 하나. 작업대를 떠난 케이크(다 먹었거나, 들었거나, 탁자 위)를 먼저 놓아야 작업대 자리가 빈다
  const away = [], home = [];
  for (const [id, cream, lit, tops, by, on, bench, left, gone] of rows(data.cakes)) {
    const c = { cream, lit, tops: rows(tops).map(([k, x, z]) => [k, x, z]), by: by || null, on: on || null, home: bench || null, left: left === undefined ? CAKE.slices : left, gone: !!gone };
    (c.gone || c.by || c.on ? away : home).push({ t: 'cakeSet', id, c });
  }
  out.push(...away, ...home);
  if (Array.isArray(data.lights)) out.push({ t: 'lights', set: data.lights[0], blink: data.lights[1] });
  out.push({ t: 'wall', v: data.wall }, { t: 'floor', v: data.floor });
  for (const [id, name, text, at] of rows(data.notes)) out.push({ t: 'note', id, name, text, at }); // 방명록이 없던 때의 방은 빈 방명록
  if (data.best && typeof data.best === 'object' && !Array.isArray(data.best)) for (const k of Object.keys(BEST)) if (Array.isArray(data.best[k])) out.push({ t: 'best', k, v: data.best[k][0], name: data.best[k][1] });
  out.push(Array.isArray(data.star) ? { t: 'star', on: true, name: data.star[0], help: data.star[1] } : { t: 'star', on: false }); // 꼭대기 별이 없던 때의 방은 안 달린 채로 연다
  for (const [id, to, from, text, wrap, at, cake, open] of rows(data.gifts)) out.push({ t: 'gift', id, to, from, text, wrap, at, cake: cake === 1 || cake === true, open: open === 1 || open === true }); // 선물이 없던 때의 방은 빈 트리 밑
  return out;
}
