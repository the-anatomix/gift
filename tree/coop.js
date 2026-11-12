// 협동 놀이 두 가지. 혼자서는 할 수 없고, 둘이 힘을 모아야 한다.
//
// 1. 꼭대기 별 달기
//   트리 꼭대기 별은 방의 상태다(state.js 의 S.star, 변화 { t: 'star', on, by, name, help }). 새 방도 예전 방도 별이 없는 채로
//   시작하고, 꼭대기에는 흐릿한 별 자리만 보인다. 별이 달리면 금빛 별이 반짝이고 누가 달았는지(name)와 받쳐 준 사람(help)이 남는다.
//   트리 옆에서 "🙌 받쳐 주기"를 누르면 두 손을 모아 받치는 자세가 된다(놀이 소식 prop: 내 이름, 그만두면 ''). 움직이면 풀린다.
//   다른 사람이 그 사람 가까이(STAR.reach 안)에서 "⭐ 올라가서 별 달기"를 누르면 받치는 사람 어깨 위로 올라가(놀이 소식 climb: 받친 사람 id)
//   별을 단다. 혼자 있으면 "⭐ 별 달기"를 눌러도 손이 닿지 않는다는 알림만 뜬다. 구경하는 사람도 받치거나 달 수 있다.
//   꾸밀 수 있는 사람은 트리 판의 "별 떼기"로 다시 뗄 수 있다. 점등식(party.js)으로 트리 둘레 빛이 밝아지면 별도 같이 빛난다.
//
// 2. 큰 가구 둘이 들기 (catalog.js 에서 heavy 인 가구: 소파, 침대)
//   방에 다른 사람이 있을 때만, 놓여 있는 큰 가구를 옮기려면 두 사람이 든다. 혼자 있으면 지금처럼 혼자 옮긴다. 새로 놓기와 치우기는 그대로.
//   A(꾸미는 사람)가 가구 판에서 큰 가구를 누르면 가구 한쪽 끝으로 가서 드는 자세로 기다린다(놀이 소식 heavy: 가구 id, 그만두면 '').
//   B(구경하는 사람도 됨)가 그 가구 가까이에서 "🤝 같이 들기"를 누르면 반대쪽 끝에 서서 들고(놀이 소식 help: A 의 id, 놓으면 ''),
//   A 에게 평소의 옮기기 화면이 열린다. A 가 놓으면 두 사람이 가구를 들고 새 자리로 옮기는 몸짓이 모두에게 보인다.
//   기다림은 HEAVY.wait 까지. 시간이 지나거나, A 가 판을 닫거나, B 가 손을 놓거나 떠나면 그만둔다.
//   규칙은 화면에서만 지킨다(apply 와 옮기는 변화 move 는 그대로).
//
// 몸짓(받치기, 올라타기, 들기)은 아바타가 매 장면 걷는 몸짓을 정한 다음에 그 위에 덮어쓴다(snow.js 의 던지는 몸짓과 같은 방식).
// app.js 가 넘겨주는 창구 K:
//   g0(1층 묶음), me, S, grid, others() → Map, myId(), mode(), setMode(m), ghost() → { id } | null, ghostPick(id), ghostCancel(),
//   itemObj(id), op(변화) → 받아들였는지, canEdit(), goTo(x, z), fx(소식), toast(글), dirty(), nameOf(id), key, store,
//   treeGlow() → 트리 둘레 빛이 평소의 몇 배인지, actBottom() → 가운데 단추(#act)의 bottom
import { THREE } from './kit.js';
import { TREE } from './room.js';
import { X0, Z0, CELL, toWorld, levelOfCell } from './path.js';
import { NOTE } from './catalog.js';
import { footprint, kindOf, cleanWords, okWords } from './state.js';
import { BODY_R } from './avatar.js';

const $ = (id) => document.getElementById(id);
const now = () => (typeof window.__now === 'function' ? window.__now() : Date.now());
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const okPid = (v) => typeof v === 'string' && /^[a-z0-9]{1,8}$/.test(v);
const okItem = (v) => typeof v === 'string' && /^[a-z0-9]{1,16}$/.test(v);
const secs = () => performance.now() / 1000; // 몸짓의 시간: 느린 기기에서도 정해진 시간에 끝나게 실제 시각으로 잰다

// y = 별 가운데 높이, near = 트리 가운데에서 이만큼 안이면 "트리 옆", reach = 받치는 사람에게서 이만큼 안이면 올라갈 수 있다, ride = 어깨 위에 올라탄 높이
export const STAR = { y: TREE.top + 0.17, near: 2.25, reach: 1.2, ride: 1.08 };
// wait = 같이 들 사람을 기다리는 시간(ms), near = 가구 가장자리에서 이만큼 안이면 "같이 들기"가 보인다, carry = 둘이 옮기는 몸짓(초)
export const HEAVY = { wait: 20000, near: 0.9, carry: 1.4 };
const CLIMB = { up: 0.9, put: 1.35, down: 2.4, end: 3.0 }; // 올라가기 → 별 달기 → 내려오기 시작 → 끝 (초)

export function makeCoop(K) {
  let propping = null;        // 내가 받치는 중이면 { x, z } (선 자리)
  const props = new Map();    // 받치는 중인 다른 사람: id → 이름
  const rides = [];           // 올라가서 별 다는 몸짓 { c: 올라가는 아바타, h: 받치는 아바타, t, mine, help, put }
  let job = null;             // 내가 큰 가구를 드는 중: { role: 'wait' | 'help', id(가구), peer(같이 드는 사람), phase, t0, from, target }
  const waits = new Map();    // 큰 가구를 들고 기다리는 다른 사람: id → { item, from: { i, j, r } }
  const helps = new Map();    // 같이 들어 준 다른 사람: id → 기다리던 사람 id
  const carries = [];         // 둘이 가구를 옮기는 몸짓
  const sparks = [];          // 별이 달릴 때 튀는 반짝이
  let clock = 0, seen = new Set(), uiAt = 1, glowWas = 1, popT = 1;

  const alive = (a) => !!a && (a === K.me || [...K.others().values()].includes(a));
  const who = (id) => (id === K.myId() ? K.me : K.others().get(id));
  const myName = () => cleanWords(K.store.get(K.key('name')), NOTE.name) || cleanWords(K.nameOf(K.myId()), NOTE.name) || '친구'; // 방명록에 쓴 이름이 있으면 그것
  const nearTree = (a) => a.level === 0 && Math.hypot(a.x, a.z) < STAR.near;
  const josa = (w) => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c < 11172 && c % 28 ? '은' : '는'; };
  // 가구가 차지하는 네모 (격자의 자리)
  function rect(it) {
    const [w, d] = footprint(it.k, it.r), x0 = X0 + it.i * CELL, z0 = Z0 + it.j * CELL;
    return { x0, z0, x1: x0 + w * CELL, z1: z0 + d * CELL, cx: x0 + w * CELL / 2, cz: z0 + d * CELL / 2, long: w >= d ? 'x' : 'z' };
  }
  const distTo = (it, a) => { const r = rect(it); return Math.hypot(a.x - clamp(a.x, r.x0, r.x1), a.z - clamp(a.z, r.z0, r.z1)); };
  // 가구를 들 자리: 긴 쪽의 두 끝(안 되면 옆). other 가 있으면 그 사람에게서 먼 쪽, 없으면 나에게서 가까운 쪽
  function endSpot(it, other) {
    const r = rect(it), g = 0.34, lv = levelOfCell(it.i);
    const ends = [[r.x0 - g, r.cz], [r.x1 + g, r.cz]], sides = [[r.cx, r.z0 - g], [r.cx, r.z1 + g]];
    const ok = ([x, z]) => K.grid.fits(x, z, BODY_R) && levelOfCell(Math.floor((x - X0) / CELL)) === lv;
    let list = (r.long === 'x' ? ends : sides).filter(ok); // 긴 쪽의 끝을 먼저
    if (!list.length) list = (r.long === 'x' ? sides : ends).filter(ok);
    if (!list.length) return null;
    const score = ([x, z]) => (other ? -Math.hypot(x - other.x, z - other.z) : Math.hypot(x - K.me.x, z - K.me.z));
    return list.sort((a, b) => score(a) - score(b))[0];
  }
  const faceItem = (a, it) => { const r = rect(it); a.turnTo(r.cx - a.x, r.cz - a.z); };

  /* ───────── 꼭대기 별 (모양) ───────── */
  const starGeo = (() => {
    const s = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + Math.PI / 2, r = k % 2 ? 0.085 : 0.2;
      if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 1 });
    g.center();
    return g;
  })();
  const gold = new THREE.MeshPhongMaterial({ color: 0xF4C430, emissive: 0x8A5C00, shininess: 90, specular: 0xFFF3B8 });
  const slotMat = new THREE.MeshBasicMaterial({ color: 0xFFF4CC, transparent: true, opacity: 0.3, depthWrite: false });
  const haloTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.35, 'rgba(255,214,110,.55)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const starG = new THREE.Group();
  starG.position.set(0, STAR.y, 0);
  K.g0.add(starG); // 1층 묶음에 단다 (위층에서는 안 보인다)
  const real = new THREE.Mesh(starGeo, gold), slot = new THREE.Mesh(starGeo, slotMat);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xFFE38A, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(0.95);
  starG.add(real, slot, halo);
  const sparkGeo = new THREE.OctahedronGeometry(0.035, 0);
  const sparkMats = [0xFFE680, 0xFFFFFF, 0xFFC94D].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  // 별이 달리는 순간: 별이 톡 튀어나오고 반짝이가 사방으로 튄다
  function burst(n = 30, dom = true) {
    popT = 0;
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(sparkGeo, sparkMats[k % 3]), a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = 0.7 + Math.random() * 1.1;
      m.position.set(0, STAR.y, 0);
      K.g0.add(m);
      sparks.push({ m, v: [Math.cos(a) * Math.sqrt(1 - u * u) * s, u * s * 0.8 + 0.6, Math.sin(a) * Math.sqrt(1 - u * u) * s], t: 0 });
    }
    if (!dom) return;
    const box = $('party');
    if (!box) return;
    for (let k = 0; k < 14; k++) { // 화면에도 별과 반짝이가 쏟아진다 (#party 의 축하 효과)
      const e = document.createElement('i');
      e.textContent = ['⭐', '✨', '🌟'][k % 3];
      e.style.left = (6 + Math.random() * 88) + '%';
      e.style.animationDelay = (Math.random() * 0.5) + 's';
      e.style.fontSize = (18 + Math.random() * 14) + 'px';
      box.appendChild(e);
      setTimeout(() => e.remove(), 3300);
    }
  }
  function paintStar() {
    const on = !!K.S.star;
    real.visible = on; slot.visible = !on; halo.visible = on;
  }

  /* ───────── 트리 판: 별이 어떤지, 별 떼기 ───────── */
  const css = document.createElement('style');
  css.textContent = '#starRow .hint{font-size:12.5px}'
    + '#coopWait{position:absolute;left:50%;bottom:130px;transform:translateX(-50%);z-index:3;display:flex;align-items:center;gap:6px;max-width:calc(100vw - 20px);'
    + 'padding:4px 4px 4px 14px;border-radius:24px;background:rgba(255,252,245,.97);border:1.5px solid var(--line);box-shadow:0 4px 14px rgba(60,30,10,.28);white-space:nowrap}'
    + '#coopWait span{font-size:13px;font-weight:800;color:var(--ink);overflow:hidden;text-overflow:ellipsis;min-width:0}#coopWait small{color:var(--sub);font-weight:700}'
    + '#coopWait .btn{border-radius:20px}';
  document.head.appendChild(css);
  const row = document.createElement('div');
  row.className = 'row'; row.id = 'starRow';
  const info = document.createElement('div');
  info.className = 'hint'; info.id = 'starInfo';
  const off = document.createElement('button');
  off.type = 'button'; off.className = 'btn'; off.id = 'starOff'; off.textContent = '별 떼기';
  off.addEventListener('click', () => { if (K.S.star && !K.op({ t: 'star', on: false })) K.toast('별을 떼지 못했어요'); });
  row.append(info, off);
  if ($('treeP')) $('treeP').appendChild(row);
  function paintRow() {
    const s = K.S.star;
    row.hidden = !s; // 별이 없으면 줄을 숨겨 트리 판이 높아지지 않게 한다 (트리가 크게 보이게)
    const text = s ? `⭐ ${s.help}님이 받치고 ${s.name}님이 달았어요` : '';
    if (info.textContent !== text) info.textContent = text;
    off.hidden = !s || !K.canEdit();
  }

  /* ───────── 큰 가구를 기다리는 동안의 띠 ───────── */
  const bar = document.createElement('div');
  bar.id = 'coopWait'; bar.hidden = true; bar.setAttribute('role', 'status');
  const barText = document.createElement('span');
  const barDel = document.createElement('button'), barStop = document.createElement('button');
  barDel.type = barStop.type = 'button'; barDel.className = barStop.className = 'btn';
  barDel.id = 'coopDel'; barDel.textContent = '치우기';
  barStop.id = 'coopStop'; barStop.textContent = '취소';
  bar.append(barText, barDel, barStop);
  document.body.appendChild(bar);
  barStop.addEventListener('click', () => endJob('그만뒀어요'));
  barDel.addEventListener('click', () => { if (!job) return; const id = job.id; endJob(null); if (K.op({ t: 'del', id })) K.toast('치웠어요'); });
  function paintBar() {
    const show = !!job && job.role === 'wait' && (job.phase === 'walk' || job.phase === 'wait');
    bar.hidden = !show;
    if (!show) return;
    const left = Math.max(0, Math.ceil((HEAVY.wait - (now() - job.t0)) / 1000));
    const html = `🤝 같이 들 친구를 기다려요 <small>${left}초</small>`;
    if (barText.innerHTML !== html) barText.innerHTML = html;
    const b = K.actBottom();
    if (b && bar.style.bottom !== b) bar.style.bottom = b;
  }

  /* ───────── 몸짓 (걷는 몸짓 위에 덮어쓴다) ───────── */
  function pose(a, kind, t = clock) {
    const p = a.parts;
    if (!p) return;
    const { body, legs, arms, head } = p;
    const set = (ax, az, as) => { for (const k of [0, 1]) { arms[k].rotation.x = ax[k]; arms[k].rotation.z = az[k]; arms[k].scale.y = as; } };
    if (kind === 'prop') { set([-0.85, -0.85], [0.52, -0.52], 1.1); body.rotation.x = 0.12; head.rotation.x = -0.32; }     // 두 손을 모아 앞에 받친다
    else if (kind === 'base') { set([-2.8, -2.8], [0.22, -0.22], 1.25); body.rotation.x = 0; head.rotation.x = -0.18; }  // 어깨 위 사람의 다리를 잡는다
    else if (kind === 'up') { // 받치는 사람을 딛고 올라간다
      const c = Math.sin(t * 11);
      set([-2.3 + 0.45 * c, -2.3 - 0.45 * c], [-0.1, 0.1], 1.1);
      legs[0].rotation.x = -0.7 * Math.max(0, c); legs[1].rotation.x = -0.7 * Math.max(0, -c); head.rotation.x = -0.25;
    } else if (kind === 'ride') { // 어깨 위에 앉아 두 팔을 뻗어 별을 단다
      set([-2.95 + 0.08 * Math.sin(t * 7), -2.95 + 0.08 * Math.cos(t * 7)], [-0.12, 0.12], 1.32);
      legs[0].rotation.x = legs[1].rotation.x = -1.45; body.rotation.x = 0; head.rotation.x = -0.42;
    } else if (kind === 'lift' || kind === 'carry') { // 가구 끝을 잡고 든다 (옮기는 중이면 걷는다)
      set([-0.62, -0.62], [0.22, -0.22], 1.2); body.rotation.x = 0.2; head.rotation.x = -0.05;
      if (kind === 'carry') { const s = Math.sin(t * 11) * 0.55; legs[0].rotation.x = s; legs[1].rotation.x = -s; }
    }
  }

  /* ───────── 받쳐 주기와 올라가기 ───────── */
  function startProp() {
    if (K.S.star) return;
    const me = K.me;
    if (job) endJob(null);
    me.stop(); me.onArrive = null;
    me.turnTo(-me.x, -me.z); // 트리를 본다
    propping = { x: me.x, z: me.z };
    K.fx({ k: 'prop', v: myName() });
    K.toast('받치고 있어요 🙌 친구가 가까이 와서 "⭐ 올라가서 별 달기"를 누르면 돼요');
    K.dirty();
  }
  function stopProp(say) {
    if (!propping) return;
    propping = null;
    K.fx({ k: 'prop', v: '' });
    if (say) K.toast('그만 받쳤어요');
    K.dirty();
  }
  // 받치고 있는 사람(pid) 어깨 위로 올라가 별을 단다
  function climb(pid) {
    const a = K.others().get(pid), help = props.get(pid), me = K.me;
    if (!a || !help || K.S.star) return false;
    if (Math.hypot(a.x - me.x, a.z - me.z) > STAR.reach) { K.toast('받쳐 주는 친구 가까이 가야 해요'); return false; }
    if (rides.some((r) => r.h === a || r.c === a)) { K.toast('지금은 다른 친구가 올라가 있어요'); return false; }
    if (job) endJob(null);
    if (propping) stopProp(false);
    me.stop(); me.onArrive = null;
    K.fx({ k: 'climb', v: pid });
    startRide(me, a, true, help);
    return true;
  }
  function startRide(c, h, mine, help) {
    for (let k = rides.length - 1; k >= 0; k--) if (rides[k].c === c) rides.splice(k, 1);
    rides.push({ c, h, t: 0, t0: secs(), mine, help, put: false });
    c.doing = null;
  }
  function endRide(r) {
    const k = rides.indexOf(r);
    if (k >= 0) rides.splice(k, 1);
    if (alive(r.c)) { r.c.sync(); r.c.animate(0, false); }
    if (r.h === K.me && propping) stopProp(false); // 다 달았으니 받치던 손을 내린다
    K.dirty();
  }
  function tickRides(dt) {
    for (const r of rides.slice()) {
      r.t = secs() - r.t0;
      if (!alive(r.c) || !alive(r.h) || (r.c === K.me && K.me.path.length)) { endRide(r); continue; }
      const T = CLIMB, hw = toWorld(r.h.x, r.h.z), cw = toWorld(r.c.x, r.c.z), top = [hw[0], hw[1] + STAR.ride, hw[2]];
      let p, kind;
      if (r.t < T.up) { const e = ease(r.t / T.up); p = [lerp(cw[0], top[0], e), lerp(cw[1], top[1], e) + Math.sin(e * Math.PI) * 0.25, lerp(cw[2], top[2], e)]; kind = 'up'; }
      else if (r.t < T.down) { p = top; kind = 'ride'; }
      else { const e = ease((r.t - T.down) / (T.end - T.down)); p = [lerp(top[0], cw[0], e), lerp(top[1], cw[1], e) + Math.sin(e * Math.PI) * 0.15, lerp(top[2], cw[2], e)]; kind = 'up'; }
      r.c.root.position.set(p[0], p[1], p[2]);
      r.c.face = Math.atan2(-hw[0], -hw[2]); r.c.root.rotation.y = r.c.face; // 트리 쪽을 본다
      r.h.face = r.c.face; r.h.root.rotation.y = r.h.face;
      pose(r.c, kind, r.t);
      pose(r.h, kind === 'ride' ? 'base' : 'prop');
      if (r.mine && !r.put && r.t >= T.put) { // 손이 닿았다: 별을 단다 (방의 상태)
        r.put = true;
        if (!K.S.star && !K.op({ t: 'star', on: true, by: K.myId(), name: myName(), help: r.help })) K.toast('별을 달지 못했어요');
      }
      if (r.t >= T.end) endRide(r);
    }
  }

  /* ───────── 큰 가구 둘이 들기 ───────── */
  // 놓인 큰 가구를 옮기려고 눌렀을 때 (가구 판). 둘이 들어야 하면 기다리기 시작하고 true, 평소처럼 혼자 옮기면 false
  function heavyPick(id) {
    const it = K.S.items.get(id);
    if (!it || !kindOf(it.k).heavy || !K.others().size || !K.canEdit()) return false;
    const name = kindOf(it.k).name;
    if (job && job.role === 'wait' && job.id === id) {
      if (job.phase === 'place') return false;
      K.toast(`${name}${josa(name)} 둘이 들어야 해요. 친구가 '🤝 같이 들기'를 눌러 주면 옮겨요`);
      return true;
    }
    if (job) endJob(null);
    if (propping) stopProp(false);
    job = { role: 'wait', id, peer: null, phase: 'walk', t0: now(), from: { i: it.i, j: it.j, r: it.r }, target: null };
    K.fx({ k: 'heavy', v: id });
    const s = endSpot(it, null), me = K.me;
    job.target = s;
    if (s && Math.hypot(s[0] - me.x, s[1] - me.z) > 0.15 && K.goTo(s[0], s[1])) me.onArrive = () => arrive(job);
    else arrive(job);
    K.toast(`${name}${josa(name)} 둘이 들어야 해요. 친구가 반대쪽에서 '🤝 같이 들기'를 눌러 주세요`);
    return true;
  }
  // 가구 끝에 닿았다: 드는 자세로 기다린다 (같이 들어 주는 사람이면 다 왔다고 알린다)
  function arrive(j) {
    if (!j || j !== job || j.phase !== 'walk') return;
    const it = K.S.items.get(j.id), me = K.me;
    if (!it) { endJob(null); return; }
    faceItem(me, it);
    j.spot = [me.x, me.z];
    K.dirty();
    if (j.role === 'wait') { j.phase = j.peer ? 'place' : 'wait'; return; }
    j.phase = 'hold';
    K.fx({ k: 'help', v: j.peer });
    K.toast('같이 들었어요 🤝 친구가 놓을 자리를 골라요');
  }
  // 기다리는 사람(pid)의 가구를 같이 든다
  function help(pid) {
    const w = waits.get(pid), it = w && K.S.items.get(w.item), me = K.me;
    if (!it) return false;
    if (job) endJob(null);
    if (propping) stopProp(false);
    job = { role: 'help', id: w.item, peer: pid, phase: 'walk', t0: now(), from: w.from, target: null };
    const s = endSpot(it, K.others().get(pid));
    job.target = s;
    if (s && Math.hypot(s[0] - me.x, s[1] - me.z) > 0.15 && K.goTo(s[0], s[1])) me.onArrive = () => arrive(job);
    else arrive(job);
    return true;
  }
  // 같이 들어 줄 사람이 반대쪽 끝에 섰다: 평소의 옮기기 화면을 연다
  function partnerJoined(pid) {
    if (!job || job.role !== 'wait' || !K.S.items.has(job.id)) return;
    job.peer = pid;
    if (job.phase === 'wait' || job.phase === 'walk') job.phase = 'place';
    if (K.mode() !== 'furn') K.setMode('furn');
    K.ghostPick(job.id);
    K.toast('친구가 같이 들었어요! 놓을 자리를 골라요');
  }
  function partnerLeft(say) {
    if (!job || job.role !== 'wait') return;
    const g = K.ghost();
    if (job.phase === 'place' && g && g.id === job.id) K.ghostCancel();
    endJob(say);
  }
  // 그만 든다. 같이 있는 사람들에게도 알린다
  function endJob(say) {
    if (!job) return;
    const j = job;
    job = null;
    K.fx(j.role === 'wait' ? { k: 'heavy', v: '' } : { k: 'help', v: '' });
    if (say) K.toast(say);
    paintBar();
    K.dirty();
  }
  // 둘이 가구를 들고 새 자리로 옮기는 몸짓. from = 옮기기 전 자리, W·H = 든 두 사람
  function startCarry(id, from, W, H) {
    const it = K.S.items.get(id), g = K.itemObj(id);
    if (!it || !g) return;
    const r0 = rect({ ...it, ...from }), r1 = rect(it);
    const a0 = from.r * Math.PI / 2;
    let a1 = it.r * Math.PI / 2;
    while (a1 - a0 > Math.PI) a1 -= Math.PI * 2;
    while (a1 - a0 < -Math.PI) a1 += Math.PI * 2;
    const rot = (x, z, t) => [x * Math.cos(t) + z * Math.sin(t), -x * Math.sin(t) + z * Math.cos(t)]; // 위에서 본 회전 (three.js 의 rotation.y 와 같은 쪽)
    const parts = [W, H].filter(alive).map((a) => ({ a, off: rot(a.x - r0.cx, a.z - r0.cz, -a0) }));
    for (let k = carries.length - 1; k >= 0; k--) if (carries[k].id === id) carries.splice(k, 1);
    carries.push({ id, g, c0: [r0.cx, r0.cz], c1: [r1.cx, r1.cz], a0, a1, parts, rot, t: 0, t0: secs() });
  }
  function tickCarries(dt) {
    for (const c of carries.slice()) {
      c.t = secs() - c.t0;
      const e = ease(c.t / HEAVY.carry), x = lerp(c.c0[0], c.c1[0], e), z = lerp(c.c0[1], c.c1[1], e), ang = lerp(c.a0, c.a1, e);
      const w = toWorld(x, z), lift = 0.2 * Math.min(1, e * 5, (1 - e) * 5);
      const done = c.t >= HEAVY.carry || !K.S.items.has(c.id) || K.itemObj(c.id) !== c.g;
      if (!done) { c.g.position.set(w[0], w[1] + lift, w[2]); c.g.rotation.y = ang; }
      for (const p of c.parts) {
        if (!alive(p.a)) continue;
        const o = c.rot(p.off[0], p.off[1], ang), px = x + o[0], pz = z + o[1];
        if (done) {
          // 새 자리의 끝에 선다 (내 자리는 친구에게도 간다. 다른 사람도 그 자리에 세워 두면 곧 올 그 사람의 자리와 맞는다)
          if (K.grid.fits(px, pz, BODY_R)) p.a.place(px, pz); else p.a.sync();
          if (K.S.items.has(c.id)) faceItem(p.a, K.S.items.get(c.id));
          continue;
        }
        const pw = toWorld(px, pz);
        p.a.root.position.set(pw[0], pw[1], pw[2]);
        p.a.face = Math.atan2(x - px, z - pz); p.a.root.rotation.y = p.a.face;
        pose(p.a, 'carry', c.t);
      }
      if (done) {
        carries.splice(carries.indexOf(c), 1);
        const it = K.S.items.get(c.id);
        if (it && K.itemObj(c.id) === c.g) { const r = rect(it), f = toWorld(r.cx, r.cz); c.g.position.set(f[0], f[1], f[2]); c.g.rotation.y = it.r * Math.PI / 2; }
        if (job && job.id === c.id) endJob(null); // 다 옮겼다: 손을 놓는다
        K.dirty();
      }
    }
  }
  // 방의 변화를 본다 (dispatch 가 받아들인 뒤). from = 'me' | 'view'(구경하는 내가 함) | 'peer'
  function onOp(op, from) {
    if (op.t === 'star') {
      paintStar(); paintRow();
      if (op.on) { burst(); K.toast(`${op.help}님이 받치고 ${op.name}님이 별을 달았어요! ⭐`); }
      else K.toast(from === 'peer' ? '꼭대기 별을 뗐어요' : '꼭대기 별을 뗐어요. 친구와 다시 달아 봐요');
      return;
    }
    if (op.t === 'del') {
      if (job && job.id === op.id) endJob(null);
      for (const [pid, w] of [...waits]) if (w.item === op.id) waits.delete(pid);
      return;
    }
    if (op.t !== 'move') return;
    // 누가 들고 있던 큰 가구인지: 기다리던 사람(W)과 같이 든 사람(H)
    let W = null, H = null, from0 = null;
    if (job && job.id === op.id && job.role === 'wait' && job.peer) { W = K.me; H = K.others().get(job.peer); from0 = job.from; }
    else if (job && job.id === op.id && job.role === 'help' && job.phase === 'hold') { W = K.others().get(job.peer); H = K.me; from0 = job.from; }
    else for (const [pid, w] of waits) {
      if (w.item !== op.id) continue;
      const hid = [...helps].find(([, x]) => x === pid);
      if (!hid) continue;
      W = K.others().get(pid); H = who(hid[0]); from0 = w.from;
    }
    if (W && H && from0) startCarry(op.id, from0, W, H);
  }

  /* ───────── 가까이 서면 할 수 있는 일 (#act 단추, 스페이스바) ───────── */
  function near() {
    const me = K.me;
    if (rides.some((r) => r.c === me)) return null;
    if (job && job.role === 'help' && job.phase === 'hold') return { label: '🤝 손 놓기', run: () => endJob('손을 놓았어요') };
    if (propping) return { label: '🙌 그만 받치기', run: () => stopProp(true) };
    for (const [pid, w] of waits) { // 큰 가구를 같이 들어 줄 수 있다
      const it = K.S.items.get(w.item);
      if (!it || levelOfCell(it.i) !== me.level || distTo(it, me) > HEAVY.near || [...helps.values()].includes(pid)) continue;
      return { label: '🤝 같이 들기', run: () => help(pid) };
    }
    if (K.S.star || me.hold || !nearTree(me)) return null;
    for (const [pid] of props) { // 받치고 있는 친구가 가까이 있다
      const a = K.others().get(pid);
      if (a && Math.hypot(a.x - me.x, a.z - me.z) <= STAR.reach && !rides.some((r) => r.h === a)) return { label: '⭐ 올라가서 별 달기', run: () => climb(pid) };
    }
    if (!K.others().size) return { weak: true, label: '⭐ 별 달기', run: () => K.toast('손이 닿지 않아요. 친구가 받쳐 주면 달 수 있어요') };
    return { label: '🙌 받쳐 주기', run: startProp };
  }

  /* ───────── 다른 사람에게서 온 소식 ───────── */
  // 받아들였으면 true (방장은 그때만 다른 사람에게 전한다)
  function peerFx(m, id) {
    const a = K.others().get(id);
    if (!a || typeof m.v !== 'string') return false;
    if (m.k === 'prop') {
      if (!m.v) { props.delete(id); K.dirty(); return true; }
      if (!okWords(m.v, NOTE.name)) return false;
      props.set(id, m.v);
      a.turnTo(-a.x, -a.z);
      K.dirty();
      return true;
    }
    if (m.k === 'climb') {
      const h = okPid(m.v) ? who(m.v) : null;
      if (!h || h === a) return false;
      startRide(a, h, false, '');
      return true;
    }
    if (m.k === 'heavy') {
      if (!m.v) {
        waits.delete(id);
        for (const [hid, w] of [...helps]) if (w === id) helps.delete(hid);
        if (job && job.role === 'help' && job.peer === id && !carries.some((c) => c.id === job.id)) endJob('친구가 가구를 내려놓았어요');
        return true;
      }
      const it = okItem(m.v) ? K.S.items.get(m.v) : null;
      if (!it || !kindOf(it.k).heavy) return false;
      waits.set(id, { item: m.v, from: { i: it.i, j: it.j, r: it.r } });
      return true;
    }
    if (m.k === 'help') {
      if (!m.v) {
        const w = helps.get(id);
        helps.delete(id);
        if (w === K.myId() && job && job.role === 'wait' && job.peer === id && !carries.some((c) => c.id === job.id)) partnerLeft('친구가 손을 놓아서 내려놓았어요');
        return true;
      }
      if (!okPid(m.v) || m.v === id) return false;
      if (m.v === K.myId()) {
        if (!job || job.role !== 'wait') return false;
        helps.set(id, m.v);
        partnerJoined(id);
        return true;
      }
      if (!waits.has(m.v)) return false;
      helps.set(id, m.v);
      return true;
    }
    return false;
  }

  /* ───────── 매 장면 ───────── */
  function tick(dt) {
    clock += dt;
    const me = K.me, others = K.others();
    // 나간 사람의 것은 지운다
    for (const m of [props, waits, helps]) for (const id of [...m.keys()]) if (!others.has(id)) m.delete(id);
    // 새로 온 사람에게 내가 받치거나 드는 중인 것을 다시 알린다
    let fresh = false;
    for (const id of others.keys()) if (!seen.has(id)) fresh = true;
    seen = new Set(others.keys());
    if (fresh) {
      if (propping) K.fx({ k: 'prop', v: myName() });
      if (job && job.role === 'wait') K.fx({ k: 'heavy', v: job.id });
      if (job && job.role === 'help' && job.phase === 'hold') K.fx({ k: 'help', v: job.peer });
    }
    // 받치는 중: 움직이면 풀린다
    if (propping && (me.path.length || me.rest || me.hop || Math.hypot(me.x - propping.x, me.z - propping.z) > 0.05 || K.S.star && !rides.some((r) => r.h === me))) stopProp(false);
    for (const [id] of props) { const a = others.get(id); if (a && a.moving && !rides.some((r) => r.h === a)) props.delete(id); }
    // 큰 가구
    if (job) {
      const g = K.ghost(), it = K.S.items.get(job.id);
      if (!it) endJob(null);
      else if (job.role === 'wait') {
        if (job.peer && !others.has(job.peer)) partnerLeft('같이 들던 친구가 떠나서 내려놓았어요');
        else if (!others.size) endJob(null);
        else if (job.phase === 'walk' || job.phase === 'wait') {
          if (K.mode() !== 'furn' || g) endJob(null); // 판을 닫았거나 다른 가구를 들었다
          else if (now() - job.t0 > HEAVY.wait) endJob('같이 들 친구가 오지 않았어요. 다시 눌러 보세요');
          else if (job.phase === 'walk' && !me.path.length && !me.hop) arrive(job);
        } else if (job.phase === 'place' && !(g && g.id === job.id) && !carries.some((c) => c.id === job.id)) endJob(null); // 놓지 않고 취소했다
      } else { // 같이 들어 주는 중
        if (!others.has(job.peer)) endJob('친구가 떠났어요');
        else if (job.phase === 'walk') {
          const last = me.path[me.path.length - 1];
          if (last && job.target && Math.hypot(last[0] - job.target[0], last[1] - job.target[1]) > 0.3) endJob(null); // 다른 데로 걸어간다
          else if (!me.path.length && !me.hop) arrive(job);
        } else if (job.phase === 'hold' && !carries.some((c) => c.id === job.id) && (me.path.length || Math.hypot(me.x - job.spot[0], me.z - job.spot[1]) > 0.15)) endJob('손을 놓았어요');
      }
    }
    tickRides(dt);
    tickCarries(dt);
    if (rides.length || carries.length || sparks.length) K.dirty(); // 움직이는 동안은 그림자도 따라간다
    // 몸짓: 받치기, 들고 기다리기
    const busy = (a) => rides.some((r) => r.c === a || r.h === a) || carries.some((c) => c.parts.some((p) => p.a === a));
    if (propping && !busy(me)) pose(me, 'prop');
    for (const [id] of props) { const a = others.get(id); if (a && !busy(a)) pose(a, 'prop'); }
    if (job && !busy(me) && (job.phase === 'wait' || job.phase === 'place' || job.phase === 'hold')) pose(me, 'lift');
    for (const id of [...waits.keys(), ...helps.keys()]) { const a = others.get(id); if (a && !a.moving && !busy(a)) pose(a, 'lift'); }
    // 꼭대기 별: 천천히 흔들리며 반짝인다. 점등식으로 트리 둘레 빛이 밝아지면 별도 같이 빛난다
    paintStar();
    const f = K.treeGlow();
    if (K.S.star) {
      popT = Math.min(1, popT + dt * 2.2);
      const s = popT >= 1 ? 1 : 0.2 + 0.8 * ease(popT) + 0.3 * Math.sin(popT * Math.PI);
      real.scale.setScalar(s);
      starG.rotation.y = Math.sin(clock * 0.8) * 0.5;
      const glow = Math.max(0, f - 1);
      gold.emissiveIntensity = 1 + glow * 0.5 + 0.15 * Math.sin(clock * 3);
      halo.scale.setScalar(0.95 * (1 + glow * 0.45) + 0.06 * Math.sin(clock * 2.4));
      halo.material.opacity = Math.min(1, 0.6 + glow * 0.2);
      if (f > 2 && glowWas <= 2) burst(18, false); // 점등!
    } else {
      starG.rotation.y = 0;
      slotMat.opacity = 0.22 + 0.1 * Math.sin(clock * 2);
    }
    glowWas = f;
    for (let k = sparks.length - 1; k >= 0; k--) {
      const s = sparks[k];
      s.t += dt; s.v[1] -= 1.6 * dt;
      s.m.position.x += s.v[0] * dt; s.m.position.y += s.v[1] * dt; s.m.position.z += s.v[2] * dt;
      s.m.rotation.y += dt * 6;
      s.m.scale.setScalar(Math.max(0.01, 1 - s.t / 1.5));
      if (s.t > 1.5) { K.g0.remove(s.m); sparks.splice(k, 1); }
    }
    uiAt += dt;
    if (uiAt > 0.2) { uiAt = 0; paintRow(); }
    paintBar();
  }

  paintStar(); paintRow();
  // 자동 검사가 쓰는 창구
  window.__coop = {
    STAR, HEAVY,
    get star() { return K.S.star ? { ...K.S.star } : null; },
    get starShown() { return real.visible && starG.parent === K.g0; }, get slotShown() { return slot.visible; },
    get propping() { return !!propping; }, props: () => [...props], get rides() { return rides.map((r) => ({ t: r.t, mine: r.mine, y: r.c.root.position.y })); },
    get job() { return job ? { role: job.role, id: job.id, peer: job.peer, phase: job.phase } : null; },
    waits: () => [...waits].map(([id, w]) => [id, w.item]), helps: () => [...helps],
    get carrying() { return carries.length; }, get sparks() { return sparks.length; }, get waitShown() { return !bar.hidden; },
    near: () => { const a = near(); return a ? a.label : null; },
    startProp, stopProp, climb, heavyPick, help, endJob,
    // 그 사람의 팔 자세 (받치기·들기 검사용)
    arms: (id) => { const a = id === 'me' ? K.me : who(id); return a && a.parts ? a.parts.arms.map((x) => [x.rotation.x, x.rotation.z]) : null; },
    starPos: () => { const v = new THREE.Vector3(); real.getWorldPosition(v); return [v.x, v.y, v.z]; },
  };
  return { near, peerFx, onOp, heavyPick, tick };
}
