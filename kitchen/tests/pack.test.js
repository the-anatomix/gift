// 포장 · 편지 · 선물 링크 검사. 실행: cd kitchen/tests && node pack.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8144, BASE = `http://localhost:${PORT}/kitchen/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 10000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(80); } }
const pack = (p) => p.evaluate(() => window.__kitchen.getState().x.pack);
async function open(ctx, url) { const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('   (페이지 오류)', e.message)); await p.goto(url); await until(() => p.evaluate(() => !!(window.__kitchen && window.__duo && window.__gift))); return p; }
const tab = async (p, n) => { await p.click(`#tabs button:text-is("${n}")`); await sleep(1100); };
const audit = (p) => p.evaluate(() => {
  const bad = [];
  for (const b of document.querySelectorAll('button, a, input, textarea')) {
    const r = b.getBoundingClientRect();
    if (!r.width || b.closest('[hidden]') || b.closest('#labels.off') || b.closest('#fallback') || getComputedStyle(b).display === 'none') continue;
    const name = (b.textContent || b.getAttribute('aria-label') || b.id || '').trim();
    if (r.width < 44 || r.height < 44) bad.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) bad.push(`${name}: 화면 밖`);
  }
  return bad;
});

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const rid = 'pack' + Math.random().toString(36).slice(2, 8);
    const A = await open(ctx, `${BASE}?net=bc#r=${rid}`);
    const B = await open(ctx, `${BASE}?net=bc#r=${rid}`);
    await until(() => B.evaluate(() => window.__duo.mode === 'on'));
    // 꾸민 과자 준비
    await A.evaluate(() => { const K = window.__kitchen; K.dispatch({ t: 'st', s: 'oven', d: { start: 1 } }); K.dispatch({ t: 'st', s: 'oven', d: { out: 0.65 } });
      K.dispatch({ t: 'coat', c: 3, len: 0.45 }); K.dispatch({ t: 'text', v: '메리' }); K.dispatch({ t: 'tcolor', c: 2 });
      for (let i = 0; i < 12; i++) K.dispatch({ t: 'grain', k: i % 4, s: 0.05 + i * 0.04, u: (i % 3 - 1) * 0.02, sp: i, sc: 1, c: 0, st: K.me + '1', id: K.me + '1.' + i }); });
    await tab(A, '포장');
    check('포장 자리: 상자 4종과 "포장 완료" 버튼이 보임', (await A.locator('#panel .sw').count()) === 4 && (await A.isVisible('#packDone')));
    check('포장 자리 버튼이 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    await A.screenshot({ path: path.join(__dirname, 'out', 'pack-open.png') });
    await A.tap('#panel .sw[data-box="1"]');
    check('상자 고르기 (상대에게도 반영)', await until(async () => (await pack(A)).box === 1 && (await pack(B)).box === 1));
    await A.tap('#packDone');
    check('포장 완료 (상대에게도 반영)', await until(async () => (await pack(A)).packed === 1 && (await pack(B)).packed === 1));
    check('포장이 끝나면 누른 사람에게 편지 쓰기 칸이 뜸', await until(() => A.isVisible('#letter'), 12000));
    check('상대 화면에는 편지 칸이 뜨지 않음', !(await B.isVisible('#letter')));
    await A.screenshot({ path: path.join(__dirname, 'out', 'pack-letter.png') });
    check('편지 칸 입력·버튼이 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    await A.tap('#ltShare');
    check('편지를 비우면 보내지 않고 안내', (await A.textContent('#toast')).includes('한 줄'));
    await A.fill('#ltTo', '지우'); await A.fill('#ltFrom', '민서'); await A.fill('#ltMsg', '메리 크리스마스!\n<b>굵게</b> & "따옴표"');
    const url = await A.evaluate(() => window.__gift.giftUrl());
    check('선물 링크 생성 (#g=…, 6000자 이하)', /#g=[A-Za-z0-9_-]+$/.test(url) && url.length < 6000, url.length);
    await A.tap('#ltShare'); await sleep(400);
    check('보내기를 누르면 공유·복사, 안 되면 링크를 보여 줌', (await A.isVisible('#ltUrl')) || (await A.textContent('#toast')).includes('복사'));
    await A.tap('#ltClose');
    check('포장 뒤 패널에 "편지 쓰기 / 다시 열기"', (await A.isVisible('#packLetter')) && (await A.isVisible('#packOpen')));
    await A.screenshot({ path: path.join(__dirname, 'out', 'pack-done.png') });
    const idle = await A.evaluate(async () => { await new Promise((r) => setTimeout(r, 600)); const a = window.__kitchen.frames; await new Promise((r) => setTimeout(r, 1500)); return window.__kitchen.frames - a; });
    check('가만히 두면 다시 그리지 않음', idle === 0, idle);

    // 받는 사람
    const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const R = await open(ctx2, url);
    check('받는 사람: "선물이 도착했어요"와 열어 보기 버튼, 탭은 숨김', (await R.isVisible('#rcOpen')) && !(await R.isVisible('#tabs')) && (await R.textContent('#recv')).includes('선물이 도착했어요'));
    check('받는 사람: 방 연결을 시도하지 않음', (await R.evaluate(() => window.__duo.mode)) === 'solo');
    const got = await R.evaluate(() => { const s = window.__kitchen.getState(); return { n: s.grains.length, t: s.text, tc: s.tc, lv: s.x.oven.lv, c: s.layers[0] && s.layers[0].c, box: s.x.pack.box, packed: s.x.pack.packed }; });
    check('받는 사람: 같은 과자·상자가 담겨 있음', got.n === 12 && got.t === '메리' && got.tc === 2 && got.lv === 2 && got.c === 3 && got.box === 1 && got.packed === 1, got);
    await sleep(800);
    await R.screenshot({ path: path.join(__dirname, 'out', 'recv-closed.png') });
    await R.tap('#rcOpen');
    check('받는 사람: 주방은 숨기고 선물만 보임', await R.evaluate(() => window.__kitchen.stage === true));
    await R.waitForTimeout(1900);
    check('열면 과자가 상자에서 솟아올라 보임', await R.evaluate(() => window.__kitchen.presenting === true && window.__kitchen.S.station === 'pack'));
    await R.screenshot({ path: path.join(__dirname, 'out', 'recv-stick.png') });
    check('잠시 뒤 편지가 저절로 펼쳐짐', await until(() => R.isVisible('#rcard'), 8000));
    check('편지 글이 글자 그대로 보임 (태그로 바뀌지 않음)', (await R.textContent('#rcMsg')) === '메리 크리스마스!\n<b>굵게</b> & "따옴표"' && (await R.evaluate(() => !document.querySelector('#rcMsg b')))
      && (await R.textContent('#rcTo')) === '지우에게' && (await R.textContent('#rcFrom')) === '민서 드림');
    await sleep(700);
    await R.screenshot({ path: path.join(__dirname, 'out', 'recv-letter.png') });
    await R.tap('#rcClose'); await sleep(200);
    check('편지지의 ✕ 로 접을 수 있음', !(await R.isVisible('#rcard')) && (await R.textContent('#rcToggle')).includes('편지 열기'));
    await R.tap('#rcToggle'); await sleep(200);
    check('"편지 열기"로 다시 펼칠 수 있음', (await R.isVisible('#rcard')) && (await R.textContent('#rcToggle')) === '편지 접기');
    await R.tap('#rcToggle'); await sleep(200);
    check('"편지 접기"로 다시 접힘', !(await R.isVisible('#rcard')));
    const before = await R.evaluate(() => window.__kitchen.S.grains.length);
    await R.mouse.move(187, 300); await R.mouse.down(); await R.mouse.move(187, 420, { steps: 8 }); await R.mouse.up();
    check('받은 과자는 문질러도 바뀌지 않음', (await R.evaluate(() => window.__kitchen.S.grains.length)) === before);
    check('받는 화면 버튼이 화면 안·44px 이상', (await audit(R)).length === 0, await audit(R));
    await R.tap('#rcMake');
    await until(() => R.evaluate(() => !!(window.__kitchen && !location.hash)));
    await sleep(800);
    check('나도 만들기 → 빈 주방으로', !(await R.evaluate(() => location.hash)) && (await R.isVisible('#tabs')) && (await R.evaluate(() => window.__kitchen.S.grains.length)) === 0);
    await ctx2.close();

    // 포장한 채로 토핑 자리로 가면 다시 열림
    await tab(A, '토핑');
    check('포장한 채 토핑 자리로 가면 상자가 다시 열림 (양쪽)', await until(async () => (await pack(A)).packed === 0 && (await pack(B)).packed === 0));
    const bad = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const X = await open(bad, `${BASE}#g=AAAAAAAAAAAA`);
    check('깨진 선물 링크는 안내만 하고 주방은 그대로 열림', (await X.isVisible('#tabs')) && (await X.textContent('#toast')).includes('읽지 못했어요'));
    await bad.close(); await ctx.close();
  } catch (e) { check('검사 도중 오류 없음', false, String(e && e.message)); }
  await browser.close(); server.close();
  const fail = results.filter((x) => !x).length;
  console.log(`\n합계: ${results.length}개 중 통과 ${results.length - fail}, 실패 ${fail}`);
  process.exitCode = fail ? 1 : 0;
})();
