// 비행 슈트의 손바닥 빛줄기 검사 (빔 단추 · 쏘기와 닿는 곳 · 소리 · 방의 상태는 그대로 · 쉬는 시간 · 마당·하늘·1인칭 · 썰매·판과 부딪힐 때 · 친구 화면 · 이상한 소식). 실행: cd tree/tests && node beam.test.js (포트 8216)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8216, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
  await p.addInitScript(() => { if (new URLSearchParams(location.search).get('ns') === 'bma') localStorage.setItem('tree.master.bma', 'de94e28d7a302b52374831e94e8c70adddf861c691e77ab53f0646f55543a3e7'); }); // 비행 슈트는 마스터키를 켠 사람만 (방장 창)
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
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

const cxz = (i, j) => [-4 + (i + 0.5) * 0.5, -4 + (j + 0.5) * 0.5]; // 칸 → 자리(가운데)
const F = (p) => T(p, () => { const f = window.__fly, W = window.__tree, m = W.me; return { on: f.on, alt: f.alt, y: m.root.position.y, x: m.x, z: m.z, lv: m.level, view: W.level, shown: f.shown, arrows: f.arrows,
  jets: !!(m.parts.jets && m.parts.jets[0].visible), bx: m.parts.body.rotation.x, cross: f.crossing, landing: f.landing }; });
const hold = (p, v) => T(p, (v) => window.__fly.hold(v), v);
const place = (p, i, j) => T(p, (a) => { window.__tree.me.stop(); window.__tree.me.place(a[0], a[1]); }, cxz(i, j));
// 단추끼리 겹치는지 (보이는 것만)
const overlaps = (p) => T(p, () => {
  const bs = [...document.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && !b.closest('[hidden]') && getComputedStyle(b).display !== 'none'; });
  const bad = [];
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i].getBoundingClientRect(), b = bs[j].getBoundingClientRect();
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push((bs[i].id || bs[i].textContent) + ' × ' + (bs[j].id || bs[j].textContent));
  }
  return bad;
});

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const shot = async (p, name) => { await T(p, () => window.__tree.snapView()); await sleep(250); await p.screenshot({ path: path.join(__dirname, 'out', name) }); };
    const toastOf = (p) => p.textContent('#toast');
    const sounds = (p, n) => T(p, (n) => window.__sfx.log.filter((x) => x.n === n).length, n);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=bma`);
    const BM = (p) => T(p, () => { const b = window.__beam, m = window.__tree.me; return { shown: b.shown, count: b.count, last: b.last, active: b.active, made: b.made, arm: m.parts.arms[0].rotation.x, aim: m.aim }; });
    const face = (p, dx, dz) => T(p, (a) => { const m = window.__tree.me; m.turnTo(a[0], a[1]); m.root.rotation.y = m.face; }, [dx, dz]);

    /* 단추 */
    await place(A, 4, 12);
    check('비행 슈트를 안 입었으면 빔 단추가 없고 쏠 수 없음', !(await BM(A)).shown && (await T(A, () => window.__beam.fire())) === false && (await BM(A)).count === 0);
    await T(A, () => window.__tree.setLook({ outfit: 'jet' })); await sleep(300);
    check('비행 슈트를 입으면 "✋ 빔" 단추가 보임 (화면 안·44px 이상·다른 단추와 안 겹침)', (await A.isVisible('#beamBtn')) && (await A.textContent('#beamBtn')).includes('빔') && (await audit(A)).length === 0 && (await overlaps(A)).length === 0, [await audit(A), await overlaps(A)]);

    /* 쏘기 */
    await T(A, () => window.__tree.dispatch({ t: 'put', id: 'sf', k: 'sofa', i: 10, j: 12, r: 0 }));
    const before = JSON.stringify(await T(A, () => window.__tree.serialize()));
    await face(A, 1, 0);
    await A.tap('#beamBtn'); await sleep(120);
    const b1 = await BM(A);
    check('누르면 보는 쪽으로 빛줄기가 나가고 한 손을 앞으로 뻗음', b1.count === 1 && b1.active.length === 1 && b1.active[0].mine && b1.active[0].seen && Math.abs(b1.last.yaw - Math.PI / 2) < 0.01 && b1.last.pitch === 0 && b1.arm < -1.2, b1);
    check('가구(소파)에 닿으면 거기까지만 뻗음', b1.last.len > 2.0 && b1.last.len < 3.3 && b1.active[0].hit, b1.last);
    await shot(A, 'beam-fire.png');
    check('쏘는 소리와 닿는 소리가 남', (await sounds(A, 'beam')) === 1 && await until(async () => (await sounds(A, 'beamHit')) === 1, 3000));
    check('닿은 곳에서 반짝이가 튐', await until(async () => (await BM(A)).active.some((x) => x.burst), 2000) || (await BM(A)).active.length === 0);
    check('잠깐 뒤 빛줄기가 사라지고 팔을 내림', await until(async () => { const b = await BM(A); return b.active.length === 0 && b.arm > -1; }, 4000), await BM(A));
    check('방의 상태는 그대로 (가구가 부서지거나 움직이지 않음)', JSON.stringify(await T(A, () => window.__tree.serialize())) === before && (await T(A, () => window.__tree.itemShown('sf'))));
    const two = await T(A, () => [window.__beam.fire(), window.__beam.fire()]);
    check('연달아 누르면 잠깐(0.7초) 쉬어야 다시 나감', two[0] === true && two[1] === false && (await BM(A)).count === 2, two);
    await sleep(2500);
    await face(A, -1, 0); await T(A, () => window.__beam.fire()); await sleep(100);
    check('벽 쪽으로 쏘면 벽에서 멈춤', (await BM(A)).last.len < 2.6 && (await BM(A)).last.len > 1.5, (await BM(A)).last);
    await sleep(2500);
    await A.keyboard.press('KeyB'); await sleep(100);
    check('키보드 B 로도 쏨', (await BM(A)).count === 4);
    await sleep(900);

    /* 마당·하늘·1인칭 */
    await place(A, 14, 22); await face(A, 0, 1); await sleep(200);
    const hits0 = await sounds(A, 'beamHit');
    await T(A, () => window.__beam.fire()); await sleep(300);
    check('마당에서 탁 트인 쪽으로 쏘면 끝까지(7) 뻗고 닿는 소리는 없음', (await BM(A)).last.len === 7 && !(await BM(A)).active[0].hit && (await sounds(A, 'beamHit')) === hits0, [(await BM(A)).last, await sounds(A, 'beamHit')]);
    await sleep(900);
    await T(A, () => window.__fly.start()); await hold(A, 1); await until(async () => (await T(A, () => window.__fly.alt)) > 4, 15000); await hold(A, 0);
    const c0 = (await BM(A)).count;
    await A.tap('#beamBtn'); await sleep(150);
    check('하늘을 나는 중에도 쏨 (빛줄기는 손에서 나감)', (await BM(A)).count === c0 + 1 && (await BM(A)).active.length === 1 && (await BM(A)).last.len === 7, await BM(A));
    await shot(A, 'beam-sky.png');
    await T(A, () => window.__fly.land(true)); await sleep(900);
    await place(A, 4, 12);
    await T(A, () => { window.__tree.setPov(true); window.__tree.lookTo(1, 0); }); await sleep(300);
    await T(A, () => window.__beam.fire()); await sleep(100);
    const fp = await BM(A), l3 = await T(A, () => window.__tree.look3);
    check('1인칭에서는 내가 보는 쪽(위아래 포함)으로 나감', Math.abs(fp.last.yaw - Math.PI / 2) < 0.02 && Math.abs(fp.last.pitch - l3.fpitch) < 0.02 && (await audit(A)).length === 0 && (await overlaps(A)).length === 0, [fp.last, l3, await audit(A), await overlaps(A)]);
    await T(A, () => window.__tree.setPov(false)); await sleep(900);

    /* 다른 것과 부딪힐 때 */
    await A.tap('#tabs button[data-m="furn"]'); await sleep(300);
    check('가구 탭을 열면 빔 단추가 숨고 쏠 수 없음', !(await BM(A)).shown && (await T(A, () => window.__beam.fire())) === false);
    await A.tap('#tabs button[data-m="furn"]'); await sleep(300);
    await place(A, 14, 23); await sleep(300);
    await T(A, () => window.__fly.mount()); await sleep(600);
    check('썰매를 타는 중에는 빔 단추가 숨음', (await T(A, () => window.__fly.ride)) && !(await BM(A)).shown);
    await T(A, () => window.__fly.land(true)); await sleep(400);

    /* 친구 화면 */
    await place(A, 4, 12); await face(A, 1, 0);
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=bmb#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=bmc#v=${rid}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    const bid = await T(B, () => window.__duo.me);
    check('권한 없는 친구에게는 빔 단추가 없음', !(await BM(B)).shown && (await T(B, () => window.__beam.fire())) === false);
    await sleep(600);
    await T(A, () => window.__beam.fire());
    const sent = (await BM(A)).last;
    check('쏘면 친구와 구경하는 사람 화면에도 같은 방향·길이로 보이고 소리가 남', await until(async () => { const b = (await BM(B)).active, c = (await BM(C)).active; return b.length === 1 && !b[0].mine && b[0].seen && Math.abs(b[0].len - sent.len) < 0.06 && Math.abs(b[0].yaw - sent.yaw) < 0.01 && c.length === 1; }, 3000) && (await T(B, () => window.__sfx.log.filter((x) => x.n === 'beam' && x.far).length)) === 1, [await BM(B), sent]);
    await sleep(900);
    await T(B, () => { for (let k = 0; k < 5; k++) window.__duo.feed({ t: 'fx', id: 'h', k: 'beam', v: '1.57;0.00;3.0' }); }); await sleep(150);
    check('한꺼번에 쏟아지는 빔 소식은 하나만 받음', (await BM(B)).active.length === 1, (await BM(B)).active);
    await sleep(900);
    await T(B, () => { for (const v of ['abc', '9.99;0.00;3.0', '0.00;2.00;3.0', '0.00;0.00;9.9', '0.00;0.00;0.1', '1.57;0.00', 5, null, '1.57;0.00;3.0;1']) window.__duo.feed({ t: 'fx', id: 'h', k: 'beam', v }); window.__duo.feed({ t: 'fx', id: 'zz', k: 'beam', v: '1.57;0.00;3.0' }); });
    await sleep(200);
    check('이상한 빔 소식은 받지 않음', (await BM(B)).active.length === 0 && errors.length === 0, (await BM(B)).active);
    await T(A, (who) => window.__duo.feed({ t: 'fx', k: 'beam', v: '1.57;0.00;3.0' }, who), bid); await sleep(300);
    check('비행 슈트를 안 입은 사람이 쐈다는 소식은 받지 않고 전하지도 않음', (await BM(A)).active.length === 0 && (await BM(C)).active.length === 0);
    /* 빛줄기에 맞으면 1초 동안 쓰러짐 */
    await sleep(900);
    await place(B, 8, 12);
    const seenB = (p) => T(p, (w) => window.__duo.others.find((o) => o.id === w), bid);
    await until(async () => { const o = await seenB(A); return o && Math.abs(o.x - (-4 + 8.5 * 0.5)) < 0.05 && !o.moving; }, 5000);
    await sleep(300);
    await place(A, 4, 12); await face(A, 1, 0);
    const zapsA = () => T(A, () => window.__beam.zaps), z0 = await zapsA();
    await T(A, () => window.__beam.fire());
    const myDown = () => T(B, () => window.__tree.me.down);
    check('친구를 맞히면 그 친구가 쓰러짐 (내 화면·맞은 친구·구경하는 사람 모두)', (await T(A, () => window.__beam.hitId)) === bid && (await zapsA()) === z0 + 1
      && await until(async () => (await myDown()) > 0 && ((await seenB(C)) || {}).down > 0 && ((await seenB(A)) || {}).down > 0, 2000)
      && await until(async () => (await toastOf(B)).includes('쓰러졌어요'), 2000), [await T(A, () => window.__beam.hitId), await myDown(), await seenB(C), (await seenB(A) || {}).down, await toastOf(B), await zapsA(), z0]);
    await shot(B, 'beam-down.png');
    const bx = await T(B, () => window.__tree.me.parts.body.rotation.x);
    check('쓰러진 사람은 뒤로 눕고, 방향키를 눌러도 못 움직임', bx < -1 && await (async () => { const x0 = (await T(B, () => window.__tree.me.x)); await B.keyboard.down('ArrowLeft'); await sleep(250); await B.keyboard.up('ArrowLeft'); return Math.abs((await T(B, () => window.__tree.me.x)) - x0) < 1e-3; })(), bx);
    check('1초쯤 지나면 일어남', await until(async () => (await myDown()) === 0 && ((await seenB(A)) || {}).down === 0, 2500) && Math.abs(await T(B, () => window.__tree.me.parts.body.rotation.x)) < 0.05);
    await T(B, (a) => { window.__duo.feed({ t: 'fx', id: 'h', k: 'zap', v: a }); }, bid); await sleep(150);
    check('빛줄기 없이 온 "맞았다" 소식은 받지 않음', (await myDown()) === 0);
    check('빛줄기 묶음은 돌려 써서 몇 개만 만들어짐', (await BM(A)).made <= 2 && (await BM(B)).made <= 2, [(await BM(A)).made, (await BM(B)).made]);
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) { check('검사가 끝까지 돌았음', false, String(e && e.stack || e).slice(0, 400)); }
  finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
