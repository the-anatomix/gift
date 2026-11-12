// 케이크 새로 굽기와 먹기 검사 (오븐 · 덜 익음/탐/잘 구움 · 케이크 여러 개 · 8조각 먹기 · 다시 굽기 · 구경하는 사람 · 저장 · 들고 나간 케이크 · 폰 화면). 실행: cd tree/tests && node bake.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8185, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const audit = (p) => p.evaluate(() => {
  const bad = [];
  for (const b of document.querySelectorAll('button, a')) {
    const r = b.getBoundingClientRect();
    if (!r.width || b.closest('[hidden]') || getComputedStyle(b).display === 'none') continue;
    const name = (b.textContent || b.getAttribute('aria-label') || '').trim();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (!b.closest('.scroll') && (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5)) bad.push(`${name}: 화면 밖`);
  }
  return bad;
});
const cakes = (p) => T(p, () => window.__tree.cakes().sort((a, b) => (a.id < b.id ? -1 : 1)));
const phase = (p) => T(p, () => window.__play.state && window.__play.state.phase);
const toastHas = (p, t) => until(async () => (await p.textContent('#toast')).includes(t), 3000);
const go = async (p) => { await p.tap('#playGo'); await sleep(150); };
const hash = (p) => T(p, () => window.__duo.hash());
const deg = (a, r = 0.2) => [r * Math.sin(a * Math.PI / 180), r * Math.cos(a * Math.PI / 180)]; // 케이크 위의 자리 (위에서 볼 때 각도)

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ka`);
    check('케이크 작업대, 오븐, 탁자 둘을 놓음', await T(A, () => { const W = window.__tree; return [['ck', 'cake', 24, 4, 0], ['ov', 'stove', 23, 0, 0], ['tb', 'table', 14, 6, 0], ['tb2', 'table', 6, 12, 0]].every(([id, k, i, j, r]) => W.dispatch({ t: 'put', id, k, i, j, r })); }));
    await T(A, () => { const W = window.__tree; W.dispatch({ t: 'cakeCream', id: 'ck', v: 1 }); W.dispatch({ t: 'cakeTop', id: 'ck', k: 'berry', x: 0.1, z: 0.1 }); });

    /* 작업대에 케이크가 있으면 못 굽는다 */
    check('처음에는 케이크 하나(작업대 id), 빈 작업대 없음', JSON.stringify((await cakes(A)).map((c) => [c.id, c.left])) === '[["ck",8]]' && (await T(A, () => window.__tree.freeBench())) === null, await cakes(A));
    check('작업대가 차 있으면 오븐을 눌러도 열리지 않고 알려 줌', await T(A, () => window.__play.start('ov')) && await toastHas(A, '작업대가 비어 있어야') && !(await T(A, () => window.__play.on)));
    check('바로 열려고 해도 열리지 않음', !(await T(A, () => window.__play.open('ov'))) && !(await T(A, () => window.__play.on)) && (await T(A, () => window.__tree.mode)) === null);

    /* 케이크를 탁자로 옮기고 굽기 */
    await T(A, () => { const W = window.__tree; W.dispatch({ t: 'cakeTake', id: 'ck', by: window.__duo.me }); W.putDown('tb'); });
    check('케이크를 탁자로 옮기면 작업대가 빔', (await T(A, () => window.__tree.cakeAt('ck').on)) === 'tb' && (await T(A, () => window.__tree.freeBench())) === 'ck');
    check('빈 작업대를 누르면 열리지 않고 케이크가 어디 있는지 알려 줌', await T(A, () => window.__tree.cakeTap('ck')) && await toastHas(A, '탁자 위에') && !(await T(A, () => window.__play.on)));
    await T(A, () => window.__play.open('ov')); await sleep(400);
    check('오븐이 열림: "케이크 굽기", 큰 단추 "굽기 시작"', (await T(A, () => window.__play.state.kind)) === 'bake' && (await phase(A)) === 'idle' && (await A.textContent('#playMain')).includes('케이크 굽기') && (await A.textContent('#playGo')) === '굽기 시작');
    check('오븐 판의 단추가 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    await A.screenshot({ path: path.join(__dirname, 'out', 'bake-idle.png') });
    await A.keyboard.press('Space'); await sleep(150);
    check('스페이스바(또는 굽기 시작)로 굽기 시작, 큰 단추가 "꺼내기"로', (await phase(A)) === 'bake' && (await A.textContent('#playGo')) === '꺼내기');
    const h0 = await T(A, () => window.__play.state.heat); await sleep(700);
    check('굽는 동안 조금씩 익음', (await T(A, () => window.__play.state.heat)) > h0);
    await T(A, () => window.__play.setHeat(0.3)); await go(A);
    check('덜 익었을 때 꺼내면 알려 주고 계속 구움', (await phase(A)) === 'bake' && await toastHas(A, '덜 익었어요') && (await cakes(A)).length === 1);
    await T(A, () => window.__play.setHeat(1.0)); await go(A);
    check('너무 익었을 때 꺼내면 탐: "다시 굽기"', (await phase(A)) === 'burnt' && (await A.textContent('#playGo')) === '다시 굽기' && (await cakes(A)).length === 1);
    await go(A); await go(A);
    await T(A, () => window.__play.setHeat(1.14));
    check('그대로 두어도 너무 오래 구우면 저절로 탐', await until(async () => (await phase(A)) === 'burnt', 3000) && (await cakes(A)).length === 1);
    await go(A); await go(A);
    await T(A, () => window.__play.setHeat(0.7)); await go(A);
    const cs = await cakes(A), nid = (cs.find((c) => c.home === 'ck') || {}).id;
    check('알맞게 익었을 때 꺼내면 빈 작업대에 새 케이크가 나옴 (케이크 둘)', (await phase(A)) === 'done' && cs.length === 2 && !!nid && nid !== 'ck' && await toastHas(A, '잘 구워졌어요'), cs);
    check('새 케이크는 작업대 위, 처음 케이크는 탁자 위 그대로, 빈 작업대 없음', (await T(A, (id) => window.__tree.cakeAt(id).where, nid)) === 'island' && (await T(A, () => window.__tree.cakeAt('ck').where)) === 'item:tb' && (await T(A, () => window.__tree.freeBench())) === null);
    check('새 케이크는 크림·장식 없이 8조각', ((c) => c.cream === 0 && c.tops.length === 0 && c.left === 8 && !c.gone)(cs.find((c) => c.id === nid)));
    await T(A, () => window.__play.close());
    check('구운 케이크가 있는 작업대를 누르면 그 케이크 판이 열림', await T(A, () => window.__play.open('ck')) && (await T(A, () => window.__play.id)) === nid);
    await T(A, () => window.__play.close());

    /* 먹기 */
    const rules = await T(A, (id) => { const W = window.__tree, d = (o) => W.dispatch(o); const r = {};
      d({ t: 'cakeTop', id, k: 'candle', x: 0, z: -0.1 }); d({ t: 'cakeLit', id, n: 1 });
      r.lit = d({ t: 'cakeEat', id }); d({ t: 'cakeLit', id, n: 0 });
      r.none = d({ t: 'cakeEat', id: 'zz' }); r.bad = d({ t: 'cakeEat' });
      return r; }, nid);
    check('촛불이 켜져 있거나 없는 케이크는 먹을 수 없음', !rules.lit && !rules.none && !rules.bad, rules);
    await T(A, (a) => { const W = window.__tree; for (const [k, x, z] of a.tops) W.dispatch({ t: 'cakeTop', id: a.id, k, x, z }); }, { id: nid, tops: [['berry', ...deg(20)], ['star', ...deg(200)], ['cherry', ...deg(300)]] });
    await T(A, () => window.__play.open('ck')); await sleep(300);
    check('케이크 판에 "한 조각 먹기" 단추', (await A.isVisible('#playEat')) && (await A.textContent('#playEat')).includes('한 조각 먹기'));
    check('케이크 판의 단추가 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    await A.tap('#playEat'); await sleep(200);
    let c1 = (await cakes(A)).find((c) => c.id === nid);
    check('한 조각 먹으면 7조각 남고, 먹은 자리(0~45도)의 장식이 없어짐', c1.left === 7 && c1.tops.length === 3 && !c1.tops.some((t) => t[0] === 'berry') && (await T(A, (id) => window.__tree.cakeTops(id), nid)) === 3 && (await A.textContent('#playSub')).includes('남은 조각 7/8'), c1);
    check('먹을 때 "냠냠" 몸짓을 함', (await T(A, () => window.__tree.me.acting)) === 'eat');
    check('먹은 쪽에는 장식을 올릴 수 없음', !(await T(A, (a) => window.__tree.dispatch({ t: 'cakeTop', id: a.id, k: 'berry', x: a.x, z: a.z }), { id: nid, x: deg(10)[0], z: deg(10)[1] })));
    await A.screenshot({ path: path.join(__dirname, 'out', 'bake-eat.png') });
    for (let k = 0; k < 4; k++) { await A.tap('#playEat'); await sleep(150); }
    c1 = (await cakes(A)).find((c) => c.id === nid);
    check('다섯 조각 먹으면 200도 자리의 장식도 없어짐', c1.left === 3 && !c1.tops.some((t) => t[0] === 'star') && c1.tops.some((t) => t[0] === 'cherry'), c1);
    await A.tap('#playEat'); await sleep(150); await A.tap('#playEat'); await sleep(150);
    await A.keyboard.press('Space'); await sleep(300); // 마지막 조각은 스페이스바로
    const after8 = await cakes(A);
    check('여덟 조각을 다 먹으면 케이크가 없어지고 판이 닫히고 알려 줌', !after8.some((c) => c.id === nid) && after8.length === 1 && !(await T(A, () => window.__play.on)) && await toastHas(A, '다 먹었어요'), after8);
    check('다 먹으면 작업대가 다시 빔', (await T(A, () => window.__tree.freeBench())) === 'ck' && (await T(A, (id) => window.__tree.cakeAt(id), nid)) === null);
    // 탁자 위의 처음 케이크도 다 먹는다 → 자리 표시만 남는다
    await T(A, () => { for (let k = 0; k < 8; k++) window.__tree.dispatch({ t: 'cakeEat', id: 'ck' }); });
    const tomb = await T(A, () => ({ list: window.__tree.cakes(), row: window.__tree.serialize().cakes.find((r) => r[0] === 'ck'), at: window.__tree.cakeAt('ck') }));
    check('처음 케이크를 다 먹으면 목록에서 빠지고, 저장에는 "다 먹음" 자리 표시가 남음 (탁자 소품도 돌아옴)', tomb.list.length === 0 && tomb.row && tomb.row[8] === 1 && tomb.at === null && (await T(A, () => window.__tree.cakeTap('tb'))) === false, tomb);
    check('다 먹은 처음 케이크는 작업대에 다시 생기지 않음', (await T(A, () => window.__tree.freeBench())) === 'ck' && (await T(A, () => window.__tree.cakeTap('ck'))) && await toastHas(A, '오븐에서'));
    await T(A, () => window.__play.open('ov')); await sleep(200);
    await go(A); await T(A, () => window.__play.setHeat(0.6)); await go(A);
    const rv = await cakes(A);
    check('다시 구우면 처음 케이크(작업대 id)가 되살아나 작업대에 나옴', rv.length === 1 && rv[0].id === 'ck' && rv[0].left === 8 && !rv[0].home && (await T(A, () => window.__tree.cakeAt('ck').where)) === 'island', rv);
    await T(A, () => window.__play.close());

    /* 저장: 케이크 여럿, 먹다 남은 것, 자리 표시 */
    await T(A, () => { const W = window.__tree; W.dispatch({ t: 'put', id: 'ck2', k: 'cake', i: 21, j: 6, r: 0 }); W.dispatch({ t: 'cakeTake', id: 'ck', by: window.__duo.me }); W.putDown('tb2'); });
    await T(A, () => window.__play.open('ov')); await sleep(200);
    check('작업대가 둘이면 비어 있는 쪽에 구움', (await T(A, () => window.__tree.freeBench())) !== null);
    await go(A); await T(A, () => window.__play.setHeat(0.6)); await go(A); await T(A, () => window.__play.close());
    let cl = await cakes(A);
    const n2 = cl.find((c) => c.home);
    check('구운 케이크가 빈 작업대에 나옴 (케이크 셋: 탁자 위, 처음 케이크가 있는 작업대, 구운 것)', cl.length === 3 && !!n2, cl);
    // 남은 한 작업대의 처음 케이크를 다 먹어 자리 표시로, 구운 케이크는 세 조각 먹고 장식 하나
    const other = n2.home === 'ck' ? 'ck2' : 'ck';
    await T(A, (a) => { const W = window.__tree; for (let k = 0; k < 8; k++) W.dispatch({ t: 'cakeEat', id: a.other }); for (let k = 0; k < 3; k++) W.dispatch({ t: 'cakeEat', id: a.n2 }); W.dispatch({ t: 'cakeTop', id: a.n2, k: 'star', x: 0, z: -0.15 }); W.dispatch({ t: 'cakeCream', id: a.n2, v: 2 }); }, { other, n2: n2.id });
    const before = await T(A, () => ({ list: window.__tree.cakes(), ser: window.__tree.serialize().cakes, hash: window.__duo.hash() }));
    await sleep(800);
    await A.reload(); await ready(A);
    const aft = await T(A, () => ({ list: window.__tree.cakes(), ser: window.__tree.serialize().cakes, hash: window.__duo.hash() }));
    check('새로 고쳐도 케이크들이 그대로 (탁자 위, 먹다 남은 구운 케이크, 다 먹은 자리 표시)', JSON.stringify([...before.ser].sort()) === JSON.stringify([...aft.ser].sort()) && before.hash === aft.hash && aft.list.length === 2 && aft.ser.some((r) => r[8] === 1), { before: before.ser, aft: aft.ser });
    const n2a = aft.list.find((c) => c.id === n2.id);
    check('먹다 남은 케이크: 5조각, 크림·장식, 작업대 위에 잘린 모양', n2a && n2a.left === 5 && n2a.cream === 2 && n2a.tops.length === 1 && (await T(A, (id) => window.__tree.cakeAt(id), n2.id)).where === 'island' && (await T(A, (id) => window.__tree.cakeAt(id).left, n2.id)) === 5, n2a);
    check('저장해 둔 케이크 모양을 받는 cakeSet 은 방을 열 때만 쓰임', !(await T(A, () => window.__tree.dispatch({ t: 'cakeSet', id: 'zz1', c: { cream: 0, tops: [], home: 'ck', left: 8 } }))));
    const bad = await T(A, () => { localStorage.setItem('nolja-tree-room.kz', JSON.stringify({ v: 2, up: 1, at: 1, items: [['b1', 'cake', 24, 4, 0]], orns: [], cakes: [['b1', 0, 0, [], '', '', '', 0, 1], ['x1', 0, 0, [], '', '', 'b1', 0, 0], ['x2', 9, 0, [], '', '', 'b1', 8, 0], ['x3', 0, 0, [], '', '', 'nope', 8, 0], ['x4', 0, 0, [], '', '', 'b1', 3, 0], ['x5', 0, 0, [], '', '', 'b1', 4, 0]], lights: ['off', 'on'], wall: 'cream', floor: 'oak' })); return true; });
    const Z = await open(ctx, `${BASE}?ns=kz`);
    const zl = await cakes(Z);
    check('망가진 케이크 저장값: 쓸 수 있는 것만 살리고, 작업대 하나에 케이크 하나', bad && zl.length === 1 && zl[0].id === 'x4' && zl[0].left === 3, zl);
    await Z.close();

    /* 여럿이: 구경하는 사람은 먹을 수 있지만 구울 수는 없다 */
    await T(A, () => window.__duo.invite());
    await until(() => T(A, () => window.__duo.mode === 'waiting'));
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=kb#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=kc#v=${rid}`);
    const allSame = () => until(async () => (await hash(A)) === (await hash(B)) && (await hash(A)) === (await hash(C)), 8000);
    check('셋이 이어지고 케이크들이 모두에게 같음', await until(async () => (await T(A, () => window.__duo.count)) === 3, 20000) && await allSame() && (await cakes(C)).length === 2);
    await T(C, (h) => window.__play.open(h), n2.home); await sleep(300);
    check('구경하는 사람의 케이크 판: "한 조각 먹기"는 있고 "들고 가기"는 없음', (await C.isVisible('#playEat')) && !(await C.isVisible('#playCarry')) && (await C.textContent('#playSub')).includes('남은 조각 5/8'));
    await C.tap('#playEat'); await sleep(300);
    check('구경하는 사람이 먹으면 모두에게 한 조각 줄어듦', await until(async () => ((await cakes(A)).find((c) => c.id === n2.id) || {}).left === 4, 4000) && await allSame(), (await cakes(A)).find((c) => c.id === n2.id));
    check('구경하는 사람 화면의 판도 "남은 조각 4/8"로 바뀜', await until(async () => (await C.textContent('#playSub')).includes('남은 조각 4/8'), 3000));
    await T(C, () => window.__play.close());
    const vb = await T(C, (h) => window.__tree.dispatch({ t: 'cakeBake', id: 'vv1', home: h }), other);
    check('구경하는 사람은 cakeBake 를 할 수 없음', vb === false && (await cakes(A)).length === 2);
    await T(C, () => window.__play.open('ov')); await sleep(200);
    const vOpen = await T(C, () => window.__play.on);
    if (vOpen) { await go(C); await T(C, () => window.__play.setHeat(0.7)); await go(C); }
    await sleep(500);
    check('구경하는 사람이 오븐에서 구워도 케이크가 생기지 않음', (await cakes(A)).length === 2 && (await cakes(C)).length === 2 && await allSame(), { a: await cakes(A), vOpen });
    check('구경하는 사람에게는 오븐을 열지 않거나, 구경 중이라 구울 수 없다고 알려 줌', !vOpen || (await C.textContent('#toast')).includes('구경'), { vOpen, toast: await C.textContent('#toast'), phase: await phase(C) });
    await T(C, () => window.__play.close());
    const cid = await T(C, () => window.__duo.me);
    check('구경하는 사람이 보낸 cakeBake 는 방장이 받지 않음', await T(A, (a) => { window.__duo.feed({ t: 'op', op: { t: 'cakeBake', id: 'vv2', home: a.h } }, a.c); return !window.__tree.S.cakes.has('vv2'); }, { h: other, c: cid }) && (await cakes(A)).length === 2);
    // 구운 케이크를 든 친구가 나갈 때
    const bid = await T(B, () => window.__duo.me);
    check('친구가 구운 케이크를 듦', await T(B, (id) => window.__tree.dispatch({ t: 'cakeTake', id, by: window.__duo.me }), n2.id) && await until(async () => (await T(A, (id) => window.__tree.cakeAt(id).where, n2.id)) === 'peer:' + bid, 4000));
    await B.close();
    check('구운 케이크를 든 친구가 나가면 그 케이크는 제 작업대로 돌아옴 (모두에게)', await until(async () => (await T(A, (id) => window.__tree.cakeAt(id) && window.__tree.cakeAt(id).where, n2.id)) === 'island' && (await T(C, (id) => window.__tree.cakeAt(id) && window.__tree.cakeAt(id).where, n2.id)) === 'island', 12000) && await until(async () => (await hash(A)) === (await hash(C)), 5000), { a: await T(A, (id) => window.__tree.cakeAt(id), n2.id) });
    const B2 = await open(ctx, `${BASE}?net=bc&door=0&ns=kb#r=${room}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await hash(A)) === (await hash(B2)), 20000);
    const bid2 = await T(B2, () => window.__duo.me);
    await T(B2, (id) => window.__tree.dispatch({ t: 'cakeTake', id, by: window.__duo.me }), n2.id);
    await until(async () => (await T(A, (id) => window.__tree.cakeAt(id).where, n2.id)) === 'peer:' + bid2, 4000);
    // 그 사이 방장이 그 작업대에 새 케이크를 굽는다 (다른 작업대는 치워서 그 작업대만 비게)
    await T(A, (o) => window.__tree.dispatch({ t: 'del', id: o }), other);
    check('든 사이에 그 작업대에 새 케이크를 구움', (await T(A, () => window.__tree.freeBench())) === n2.home && await T(A, (h) => window.__tree.dispatch({ t: 'cakeBake', id: 'nb1', home: h }), n2.home));
    await B2.close();
    check('작업대가 차 있으면 나간 친구가 들고 있던 케이크는 없어짐 (모두에게)', await until(async () => !(await cakes(A)).some((c) => c.id === n2.id) && !(await cakes(C)).some((c) => c.id === n2.id), 12000) && await until(async () => (await hash(A)) === (await hash(C)), 5000) && (await cakes(A)).some((c) => c.id === 'nb1'), { a: await cakes(A), c: await cakes(C) });

    /* 폰 화면: 할 일 단추, 누운 판 */
    await T(A, () => { const W = window.__tree; W.me.stop(); W.me.place(-4 + 24 * 0.5, -3.2); }); await sleep(400);
    check('오븐 앞에서 "🍳 케이크 굽기" 단추가 뜨고 화면 안·44px 이상', (await T(A, () => window.__tree.nearAction())) === '🍳 케이크 굽기' && (await A.isVisible('#act')) && (await audit(A)).length === 0, { near: await T(A, () => window.__tree.nearAction()), bad: await audit(A) });
    await T(A, () => window.__tree.dispatch({ t: 'put', id: 'bd', k: 'bed', i: 2, j: 11, r: 0 }));
    await T(A, () => window.__tree.lieDown('bd'));
    check('누워 있을 때 판과 단추가 화면 안·44px 이상', await until(() => T(A, () => !!window.__tree.lying), 15000) && (await A.isVisible('#lieP')) && (await audit(A)).length === 0, await audit(A));
    await A.screenshot({ path: path.join(__dirname, 'out', 'bake-lie.png') });
    await T(A, () => window.__tree.getUp());

    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
