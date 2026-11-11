// 거실 · 걷기 검사. 실행: cd tree/tests && node room.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8161, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
async function open(ctx, url) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url);
  await until(() => p.evaluate(() => !!(window.__tree && window.__tree.frames > 3)));
  return p;
}
const pos = (p) => p.evaluate(() => ({ x: window.__tree.me.x, z: window.__tree.me.z, moving: window.__tree.me.moving }));
const idle = (p) => until(async () => !(await pos(p)).moving && (await p.evaluate(() => window.__tree.me.path.length === 0)), 15000);
const audit = (p) => p.evaluate(() => {
  const bad = [];
  for (const b of document.querySelectorAll('button, a')) {
    const r = b.getBoundingClientRect();
    if (!r.width || b.closest('[hidden]') || getComputedStyle(b).display === 'none') continue;
    const name = (b.textContent || b.getAttribute('aria-label') || '').trim();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) bad.push(`${name}: 화면 밖`);
  }
  return bad;
});
// 걷는 동안 자리를 계속 적어 두었다가, 막힌 칸(트리 자리)에 들어간 적이 있는지 본다
async function walkAndTrace(p, act) {
  await p.evaluate(() => { const T = window.__tree; T._trace = []; T._tk = setInterval(() => T._trace.push([T.me.x, T.me.z]), 16); });
  await act();
  await sleep(150);
  await idle(p);
  return p.evaluate(() => { const T = window.__tree; clearInterval(T._tk);
    return { n: T._trace.length, inTree: T._trace.filter(([x, z]) => !T.grid.freeAt(x, z)).length, out: T._trace.filter(([x, z]) => Math.abs(x) > T.HALF || Math.abs(z) > T.HALF).length }; });
}

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    /* ── 폰 화면 ── */
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, BASE);
    await sleep(400);
    check('거실이 열리고 화면이 그려짐', (await A.evaluate(() => window.__tree.frames)) > 3 && !(await A.isVisible('#fallback')));
    check('버튼이 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    const fitOk = await A.evaluate(() => { const T = window.__tree, H = T.HALF, top = document.getElementById('top').getBoundingClientRect().bottom, bottom = document.getElementById('bottom').getBoundingClientRect().top;
      const pts = []; for (const x of [-H, H]) for (const z of [-H, H]) for (const y of [0, 2.5]) pts.push(T.screenOf(x, z, y));
      return pts.every((s) => s.x >= 0 && s.x <= innerWidth && s.y >= top && s.y <= bottom); });
    check('방 전체가 위 막대와 아래 판 사이에 들어옴', fitOk);
    check('아바타가 처음에 빈칸에 서 있음', await A.evaluate(() => window.__tree.grid.fits(window.__tree.me.x, window.__tree.me.z)));
    await A.screenshot({ path: path.join(__dirname, 'out', 'room-phone.png') });

    // 바닥을 눌러 걷기
    const start = await pos(A);
    const tgt = { x: 2.3, z: -1.6 };
    const s = await A.evaluate((t) => window.__tree.screenOf(t.x, t.z), tgt);
    await A.touchscreen.tap(s.x, s.y);
    check('바닥을 누르면 걷기 시작', await until(async () => (await pos(A)).moving, 2000));
    await idle(A);
    const end = await pos(A);
    check('누른 자리까지 걸어감', Math.hypot(end.x - tgt.x, end.z - tgt.z) < 0.15 && Math.hypot(end.x - start.x, end.z - start.z) > 1, end);

    // 트리 건너편으로: 돌아서 간다
    const t1 = await walkAndTrace(A, () => A.evaluate(() => window.__tree.goTo(-2.3, 1.2)));
    const e1 = await pos(A);
    check('트리 건너편까지 감', Math.hypot(e1.x + 2.3, e1.z - 1.2) < 0.15, e1);
    check('가는 길에 트리 자리를 밟지 않음', t1.n > 20 && t1.inTree === 0 && t1.out === 0, t1);

    // 트리를 누르면 그 옆까지만
    const c = await A.evaluate(() => window.__tree.screenOf(0, 0));
    const t2 = await walkAndTrace(A, () => A.touchscreen.tap(c.x, c.y));
    const e2 = await pos(A);
    check('트리 한가운데를 누르면 트리 옆 빈칸에서 멈춤', (await A.evaluate(() => window.__tree.grid.fits(window.__tree.me.x, window.__tree.me.z))) && Math.hypot(e2.x, e2.z) < 2.2 && t2.inTree === 0, { e2, t2 });

    // 방 밖(벽·빈 곳)을 누르면 그대로
    const before = await pos(A);
    await A.touchscreen.tap(187, 120); await sleep(400);
    const after = await pos(A);
    check('방 밖을 누르면 움직이지 않음', Math.hypot(after.x - before.x, after.z - before.z) < 0.01);

    // 방 돌려 보기
    const w0 = await A.evaluate(() => window.__tree.walls);
    check('처음에는 뒤쪽 벽 두 면만 보임', w0.n && w0.w && !w0.s && !w0.e, w0);
    await A.tap('#turn');
    await until(() => A.evaluate(() => !window.__tree.turning), 5000);
    const w1 = await A.evaluate(() => window.__tree.walls);
    check('돌려 보면 보이는 벽 두 면이 바뀜', (await A.evaluate(() => window.__tree.yawK)) === 1 && Object.values(w1).filter(Boolean).length === 2 && (w1.n !== w0.n || w1.w !== w0.w), w1);
    await sleep(300);
    await A.screenshot({ path: path.join(__dirname, 'out', 'room-phone-turned.png') });
    // 돌린 뒤에도 누른 자리로 간다
    const tgt2 = { x: 1.8, z: 2.2 };
    const s2 = await A.evaluate((t) => window.__tree.screenOf(t.x, t.z), tgt2);
    await A.touchscreen.tap(s2.x, s2.y); await sleep(150); await idle(A);
    const e3 = await pos(A);
    check('방을 돌린 뒤에도 누른 자리로 감', Math.hypot(e3.x - tgt2.x, e3.z - tgt2.z) < 0.15, e3);
    for (let k = 0; k < 3; k++) { await A.tap('#turn'); await until(() => A.evaluate(() => !window.__tree.turning), 5000); }
    check('네 번 돌리면 처음 방향', (await A.evaluate(() => window.__tree.yawK)) === 0);

    // 낮은 화질로 내려가도 계속 그려짐
    const f0 = await A.evaluate(() => { window.__tree.lowerQuality(); return window.__tree.frames; });
    await sleep(500);
    check('화질을 낮춰도 계속 그려짐', (await A.evaluate(() => window.__tree.quality)) === 'low' && (await A.evaluate(() => window.__tree.frames)) > f0);
    await ctx.close();

    /* ── PC 화면: 키보드 ── */
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const B = await open(ctx2, BASE);
    await sleep(300);
    const b0 = await pos(B);
    const sy0 = (await B.evaluate(() => window.__tree.screenOf(window.__tree.me.x, window.__tree.me.z))).y;
    await B.keyboard.down('ArrowUp'); await sleep(500); await B.keyboard.up('ArrowUp'); await sleep(200);
    const b1 = await pos(B);
    const sy1 = (await B.evaluate(() => window.__tree.screenOf(window.__tree.me.x, window.__tree.me.z))).y;
    check('위 방향키를 누르면 화면 위쪽으로 걸음', Math.hypot(b1.x - b0.x, b1.z - b0.z) > 0.3 && sy1 < sy0 - 5, { b0, b1 });
    // 트리 쪽으로 계속 걸어도 트리 안으로 들어가지 않는다
    const t3 = await walkAndTrace(B, async () => { await B.keyboard.down('KeyW'); await sleep(2500); await B.keyboard.up('KeyW'); });
    check('방향키로 트리를 뚫고 지나갈 수 없음', t3.inTree === 0 && t3.out === 0, t3);
    // 벽 쪽으로 계속 걸어도 방 밖으로 나가지 않는다
    const t4 = await walkAndTrace(B, async () => { await B.keyboard.down('KeyD'); await sleep(3000); await B.keyboard.up('KeyD'); });
    check('방향키로 방 밖으로 나갈 수 없음', t4.out === 0 && t4.inTree === 0, t4);
    await B.keyboard.press('KeyE'); await until(() => B.evaluate(() => !window.__tree.turning), 5000);
    check('E 키로 방을 돌려 봄', (await B.evaluate(() => window.__tree.yawK)) === 1);
    check('PC 에서도 방 전체가 화면 안', await B.evaluate(() => { const T = window.__tree, H = T.HALF; for (const x of [-H, H]) for (const z of [-H, H]) for (const y of [0, 2.5]) { const s = T.screenOf(x, z, y); if (s.x < 0 || s.x > innerWidth || s.y < 0 || s.y > innerHeight) return false; } return true; }));
    await B.screenshot({ path: path.join(__dirname, 'out', 'room-pc.png') });
    await ctx2.close();

    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
