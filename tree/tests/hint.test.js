// 옆으로 넘기는 목록의 ‹ › 띠 검사 (긴 목록에서 › 가 보임 · 누르면 넘어감 · 끝에서 사라짐 · ‹ 로 돌아옴 · 목록의 단추를 가로막지 않음 · 판을 닫으면 사라짐). 실행: cd tree/tests && node hint.test.js (포트 8214)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8214, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const T = (p, fn, arg) => p.evaluate(fn, arg);
// 보이는 띠와 목록의 넘긴 정도
const H = (p, id) => T(p, (id) => {
  const box = document.getElementById(id), r = box.getBoundingClientRect();
  const arrows = [...document.querySelectorAll('.sarrow:not([hidden])')].map((e) => { const a = e.getBoundingClientRect(); return { side: e.classList.contains('l') ? 'l' : 'r', x: a.left, y: a.top, w: a.width, h: a.height }; })
    .filter((a) => a.y < r.bottom && a.y + a.h > r.top);
  return { left: box.scrollLeft, over: box.scrollWidth - box.clientWidth, box: { x: r.left, y: r.top, w: r.width, h: r.height }, sides: arrows.map((a) => a.side).sort().join(''), arrows };
}, id);
const tapArrow = async (p, id, side) => { const a = (await H(p, id)).arrows.find((x) => x.side === side); if (!a) return false; await p.touchscreen.tap(a.x + a.w / 2, a.y + a.h / 2); return true; };

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await ctx.newPage();
    await A.addInitScript(() => localStorage.setItem('tree.master.hta', 'de94e28d7a302b52374831e94e8c70adddf861c691e77ab53f0646f55543a3e7')); // 달력으로 잠긴 가구가 없게
    A.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
    await A.goto(`${BASE}?net=bc&door=0&ns=hta`);
    await until(() => A.evaluate(() => !!(window.__tree && window.__tree.frames > 3)), 30000);
    if (await A.isVisible('#lookDone')) await A.click('#lookDone');
    await sleep(400);
    check('판이 닫혀 있을 때는 띠가 없음', (await T(A, () => window.__hint.shown)).length === 0, await T(A, () => window.__hint.shown));

    /* 가구 목록 */
    await A.tap('#tabs button[data-m="furn"]');
    check('긴 가구 목록의 오른쪽 끝에 › 띠만 보임 (왼쪽은 처음이라 없음)', await until(async () => (await H(A, 'furnList')).sides === 'r', 4000), await H(A, 'furnList'));
    const h0 = await H(A, 'furnList'), r0 = h0.arrows[0];
    check('띠는 목록의 오른쪽 끝에 딱 붙어 있고 목록 높이만큼', r0 && Math.abs(r0.x + r0.w - (h0.box.x + h0.box.w)) < 1.5 && Math.abs(r0.y - h0.box.y) < 1.5 && Math.abs(r0.h - h0.box.h) < 1.5 && r0.w <= 24, [r0, h0.box]);
    await A.screenshot({ path: path.join(__dirname, 'out', 'hint-furn.png') });
    await tapArrow(A, 'furnList', 'r');
    check('› 를 누르면 목록이 옆으로 넘어가고 ‹ 도 생김', await until(async () => { const h = await H(A, 'furnList'); return h.left > 100 && h.sides.includes('l'); }, 5000), await H(A, 'furnList'));
    check('띠를 눌러도 가구를 고르거나 판이 닫히지 않음', (await T(A, () => window.__tree.mode)) === 'furn' && (await T(A, () => window.__tree.ghost)) === null);
    for (let k = 0; k < 22 && (await H(A, 'furnList')).sides.includes('r'); k++) { await tapArrow(A, 'furnList', 'r'); await sleep(700); }
    const end = await H(A, 'furnList');
    check('끝까지 넘기면 › 가 사라지고 ‹ 만 남음', end.sides === 'l' && end.over - end.left <= 4, end);
    const last = await T(A, () => { const b = document.querySelector('#furnList > :last-child'); return b ? b.dataset.v || b.textContent : null; });
    await A.tap('#furnList > :last-child'); await sleep(300);
    check('끝의 가구 단추는 띠에 가려지지 않고 눌림', (await T(A, () => window.__tree.ghost)) !== null, last);
    await T(A, () => window.__tree.ghostCancel && window.__tree.ghostCancel()); await sleep(200);
    if ((await T(A, () => window.__tree.mode)) !== 'furn') await A.tap('#tabs button[data-m="furn"]');
    for (let k = 0; k < 40 && (await H(A, 'furnList')).sides.includes('l'); k++) { await tapArrow(A, 'furnList', 'l'); await sleep(700); }
    const back = await H(A, 'furnList');
    check('‹ 로 처음까지 돌아오면 ‹ 가 사라짐', back.sides === 'r' && back.left <= 4, back);
    await A.tap('#furnList > :first-child'); await sleep(300);
    check('처음의 가구 단추도 눌림', (await T(A, () => window.__tree.ghost)) !== null);
    await T(A, () => window.__tree.ghostCancel && window.__tree.ghostCancel());
    await T(A, () => window.__tree.setMode(null));
    check('판을 닫으면 띠도 사라짐', await until(async () => (await T(A, () => window.__hint.shown)).length === 0, 3000), await T(A, () => window.__hint.shown));

    /* 옷 목록 */
    await A.tap('#tabs button[data-m="look"]');
    check('옷 목록에도 › 띠가 보임', await until(async () => (await H(A, 'pickOutfit')).sides === 'r', 4000), await H(A, 'pickOutfit'));
    await tapArrow(A, 'pickOutfit', 'r');
    check('옷 목록도 › 로 넘어감', await until(async () => (await H(A, 'pickOutfit')).left > 60, 5000), await H(A, 'pickOutfit'));
    await A.tap('#cosTabs [data-v="eye"]'); await sleep(500);
    check('짧은 목록(안경)에는 띠가 없음', (await T(A, () => window.__hint.shown)).length === 0, await T(A, () => window.__hint.shown));
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) { check('검사가 끝까지 돌았음', false, String(e && e.stack || e).slice(0, 400)); }
  finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
