// 와인 냉장고 검사 (가구·유리문 안의 병 · 문 열기와 불빛 · 고르는 판 · 잔에 따르기 · 마시는 몸짓과 줄어드는 잔 · 스파클링의 코르크 · 빈 잔 · 친구에게 보이기 · 소리) (포트 8212)
const PORT = 8212;
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
const glass = (p) => T(p, () => window.__food.glass);

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = serve();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext(PHONE);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=wa`);
    check('와인 냉장고와 보통 냉장고를 놓음(가구 목록에 있음)', await put(A, [['wn', 'wine', 14, 0, 0], ['fr', 'fridge', 8, 0, 0]]));
    const W = await T(A, () => window.__food.wines);
    check('고를 것: 레드·화이트·로제·스파클링·포도주스 다섯 가지, 스파클링은 길쭉한 잔', W.length === 5 && ['red', 'white', 'rose', 'bubbly', 'grape'].every((k) => W.some((w) => w.id === k)) && W.find((w) => w.id === 'bubbly').glass === 'flute', W);
    check('닫힌 와인 냉장고는 조각 8개 이하로 그림(병은 한 묶음)', (await T(A, () => window.__food.meshes('wn'))) <= 8, await T(A, () => window.__food.meshes('wn')));

    /* 열기 */
    await stand(A, 3.25, -3.0);
    check('앞에 서면 "🍷 와인 냉장고 열기"', (await near(A)) === '🍷 와인 냉장고 열기' && (await doors(A)).length === 0, await near(A));
    await A.tap('#act'); // 첫 누르기: 이때부터 소리가 난다
    check('단추를 누르면 판이 열림: 와인 목록 5칸, 보통 냉장고 목록은 숨음', await until(async () => (await mode(A)) === 'fridge', 3000) && await A.isVisible('#wineList') && !(await A.isVisible('#fridgeList')) && (await A.locator('#wineList .fd').count()) === 5 && (await A.textContent('#fridgeP h2')).includes('와인 냉장고'));
    check('유리문이 실제로 열리고 안에 불이 켜지며 병 10개가 눕혀 있음', await until(async () => { const d = (await doors(A))[0]; return d && d.a === 1 && d.angle < -1.7 && d.lit > 0.2 && d.shelf === 10; }, 4000), await doors(A));
    check('문 여는 소리', (await heard(A, 'cellarOpen')).length === 1, await T(A, () => window.__sfx.log));
    check('폰(375×812)에서 판의 단추가 화면 안·44px 이상·겹치지 않음', (await audit(A, '#fridgeP button, #act')).length === 0, await audit(A, '#fridgeP button, #act'));
    await sleep(500); await shot(A, 'wine-open.png');

    /* 병을 눌러 꺼내 따르기 */
    const pt = await T(A, () => { const w = window.__food.shelfPoint('rose'); window.__tree.snapView(); return window.__tree.screenOf(w[0], w[2], w[1]); });
    await A.touchscreen.tap(pt.x, pt.y);
    check('눕혀 있는 병을 누르면 그 와인을 꺼냄', await until(async () => ((await holding(A)) || {}).kind === 'rose', 3000), { h: await holding(A), pt });
    check('병을 기울여 잔에 따름: 처음에는 잔이 비어 있고 병이 보임', await until(async () => { const g = await glass(A); return g && g.pouring && g.bottle && g.level < 1.5; }, 1500), await glass(A));
    await shot(A, 'wine-pour.png');
    check('따르는 동안에는 마실 수 없음', (await T(A, () => window.__food.bite())) === false && (await holding(A)).left === 4);
    check('잔이 차오르고 병이 치워짐', await until(async () => { const g = await glass(A); return g && !g.pouring && !g.bottle && g.level === 4; }, 4000), await glass(A));
    check('따르는 소리가 나고, 무엇을 따랐는지 알려 줌', (await heard(A, 'wine')).length === 1 && await toastHas(A, '로제 와인을 잔에 따랐어요'));
    check('꺼내면 판과 문이 닫히고 닫는 소리가 남', (await mode(A)) === null && await until(async () => (await doors(A)).length === 0, 4000) && (await heard(A, 'cellarShut')).length === 1);
    await until(async () => (await holding(A)).ready, 3000);
    check('할 일 단추: "🌸 로제 와인 마시기 ●●●●"', (await near(A)) === '🌸 로제 와인 마시기 ●●●●', await near(A));

    /* 마시기 */
    const rest = await glass(A);
    await hush(A);
    await T(A, () => window.__tree.pressSpace());
    let low = 0, back = 0, mid = false;
    await until(async () => { const g = await glass(A), h = await holding(A); if (!g || !h) return true; low = Math.min(low, g.armX - rest.armX); back = Math.min(back, g.headX); if (g.level > 3.05 && g.level < 3.95) mid = true; return h.shown === 3 && h.ready; }, 6000);
    check('마시는 몸짓: 잔 든 팔이 입으로 올라가고(0.7 넘게) 고개가 뒤로 젖혀짐', low < -0.7 && back < -0.15, { low, back });
    check('잔 속 높이가 한 번에 줄지 않고 조금씩 내려감', mid && (await glass(A)).level === 3, { mid, g: await glass(A) });
    check('꿀꺽 소리가 나고 머리 위에 말이 뜸', (await heard(A, 'gulp')).length === 1 && (await holding(A)).said === '향긋', await holding(A));
    await shot(A, 'wine-sip.png');
    await bite(A); await bite(A);
    check('세 모금 뒤 한 모금 남음', (await near(A)) === '🌸 로제 와인 마시기 ●○○○', await near(A));
    await bite(A);
    check('다 마시면 빈 잔이 남고 알려 줌', (await holding(A)).ending && await until(async () => (await glass(A)).level === 0, 1500) && await toastHas(A, '빈 잔이에요'), await holding(A));
    check('빈 잔은 잠깐 뒤 내려놓고(잔 놓는 소리) 없어짐', await until(async () => (await holding(A)) === null, 4000) && (await heard(A, 'glassDown')).length === 1);

    /* 스파클링과 포도주스 */
    await hush(A);
    await T(A, () => window.__food.take('bubbly'));
    check('스파클링: 코르크 "뻥" 소리와 함께 튀는 방울, 그다음에 따르는 소리', (await heard(A, 'cork')).length === 1 && (await T(A, () => window.__food.sparks)) >= 6 && await until(async () => (await heard(A, 'wine')).length === 1, 2000), await T(A, () => window.__sfx.log));
    await until(async () => !(await glass(A)).pouring, 4000); await sleep(700);
    check('스파클링은 들고 있는 동안 거품이 계속 올라옴', (await T(A, () => window.__food.sparks)) > 0, await T(A, () => window.__food.sparks));
    await shot(A, 'wine-bubbly.png');
    await T(A, () => window.__food.take('grape'));
    check('포도주스(무알코올)로 바꿔 들 수 있음', (await holding(A)).kind === 'grape' && await toastHas(A, '포도주스를 잔에 따랐어요'));
    await until(async () => (await holding(A)).ready, 4000);
    for (let i = 0; i < 4; i++) await bite(A);
    check('다 마시면 무알코올이라고 알려 줌', await toastHas(A, '무알코올'));
    await until(async () => (await holding(A)) === null, 4000);

    /* 보통 냉장고는 그대로 */
    await stand(A, 0.5, -3.0);
    check('보통 냉장고 앞에서는 "🧊 냉장고 열기"', (await near(A)) === '🧊 냉장고 열기', await near(A));
    await A.tap('#act'); await until(async () => (await mode(A)) === 'fridge', 3000);
    check('보통 냉장고 판에는 음식 15가지만 보이고 와인은 없음', await A.isVisible('#fridgeList') && !(await A.isVisible('#wineList')) && (await A.locator('#fridgeList .fd').count()) === 15 && (await A.textContent('#fridgeP h2')).includes('🧊 냉장고') && await until(async () => ((await doors(A))[0] || {}).shelf === 15, 3000), await doors(A));
    check('냉장고 문 여는 소리는 와인 냉장고와 다름', (await heard(A, 'fridgeOpen')).length === 1);
    await A.tap('#fridgeClose'); await until(async () => (await doors(A)).length === 0, 4000);

    /* 친구에게 보이기 */
    await stand(A, 3.25, -3.0);
    const B = await join(ctx, A, 'wb', 2);
    await B.tap('#c'); await hush(B);
    await T(A, () => window.__tree.useItem('wn'));
    check('와인 냉장고를 열면 친구 화면에서도 유리문이 열리고 소리가 작게 남', await until(async () => { const d = (await doors(B))[0]; return d && d.id === 'wn' && d.a === 1 && d.shelf === 10; }, 5000) && (await heard(B, 'cellarOpen')).some((r) => r.far && r.v < 0.8), { d: await doors(B), s: await heard(B, 'cellarOpen') });
    await T(A, () => window.__food.take('red'));
    const who = await until(async () => ((await others(B))[0] || {}).who, 4000);
    check('친구 화면에서도 병을 기울여 따르는 모습이 보임', await until(async () => { const g = await T(B, (w) => window.__food.glassOf(w), who); return g && g.pouring; }, 2000) && await until(async () => { const g = await T(B, (w) => window.__food.glassOf(w), who); return g && !g.pouring && g.level === 4; }, 4000), await others(B));
    await until(async () => (await holding(A)).ready, 4000);
    await bite(A);
    check('한 모금 마시면 친구 화면에서도 잔이 줄고 말이 뜨고 소리가 남', await until(async () => { const o = (await others(B))[0]; return o && o.shown === 3 && o.said === '음~'; }, 4000) && (await heard(B, 'gulp')).some((r) => r.far), await others(B));
    await sleep(4500);
    check('다시 알리는 소식(4초마다)으로는 또 따르지 않음', (await T(B, (w) => window.__food.glassOf(w), who)).pouring === false && (await heard(B, 'wine')).length === 1, await heard(B, 'wine'));
    const bad = await T(B, (w) => [{ k: 'food', v: 'h:red:9' }, { k: 'food', v: 'h:merlot:2' }, { k: 'food', v: 'o:nope' }].map((m) => window.__food.peerFx(m, w)), who);
    check('틀린 입 수·없는 종류·없는 냉장고 소식은 받지 않음', bad.every((x) => x === false), bad);

    /* 새로 시작하는 방 */
    const ctx2 = await browser.newContext(PHONE);
    const C = await open(ctx2, `${BASE}?net=bc&door=0&ns=wc`, false);
    const st = await T(C, () => [...window.__tree.S.items.values()].filter((it) => it.k === 'wine').map((it) => [it.i, it.j]));
    check('새로 시작하는 방의 주방에는 와인 냉장고가 하나 놓여 있음(냉장고 옆)', st.length === 1 && st[0][0] === 27 && st[0][1] === 0, st);
    await shot(C, 'wine-room.png');
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) { check('검사 도중 오류 없음', false, String(e && e.stack || e)); }
  await finish(browser, server);
})();
