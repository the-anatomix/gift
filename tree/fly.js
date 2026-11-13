// 방장의 비행 슈트로 날기. 옷(비행 슈트)의 모양은 costume.js, 나는 몸짓은 avatar.js 의 animate(A.fly) 에 있고, 여기는 규칙과 단추·동기화다.
//
// 규칙
//   - 방장(혼자 노는 내 방 포함)이 비행 슈트를 입었을 때만 "🚀 날기" 단추가 보인다. 누르면 떠오르고, 다시 누르면("🛬 착지") 내려앉는다.
//   - 나는 동안: 바닥을 누르거나 방향키·조이스틱으로 그쪽으로 날아간다. ▲▼ 단추(키보드 R / F, PageUp / PageDown)로 오르내린다.
//   - 집 안에서는 천장 밑(CEIL)까지. 가구와 벽은 걸을 때와 같이 막힌다. 천장에서 ▲를, 바닥에서 ▼를 잠깐 더 누르고 있으면 위층·아래층으로 넘어간다
//     (넘어간 자리에 가구가 있으면 가장 가까운 빈칸으로). 1층 바닥에서 ▼를 더 누르면 착지한다.
//   - 마당에서는 YARD_TOP 까지 높이 오른다. HI 보다 높으면 마당의 가구(눈사람 등) 위를 지나가고, 나무·가로등·집 벽은 그대로 막힌다. 현관문은 HI 보다 낮게 날아야 지난다.
//   - 못 나는 때(K.busy): 걷기 화면이 아닐 때(가구·트리·벽지·캐릭터 판, 놀이 판, 문 앞), 같이 놀기(숨바꼭질·몰래 산타) 중, 눈싸움 모드·팀전·눈 뭉치 굴리기,
//     케이크를 들었을 때, 누웠을 때, 사다리를 타는 중. 나는 중에 그렇게 되면 그 자리(막혔으면 가장 가까운 빈칸)에 바로 내려선다.
//   - 나는 동안에는 가구 누르기와 "그 앞에서 스페이스바"가 쉬어서 침대·사다리·놀이를 시작하지 않는다(app.js 의 lift, nearAction).
// 동기화: 자리는 평소처럼 pos 로, 높이는 놀이 소식 { k: 'fly', v: '세상 높이(소수 둘째 자리)' } 로 알린다. 내려서면 v: ''.
//   높이는 층 바닥이 아니라 세상 기준이라서 층을 넘는 순간에도 끊기지 않는다. 방장('h')이 보낸 것만, 비행 슈트를 입고 있을 때만 받는다.
import { BODY_R, FLY_SPEED } from './avatar.js';
import { HOST_OUTFIT } from './costume.js';
import { cellOf, centerOf, zoneOf, levelOf, YARD, FLOOR_H, FLOOR_DX, LEVELS, X0, Z0, GX1, GZ1 } from './path.js';

export const CEIL = 1.2;      // 집 안에서 뜰 수 있는 높이 (머리가 천장에 닿지 않게)
export const YARD_TOP = 7.5;  // 마당에서 오를 수 있는 높이
export const HI = 1.5;        // 이보다 높으면 마당의 가구 위를 지난다
const VS = 2.4;               // 오르내리는 빠르기
const HOVER = 0.55;           // 처음 떠오르는 높이
const HOLD = 0.35;            // 천장·바닥에서 이만큼 더 누르고 있으면 층을 넘는다(초)

// K = { me, others(), grid, fixed(i, j), isHost(), look(), setLook(patch), busy(), online(), fx(m), toast(msg), dirty(), $ }
export function makeFly(K) {
  const me = K.me, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const css = document.createElement('style');
  css.textContent = '#flyBtn,#flyUp,#flyDown{position:absolute;left:10px;z-index:3;width:58px;height:58px;padding:0;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;'
    + 'font-size:11px;font-weight:800;line-height:1.1;box-shadow:0 4px 14px rgba(60,30,10,.28);touch-action:none;user-select:none;-webkit-user-select:none}'
    + '#flyBtn b,#flyUp b,#flyDown b{font-size:21px;line-height:1}#flyBtn{bottom:246px}#flyDown{bottom:312px}#flyUp{bottom:378px}'
    + '#flyBtn[aria-pressed=true]{background:#C2261F;border-color:#C2261F;color:#fff}#flyUp.on,#flyDown.on{background:#FFE7A8}';
  document.head.appendChild(css);
  const mk = (id, icon, text, label) => {
    const b = document.createElement('button');
    b.type = 'button'; b.id = id; b.className = 'btn'; b.hidden = true; b.setAttribute('aria-label', label);
    const i = document.createElement('b'); i.textContent = icon; b.append(i, text);
    document.body.appendChild(b);
    return b;
  };
  const btn = mk('flyBtn', '🚀', '날기', '날기'), up = mk('flyUp', '▲', '위로', '위로 날기'), down = mk('flyDown', '▼', '아래로', '아래로 날기');
  btn.setAttribute('aria-pressed', 'false');

  let on = false, held = 0, keyV = 0;      // held = 누르고 있는 단추(1 위, -1 아래), keyV = 키보드
  let target = null, landing = null, cross = null, rise = 0, pushT = 0, clock = 0, sentAt = -9, sentY = -9, demoted = false;

  const suited = () => K.look().outfit === HOST_OUTFIT && K.isHost();
  const lvY = () => me.level * FLOOR_H;
  const alt = () => (me.fly ? me.fly.y - lvY() : 0);
  const inYard = (x = me.x, z = me.z) => { const [i, j] = cellOf(x, z); return zoneOf(i, j) === 'yard'; };
  // 그 높이로 (x, z) 에 있을 수 있는지
  function fits(x, z, a) {
    if (x < X0 + BODY_R || x > GX1 - BODY_R || z < Z0 + BODY_R || z > GZ1 - BODY_R) return false;
    if (a < HI) return K.grid.fits(x, z, BODY_R);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { // 높이 떴다: 마당 하늘만. 나무·가로등·집 벽(현관문 줄 포함)은 막힌다
      const [i, j] = cellOf(x + dx * BODY_R, z + dz * BODY_R);
      if (zoneOf(i, j) !== 'yard' || j <= YARD.wall || K.fixed(i, j)) return false;
    }
    return true;
  }
  const setY = (y) => { me.fly.y = me.fly.to = y; me.root.position.y = y; };
  // (dx, dz) 쪽으로 step 만큼. 막히면 한 축씩 미끄러진다. 움직였으면 true
  function slide(dx, dz, step) {
    const a = alt(), ox = me.x, oz = me.z, nx = me.x + dx * step, nz = me.z + dz * step;
    if (fits(nx, nz, a)) me.place(nx, nz); else if (fits(nx, me.z, a)) me.place(nx, me.z); else if (fits(me.x, nz, a)) me.place(me.x, nz);
    return Math.hypot(me.x - ox, me.z - oz) > 1e-5;
  }
  // 내려설 자리: 지금 자리가 비었으면 거기, 아니면 같은 층의 가장 가까운 빈칸
  function spot() {
    if (K.grid.fits(me.x, me.z, BODY_R)) return [me.x, me.z];
    const [i, j] = cellOf(me.x, me.z), c = K.grid.nearestFree(i, j, me.x, me.z);
    return c ? centerOf(c[0], c[1]) : null;
  }
  function tell(force) {
    if (!K.online() || !on) return;
    const y = me.fly.y;
    if (!force && clock - sentAt < 0.1) return;
    if (!force && Math.abs(y - sentY) < 0.02 && clock - sentAt < 1) return; // 가만히 떠 있어도 1초에 한 번은 알린다(새로 온 사람에게도 보이게)
    sentAt = clock; sentY = y;
    K.fx({ k: 'fly', v: y.toFixed(2) });
  }
  function start() {
    if (on) return true;
    if (!suited()) { K.toast('비행 슈트를 입은 방장만 날 수 있어요'); return false; }
    if (K.busy()) { K.toast('지금은 날 수 없어요'); return false; }
    me.stop(); me.onArrive = null;
    on = true; target = landing = cross = null; pushT = 0; rise = HOVER;
    me.fly = { y: lvY(), to: lvY(), mv: false, t: 0 };
    paint(); tell(true); K.dirty();
    return true;
  }
  function end() {
    on = false; target = landing = cross = null; held = 0; keyV = 0; rise = 0;
    me.fly = null; me.sync(); me.animate(0, false);
    if (K.online()) K.fx({ k: 'fly', v: '' });
    paint(); K.dirty();
  }
  // 내려선다. now = true 면 그 자리에 바로(놀이가 시작됐을 때 등), 아니면 천천히 내려앉는다
  function land(now) {
    if (!on) return false;
    const s = spot();
    if (now || !s) { if (s) me.place(s[0], s[1]); end(); return true; }
    landing = s; target = null; cross = null; rise = 0;
    return true;
  }
  // 위층·아래층으로 넘어가기 시작한다
  function startCross(dir) {
    const lv = me.level + dir;
    if (lv < 0 || lv >= LEVELS || inYard()) return false;
    let x = me.x + dir * FLOOR_DX, z = me.z;
    if (!K.grid.fits(x, z, BODY_R)) {
      const [i, j] = cellOf(x, z), c = K.grid.nearestFree(i, j, x, z);
      if (!c || levelOf(centerOf(c[0], c[1])[0]) !== lv) { K.toast(dir > 0 ? '위층에 설 자리가 없어요' : '아래층에 설 자리가 없어요'); return false; }
      [x, z] = centerOf(c[0], c[1]);
    }
    cross = { dir, lv, x, z, done: false }; target = null;
    return true;
  }

  function paint() {
    const show = suited() && (on || !K.busy());
    btn.hidden = !show; up.hidden = down.hidden = !(show && on);
    btn.setAttribute('aria-pressed', String(on));
    btn.lastChild.textContent = on ? '착지' : '날기'; btn.firstChild.textContent = on ? '🛬' : '🚀';
    btn.setAttribute('aria-label', on ? '착지' : '날기');
    up.classList.toggle('on', held > 0 || keyV > 0); down.classList.toggle('on', held < 0 || keyV < 0);
  }
  btn.addEventListener('click', () => { if (on) land(false); else start(); });
  for (const [b, v] of [[up, 1], [down, -1]]) {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); held = v; try { b.setPointerCapture(e.pointerId); } catch (_) { /* 괜찮다 */ } paint(); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { if (held === v) { held = 0; paint(); } });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  const KEYV = { KeyR: 1, PageUp: 1, KeyF: -1, PageDown: -1 };
  addEventListener('keydown', (e) => {
    if (!on || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.ctrlKey || e.metaKey || e.altKey) return;
    if (KEYV[e.code]) { keyV = KEYV[e.code]; e.preventDefault(); paint(); }
  });
  addEventListener('keyup', (e) => { if (KEYV[e.code] === keyV) { keyV = 0; paint(); } });
  addEventListener('blur', () => { keyV = 0; held = 0; });

  let shown = '';
  function tick(dt) {
    clock += dt;
    // 방장이 아닌데 비행 슈트를 입고 있으면(남의 방에 놀러 갔을 때) 평상복으로 바꿔 두고, 다시 방장이 되면 돌려 입는다
    if (K.look().outfit === HOST_OUTFIT && !K.isHost()) { if (on) land(true); demoted = true; K.setLook({ outfit: 'basic' }, true); }
    else if (demoted && K.isHost()) { demoted = false; if (K.look().outfit === 'basic') K.setLook({ outfit: HOST_OUTFIT }, true); }
    if (on && (!suited() || K.busy())) land(true);
    const key = (suited() ? 1 : 0) + (on ? 2 : 0) + (K.busy() ? 4 : 0);
    if (key !== shown) { shown = key; paint(); }
    if (!on) return false;
    const f = me.fly, ox = me.x, oz = me.z;
    let v = held || keyV;
    if (cross) { // 층을 넘는 중: 곧장 위(아래)로. 반쯤 지나면 그 층으로 옮겨 선다
      const c = cross, edge = (c.dir > 0 ? c.lv : c.lv + 1) * FLOOR_H; // 지나가는 바닥의 높이
      setY(f.y + c.dir * VS * 1.4 * dt);
      if (!c.done && (c.dir > 0 ? f.y >= edge - 0.9 : f.y <= edge - 0.6)) { c.done = true; me.place(c.x, c.z); }
      if (c.dir > 0 ? f.y >= edge + 0.3 : f.y <= edge - FLOOR_H + CEIL) { if (!c.done) me.place(c.x, c.z); cross = null; pushT = 0; }
    } else if (landing) { // 내려앉는 중
      const dx = landing[0] - me.x, dz = landing[1] - me.z, d = Math.hypot(dx, dz), s = Math.min(d, FLY_SPEED * dt);
      if (d > 1e-4) { me.turnTo(dx, dz); me.place(me.x + dx / d * s, me.z + dz / d * s); }
      setY(Math.max(lvY(), f.y - VS * 1.3 * dt));
      if (d - s < 0.03 && f.y <= lvY() + 1e-3) { me.place(landing[0], landing[1]); end(); return true; }
    } else {
      if (target) { // 누른 자리로 날아간다
        const dx = target[0] - me.x, dz = target[1] - me.z, d = Math.hypot(dx, dz);
        if (d < 0.04) target = null;
        else { me.turnTo(dx, dz); if (!slide(dx / d, dz / d, Math.min(d, FLY_SPEED * dt))) target = null; }
      }
      if (v) rise = 0; else if (rise) { v = alt() < rise ? 1 : 0; if (!v) rise = 0; }
      const yard = inYard(), a = alt(), top = yard ? YARD_TOP : CEIL, low = a >= HI && !K.grid.fits(me.x, me.z, BODY_R) ? HI : 0;
      let na = a + v * VS * dt;
      if (a > top + 1e-6) na = Math.max(top, a - VS * dt); else na = clamp(na, low, top); // 마당에서 높이 뜬 채 집에 들어오면 천장 밑으로 내려온다
      setY(lvY() + na);
      // 천장·바닥에 닿은 채 더 누르고 있으면: 층을 넘거나(집 안) 내려선다(맨 아래)
      const pushing = (held || keyV) > 0 ? (na >= top - 1e-3 && !yard) : (held || keyV) < 0 ? na <= 1e-3 : false;
      pushT = pushing ? pushT + dt : 0;
      if (pushT >= HOLD) {
        pushT = 0;
        if ((held || keyV) > 0) { if (me.level < LEVELS - 1) startCross(1); }
        else if (me.level > 0 && !yard) startCross(-1); else land(false);
      }
    }
    f.mv = f.mv2 || Math.hypot(me.x - ox, me.z - oz) > 1e-5; f.mv2 = false;
    tell(false);
    K.dirty();
    return f.mv;
  }

  const api = {
    get on() { return on; },
    tick, start, land,
    // 방향키·조이스틱으로 (dx, dz) 쪽으로 민다 (app.js 의 keyWalk 가 부른다). 움직였으면 true
    push(dx, dz, p, dt) {
      if (!on || cross || landing) return false;
      target = null;
      const mv = slide(dx, dz, FLY_SPEED * p * dt);
      if (mv) me.fly.mv2 = true;
      return mv;
    },
    // 바닥을 눌렀다 (app.js 의 goTo 가 부른다). 날아서 갈 것이면 true, 아니면 false(내려서서 걸어간다)
    goTo(x, z) {
      if (!on) return false;
      if (K.busy() || !suited()) { land(true); return false; }
      if (cross || landing) return true;
      if (levelOf(x) === me.level) target = [clamp(x, X0 + BODY_R, GX1 - BODY_R), clamp(z, Z0 + BODY_R, GZ1 - BODY_R)];
      return true;
    },
    // 방장이 날고 있다는 소식. 방장('h')이 비행 슈트를 입고 있을 때만 받는다
    peerFx(m, id) {
      const a = K.others().get(id);
      if (id !== 'h' || !a || typeof m.v !== 'string') return false;
      if (m.v === '') { if (a.fly) { a.fly = null; a.sync(); a.animate(0, false); K.dirty(); } return true; }
      const y = Number(m.v);
      if (!/^\d{1,2}\.\d\d$/.test(m.v) || !(y >= 0 && y <= LEVELS * FLOOR_H + YARD_TOP) || a.look.outfit !== HOST_OUTFIT || a.rest || a.hop) return false;
      if (a.fly) a.fly.to = y; else a.fly = { y: a.root.position.y, to: y, mv: false, t: 0 };
      K.dirty();
      return true;
    },
  };
  // 자동 검사가 쓰는 창구
  window.__fly = {
    get on() { return on; }, get alt() { return alt(); }, get y() { return me.fly ? me.fly.y : null; }, get shown() { return !btn.hidden; }, get arrows() { return !up.hidden; },
    get crossing() { return !!cross; }, get landing() { return !!landing; }, get target() { return target; },
    start, land, hold(v) { held = v; paint(); }, CEIL, YARD_TOP, HI,
    peer: (id) => { const a = K.others().get(id); return a && a.fly ? { y: a.fly.y, to: a.fly.to, jets: !!(a.parts.jets && a.parts.jets[0].visible) } : null; },
  };
  return api;
}
