// 케이크 들고 다니기 검사 (들기, 탁자에 올려놓기, 규칙, 저장, 여럿이). 실행: cd tree/tests && node carry.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8171, BASE = `http://localhost:${PORT}/tree/`;
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

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ya`);
    const at = (p, id = 'ck') => T(p, (i) => window.__tree.cakeAt(i), id);
    const hash = (p) => T(p, () => window.__duo.hash());
    const mode = (p) => T(p, () => window.__duo.mode);
    const toastHas = (p, t) => until(async () => (await p.textContent('#toast')).includes(t), 3000);
    const arms = (p) => T(p, () => { const a = window.__tree.me.parts.arms; return [a[0].rotation.x, a[1].rotation.x]; });
    const tapItem = async (p, id, y = 0.5) => { // 가구의 한가운데를 누른다
      await T(p, () => window.__tree.snapView());
      const s = await T(p, (a) => { const W = window.__tree, it = W.S.items.get(a.id), big = it.k === 'cake' || it.k === 'table'; return W.screenOf(-4 + (it.i + (big ? 1.5 : 0.5)) * 0.5, -4 + (it.j + (big ? 1 : 0.5)) * 0.5, a.y); }, { id, y });
      await p.touchscreen.tap(s.x, s.y);
    };
    const settle = (p) => until(() => T(p, () => !window.__tree.me.moving && !window.__tree.me.path.length), 12000);

    /* 혼자: 들기와 내려놓기 */
    check('케이크 작업대, 탁자 둘, 소파를 놓음', await T(A, () => { const W = window.__tree; return [['ck', 'cake', 24, 4], ['tb', 'table', 14, 6], ['tb2', 'table', 6, 12], ['sf', 'sofa', 2, 2]].every(([id, k, i, j]) => W.dispatch({ t: 'put', id, k, i, j, r: 0 })); }));
    await T(A, () => { const W = window.__tree; for (const [k, x, z] of [['berry', 0.1, 0.1], ['candle', -0.1, 0], ['candle', 0.1, -0.1]]) W.dispatch({ t: 'cakeTop', id: 'ck', k, x, z }); });
    check('처음에는 케이크가 작업대 위에 있음', (await at(A)).where === 'island' && (await at(A)).by === null && !(await A.isVisible('#carryP')), await at(A));
    await T(A, () => window.__play.open('ck')); await sleep(600);
    check('케이크 판에 "들고 가기" 단추가 있고 화면 안·44px 이상', (await A.isVisible('#playCarry')) && (await audit(A)).length === 0, await audit(A));
    await A.tap('#playCarry'); await sleep(500);
    let c = await at(A);
    check('"들고 가기"를 누르면 놀이가 닫히고 케이크가 내 손에 들림', c.by === 'h' && c.where === 'me' && c.scale < 0.7 && !(await T(A, () => window.__play.on)) && (await T(A, () => window.__tree.carried())) === 'ck', c);
    check('두 팔을 앞으로 내밀어 들고, 아래에 안내와 "작업대에 두기" 단추가 보임', (await arms(A)).every((x) => x < -0.9) && (await A.isVisible('#carryP')) && (await A.isVisible('#carryBack')) && (await audit(A)).length === 0, { arms: await arms(A), audit: await audit(A) });
    await A.screenshot({ path: path.join(__dirname, 'out', 'carry-hold.png') });
    const p0 = await T(A, () => [window.__tree.me.x, window.__tree.me.z]);
    await T(A, () => window.__tree.goTo(2, 1)); await settle(A);
    const p1 = await T(A, () => [window.__tree.me.x, window.__tree.me.z]);
    check('걸어 다녀도 계속 들고 있음', Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 1 && (await at(A)).where === 'me' && (await arms(A)).every((x) => x < -0.9), { p0, p1, at: await at(A), arms: await arms(A) });
    check('들고 있는 동안 소파 같은 다른 가구를 누르면 평소처럼 걸어감 (내려놓지 않음)', await T(A, () => window.__tree.cakeTap('sf') === false) && (await at(A)).where === 'me');
    await tapItem(A, 'tb');
    check('탁자를 누르면 걸어가서 탁자 위에 올려놓음', await until(async () => (await at(A)).on === 'tb', 12000) && (await at(A)).where === 'item:tb' && (await at(A)).by === null && await toastHas(A, '탁자에 올려놓았어요'), await at(A));
    c = await at(A);
    check('올려놓으면 탁자의 소품은 치워지고, 팔은 내려오고, 안내는 사라짐', c.deco === false && c.scale > 0.8 && (await arms(A)).every((x) => x > -0.5) && !(await A.isVisible('#carryP')) && (await T(A, () => window.__tree.carried())) === null, { c, arms: await arms(A) });
    await T(A, () => window.__tree.snapView());
    await A.screenshot({ path: path.join(__dirname, 'out', 'carry-table.png') });
    check('케이크가 없는 작업대를 누르면 탁자 위에 있다고 알려 줌', await T(A, () => window.__tree.cakeTap('ck') === true) && await toastHas(A, '탁자 위에'));
    await settle(A);
    await tapItem(A, 'tb', 0.6);
    check('케이크가 놓인 탁자를 누르면 그 자리에서 케이크 놀이가 열림', await until(() => T(A, () => window.__play.on && window.__play.id === 'ck' && window.__play.spot === 'tb'), 12000) && (await A.isVisible('#playGo')));
    await sleep(500);
    await A.screenshot({ path: path.join(__dirname, 'out', 'carry-table-play.png') });
    await A.tap('#playGo'); await sleep(300);
    check('탁자 위에서도 촛불을 켤 수 있음', await T(A, () => window.__tree.S.cakes.get('ck').lit) === 2 && (await A.textContent('#playMain')).includes('촛불 2개'));
    await A.tap('#playGo'); await sleep(200); await A.tap('#playGo'); await sleep(300);
    check('탁자 위에서 촛불을 다 불면 축하가 나옴', await T(A, () => window.__tree.S.cakes.get('ck').lit) === 0 && (await A.locator('#party i').count()) > 0);
    check('놀던 케이크의 탁자를 옮기면 놀이가 닫히고 케이크는 탁자를 따라감', await T(A, () => window.__tree.dispatch({ t: 'move', id: 'tb', i: 13, j: 6, r: 1 })) && !(await T(A, () => window.__play.on)) && (await at(A)).where === 'item:tb');
    await T(A, () => window.__play.open('ck')); await sleep(400);
    await A.tap('#playCarry'); await sleep(400);
    check('탁자에서 다시 들 수 있고, 탁자의 소품이 돌아옴', (await at(A)).where === 'me' && await T(A, () => window.__tree.cakeAt('ck').on === null));
    await A.tap('#carryBack'); await sleep(300);
    check('"작업대에 두기"를 누르면 바로 작업대로 돌아감', (await at(A)).where === 'island' && (await at(A)).scale === 1 && !(await A.isVisible('#carryP')) && await toastHas(A, '작업대에 돌려놓았어요'));
    await T(A, () => window.__play.open('ck')); await sleep(300); await A.tap('#playCarry'); await sleep(300);
    await T(A, () => window.__tree.goTo(8.6, 0.6)); await settle(A); // 주방으로 가서
    await tapItem(A, 'ck', 0.9);
    check('들고서 작업대를 누르면 걸어가서 돌려놓음', await until(async () => (await at(A)).where === 'island', 12000), await at(A));

    /* 규칙 */
    const rules = await T(A, () => {
      const W = window.__tree, d = (op) => W.dispatch(op), r = {};
      d({ t: 'put', id: 'ck2', k: 'cake', i: 21, j: 12, r: 0 });
      r.take = d({ t: 'cakeTake', id: 'ck', by: 'h' });
      r.two = d({ t: 'cakeTake', id: 'ck2', by: 'h' });                      // 한 사람이 하나만
      r.again = d({ t: 'cakeTake', id: 'ck', by: 'g1' });                    // 이미 누가 들고 있음
      r.other = d({ t: 'cakeDrop', id: 'ck', by: 'g1', on: 'tb' });          // 남이 내려놓을 수 없음
      r.sofa = d({ t: 'cakeDrop', id: 'ck', by: 'h', on: 'sf' });            // 탁자가 아닌 가구
      r.none = d({ t: 'cakeDrop', id: 'ck', by: 'h', on: 'zzz' });           // 없는 가구
      r.bad = [d({ t: 'cakeTake', id: 'ck2' }), d({ t: 'cakeTake', id: 'ck2', by: 5 }), d({ t: 'cakeTake', id: 'ck2', by: '<b>' }), d({ t: 'cakeTake', id: 'sf', by: 'g2' }), d({ t: 'cakeDrop', id: 'ck2', by: 'h' })];
      r.drop = d({ t: 'cakeDrop', id: 'ck', by: 'h', on: 'tb' });
      r.take2 = d({ t: 'cakeTake', id: 'ck2', by: 'h' });
      r.full = d({ t: 'cakeDrop', id: 'ck2', by: 'h', on: 'tb' });           // 탁자 하나에 케이크 하나
      r.tb2 = d({ t: 'cakeDrop', id: 'ck2', by: 'h', on: 'tb2' });
      return r;
    });
    check('규칙: 한 사람이 하나만 들고, 든 사람만 내려놓고, 탁자에만 올리고, 탁자 하나에 케이크 하나', rules.take && !rules.two && !rules.again && !rules.other && !rules.sofa && !rules.none && rules.bad.every((x) => !x) && rules.drop && rules.take2 && !rules.full && rules.tb2, rules);
    check('케이크 둘이 저마다 탁자 위에 있음', (await at(A, 'ck')).where === 'item:tb' && (await at(A, 'ck2')).where === 'item:tb2');
    check('케이크가 놓인 탁자를 치우면 케이크는 작업대로 돌아감', await T(A, () => window.__tree.dispatch({ t: 'del', id: 'tb2' })) && (await at(A, 'ck2')).where === 'island' && (await at(A, 'ck2')).on === null);
    check('작업대를 치우면 탁자에 있던 그 케이크도 사라지고 소품이 돌아옴', await T(A, () => { const W = window.__tree; const ok = W.dispatch({ t: 'del', id: 'ck2' }); return ok && !W.S.cakes.has('ck2') && W.cakeAt('ck2') === null; }));

    /* 저장 */
    await sleep(900);
    await A.reload(); await ready(A);
    check('새로 고쳐도 탁자에 올려놓은 케이크는 그대로', (await at(A)).where === 'item:tb' && (await at(A)).on === 'tb' && (await at(A)).deco === false, await at(A));
    await T(A, () => window.__tree.dispatch({ t: 'cakeTake', id: 'ck', by: 'h' })); await sleep(900);
    await A.reload(); await ready(A);
    check('들고 있다가 새로 고치면 케이크는 작업대로 돌아와 있음', (await at(A)).where === 'island' && (await at(A)).by === null && !(await A.isVisible('#carryP')), await at(A));

    /* 여럿이 */
    await T(A, () => window.__duo.invite());
    await until(async () => (await mode(A)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], id = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=yb#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=yc#v=${id}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2 && (await hash(A)) === (await hash(B)) && (await hash(A)) === (await hash(C)), 20000);
    const bid = await T(B, () => window.__duo.me);
    await T(A, () => window.__play.open('ck')); await sleep(300); await A.tap('#playCarry');
    check('방장이 케이크를 들면 친구와 구경하는 사람에게 방장 손에 들린 것으로 보임', await until(async () => (await at(B)).where === 'peer:h' && (await at(C)).where === 'peer:h', 4000) && (await hash(A)) === (await hash(B)) && (await hash(A)) === (await hash(C)), { b: await at(B), c: await at(C) });
    check('친구 화면에서 방장 아바타가 두 팔을 내밀고 있음', await T(B, () => window.__duo.others.find((o) => o.id === 'h').hold === true));
    check('남이 들고 있는 케이크의 작업대를 누르면 알려 줌', await T(B, () => window.__tree.cakeTap('ck') === true) && await toastHas(B, '친구가 케이크를 들고'));
    check('남이 들고 있는 케이크는 들 수 없음', !(await T(B, (me) => window.__tree.dispatch({ t: 'cakeTake', id: 'ck', by: me }), bid)) && (await at(A)).by === 'h');
    const D = await open(ctx, `${BASE}?net=bc&door=0&ns=yd#v=${id}`);
    check('나중에 들어온 사람에게도 방장이 들고 있는 것으로 보임', await until(async () => (await at(D)).where === 'peer:h', 15000) && (await hash(A)) === (await hash(D)), await at(D));
    await D.close();
    await until(async () => (await T(A, () => window.__duo.count)) === 3, 8000);
    await T(A, () => window.__tree.putDown('tb'));
    check('방장이 탁자에 올려놓으면 모두에게 탁자 위로 보임', await until(async () => (await at(B)).where === 'item:tb' && (await at(C)).where === 'item:tb', 4000) && (await hash(A)) === (await hash(B)));
    await T(C, () => window.__play.open('ck')); await sleep(400);
    check('구경하는 사람의 케이크 판에는 "들고 가기"가 없고, 들 수도 없음', !(await C.isVisible('#playCarry')) && !(await T(C, () => window.__tree.dispatch({ t: 'cakeTake', id: 'ck', by: window.__duo.me }))) && (await at(A)).on === 'tb');
    await T(B, () => window.__play.open('ck')); await sleep(400);
    await B.tap('#playCarry');
    check('친구가 탁자에서 케이크를 들면 방장과 구경하는 사람에게 친구 손에 들린 것으로 보임', await until(async () => (await at(A)).where === 'peer:' + bid && (await at(C)).where === 'peer:' + bid, 4000) && (await at(B)).where === 'me', { a: await at(A), c: await at(C) });
    check('보던 케이크를 누가 들고 가면 그 케이크 판은 닫힘', await until(() => T(C, () => !window.__play.on), 3000));
    check('남의 이름으로 케이크를 들거나 내려놓으려는 변화는 방장이 받지 않음', await T(A, (b) => { const D = window.__duo, S = window.__tree.S; D.feed({ t: 'op', op: { t: 'cakeDrop', id: 'ck', by: 'h', on: 'tb' } }, b); D.feed({ t: 'op', op: { t: 'cakeDrop', id: 'ck', by: b, on: 'tb', extra: 1 } }, 'zz'); return S.cakes.get('ck').by === b; }, bid));
    await sleep(600);
    check('그 뒤에도 방이 서로 같음', (await hash(A)) === (await hash(B)) && (await hash(A)) === (await hash(C)));
    await B.close();
    check('케이크를 든 친구가 나가면 케이크는 작업대로 돌아옴 (모두에게)', await until(async () => (await at(A)).where === 'island' && (await at(C)).where === 'island' && (await at(A)).by === null, 12000) && await until(async () => (await hash(A)) === (await hash(C)), 5000), { a: await at(A), c: await at(C) });
    await T(A, () => window.__tree.dispatch({ t: 'cakeTake', id: 'ck', by: 'h' }));
    await until(async () => (await at(C)).where === 'peer:h', 4000);
    await A.close();
    check('케이크를 든 방장과 끊기면 구경하던 사람 방에서는 작업대로 돌아옴', await until(async () => (await at(C)).where === 'island' && (await at(C)).by === null, 15000), await at(C));
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
