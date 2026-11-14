// 내 소원함. 이 기기(localStorage)에만 둔다. 저장된 값이 망가져 있어도 화면이 죽지 않게 읽을 때마다 다듬는다.
import { tidy } from './codec.js';

const KEY = 'nolja.wish.box.v1', MAX = 60;
let mem = null; // 저장소를 못 쓰는 브라우저(비공개 창 등)에서는 이 탭 안에서만 기억한다

function fix(e) {
  const n = tidy(e); if (!n) return null;
  const done = Array.isArray(e.done) ? e.done : [];
  return Object.assign(n, {
    mine: e.mine ? 1 : 0,                                  // 1 내가 쓴 쪽지, 0 받은 쪽지
    opened: e.opened ? 1 : 0,                              // 펼쳐 본 쪽지
    done: n.w.map((_, i) => (done[i] ? 1 : 0)),            // 소원마다 "이뤘어요"
    at: Number.isFinite(e.at) ? e.at : 0,                  // 담은 때
  });
}
export function load() {
  let raw = null;
  try { const s = localStorage.getItem(KEY); raw = s == null ? mem : JSON.parse(s); } catch (_) { raw = mem; /* 망가진 값은 빈 소원함으로 본다 */ }
  const seen = new Set(), out = [];
  for (const e of Array.isArray(raw) ? raw.slice(0, MAX * 2) : []) {
    const n = fix(e);
    if (n && !seen.has(n.id)) { seen.add(n.id); out.push(n); }
    if (out.length >= MAX) break;
  }
  return out;
}
function save(list) {
  mem = list.slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(mem)); return true; } catch (_) { return false; }
}
export const find = (id) => load().find((e) => e.id === id) || null;
// 새 쪽지는 맨 앞에. 이미 있는 쪽지면 그대로 둔다(펼쳐 본 표시와 이룬 소원을 지키려고).
export function keep(note, mine, now) {
  const list = load(), had = list.find((e) => e.id === note.id);
  if (had) return had;
  const e = fix(Object.assign({}, note, { mine, at: now }));
  if (!e) return null;
  list.unshift(e); save(list);
  return e;
}
export function patch(id, fn) {
  const list = load(), e = list.find((x) => x.id === id);
  if (!e) return null;
  fn(e); save(list);
  return e;
}
export function remove(id) { save(load().filter((e) => e.id !== id)); }
// 펼쳐 본 쪽지들의 이룬 소원 수
export function tally(list = load()) {
  let done = 0, all = 0;
  for (const e of list) if (e.opened) { all += e.w.length; done += e.done.filter(Boolean).length; }
  return { done, all };
}
