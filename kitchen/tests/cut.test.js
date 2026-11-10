// 자르기 자리 자동 검사.  실행: cd kitchen/tests && NODE_PATH=$(npm root -g) node cut.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8142, BASE = `http://localhost:${PORT}/kitchen/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.txt': 'text/plain' };
const Y = 0.97, X0 = -0.95, Z0 = 0.75;                       // 도마 위 반죽판 높이·가운데
const BX = [-1.23, -1.14, -1.05, -0.96, -0.87];                // 자를 곳 다섯 군데의 대략적인 x

const results = [];
function check(name, ok, detail) {
  results.push(!!ok);
  console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && detail !== undefined ? '  → ' + JSON.stringify(detail) : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000) {
  const t = Date.now();
  for (;;) { try { if (await fn()) return true; } catch (_) { /* 다시 */ } if (Date.now() - t > ms) return false; await sleep(100); }
}
const cuts = (p) => p.evaluate(() => window.__kitchen.getState().x.cut.cuts);
const scr = (p, x, z) => p.evaluate(([x, y, z]) => window.__kitchen.project(x, y, z), [x, Y, z]);
async function open(ctx, url) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('   (페이지 오류)', e.message));
  await p.goto(url);
  await until(() => p.evaluate(() => !!(window.__kitchen && window.__duo)));
  return p;
}
async function tab(p, name) { await p.click(`#tabs button:text-is("${name}")`); await sleep(1100); }
async function swipe(p, x) { // 세로로 긋기
  const a = await scr(p, x, Z0 - 0.26), b = await scr(p, x, Z0 + 0.26);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 10 }); await p.mouse.up();
  await sleep(120);
}

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); } });
  }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    console.log('── 자르기 (마우스, 390×844) ──');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await open(ctx, BASE);
    await tab(p, '자르기');
    check('처음에는 안 잘린 판, "0 / 5" 표시', (await cuts(p)).length === 0 && (await p.textContent('#cutCount')) === '0 / 5');
    const a = await scr(p, X0 - 0.3, Z0), b = await scr(p, X0 + 0.2, Z0);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 10 }); await p.mouse.move(a.x, a.y, { steps: 10 }); await p.mouse.up();
    check('가로로만 문지르면 잘리지 않음', (await cuts(p)).length === 0, await cuts(p));
    await swipe(p, BX[2]);
    check('세로로 그으면 그 자리가 잘림', same(await cuts(p), [2]) && (await p.textContent('#cutCount')) === '1 / 5', await cuts(p));
    await swipe(p, X0 + 0.6);
    check('반죽판 밖을 그으면 잘리지 않음', (await cuts(p)).length === 1, await cuts(p));
    await sleep(500);
    await p.screenshot({ path: path.join(__dirname, 'out', 'cut-1.png') });
    for (const i of [0, 1, 3, 4]) await swipe(p, BX[i]);
    for (let n = 0; n < 4 && (await cuts(p)).length < 5; n++) for (const x of BX) await swipe(p, x); // 벌어져 밀린 자리 보정
    check('다섯 번 자르면 완성 ("막대 완성!")', (await cuts(p)).length === 5 && (await p.textContent('#panel')).includes('막대 완성!'), await cuts(p));
    await sleep(600);
    await p.screenshot({ path: path.join(__dirname, 'out', 'cut.png') });
    const idle = await p.evaluate(async () => { const a = window.__kitchen.frames; await new Promise((r) => setTimeout(r, 1500)); return window.__kitchen.frames - a; });
    check('1.5초 가만히 두면 다시 그리지 않음', idle === 0, idle);
    await p.click('#cutReset');
    check('다시 하기로 초기화', (await cuts(p)).length === 0 && (await p.textContent('#cutCount')) === '0 / 5');
    for (const x of BX) await swipe(p, x);
    await until(async () => (await cuts(p)).length === 5, 1500);
    await p.click('#cutNext'); await sleep(300);
    check('"구우러 가기"로 굽기 자리 이동', (await p.evaluate(() => window.__kitchen.S.station)) === 'oven');
    await ctx.close();

    console.log('\n── 자르기 (터치, 375×812) ──');
    const ctxM = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const m = await open(ctxM, BASE);
    await m.tap('#tabs button:text-is("자르기")'); await sleep(1100);
    const audit = () => m.evaluate(() => {
      const bad = [];
      for (const b of document.querySelectorAll('#panel button, #tabs button')) {
        const r = b.getBoundingClientRect();
        if (r.width < 44 || r.height < 44 || r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) bad.push(`${b.textContent}: ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      return bad;
    });
    const cdp = await ctxM.newCDPSession(m);
    const touch = async (x) => {
      const s = await scr(m, x, Z0 - 0.26), e = await scr(m, x, Z0 + 0.26);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s.x, y: s.y }] });
      for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: s.x + (e.x - s.x) * i / 8, y: s.y + (e.y - s.y) * i / 8 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(120);
    };
    const box = await m.evaluate(() => { const a = window.__kitchen.project(-1.31, 0.97, 0.55), b = window.__kitchen.project(-0.59, 0.97, 0.95); const top = document.getElementById('bottom').getBoundingClientRect().top; return { a, b, top, w: innerWidth }; });
    check('반죽판이 화면 안에 있고 아래 패널에 가리지 않음', box.a.x > 0 && box.b.x < box.w && box.a.y > 50 && box.b.y < box.top, box);
    await touch(BX[1]);
    const st = await m.evaluate(() => ({ y: window.scrollY, top: document.scrollingElement.scrollTop }));
    check('한 손가락 터치로 그어도 잘림', same(await cuts(m), [1]), await cuts(m));
    check('그을 때 페이지가 스크롤되지 않음', st.y === 0 && st.top === 0, st);
    let bad = await audit();
    for (let n = 0; n < 4 && (await cuts(m)).length < 5; n++) for (const x of BX) await touch(x);
    check('터치로 끝까지 자를 수 있음', (await cuts(m)).length === 5, await cuts(m));
    await sleep(500);
    bad = bad.concat(await audit());
    check('패널 버튼이 화면 안에 있고 44px 이상 (진행 중·완성)', bad.length === 0, bad);
    await m.screenshot({ path: path.join(__dirname, 'out', 'cut-mobile.png') });
    await ctxM.close();

    console.log('\n── 자르기 (둘이 굽기, 같은 기기 안 통신) ──');
    const ctxD = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const url = `${BASE}?net=bc#r=cut${Math.random().toString(36).slice(2, 8)}`;
    const A = await open(ctxD, url);
    await until(() => A.evaluate(() => window.__duo.mode === 'waiting'));
    await tab(A, '자르기');
    await swipe(A, BX[0]); await swipe(A, BX[3]);
    const before = await cuts(A);
    const B = await open(ctxD, url);
    check('연결 성립', await until(async () => (await A.evaluate(() => window.__duo.mode)) === 'on' && (await B.evaluate(() => window.__duo.mode)) === 'on', 15000));
    check('늦게 들어온 쪽에 잘린 상태 복원', before.length === 2 && await until(async () => same(await cuts(B), before)), [before, await cuts(B)]);
    await until(() => B.evaluate(() => window.__kitchen.S.station === 'cut')); await sleep(1200);
    await swipe(A, BX[1]);
    check('A 가 자른 것이 B 에 반영', await until(async () => (await cuts(A)).length === 3 && same(await cuts(A), await cuts(B))), [await cuts(A), await cuts(B)]);
    for (let n = 0; n < 4 && (await cuts(B)).length < 5; n++) for (const x of BX) await swipe(B, x);
    check('B 가 마저 자르면 양쪽 모두 완성', await until(async () => (await cuts(A)).length === 5 && (await A.textContent('#panel')).includes('막대 완성!') && (await B.textContent('#panel')).includes('막대 완성!')), [await cuts(A), await cuts(B)]);
    await B.click('#cutReset');
    check('다시 하기가 상대에게도 반영', await until(async () => (await cuts(A)).length === 0 && (await A.textContent('#cutCount')) === '0 / 5'));
    await ctxD.close();
  } catch (e) {
    check('검사 도중 오류 없음', false, String(e && e.message));
  }
  await browser.close(); server.close();
  const fail = results.filter((r) => !r).length;
  console.log(`\n합계: ${results.length}개 중 통과 ${results.length - fail}, 실패 ${fail}`);
  process.exitCode = fail ? 1 : 0;
})();
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
