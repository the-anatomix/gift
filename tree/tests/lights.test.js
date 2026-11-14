// 방 불 켜고 끄기 검사: 벽 스위치(스페이스바·단추) · 층마다 따로 · 어두워지는 정도 · 마당 · 하늘·점등식과 곱하기 · 저장 · 여럿이 볼 때(동기화, 늦게 온 사람, 구경하는 사람)
// 실행: cd tree/tests && node lights.test.js   (화면 사진은 out/lights-*.png)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8202, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__lights && window.__tree.frames > 3)), 20000);
// 시계: window.__now 로 날짜·시각을 정한다 (하늘이 정하는 바탕 밝기가 검사 도중에 바뀌지 않게 낮 1시로 둔다)
const CLOCK = () => { window.__clk = { base: new Date(2026, 11, 10, 13, 0, 0).getTime(), t0: performance.now() }; window.__now = () => window.__clk.base + (performance.now() - window.__clk.t0); };
async function open(ctx, url) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; });
  await p.addInitScript(CLOCK);
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const lamps = (p) => T(p, () => window.__lights.lamps);
// 지금 밝기가 바탕값(하늘이 정한 값)의 몇 배인지 [하늘빛, 햇빛]
const ratio = (p) => T(p, () => { const b = window.__party.bright(), s = window.__sky.state.base; return [b.hemi / s[0], b.sun / s[1]]; });
const near = (v, w, e = 0.012) => Math.abs(v - w) < e;
const goSwitch = (p, lv) => T(p, (lv2) => { const W = window.__tree, s = window.__lights.spot(lv2); W.me.stop(); W.me.place(s[0], s[1]); }, lv);
const stand = (p, lv, a, j) => T(p, ([lv2, a2, j2]) => { const W = window.__tree; W.me.stop(); W.me.place(W.box.x0 + (lv2 * 32 + a2 + 0.5) * W.CELL, W.box.z0 + (j2 + 0.5) * W.CELL); }, [lv, a, j]);
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
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const url = (ns, h) => `${BASE}?net=bc&door=0&ns=${ns}&st=3000&rt=500${h || ''}`;
    const A = await open(ctx, url('la'));
    await sleep(600);
    const r0 = await ratio(A);
    check('처음에는 네 층 모두 불이 켜져 있고 밝기는 정확히 원래대로(배수 1)', JSON.stringify(await lamps(A)) === '[1,1,1,1]' && r0[0] === 1 && r0[1] === 1 && (await T(A, () => window.__lights.lamp().join())) === '1,1', r0);
    check('저장 모양에 불 항목이 없음(예전 방과 같은 모양)', (await T(A, () => window.__tree.serialize().lamps)) === undefined);
    await stand(A, 0, 8, 12); await sleep(300);
    check('스위치에서 떨어져 있으면 불 단추가 없음', (await T(A, () => window.__lights.near())) === null);

    /* 1층 스위치 */
    await goSwitch(A, 0); await sleep(400);
    check('1층 벽 스위치 앞에 서면 "불 끄기" 단추가 뜸 (화면 안·44px 이상)', (await T(A, () => window.__tree.nearAction())) === '💡 불 끄기' && (await A.isVisible('#act')) && (await A.textContent('#act')).includes('불 끄기') && (await audit(A)).length === 0, [await T(A, () => window.__tree.nearAction()), await audit(A)]);
    await A.screenshot({ path: path.join(__dirname, 'out', 'lights-on.png') });
    await A.tap('#act');
    check('단추를 누르면 1층 불만 꺼짐', await until(async () => JSON.stringify(await lamps(A)) === '[0,1,1,1]', 3000) && (await A.textContent('#toast')).includes('1층 불을 껐어요'));
    await sleep(1600);
    const r1 = await ratio(A);
    check('불을 끄면 방이 어두워짐: 하늘빛 0.2배, 햇빛 0.04배 (바탕값에 곱함)', near(r1[0], 0.2) && near(r1[1], 0.04), r1);
    const glow = await T(A, () => window.__party.bright().glow);
    check('트리 둘레 빛은 그대로 남고, 스위치의 작은 불이 켜져 어두워도 찾을 수 있음', glow === 1.6 && JSON.stringify(await T(A, () => window.__lights.dots)) === '[true,false,false]', glow);
    check('꺼진 스위치 앞에서는 "불 켜기"', (await T(A, () => window.__tree.nearAction())) === '💡 불 켜기');
    await A.screenshot({ path: path.join(__dirname, 'out', 'lights-off.png') });

    /* 마당과 다른 층은 어두워지지 않는다 */
    await stand(A, 0, 6, 22); await sleep(1500);
    const rY = await ratio(A);
    check('마당에 나가면 1층 불이 꺼져 있어도 어둡지 않음', rY[0] === 1 && rY[1] === 1 && !(await T(A, () => window.__lights.dark)), rY);
    await stand(A, 1, 10, 8); await sleep(1500);
    const r2 = await ratio(A);
    check('2층은 불이 켜져 있어서 밝음 (층마다 따로)', (await T(A, () => window.__tree.level)) === 1 && r2[0] === 1 && r2[1] === 1, r2);
    await stand(A, 0, 8, 12); await sleep(1500);
    check('1층으로 돌아오면 다시 어두움', near((await ratio(A))[0], 0.2));

    /* 하늘(낮밤)과 점등식 */
    const base0 = await T(A, () => window.__sky.state.base);
    await T(A, () => { window.__clk = { base: new Date(2026, 11, 10, 22, 0, 0).getTime(), t0: performance.now() }; window.__sky.refresh(); });
    await sleep(700);
    const base1 = await T(A, () => window.__sky.state.base), rN = await ratio(A);
    check('밤이 되어 하늘이 바탕 밝기를 바꿔도 방 불의 배수는 그대로 곱해짐', base1[0] < base0[0] - 0.01 && near(rN[0], 0.2) && near(rN[1], 0.04), [base0, base1, rN]);
    await T(A, () => window.__tree.dispatch({ t: 'lights', set: 'off', blink: 'on' }));
    await T(A, () => window.__party.begin('light'));
    check('불이 꺼진 채 점등식을 하면 점등식의 어두움이 그 위에 더 곱해짐(더 어두워짐)', await until(async () => { const r = await ratio(A); return r[0] < 0.17 && r[0] > 0; }, 10000), await ratio(A));
    await until(() => T(A, () => !window.__party.show), 40000); await sleep(3600);
    check('점등식이 끝나면 방 불의 배수로 돌아옴', near((await ratio(A))[0], 0.2) && near((await ratio(A))[1], 0.04), await ratio(A));
    await goSwitch(A, 0); await sleep(300);
    await T(A, () => window.__tree.pressSpace());
    await sleep(1600);
    const rOn = await ratio(A);
    check('스페이스바로 다시 켜면 정확히 원래 밝기(배수 1)로 돌아옴', JSON.stringify(await lamps(A)) === '[1,1,1,1]' && rOn[0] === 1 && rOn[1] === 1 && (await A.textContent('#toast')).includes('불을 켰어요'), rOn);

    /* 3층: 따로 끄고, 저장된다 */
    await goSwitch(A, 2); await sleep(900);
    check('3층에도 스위치가 있음', (await T(A, () => window.__tree.level)) === 2 && (await T(A, () => window.__tree.nearAction())) === '💡 불 끄기');
    await T(A, () => window.__tree.pressSpace()); await sleep(1500);
    check('3층 불만 꺼짐', JSON.stringify(await lamps(A)) === '[1,1,0,1]' && near((await ratio(A))[0], 0.2));
    await sleep(500); await A.reload(); await ready(A);
    check('다시 열어도 불 상태가 그대로임(저장됨)', JSON.stringify(await lamps(A)) === '[1,1,0,1]' && JSON.stringify(await T(A, () => window.__tree.serialize().lamps)) === '[1,1,0,1]');

    /* 여럿이 */
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const inv = await T(A, () => window.__duo.inviteUrl()), room = inv.split('#r=')[1];
    const B = await open(ctx, url('lb', '#r=' + room));
    check('나중에 들어온 친구도 같은 불 상태를 받음(3층만 꺼짐)', await until(async () => (await T(B, () => window.__duo.mode)) === 'on' && JSON.stringify(await lamps(B)) === '[1,1,0,1]', 12000) && (await T(B, () => window.__duo.hash())) === (await T(A, () => window.__duo.hash())));
    await goSwitch(B, 1); await sleep(900);
    await T(B, () => window.__tree.pressSpace());
    check('친구가 2층 불을 끄면 방장에게도 꺼짐', await until(async () => JSON.stringify(await lamps(A)) === '[1,0,0,1]', 4000) && JSON.stringify(await lamps(B)) === '[1,0,0,1]');
    await stand(A, 1, 12, 10);
    check('같은 층에 있는 방장의 화면도 어두워짐', await until(async () => near((await ratio(A))[0], 0.2) && near((await ratio(B))[0], 0.2), 6000), [await ratio(A), await ratio(B)]);
    await T(A, () => window.__lights.toggle(1));
    check('방장이 켜면 친구에게도 켜지고 알림이 뜸', await until(async () => JSON.stringify(await lamps(B)) === '[1,1,0,1]' && (await B.textContent('#toast')).includes('2층 불을 켰어요'), 4000));
    check('두 사람의 방 지문이 같음', await until(async () => (await T(B, () => window.__duo.hash())) === (await T(A, () => window.__duo.hash())), 4000));
    // 구경하는 사람
    const V = await open(ctx, url('lv', '#v=' + room.split('-')[0]));
    check('구경 온 사람도 같은 불 상태를 봄', await until(async () => (await T(V, () => window.__duo.mode)) === 'on' && JSON.stringify(await lamps(V)) === '[1,1,0,1]', 12000));
    await goSwitch(V, 0); await sleep(500);
    await T(V, () => window.__tree.pressSpace()); await sleep(500);
    check('구경하는 사람은 불을 켜고 끌 수 없음(안내만 뜸)', JSON.stringify(await lamps(V)) === '[1,1,0,1]' && (await V.textContent('#toast')).includes('구경하는 중'));
    await T(V, () => window.__duo.rawOp({ t: 'lamp', lv: 0, on: false })); await sleep(800);
    check('구경하는 사람이 변화를 억지로 보내도 방장이 받지 않음', JSON.stringify(await lamps(A)) === '[1,1,0,1]' && JSON.stringify(await lamps(B)) === '[1,1,0,1]');
    check('이상한 변화(없는 층, 이미 같은 상태)는 받지 않음', await T(A, () => { const W = window.__tree; return !W.dispatch({ t: 'lamp', lv: 4, on: false }) && !W.dispatch({ t: 'lamp', lv: 0, on: true }) && !W.dispatch({ t: 'lamp', lv: 1, on: 'x' }); }));
    await ctx.close();
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
