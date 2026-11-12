// 같이 놀기 · 숨바꼭질 검사 (놀이 고르기 판, 심판, 눈 가리는 술래, 옷장에 숨기, 찾기, 술래에게 안 보이는 말, 같은 층 경고, 결과, 심판이 나가면 취소, 도중에 온 사람).
// 실행: cd tree/tests && node hide.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8193, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__games && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
  // 빈 방에서 시작하고, 시계를 앞당길 수 있게 한다 (window.__skip 밀리초만큼)
  await p.addInitScript(() => { window.__bare = true; window.__skip = 0; window.__now = () => Date.now() + window.__skip; });
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
const overlap = (p, a, b) => p.evaluate(([a, b]) => { const x = document.querySelector(a).getBoundingClientRect(), y = document.querySelector(b).getBoundingClientRect(); return !(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top); }, [a, b]);
const stand = (p, x, z) => T(p, ([x, z]) => { const t = window.__tree; t.me.stop(); t.me.place(x, z); t.snapView(); }, [x, z]);
const G = (p) => T(p, () => window.__games.state);
const band = (p) => T(p, () => window.__games.band);
const skip = (p, ms) => T(p, (ms) => { window.__skip += ms; }, ms);
const shot = (p, n) => p.screenshot({ path: path.join(__dirname, 'out', n) });

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ha`);

    /* 혼자일 때: 단추와 고르기 판 */
    const gb = await T(A, () => { const r = document.getElementById('gameBtn').getBoundingClientRect(); return { w: r.width, h: r.height, l: r.left, r: r.right, b: r.bottom, ih: innerHeight, iw: innerWidth, label: document.getElementById('gameBtn').getAttribute('aria-label'), inTools: document.getElementById('gameBtn').parentElement.id }; });
    check('도구 단추에 "🎲 같이 놀기"가 있음 (44px 이상, 화면 안)', gb.inTools === 'tools' && gb.label === '같이 놀기' && gb.w >= 44 && gb.h >= 44 && gb.l >= 0 && gb.r <= gb.iw, gb);
    await A.tap('#gameBtn'); await sleep(200);
    const solo = await T(A, () => ({ open: window.__games.pick, dis: [...document.querySelectorAll('#gamePick [data-g]')].map((b) => b.disabled), why: document.getElementById('gamePickWhy').textContent, txt: document.getElementById('gamePick').textContent }));
    check('누르면 놀이 고르기 판(숨바꼭질 / 몰래 산타, 사람 수와 설명)', solo.open && solo.txt.includes('숨바꼭질 · 2명 이상') && solo.txt.includes('몰래 산타 · 3명 이상') && solo.txt.includes('술래'), solo);
    check('혼자일 때는 고를 수 없고 친구를 초대하라는 안내', solo.dis.every(Boolean) && solo.why.includes('초대'), solo);
    await shot(A, 'hide-pick-solo.png');
    check('고르기 판의 단추도 44px 이상·화면 안', (await audit(A)).length === 0, await audit(A));
    await A.tap('#gamePickClose'); await sleep(100);
    check('닫기를 누르면 닫힘', !(await T(A, () => window.__games.pick)));

    /* 셋이 모임: A 방장(꾸미기), B 꾸미기, C 구경 */
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=hb#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=hc#v=${rid}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    const bid = await T(B, () => window.__duo.me), cid = await T(C, () => window.__duo.me);
    // 1층 거실 북쪽 벽 옆에 옷장 하나
    await T(A, () => window.__tree.dispatch({ t: 'put', id: 'cl', k: 'closet', i: 2, j: 2, r: 0 }));
    await until(() => T(C, () => window.__tree.S.items.has('cl')), 4000);
    await T(C, () => { document.getElementById('gameBtn').click(); });
    check('구경하는 사람에게는 "꾸밀 수 있는 사람이 시작" 안내', (await T(C, () => document.getElementById('gamePickWhy').textContent)).includes('꾸밀 수 있는 사람') && (await T(C, () => [...document.querySelectorAll('#gamePick [data-g]')].every((b) => b.disabled))));
    await T(C, () => document.getElementById('gamePickClose').click());
    await A.tap('#gameBtn'); await sleep(150);
    check('셋이면 숨바꼭질을 고를 수 있음 (방장)', await T(A, () => !document.querySelector('#gamePick [data-g="hide"]').disabled));
    check('트리에 장식이 없으면 몰래 산타는 고를 수 없음', await T(A, () => document.querySelector('#gamePick [data-g="santa"]').disabled && window.__games.why('santa').includes('장식')));
    // 술래는 B 가 되게: 무작위를 잠깐 고정한다 (pl = [h, B, C])
    await T(A, () => { const r = Math.random; Math.random = () => 0.4; document.querySelector('#gamePick [data-g="hide"]').click(); Math.random = r; });
    let g = await G(A);
    check('고르면 판이 시작되고 시작한 사람이 심판, 모두가 명단에', !!g && g.g === 'hide' && g.ref === 'h' && g.ph === 'hide' && g.pl.length === 3 && g.sk === bid, g);
    check('모두의 화면에 같은 판 (술래 B)', await until(async () => { const b = await G(B), c = await G(C); return b && c && b.gid === g.gid && c.gid === g.gid && b.sk === bid && c.sk === bid; }, 3000));
    check('한 번에 한 판만: 진행 중에는 새로 시작할 수 없음', (await T(B, () => window.__games.start('santa'))) === false && (await G(A)).gid === g.gid);
    const bA = await band(A), bB = await band(B);
    check('상태 띠: 놀이 이름·남은 시간·내 역할, 심판만 "그만하기"', bA && bA.name.includes('숨바꼭질') && /숨는 중 0:(19|20)/.test(bA.clock) && bA.role.includes('숨는 사람') && bA.stop && bB && bB.role.includes('술래') && !bB.stop, { bA, bB });
    check('구경하는 사람(C)도 명단에 들어 같이 숨음', (await band(C)).role.includes('숨는 사람'));

    /* 술래: 눈 가리기 */
    check('술래 화면은 어두워지고 "숨는 중… 20" 카운트', (await T(B, () => window.__games.blind)) && /숨는 중… (19|20)/.test(await T(B, () => document.getElementById('gameBlindN').textContent)));
    check('숨는 사람 화면은 어둡지 않음', !(await T(A, () => window.__games.blind)) && !(await T(C, () => window.__games.blind)));
    const b0 = await T(B, () => [window.__tree.me.x, window.__tree.me.z]);
    await T(B, () => window.__tree.goTo(window.__tree.me.x + 2, window.__tree.me.z));
    await B.keyboard.down('ArrowLeft'); await sleep(500); await B.keyboard.up('ArrowLeft');
    const b1 = await T(B, () => [window.__tree.me.x, window.__tree.me.z]);
    check('눈 가리는 동안 술래는 움직일 수 없음 (눌러 걷기·방향키)', Math.hypot(b1[0] - b0[0], b1[1] - b0[1]) < 1e-3, { b0, b1 });
    check('눈 가리는 동안 스페이스 단추는 "🙈 눈 가리는 중"', (await T(B, () => window.__tree.nearAction())) === '🙈 눈 가리는 중');
    await shot(B, 'hide-blind.png');

    /* 숨기: A 는 옷장에, C 는 2층에 */
    await stand(A, -2.25, -2.2); await sleep(300);
    check('숨는 사람이 옷장 앞에 서면 "🚪 옷장에 숨기"', (await T(A, () => window.__tree.nearAction())) === '🚪 옷장에 숨기', await T(A, () => window.__tree.nearAction()));
    check('#act 단추에도 그렇게 보임', await until(async () => (await A.isVisible('#act')) && (await A.textContent('#act')).includes('옷장에 숨기'), 1500));
    await A.keyboard.press('Space'); await sleep(300);
    check('스페이스를 누르면 옷장에 숨음 (내 띠에 "옷장 안")', (await band(A)).role.includes('옷장 안') && (await T(A, () => window.__games.locked)));
    check('옷장에 숨은 사람은 모두의 화면에서 안 보임 (나·술래·다른 숨는 사람)', await until(async () => (await T(A, () => window.__games.shrunk('h'))) && (await T(B, () => window.__games.shrunk('h'))) && (await T(C, () => window.__games.shrunk('h'))), 3000));
    const a0 = await T(A, () => [window.__tree.me.x, window.__tree.me.z]);
    await T(A, () => window.__tree.goTo(0, 3)); await sleep(400);
    const a1 = await T(A, () => [window.__tree.me.x, window.__tree.me.z]);
    check('옷장 안에서는 움직이지 않음', Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) < 1e-3);
    check('옷장 안에서 스페이스는 "🚪 옷장에서 나오기"', (await T(A, () => window.__tree.nearAction())) === '🚪 옷장에서 나오기');
    await A.keyboard.press('Space'); await sleep(300);
    check('다시 누르면 나옴 (모두에게 다시 보임)', !(await T(A, () => window.__games.locked)) && await until(async () => !(await T(B, () => window.__games.shrunk('h'))) && !(await T(A, () => window.__games.shrunk('h'))), 3000));
    await A.keyboard.press('Space'); await sleep(300);
    await until(() => T(B, () => window.__games.shrunk('h')), 3000);
    const up = await T(C, () => window.__tree.FLOOR_DX);
    await stand(C, 2 + up, 1); // 2층
    const settled = (p, id) => until(async () => { const o = await T(p, (id) => window.__duo.others.find((q) => q.id === id), id); return o && o.level === 1 && !o.moving && !o.climbing; }, 15000);
    await settled(B, cid); await settled(A, cid);

    /* 술래에게 숨은 사람의 말·행동이 안 보임 */
    await T(C, () => window.__duo.say('여기 2층이야'));
    await until(async () => (await T(A, () => window.__duo.chatLog)).some((l) => l.includes('여기 2층이야')), 3000);
    await sleep(300);
    const logB = await T(B, () => window.__duo.chatLog);
    check('숨는 사람끼리는 말이 그대로 보임', (await T(A, () => window.__duo.chatLog)).some((l) => l.includes('여기 2층이야')));
    check('술래에게는 "어디선가 소리가 났어요"만 (말풍선·글 없음)', !logB.some((l) => l.includes('여기 2층이야')) && logB.some((l) => l.includes('어디선가 소리가 났어요')) && !(await T(B, () => window.__duo.bubbles)).some((b) => b.text.includes('2층')), logB);
    await T(C, () => window.__tree.doAct('wave'));
    await sleep(500);
    check('숨는 사람의 행동은 술래에게 안 보이고 다른 사람에게는 보임', !(await T(B, (c) => window.__duo.others.find((o) => o.id === c).acting, cid)) && (await T(A, (c) => window.__duo.others.find((o) => o.id === c).acting, cid)) === 'wave');

    /* 찾기 시작 */
    await skip(A, 20500);
    check('20초가 지나면 찾기 시작 (모두의 띠에 2:00)', await until(async () => (await G(B)).ph === 'seek' && (await G(C)).ph === 'seek' && /[12]:[0-5]\d/.test((await band(B)).clock), 4000), await band(B));
    check('술래의 눈 가림이 풀리고 움직일 수 있음', !(await T(B, () => window.__games.blind)) && !(await T(B, () => window.__games.locked)));
    // 술래가 2층으로 오면 C 에게 경고
    check('찾기가 시작될 때 술래와 같은 층(1층)에 숨은 사람(A)에게 경고', await until(async () => (await band(A)).warn, 3000));
    await stand(B, 3.5 + up, 2.5);
    check('술래가 같은 층에 오면 숨은 사람에게 "술래가 이 층에 왔어요!"', await until(async () => (await band(C)).warn && (await C.textContent('#toast')).includes('술래가 이 층에 왔어요'), 15000), { b: await band(C), t: await C.textContent('#toast') });
    check('술래가 떠난 층에 숨은 사람(A)의 경고는 꺼짐', await until(async () => !(await band(A)).warn, 15000));
    // 멀리서 누르면 더 가까이 가라는 안내
    await stand(B, 6 + up, 1); await sleep(400);
    await T(B, () => window.__tree.snapView());
    let at = await T(B, (c) => { const o = window.__duo.others.find((q) => q.id === c); return window.__tree.screenOf(o.x, o.z, 0.9); }, cid);
    await B.touchscreen.tap(at.x, at.y); await sleep(300);
    check('술래가 멀리서(1.5m 밖) 누르면 "더 가까이"', (await B.textContent('#toast')).includes('더 가까이') && (await G(B)).out.length === 0, await B.textContent('#toast'));
    await stand(B, 3 + up, 1); await sleep(400);
    check('가까이(1.5m 안) 가면 스페이스 단추가 "🔎 찾았다!"', (await T(B, () => window.__tree.nearAction())) === '🔎 찾았다!');
    at = await T(B, (c) => { const o = window.__duo.others.find((q) => q.id === c); return window.__tree.screenOf(o.x, o.z, 0.9); }, cid);
    await B.touchscreen.tap(at.x, at.y);
    check('숨은 사람을 누르면 찾음 (모두에게 알림)', await until(async () => (await G(A)).out.includes(cid) && (await G(C)).out.includes(cid), 3000));
    check('찾힌 사람 화면: "들켰어요" 와 구경', (await C.textContent('#toast')).includes('들켰어요') && (await band(C)).role.includes('구경'));
    check('찾힌 사람에게 "👀 찾음" 표시가 붙음', await until(async () => (await T(B, () => window.__games.tags)).includes(cid) && (await T(C, () => window.__games.tags)).includes(cid), 2000));
    check('찾힌 사람의 말은 술래에게도 그대로', await T(C, () => window.__duo.say('들켰다')) && await until(async () => (await T(B, () => window.__duo.chatLog)).some((l) => l.includes('들켰다')), 3000));
    check('판은 계속 (아직 A 가 남음)', (await G(A)).ph === 'seek');
    await shot(B, 'hide-seek.png');

    /* 옷장 열어 보기 */
    await stand(B, 2.25 - 4 + 2, -1.9); await sleep(300); // 1층 옷장 앞 (조금 옆)
    await stand(B, -1.5, -2.1); await sleep(300);
    check('술래가 옷장 앞에 서면 "🚪 옷장 열어 보기"', (await T(B, () => window.__tree.nearAction())) === '🚪 옷장 열어 보기', await T(B, () => window.__tree.nearAction()));
    await B.keyboard.press('Space');
    check('옷장을 열면 안에 숨은 사람을 찾고, 모두 찾았으니 술래 승', await until(async () => (await T(A, () => window.__games.result)) && (await T(B, () => window.__games.result)) && (await T(C, () => window.__games.result)), 3000));
    const rA = await T(A, () => window.__games.result), rB = await T(B, () => window.__games.result);
    check('결과 판: 술래 승리, 이긴 사람과 진 사람', rA.main.includes('술래') && rA.main.includes('승리') && rB.sub.includes('이겼어요') && rA.sub.includes('졌어요'), { rA, rB });
    check('판이 끝나면 띠와 숨김이 모두 풀림', !(await band(A)) && !(await T(A, () => window.__games.shrunk('h'))) && !(await T(B, () => window.__games.shrunk('h'))) && (await T(B, () => window.__games.tags)).length === 0);
    await shot(A, 'hide-result.png');
    check('결과 판의 단추도 44px 이상·화면 안', (await audit(A)).length === 0, await audit(A));
    for (const p of [A, B, C]) await T(p, () => window.__games.closeEnd());

    /* 시간이 끝나면 숨은 사람 승: B 가 심판(손님이 심판) */
    await T(B, () => { const ids = [window.__duo.me, ...window.__duo.others.map((o) => o.id)], k = ids.indexOf('h'), r = Math.random; Math.random = () => (k + 0.5) / ids.length; window.__games.start('hide'); Math.random = r; }); // 술래는 방장
    g = await G(B);
    check('손님(B)이 시작하면 B 의 화면이 심판', g && g.ref === bid && g.sk === 'h' && await until(async () => (await G(A)) && (await G(C)) && (await G(A)).ref === bid, 3000));
    check('술래가 된 방장 화면이 어두워짐', await until(() => T(A, () => window.__games.blind), 2000));
    await skip(B, 20500);
    await until(async () => (await G(A)).ph === 'seek', 4000);
    await skip(B, 121000);
    check('찾기 시간이 끝나면 숨은 사람 승', await until(async () => { const r = await T(C, () => window.__games.result); return r && r.main.includes('숨은 사람 승리'); }, 4000), await T(C, () => window.__games.result));
    check('끝까지 안 들킨 사람의 이름이 결과에 나옴', (await T(C, () => window.__games.result)).sub.includes('끝까지 안 들킨 사람') && (await T(C, () => window.__games.result)).sub.includes('이겼어요'));
    for (const p of [A, B, C]) await T(p, () => window.__games.closeEnd());

    /* 그만하기 (심판만) */
    await T(A, () => window.__games.start('hide'));
    await until(async () => (await G(C)) !== null, 3000);
    check('심판이 아닌 사람에게는 "그만하기"가 없음', !(await band(C)).stop && (await band(A)).stop);
    await A.tap('#gameStop');
    check('심판이 "그만하기"를 누르면 모두에게 취소 알림', await until(async () => { const r = await T(C, () => window.__games.result); return r && r.main.includes('취소') && !(await G(C)); }, 3000));
    for (const p of [A, B, C]) await T(p, () => window.__games.closeEnd());

    /* 도중에 온 사람은 구경, 심판이 나가면 취소 */
    await T(B, () => window.__games.start('hide'));
    await until(async () => (await G(A)) && (await G(C)), 3000);
    const D = await open(ctx, `${BASE}?net=bc&door=0&ns=hd#v=${rid}`);
    check('판 도중에 들어온 사람은 구경 (명단에 없음)', await until(async () => { const b = await band(D); return b && b.role.includes('구경') && !(await G(D)).pl.includes(await T(D, () => window.__duo.me)); }, 8000), await band(D));
    await shot(D, 'hide-late.png');
    await B.close();
    check('심판이 나가면 판이 취소되고 모두에게 알림', await until(async () => { const r = await T(A, () => window.__games.result), r2 = await T(C, () => window.__games.result); return r && r2 && r.sub.includes('심판') && !(await G(A)); }, 15000), await T(A, () => window.__games.result));

    /* 폰 화면: 띠·단추가 겹치지 않음 */
    for (const p of [A, C, D]) await T(p, () => window.__games.closeEnd());
    await T(A, () => window.__games.start('hide'));
    await until(() => G(C), 3000);
    await stand(A, -2.25, -2.2); await sleep(400);
    check('상태 띠가 위 막대·#act·도구 단추와 겹치지 않음', (await A.isVisible('#act')) && !(await overlap(A, '#gameBand', '#act')) && !(await overlap(A, '#gameBand', '#top a')) && !(await overlap(A, '#gameBand', '#tools')) && !(await overlap(A, '#act', '#tools')));
    check('놀이 중 화면의 단추가 모두 44px 이상·화면 안', (await audit(A)).length === 0 && (await audit(C)).length === 0, [await audit(A), await audit(C)]);
    await shot(A, 'hide-band.png');
    // 🎤 까지 보여 도구 단추가 8개여도 화면 안 (위 줄로 넘어감)
    await T(A, () => { document.getElementById('mic').hidden = false; window.dispatchEvent(new Event('resize')); }); await sleep(300);
    check('도구 단추가 많아도(🎤 포함) 화면 안·#act 와 안 겹침', (await audit(A)).length === 0 && !(await overlap(A, '#act', '#tools')), await audit(A));
    await shot(A, 'hide-tools-mic.png');

    /* 이상한 소식 */
    await T(C, () => { for (const v of ['', '{', '[]', '{"a":"s"}', '{"a":"s","gid":"x","g":"hide","ref":"zz","ph":"seek","left":5,"pl":[],"out":[]}', JSON.stringify({ a: 'find', gid: 'nope', id: 'h' }), 'x'.repeat(3000)]) window.__duo.feed({ t: 'fx', id: 'h', k: 'gm', v }); });
    await sleep(300);
    check('이상한 놀이 소식이 와도 버팀', (await G(C)) && (await G(C)).ref === 'h' && (await G(C)).out.length === 0);
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
