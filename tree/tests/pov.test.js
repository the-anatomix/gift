// 1인칭 ↔ 내려다보는 시점 검사. 실행: cd tree/tests && node pov.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8164, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__tree.frames > 3)));
async function open(ctx, url) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const me = (p) => T(p, () => ({ x: window.__tree.me.x, z: window.__tree.me.z, moving: window.__tree.me.moving }));
const idle = (p) => until(() => T(p, () => !window.__tree.me.moving && window.__tree.me.path.length === 0), 15000);
const look = (p) => T(p, () => window.__tree.look3);
const walls = (p) => T(p, () => Object.values(window.__tree.walls).filter(Boolean).length);
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

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    /* ── 폰 ── */
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, BASE);
    await T(A, () => { const W = window.__tree; [['sofa', 1, 6, 1], ['fire', 6, 0, 0], ['lamp', 0, 15, 0]].forEach(([k, i, j, r], n) => W.dispatch({ t: 'put', id: 'p' + n, k, i, j, r })); });
    check('처음에는 내려다보는 시점: 내 아바타가 보이고 벽은 두 면, 조이스틱은 없음', (await T(A, () => window.__tree.pov)) === 'iso' && (await T(A, () => window.__tree.meShown)) && (await walls(A)) === 2 && !(await A.isVisible('#stick')) && (await A.isVisible('#turn')));
    await A.tap('#pov'); await sleep(400);
    const l0 = await look(A), m0 = await me(A);
    check('눈 모양 단추를 누르면 1인칭: 눈높이에서 보고, 내 아바타는 숨고, 벽 네 면이 다 보임', (await T(A, () => window.__tree.pov)) === 'fp' && (await T(A, () => window.__tree.eyeOn)) && !(await T(A, () => window.__tree.meShown)) && (await walls(A)) === 4 && Math.abs(l0.x - m0.x) < 1e-6 && Math.abs(l0.z - m0.z) < 1e-6 && l0.y > 1 && l0.y < 1.4, l0);
    check('1인칭에서는 조이스틱이 나오고 방 돌리기 단추는 숨음, 단추는 화면 안·44px 이상', (await A.isVisible('#stick')) && !(await A.isVisible('#turn')) && (await A.getAttribute('#pov', 'aria-pressed')) === 'true' && (await audit(A)).length === 0, await audit(A));
    await sleep(300);
    await A.screenshot({ path: path.join(__dirname, 'out', 'pov-phone.png') });
    // 끌어서 둘러보기
    const drag = async (p, x0, y0, x1, y1) => { const c = await p.context().newCDPSession(p);
      await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
      for (let k = 1; k <= 6; k++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k / 6, y: y0 + (y1 - y0) * k / 6 }] });
      await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(150); };
    await drag(A, 100, 300, 260, 340);
    const l1 = await look(A), m1 = await me(A);
    check('화면을 끌면 고개가 돌아가고, 걷지는 않음', Math.abs(l1.fy - l0.fy) > 0.5 && Math.abs(l1.fpitch - l0.fpitch) > 0.05 && m1.x === m0.x && m1.z === m0.z, { l0, l1 });
    // 방 가운데(트리)를 보게 돌린 뒤, 바닥을 눌러 걷기
    await T(A, () => { const W = window.__tree; W.me.place(3, 3); W.me.turnTo(-1, -1); W.setPov(true); });
    await sleep(300);
    const tgt = { x: 1.3, z: 1.3 };
    const s = await T(A, (t) => window.__tree.screenOf(t.x, t.z), tgt);
    check('1인칭에서 앞쪽 바닥이 화면에 보임', s.x > 0 && s.x < 375 && s.y > 60 && s.y < 640, s);
    await A.touchscreen.tap(s.x, s.y); await sleep(150); await idle(A);
    const m2 = await me(A), l2 = await look(A);
    check('바닥을 누르면 그 자리로 걸어가고 눈도 따라감', Math.hypot(m2.x - tgt.x, m2.z - tgt.z) < 0.2 && Math.abs(l2.x - m2.x) < 0.05 && Math.abs(l2.z - m2.z) < 0.05, { m2, l2 });
    // 조이스틱 (앞이 트여 있는 자리에서)
    await T(A, () => { const W = window.__tree; W.me.place(3.4, 3.4); W.me.turnTo(-1, -1); W.setPov(true); });
    await sleep(200);
    const mj = await me(A);
    const sb = await A.evaluate(() => { const r = document.getElementById('stick').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; });
    const cdp = await A.context().newCDPSession(A);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sb.x, y: sb.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sb.x, y: sb.y - sb.r * 0.8 }] });
    await sleep(700);
    const m3 = await me(A);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const fwd = await T(A, () => { const l = window.__tree.look3; return { x: -Math.sin(l.fy), z: -Math.cos(l.fy) }; });
    const along = (m3.x - mj.x) * fwd.x + (m3.z - mj.z) * fwd.z;
    check('조이스틱을 위로 밀면 보는 쪽으로 걸음', along > 0.5 && Math.hypot(m3.x - mj.x, m3.z - mj.z) - along < 0.2, { mj, m3, fwd });
    await sleep(300);
    const m4 = await me(A); await sleep(300);
    check('조이스틱에서 손을 떼면 멈춤', Math.hypot((await me(A)).x - m4.x, (await me(A)).z - m4.z) < 0.01);
    // 1인칭에서 가구 놓기
    await T(A, () => { const W = window.__tree; W.me.place(3, 1); W.lookTo(0, -1); });
    await sleep(200);
    await A.tap('#tabs button[data-m="furn"]'); await sleep(200);
    await A.tap('.more[data-list="furnList"]'); await A.tap('#furnList .pick[data-v="giftR"]'); await sleep(300);
    const fpt = await T(A, () => { const W = window.__tree, l = W.look3; return { x: W.me.x - Math.sin(l.fy) * 2.6, z: W.me.z - Math.cos(l.fy) * 2.6 }; });
    const fs2 = await T(A, (t) => window.__tree.screenOf(t.x, t.z), fpt);
    await A.touchscreen.tap(fs2.x, fs2.y); await sleep(200);
    const g = await T(A, () => window.__tree.ghost);
    check('1인칭에서 바닥을 누르면 들고 있는 가구가 그 자리로 감', g && Math.abs(-4 + (g.i + 0.5) * 0.5 - fpt.x) < 0.3 && Math.abs(-4 + (g.j + 0.5) * 0.5 - fpt.z) < 0.3 && g.ok, { g, fpt });
    await A.screenshot({ path: path.join(__dirname, 'out', 'pov-furn.png') });
    await A.tap('#gDone'); await sleep(200);
    check('1인칭에서도 "놓기"로 놓임', await T(A, () => window.__tree.S.items.size === 4 && !window.__tree.ghost));
    await A.tap('#tabs button[data-m="furn"]');
    // 1인칭에서 트리 꾸미기
    await A.tap('#tabs button[data-m="tree"]'); await sleep(200); await idle(A); await sleep(400);
    const tp = await T(A, () => { const W = window.__tree; return W.treePoint(1.3, Math.atan2(W.me.x, W.me.z)); });
    check('트리 탭을 누르면 트리 옆에 가서 트리를 바라봄', tp.x > 40 && tp.x < 335 && tp.y > 70 && tp.y < 500 && !(await A.isVisible('#stick')), tp);
    await A.touchscreen.tap(tp.x, tp.y); await sleep(200);
    check('1인칭에서 트리를 누르면 장식이 달림', (await T(A, () => window.__tree.S.orns.size)) === 1);
    await sleep(300);
    await A.screenshot({ path: path.join(__dirname, 'out', 'pov-tree.png') });
    await A.tap('#tabs button[data-m="tree"]');
    // 캐릭터 고르기는 내 모습이 보여야 한다
    await A.tap('#tabs button[data-m="look"]'); await sleep(300);
    check('캐릭터를 고를 때는 잠깐 내려다보는 시점으로 돌아가 내 모습이 보임', !(await T(A, () => window.__tree.eyeOn)) && (await T(A, () => window.__tree.meShown)) && (await walls(A)) === 2);
    await A.tap('#lookDone'); await sleep(300);
    check('다 고르면 다시 1인칭', (await T(A, () => window.__tree.eyeOn)) && !(await T(A, () => window.__tree.meShown)) && (await walls(A)) === 4);
    await A.reload(); await ready(A);
    check('다시 열어도 1인칭 그대로', (await T(A, () => window.__tree.pov)) === 'fp' && (await T(A, () => window.__tree.eyeOn)) && (await walls(A)) === 4 && (await A.isVisible('#stick')));
    await A.tap('#pov'); await sleep(300);
    check('단추를 다시 누르면 내려다보는 시점으로 돌아옴', (await T(A, () => window.__tree.pov)) === 'iso' && (await T(A, () => window.__tree.meShown)) && (await walls(A)) === 2 && !(await A.isVisible('#stick')) && (await A.isVisible('#turn')));
    await ctx.close();

    /* ── PC ── */
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const B = await open(ctx2, BASE);
    await T(B, () => { const W = window.__tree; W.me.place(3, 3); W.me.turnTo(-1, -1); W.setPov(true); });
    await sleep(300);
    const b0 = await me(B), bl = await look(B);
    await B.keyboard.down('KeyW'); await sleep(1100); await B.keyboard.up('KeyW'); await sleep(150);
    const b1 = await me(B);
    const al = (b1.x - b0.x) * -Math.sin(bl.fy) + (b1.z - b0.z) * -Math.cos(bl.fy);
    check('PC 1인칭: W 키로 보는 쪽으로 걸음', al > 0.5, { b0, b1 });
    await B.mouse.move(600, 300); await B.mouse.down(); await B.mouse.move(760, 330, { steps: 5 }); await B.mouse.up(); await sleep(100);
    check('PC 1인칭: 마우스로 끌어 둘러봄', Math.abs((await look(B)).fy - bl.fy) > 0.4);
    const f0 = (await look(B)).fy;
    await B.keyboard.press('KeyE'); await sleep(100);
    check('PC 1인칭: Q · E 키로 고개를 돌림', Math.abs((await look(B)).fy - f0) > 0.5);
    await sleep(300);
    await B.screenshot({ path: path.join(__dirname, 'out', 'pov-pc.png') });
    await ctx2.close();
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
