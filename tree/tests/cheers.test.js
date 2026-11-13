// 건배 "짠" 검사 (마실 것을 든 둘이 가까이 있을 때만 단추 · 마주 보고 잔 내밀기 · 짠 소리와 반짝이 · 상대 화면에도 · 셋이 다 같이 · 빈손인 친구 안내 · 이상한 소식) (포트 8213)
const PORT = 8213;
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
const C_ = (p) => T(p, () => ({ partners: window.__cheers.partners.length, count: window.__cheers.count, events: window.__cheers.events, cooling: window.__cheers.cooling }));
const glass = (p) => T(p, () => window.__food.glass);
// p 를 (x, z) 에 세우고, 다른 사람들 화면에도 그 자리로 보일 때까지 기다린다
async function move(p, x, z, seenBy) {
  await stand(p, x, z);
  await T(p, () => { const W = window.__tree; W.goTo(W.me.x + 0.02, W.me.z); });
  const me = await T(p, () => window.__duo.me);
  for (const q of seenBy) await until(() => T(q, ([x, z, n]) => window.__duo.others.some((o) => Math.hypot(o.x - x, o.z - z) < 0.25 && !o.moving), [x, z, me]), 8000);
  await sleep(250);
}
const take = async (p, kind) => { await T(p, (k) => window.__food.take(k), kind); await until(async () => (await holding(p)).ready, 6000); };

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = serve();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext(PHONE);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ca`);
    await A.tap('#c');
    await take(A, 'red');
    check('혼자 있을 때는 "마시기"만 보임', (await near(A)).startsWith('🍷 레드 와인 마시기') && (await C_(A)).partners === 0, await near(A));
    const B = await join(ctx, A, 'cb', 2);
    await B.tap('#c');
    await move(A, 0, 2.5, [B]); await move(B, 3.5, 2.5, [A]);

    /* 상대가 빈손일 때 */
    await move(B, 0.9, 2.5, [A]);
    check('가까이 온 친구가 빈손이면 "짠" 단추는 없고 안내가 한 번 뜸', await toastHas(A, '친구도 마실 것을 들면', 4000) && (await near(A)).startsWith('🍷 레드 와인 마시기'), await near(A));
    check('빈손인 사람에게는 건배 단추가 없음', !String(await near(B)).includes('짠'), await near(B));

    /* 둘 다 들었지만 멀 때 */
    await move(B, 3.5, 2.5, [A]);
    await take(B, 'juice');
    await until(async () => (await others(A)).some((o) => o.kind === 'juice'), 5000);
    check('둘 다 들었어도 멀리 있으면 "짠" 단추가 없음', (await near(A)).startsWith('🍷 레드 와인 마시기') && (await C_(A)).partners === 0, await near(A));

    /* 가까이 */
    await move(B, 0.9, 2.5, [A]);
    check('마실 것을 든 둘이 가까이 서면 두 사람 모두에게 "🥂 짠!" 단추가 뜸', await until(async () => (await near(A)) === '🥂 짠!' && (await near(B)) === '🥂 짠!', 4000), { a: await near(A), b: await near(B) });
    check('폰(375×812)에서 단추가 화면 안·44px 이상·겹치지 않음', (await audit(A, '#act, #tools button')).length === 0, await audit(A, '#act, #tools button'));
    await hush(A); await hush(B);
    const armA = (await glass(A)).armX;
    await A.tap('#act');
    check('누르면 건배가 시작됨: 두 사람이 함께', (await C_(A)).count === 1 && (await C_(A)).events[0].who.length === 2 && (await C_(A)).events[0].mine, await C_(A));
    let reach = 0, sp = 0; await until(async () => { const g = await glass(A); if (g) reach = Math.min(reach, g.armX - armA); sp = Math.max(sp, await T(A, () => window.__food.sparks)); return sp >= 10; }, 5000);
    await shot(A, 'cheers-two.png');
    check('잔을 앞으로 내밀고(팔이 0.25 넘게 올라감) 서로 마주 봄', reach < -0.25 && Math.abs(Math.atan2(Math.sin((await T(A, () => window.__tree.me.face)) - Math.PI / 2), Math.cos((await T(A, () => window.__tree.me.face)) - Math.PI / 2))) < 0.3, { reach, face: await T(A, () => window.__tree.me.face) });
    check('잔이 닿는 순간 "짠" 소리와 반짝이, 알림', (await heard(A, 'cheers')).length === 1 && (await heard(A, 'cheers'))[0].far === false && sp >= 10 && await toastHas(A, '🥂 짠!'), { s: await heard(A, 'cheers'), sp });
    check('상대 화면에서도 같이 건배함(자기 잔도 내밀고 소리도 남)', await until(async () => (await C_(B)).count === 1 && (await heard(B, 'cheers')).length === 1, 4000) && (await heard(B, 'cheers'))[0].far === false && await toastHas(B, '🥂 짠!'), { c: await C_(B), s: await heard(B, 'cheers') });
    check('상대는 나를 마주 봄', Math.abs(Math.atan2(Math.sin((await T(B, () => window.__tree.me.face)) + Math.PI / 2), Math.cos((await T(B, () => window.__tree.me.face)) + Math.PI / 2))) < 0.3, await T(B, () => window.__tree.me.face));
    check('한 번 한 뒤 잠깐은 다시 "마시기"가 먼저(바로 또 눌리지 않게)', (await C_(A)).cooling && (await near(A)).startsWith('🍷 레드 와인 마시기'), await near(A));
    await until(async () => (await C_(A)).events.length === 0, 4000);
    await bite(A);
    check('건배한 뒤 그대로 마실 수 있음', (await holding(A)).left === 3, await holding(A));
    await T(A, () => window.__cheers.rest()); await T(B, () => window.__cheers.rest());
    check('조금 지나면 다시 "🥂 짠!"', (await near(A)) === '🥂 짠!', await near(A));

    /* 셋이 다 같이 */
    const C = await join(ctx, A, 'cc', 3);
    await C.tap('#c');
    await take(C, 'bubbly');
    await move(C, 0.45, 3.3, [A, B]);
    await until(async () => (await C_(A)).partners === 2, 6000);
    check('셋이 모이면 "🥂 다 같이 짠! (3명)"', (await near(A)) === '🥂 다 같이 짠! (3명)', await near(A));
    await hush(A); await hush(B); await hush(C);
    const before = [(await C_(A)).count, (await C_(B)).count, (await C_(C)).count];
    await T(C, () => window.__cheers.rest()); await C.tap('#act');
    check('한 사람이 누르면 세 사람 화면 모두에서 셋이 같이 건배함', await until(async () => { const a = await C_(A), b = await C_(B), c = await C_(C); return a.count === before[0] + 1 && b.count === before[1] + 1 && c.count === before[2] + 1; }, 5000) && (await until(async () => (await heard(A, 'cheers')).length === 1 && (await heard(B, 'cheers')).length === 1 && (await heard(C, 'cheers')).length === 1, 4000)), { a: await C_(A), b: await C_(B), c: await C_(C) });
    await shot(A, 'cheers-three.png');
    check('알림도 "다 같이 짠! (3명)"', await toastHas(C, '다 같이 짠! (3명)'));

    /* 떨어져서 구경하는 사람 */
    await until(async () => (await C_(A)).events.length === 0, 4000);
    await move(C, -3.2, -2.6, [A, B]);
    await T(A, () => window.__cheers.rest()); await T(B, () => window.__cheers.rest()); await hush(C);
    const cc = (await C_(C)).count;
    await T(A, () => window.__cheers.run());
    check('멀리 있는 사람은 끼지 않고, 두 사람의 건배가 보이며 소리는 작게 들림', await until(async () => (await C_(C)).count === cc + 1, 4000) && (await C_(C)).events.every((e) => !e.mine && e.who.length === 2) && await until(async () => (await heard(C, 'cheers')).length === 1, 3000) && (await heard(C, 'cheers'))[0].far && (await heard(C, 'cheers'))[0].v < 0.4, { c: await C_(C), s: await heard(C, 'cheers') });
    check('멀리 있는 사람의 팔은 그대로', (await glass(C)).cheer === false);

    /* 이상한 소식 */
    const whoA = await T(B, () => window.__food.others.find((o) => o.kind === 'red').who);
    await sleep(5000); // 도배 막는 시간(놀이 시계로 1.5초)이 지나게
    const bad = await T(B, (w) => [{ k: 'cheers', v: 'abc' }, { k: 'cheers', v: 7 }, { k: 'cheers', v: '99.00,99.00' }, { k: 'cheers', v: '0.5,2.5' }].map((m) => window.__cheers.peerFx(m, w)).concat(window.__cheers.peerFx({ k: 'cheers', v: '0.45,2.50' }, 'nobody')), whoA);
    check('틀린 모양·먼 자리·모르는 사람의 건배 소식은 받지 않음', bad.every((x) => x === false), bad);
    const twice = await T(B, (w) => [window.__cheers.peerFx({ k: 'cheers', v: '0.45,2.50' }, w), window.__cheers.peerFx({ k: 'cheers', v: '0.45,2.50' }, w)], whoA);
    check('연달아 보낸 건배는 한 번만 받음', twice[0] === true && twice[1] === false, twice);

    /* 잔이 비면 */
    await until(async () => (await C_(B)).events.length === 0, 4000);
    while ((await holding(B)) && (await holding(B)).left > 0) await bite(B);
    await T(A, () => window.__cheers.rest());
    check('상대가 다 마셔 빈 잔이면 "짠" 단추가 사라짐', await until(async () => !String(await near(A)).includes('짠'), 5000), await near(A));
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) { check('검사 도중 오류 없음', false, String(e && e.stack || e)); }
  await finish(browser, server);
})();
