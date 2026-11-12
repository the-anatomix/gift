// 어드벤트 달력 검사. 실행: cd tree/tests && node advent.test.js
// 날짜는 window.__now 로 바꾼다 (setNow). 처음에는 2026년 11월 12일 낮.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8191, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__advent && window.__tree.frames > 3)), 20000);
const NOV12 = new Date(2026, 10, 12, 13, 0).getTime();
// 페이지를 열기 전에: 시계를 base 에서 시작한다 (sessionStorage 에 적어 두면 다시 열어도 그 날짜)
const clockInit = (ctx) => ctx.addInitScript(() => { const b = +sessionStorage.getItem('advNow') || 0, t0 = Date.now(); if (b) window.__now = () => b + (Date.now() - t0); });
async function open(ctx, url, page, base = NOV12) {
  const p = page || await ctx.newPage();
  if (!page) p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  if (!page) { await p.goto(BASE + 'tests/none.html').catch(() => {}); }
  await p.evaluate((b) => { try { sessionStorage.setItem('advNow', String(b)); } catch (_) {} }, base).catch(() => {});
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const setNow = (p, ms) => p.evaluate((b) => { sessionStorage.setItem('advNow', String(b)); const t0 = Date.now(); window.__now = () => b + (Date.now() - t0); }, ms);
const audit = (p) => p.evaluate(() => {
  const bad = [];
  for (const b of document.querySelectorAll('button, a, input:not([type=file])')) {
    const r = b.getBoundingClientRect();
    if (!r.width || b.closest('[hidden]') || getComputedStyle(b).display === 'none') continue;
    const name = (b.textContent || b.getAttribute('aria-label') || b.id || '').trim();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (!b.closest('.scroll') && (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5)) bad.push(`${name}: 화면 밖`);
  }
  return bad;
});
const idOf = (p, k) => T(p, (k) => { for (const it of window.__tree.S.items.values()) if (it.k === k) return it.id; return null; }, k);
const toastHas = (p, t) => until(async () => (await p.textContent('#toast')).includes(t), 4000);
const advDays = (p) => T(p, () => [...window.__tree.S.adv.keys()].sort((a, b) => a - b));

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(p.endsWith('none.html') ? 200 : 404, { 'content-type': 'text/html' }); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    await clockInit(ctx);

    /* 상태 규칙 (state.js, catalog.js) */
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=aa`);
    const rules = await T(A, async () => {
      const m = await import('./state.js'), c = await import('./catalog.js'), S = m.makeState(), ap = (op) => m.apply(S, op, () => false), at = Date.now(), r = {};
      r.n = c.ADVENT.length; r.all = c.ADVENT.every(Boolean);
      r.uniq = new Set(c.ADVENT.map((x) => x.kind + ':' + x.id)).size === 25 && new Set(c.ADVENT.map((x) => x.icon)).size === 25;
      r.kinds = [...new Set(c.ADVENT.map((x) => x.kind))].sort().join(',');
      r.orns = c.ADVENT.filter((x) => x.kind === 'orn').length; r.furn = c.ADVENT.filter((x) => x.kind === 'furn').length;
      r.d25 = c.ADVENT[24].id;
      r.deer0 = ap({ t: 'put', id: 'd1', k: 'deer', i: 2, j: 2, r: 0 });
      r.flake0 = ap({ t: 'orn', id: 'o1', k: 'flake', x: 0.5, y: 1, z: 0.5 });
      r.pink0 = ap({ t: 'lights', set: 'pink', blink: 'on' });
      r.night0 = ap({ t: 'wall', v: 'night' }); r.candy0 = ap({ t: 'floor', v: 'candy' });
      r.plain = ap({ t: 'put', id: 'p1', k: 'sofa', i: 6, j: 6, r: 0 }) && ap({ t: 'orn', id: 'o0', k: 'red', x: 0.5, y: 1, z: 0.5 });
      r.lockDay = m.lockDay(S, c.FURNITURE, 'deer') === 3 && m.lockDay(S, c.FURNITURE, 'sofa') === 0;
      r.open = ap({ t: 'adv', d: 3, name: '산타', at });
      r.dup = ap({ t: 'adv', d: 3, name: '루돌프', at });
      r.bad = ap({ t: 'adv', d: 0, name: '산타', at }) || ap({ t: 'adv', d: 26, name: '산타', at }) || ap({ t: 'adv', d: 2.5, name: '산타', at }) || ap({ t: 'adv', d: '4', name: '산타', at })
        || ap({ t: 'adv', d: 4, name: '', at }) || ap({ t: 'adv', d: 4, name: '가'.repeat(11), at }) || ap({ t: 'adv', d: 4, name: '산타', at: -1 }) || ap({ t: 'adv', d: 4, name: '산타', at: 'x' });
      r.deer1 = ap({ t: 'put', id: 'd1', k: 'deer', i: 2, j: 2, r: 0 });
      for (const d of [1, 5, 9, 14]) ap({ t: 'adv', d, name: '산타', at });
      r.rest = ap({ t: 'orn', id: 'o1', k: 'flake', x: 0.5, y: 1, z: 0.5 }) && ap({ t: 'lights', set: 'pink', blink: 'on' }) && ap({ t: 'wall', v: 'night' }) && ap({ t: 'floor', v: 'candy' });
      r.stillLocked = !ap({ t: 'orn', id: 'o2', k: 'king', x: 0.5, y: 1.5, z: 0.5 });
      // 저장했다가 다시 열기: 연 칸이 먼저 들어가서 풀린 것들이 그대로 놓인다
      const d = JSON.parse(JSON.stringify(m.serialize(S))), S2 = m.makeState();
      for (const op of m.ops(d)) m.apply(S2, op, () => false);
      r.v = d.v; r.advRow = JSON.stringify(d.adv[0]);
      r.round = JSON.stringify([...S2.adv]) === JSON.stringify([...S.adv].sort((a, b) => a[0] - b[0])) && S2.items.has('d1') && S2.orns.has('o1') && S2.lights.set === 'pink' && S2.wall === 'night' && S2.floor === 'candy';
      // 달력이 없던 때의 방
      const old = { v: 2, at: 1, sync: 0, items: [], orns: [], lights: ['off', 'on'], wall: 'cream', floor: 'oak', notes: [] }, S3 = m.makeState();
      for (const op of m.ops(old)) m.apply(S3, op, () => false);
      r.old = S3.adv.size === 0 && Array.isArray(m.serialize(S3).adv) && m.serialize(S3).adv.length === 0;
      return r;
    });
    check('보상 25가지가 모두 다름 (트리 장식 14, 특별 가구 7, 전구·벽지·바닥), 25일은 황금 왕별', rules.n === 25 && rules.all && rules.uniq && rules.orns === 14 && rules.furn === 7 && rules.kinds === 'floor,furn,light,orn,wall' && rules.d25 === 'king', rules);
    check('풀리지 않은 특별 가구·장식·전구·벽지·바닥은 apply 에서 거절, 보통 것은 그대로', !rules.deer0 && !rules.flake0 && !rules.pink0 && !rules.night0 && !rules.candy0 && rules.plain && rules.lockDay, rules);
    check('칸 열기: 1~25 정수, 한 칸은 한 번만, 이름 1~10자, 때는 ms', rules.open && !rules.dup && !rules.bad, rules);
    check('칸을 열면 그 칸의 것이 풀리고, 다른 칸의 것은 그대로 잠김', rules.deer1 && rules.rest && rules.stillLocked, rules);
    check('저장했다 다시 열어도 연 칸과 풀린 것들이 그대로 (저장 형식 v 2)', rules.round && rules.v === 2 && rules.advRow.startsWith('[1,"산타",'), rules);
    check('달력이 없던 때의 방은 연 칸 없이 열림', rules.old, rules);

    /* 기본으로 놓이는 달력 */
    const aid = await idOf(A, 'advent');
    const ai = await T(A, (id) => { const it = window.__tree.S.items.get(id); return it && { i: it.i, j: it.j, r: it.r, shown: window.__tree.itemShown(id) }; }, aid);
    check('새 방에는 거실 북쪽 벽(14, 0)에 어드벤트 달력이 놓여 있음', ai && ai.i === 14 && ai.j === 0 && ai.r === 0 && ai.shown, ai);
    const cat = await T(A, async () => { const c = await import('./catalog.js'); const f = c.FURNITURE.find((x) => x.id === 'advent'); return f && { w: f.w, d: f.d, solid: f.solid, play: f.play, icon: f.icon, name: f.name }; });
    check('가구 목록에 어드벤트 달력(🗓️, 2×1 얇은 판, 놀이 advent)', cat && cat.w === 2 && cat.d === 1 && cat.solid && cat.play === 'advent' && cat.icon === '🗓️', cat);

    /* 12월 전: 판은 열리지만 칸은 열 수 없다 */
    await T(A, (id) => { const t = window.__tree, it = t.S.items.get(id); t.me.place(t.box.x0 + (it.i + 1) * t.CELL - 1.2, t.box.z0 + 2.6); }, aid);
    await T(A, (id) => window.__play.start(id), aid);
    check('달력을 누르면 그 앞으로 걸어가서 판이 열림', await until(() => T(A, () => window.__advent.shown && window.__play.on), 15000));
    let sub = await A.textContent('#playSub');
    check('11월 12일: "12월 1일부터 열 수 있어요 (D-19)"', sub.includes('12월 1일부터 열 수 있어요 (D-19)'), sub);
    let cells = await T(A, () => window.__advent.cells);
    check('12월 전에는 25칸 모두 닫혀 있고 여는 단추가 없음', cells.length === 25 && cells.every((c) => c.st === 'shut') && !(await A.isVisible('#playGo')), cells.slice(0, 3));
    await A.tap('#advGrid button[data-d="1"]');
    check('칸을 누르면 열리지 않고 남은 날을 알려 줌', (await toastHas(A, '12월 1일부터 열 수 있어요 (D-19)')) && (await advDays(A)).length === 0);
    let bad = await audit(A);
    check('폰(375×812)에서 칸과 단추가 44px 이상이고 화면 안', bad.length === 0, bad);
    await A.tap('#playQuit');
    await until(() => T(A, () => !window.__play.on));
    const near = await until(() => T(A, () => window.__tree.nearAction()), 3000);
    check('달력 앞에서 스페이스바 안내 "🗓️ 어드벤트 달력"', near === '🗓️ 어드벤트 달력', near);
    check('오늘 열 칸이 없으면 달력 위 별이 꺼져 있음', (await T(A, () => window.__advent.mark)) === false);

    /* 고르는 목록의 🔒 */
    const locks = await T(A, () => window.__advent.locks());
    const by = (l) => locks.filter((x) => x.list === l).length;
    check('풀리지 않은 25가지가 목록에 🔒 로 보임 (가구 7, 장식 14, 전구 2, 벽지 1, 바닥 1)', locks.length === 25 && by('furnList') === 7 && by('ornList') === 14 && by('lightList') === 2 && by('wallList') === 1 && by('floorList') === 1, locks);
    await A.tap('#tabs button[data-m="furn"]'); await sleep(250);
    const deerBtn = A.locator('#furnList .pick[data-v="deer"]');
    check('잠긴 가구에는 몇 일 칸인지 적혀 있음 (🔒 12/3)', (await deerBtn.textContent()).includes('12/3'));
    await deerBtn.scrollIntoViewIfNeeded(); await deerBtn.tap({ force: true }); // 잠긴 단추는 aria-disabled 라 검사 도구가 기다리지 않게
    check('잠긴 가구를 누르면 들리지 않고 언제 풀리는지 알려 줌', (await toastHas(A, '12월 3일 칸을 열면')) && !(await T(A, () => window.__tree.ghost)));
    await A.tap('#tabs button[data-m="furn"]'); await sleep(200);

    /* 12월 3일 */
    await setNow(A, new Date(2026, 11, 3, 9, 0).getTime());
    await T(A, (id) => window.__play.open(id), aid);
    check('12월 3일: 1~3일 칸이 눈에 띄게 열 수 있음, 4일부터는 닫힘', await until(async () => { const c = await T(A, () => window.__advent.cells); return c.slice(0, 3).every((x) => x.st === 'ready') && c.slice(3).every((x) => x.st === 'shut'); }, 3000));
    check('달력 위에 오늘 열 칸이 있다는 별이 반짝임', await until(() => T(A, () => window.__advent.mark), 3000));
    sub = await A.textContent('#playSub');
    check('판에 "오늘은 12월 3일!"과 연 칸 수', sub.includes('오늘은 12월 3일') && sub.includes('0/25'), sub);
    await A.screenshot({ path: path.join(__dirname, 'out', 'advent-phone.png') });
    await A.tap('#playGo');
    check('큰 단추로 1일 칸을 열면 눈 결정이 풀리고 알림이 뜸', (await until(async () => JSON.stringify(await advDays(A)) === '[1]')) && (await toastHas(A, '12월 1일 칸을 열었어요: ❄️ 눈 결정')));
    check('열 때 연출: 화면 가운데 그림과 달력 앞 상자', (await T(A, () => window.__advent.show)).includes('눈 결정') && (await T(A, () => window.__advent.fx)) > 0);
    check('연 칸은 열린 모습(그림)으로 바뀜', (await T(A, () => window.__advent.cells[0])).st === 'done' && (await T(A, () => window.__advent.cells[0].text)).includes('❄️'));
    check('연 사람 이름이 남음 (방장)', (await T(A, () => window.__tree.S.adv.get(1).name)) === '방장');
    await A.tap('#advGrid button[data-d="3"]');
    check('지나간 날(3일) 칸도 눌러서 열 수 있음 → 루돌프 인형', (await until(async () => (await advDays(A)).includes(3))) && (await toastHas(A, '🦌 루돌프 인형')));
    await A.tap('#advGrid button[data-d="4"]');
    check('내일 칸(4일)은 "12월 4일에 열 수 있어요 (D-1)"', (await toastHas(A, '12월 4일에 열 수 있어요 (D-1)')) && !(await advDays(A)).includes(4));
    await A.tap('#advGrid button[data-d="1"]');
    check('연 칸을 누르면 무엇이 풀렸고 누가 열었는지 알려 줌', await toastHas(A, '방장님이 열었어요'));
    bad = await audit(A);
    check('칸을 연 뒤에도 폰 화면 안, 44px 이상', bad.length === 0, bad);
    await T(A, () => window.__play.close());
    const lk2 = await T(A, () => window.__advent.locks());
    check('풀린 것은 🔒 가 사라짐 (눈 결정, 루돌프 인형)', lk2.length === 23 && !lk2.some((x) => x.v === 'flake' || x.v === 'deer'), lk2.map((x) => x.v));
    await A.tap('#tabs button[data-m="furn"]'); await sleep(250);
    await A.locator('#furnList .pick[data-v="deer"]').scrollIntoViewIfNeeded(); await A.locator('#furnList .pick[data-v="deer"]').tap();
    check('풀린 루돌프 인형을 고르면 들림', await until(async () => { const g = await T(A, () => window.__tree.ghost); return g && g.k === 'deer'; }, 3000));
    await T(A, () => window.__tree.ghostDone());
    check('루돌프 인형을 놓을 수 있음', await until(() => idOf(A, 'deer'), 3000));
    await A.tap('#tabs button[data-m="furn"]'); await sleep(200);
    check('풀린 눈 결정 장식을 트리에 닮', await T(A, () => window.__tree.dispatch({ t: 'orn', id: 'advo1', k: 'flake', x: 0.6, y: 1.2, z: 0.4 })) && (await T(A, () => window.__tree.ornObjs)) >= 1);

    /* 12월이 지나면 25칸 모두, 다시 열어도 그대로 */
    await setNow(A, new Date(2026, 11, 27, 9, 0).getTime());
    await T(A, (id) => window.__play.open(id), aid);
    check('12월 27일: 아직 안 연 칸 23개가 모두 열 수 있음', await until(async () => (await T(A, () => window.__advent.cells)).filter((x) => x.st === 'ready').length === 23, 3000));
    await T(A, () => window.__play.close());
    await sleep(600);
    await open(ctx, `${BASE}?net=bc&door=0&ns=aa`, A, new Date(2026, 11, 27, 9, 0).getTime());
    check('다시 열어도 연 칸·루돌프 인형·장식이 그대로', JSON.stringify(await advDays(A)) === '[1,3]' && !!(await idOf(A, 'deer')) && (await T(A, () => window.__tree.S.orns.has('advo1'))));
    check('다시 열어도 달력이 하나만 있음', (await T(A, () => [...window.__tree.S.items.values()].filter((it) => it.k === 'advent').length)) === 1);

    /* 달력이 없던 때에 꾸민 방 */
    const ctxO = await browser.newContext(vp);
    await clockInit(ctxO);
    const O = await ctxO.newPage();
    O.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
    await O.goto(BASE + 'tests/none.html');
    await O.evaluate(() => localStorage.setItem('nolja-tree-room', JSON.stringify({ v: 2, up: 1, at: 1700000000000, sync: 0, items: [['old1', 'sofa', 1, 6, 1], ['old2', 'lamp', 14, 0, 0]], orns: [], lights: ['warm', 'on'], wall: 'sage', floor: 'walnut', notes: [] })));
    await O.goto(BASE); await ready(O);
    const og = await T(O, () => { const a = [...window.__tree.S.items.values()].filter((it) => it.k === 'advent'); return { n: a.length, i: a[0] && a[0].i, j: a[0] && a[0].j, at: window.__tree.S.at, size: window.__tree.S.items.size }; });
    check('달력이 없던 때의 방을 열면 달력이 하나 더해짐 (자리가 막혀 있으면 가까운 빈자리, 꾸민 것은 그대로)', og.n === 1 && og.size === 3 && og.j <= 1 && og.at === 1700000000000, og);
    await T(O, () => { const W = window.__tree; const id = [...W.S.items.values()].find((it) => it.k === 'advent').id; W.dispatch({ t: 'del', id }); });
    await sleep(600);
    await O.reload(); await ready(O);
    check('달력을 치운 뒤 다시 열면 다시 생기지 않음', (await T(O, () => [...window.__tree.S.items.values()].filter((it) => it.k === 'advent').length)) === 0);
    await ctxO.close();

    /* 여럿이: 방장 A, 꾸미는 B, 구경하는 C (12월 5일) */
    const DEC5 = new Date(2026, 11, 5, 20, 0).getTime();
    await open(ctx, `${BASE}?net=bc&door=0&ns=aa`, A, DEC5);
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=ab#r=${room}`, null, DEC5);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=ac#v=${rid}`, null, DEC5);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(C, () => window.__duo.others)).length === 2 && (await T(B, () => window.__duo.others)).length === 2, 20000);
    check('친구들도 방장의 달력(연 칸)을 받음', JSON.stringify(await advDays(B)) === '[1,3]' && JSON.stringify(await advDays(C)) === '[1,3]');
    const bid = await idOf(B, 'advent');
    await T(B, (id) => window.__play.open(id), bid);
    await T(B, () => window.__advent.pick(2));
    check('꾸미는 사람이 2일 칸을 열면 모두에게 풀림', await until(async () => (await advDays(A)).includes(2) && (await advDays(C)).includes(2)));
    check('다른 사람들에게 "○○님이 12월 2일 칸을 열었어요: 🍪 진저쿠키" 알림', (await toastHas(A, '님이 12월 2일 칸을 열었어요: 🍪 진저쿠키')) && (await toastHas(C, '님이 12월 2일 칸을 열었어요: 🍪 진저쿠키')));
    check('판을 열어 둔 사람의 칸도 바로 바뀜', (await T(B, () => window.__advent.cells[1].st)) === 'done');
    await T(B, () => window.__play.close());
    await T(C, (id) => window.__play.open(id), bid);
    await sleep(300);
    check('구경하는 사람도 판은 열 수 있지만 여는 큰 단추가 없음', (await T(C, () => window.__advent.shown)) && !(await C.isVisible('#playGo')));
    await T(C, () => window.__advent.pick(4));
    check('구경하는 사람이 칸을 누르면 "꾸미는 사람만" 알림, 열리지 않음', (await toastHas(C, '꾸미는 사람만')) && !(await advDays(C)).includes(4));
    bad = await audit(C);
    check('구경하는 사람 폰 화면에서도 44px 이상, 화면 안', bad.length === 0, bad);
    await T(C, () => window.__duo.rawOp({ t: 'adv', d: 5, name: '루돌프', at: Date.now() }));
    await sleep(900);
    check('구경하는 사람이 보낸 칸 열기는 방장이 받지 않음', !(await advDays(A)).includes(5) && !(await advDays(B)).includes(5));
    await T(C, () => window.__play.close());
    check('세 사람의 방 지문이 같음', await until(async () => { const h = await T(A, () => window.__duo.hash()); return h === await T(B, () => window.__duo.hash()) && h === await T(C, () => window.__duo.hash()); }, 6000));
    // 접속해 있는 동안 날짜가 바뀌면: 새 칸이 열 수 있게 되고 알림
    await setNow(A, new Date(2026, 11, 5, 23, 59, 58).getTime());
    check('자정이 지나면 "12월 6일! 오늘 칸을 열 수 있어요" 알림', await until(async () => (await A.textContent('#toast')).includes('12월 6일!'), 6000));
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) {
    console.log('검사 중 오류:', e);
    results.push(false);
  } finally {
    await browser.close();
    server.close();
  }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
