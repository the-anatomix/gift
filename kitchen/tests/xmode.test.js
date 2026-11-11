// 1인/2인 고르기 · 둘이 서로 선물 검사. 실행: cd kitchen/tests && node xmode.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8145, BASE = `http://localhost:${PORT}/kitchen/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(80); } }
async function open(ctx, url) { const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('   (페이지 오류)', e.message)); await p.goto(url); await until(() => p.evaluate(() => !!(window.__kitchen && window.__duo && window.__gift))); return p; }
const mode = (p) => p.evaluate(() => window.__duo.mode);
const n = (p) => p.evaluate(() => window.__kitchen.S.grains.length);
const audit = (p) => p.evaluate(() => {
  const bad = [];
  for (const b of document.querySelectorAll('button, a')) {
    const r = b.getBoundingClientRect();
    if (!r.width || b.closest('[hidden]') || b.closest('#labels.off') || b.closest('#fallback') || getComputedStyle(b).display === 'none') continue;
    const name = (b.textContent || b.getAttribute('aria-label') || '').trim();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) bad.push(`${name}: 화면 밖`);
  }
  return bad;
});
const decorate = (p, k, count) => p.evaluate(({ k, count }) => { const K = window.__kitchen; K.dispatch({ t: 'coat', c: k, len: 0.4 });
  for (let i = 0; i < count; i++) K.dispatch({ t: 'grain', k, s: 0.05 + i * 0.03, u: 0, sp: i, sc: 1, c: 0, st: K.me + '1', id: K.me + '1.' + i }); }, { k, count });
async function packAndGive(p, msg) {
  await p.click('#tabs button:text-is("포장")'); await sleep(1100);
  await p.tap('#packDone');
  await until(() => p.isVisible('#letter'), 15000);
  await p.fill('#ltMsg', msg);
}

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, `${BASE}?net=bc`);
    await sleep(600);
    check('처음 화면에 혼자 / 둘이 같이 / 둘이 서로 선물 고르기가 보임', (await A.isVisible('#chooseSolo')) && (await A.isVisible('#homeAction')) && (await A.isVisible('#chooseExchange')));
    check('고르기 버튼이 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    await A.screenshot({ path: path.join(__dirname, 'out', 'choose.png') });
    await A.tap('#chooseSolo'); await sleep(300);
    check('혼자 굽기를 고르면 고르기가 접히고 "둘이 굽기" 버튼만 남음', !(await A.isVisible('#chooseSolo')) && (await A.textContent('#homeAction')) === '둘이 굽기' && (await mode(A)) === 'solo');
    await A.tap('#homeAction'); await sleep(300);
    check('"둘이 굽기"를 누르면 다시 고를 수 있음', await A.isVisible('#chooseExchange'));
    await A.tap('#chooseExchange');
    check('둘이 서로 선물 → 초대 링크(#x=방id)로 기다림', await until(async () => (await mode(A)) === 'waiting') && /#x=[a-z0-9]{10}$/.test(await A.evaluate(() => window.__duo.inviteUrl())));
    await decorate(A, 3, 5);
    const B = await open(ctx, await A.evaluate(() => window.__duo.inviteUrl()));
    check('링크로 들어온 쪽은 고르기 없이 바로 연결', await until(async () => (await mode(A)) === 'on' && (await mode(B)) === 'on') && (await B.evaluate(() => window.__duo.xmode)));
    check('연결 표시가 "서로 선물 중"', (await A.textContent('#duo')).includes('서로 선물 중'));
    await sleep(500);
    check('과자는 각자 것: A 가 꾸민 것이 B 에 나타나지 않음', (await n(A)) === 5 && (await n(B)) === 0);
    await decorate(B, 1, 8); await sleep(400);
    check('B 가 꾸민 것도 A 에 나타나지 않음', (await n(A)) === 5 && (await n(B)) === 8);
    await B.click('#tabs button:text-is("초콜릿")'); await sleep(1100);
    check('자리 이동도 각자', (await A.evaluate(() => window.__kitchen.S.station)) !== 'choco');

    await packAndGive(A, 'A 가 B 에게');
    check('편지 칸에 "상대에게 바로 선물하기" 버튼이 보임', await A.isVisible('#ltGive'));
    check('편지 칸 버튼이 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    await A.screenshot({ path: path.join(__dirname, 'out', 'x-letter.png') });
    await A.tap('#ltGive');
    check('보내면 편지 칸이 닫히고 "내 선물은 보냈어요"', await until(async () => !(await A.isVisible('#letter')) && (await A.textContent('#duo')).includes('보냈어요')));
    check('B 에게 "선물이 도착했어요"와 열어 보기 버튼', await until(() => B.isVisible('#giftOpen')));
    await sleep(500);
    await B.screenshot({ path: path.join(__dirname, 'out', 'x-arrived.png') });
    check('도착 표시 버튼이 화면 안·44px 이상', (await audit(B)).length === 0, await audit(B));
    await B.tap('#giftOpen'); await sleep(900);
    check('열면 A 의 과자와 상자가 보임 (탭은 숨김)', (await n(B)) === 5 && (await B.isVisible('#rcOpen')) && !(await B.isVisible('#tabs')));
    await B.tap('#rcOpen');
    await until(() => B.isVisible('#env'), 8000); await B.tap('#env');
    check('상자를 열고 봉투를 누르면 A 의 편지가 나타남', await until(() => B.isVisible('#rcard'), 8000) && (await B.textContent('#rcMsg')) === 'A 가 B 에게');
    check('돌아가는 버튼이 "내 주방으로"', (await B.textContent('#rcMake')) === '내 주방으로');
    if (await B.isVisible('#rcard')) await B.tap('#rcClose');
    await B.tap('#rcMake'); await sleep(900);
    check('내 주방으로 돌아오면 B 자신의 과자가 그대로', (await n(B)) === 8 && (await B.isVisible('#tabs')) && (await B.evaluate(() => window.__kitchen.S.layers[0].c)) === 1);
    check('돌아오면 주방이 다시 보임', await B.evaluate(() => window.__kitchen.stage === false && !window.__kitchen.presenting));
    check('선물을 보는 동안에도 연결 유지', (await mode(A)) === 'on' && (await mode(B)) === 'on');

    await packAndGive(B, 'B 가 A 에게'); await B.tap('#ltGive');
    check('반대 방향도 선물 가능 (A 에 도착)', await until(() => A.isVisible('#giftOpen')));
    await A.tap('#giftOpen'); await sleep(900); await A.tap('#rcOpen');
    await until(() => A.isVisible('#env'), 8000); await A.tap('#env');
    check('A 가 B 의 과자와 편지를 봄', await until(() => A.isVisible('#rcard'), 8000) && (await A.textContent('#rcMsg')) === 'B 가 A 에게' && (await n(A)) === 8);
    if (await A.isVisible('#rcard')) await A.tap('#rcClose');
    await A.tap('#rcMake'); await sleep(900);
    check('A 도 자기 과자로 돌아옴', (await n(A)) === 5);

    await B.close();
    check('상대가 나가면 솔로로 전환, 편지 칸은 링크 보내기만', await until(async () => (await mode(A)) === 'lost', 20000));
    await A.evaluate(() => window.__gift.openLetter());
    check('끊긴 뒤에는 "바로 선물하기"가 숨고 링크 보내기만 남음', !(await A.isVisible('#ltGive')) && (await A.isVisible('#ltShare')));
    await ctx.close();
  } catch (e) { check('검사 도중 오류 없음', false, String(e && e.message)); }
  await browser.close(); server.close();
  const fail = results.filter((x) => !x).length;
  console.log(`\n합계: ${results.length}개 중 통과 ${results.length - fail}, 실패 ${fail}`);
  process.exitCode = fail ? 1 : 0;
})();
