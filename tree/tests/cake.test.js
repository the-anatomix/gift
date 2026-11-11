// 케이크 만들기 검사 (크림·장식·촛불, 여럿이 같이, 구경하는 사람의 촛불 불기). 실행: cd tree/tests && node cake.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8167, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__play && window.__duo && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const cake = (p) => T(p, () => { const c = window.__tree.S.cakes.get('ck'); return c ? { cream: c.cream, lit: c.lit, tops: c.tops.map((t) => t.slice()) } : null; });
const drawn = (p) => T(p, () => window.__tree.cakeTops('ck'));
const hash = (p) => T(p, () => window.__duo.hash());
const party = (p) => p.locator('#party i').count();
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
// 케이크 작업대(칸 24, 4)의 케이크 가운데는 (8.75, -1.5), 윗면 높이 1.14
const CX = 8.75, CZ = -1.5;
const tapTop = async (p, dx, dz) => { const s = await T(p, (a) => window.__tree.screenOf(a.x, a.z, 1.14), { x: CX + dx, z: CZ + dz }); await p.touchscreen.tap(s.x, s.y); await sleep(150); };

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const A = await open(ctx, `${BASE}?net=bc&ns=ka`);
    check('주방에 케이크 작업대를 놓을 수 있음', await T(A, () => window.__tree.dispatch({ t: 'put', id: 'ck', k: 'cake', i: 24, j: 4, r: 0 })) && (await drawn(A)) === 0);
    await T(A, () => window.__play.open('ck')); await sleep(700);
    check('케이크 만들기: 크림 4가지, 장식 6가지를 고를 수 있고 단추는 화면 안·44px 이상', (await A.locator('#playBtns [id^="cream-"]').count()) === 4 && (await A.locator('#playBtns [id^="top-"]').count()) === 6 && !(await A.isVisible('#playGo')) && (await audit(A)).length === 0, await audit(A));
    const ok = await T(A, () => { const W = window.__tree, v = W.view, pts = []; for (const [dx, dz] of [[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.3]]) pts.push(W.screenOf(8.75 + dx, -1.5 + dz, 1.14)); return pts.every((s) => s.x > 5 && s.x < innerWidth - 5 && s.y > v.top && s.y < innerHeight - v.bottom); });
    check('케이크 윗면 전체가 판에 가리지 않고 화면 안에 보임', ok);
    await tapTop(A, 0, 0);
    let c = await cake(A);
    check('케이크 위를 누르면 고른 장식(딸기)이 그 자리에 올라감', c && c.tops.length === 1 && c.tops[0][0] === 'berry' && Math.hypot(c.tops[0][1], c.tops[0][2]) < 0.05 && (await drawn(A)) === 1, c);
    await A.tap('#cream-pink'); await sleep(150);
    check('크림 색을 바꿀 수 있음', (await cake(A)).cream === 1 && (await A.getAttribute('#cream-pink', 'aria-pressed')) === 'true');
    await A.tap('#top-star'); await tapTop(A, 0.15, 0.1);
    await A.tap('#top-tree'); await tapTop(A, -0.15, -0.1);
    c = await cake(A);
    check('다른 장식을 골라 올릴 수 있고, 누른 자리에 놓임', c.tops.length === 3 && c.tops[1][0] === 'star' && Math.abs(c.tops[1][1] - 0.15) < 0.05 && Math.abs(c.tops[1][2] - 0.1) < 0.05 && c.tops[2][0] === 'tree', c.tops);
    const far = await T(A, () => window.__tree.screenOf(8.75 + 0.6, -1.5, 1.14));
    await A.touchscreen.tap(far.x, far.y); await sleep(150);
    check('케이크 밖을 누르면 아무것도 올라가지 않음', (await cake(A)).tops.length === 3);
    check('초가 없으면 촛불 켜기 단추가 없음', !(await A.isVisible('#playGo')));
    await A.tap('#top-candle');
    for (const [dx, dz] of [[-0.1, 0.15], [0.1, 0.15], [0, -0.2]]) await tapTop(A, dx, dz);
    check('초를 올리면 촛불 켜기 단추가 생김', (await cake(A)).tops.filter((t) => t[0] === 'candle').length === 3 && (await A.textContent('#playGo')).includes('촛불 켜기') && (await audit(A)).length === 0, await audit(A));
    await sleep(300);
    await A.screenshot({ path: path.join(__dirname, 'out', 'cake-make.png') });
    await A.tap('#playGo'); await sleep(200);
    check('촛불을 켜면 초 3개에 불이 붙고 "후~ 불기"가 나옴', (await cake(A)).lit === 3 && (await A.textContent('#playMain')).includes('촛불 3개') && (await A.textContent('#playGo')) === '후~ 불기');
    await sleep(300);
    await A.screenshot({ path: path.join(__dirname, 'out', 'cake-lit.png') });
    await tapTop(A, 0.2, -0.1);
    check('촛불이 켜져 있는 동안에는 장식이 더 올라가지 않음', (await cake(A)).tops.length === 6);
    await A.tap('#playGo'); await A.tap('#playGo'); await sleep(200);
    check('불 때마다 촛불이 하나씩 꺼짐', (await cake(A)).lit === 1 && (await party(A)) === 0);
    await A.tap('#playGo'); await sleep(300);
    check('마지막 촛불을 끄면 축하가 쏟아지고 다시 꾸미는 화면으로 돌아옴', (await cake(A)).lit === 0 && (await party(A)) > 10 && (await A.textContent('#toast')).includes('메리 크리스마스') && (await A.textContent('#playMain')) === '케이크 만들기');
    await A.screenshot({ path: path.join(__dirname, 'out', 'cake-party.png') });
    check('규칙에 어긋난 케이크 변화는 받아들이지 않음', await T(A, () => { const W = window.__tree, h = window.__duo.hash();
      const bad = [{ t: 'cakeTop', id: 'ck', k: 'nope', x: 0, z: 0 }, { t: 'cakeTop', id: 'ck', k: 'berry', x: 0.29, z: 0.29 }, { t: 'cakeTop', id: 'ck', k: 'berry', x: 'a', z: 0 }, { t: 'cakeTop', id: 'none', k: 'berry', x: 0, z: 0 },
        { t: 'cakeCream', id: 'ck', v: 9 }, { t: 'cakeCream', id: 'ck', v: 1.5 }, { t: 'cakeLit', id: 'ck', n: 9 }, { t: 'cakeLit', id: 'ck', n: -1 }, { t: 'cakeBlow', id: 'ck' }, { t: 'cakeBlow', id: 'none' }];
      return bad.every((o) => W.dispatch(o) === false) && window.__duo.hash() === h; }));
    const cap = await T(A, () => { const W = window.__tree; let n = 0; for (let k = 0; k < 60; k++) if (W.dispatch({ t: 'cakeTop', id: 'ck', k: 'cherry', x: 0.2 * Math.cos(k), z: 0.2 * Math.sin(k) })) n++; return { n, total: W.S.cakes.get('ck').tops.length }; });
    check('장식은 40개까지만 올라감', cap.total === 40 && cap.n === 34, cap);
    await sleep(500);
    await A.reload(); await ready(A);
    c = await cake(A);
    check('다시 열어도 케이크가 그대로 (크림·장식)', c && c.cream === 1 && c.tops.length === 40 && c.lit === 0 && (await drawn(A)) === 40, c && c.tops.length);
    await T(A, () => window.__play.open('ck')); await sleep(300);
    await A.tap('#playClear'); await sleep(200);
    check('"다 치우기"를 누르면 장식이 모두 사라짐', (await cake(A)).tops.length === 0 && (await drawn(A)) === 0 && !(await A.isVisible('#playClear')));
    await A.tap('#playQuit');

    /* 여럿이 같이 */
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], id = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&ns=kb#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&ns=kc#v=${id}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    await T(A, () => window.__tree.dispatch({ t: 'cakeTop', id: 'ck', k: 'berry', x: 0.1, z: 0 }));
    check('내가 올린 장식이 다른 사람들 케이크에도 올라감', await until(async () => (await drawn(B)) === 1 && (await drawn(C)) === 1, 5000));
    // 방에서 케이크 작업대를 누르면 옆으로 걸어가서 같이 만든다
    await T(B, () => { window.__tree.setZoomMul(0); window.__tree.snapView(); });
    const isl = await T(B, () => { window.__tree.snapView(); return window.__tree.screenOf(8.75, -1.2, 0.6); });
    await B.touchscreen.tap(isl.x, isl.y);
    check('다른 사람도 케이크 작업대를 누르면 옆으로 걸어와 같이 만들 수 있음', await until(async () => (await T(B, () => window.__tree.mode)) === 'play' && (await T(B, () => window.__play.state && window.__play.state.kind)) === 'cake', 20000) && (await B.textContent('#playMain')) === '케이크 만들기');
    const bme = await T(B, () => [window.__tree.me.x, window.__tree.me.z]);
    check('같이 만드는 사람의 아바타는 케이크 작업대 옆에 서 있음', Math.hypot(bme[0] - 8.75, bme[1] + 1.5) < 2.2, bme);
    await sleep(500);
    await B.tap('#top-candle'); await tapTop(B, -0.1, 0.1); await tapTop(B, 0.12, -0.12);
    check('옆에서 같이 올린 장식이 방장과 구경하는 사람에게도 보임', await until(async () => (await drawn(A)) === 3 && (await drawn(C)) === 3, 5000) && (await hash(A)) === (await hash(B)));
    await T(C, () => window.__play.open('ck')); await sleep(400);
    check('구경하는 사람은 케이크를 꾸밀 수 없다는 안내를 봄', (await C.textContent('#playSub')).includes('구경하는 중') && (await C.locator('#playBtns [id^="top-"]').count()) === 0);
    await tapTop(C, 0, 0.2);
    await T(C, () => window.__duo.rawOp({ t: 'cakeTop', id: 'ck', k: 'star', x: 0, z: 0.2 }));
    await sleep(600);
    check('구경하는 사람이 올리려 해도 올라가지 않음', (await cake(A)).tops.length === 3 && (await cake(C)).tops.length === 3);
    await T(C, () => window.__play.open('ck')); await sleep(300); // 억지로 보낸 변화 때문에 방을 다시 받으면서 놀이가 닫혔으므로 다시 연다
    await T(A, () => window.__play.open('ck')); await sleep(300);
    await A.tap('#playGo');
    check('촛불을 켜면 모두의 화면에 켜지고, 구경하는 사람에게도 "후~ 불기"가 나옴', await until(async () => (await cake(B)).lit === 2 && (await cake(C)).lit === 2 && (await C.isVisible('#playGo')) && (await C.textContent('#playGo')) === '후~ 불기', 5000));
    await sleep(400);
    await B.screenshot({ path: path.join(__dirname, 'out', 'cake-together.png') });
    await C.tap('#playGo');
    check('구경하는 사람이 불어도 촛불이 꺼짐', await until(async () => (await cake(A)).lit === 1 && (await cake(B)).lit === 1 && (await cake(C)).lit === 1, 5000));
    await B.tap('#playGo');
    check('마지막 촛불이 꺼지면 모두의 화면에 축하가 쏟아짐', await until(async () => (await party(A)) > 10 && (await party(B)) > 10 && (await party(C)) > 10, 5000) && (await cake(A)).lit === 0);
    await sleep(2200);
    check('끝난 뒤 세 사람의 방이 똑같음', await until(async () => (await hash(A)) === (await hash(B)) && (await hash(B)) === (await hash(C)), 8000));
    await T(B, () => window.__play.close());
    await T(A, () => { window.__play.close(); window.__tree.dispatch({ t: 'del', id: 'ck' }); });
    check('케이크 작업대를 치우면 케이크도 사라지고, 같이 만들던 사람의 놀이는 닫힘', await until(async () => !(await cake(A)) && !(await cake(B)) && (await T(C, () => window.__tree.mode)) === null, 5000));
    await ctx.close();
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
