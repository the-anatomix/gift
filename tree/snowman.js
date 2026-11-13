// 마당 눈사람 같이 만들기. 마당에서 "⛄ 굴리기" 를 켜고 걸으면 내 앞에 눈 뭉치가 생겨 걸은 만큼 커진다(반지름 R0 → R1, GROW m 쯤에 다 큼).
// "📍 여기 두기" 를 누르면 그 자리에 몸통으로 놓이고, 다른 뭉치를 놓인 몸통 가까이(NEAR 안)로 굴려 와 "⬆️ 올리기" 를 누르면 위에 쌓인다.
// 더 작은 뭉치만 올릴 수 있다. 올린 뭉치가 머리만큼 작으면(HEAD 이하) 2단, 아니면 하나 더 올려 3단이 되면 눈사람이 완성된다:
// 눈·당근 코·단추·나뭇가지 팔·목도리·모자가 생기고, 마지막 뭉치를 올린 사람이 방에 가구 눈사람(snowman)을 놓는다(state.js 의 'snowman' 변화, 구경하는 사람도 된다).
// 만드는 중의 뭉치는 방의 상태가 아니라 놀이 소식으로만 주고받는다(새로 들어온 사람에게는 뭉치를 마지막으로 만진 사람이 다시 알려 준다).
//   { k: 'ball', v: 'id,s,x,z,r[,r2[,r3]]' }  뭉치 하나의 지금 모습. s = r(보낸 사람이 굴리는 중) | l(그냥 놓여 있음) | b(몸통, 위에 쌓인 반지름들) | x(없어짐)
//   { k: 'made', v: 'id,누구.누구' }           몸통 id 의 눈사람이 다 됐다 (만든 사람들)
// 마당을 나가거나 굴리기를 끄면 굴리던 뭉치는 그 자리에 놓인다(l). 다시 켜고 그 옆에 서면 이어서 굴린다.
import { THREE, M, put, ball, cyl } from './kit.js';
import { sfx } from './sfx.js';
import { X0, X1, Z1, GZ1, YARD, GX, cellOf, centerOf, zoneOf, levelOf } from './path.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => (typeof window.__now === 'function' ? window.__now() : Date.now());
export const R0 = 0.15, R1 = 0.55, GROW = 10; // 처음 반지름, 다 큰 반지름, 다 클 때까지 굴리는 거리(m)
export const NEAR = 1.0;   // 몸통에 올릴 수 있는 거리 (두 뭉치 가운데 사이)
export const HEAD = 0.3;   // 이만큼 작은 뭉치를 올리면 머리로 보고 2단 눈사람이 된다
const PICK = 1.2;          // 굴리기를 켤 때 이만큼 안에 놓인 뭉치가 있으면 그것을 이어서 굴린다
const MAX_BALLS = 12;      // 마당에 있을 수 있는 뭉치 수
const MARK_LIFE = 40;      // 굴린 자국이 남아 있는 시간(초)
const MAKE_T = 3.2;        // 완성 연출 시간(초, 실제 시각. 느린 기기에서도 이만큼 뒤면 끝난다). 끝나면 가구 눈사람으로 바뀐다
const OK_MODES = [null, 'chat', 'duo', 'emo'];
const okId = (v) => typeof v === 'string' && /^[a-z0-9]{1,8}$/.test(v);
const okBall = (v) => typeof v === 'string' && /^[a-z0-9]{3,10}$/.test(v);
const rnd = () => Math.random().toString(36).slice(2, 7).padEnd(5, '0');

// S = snow.js 가 넘겨주는 것: { snowOff(): 눈싸움 모드 끄기, base(): 단추를 놓을 아래 높이, eye() }
export function makeSnowman(K, S) {
  let on = false, mine = null, sinceUi = 1, sinceSend = 0, seen = new Set();
  const balls = new Map();   // id → { id, s, by, own(마지막으로 만진 사람), x, z, r, stack: [], who: Set, g, core, tx, tz, mk: [x, z], made }
  const marks = [];          // 굴린 자국 { m, t }
  const makes = [];          // 완성 연출 { b, t, parts: [{ m, at }], bits, mineDone, done }
  const geo = new THREE.IcosahedronGeometry(1, 2), mat = new THREE.MeshLambertMaterial({ color: 0xF6F9FF, emissive: 0x2C3A56, flatShading: true });
  const markGeo = new THREE.CircleGeometry(1, 16), markMat = new THREE.MeshBasicMaterial({ color: 0xC6D2E8, transparent: true, opacity: 0.75, depthWrite: false });

  /* ───────── 단추 ───────── */
  const css = document.createElement('style');
  css.textContent = '#rollBtn,#rollGo{position:absolute;z-index:3;height:58px;padding:0;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;'
    + 'font-size:11px;font-weight:800;line-height:1.1;box-shadow:0 4px 14px rgba(60,30,10,.28)}#rollBtn b,#rollGo b{font-size:21px;line-height:1}'
    + '#rollBtn{right:10px;bottom:226px;width:58px}#rollBtn[aria-pressed=true]{background:#5B8FD6;border-color:#5B8FD6;color:#fff}'
    + '#rollGo{left:10px;bottom:130px;width:62px}';
  document.head.appendChild(css);
  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'rollBtn'; btn.className = 'btn'; btn.hidden = true;
  btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', '눈 굴리기');
  btn.innerHTML = '<b>⛄</b>굴리기';
  const go = document.createElement('button');
  go.type = 'button'; go.id = 'rollGo'; go.className = 'btn main'; go.hidden = true;
  document.body.append(btn, go);
  btn.addEventListener('click', () => setOn(!on));
  go.addEventListener('click', () => { if (nearBase()) stackUp(); else placeHere(); });

  const inYard = () => { const me = K.me; if (me.hop || me.rest || levelOf(me.x)) return false; const [i, j] = cellOf(me.x, me.z); return zoneOf(i, j) === 'yard'; };
  const allowed = () => OK_MODES.includes(K.mode()) && !K.ghost() && inYard();
  const myId = () => K.myId();
  // 뭉치가 놓일 수 있는 범위 (울타리와 집 벽 안)
  const keepIn = (x, z, r) => [clamp(x, X0 + 0.15 + r, X1 - 0.15 - r), clamp(z, Z1 + 0.55 + r * 0.5, GZ1 - 0.12 - r)];

  /* ───────── 뭉치 모양 ───────── */
  // 쌓인 뭉치 k 의 가운데 높이 (아래 뭉치에 조금 파묻힌다)
  function heights(b) {
    const rs = [b.r, ...b.stack], ys = [rs[0]];
    for (let k = 1; k < rs.length; k++) ys.push(ys[k - 1] + (rs[k - 1] + rs[k]) * 0.82);
    return { rs, ys };
  }
  function shape(b) {
    const { rs, ys } = heights(b);
    while (b.g.children.length < rs.length) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; b.g.add(m); }
    while (b.g.children.length > rs.length) b.g.remove(b.g.children[b.g.children.length - 1]);
    b.g.children.forEach((m, k) => { m.scale.setScalar(rs[k]); m.position.set(0, ys[k], 0); });
    b.core = b.g.children[0];
    b.g.position.set(b.x, 0, b.z);
    K.dirty();
  }
  function add(id, s, x, z, r, stack = []) {
    const b = { id, s, by: null, own: null, x, z, r, stack: stack.slice(), who: new Set(), g: new THREE.Group(), core: null, tx: x, tz: z, mk: [x, z], made: false };
    b.g.userData.ball = id;
    K.scene.add(b.g);
    balls.set(id, b);
    shape(b);
    return b;
  }
  function drop(b) {
    K.scene.remove(b.g);
    balls.delete(b.id);
    if (mine === b.id) mine = null;
    K.dirty();
  }
  const msgOf = (b) => `${b.id},${b.s},${b.x.toFixed(2)},${b.z.toFixed(2)},${[b.r, ...b.stack].map((r) => r.toFixed(3)).join(',')}`;
  function send(b, s = b.s) { b.own = myId(); K.fx({ k: 'ball', v: msgOf({ ...b, s }) }); }

  /* ───────── 굴리기 켜고 끄기 ───────── */
  function setOn(v) {
    v = !!v && allowed();
    if (v === on) return on;
    on = v;
    if (on) {
      S.snowOff(); // 눈덩이 던지기와는 같이 켜지 않는다
      const me = K.me;
      // 옆에 그냥 놓인 뭉치가 있으면 그것을 이어서 굴린다
      let pick = null, best = PICK;
      for (const b of balls.values()) { const d = Math.hypot(b.x - me.x, b.z - me.z) - b.r; if (b.s === 'l' && d < best) { best = d; pick = b; } }
      if (!pick) {
        if (balls.size >= MAX_BALLS) {
          const old = [...balls.values()].find((b) => b.s === 'l');
          if (!old) { on = false; K.toast('마당에 눈 뭉치가 너무 많아요. 몸통에 올려 눈사람을 완성해 봐요'); paint(); return false; }
          send(old, 'x'); drop(old);
        }
        const f = me.root.rotation.y, [x, z] = keepIn(me.x + Math.sin(f) * (0.32 + R0), me.z + Math.cos(f) * (0.32 + R0), R0);
        pick = add(rnd(), 'r', x, z, R0); sfx('snowScoop');
        K.toast('걸으면 눈 뭉치가 굴러가며 커져요 ⛄');
      } else K.toast('놓여 있던 눈 뭉치를 이어서 굴려요');
      pick.s = 'r'; pick.by = myId(); pick.who.add(myId());
      mine = pick.id; pick.last = [K.me.x, K.me.z];
      send(pick);
    } else letGo();
    paint();
    return on;
  }
  // 굴리던 뭉치를 그 자리에 둔다 (마당을 나갔거나 굴리기를 껐다)
  function letGo() {
    const b = balls.get(mine);
    mine = null;
    if (!b) return;
    b.s = 'l'; b.by = null;
    send(b);
  }
  // "여기 두기": 굴리던 뭉치를 몸통으로 놓는다
  function placeHere() {
    const b = balls.get(mine);
    if (!on || !b) return false;
    b.s = 'b'; b.by = null; mine = null;
    send(b);
    on = false; paint();
    K.toast('몸통을 놓았어요. 더 작은 뭉치를 굴려 와 올려요');
    return true;
  }
  // 내 뭉치를 올릴 수 있는 몸통 (가장 가까운 것, 없으면 null)
  function nearBase() {
    const b = balls.get(mine);
    if (!b) return null;
    let best = null, bd = NEAR + 1e-6;
    for (const o of balls.values()) { if (o.s !== 'b' || o === b) continue; const d = Math.hypot(o.x - b.x, o.z - b.z); if (d <= bd) { bd = d; best = o; } }
    return best;
  }
  // "올리기": 내 뭉치를 가까운 몸통 위에 쌓는다
  function stackUp() {
    const b = balls.get(mine), base = nearBase();
    if (!on || !b || !base) return false;
    const top = base.stack.length ? base.stack[base.stack.length - 1] : base.r;
    if (b.r >= top - 0.005) { K.toast('더 작은 뭉치만 올릴 수 있어요'); return false; }
    base.stack.push(b.r);
    for (const w of b.who) base.who.add(w);
    base.who.add(myId());
    send(b, 'x'); drop(b);
    shape(base);
    const done = base.stack.length >= 2 || b.r <= HEAD;
    on = false;
    send(base);
    if (done) { K.fx({ k: 'made', v: `${base.id},${[...base.who].filter(okId).slice(0, 8).join('.')}` }); finish(base, [...base.who], true); }
    else K.toast('올렸어요! 머리가 될 작은 뭉치를 하나 더 올려요');
    paint();
    return true;
  }

  /* ───────── 완성 ───────── */
  const who2text = (ids) => {
    const list = [...new Set(ids)].filter((id) => id === myId() || K.others().has(id) || id === 'h');
    const me = list.includes(myId()), rest = list.filter((id) => id !== myId()).map((id) => K.name(id) + '님');
    if (!rest.length) return '눈사람을 만들었어요! ⛄';
    const front = me ? ['나', ...rest.slice(0, -1)] : rest.slice(0, -1), last = rest[rest.length - 1];
    if (!front.length) return `${last}이 눈사람을 만들었어요! ⛄`;
    const tail = front[front.length - 1] === '나' ? '와' : '과';
    return `${front.join(', ')}${tail} ${last}이 눈사람을 만들었어요! ⛄`;
  };
  function finish(base, ids, byMe) {
    if (base.made) return;
    base.made = true; base.s = 'd';
    K.toast(who2text(ids));
    const { rs, ys } = heights(base), h = rs.length - 1, rh = rs[h], yh = ys[h], rm = rs[h - 1], ym = ys[h - 1];
    const deco = new THREE.Group();
    base.g.add(deco);
    // 마지막 뭉치를 올린 사람(없으면 화면) 쪽을 본다
    const a = byMe ? K.me : null;
    deco.rotation.y = a ? Math.atan2(a.x - base.x, a.z - base.z) : Math.PI / 4;
    const parts = [], at = (m, t) => { m.scale.setScalar(0.001); parts.push({ m, at: t }); return m; };
    const BLACK = 0x2B2420;
    // 눈 두 개, 당근 코
    for (const s of [-1, 1]) at(put(ball(rh * 0.1, 8, 6), BLACK, s * rh * 0.36, yh + rh * 0.28, rh * 0.86, deco, false), 0.25);
    const nose = at(put(new THREE.ConeGeometry(rh * 0.13, rh * 0.7, 10), 0xF28C28, 0, yh + rh * 0.02, rh * 1.15, deco, false), 0.55);
    nose.rotation.x = Math.PI / 2;
    // 단추 (머리 밑 뭉치 앞)
    for (const k of [-1, 0, 1]) at(put(ball(rm * 0.09, 8, 6), BLACK, 0, ym + k * rm * 0.36, Math.sqrt(Math.max(0, 1 - (k * 0.36) ** 2)) * rm * 0.98, deco, false), 0.85 + (k + 1) * 0.12);
    // 나뭇가지 팔
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * rm * 0.85, ym + rm * 0.15, 0); arm.rotation.z = s * -0.55;
      const len = rm * 1.5 + 0.12;
      put(cyl(0.018, 0.026, len, 6), 0x6B4630, s * len / 2, 0, 0, arm).rotation.z = Math.PI / 2;
      const fork = put(cyl(0.012, 0.016, len * 0.35, 6), 0x6B4630, s * len * 0.78, len * 0.1, 0, arm); fork.rotation.z = Math.PI / 2 - s * 0.9;
      deco.add(arm); at(arm, 1.35);
    }
    // 목도리 (머리와 그 밑 뭉치 사이), 모자
    const neck = (yh + ym) / 2, nr = Math.min(rh, rm) * 0.95;
    const scarf = at(put(new THREE.TorusGeometry(nr, rh * 0.2, 8, 20), 0xD23A30, 0, neck + rh * 0.05, 0, deco), 1.75);
    scarf.rotation.x = Math.PI / 2;
    at(put(new THREE.BoxGeometry(rh * 0.32, rh * 0.75, rh * 0.12), 0xD23A30, nr * 0.55, neck - rh * 0.35, nr * 0.85, deco), 1.9).rotation.z = 0.2;
    const hat = new THREE.Group();
    hat.position.set(0, yh + rh * 0.82, 0); hat.rotation.z = 0.12;
    put(cyl(rh * 0.85, rh * 0.85, rh * 0.08, 18), BLACK, 0, 0, 0, hat);
    put(cyl(rh * 0.55, rh * 0.58, rh * 0.75, 18), BLACK, 0, rh * 0.4, 0, hat);
    put(cyl(rh * 0.585, rh * 0.585, rh * 0.14, 18), 0xD23A30, 0, rh * 0.12, 0, hat);
    deco.add(hat); at(hat, 2.15);
    // 반짝이는 눈가루
    const bits = [];
    for (let k = 0; k < 16; k++) {
      const m = put(ball(0.035, 6, 5), 0xFFFFFF, 0, yh, 0, base.g, false), q = k / 16 * Math.PI * 2;
      bits.push({ m, v: [Math.cos(q) * (0.8 + Math.random()), 1.5 + Math.random() * 1.5, Math.sin(q) * (0.8 + Math.random())] });
    }
    makes.push({ b: base, t: 0, t0: now(), parts, bits, byMe, done: false });
    K.dirty();
  }
  // 연출이 끝나면: 마지막 뭉치를 올린 사람이 방에 가구 눈사람을 놓는다 (가까운 빈 마당 칸)
  function settle(mk) {
    const b = mk.b;
    if (mk.byMe) {
      const spot = spotNear(b.x, b.z);
      const ok = spot && K.op({ t: 'snowman', id: K.newId(), i: spot[0], j: spot[1] });
      if (!ok) K.toast('눈사람을 방에 남길 자리가 없어요 (마당에 눈사람은 몇 개까지만 둘 수 있어요)');
    }
    drop(b);
  }
  // (x, z) 에서 가장 가까운, 눈사람을 놓을 수 있는 빈 마당 칸 (사람이 서 있는 칸은 뺀다)
  function spotNear(x, z) {
    const avoid = [K.me, ...K.others().values()].filter((a) => !levelOf(a.x)).map((a) => cellOf(a.x, a.z));
    let best = null, bd = Infinity;
    for (let j = YARD.j0; j <= YARD.j1; j++) for (let i = 0; i < GX; i++) {
      if (zoneOf(i, j) !== 'yard' || !K.canPut(i, j, avoid)) continue;
      const [cx, cz] = centerOf(i, j), d = Math.hypot(cx - x, cz - z);
      if (d < bd) { bd = d; best = [i, j]; }
    }
    return best;
  }

  /* ───────── 친구에게서 온 소식 ───────── */
  function peerFx(m, from) {
    if (typeof m.v !== 'string' || m.v.length > 80) return false;
    const p = m.v.split(',');
    if (m.k === 'ball') {
      if (p.length < 5 || p.length > 7 || !okBall(p[0]) || !['r', 'l', 'b', 'x'].includes(p[1])) return false;
      const x = +p[2], z = +p[3], rs = p.slice(4).map(Number);
      if (!isFinite(x) || !isFinite(z) || x < X0 - 0.1 || x > X1 + 0.1 || z < Z1 - 0.1 || z > GZ1 + 0.1) return false;
      if (!rs.every((r) => isFinite(r) && r >= R0 - 0.01 && r <= R1 + 0.01) || rs.some((r, k) => k && r >= rs[k - 1])) return false;
      if (rs.length > 1 && p[1] !== 'b') return false;
      let b = balls.get(p[0]);
      if (p[1] === 'x') { if (b && !b.made) drop(b); return true; }
      if (b && b.made) return true;
      if (!b) { if (balls.size >= MAX_BALLS + 4) return false; b = add(p[0], p[1], x, z, rs[0], rs.slice(1)); }
      if (mine === b.id && p[1] === 'r' && from !== myId()) { mine = null; on = false; paint(); } // 다른 사람이 가져갔다
      b.s = p[1]; b.own = from; b.by = p[1] === 'r' ? from : null;
      if (p[1] === 'r') b.who.add(from);
      b.tx = x; b.tz = z;
      const grew = b.r !== rs[0] || b.stack.length !== rs.length - 1;
      b.r = rs[0]; b.stack = rs.slice(1);
      if (p[1] !== 'r') { b.x = x; b.z = z; }
      if (grew || p[1] !== 'r') shape(b);
      return true;
    }
    if (m.k === 'made') {
      if (p.length !== 2 || !okBall(p[0])) return false;
      const b = balls.get(p[0]), ids = p[1].split('.').filter(okId).slice(0, 8);
      if (!b || b.s !== 'b' || !b.stack.length) return false;
      finish(b, ids.length ? ids : [from], false);
      return true;
    }
    return false;
  }

  /* ───────── 매 장면 ───────── */
  function mark(b, x, z, r) {
    const m = new THREE.Mesh(markGeo, markMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); m.scale.set(r * 0.85, r * 0.85, 1);
    m.renderOrder = -1;
    K.scene.add(m);
    marks.push({ m, t: 0, s: r * 0.85 });
    if (marks.length > 320) K.scene.remove(marks.shift().m);
  }
  // 뭉치가 (nx, nz) 로 굴러갔다: 구르는 만큼 돌고, 자국을 남긴다
  function rollTo(b, nx, nz) {
    const dx = nx - b.x, dz = nz - b.z, d = Math.hypot(dx, dz);
    if (d < 1e-5) return 0;
    b.x = nx; b.z = nz;
    b.g.position.set(nx, 0, nz);
    if (b.core) b.core.rotateOnWorldAxis(new THREE.Vector3(dz / d, 0, -dx / d), d / b.r);
    if (Math.hypot(nx - b.mk[0], nz - b.mk[1]) > 0.18) { b.mk = [nx, nz]; mark(b, nx, nz, b.r); }
    K.dirty();
    return d;
  }
  function paint() {
    const show = allowed();
    btn.hidden = !show;
    btn.setAttribute('aria-pressed', String(on));
    const b = balls.get(mine), base = S.base();
    if (show) btn.style.bottom = (base + 96) + 'px';
    go.hidden = !(show && on && b);
    if (!go.hidden) {
      const st = document.getElementById('stick'), stTop = S.eye() && st && !st.hidden ? window.innerHeight - st.getBoundingClientRect().top + 8 : 0; // 1인칭: 조이스틱이 실제로 놓인 자리 위에 둔다
      go.style.bottom = Math.max(S.eye() ? base + 116 : base, stTop) + 'px';
      const up = !!nearBase(), html = up ? '<b>⬆️</b>올리기' : '<b>📍</b>여기 두기';
      if (go.innerHTML !== html) { go.innerHTML = html; go.setAttribute('aria-label', up ? '몸통 위에 올리기' : '여기 두기'); }
    }
  }
  function tick(dt) {
    if (on && !allowed()) { on = false; letGo(); paint(); }
    sinceUi += dt; sinceSend += dt;
    if (sinceUi > 0.2) { sinceUi = 0; paint(); }
    // 내가 굴리는 뭉치: 내 앞에서 굴러가며 커진다
    const b = balls.get(mine);
    if (on && b) {
      const me = K.me, f = me.root.rotation.y;
      const [nx, nz] = keepIn(me.x + Math.sin(f) * (0.3 + b.r), me.z + Math.cos(f) * (0.3 + b.r), b.r);
      const d = rollTo(b, nx, nz);
      if (d > 0 && d < 0.5 && b.r < R1) { b.r = Math.min(R1, b.r + d * (R1 - R0) / GROW); shape(b); }
      if (d > 0.002) sfx('snowRoll');
      if (d > 0 && sinceSend > 0.1) { sinceSend = 0; send(b); }
      else if (sinceSend > 2) { sinceSend = 0; send(b); } // 가끔은 가만히 있어도 알린다
    }
    // 남이 굴리는 뭉치: 받은 자리로 부드럽게 따라간다. 굴리던 사람이 나갔으면 그 자리에 놓인다
    for (const o of balls.values()) {
      if (o.id === mine || o.made) continue;
      if (o.s === 'r' && o.by !== myId() && !K.others().has(o.by)) { o.s = 'l'; o.by = null; }
      if (o.s === 'r') { const k = Math.min(1, dt * 10); rollTo(o, o.x + (o.tx - o.x) * k, o.z + (o.tz - o.z) * k); }
    }
    // 굴리는 몸짓 (avatar.js 의 push)
    const rolling = new Set([...balls.values()].filter((o) => o.s === 'r' && !o.made).map((o) => o.by));
    K.me.push = on && !!b;
    for (const [id, a] of K.others()) a.push = rolling.has(id);
    // 새로 온 사람에게 내가 마지막으로 만진 뭉치를 알려 준다. 만진 사람이 나갔으면 남은 사람 중 이름이 가장 앞서는 사람이 맡는다
    const now2 = new Set(K.others().keys()), first = [myId(), ...now2].sort()[0];
    for (const o of balls.values()) if (o.own !== myId() && !now2.has(o.own)) o.own = first;
    if ([...now2].some((id) => !seen.has(id))) for (const o of balls.values()) if (o.own === myId() && !o.made) K.fx({ k: 'ball', v: msgOf(o) });
    seen = now2;
    // 굴린 자국: 오래되면 작아지며 사라진다
    for (let k = marks.length - 1; k >= 0; k--) {
      const q = marks[k];
      q.t += dt;
      if (q.t > MARK_LIFE - 3) { const s = q.s * Math.max(0.01, (MARK_LIFE - q.t) / 3); q.m.scale.set(s, s, 1); }
      if (q.t > MARK_LIFE) { K.scene.remove(q.m); marks.splice(k, 1); }
    }
    // 완성 연출: 장식이 하나씩 톡 튀어나온다
    for (let k = makes.length - 1; k >= 0; k--) {
      const mk = makes[k];
      mk.t = Math.max(0, (now() - mk.t0) / 1000);
      for (const q of mk.parts) { const u = clamp((mk.t - q.at) / 0.3, 0, 1); q.m.scale.setScalar(Math.max(0.001, u < 1 ? 1 + 0.35 * Math.sin(u * Math.PI) - (1 - u) * (1 - u) : 1)); }
      for (const q of mk.bits) { q.v[1] -= 6 * dt; q.m.position.x += q.v[0] * dt; q.m.position.y = Math.max(0, q.m.position.y + q.v[1] * dt); q.m.position.z += q.v[2] * dt; q.m.scale.setScalar(Math.max(0.01, 1 - mk.t / 1.4)); }
      K.dirty();
      if (mk.t >= MAKE_T) { makes.splice(k, 1); settle(mk); }
    }
  }

  return {
    peerFx, tick, setOn,
    get on() { return on; },
    off() { if (on) setOn(false); },
    test: {
      get on() { return on; }, set: (v) => setOn(v), get shown() { return !btn.hidden; }, get go() { return go.hidden ? '' : go.textContent; },
      get mine() { const b = balls.get(mine); return b ? { id: b.id, x: b.x, z: b.z, r: b.r } : null; },
      balls: () => [...balls.values()].map((b) => ({ id: b.id, s: b.s, by: b.by, x: b.x, z: b.z, r: b.r, stack: b.stack.slice(), made: b.made })),
      get marks() { return marks.length; }, get making() { return makes.length; },
      makingDeco: () => makes.map((mk) => mk.parts.filter((q) => q.m.scale.x > 0.9).length),
      placeHere, stackUp, nearBase: () => { const o = nearBase(); return o ? o.id : null; }, spotNear, who2text,
      push: (id) => { const a = id === 'me' || id === myId() ? K.me : K.others().get(id); return a ? !!a.push : null; },
      R0, R1, GROW, NEAR, HEAD,
    },
  };
}
