// 썰매 기차: 누가 루돌프 썰매(fly.js 의 ride, sleigh.js)를 타고 날면, 다른 사람들이 그 뒤에 작은 객차를 달고 줄줄이 따라 탄다.
//
// 규칙
//   - 같이 꾸미는 방에서 누가 썰매를 타고 있고, 내가 위가 뚫린 마당에 서 있으면 "🚃 같이 타기" 단추가 보인다(권한은 필요 없다. 구경하는 사람도 탄다).
//     누르면 가장 가까운 썰매의 맨 뒤 객차에 올라탄다. 썰매가 하늘 높이 있어도 그 자리로 휙 날아올라 앉는다.
//   - 한 썰매에 CARS 칸까지. 먼저 탄 사람이 앞 칸이다.
//   - 탄 동안에는 걷거나 누르는 것이 쉬고, 썰매가 지나간 길을 그대로 따라간다(기차처럼 굽이굽이). 객차에 앉아 두 팔을 흔든다.
//   - "🛬 내리기"를 누르거나 썰매가 내려앉으면(몰던 사람이 나가도) 마당의 가장 가까운 빈칸으로 내려온다.
// 동기화: 탄 사람이 놀이 소식 { k: 'car', v: '몰던사람id;탄때' } 를 1초마다 알리고(새로 온 사람에게도 보이게), 내리면 v: ''.
//   탄때(0.1초 단위)로 칸의 순서를 모두가 똑같이 정한다. 객차의 자리는 저마다의 화면에서 몰던 사람이 지나간 길로 구한다(소식을 기다리지 않아 부드럽다).
// 모양: 객차는 아바타의 root 에 붙였다 뗀다(sleigh.js 와 같은 방식). 앞 칸과 금색 줄로 이어져 보인다.
import { THREE, put, rbox, ball, cyl, bake } from './kit.js';
import { sfx } from './sfx.js';
import { BODY_R } from './avatar.js';
import { ZY } from './fly.js';
import { cellOf, centerOf, toWorld, X0, X1, GZ1 } from './path.js';

export const CARS = 5;       // 한 썰매에 달 수 있는 객차 수
export const GAP = 1.45;     // 칸과 칸 사이 (썰매 길이쯤)
const STEP = 0.08;           // 지나간 길을 이만큼마다 적어 둔다
const KEEP = 160;            // 적어 두는 점의 수(길이 넉넉히)
const OFF_T = 0.9;           // 내려오는 데 걸리는 시간(초)
const WAIT = 2;              // 몰던 사람의 썰매가 보이지 않으면 이만큼 기다렸다가 내린다(소식이 늦게 올 때)
const CAR_RE = /^([a-z0-9]{1,8});(\d{1,9})$/;
const TINT = [0x2F8F4E, 0x2F6FB0, 0xC98A1E, 0x7A4BA8, 0xC62F2A];
const C = { gold: 0xE2B33C, wood: 0x6B4630, dark: 0x3B2A20 };

function build(slot) {
  const g = new THREE.Group(), c = TINT[(slot - 1) % TINT.length];
  put(rbox(0.66, 0.06, 0.9, 0.03), c, 0, 0.1, 0, g);
  for (const s of [-1, 1]) {
    put(rbox(0.05, 0.3, 0.9, 0.02), c, 0.33 * s, 0.25, 0, g);
    put(new THREE.BoxGeometry(0.065, 0.028, 0.92), C.gold, 0.33 * s, 0.41, 0, g, false);
    put(new THREE.BoxGeometry(0.04, 0.04, 1.15), C.gold, 0.27 * s, -0.12, 0.04, g);                        // 날
    for (const z of [-0.28, 0.32]) put(cyl(0.018, 0.018, 0.2, 6), C.gold, 0.27 * s, -0.02, z, g, false);
  }
  put(rbox(0.7, 0.52, 0.06, 0.03), c, 0, 0.36, -0.45, g);                                                     // 등받이
  put(new THREE.BoxGeometry(0.72, 0.03, 0.075), C.gold, 0, 0.63, -0.45, g, false);
  put(rbox(0.66, 0.3, 0.06, 0.03), c, 0, 0.26, 0.47, g).rotation.x = 0.35;                                   // 앞판
  put(rbox(0.56, 0.06, 0.3, 0.02), C.wood, 0, 0.2, -0.05, g, false);                                         // 앉는 널
  put(new THREE.BoxGeometry(0.02, 0.02, 0.62), C.gold, 0, 0.16, 0.82, g, false);                              // 앞 칸과 잇는 줄
  put(ball(0.04, 8, 6), C.gold, 0, 0.16, 1.12, g, false);
  put(ball(0.05, 8, 6), C.dark, 0, 0.66, -0.45, g, false);                                                    // 등받이의 단추
  bake(g);
  return g;
}

// K = { scene, me, others(): Map(id → 아바타), myId(), online(), grid, yard(), busy(), fx(m), toast(msg), nameOf(id), dirty() }
export function makeTrain(K) {
  const me = K.me, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const css = document.createElement('style');
  css.textContent = '#carBtn{position:absolute;left:10px;bottom:246px;z-index:3;width:58px;height:58px;padding:0;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;'
    + 'font-size:11px;font-weight:800;line-height:1.1;box-shadow:0 4px 14px rgba(60,30,10,.28);touch-action:manipulation;user-select:none;-webkit-user-select:none}'
    + '#carBtn b{font-size:21px;line-height:1}#carBtn.up{bottom:312px}#carBtn[aria-pressed=true]{background:#2F6FB0;border-color:#2F6FB0;color:#fff}';
  document.head.appendChild(css);
  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'carBtn'; btn.className = 'btn'; btn.hidden = true;
  const ic = document.createElement('b'); btn.append(ic, '');
  document.body.appendChild(btn);

  const seats = new Map();  // 탄 사람의 id → { a: 아바타, d: 몰던 사람 id, t: 탄때, m: 객차 모양, slot, lost: 썰매가 안 보인 시간, off: 내려오는 중 { t, x, z } }
  const trails = new Map(); // 썰매를 모는 아바타 → 지나간 길 [{ x, y, z }] (새것이 앞)
  let clock = 0, sentAt = -9;

  const avatarOf = (id) => (id === K.myId() ? me : K.others().get(id));
  const sledding = (a) => !!(a && a.fly && a.fly.sled);
  const mine = () => { const s = seats.get(K.myId()); return s && s.a === me && !s.off ? s : null; };
  const riders = (d) => [...seats.entries()].filter(([, s]) => s.d === d && !s.off).sort((x, y) => x[1].t - y[1].t || (x[0] < y[0] ? -1 : 1));

  // 썰매를 모는 사람 중 가장 가까운, 빈 칸이 있는 사람
  function nearest() {
    let best = null, bd = Infinity;
    const p = me.root.position;
    for (const [id, a] of K.others()) {
      if (!sledding(a) || riders(id).length >= CARS) continue;
      const d = Math.hypot(a.root.position.x - p.x, a.root.position.z - p.z);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }
  const canBoard = () => K.online() && !mine() && !seats.has(K.myId()) && !K.busy() && K.yard() && !!nearest();

  function seat(id, a, d, t) {
    let s = seats.get(id);
    if (s && s.off) { unseat(id, s); s = null; }
    if (!s) {
      s = { a, d, t, m: null, slot: 0, lost: 0, off: null };
      seats.set(id, s);
      if (a.rest) a.rise();
      a.stop(); a.onArrive = null;
      const p = a.root.position;
      a.fly = { y: p.y, to: p.y, mv: false, t: 0, air: { x: p.x, z: p.z, tx: p.x, tz: p.z }, sled: false, car: true };
      sfx('sleighOn', a === me ? null : a);
    }
    s.d = d; s.t = t;
    return s;
  }
  function unseat(id, s) {
    if (s.m) { s.a.root.remove(s.m); s.m.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); s.m = null; }
    if (s.a.fly && s.a.fly.car) { s.a.fly = null; s.a.sync(); s.a.animate(0, false); }
    seats.delete(id);
    K.dirty();
  }
  // 내려오기 시작한다. 내려설 자리는 마당의 가장 가까운 빈칸
  function leave(id, s) {
    if (s.off) return;
    let x = clamp(s.a.x, X0 + BODY_R, X1 - BODY_R), z = clamp(s.a.z, ZY, GZ1 - BODY_R);
    if (!K.grid.fits(x, z, BODY_R)) { const [i, j] = cellOf(x, z), c = K.grid.nearestFree(i, j, x, z); if (c) [x, z] = centerOf(c[0], c[1]); }
    s.off = { t: 0, x, z };
    if (s.a === me) { me.place(x, z); if (K.online()) K.fx({ k: 'car', v: '' }); }
  }

  function board() {
    if (!canBoard()) { K.toast('지금은 탈 수 없어요'); return false; }
    const d = nearest(), t = Math.floor(Date.now() / 100) % 1e9;
    seat(K.myId(), me, d, t);
    K.fx({ k: 'car', v: d + ';' + t }); sentAt = clock;
    K.toast(`${K.nameOf(d)} 님의 썰매 기차에 탔어요 🚃`);
    paint(); K.dirty();
    return true;
  }
  function getOff() { const s = mine(); if (!s) return false; leave(K.myId(), s); paint(); return true; }
  btn.addEventListener('click', () => { if (mine()) getOff(); else board(); });

  let shown = '';
  function paint() {
    const on = !!mine(), show = on || canBoard();
    btn.hidden = !show;
    btn.setAttribute('aria-pressed', String(on));
    ic.textContent = on ? '🛬' : '🚃'; btn.lastChild.textContent = on ? '내리기' : '같이 타기';
    btn.setAttribute('aria-label', on ? '썰매 기차에서 내리기' : '썰매 기차에 같이 타기');
    btn.classList.toggle('up', !on && !!(document.getElementById('sledBtn') && !document.getElementById('sledBtn').hidden)); // 썰매 단추가 있으면 그 위로
  }

  // 몰던 사람이 지나간 길에서, 앞에서부터 (땅 위 거리로) dist 만큼 뒤의 자리. 곧장 떠오른 길은 길이로 치지 않는다.
  // 길이 모자라면 바라보는 쪽의 반대로 지금 높이 그대로 곧게 늘인다
  const at = new THREE.Vector3();
  function along(a, dist) {
    const tr = trails.get(a) || [], p = a.root.position;
    let px = p.x, py = p.y, pz = p.z, left = dist, ry = a.root.rotation.y;
    for (const q of tr) {
      const L = Math.hypot(q.x - px, q.z - pz);
      if (L < 1e-6) continue;
      ry = Math.atan2(px - q.x, pz - q.z);
      if (L >= left) { const k = left / L; return at.set(px + (q.x - px) * k, py + (q.y - py) * k, pz + (q.z - pz) * k); }
      left -= L; px = q.x; py = q.y; pz = q.z;
    }
    return at.set(px - Math.sin(ry) * left, Math.max(py, p.y), pz - Math.cos(ry) * left);
  }

  function tick(dt) {
    clock += dt;
    // 썰매를 모는 사람들이 지나간 길을 적는다
    const drivers = new Set();
    for (const a of [me, ...K.others().values()]) {
      if (!sledding(a)) continue;
      drivers.add(a);
      let tr = trails.get(a);
      if (!tr) trails.set(a, tr = []);
      const p = a.root.position;
      if (!tr.length || Math.hypot(p.x - tr[0].x, p.y - tr[0].y, p.z - tr[0].z) > STEP) { tr.unshift({ x: p.x, y: p.y, z: p.z }); if (tr.length > KEEP) tr.length = KEEP; }
    }
    for (const a of trails.keys()) if (!drivers.has(a)) trails.delete(a);
    // 탄 사람들
    for (const [id, s] of [...seats]) {
      if (s.a !== me && K.others().get(id) !== s.a) { unseat(id, s); continue; } // 나간 사람
      const f = s.a.fly;
      if (!f || !f.car) { seats.delete(id); continue; }                            // 다른 것이 아바타를 가져갔다
      if (s.off) { // 내려오는 중: 내려설 자리로 날아 내려온다
        s.off.t += dt;
        const w = toWorld(s.a === me ? s.off.x : s.a.x, s.a === me ? s.off.z : s.a.z);
        f.air.tx = w[0]; f.air.tz = w[2]; f.to = w[1];
        if (s.m && s.off.t > 0.25) { s.a.root.remove(s.m); s.m = null; }
        if (s.off.t >= OFF_T) unseat(id, s);
        K.dirty();
        continue;
      }
      const d = avatarOf(s.d);
      if (!sledding(d) || s.d === id) {
        s.lost += dt;
        if (s.a === me ? s.lost > 0.4 : s.lost > WAIT) { if (s.a === me) K.toast('썰매가 내려앉았어요'); leave(id, s); }
        continue;
      }
      s.lost = 0;
      const list = riders(s.d), slot = list.findIndex(([x]) => x === id) + 1;
      if (slot > CARS) { if (s.a === me) K.toast('썰매 기차가 꽉 찼어요'); leave(id, s); continue; }
      if (slot !== s.slot) { if (s.m) { s.a.root.remove(s.m); s.m = null; } s.slot = slot; }
      if (!s.m) { s.m = build(slot); s.a.root.add(s.m); }
      const p = along(d, slot * GAP);
      f.air.tx = p.x; f.air.tz = p.z; f.to = Math.max(0, p.y);
      const q = along(d, slot * GAP - 0.35); // 앞 칸 쪽을 본다
      if (Math.hypot(q.x - p.x, q.z - p.z) > 1e-4) s.a.face = Math.atan2(q.x - p.x, q.z - p.z);
      f.mv = d.moving;
      if (s.a === me) { // 격자의 자리는 마당 안의 가장 가까운 자리("그림자")
        me.place(clamp(f.air.x, X0 + BODY_R, X1 - BODY_R), clamp(f.air.z, ZY, GZ1 - BODY_R));
        if (K.online() && clock - sentAt > 1) { sentAt = clock; K.fx({ k: 'car', v: s.d + ';' + s.t }); }
      }
      K.dirty();
    }
    const key = (mine() ? 1 : 0) + (canBoard() ? 2 : 0) + (document.getElementById('sledBtn') && !document.getElementById('sledBtn').hidden ? 4 : 0);
    if (key !== shown) { shown = key; paint(); }
  }

  // 누가 썰매 기차에 탔다(v: '몰던사람id;탄때') / 내렸다('')
  function peerFx(m, id) {
    const a = K.others().get(id);
    if (!a || typeof m.v !== 'string') return false;
    if (m.v === '') { const s = seats.get(id); if (s) leave(id, s); return true; }
    const x = CAR_RE.exec(m.v);
    if (!x) return false;
    const d = x[1], t = Number(x[2]);
    if (d === id || !avatarOf(d)) return false;
    const had = seats.get(id);
    if (!had || had.off) { if (riders(d).length >= CARS) return false; if (a.fly && !a.fly.car) return false; }
    seat(id, a, d, t);
    if (!had && d === K.myId()) K.toast(`${K.nameOf(id)} 님이 썰매 기차에 탔어요 🚃`);
    K.dirty();
    return true;
  }

  const api = { tick, peerFx, board, getOff, get on() { return !!seats.get(K.myId()); } };
  // 자동 검사가 쓰는 창구
  window.__train = {
    get on() { return api.on; }, get shown() { return !btn.hidden; }, get up() { return btn.classList.contains('up'); }, board, getOff, CARS, GAP,
    seat: (id) => { const s = seats.get(id === 'me' ? K.myId() : id); return s ? { d: s.d, slot: s.slot, car: !!s.m, off: !!s.off, x: s.a.root.position.x, y: s.a.root.position.y, z: s.a.root.position.z } : null; },
    riders: (d) => riders(d).map(([x]) => x),
  };
  return api;
}
