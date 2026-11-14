// 루돌프 썰매 검사 (🦌 권한 · 마당에서 타기 · 썰매와 루돌프의 모양 · 집 밖 하늘 · 방울 소리와 반짝이 꼬리 · 내리기 · 비행 슈트와 같이 · 친구 화면 · 마스터가 주는 권한 · 이상한 소식). 실행: cd tree/tests && node sleigh.test.js (포트 8215)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8215, BASE = `http://localhost:${PORT}/tree/`;
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
    const sounds = (p, n) => T(p, (n) => window.__sfx.log.filter((x) => x.n === n).length, n);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=sla`);
    const SL = (p) => T(p, () => { const f = window.__fly, m = window.__tree.me, s = window.__sleigh.me; return { on: f.on, ride: f.ride, alt: f.alt, air: f.air, shown: f.sledShown, fly: f.shown, arrows: f.arrows, sl: s, lx: m.parts.legs[0].rotation.x, y: m.root.position.y, x: m.x, z: m.z,
      jets: !!(m.parts.jets && m.parts.jets[0].visible), riders: window.__sleigh.riders }; });

    /* 단추와 타기 */
    await place(A, 4, 12);
    check('집 안에서는 썰매 단추가 없고 탈 수 없음 (마당에서 타라고 알려 줌)', !(await SL(A)).shown && (await T(A, () => window.__fly.mount())) === false && !(await SL(A)).on && /마당/.test(await toastOf(A)), await toastOf(A));
    await place(A, 14, 23); await sleep(300);
    check('🦌 권한이 있는 사람이 마당에 나가면 "🦌 썰매" 단추가 보임 (비행 슈트 없이. 화면 안·44px 이상·안 겹침)', (await A.isVisible('#sledBtn')) && (await A.textContent('#sledBtn')).includes('썰매') && !(await A.isVisible('#flyBtn')) && (await audit(A)).length === 0 && (await overlaps(A)).length === 0, [await audit(A), await overlaps(A)]);
    await A.tap('#sledBtn');
    check('누르면 썰매에 타고 하늘로 떠오름 (2.6, 세상 좌표)', await until(async () => { const s = await SL(A); return s.ride && Math.abs(s.alt - 2.6) < 0.08 && s.air; }, 8000), await SL(A));
    const s1 = await SL(A);
    check('루돌프(빛나는 빨간 코)가 끄는 썰매가 아바타에 붙고, 아바타는 앉은 몸짓', s1.sl && s1.sl.on && s1.sl.attached && s1.sl.nose && s1.lx < -1.2, s1);
    check('썰매의 그리기 호출은 몇 번뿐 (합친 도형 + 코 + 빛 + 꼬리)', s1.sl.calls <= 9, s1.sl.calls);
    check('타는 동안: "내리기"와 ▲▼ 가 보임 (화면 안·44px 이상·안 겹침)', (await A.textContent('#sledBtn')).includes('내리기') && (await A.isVisible('#flyUp')) && (await A.isVisible('#flyDown')) && (await audit(A)).length === 0 && (await overlaps(A)).length === 0, [await audit(A), await overlaps(A)]);
    check('타는 소리가 남', (await sounds(A, 'sleighOn')) === 1);
    await shot(A, 'sleigh-on.png');

    /* 하늘을 난다 */
    await T(A, () => window.__fly.airTo(-10, 10));
    await until(async () => (await SL(A)).sl.trail > 8, 6000);
    check('달리는 동안 뒤에 반짝이 꼬리가 남고 방울 소리가 남', (await SL(A)).sl.trail > 8 && await until(async () => (await sounds(A, 'bells')) >= 2, 5000), [(await SL(A)).sl, await sounds(A, 'bells')]);
    check('집 밖 하늘까지 날아감 (월드 전체 비행)', await until(async () => { const s = await SL(A); return s.air && Math.hypot(s.air.x + 10, s.air.z - 10) < 0.1; }, 15000) && (await SL(A)).x < -3.8, await SL(A));
    await shot(A, 'sleigh-out.png');
    await sleep(1600);
    check('멈추면 꼬리가 사라지고 방울 소리도 멎음', (await SL(A)).sl.trail === 0 && (await sounds(A, 'bells')) === (await (async () => { await sleep(900); return sounds(A, 'bells'); })()), await SL(A));
    await hold(A, 1); await until(async () => (await SL(A)).alt > 12.6, 25000); await hold(A, 0);
    await T(A, () => window.__fly.airTo(3.5, -2));
    check('높이 올라가면 집 위도 지나감', await until(async () => { const s = await SL(A); return s.air && Math.hypot(s.air.x - 3.5, s.air.z + 2) < 0.1; }, 15000), await SL(A));
    await hold(A, -1); await sleep(4500);
    check('집 위에서는 지붕보다 아래로 못 내려감', (await SL(A)).ride && Math.abs((await SL(A)).alt - 11.8) < 0.05, await SL(A));
    await hold(A, 0);
    await A.tap('#sledBtn');
    check('"내리기"를 누르면 마당의 빈칸으로 날아와 내려앉고 썰매가 사라짐', await until(async () => { const s = await SL(A); return !s.on && s.y === 0 && (!s.sl || !s.sl.on); }, 30000) && (await T(A, () => window.__tree.grid.fits(window.__tree.me.x, window.__tree.me.z))) && (await SL(A)).z > 5.5 && Math.abs((await SL(A)).lx) < 0.5, await SL(A));
    check('내린 뒤에는 다시 "🦌 썰매"이고 걸어서 감', (await A.textContent('#sledBtn')).includes('썰매') && !(await A.isVisible('#flyUp')) && (await T(A, (a) => window.__tree.goTo(a[0], a[1]), cxz(12, 23))) === true && await until(() => T(A, () => window.__tree.me.moving), 3000));
    await until(() => T(A, () => !window.__tree.me.moving && !window.__tree.me.path.length), 8000);
    check('꼬리까지 다 사라지면 남는 것이 없음', await until(async () => (await SL(A)).riders === 0, 4000), await SL(A));

    /* 비행 슈트와 같이 */
    await T(A, () => window.__tree.setLook({ outfit: 'jet' })); await sleep(300);
    check('비행 슈트를 입고 마당에 있으면 날기·빔·썰매 단추가 나란히 (화면 안·44px 이상·안 겹침)', (await A.isVisible('#flyBtn')) && (await A.isVisible('#beamBtn')) && (await A.isVisible('#sledBtn')) && (await audit(A)).length === 0 && (await overlaps(A)).length === 0, [await audit(A), await overlaps(A)]);
    await shot(A, 'sleigh-buttons.png');
    await T(A, () => window.__fly.start()); await until(async () => (await SL(A)).alt > 0.5, 5000);
    check('슈트로 나는 중에는 썰매 단추가 없고 탈 수 없음', !(await SL(A)).shown && (await T(A, () => window.__fly.mount())) === false && !(await SL(A)).ride);
    await T(A, () => window.__fly.land(true)); await sleep(300);
    await A.tap('#sledBtn'); await until(async () => (await SL(A)).alt > 2.5, 8000);
    check('슈트를 입고 썰매를 타면 손발의 불꽃은 안 나오고, 날기·빔 단추는 숨음', (await SL(A)).ride && !(await SL(A)).jets && !(await A.isVisible('#flyBtn')) && !(await A.isVisible('#beamBtn')) && (await overlaps(A)).length === 0, await SL(A));
    await A.tap('#tabs button[data-m="furn"]'); await sleep(300);
    check('타는 중에 가구 탭을 열면 바로 내려서고 단추도 숨음', !(await SL(A)).on && (await SL(A)).y === 0 && !(await SL(A)).shown);
    await A.tap('#tabs button[data-m="furn"]'); await sleep(300);
    await T(A, () => window.__tree.setLook({ outfit: 'santa' })); await sleep(300);

    /* 친구 화면 */
    await place(A, 14, 23);
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=slb#r=${room}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 2 && (await T(B, () => window.__duo.others)).length === 1, 20000);
    const bid = await T(B, () => window.__duo.me);
    const peer = (p, id = 'h') => T(p, (id) => ({ fly: window.__fly.peer(id), sl: window.__sleigh.peer(id) }), id);
    await place(B, 10, 23); await sleep(400);
    check('권한 없는 친구는 마당에서도 썰매 단추가 없고 탈 수 없음', !(await SL(B)).shown && (await T(B, () => window.__fly.mount())) === false && !(await SL(B)).on && !/마스터|권한/.test(await toastOf(B)), await toastOf(B));
    await T(A, () => window.__fly.mount()); await until(async () => (await SL(A)).alt > 2.5, 8000);
    await T(A, () => window.__fly.airTo(-9, 12));
    await until(async () => { const s = await SL(A); return s.air && Math.hypot(s.air.x + 9, s.air.z - 12) < 0.1; }, 15000);
    const ay = (await SL(A)).y;
    check('친구 화면에서도 같은 자리·높이에 썰매를 탄 모습으로 보임 (비행 슈트가 아니어도)', await until(async () => { const p = await peer(B); return p.fly && p.fly.sled && p.sl && p.sl.on && p.sl.attached && Math.hypot(p.fly.wx + 9, p.fly.wz - 12) < 0.25 && Math.abs(p.fly.y - ay) < 0.1 && p.fly.seen; }, 8000), [await peer(B), ay]);
    check('친구에게도 방울 소리가 들림 (멀어서 작게)', (await T(B, () => window.__sfx.log.filter((x) => x.n === 'bells' && x.far).length)) >= 1);
    await shot(B, 'sleigh-peer.png');
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=slc#v=${rid}`);
    check('타고 있는 동안 들어온 사람(구경)에게도 썰매가 보임', await until(async () => { const p = await peer(C); return p.fly && p.fly.sled && p.sl && p.sl.on && Math.hypot(p.fly.wx + 9, p.fly.wz - 12) < 0.25; }, 20000), await peer(C));
    await A.tap('#sledBtn');
    check('내리면 친구 화면에서도 썰매가 사라지고 원래 모습으로 내려섬', await until(async () => { const p = await peer(B), q = await peer(C); return !(await SL(A)).on && !p.fly && (!p.sl || !p.sl.on) && !q.fly && (!q.sl || !q.sl.on); }, 30000), await peer(B));

    /* 마스터가 사람별로 주는 권한 */
    await A.tap('#tabs button[data-m="master"]'); await sleep(900);
    const bad = await T(A, () => [...document.querySelectorAll('#masterP button, #tabs button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && (r.height < 43.5 || r.width < 43.5 || r.left < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5); }).map((b) => b.textContent));
    check('마스터 판의 사람 줄에 🦌 가 더해져도 단추는 44px 이상·화면 안', (await T(A, () => document.querySelectorAll('#mkPeople .who .chip').length)) === 14 && bad.length === 0, bad);
    await A.tap(`#mkPeople .who[data-id="${bid}"] [data-bit="32"]`);
    check('🦌 를 켜 주면 친구에게 썰매 단추가 생김', await until(async () => (await SL(B)).shown, 5000), await SL(B));
    await B.tap('#sledBtn'); await until(async () => (await SL(B)).alt > 2.5, 8000);
    check('친구가 타면 마스터 화면에도 썰매를 탄 모습으로 보임', await until(async () => { const p = await peer(A, bid); return p.fly && p.fly.sled && p.sl && p.sl.on; }, 8000), await peer(A, bid));
    await A.tap(`#mkPeople .who[data-id="${bid}"] [data-bit="32"]`);
    check('🦌 를 끄면 친구는 바로 내려서고 단추도 사라짐', await until(async () => { const s = await SL(B); return !s.on && !s.shown && s.y === 0; }, 5000) && await until(async () => !(await peer(A, bid)).fly, 5000), await SL(B));
    await T(A, () => window.__tree.setMode(null));

    /* 이상한 소식 */
    await T(B, () => { for (const v of ['s', 's99.00', 'sx2.00', 's2.00;1.00', 'ss2.00', 's-1.00']) window.__duo.feed({ t: 'fx', id: 'h', k: 'fly', v }); window.__duo.feed({ t: 'fx', id: 'zz', k: 'fly', v: 's2.00' }); });
    await sleep(300);
    check('이상한 썰매 소식이 와도 버팀', !(await peer(B)).fly && errors.length === 0, await peer(B));
    await T(A, () => window.__tree.dispatch({ t: 'put', id: 'fs', k: 'sled', i: 20, j: 22, r: 0 }));
    check('가구 "산타 썰매"는 예전 그대로 놓임 (탈것과 상관없음)', await T(A, () => window.__tree.S.items.has('fs')));
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) { check('검사가 끝까지 돌았음', false, String(e && e.stack || e).slice(0, 400)); }
  finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
