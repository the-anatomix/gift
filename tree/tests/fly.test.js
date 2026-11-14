// 비행 슈트로 날기 검사 (날기 단추 · 떠오르기 · 날아가기와 벽·가구 · 층 넘기 · 마당 · 착지 · 다른 기능과 부딪힐 때 · 친구 화면 · 권한 없는 사람). 실행: cd tree/tests && node fly.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8200, BASE = `http://localhost:${PORT}/tree/`;
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
  await p.addInitScript(() => { if (new URLSearchParams(location.search).get('ns') === 'fya') localStorage.setItem('tree.master.fya', 'de94e28d7a302b52374831e94e8c70adddf861c691e77ab53f0646f55543a3e7'); }); // 비행 슈트는 마스터키를 켠 사람만 (방장 창)
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
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=fya`);
    const shot = async (p, name) => { await T(p, () => window.__tree.snapView()); await sleep(250); await p.screenshot({ path: path.join(__dirname, 'out', name) }); };

    /* 단추 */
    await place(A, 4, 12);
    check('비행 슈트를 안 입었으면 날기 단추가 없고 날 수 없음', !(await F(A)).shown && (await T(A, () => window.__fly.start())) === false && !(await F(A)).on);
    await T(A, () => window.__tree.setLook({ outfit: 'jet' })); await sleep(300);
    check('권한이 있는 사람이 비행 슈트를 입으면 "🚀 날기" 단추가 보임 (화면 안·44px 이상·다른 단추와 안 겹침)', (await A.isVisible('#flyBtn')) && (await A.textContent('#flyBtn')).includes('날기') && !(await A.isVisible('#flyUp')) && (await audit(A)).length === 0 && (await overlaps(A)).length === 0, [await audit(A), await overlaps(A)]);
    check('땅에 있을 때는 불꽃이 안 보임', !(await F(A)).jets && (await F(A)).y === 0);
    await A.tap('#flyBtn');
    check('누르면 떠올라 0.55 높이에 떠 있음', await until(async () => { const f = await F(A); return f.on && Math.abs(f.alt - 0.55) < 0.06; }, 8000), await F(A));
    const f1 = await F(A);
    check('나는 동안: 손발의 불꽃이 보이고, ▲▼ 단추와 "착지"가 보임 (화면 안·44px 이상·안 겹침)', f1.jets && f1.arrows && (await A.isVisible('#flyUp')) && (await A.isVisible('#flyDown')) && (await A.textContent('#flyBtn')).includes('착지') && (await audit(A)).length === 0 && (await overlaps(A)).length === 0, [f1, await audit(A), await overlaps(A)]);
    await shot(A, 'fly-hover.png');

    /* 날아가기와 막히는 것 */
    await T(A, () => window.__tree.dispatch({ t: 'put', id: 'sf', k: 'sofa', i: 10, j: 12, r: 0 }));
    const t0 = Date.now(), [gx, gz] = cxz(4, 4);
    check('바닥을 누르면(goTo) 그쪽으로 날아감', (await T(A, (a) => window.__tree.goTo(a[0], a[1]), [gx, gz])) === true);
    await sleep(150);
    const mid = await F(A);
    check('나아갈 때는 몸을 앞으로 눕힘', mid.bx > 0.3 && mid.on, mid.bx);
    check('누른 자리에 닿고 높이는 그대로', await until(async () => { const f = await F(A); return Math.hypot(f.x - gx, f.z - gz) < 0.06 && Math.abs(f.alt - 0.55) < 0.06; }, 12000), await F(A));
    await T(A, (a) => window.__tree.goTo(a[0], a[1]), cxz(4, 12)); await until(async () => Math.hypot((await F(A)).x + 1.75, (await F(A)).z - 2.25) < 0.06, 12000);
    await T(A, (a) => window.__tree.goTo(a[0], a[1]), cxz(12, 12)); // 소파 쪽으로
    await sleep(2500);
    const blk = await F(A);
    check('가구(소파)에 막혀 그 앞에서 멈춤', blk.on && blk.x < -4 + 10 * 0.5 - 0.15 && (await T(A, () => window.__tree.grid.fits(window.__tree.me.x, window.__tree.me.z))), blk);
    await T(A, () => window.__tree.goTo(-9, 2.25)); await sleep(2500);
    const wall = await F(A);
    check('벽 밖으로 못 나감', wall.x >= -4 + 0.17 && wall.x < -3.5 && (await T(A, () => window.__tree.grid.fits(window.__tree.me.x, window.__tree.me.z))), wall);
    await A.keyboard.down('ArrowRight'); await sleep(700); await A.keyboard.up('ArrowRight');
    const key = await F(A);
    check('방향키로도 날아감', Math.hypot(key.x - wall.x, key.z - wall.z) > 0.5 && key.on, [wall.x, wall.z, key.x, key.z]);

    /* 그 앞에서 스페이스바와 사다리 */
    await place(A, 18, 8);
    check('나는 중에는 사다리 옆에서도 할 수 있는 일이 안 뜸 (사다리를 타지 않음)', (await T(A, () => window.__tree.nearAction())) === null && !(await A.isVisible('#act')));

    /* 오르내리기와 층 넘기 */
    await place(A, 4, 12);
    await A.keyboard.down('KeyR');
    check('R(▲)을 누르면 천장 밑(1.2)까지 오름', await until(async () => Math.abs((await F(A)).alt - 1.2) < 0.03 || (await F(A)).lv === 1, 8000), await F(A));
    check('천장에서 더 누르고 있으면 2층으로 넘어감 (화면도 2층)', await until(async () => { const f = await F(A); return f.lv === 1 && f.view === 1 && !f.cross; }, 10000), await F(A));
    await A.keyboard.up('KeyR');
    const up1 = await F(A);
    check('넘어온 자리는 같은 자리의 2층, 2층 바닥 위에 떠 있음', Math.abs(up1.x - (-1.75 + 16)) < 0.01 && Math.abs(up1.z - 2.25) < 0.01 && up1.y > 2.8 && up1.y < 2.8 + 1.21 && up1.on, up1);
    await shot(A, 'fly-2f.png');
    await hold(A, 1);
    check('▲ 단추로 3층까지', await until(async () => { const f = await F(A); return f.lv === 2 && f.view === 2 && !f.cross; }, 12000), await F(A));
    await sleep(1500);
    const top = await F(A);
    check('3층 천장 위로는 못 감', top.lv === 2 && Math.abs(top.alt - 1.2) < 0.03 && top.on, top);
    await hold(A, -1);
    check('▼ 를 누르고 있으면 3층 → 2층 → 1층으로 내려와 착지', await until(async () => { const f = await F(A); return !f.on && f.lv === 0 && f.y === 0; }, 25000), await F(A));
    await hold(A, 0);
    const dn = await F(A);
    check('착지하면 불꽃이 꺼지고 ▲▼ 가 사라지고 다시 "날기"', !dn.jets && !dn.arrows && dn.view === 0 && (await A.textContent('#flyBtn')).includes('날기') && Math.abs(dn.x + 1.75) < 0.01, dn);
    check('착지한 뒤에는 걸어서 감', (await T(A, (a) => window.__tree.goTo(a[0], a[1]), cxz(6, 12))) === true && await until(() => T(A, () => window.__tree.me.moving), 3000));
    await until(() => T(A, () => !window.__tree.me.moving && !window.__tree.me.path.length), 8000);

    // 위층에 가구가 있는 자리 밑에서 올라가면 가까운 빈칸으로
    await T(A, () => window.__tree.dispatch({ t: 'put', id: 'up', k: 'sofa', i: 32 + 3, j: 12, r: 0 }));
    await place(A, 4, 12);
    await T(A, () => window.__fly.start()); await hold(A, 1);
    await until(async () => { const f = await F(A); return f.lv === 1 && !f.cross; }, 12000);
    await hold(A, 0);
    const side = await F(A);
    check('위층 그 자리에 가구가 있으면 가장 가까운 빈칸으로 올라섬', side.lv === 1 && (await T(A, () => window.__tree.grid.fits(window.__tree.me.x, window.__tree.me.z))) && Math.hypot(side.x - 14.25, side.z - 2.25) < 1.6, side);
    await A.tap('#flyBtn');
    check('"착지"를 누르면 그 층 바닥에 내려앉음', await until(async () => { const f = await F(A); return !f.on && f.lv === 1 && Math.abs(f.y - 2.8) < 1e-6; }, 8000), await F(A));

    /* 마당 */
    await place(A, 14, 23);
    const yardOk = await T(A, () => window.__tree.grid.fits(window.__tree.me.x, window.__tree.me.z));
    await T(A, () => window.__tree.snapView()); const z0 = await T(A, () => window.__tree.view.z);
    await T(A, () => window.__fly.start()); await hold(A, 1);
    await until(async () => (await F(A)).alt > 5, 20000); await hold(A, 0);
    const AIR = (p) => T(p, () => ({ air: window.__fly.air, wide: window.__fly.wide, alt: window.__fly.alt, z: window.__tree.view.z, wx: window.__tree.me.root.position.x, wz: window.__tree.me.root.position.z, sx: window.__tree.me.x, sz: window.__tree.me.z, lv: window.__tree.me.level }));
    check('마당에서 1.5 보다 높이 뜨면 하늘(세상 좌표)로 침', !!(await AIR(A)).air && (await F(A)).lv === 0, await AIR(A));
    await T(A, () => window.__tree.goTo(window.__tree.me.x, -1)); await sleep(2500);
    const roof = await AIR(A);
    check('지붕(9.0)보다 낮게 뜬 채로는 집 위로 넘어가지 못함', roof.wz > -4 + 19 * 0.5 && roof.alt < 9 && (await F(A)).on, roof);
    await hold(A, 1);
    check('마당·하늘에서는 16 까지 오름. 층은 그대로 1층', yardOk && await until(async () => Math.abs((await F(A)).alt - 16) < 0.03, 20000) && (await F(A)).lv === 0 && (await F(A)).view === 0, await F(A));
    await hold(A, 0);
    await shot(A, 'fly-yard.png');
    await T(A, () => window.__fly.airTo(window.__fly.air.x, -1));
    check('지붕보다 높이 뜨면 집 위를 지나감 (격자의 자리는 마당에 남고 층은 1층)', await until(async () => Math.abs((await AIR(A)).wz + 1) < 0.1, 12000) && (await AIR(A)).sz >= -4 + 19 * 0.5 && (await AIR(A)).lv === 0, await AIR(A));
    await hold(A, -1); await sleep(2500); await hold(A, 0);
    check('집 위에서는 지붕 높이(9.0)보다 아래로 못 내려감', Math.abs((await AIR(A)).alt - 9) < 0.05 && (await F(A)).on, await AIR(A));
    /* 집 밖 하늘 */
    await T(A, () => window.__fly.airTo(-12, 3));
    check('집 밖(울타리 너머)으로 날아감: 세상 좌표는 집 밖, 격자의 자리는 마당 가장자리', await until(async () => { const a = await AIR(A); return Math.hypot(a.wx + 12, a.wz - 3) < 0.1; }, 15000) && Math.abs((await AIR(A)).sx - (-4 + 0.18)) < 0.01 && (await AIR(A)).lv === 0, await AIR(A));
    const out = await AIR(A);
    check('집 밖에서는 화면이 물러나 집·마당이 같이 보이고, 나는 화면 안에 있음', out.wide === 1 && await until(async () => (await AIR(A)).z < Math.min(z0, 1) - 0.05, 5000) && await T(A, () => { const p = window.__tree.me.root.position, s = window.__tree.screenOf(p.x, p.z, p.y + 0.6); return s.x > 10 && s.x < innerWidth - 10 && s.y > 50 && s.y < innerHeight - 150; }), [out, z0, await T(A, () => { const p = window.__tree.me.root.position; return window.__tree.screenOf(p.x, p.z, p.y + 0.6); })]);
    await shot(A, 'fly-out.png');
    await T(A, () => window.__fly.airTo(-60, 2.75)); await sleep(9000);
    const far = await AIR(A), fd = Math.hypot(far.wx - 3.5, far.wz - 2.75);
    check('너무 멀리는 못 감: 경계(20) 안에서 부드럽게 멈춤', fd > 15 && fd <= 20.01 && (await F(A)).on, [far, fd]);
    await A.keyboard.down('ArrowLeft'); await sleep(900); await A.keyboard.up('ArrowLeft');
    const far2 = await AIR(A);
    check('경계에서 방향키로 더 밀어도 넘어가지 않음', Math.hypot(far2.wx - 3.5, far2.wz - 2.75) <= 20.01, far2);
    await hold(A, -1);
    check('집 밖에서는 1.5 보다 아래로 못 내려가고, ▼ 를 더 누르면 마당의 빈칸으로 날아와 내려앉음', await until(async () => { const f = await F(A); return !f.on && f.y === 0; }, 30000) && (await T(A, () => window.__tree.grid.fits(window.__tree.me.x, window.__tree.me.z))) && (await F(A)).z > 5.5 && (await AIR(A)).air === null, [await F(A), await AIR(A)]);
    await hold(A, 0);
    check('내려서면 화면이 원래 크기로 돌아옴', await until(async () => Math.abs((await AIR(A)).z - z0) < 0.02, 6000), [(await AIR(A)).z, z0]);
    await place(A, 14, 23);
    await T(A, () => window.__fly.start()); await hold(A, 1); await until(async () => (await F(A)).alt > 6, 20000); await hold(A, 0);
    await T(A, () => window.__tree.dispatch({ t: 'put', id: 'sm', k: 'snowman', i: 20, j: 23, r: 0 }));
    await T(A, (a) => window.__tree.goTo(a[0], a[1]), cxz(20, 23));
    check('높이 뜨면 마당의 가구(눈사람) 위를 지나감', await until(async () => { const f = await F(A), [x, z] = cxz(20, 23); return Math.hypot(f.x - x, f.z - z) < 0.06; }, 12000), await F(A));
    await hold(A, -1); await until(async () => (await F(A)).alt < 1.51, 15000); await sleep(800); await hold(A, 0);
    const over = await F(A);
    check('가구 위에서는 가구 높이(1.5)보다 아래로 못 내려감', over.on && Math.abs(over.alt - 1.5) < 0.03, over);
    await A.tap('#flyBtn');
    check('그 위에서 착지하면 가장 가까운 빈칸에 내려앉음', await until(async () => { const f = await F(A); return !f.on && f.y === 0; }, 10000) && (await T(A, () => window.__tree.grid.fits(window.__tree.me.x, window.__tree.me.z))), await F(A));

    /* 다른 것과 부딪힐 때 */
    await T(A, () => window.__fly.start()); await until(async () => (await F(A)).alt > 0.5, 5000);
    await A.tap('#tabs button[data-m="furn"]'); await sleep(300);
    check('나는 중에 가구 탭을 열면 바로 내려서고 날기 단추도 숨음', !(await F(A)).on && (await F(A)).y === 0 && !(await F(A)).shown);
    await A.tap('#tabs button[data-m="furn"]'); await sleep(300);
    await T(A, () => window.__fly.start()); await until(async () => (await F(A)).alt > 0.5, 5000);
    await T(A, () => window.__snow.set(true)); await sleep(300);
    check('눈싸움 모드를 켜면 내려서고, 켜 둔 동안에는 날 수 없음', !(await F(A)).on && (await T(A, () => window.__snow.on)) && !(await F(A)).shown && (await T(A, () => window.__fly.start())) === false);
    await T(A, () => window.__snow.set(false)); await sleep(300);
    await T(A, () => window.__fly.start()); await until(async () => (await F(A)).alt > 0.5, 5000);
    await T(A, () => window.__tree.setLook({ outfit: 'basic' })); await sleep(300);
    check('나는 중에 옷을 갈아입으면 내려섬', !(await F(A)).on && (await F(A)).y === 0 && !(await F(A)).shown);
    await T(A, () => window.__tree.setLook({ outfit: 'jet' }));

    /* 친구 화면 */
    await place(A, 4, 12);
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=fyb#r=${room}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 2 && (await T(B, () => window.__duo.others)).length === 1, 20000);
    const bid = await T(B, () => window.__duo.me);
    const peer = (p, id = 'h') => T(p, (id) => { const o = window.__duo.others.find((x) => x.id === id), f = window.__fly.peer(id); return o ? { fly: f, level: o.level, shown: o.shown, x: o.x, z: o.z } : null; }, id);
    await T(A, () => window.__fly.start());
    check('방장이 날면 친구 화면에서도 떠 있고 불꽃이 보임', await until(async () => { const p = await peer(B); return p && p.fly && Math.abs(p.fly.y - 0.55) < 0.08 && p.fly.jets; }, 8000), await peer(B));
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=fyc#v=${rid}`);
    check('떠 있는 동안 들어온 사람(구경)에게도 날고 있는 모습이 보임', await until(async () => { const p = await peer(C); return p && p.fly && Math.abs(p.fly.y - 0.55) < 0.08; }, 20000), await peer(C));
    await shot(B, 'fly-peer.png');
    await T(A, (a) => window.__tree.goTo(a[0], a[1]), cxz(8, 14));
    check('날아간 자리도 친구에게 전해짐', await until(async () => { const p = await peer(B), [x, z] = cxz(8, 14); return Math.hypot(p.x - x, p.z - z) < 0.15 && p.fly; }, 12000), await peer(B));
    await hold(A, 1);
    await until(async () => { const f = await F(A); return f.lv === 1 && !f.cross; }, 12000);
    await hold(A, 0);
    const ay = (await F(A)).y;
    check('방장이 날아서 2층으로 넘어가면 친구 화면에서는 1층에서 사라짐 (2층에 있음, 사다리를 타지 않음)', await until(async () => { const p = await peer(B); return p.level === 1 && !p.shown && p.fly && Math.abs(p.fly.y - ay) < 0.1; }, 8000) && !(await T(B, () => window.__duo.others[0].climbing)), [await peer(B), ay]);
    await A.tap('#flyBtn');
    check('착지하면 친구 화면에서도 내려서고 불꽃이 꺼짐', await until(async () => { const p = await peer(B), q = await peer(C); return p && !p.fly && q && !q.fly; }, 10000), await peer(B));

    /* 권한 없는 사람 */
    check('권한 없는 친구는 날기 단추가 없고 날 수 없음', !(await F(B)).shown && (await T(B, () => window.__fly.start())) === false && !(await F(B)).on && !(await F(C)).shown);
    await T(B, () => window.__tree.setLook({ outfit: 'jet' })); await sleep(300);
    check('권한 없는 친구는 비행 슈트를 입을 수 없음', (await T(B, () => window.__tree.look.outfit)) !== 'jet' && !(await F(B)).shown, await T(B, () => window.__tree.look.outfit));
    await T(A, (who) => { for (const v of ['3.00', '0.55']) window.__duo.feed({ t: 'fx', k: 'fly', v }, who); }, bid);
    await sleep(400);
    check('비행 슈트를 안 입은 친구가 보낸 "날고 있다"는 소식은 받지 않음', (await peer(A, bid)).fly === null && (await peer(C, bid)).fly === null);
    await T(A, (who) => { window.__duo.feed({ t: 'look', look: { gender: 'm', outfit: 'jet', face: 'smile' } }, who); window.__duo.feed({ t: 'fx', k: 'fly', v: '0.80' }, who); }, bid);
    check('방장이 아니어도 비행 슈트를 입은 사람이 난다는 소식은 그대로 받고 전함 (권한은 그 사람 기기에서 판단)', await until(async () => { const p = await peer(A, bid), q = await peer(C, bid); return p && p.fly && Math.abs(p.fly.to - 0.8) < 0.01 && q && q.fly; }, 6000), [await peer(A, bid), await peer(C, bid)]);
    await T(A, (who) => window.__duo.feed({ t: 'fx', k: 'fly', v: '' }, who), bid); await sleep(300);
    await T(B, () => { for (const v of ['abc', '99.00', '-1.00', 5, null, 'x'.repeat(99), '1.5']) window.__duo.feed({ t: 'fx', id: 'h', k: 'fly', v }); window.__duo.feed({ t: 'fx', id: 'zz', k: 'fly', v: '2.00' }); });
    await sleep(300);
    check('이상한 높이 소식이 와도 버팀', (await peer(B)).fly === null && errors.length === 0);
    /* 집 밖 하늘을 나는 모습이 친구에게도 */
    await place(A, 14, 23); await T(A, () => window.__fly.start()); await hold(A, 1); await until(async () => (await F(A)).alt > 4, 20000); await hold(A, 0);
    await T(A, () => window.__fly.airTo(-10, 9));
    await until(async () => Math.hypot((await T(A, () => window.__fly.air.x)) + 10, (await T(A, () => window.__fly.air.z)) - 9) < 0.1, 15000);
    const ay2 = (await F(A)).y;
    check('집 밖 하늘의 자리와 높이가 친구·구경하는 사람 화면에서도 같은 곳', await until(async () => { const p = await peer(B), q = await peer(C); return p && p.fly && p.fly.air && Math.hypot(p.fly.wx + 10, p.fly.wz - 9) < 0.2 && Math.abs(p.fly.y - ay2) < 0.1 && q && q.fly && Math.hypot(q.fly.wx + 10, q.fly.wz - 9) < 0.2; }, 8000), [await peer(B), ay2]);
    await T(B, (a) => { window.__tree.me.stop(); window.__tree.me.place(a[0] + 16, a[1]); }, cxz(4, 12));
    check('하늘을 나는 사람은 2층에 있는 친구에게도 보임 (같은 세상 자리)', await until(async () => (await T(B, () => window.__tree.level)) === 1 && (await peer(B)).fly.seen, 5000) && Math.hypot((await peer(B)).fly.wx + 10, (await peer(B)).fly.wz - 9) < 0.2, await peer(B));
    await T(B, (a) => { window.__tree.me.place(a[0], a[1]); }, cxz(4, 12));
    await T(B, () => { for (const v of ['5.00;99.00;1.00', '5.00;1.00', '0.50;-9.00;2.00', 's5.00;-30.00;-30.0', '5.00;-9.00;2.00;1']) window.__duo.feed({ t: 'fx', id: 'h', k: 'fly', v }); });
    await sleep(300);
    check('이상한 하늘 자리 소식(너무 멂·모자람·너무 낮음)은 받지 않음', Math.hypot((await peer(B)).fly.air.tx + 10, (await peer(B)).fly.air.tz - 9) < 0.05 && errors.length === 0, await peer(B));
    await T(A, () => window.__fly.land(true)); await sleep(400);
    check('바로 내려서면(놀이 시작 등) 마당의 빈칸에 서고 친구 화면에서도 내려섬', (await F(A)).y === 0 && (await T(A, () => window.__tree.grid.fits(window.__tree.me.x, window.__tree.me.z))) && await until(async () => !(await peer(B)).fly, 5000), await F(A));
    await T(A, () => window.__tree.setLook({ outfit: 'santa' })); await sleep(300);
    await T(B, () => window.__duo.feed({ t: 'fx', id: 'h', k: 'fly', v: '2.00' })); await sleep(200);
    check('비행 슈트를 안 입은 사람이 난다는 소식은 받지 않음', (await peer(B)).fly === null);
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
