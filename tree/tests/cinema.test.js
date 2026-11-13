// 3층 영화관 검사: 새 방의 기본 배치 · 좌석에 앉기 · 팝콘 · 스크린으로 영화 보기 · 벽 그림 · 이미 꾸민 방은 그대로 · "3층을 영화관으로 바꾸기" · 여럿이 볼 때
// 실행: cd tree/tests && node cinema.test.js   (화면 사진은 out/cinema-*.png)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8201, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__cinema && window.__tree.frames > 3)), 20000);
async function open(ctx, url, bare = false) {
  const p = await ctx.newPage();
  if (bare) await p.addInitScript(() => { window.__bare = true; });
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const items = (p) => T(p, () => window.__tree.serialize().items);
const kinds = (list, lv) => { const n = {}; for (const it of list) if (lv === undefined || Math.floor(it[2] / 32) === lv) { const k = it[1].replace(/\d$/, ''); n[k] = (n[k] || 0) + 1; } return n; };
// 층 lv 의 집 기준 칸 (a, j) 한가운데로 옮겨 선다
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

    /* 새 방: 3층이 처음부터 영화관 */
    const N = await open(ctx, url('cn'));
    const all = await items(N), k3 = kinds(all, 2);
    check('새 방의 3층에 영화관이 차려져 있음: 스크린 1, 좌석 6(세 가지 단), 유도등 3, 팝콘 기계 1, 그림 7', k3.screen === 1 && k3.seat === 6 && k3.guide === 3 && k3.popcorn === 1 && k3.art === 7 && Object.values(k3).reduce((a, b) => a + b, 0) === 18, k3);
    check('좌석은 뒤로 갈수록 높은 단(seat, seat2, seat3 두 개씩)', ['seat', 'seat2', 'seat3'].every((k) => all.filter((it) => it[1] === k).length === 2));
    check('기본 가구는 모두 놓였고(40개) 1·2층과 마당은 예전 그대로', all.length === 40 && all.filter((it) => it[2] < 32).length === 17 && all.filter((it) => Math.floor(it[2] / 32) === 1).length === 5 && !!(await T(N, () => window.__cinema.has)), all.length);
    await stand(N, 2, 20, 8); await sleep(900);
    check('3층에 올라가면 영화관 가구가 보임', (await T(N, () => window.__tree.level)) === 2 && (await T(N, () => window.__tree.serialize().items.filter((it) => it[2] >= 64).every((it) => window.__tree.itemShown(it[0])))));
    await N.screenshot({ path: path.join(__dirname, 'out', 'cinema-new.png') });

    /* 좌석에 앉기 */
    const seat = all.find((it) => it[1] === 'seat2' && it[3] === 4);
    await stand(N, 2, 10, 5); await T(N, () => window.__tree.me.turnTo(1, 0)); await sleep(400);
    check('좌석 앞에 서면 "앉기" 단추가 뜸 (폰에서도 화면 안·44px 이상)', (await T(N, () => window.__tree.nearAction())) === '💺 앉기' && (await N.isVisible('#act')) && (await audit(N)).length === 0, [await T(N, () => window.__tree.nearAction()), await audit(N)]);
    await T(N, () => window.__tree.pressSpace());
    check('스페이스바(단추)를 누르면 걸어가 자리에 앉음', await until(() => T(N, () => window.__cinema.sitting), 8000) && (await T(N, () => window.__tree.lying)).id === seat[0]);
    const sit = await T(N, () => ({ y: window.__tree.me.root.position.y, face: window.__tree.me.root.rotation.y, act: window.__tree.nearAction(), panel: document.getElementById('lieP').textContent }));
    check('앉은 자리는 단 위(3층 바닥보다 높음)이고 스크린(서쪽)을 봄', sit.y > 2 * 2.8 + 0.15 && sit.y < 2 * 2.8 + 0.5 && Math.abs(Math.sin(sit.face) + 1) < 0.01, sit);
    check('앉아 있을 때의 안내와 "일어나기"', sit.act === '💺 일어나기' && sit.panel.includes('자리에 앉아 있어요') && (await audit(N)).length === 0, sit);
    await sleep(500);
    await N.screenshot({ path: path.join(__dirname, 'out', 'cinema-sit.png') });
    await T(N, () => window.__tree.pressSpace()); await sleep(300);
    check('일어나기를 누르면 일어남', !(await T(N, () => window.__cinema.sitting)) && (await T(N, () => window.__tree.lying)) === null);

    /* 팝콘 기계 */
    const pop = all.find((it) => it[1] === 'popcorn');
    await stand(N, 2, 27, 7); await T(N, () => window.__tree.me.turnTo(1, 0)); await sleep(400);
    check('팝콘 기계 앞에서는 "팝콘 먹기"', (await T(N, () => window.__tree.nearAction())) === '🍿 팝콘 먹기');
    await T(N, (id) => window.__tree.useItem(id), pop[0]);
    check('누르면 팝콘을 집어 먹음(먹는 몸짓과 알림)', await until(async () => (await N.textContent('#toast')).includes('팝콘'), 6000) && (await T(N, () => window.__tree.me.acting)) === 'eat', await T(N, () => window.__tree.me.acting));

    /* 스크린: TV 와 같은 놀이(동영상 넣기·같이 보기)가 큰 화면으로 열린다 */
    const scr = all.find((it) => it[1] === 'screen');
    await sleep(2600); await stand(N, 2, 1, 9); await T(N, () => window.__tree.me.turnTo(-1, 0)); await sleep(500);
    check('스크린 앞에서는 "영화 보기"', (await T(N, () => window.__tree.nearAction())) === '🎬 영화 보기', await T(N, () => window.__tree.nearAction()));
    await T(N, (id) => window.__play.open(id), scr[0]); await sleep(600);
    const eye = await T(N, () => ({ mode: window.__tree.mode, on: window.__play.on, posed: window.__play.posed, x: window.__tree.look3.x, y: window.__tree.look3.y }));
    check('스크린을 열면 TV 놀이 판이 열리고, 큰 화면에 맞춰 뒤로 물러서서 봄', eye.mode === 'play' && eye.posed && eye.y > 5.6 + 1.2 && eye.x > -4 + 3, eye);
    check('영화 보기 판의 단추가 화면 안·44px 이상', (await audit(N)).length === 0, await audit(N));
    await sleep(400);
    await N.screenshot({ path: path.join(__dirname, 'out', 'cinema-screen.png') });
    await T(N, () => window.__play.close()); await sleep(300);

    /* 벽에 건 그림은 그 벽이 내려가면 같이 숨는다 */
    const arts = all.filter((it) => it[1].startsWith('art'));
    const shown0 = await T(N, (ids) => { const w = window.__tree.room.floors[2].walls; return ids.map(([id, side]) => [window.__cinema.artShown(id), w[side].upper.visible]); }, arts.map((it) => [it[0], it[4] === 0 ? 'n' : 's']));
    check('그림은 걸린 벽이 보일 때만 보임(북쪽 벽 5점, 남쪽 벽 2점)', arts.filter((it) => it[4] === 0).length === 5 && arts.filter((it) => it[4] === 2).length === 2 && shown0.every(([a, b]) => a === b) && shown0.some(([a]) => a), shown0);
    await T(N, () => window.__tree.turnView(1)); await sleep(1500);
    const shown1 = await T(N, (ids) => { const w = window.__tree.room.floors[2].walls; return ids.map(([id, side]) => [window.__cinema.artShown(id), w[side].upper.visible]); }, arts.map((it) => [it[0], it[4] === 0 ? 'n' : 's']));
    check('화면을 돌려 벽이 바뀌어도 그림은 벽을 따라 숨고 보임', shown1.every(([a, b]) => a === b), shown1);
    await T(N, () => window.__tree.turnView(-1)); await sleep(1200);

    /* 다시 열어도 그대로이고 또 더해지지 않는다 */
    await sleep(500); await N.reload(); await ready(N);
    check('다시 열어도 영화관은 그대로(가구 40개, 또 더해지지 않음)', (await items(N)).length === 40 && kinds(await items(N), 2).screen === 1);
    await N.close();

    /* 이미 3층을 꾸며 둔 방: 그대로 둔다 */
    const O = await open(ctx, url('co'), true);
    await T(O, () => { const W = window.__tree; W.dispatch({ t: 'put', id: 'mybed', k: 'bed', i: 64 + 3, j: 1, r: 0 }); W.dispatch({ t: 'put', id: 'myrug', k: 'rug', i: 64 + 9, j: 8, r: 0 }); W.dispatch({ t: 'put', id: 'sofa1', k: 'sofa', i: 2, j: 6, r: 1 }); W.dispatch({ t: 'put', id: 'up2f', k: 'lamp', i: 32 + 5, j: 5, r: 0 }); });
    await sleep(700); await O.reload(); await ready(O);
    check('이미 3층을 꾸며 둔 방은 다시 열어도 그대로(영화관이 끼어들지 않음)', (await items(O)).length === 4 && !(await T(O, () => window.__cinema.has)), await items(O));
    await O.tap('#tabs button[data-m="paint"]'); await sleep(300);
    check('방장의 "벽·바닥" 판에 "3층을 영화관으로 바꾸기" 단추가 있음 (화면 안·44px 이상)', (await O.isVisible('#cineBtn')) && (await O.textContent('#cineBtn')).includes('3층을 영화관으로 바꾸기') && (await audit(O)).length === 0, await audit(O));
    await O.tap('#cineBtn'); await sleep(200);
    check('한 번 누르면 바로 바꾸지 않고 다시 묻는다(치울 가구 수를 알려 줌)', (await O.textContent('#cineBtn')).includes('한 번 더') && (await O.textContent('#cineBtn')).includes('2개') && (await items(O)).length === 4 && (await audit(O)).length === 0, [await O.textContent('#cineBtn'), await audit(O)]);
    await O.screenshot({ path: path.join(__dirname, 'out', 'cinema-button.png') });
    await O.tap('#cineBtn'); await sleep(500);
    const after = await items(O);
    check('한 번 더 누르면 3층 가구를 치우고 영화관을 차림 (다른 층은 그대로)', after.length === 20 && !after.some((it) => it[0] === 'mybed' || it[0] === 'myrug') && after.some((it) => it[0] === 'sofa1') && after.some((it) => it[0] === 'up2f') && kinds(after, 2).screen === 1 && kinds(after, 2).seat === 6 && kinds(after, 2).art === 7, kinds(after, 2));
    check('바꾼 뒤에는 단추가 처음 글로 돌아옴', (await O.textContent('#cineBtn')).includes('3층을 영화관으로 바꾸기'));

    /* 여럿이: 손님에게도 같은 영화관, 단추는 방장(과 공동 관리자)에게만 */
    await T(O, () => window.__duo.invite());
    await until(async () => (await T(O, () => window.__duo.mode)) === 'waiting');
    const inv = await T(O, () => window.__duo.inviteUrl());
    const G = await open(ctx, url('cg', '#r=' + inv.split('#r=')[1]), true);
    check('들어온 친구도 같은 영화관을 받음', await until(async () => (await T(G, () => window.__duo.mode)) === 'on' && (await T(G, () => window.__duo.hash())) === (await T(O, () => window.__duo.hash())), 12000) && (await items(G)).length === 20);
    await G.tap('#tabs button[data-m="paint"]'); await sleep(300);
    check('꾸미는 손님에게는 바꾸기 단추가 없고, 직접 불러도 바뀌지 않음', !(await G.isVisible('#cineBtn')) && (await T(G, () => window.__cinema.convert())) === -1 && (await items(G)).length === 20);
    await T(O, () => window.__tree.dispatch({ t: 'put', id: 'extra', k: 'plant', i: 64 + 20, j: 2, r: 0 })); await sleep(300);
    const n2 = await T(O, () => window.__cinema.convert());
    check('방장이 다시 바꾸면 손님 화면도 같이 바뀜(3층에 더 놓은 것은 치워짐)', n2 === 18 && await until(async () => (await T(G, () => window.__duo.hash())) === (await T(O, () => window.__duo.hash())) && !(await items(G)).some((it) => it[0] === 'extra') && (await items(G)).length === 20, 8000), n2);
    // 손님이 앉으면 방장에게도 앉은 모습으로 보인다
    const s2 = (await items(G)).find((it) => it[1] === 'seat');
    await T(G, () => window.__tree.setMode(null)); await stand(G, 2, 5, 5); await sleep(500);
    await T(G, (id) => window.__tree.lieDown(id), s2[0]);
    check('친구가 좌석에 앉으면 방장에게도 그 자리에 앉은 것으로 보임', await until(() => T(G, () => window.__cinema.sitting), 8000) && await until(async () => { const o = (await T(O, () => window.__duo.others))[0]; return o && o.lying && o.lying.id === s2[0]; }, 5000));
    await ctx.close();
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
