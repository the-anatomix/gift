// 마당 눈싸움 검사 (단추, 던지기, 벽·거리 제한, 1인칭과 F 키, 친구에게 보이는지, 맞히기). 실행: cd tree/tests && node snow.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8175, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__snow && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
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
// 자리 (x, z) 에 서서 화면이 자리를 잡게 한다
const stand = (p, x, z) => T(p, ([x, z]) => { const t = window.__tree; t.me.stop(); t.me.place(x, z); t.snapView(); }, [x, z]);
const idle = (p) => until(() => T(p, () => window.__snow.balls === 0 && window.__snow.ready), 4000);

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=sa`);

    /* 단추 */
    await sleep(400);
    check('집 안에서는 눈덩이 단추가 안 보임', !(await A.isVisible('#snowBtn')) && !(await T(A, () => window.__snow.yard)));
    await stand(A, 1.5, 8.5); await sleep(400);
    check('마당에 나가면 "❄️ 눈덩이" 단추가 보임', (await A.isVisible('#snowBtn')) && (await A.textContent('#snowBtn')).includes('눈덩이'));
    // #act 단추가 보이는 자리(가구 앞)에서 겹치지 않는지도 본다: #act 가 가장 넓을 때의 범위는 가운데 100vw - 150px
    const box = await T(A, () => { const r = document.getElementById('snowBtn').getBoundingClientRect(), b = document.getElementById('bottom').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, bt: b.top, iw: innerWidth }; });
    check('단추는 44px 이상, 화면 안, 아래 판 위, 가운데 단추(#act) 자리와 안 겹침', box.w >= 44 && box.h >= 44 && box.r <= box.iw && box.b <= box.bt && box.l >= box.iw - 75 && (await audit(A)).length === 0, { box, bad: await audit(A) });
    await A.tap('#snowBtn'); await sleep(200);
    check('누르면 눈싸움 모드가 켜짐', (await T(A, () => window.__snow.on)) && (await A.getAttribute('#snowBtn', 'aria-pressed')) === 'true');

    /* 던지기 */
    const at = await T(A, () => window.__tree.screenOf(window.__tree.me.x + 2.5, window.__tree.me.z - 0.5, 0));
    await A.touchscreen.tap(at.x, at.y); await sleep(120);
    let fl = await T(A, () => window.__snow.flying());
    check('마당을 누르면 걸어가지 않고 그쪽으로 눈덩이를 던짐', fl.length === 1 && Math.abs(fl[0].to[0] - 4.0) < 0.15 && Math.abs(fl[0].to[2] - 8.0) < 0.15 && !(await T(A, () => window.__tree.me.moving || window.__tree.me.path.length > 0)), fl);
    check('던지는 몸짓: 오른팔을 들어 휘두름', (await T(A, () => window.__snow.arm('me'))) < -1, await T(A, () => window.__snow.arm('me')));
    await A.screenshot({ path: path.join(__dirname, 'out', 'snow-throw.png') });
    await idle(A);
    // 날아가는 동안의 높이를 장면마다 적어 둔다
    const ys = await T(A, () => new Promise((res) => { const t = window.__tree.me, out = []; window.__snow.throwAt(t.x + 3, t.z); const f = () => { const b = window.__snow.flying()[0]; if (b) { out.push(b.y); requestAnimationFrame(f); } else res(out); }; requestAnimationFrame(f); }));
    check('눈덩이는 손 높이에서 떠올라 포물선으로 날아감', ys.length > 3 && ys[0] > 0.9 && Math.max(...ys) > 1.4 && Math.max(...ys) > ys[0] + 0.1 && ys[ys.length - 1] < 0.4, ys.map((y) => +y.toFixed(2)));
    check('떨어진 자리에 눈이 퍽 흩어짐', await until(() => T(A, () => window.__snow.balls === 0 && window.__snow.puffs > 0), 2000));
    await idle(A);
    check('0.6초에 한 번까지만 던짐', await T(A, () => { window.__snow.throwAt(3, 9); return window.__snow.throwAt(3, 9) === false && window.__snow.balls === 1; }));
    await idle(A);
    fl = await T(A, () => { window.__snow.throwAt(window.__tree.me.x + 20, window.__tree.me.z); return window.__snow.flying(); });
    check('멀리 누르면 6m 까지만 날아감', fl.length === 1 && Math.abs(fl[0].to[0] - 7.5) < 0.05 && Math.abs(fl[0].to[2] - 8.5) < 0.05, fl);
    await idle(A);
    await stand(A, 1.5, 6.2);
    fl = await T(A, () => { window.__snow.throwAt(1.5, 2); return window.__snow.flying(); });
    check('집 쪽으로 던져도 벽(z 5.2)을 넘지 않음', fl.length === 1 && fl[0].to[2] >= 5.2 - 1e-6 && fl[0].to[2] < 5.25, fl);
    await idle(A);
    check('마당 밖(울타리 너머)으로는 나가지 않음', await T(A, () => { window.__snow.throwAt(-30, 9); const f = window.__snow.flying()[0]; return f && f.to[0] >= -4 && f.to[2] <= 9.5; }));
    await idle(A);

    /* 다른 판이 열리면 꺼짐 */
    await A.tap('#tabs button[data-m="furn"]'); await sleep(300);
    check('가구 탭을 열면 눈싸움 모드가 꺼지고 단추가 숨음', !(await T(A, () => window.__snow.on)) && !(await A.isVisible('#snowBtn')));
    await A.tap('#tabs button[data-m="furn"]'); await sleep(300);
    check('가구 탭을 닫으면 단추가 다시 보임 (모드는 꺼진 그대로)', (await A.isVisible('#snowBtn')) && !(await T(A, () => window.__snow.on)));
    await T(A, () => window.__snow.set(true));
    await T(A, () => window.__tree.setMode('tree')); await sleep(400);
    check('트리 꾸미기를 열면 꺼짐', !(await T(A, () => window.__snow.on)));
    await T(A, () => window.__tree.setMode(null)); await sleep(300);
    await stand(A, 1.5, 8.5); await sleep(300);
    await T(A, () => window.__snow.set(true));
    const before = await T(A, () => [window.__tree.me.x, window.__tree.me.z]);
    await stand(A, 1.5, 3); await sleep(400);
    check('집 안으로 들어가면 단추가 숨고 모드가 꺼짐', !(await A.isVisible('#snowBtn')) && !(await T(A, () => window.__snow.on)) && (await T(A, () => window.__snow.throwAt(1, 7))) === false);
    const at2 = await T(A, () => window.__tree.screenOf(2.5, 3, 0));
    await A.touchscreen.tap(at2.x, at2.y);
    check('모드가 꺼져 있으면 누르면 다시 걸어감', await until(() => T(A, () => window.__tree.me.moving), 1500));
    await stand(A, before[0], before[1]);

    /* 1인칭 */
    await T(A, () => { window.__tree.setPov(true); window.__tree.lookTo(1, 0); }); await sleep(300);
    await T(A, () => window.__snow.set(true));
    check('1인칭에서도 단추가 보이고 켜짐', (await A.isVisible('#snowBtn')) && (await T(A, () => window.__snow.on)) && (await audit(A)).length === 0, await audit(A));
    await idle(A);
    const mid = await T(A, () => { const t = document.getElementById('top').getBoundingClientRect().bottom, b = document.getElementById('bottom').getBoundingClientRect().top; return { x: innerWidth / 2, y: (t + b) / 2 + 60 }; });
    await A.touchscreen.tap(mid.x, mid.y); await sleep(100);
    fl = await T(A, () => window.__snow.flying());
    check('1인칭에서 누르면 보는 쪽(앞)으로 던짐', fl.length === 1 && fl[0].to[0] > 2.5 && Math.abs(fl[0].to[2] - 8.5) < 1, fl);
    await A.screenshot({ path: path.join(__dirname, 'out', 'snow-fp.png') });
    await idle(A);
    await A.keyboard.press('f'); await sleep(100);
    fl = await T(A, () => window.__snow.flying());
    check('1인칭에서 F 키는 화면 가운데 쪽으로 던짐', fl.length === 1 && fl[0].to[0] > 2.5 && Math.abs(fl[0].to[2] - 8.5) < 0.6, fl);
    await idle(A);
    await T(A, () => window.__tree.setPov(false)); await sleep(200);
    await T(A, () => { const m = window.__tree.me; m.turnTo(0, 1); m.root.rotation.y = m.face; });
    await A.keyboard.press('f'); await sleep(100);
    fl = await T(A, () => window.__snow.flying());
    check('내려다볼 때 F 키는 아바타가 바라보는 쪽으로 던짐', fl.length === 1 && Math.abs(fl[0].to[0] - 1.5) < 0.1 && fl[0].to[2] > 8.6, fl);
    await idle(A);

    /* 여럿이: 친구에게 보이고, 맞히기 */
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=sb#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=sc#v=${rid}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    const bid = await T(B, () => window.__duo.me), cid = await T(C, () => window.__duo.me);
    await stand(A, 1.5, 8.5); await stand(B, 4.5, 8.5); await stand(C, 6.5, 6.5);
    const seenAt = (p, id, x, z) => until(() => T(p, ([id, x, z]) => { const o = window.__duo.others.find((q) => q.id === id); return o && Math.abs(o.x - x) < 0.05 && Math.abs(o.z - z) < 0.05; }, [id, x, z]), 5000);
    await seenAt(A, bid, 4.5, 8.5); await seenAt(B, 'h', 1.5, 8.5); await seenAt(C, 'h', 1.5, 8.5); await seenAt(C, bid, 4.5, 8.5); await seenAt(A, cid, 6.5, 6.5);
    await sleep(300);
    // 빗나가는 공: 친구들 화면에도 방장 자리에서 날아감
    await T(A, () => window.__snow.throwAt(1.5, 6.0));
    check('던진 눈덩이가 친구(꾸미는 사람·구경하는 사람) 화면에도 날아감', await until(async () => (await T(B, () => window.__snow.flying().some((f) => f.who === 'h' && Math.abs(f.to[2] - 6) < 0.02))) && (await T(C, () => window.__snow.flying().some((f) => f.who === 'h'))), 1500));
    await idle(A); await sleep(400);
    check('빗나가면 아무도 눈을 뒤집어쓰지 않음', !(await T(A, (b) => window.__snow.snowy(b), bid)) && (await T(A, () => window.__snow.hits)) === 0);
    // 맞히기
    await T(A, () => window.__snow.throwAt(4.5, 8.5));
    check('던진 사람 화면에서 친구가 맞으면 "명중!" 과 맞힌 횟수가 오름', await until(async () => (await T(A, () => window.__snow.hits)) === 1 && (await A.textContent('#toast')).includes('명중'), 2500), { hits: await T(A, () => window.__snow.hits), toast: await A.textContent('#toast') });
    check('화면 한쪽에 내가 맞힌 횟수가 보임', (await A.isVisible('#snowScore')) && (await A.textContent('#snowScore')).includes('1'));
    check('맞은 사람은 모두의 화면에서 눈을 뒤집어씀 (머리·어깨에 눈 뭉치)', await until(async () => (await T(A, (b) => window.__snow.snowy(b), bid)) && (await T(B, (b) => window.__snow.snowy(b), bid)) && (await T(C, (b) => window.__snow.snowy(b), bid)), 2500));
    check('옷을 바꿔도 눈은 그대로 붙어 있음', await T(B, async () => { window.__tree.setLook({ outfit: 'santa' }); await new Promise((r) => setTimeout(r, 200)); const s = window.__tree.me.snowy; return !!s && s.gs[0].parent === window.__tree.me.parts.head; }));
    check('맞은 사람에게 "눈덩이에 맞았어요! ☃️" 알림', (await B.textContent('#toast')).includes('눈덩이에 맞았어요'), await B.textContent('#toast'));
    check('맞은 사람의 머리와 어깨에 흰 눈 뭉치가 붙어 있음', await T(B, () => { const s = window.__tree.me.snowy; return !!s && s.gs[0].parent === window.__tree.me.parts.head && s.gs[0].children.length >= 3 && s.gs[1].children.length >= 4; }));
    check('맞히지 않은 사람(구경하는 사람)은 그대로', !(await T(A, (c) => window.__snow.snowy(c), cid)) && !(await T(C, () => window.__snow.snowy('me'))));
    await T(A, () => window.__snow.set(true));
    await B.screenshot({ path: path.join(__dirname, 'out', 'snow-hit-b.png') });
    await A.screenshot({ path: path.join(__dirname, 'out', 'snow-hit-a.png') });
    check('몇 초 뒤에는 털어 냄', await until(async () => !(await T(B, () => window.__snow.snowy('me'))) && !(await T(A, (b) => window.__snow.snowy(b), bid)), 8000));
    // 손님이 던져 방장을 맞힘 (방장이 다른 사람에게 전해 준다)
    await T(B, () => window.__snow.throwAt(1.5, 8.5));
    check('손님이 방장을 맞히면 방장과 구경하는 사람 화면에서도 방장이 눈을 뒤집어씀', await until(async () => (await T(A, () => window.__snow.snowy('me'))) && (await T(C, () => window.__snow.snowy('h'))) && (await T(B, () => window.__snow.hits)) === 1, 3000));
    check('방장의 맞힌 횟수는 그대로(내 것만 셈)', (await T(A, () => window.__snow.hits)) === 1);
    // 집 안에 있는 사람은 맞지 않는다
    await idle(B);
    await stand(B, 4.5, 4.4); await seenAt(A, bid, 4.5, 4.4);
    await stand(A, 4.5, 6.0); await sleep(200);
    await T(A, () => window.__snow.throwAt(4.5, 4.4));
    await idle(A); await sleep(300);
    check('집 안에 있는 사람은 맞지 않음 (벽을 넘지 않음)', (await T(A, () => window.__snow.hits)) === 1 && !(await T(B, () => window.__snow.snowy('me'))));
    // 2층에 있는 사람도 맞지 않는다: 격자에서 2층 자리는 마당과 겹치지 않는다
    check('2층에 있는 사람은 마당 사람으로 치지 않음', await T(A, () => { const t = window.__tree; return t.FLOOR_DX > 15 && t.toWorld(t.FLOOR_DX + 1, 2)[1] > 0 && t.toWorld(1, 7)[1] === 0; }));

    /* 이상한 소식 */
    const n0 = await T(B, () => window.__snow.balls);
    await T(B, () => { for (const m of [{ t: 'fx', id: 'h', k: 'snow', v: 'abc' }, { t: 'fx', id: 'h', k: 'snow', v: '1,99' }, { t: 'fx', id: 'h', k: 'snow', v: 5 }, { t: 'fx', id: 'zzz', k: 'snow', v: '1,7' }, { t: 'fx', id: 'h', k: 'hit', v: '<x>' }, { t: 'fx', id: 'h', k: 'hit', v: 'nobody' }, { t: 'fx', id: 'h', k: 'snow', v: '1,'.repeat(20) }]) window.__duo.feed(m); });
    await sleep(200);
    check('이상한 눈싸움 소식이 와도 버팀 (아무 일 없음)', (await T(B, () => window.__snow.balls)) === n0 && !(await T(B, () => window.__snow.snowy('me'))));
    check('눈싸움 단추가 있어도 화면의 단추가 모두 44px 이상·화면 안', (await audit(A)).length === 0 && (await audit(B)).length === 0, [await audit(A), await audit(B)]);
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
