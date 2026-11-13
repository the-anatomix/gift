// 마당 눈싸움. 마당에 있을 때 "❄️ 눈덩이" 단추로 눈싸움 모드를 켜고, 마당을 누르면 그쪽으로 눈덩이를 던진다(PC 는 F 키로 바라보는 쪽).
// 눈덩이는 손 높이에서 포물선으로 날아가 누른 자리(멀면 MAX_D 까지)에 떨어지고 눈이 퍽 흩어진다.
// 친구에게는 놀이 소식으로 전한다: { k: 'snow', v: 'x,z' }(떨어질 자리), { k: 'hit', v: 맞은 사람 id }.
// 맞았는지는 던진 사람 화면에서만 정한다(날아가는 길에 마당에 선 사람이 HIT_R 안에 들어오면). 집 안·2층 사람은 맞지 않는다.
// app.js 가 넘겨주는 창구 K 로 아바타·카메라·소식을 다룬다.
// 눈싸움 팀전(snowteam.js)과 눈사람 같이 만들기(snowman.js)도 여기서 만들어 잇는다. 눈 굴리기와 눈덩이 던지기는 같이 켜지지 않는다.
import { THREE, M } from './kit.js';
import { makeTeam } from './snowteam.js';
import { makeSnowman } from './snowman.js';
import { sfx } from './sfx.js';
import { X0, X1, GZ1, cellOf, zoneOf, levelOf } from './path.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const MAX_D = 6;        // 가장 멀리 던지는 거리
export const HIT_R = 0.35;     // 맞는 몸 반지름
export const WALL_Z = 5.2;     // 집 남쪽 벽: 눈덩이는 이 선을 넘지 않는다
const GAP = 0.6;               // 다시 던질 수 있을 때까지(초)
const SNOWY = 4;               // 맞은 사람이 눈을 뒤집어쓰고 있는 시간(초)
const BALL_R = 0.07, BODY_TOP = 1.6;
const OK_MODES = [null, 'chat', 'duo', 'emo']; // 눈싸움 모드를 켜 둘 수 있는 화면 (가구·트리·벽바닥·캐릭터·놀이·문 앞에서는 꺼진다)
const okId = (v) => typeof v === 'string' && /^[a-z0-9]{1,8}$/.test(v);

export function makeSnow(K) {
  let on = false, last = -9, clock = 0, hits = 0, sinceUi = 1;
  const balls = [];          // 날아가는 눈덩이 { m, from, to, T, H, t, who(던진 사람 id, 나는 'me'), mine }
  const puffs = [];          // 흩어지는 눈 { g, t, parts: [{ m, v }], disc }
  const snowy = new Map();   // 아바타 → 눈을 털어 낼 시각 (실제 시각, 느린 기기에서도 몇 초 뒤면 털어 낸다)
  const swing = new Map();   // 아바타 → 던지는 몸짓을 시작한 시각
  const ballGeo = new THREE.SphereGeometry(BALL_R, 12, 9), bitGeo = new THREE.SphereGeometry(0.035, 6, 5), discGeo = new THREE.CircleGeometry(0.28, 16);
  const white = M(0xFFFFFF), discMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.85, depthWrite: false });

  /* ───────── 단추와 맞힌 횟수 ───────── */
  const css = document.createElement('style');
  css.textContent = '#snowBtn{position:absolute;right:10px;bottom:130px;z-index:3;width:58px;height:58px;padding:0;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;'
    + 'font-size:11px;font-weight:800;line-height:1.1;box-shadow:0 4px 14px rgba(60,30,10,.28)}#snowBtn b{font-size:21px;line-height:1}'
    + '#snowBtn[aria-pressed=true]{background:#5B8FD6;border-color:#5B8FD6;color:#fff}'
    + '#snowScore{position:absolute;right:10px;bottom:196px;z-index:3;padding:4px 10px;border-radius:12px;background:rgba(255,252,245,.92);color:#5A3824;font-size:12px;font-weight:800;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.2)}';
  document.head.appendChild(css);
  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'snowBtn'; btn.className = 'btn'; btn.hidden = true;
  btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', '눈싸움 모드');
  btn.innerHTML = '<b>❄️</b>눈덩이';
  const score = document.createElement('div');
  score.id = 'snowScore'; score.hidden = true;
  document.body.append(btn, score);
  btn.addEventListener('click', () => setOn(!on));

  const inYard = () => { const me = K.me; if (me.hop || me.rest || levelOf(me.x)) return false; const [i, j] = cellOf(me.x, me.z); return zoneOf(i, j) === 'yard'; };
  const allowed = () => OK_MODES.includes(K.mode()) && !K.ghost() && inYard();
  function setOn(v) {
    v = !!v && allowed();
    if (v === on) return on;
    on = v;
    if (on) man.off(); // 눈 굴리기를 끈다
    if (on) K.toast(K.eye() ? '눈싸움! 누른 쪽으로 눈덩이를 던져요 (F 키는 화면 가운데로)' : '눈싸움! 마당을 누르면 그쪽으로 눈덩이를 던져요');
    paint();
    return on;
  }
  // 단추 자리: 아래 판 바로 위, 오른쪽 끝 (가운데 #act 단추와 겹치지 않는다)
  const baseY = () => { const b = $('bottom'); return (b ? window.innerHeight - b.getBoundingClientRect().top : 122) + 8; };
  function paint() {
    const show = allowed();
    btn.hidden = !show; score.hidden = !show || (!on && !hits);
    btn.setAttribute('aria-pressed', String(on));
    if (show) {
      const base = baseY();
      btn.style.bottom = base + 'px'; score.style.bottom = (base + 64) + 'px';
      score.textContent = `❄️ 명중 ${hits}`;
    }
  }

  /* ───────── 던지기 ───────── */
  // 아바타 a 의 오른손 자리 (세상 좌표). 마당은 1층이라 격자 자리가 곧 세상 자리다
  function handOf(a) {
    const f = a.face, p = a.root.position, lx = -0.2, lz = 0.12;
    return [p.x + lx * Math.cos(f) + lz * Math.sin(f), p.y + 1.15, p.z - lx * Math.sin(f) + lz * Math.cos(f)];
  }
  // 던질 자리를 다듬는다: 가장 멀리 MAX_D, 마당 밖으로 나가지 않고, 집 벽을 넘지 않는다
  function aimFrom(x, z, tx, tz) {
    let dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
    if (d < 0.25) { const f = K.me.face; dx = Math.sin(f); dz = Math.cos(f); d = 1.2; tx = x + dx * d; tz = z + dz * d; }
    if (d > MAX_D) { tx = x + dx / d * MAX_D; tz = z + dz / d * MAX_D; }
    if (tz < WALL_Z && z > WALL_Z) { const k = (WALL_Z - z) / (tz - z); tx = x + (tx - x) * k; tz = WALL_Z; } // 벽에 부딪혀 떨어진다
    return [clamp(tx, X0 + 0.05, X1 - 0.05), clamp(tz, WALL_Z, GZ1 - 0.05)];
  }
  function launch(a, who, to, mine) {
    const from = handOf(a), d = Math.hypot(to[0] - from[0], to[1] - from[2]);
    sfx('snowThrow', mine ? null : a);
    const m = new THREE.Mesh(ballGeo, white);
    m.castShadow = true; m.position.set(from[0], from[1], from[2]);
    K.scene.add(m);
    balls.push({ m, from, to: [to[0], BALL_R, to[1]], T: 0.32 + 0.07 * d, H: 0.45 + 0.12 * d, t: 0, who, mine });
    swing.set(a, clock);
    a.turnTo(to[0] - a.x, to[1] - a.z);
  }
  // 내가 (tx, tz) 쪽으로 던진다. 던졌으면 true
  function throwAt(tx, tz) {
    if (!allowed() || clock - last < GAP) return false;
    if (typeof tx !== 'number' || typeof tz !== 'number' || !isFinite(tx) || !isFinite(tz)) return false;
    const me = K.me, to = aimFrom(me.x, me.z, tx, tz);
    last = clock;
    me.stop(); me.onArrive = null;
    me.turnTo(to[0] - me.x, to[1] - me.z);
    launch(me, 'me', to, true);
    K.fx({ k: 'snow', v: to[0].toFixed(2) + ',' + to[1].toFixed(2) });
    K.dirty();
    return true;
  }
  // 화면의 한 점 쪽으로: 바닥을 가리키면 그 자리, 하늘을 가리키면(1인칭) 그 방향으로 가장 멀리
  function throwToScreen(px, py) {
    const r = K.ray(px, py), me = K.me;
    if (r.direction.y < -1e-4) {
      const k = -r.origin.y / r.direction.y;
      if (k > 0) return throwAt(r.origin.x + r.direction.x * k, r.origin.z + r.direction.z * k);
    }
    const h = Math.hypot(r.direction.x, r.direction.z) || 1;
    return throwAt(me.x + r.direction.x / h * MAX_D, me.z + r.direction.z / h * MAX_D);
  }
  // F 키: 1인칭이면 화면 가운데 쪽, 아니면 아바타가 바라보는 쪽으로
  function throwAhead() {
    if (K.eye()) {
      const t = $('top'), b = $('bottom'), y0 = t ? t.getBoundingClientRect().bottom : 0, y1 = b ? b.getBoundingClientRect().top : window.innerHeight;
      return throwToScreen(window.innerWidth / 2, (y0 + y1) / 2);
    }
    const me = K.me;
    return throwAt(me.x + Math.sin(me.face) * 4.5, me.z + Math.cos(me.face) * 4.5);
  }
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyF' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (throwAhead()) e.preventDefault();
  });

  /* ───────── 떨어진 자리, 맞은 모습 ───────── */
  function puff(x, y, z) {
    const g = new THREE.Group(), parts = [];
    g.position.set(x, y, z);
    for (let k = 0; k < 12; k++) {
      const m = new THREE.Mesh(bitGeo, white), a = k / 12 * Math.PI * 2 + Math.random() * 0.4, s = 0.8 + Math.random() * 0.9;
      g.add(m); parts.push({ m, v: [Math.cos(a) * s, 1.2 + Math.random() * 1.3, Math.sin(a) * s] });
    }
    let disc = null;
    if (y < 0.2) { disc = new THREE.Mesh(discGeo, discMat.clone()); disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.025, z); K.scene.add(disc); }
    K.scene.add(g);
    puffs.push({ g, t: 0, parts, disc });
  }
  function land(b, at) {
    const p = at || b.m.position;
    sfx('snowHit', b.mine ? null : p);
    puff(p.x, Math.max(0, p.y - BALL_R), p.z);
    K.scene.remove(b.m);
    balls.splice(balls.indexOf(b), 1);
  }
  const avatarOf = (id) => (id === 'me' || id === K.myId() ? K.me : K.others().get(id));
  function cover(a) { snowy.set(a, performance.now() + SNOWY * 1000); a.snowed(true); K.dirty(); }
  // 마당에 서 있어서 맞을 수 있는 사람인지
  function inYardA(a) { if (a.hop || levelOf(a.x)) return false; const [i, j] = cellOf(a.x, a.z); return zoneOf(i, j) === 'yard'; }

  /* ───────── 친구에게서 온 소식 ───────── */
  // 받아들였으면 true (방장은 그때만 다른 사람에게 전한다)
  function peerFx(m, id) {
    if (m.k === 'snow') {
      const a = K.others().get(id), p = typeof m.v === 'string' ? m.v.split(',').map(Number) : [];
      if (!a || p.length !== 2 || !p.every(isFinite)) return false;
      if (p[0] < X0 - 0.1 || p[0] > X1 + 0.1 || p[1] < WALL_Z - 0.01 || p[1] > GZ1 + 0.1) return false;
      launch(a, id, p, false);
      K.dirty();
      return true;
    }
    if (m.k === 'hit') {
      if (!okId(m.v) || m.v === id) return false;
      const v = m.v === K.myId() ? K.me : K.others().get(m.v);
      if (!v) return false;
      // 그 사람이 던진 눈덩이가 아직 날아가고 있으면 맞은 사람에게서 터진다
      const b = balls.find((x) => x.who === id);
      if (b) land(b, new THREE.Vector3(v.root.position.x, v.root.position.y + 1.2, v.root.position.z));
      cover(v);
      const said = team.hit(id, m.v); // 팀전이면 점수를 센다
      if (v === K.me) K.toast(said === '같은 팀이에요! 점수는 없어요' ? '같은 팀 눈덩이에 맞았어요! ☃️' : '눈덩이에 맞았어요! ☃️');
      return true;
    }
    if (m.k === 'team') return team.peerFx(m, id);                       // 팀전
    if (m.k === 'ball' || m.k === 'made') return man.peerFx(m, id);     // 눈사람
    return false;
  }

  /* ───────── 매 장면 ───────── */
  function tick(dt) {
    clock += dt;
    team.tick(); man.tick(dt);
    if (on && !allowed()) { on = false; paint(); }
    sinceUi += dt;
    if (sinceUi > 0.2) { sinceUi = 0; paint(); }
    for (const b of balls.slice()) {
      b.t += dt;
      const e = Math.min(1, b.t / b.T), f = b.from, to = b.to;
      b.m.position.set(f[0] + (to[0] - f[0]) * e, f[1] + (to[1] - f[1]) * e + 4 * b.H * e * (1 - e), f[2] + (to[2] - f[2]) * e);
      if (b.mine && b.t > 0.05) { // 내가 던진 것만 맞았는지 본다
        const p = b.m.position;
        let hitId = null;
        if (p.y < BODY_TOP) for (const [id, a] of K.others()) if (inYardA(a) && Math.hypot(p.x - a.x, p.z - a.z) < HIT_R) { hitId = id; break; }
        if (hitId) {
          land(b); hits++;
          cover(K.others().get(hitId));
          K.fx({ k: 'hit', v: hitId });
          K.toast(team.hit(K.myId(), hitId) || '명중! ❄️'); // 팀전이면 점수를 센다
          paint();
          continue;
        }
      }
      if (e >= 1) land(b);
    }
    for (let k = puffs.length - 1; k >= 0; k--) {
      const p = puffs[k];
      p.t += dt;
      const s = Math.max(0.01, 1 - p.t / 0.7);
      for (const q of p.parts) { q.v[1] -= 9 * dt; q.m.position.x += q.v[0] * dt; q.m.position.z += q.v[2] * dt; q.m.position.y = Math.max(-p.g.position.y, q.m.position.y + q.v[1] * dt); q.m.scale.setScalar(s); }
      if (p.disc) { const u = clamp(p.t / 0.15, 0, 1); p.disc.scale.setScalar(0.3 + 0.7 * u); p.disc.material.opacity = 0.85 * clamp((2.2 - p.t) / 0.8, 0, 1); }
      if (p.t > 2.2) { K.scene.remove(p.g); if (p.disc) { K.scene.remove(p.disc); p.disc.material.dispose(); } puffs.splice(k, 1); }
    }
    // 던지는 몸짓: 오른팔을 머리 위로 들었다가 앞으로 휘두른다 (걷는 몸짓 위에 덮어쓴다)
    for (const [a, t0] of swing) {
      const t = clock - t0, live = a === K.me || [...K.others().values()].includes(a);
      if (t > 0.45 || !live || !a.parts) { swing.delete(a); continue; }
      const u = t / 0.45, arm = a.parts.arms[0];
      arm.rotation.x = u < 0.4 ? -2.9 * (u / 0.4) : -2.9 + 2.0 * ((u - 0.4) / 0.6);
      arm.rotation.z = -0.15; arm.scale.y = 1.2;
      K.dirty();
    }
    // 눈을 뒤집어쓴 사람: 시간이 지나면 털어 낸다 (생김새를 바꿨으면 새 몸에 다시 얹는다)
    for (const [a, until] of snowy) {
      const live = a === K.me || [...K.others().values()].includes(a);
      if (!live || performance.now() > until) { a.snowed(false); snowy.delete(a); K.dirty(); } else a.snowed(true);
    }
  }

  // 팀전과 눈사람
  const team = makeTeam(K, { on: () => on, setOn: (v) => setOn(v), shown: () => allowed(), base: baseY, eye: () => K.eye() });
  const man = makeSnowman(K, { snowOff: () => setOn(false), base: baseY, eye: () => K.eye() });

  const api = {
    // 눈싸움 모드에서 화면을 눌렀을 때: 던졌거나 던지려 했으면 true (걸어가지 않는다)
    tap(px, py) { if (!on || !allowed()) return false; throwToScreen(px, py); return true; },
    peerFx, tick,
    get on() { return on; },
  };
  // 자동 검사가 쓰는 창구
  window.__snow = {
    get on() { return on; }, set: (v) => setOn(v), get hits() { return hits; }, get balls() { return balls.length; }, get puffs() { return puffs.length; },
    get shown() { return !btn.hidden; }, get yard() { return inYard(); }, get ready() { return clock - last >= GAP; },
    throwAt, throwAhead, throwToScreen, team: team.test, man: man.test,
    snowy: (id) => { const a = avatarOf(id); return !!(a && a.snowy); },
    flying: () => balls.map((b) => ({ who: b.who, x: b.m.position.x, y: b.m.position.y, z: b.m.position.z, to: b.to })),
    arm: (id) => { const a = avatarOf(id); return a && a.parts ? a.parts.arms[0].rotation.x : null; },
  };
  return api;
}
