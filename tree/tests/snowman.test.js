// 마당 눈사람 같이 만들기 검사 (굴리기 단추, 굴리며 커지기·자국·몸짓, 여기 두기, 올리기 규칙, 완성 연출과 가구 눈사람, 눈싸움과 함께 켜지지 않기,
// 친구에게 보이기, 구경하는 사람이 완성하기, 새로 온 사람, 이상한 소식). 실행: cd tree/tests && node snowman.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8198, BASE = `http://localhost:${PORT}/tree/`;
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
// 보이는 것 중 서로 겹치는 단추들 (화면 위에 떠 있는 것만)
const overlaps = (p, ids) => p.evaluate((ids) => {
  const box = (id) => { const e = document.getElementById(id); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; return e.getBoundingClientRect(); };
  const out = [];
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const r = box(ids[a]), q = box(ids[b]);
    if (r && q && r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom) out.push(ids[a] + '×' + ids[b]);
  }
  return out;
}, ids);
const stand = (p, x, z, fx = 1, fz = 0) => T(p, ([x, z, fx, fz]) => { const t = window.__tree; t.me.stop(); t.me.place(x, z); t.me.turnTo(fx, fz); t.me.root.rotation.y = t.me.face; t.snapView(); }, [x, z, fx, fz]);
const walk = async (p, x, z) => { await T(p, ([x, z]) => window.__tree.goTo(x, z), [x, z]); await until(() => T(p, () => !window.__tree.me.moving && !window.__tree.me.path.length), 15000); await sleep(150); };
const M = (p) => T(p, () => { const m = window.__snow.man; return { on: m.on, mine: m.mine, balls: m.balls(), go: m.go, shown: m.shown }; });
// 몸통 (bx, bz) 의 서쪽 1m 에 서서 동쪽(몸통 쪽)을 본다: 굴리던 뭉치가 몸통 바로 옆에 온다
const nearBase = async (p, b) => { await stand(p, b.x - 1.0, b.z); await sleep(200); };
const toastHas = (p, s, ms = 2500) => until(async () => (await p.textContent('#toast')).includes(s), ms);
const snowmen = (p) => T(p, () => [...window.__tree.S.items.values()].filter((o) => o.k === 'snowman').map((o) => ({ id: o.id, i: o.i, j: o.j })));

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ma&st=4000`);

    /* 단추 */
    await sleep(300);
    check('집 안에서는 굴리기 단추가 안 보임', !(await A.isVisible('#rollBtn')));
    await stand(A, -3, 9.0); await sleep(400);
    check('마당에 나가면 "⛄ 굴리기" 단추가 보임', (await A.isVisible('#rollBtn')) && (await A.textContent('#rollBtn')).includes('굴리기'));
    await T(A, () => window.__snow.set(true)); await sleep(300); // 눈싸움을 켜면 맞힌 횟수 칸도 보인다
    const box = await T(A, () => { const r = document.getElementById('rollBtn').getBoundingClientRect(), b = document.getElementById('bottom').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, bt: b.top, iw: innerWidth }; });
    check('굴리기 단추는 44px 이상, 화면 안, 아래 판 위, 오른쪽 끝(#act 자리 밖)', box.w >= 44 && box.h >= 44 && box.r <= box.iw && box.t >= 0 && box.b <= box.bt && box.l >= box.iw - 75, box);
    check('굴리기 단추가 눈덩이 단추·맞힌 횟수와 겹치지 않음', (await overlaps(A, ['rollBtn', 'snowBtn', 'snowScore', 'act'])).length === 0 && (await A.isVisible('#snowScore')), await overlaps(A, ['rollBtn', 'snowBtn', 'snowScore', 'act']));
    await A.tap('#rollBtn'); await sleep(250);
    let s = await M(A);
    check('누르면 굴리기가 켜지고 눈덩이 던지기는 꺼짐', s.on && !(await T(A, () => window.__snow.on)) && (await A.getAttribute('#rollBtn', 'aria-pressed')) === 'true' && (await A.getAttribute('#snowBtn', 'aria-pressed')) === 'false');
    check('내 앞(동쪽)에 작은 눈 뭉치(반지름 0.15)가 생김', s.mine && Math.abs(s.mine.r - 0.15) < 0.01 && s.mine.x > -3 + 0.3 && Math.abs(s.mine.z - 9.0) < 0.3, s.mine);
    const gb = await T(A, () => { const r = document.getElementById('rollGo').getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, h: r.height, t: r.top, b: r.bottom, bt: document.getElementById('bottom').getBoundingClientRect().top, iw: innerWidth }; });
    check('"📍 여기 두기" 단추: 왼쪽 끝, 44px 이상, 아래 판 위, #act 자리 밖', s.go.includes('여기 두기') && gb.w >= 44 && gb.h >= 44 && gb.l >= 0 && gb.r <= 75 && gb.b <= gb.bt, gb);
    check('눈덩이 단추를 누르면 굴리기가 꺼짐 (둘은 같이 켜지지 않음)', await T(A, () => { window.__snow.set(true); const a = window.__snow.on && !window.__snow.man.on; window.__snow.man.set(true); return a && window.__snow.man.on && !window.__snow.on; }));

    /* 굴리기 */
    await T(A, () => window.__tree.goTo(2, 9.0));
    await sleep(900);
    const mid = await M(A);
    check('걸으면 뭉치가 내 앞에서 굴러가며 커지고, 굴리는 몸짓(몸을 숙여 두 손으로 밈)', mid.mine && mid.mine.r > 0.17 && mid.mine.x > (await T(A, () => window.__tree.me.x)) && (await T(A, () => window.__snow.man.push('me'))) && (await T(A, () => window.__tree.me.parts.arms[0].rotation.x)) < -0.6, { mid: mid.mine, arm: await T(A, () => window.__tree.me.parts.arms[0].rotation.x) });
    await A.screenshot({ path: path.join(__dirname, 'out', 'snowman-roll.png') });
    await until(() => T(A, () => !window.__tree.me.moving && !window.__tree.me.path.length), 8000);
    s = await M(A);
    check('5m 쯤 굴리면 반지름 0.35 쯤', s.mine && s.mine.r > 0.31 && s.mine.r < 0.39, s.mine);
    check('눈밭에 굴린 자국이 남음', (await T(A, () => window.__snow.man.marks)) > 10);
    await walk(A, 7.5, 9.0);
    s = await M(A);
    check('10m 넘게 굴리면 반지름 0.55 까지만 큼', s.mine && Math.abs(s.mine.r - 0.55) < 0.005, s.mine);
    check('뭉치는 울타리 안에 머묾', s.mine && s.mine.z <= 9.5 - 0.12 - 0.55 + 1e-6 && s.mine.x <= 11 - 0.15 - 0.55 + 1e-6, s.mine);
    check('멈춰 서 있으면 밀던 손을 내린 채 그대로(굴리기 중)', s.on && (await T(A, () => window.__snow.man.push('me'))));
    await A.tap('#rollGo'); await sleep(200);
    s = await M(A);
    const body = s.balls.find((b) => b.s === 'b');
    check('"여기 두기" 를 누르면 그 자리에 몸통으로 놓이고 굴리기가 꺼짐', !!body && Math.abs(body.r - 0.55) < 0.005 && !s.on && !s.mine && (await toastHas(A, '몸통을 놓았어요')), s);

    /* 올리기 규칙 */
    await stand(A, -3, 6.2); await T(A, () => window.__snow.man.set(true)); await sleep(150);
    check('몸통 옆이 아니면 새 뭉치를 만든다 (놓인 몸통은 집어 오지 않음)', (await M(A)).mine && (await M(A)).mine.id !== body.id);
    await walk(A, 3.8, 6.2); // 7m 쯤
    const mid2 = (await M(A)).mine;
    await nearBase(A, body);
    s = await M(A);
    check('몸통 가까이(1m 안) 오면 단추가 "⬆️ 올리기" 로 바뀜', await until(async () => (await M(A)).go.includes('올리기'), 2000) && (await T(A, () => window.__snow.man.nearBase())) === body.id, s.go);
    check('순간 이동(멀리 한 번에 옮겨짐)으로는 커지지 않음', Math.abs(s.mine.r - mid2.r) < 0.01, [mid2, s.mine]);
    await A.tap('#rollGo'); await sleep(200);
    s = await M(A);
    let bb = s.balls.find((b) => b.id === body.id);
    check('더 작은 뭉치를 올리면 위에 쌓임 (머리만큼 작지 않으면 아직 완성 아님)', bb && bb.stack.length === 1 && Math.abs(bb.stack[0] - mid2.r) < 0.01 && !bb.made && !s.mine && s.balls.length === 1 && (await toastHas(A, '하나 더 올려요')), s);
    // 셋째 뭉치가 둘째보다 크면 올리지 못한다
    await stand(A, -3, 6.2); await T(A, () => window.__snow.man.set(true));
    await walk(A, 5.5, 6.2);
    const big = (await M(A)).mine;
    await nearBase(A, body); await A.tap('#rollGo'); await sleep(200);
    s = await M(A);
    check('위 뭉치보다 크거나 같은 뭉치는 올리지 못함 ("더 작은 뭉치만")', big.r > mid2.r && s.mine && s.mine.id === big.id && s.balls.find((b) => b.id === body.id).stack.length === 1 && (await toastHas(A, '더 작은 뭉치만')), { big, mid2, s });
    await A.tap('#rollBtn'); await sleep(200);
    s = await M(A);
    check('굴리기를 끄면 굴리던 뭉치는 그 자리에 놓임', !s.on && s.balls.find((b) => b.id === big.id).s === 'l');
    await T(A, () => window.__snow.man.set(true)); await sleep(150);
    check('놓인 뭉치 옆에서 다시 켜면 그것을 이어서 굴림', (await M(A)).mine && (await M(A)).mine.id === big.id && (await toastHas(A, '이어서')));
    // 마당을 나가면 뭉치는 그 자리에 남는다
    await walk(A, 2.0, 3.0);
    s = await M(A);
    const left = s.balls.find((b) => b.id === big.id);
    check('마당을 나가면 굴리기가 꺼지고 뭉치는 마당에 남음, 단추도 숨음', !s.on && left && left.s === 'l' && left.z > 5.5 && !(await A.isVisible('#rollBtn')) && !(await A.isVisible('#rollGo')), s);

    /* 완성 */
    await stand(A, -3, 7.6); await T(A, () => window.__snow.man.set(true));
    await walk(A, 0.4, 7.6); // 3.4m: 머리
    const head = (await M(A)).mine;
    await nearBase(A, body); await sleep(100);
    await A.tap('#rollGo');
    check('셋째 뭉치(머리)를 올리면 눈사람 완성 알림', head.r < mid2.r && (await toastHas(A, '눈사람을 만들었어요! ⛄')), head);
    check('완성 연출이 시작됨', (await T(A, () => window.__snow.man.making)) === 1);
    await sleep(2300);
    const deco = await T(A, () => window.__snow.man.makingDeco());
    await A.screenshot({ path: path.join(__dirname, 'out', 'snowman-made.png') });
    check('눈·당근 코·단추·나뭇가지 팔·목도리·모자가 하나씩 생김', deco.length === 1 && deco[0] >= 10, deco);
    check('연출이 끝나면 그 자리 가까운 마당 칸에 가구 눈사람이 놓임', await until(async () => (await snowmen(A)).length === 1, 3000));
    let sm = (await snowmen(A))[0];
    const smXZ = await T(A, (sm) => [-4 + (sm.i + 0.5) * 0.5, -4 + (sm.j + 0.5) * 0.5], sm);
    check('가구 눈사람은 몸통이 있던 자리 가까이(1m 안), 마당 칸', sm.j >= 19 && Math.hypot(smXZ[0] - body.x, smXZ[1] - body.z) < 1.0 && (await T(A, () => window.__tree.itemShown([...window.__tree.S.items.values()].find((o) => o.k === 'snowman').id))), { sm, smXZ, body });
    s = await M(A);
    check('쌓았던 뭉치는 사라지고, 다른 뭉치는 그대로', !s.balls.some((b) => b.id === body.id) && s.balls.length === 1 && s.balls[0].id === big.id && (await T(A, () => window.__snow.man.making)) === 0, s.balls);
    check('저장되는 방에도 눈사람이 들어 있음 (저장 형식 v 2 그대로)', await until(() => T(A, () => { const d = JSON.parse(localStorage.getItem('nolja-tree-room.ma') || 'null'); return d && d.v === 2 && d.items.some((r) => r[1] === 'snowman'); }), 2000));
    // 보통 가구처럼 옮기고 치운다
    check('완성된 눈사람은 보통 가구처럼 옮기고 치울 수 있음', await T(A, (sm) => { const t = window.__tree; const a = t.dispatch({ t: 'move', id: sm.id, i: 2, j: 24, r: 1 }); const it = t.S.items.get(sm.id); const ok = a && it.i === 2 && it.j === 24; const b = t.dispatch({ t: 'move', id: sm.id, i: sm.i, j: sm.j, r: 0 }); return ok && b; }, sm));
    // 방의 규칙
    check('"snowman" 변화는 마당 칸에만 (집 안·위층·벽 줄은 안 됨)', await T(A, () => { const t = window.__tree; return !t.dispatch({ t: 'snowman', id: 'zq1', i: 2, j: 3 }) && !t.dispatch({ t: 'snowman', id: 'zq2', i: 40, j: 3 }) && !t.dispatch({ t: 'snowman', id: 'zq3', i: 10, j: 18 }) && !t.dispatch({ t: 'snowman', id: 'zq4', i: 'x', j: 20 }); }));
    check('눈사람은 방에 8개까지 (가구로 놓은 것까지 셈)', await T(A, () => { const t = window.__tree; let n = 0; for (let k = 0; k < 10; k++) if (t.dispatch({ t: 'snowman', id: 'zm' + k, i: 1 + k * 2, j: 25 })) n++; const all = [...t.S.items.values()].filter((o) => o.k === 'snowman').length; for (let k = 0; k < 10; k++) t.dispatch({ t: 'del', id: 'zm' + k }); return n === 7 && all === 8; }));
    check('다른 가구가 있는 칸에는 놓이지 않음', await T(A, (sm) => !window.__tree.dispatch({ t: 'snowman', id: 'zq5', i: sm.i, j: sm.j }), sm));

    /* 다른 판이 열리면 꺼짐 */
    await stand(A, -2, 8.0); await T(A, () => window.__snow.man.set(true)); await sleep(100);
    await A.tap('#tabs button[data-m="furn"]'); await sleep(300);
    check('가구 탭을 열면 굴리기가 꺼지고 단추가 숨음', !(await T(A, () => window.__snow.man.on)) && !(await A.isVisible('#rollBtn')) && !(await A.isVisible('#rollGo')));
    await A.tap('#tabs button[data-m="furn"]'); await sleep(300);
    await T(A, () => window.__snow.man.set(true));
    await T(A, () => window.__tree.setMode('tree')); await sleep(300);
    check('트리 꾸미기를 열면 꺼짐', !(await T(A, () => window.__snow.man.on)));
    await T(A, () => window.__tree.setMode(null)); await sleep(200);
    await stand(A, -2, 8.0); await sleep(200);
    await T(A, () => { window.__tree.setPov(true); window.__snow.man.set(true); }); await sleep(1500);
    check('1인칭에서도 굴리기가 되고, 여기 두기 단추는 조이스틱과 겹치지 않음', (await T(A, () => window.__snow.man.on)) && (await overlaps(A, ['rollGo', 'stick', 'rollBtn', 'snowBtn', 'act'])).length === 0 && (await audit(A)).length === 0, [await overlaps(A, ['rollGo', 'stick', 'rollBtn', 'snowBtn', 'act']), await audit(A)]);
    await A.screenshot({ path: path.join(__dirname, 'out', 'snowman-fp.png') });
    await T(A, () => { window.__snow.man.set(false); window.__tree.setPov(false); }); await sleep(200);

    /* 여럿이: 친구에게 보이고, 구경하는 사람이 완성하기 */
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=mb&st=4000#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=mc&st=4000#v=${rid}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    const bid = await T(B, () => window.__duo.me), cid = await T(C, () => window.__duo.me);
    await stand(C, -3, 6.2);
    check('구경하는 사람(C)도 굴리기 단추가 보임', await until(() => C.isVisible('#rollBtn'), 3000));
    // B 가 굴리면 A·C 에게도 보인다
    await stand(B, -3, 8.6); await sleep(300);
    await T(B, () => window.__snow.man.set(true));
    await T(B, () => window.__tree.goTo(2.5, 8.6));
    await sleep(800);
    const bb2 = (await M(B)).mine;
    check('친구가 굴리는 뭉치가 모두의 화면에 보이고 따라감, 굴리는 몸짓도 보임', await until(async () => {
      const a = (await M(A)).balls.find((x) => x.id === bb2.id), c = (await M(C)).balls.find((x) => x.id === bb2.id);
      return a && c && a.s === 'r' && a.by === bid && c.by === bid && a.x > -2 && (await T(A, (b) => window.__snow.man.push(b), bid)) && (await T(C, (b) => window.__snow.man.push(b), bid));
    }, 4000), await M(A));
    await until(() => T(B, () => !window.__tree.me.moving), 20000); await sleep(300);
    const bNow = (await M(B)).mine;
    check('굴린 만큼 커진 것도 친구 화면에 그대로', await until(async () => { const a = (await M(A)).balls.find((x) => x.id === bNow.id); return a && Math.abs(a.r - bNow.r) < 0.01 && Math.abs(a.x - bNow.x) < 0.05; }, 12000), [bNow, (await M(A)).balls]);
    check('친구 화면에도 굴린 자국이 남음', (await T(C, () => window.__snow.man.marks)) > 5);
    await B.tap('#rollGo'); await sleep(200);
    const base2 = (await M(B)).balls.find((x) => x.id === bNow.id);
    check('친구가 놓은 몸통이 모두에게 몸통으로 보임', base2 && base2.s === 'b' && await until(async () => (await M(A)).balls.some((x) => x.id === bNow.id && x.s === 'b') && (await M(C)).balls.some((x) => x.id === bNow.id && x.s === 'b'), 2000));
    // C(구경)가 머리를 굴려 와 올린다: 2단 눈사람
    await stand(C, 5.0, 6.2); await T(C, () => window.__snow.man.set(true)); // (현관 앞에는 방장이 두고 간 큰 뭉치가 있어서 비켜 선다)
    await walk(C, 7.4, 6.2); // 2.4m: 머리만큼 작다
    const cHead = (await M(C)).mine;
    await nearBase(C, base2);
    check('구경하는 사람도 몸통 옆에서 "⬆️ 올리기"', await until(async () => (await M(C)).go.includes('올리기'), 2000));
    const items0 = (await snowmen(A)).length;
    await C.tap('#rollGo');
    check('머리만큼 작은 뭉치(반지름 0.3 이하)를 올리면 2단 눈사람 완성', cHead.r <= 0.3 && (await toastHas(C, '나와 친구')), { cHead, t: await C.textContent('#toast') });
    check('다른 사람 화면에 "○○님과 △△님이 눈사람을 만들었어요! ⛄"', await toastHas(A, '님과 친구') && (await A.textContent('#toast')).includes('님이 눈사람을 만들었어요! ⛄'), await A.textContent('#toast'));
    check('친구 화면에서도 완성 연출', (await T(B, () => window.__snow.man.making)) === 1 && (await T(A, () => window.__snow.man.making)) === 1);
    check('구경하는 사람이 완성한 눈사람도 방에 남음 (모두의 화면, 같은 칸)', await until(async () => {
      const a = await snowmen(A), b = await snowmen(B), c = await snowmen(C);
      return a.length === items0 + 1 && b.length === a.length && c.length === a.length && JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) === JSON.stringify(c);
    }, 6000), [await snowmen(A), await snowmen(C)]);
    await B.screenshot({ path: path.join(__dirname, 'out', 'snowman-friend.png') });
    check('구경하는 사람은 여전히 다른 가구는 못 놓음', await T(C, () => { window.__duo.rawOp({ t: 'put', id: 'cz1', k: 'sofa', i: 2, j: 22, r: 0 }); return true; }) && (await sleep(600), !(await T(A, () => window.__tree.S.items.has('cz1')))));
    // 새로 온 사람에게도 놓여 있는 뭉치가 보인다 / 굴리던 사람이 나가면 뭉치는 그 자리에 남는다
    await stand(B, 4, 6.2); await T(B, () => window.__snow.man.set(true));
    const bLast = (await M(B)).mine;
    await until(async () => (await M(A)).balls.some((x) => x.id === bLast.id && x.s === 'r'), 2000);
    await B.close();
    check('굴리던 사람이 나가면 뭉치는 그 자리에 놓임', await until(async () => (await M(A)).balls.some((x) => x.id === bLast.id && x.s === 'l'), 8000), (await M(A)).balls);
    const D = await open(ctx, `${BASE}?net=bc&door=0&ns=md&st=4000#v=${rid}`);
    await until(async () => (await T(D, () => window.__duo.others)).length === 2, 20000);
    check('새로 들어온 사람에게도 마당에 놓인 뭉치들이 보임', await until(async () => { const d = (await M(D)).balls.map((x) => x.id).sort(), a = (await M(A)).balls.map((x) => x.id).sort(); return a.length >= 2 && JSON.stringify(d) === JSON.stringify(a); }, 6000), [(await M(A)).balls, (await M(D)).balls]);

    /* 이상한 소식 */
    const n0 = (await M(D)).balls.length;
    await T(D, () => { for (const m of [
      { t: 'fx', id: 'h', k: 'ball', v: 'abc' }, { t: 'fx', id: 'h', k: 'ball', v: 'zz9,r,1,99,0.2' }, { t: 'fx', id: 'h', k: 'ball', v: 'zz9,r,1,7,5' },
      { t: 'fx', id: 'h', k: 'ball', v: 'zz9,q,1,7,0.2' }, { t: 'fx', id: 'h', k: 'ball', v: 'zz9,r,1,7,0.2,0.3' }, { t: 'fx', id: 'h', k: 'ball', v: 'zz9,b,1,7,0.3,0.4' },
      { t: 'fx', id: 'h', k: 'ball', v: 5 }, { t: 'fx', id: 'h', k: 'ball', v: 'x'.repeat(200) }, { t: 'fx', id: 'h', k: 'made', v: 'nope,h' }, { t: 'fx', id: 'h', k: 'made', v: 7 },
      { t: 'fx', id: 'h', k: 'ball', v: '<b>,r,1,7,0.2' },
    ]) window.__duo.feed(m); });
    await sleep(300);
    check('이상한 눈사람 소식이 와도 버팀 (아무 일 없음)', (await M(D)).balls.length === n0 && (await T(D, () => window.__snow.man.making)) === 0);
    check('굴리기 단추가 있어도 화면의 단추가 모두 44px 이상·화면 안', (await audit(A)).length === 0 && (await audit(C)).length === 0, [await audit(A), await audit(C)]);
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
