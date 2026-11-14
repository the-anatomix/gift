// 피자 화덕 검사 (도우 펴기 → 소스 → 치즈 → 토핑 → 화덕 게이지: 덜 익음·딱 좋음·탐 → 조각 먹기 · 친구 화면과 같음 · 구경하는 사람은 먹기만 · 저장 · 소리)
const PORT = 8214;
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(50); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__food && window.__sfx && window.__cheers && window.__tree.frames > 3)), 20000);
async function open(ctx, url, bare = true) {
  const p = await ctx.newPage();
  if (bare) await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
// 폰 화면에서 보이는 단추가 화면 안에 있고 44px 이상이며 sel 안의 단추끼리 겹치지 않는지
const audit = (p, sel) => p.evaluate((sel) => {
  const bad = [], shown = (b) => b.getBoundingClientRect().width && !b.closest('[hidden]') && getComputedStyle(b).display !== 'none';
  for (const b of document.querySelectorAll('button, a, input[type=range]')) {
    if (!shown(b)) continue;
    const r = b.getBoundingClientRect(), name = (b.textContent || b.getAttribute('aria-label') || '').trim();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (!b.closest('.scroll') && (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5)) bad.push(`${name}: 화면 밖`);
  }
  const bs = [...document.querySelectorAll(sel)].filter(shown).map((b) => [b.textContent || b.id, b.getBoundingClientRect()]);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i][1], c = bs[j][1]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) bad.push(`겹침: ${bs[i][0]} / ${bs[j][0]}`); }
  return bad;
}, sel);
const near = (p) => T(p, () => window.__tree.nearAction());
const mode = (p) => T(p, () => window.__tree.mode);
const holding = (p) => T(p, () => window.__food.holding);
const doors = (p) => T(p, () => window.__food.doors);
const others = (p) => T(p, () => window.__food.others);
const heard = (p, n) => T(p, (n) => window.__sfx.log.filter((r) => r.n === n), n); // 요청된 소리의 기록
const hush = (p) => T(p, () => window.__sfx.clear());
const toastHas = (p, t, ms = 3000) => until(async () => (await p.textContent('#toast')).includes(t), ms);
const stand = async (p, x, z) => { await T(p, (a) => { const W = window.__tree; W.me.stop(); W.me.onArrive = null; W.me.place(a[0], a[1]); W.snapView(); }, [x, z]); await sleep(350); };
const shot = (p, name) => p.screenshot({ path: path.join(__dirname, 'out', name) });
// 한 입 먹고(한 모금 마시고) 그 입이 닿을 때까지 기다린다
const bite = async (p) => { const h = await holding(p); await T(p, () => window.__food.bite()); await until(async () => { const n = await holding(p); return !n || (n.shown < h.shown && (n.ready || n.ending)); }, 6000); };
const serve = () => http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
const PHONE = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
const put = (p, list) => T(p, (list) => list.every(([id, k, i, j, r]) => window.__tree.dispatch({ t: 'put', id, k, i, j, r })), list);
// 친구 한 명을 같은 방에 들인다
async function join(ctx, host, ns, n) {
  if (!['waiting', 'on'].includes(await T(host, () => window.__duo.mode))) { await T(host, () => window.__duo.invite()); await until(() => T(host, () => window.__duo.mode === 'waiting')); }
  const room = (await T(host, () => window.__duo.inviteUrl())).split('#r=')[1];
  const p = await open(ctx, `${BASE}?net=bc&door=0&ns=${ns}#r=${room}`);
  await until(async () => (await T(host, () => window.__duo.count)) === n, 20000);
  return p;
}
const finish = async (browser, server) => {
  await browser.close(); server.close();
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass} / ${results.length} 통과`);
  process.exit(pass === results.length ? 0 : 1);
};
const pz = (p) => T(p, () => window.__pizza.list());
const st = (p) => T(p, () => window.__pizza.state);
const go = async (p) => { await p.tap('#playGo'); await sleep(150); };
const hash = (p) => T(p, () => window.__duo.hash());
const names = (p) => T(p, () => window.__sfx.log.map((r) => r.n));
const openOven = async (p) => { await T(p, () => window.__play.open('pz')); await sleep(400); };

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = serve();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext(PHONE);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=pa`);
    await A.tap('#c');
    check('가구 목록에 "피자 화덕"이 있고 놓을 수 있음', await put(A, [['pz', 'pizza', 22, 0, 0]]) && (await pz(A)).length === 0);
    await T(A, () => window.__play.start('pz')); await until(async () => (await mode(A)) === 'play', 15000); await T(A, () => window.__play.close()); await sleep(300); // 화덕 앞으로 걸어간다
    check('화덕 앞에서 "🍕 피자 화덕" 단추, 화면 안·44px 이상', (await near(A)) === '🍕 피자 화덕' && (await A.isVisible('#act')) && (await audit(A, '#act')).length === 0, [await near(A), await audit(A, '#act')]);
    await openOven(A);
    check('열면 "피자 만들기", 큰 단추 "🫓 도우 펴기"', (await mode(A)) === 'play' && (await A.textContent('#playMain')) === '피자 만들기' && (await A.textContent('#playGo')).includes('도우 펴기') && (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    await shot(A, 'pizza-start.png');

    /* 도우 → 소스 → 치즈 */
    await hush(A); await go(A);
    const p1 = (await st(A)).p;
    check('단추를 누르면 도우가 조금 펴짐 (아직 방 상태는 그대로)', p1 > 0.2 && p1 < 0.3 && (await pz(A)).length === 0, p1);
    await A.mouse.move(100, 300); for (let k = 0; k < 10; k++) { await A.mouse.move(100 + (k % 2) * 160, 300 + (k % 3) * 30); await sleep(40); }
    check('도마를 문질러도 펴짐', (await st(A)).p > p1 + 0.15 || (await pz(A)).length === 1, await st(A));
    await shot(A, 'pizza-dough.png');
    for (let k = 0; k < 5 && !(await pz(A)).length; k++) await go(A);
    check('다 펴면 도우가 도마에 놓임 (단계 1), 소리 dough', JSON.stringify(await pz(A)) === '[{"id":"pz","st":1,"left":8,"tops":[]}]' && (await heard(A, 'dough')).length >= 1 && (await A.textContent('#playGo')).includes('소스 바르기'), await pz(A));
    for (let k = 0; k < 5 && (await pz(A))[0].st < 2; k++) await go(A);
    check('소스 바르기 (단계 2), 소리 sauce', (await pz(A))[0].st === 2 && (await heard(A, 'sauce')).length >= 1 && (await A.textContent('#playGo')).includes('치즈 뿌리기'));
    for (let k = 0; k < 5 && (await pz(A))[0].st < 3; k++) await go(A);
    check('치즈 뿌리기 (단계 3), 소리 sprinkle', (await pz(A))[0].st === 3 && (await heard(A, 'sprinkle')).length >= 1);
    check('차례를 건너뛰는 변화는 받지 않음', !(await T(A, () => window.__tree.dispatch({ t: 'pz', id: 'pz', a: 'sauce' }))) && !(await T(A, () => window.__tree.dispatch({ t: 'pz', id: 'pz', a: 'dough' }))));

    /* 토핑 */
    check('토핑 판: 여덟 가지 토핑과 "🔥 화덕에 굽기", 화면 안·44px 이상·겹치지 않음', (await A.locator('#playBtns .chip').count()) === 8 && (await A.textContent('#playGo')).includes('화덕에 굽기') && (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    await shot(A, 'pizza-tops.png');
    await hush(A);
    await A.tap('#pzTop-pep'); await sleep(120); await A.tap('#pzTop-pep'); await sleep(120); await A.tap('#pzTop-mush'); await sleep(120); await A.tap('#pzTop-pine'); await sleep(120);
    let t = (await pz(A))[0].tops;
    check('토핑을 누르면 하나씩 올라감 (페퍼로니 둘, 버섯, 파인애플), 소리 top', t.map((x) => x[0]).join() === 'pep,pep,mush,pine' && t.every((x) => Math.hypot(x[1], x[2]) <= 0.15) && (await heard(A, 'top')).length >= 1, t);
    const at = await T(A, () => { const w = window.__pizza.spot('pz', 0.05, 0.04), q = window.__tree.screenOf(w[0], w[2], w[1]); return Array.isArray(q) ? q : [q.x, q.y]; });
    await A.tap('#pzTop-shrimp'); await sleep(120); await A.touchscreen.tap(at[0], at[1]); await sleep(300);
    t = (await pz(A))[0].tops;
    const last = t[t.length - 1];
    check('피자를 누르면 그 자리에 고른 토핑이 올라감', t.length === 6 && last[0] === 'shrimp' && Math.abs(last[1] - 0.05) < 0.04 && Math.abs(last[2] - 0.04) < 0.04, t);
    check('모르는 토핑·피자 밖 자리는 받지 않음', !(await T(A, () => window.__tree.dispatch({ t: 'pzTop', id: 'pz', k: 'rock', x: 0, z: 0 }))) && !(await T(A, () => window.__tree.dispatch({ t: 'pzTop', id: 'pz', k: 'pep', x: 0.14, z: 0.14 }))));
    const v0 = (await T(A, () => window.__pizza.views))[0];
    check('도마 위 피자 모양이 방 상태와 같음 (단계 3, 토핑 6)', v0 && v0.sig === '3:6:8' && v0.meshes >= 9, v0);
    await shot(A, 'pizza-topped.png');

    /* 굽기: 덜 익음 · 탐 · 딱 좋음 */
    await hush(A); await go(A);
    check('화덕에 넣으면 숙여서 화덕 입구를 보고 게이지가 나옴', (await st(A)).low === true && (await A.isVisible('#pzBar')));
    check('넣고 나면 굽기 시작, 큰 단추 "꺼내기"', await until(async () => (await st(A)).phase === 'bake' && (await A.textContent('#playGo')) === '꺼내기', 20000) && (await audit(A, '#playBtns button')).length === 0);
    const h0 = (await st(A)).heat; await sleep(700);
    check('굽는 동안 게이지가 차오름', (await st(A)).heat > h0 && (await T(A, () => parseFloat(document.getElementById('pzFill').style.width))) > 0);
    await shot(A, 'pizza-oven.png');
    await T(A, () => { window.__pizza.setHeat(0.3); document.getElementById('playGo').click(); });
    check('덜 익었을 때 꺼내면 알려 주고 계속 구움', (await st(A)).phase === 'bake' && await toastHas(A, '덜 익었어요') && (await pz(A))[0].st === 3);
    await T(A, () => { window.__pizza.setHeat(1.0); document.getElementById('playGo').click(); }); await sleep(200);
    check('너무 익었을 때 꺼내면 타서 없어짐, 처음부터 다시', (await pz(A)).length === 0 && await toastHas(A, '탔어요') && (await A.textContent('#playGo')).includes('도우 펴기') && (await st(A)).low === false && !(await A.isVisible('#pzBar')));
    // 다시 만든다 (변화로 바로)
    await T(A, () => { const W = window.__tree; for (const a of ['dough', 'sauce', 'cheese']) W.dispatch({ t: 'pz', id: 'pz', a }); W.dispatch({ t: 'pzTop', id: 'pz', k: 'pep', x: 0.05, z: 0.1 }); W.dispatch({ t: 'pzTop', id: 'pz', k: 'olive', x: -0.1, z: -0.02 }); W.dispatch({ t: 'pzTop', id: 'pz', k: 'corn', x: 0.02, z: -0.1 }); });
    await sleep(300); await go(A);
    await until(async () => (await st(A)).phase === 'bake', 20000);
    await T(A, () => window.__pizza.setHeat(1.14));
    check('그대로 두어도 너무 오래 구우면 저절로 탐', await until(async () => (await pz(A)).length === 0, 5000));
    await T(A, () => { const W = window.__tree; for (const a of ['dough', 'sauce', 'cheese']) W.dispatch({ t: 'pz', id: 'pz', a }); W.dispatch({ t: 'pzTop', id: 'pz', k: 'pep', x: 0.05, z: 0.1 }); W.dispatch({ t: 'pzTop', id: 'pz', k: 'olive', x: -0.1, z: -0.02 }); W.dispatch({ t: 'pzTop', id: 'pz', k: 'corn', x: 0.02, z: -0.1 }); });
    await sleep(300); await go(A);
    await until(async () => (await st(A)).phase === 'bake', 20000);
    await hush(A);
    await T(A, () => { window.__pizza.setHeat(0.7); document.getElementById('playGo').click(); }); await sleep(250);
    check('알맞게(가운데 선) 꺼내면 구워짐: 단계 4, 여덟 조각, "완벽", 소리 ovenDing', JSON.stringify((await pz(A)).map((p) => [p.st, p.left, p.tops.length])) === '[[4,8,3]]' && await toastHas(A, '완벽') && (await heard(A, 'ovenDing')).length === 1 && (await A.textContent('#playEat')).includes('한 조각 먹기'), await pz(A));
    check('구운 피자 판의 단추가 화면 안·44px 이상', (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    await sleep(500); await shot(A, 'pizza-baked.png');
    check('구운 뒤에는 토핑을 더 올릴 수 없음', !(await T(A, () => window.__tree.dispatch({ t: 'pzTop', id: 'pz', k: 'pep', x: 0, z: 0 }))));

    /* 먹기 */
    await A.tap('#playEat'); await sleep(400);
    const h = await holding(A);
    check('한 조각 먹기: 일곱 조각 남고 판이 닫히며 손에 피자 조각을 듦', (await pz(A))[0].left === 7 && (await mode(A)) === null && h && h.kind === 'pizza', [await pz(A), h]);
    const v1 = (await T(A, () => window.__pizza.views))[0];
    check('도마 위 피자가 잘린 모양으로 바뀜', v1 && v1.sig === '4:3:7', v1);
    await bite(A);
    check('든 조각은 한 입씩 먹음 (food.js 그대로)', (await holding(A)).left === 2);
    await T(A, () => window.__food.stow());

    /* 저장 */
    const ser = await T(A, () => window.__tree.serialize().pizzas);
    check('저장에 피자가 들어감 [화덕, 단계, 남은 조각, 토핑]', JSON.stringify(ser) === '[["pz",4,7,[["pep",0.05,0.1],["olive",-0.1,-0.02],["corn",0.02,-0.1]]]]', ser);
    check('저장해 둔 피자를 받는 pzSet 은 방을 열 때만 쓰임', !(await T(A, () => window.__tree.dispatch({ t: 'pzSet', id: 'pz', p: { st: 4, left: 2, tops: [] } }))) && (await pz(A))[0].left === 7);
    await T(A, () => window.__tree.dispatch({ t: 'wall', v: 1 })); await sleep(1500);
    await A.reload(); await ready(A); if (await A.isVisible('#lookDone')) await A.click('#lookDone');
    check('새로 고쳐도 먹다 남은 피자가 그대로', await until(async () => JSON.stringify((await pz(A)).map((p) => [p.id, p.st, p.left, p.tops.length])) === '[["pz",4,7,3]]', 8000) && await until(async () => ((await T(A, () => window.__pizza.views))[0] || {}).sig === '4:3:7', 4000), await pz(A));

    /* 여럿이 */
    await T(A, () => window.__duo.invite());
    await until(() => T(A, () => window.__duo.mode === 'waiting'));
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=pb#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=pc#v=${rid}`);
    const allSame = () => until(async () => (await hash(A)) === (await hash(B)) && (await hash(A)) === (await hash(C)), 8000);
    check('셋이 이어지고 피자가 모두에게 같음', await until(async () => (await T(A, () => window.__duo.count)) === 3, 20000) && await allSame() && (await pz(C)).length === 1 && ((await T(B, () => window.__pizza.views))[0] || {}).sig === '4:3:7');
    await openOven(C);
    check('구경하는 사람의 판: "한 조각 먹기"는 있고 "치우기"는 없음', (await C.isVisible('#playEat')) && !(await C.isVisible('#pzClear')));
    await hush(B);
    await C.tap('#playEat');
    check('구경하는 사람이 먹으면 모두에게 한 조각 줄어듦', await until(async () => (await pz(A))[0].left === 6 && (await pz(B))[0].left === 6, 5000) && await allSame() && ((await holding(C)) || {}).kind === 'pizza', await pz(A));
    check('구경하는 사람은 만들거나 치울 수 없음', !(await T(C, () => window.__tree.dispatch({ t: 'pzClear', id: 'pz' }))) && !(await T(C, () => window.__tree.dispatch({ t: 'pz', id: 'pz', a: 'dough' }))) && (await pz(A)).length === 1);

    /* 들고 가서 탁자에 올려놓고 나눠 먹기 */
    const view0 = (p) => T(p, () => window.__pizza.views[0] || null);
    const bid = await T(B, () => window.__duo.me);
    check('탁자 둘을 놓음', await put(A, [['tb', 'table', 14, 6, 0], ['tb2', 'table', 6, 12, 0]]) && await allSame());
    await T(C, () => window.__play.close()); await openOven(C);
    check('구경하는 사람의 판에는 "들고 가기"가 없음', !(await C.isVisible('#pzCarry')));
    await T(C, () => window.__play.close());
    await openOven(B); await hush(A);
    check('꾸미는 사람의 판에는 "들고 가기"가 있고 단추가 화면 안·44px 이상', (await B.textContent('#pzCarry')).includes('들고 가기') && (await audit(B, '#playBtns button')).length === 0, await audit(B, '#playBtns button'));
    await B.tap('#pzCarry');
    check('들고 가기: 판이 닫히고 피자가 내 손에 (모두에게), 소리 carry', await until(async () => (await pz(A))[0].by === bid && (await pz(C))[0].by === bid, 5000) && (await mode(B)) === null && ((await view0(B)) || {}).where === 'h' && await until(async () => ((await view0(A)) || {}).where === 'h', 3000) && await until(async () => (await heard(A, 'carry')).length === 1, 3000) && await allSame(), [await pz(A), await view0(A)]);
    check('든 사람은 두 팔을 내밀고, 아래에 피자 안내와 "도마에 두기"가 보임', await T(A, (b) => window.__duo.others.find((o) => o.id === b).hold === true, bid) && (await B.isVisible('#carryP')) && (await B.textContent('#carryP')).includes('피자를 들고') && (await B.textContent('#carryBack')).includes('도마'));
    await sleep(400); await shot(B, 'pizza-carry.png');
    check('들고 가는 중에는 먹거나 남이 뺏어 들 수 없음', !(await T(A, () => window.__tree.dispatch({ t: 'pzEat', id: 'pz' }))) && !(await T(A, () => window.__tree.dispatch({ t: 'pzTake', id: 'pz', by: window.__duo.me }))) && (await pz(A))[0].left === 6);
    check('남의 이름으로 내려놓을 수 없음', !(await T(A, () => window.__tree.dispatch({ t: 'pzDrop', id: 'pz', by: window.__duo.me, on: 'tb' }))) && (await pz(A))[0].by === bid);
    await openOven(A);
    check('화덕을 연 다른 사람에게는 들고 가는 중이라고 알려 줌', (await A.textContent('#playSub')).includes('들고 가는 중'), await A.textContent('#playSub'));
    await T(A, () => window.__play.close());
    await B.bringToFront(); await stand(B, 4.2, 0.7);
    check('들고 있을 때 탁자를 누르면 내려놓으러 감', await T(B, () => window.__tree.cakeTap('tb') === true));
    check('탁자를 누르면 걸어가서 올려놓음 (모두에게), 소리 setDown', await until(async () => (await pz(A))[0].on === 'tb' && !(await pz(A))[0].by && (await pz(C))[0].on === 'tb', 40000) && await until(async () => ((await view0(C)) || {}).where === 't', 3000) && await until(async () => (await heard(A, 'setDown')).length === 1, 3000) && await allSame(), await pz(A));
    check('내려놓으면 팔을 내리고 안내가 사라짐', await T(A, (b) => window.__duo.others.find((o) => o.id === b).hold === false, bid) && !(await B.isVisible('#carryP')));
    check('피자가 놓인 탁자에는 다른 피자·케이크를 못 올림', !(await T(A, () => { const W = window.__tree; W.dispatch({ t: 'put', id: 'ck', k: 'cake', i: 24, j: 4, r: 0 }); W.dispatch({ t: 'cakeTake', id: 'ck', by: window.__duo.me }); return W.dispatch({ t: 'cakeDrop', id: 'ck', by: window.__duo.me, on: 'tb' }); })) && await T(A, () => window.__tree.dispatch({ t: 'cakeDrop', id: 'ck', by: window.__duo.me })));
    await C.bringToFront(); await stand(C, 4.2, 0.7); await T(C, () => window.__tree.cakeTap('tb'));
    check('구경하는 사람이 탁자를 누르면 걸어가서 피자 판이 열림 (먹기만)', await until(async () => (await mode(C)) === 'play' && await C.isVisible('#playEat'), 40000) && !(await C.isVisible('#pzCarry')) && (await C.textContent('#playSub')).includes('둘러앉아'));
    await sleep(500); await shot(C, 'pizza-table.png');
    await T(C, () => window.__food.stow()); await C.tap('#playEat');
    check('탁자에서 한 조각 먹으면 모두에게 줄어듦', await until(async () => (await pz(A))[0].left === 5 && (await pz(B))[0].left === 5, 5000) && ((await holding(C)) || {}).kind === 'pizza' && await allSame(), await pz(A));
    await A.bringToFront(); await stand(A, 4.2, 0.7); await T(A, () => window.__tree.cakeTap('tb'));
    check('꾸미는 사람은 탁자에서 "다시 들기"', await until(async () => (await mode(A)) === 'play' && await A.isVisible('#pzCarry'), 40000) && (await A.textContent('#pzCarry')).includes('다시 들기'));
    await A.tap('#pzCarry');
    check('다시 들면 탁자가 비고 소품이 돌아옴', await until(async () => (await pz(B))[0].by === 'h' && !(await pz(B))[0].on, 4000) && await T(A, () => window.__tree.me.hold === true));
    check('케이크와 피자를 한꺼번에 들 수 없음', !(await T(A, () => window.__tree.dispatch({ t: 'cakeTake', id: 'ck', by: window.__duo.me }))));
    check('다른 탁자에 올려놓음', await T(A, () => window.__tree.dispatch({ t: 'pzDrop', id: 'pz', by: window.__duo.me, on: 'tb2' })) && await until(async () => (await pz(C))[0].on === 'tb2', 4000) && await allSame());
    const ser2 = await T(A, () => window.__tree.serialize().pizzas);
    check('저장: 탁자에 올린 피자는 뒤에 [든 사람, 탁자] 가 붙음', JSON.stringify(ser2.map((r) => r.slice(4))) === '[["","tb2"]]', ser2);
    check('탁자를 치우면 피자는 화덕의 도마로 돌아옴 (모두에게)', await T(A, () => window.__tree.dispatch({ t: 'del', id: 'tb2' })) && await until(async () => !(await pz(B))[0].on && ((await view0(B)) || {}).where === 'b', 4000) && await allSame());
    const D = await join(ctx, A, 'pd', 4);
    const did = await T(D, () => window.__duo.me);
    check('새로 온 친구가 들고', await T(D, () => window.__tree.dispatch({ t: 'pzTake', id: 'pz', by: window.__duo.me })) && await until(async () => (await pz(A))[0].by === did, 4000));
    await D.close();
    check('든 사람이 나가면 피자는 도마로 돌아옴', await until(async () => !(await pz(A))[0].by && !(await pz(B))[0].by && ((await view0(A)) || {}).where === 'b', 15000) && await until(async () => (await T(A, () => window.__duo.count)) === 3, 15000), await pz(A));
    await T(A, () => window.__tree.dispatch({ t: 'del', id: 'ck' }));
    await T(A, () => { for (let k = 0; k < 6; k++) window.__tree.dispatch({ t: 'pzEat', id: 'pz' }); });
    check('여덟 조각을 다 먹으면 도마가 빔 (모두에게)', await until(async () => (await pz(A)).length === 0 && (await pz(B)).length === 0 && (await pz(C)).length === 0 && (await T(B, () => window.__pizza.views)).length === 0, 5000));
    // 친구가 만드는 것이 내 화면에도 보이고 들린다
    await hush(A); await openOven(B);
    for (let k = 0; k < 5 && !(await pz(B)).length; k++) await go(B);
    check('친구가 도우를 펴면 내 화면에도 놓이고 소리가 들림', await until(async () => ((await T(A, () => window.__pizza.views))[0] || {}).sig === '1:0:8' && (await heard(A, 'dough')).length >= 1, 5000), await names(A));
    await openOven(A);
    check('같은 화덕을 연 내 판도 친구가 만든 단계(소스 바르기)로', (await A.textContent('#playGo')).includes('소스 바르기'));
    await T(B, () => document.getElementById('pzClear').click());
    check('친구가 치우면 내 판도 처음(도우 펴기)으로', await until(async () => (await A.textContent('#playGo')).includes('도우 펴기'), 4000) && (await pz(A)).length === 0);
    await T(A, () => window.__tree.dispatch({ t: 'pz', id: 'pz', a: 'dough' })); await T(A, () => window.__play.close());
    check('화덕을 치우면 만들던 피자도 없어짐 (모두에게)', await T(A, () => window.__tree.dispatch({ t: 'del', id: 'pz' })) && await until(async () => (await pz(B)).length === 0 && (await T(B, () => window.__pizza.views)).length === 0, 4000) && await allSame());
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) { check('검사 도중 오류 없음', false, String(e && e.stack || e)); }
  await finish(browser, server);
})();
