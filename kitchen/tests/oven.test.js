// 굽기 자리 검사. 실행: cd kitchen/tests && node oven.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8143, BASE = `http://localhost:${PORT}/kitchen/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const oven = (p) => p.evaluate(() => window.__kitchen.getState().x.oven);
async function open(ctx, url) { const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('   (페이지 오류)', e.message)); await p.goto(url); await until(() => p.evaluate(() => !!(window.__kitchen && window.__duo))); return p; }
const tab = async (p, n) => { await p.click(`#tabs button:text-is("${n}")`); await sleep(1100); };
// 화면 없는 브라우저는 그리기가 느려 누르는 순간이 밀린다. 굽기 정도 판정은 꺼낸 시점을 직접 넣어 확인한다.
const takeOut = (p, at) => p.evaluate((at) => window.__kitchen.dispatch({ t: 'st', s: 'oven', d: { out: at } }), at);

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const rid = 'oven' + Math.random().toString(36).slice(2, 8);
    const A = await open(ctx, `${BASE}?net=bc#r=${rid}`);
    await tab(A, '굽기');
    check('굽기 자리에 "굽기 시작" 버튼과 게이지가 보임', (await A.isVisible('#ovenAct')) && (await A.isVisible('#ovenBar')));
    const bb = await A.locator('#ovenAct').boundingBox();
    check('버튼이 화면 안에 있고 44px 이상', bb.width >= 44 && bb.height >= 44 && bb.x >= 0 && bb.x + bb.width <= 375 && bb.y + bb.height <= 812, bb);
    await A.tap('#ovenAct');
    check('누르면 굽기 시작 (게이지가 차오름)', await until(async () => { const o = await oven(A); return o.phase === 'baking' && o.prog > 0.1; }));
    await A.screenshot({ path: path.join(__dirname, 'out', 'oven-baking.png') });
    check('굽는 중에는 버튼이 "지금 꺼내기"로 바뀜', (await A.textContent('#ovenAct')) === '지금 꺼내기');
    await A.tap('#ovenAct');
    let o = await oven(A);
    check('"지금 꺼내기"를 누르면 굽기가 끝나고 결과가 나옴', o.done === 1 && o.lv >= 1 && (await A.textContent('#panel')).includes('구워졌어요'), o);
    await A.click('#ovenAgain'); await A.tap('#ovenAct'); await takeOut(A, 0.65);
    o = await oven(A);
    check('알맞은 구간에서 꺼내면 "알맞게 구워졌어요"', o.done === 1 && o.lv === 2 && (await A.textContent('#panel')).includes('알맞게'), o);
    await sleep(600);
    await A.screenshot({ path: path.join(__dirname, 'out', 'oven-done.png') });

    const B = await open(ctx, `${BASE}?net=bc#r=${rid}`);
    await until(() => B.evaluate(() => window.__duo.mode === 'on'));
    check('늦게 들어온 쪽에 굽기 결과 복원', await until(async () => { const x = await oven(B); return x.done === 1 && x.lv === 2; }), await oven(B));
    await sleep(1200);
    await B.click('#ovenAgain');
    check('다시 굽기가 상대에게 반영', await until(async () => (await oven(A)).done === 0 && (await oven(B)).done === 0));
    await B.click('#ovenAct'); await until(async () => (await oven(A)).phase === 'baking'); await takeOut(B, 0.2);
    check('일찍 꺼내면 덜 구워짐, 상대에게도 같은 결과', await until(async () => (await oven(A)).lv === 1 && (await oven(B)).lv === 1), [await oven(A), await oven(B)]);
    await A.click('#ovenAgain'); await sleep(200);
    await A.click('#ovenAct');
    check('끝까지 두면 저절로 꺼내지고 진하게 구워짐', await until(async () => (await oven(A)).lv === 3 && (await oven(B)).lv === 3, 9000), [await oven(A), await oven(B)]);
    const cont = await A.evaluate(() => window.__duo.continueUrl());
    const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const D = await open(ctx2, cont);
    check('이어 굽기 링크에 굽기 정도가 담김', (await oven(D)).lv === 3, await oven(D));
    await ctx2.close();
    await sleep(800);
    const idle = await A.evaluate(async () => { const a = window.__kitchen.frames; await new Promise((r) => setTimeout(r, 1500)); return window.__kitchen.frames - a; });
    check('가만히 두면 다시 그리지 않음', idle === 0, idle);
    await ctx.close();
  } catch (e) { check('검사 도중 오류 없음', false, String(e && e.message)); }
  await browser.close(); server.close();
  const fail = results.filter((x) => !x).length;
  console.log(`\n합계: ${results.length}개 중 통과 ${results.length - fail}, 실패 ${fail}`);
  process.exitCode = fail ? 1 : 0;
})();
