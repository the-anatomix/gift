// 피자 화덕: 도우를 펴고 → 소스를 바르고 → 치즈를 뿌리고 → 토핑을 올리고 → 화덕에 굽고 → 조각으로 같이 먹는다
//   가구 모양(addShape)과 놀이(play.js 의 play.add)를 여기서 더한다. 만들던 피자는 방 상태(S.pizzas, state.js 의 pz…)라서 모두에게 같게 보이고 저장된다.
//   굽는 동안(화덕에 넣고 게이지를 보는 것)만 굽는 사람 화면의 일이고, 알맞게 꺼내면 pzBake, 태우면 pzClear 를 보낸다.
//   먹기: pzEat 로 한 조각 줄이고, 손에 피자 조각을 든다(food.js 의 take. 한 입씩 먹는 것은 거기 것 그대로).
import { THREE, L, put, cbox, rbox, cyl, ball } from './kit.js';
import { addShape } from './furniture.js';
import { PIZZA, PIZZA_TOPS } from './catalog.js';
import { sfx } from './sfx.js';

const BOARD = [0.23, 0.832, 0], MOUTH = [-0.25, 0.84, 0.02], OVEN_X = -0.25;
const HEAT = { ok: [0.5, 0.9], best: 0.7, tol: 0.04, max: 1.15, rubs: 4 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

addShape('pizza', (g) => { // 2 × 1: 왼쪽에 벽돌 화덕, 오른쪽에 나무 도마
  put(cbox(0.98, 0.78, 0.46, 0.03), 0xCDBBA4, 0, 0.39, 0, g);
  put(new THREE.BoxGeometry(0.96, 0.08, 0.42), 0x6E655C, 0, 0.04, 0, g, false);
  put(rbox(0.98, 0.03, 0.47, 0.012), 0x8A5F3F, 0, 0.795, 0, g);
  // 화덕: 둥근 벽돌 지붕, 아치 입구, 속의 불빛, 굴뚝
  put(new THREE.SphereGeometry(0.215, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xB5533C, OVEN_X, 0.81, -0.01, g);
  put(cyl(0.225, 0.225, 0.03, 18), 0x8C4A36, OVEN_X, 0.825, -0.01, g, false);
  const arch = put(new THREE.CylinderGeometry(0.115, 0.115, 0.07, 14, 1, false, -Math.PI / 2, Math.PI), 0x8C4A36, OVEN_X, 0.84, 0.175, g, false); arch.rotation.x = Math.PI / 2;
  const glow = put(new THREE.CircleGeometry(0.092, 14, 0, Math.PI), L(0xFF9A3C), OVEN_X, 0.842, 0.212, g, false);
  put(new THREE.CircleGeometry(0.06, 10, 0, Math.PI), L(0xFFD27A), OVEN_X, 0.842, 0.2125, g, false);
  put(cyl(0.04, 0.05, 0.15, 10), 0x8C4A36, OVEN_X, 1.06, -0.09, g, false);
  put(cyl(0.055, 0.055, 0.02, 10), 0x6E3A2A, OVEN_X, 1.14, -0.09, g, false);
  // 도마와 밀대
  put(cyl(0.21, 0.21, 0.02, 26), 0xD9B382, BOARD[0], 0.82, 0, g);
  put(rbox(0.07, 0.02, 0.05, 0.008), 0xD9B382, 0.455, 0.82, 0, g, false);
  put(cyl(0.016, 0.016, 0.2, 8), 0xB98A55, 0.03, 0.826, 0.19, g, false).rotation.z = Math.PI / 2;
  void glow;
  g.userData.pizza = { board: BOARD, mouth: MOUTH };
});

// 토핑 하나의 모양 (피자 위 y = 0 에 놓인다)
const TOP = {
  pep: (g) => put(cyl(0.021, 0.021, 0.005, 12), 0xB3261E, 0, 0.003, 0, g, false),
  mush: (g) => { put(cyl(0.017, 0.012, 0.006, 10), 0xE8DCC8, 0, 0.003, 0, g, false); put(new THREE.BoxGeometry(0.008, 0.005, 0.016), 0xD9C9AE, 0, 0.003, 0.012, g, false); },
  bell: (g) => put(new THREE.TorusGeometry(0.014, 0.004, 5, 12), 0x4CA64C, 0, 0.004, 0, g, false).rotation.set(Math.PI / 2, 0, 0),
  olive: (g) => put(new THREE.TorusGeometry(0.009, 0.0045, 5, 10), 0x2B2A28, 0, 0.004, 0, g, false).rotation.set(Math.PI / 2, 0, 0),
  pine: (g) => put(new THREE.CylinderGeometry(0.017, 0.017, 0.007, 3), 0xF7D154, 0, 0.004, 0, g, false),
  shrimp: (g) => put(new THREE.TorusGeometry(0.013, 0.006, 5, 10, Math.PI * 1.3), 0xF59A7A, 0, 0.005, 0, g, false).rotation.set(Math.PI / 2, 0, 0),
  bacon: (g) => put(new THREE.BoxGeometry(0.034, 0.004, 0.012), 0xC2553F, 0, 0.003, 0, g, false),
  corn: (g) => { for (const [x, z] of [[-0.007, 0], [0.007, 0.003], [0, -0.008]]) put(ball(0.006, 6, 5), 0xF7D154, x, 0.004, z, g, false); },
};
const angOf = (x, z) => { const a = Math.atan2(x, z); return a < 0 ? a + Math.PI * 2 : a; }; // CylinderGeometry 의 각도와 같은 쪽으로 잰다

// K = { play, S(), itemObj(id), op(o), canEdit(), toast, close, setPose, ray(px, py), aspect(), food, busy(), dirty() }
export function makePizza(K) {
  const $ = (id) => document.getElementById(id);
  const portrait = () => window.innerWidth < window.innerHeight;
  const v3 = new THREE.Vector3(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const world = (g, x, y, z) => { g.updateMatrixWorld(); const p = g.localToWorld(v3.set(x, y, z)); return [p.x, p.y, p.z]; };

  /* ───────── 도마 위의 피자 (모두에게 보인다) ───────── */
  const views = new Map(); // 화덕 id → { g, sig, parent }
  function drop(id) { const v = views.get(id); if (!v) return; if (v.g.parent) v.g.parent.remove(v.g); v.g.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); views.delete(id); K.dirty(); }
  function build(p) {
    const g = new THREE.Group(), baked = p.st === 4, th = baked ? p.left / PIZZA.slices * Math.PI * 2 : Math.PI * 2;
    const disc = (r, h, y, col) => put(new THREE.CylinderGeometry(r, r, h, 30, 1, false, 0, th), col, 0, y, 0, g, false);
    disc(0.172, 0.014, 0.007, baked ? 0xD9A05B : 0xEED9A8);
    if (p.st >= 2) disc(0.15, 0.004, 0.016, baked ? 0xA92F22 : 0xC4372B);
    if (p.st >= 3) disc(0.143, 0.004, 0.019, baked ? 0xF2B84A : 0xF8E08E);
    const tops = new THREE.Group(); tops.position.y = 0.021; g.add(tops);
    p.tops.forEach(([k, x, z], n) => {
      if (baked && angOf(x, z) >= th - 0.02) return; // 먹은 쪽
      const t = new THREE.Group(); t.position.set(x, 0, z); t.rotation.y = n * 2.4; TOP[k](t); tops.add(t);
    });
    if (baked) for (let k = 0; k <= p.left && k < PIZZA.slices; k++) { // 조각 금
      const a = k / PIZZA.slices * Math.PI * 2, m = put(new THREE.BoxGeometry(0.003, 0.002, 0.168), 0xB9853F, Math.sin(a) * 0.084, 0.0225, Math.cos(a) * 0.084, g, false); m.rotation.y = a;
    }
    return g;
  }
  let cur = null; // 지금 내가 하는 놀이 (play.js 의 cur)
  function sync() {
    const S = K.S();
    for (const id of [...views.keys()]) if (!S.pizzas.has(id) || !K.itemObj(id)) drop(id);
    for (const [id, p] of S.pizzas) {
      const o = K.itemObj(id); if (!o) continue;
      const sig = `${p.st}:${p.tops.length}:${p.left}`; let v = views.get(id);
      if (v && v.sig === sig && v.g.parent === o) continue;
      if (v) drop(id);
      v = { g: build(p), sig }; o.add(v.g); views.set(id, v); K.dirty();
      v.g.position.set(...BOARD);
    }
  }

  /* ───────── 놀이 판 ───────── */
  const gauge = document.createElement('div'); gauge.id = 'pzBar'; gauge.hidden = true; gauge.setAttribute('role', 'meter'); gauge.setAttribute('aria-label', '익은 정도');
  gauge.style.cssText = 'position:relative;height:18px;border-radius:9px;background:#F3E3C8;overflow:hidden;flex:none';
  gauge.innerHTML = `<div style="position:absolute;top:0;bottom:0;left:${HEAT.ok[0] / HEAT.max * 100}%;width:${(HEAT.ok[1] - HEAT.ok[0]) / HEAT.max * 100}%;background:#D9A05B"></div>`
    + `<div style="position:absolute;top:0;bottom:0;left:calc(${HEAT.best / HEAT.max * 100}% - 1.5px);width:3px;background:#FFF6E2"></div>`
    + '<div id="pzFill" style="position:absolute;top:0;bottom:0;left:0;width:0;background:rgba(90,56,36,.55);border-right:3px solid #5A3824"></div>';
  $('playBtns').parentNode.insertBefore(gauge, $('playBtns'));
  const STEPS = [
    { a: 'dough', label: '🫓 도우 펴기', main: '피자 만들기', sub: '도마를 문지르거나 단추를 눌러 도우를 둥글게 펴요', snd: 'dough' },
    { a: 'sauce', label: '🍅 소스 바르기', main: '소스 바르기', sub: '도우 위를 문질러 토마토소스를 발라요', snd: 'sauce' },
    { a: 'cheese', label: '🧀 치즈 뿌리기', main: '치즈 뿌리기', sub: '문질러서 치즈를 골고루 뿌려요', snd: 'sprinkle' },
  ];
  const pz = (c) => K.S().pizzas.get(c.id) || null;
  const quit = { label: '그만하기', id: 'playQuit', fn: () => K.close() };
  function view(c, low) {
    c.low = low;
    if (low) K.setPose({ pos: world(c.g, OVEN_X, 1.0, portrait() ? 1.5 : 1.2), at: world(c.g, OVEN_X, 0.88, 0), fov: portrait() ? 54 : 40, inside: true });
    else K.setPose({ pos: world(c.g, BOARD[0] - 0.06, BOARD[1] + (portrait() ? 1.05 : 0.75), portrait() ? 0.95 : 0.8), at: world(c.g, BOARD[0] - 0.06, BOARD[1], 0), fov: portrait() ? 58 : 42, inside: true });
  }
  // 펴는 중·바르는 중에 내 화면에만 보이는 것 (다 되면 방 상태가 바뀌어 모두에게 보인다)
  function ghost(c) {
    if (c.ghost) { c.g.remove(c.ghost); c.ghost.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); c.ghost = null; }
    const p = pz(c), st = p ? p.st : 0;
    if (st >= 3 || !K.canEdit() || !(c.p > 0)) return;
    const g = c.ghost = new THREE.Group(); g.position.set(...BOARD); c.g.add(g);
    const k = clamp(c.p, 0.05, 1);
    if (st === 0) { const m = put(ball(0.075, 16, 10), 0xEED9A8, 0, 0.07 * (1 - 0.85 * k), 0, g, false); m.scale.set(1 + 1.25 * k, 1 - 0.85 * k, 1 + 1.25 * k); }
    else put(cyl(0.15 * k, 0.15 * k, 0.004, 26), st === 1 ? 0xC4372B : 0xF8E08E, 0, st === 1 ? 0.0165 : 0.0195, 0, g, false);
    K.dirty();
  }
  function rub(c, amt) {
    const p = pz(c), st = p ? p.st : 0;
    if (c.phase || st >= 3 || !K.canEdit()) return;
    c.p = Math.min(1, (c.p || 0) + amt); sfx(STEPS[st].snd);
    if (c.p >= 1) { c.p = 0; ghost(c); K.op({ t: 'pz', id: c.id, a: STEPS[st].a }); } else ghost(c);
    paint(c);
  }
  function addTop(c, k, x, z) {
    const p = pz(c);
    if (!p || p.st !== 3 || c.phase) return false;
    if (p.tops.length >= PIZZA.max) { K.toast(`토핑은 ${PIZZA.max}개까지 올릴 수 있어요`); return false; }
    if (x == null) { const n = p.tops.length, r = PIZZA.r * Math.sqrt((n % 12 + 0.6) / 12.6), a = n * 2.39996; x = Math.cos(a) * r; z = Math.sin(a) * r; } // 빈 데를 돌아가며
    return K.op({ t: 'pzTop', id: c.id, k, x: +x.toFixed(3), z: +z.toFixed(3) });
  }
  function intoOven(c) {
    const p = pz(c), v = views.get(c.id);
    if (!p || p.st !== 3 || !v) return;
    c.phase = 'load'; c.t = 0; c.heat = 0; view(c, true); sfx('whoosh'); paint(c);
  }
  function out(c) {
    if (c.phase !== 'bake') return;
    if (c.heat < HEAT.ok[0]) { K.toast('아직 덜 익었어요. 치즈가 더 녹아야 해요'); return; }
    c.phase = null; view(c, false);
    if (c.heat > HEAT.ok[1]) { sfx('sizzle'); K.op({ t: 'pzClear', id: c.id }); K.toast('피자가 새까맣게 탔어요. 다시 만들어 봐요'); paint(c); return; }
    c.perfect = Math.abs(c.heat - HEAT.best) <= HEAT.tol;
    if (K.op({ t: 'pzBake', id: c.id })) K.toast(c.perfect ? '완벽해요! 피자가 노릇하게 구워졌어요 ✨' : '피자가 잘 구워졌어요! 🍕');
    paint(c);
  }
  function eat(c) {
    const p = pz(c);
    if (!p || p.st !== 4) return;
    if (K.busy()) { K.toast('케이크를 내려놓고 먹어요'); return; }
    if (K.op({ t: 'pzEat', id: c.id })) { K.close(); K.food.take('pizza'); }
  }
  function paint(c) {
    const p = pz(c), st = p ? p.st : 0, edit = K.canEdit();
    gauge.hidden = !c.phase;
    const wipe = edit && st > 0 ? [{ label: '치우기', id: 'pzClear', fn: () => { c.p = 0; ghost(c); K.op({ t: 'pzClear', id: c.id }); } }] : [];
    if (c.phase === 'load') K.play.panel('화덕에 넣는 중…', '불이 세서 금방 익어요', []);
    else if (c.phase === 'bake') K.play.panel('굽는 중…', '막대가 짙은 띠 안에 들어오면 꺼내요. 가운데 선에 맞추면 완벽!', [{ label: '꺼내기', main: true, id: 'playGo', fn: () => out(c) }]);
    else if (st < 3) {
      if (!edit) K.play.panel('피자 화덕', st ? '친구가 피자를 만드는 중이에요' : '구경하는 중에는 피자를 만들 수 없어요', [quit]);
      else K.play.panel(STEPS[st].main, `${STEPS[st].sub} (${Math.round((c.p || 0) * 100)}%)`, [{ label: STEPS[st].label, main: true, id: 'playGo', fn: () => rub(c, 1 / HEAT.rubs + 1e-6) }, ...wipe, quit]);
    } else if (st === 3) {
      if (!edit) K.play.panel('피자 화덕', '친구가 토핑을 올리는 중이에요', [quit]);
      else K.play.panel('토핑 올리기', `고른 토핑이 올라가요. 피자를 누르면 그 자리에 (${p.tops.length}/${PIZZA.max})`, [
        ...PIZZA_TOPS.map((t) => ({ label: `${t.icon} ${t.name}`, chip: true, id: 'pzTop-' + t.id, on: c.k === t.id, fn: () => { c.k = t.id; addTop(c, t.id); paint(c); } })),
        { label: '🔥 화덕에 굽기', main: true, id: 'playGo', fn: () => intoOven(c) }, ...wipe, quit]);
    } else K.play.panel(c.perfect ? '완벽한 피자! ✨' : '따끈한 피자', `남은 조각 ${p.left}/${PIZZA.slices} · 한 조각씩 들고 먹어요`, [{ label: '🍕 한 조각 먹기', main: true, id: 'playEat', fn: () => eat(c) }, ...wipe, quit]);
  }
  K.play.add('pizza', {
    start(c) { cur = c; c.p = 0; c.phase = null; c.k = PIZZA_TOPS[0].id; c.sig = ''; view(c, false); paint(c); },
    paint,
    tick(c, dt) {
      const p = pz(c), v = views.get(c.id), sig = p ? `${p.st}:${p.tops.length}:${p.left}` : '-';
      if (sig !== c.sig) { c.sig = sig; if (!p || p.st !== 3) { if (c.phase) view(c, false); c.phase = null; } ghost(c); paint(c); } // 친구가 바꿨을 때도 판을 맞춘다
      if (!c.phase || !v) return;
      c.t += dt;
      if (c.phase === 'load') {
        const k = clamp(c.t / 0.8, 0, 1), e = k * k * (3 - 2 * k);
        v.g.position.set(BOARD[0] + (MOUTH[0] - BOARD[0]) * e, BOARD[1] + (MOUTH[1] - BOARD[1]) * e + 0.12 * Math.sin(e * Math.PI), BOARD[2] + (MOUTH[2] + 0.22 * (1 - e) - BOARD[2]) * e);
        v.g.scale.setScalar(1 - 0.45 * e);
        if (k >= 1) { c.phase = 'bake'; c.t = 0; sfx('ovenOn'); paint(c); }
      } else {
        c.heat += dt * (0.22 + 0.06 * Math.sin(c.t * 3.1) + 0.03 * Math.sin(c.t * 7.3)); // 장작불이라 세기가 일렁인다
        $('pzFill').style.width = (clamp(c.heat / HEAT.max, 0, 1) * 100).toFixed(1) + '%';
        if (c.heat >= HEAT.max) { c.heat = HEAT.max; out(c); }
      }
      K.dirty();
    },
    tap(c, px, py) { // 피자를 누른 자리에 고른 토핑을 올린다
      const p = pz(c), v = views.get(c.id), r = K.ray(px, py);
      if (!p || p.st !== 3 || c.phase || !v || !r || !K.canEdit()) return;
      v.g.updateMatrixWorld(); plane.constant = -v.g.getWorldPosition(v3).y - 0.02;
      const hit = r.intersectPlane(plane, new THREE.Vector3()); if (!hit) return;
      v.g.worldToLocal(hit);
      if (Math.hypot(hit.x, hit.z) <= PIZZA.r) addTop(c, c.k, hit.x, hit.z);
    },
    move(c, px, py) { // 문지르면 펴지고 발린다 (화면 폭의 네 배쯤)
      const l = c.last; c.last = [px, py, performance.now()];
      if (!l || c.last[2] - l[2] > 250) return;
      const d = Math.hypot(px - l[0], py - l[1]);
      if (d > 1) rub(c, d / (4 * Math.max(320, window.innerWidth)));
    },
    stop(c) {
      cur = null; gauge.hidden = true; c.p = 0; ghost(c);
      const v = views.get(c.id); if (v) { v.g.position.set(...BOARD); v.g.scale.setScalar(1); }
    },
  });
  return {
    tick() { sync(); },
    test: {
      get views() { return [...views].map(([id, v]) => ({ id, sig: v.sig, meshes: (() => { let n = 0; v.g.traverse((m) => { if (m.isMesh) n++; }); return n; })(), at: v.g.position.toArray() })); },
      get state() { return cur ? { id: cur.id, phase: cur.phase, p: cur.p, heat: cur.heat, k: cur.k, low: cur.low, perfect: cur.perfect } : null; },
      setHeat(h) { if (cur) cur.heat = h; },
      list: () => [...K.S().pizzas].map(([id, p]) => ({ id, st: p.st, left: p.left, tops: p.tops.map((t) => [...t]) })),
      spot(id, x, z) { const v = views.get(id); return v ? world(v.g, x, 0.02, z) : null; }, // 피자 위 한 점의 자리 (방 좌표)
    },
  };
}
