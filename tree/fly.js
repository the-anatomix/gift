// 비행 슈트로 날기 (입고 나는 권한은 master.js 의 SUIT: 마스터키를 켠 사람과 마스터가 허락한 사람. 아래 글의 "방장"은 그 권한이 있는 사람을 뜻한다). 옷(비행 슈트)의 모양은 costume.js, 나는 몸짓은 avatar.js 의 animate(A.fly) 에 있고, 여기는 규칙과 단추·동기화다.
//
// 규칙
//   - 방장(혼자 노는 내 방 포함)이 비행 슈트를 입었을 때만 "🚀 날기" 단추가 보인다. 누르면 떠오르고, 다시 누르면("🛬 착지") 내려앉는다.
//   - 나는 동안: 바닥을 누르거나 방향키·조이스틱으로 그쪽으로 날아간다. ▲▼ 단추(키보드 R / F, PageUp / PageDown)로 오르내린다.
//   - 집 안에서는 천장 밑(CEIL)까지. 가구와 벽은 걸을 때와 같이 막힌다. 천장에서 ▲를, 바닥에서 ▼를 잠깐 더 누르고 있으면 위층·아래층으로 넘어간다
//     (넘어간 자리에 가구가 있으면 가장 가까운 빈칸으로). 1층 바닥에서 ▼를 더 누르면 착지한다.
//   - 마당에서는 SKY_TOP 까지 높이 오른다. HI 보다 높이 뜨면 "하늘"이다(me.fly.air = 세상 좌표 { x, z }): 마당의 가구(눈사람 등) 위를 지나고,
//     울타리 너머 집 밖 하늘 전체를 날아다닌다. OVER 보다 높으면 마당의 나무·가로등 위를, ROOF 보다 높으면 집 위를 지난다(그보다 낮으면 막힌다).
//     집 한가운데에서 FAR[0] 보다 멀어지면 바깥쪽으로 점점 느려지고 FAR[1] 보다 멀리는 못 간다(부드러운 경계). 현관문은 HI 보다 낮게 날아야 지난다.
//     하늘에 있는 동안 격자의 자리(me.x, me.z)는 마당 안의 가장 가까운 자리("그림자")에 둔다: 걷는 자리 소식·층·소리 거리·내려설 자리는 그것으로 친다.
//     집 밖에서는 HI 보다 낮게 못 내려가고, 착지하면 마당의 가장 가까운 빈칸으로 날아와 내려앉는다.
//   - 루돌프 썰매(ride): 🦌 권한(master.js 의 SLED)이 있으면 비행 슈트 없이 마당에서 탄다. 타면 바로 하늘로 뜨고(HI 밑으로 안 내려감), 내리면 마당에 내려앉는다.
//     썰매의 모양·방울 소리·반짝이 꼬리는 sleigh.js, 앉은 몸짓은 avatar.js 의 animate(A.fly.sled).
//   - 못 나는 때(K.busy): 걷기 화면이 아닐 때(가구·트리·벽지·캐릭터 판, 놀이 판, 문 앞), 같이 놀기(숨바꼭질·몰래 산타) 중, 눈싸움 모드·팀전·눈 뭉치 굴리기,
//     케이크를 들었을 때, 누웠을 때, 사다리를 타는 중. 나는 중에 그렇게 되면 그 자리(막혔으면 가장 가까운 빈칸)에 바로 내려선다.
//   - 나는 동안에는 가구 누르기와 "그 앞에서 스페이스바"가 쉬어서 침대·사다리·놀이를 시작하지 않는다(app.js 의 lift, nearAction).
// 동기화: 자리는 평소처럼 pos 로, 높이는 놀이 소식 { k: 'fly', v: '[s]높이[;x;z]' } 로 알린다(모두 소수 둘째 자리). 내려서면 v: ''.
//   높이는 층 바닥이 아니라 세상 기준이라서 층을 넘는 순간에도 끊기지 않는다. ;x;z 는 하늘에 있을 때의 세상 좌표, 맨 앞의 s 는 썰매를 탔다는 표시.
//   보낸 사람이 비행 슈트를 입고 있거나 썰매 표시가 있을 때만 받는다(권한은 보낸 사람 기기에서 판단한다).
import { BODY_R, FLY_SPEED } from './avatar.js';
import { HOST_OUTFIT } from './costume.js';
import { cellOf, centerOf, zoneOf, levelOf, YARD, FLOOR_H, FLOOR_DX, LEVELS, CELL, X0, X1, Z0, GX1, GZ1 } from './path.js';

export const CEIL = 1.2;      // 집 안에서 뜰 수 있는 높이 (머리가 천장에 닿지 않게)
export const SKY_TOP = 16;    // 마당과 집 밖 하늘에서 오를 수 있는 높이
export const YARD_TOP = SKY_TOP;
export const HI = 1.5;        // 이보다 높으면 하늘이다: 마당의 가구 위를 지나고 울타리 밖으로 나간다
export const OVER = 4.5;      // 이보다 높으면 마당의 나무·가로등 위를 지난다
export const ROOF = LEVELS * FLOOR_H + 0.6; // 이보다 높으면 집 위를 지난다
export const FAR = [15, 20];  // 집 한가운데에서 이만큼 멀어지면 느려지기 시작하고, 이만큼보다 멀리는 못 간다
export const WX = (X0 + X1) / 2, WZ = (Z0 + GZ1) / 2; // 세상의 한가운데(집과 마당의 가운데)
const VS = 2.4;               // 오르내리는 빠르기
const HOVER = 0.55;           // 처음 떠오르는 높이
const RIDE_HOVER = 2.6;       // 썰매를 타면 떠오르는 높이
const HOLD = 0.35;            // 천장·바닥에서 이만큼 더 누르고 있으면 층을 넘는다(초)
const WALL = 0.3;             // 집 벽의 두께쯤
const ZY = Z0 + YARD.j0 * CELL + BODY_R; // 마당의 북쪽 끝(집 남쪽 벽 바로 앞)
const FLY_RE = /^(s?)(\d{1,2}\.\d\d)(?:;(-?\d{1,2}\.\d\d);(-?\d{1,2}\.\d\d))?$/;

// K = { me, others(), grid, fixed(i, j), isHost(), canSled(), look(), setLook(patch), busy(), online(), fx(m), toast(msg), dirty(), $ }
export function makeFly(K) {
  const me = K.me, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const css = document.createElement('style');
  css.textContent = '#flyBtn,#flyUp,#flyDown,#sledBtn{position:absolute;left:10px;z-index:3;width:58px;height:58px;padding:0;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;'
    + 'font-size:11px;font-weight:800;line-height:1.1;box-shadow:0 4px 14px rgba(60,30,10,.28);touch-action:none;user-select:none;-webkit-user-select:none}'
    + '#flyBtn b,#flyUp b,#flyDown b,#sledBtn b{font-size:21px;line-height:1}#flyBtn,#sledBtn{bottom:246px}#flyDown{bottom:312px}#flyUp{bottom:378px}#sledBtn.side{left:138px}'
    + '#flyBtn[aria-pressed=true]{background:#C2261F;border-color:#C2261F;color:#fff}#sledBtn[aria-pressed=true]{background:#2F7D4F;border-color:#2F7D4F;color:#fff}#flyUp.on,#flyDown.on{background:#FFE7A8}';
  document.head.appendChild(css);
  const mk = (id, icon, text, label) => {
    const b = document.createElement('button');
    b.type = 'button'; b.id = id; b.className = 'btn'; b.hidden = true; b.setAttribute('aria-label', label);
    const i = document.createElement('b'); i.textContent = icon; b.append(i, text);
    document.body.appendChild(b);
    return b;
  };
  const btn = mk('flyBtn', '🚀', '날기', '날기'), up = mk('flyUp', '▲', '위로', '위로 날기'), down = mk('flyDown', '▼', '아래로', '아래로 날기');
  const sled = mk('sledBtn', '🦌', '썰매', '루돌프 썰매 타기');
  btn.setAttribute('aria-pressed', 'false'); sled.setAttribute('aria-pressed', 'false');

  let on = false, ride = false, held = 0, keyV = 0; // ride = 썰매를 탔다, held = 누르고 있는 단추(1 위, -1 아래), keyV = 키보드
  let target = null, landing = null, cross = null, rise = 0, pushT = 0, clock = 0, sentAt = -9, sentV = '', demoted = false, warnAt = -9;

  const suited = () => K.look().outfit === HOST_OUTFIT && K.isHost();
  const may = () => (ride ? K.canSled() : suited()); // 지금 타고 있는 것으로 날아도 되는지
  const lvY = () => me.level * FLOOR_H;
  const alt = () => (me.fly ? me.fly.y - lvY() : 0);
  const air = () => (me.fly ? me.fly.air : null);
  const inYard = (x = me.x, z = me.z) => { const [i, j] = cellOf(x, z); return zoneOf(i, j) === 'yard'; };
  const openYard = () => me.level === 0 && me.z >= ZY - 1e-6 && inYard(); // 위가 뚫린 마당(현관문 칸은 빼고)
  const inRect = (x, z) => x >= X0 + BODY_R - 1e-6 && x <= X1 - BODY_R + 1e-6 && z >= ZY - 1e-6 && z <= GZ1 - BODY_R + 1e-6; // 마당 안
  const inHouse = (x, z) => x > X0 - WALL - BODY_R && x < X1 + WALL + BODY_R && z > Z0 - WALL - BODY_R && z < ZY - 1e-6;       // 집 위
  const yardFixed = (x, z) => { // 마당의 나무·가로등에 걸리는지
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const [i, j] = cellOf(x + dx * BODY_R, z + dz * BODY_R); if (zoneOf(i, j) === 'yard' && K.fixed(i, j)) return true; }
    return false;
  };
  // 그 높이로 (x, z) 에 있을 수 있는지 (걷는 높이: 격자의 자리)
  function fits(x, z, a) {
    if (x < X0 + BODY_R || x > GX1 - BODY_R || z < Z0 + BODY_R || z > GZ1 - BODY_R) return false;
    if (a < HI) return K.grid.fits(x, z, BODY_R);
    return inRect(x, z) && !yardFixed(x, z);
  }
  // 하늘에서 세상 좌표 (x, z), 세상 높이 y 에 있을 수 있는지
  function airFits(x, z, y) {
    if (Math.hypot(x - WX, z - WZ) > FAR[1]) return false;
    if (y < ROOF && inHouse(x, z)) return false;
    return y >= OVER || !yardFixed(x, z);
  }
  // 하늘의 그 자리에서 내려갈 수 있는 가장 낮은 높이
  function lowAt(x, z) {
    if (inHouse(x, z)) return ROOF;
    if (!inRect(x, z)) return HI;
    return K.grid.fits(x, z, BODY_R) ? 0 : yardFixed(x, z) ? OVER : HI;
  }
  const setY = (y) => { me.fly.y = me.fly.to = y; me.root.position.y = y; };
  // 하늘의 자리를 옮긴다. 격자의 자리는 마당 안의 가장 가까운 자리에 둔다
  function setAir(x, z) {
    const A = me.fly.air || (me.fly.air = { x, z, tx: x, tz: z });
    A.x = A.tx = x; A.z = A.tz = z;
    me.place(clamp(x, X0 + BODY_R, X1 - BODY_R), clamp(z, ZY, GZ1 - BODY_R));
  }
  const dropAir = () => { if (me.fly && me.fly.air) { me.fly.air = null; me.sync(); } };
  const here = () => { const A = air(); return A ? [A.x, A.z] : [me.x, me.z]; };
  const speed = () => FLY_SPEED * (air() ? 1 + 0.7 * clamp((alt() - HI) / 6, 0, 1) : 1) * (ride ? 1.15 : 1); // 높이 뜨면 더 빨리 난다
  // (dx, dz) 쪽으로 step 만큼. 막히면 한 축씩 미끄러진다. 움직였으면 true
  function slide(dx, dz, step) {
    const A = air();
    if (A) {
      const ox = A.x, oz = A.z, y = me.fly.y, rx = ox - WX, rz = oz - WZ, d = Math.hypot(rx, rz);
      if (d > FAR[0]) { // 부드러운 경계: 멀어지는 쪽 걸음만 점점 줄인다
        const out = (rx * dx + rz * dz) / d;
        if (out > 0) {
          const k = clamp((FAR[1] - d) / (FAR[1] - FAR[0]), 0, 1);
          dx -= rx / d * out * (1 - k); dz -= rz / d * out * (1 - k);
          if (k < 0.2 && clock - warnAt > 6) { warnAt = clock; K.toast('여기가 하늘 끝이에요. 더 멀리는 못 가요'); }
        }
      }
      const nx = ox + dx * step, nz = oz + dz * step;
      if (airFits(nx, nz, y)) setAir(nx, nz); else if (airFits(nx, oz, y)) setAir(nx, oz); else if (airFits(ox, nz, y)) setAir(ox, nz);
      return Math.hypot(A.x - ox, A.z - oz) > 1e-5;
    }
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
    const A = air(), v = (ride ? 's' : '') + me.fly.y.toFixed(2) + (A ? ';' + A.x.toFixed(2) + ';' + A.z.toFixed(2) : '');
    if (!force && clock - sentAt < 0.1) return;
    if (!force && v === sentV && clock - sentAt < 1) return; // 가만히 떠 있어도 1초에 한 번은 알린다(새로 온 사람에게도 보이게)
    sentAt = clock; sentV = v;
    K.fx({ k: 'fly', v });
  }
  function begin(asRide) {
    me.stop(); me.onArrive = null;
    on = true; ride = asRide; target = landing = cross = null; pushT = 0; rise = asRide ? RIDE_HOVER : HOVER;
    me.fly = { y: lvY(), to: lvY(), mv: false, t: 0, air: null, sled: asRide };
    paint(); tell(true); K.dirty();
    return true;
  }
  function start() {
    if (on) return true;
    if (!suited()) { K.toast('지금은 날 수 없어요'); return false; }
    if (K.busy()) { K.toast('지금은 날 수 없어요'); return false; }
    return begin(false);
  }
  // 루돌프 썰매에 탄다 (마당에서만)
  function mount() {
    if (on && ride) return true;
    if (!K.canSled()) { K.toast('지금은 탈 수 없어요'); return false; }
    if (on || K.busy()) { K.toast('지금은 탈 수 없어요'); return false; }
    if (!openYard()) { K.toast('썰매는 마당에서 타요. 현관문으로 나가 보세요'); return false; }
    return begin(true);
  }
  function end() {
    on = false; ride = false; target = landing = cross = null; held = 0; keyV = 0; rise = 0;
    me.fly = null; me.sync(); me.animate(0, false);
    if (K.online()) K.fx({ k: 'fly', v: '' });
    paint(); K.dirty();
  }
  // 내려선다. now = true 면 그 자리에 바로(놀이가 시작됐을 때 등), 아니면 천천히 내려앉는다. 집 밖 하늘에 있었으면 마당의 가장 가까운 빈칸으로 온다
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
    const free = on || !K.busy(), show = suited() && free && !ride, showSled = K.canSled() && free && (ride || (!on && openYard()));
    btn.hidden = !show; sled.hidden = !showSled; up.hidden = down.hidden = !(on && (show || showSled));
    btn.setAttribute('aria-pressed', String(on && !ride));
    btn.lastChild.textContent = on ? '착지' : '날기'; btn.firstChild.textContent = on ? '🛬' : '🚀';
    btn.setAttribute('aria-label', on ? '착지' : '날기');
    sled.classList.toggle('side', show); // 날기·빔 단추 옆으로 비켜 선다
    sled.setAttribute('aria-pressed', String(ride));
    sled.lastChild.textContent = ride ? '내리기' : '썰매'; sled.firstChild.textContent = ride ? '🛬' : '🦌';
    sled.setAttribute('aria-label', ride ? '썰매에서 내리기' : '루돌프 썰매 타기');
    up.classList.toggle('on', held > 0 || keyV > 0); down.classList.toggle('on', held < 0 || keyV < 0);
  }
  btn.addEventListener('click', () => { if (on) land(false); else start(); });
  sled.addEventListener('click', () => { if (ride) land(false); else mount(); });
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
    // 권한이 없는데 비행 슈트를 입고 있으면 평상복으로 바꿔 두고, 다시 권한이 생기면 돌려 입는다
    if (K.look().outfit === HOST_OUTFIT && !K.isHost()) { if (on && !ride) land(true); demoted = true; K.setLook({ outfit: 'basic' }, true); }
    else if (demoted && K.isHost()) { demoted = false; if (K.look().outfit === 'basic') K.setLook({ outfit: HOST_OUTFIT }, true); }
    if (on && (!may() || K.busy())) land(true);
    const key = (suited() ? 1 : 0) + (on ? 2 : 0) + (K.busy() ? 4 : 0) + (ride ? 8 : 0) + (K.canSled() ? 16 : 0) + (!on && openYard() ? 32 : 0);
    if (key !== shown) { shown = key; paint(); }
    if (!on) return false;
    const f = me.fly, [ox, oz] = here();
    let v = held || keyV;
    if (cross) { // 층을 넘는 중: 곧장 위(아래)로. 반쯤 지나면 그 층으로 옮겨 선다
      const c = cross, edge = (c.dir > 0 ? c.lv : c.lv + 1) * FLOOR_H; // 지나가는 바닥의 높이
      setY(f.y + c.dir * VS * 1.4 * dt);
      if (!c.done && (c.dir > 0 ? f.y >= edge - 0.9 : f.y <= edge - 0.6)) { c.done = true; me.place(c.x, c.z); }
      if (c.dir > 0 ? f.y >= edge + 0.3 : f.y <= edge - FLOOR_H + CEIL) { if (!c.done) me.place(c.x, c.z); cross = null; pushT = 0; }
    } else if (landing) { // 내려앉는 중: 내려설 자리 위로 날아가며 내려온다 (집이나 나무를 넘어야 하면 먼저 올라간다)
      const A = f.air, [cx, cz] = here(), dx = landing[0] - cx, dz = landing[1] - cz, d = Math.hypot(dx, dz), s = Math.min(d, speed() * dt);
      const nx = d > 1e-4 ? cx + dx / d * s : cx, nz = d > 1e-4 ? cz + dz / d * s : cz;
      const need = A ? (d - s < 0.05 ? 0 : lowAt(nx, nz)) : 0, a = f.y - lvY();
      if (a < need - 1e-3) setY(Math.min(lvY() + need, f.y + VS * 2 * dt));
      else {
        if (d > 1e-4) { me.turnTo(dx, dz); if (A) setAir(nx, nz); else me.place(nx, nz); }
        setY(Math.max(lvY() + need, f.y - VS * 1.3 * dt));
      }
      if (d - s < 0.03 && f.y <= lvY() + 1e-3) { dropAir(); me.place(landing[0], landing[1]); end(); return true; }
    } else {
      if (target) { // 누른 자리로 날아간다
        const [cx, cz] = here(), dx = target[0] - cx, dz = target[1] - cz, d = Math.hypot(dx, dz);
        if (d < 0.04) target = null;
        else { me.turnTo(dx, dz); if (!slide(dx / d, dz / d, Math.min(d, speed() * dt))) target = null; }
      }
      const a = alt(), A = f.air, sky = !!A || openYard(), top = sky ? SKY_TOP : CEIL;
      const low = A ? Math.max(lowAt(A.x, A.z), ride ? HI : 0) : 0;
      if (v) rise = 0; else if (rise) { v = a < Math.min(rise, top) ? 1 : 0; if (!v) rise = 0; }
      let na = a + v * VS * (A ? 1.5 : 1) * dt;
      if (a > top + 1e-6) na = Math.max(top, a - VS * dt); else if (a < low - 1e-6) na = Math.min(low, a + VS * 2 * dt); else na = clamp(na, low, top);
      setY(lvY() + na);
      if (!A && sky && na >= HI) setAir(me.x, me.z);                    // 마당에서 높이 떴다: 하늘
      else if (A && na < HI) dropAir();                                 // 마당의 빈 자리 위로 낮게 내려왔다: 다시 격자의 자리로
      // 천장·바닥에 닿은 채 더 누르고 있으면: 층을 넘거나(집 안) 내려선다(맨 아래, 집 밖 하늘의 맨 아래, 썰매). 집 위와 마당의 가구 위에서는 그대로 떠 있다
      const pushing = (held || keyV) > 0 ? (na >= top - 1e-3 && !sky) : (held || keyV) < 0 ? na <= low + 1e-3 && (low < 1e-3 || (!!A && !inHouse(A.x, A.z) && (ride || !inRect(A.x, A.z)))) : false;
      pushT = pushing ? pushT + dt : 0;
      if (pushT >= HOLD) {
        pushT = 0;
        if ((held || keyV) > 0) { if (me.level < LEVELS - 1) startCross(1); }
        else if (me.level > 0 && !sky) startCross(-1); else land(false);
      }
    }
    if (!on) return true;
    const [hx, hz] = here();
    f.mv = f.mv2 || Math.hypot(hx - ox, hz - oz) > 1e-5; f.mv2 = false;
    tell(false);
    K.dirty();
    return f.mv;
  }

  const api = {
    get on() { return on; }, get ride() { return ride; },
    // 하늘에 있는지(마당 위로 높이 떴거나 집 밖). 카메라가 따라가며 넓게 보여 준다 (app.js 의 updateView)
    get sky() { return !!air(); },
    // 하늘에서 화면이 얼마나 넓게 보여야 하는지 0~1 (집 밖으로 나갔거나 높이 떴을수록 1)
    get wide() { const A = air(); if (!A) return 0; const out = Math.max(X0 - A.x, A.x - X1, ZY - A.z, A.z - GZ1, 0); return clamp(Math.max(out / 2.5, (alt() - 3) / 4), 0, 1); },
    tick, start, land, mount,
    // 방향키·조이스틱으로 (dx, dz) 쪽으로 민다 (app.js 의 keyWalk 가 부른다). 움직였으면 true
    push(dx, dz, p, dt) {
      if (!on || cross || landing) return false;
      target = null;
      const mv = slide(dx, dz, speed() * p * dt);
      if (mv) me.fly.mv2 = true;
      return mv;
    },
    // 바닥을 눌렀다 (app.js 의 goTo 가 부른다). 날아서 갈 것이면 true, 아니면 false(내려서서 걸어간다)
    goTo(x, z) {
      if (!on) return false;
      if (K.busy() || !may()) { land(true); return false; }
      if (cross || landing) return true;
      if (levelOf(x) === me.level) target = [clamp(x, X0 + BODY_R, GX1 - BODY_R), clamp(z, Z0 + BODY_R, GZ1 - BODY_R)];
      return true;
    },
    // 하늘에 있을 때 화면을 눌렀다: 세상 좌표 (x, z) 로 지금 높이 그대로 날아간다 (app.js 가 누른 자리를 내 높이의 평면에서 구해 준다)
    airTo(x, z) {
      if (!on || !air() || cross || landing || !Number.isFinite(x) || !Number.isFinite(z)) return false;
      const d = Math.hypot(x - WX, z - WZ), k = d > FAR[1] ? FAR[1] / d : 1;
      target = [WX + (x - WX) * k, WZ + (z - WZ) * k];
      return true;
    },
    // 누가 날고 있다는 소식. 비행 슈트를 입고 있거나 썰매를 탔을 때만 받는다
    peerFx(m, id) {
      const a = K.others().get(id);
      if (!a || typeof m.v !== 'string') return false;
      if (m.v === '') { if (a.fly) { a.fly = null; a.sync(); a.animate(0, false); K.dirty(); } return true; }
      const x = FLY_RE.exec(m.v);
      if (!x) return false;
      const y = Number(x[2]), isSled = x[1] === 's', ax = x[3] === undefined ? null : Number(x[3]), az = x[3] === undefined ? null : Number(x[4]);
      if (!(y >= 0 && y <= LEVELS * FLOOR_H + CEIL + SKY_TOP) || (!isSled && a.look.outfit !== HOST_OUTFIT) || a.rest || a.hop) return false;
      if (ax !== null && (Math.hypot(ax - WX, az - WZ) > FAR[1] + 0.5 || y < HI - 0.01 || y > SKY_TOP + 0.01)) return false;
      if (a.fly) a.fly.to = y; else a.fly = { y: a.root.position.y, to: y, mv: false, t: 0, air: null, sled: false };
      a.fly.sled = isSled;
      if (ax === null) { if (a.fly.air) { a.fly.air = null; a.sync(); } }
      else if (a.fly.air) { a.fly.air.tx = ax; a.fly.air.tz = az; }
      else a.fly.air = { x: a.root.position.x, z: a.root.position.z, tx: ax, tz: az };
      K.dirty();
      return true;
    },
  };
  // 자동 검사가 쓰는 창구
  window.__fly = {
    get on() { return on; }, get ride() { return ride; }, get alt() { return alt(); }, get y() { return me.fly ? me.fly.y : null; }, get shown() { return !btn.hidden; }, get arrows() { return !up.hidden; },
    get sledShown() { return !sled.hidden; }, get air() { const A = air(); return A ? { x: A.x, z: A.z } : null; }, get wide() { return api.wide; },
    get crossing() { return !!cross; }, get landing() { return !!landing; }, get target() { return target; },
    start, land, mount, airTo: api.airTo, hold(v) { held = v; paint(); }, CEIL, YARD_TOP, SKY_TOP, HI, OVER, ROOF, FAR, WX, WZ,
    peer: (id) => { const a = K.others().get(id); return a && a.fly ? { y: a.fly.y, to: a.fly.to, jets: !!(a.parts.jets && a.parts.jets[0].visible), sled: !!a.fly.sled,
      air: a.fly.air ? { x: a.fly.air.x, z: a.fly.air.z, tx: a.fly.air.tx, tz: a.fly.air.tz } : null, wx: a.root.position.x, wz: a.root.position.z, seen: a.root.visible } : null; },
  };
  return api;
}
