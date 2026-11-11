// 방 안 놀이 검사 (다트, TV, 마시멜로 굽기, 오르골). 실행: cd tree/tests && node play.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8165, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__play && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const st = (p) => T(p, () => window.__play.state);
const mode = (p) => T(p, () => window.__tree.mode);
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
const ROOM = [['dart', 'dart', 3, 0, 0], ['tv', 'tv', 0, 9, 1], ['music', 'music', 13, 0, 0], ['fire', 'fire', 6, 0, 0], ['sofa', 'sofa', 3, 10, 1]];
const furnish = (p) => T(p, (r) => r.every(([id, k, i, j, rr]) => window.__tree.dispatch({ t: 'put', id, k, i, j, r: rr })), ROOM);
const throwAt = async (p, x, y) => { await T(p, (a) => window.__play.throwAt(a.x, a.y), { x, y }); await until(async () => (await st(p)).phase !== 'fly', 3000); };

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, BASE);
    check('다트판 · TV · 오르골 · 벽난로를 방에 놓을 수 있음', await furnish(A));
    await T(A, () => window.__tree.setZoomMul(0)); await sleep(900);

    /* 다트 */
    const sp = await T(A, () => window.__tree.screenOf(-4 + 3.5 * 0.5, -4 + 0.5 * 0.5, 1.3));
    const m0 = await T(A, () => [window.__tree.me.x, window.__tree.me.z]);
    await A.touchscreen.tap(sp.x, sp.y);
    check('방에서 다트판을 누르면 그 앞으로 걸어가서 다트가 열림', await until(async () => (await mode(A)) === 'play' && (await st(A)) && (await st(A)).kind === 'dart', 15000));
    const m1 = await T(A, () => [window.__tree.me.x, window.__tree.me.z]);
    check('아바타가 다트판 앞에 서 있음', Math.hypot(m1[0] - m0[0], m1[1] - m0[1]) > 1 && Math.hypot(m1[0] - (-2.25), m1[1] - (-3.75)) < 1.6, m1);
    const vis = { p: await A.isVisible('#playP'), tabs: await A.isVisible('#tabs'), zin: await A.isVisible('#zin'), pov: await A.isVisible('#pov'), eye: await T(A, () => window.__play.posed && window.__tree.eyeOn && !window.__tree.meShown) };
    check('놀이 중에는 놀이 판만 보이고(탭·시점 단추 숨음) 1인칭 카메라로 봄', vis.p && !vis.tabs && !vis.zin && !vis.pov && vis.eye, vis);
    check('다트 판의 단추가 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    let s = await st(A);
    check('화살 3개, 0점에서 시작', s.left === 3 && s.score === 0 && s.phase === 'aim');
    await sleep(500);
    await A.screenshot({ path: path.join(__dirname, 'out', 'play-dart.png') });
    await throwAt(A, 0.01, 0.0);
    s = await st(A);
    check('한가운데에 맞으면 50점', s.last.pts === 50 && s.score === 50 && s.left === 2 && s.darts === 1 && (await A.textContent('#playMain')).includes('50점'), s);
    const pts = async (x, y) => { await T(A, () => window.__play.close()); await T(A, () => window.__play.open('dart')); await throwAt(A, x, y); return (await st(A)).last.pts; };
    const got = [await pts(0.03, 0), await pts(0, 0.1), await pts(0, 0.16), await pts(0, 0.265), await pts(0.1, 0), await pts(0, -0.1), await pts(-0.1, 0), await pts(0, 0.31)];
    check('진짜 다트판 점수: 가운데 둘레 25, 위 칸 20, 3배 칸 60, 2배 칸 40, 오른쪽 6 · 아래 3 · 왼쪽 11, 테두리는 0', JSON.stringify(got) === JSON.stringify([25, 20, 60, 40, 6, 3, 11, 0]), got);
    const all = await T(A, () => { const f = window.__play.dartScore, seen = new Set(); for (let k = 0; k < 20; k++) { const a = k * Math.PI / 10; seen.add(f(Math.sin(a) * 0.1, Math.cos(a) * 0.1).pts); } return { n: seen.size, max: f(0, 0.16).pts, out: f(0.3, 0.3).pts, miss: !!f(0.3, 0.3).miss }; });
    check('스무 칸의 숫자가 모두 다르고(1~20), 가장 큰 점수는 20의 3배', all.n === 20 && all.max === 60 && all.out === 0 && all.miss, all);
    await T(A, () => window.__play.close()); await T(A, () => window.__play.open('dart')); await sleep(300);
    await throwAt(A, 0.5, 0.1);
    check('판 밖으로 나간 화살은 0점이고 떨어져서 사라짐', (await st(A)).last.pts === 0 && (await st(A)).left === 2 && await until(async () => (await st(A)).darts === 0, 3000), await st(A));
    await T(A, () => window.__play.close()); await T(A, () => window.__play.open('dart')); await sleep(300);
    // 겨냥: 누른 채 움직이면 조준점이 따라오고(폰에서는 손가락보다 조금 위), 손을 떼면 그 근처에 꽂힌다
    const world = (x, y) => T(A, (a) => { const p = window.__play.boardPoint(a.x, a.y); return window.__tree.screenOf(p.x, p.z, p.y); }, { x, y });
    const t1 = await world(0.1, 0.12), t2 = await world(-0.08, -0.05);
    const cdp = await A.context().newCDPSession(A);
    const touch = (type, pt) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pt ? [{ x: Math.round(pt.x), y: Math.round(pt.y) + 56 }] : [] });
    await touch('touchStart', t1); await sleep(120);
    let aim = await T(A, () => window.__play.aim);
    check('판을 누르면 조준점이 그 자리(손가락 조금 위)로 옴', Math.hypot(aim.want[0] - 0.1, aim.want[1] - 0.12) < 0.03 && (await st(A)).phase === 'aim' && (await st(A)).darts === 0, aim);
    await touch('touchMove', t2); await sleep(120);
    aim = await T(A, () => window.__play.aim);
    check('누른 채 움직이면 조준점이 따라오고, 손이 떨리듯 조금 흔들림', Math.hypot(aim.want[0] + 0.08, aim.want[1] + 0.05) < 0.03 && Math.hypot(aim.now[0] - aim.want[0], aim.now[1] - aim.want[1]) < 0.09 && (await st(A)).darts === 0, aim);
    await touch('touchEnd');
    check('손을 떼면 겨냥한 자리 근처로 날아가 꽂힘', await until(async () => (await st(A)).left === 2, 3000) && Math.hypot((await st(A)).last.x + 0.08, (await st(A)).last.y + 0.05) < 0.1, await st(A));
    await A.tap('#playGo'); await until(async () => (await st(A)).left === 1, 3000);
    await throwAt(A, 0, 0);
    s = await st(A);
    check('세 개를 다 던지면 끝나고 합계와 내 최고 점수를 보여 줌', s.phase === 'done' && s.left === 0 && (await A.textContent('#playMain')).includes(`합계 ${s.score}점`) && (await A.textContent('#playSub')).includes('최고 점수') && (await A.textContent('#playGo')) === '다시 하기', s);
    const best = await T(A, () => JSON.parse(localStorage.getItem('nolja-tree-dart')));
    check('최고 점수가 기억됨', best >= s.score && best >= 50, best);
    await A.tap('#playGo'); await sleep(200);
    s = await st(A);
    check('"다시 하기"를 누르면 화살 3개로 새로 시작', s.left === 3 && s.score === 0 && s.darts === 0 && s.phase === 'aim');
    await A.tap('#playQuit'); await sleep(300);
    check('"그만하기"를 누르면 방으로 돌아옴 (탭이 다시 보이고 내 아바타가 보임)', (await mode(A)) === null && (await A.isVisible('#tabs')) && (await A.isVisible('#tools')) && !(await T(A, () => window.__play.on)) && (await T(A, () => window.__tree.meShown && !window.__tree.eyeOn)));

    /* 마시멜로 */
    await T(A, () => window.__play.open('fire')); await sleep(300);
    check('벽난로: 굽기 시작 전', (await st(A)).phase === 'idle' && (await st(A)).heat === 0 && (await audit(A)).length === 0);
    await A.tap('#playGo'); await sleep(900);
    const h1 = (await st(A)).heat;
    check('굽기 시작을 누르면 점점 익어 감', (await st(A)).phase === 'roast' && h1 > 0.08 && h1 < 0.4, h1);
    await A.screenshot({ path: path.join(__dirname, 'out', 'play-fire.png') });
    await T(A, () => { window.__play.setHeat(0.64); document.getElementById('playGo').click(); }); await sleep(200);
    s = await st(A);
    check('노릇노릇할 때 꺼내면 "완벽"과 높은 점수', s.phase === 'done' && s.pts >= 95 && s.say.includes('완벽') && (await A.textContent('#playMain')).includes('완벽'), s);
    check('구운 정도에 따라 말이 달라짐', await T(A, () => { const v = window.__play.verdict; return v(0.1)[0].includes('하얘') && v(0.5)[0].includes('덜 익') && v(0.9)[0].includes('조금 탔') && v(1.2)[0].includes('새까맣게') && v(1.2)[1] === 0 && v(0.66)[1] === 100; }));
    await A.tap('#playGo'); await sleep(100); await A.tap('#playGo');
    await T(A, () => window.__play.setHeat(1.25));
    check('너무 오래 두면 저절로 타서 끝남', await until(async () => (await st(A)).phase === 'done', 5000) && (await st(A)).say.includes('새까맣게'));
    await A.tap('#playQuit'); await sleep(200);

    /* TV */
    await T(A, () => window.__play.open('tv')); await sleep(500);
    check('TV: 동영상이 없으면 눈 내리는 밤이 나오고 "동영상 넣기" 단추가 보임', (await A.textContent('#playMain')).includes('눈 내리는 밤') && (await A.textContent('#playGo')) === '동영상 넣기' && !(await A.isVisible('#playSound')) && (await audit(A)).length === 0, await audit(A));
    const px0 = await T(A, () => window.__play.pixel(20, 20));
    check('TV 화면에 밤하늘이 그려짐', px0[2] > px0[0] + 20, px0);
    const tvs = await T(A, () => { const W = window.__tree, r = []; for (const [dx, dy] of [[-0.59, 0.33], [0.59, -0.33]]) r.push(W.screenOf(-4 + 0.25, -4 + 10.5 * 0.5 - dx, 0.87 + dy)); return r; });
    check('TV 화면 전체가 놀이 판에 가리지 않고 화면 안에 들어옴', tvs.every((q) => q.x >= 0 && q.x <= 375 && q.y >= 50) && Math.max(...tvs.map((q) => q.y)) < (await A.evaluate(() => document.getElementById('playP').getBoundingClientRect().top)), tvs);
    // 빨간 화면이 나오는 짧은 동영상을 만들어 넣는다
    const b64 = await A.evaluate(() => new Promise((ok, no) => {
      const c = document.createElement('canvas'); c.width = 96; c.height = 54;
      const g = c.getContext('2d'); let k = 0;
      const paint = () => { g.fillStyle = '#E01010'; g.fillRect(0, 0, 96, 54); g.fillStyle = '#fff'; g.fillRect(k++ % 90, 20, 6, 6); };
      paint(); const iv = setInterval(paint, 40);
      const rec = new MediaRecorder(c.captureStream(25), { mimeType: 'video/webm' }), parts = [];
      rec.ondataavailable = (e) => parts.push(e.data);
      rec.onstop = () => { clearInterval(iv); const fr = new FileReader(); fr.onload = () => ok(fr.result.split(',')[1]); fr.onerror = no; fr.readAsDataURL(new Blob(parts, { type: 'video/webm' })); };
      rec.start(); setTimeout(() => rec.stop(), 900);
    }));
    await A.setInputFiles('#tvFile', { name: 'clip.webm', mimeType: 'video/webm', buffer: Buffer.from(b64, 'base64') });
    check('동영상 파일을 고르면 TV 에서 재생됨', await until(async () => { const v = await T(A, () => window.__play.video); return v && v.ready >= 2 && v.w === 96 && !v.paused; }, 10000), await T(A, () => window.__play.video));
    check('TV 화면에 넣은 동영상(빨간 화면)이 나옴', await until(async () => { const c = await T(A, () => window.__play.pixel(240, 200)); return c[0] > 150 && c[1] < 90 && c[2] < 90; }, 6000), await T(A, () => window.__play.pixel(240, 200)));
    check('동영상을 넣으면 소리 · 빼기 단추가 생기고 처음에는 소리가 꺼져 있음', (await A.textContent('#playGo')) === '다른 동영상' && (await A.isVisible('#playSound')) && (await A.isVisible('#playDrop')) && (await T(A, () => window.__play.video.muted)) && (await audit(A)).length === 0, await audit(A));
    await A.tap('#playSound'); await sleep(150);
    check('소리 켜기를 누르면 소리가 켜짐', !(await T(A, () => window.__play.video.muted)) && (await A.textContent('#playSound')).includes('소리 끄기'));
    await A.screenshot({ path: path.join(__dirname, 'out', 'play-tv.png') });
    await A.tap('#playQuit'); await sleep(300);
    check('그만 보면 소리는 꺼지고 화면은 방에서 계속 나옴', (await T(A, () => window.__play.video.muted)) && !(await T(A, () => window.__play.video.paused)) && await until(async () => { const c = await T(A, () => window.__play.pixel(240, 200)); return c[0] > 150 && c[1] < 90; }, 3000));
    await sleep(600);
    await A.reload(); await ready(A);
    check('다시 열어도 넣어 둔 동영상이 계속 나옴', await until(async () => { const v = await T(A, () => window.__play.video); return v && v.ready >= 2 && !v.paused && v.muted; }, 10000) && await until(async () => { const c = await T(A, () => window.__play.pixel(240, 200)); return c[0] > 150 && c[1] < 90; }, 5000), await T(A, () => window.__play.video));
    await T(A, () => window.__play.open('tv')); await sleep(300);
    await A.tap('#playDrop'); await sleep(400);
    check('"빼기"를 누르면 다시 눈 내리는 밤', !(await T(A, () => window.__play.video)) && (await A.textContent('#playGo')) === '동영상 넣기' && await until(async () => { const c = await T(A, () => window.__play.pixel(20, 20)); return c[2] > c[0] + 20; }, 3000));
    await A.tap('#playQuit');
    await A.reload(); await ready(A);
    await sleep(500);
    check('뺀 뒤에는 다시 열어도 동영상이 없음', !(await T(A, () => window.__play.video)));

    /* 오르골 */
    await T(A, () => window.__play.open('music')); await sleep(300);
    check('오르골: 캐럴 세 곡을 고를 수 있고, 내려다보는 시점 그대로', (await A.locator('#playBtns .chip').count()) === 3 && !(await T(A, () => window.__play.posed)) && (await audit(A)).length === 0, await audit(A));
    await A.tap('#song-jingle'); await sleep(500);
    check('곡을 누르면 캐럴이 나옴', (await T(A, () => window.__play.song)) === 'jingle' && (await T(A, () => window.__play.audio)) === 'running' && (await A.getAttribute('#song-jingle', 'aria-pressed')) === 'true' && (await A.textContent('#playMain')).includes('징글벨'), { s: await T(A, () => window.__play.song), a: await T(A, () => window.__play.audio) });
    await A.tap('#song-silent'); await sleep(200);
    check('다른 곡으로 바꿀 수 있음', (await T(A, () => window.__play.song)) === 'silent');
    await A.tap('#playQuit'); await sleep(300);
    check('판을 닫아도 캐럴은 계속 나옴', (await mode(A)) === null && (await T(A, () => window.__play.song)) === 'silent' && errors.length === 0);
    await T(A, () => window.__play.open('music')); await sleep(200);
    await A.tap('#playOff'); await sleep(200);
    check('"끄기"를 누르면 꺼짐', (await T(A, () => window.__play.song)) === null && !(await A.isVisible('#playOff')));
    await A.tap('#playQuit');

    /* 1인칭에서 놀고 돌아오기 */
    await A.tap('#pov'); await sleep(200);
    await T(A, () => window.__play.open('dart')); await sleep(300);
    await T(A, () => window.__play.close()); await sleep(200);
    check('1인칭에서 놀고 나오면 다시 1인칭', await T(A, () => window.__tree.pov === 'fp' && window.__tree.eyeOn && !window.__play.posed) && (await A.isVisible('#stick')));
    await A.tap('#pov');
    // 놀던 가구를 치우면 놀이가 닫힌다
    await T(A, () => window.__play.open('fire')); await sleep(200);
    await T(A, () => window.__tree.dispatch({ t: 'del', id: 'fire' })); await sleep(200);
    check('놀던 가구가 사라지면 놀이가 닫힘', (await mode(A)) === null && !(await T(A, () => window.__play.on)) && errors.length === 0, errors);
    await ctx.close();

    /* 친구에게 전해지는 것 (같은 브라우저 안 통신) */
    const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const P = await open(ctx2, `${BASE}?net=bc&door=0&ns=pa`);
    await furnish(P);
    await T(P, () => window.__duo.invite());
    await until(async () => (await T(P, () => window.__duo.mode)) === 'waiting');
    const room = (await T(P, () => window.__duo.inviteUrl())).split('#r=')[1]; // 방이름-열쇠 (열쇠가 있어야 같이 꾸밀 수 있다)
    const Q = await open(ctx2, `${BASE}?net=bc&door=0&ns=pb#r=${room}`);
    await until(async () => (await T(P, () => window.__duo.mode)) === 'on' && (await T(Q, () => window.__duo.mode)) === 'on', 15000);
    await sleep(500);
    await T(P, () => window.__play.open('music')); await P.tap('#song-wish');
    check('내가 튼 캐럴이 친구에게도 나옴', await until(async () => (await T(Q, () => window.__play.song)) === 'wish', 4000) && (await Q.textContent('#toast')).includes('캐럴'));
    await P.tap('#playOff');
    check('내가 끄면 친구 쪽도 꺼짐', await until(async () => (await T(Q, () => window.__play.song)) === null, 4000));
    await T(P, () => window.__play.open('dart'));
    for (const x of [0, 0.08, 0.3]) await throwAt(P, x, 0);
    check('다트 점수가 친구에게 알려짐', await until(async () => (await Q.textContent('#toast')).includes('다트에서 56점'), 4000), await Q.textContent('#toast'));
    await T(Q, () => window.__tree.dispatch({ t: 'del', id: 'dart' }));
    check('내가 놀던 가구를 친구가 치우면 놀이가 닫힘', await until(async () => (await mode(P)) === null && !(await T(P, () => window.__play.on)), 4000));
    check('이상한 놀이 소식이 와도 버팀', await T(Q, () => { for (const m of [null, {}, { k: 5 }, { k: 'dart', v: 'x' }, { k: 'music', v: 7 }, { k: 'music', v: 'nope' }, { k: 'zzz', v: 1 }, { k: 'dart', v: 1e9 }]) window.__play.peerFx(m); return window.__play.song === null; }) && errors.length === 0);
    await ctx2.close();

    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
