// "최고급 수제 초콜릿" 칭호 검사. 실행: cd kitchen/tests && node title.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8146, BASE = `http://localhost:${PORT}/kitchen/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(80); } }
async function open(ctx, url) { const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('   (페이지 오류)', e.message)); await p.goto(url); await until(() => p.evaluate(() => !!(window.__kitchen && window.__duo && window.__gift))); return p; }
const q = (p) => p.evaluate(() => window.__kitchen.grades());
const st = (p, s, d) => p.evaluate(({ s, d }) => window.__kitchen.dispatch({ t: 'st', s, d }), { s, d });
const ev = (p, a) => p.evaluate((a) => window.__kitchen.dispatch(a), a);
const tab = async (p, n) => { await p.click(`#tabs button:text-is("${n}")`); await sleep(1100); };
async function make(p, o) { // 네 자리를 정해진 정확도로 만든다
  await st(p, 'dough', { reset: true }); await st(p, 'dough', o.dough ? { p: 1, perf: 1 } : { p: 1 });
  await st(p, 'cut', { reset: true }); for (let i = 0; i < 5; i++) await st(p, 'cut', { cut: i, ok: o.cut || i ? 1 : 0 });
  await st(p, 'oven', { reset: 1 }); await st(p, 'oven', { start: 1 }); await st(p, 'oven', { out: o.oven });
  await ev(p, { t: 'uncoat' }); await ev(p, { t: 'coat', c: 0, len: o.dip });
}

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((rq, r) => { let p = decodeURIComponent(rq.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, BASE);
    let x = await q(A);
    check('처음에는 아무 점수도 없음', x.dough === 0 && x.cut === 0 && x.oven === 0 && x.choco === 0 && !x.perfect, x);

    await make(A, { dough: 1, cut: 1, oven: 0.675, dip: 0.52 });
    x = await q(A);
    check('네 가지를 모두 딱 맞추면 완벽', x.perfect && x.dough === 2 && x.cut === 2 && x.oven === 2 && x.choco === 2, x);

    // 기준이 빡빡한지: 조금씩만 벗어나도 탈락
    await st(A, 'oven', { reset: 1 }); await st(A, 'oven', { start: 1 }); await st(A, 'oven', { out: 0.675 + 0.02 });
    x = await q(A);
    check('굽기: 0.1초쯤 늦게 꺼내면 알맞게 구워져도 완벽은 아님', x.oven === 1 && !x.perfect && (await A.evaluate(() => window.__kitchen.getState().x.oven.lv)) === 2, x);
    await st(A, 'oven', { reset: 1 }); await st(A, 'oven', { start: 1 }); await st(A, 'oven', { out: 0.675 - 0.012 });
    check('굽기: 기준 안쪽이면 완벽', (await q(A)).oven === 2);
    await ev(A, { t: 'uncoat' }); await ev(A, { t: 'coat', c: 0, len: 0.52 + 0.02 });
    check('초콜릿: 금에서 조금 넘치면 완벽이 아님', (await q(A)).choco === 1);
    await ev(A, { t: 'uncoat' }); await ev(A, { t: 'coat', c: 0, len: 0.6 }); await ev(A, { t: 'coat', c: 1, len: 0.52 });
    check('초콜릿: 두 번 담그면 완벽이 아님', (await q(A)).choco === 1);
    await make(A, { dough: 0, cut: 1, oven: 0.675, dip: 0.52 });
    check('반죽: 손을 떼었다 다시 하면 완벽이 아님', (await q(A)).dough === 1 && !(await q(A)).perfect);
    await make(A, { dough: 1, cut: 0, oven: 0.675, dip: 0.52 });
    check('자르기: 한 번이라도 어긋나면 완벽이 아님', (await q(A)).cut === 1 && !(await q(A)).perfect);

    // 실제 손가락으로: 자르기 눈금 정확도
    await st(A, 'cut', { reset: true });
    await tab(A, '자르기');
    const P = (wx, wz) => A.evaluate(({ wx, wz }) => window.__kitchen.project(wx, 0.972, wz), { wx, wz });
    const swipe = async (wx) => { const a = await P(wx, 0.75 - 0.3), b = await P(wx, 0.75 + 0.3); await A.mouse.move(a.x, a.y); await A.mouse.down(); await A.mouse.move(b.x, b.y, { steps: 10 }); await A.mouse.up(); await sleep(350); };
    const SW = 0.09, X0 = -0.95 - 0.1 - 3 * SW; // 반죽판 왼쪽 끝
    await swipe(X0 + SW * 1);            // 첫 눈금에 딱
    let cs = await A.evaluate(() => window.__kitchen.getState().x.cut);
    check('자르기: 눈금에 딱 맞춰 그으면 어긋남 0', cs.cuts.length === 1 && cs.bad === 0, cs);
    await swipe(X0 + SW * 2 + 0.03 + 0.022); // 둘째 눈금에서 살짝 옆 (첫 칼집으로 벌어진 만큼 더함)
    cs = await A.evaluate(() => window.__kitchen.getState().x.cut);
    check('자르기: 눈금에서 살짝 벗어나면 잘리긴 해도 어긋남으로 셈', cs.cuts.length === 2 && cs.bad === 1, cs);
    await A.screenshot({ path: path.join(__dirname, 'out', 'title-cut.png') });

    // 실제 손가락으로: 반죽 한 번에
    await tab(A, '반죽');
    const c = await A.evaluate(() => window.__kitchen.project(1.12, 1.06, -1.7));
    await st(A, 'dough', { reset: true });
    await A.mouse.move(c.x + 50, c.y); await A.mouse.down();
    for (let i = 1; i <= 420 && (await A.evaluate(() => window.__kitchen.getState().x.dough.p)) < 1; i++) await A.mouse.move(c.x + Math.cos(i * 0.5) * 50, c.y + Math.sin(i * 0.5) * 34);
    await A.mouse.up();
    check('반죽: 손을 떼지 않고 끝까지 문지르면 완벽', (await q(A)).dough === 2, await A.evaluate(() => window.__kitchen.getState().x.dough));
    await st(A, 'dough', { reset: true });
    await A.mouse.move(c.x + 50, c.y); await A.mouse.down();
    for (let i = 1; i <= 30; i++) await A.mouse.move(c.x + Math.cos(i * 0.5) * 50, c.y + Math.sin(i * 0.5) * 34);
    await A.mouse.up(); await A.mouse.down();
    for (let i = 1; i <= 420 && (await A.evaluate(() => window.__kitchen.getState().x.dough.p)) < 1; i++) await A.mouse.move(c.x + Math.cos(i * 0.5) * 50, c.y + Math.sin(i * 0.5) * 34);
    await A.mouse.up();
    check('반죽: 중간에 손을 떼면 완성은 되지만 완벽은 아님', (await q(A)).dough === 1, await A.evaluate(() => window.__kitchen.getState().x.dough));

    // 칭호 없이 포장
    await make(A, { dough: 1, cut: 1, oven: 0.7, dip: 0.52 });
    await tab(A, '포장');
    check('포장 자리에 점수 요약이 보임 (★ 셋, ☆ 하나)', /반죽 ★ 자르기 ★ 굽기 ☆ 초콜릿 ★/.test(await A.textContent('#panel')), await A.textContent('#panel'));
    await A.tap('#packDone'); await until(() => A.isVisible('#letter'), 15000);
    await A.tap('#ltClose'); await sleep(300);
    check('★ 셋이면 "고급 수제 초콜릿" (최고급은 아님)', (await A.evaluate(() => window.__kitchen.getState().x.pack.seal)) === 1 && /🎖 고급 수제 초콜릿/.test(await A.textContent('#panel')));
    const urlS = await A.evaluate(() => { document.getElementById('ltMsg').value = '고급'; return window.__gift.giftUrl(); });
    await A.screenshot({ path: path.join(__dirname, 'out', 'title-silver.png') });
    await A.tap('#packOpen'); await sleep(1200);
    await make(A, { dough: 0, cut: 0, oven: 0.7, dip: 0.52 });
    check('★ 하나뿐이면 칭호 없음', (await q(A)).tier === 0);
    await st(A, 'dough', { reset: true });
    await ev(A, { t: 'go', s: 'home' }); await sleep(1100);
    if (await A.isVisible('#chooseSolo')) { await A.tap('#chooseSolo'); await sleep(300); }
    check('전체 화면에 다음 차례 안내 ("다음 차례: 반죽하기")', (await A.textContent('#panel')).includes('다음 차례: 반죽하기') && (await A.isVisible('#homeNext')));
    check('탭에 진행 표시 (자르기 ☆, 초콜릿 ★, 반죽은 다음 차례)', await A.evaluate(() => { const t = [...document.querySelectorAll('#tabs button')]; const f = (n) => t.find((b) => b.textContent === n); return f('자르기').dataset.g === '1' && f('초콜릿').dataset.g === '2' && f('반죽').classList.contains('next'); }));
    await A.screenshot({ path: path.join(__dirname, 'out', 'title-home.png') });
    await A.tap('#homeNext'); await sleep(1100);
    check('"하러 가기"를 누르면 그 자리로 이동', (await A.evaluate(() => window.__kitchen.S.station)) === 'dough');

    // 칭호 받고 포장
    await make(A, { dough: 1, cut: 1, oven: 0.675, dip: 0.52 });
    await tab(A, '전체'); await tab(A, '포장');
    check('모두 완벽이면 요약에 "최고급 수제!"', (await A.textContent('#panel')).includes('최고급 수제!'));
    await A.tap('#packDone'); await until(() => A.isVisible('#letter'), 15000);
    await A.fill('#ltMsg', '완벽하게 만들었어'); const url = await A.evaluate(() => window.__gift.giftUrl());
    await A.tap('#ltClose'); await sleep(300);
    check('모두 완벽이면 "최고급 수제 초콜릿" 칭호', (await A.evaluate(() => window.__kitchen.getState().x.pack.seal)) === 2 && (await A.textContent('#panel')).includes('최고급 수제 초콜릿'));
    await A.screenshot({ path: path.join(__dirname, 'out', 'title-pack.png') });

    const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const R = await open(ctx2, url);
    await sleep(700);
    check('받는 사람 화면에 칭호 표시', (await R.isVisible('#rcTitle')) && (await R.textContent('#rcTitle')).includes('최고급 수제 초콜릿'));
    await R.screenshot({ path: path.join(__dirname, 'out', 'title-recv.png') });
    await R.tap('#rcOpen'); await until(() => R.isVisible('#env'), 9000); await R.tap('#env'); await until(() => R.isVisible('#rcard'), 4000); await sleep(700);
    check('편지지에도 칭호 도장', await R.isVisible('#rcStamp'));
    await R.screenshot({ path: path.join(__dirname, 'out', 'title-letter.png') });
    const S2 = await open(ctx2, urlS); await sleep(600);
    check('고급 수제 선물은 받는 화면에 "고급 수제 초콜릿"으로 표시', (await S2.textContent('#rcTitle')).includes('🎖 고급 수제 초콜릿'));
    await ctx2.close(); await ctx.close();
  } catch (e) { check('검사 도중 오류 없음', false, String(e && e.message).slice(0, 300)); }
  await browser.close(); server.close();
  const fail = results.filter((x) => !x).length;
  console.log(`\n합계: ${results.length}개 중 통과 ${results.length - fail}, 실패 ${fail}`);
  process.exitCode = fail ? 1 : 0;
})();
