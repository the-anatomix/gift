// 가구 놓기 · 트리 꾸미기 · 벽지와 바닥 · 저장 검사. 실행: cd tree/tests && node decor.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8162, BASE = `http://localhost:${PORT}/tree/`;
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
  await p.goto(url);
  await ready(p);
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const idle = (p) => until(() => T(p, () => !window.__tree.me.moving && window.__tree.me.path.length === 0), 15000);
const settled = (p) => until(() => T(p, () => window.__tree.view.settled), 5000);
const ghost = (p) => T(p, () => window.__tree.ghost);
const items = (p) => T(p, () => [...window.__tree.S.items.values()]);
const orns = (p) => T(p, () => [...window.__tree.S.orns.values()]);
const at = (p, x, z, y = 0) => T(p, (a) => { window.__tree.snapView(); return window.__tree.screenOf(a.x, a.z, a.y); }, { x, z, y });
const cx = (i, w = 1) => -4 + (i + w / 2) * 0.5; // 칸 번호 → 방 안 좌표 (가운데)
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
// 걷는 동안 막힌 칸(트리·가구)에 들어간 적이 있는지
async function walkAndTrace(p, act) {
  await T(p, () => { const W = window.__tree; W._trace = []; W._tk = setInterval(() => W._trace.push([W.me.x, W.me.z]), 16); });
  await act();
  await sleep(150); await idle(p);
  return T(p, () => { const W = window.__tree; clearInterval(W._tk); return { n: W._trace.length, blocked: W._trace.filter(([x, z]) => !W.grid.freeAt(x, z)).length }; });
}

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    /* ── 폰 화면 ── */
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, BASE);
    await A.tap('#lookDone');
    await T(A, () => window.__tree.setZoomMul(0)); // 방 전체 보기에서 확인한다
    await settled(A); await sleep(300);

    /* 가구 */
    await A.tap('#tabs button[data-m="furn"]'); await sleep(300);
    check('가구 탭을 누르면 가구 21가지가 나옴', (await A.isVisible('#furn')) && (await A.locator('#furnList .pick').count()) === 21 && (await T(A, () => window.__tree.mode)) === 'furn');
    check('가구 판의 단추가 44px 이상', (await audit(A)).length === 0, await audit(A));
    // 목록: 접어 두면 옆으로 넘기고, "전체 보기"를 누르면 한 번에 다 보인다
    const shown = (sel) => A.evaluate((q) => { const box = document.querySelector(q), r = box.getBoundingClientRect();
      return [...box.querySelectorAll('.pick')].filter((b) => { const c = b.getBoundingClientRect(); return c.left >= r.left - 1 && c.right <= Math.min(r.right, innerWidth) + 1 && c.top >= 0 && c.bottom <= innerHeight; }).length; }, sel);
    const n0 = await shown('#furnList');
    check('접어 둔 목록은 일부만 보이고, 더 있다는 표시가 있음', n0 >= 3 && n0 < 21 && (await A.evaluate(() => document.getElementById('furnList').classList.contains('more-right'))), n0);
    await A.tap('.more[data-list="furnList"]'); await sleep(250);
    check('"전체 보기"를 누르면 가구 21가지가 한 번에 다 보임', (await shown('#furnList')) === 21 && (await A.textContent('.more[data-list="furnList"]')) === '접기' && (await audit(A)).length === 0, { n: await shown('#furnList'), bad: await audit(A) });
    await A.screenshot({ path: path.join(__dirname, 'out', 'furn-open.png') });
    const vOpen = await T(A, () => { const W = window.__tree, v = W.view, s = W.screenOf(W.me.x, W.me.z, 0); return s.y < innerHeight - v.bottom; });
    check('목록을 펼쳐도 아바타가 판에 가려지지 않음', vOpen);
    await A.tap('.more[data-list="furnList"]'); await sleep(250);
    check('"접기"를 누르면 다시 한 줄로 접힘', (await shown('#furnList')) === n0 && (await A.textContent('.more[data-list="furnList"]')) === '전체 보기');
    await A.tap('#furnList .pick[data-v="sofa"]'); await sleep(300);
    let g = await ghost(A);
    check('소파를 고르면 방에 들린 채로 나타남 (놓을 수 있는 자리)', g && g.k === 'sofa' && g.ok && !g.id && (await A.isVisible('#furnBar')) && !(await A.isVisible('#furnList')) && !(await A.isVisible('#gDel')), g);
    check('놓기·돌리기·취소 단추가 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    await A.screenshot({ path: path.join(__dirname, 'out', 'furn-ghost.png') });
    let s = await at(A, 2.0, 3.5);
    await A.touchscreen.tap(s.x, s.y); await sleep(150);
    g = await ghost(A);
    check('바닥을 누르면 그 자리로 옮겨 감', g.i === 10 && g.j === 14 && g.ok, g);
    const meBefore = await T(A, () => [window.__tree.me.x, window.__tree.me.z]);
    await sleep(300);
    const meAfter = await T(A, () => [window.__tree.me.x, window.__tree.me.z]);
    check('가구를 들고 있을 때는 바닥을 눌러도 걷지 않음', meBefore[0] === meAfter[0] && meBefore[1] === meAfter[1]);
    await A.tap('#gTurn'); await sleep(100);
    g = await ghost(A);
    check('돌리면 방향이 바뀌고 방 안에 머무름', g.r === 1 && g.i >= 0 && g.j >= 0 && g.i + 2 <= 30 && g.j + 4 <= 18, g);
    await A.tap('#gTurn'); await A.tap('#gTurn'); await A.tap('#gTurn'); await sleep(100);
    // 트리 위로
    s = await at(A, 0.4, 0.9);
    await A.touchscreen.tap(s.x, s.y); await sleep(150);
    g = await ghost(A);
    check('트리 자리와 겹치면 놓을 수 없는 자리로 표시됨', g && !g.ok, g);
    await A.tap('#gDone'); await sleep(200);
    check('놓을 수 없는 자리에서 "놓기"를 눌러도 놓이지 않음', (await items(A)).length === 0 && !!(await ghost(A)) && (await A.textContent('#toast')).includes('놓을 수 없어요'));
    s = await at(A, 2.0, 3.5);
    await A.touchscreen.tap(s.x, s.y); await sleep(150);
    await A.tap('#gDone'); await sleep(200);
    let its = await items(A);
    check('놓을 수 있는 자리에서 "놓기"를 누르면 놓임', its.length === 1 && its[0].k === 'sofa' && its[0].i === 10 && its[0].j === 14 && !(await ghost(A)) && (await T(A, () => window.__tree.itemObjs)) === 1 && (await A.isVisible('#furnList')), its);
    check('놓인 가구 자리는 걸어 들어갈 수 없는 칸이 됨', await T(A, () => { const G = window.__tree.grid; return !G.free(10, 14) && !G.free(13, 15) && G.free(9, 14) && G.free(10, 13); }));
    // 소파 건너편으로 걷기
    await T(A, () => window.__tree.me.place(-4 + 9.5 * 0.5, -4 + 15.5 * 0.5));
    const t1 = await walkAndTrace(A, () => T(A, () => window.__tree.goTo(-4 + 14.5 * 0.5, -4 + 15.5 * 0.5)));
    const m1 = await T(A, () => [window.__tree.me.x, window.__tree.me.z]);
    check('가구를 돌아서 건너편까지 걸어감', t1.blocked === 0 && t1.n > 10 && Math.hypot(m1[0] - 3.25, m1[1] - 3.75) < 0.15, { t1, m1 });

    // 놓인 가구 옮기기
    s = await at(A, cx(10, 4), cx(14, 2), 0.35);
    await A.touchscreen.tap(s.x, s.y); await sleep(200);
    g = await ghost(A);
    check('놓인 가구를 누르면 다시 들림 (치우기 단추가 보임)', g && g.id === its[0].id && (await A.isVisible('#gDel')), g);
    s = await at(A, -2.5, 3.5);
    await A.touchscreen.tap(s.x, s.y); await sleep(150);
    await A.tap('#gDone'); await sleep(200);
    its = await items(A);
    check('다른 자리에 놓으면 옮겨짐: 옛 자리는 비고 새 자리는 막힘', its.length === 1 && its[0].i === 1 && its[0].j === 14 && (await T(A, () => { const G = window.__tree.grid; return G.free(10, 14) && G.free(13, 15) && !G.free(1, 14) && !G.free(4, 15); })), its);
    // 옮기다가 취소
    await T(A, (id) => window.__tree.ghostPick(id), its[0].id);
    await T(A, () => window.__tree.ghostMoveTo(2, -3));
    await A.tap('#gCancel'); await sleep(150);
    its = await items(A);
    check('옮기다가 취소하면 원래 자리 그대로', its[0].i === 1 && its[0].j === 14 && !(await ghost(A)) && (await T(A, () => { let ok = false; window.__tree.me.root.parent.traverse((o) => { if (o.userData.item) ok = Math.abs(o.position.x - (-2.5)) < 1e-6 && Math.abs(o.position.y) < 1e-6; }); return ok; })));
    // 새 가구를 고르다 취소
    await A.tap('#furnList .pick[data-v="chair"]'); await sleep(150);
    await A.tap('#gCancel'); await sleep(150);
    check('새 가구를 고르다 취소하면 아무것도 놓이지 않음', (await items(A)).length === 1 && (await T(A, () => window.__tree.itemObjs)) === 1);
    // 겹쳐 놓기
    await T(A, () => { window.__tree.ghostNew('chair'); window.__tree.ghostMoveTo(-2.5, 3.5); });
    check('다른 가구와 겹치는 자리는 놓을 수 없음', !(await ghost(A)).ok);
    await T(A, () => window.__tree.ghostCancel());
    await T(A, () => { window.__tree.ghostNew('rug'); window.__tree.ghostMoveTo(-2.5, 3.5); });
    check('러그는 가구 밑에 깔 수 있음', (await ghost(A)).ok);
    await T(A, () => { window.__tree.ghostMoveTo(2.5, -2.5); window.__tree.ghostDone(); });
    check('러그는 밟고 지나갈 수 있음', (await items(A)).length === 2 && (await T(A, () => window.__tree.grid.freeAt(2.5, -2.5))));
    await T(A, () => { window.__tree.ghostNew('rug'); window.__tree.ghostMoveTo(2.5, -2.5); });
    check('러그끼리는 겹칠 수 없음', !(await ghost(A)).ok);
    await T(A, () => window.__tree.ghostCancel());
    await T(A, () => { const W = window.__tree; W.ghostNew('giftR'); W.ghostMoveTo(W.me.x, W.me.z); });
    check('내가 서 있는 칸에는 가구를 놓을 수 없음', !(await ghost(A)).ok);
    await T(A, () => window.__tree.ghostCancel());
    // 치우기
    s = await at(A, cx(1, 4), cx(14, 2), 0.35);
    await A.touchscreen.tap(s.x, s.y); await sleep(200);
    await A.tap('#gDel'); await sleep(200);
    its = await items(A);
    check('놓인 가구를 누르고 "치우기"를 누르면 사라지고 자리가 빔', its.length === 1 && its[0].k === 'rug' && (await T(A, () => window.__tree.itemObjs)) === 1 && (await T(A, () => window.__tree.grid.free(1, 14))), its);
    // 방 채우기 (사진용) + 개수 제한
    await T(A, () => { const W = window.__tree; [['sofa', 1, 6, 1], ['fire', 6, 0, 0], ['chair', 12, 2, 0], ['table', 4, 6, 1], ['shelf', 1, 0, 0], ['giftr', 5, 9, 0, 'giftR'], ['giftg', 6, 10, 0, 'giftG'], ['plant', 15, 0, 0], ['lamp', 0, 15, 0], ['snowman', 14, 12, 0]]
      .forEach(([id, i, j, r, k]) => W.dispatch({ t: 'put', id: 'p' + id, k: k || id, i, j, r })); });
    check('가구 11가지를 모두 놓을 수 있음', (await items(A)).length === 11 && (await T(A, () => window.__tree.itemObjs)) === 11);
    await sleep(400);
    await A.screenshot({ path: path.join(__dirname, 'out', 'furn-room.png') });
    const cap = await T(A, () => { const W = window.__tree; let k = 0; for (let j = 15; j >= 0 && W.S.items.size < 100; j--) for (let i = 0; i < 16 && W.S.items.size < 100; i++) W.dispatch({ t: 'put', id: 'fillfill' + (k++), k: 'giftR', i, j, r: 0 });
      const free = []; for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if (W.grid.free(i, j)) free.push([i, j]);
      return { n: W.S.items.size, free: free.length, more: W.dispatch({ t: 'put', id: 'onemore', k: 'plant', i: free[0][0], j: free[0][1], r: 0 }) }; });
    check('가구는 100개까지만 놓임', cap.n === 100 && cap.more === false, cap);
    await T(A, () => { const W = window.__tree; for (const it of [...W.S.items.values()]) if (it.id.startsWith('fillfill')) W.dispatch({ t: 'del', id: it.id }); });
    check('규칙에 어긋난 변화는 받아들이지 않음', await T(A, () => { const W = window.__tree, n = W.S.items.size;
      const bad = [{ t: 'put', id: 'b1', k: 'nope', i: 0, j: 0, r: 0 }, { t: 'put', id: 'b2', k: 'sofa', i: 14, j: 0, r: 0 }, { t: 'put', id: 'b3', k: 'lamp', i: 1.5, j: 2, r: 0 }, { t: 'put', id: 'b4', k: 'lamp', i: 2, j: 12, r: 7 },
        { t: 'put', id: '<b>', k: 'lamp', i: 2, j: 12, r: 0 }, { t: 'move', id: 'none', i: 0, j: 0, r: 0 }, { t: 'del', id: 'none' }, { t: 'orn', id: 'o1', k: 'red', x: 9, y: 1, z: 0 }, { t: 'orn', id: 'o2', k: 'nope', x: 0.3, y: 1, z: 0.3 },
        { t: 'lights', set: 'x', blink: 'on' }, { t: 'wall', v: 'x' }, { t: 'floor', v: 3 }, { t: 'zzz' }, null];
      return bad.every((o) => W.dispatch(o) === false) && W.S.items.size === n && W.S.orns.size === 0; }));

    /* 트리 */
    await T(A, () => window.__tree.setZoomMul(1));
    await A.tap('#tabs button[data-m="tree"]'); await sleep(200);
    check('트리 탭을 누르면 트리 꾸미기가 열리고 가구는 잠깐 숨음', (await A.isVisible('#treeP')) && (await T(A, () => window.__tree.mode)) === 'tree' && !(await T(A, () => window.__tree.itemsShown)));
    check('트리 판의 단추가 44px 이상', (await audit(A)).length === 0, await audit(A));
    await A.tap('.more[data-list="ornList"]'); await sleep(250);
    check('장식 목록도 펼치면 9가지(장식 8 + 떼기)가 다 보임', (await A.evaluate(() => { const box = document.getElementById('ornList'); return [...box.querySelectorAll('.pick')].filter((b) => { const c = b.getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth && c.bottom <= innerHeight; }).length; })) === 9 && (await audit(A)).length === 0);
    check('전구 색 5가지가 모두 화면 안에 보임', await A.evaluate(() => [...document.querySelectorAll('#lightList .chip')].every((b) => { const c = b.getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth && c.width >= 43.5; })));
    await A.tap('.more[data-list="ornList"]'); await sleep(250);
    await idle(A); await settled(A); await sleep(700);
    const tv = await T(A, () => { const W = window.__tree, v = W.view, top = W.screenOf(0, 0, 2.68), base = W.screenOf(0, 0, 0.3), l = W.treePoint(0.5, W.yaw - Math.PI / 2), r = W.treePoint(0.5, W.yaw + Math.PI / 2);
      return { ok: top.y >= v.top && base.y <= innerHeight - v.bottom && l.x >= 0 && r.x <= innerWidth, tall: base.y - top.y, me: Math.hypot(W.me.x, W.me.z) }; });
    check('트리가 위 막대와 아래 판 사이에 크게 들어옴', tv.ok && tv.tall > 200, tv);
    check('아바타가 트리 옆으로 걸어와 섬', tv.me > 1.2 && tv.me < 2.8, tv);
    const tapTree = async (y, a) => { const p = await T(A, (q) => window.__tree.treePoint(q.y, window.__tree.yaw + q.a), { y, a }); await A.touchscreen.tap(p.x, p.y); await sleep(120); };
    await tapTree(1.2, 0);
    let os = await orns(A);
    const onTree = (o) => T(A, (q) => { const r = Math.hypot(q.x, q.z), R = window.__tree.surfaceR(q.y); return r <= R + 0.02 && r >= R * 0.85; }, o);
    check('트리를 누르면 고른 장식(빨강 방울)이 달림', os.length === 1 && os[0].k === 'red' && (await T(A, () => window.__tree.ornObjs)) === 1 && (await A.textContent('#ornCount')).includes('1'), os);
    check('장식은 누른 자리의 트리 겉면에 붙음', await onTree(os[0]), os[0]);
    await A.tap('#ornList .pick[data-v="star"]');
    await tapTree(1.75, 0.3);
    await A.tap('#ornList .pick[data-v="cane"]');
    await tapTree(0.8, -0.4);
    await A.tap('#ornList .pick[data-v="bell"]');
    await tapTree(2.2, -0.1);
    os = await orns(A);
    check('다른 장식을 골라 누르면 그 장식이 달림', os.length === 4 && os[1].k === 'star' && os[2].k === 'cane' && os[3].k === 'bell' && (await onTree(os[1])) && (await onTree(os[2])) && (await onTree(os[3])), os);
    const mb = await T(A, () => [window.__tree.me.x, window.__tree.me.z]);
    await A.touchscreen.tap(30, 200); await sleep(400);
    const ma = await T(A, () => [window.__tree.me.x, window.__tree.me.z]);
    check('트리 밖을 누르면 장식이 달리지 않고 걷지도 않음', (await orns(A)).length === 4 && mb[0] === ma[0] && mb[1] === ma[1]);
    // 떼기
    await A.tap('#ornList .pick[data-v="cut"]');
    await tapTree(1.45, 0.05); // 장식이 없는 곳
    check('떼기를 고르고 빈 곳을 누르면 아무 일도 없음', (await orns(A)).length === 4);
    s = await at(A, os[0].x * 1.05, os[0].z * 1.05, os[0].y - 0.03);
    await A.touchscreen.tap(s.x, s.y); await sleep(150);
    const os2 = await orns(A);
    check('떼기를 고르고 장식을 누르면 그 장식만 떼어짐', os2.length === 3 && !os2.some((o) => o.id === os[0].id) && (await T(A, () => window.__tree.ornObjs)) === 3, os2);
    // 전구
    await A.tap('#lightList .chip[data-v="multi"]'); await sleep(100);
    check('전구 색을 고르면 불이 켜짐', (await T(A, () => window.__tree.S.lights.set)) === 'multi' && (await T(A, () => window.__tree.bulbsOn)) && (await A.getAttribute('#lightList .chip[data-v="multi"]', 'aria-pressed')) === 'true');
    await A.tap('#blinkList .chip[data-v="twinkle"]'); await sleep(100);
    check('깜빡임을 바꿀 수 있음', (await T(A, () => window.__tree.S.lights.blink)) === 'twinkle' && (await T(A, () => window.__tree.S.lights.set)) === 'multi');
    await A.tap('#ornList .pick[data-v="gold"]');
    for (const [y, a] of [[0.6, -0.6], [0.7, 0.5], [1.0, -0.3], [1.1, 0.55], [1.4, -0.45], [1.6, 0.1], [1.9, -0.25], [2.05, 0.3], [2.4, 0]]) await tapTree(y, a);
    await sleep(400);
    await A.screenshot({ path: path.join(__dirname, 'out', 'tree-phone.png') });
    await A.tap('#lightList .chip[data-v="off"]'); await sleep(100);
    check('"끄기"를 누르면 불이 꺼짐', !(await T(A, () => window.__tree.bulbsOn)));
    await A.tap('#lightList .chip[data-v="warm"]');
    // 돌려 보기
    await A.tap('#turn'); await until(() => T(A, () => !window.__tree.turning), 5000); await sleep(150); await idle(A);
    const m2 = await T(A, () => [window.__tree.me.x, window.__tree.me.z]);
    check('방을 돌리면 아바타도 트리 둘레를 따라 돌아옴', Math.hypot(m2[0] - ma[0], m2[1] - ma[1]) > 1 && Math.hypot(m2[0], m2[1]) < 2.8, { ma, m2 });
    const nBefore = (await orns(A)).length;
    await tapTree(1.3, 0);
    os = await orns(A);
    check('돌린 쪽에도 장식을 달 수 있음', os.length === nBefore + 1 && (await onTree(os[os.length - 1])));
    const capO = await T(A, () => { const W = window.__tree; let k = 0; while (W.S.orns.size < 150 && k < 400) { const a = k * 0.37, y = 0.5 + (k % 40) * 0.05, r = W.surfaceR(y) * 0.95; W.dispatch({ t: 'orn', id: 'fillfill' + (k++), k: 'red', x: Math.sin(a) * r, y, z: Math.cos(a) * r }); }
      return { n: W.S.orns.size, more: W.dispatch({ t: 'orn', id: 'zz9', k: 'red', x: 0.3, y: 1, z: 0.3 }) }; });
    check('장식은 150개까지만 달림', capO.n === 150 && capO.more === false, capO);
    await T(A, () => { const W = window.__tree; for (const o of [...W.S.orns.values()]) if (o.id.startsWith('fillfill')) W.dispatch({ t: 'ornDel', id: o.id }); });
    await A.tap('#tabs button[data-m="tree"]'); await sleep(200);
    check('트리 탭을 다시 누르면 닫히고 가구가 다시 보임', (await T(A, () => window.__tree.mode)) === null && (await T(A, () => window.__tree.itemsShown)) && !(await A.isVisible('#treeP')));

    /* 벽지와 바닥 */
    await A.tap('#tabs button[data-m="paint"]'); await sleep(200);
    check('벽·바닥 판: 벽지 5가지, 바닥 3가지, 단추 44px 이상', (await A.locator('#wallList .sw').count()) === 5 && (await A.locator('#floorList .sw').count()) === 3 && (await audit(A)).length === 0, await audit(A));
    await A.tap('#wallList .sw[data-v="sage"]'); await A.tap('#floorList .sw[data-v="walnut"]'); await sleep(300);
    check('벽지와 바닥을 누르면 바뀜', (await T(A, () => window.__tree.S.wall)) === 'sage' && (await T(A, () => window.__tree.S.floor)) === 'walnut' && (await A.getAttribute('#wallList .sw[data-v="sage"]', 'aria-pressed')) === 'true');
    await A.tap('#tabs button[data-m="paint"]');
    await T(A, () => window.__tree.setZoomMul(0)); await settled(A); await sleep(500);
    await A.screenshot({ path: path.join(__dirname, 'out', 'room-decorated.png') });

    /* 저장 */
    const before = await T(A, () => window.__tree.serialize());
    await sleep(500);
    await A.reload(); await ready(A);
    const after = await T(A, () => window.__tree.serialize());
    check('다시 열면 꾸민 방 그대로 (가구·장식·전구·벽지·바닥)', JSON.stringify(before) === JSON.stringify(after) && after.items.length === 11 && after.orns.length >= 10 && after.lights[0] === 'warm' && after.wall === 'sage' && after.floor === 'walnut',
      { items: after.items.length, orns: after.orns.length, lights: after.lights, wall: after.wall, beforeOrns: before.orns.length });
    check('다시 연 방에 가구와 장식이 그려지고 전구가 켜짐', await T(A, () => { const W = window.__tree; return W.itemObjs === 11 && W.ornObjs === W.S.orns.size && W.bulbsOn && !W.grid.free(6, 0); }));
    // 내 시작 자리에 가구가 놓인 채로 저장된 방
    await T(A, () => localStorage.setItem('nolja-tree-room', JSON.stringify({ v: 1, items: [['s1', 'sofa', 10, 12, 0], ['s2', 'fire', 10, 10, 0]], orns: [], lights: ['off', 'on'], wall: 'cream', floor: 'oak' })));
    await A.reload(); await ready(A);
    check('내 자리에 가구가 있는 방을 열면 옆 빈칸에서 시작', await T(A, () => { const W = window.__tree; return W.S.items.size === 2 && W.grid.fits(W.me.x, W.me.z); }));
    // 망가진 저장값
    for (const bad of ['{', '"x"', '{"v":1,"items":"no","orns":[[1,2]],"lights":5}', '{"v":1,"items":[["a","sofa",3,40,0],["b","lamp",3,3,0],["b","lamp",4,4,0],[null]],"orns":[["o","red",50,1,0]],"lights":["warm","zz"],"wall":"x","floor":null}']) {
      await T(A, (v) => localStorage.setItem('nolja-tree-room', v), bad);
      await A.reload(); await ready(A);
    }
    const lastBad = await T(A, () => window.__tree.serialize());
    check('저장값이 망가져 있어도 열리고, 쓸 수 있는 것만 살림', errors.length === 0 && lastBad.items.length === 1 && lastBad.items[0][0] === 'b' && lastBad.orns.length === 0 && lastBad.lights[0] === 'off' && lastBad.wall === 'cream', lastBad);
    await ctx.close();

    /* ── PC 화면: 마우스와 키보드 ── */
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const B = await open(ctx2, BASE);
    await B.click('#lookDone'); await sleep(500);
    await B.click('#tabs button[data-m="furn"]'); await sleep(200);
    const fb = await B.evaluate(() => { const r = document.getElementById('furnList').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await B.mouse.move(fb.x, fb.y); await B.mouse.wheel(0, 300); await sleep(200);
    check('PC 에서는 목록 위에서 휠을 굴리면 옆으로 넘어감', (await B.evaluate(() => document.getElementById('furnList').scrollLeft)) > 100);
    await B.click('.more[data-list="furnList"]'); await sleep(200);
    check('PC 에서도 "전체 보기"로 가구 21가지가 다 보임', await B.evaluate(() => { const box = document.getElementById('furnList').getBoundingClientRect(); return [...document.querySelectorAll('#furnList .pick')].every((b) => { const c = b.getBoundingClientRect(); return c.left >= box.left - 1 && c.right <= box.right + 1 && c.bottom <= innerHeight; }); }));
    await B.reload(); await ready(B);
    await B.click('#tabs button[data-m="furn"]'); await sleep(200);
    check('펼쳐 둔 것은 다시 열어도 그대로', await B.evaluate(() => document.getElementById('furnList').classList.contains('open')));
    await B.click('#furnList .pick[data-v="table"]'); await sleep(900); // 판 높이가 바뀌어 화면이 자리를 잡을 때까지
    const p1 = await at(B, -2.5, 2.5), p2 = await at(B, 2.5, -2.0);
    await B.mouse.move(p1.x, p1.y); await B.mouse.down(); await sleep(60);
    const g1 = await ghost(B);
    await B.mouse.move((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, { steps: 4 }); await B.mouse.move(p2.x, p2.y, { steps: 4 }); await sleep(60);
    const g2 = await ghost(B);
    await B.mouse.up(); await sleep(100);
    check('마우스로 끌면 가구가 따라옴', g1 && g2 && (g1.i !== g2.i || g1.j !== g2.j) && Math.abs(cx(g2.i, 3) - 2.5) < 0.3 && Math.abs(cx(g2.j, 2) + 2.0) < 0.3 && !!(await ghost(B)), { g1, g2 });
    await B.keyboard.press('KeyR');
    check('R 키로 돌림', (await ghost(B)).r === 1);
    await B.keyboard.press('Enter'); await sleep(150);
    check('Enter 키로 놓음', (await items(B)).length === 1 && !(await ghost(B)));
    await B.click('#furnList .pick[data-v="lamp"]'); await B.keyboard.press('Escape'); await sleep(100);
    check('Esc 키로 취소', (await items(B)).length === 1 && !(await ghost(B)));
    const it = (await items(B))[0];
    await T(B, (id) => window.__tree.ghostPick(id), it.id);
    await B.keyboard.press('Delete'); await sleep(100);
    check('Delete 키로 치움', (await items(B)).length === 0 && !(await ghost(B)));
    await B.click('#tabs button[data-m="tree"]'); await idle(B); await settled(B); await sleep(600);
    const tp = await T(B, () => window.__tree.treePoint(1.3, window.__tree.yaw));
    await B.mouse.click(tp.x, tp.y); await sleep(150);
    check('PC 에서도 트리를 눌러 장식을 닮', (await orns(B)).length === 1);
    await B.screenshot({ path: path.join(__dirname, 'out', 'tree-pc.png') });
    await ctx2.close();

    /* ── 새로 시작하는 방의 기본 가구 ── */
    const ctx3 = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const N1 = await ctx3.newPage(); // 검사용 빈 방 표시 없이 그대로 연다
    N1.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
    await N1.goto(BASE); await ready(N1);
    await N1.tap('#lookDone'); await sleep(300);
    const st0 = await T(N1, () => window.__tree.serialize());
    const up = st0.items.filter((it) => it[0].startsWith('up')), low = st0.items.filter((it) => !it[0].startsWith('up'));
    check('처음 시작하는 방에는 놀 수 있는 가구(벽난로·TV·다트판·오르골)와 주방·방 가구 12개, 마당·2층·3층 가구와 방명록 14개가 놓여 있음', low.length === 12 && up.length === 14 && ['dart', 'fire', 'music', 'tv', 'cake', 'counter', 'stove', 'fridge', 'bed', 'closet', 'stand'].every((k) => low.some((it) => it[1] === k)) && (await T(N1, () => window.__tree.itemObjs)) === 26, st0.items);
    check('기본 가구는 제 방에 놓여 있음 (주방 가구는 주방, 침대는 방, 마당 가구는 마당, 위층 가구는 위층)', low.every((it) => (it[0].startsWith('base') ? it[2] < 20 : it[2] > 20 && it[2] < 30)) && low.find((it) => it[1] === 'cake')[3] < 9 && low.find((it) => it[1] === 'bed')[3] > 9
      && up.filter((it) => it[2] < 30).length === 3 && up.filter((it) => it[2] < 30).every((it) => it[3] >= 19) && up.filter((it) => it[2] >= 32 && it[2] < 62).length === 5 && up.filter((it) => it[2] >= 64).length === 5, st0.items);
    check('기본 가구는 꾸민 것으로 치지 않음 (친구 방에 들어갈 때 친구 방을 덮지 않게)', st0.at === 0 && st0.sync === 0);
    check('기본 가구 자리는 걸어 들어갈 수 없고, 내 아바타는 빈칸에 서 있음', await T(N1, () => { const W = window.__tree; return !W.grid.free(6, 0) && !W.grid.free(0, 7) && !W.grid.free(11, 0) && !W.grid.free(15, 12) && W.grid.fits(W.me.x, W.me.z); }));
    await T(N1, () => window.__tree.setZoomMul(0)); await sleep(900);
    await N1.screenshot({ path: path.join(__dirname, 'out', 'starter.png') });
    // 방에서 벽난로를 누르면 놀이가 열린다 (기본 가구로 바로 놀 수 있다)
    const fp = await T(N1, () => window.__tree.screenOf(0, -3.3, 0.9));
    await N1.touchscreen.tap(fp.x, fp.y);
    check('기본으로 놓인 벽난로를 누르면 마시멜로 굽기가 열림', await until(async () => (await T(N1, () => window.__tree.mode)) === 'play' && (await T(N1, () => window.__play.state && window.__play.state.kind)) === 'fire', 15000));
    await T(N1, () => window.__play.close());
    // 옮기고 치울 수 있다
    await T(N1, () => { const W = window.__tree; W.setMode('furn'); W.ghostPick('base2'); W.ghostMoveTo(2.75, 3.25); W.ghostDone(); });
    const moved = (await items(N1)).find((it) => it.id === 'base2');
    check('기본 가구도 옮길 수 있음', moved && moved.i === 13 && moved.j === 14 && (await T(N1, () => window.__tree.grid.free(11, 0))), moved);
    await T(N1, () => { const W = window.__tree; for (const id of [...W.S.items.keys()]) { W.ghostPick(id); W.ghostRemove(); } });
    check('기본 가구도 치울 수 있음', (await items(N1)).length === 0);
    await sleep(500);
    await N1.reload(); await ready(N1);
    check('다 치운 뒤 다시 열어도 기본 가구가 다시 생기지 않음', (await items(N1)).length === 0);
    // 거실만 있던 때에 꾸며 둔 방(v 1)을 열면: 꾸민 것은 그대로, 주방과 방의 기본 가구만 더해진다
    await T(N1, () => localStorage.setItem('nolja-tree-room', JSON.stringify({ v: 1, at: 1700000000000, sync: 0, items: [['old1', 'sofa', 1, 6, 1], ['old2', 'lamp', 0, 15, 0]], orns: [['o1', 'red', 0.3, 1.2, 0.4]], lights: ['warm', 'on'], wall: 'sage', floor: 'walnut' })));
    await N1.reload(); await ready(N1);
    const mg = await T(N1, () => window.__tree.serialize());
    check('예전에 꾸민 방을 열면 꾸민 것은 그대로이고 주방·방 가구와 마당·위층 가구가 더해짐', mg.items.length === 24 && mg.items.filter((it) => /^up\d+$/.test(it[0])).length === 14 && mg.items.some((it) => it[0] === 'old1' && it[2] === 1 && it[3] === 6) && mg.items.some((it) => it[1] === 'cake') && !mg.items.some((it) => it[0].startsWith('base')) && mg.orns.length === 1 && mg.wall === 'sage' && mg.at === 1700000000000, mg.items.map((it) => it[0]));
    await ctx3.close();

    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
