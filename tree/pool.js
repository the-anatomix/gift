// 당구: 4층 게임방의 당구대(gameroom.js 의 모양)에서 친다. 공과 큐가 3D 당구대 위에 올라가고, 화면은 당구대를 내려다본다.
//
// 놀이
//   - 당구대 앞에서 "🎱 당구 치기"를 누르면 그 당구대에 앉는다(같은 당구대를 연 사람끼리 한 판을 같이 친다. 혼자면 혼자).
//   - 내 차례면 당구대를 누른 채 뒤로 끌었다 놓는다(새총처럼: 끈 반대쪽으로, 많이 끌수록 세게). ↺ ↻ 로 방향을 돌리고 "치기"로도 친다.
//   - 색 공을 넣으면 1점이고 한 번 더 친다. 못 넣거나 흰 공이 빠지면 다음 사람 차례. 색 공 6개가 다 들어가면 끝, 점수가 높은 사람이 이긴다.
//   - 혼자 치면 몇 번 만에 다 넣었는지가 점수다(6번 = 100점, 한 번 더 칠 때마다 10점씩 빠진다. BEST.pool 이 방 기록·이름별 순위에 남는다).
//   - 놀이에 끼지 않은 사람도 그 당구대 위로 공이 굴러가는 것을 본다.
// 동기화: 놀이 소식 { k: 'pool', v } (길어서 app.js 의 20자 검사보다 먼저 받는다)
//   'J|당구대' 앉았다, 'L|당구대' 일어났다, 'S|당구대|번호|방향|세기' 쳤다(지금 차례인 사람만),
//   'T|당구대|번호|사람들|차례|공|점수|단계|친 횟수' 한 판의 모든 것. 친 사람이 공이 다 멈춘 뒤에 보내고, 모두 그대로 맞춘다(그동안은 저마다 굴려 보인다).
//   새로 앉은 사람이 있으면 맨 앞 사람(판장)이 사람들에 넣어 T 를 보낸다. 같은 번호면 맨 앞 사람 id 가 작은 쪽을 따른다.
import { THREE, put, cyl } from './kit.js';
import { sfx } from './sfx.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 판 좌표: 당구대 천(가로 1.72 × 세로 0.76)을 300 × 133 으로 본다. 당구대 기준 자리 = ((x - 150) × U, 높이 Y, (y - 66.5) × U)
export const P = { w: 300, h: 133, r: 4.9, pocket: 10, max: 560, drag: 95, step: 1 / 240 };
const U = 1.72 / P.w, Y = 0.553;
const POCKETS = [[2, 2], [P.w / 2, 0], [P.w - 2, 2], [2, P.h - 2], [P.w / 2, P.h], [P.w - 2, P.h - 2]];
const CUE0 = [P.w * 0.25, P.h / 2];
const COLS = [0xFFFFFF, 0xD9483B, 0xF2B544, 0x3E7CB8, 0x7A4FB8, 0x2B2A28, 0xE8776A];
const NAME_OF = ['흰 공', '빨강', '노랑', '파랑', '보라', '검정', '주황'];
const okId = (v) => typeof v === 'string' && /^[a-z0-9]{1,8}$/.test(v);
const okItem = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(v);
const r1 = (v) => Math.round(v * 10) / 10;

function rack() { // 처음 자리: 흰 공과, 세모로 모인 색 공 여섯
  const R = P.r * 2 + 0.6, x0 = P.w * 0.68, y0 = P.h / 2, b = [{ x: CUE0[0], y: CUE0[1], vx: 0, vy: 0, in: false }];
  for (let row = 0; row < 3; row++) for (let n = 0; n <= row; n++) b.push({ x: x0 + row * R * 0.87, y: y0 + (n - row / 2) * R, vx: 0, vy: 0, in: false });
  return b;
}

// K = { play, S(), itemObj(id), myId(), others(): Map, nameOf(id), online(), fx(m), close(), setPose(p), planeAt(px, py, y) → THREE.Vector3 | null, cam(), record(k, v), bestLine(k), dirty() }
export function makePool(K) {
  const tables = new Map(); // 당구대 id → 한 판 { id, seq, players, turn, pts, balls, phase('aim'|'roll'|'wait'|'over'), shots, shooter, before, scratch, mesh, acc }
  let cur = null;           // 내가 앉은 당구대의 놀이 (play.js 의 c)
  let pull = null, aimAng = 0, pow = 0, gauge = 0, joinAt = -9, clock = 0;
  const me = () => K.myId();
  const v3 = new THREE.Vector3();

  // 세기 막대 (판 위에 붙는 작은 막대. 끌 때는 끈 만큼, 아니면 "치기" 단추의 세기가 오르내린다)
  const bar = document.createElement('div'); bar.id = 'poolBar'; bar.hidden = true;
  bar.style.cssText = 'height:10px;border-radius:6px;background:rgba(60,30,10,.18);overflow:hidden;margin:2px 0 6px;flex:none';
  const fill = document.createElement('div'); fill.style.cssText = 'height:100%;width:0;background:#E8776A;border-radius:6px';
  bar.appendChild(fill);
  document.getElementById('playBtns').parentNode.insertBefore(bar, document.getElementById('playBtns'));

  function fresh(id, players) { return { id, seq: 0, players, turn: 0, pts: Object.fromEntries(players.map((p) => [p, 0])), balls: rack(), phase: 'aim', shots: 0, shooter: null, before: 0, scratch: false, mesh: null, acc: 0 }; }
  const sunk = (t) => t.balls.slice(1).filter((b) => b.in).length;
  const turnId = (t) => t.players[t.turn % Math.max(1, t.players.length)];
  const myTurn = (t) => !!t && t.phase === 'aim' && turnId(t) === me();
  const send = (v) => { if (K.online()) K.fx({ k: 'pool', v }); };
  function encode(t) {
    const balls = t.balls.map((b) => (b.in ? 'i' : `${r1(b.x)}:${r1(b.y)}`)).join(',');
    const pts = t.players.map((p) => t.pts[p] || 0).join(',');
    return `T|${t.id}|${t.seq}|${t.players.join(',')}|${t.turn}|${balls}|${pts}|${t.phase === 'over' ? 'over' : 'aim'}|${t.shots}`;
  }
  const tell = (t) => send(encode(t));

  /* ───────── 굴리기 (정해진 짧은 걸음으로: 누구 화면에서나 거의 같게 굴러간다) ───────── */
  function stepBalls(t) {
    const B = t.balls, R = P.r, h = P.step, src = cur && cur.id === t.id ? null : K.itemObj(t.id) || null; // 남의 당구대 소리는 멀면 작게
    for (const b of B) {
      if (b.in) continue;
      b.x += b.vx * h; b.y += b.vy * h;
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > 0) { const k = Math.max(0, sp - (70 + sp * 0.9) * h) / sp; b.vx *= k; b.vy *= k; if (sp * k < 4) { b.vx = 0; b.vy = 0; } } // 천의 마찰
      for (const [px, py] of POCKETS) {
        const dx = b.x - px, dy = b.y - py;
        if (dx * dx + dy * dy < P.pocket * P.pocket) { b.in = true; b.vx = b.vy = 0; if (b === B[0]) t.scratch = true; sfx(b === B[0] ? 'wipe' : 'top', src); break; }
      }
      if (b.in) continue;
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.78; } if (b.x > P.w - R) { b.x = P.w - R; b.vx = -Math.abs(b.vx) * 0.78; } // 쿠션
      if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * 0.78; } if (b.y > P.h - R) { b.y = P.h - R; b.vy = -Math.abs(b.vy) * 0.78; }
    }
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { // 공끼리 (같은 무게, 거의 탄성)
      const a = B[i], b = B[j];
      if (a.in || b.in) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy;
      if (dd >= 4 * R * R || dd < 1e-12) continue;
      const d = Math.sqrt(dd), nx = dx / d, ny = dy / d, o = (2 * R - d) / 2;
      a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel > 0) { const k = rel * 0.96; a.vx -= k * nx; a.vy -= k * ny; b.vx += k * nx; b.vy += k * ny; if (rel > 40) sfx('clack', src); }
    }
    return B.every((b) => b.in || (b.vx === 0 && b.vy === 0));
  }
  function shoot(t, ang, p) { // 흰 공을 친다 (누가 쳤든 저마다 굴린다)
    const q = t.balls[0], v = P.max * (0.18 + 0.82 * clamp(p, 0, 1));
    q.vx = Math.cos(ang) * v; q.vy = Math.sin(ang) * v;
    t.phase = 'roll'; t.before = sunk(t); t.scratch = false; t.acc = 0;
    sfx('dartHit', cur && cur.id === t.id ? null : K.itemObj(t.id) || null);
  }
  // 공이 다 멈췄다: 친 사람이 점수와 차례를 정해 모두에게 알린다. 다른 사람은 그 소식(T)을 기다린다
  function settle(t) {
    const q = t.balls[0];
    if (t.shooter !== me()) { t.phase = 'wait'; return; }
    const got = sunk(t) - t.before;
    t.shots++;
    t.pts[me()] = (t.pts[me()] || 0) + got;
    if (q.in) { q.in = false; q.x = CUE0[0]; q.y = CUE0[1]; for (const b of t.balls) if (b !== q && !b.in && Math.hypot(b.x - q.x, b.y - q.y) < 2 * P.r) q.y += 3 * P.r; } // 흰 공이 빠지면 처음 자리로
    if (t.scratch || !got) t.turn = (t.turn + 1) % t.players.length;
    t.say = t.scratch ? '흰 공이 빠졌어요! 다음 사람 차례' : got > 1 ? `한 번에 ${got}개! 👏 한 번 더` : got ? '들어갔다! 👍 한 번 더' : '';
    t.seq++;
    t.phase = sunk(t) >= 6 ? 'over' : 'aim';
    if (t.phase === 'over') finish(t);
    tell(t);
    paint();
  }
  function finish(t) {
    sfx('ovenDing');
    if (t.players.length === 1 && t.players[0] === me()) K.record('pool', clamp(100 - (t.shots - 6) * 10, 10, 100));
  }
  const soloScore = (t) => clamp(100 - (t.shots - 6) * 10, 10, 100);

  /* ───────── 당구대 위의 공과 큐 ───────── */
  let geo = null;
  const mats = COLS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.05 }));
  function meshOf(t) {
    const g = K.itemObj(t.id);
    if (!g) return null;
    let m = t.mesh;
    if (m && m.parent !== g) { if (m.root.parent) m.root.parent.remove(m.root); g.add(m.root); m.parent = g; } // 당구대를 옮겨 새로 지었으면 새 모양에 올린다
    if (m) return m;
    if (!geo) geo = new THREE.SphereGeometry(P.r * U, 14, 10);
    const root = new THREE.Group();
    const balls = COLS.map((_, k) => { const s = new THREE.Mesh(geo, mats[k]); s.castShadow = true; root.add(s); return s; });
    const cue = new THREE.Group(); // 큐: 흰 공 뒤에서 당겨진다 (내 차례일 때 내 화면에만)
    const stick = put(cyl(0.007, 0.012, 1.05, 8), 0xD9B382, 0, 0, 0, cue, false); stick.rotation.z = Math.PI / 2; stick.position.x = -0.56;
    put(cyl(0.0072, 0.0072, 0.02, 8), 0x3E7CB8, 0, 0, 0, cue, false).rotation.z = Math.PI / 2;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.006), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.6, depthWrite: false }));
    line.rotation.x = -Math.PI / 2; line.position.set(0.5, -P.r * U + 0.002, 0); line.scale.x = 0.7; cue.add(line); // 겨냥하는 선
    root.add(cue);
    for (const o of [root, ...balls]) o.raycast = () => {};
    g.add(root);
    t.mesh = m = { root, balls, cue, parent: g };
    return m;
  }
  const decoOf = (g) => { let d = null; g.traverse((o) => { if (o.userData.poolDeco) d = o.userData.poolDeco; }); return d; };
  function drawTable(t) {
    const m = meshOf(t);
    if (!m) return;
    const g = K.itemObj(t.id);
    const d = decoOf(g); if (d && d.visible) { d.visible = false; K.dirty(); }
    t.balls.forEach((b, k) => { const s = m.balls[k]; s.visible = !b.in; s.position.set((b.x - P.w / 2) * U, Y, (b.y - P.h / 2) * U); });
    const aim = cur && cur.id === t.id && myTurn(t);
    m.cue.visible = aim;
    if (aim) {
      const q = t.balls[0], p = pull ? pow : 0;
      m.cue.position.set((q.x - P.w / 2) * U, Y, (q.y - P.h / 2) * U);
      m.cue.rotation.y = -aimAng;
      m.cue.children[0].position.x = -0.56 - (P.r * U + 0.01) - p * 0.16;
      m.cue.children[1].position.x = -(P.r * U + 0.01) - p * 0.16;
    }
  }
  function drop(t) { // 당구대에서 공을 걷고 쉬는 공을 다시 보인다
    if (t.mesh) { if (t.mesh.root.parent) t.mesh.root.parent.remove(t.mesh.root); t.mesh = null; }
    const g = K.itemObj(t.id), d = g && decoOf(g); if (d) d.visible = true;
    tables.delete(t.id); K.dirty();
  }

  /* ───────── 겨냥: 당구대를 누른 채 끌었다 놓기 ───────── */
  function local(px, py) { // 화면의 한 점 → 판 좌표
    const g = cur && K.itemObj(cur.id);
    if (!g) return null;
    g.updateMatrixWorld();
    v3.set(0, Y, 0); g.localToWorld(v3);
    const w = K.planeAt(px, py, v3.y);
    if (!w) return null;
    g.worldToLocal(w);
    return [w.x / U + P.w / 2, w.z / U + P.h / 2];
  }
  function aimFrom(t, p) {
    const q = t.balls[0], dx = q.x - p[0], dy = q.y - p[1], d = Math.sqrt(dx * dx + dy * dy);
    if (d > 3) aimAng = Math.atan2(dy, dx);
    pow = clamp(d / P.drag, 0, 1);
  }
  function press(px, py) { const t = cur && tables.get(cur.id); if (!myTurn(t)) return; const p = local(px, py); if (!p) return; pull = p; aimFrom(t, p); K.dirty(); }
  function move(c, px, py) { const t = cur && tables.get(cur.id); if (!pull || !myTurn(t)) return; const p = local(px, py); if (!p) return; pull = p; aimFrom(t, p); K.dirty(); }
  function release() { const t = cur && tables.get(cur.id); const p = pow; const was = !!pull; pull = null; pow = 0; if (was && p > 0.08 && myTurn(t)) fire(t, aimAng, p); K.dirty(); }
  function fire(t, ang, p) {
    if (!myTurn(t)) return false;
    t.shooter = me();
    shoot(t, ang, p);
    send(`S|${t.id}|${t.seq}|${ang.toFixed(3)}|${p.toFixed(3)}`);
    paint();
    return true;
  }

  /* ───────── 판 (아래) ───────── */
  const turnBtn = (label, id, d) => ({ label, id, fn: () => { aimAng += d; K.dirty(); } });
  const quit = { label: '그만하기', id: 'playQuit', fn: () => K.close() };
  const who = (id) => (id === me() ? '나' : K.nameOf(id));
  function board(t) { return t.players.map((p) => `${who(p)} ${t.pts[p] || 0}`).join(' · '); }
  function paint() {
    if (!cur) return;
    const t = tables.get(cur.id);
    bar.hidden = !myTurn(t);
    if (!t) { K.play.panel('당구', '자리를 잡는 중…', [quit]); return; }
    const solo = t.players.length === 1, left = 6 - sunk(t);
    const score = solo ? `남은 공 ${left}개 · ${t.shots}번 쳤어요` : board(t);
    const best = solo && K.bestLine('pool') ? ' · ' + K.bestLine('pool') : '';
    if (t.phase === 'over') {
      const top = Math.max(...t.players.map((p) => t.pts[p] || 0)), win = t.players.filter((p) => (t.pts[p] || 0) === top);
      const main = solo ? `${t.shots}번 만에 다 넣었어요! 🎉 ${soloScore(t)}점` : win.length > 1 ? `비겼어요! (${win.map(who).join(', ')})` : win[0] === me() ? '내가 이겼어요! 🏆' : `${who(win[0])} 승리! 🏆`;
      K.play.panel(main, score + best, [{ label: '🎱 한 판 더', main: true, id: 'playGo', fn: () => again(t) }, quit]);
    } else if (myTurn(t)) {
      K.play.panel(solo ? '당구 · 공 6개 넣기' : '당구 · 내 차례 🎱', (t.say ? t.say + ' · ' : '') + score + ' · 당구대를 누른 채 뒤로 끌었다 놓아요' + best,
        [turnBtn('↺', 'poolL', -0.06), { label: '🎱 치기', main: true, id: 'playGo', fn: () => fire(t, aimAng, 0.25 + 0.75 * Math.abs(Math.sin(gauge))) }, turnBtn('↻', 'poolR', 0.06), quit]);
    } else if (t.phase === 'roll' || t.phase === 'wait') K.play.panel('데구루루… 🎱', score, [quit]);
    else K.play.panel(`${who(turnId(t))} 차례`, (t.say ? t.say + ' · ' : '') + score + ' · 내 차례를 기다려요', [quit]);
  }
  function again(t) { // 한 판 더: 같은 사람들, 공을 다시 모으고 점수를 비운다 (지난 판에서 진 사람부터… 가 아니라 앉은 차례대로)
    const n = fresh(t.id, t.players.slice()); n.seq = t.seq + 1; n.mesh = t.mesh; tables.set(t.id, n); aimAng = 0;
    tell(n); paint(); K.dirty();
  }

  /* ───────── 앉기·일어나기 ───────── */
  function join(id) {
    let t = tables.get(id);
    if (t && t.players.includes(me())) return t;
    if (!t || !t.players.length) { t = fresh(id, [me()]); if (tables.get(id)) { t.seq = tables.get(id).seq + 1; t.mesh = tables.get(id).mesh; } tables.set(id, t); tell(t); send(`J|${id}`); joinAt = clock; } // 아무도 없으면 내가 판을 연다 (이미 치는 사람들이 있는데 내가 몰랐으면, 판장이 J 를 받고 나를 넣어 준다)
    else { send(`J|${id}`); joinAt = clock; } // 이미 치고 있으면 끼워 달라고 한다(판장이 넣어 준다)
    return t;
  }
  function leave(id, who2) { // who2 가 그 당구대에서 일어났다
    const t = tables.get(id);
    if (!t) return;
    const k = t.players.indexOf(who2);
    if (k < 0) return;
    const wasTurn = t.turn % t.players.length === k;
    t.players.splice(k, 1); delete t.pts[who2];
    if (!t.players.length) { drop(t); return; }
    if (k < t.turn % (t.players.length + 1)) t.turn--;
    t.turn = ((t.turn % t.players.length) + t.players.length) % t.players.length;
    if (wasTurn && t.phase !== 'over') { t.phase = 'aim'; for (const b of t.balls) { b.vx = 0; b.vy = 0; } }
    if (t.players[0] === me()) { t.seq++; tell(t); } // 남은 판장이 알린다
    paint();
  }

  K.play.add('pool', {
    start(c) {
      cur = c; pull = null; pow = 0; aimAng = 0;
      join(c.id);
      const g = c.g, at = (x, y, z) => { g.updateMatrixWorld(); const p = g.localToWorld(new THREE.Vector3(x, y, z)); return [p.x, p.y, p.z]; };
      const tall = window.innerWidth < window.innerHeight;
      K.setPose(tall ? { pos: at(1.55, 2.35, 0), at: at(-0.12, 0.45, 0), fov: 64, inside: true } : { pos: at(0, 2.05, 1.05), at: at(0, 0.45, 0.05), fov: 50, inside: true });
      paint();
    },
    paint: () => paint(),
    tick() {},
    tap() {},
    press, move, release, // play.js: press(px, py), move(c, px, py), release()
    stop(c) {
      const t = tables.get(c.id);
      cur = null; pull = null; bar.hidden = true;
      if (t) { send(`L|${c.id}`); leave(c.id, me()); }
      K.dirty();
    },
  });

  /* ───────── 친구에게서 온 소식 ───────── */
  function peerFx(m, from) {
    if (typeof m.v !== 'string' || m.v.length > 240 || !okId(from)) return false;
    const a = m.v.split('|'), kind = a[0], id = a[1];
    if (!okItem(id) || !K.S().items.has(id) || K.S().items.get(id).k !== 'pool') return false;
    let t = tables.get(id);
    if (kind === 'J') {
      if (!t || !t.players.length) return true;
      if (t.players[0] === me() && !t.players.includes(from) && t.players.length < 6) { t.players.push(from); t.pts[from] = 0; t.seq++; tell(t); paint(); }
      return true;
    }
    if (kind === 'L') { leave(id, from); return true; }
    if (kind === 'S') {
      const seq = Number(a[2]), ang = Number(a[3]), p = Number(a[4]);
      if (!t || seq !== t.seq || turnId(t) !== from || t.phase !== 'aim' || !Number.isFinite(ang) || Math.abs(ang) > 50 || !(p >= 0 && p <= 1)) return false;
      t.shooter = from; shoot(t, ang, p); paint(); K.dirty();
      return true;
    }
    if (kind === 'T') {
      const seq = Number(a[2]), players = (a[3] || '').split(',').filter(Boolean), turn = Number(a[4]), bs = (a[5] || '').split(','), pts = (a[6] || '').split(',').map(Number), phase = a[7], shots = Number(a[8]);
      if (!Number.isInteger(seq) || seq < 0 || !players.length || players.length > 6 || !players.every(okId) || new Set(players).size !== players.length) return false;
      if (!Number.isInteger(turn) || turn < 0 || turn >= players.length || bs.length !== 7 || pts.length !== players.length || !pts.every((v) => Number.isInteger(v) && v >= 0 && v <= 6) || !Number.isInteger(shots) || shots < 0 || shots > 999) return false;
      const balls = [];
      for (const s of bs) {
        if (s === 'i') { balls.push({ x: 0, y: 0, vx: 0, vy: 0, in: true }); continue; }
        const [x, y] = s.split(':').map(Number);
        if (!(x >= 0 && x <= P.w && y >= 0 && y <= P.h)) return false;
        balls.push({ x, y, vx: 0, vy: 0, in: false });
      }
      if (balls[0].in) return false;
      if (t && t.players.length && (seq < t.seq || (seq === t.seq && players[0] > t.players[0]))) { if (t.players[0] === me() && t.players.length) tell(t); return true; } // 지난 소식 (같은 번호면 맨 앞 사람 id 가 작은 쪽). 판장이면 지금 판을 다시 알린다
      const had = t;
      t = { id, seq, players, turn, pts: Object.fromEntries(players.map((p, k) => [p, pts[k]])), balls, phase: phase === 'over' ? 'over' : 'aim', shots, shooter: null, before: 0, scratch: false, mesh: had ? had.mesh : null, acc: 0, say: '' };
      if (had && had.phase !== 'over' && t.phase === 'over' && cur && cur.id === id) finish(t);
      if (had && had.shooter && had.shooter !== me()) { const got = sunk(t) - had.before; t.say = had.scratch ? '흰 공이 빠졌어요!' : got ? `${who(had.shooter)}: 들어갔다!` : ''; }
      tables.set(id, t);
      if (cur && cur.id === id && !players.includes(me()) && clock - joinAt > 1.5) { send(`J|${id}`); joinAt = clock; } // 앉아 있는데 명단에 없으면 다시 끼워 달라고 한다
      paint(); K.dirty();
      return true;
    }
    return false;
  }

  function tick(dt) {
    clock += dt; gauge += dt * 2.4;
    for (const t of [...tables.values()]) {
      if (!K.S().items.has(t.id)) { drop(t); continue; }
      for (const p of [...t.players]) if (p !== me() && !K.others().has(p)) leave(t.id, p); // 나간 사람
      if (!tables.has(t.id)) continue;
      if (t.phase === 'roll') {
        t.acc += Math.min(dt, 0.1);
        let done = false;
        while (t.acc >= P.step && !done) { t.acc -= P.step; done = stepBalls(t); }
        if (done) settle(t);
        K.dirty();
      }
      drawTable(t);
    }
    if (cur && !bar.hidden) { const t = tables.get(cur.id); const p = pull ? pow : Math.abs(Math.sin(gauge)); fill.style.width = (p * 100).toFixed(0) + '%'; fill.style.background = p > 0.75 ? '#D9483B' : '#E8776A'; if (t && myTurn(t)) K.dirty(); }
    if (cur && tables.get(cur.id) && !tables.get(cur.id).players.includes(me()) && clock - joinAt > 3) { joinAt = clock; send(`J|${cur.id}`); }
  }

  return {
    tick, peerFx,
    get on() { return !!cur; },
    test: {
      state(id) { const t = tables.get(id || (cur && cur.id)); return t ? { id: t.id, seq: t.seq, players: t.players.slice(), turn: turnId(t), pts: { ...t.pts }, phase: t.phase, shots: t.shots, sunk: sunk(t), say: t.say || '', balls: t.balls.map((b) => ({ x: b.x, y: b.y, in: b.in })), shown: !!(t.mesh && t.mesh.balls[1].visible !== undefined && t.mesh.root.parent), cue: !!(t.mesh && t.mesh.cue.visible) } : null; },
      get aim() { return aimAng; },
      // 검사용: 공 하나를 그 자리에 둔다(0 = 흰 공), 내 차례면 그 방향·세기로 친다
      setBall(i, x, y, id) { const t = tables.get(id || (cur && cur.id)); const b = t && t.balls[i]; if (b) Object.assign(b, { x, y, vx: 0, vy: 0, in: false }); },
      pot(i) { const t = cur && tables.get(cur.id); const b = t && t.balls[i]; if (b && i > 0) Object.assign(b, { in: true, vx: 0, vy: 0 }); },
      shoot(ang, p) { const t = cur && tables.get(cur.id); return !!t && fire(t, ang, p); },
      // 판 좌표 (x, y) 가 화면의 어디인지 (끌기 검사)
      screenOf(x, y) { const g = cur && K.itemObj(cur.id); if (!g) return null; g.updateMatrixWorld(); const w = g.localToWorld(new THREE.Vector3((x - P.w / 2) * U, Y, (y - P.h / 2) * U)).project(K.cam()); return { x: (w.x + 1) / 2 * innerWidth, y: (1 - w.y) / 2 * innerHeight }; },
    },
  };
}
