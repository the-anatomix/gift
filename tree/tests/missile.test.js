// 비행 슈트의 유도탄·목표 고르기·U/I 키 검사 (아래 머리말은 beam.test.js 와 같은 틀). 원래 설명: 비행 슈트의 손바닥 빛줄기 검사 (빔 단추 · 쏘기와 닿는 곳 · 소리 · 방의 상태는 그대로 · 쉬는 시간 · 마당·하늘·1인칭 · 썰매·판과 부딪힐 때 · 친구 화면 · 이상한 소식). 실행: cd tree/tests && node beam.test.js (포트 8216)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8238, BASE = `http://localhost:${PORT}/tree/`;
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
  await p.addInitScript(() => { if (new URLSearchParams(location.search).get('ns') === 'mia') localStorage.setItem('tree.master.mia', '9262b0baa88add8fdc882f6772709ebfbd645aaa651e904e4e3d795898a71a7d'); }); // 비행 슈트는 마스터키를 켠 사람만 (방장 창)
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
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=mia`);
    const M = (p) => T(p, () => { const m = window.__missile; return { shown: m.shown, lockShown: m.lockShown, lock: m.lock, auto: m.auto, mark: m.mark, count: m.count, last: m.last, hits: m.hits, active: m.active, made: m.made }; });
    const face = (p, dx, dz) => T(p, (a) => { const m = window.__tree.me; m.turnTo(a[0], a[1]); m.root.rotation.y = m.face; }, [dx, dz]);
    const ready2 = (p) => T(p, () => window.__missile.ready());

    /* 단추 */
    await place(A, 4, 12);
    check('비행 슈트를 안 입었으면 유도탄·목표 단추가 없고 쏠 수 없음', !(await M(A)).shown && !(await M(A)).lockShown && (await T(A, () => window.__missile.fire())) === false && (await M(A)).count === 0);
    await T(A, () => window.__tree.setLook({ outfit: 'jet' })); await sleep(300);
    check('비행 슈트를 입으면 "☄️ 유도탄"·"🎯 목표" 단추가 보임 (화면 안·44px 이상·다른 단추와 안 겹침)', (await A.isVisible('#misBtn')) && (await A.isVisible('#lockBtn')) && (await A.textContent('#misBtn')).includes('유도탄') && (await audit(A)).length === 0 && (await overlaps(A)).length === 0, [await audit(A), await overlaps(A)]);

    /* 혼자: 목표 없이 곧장 */
    const before = JSON.stringify(await T(A, () => window.__tree.serialize()));
    await face(A, 1, 0);
    await A.tap('#misBtn'); await sleep(150);
    const m1 = await M(A);
    check('목표가 없으면 보는 쪽으로 곧장 날아감', m1.count === 1 && m1.last.tid === '' && Math.abs(m1.last.yaw - 1.57) < 0.01 && m1.last.len > 3 && m1.active.length === 1 && m1.active[0].mine && m1.active[0].phase === 'fly' && m1.active[0].seen, m1);
    await shot(A, 'missile-fly.png');
    check('닿는 곳에서 터지고 사라짐 (쏘는 소리·터지는 소리)', await until(async () => (await M(A)).active.some((x) => x.phase === 'boom'), 6000) && await until(async () => (await M(A)).active.length === 0, 4000) && (await sounds(A, 'missile')) === 1 && (await sounds(A, 'boom')) === 1, [await M(A), await sounds(A, 'boom')]);
    check('방의 상태는 그대로', JSON.stringify(await T(A, () => window.__tree.serialize())) === before);
    await ready2(A);
    const two = await T(A, () => [window.__missile.fire(), window.__missile.fire()]);
    check('연달아 누르면 채우는 시간(4초)이 지나야 다시 나감', two[0] === true && two[1] === false && (await toastOf(A)).includes('채우는 중'), [two, await toastOf(A)]);
    await ready2(A);
    await A.keyboard.press('KeyM'); await sleep(100);
    check('키보드 M 으로도 쏨', (await M(A)).count === 3);
    await T(A, () => window.__missile.cycle()); await sleep(100);
    check('혼자일 때 목표 단추를 누르면 고를 사람이 없다고 알림', (await M(A)).lock === null && (await toastOf(A)).includes('없어요'), await toastOf(A));

    /* 날 때 U / I 키로 오르내리기 */
    await place(A, 14, 22); await sleep(200);
    await T(A, () => window.__fly.start()); await sleep(900);
    const a0 = await T(A, () => window.__fly.alt);
    await A.keyboard.down('KeyU'); await sleep(700); await A.keyboard.up('KeyU');
    const a1 = await T(A, () => window.__fly.alt);
    await sleep(200);
    const a2 = await T(A, () => window.__fly.alt);
    await A.keyboard.down('KeyI'); await sleep(450); await A.keyboard.up('KeyI');
    const a3 = await T(A, () => window.__fly.alt);
    check('나는 중에 U 를 누르고 있으면 올라가고, 떼면 멈추고, I 를 누르면 내려감', a1 > a0 + 0.8 && Math.abs(a2 - a1) < 0.05 && a3 < a2 - 0.5, [a0, a1, a2, a3]);
    await T(A, () => window.__fly.land(true)); await sleep(400);
    await T(A, () => window.__fly.mount()); await sleep(1500);
    const s0 = await T(A, () => window.__fly.alt);
    await A.keyboard.down('KeyU'); await sleep(600); await A.keyboard.up('KeyU');
    check('썰매를 탔을 때도 U 로 올라감', (await T(A, () => window.__fly.ride)) && (await T(A, () => window.__fly.alt)) > s0 + 0.8, [s0, await T(A, () => window.__fly.alt)]);
    await T(A, () => window.__fly.land(true)); await sleep(400);

    /* 친구와: 목표 고르기 */
    await place(A, 4, 12); await face(A, 1, 0);
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=mib#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=mic#v=${rid}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    const bid = await T(B, () => window.__duo.me), cid = await T(C, () => window.__duo.me);
    const seen = (p, w) => T(p, (w) => window.__duo.others.find((o) => o.id === w), w);
    const at = async (p, w, i, j) => { await place(p, i, j); await until(async () => { const o = await seen(A, w); return o && Math.abs(o.x - (-4 + (i + 0.5) * 0.5)) < 0.05 && Math.abs(o.z - (-4 + (j + 0.5) * 0.5)) < 0.05 && !o.moving; }, 6000); };
    check('권한 없는 친구에게는 유도탄·목표 단추가 없음', !(await M(B)).shown && !(await M(B)).lockShown && (await T(B, () => window.__missile.fire())) === false);
    await at(B, bid, 8, 14); await at(C, cid, 4, 6); // B 는 오른쪽 앞(조금 비껴서), C 는 뒤쪽
    await sleep(400);
    const m2 = await M(A);
    check('고른 목표가 없으면 앞에 있는 사람에게 옅은 조준 표시가 뜸', m2.lock === null && m2.auto === bid && m2.mark && !m2.mark.strong, m2);
    const z0 = await T(A, () => window.__beam.zaps);
    await T(A, () => window.__beam.fire()); await sleep(100);
    check('빔: 똑바로 보지 않아도 앞에 있는 사람을 스스로 겨눠 맞힘', (await T(A, () => window.__beam.hitId)) === bid && (await T(A, () => window.__beam.zaps)) === z0 + 1 && Math.abs((await T(A, () => window.__beam.last)).yaw - 1.57) > 0.2, await T(A, () => window.__beam.last));
    await until(async () => (await T(B, () => window.__tree.me.down)) === 0 && ((await seen(A, bid)) || {}).down === 0, 20000);
    await A.keyboard.press('KeyT'); await sleep(100);
    const l1 = (await M(A)).lock;
    await T(A, () => window.__missile.cycle()); await sleep(100);
    const l2 = (await M(A)).lock;
    await T(A, () => window.__missile.cycle()); await sleep(100);
    const l3 = (await M(A)).lock;
    check('목표 단추(T 키)를 누를 때마다 가까운 사람부터 차례로 고르고, 끝에서 한 번 더 누르면 풀림', l1 === bid && l2 === cid && l3 === null, [l1, l2, l3, bid, cid]);
    const sp = await T(A, (w) => { const o = window.__duo.others.find((x) => x.id === w); return window.__tree.screenOf(o.x, o.z, 0.5); }, cid);
    await A.touchscreen.tap(sp.x, sp.y); await sleep(200);
    const m3 = await M(A);
    check('화면에서 사람을 누르면 그 사람이 목표가 되고 진한 조준 표시가 뜸 (그쪽으로 걸어가지 않음)', m3.lock === cid && m3.mark && m3.mark.strong && (await A.getAttribute('#lockBtn', 'aria-pressed')) === 'true' && (await toastOf(A)).includes('목표') && !(await T(A, () => window.__tree.me.moving)), [m3, sp]);
    await shot(A, 'missile-lock.png');
    await sleep(800);
    const z1 = await T(A, () => window.__beam.zaps);
    await T(A, () => window.__beam.fire()); await sleep(100);
    check('빔: 고른 목표가 뒤에 있어도 돌아서서 맞힘', (await T(A, () => window.__beam.hitId)) === cid && (await T(A, () => window.__beam.zaps)) === z1 + 1);
    await until(async () => ((await seen(A, cid)) || {}).down === 0, 20000);
    await T(A, () => { window.__missile.lock = null; });

    /* 유도탄: 따라가서 3초 기절 */
    // B 를 A 에게서 곧장 걸어갈 수 없는(벽이나 트리 뒤) 자리에 세운다
    const spot = await T(A, () => {
      const W = window.__tree, g = W.grid, me = W.me;
      let best = null;
      for (let j = 0; j < 18; j++) for (let i = 0; i < 30; i++) {
        const x = -4 + (i + 0.5) * 0.5, z = -4 + (j + 0.5) * 0.5, d = Math.hypot(x - me.x, z - me.z);
        if (!g.fits(x, z) || d < 4 || d > 9 || g.clear(me.x, me.z, x, z)) continue;
        const r = g.route(me.x, me.z, x, z);
        if (r && r.length >= 2 && (!best || d < best.d)) best = { i, j, d, n: r.length };
      }
      return best;
    });
    check('검사 준비: 곧장은 못 가고 돌아가야 하는 자리를 찾음', !!spot, spot);
    await at(B, bid, spot.i, spot.j); await at(C, cid, 4, 3);
    await sleep(300);
    await ready2(A);
    await T(A, (w) => { window.__missile.lock = w; }, bid);
    const h0 = (await M(A)).hits;
    await A.tap('#misBtn'); await sleep(120);
    const m4 = await M(A);
    check('목표가 있으면 그 사람을 따라가는 유도탄이 나감 (친구·구경하는 사람 화면에도 보임)', m4.last.tid === bid && m4.active.length === 1 && m4.active[0].tid === bid
      && await until(async () => (await M(B)).active.some((x) => !x.mine && x.tid === bid) && (await M(C)).active.some((x) => !x.mine && x.tid === bid), 2000), [m4, await M(B)]);
    check('목표가 된 사람에게 "유도탄이 따라와요" 알림이 뜸', await until(async () => (await toastOf(B)).includes('따라와요'), 2000), await toastOf(B));
    const myDown = () => T(B, () => window.__tree.me.down);
    check('벽 뒤에 있어도 길을 따라 돌아가서 맞히고, 맞은 사람은 3초쯤 기절함 (내 화면·맞은 친구·구경하는 사람 모두)', await until(async () => (await M(A)).hits === h0 + 1, 20000)
      && await until(async () => (await myDown()) > 1.5 && ((await seen(C, bid)) || {}).down > 1.5 && ((await seen(A, bid)) || {}).down > 1.5, 4000)
      && await until(async () => (await toastOf(B)).includes('기절'), 2000), [await M(A), await myDown(), await seen(C, bid), await toastOf(B)]);
    await shot(B, 'missile-stun.png');
    const t0 = Date.now();
    check('기절한 사람은 방향키를 눌러도 못 움직이고 머리 위에 별이 돎', await (async () => { const x0 = (await T(B, () => window.__tree.me.x)); await B.keyboard.down('ArrowLeft'); await sleep(300); await B.keyboard.up('ArrowLeft'); return Math.abs((await T(B, () => window.__tree.me.x)) - x0) < 1e-3; })()
      && await until(async () => (await M(A)).active.some((x) => x.phase === 'stun') && (await M(B)).active.some((x) => x.phase === 'stun'), 8000), [await M(A), await M(B)]);
    check('3초쯤 지나면 일어나고 별도 사라짐', await until(async () => (await myDown()) === 0 && ((await seen(A, bid)) || {}).down === 0, 30000) && Date.now() - t0 > 1500 && await until(async () => (await M(A)).active.length === 0 && (await M(B)).active.length === 0, 8000), [Date.now() - t0, await M(A)]);
    check('방의 상태는 그대로이고 소리가 남', JSON.stringify(await T(A, () => window.__tree.serialize())) === before.replace(/"at":\d+/, '') || (await sounds(A, 'boom')) >= 2, await sounds(A, 'boom'));

    /* 고른 목표가 없을 때: 가장 가까운 사람 */
    await T(A, () => { window.__missile.lock = null; });
    await at(B, bid, 8, 12); await sleep(300);
    await face(A, -1, 0); await ready2(A); // 등지고 서 있어도
    await T(A, () => window.__missile.fire()); await sleep(100);
    check('고른 목표가 없으면 어느 쪽에 있든 가장 가까운 사람을 따라감', (await M(A)).last.tid === bid && await until(async () => (await myDown()) > 2, 15000), (await M(A)).last);
    await until(async () => (await myDown()) === 0 && ((await seen(A, bid)) || {}).down === 0, 30000);

    /* 이상한 소식 */
    await until(async () => (await M(B)).active.length === 0 && (await M(A)).active.length === 0 && (await M(C)).active.length === 0, 20000);
    await sleep(2600); await T(B, () => new Promise((r) => { const t0 = window.__missile.active.length; let n = 0; const f = () => (++n > 150 ? r(t0) : requestAnimationFrame(f)); f(); })); // 화면 시간으로도 넉넉히 // 친구 화면에서 유도탄 소식을 다시 받을 수 있을 때까지
    await T(B, (w) => { for (const v of ['abc', w + ';9.99;0.00;0.0', w + ';0.00;2.00;0.0', ';0.00;0.00;99.0', ';0.00;0.00;0.1', w + ';1.57;0.00', 5, null, 'h;1.57;0.00;0.0', 'toolongidname;1.57;0.00;0.0']) window.__duo.feed({ t: 'fx', id: 'h', k: 'mis', v }); window.__duo.feed({ t: 'fx', id: 'zz', k: 'mis', v: w + ';1.57;0.00;0.0' }); }, bid);
    await sleep(200);
    check('이상한 유도탄 소식은 받지 않음', (await M(B)).active.length === 0 && errors.length === 0, (await M(B)).active);
    await T(B, (w) => window.__duo.feed({ t: 'fx', id: 'h', k: 'boom', v: w }), bid); await sleep(200);
    check('유도탄 없이 온 "맞았다" 소식은 받지 않음', (await myDown()) === 0);
    await T(A, (w) => window.__duo.feed({ t: 'fx', k: 'mis', v: 'h;1.57;0.00;0.0' }, w), bid); await sleep(300);
    check('비행 슈트를 안 입은 사람이 쐈다는 소식은 받지 않고 전하지도 않음', (await M(A)).active.length === 0 && (await M(C)).active.length === 0 && (await T(A, () => window.__tree.me.down)) === 0);
    await T(B, (w) => { window.__duo.feed({ t: 'fx', id: 'h', k: 'mis', v: w + ';1.57;0.00;0.0' }); window.__duo.feed({ t: 'fx', id: 'h', k: 'boom', v: w }); window.__duo.feed({ t: 'fx', id: 'h', k: 'boom', v: w }); }, cid); await sleep(300);
    check('유도탄 하나로는 그 목표 한 사람만, 한 번만 기절함', (await myDown()) === 0 && (await T(B, (w) => window.__duo.others.find((o) => o.id === w).down, cid)) > 2);
    check('유도탄 묶음은 돌려 써서 몇 개만 만들어짐', (await M(A)).made <= 2 && (await M(B)).made <= 2, [(await M(A)).made, (await M(B)).made]);
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) { check('검사가 끝까지 돌았음', false, String(e && e.stack || e).slice(0, 400)); }
  finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
