// 반죽 자리 자동 검사.  실행: cd kitchen/tests && NODE_PATH=$(npm root -g) node dough.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8141, BASE = `http://localhost:${PORT}/kitchen/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.txt': 'text/plain' };
const results = [];
function check(name, ok, detail) {
  results.push(!!ok);
  console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && detail !== undefined ? '  → ' + JSON.stringify(detail) : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000) {
  const t = Date.now();
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch (_) { /* 다시 */ }
    if (Date.now() - t > ms) return false;
    await sleep(100);
  }
}
const prog = (p) => p.evaluate(() => window.__kitchen.getState().x.dough.p);
const mode = (p) => p.evaluate(() => window.__duo.mode);
async function open(ctx, url) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('   (페이지 오류)', e.message));
  await p.goto(url);
  await until(() => p.evaluate(() => !!(window.__kitchen && window.__duo)));
  return p;
}
const bowl = (p) => p.evaluate(() => window.__kitchen.project(1.1, 1.06, -1.72));
// 그릇 위를 원으로 문지른다. turns 바퀴, 반지름 r px
async function circle(p, turns, r = 42) {
  const c = await bowl(p), n = Math.round(turns * 24);
  await p.mouse.move(c.x + r, c.y); await p.mouse.down();
  for (let i = 1; i <= n; i++) { const a = (i / 24) * Math.PI * 2; await p.mouse.move(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r); }
  await p.mouse.up();
}

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); } });
  }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    console.log('── 반죽 자리 (마우스, 390×844) ──');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await open(ctx, BASE);
    await p.click('#tabs button:text-is("반죽")'); await sleep(1200);
    check('처음 진행도는 0, 안내와 진행 표시가 보임', (await prog(p)) === 0 && ((await p.locator('#doughBar').count()) === 1) && (await p.textContent('#panel')).includes('문질러'));
    await p.screenshot({ path: path.join(__dirname, 'out', 'dough-0.png') });
    await circle(p, 4);
    const mid = await prog(p);
    check('문지르면 진행도가 오름', mid > 0.1 && mid < 1, mid);
    check('진행 표시(%)가 따라 바뀜', (await p.textContent('#doughPct')) !== '0%', await p.textContent('#doughPct'));
    await p.screenshot({ path: path.join(__dirname, 'out', 'dough-mid.png') });
    await p.mouse.move(30, 120); await p.mouse.down(); await p.mouse.move(120, 160, { steps: 20 }); await p.mouse.up();
    check('그릇 밖을 문지르면 오르지 않음', (await prog(p)) === mid, await prog(p));
    for (let i = 0; i < 6 && (await prog(p)) < 1; i++) await circle(p, 4);
    check('계속 문지르면 진행도가 1 이 됨', (await prog(p)) === 1, await prog(p));
    check('"반죽 완성!" 과 다시 하기·자르러 가기 버튼이 뜸', await until(async () => (await p.textContent('#panel')).includes('반죽 완성') && (await p.isVisible('#doughAgain')) && (await p.isVisible('#doughNext')), 3000));
    await sleep(900);
    await p.screenshot({ path: path.join(__dirname, 'out', 'dough.png') });
    const idle = await p.evaluate(async () => { const a = window.__kitchen.frames; await new Promise((r) => setTimeout(r, 1500)); return window.__kitchen.frames - a; });
    check('1.5초 가만히 두면 다시 그리지 않음', idle === 0, idle);
    await p.click('#doughAgain');
    check('다시 하기로 진행도가 0 이 됨', (await prog(p)) === 0 && ((await p.locator('#doughBar').count()) === 1), await prog(p));
    for (let i = 0; i < 8 && (await prog(p)) < 1; i++) await circle(p, 4);
    await p.click('#doughNext');
    check('자르러 가기를 누르면 자르기 자리로 이동', await until(() => p.evaluate(() => window.__kitchen.S.station === 'cut'), 3000));
    await ctx.close();

    console.log('\n── 반죽 자리 (터치, 375×812) ──');
    const ctxM = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const m = await open(ctxM, BASE);
    await m.tap('#tabs button:text-is("반죽")'); await sleep(1200);
    const cdp = await ctxM.newCDPSession(m);
    const c = await bowl(m);
    const audit = () => m.evaluate(() => {
      const bad = [];
      for (const b of document.querySelectorAll('#panel button, #tabs button')) {
        const r = b.getBoundingClientRect();
        if (!r.width) continue;
        if (r.width < 44 || r.height < 44) bad.push(`${b.textContent.trim()}: ${Math.round(r.width)}×${Math.round(r.height)}`);
        if (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) bad.push(`${b.textContent.trim()}: 화면 밖`);
      }
      return bad;
    });
    const t0 = Date.now();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x + 40, y: c.y }] });
    for (let i = 1; i <= 24 * 5; i++) { const a = (i / 24) * Math.PI * 2; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x + Math.cos(a) * 40, y: c.y + Math.sin(a) * 40 }] }); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const pt = await prog(m);
    check('한 손가락 터치로 문질러도 진행됨', pt > 0.2, pt);
    check('문지르는 동안 페이지가 스크롤되지 않음', (await m.evaluate(() => window.scrollY === 0 && document.scrollingElement.scrollTop === 0)));
    let bad = await audit();
    for (let n = 0; n < 6 && (await prog(m)) < 1; n++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x + 40, y: c.y }] });
      for (let i = 1; i <= 24 * 5; i++) { const a = (i / 24) * Math.PI * 2; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x + Math.cos(a) * 40, y: c.y + Math.sin(a) * 40 }] }); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    check('터치로 끝까지 완성됨', (await prog(m)) === 1, [await prog(m), Date.now() - t0]);
    await sleep(500);
    bad = bad.concat(await audit());
    check('패널 버튼이 화면 안에 있고 44px 이상 (진행 중·완성 뒤)', bad.length === 0, bad);
    await m.screenshot({ path: path.join(__dirname, 'out', 'dough-mobile.png') });
    await ctxM.close();

    console.log('\n── 반죽 자리 (둘이 굽기, 같은 기기 안 통신) ──');
    const ctxD = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const url = `${BASE}?net=bc#r=dough${Math.random().toString(36).slice(2, 8)}`;
    const A = await open(ctxD, url);
    await until(async () => (await mode(A)) === 'waiting');
    await A.click('#tabs button:text-is("반죽")'); await sleep(1200);
    await circle(A, 4);
    const a1 = await prog(A);
    const B = await open(ctxD, url);
    check('연결 성립', await until(async () => (await mode(A)) === 'on' && (await mode(B)) === 'on', 15000));
    check('늦게 들어온 쪽에 반죽 진행도 복원', a1 > 0 && await until(async () => (await prog(B)) === a1), [a1, await prog(B)]);
    await until(() => B.evaluate(() => window.__kitchen.S.station === 'dough')); await sleep(1200);
    await circle(A, 3);
    const a2 = await prog(A);
    check('한쪽 진행이 다른 쪽에 반영됨 (A → B)', a2 > a1 && await until(async () => (await prog(B)) === a2), [a2, await prog(B)]);
    for (let i = 0; i < 8 && (await prog(B)) < 1; i++) await circle(B, 4);
    check('다른 쪽이 이어서 완성하면 양쪽 모두 완성 (B → A)', (await prog(B)) === 1 && await until(async () => (await prog(A)) === 1) && await until(async () => (await A.textContent('#panel')).includes('반죽 완성'), 3000), [await prog(A), await prog(B)]);
    await B.click('#doughAgain');
    check('다시 하기도 반영됨', await until(async () => (await prog(A)) === 0 && (await prog(B)) === 0));
    await ctxD.close();
  } catch (e) {
    check('검사 도중 오류 없음', false, String(e && e.message));
  }
  await browser.close(); server.close();
  const fail = results.filter((r) => !r).length;
  console.log(`\n합계: ${results.length}개 중 통과 ${results.length - fail}, 실패 ${fail}`);
  process.exitCode = fail ? 1 : 0;
})();
