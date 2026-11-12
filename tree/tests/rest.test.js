// 침대에 눕기 · 그 앞에서 스페이스바(할 수 있는 일 단추) · 냉장고 열기 · 옷장 검사. 실행: cd tree/tests && node rest.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8183, BASE = `http://localhost:${PORT}/tree/`;
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
const cxz = (i, j) => [-4 + (i + 0.5) * 0.5, -4 + (j + 0.5) * 0.5];
const settle = (p) => until(() => T(p, () => { const m = window.__tree.me; return !m.moving && !m.path.length && !m.climbing; }), 20000);
const lying = (p) => T(p, () => window.__tree.lying);
const near = (p) => T(p, () => window.__tree.nearAction());
const toastHas = (p, t, ms = 3000) => until(async () => (await p.textContent('#toast')).includes(t), ms);
const stand = async (p, x, z) => { await T(p, (a) => { const W = window.__tree; W.me.stop(); W.me.place(a[0], a[1]); }, [x, z]); await sleep(350); }; // 그 자리에 바로 선다 (할 수 있는 일 단추는 0.15초마다 다시 그린다)

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ra`);
    check('침대 둘, 다트판, TV, 냉장고, 옷장, 케이크 작업대를 놓음', await T(A, () => { const W = window.__tree; return [['bd', 'bed', 2, 11, 0], ['bd2', 'bed', 12, 12, 0], ['dt', 'dart', 11, 0, 0], ['tv', 'tv', 0, 6, 1], ['fr', 'fridge', 14, 0, 0], ['cl', 'closet', 16, 17, 2], ['ck', 'cake', 24, 4, 0]].every(([id, k, i, j, r]) => W.dispatch({ t: 'put', id, k, i, j, r })); }));

    /* 눕기 */
    check('침대 앞에서는 "눕기"가 뜸', (await stand(A, ...cxz(3, 16)), await near(A)) === '🛏️ 눕기', await near(A));
    await stand(A, 1, -2);
    check('lieDown: 침대로 걸어가서 빈 베개 쪽(왼쪽)에 누움', await T(A, () => window.__tree.lieDown('bd')) && await until(async () => { const l = await lying(A); return l && l.id === 'bd' && l.side === 0; }, 15000), await lying(A));
    await sleep(300);
    const ly = await T(A, () => ({ y: window.__tree.me.root.position.y, rest: !!window.__tree.me.rest, moving: window.__tree.me.moving }));
    check('누우면 침대 높이에 몸이 놓이고 움직이지 않음', ly.rest && ly.y > 0.3 && ly.y < 0.6 && !ly.moving, ly);
    check('누워 있는 동안 아래에 "누워 있어요" 판과 일어나기 단추, 할 일 단추는 "일어나기"', (await A.isVisible('#lieP')) && (await A.isVisible('#lieUp')) && (await near(A)) === '🛏️ 일어나기' && (await A.isVisible('#act')) && (await A.textContent('#act')).includes('일어나기'), { lieP: await A.isVisible('#lieP'), near: await near(A), act: await A.textContent('#act') });
    check('누워 있을 때 단추가 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    await A.screenshot({ path: path.join(__dirname, 'out', 'rest-lie.png') });
    await A.keyboard.press('Space'); await sleep(300);
    check('스페이스바를 누르면 일어남 (판도 사라짐)', (await lying(A)) === null && !(await A.isVisible('#lieP')) && (await T(A, () => window.__tree.me.root.position.y)) < 0.05);
    await T(A, () => window.__tree.lieDown('bd')); await until(() => lying(A), 15000);
    await A.tap('#lieUp'); await sleep(300);
    check('"일어나기"를 눌러도 일어남', (await lying(A)) === null && !(await A.isVisible('#lieP')));
    await T(A, () => window.__tree.lieDown('bd')); await until(() => lying(A), 15000);
    await T(A, () => window.__tree.goTo(1, -2)); await sleep(200);
    check('누워 있다가 다른 데로 걸어가면 일어나서 걸어감', (await lying(A)) === null && await until(() => T(A, () => window.__tree.me.moving), 3000));
    await settle(A);
    await T(A, () => window.__tree.lieDown('bd')); await until(() => lying(A), 15000);
    await A.tap('#act'); await sleep(300);
    check('폰에서 할 일 단추("일어나기")를 눌러도 일어남', (await lying(A)) === null);

    /* 여럿이: 둘은 눕고 셋째는 자리가 없다 */
    await T(A, () => window.__duo.invite());
    await until(() => T(A, () => window.__duo.mode === 'waiting'));
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=rb#r=${room}`);
    const hash = (p) => T(p, () => window.__duo.hash());
    await until(async () => (await T(A, () => window.__duo.count)) === 2 && (await hash(A)) === (await hash(B)), 20000);
    const peerLie = (p) => T(p, () => window.__duo.others.map((o) => o.lying));
    await T(A, () => window.__tree.lieDown('bd')); await until(() => lying(A), 15000);
    check('내가 누우면 친구 화면에서도 내가 그 침대 왼쪽에 누워 있음', await until(async () => JSON.stringify(await peerLie(B)) === '[{"id":"bd","side":0}]', 4000), await peerLie(B));
    await T(B, () => window.__tree.lieDown('bd'));
    check('친구가 같은 침대를 누르면 남은 오른쪽 베개에 누움', await until(async () => { const l = await lying(B); return l && l.id === 'bd' && l.side === 1; }, 15000) && await until(async () => JSON.stringify(await peerLie(A)) === '[{"id":"bd","side":1}]', 4000), { b: await lying(B), a: await peerLie(A) });
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=rc#v=${rid}`);
    check('나중에 들어온 사람에게도 두 사람이 누워 있는 것으로 보임', await until(async () => { const l = await peerLie(C); return l.length === 2 && l.filter((x) => x && x.id === 'bd').map((x) => x.side).sort().join() === '0,1'; }, 15000), await peerLie(C));
    await T(C, () => window.__tree.lieDown('bd'));
    check('셋째 사람은 침대까지 걸어가 보고, 누울 자리가 없다고 알려 줌', await toastHas(C, '누울 자리가 없어요', 15000) && (await lying(C)) === null, { l: await lying(C), toast: await C.textContent('#toast') });
    await settle(C);
    await T(B, () => window.__tree.getUp());
    check('친구가 일어나면 내 화면에서도 일어남', await until(async () => { const l = await peerLie(A); return l.length === 2 && l.every((x) => x === null); }, 4000), await peerLie(A));
    // 누운 침대를 옮기거나 치우면
    const x0 = await T(A, () => window.__tree.me.root.position.x);
    check('누운 침대를 옮기면 누운 채로 따라감', await T(A, () => window.__tree.dispatch({ t: 'move', id: 'bd', i: 3, j: 11, r: 0 })) && JSON.stringify(await lying(A)) === '{"id":"bd","side":0}' && Math.abs((await T(A, () => window.__tree.me.root.position.x)) - x0 - 0.5) < 0.05, { l: await lying(A), x0, x1: await T(A, () => window.__tree.me.root.position.x) });
    check('친구 화면에서도 옮긴 침대 위에 누워 있음', await until(async () => (await peerLie(B)).some((x) => x && x.id === 'bd'), 4000));
    await T(A, () => window.__tree.dispatch({ t: 'del', id: 'bd' }));
    check('누운 침대를 치우면 일어남 (나에게도, 친구에게도)', (await lying(A)) === null && !(await A.isVisible('#lieP')) && await until(async () => (await peerLie(B)).every((x) => x === null), 4000), { a: await lying(A), b: await peerLie(B) });
    await C.close(); await B.close();
    await until(() => T(A, () => window.__duo.count === 1), 10000);
    // 케이크를 들고는 못 눕는다
    await T(A, () => window.__tree.dispatch({ t: 'cakeTake', id: 'ck', by: window.__duo.me }));
    check('케이크를 들고 침대를 누르면 누울 수 없다고 알려 줌', (await T(A, () => window.__tree.carried())) === 'ck' && await T(A, () => window.__tree.lieDown('bd2')) && await toastHas(A, '케이크를 들고는') && (await lying(A)) === null);
    await sleep(800);
    check('그 뒤에도 눕지 않음', (await lying(A)) === null);
    await T(A, () => window.__tree.putDown(null)); await settle(A);

    /* 그 앞에서 스페이스바 */
    await stand(A, 1.75, -3.0);
    check('다트판 앞: "🎯 다트 하기" 단추가 뜸', (await near(A)) === '🎯 다트 하기' && (await A.isVisible('#act')) && (await A.textContent('#act')).startsWith('🎯 다트 하기'), { near: await near(A), act: await A.textContent('#act') });
    check('할 일 단추가 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    await A.screenshot({ path: path.join(__dirname, 'out', 'rest-act.png') });
    await A.keyboard.press('Space');
    check('스페이스바를 누르면 다트 놀이가 열리고 단추는 사라짐', await until(() => T(A, () => window.__play.on && window.__play.state.kind === 'dart'), 6000) && await until(async () => !(await A.isVisible('#act')), 2000));
    await sleep(300);
    await A.keyboard.press('Space');
    check('놀이 중 스페이스바는 큰 단추(던지기): 화살이 하나 줄어듦', await until(() => T(A, () => window.__play.state.left === 2), 6000), await T(A, () => window.__play.state));
    await T(A, () => window.__play.close());
    await stand(A, -2.9, -0.25);
    check('TV 앞: "📺 TV 보기"', (await near(A)) === '📺 TV 보기', await near(A));
    await T(A, () => window.__tree.pressSpace());
    check('스페이스바로 TV 가 열림 (TV 에서는 스페이스바가 다른 일을 하지 않음)', await until(() => T(A, () => window.__play.on && window.__play.state.kind === 'tv'), 6000) && (await T(A, () => (window.__tree.pressSpace(), window.__play.on))));
    await T(A, () => window.__play.close());
    await stand(A, ...cxz(13, 17));
    check('침대 앞: "🛏️ 눕기", 스페이스바로 누움', (await near(A)) === '🛏️ 눕기' && (await T(A, () => (window.__tree.pressSpace(), true))) && await until(async () => { const l = await lying(A); return l && l.id === 'bd2'; }, 12000), { near: await near(A), l: await lying(A) });
    await T(A, () => window.__tree.getUp());
    await stand(A, 3.5, -3.0);
    check('냉장고 앞: "🧊 냉장고 열기"', (await near(A)) === '🧊 냉장고 열기', await near(A));
    await A.tap('#act');
    check('누르면 냉장고 판이 열림(문이 열림)', await until(() => T(A, () => window.__tree.mode === 'fridge' && window.__food.open === 'fr'), 3000) && await A.isVisible('#fridgeP'));
    await A.tap('#fridgeList .fd[data-v="cookie"]'); await sleep(400);
    check('하나를 고르면 손에 들고, 할 일 단추로 먹는 몸짓("eat")을 함', (await near(A)).startsWith('🍪 쿠키 먹기') && (await T(A, () => (window.__tree.pressSpace(), true))) && await until(() => T(A, () => window.__tree.me.acting === 'eat'), 3000), { near: await near(A), acting: await T(A, () => window.__tree.me.acting) });
    await T(A, () => window.__food.holding && window.__tree.useItem('fr')); await until(() => T(A, () => window.__tree.mode === 'fridge'), 3000);
    await A.tap('#fridgeBack'); await A.tap('#fridgeClose');
    await sleep(2500);
    await stand(A, 4.75, 4.0);
    check('옷장 앞: "👕 옷 갈아입기"', (await near(A)) === '👕 옷 갈아입기', await near(A));
    await A.keyboard.press('Space');
    check('스페이스바로 옷장을 열면 캐릭터(옷) 고르기 판이 열림', await until(() => T(A, () => window.__tree.lookOpen), 5000) && (await A.isVisible('#look')));
    check('판이 열려 있을 때는 할 일 단추가 없음', (await near(A)) === null && !(await A.isVisible('#act')));
    await A.tap('#pickOutfit .chip[data-v="santa"]'); await A.tap('#lookDone'); await sleep(200);
    check('옷을 갈아입고 닫음', (await T(A, () => window.__tree.look.outfit)) === 'santa' && !(await T(A, () => window.__tree.lookOpen)));
    await stand(A, ...cxz(19, 8));
    check('사다리 앞: "🪜 2층으로 올라가기"', (await near(A)) === '🪜 2층으로 올라가기', await near(A));
    await A.keyboard.press('Space');
    check('스페이스바로 사다리를 타고 2층으로', await until(() => T(A, () => window.__tree.me.climbing), 3000) && await until(() => T(A, () => !window.__tree.me.climbing && window.__tree.level === 1), 8000));
    await settle(A);
    check('사다리를 타는 동안은 단추가 없고, 2층에 올라서면 "🪜 1층으로 내려가기"', (await near(A)) === '🪜 1층으로 내려가기', await near(A));
    await T(A, () => window.__tree.pressSpace());
    check('스페이스바로 1층으로 내려옴', await until(() => T(A, () => !window.__tree.me.climbing && window.__tree.level === 0 && !window.__tree.me.path.length), 8000));
    await stand(A, -2, 3);
    check('아무것도 없는 곳에서는 단추가 없고, 스페이스바를 눌러도 아무 일 없음', (await near(A)) === null && !(await A.isVisible('#act')) && (await T(A, () => (window.__tree.pressSpace(), window.__tree.mode === null && !window.__tree.me.path.length))));
    // 케이크 작업대
    await stand(A, ...cxz(25, 7));
    check('케이크 작업대 앞: "🎂 케이크 꾸미기·먹기", 스페이스바로 케이크 판이 열림', (await near(A)) === '🎂 케이크 꾸미기·먹기' && (await T(A, () => (window.__tree.pressSpace(), true))) && await until(() => T(A, () => window.__play.on && window.__play.id === 'ck'), 6000), await near(A));
    await A.keyboard.press('Space');
    check('케이크 판에서 스페이스바는 "한 조각 먹기"', await until(() => T(A, () => window.__tree.cakeAt('ck').left === 7), 3000), await T(A, () => window.__tree.cakeAt('ck')));
    await T(A, () => window.__play.close());

    /* PC: 단추에 "스페이스" 안내 */
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const P = await open(ctx2, `${BASE}?ns=rp`);
    await T(P, () => window.__tree.dispatch({ t: 'put', id: 'dt', k: 'dart', i: 11, j: 0, r: 0 }));
    await stand(P, 1.75, -3.0);
    check('PC 에서는 단추에 "· 스페이스" 가 붙음', (await P.textContent('#act')) === '🎯 다트 하기 · 스페이스', await P.textContent('#act'));
    await P.keyboard.press('Space');
    await until(() => T(P, () => window.__play.on), 6000); await sleep(300);
    await P.keyboard.press('Space');
    check('PC 에서도 스페이스바로 다트를 던짐', await until(() => T(P, () => window.__play.state.left === 2), 6000));
    await ctx2.close();

    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
