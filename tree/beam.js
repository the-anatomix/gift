// 비행 슈트의 손바닥 빛줄기와 유도탄, 그리고 목표 고르기.
// 빛줄기: "✋ 빔" 단추(키보드 B)를 누르면 한 손을 뻗어 짧은 빛줄기를 쏘고, 닿은 곳에서 반짝이가 튄다. 사람이 맞으면 1초 동안 뒤로 쓰러진다(avatar.knock).
// 유도탄: "☄️ 유도탄" 단추(키보드 M)를 누르면 작은 유도탄이 목표를 따라가서 터지고, 맞은 사람은 STUN(3초) 동안 기절한다(머리 위에 별이 돈다).
//   목표가 있으면 집 안에서는 걸어가는 길(문·가구 사이, grid.route)을 따라 날아가서 벽에 막히지 않는다. 목표가 없으면 보는 쪽으로 곧장 날아가 닿는 곳에서 터진다.
// 목표: "🎯 목표" 단추(키보드 T)를 누를 때마다 가까운 사람부터 차례로 고르고(끝에서 한 번 더 누르면 푼다), 화면에서 그 사람을 직접 눌러도 된다. 고른 사람에게 조준 표시가 뜬다.
//   고른 목표가 없으면 쏠 때 스스로 겨눈다: 빛줄기는 내가 보는 쪽 앞(내려다볼 때 ±60°, 1인칭 ±26°)에서 가장 가까운 사람, 유도탄은 어느 쪽이든 가장 가까운 사람. 그 사람에게는 옅은 조준 표시가 뜬다.
//   빛줄기도 목표를 향해 쏘므로(위아래 각 포함) 벽이나 가구에 가리지 않았으면 맞는다.
// 방의 상태는 바꾸지 않는다(가구를 부수거나 밀지 않는다). 독자 디자인이며 실제 작품의 이름·모양·소리는 쓰지 않았다.
// 방향: 목표가 없을 때 내려다보면 아바타가 보는 쪽으로 수평, 1인칭에서는 내가 보는 쪽(위아래 포함). 길이는 쏜 사람이 재서(벽·가구·바닥까지, 길어야 MAX) 같이 보낸다.
// 동기화: 놀이 소식 { k: 'beam', v: '방향(라디안);위아래 각;길이' }, 사람을 맞혔으면 이어서 { k: 'zap', v: 맞은 사람 id }.
//         { k: 'mis', v: '목표 id(없으면 빈 글자);방향;위아래 각;길이' }, 유도탄이 목표에 닿았으면 { k: 'boom', v: 맞은 사람 id }.
// 보낸 사람이 비행 슈트를 입고 있을 때만, zap·boom 은 그 사람의 빛줄기·유도탄을 방금 받았을 때만 받는다. 맞혔는지는 쏜 사람이 정한다(유도탄이 날아가는 모습은 저마다의 화면에서 따로 구한다).
import { THREE, soft } from './kit.js';
import { HOST_OUTFIT } from './costume.js';
import { BODY_R, HEIGHT } from './avatar.js';
import { cellOf, zoneOf, YARD, FLOOR_H, FLOOR_DX, CELL, Z0 } from './path.js';
import { sfx } from './sfx.js';

export const MAX = 7;      // 빛줄기의 가장 긴 길이
export const RANGE = 14;   // 유도탄이 닿는 거리 (목표가 없을 때 곧장 날아가는 거리이기도 하다)
export const STUN = 3;     // 유도탄에 맞아 기절해 있는 시간(초)
const COOL = 0.7, LIFE = 0.75, SPARKS = 18;
const M_COOL = 4, M_LIFE = 5, M_V0 = 3, M_V1 = 7.5, M_ACC = 7, M_HIT = 0.34, M_PTS = 40, M_BOOM = 0.7, M_MAX = 4; // 유도탄: 다시 쏘기까지, 날아가는 시간, 빠르기(처음·끝·붙는 빠르기), 닿았다고 보는 거리, 점 수, 터지는 시간, 한꺼번에 그리는 수
const LOCK_FAR = RANGE + 4; // 이보다 멀리 있는 사람은 목표로 고를 수 없다
const RE = /^(-?\d\.\d\d);(-?\d\.\d\d);(\d\.\d)$/;
const M_RE = /^([a-z0-9]{0,8});(-?\d\.\d\d);(-?\d\.\d\d);(\d{1,2}\.\d)$/;
const BEAM = new THREE.MeshBasicMaterial({ color: 0x8FE6FF, transparent: true, opacity: 0.92, depthWrite: false }); // 밝은 바닥 위에서도 보이게 더하기 섞기를 쓰지 않는다
let geo = null, sparkMat = null, glowMat = null, mBody = null, mTip = null;

// K = { scene, me, others(): Map, myId(), nameOf(id), toast(m), show(): 단추를 보일 때인지, dir(): { yaw, pitch }, eye(): 1인칭인지, screen(v3): 화면의 자리 { x, y },
//       grid, fixed(i, j), sky(): 내가 하늘에 있는지, online(), fx(m), dirty() }
export function makeBeam(K) {
  const css = document.createElement('style');
  css.textContent = '#beamBtn,#misBtn,#lockBtn{position:absolute;left:74px;bottom:246px;z-index:3;width:58px;height:58px;padding:0;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;'
    + 'font-size:11px;font-weight:800;line-height:1.1;box-shadow:0 4px 14px rgba(60,30,10,.28);touch-action:manipulation;user-select:none;-webkit-user-select:none}#beamBtn b,#misBtn b,#lockBtn b{font-size:21px;line-height:1}'
    + '#misBtn{bottom:312px}#lockBtn{bottom:378px}#lockBtn[aria-pressed=true]{background:#C2261F;border-color:#C2261F;color:#fff}#misBtn.wait{opacity:.55}';
  document.head.appendChild(css);
  const PC = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches); // 키보드가 있는 기기에는 단추에 키 이름을 같이 적는다
  const mk = (id, icon, text, label) => {
    const b = document.createElement('button');
    b.type = 'button'; b.id = id; b.className = 'btn'; b.hidden = true; b.setAttribute('aria-label', label);
    const i = document.createElement('b'); i.textContent = icon; b.append(i, text);
    document.body.appendChild(b);
    return b;
  };
  const btn = mk('beamBtn', '✋', PC ? '빔 B' : '빔', '손바닥 빛줄기 쏘기 (B 키)');
  const misBtn = mk('misBtn', '☄️', PC ? '유도탄 M' : '유도탄', '유도탄 쏘기 (M 키)');
  const lockBtn = mk('lockBtn', '🎯', PC ? '목표 T' : '목표', '목표 고르기 (T 키)');
  lockBtn.setAttribute('aria-pressed', 'false');

  const slots = [], lastOf = new WeakMap(), o = new THREE.Vector3(), d = new THREE.Vector3(), e = new THREE.Vector3();
  let clock = 0, firedAt = -9, count = 0, last = null, hitId = null, zaps = 0;
  const shotOf = new WeakMap(); // 친구가 마지막으로 쏜 빛줄기 { t, yaw } (zap 소식을 확인한다)
  // 목표와 유도탄
  let lock = null, auto = null, autoAt = -9, mark = null; // lock = 내가 고른 목표 id, auto = 지금 쏘면 스스로 겨눌 사람 id, mark = 조준 표시
  let mFiredAt = -9, mCount = 0, mLast = null, hits = 0;
  const mis = [], mShot = new WeakMap(), mLastOf = new WeakMap(); // 유도탄 묶음, 친구가 방금 쏜 유도탄 { t, tid } (boom 소식을 확인한다)
  const tp = new THREE.Vector3(), want = new THREE.Vector3(), aimPt = new THREE.Vector3();
  const who = (id) => (id === K.myId() ? K.me : K.others().get(id));
  function mats() {
    if (geo) return;
    geo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); geo.rotateX(Math.PI / 2); geo.translate(0, 0, 0.5); // +z 쪽으로 뻗는 길이 1 의 대롱
    sparkMat = new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, vertexColors: true, map: soft(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    glowMat = new THREE.SpriteMaterial({ map: soft(), color: 0x9FEAFF, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    mBody = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8); mBody.rotateX(Math.PI / 2);                              // 유도탄 몸통(+z 가 앞)
    mTip = new THREE.ConeGeometry(0.04, 0.1, 8); mTip.rotateX(Math.PI / 2); mTip.translate(0, 0, 0.15);              // 뾰족한 앞머리
  }
  function slot() {
    let s = slots.find((x) => !x.on);
    if (s) return s;
    if (slots.length >= 6) return null;
    mats();
    const g = new THREE.Group(), ray = new THREE.Mesh(geo, BEAM), glow = new THREE.Sprite(glowMat), pg = new THREE.BufferGeometry();
    const pos = new Float32Array(SPARKS * 3), col = new Float32Array(SPARKS * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(pg, sparkMat);
    for (const m of [ray, glow, pts]) { m.frustumCulled = false; m.raycast = () => {}; m.renderOrder = 4; }
    g.add(ray, glow, pts); g.visible = false; K.scene.add(g);
    s = { on: false, g, ray, glow, pts, pg, pos, col, vel: new Float32Array(SPARKS * 3) };
    slots.push(s);
    return s;
  }
  // 손바닥의 세상 자리
  function palm(a, out) {
    const arm = a.parts.arms[0];
    arm.updateWorldMatrix(true, false);
    return out.set(0, -0.3, 0.03).applyMatrix4(arm.matrixWorld);
  }
  const dirOf = (yaw, pitch, out) => out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  // 맞을 수 있는 사람: 같은 층에 서 있고(눕거나 사다리·하늘·썰매가 아니고) 보이는 사람
  // 내가 하늘에 있으면 마당에 있는 사람만 (집 안은 지붕에 가린다)
  const inYard = (a) => { const [i, j] = cellOf(a.x, a.z); return zoneOf(i, j) === 'yard'; };
  const target = (a) => a.root.visible && a.parts && !a.rest && !a.hop && !a.fly && !(a.down > 0) && a.level === K.me.level && (!K.sky() || inYard(a));
  const turn = (v) => Math.atan2(Math.sin(v), Math.cos(v));
  // 맞힐 수 있는 사람들 (가까운 순). far 보다 먼 사람은 뺀다
  function cands(far) {
    const p = K.me.root.position, out = [];
    for (const [id, a] of K.others()) {
      if (!target(a)) continue;
      const dx = a.root.position.x - p.x, dz = a.root.position.z - p.z, dist = Math.hypot(dx, dz);
      if (dist <= far && dist > 0.05) out.push({ id, a, dist, dx, dz });
    }
    return out.sort((x, y) => x.dist - y.dist);
  }
  // 쏠 때 겨눌 사람: 고른 목표가 있으면 그 사람, 없으면 yaw 쪽 ±cone 안에서 가장 가까운(가운데에 가까운) 사람
  function choose(far, yaw, cone, near = false) { // near = 방향보다 거리를 먼저 본다 (유도탄)
    const list = cands(far), L = lock && list.find((c) => c.id === lock);
    if (L) return L;
    let best = null, bs = Infinity;
    for (const c of list) {
      const off = Math.abs(turn(Math.atan2(c.dx, c.dz) - yaw));
      if (off > cone) continue;
      const sc = near ? c.dist + off * 0.3 : off + c.dist * 0.08;
      if (sc < bs) { bs = sc; best = c; }
    }
    return best;
  }
  const cone = () => (K.eye() ? 0.45 : 1.05);
  // 그 사람의 가슴을 향하는 방향 (소식에 실리는 소수 둘째 자리로 맞춘다)
  function aimAt(c) {
    const p = K.me.root.position, q = c.a.root.position, dy = q.y + 0.55 - (p.y + 0.78);
    return { yaw: Number(Math.atan2(c.dx, c.dz).toFixed(2)), pitch: Number(Math.max(-1.2, Math.min(1.2, Math.atan2(dy, c.dist))).toFixed(2)) };
  }
  function paintLock() {
    const on = !!lock && K.others().has(lock);
    lockBtn.setAttribute('aria-pressed', String(on));
    lockBtn.setAttribute('aria-label', on ? `목표: ${K.nameOf(lock)} (누르면 다음 사람)` : '목표 고르기 (T 키)');
  }
  // 목표를 차례로 바꾼다: 가까운 사람부터, 마지막 다음에는 푼다
  function cycle() {
    if (!K.show()) return false;
    const list = cands(LOCK_FAR), i = list.findIndex((c) => c.id === lock), next = i < 0 ? list[0] : list[i + 1];
    if (!list.length) { lock = null; K.toast('목표로 삼을 사람이 가까이에 없어요'); }
    else if (next) { lock = next.id; K.toast(`🎯 목표: ${K.nameOf(lock)}`); }
    else { lock = null; K.toast('목표를 풀었어요. 쏠 때 앞에 있는 사람을 스스로 겨눠요'); }
    paintLock(); autoAt = -9; K.dirty();
    return true;
  }
  // 화면에서 사람을 눌렀다: 그 사람을 목표로 (이미 목표면 푼다). 사람을 누른 것이 아니면 false
  function tap(x, y) {
    if (!K.show()) return false;
    let best = null, bd = 40;
    for (const c of cands(LOCK_FAR)) {
      const q = c.a.root.position, sc = K.screen(tp.set(q.x, q.y + 0.5, q.z)), dd = Math.hypot(sc.x - x, sc.y - y);
      if (dd < bd) { bd = dd; best = c; }
    }
    if (!best) return false;
    lock = lock === best.id ? null : best.id;
    K.toast(lock ? `🎯 목표: ${K.nameOf(lock)}` : '목표를 풀었어요');
    paintLock(); autoAt = -9; K.dirty();
    return true;
  }
  // 조준 표시: 네 귀퉁이 꺾쇠와 가운데 점 (목표의 가슴 높이에 띄운다. 벽에 가려도 보인다)
  function marker() {
    if (mark) return mark;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    g.strokeStyle = '#FF4A3D'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { g.beginPath(); g.moveTo(32 - sx * 26, 32 - sy * 12); g.lineTo(32 - sx * 26, 32 - sy * 26); g.lineTo(32 - sx * 12, 32 - sy * 26); g.stroke(); }
    g.fillStyle = '#FF4A3D'; g.beginPath(); g.arc(32, 32, 4, 0, Math.PI * 2); g.fill();
    mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, depthWrite: false }));
    mark.renderOrder = 9; mark.frustumCulled = false; mark.raycast = () => {}; mark.visible = false;
    K.scene.add(mark);
    return mark;
  }
  // 내 빛줄기가 어디까지 가는지: 사람·바닥·천장·벽·가구에 닿으면 거기까지. 사람에 닿았으면 hitId 에 그 사람
  function trace(yaw, pitch, far = MAX) {
    const me = K.me, lv = me.level, y0 = lv * FLOOR_H, sky = K.sky();
    o.copy(me.root.position); o.y += 0.78; dirOf(yaw, pitch, d);
    hitId = null;
    const ppl = [...K.others()].filter(([, a]) => target(a)), R2 = (BODY_R + 0.12) ** 2;
    for (let t = 0.4; t < far; t += 0.1) {
      e.copy(d).multiplyScalar(t).add(o);
      for (const [id, a] of ppl) {                                           // 사람
        const p = a.root.position, dx = e.x - p.x, dz = e.z - p.z;
        if (dx * dx + dz * dz < R2 && e.y > p.y - 0.05 && e.y < p.y + HEIGHT + 0.1) { hitId = id; return t; }
      }
      if (sky) { if (e.y < 0.05) return t; continue; }                       // 하늘에서는 땅에 닿을 때만
      if (e.y < y0 + 0.04) return t;
      const [i, j] = cellOf(e.x + lv * FLOOR_DX, e.z), zone = zoneOf(i, j);
      if (zone === null) { if (lv === 0 && e.z > Z0 + YARD.wall * CELL + CELL) continue; return t; } // 마당 밖은 뚫려 있다
      if (zone !== 'yard' && e.y > y0 + 2.5) return t;                       // 천장
      if (K.fixed(i, j)) return t;                                           // 벽·트리·나무
      if (!K.grid.free(i, j) && e.y - y0 < 1.15) return t;                   // 가구
    }
    return far;
  }
  function spawn(a, yaw, pitch, len) {
    const s = slot();
    if (!s) return false;
    Object.assign(s, { on: true, a, yaw, pitch, len, t: 0, burst: false, hit: len < MAX - 0.05 });
    for (let i = 0; i < SPARKS * 3; i++) s.col[i] = 0;
    s.pg.attributes.color.needsUpdate = true;
    a.aim = 0.5; a.aimP = pitch;
    a.turnTo(Math.sin(yaw), Math.cos(yaw));
    K.dirty();
    return true;
  }
  function fire() {
    if (!K.show() || clock - firedAt < COOL) return false;
    let { yaw, pitch } = K.dir();
    const c = choose(MAX + 0.5, yaw, cone()); // 목표(고른 사람이나 앞에 있는 사람)가 있으면 그 사람을 향해 쏜다
    if (c) ({ yaw, pitch } = aimAt(c));
    const len = Math.max(0.4, Math.round(trace(yaw, pitch) * 10) / 10);
    if (!spawn(K.me, yaw, pitch, len)) return false;
    firedAt = clock; count++; last = { yaw, pitch, len };
    sfx('beam');
    if (K.online()) K.fx({ k: 'beam', v: `${yaw.toFixed(2)};${pitch.toFixed(2)};${len.toFixed(1)}` });
    const v = hitId && K.others().get(hitId);
    if (v && v.knock(yaw)) { zaps++; K.dirty(); if (K.online()) K.fx({ k: 'zap', v: hitId }); } // 사람을 맞혔다: 그 사람이 쓰러진다
    return true;
  }

  /* ───────── 유도탄 ───────── */
  function mslot() {
    let s = mis.find((x) => !x.on);
    if (s) return s;
    if (mis.length >= M_MAX) return null;
    mats();
    const g = new THREE.Group(), rocket = new THREE.Group(), pg = new THREE.BufferGeometry();
    rocket.add(new THREE.Mesh(mBody, new THREE.MeshBasicMaterial({ color: 0xD23A30 })), new THREE.Mesh(mTip, new THREE.MeshBasicMaterial({ color: 0xF2C14E })));
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: 0xFFB060, transparent: true, depthWrite: false })); // 밝은 눈밭 위에서도 보이게 더하기 섞기를 쓰지 않는다
    const pos = new Float32Array(M_PTS * 3), col = new Float32Array(M_PTS * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(pg, sparkMat);
    for (const m of [...rocket.children, flame, pts]) { m.frustumCulled = false; m.raycast = () => {}; m.renderOrder = 4; }
    g.add(rocket, flame, pts); g.visible = false; K.scene.add(g);
    s = { on: false, g, rocket, flame, pts, pg, pos, col, vel: new Float32Array(M_PTS * 3), age: new Float32Array(M_PTS), p: new THREE.Vector3(), dir: new THREE.Vector3() };
    mis.push(s);
    return s;
  }
  // 유도탄 하나를 띄운다. tid = 따라갈 사람('' 이면 곧장 len 만큼), mine = 내가 쏜 것(맞혔는지를 내가 정한다)
  function launch(a, tid, yaw, pitch, len, mine) {
    const s = mslot();
    if (!s) return null;
    dirOf(yaw, tid ? Math.max(pitch, 0.5) : pitch, s.dir); // 따라가는 유도탄은 위로 솟았다가 꺾여 들어간다
    s.p.copy(a.root.position); s.p.y += 0.85; s.p.addScaledVector(s.dir, 0.3);
    Object.assign(s, { on: true, a, tid, mine, len, far: 0, t: 0, sp: M_V0, phase: 'fly', bt: 0, lv: a.level, sky: !!(a.fly && a.fly.air), way: null, wayAt: -9, victim: null, yaw, n: 0, pend: false });
    s.col.fill(0); s.age.fill(9); s.pg.attributes.color.needsUpdate = true;
    s.rocket.visible = true; s.flame.visible = true; s.flame.material.opacity = 0.95;
    a.aim = 0.5; a.aimP = pitch;
    a.turnTo(Math.sin(yaw), Math.cos(yaw));
    K.dirty();
    return s;
  }
  // 터진다. v = 맞은 사람(없으면 벽·바닥·허공). 내 유도탄이면 그 사람을 기절시키고 모두에게 알린다
  function explode(s, v) {
    s.phase = 'boom'; s.bt = 0; s.rocket.visible = false;
    for (let i = 0; i < M_PTS; i++) {
      s.pos[i * 3] = s.p.x; s.pos[i * 3 + 1] = s.p.y; s.pos[i * 3 + 2] = s.p.z; s.age[i] = 0;
      const u = Math.random() * 2 - 1, ph = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u), sp = 0.8 + Math.random() * 2.8;
      s.vel[i * 3] = q * Math.cos(ph) * sp; s.vel[i * 3 + 1] = u * sp + 0.9; s.vel[i * 3 + 2] = q * Math.sin(ph) * sp;
    }
    sfx('boom', s.mine ? null : { x: s.p.x + s.lv * FLOOR_DX, z: s.p.z, level: s.lv });
    if (v && (s.mine || s.pend)) stun(s, v);
    if (v && s.mine && K.online()) K.fx({ k: 'boom', v: s.tid });
    K.dirty();
  }
  // 맞은 사람이 STUN 동안 기절한다 (날거나 누워 있으면 쓰러지지 않는다)
  function stun(s, v, yaw = 0) {
    if (!v.knock(s ? Math.atan2(s.dir.x, s.dir.z) : yaw, STUN)) return false;
    hits++; if (s) s.victim = v;
    if (v === K.me) K.toast(`유도탄에 맞아 ${STUN}초 동안 기절했어요! 💫`);
    K.dirty();
    return true;
  }
  const kill = (s) => { s.on = false; s.g.visible = false; s.victim = null; K.dirty(); };
  function fireMissile() {
    if (!K.show()) return false;
    if (clock - mFiredAt < M_COOL) { K.toast(`유도탄을 채우는 중이에요 (${Math.ceil(M_COOL - (clock - mFiredAt))}초)`); return false; }
    let { yaw, pitch } = K.dir(), tid = '', len = 0;
    const c = choose(RANGE, yaw, Math.PI, true); // 고른 목표, 없으면 가장 가까운 사람 (어느 쪽에 있든)
    if (c) { ({ yaw, pitch } = aimAt(c)); tid = c.id; }
    else { yaw = Number(yaw.toFixed(2)); pitch = Number(pitch.toFixed(2)); len = Math.max(0.6, Math.round(trace(yaw, pitch, RANGE) * 10) / 10); }
    if (!launch(K.me, tid, yaw, pitch, len, true)) return false;
    mFiredAt = clock; mCount++; mLast = { tid, yaw, pitch, len };
    sfx('missile');
    if (K.online()) K.fx({ k: 'mis', v: `${tid};${yaw.toFixed(2)};${pitch.toFixed(2)};${len.toFixed(1)}` });
    if (!c && lock) K.toast('목표가 너무 멀거나 다른 층에 있어요. 앞으로 곧장 쐈어요');
    return true;
  }
  // 유도탄 하나를 dt 초 움직인다
  function stepMissile(s, dt) {
    s.t += dt;
    const a = s.a, gone = a !== K.me && ![...K.others().values()].includes(a);
    if (s.phase === 'fly') {
      if (gone || !a.parts) { kill(s); return; }
      const v = s.tid ? who(s.tid) : null, home = !!v && !!v.parts && v.level === s.lv, off = s.lv * FLOOR_DX, y0 = s.lv * FLOOR_H;
      let dist = Infinity;
      if (home) { // 목표를 따라간다. 집 안에서는 걸어가는 길의 꺾이는 점을 차례로 지난다 (0.25초마다 길을 다시 찾는다)
        tp.set(v.root.position.x, v.root.position.y + 0.55, v.root.position.z); aimPt.copy(tp);
        dist = tp.distanceTo(s.p);
        if (!s.sky) {
          if (s.t - s.wayAt > 0.25) { s.wayAt = s.t; s.way = K.grid.route(s.p.x + off, s.p.z, v.x, v.z); }
          const k = s.way ? s.way.findIndex(([x, z]) => Math.hypot(x - off - s.p.x, z - s.p.z) > 0.4) : -1;
          if (k >= 0 && k < s.way.length - 1) aimPt.set(s.way[k][0] - off, y0 + 0.95, s.way[k][1]);
        }
        want.copy(aimPt).sub(s.p).normalize();
        s.dir.lerp(want, Math.min(1, (4 + 10 * s.t) * dt)).normalize();
      }
      s.sp = Math.min(M_V1, s.sp + M_ACC * dt);
      const step = s.sp * dt;
      if (home && dist <= step + M_HIT) { s.p.copy(tp); explode(s, v); return; }
      s.p.addScaledVector(s.dir, step); s.far += step;
      let wall = false;
      if (!s.sky) {
        const [i, j] = cellOf(s.p.x + off, s.p.z), zone = zoneOf(i, j);
        if (zone !== null && zone !== 'yard' && s.p.y > y0 + 2.3) { s.p.y = y0 + 2.3; if (s.dir.y > 0) { s.dir.y = 0; s.dir.normalize(); } } // 천장 밑으로
        wall = zone === null ? !(s.lv === 0 && s.p.z > Z0 + YARD.wall * CELL + CELL) : K.fixed(i, j);
      }
      // 터지는 때: 바닥, 시간이 다 됨, 곧장 날아간 유도탄이 닿을 곳에 닿음, 따라갈 사람을 잃고 벽에 닿음 (따라가는 중에는 길을 따라가므로 벽을 보지 않는다)
      if (s.p.y < (s.sky ? 0 : y0) + 0.06 || s.t > M_LIFE || (!s.tid && s.far >= s.len) || (s.tid && !home && wall)) { explode(s, null); return; }
      s.rocket.position.copy(s.p); s.rocket.lookAt(e.copy(s.dir).add(s.p));
      e.copy(s.dir).multiplyScalar(-0.14).add(s.p);                            // 꼬리
      const fs = 0.2 + 0.07 * Math.sin(s.t * 60);
      s.flame.position.copy(e); s.flame.scale.set(fs, fs, 1);
      const n = s.n++ % M_PTS;                                                 // 연기 꼬리
      s.pos[n * 3] = e.x; s.pos[n * 3 + 1] = e.y; s.pos[n * 3 + 2] = e.z; s.age[n] = 0;
      for (let k = 0; k < 3; k++) s.vel[n * 3 + k] = (Math.random() - 0.5) * 0.4 - (k === 0 ? s.dir.x : k === 1 ? s.dir.y : s.dir.z) * 0.5;
      for (let i = 0; i < M_PTS; i++) {
        s.age[i] += dt;
        const f = Math.max(0, 1 - s.age[i] / 0.55);
        for (let k = 0; k < 3; k++) s.pos[i * 3 + k] += s.vel[i * 3 + k] * dt;
        s.col[i * 3] = f; s.col[i * 3 + 1] = 0.62 * f; s.col[i * 3 + 2] = 0.3 * f * f;
      }
    } else if (s.phase === 'boom') {
      s.bt += dt;
      const f = Math.max(0, 1 - s.bt / M_BOOM), gs = 0.5 + 2.4 * (1 - f * f);
      s.flame.position.copy(s.p); s.flame.scale.set(gs, gs, 1); s.flame.material.opacity = 0.95 * f;
      for (let i = 0; i < M_PTS; i++) {
        s.vel[i * 3 + 1] -= 2.6 * dt;
        for (let k = 0; k < 3; k++) s.pos[i * 3 + k] += s.vel[i * 3 + k] * dt;
        s.col[i * 3] = f; s.col[i * 3 + 1] = 0.8 * f * f; s.col[i * 3 + 2] = 0.35 * f * f * f;
      }
      if (s.bt >= M_BOOM) { // 다 터졌다: 맞은 사람이 기절해 있으면 머리 위에 별을 돌린다
        if (!s.victim || !(s.victim.down > 0.05)) { kill(s); return; }
        s.phase = 'stun'; s.flame.visible = false; s.col.fill(0);
      }
    } else { // 기절: 별 다섯 개가 빙글빙글
      const v = s.victim, there = v && (v === K.me || [...K.others().values()].includes(v));
      if (!there || !(v.down > 0.05)) { kill(s); return; }
      const q = v.root.position;
      for (let i = 0; i < 5; i++) {
        const an = s.t * 5 + i * Math.PI * 0.4;
        s.pos[i * 3] = q.x + Math.cos(an) * 0.3; s.pos[i * 3 + 1] = q.y + 0.62 + 0.05 * Math.sin(s.t * 7 + i); s.pos[i * 3 + 2] = q.z + Math.sin(an) * 0.3;
        s.col[i * 3] = 1; s.col[i * 3 + 1] = 0.88; s.col[i * 3 + 2] = 0.3;
      }
    }
    s.g.visible = true;
    s.pg.attributes.position.needsUpdate = true; s.pg.attributes.color.needsUpdate = true;
    K.dirty();
  }

  btn.addEventListener('click', fire);
  misBtn.addEventListener('click', fireMissile);
  lockBtn.addEventListener('click', cycle);
  addEventListener('keydown', (ev) => {
    if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement || btn.hidden) return;
    if (ev.code === 'KeyB') fire(); else if (ev.code === 'KeyM') fireMissile(); else if (ev.code === 'KeyT') cycle();
  });

  function tick(dt) {
    clock += dt;
    const show = K.show();
    if (btn.hidden === show) { btn.hidden = misBtn.hidden = lockBtn.hidden = !show; paintLock(); }
    if (show) misBtn.classList.toggle('wait', clock - mFiredAt < M_COOL);
    // 조준 표시: 고른 목표(진하게), 없으면 지금 쏘면 스스로 겨눌 사람(옅게)
    if (lock && !K.others().has(lock)) { lock = null; paintLock(); } // 목표가 방에서 나갔다
    if (show && clock - autoAt > 0.15) { autoAt = clock; const c = choose(MAX + 0.5, K.dir().yaw, cone()); auto = c ? c.id : null; }
    const ta = show ? K.others().get(lock || auto) : null, seen = !!ta && target(ta);
    if (mark || seen) {
      const m = marker();
      if (m.visible !== seen) { m.visible = seen; K.dirty(); }
      if (seen) {
        const q = ta.root.position, sc = (lock ? 0.62 : 0.5) * (1 + 0.08 * Math.sin(clock * 6));
        m.position.set(q.x, q.y + 0.55, q.z); m.scale.set(sc, sc, 1); m.material.opacity = lock ? 1 : 0.5;
        K.dirty();
      }
    }
    for (const s of mis) if (s.on) stepMissile(s, dt);
    for (const s of slots) {
      if (!s.on) continue;
      s.t += dt;
      const a = s.a, gone = a !== K.me && ![...K.others().values()].includes(a);
      if (s.t >= LIFE || gone || !a.parts) { s.on = false; s.g.visible = false; K.dirty(); continue; }
      s.g.visible = a === K.me || a.root.visible;
      palm(a, o); dirOf(s.yaw, s.pitch, d);
      const grow = Math.min(1, s.t / 0.07), fade = s.t < 0.3 ? 1 : Math.max(0, 1 - (s.t - 0.3) / 0.14), L = Math.max(0.01, s.len * grow);
      const r = 0.055 * fade * (0.85 + 0.15 * Math.sin(s.t * 70));
      s.ray.visible = fade > 0; s.ray.position.copy(o); s.ray.lookAt(e.copy(d).add(o)); s.ray.scale.set(Math.max(1e-4, r), Math.max(1e-4, r), L);
      e.copy(d).multiplyScalar(L).add(o);                                      // 빛줄기의 끝
      const gs = (0.28 + 0.5 * grow) * Math.max(0, 1 - s.t / LIFE);
      s.glow.position.copy(e); s.glow.scale.set(gs, gs, 1);
      if (!s.burst && grow >= 1) { // 닿은 곳에서 반짝이가 튄다
        s.burst = true;
        for (let i = 0; i < SPARKS; i++) {
          s.pos[i * 3] = e.x; s.pos[i * 3 + 1] = e.y; s.pos[i * 3 + 2] = e.z;
          const u = Math.random() * 2 - 1, ph = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u), sp = 0.6 + Math.random() * 1.5;
          s.vel[i * 3] = q * Math.cos(ph) * sp - d.x * 0.5; s.vel[i * 3 + 1] = u * sp + 0.6; s.vel[i * 3 + 2] = q * Math.sin(ph) * sp - d.z * 0.5;
        }
        if (s.hit) sfx('beamHit', a === K.me ? null : a);
      }
      if (s.burst) {
        const f = Math.max(0, 1 - (s.t - 0.07) / (LIFE - 0.07));
        for (let i = 0; i < SPARKS; i++) {
          s.vel[i * 3 + 1] -= 2.2 * dt;
          for (let k = 0; k < 3; k++) s.pos[i * 3 + k] += s.vel[i * 3 + k] * dt;
          const w = f * (i % 3 ? 1 : 0.7); s.col[i * 3] = (i % 2 ? 0.75 : 1) * w; s.col[i * 3 + 1] = 0.95 * w; s.col[i * 3 + 2] = w;
        }
        s.pg.attributes.position.needsUpdate = true; s.pg.attributes.color.needsUpdate = true;
      }
      K.dirty();
    }
  }
  const api = {
    tick, fire, tap,
    // 누가 빛줄기를 쐈다는 소식. 비행 슈트를 입은 사람 것만, 너무 잦지 않게 받는다
    peerFx(m, id) {
      if (m.k === 'zap') return zap(m, id);
      if (m.k === 'mis') return peerMissile(m, id);
      if (m.k === 'boom') return peerBoom(m, id);
      const a = K.others().get(id), x = typeof m.v === 'string' ? RE.exec(m.v) : null;
      if (!a || !x) return false;
      const yaw = Number(x[1]), pitch = Number(x[2]), len = Number(x[3]);
      if (Math.abs(yaw) > 3.15 || Math.abs(pitch) > 1.3 || !(len >= 0.4 && len <= MAX) || a.look.outfit !== HOST_OUTFIT || a.rest || a.hop) return false;
      if (clock - (lastOf.get(a) ?? -9) < COOL * 0.6) return false;
      lastOf.set(a, clock);
      if (!spawn(a, yaw, pitch, len)) return false;
      shotOf.set(a, { t: clock, yaw });
      sfx('beam', a);
      return true;
    },
  };
  // 친구의 빛줄기가 누군가(나일 수도)를 맞혔다는 소식. 방금 받은 그 사람의 빛줄기가 있어야 한다
  function zap(m, id) {
    const a = K.others().get(id), shot = a && shotOf.get(a);
    if (!a || !shot || clock - shot.t > 1.5 || typeof m.v !== 'string' || m.v === id || !/^[a-z0-9]{1,8}$/.test(m.v)) return false;
    shotOf.delete(a); // 한 번 쏜 빛줄기로 한 사람만
    const mine = m.v === K.myId(), v = mine ? K.me : K.others().get(m.v);
    if (!v) return true; // 내가 모르는 사람이어도 다른 사람에게는 전한다
    if (v.knock(shot.yaw)) { zaps++; K.dirty(); if (mine) K.toast('빔에 맞아 쓰러졌어요! 💫'); }
    return true;
  }
  // 친구가 유도탄을 쐈다는 소식. 비행 슈트를 입은 사람 것만, M_COOL 보다 잦지 않게 받는다
  function peerMissile(m, id) {
    const a = K.others().get(id), x = typeof m.v === 'string' && m.v.length <= 26 ? M_RE.exec(m.v) : null;
    if (!a || !x) return false;
    const tid = x[1], yaw = Number(x[2]), pitch = Number(x[3]), len = Number(x[4]);
    if (Math.abs(yaw) > 3.15 || Math.abs(pitch) > 1.3 || len > RANGE || (!tid && len < 0.6) || tid === id || a.look.outfit !== HOST_OUTFIT || a.rest || a.hop) return false;
    if (clock - (mLastOf.get(a) ?? -9) < M_COOL * 0.6) return false;
    mLastOf.set(a, clock);
    mShot.set(a, { t: clock, tid });
    launch(a, tid, yaw, pitch, len, false); // 그릴 자리가 없어도 소식은 받는다 (맞았다는 소식이 뒤따른다)
    sfx('missile', a);
    if (tid && tid === K.myId()) K.toast('🚨 유도탄이 나를 따라와요!');
    return true;
  }
  // 친구의 유도탄이 목표에 닿았다는 소식. 방금 받은 그 사람의 유도탄이 그 목표를 따라가던 것이어야 한다
  function peerBoom(m, id) {
    const a = K.others().get(id), shot = a && mShot.get(a);
    if (!a || !shot || clock - shot.t > M_LIFE + 1.5 || typeof m.v !== 'string' || !m.v || m.v !== shot.tid) return false;
    mShot.delete(a); // 유도탄 하나에 한 번만
    const v = who(m.v), s = mis.find((x) => x.on && x.a === a && !x.mine && x.tid === m.v && !x.victim);
    if (!v) return true; // 내가 모르는 사람이어도 다른 사람에게는 전한다
    if (s && s.phase === 'fly') { s.pend = true; s.p.set(v.root.position.x, v.root.position.y + 0.55, v.root.position.z); explode(s, v); } // 내 화면에서는 아직 날아가는 중이었다: 바로 터뜨린다
    else stun(s || null, v, Math.atan2(v.root.position.x - a.root.position.x, v.root.position.z - a.root.position.z));
    return true;
  }
  // 자동 검사가 쓰는 창구
  window.__missile = {
    fire: fireMissile, cycle, tap, RANGE, STUN, COOL: M_COOL, get shown() { return !misBtn.hidden; }, get lockShown() { return !lockBtn.hidden; },
    get lock() { return lock; }, set lock(v) { lock = v; paintLock(); }, get auto() { return auto; }, get mark() { return !!mark && mark.visible ? { x: mark.position.x, y: mark.position.y, z: mark.position.z, strong: mark.material.opacity > 0.9 } : null; },
    get count() { return mCount; }, get last() { return mLast; }, get hits() { return hits; }, get made() { return mis.length; },
    get active() { return mis.filter((s) => s.on).map((s) => ({ mine: s.mine, tid: s.tid, phase: s.phase, t: s.t, far: s.far, x: s.p.x, y: s.p.y, z: s.p.z, seen: s.g.visible, way: s.way ? s.way.length : 0 })); },
    ready() { mFiredAt = -9; }, // 채우는 시간을 건너뛴다
  };
  window.__beam = {
    fire, MAX, get shown() { return !btn.hidden; }, get count() { return count; }, get last() { return last; },
    get active() { return slots.filter((s) => s.on).map((s) => ({ mine: s.a === K.me, len: s.len, hit: s.hit, yaw: s.yaw, pitch: s.pitch, t: s.t, seen: s.g.visible, burst: s.burst })); },
    get made() { return slots.length; }, get zaps() { return zaps; }, get hitId() { return hitId; },
  };
  return api;
}
