// 썰매 기차 · Shift 달리기 검사. 실행: cd tree/tests && node train.test.js (포트 8231)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8231, BASE = `http://localhost:${PORT}/tree/`;
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
  await p.addInitScript(() => { if (new URLSearchParams(location.search).get('ns') === 'sla') localStorage.setItem('tree.master.sla', 'de94e28d7a302b52374831e94e8c70adddf861c691e77ab53f0646f55543a3e7'); }); // 비행 슈트는 마스터키를 켠 사람만 (방장 창)
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
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=sla`);
    const TR = (p) => T(p, () => { const t = window.__train, m = window.__tree.me; return { on: t.on, shown: t.shown, up: t.up, seat: t.seat('me'), x: m.x, z: m.z, y: m.root.position.y, wx: m.root.position.x, wz: m.root.position.z, lx: m.parts.legs[0].rotation.x, az: m.parts.arms[0].rotation.z, fly: !!m.fly }; });

    /* Shift 달리기 */
    const walkFor = async (shift) => {
      await place(A, 4, 23); await sleep(150);
      const s0 = await TR(A);
      if (shift) await A.keyboard.down('Shift');
      await A.keyboard.down('ArrowRight'); await sleep(600); const run = await T(A, () => window.__tree.me.run); await A.keyboard.up('ArrowRight');
      if (shift) await A.keyboard.up('Shift');
      await sleep(100);
      const s1 = await TR(A); return { d: Math.hypot(s1.x - s0.x, s1.z - s0.z), run };
    };
    const w1 = await walkFor(false), w2 = await walkFor(true);
    check('Shift 를 누르고 걸으면 달림 (더 멀리 감)', !w1.run && w2.run && w2.d > w1.d * 1.4, [w1, w2]);
    check('Shift 를 떼면 다시 걸음', (await T(A, () => window.__tree.me.run)) === false);

    /* 썰매 기차 */
    await place(A, 14, 23);
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=slb#r=${room}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 2 && (await T(B, () => window.__duo.others)).length === 1, 20000);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=slc#v=${rid}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3, 20000);
    const bid = await T(B, () => window.__duo.me), cid = await T(C, () => window.__duo.me);
    await place(B, 10, 23); await place(C, 8, 23); await sleep(500);
    check('아무도 썰매를 안 타면 "같이 타기" 단추가 없음', !(await TR(B)).shown && (await T(B, () => window.__train.board())) === false);
    await T(A, () => window.__fly.mount()); await until(async () => (await T(A, () => window.__fly.alt)) > 2.5, 8000);
    check('누가 썰매를 타면 마당의 친구에게 "🚃 같이 타기" 단추가 보임 (화면 안·44px 이상·안 겹침)', await until(async () => (await TR(B)).shown, 5000) && (await B.textContent('#carBtn')).includes('같이 타기') && (await audit(B)).length === 0 && (await overlaps(B)).length === 0, [await audit(B), await overlaps(B)]);
    await place(B, 4, 10); await sleep(400);
    check('집 안에서는 같이 타기 단추가 없음', !(await TR(B)).shown);
    await place(B, 10, 23); await sleep(400);
    await B.tap('#carBtn');
    check('누르면 썰매 뒤 첫 칸 객차에 타고 하늘로 날아오름', await until(async () => { const s = await TR(B); return s.on && s.seat && s.seat.slot === 1 && s.seat.car && s.y > 2; }, 6000), await TR(B));
    check('객차에서는 앉아서 두 팔을 흔듦', (await TR(B)).lx < -1.2 && Math.abs((await TR(B)).az) > 1.1, await TR(B));
    check('썰매를 몰던 사람에게 탔다고 알려 줌', await until(async () => /썰매 기차에 탔어요/.test(await toastOf(A)), 4000), await toastOf(A));
    check('탄 동안에는 "내리기" 단추 (화면 안·44px 이상·안 겹침)', (await B.textContent('#carBtn')).includes('내리기') && (await audit(B)).length === 0 && (await overlaps(B)).length === 0, [await audit(B), await overlaps(B)]);
    await C.tap('#carBtn');
    check('구경하는 사람도 두 번째 칸에 탐', await until(async () => { const s = await TR(C); return s.on && s.seat && s.seat.slot === 2; }, 6000), await TR(C));
    check('모두의 화면에서 칸 순서가 같음', await until(async () => {
      const r = await Promise.all([A, B, C].map((p) => T(p, (h) => window.__train.riders(h), 'h')));
      return JSON.stringify(r[0]) === JSON.stringify([bid, cid]) && JSON.stringify(r[2]) === JSON.stringify([bid, 'me'].map((x) => (x === 'me' ? cid : x)));
    }, 6000), await Promise.all([A, B, C].map((p) => T(p, (h) => window.__train.riders(h), 'h'))));
    await T(A, () => window.__fly.airTo(-9, 12));
    await until(async () => { const f = await T(A, () => window.__fly.air); return f && Math.hypot(f.x + 9, f.z - 12) < 0.1; }, 15000);
    await T(A, () => window.__fly.airTo(-9, 2));
    await until(async () => { const f = await T(A, () => window.__fly.air); return f && Math.hypot(f.x + 9, f.z - 2) < 0.1; }, 15000);
    await sleep(700);
    const ap = await T(A, () => { const p = window.__tree.me.root.position; return { x: p.x, y: p.y, z: p.z }; });
    const gapOf = (s) => Math.hypot(s.x - ap.x, s.z - ap.z);
    check('객차들이 썰매가 지나간 길을 따라 줄줄이 (내 화면에서 GAP, 2×GAP 뒤)', await until(async () => { const b = (await TR(B)).seat, c = (await TR(C)).seat; return b && c && Math.abs(gapOf(b) - 1.45) < 0.25 && Math.abs(gapOf(c) - 2.9) < 0.3 && b.z > ap.z && c.z > b.z; }, 4000), [ap, (await TR(B)).seat, (await TR(C)).seat]);
    check('몰던 사람 화면에서도 같은 자리에 줄줄이', await until(async () => { const b = await T(A, (id) => window.__train.seat(id), bid), c = await T(A, (id) => window.__train.seat(id), cid); return b && c && b.car && c.car && Math.abs(gapOf(b) - 1.45) < 0.25 && Math.abs(gapOf(c) - 2.9) < 0.3; }, 4000));
    await shot(B, 'train-on.png'); await shot(A, 'train-driver.png');
    await B.tap('#carBtn');
    check('"내리기"를 누르면 마당의 빈칸으로 내려옴', await until(async () => { const s = await TR(B); return !s.on && !s.fly && s.y === 0; }, 6000) && (await T(B, () => window.__tree.grid.fits(window.__tree.me.x, window.__tree.me.z))) && (await TR(B)).z > 5.5, await TR(B));
    check('다른 사람 화면에서도 내려오고, 뒤 칸이 앞으로 당겨짐', await until(async () => !(await T(A, (id) => window.__train.seat(id), bid)) && (await T(A, (id) => window.__train.seat(id), cid) || {}).slot === 1 && (await TR(C)).seat.slot === 1, 6000));
    await T(A, () => window.__fly.land(false));
    check('썰매가 내려앉으면 탄 사람도 모두 내려옴', await until(async () => { const s = await TR(C); return !s.on && !s.fly && s.y === 0; }, 30000) && await until(async () => !(await T(A, (id) => window.__train.seat(id), cid)), 6000), await TR(C));

    /* 이상한 소식 */
    await T(B, () => { for (const v of ['h', ';1', 'h;', 'h;x', 'H;1', 'zz;1', 'h;12345678901']) window.__duo.feed({ t: 'fx', id: 'h', k: 'car', v }); window.__duo.feed({ t: 'fx', id: 'zz', k: 'car', v: 'h;1' }); });
    await sleep(300);
    check('이상한 기차 소식이 와도 버팀', !(await T(B, () => window.__train.seat('h'))) && errors.length === 0);
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) { check('검사가 끝까지 돌았음', false, String(e && e.stack || e).slice(0, 400)); }
  finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
