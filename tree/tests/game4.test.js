// 4층 게임방 검사: 4층과 사다리 · 게임방 가구(오락기·인형뽑기·당구대·빈백·토끼 인형) · 마스터 판의 "4층을 게임방으로 꾸미기" · 오락기 별 받기(점수·목숨·끝·이 방 기록) · 인형뽑기(뽑기·놓이는 인형·실패) · 친구 화면과 저장
// 실행: cd tree/tests && node game4.test.js   (화면 사진은 out/game4-*.png)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8232, BASE = `http://localhost:${PORT}/tree/`, OUT = path.join(__dirname, 'out');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const HASH = 'de94e28d7a302b52374831e94e8c70adddf861c691e77ab53f0646f55543a3e7';
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const T = (p, fn, arg) => p.evaluate(fn, arg);
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__game4 && window.__tree.frames > 3)), 30000);
async function open(ctx, url, master) {
  const p = await ctx.newPage();
  await p.addInitScript((mk) => { window.__bare = true; if (mk) localStorage.setItem('tree.master.' + new URLSearchParams(location.search).get('ns'), mk); }, master ? HASH : '');
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const shot = (p, name) => p.screenshot({ path: path.join(OUT, `game4-${name}.png`) });
const st = (p) => T(p, () => window.__game4.state);
const mode = (p) => T(p, () => window.__tree.mode);
const kinds = (p, lv) => T(p, (lv) => [...window.__tree.S.items.values()].filter((it) => lv == null || Math.floor(it.i / 32) === lv).map((it) => it.k).sort(), lv);
const idOf = (p, k) => T(p, (k) => { const it = [...window.__tree.S.items.values()].find((x) => x.k === k); return it ? it.id : null; }, k);
const bunnies = (p) => T(p, () => [...window.__tree.S.items.values()].filter((it) => /^bunny\d?$/.test(it.k)).length);
const hash = (p) => T(p, () => window.__duo.hash());
const audit = (p, sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((b) => b.getBoundingClientRect().width && !b.closest('[hidden]')).map((b) => [b.textContent.trim(), b.getBoundingClientRect()]).filter(([, r]) => r.width < 43.5 || r.height < 43.5 || r.left < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5).map(([t, r]) => `${t}: ${Math.round(r.width)}×${Math.round(r.height)}`), sel);
const serve = () => http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
const settle = (p) => until(() => T(p, () => { const m = window.__tree.me; return !m.moving && !m.path.length && !m.climbing; }), 60000);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = serve();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ga`, true);

    /* 4층과 사다리 */
    const info = await T(A, () => { const W = window.__tree; return { lv: W.LEVELS, lad: W.LADDERS.map((l) => [l.lv, l.a, l.b]), floors: W.room.floors.length, lamps: W.S.lamps.length, gx: W.GX }; });
    check('집이 4층이고 사다리가 셋: 3층 (91,13) → 4층 (124,13)', info.lv === 4 && info.floors === 4 && info.lamps === 4 && info.gx === 126 && JSON.stringify(info.lad[2]) === '[2,[91,13],[124,13]]', info);
    await T(A, () => { const W = window.__tree; W.me.place(-4 + (64 + 20.5) * 0.5, -4 + 13.5 * 0.5); W.snapView(); });
    const [gx, gz] = [-4 + (96 + 10.5) * 0.5, -4 + 12.5 * 0.5];
    const went = await T(A, (a) => window.__tree.goTo(a[0], a[1]), [gx, gz]);
    check('3층에서 4층 자리로 가라고 하면 사다리를 타고 올라감 (높이 8.4)', went && await until(() => T(A, () => window.__tree.me.climbing), 30000) && await settle(A) && await T(A, (a) => { const W = window.__tree; return W.level === 3 && Math.hypot(W.me.x - a[0], W.me.z - a[1]) < 0.2 && Math.abs(W.me.root.position.y - 8.4) < 0.05 && W.room.floors.map((f) => f.g.visible).join() === 'false,false,false,true'; }, [gx, gz]), await T(A, () => [window.__tree.level, window.__tree.me.x, window.__tree.me.z]));
    check('사다리 구멍과 올라선 칸에는 가구를 놓을 수 없음', !(await T(A, () => window.__tree.dispatch({ t: 'put', id: 'x1', k: 'lamp', i: 96 + 27, j: 13, r: 0 }))) && !(await T(A, () => window.__tree.dispatch({ t: 'put', id: 'x2', k: 'lamp', i: 96 + 28, j: 13, r: 0 }))));
    check('4층의 불도 따로 켜고 끔', await T(A, () => { const W = window.__tree; return W.dispatch({ t: 'lamp', lv: 3, on: false }) && W.S.lamps.join() === '1,1,1,0' && JSON.stringify(W.serialize().lamps) === '[1,1,1,0]' && W.dispatch({ t: 'lamp', lv: 3, on: true }) && !W.dispatch({ t: 'lamp', lv: 4, on: false }); }));
    await sleep(400); await shot(A, 'empty');

    /* 가구 목록 */
    await A.tap('#tabs button[data-m="furn"]'); await sleep(300);
    const picks = await T(A, () => [...document.querySelectorAll('#furnList .pick')].map((b) => b.textContent.trim()));
    check('가구 탭에 게임방 가구 여덟 가지가 나옴 (누구나 직접 놓는다)', ['오락기', '인형뽑기', '당구대', '빈백', '토끼 인형 (빨강)', '토끼 인형 (하늘)', '토끼 인형 (노랑)', '큰 토끼 인형'].every((n) => picks.some((t) => t.includes(n))) && picks.length === 51, [picks.length, picks.slice(-9)]);
    await A.tap('#tabs button[data-m="furn"]'); await sleep(200);
    check('토끼 인형을 2층에도 놓을 수 있음', await T(A, () => window.__tree.dispatch({ t: 'put', id: 'bn', k: 'bunny2', i: 32 + 5, j: 5, r: 0 })) && await T(A, () => { let n = 0; window.__tree.itemObj && 0; const W = window.__tree; return W.S.items.get('bn').k === 'bunny2'; }));

    /* 마스터 판: 한 번에 꾸미기 */
    await T(A, () => window.__tree.dispatch({ t: 'put', id: 'old', k: 'sofa', i: 96 + 5, j: 5, r: 0 }));
    await T(A, () => window.__duo.invite());
    await until(() => T(A, () => window.__duo.mode === 'waiting'));
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=gb#r=${room}`, false);
    await until(async () => (await T(A, () => window.__duo.count)) === 2, 20000);
    check('마스터키가 없는 친구는 꾸미기 단추가 없고, 해 봐도 안 됨', !(await T(B, () => window.__game4.row)) && (await T(B, () => window.__game4.convert())) === -1 && (await kinds(B, 3)).join() === 'sofa');
    await A.bringToFront();
    await A.tap('#tabs button[data-m="master"]'); await sleep(300);
    check('마스터 판에 "🎮 4층을 게임방으로 꾸미기" 단추 (화면 안·44px 이상)', (await A.isVisible('#gameBtn4')) && (await A.textContent('#gameBtn4')).includes('4층을 게임방으로') && (await audit(A, '#masterP button')).length === 0, await audit(A, '#masterP button'));
    await A.tap('#gameBtn4'); await sleep(200);
    check('한 번 누르면 치울 가구 수를 알려 주며 다시 물음', (await A.textContent('#gameBtn4')).includes('4층 가구 1개를 치우고') && (await kinds(A, 3)).join() === 'sofa');
    await A.tap('#gameBtn4'); await sleep(600);
    const set = await kinds(A, 3);
    check('한 번 더 누르면 4층의 가구를 치우고 게임방 18점을 놓음 (다른 층은 그대로)', set.length === 18 && !set.includes('sofa') && set.filter((k) => k === 'arcade').length === 3 && set.filter((k) => k === 'claw').length === 2 && set.filter((k) => /^bunny/.test(k)).length === 5 && set.includes('bigbunny') && set.includes('pool') && (await T(A, () => window.__tree.S.items.has('bn'))), set);
    check('친구 화면에도 같은 게임방', await until(async () => (await hash(A)) === (await hash(B)) && (await kinds(B, 3)).length === 18, 8000));
    await T(A, () => { const W = window.__tree; W.setMode(null); for (let k = 0; k < 6; k++) W.zoomBy(0.8); }); await sleep(900); await shot(A, 'room');

    /* 오락기: 별 받기 */
    const arc = await idOf(A, 'arcade');
    await T(A, (id) => window.__play.open(id), arc); await sleep(500);
    check('오락기를 열면 작은 화면과 "시작하기"가 보임', (await A.isVisible('#arcCv')) && (await A.textContent('#playGo')).includes('시작하기') && (await st(A)).phase === 'ready');
    await A.tap('#playGo');
    check('시작하면 별이 떨어지기 시작하고 ◀ ▶ 단추가 보임 (화면 안·44px 이상)', await until(async () => { const s = await st(A); return s.phase === 'run' && s.drops > 0; }, 8000) && (await A.isVisible('#arcL')) && (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    await T(A, () => { for (let k = 0; k < 4; k++) window.__game4.spawn('star'); window.__game4.spawn('big'); });
    check('바구니 위로 떨어진 별을 받으면 점수가 오름 (별 1점, 큰 별 3점)', await until(async () => (await st(A)).score >= 7, 8000), await st(A));
    await sleep(300); await shot(A, 'arcade');
    const x0 = (await st(A)).x;
    await A.tap('#arcR'); await A.tap('#arcR');
    check('▶ 를 누르면 바구니가 오른쪽으로', await until(async () => (await st(A)).x > x0 + 0.15, 4000), [x0, (await st(A)).x]);
    const box = await A.locator('#arcCv').boundingBox();
    await A.touchscreen.tap(box.x + box.width * 0.2, box.y + box.height * 0.5);
    check('화면을 누르면 그 자리로 바구니가 옴', await until(async () => Math.abs((await st(A)).x - 0.2) < 0.06, 4000), (await st(A)).x);
    await T(A, () => window.__game4.spawn('rock'));
    check('까만 돌을 받으면 목숨이 줄어듦', await until(async () => (await st(A)).lives === 2, 8000), await st(A));
    const sc = (await st(A)).score;
    await T(A, () => window.__game4.setT(39.9));
    check('40초가 지나면 끝나고 점수와 "한 판 더"가 나옴', await until(async () => (await st(A)).phase === 'over', 8000) && (await A.textContent('#playMain')).includes(`별 ${(await st(A)).score}개`) && (await A.textContent('#playGo')).includes('한 판 더'), await st(A));
    check('점수가 이 방 기록과 순위에 남고 친구에게도 감', await until(async () => { const b = await T(A, () => window.__tree.S.best.arcade); const r = await T(B, () => window.__tree.S.best.arcade); return b && b.v >= sc && r && r.v === b.v; }, 8000), await T(A, () => window.__tree.S.best));
    await T(A, () => { const s = window.__game4; document.getElementById('playGo').click(); s.spawn('rock'); s.spawn('rock'); s.spawn('rock'); });
    check('돌을 세 번 받으면 바로 끝남', await until(async () => { const s = await st(A); return s.phase === 'over' && s.lives === 0; }, 10000), await st(A));
    await T(A, () => window.__play.close()); await sleep(300);
    check('닫으면 작은 화면이 사라짐', !(await A.isVisible('#arcCv')) && (await mode(A)) === null);

    /* 인형뽑기 */
    const claw = await idOf(A, 'claw'), n0 = await bunnies(A);
    await T(A, (id) => window.__play.open(id), claw); await sleep(600);
    check('인형뽑기를 열면 인형 셋과 "집게 내리기", 남은 집게 3번', (await T(A, () => window.__game4.dolls)).length === 3 && (await A.textContent('#playGo')).includes('집게 내리기') && (await A.textContent('#playSub')).includes('3번'));
    const x1 = (await st(A)).x; await sleep(500);
    check('집게가 좌우로 오감', Math.abs((await st(A)).x - x1) > 0.005, [x1, (await st(A)).x]);
    await shot(A, 'claw');
    await T(A, () => { window.__game4.aim(-0.07); document.getElementById('playGo').click(); });
    check('인형이 없는 데에 내리면 못 뽑고 집게가 한 번 줄어듦', await until(async () => { const s = await st(A); return s.phase === 'aim' && s.left === 2 && s.won === 0; }, 15000) && (await bunnies(A)) === n0, await st(A));
    await T(A, () => { window.__game4.aim(0.01); document.getElementById('playGo').click(); });
    check('인형 바로 위에서 내리면 뽑힘: 토끼 인형 하나가 내 옆에 놓임 (친구에게도)', await until(async () => (await st(A)).won === 1, 20000) && await until(async () => (await bunnies(A)) === n0 + 1 && (await bunnies(B)) === n0 + 1, 6000) && (await T(A, () => window.__game4.dolls.filter((d) => d.taken).length)) === 1, [await st(A), await bunnies(A)]);
    await shot(A, 'claw-won');
    await until(async () => (await st(A)).phase === 'aim', 8000);
    await T(A, () => { window.__game4.aim(-0.07); document.getElementById('playGo').click(); });
    check('집게를 다 쓰면 결과와 "한 판 더"', await until(async () => (await st(A)).phase === 'done', 15000) && (await A.textContent('#playMain')).includes('1개를 뽑았어요') && (await A.textContent('#playGo')).includes('한 판 더'), [await st(A), await A.textContent('#playMain')]);
    await A.tap('#playGo');
    check('한 판 더: 인형 셋이 다시 차고 집게 3번', await until(async () => { const s = await st(A); return s.phase === 'aim' && s.left === 3; }, 4000) && (await T(A, () => window.__game4.dolls.every((d) => !d.taken))));
    await T(A, () => window.__play.close()); await sleep(300);
    // 구경하는 사람은 뽑아도 방에 놓지 못한다
    const rid = room.split('-')[0];
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=gc#v=${rid}`, false);
    await until(async () => (await T(A, () => window.__duo.count)) === 3, 20000);
    await C.bringToFront();
    await T(C, (id) => window.__play.open(id), claw); await sleep(600);
    await T(C, () => { window.__game4.aim(0.01); document.getElementById('playGo').click(); });
    check('구경하는 사람도 뽑기는 할 수 있지만 방에 인형이 놓이지는 않음', await until(async () => (await st(C)).won === 1, 25000) && (await bunnies(A)) === n0 + 1 && (await st(C)).placed === false, [await st(C), await bunnies(A)]);
    await T(C, () => window.__play.close());
    await A.bringToFront();
    check('방에 토끼 인형이 열두 개면 더 놓이지 않음', await T(A, () => { const W = window.__tree; let k = 0; for (let n = [...W.S.items.values()].filter((it) => /^bunny\d?$/.test(it.k)).length; n < 12; n++) W.dispatch({ t: 'put', id: 'fill' + n, k: 'bunny3', i: 96 + 2 + (k++), j: 4, r: 0 }); return [...W.S.items.values()].filter((it) => /^bunny\d?$/.test(it.k)).length; }) === 12);
    await T(A, (id) => window.__play.open(id), claw); await sleep(600);
    await T(A, () => { window.__game4.aim(0.01); document.getElementById('playGo').click(); });
    check('그때는 뽑아도 기계에 돌려놓았다고 알려 줌', await until(async () => (await st(A)).won === 1, 40000) && (await bunnies(A)) === 12 && (await st(A)).placed === false, [await st(A), await bunnies(A), await T(A, () => window.__game4.dolls)]);
    await T(A, () => window.__play.close()); await sleep(300);

    /* 당구 */
    const pool = await idOf(A, 'pool');
    const balls = () => T(A, () => window.__game4.balls);
    const still = () => until(async () => (await st(A)).phase !== 'roll', 15000);
    await T(A, (id) => window.__play.open(id), pool); await sleep(600);
    check('당구대를 열면 당구판(흰 공 + 색 공 6개)과 "시작하기"', (await A.isVisible('#poolCv')) && (await balls()).length === 7 && (await A.textContent('#playGo')).includes('시작하기'), await balls());
    await A.tap('#playGo'); await sleep(200);
    check('시작하면 남은 기회 8번, 방향 버튼과 "치기"', (await st(A)).phase === 'aim' && (await st(A)).left === 8 && (await A.isVisible('#poolL')) && (await A.isVisible('#poolR')) && (await A.textContent('#playGo')).includes('치기'), await st(A));
    const a0 = (await st(A)).ang; await A.tap('#poolR');
    check('↻ 를 누르면 겨냥하는 방향이 돎', Math.abs((await st(A)).ang - a0 - 0.1) < 1e-6);
    await T(A, () => { const g = window.__game4; g.setBall(0, 60, 60); g.setBall(1, 30, 30); });
    await T(A, () => window.__game4.shoot(-3 * Math.PI / 4, 0.5));
    check('흰 공으로 색 공을 맞혀 구멍에 넣으면 넣은 공이 하나 늘고 기회는 하나 줆', await still() && (await st(A)).sunk === 1 && (await st(A)).left === 7 && (await balls())[1].in, [await st(A), (await balls())[1]]);
    await shot(A, 'pool');
    await T(A, () => window.__game4.setBall(0, 22, 22)); await T(A, () => window.__game4.shoot(-3 * Math.PI / 4, 0.3));
    check('흰 공이 빠지면 처음 자리로 돌아오고 한 번을 더 잃음', await still() && (await st(A)).left === 5 && !(await balls())[0].in && (await A.textContent('#playSub')).includes('흰 공이 빠졌어요'), [await st(A), (await balls())[0]]);
    const box2 = await A.locator('#poolCv').boundingBox(), q = (await balls())[0];
    const qx = box2.x + q.x / 300 * box2.width, qy = box2.y + q.y / 133 * box2.height;
    await A.mouse.move(qx, qy); await A.mouse.down(); await A.mouse.move(qx - 40, qy, { steps: 4 }); await A.mouse.up();
    check('흰 공을 뒤로 끌었다 놓으면 끈 반대쪽(오른쪽)으로 나감', await until(async () => (await st(A)).left === 4, 3000) && Math.abs((await st(A)).ang) < 0.05, await st(A));
    for (let k = 0; k < 4; k++) { await still(); await T(A, () => window.__game4.shoot(Math.PI / 2, 0.05)); }
    check('기회를 다 쓰면 끝나고 점수(넣은 공 × 10)와 "한 판 더", 기록에 남음', await until(async () => (await st(A)).phase === 'over', 15000) && (await st(A)).score === (await st(A)).sunk * 10 && (await A.textContent('#playGo')).includes('한 판 더') && await until(() => T(A, () => !!window.__tree.S.best.pool), 5000), await st(A));
    await T(A, () => window.__play.close()); await sleep(300);
    check('닫으면 당구판이 사라짐', !(await A.isVisible('#poolCv')) && (await mode(A)) === null);

    /* 빈백에 앉기 */
    const bag = await idOf(A, 'beanbag');
    check('빈백 앞에서 "💺 앉기"가 뜸', (await T(A, (id) => { const W = window.__tree, it = W.S.items.get(id); W.me.place(-4 + (it.i + 1) * 0.5, -4 + (it.j + 2.5) * 0.5); return W.nearAction(); }, bag)) === '💺 앉기');
    await T(A, (id) => window.__tree.lieDown(id), bag);
    check('누르면 빈백에 파묻혀 앉음', await until(() => T(A, () => window.__cinema.sitting), 15000) && (await T(A, (id) => window.__tree.lying.id === id, bag)));
    await shot(A, 'beanbag');
    await T(A, () => window.__tree.getUp()); await sleep(200);

    /* 그 앞에서 스페이스바, 저장 */
    check('오락기·인형뽑기 앞에서 할 일 이름이 뜸', await T(A, (ids) => { const W = window.__tree; const at = (id) => { const it = W.S.items.get(id); W.me.place(-4 + (it.i + 0.5) * 0.5, -4 + (it.j + 1.6) * 0.5); return W.nearAction(); }; return [at(ids[0]), at(ids[1])]; }, [arc, claw]).then((r) => r[0] === '🕹️ 오락기 하기' && r[1] === '🧸 인형 뽑기'));
    await T(A, () => window.__tree.dispatch({ t: 'wall', v: 1 })); await sleep(1500);
    const before = await kinds(A);
    await A.reload(); await ready(A); if (await A.isVisible('#lookDone')) await A.click('#lookDone');
    check('새로 고쳐도 게임방과 기록이 그대로', await until(async () => JSON.stringify(await kinds(A)) === JSON.stringify(before), 10000) && await T(A, () => !!window.__tree.S.best.arcade));
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) {
    console.log('검사 중 오류', e); results.push(false);
  } finally {
    await browser.close(); server.close();
  }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
