// 3층집과 마당 검사 (층 오르내리기 · 내가 있는 층만 보임 · 위층과 마당에 가구 · 비워 둬야 하는 칸 · 예전 저장 · 여럿이). 실행: cd tree/tests && node floors.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8181, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__tree.frames > 3)), 20000);
async function open(ctx, url, bare = true) {
  const p = await ctx.newPage();
  if (bare) await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const cxz = (i, j) => [-4 + (i + 0.5) * 0.5, -4 + (j + 0.5) * 0.5]; // 칸 → 자리(가운데)
const settle = (p) => until(() => T(p, () => { const m = window.__tree.me; return !m.moving && !m.path.length && !m.climbing; }), 25000);
// 걸어가면서 사다리를 탔는지, 거쳐 간 층, 막힌 칸을 밟았는지 적어 둔다
async function walk(p, x, z) {
  await T(p, () => { const W = window.__tree; W._seen = { climb: false, lvs: [W.level], bad: 0 };
    W._tk = setInterval(() => { const s = W._seen; if (W.me.climbing) s.climb = true; else if (!W.grid.freeAt(W.me.x, W.me.z)) s.bad++; if (s.lvs[s.lvs.length - 1] !== W.level) s.lvs.push(W.level); }, 25); });
  const ok = await T(p, (a) => window.__tree.goTo(a[0], a[1]), [x, z]);
  await sleep(200); await settle(p);
  return T(p, (ok) => { const W = window.__tree; clearInterval(W._tk); return { ok, ...W._seen, x: W.me.x, z: W.me.z, lv: W.level, y: W.me.root.position.y }; }, ok);
}
const vis = (p, ids) => T(p, (ids) => { const W = window.__tree; return { lv: W.level, floors: W.room.floors.map((f) => f.g.visible), items: ids.map((id) => W.itemShown(id)) }; }, ids);
// 다른 사람 아바타들이 내 화면에 보이는지
const peersShown = (p) => T(p, () => window.__duo.others.map((o) => o.shown));
const peerLv = (p) => T(p, () => window.__duo.others.map((o) => o.level));

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const A = await open(ctx, `${BASE}?ns=fa`);

    /* 층 오르내리기 */
    const L = await T(A, () => window.__tree.LADDERS);
    check('사다리 세 개: 1층 (19,8) → 2층 (52,8), 2층 (56,8) → 3층 (89,8), 3층 (91,13) → 4층 (124,13)', JSON.stringify(L.map((l) => [l.lv, l.a, l.b])) === '[[0,[19,8],[52,8]],[1,[56,8],[89,8]],[2,[91,13],[124,13]]]', L);
    check('격자는 126 × 27 칸, 문은 셋(방 문 둘 + 현관문)', (await T(A, () => [window.__tree.GX, window.__tree.GZ, window.__tree.room.doors.length])).join() === '126,27,3');
    const putOk = await T(A, () => { const W = window.__tree; return [['f1', 'sofa', 1, 6, 1], ['u2', 'lamp', 34, 2, 0], ['u3', 'plant', 66, 2, 0]].every(([id, k, i, j, r]) => W.dispatch({ t: 'put', id, k, i, j, r })); });
    const v0 = await vis(A, ['f1', 'u2', 'u3']);
    check('1층에 있을 때: 1층 바닥과 1층 가구만 보이고 위층과 위층 가구는 숨음', putOk && v0.lv === 0 && v0.floors.join() === 'true,false,false,false' && v0.items.join() === 'true,false,false', v0);
    const [x2, z2] = cxz(32 + 6, 5);
    const w1 = await walk(A, x2, z2);
    check('2층 자리로 가라고 하면 사다리를 타고 올라가서 그 자리까지 감', w1.ok && w1.climb && w1.lv === 1 && Math.hypot(w1.x - x2, w1.z - z2) < 0.15 && Math.abs(w1.y - 2.8) < 0.05 && w1.lvs.join() === '0,1' && w1.bad === 0, w1);
    const v1 = await vis(A, ['f1', 'u2', 'u3']);
    check('2층에서는 2층 바닥과 2층 가구만 보이고 1층 가구(와 트리)는 숨음', v1.floors.join() === 'false,true,false,false' && v1.items.join() === 'false,true,false', v1);
    await A.screenshot({ path: path.join(__dirname, 'out', 'floors-2f.png') });
    const [x3, z3] = cxz(64 + 6, 12);
    const w2 = await walk(A, x3, z3);
    check('3층까지 올라감 (높이 5.6)', w2.ok && w2.climb && w2.lv === 2 && Math.hypot(w2.x - x3, w2.z - z3) < 0.15 && Math.abs(w2.y - 5.6) < 0.05 && w2.bad === 0, w2);
    const v2 = await vis(A, ['f1', 'u2', 'u3']);
    check('3층에서는 3층과 3층 가구만 보임', v2.floors.join() === 'false,false,true,false' && v2.items.join() === 'false,false,true', v2);
    const w3 = await walk(A, -2, -3);
    check('3층에서 1층 자리로 가라고 하면 사다리 둘을 내려가서 감', w3.ok && w3.climb && w3.lvs.join() === '2,1,0' && w3.lv === 0 && Math.hypot(w3.x + 2, w3.z + 3) < 0.15 && Math.abs(w3.y) < 0.05 && w3.bad === 0, w3);
    check('1층으로 돌아오면 다시 1층만 보임', (await vis(A, ['f1', 'u2', 'u3'])).items.join() === 'true,false,false');

    // 사다리를 타는 동안
    await T(A, (p) => window.__tree.goTo(p[0], p[1]), cxz(32 + 6, 5));
    check('사다리를 타는 동안은 me.climbing 이고, 다른 데로 가라고 해도 끝까지 탐', await until(() => T(A, () => window.__tree.me.climbing), 15000) && (await T(A, () => window.__tree.goTo(-2, -3))) === false && (await T(A, () => window.__tree.me.climbing)));
    const climbT = await T(A, async () => { const t = performance.now(); while (window.__tree.me.climbing) await new Promise((r) => setTimeout(r, 20)); return (performance.now() - t) / 1000; });
    check('사다리를 다 타는 데 2초쯤 걸림', climbT > 0.6 && climbT < 4, climbT);
    await settle(A);

    // 위층에서 바닥 누르기
    await T(A, () => window.__tree.snapView());
    const tgt = cxz(32 + 10, 13), sp = await T(A, (t) => window.__tree.screenOf(t[0], t[1]), tgt);
    await A.touchscreen.tap(sp.x, sp.y); await sleep(200); await settle(A);
    const m2 = await T(A, () => [window.__tree.me.x, window.__tree.me.z, window.__tree.level]);
    check('2층에서 바닥을 누르면 2층의 그 자리로 걸어감', Math.hypot(m2[0] - tgt[0], m2[1] - tgt[1]) < 0.2 && m2[2] === 1, { m2, tgt });

    /* 1인칭 눈높이 */
    const eye2 = await T(A, () => { window.__tree.setPov(true); return window.__tree.look3; });
    await sleep(200);
    const eye2b = await T(A, () => window.__tree.look3);
    check('2층에서 1인칭으로 보면 눈높이가 2층 바닥 위 (2.8 + 1.18 쯤)', eye2b.y > 3.7 && eye2b.y < 4.3, { eye2, eye2b });
    await T(A, () => window.__tree.setPov(false));

    /* 위층에 가구 놓기 */
    await T(A, () => { window.__tree.setMode('furn'); window.__tree.ghostNew('chair'); });
    const g2 = await T(A, () => window.__tree.ghost);
    check('2층에서 고른 가구는 2층(칸 32~61)에 들린 채로 나타남', g2 && g2.ok && g2.i >= 32 && g2.i <= 61, g2);
    const gp = cxz(32 + 4, 14), gs = await T(A, (t) => { window.__tree.snapView(); return window.__tree.screenOf(t[0], t[1]); }, gp);
    await A.touchscreen.tap(gs.x, gs.y); await sleep(150);
    const g2b = await T(A, () => window.__tree.ghost);
    check('2층 바닥을 누르면 들고 있는 가구가 2층의 그 자리로 옴', g2b && Math.abs(g2b.i - 36) <= 1 && Math.abs(g2b.j - 14) <= 1 && g2b.ok, g2b);
    await T(A, () => window.__tree.ghostDone());
    const up = await T(A, () => [...window.__tree.S.items.values()].find((it) => it.k === 'chair'));
    check('놓으면 2층에 놓이고 보임', up && up.i >= 32 && up.i < 62 && (await T(A, (id) => window.__tree.itemShown(id), up.id)), up);
    // 비워 둬야 하는 칸
    await T(A, () => { window.__tree.ghostNew('lamp'); window.__tree.ghostMoveTo(-4 + 52.5 * 0.5, -4 + 8.5 * 0.5); });
    check('사다리로 올라선 칸(52,8)에는 들고 간 가구를 놓을 수 없음', !(await T(A, () => window.__tree.ghost.ok)), await T(A, () => window.__tree.ghost));
    await T(A, () => window.__tree.ghostMoveTo(-4 + 51.5 * 0.5, -4 + 8.5 * 0.5));
    check('사다리 구멍 칸(51,8)에도 놓을 수 없음', !(await T(A, () => window.__tree.ghost.ok)));
    await T(A, () => { window.__tree.ghostCancel(); window.__tree.setMode(null); });
    const rules = await T(A, () => { const W = window.__tree, put = (i, j) => W.dispatch({ t: 'put', id: 'r' + i + 'x' + j, k: 'lamp', i, j, r: 0 });
      return { foot1: put(19, 8), top1: put(52, 8), foot2: put(56, 8), top2: put(89, 8), hatch1: put(51, 8), hatch2: put(88, 8), door: put(3, 18), wall: put(8, 18), gap: put(30, 5), gap2: put(62, 5), noYard2: put(40, 20), out: put(94, 5), outJ: put(5, 27),
        yard: put(10, 22), f2: put(40, 15), f3: put(70, 15) }; });
    check('사다리 앞·올라선 칸·구멍, 현관 문턱, 남쪽 벽 줄, 층 사이 빈 곳, 격자 밖에는 놓을 수 없음', ['foot1', 'top1', 'foot2', 'top2', 'hatch1', 'hatch2', 'door', 'wall', 'gap', 'gap2', 'noYard2', 'out', 'outJ'].every((k) => rules[k] === false), rules);
    check('마당, 2층, 3층의 빈칸에는 놓을 수 있음', rules.yard && rules.f2 && rules.f3, rules);
    await T(A, () => { for (const id of ['r10x22', 'r40x15', 'r70x15']) window.__tree.dispatch({ t: 'del', id }); });
    // 새로 고쳐도
    await sleep(600);
    await A.reload(); await ready(A);
    const after = await T(A, (id) => ({ it: window.__tree.S.items.get(id), lv: window.__tree.level, shown: window.__tree.itemShown(id), u2: window.__tree.S.items.has('u2') }), up.id);
    check('새로 고쳐도 2층에 놓은 가구가 그대로 있음 (1층에서 시작하면 숨어 있음)', after.it && after.it.i === up.i && after.it.j === up.j && after.u2 && (after.lv !== 0 || !after.shown), after);

    /* 키보드로 사다리 */
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const K = await open(ctx2, `${BASE}?ns=fk`);
    await T(K, (p) => { window.__tree.me.stop(); window.__tree.me.place(p[0], p[1]); }, cxz(19, 8)); await sleep(200);
    await K.keyboard.down('ArrowRight'); await sleep(900); await K.keyboard.up('ArrowRight');
    check('사다리 앞 칸에 서서 오른쪽(사다리 쪽) 방향키를 누르면 올라감', await until(() => T(K, () => window.__tree.me.climbing), 9000) && await until(() => T(K, () => !window.__tree.me.climbing && window.__tree.level === 1), 20000));
    const kc = await T(K, () => [Math.floor((window.__tree.me.x + 4) / 0.5), Math.floor((window.__tree.me.z + 4) / 0.5)]);
    check('올라서면 2층의 올라선 칸 (52,8)', kc.join() === '52,8', kc);
    await K.keyboard.down('ArrowLeft'); await sleep(900); await K.keyboard.up('ArrowLeft');
    check('올라선 칸에서 왼쪽 방향키를 누르면 다시 내려감', await until(() => T(K, () => window.__tree.me.climbing), 9000) && await until(() => T(K, () => !window.__tree.me.climbing && window.__tree.level === 0), 20000));
    await T(K, (p) => { window.__tree.me.stop(); window.__tree.me.place(p[0], p[1]); }, cxz(17, 8)); await sleep(200);
    await K.keyboard.down('ArrowRight'); await sleep(900); await K.keyboard.up('ArrowRight'); await sleep(400);
    check('사다리 앞 칸이 아닌 곳에서 오른쪽 키를 누르면 그냥 걸음 (올라가지 않음)', !(await T(K, () => window.__tree.me.climbing)) && (await T(K, () => window.__tree.level)) === 0);
    await ctx2.close();

    /* 마당 */
    await T(A, () => { window.__tree.me.stop(); window.__tree.me.place(-2.5, 3); }); await sleep(300);
    const fd = () => T(A, () => window.__tree.room.doors[2].open);
    check('현관문은 멀리 있을 때 닫혀 있음', (await fd()) === 0);
    const yard = cxz(4, 23);
    await T(A, () => { const W = window.__tree; W._door = 0; W._dk = setInterval(() => { W._door = Math.max(W._door, W.room.doors[2].open); }, 25); });
    const wy = await walk(A, yard[0], yard[1]);
    const seenOpen = await T(A, () => { clearInterval(window.__tree._dk); return window.__tree._door; });
    check('집 안에서 마당 자리로 가라고 하면 현관을 지나 마당까지 걸어감', wy.ok && wy.lv === 0 && wy.z > 5 && Math.hypot(wy.x - yard[0], wy.z - yard[1]) < 0.15 && wy.bad === 0, wy);
    check('현관을 지날 때 현관문이 열림', seenOpen > 0.9, seenOpen);
    check('마당에서 문에서 멀어지면 현관문이 닫힘', await until(async () => (await fd()) === 0, 4000), await fd());
    check('마당은 1층과 같이 보임 (1층 가구도 보임)', (await vis(A, ['f1'])).items[0] === true && (await T(A, () => window.__tree.level)) === 0);
    await T(A, () => { window.__tree.setMode('furn'); window.__tree.ghostNew('snowman'); });
    const gy = await T(A, () => window.__tree.ghost);
    check('마당에서 고른 가구는 마당(j 19~26)에 나타남', gy && gy.ok && gy.j >= 19 && gy.i < 30, gy);
    await T(A, () => { window.__tree.ghostDone(); window.__tree.setMode(null); });
    const sn = await T(A, () => [...window.__tree.S.items.values()].find((it) => it.k === 'snowman'));
    check('마당에 가구를 놓을 수 있고 보임', sn && sn.j >= 19 && (await T(A, (id) => window.__tree.itemShown(id), sn.id)), sn);
    await T(A, () => window.__tree.setZoomMul(0.01)); await sleep(700);
    await A.screenshot({ path: path.join(__dirname, 'out', 'floors-yard.png') });
    const back = await walk(A, -2, 2);
    check('마당에서 다시 집 안으로 들어올 수 있음', back.ok && back.z < 5 && Math.hypot(back.x + 2, back.z - 2) < 0.15, back);

    /* 예전에 저장한 방 */
    // 사다리 앞 칸 (19,8) 에 가구가 놓여 있던 방: 가까운 빈자리로 옮겨진다
    await T(A, () => localStorage.setItem('nolja-tree-room.fa', JSON.stringify({ v: 2, up: 1, at: 1700000000000, sync: 0, items: [['ld', 'lamp', 19, 8, 0], ['lt', 'table', 3, 17, 0], ['ok', 'sofa', 1, 6, 1]], orns: [], cakes: [], lights: ['off', 'on'], wall: 'cream', floor: 'oak' })));
    await A.reload(); await ready(A);
    const rel = await T(A, () => { const W = window.__tree, it = (id) => W.S.items.get(id); return { ld: it('ld'), lt: it('lt'), ok: it('ok'), foot: W.grid.free(19, 8), door: W.grid.free(3, 18) && W.grid.free(4, 18) }; });
    check('사다리 앞 칸에 놓여 있던 가구는 방을 열 때 1층의 가까운 빈자리로 옮겨짐', rel.ld && !(rel.ld.i === 19 && rel.ld.j === 8) && rel.ld.i < 30 && Math.hypot(rel.ld.i - 19, rel.ld.j - 8) <= 3 && rel.foot, rel);
    check('남쪽 벽 줄에 걸친 탁자(예전 집에서는 있을 수 없던 자리)는 버려지고 현관은 비어 있음', !rel.lt && rel.door, rel);
    check('다른 가구는 그대로', rel.ok && rel.ok.i === 1 && rel.ok.j === 6);

    // 마당·위층이 없던 때에 꾸민 방 (up 표시가 없다): 마당·위층 기본 가구가 한 번만 더해진다
    const ctx3 = await browser.newContext(vp);
    const N = await open(ctx3, `${BASE}?ns=fu`, false);
    await T(N, () => localStorage.setItem('nolja-tree-room.fu', JSON.stringify({ v: 2, at: 1700000000000, sync: 0, items: [['old1', 'sofa', 1, 6, 1], ['old2', 'lamp', 0, 15, 0]], orns: [], lights: ['off', 'on'], wall: 'cream', floor: 'oak' })));
    await N.reload(); await ready(N);
    const s1 = await T(N, () => window.__tree.serialize());
    const ups = s1.items.filter((it) => /^up\d+$/.test(it[0]));
    check('예전 방을 열면 꾸민 것은 그대로이고 마당·2층·3층(다락방) 기본 가구와 방명록·달력(15개)이 더해짐', ups.length === 15 && s1.items.length === 17 && s1.items.some((it) => it[0] === 'old1') && !s1.items.some((it) => /^(base|east)/.test(it[0])) && ups.some((it) => it[3] >= 19) && ups.some((it) => it[2] >= 32 && it[2] < 62) && ups.some((it) => it[2] >= 64), s1.items.map((it) => it[0]));
    await T(N, () => window.__tree.dispatch({ t: 'del', id: 'up0' })); await sleep(700);
    const disk = await T(N, () => JSON.parse(localStorage.getItem('nolja-tree-room.fu')));
    check('저장값에 up: 1 표시가 붙음', disk && disk.up === 1, disk && disk.up);
    await N.reload(); await ready(N);
    const s2 = await T(N, () => window.__tree.serialize());
    check('다시 열어도 기본 가구가 또 더해지지 않음 (치운 것도 다시 생기지 않음)', s2.items.length === 16 && !s2.items.some((it) => it[0] === 'up0'), s2.items.map((it) => it[0]));
    // 새 방
    const N2 = await open(ctx3, `${BASE}?ns=fn`, false);
    const s3 = await T(N2, () => window.__tree.serialize());
    check('새 방에는 1층 기본 가구 13개 + 마당·위층(3층 다락방 5개) 기본 가구와 방명록·달력 15개', s3.items.length === 28 && s3.items.filter((it) => /^up\d+$/.test(it[0])).length === 15, s3.items.length);
    await ctx3.close();

    /* 둘이: 다른 층에 있는 사람 */
    const PA = await open(ctx, `${BASE}?net=bc&door=0&ns=pa`);
    await T(PA, () => window.__duo.invite());
    await until(() => T(PA, () => window.__duo.mode === 'waiting'));
    const room = (await T(PA, () => window.__duo.inviteUrl())).split('#r=')[1];
    const PB = await open(ctx, `${BASE}?net=bc&door=0&ns=pb#r=${room}`);
    const hash = (p) => T(p, () => window.__duo.hash());
    check('둘이 이어짐', await until(async () => (await T(PA, () => window.__duo.mode)) === 'on' && (await T(PB, () => window.__duo.mode)) === 'on' && (await hash(PA)) === (await hash(PB)), 20000));
    await settle(PA); await settle(PB);
    check('같은 층(1층)에 있으면 서로 보임', await until(async () => (await peersShown(PA)).join() === 'true' && (await peersShown(PB)).join() === 'true', 5000), { a: await peersShown(PA), b: await peersShown(PB) });
    const bt = cxz(32 + 12, 12);
    await walk(PB, bt[0], bt[1]);
    const ob = () => T(PA, () => window.__duo.other);
    check('친구가 2층으로 가면 내 화면에서도 친구 자리가 2층 그 자리로 따라옴', await until(async () => { const o = await ob(); return o && Math.hypot(o.x - bt[0], o.z - bt[1]) < 0.1 && !o.moving; }, 15000), await ob());
    check('2층에 있는 친구는 1층에 있는 내 화면에서 숨음 (친구 화면에서도 나는 숨음)', await until(async () => (await peersShown(PA)).join() === 'false' && (await peersShown(PB)).join() === 'false' && (await peerLv(PA)).join() === '1' && (await peerLv(PB)).join() === '0', 5000), { a: await peersShown(PA), b: await peersShown(PB), la: await peerLv(PA), lb: await peerLv(PB) });
    const at2 = cxz(32 + 14, 12);
    await walk(PA, at2[0], at2[1]);
    check('나도 2층에 올라가면 서로 보임', await until(async () => (await peersShown(PA)).join() === 'true' && (await peersShown(PB)).join() === 'true', 6000), { a: await peersShown(PA), b: await peersShown(PB) });
    await T(PB, () => { window.__tree.setMode('furn'); window.__tree.ghostNew('giftR'); window.__tree.ghostDone(); window.__tree.setMode(null); });
    const gift = await T(PB, () => [...window.__tree.S.items.values()].find((it) => it.k === 'giftR'));
    check('친구가 2층에 놓은 가구가 내 방에도 2층에 놓이고 보임', gift && gift.i >= 32 && await until(async () => (await hash(PA)) === (await hash(PB)), 5000) && (await T(PA, (id) => !!window.__tree.S.items.get(id) && window.__tree.itemShown(id), gift.id)), gift);
    const ct = cxz(64 + 10, 12);
    await walk(PB, ct[0], ct[1]);
    check('친구가 3층으로 가면 2층의 내 화면에서 숨음', await until(async () => { const o = await ob(); return o && Math.hypot(o.x - ct[0], o.z - ct[1]) < 0.1; }, 15000) && await until(async () => (await peersShown(PA)).join() === 'false', 5000), { o: await ob(), a: await peersShown(PA) });
    check('3층에 있는 친구 화면에서는 2층 선물이 숨음', !(await T(PB, (id) => window.__tree.itemShown(id), gift.id)));
    await walk(PB, -2, -3);
    check('친구가 1층으로 내려와도 자리가 맞음', await until(async () => { const o = await ob(); return o && Math.hypot(o.x + 2, o.z + 3) < 0.1; }, 15000), await ob());

    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
