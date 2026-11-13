// 거실 · 걷기 · 캐릭터 고르기 검사. 실행: cd tree/tests && node room.test.js
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
  await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
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
    const sc = b.closest('.scroll'); // 옆으로 미는 목록 안의 단추는 목록 밖으로 나가 있어도 된다
    const name = (b.textContent || b.getAttribute('aria-label') || '').trim();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (!sc && (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5)) bad.push(`${name}: 화면 밖`);
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
    return { n: T._trace.length, inTree: T._trace.filter(([x, z]) => !T.grid.freeAt(x, z)).length, out: T._trace.filter(([x, z]) => x < T.box.x0 || x > T.box.x1 || z < T.box.z0 || z > T.box.z1).length }; });
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

    // 캐릭터 고르기
    check('처음 오면 캐릭터 고르기가 먼저 열림', (await A.isVisible('#look')) && (await A.evaluate(() => window.__tree.lookOpen)));
    check('고르기 판의 버튼이 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    check('성별 2가지, 옷 12가지(평상복·산타·루돌프 …. 나머지는 costume.test.js)', (await A.locator('#pickGender .chip').count()) === 2 && (await A.locator('#pickOutfit .chip').count()) === 12 && (await A.textContent('#pickOutfit')).includes('산타') && (await A.textContent('#pickOutfit')).includes('루돌프'));
    const meshes = () => A.evaluate(() => { let n = 0; window.__tree.me.root.traverse((o) => { if (o.isMesh) n++; }); return n; });
    const n0 = await meshes();
    await A.tap('#pickGender .chip[data-v="m"]');
    await A.tap('#pickOutfit .chip[data-v="santa"]');
    await sleep(200);
    const lk = await A.evaluate(() => window.__tree.look);
    check('남자 · 산타를 누르면 아바타가 바로 바뀜', lk.gender === 'm' && lk.outfit === 'santa' && (await meshes()) !== n0 && (await A.getAttribute('#pickOutfit .chip[data-v="santa"]', 'aria-pressed')) === 'true', lk);
    await until(() => A.evaluate(() => window.__tree.view.settled), 4000);
    await A.screenshot({ path: path.join(__dirname, 'out', 'look-phone.png') });
    const inUse = () => A.evaluate(() => { const T = window.__tree, v = T.view, a = T.screenOf(T.me.x, T.me.z, 0), b = T.screenOf(T.me.x, T.me.z, 1.45);
      return { ok: b.y >= v.top - 1 && a.y <= innerHeight - v.bottom + 1 && a.x > 20 && a.x < innerWidth - 20, tall: a.y - b.y }; });
    const u1 = await inUse();
    check('고르는 동안 아바타가 판에 가려지지 않고 크게 보임', u1.ok && u1.tall > 90, u1);
    for (const g of ['f', 'm']) for (const o of ['basic', 'santa', 'rudolph']) {
      await A.tap(`#pickGender .chip[data-v="${g}"]`); await A.tap(`#pickOutfit .chip[data-v="${o}"]`); await sleep(120);
    }
    check('여섯 가지 조합을 모두 눌러도 오류 없음', errors.length === 0 && (await A.evaluate(() => window.__tree.look.outfit)) === 'rudolph', errors);
    await A.tap('#lookDone');
    check('"다 골랐어요"를 누르면 판이 닫히고 아래 탭이 남음', !(await A.isVisible('#look')) && (await A.isVisible('#tabs')) && (await A.evaluate(() => window.__tree.mode)) === null);
    check('버튼이 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));

    // 폰에서는 아바타를 따라가며 크게 보여 준다
    await until(() => A.evaluate(() => window.__tree.view.settled), 4000);
    await sleep(500);
    const v0 = await A.evaluate(() => window.__tree.view), u2 = await inUse();
    check('폰 처음 배율: 방을 당겨서 아바타가 크게 보임', !v0.whole && v0.pxu > 50 && u2.ok && u2.tall > 60, { v0, u2 });
    check('아바타가 처음에 빈칸에 서 있음', await A.evaluate(() => window.__tree.grid.fits(window.__tree.me.x, window.__tree.me.z)));
    await A.screenshot({ path: path.join(__dirname, 'out', 'room-phone.png') });
    // 가까운 바닥을 눌러 걷기
    const start = await pos(A);
    const near = { x: start.x + 1.2, z: start.z - 0.4 };
    const sn = await A.evaluate((t) => window.__tree.screenOf(t.x, t.z), near);
    await A.touchscreen.tap(sn.x, sn.y);
    check('바닥을 누르면 걷기 시작', await until(async () => (await pos(A)).moving, 2000));
    await idle(A);
    const en = await pos(A);
    check('누른 자리까지 걸어감', Math.hypot(en.x - near.x, en.z - near.z) < 0.15, en);
    // 멀리 걸어가도 화면이 따라온다
    await A.evaluate(() => window.__tree.goTo(-3.4, -3.2)); await sleep(150); await idle(A); await sleep(900);
    const u3 = await inUse();
    check('방 반대편 구석까지 걸어가도 아바타가 화면 안에 있음', u3.ok, u3);

    // 크게·작게 보기
    await A.tap('#zin'); await until(() => A.evaluate(() => window.__tree.view.settled), 4000);
    const v1 = await A.evaluate(() => window.__tree.view);
    check('＋ 를 누르면 더 크게 보임', v1.pxu > v0.pxu * 1.2, { a: v0.pxu, b: v1.pxu });
    for (let k = 0; k < 8; k++) await A.tap('#zout');
    await until(() => A.evaluate(() => window.__tree.view.settled), 4000); await sleep(400);
    const fitOk = () => A.evaluate(() => { const T = window.__tree, H = T.HALF, v = T.view;
      const pts = []; for (const x of [T.box.x0, T.box.x1]) for (const z of [T.box.z0, T.box.z1]) for (const y of [0, 2.7]) pts.push(T.screenOf(x, z, y));
      return pts.every((s) => s.x >= 0 && s.x <= innerWidth && s.y >= v.top - 7 && s.y <= innerHeight - v.bottom + 7); });
    check('－ 를 끝까지 누르면 방 전체가 위 막대와 아래 판 사이에 들어옴', (await A.evaluate(() => window.__tree.view.whole)) && (await fitOk()));
    await A.screenshot({ path: path.join(__dirname, 'out', 'room-phone-whole.png') });

    // 아래부터는 방 전체 보기에서 확인한다
    const tgt = { x: 3.2, z: -2.4 };
    const s = await A.evaluate((t) => window.__tree.screenOf(t.x, t.z), tgt);
    await A.touchscreen.tap(s.x, s.y); await sleep(150); await idle(A);
    const end = await pos(A);
    check('방 전체 보기에서도 누른 자리까지 걸어감', Math.hypot(end.x - tgt.x, end.z - tgt.z) < 0.15, end);

    // 트리 건너편으로: 돌아서 간다
    const t1 = await walkAndTrace(A, () => A.evaluate(() => window.__tree.goTo(-3.1, 2.4)));
    const e1 = await pos(A);
    check('트리 건너편까지 감', Math.hypot(e1.x + 3.1, e1.z - 2.4) < 0.15, e1);
    check('가는 길에 트리 자리를 밟지 않음', t1.n > 20 && t1.inTree === 0 && t1.out === 0, t1);

    // 트리를 누르면 그 옆까지만
    const c = await A.evaluate(() => window.__tree.screenOf(0, 0));
    const t2 = await walkAndTrace(A, () => A.touchscreen.tap(c.x, c.y));
    const e2 = await pos(A);
    check('트리 한가운데를 누르면 트리 옆 빈칸에서 멈춤', (await A.evaluate(() => window.__tree.grid.fits(window.__tree.me.x, window.__tree.me.z))) && Math.hypot(e2.x, e2.z) < 2.2 && t2.inTree === 0, { e2, t2 });

    // 방 밖(벽·빈 곳)을 누르면 그대로
    const before = await pos(A);
    await A.touchscreen.tap(187, 110); await sleep(400);
    const after = await pos(A);
    check('방 밖을 누르면 움직이지 않음', Math.hypot(after.x - before.x, after.z - before.z) < 0.01);

    // 방 돌려 보기
    const w0 = await A.evaluate(() => window.__tree.walls);
    check('처음에는 뒤쪽 벽 두 면만 보임', w0.n && w0.w && !w0.s && !w0.e, w0);
    await A.tap('#turn');
    await until(() => A.evaluate(() => !window.__tree.turning), 5000);
    const w1 = await A.evaluate(() => window.__tree.walls);
    check('돌려 보면 보이는 벽 두 면이 바뀜', (await A.evaluate(() => window.__tree.yawK)) === 1 && Object.values(w1).filter(Boolean).length === 2 && (w1.n !== w0.n || w1.w !== w0.w), w1);
    await sleep(500);
    check('돌린 뒤에도 방 전체가 화면 안', await fitOk());
    await A.screenshot({ path: path.join(__dirname, 'out', 'room-phone-turned.png') });
    // 돌린 뒤에도 누른 자리로 간다
    const tgt2 = { x: 2.8, z: 3.2 };
    const s2 = await A.evaluate((t) => window.__tree.screenOf(t.x, t.z), tgt2);
    await A.touchscreen.tap(s2.x, s2.y); await sleep(150); await idle(A);
    const e3 = await pos(A);
    check('방을 돌린 뒤에도 누른 자리로 감', Math.hypot(e3.x - tgt2.x, e3.z - tgt2.z) < 0.15, e3);
    for (let k = 0; k < 3; k++) { await A.tap('#turn'); await until(() => A.evaluate(() => !window.__tree.turning), 5000); }
    check('네 번 돌리면 처음 방향', (await A.evaluate(() => window.__tree.yawK)) === 0);

    // 고른 캐릭터를 기억한다
    await A.tap('#tabs button[data-m="look"]'); await A.tap('#pickGender .chip[data-v="f"]'); await A.tap('#pickOutfit .chip[data-v="santa"]'); await A.tap('#lookDone');
    await A.reload();
    await until(() => A.evaluate(() => !!(window.__tree && window.__tree.frames > 3)));
    const lk2 = await A.evaluate(() => window.__tree.look);
    check('다시 열면 고른 캐릭터 그대로, 고르기 판은 안 뜸', lk2.gender === 'f' && lk2.outfit === 'santa' && !(await A.isVisible('#look')) && (await A.isVisible('#tabs')), lk2);
    await A.evaluate(() => localStorage.setItem('nolja-tree-look', '{"gender":"x","outfit":"<b>"}'));
    await A.reload();
    await until(() => A.evaluate(() => !!(window.__tree && window.__tree.frames > 3)));
    const lk3 = await A.evaluate(() => window.__tree.look);
    check('저장된 값이 이상하면 기본 캐릭터로 열림', lk3.gender === 'f' && lk3.outfit === 'basic', lk3);

    // 낮은 화질로 내려가도 계속 그려짐
    const f0 = await A.evaluate(() => { window.__tree.lowerQuality(); return window.__tree.frames; });
    await sleep(500);
    check('화질을 낮춰도 계속 그려짐', (await A.evaluate(() => window.__tree.quality)) === 'low' && (await A.evaluate(() => window.__tree.frames)) > f0);
    await ctx.close();

    /* ── PC 화면: 키보드 ── */
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const B = await open(ctx2, BASE);
    await sleep(300);
    await B.click('#lookDone'); await sleep(600);
    // 마당이 생겨 세상이 넓어져서, PC 에서도 처음에는 아바타를 따라가며 보여 준다
    const pcMe = await B.evaluate(() => { const T = window.__tree, a = T.screenOf(T.me.x, T.me.z, 0); return { whole: T.view.whole, x: a.x, y: a.y, pxu: T.view.pxu }; });
    check('PC 처음 배율: 아바타를 따라가며 화면 가운데쯤에 크게 보임', !pcMe.whole && pcMe.x > 200 && pcMe.x < 1080 && pcMe.y > 150 && pcMe.y < 700, pcMe);
    await B.evaluate(() => { window.__tree.setZoomMul(0.01); window.__tree.snapView(); }); await sleep(300);
    check('PC 에서 끝까지 작게 보면 집(1층) 전체가 화면 안', (await B.evaluate(() => window.__tree.view.whole)) && await B.evaluate(() => { const T = window.__tree, H = T.HALF; for (const x of [T.box.x0, T.box.x1]) for (const z of [T.box.z0, T.box.z1]) for (const y of [0, 2.7]) { const s = T.screenOf(x, z, y); if (s.x < 0 || s.x > innerWidth || s.y < 0 || s.y > innerHeight) return false; } return true; }));
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
    const t4 = await walkAndTrace(B, async () => { await B.keyboard.down('KeyD'); await sleep(3500); await B.keyboard.up('KeyD'); });
    check('방향키로 방 밖으로 나갈 수 없음', t4.out === 0 && t4.inTree === 0, t4);
    const p0 = (await B.evaluate(() => window.__tree.view)).pxu;
    await B.mouse.move(640, 400); await B.mouse.wheel(0, -400);
    await until(() => B.evaluate(() => window.__tree.view.settled), 4000);
    check('휠을 올리면 크게 보임', (await B.evaluate(() => window.__tree.view)).pxu > p0 * 1.2);
    await B.keyboard.press('KeyE'); await until(() => B.evaluate(() => !window.__tree.turning), 5000);
    check('E 키로 방을 돌려 봄', (await B.evaluate(() => window.__tree.yawK)) === 1);
    await B.screenshot({ path: path.join(__dirname, 'out', 'room-pc.png') });
    await ctx2.close();

    /* 방문: 다가가면 열리고 지나가면 닫힌다 */
    const ctx3 = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const D = await ctx3.newPage();
    D.on('pageerror', (e) => { errors.push(e.message); });
    await D.goto(BASE + '?ns=rd'); await until(() => D.evaluate(() => !!(window.__tree && window.__tree.frames > 3)), 20000);
    if (await D.isVisible('#lookDone')) await D.click('#lookDone');
    const doors = () => D.evaluate(() => window.__tree.room.doors.map((d) => d.open));
    const still = () => until(() => D.evaluate(() => !window.__tree.me.moving && !window.__tree.me.path.length), 15000);
    await D.evaluate(() => { window.__tree.me.stop(); window.__tree.me.place(0, 3); }); await sleep(500);
    check('문이 세 개(방의 거실 쪽·주방 쪽, 현관) 있고, 멀리 있을 때는 닫혀 있음', JSON.stringify(await doors()) === '[0,0,0]', await doors());
    let seen = 0;
    await D.evaluate(() => window.__tree.goTo(8, 3));
    for (let k = 0; k < 120 && (await D.evaluate(() => window.__tree.me.x)) < 7.9; k++) { seen = Math.max(seen, (await doors())[0]); await sleep(50); }
    await still();
    const inBed = await D.evaluate(() => [window.__tree.me.x, window.__tree.me.z]);
    check('거실에서 방으로 걸어가면 문이 열려서 지나갈 수 있음', seen > 0.9 && Math.hypot(inBed[0] - 8, inBed[1] - 3) < 0.3, { seen, inBed });
    check('방 안으로 들어가 문에서 멀어지면 다시 닫힘', await until(async () => (await doors())[0] === 0, 4000), await doors());
    await D.evaluate(() => { window.__tree.me.stop(); window.__tree.me.place(8.75, 0.2); });
    check('주방 쪽 문도 다가가면 열림 (거실 쪽 문과 현관문은 그대로 닫혀 있음)', await until(async () => (await doors())[1] === 1, 4000) && (await doors())[0] === 0 && (await doors())[2] === 0, await doors());
    await D.evaluate(() => { window.__tree.me.stop(); window.__tree.me.place(8.75, -2.5); });
    check('멀어지면 닫힘', await until(async () => (await doors())[1] === 0, 4000));
    check('내려다볼 때는 문짝 윗부분이 숨고(낮은 벽처럼), 1인칭에서는 다 보임', await D.evaluate(() => { const W = window.__tree, up = () => W.room.doors[0].leaf.children.filter((m) => m.visible).length; const a = up(); W.setPov(true); const b = up(); W.setPov(false); return a < b && up() === a; }));
    await ctx3.close();

    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
