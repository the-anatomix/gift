// 눈싸움 팀전 검사 (팀전 단추, 팀 나누기, 카운트다운, 팀 색 표시, 점수판, 같은 팀·상대 팀 맞히기, 결과 띠와 환호,
// 판 중에 들어온 사람, 시작한 사람이 나가면 취소, 이상한 소식). 실행: cd tree/tests && node snowteam.test.js
// 한 판은 ?tm=20 으로 20초로 줄여서 본다 (평소 90초).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8195, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__snow && window.__tree.frames > 3)), 20000);
const Q = '?net=bc&door=0&tm=20&st=4000';
async function open(ctx, url) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; });
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
const overlaps = (p, ids) => p.evaluate((ids) => {
  const box = (id) => { const e = document.getElementById(id); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; return e.getBoundingClientRect(); };
  const out = [];
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const r = box(ids[a]), q = box(ids[b]);
    if (r && q && r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom) out.push(ids[a] + '×' + ids[b]);
  }
  return out;
}, ids);
const stand = (p, x, z) => T(p, ([x, z]) => { const t = window.__tree; t.me.stop(); t.me.place(x, z); t.snapView(); }, [x, z]);
const TM = (p) => T(p, () => { const t = window.__snow.team; return { on: t.on, live: t.live, ended: t.ended, lead: t.lead, mid: t.mid, red: t.red, green: t.green, score: t.score, board: t.board, result: t.result, sub: t.resultSub, count: t.count, btn: t.btn }; });
const idle = (p) => until(() => T(p, () => window.__snow.balls === 0 && window.__snow.ready), 4000);

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const A = await open(ctx, `${BASE}${Q}&ns=ta`);
    await stand(A, 1.5, 8.5); await sleep(300);
    await T(A, () => window.__snow.set(true)); await sleep(300);
    check('혼자일 때는 눈싸움 모드를 켜도 팀전 단추가 없음', !(await A.isVisible('#teamBtn')) && (await T(A, () => window.__snow.team.start())) === false);

    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}${Q}&ns=tb#r=${room}`);
    const C = await open(ctx, `${BASE}${Q}&ns=tc#v=${rid}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    const bid = await T(B, () => window.__duo.me), cid = await T(C, () => window.__duo.me);
    await stand(A, 1.5, 8.5); await stand(B, 4.5, 8.5); await stand(C, 7.5, 6.5); await sleep(400);
    await T(A, () => window.__snow.set(true));
    check('2명 이상 접속하고 눈싸움 모드를 켜면 "⚔️ 팀전" 단추가 보임', await until(() => A.isVisible('#teamBtn'), 2000) && (await A.textContent('#teamBtn')).includes('팀전'));
    check('눈싸움 모드를 켜지 않은 사람에게는 팀전 단추가 없음', !(await B.isVisible('#teamBtn')));
    const box = await T(A, () => { const r = document.getElementById('teamBtn').getBoundingClientRect(), b = document.getElementById('bottom').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, bt: b.top }; });
    check('팀전 단추: 44px 이상, 왼쪽 끝(#act 자리 밖), 아래 판 위, 다른 단추와 안 겹침', box.w >= 44 && box.h >= 44 && box.l >= 0 && box.r <= 75 && box.b <= box.bt && (await overlaps(A, ['teamBtn', 'snowBtn', 'snowScore', 'rollBtn', 'act', 'stick'])).length === 0 && (await audit(A)).length === 0, [box, await overlaps(A, ['teamBtn', 'snowBtn', 'snowScore', 'rollBtn', 'act']), await audit(A)]);
    await A.screenshot({ path: path.join(__dirname, 'out', 'snowteam-btn.png') });

    /* 시작 */
    await A.tap('#teamBtn');
    const tA = await TM(A);
    check('누르면 판이 시작되고 3초를 셈', tA.on && !tA.live && tA.lead === 'h' && ['3', '2'].includes(tA.count), tA);
    const all = ['h', bid, cid].sort();
    check('접속한 셋을 빨강·초록으로 번갈아 나눔 (2 : 1, 빠진 사람 없음)', [tA.red.length, tA.green.length].sort().join() === '1,2' && [...tA.red, ...tA.green].sort().join() === all.join(), tA);
    check('모든 화면에서 같은 판, 같은 팀 (구경하는 사람 포함)', await until(async () => { const b = await TM(B), c = await TM(C); return b.mid === tA.mid && c.mid === tA.mid && b.red.join() === tA.red.join() && c.green.join() === tA.green.join() && b.lead === 'h' && c.lead === 'h'; }, 3000));
    check('친구 화면에도 카운트다운과 점수판, 눈싸움 모드가 저절로 켜짐', await until(async () => (await TM(B)).count !== '' && (await TM(C)).board.includes('🔴 0 : 0 🟢') && (await T(B, () => window.__snow.on)) && (await T(C, () => window.__snow.on)), 3000), [await TM(B), await TM(C)]);
    check('판 중에는 팀전 단추가 숨음', !(await A.isVisible('#teamBtn')));
    const teamOf = (id) => (tA.red.includes(id) ? 'r' : 'g');
    check('모두의 화면에서 머리 위에 팀 색 띠가 보임', await until(async () => {
      for (const [p, mine] of [[A, 'h'], [B, bid], [C, cid]]) for (const id of all) if ((await T(p, ([id, mine]) => window.__snow.team.band(id === mine ? window.__duo.me : id), [id, mine])) !== teamOf(id)) return false;
      return true;
    }, 3000));
    await sleep(300);
    await B.screenshot({ path: path.join(__dirname, 'out', 'snowteam-count.png') });
    check('3초 뒤 "시작!" 과 함께 점수를 세기 시작', await until(async () => (await TM(A)).live && (await TM(B)).live, 5000));
    check('점수판은 "🔴 0 : 0 🟢 · 0:20" 꼴 (남은 시간)', /^🔴 0 : 0 🟢 · 0:(20|1\d)$/.test((await TM(A)).board), (await TM(A)).board);

    /* 맞히기 */
    const pages = { h: A, [bid]: B, [cid]: C };
    const pair = (same) => { for (const x of all) for (const y of all) if (x !== y && (teamOf(x) === teamOf(y)) === same) return [x, y]; return null; };
    const [hx, hy] = pair(false);
    const spot = { [hx]: [1.5, 8.5], [hy]: [4.5, 8.5] };
    const third = all.find((id) => id !== hx && id !== hy);
    spot[third] = [8.5, 6.0];
    for (const id of all) await stand(pages[id], ...spot[id]);
    const seen = (p, id, x, z) => until(() => T(p, ([id, x, z]) => { const o = window.__duo.others.find((q) => q.id === id); return o && Math.abs(o.x - x) < 0.05 && Math.abs(o.z - z) < 0.05; }, [id, x, z]), 5000);
    for (const id of all) for (const o of all) if (id !== o) await seen(pages[id], o === 'h' ? 'h' : o, ...spot[o]);
    await sleep(300);
    await T(pages[hx], ([x, z]) => window.__snow.throwAt(x, z), spot[hy]);
    const ti = teamOf(hx) === 'r' ? 0 : 1;
    check('상대 팀을 맞히면 그 팀 +1 (던진 사람 화면에 "팀 +1!")', await until(async () => (await TM(pages[hx])).score[ti] === 1 && (await pages[hx].textContent('#toast')).includes('팀 +1'), 3000), [await TM(pages[hx]), await pages[hx].textContent('#toast')]);
    check('점수는 모두의 화면에서 같음', await until(async () => { const s = [await TM(A), await TM(B), await TM(C)].map((t) => t.score.join()); return s.every((x) => x === s[0]) && s[0] === (ti ? '0,1' : '1,0'); }, 3000));
    check('점수판에 바로 보임', (await TM(C)).board.includes(ti ? '🔴 0 : 1 🟢' : '🔴 1 : 0 🟢'), (await TM(C)).board);
    await idle(pages[hx]);
    // 같은 팀끼리: 눈은 뒤집어쓰지만 점수는 없다
    const [sx, sy] = pair(true);
    await stand(pages[sx], 1.5, 6.5); await stand(pages[sy], 3.5, 6.5);
    for (const id of all) if (id !== sx) await seen(pages[id], sx, 1.5, 6.5);
    for (const id of all) if (id !== sy) await seen(pages[id], sy, 3.5, 6.5);
    await sleep(300);
    const before = (await TM(A)).score.join();
    await T(pages[sx], () => window.__snow.throwAt(3.5, 6.5));
    check('같은 팀을 맞히면 점수는 없고 "같은 팀이에요!", 눈은 뒤집어씀', await until(async () => (await pages[sx].textContent('#toast')).includes('같은 팀') && (await T(pages[sy], () => window.__snow.snowy('me'))), 3000) && (await TM(A)).score.join() === before && (await TM(B)).score.join() === before, [await TM(A), await pages[sx].textContent('#toast')]);
    check('팀전 중에도 내가 맞힌 횟수(개인)는 그대로 셈', (await T(pages[hx], () => window.__snow.hits)) >= 1);
    await A.screenshot({ path: path.join(__dirname, 'out', 'snowteam-live.png') });

    /* 끝 */
    const win = ti ? 'g' : 'r', winName = ti ? '초록' : '빨강';
    check('시간이 다 되면 모두의 화면에 같은 결과 띠 ("○○ 팀 승리! 1 : 0")', await until(async () => {
      const r = [await TM(A), await TM(B), await TM(C)].map((t) => t.result);
      return r.every((x) => x === r[0]) && r[0].includes(`${winName} 팀 승리! ${ti ? '0 : 1' : '1 : 0'}`);
    }, 30000), [await TM(A), await TM(B), await TM(C)].map((t) => t.result));
    check('점수판에 "끝"', (await TM(B)).board.includes('끝'));
    const winners = all.filter((id) => teamOf(id) === win), losers = all.filter((id) => teamOf(id) !== win);
    check('이긴 팀은 모두의 화면에서 만세(환호)를 함', await until(async () => {
      for (const p of [A, B, C]) {
        const me = await T(p, () => window.__duo.me), acts = await T(p, () => Object.fromEntries([...window.__duo.others.map((o) => [o.id, o.acting]), [window.__duo.me, window.__tree.me.acting]]));
        for (const id of winners) if (acts[id] !== 'cheer') return false;
        for (const id of losers) if (acts[id] === 'cheer') return false;
        void me;
      }
      return true;
    }, 3000));
    await C.screenshot({ path: path.join(__dirname, 'out', 'snowteam-result.png') });
    check('결과 띠 아랫줄에 내 팀 이야기 (이긴 팀 "우리 팀이 이겼어요!", 진 팀 "다음 판에서 이겨 봐요!")', (await TM(pages[winners[0]])).sub.includes('우리 팀이 이겼어요') && (await TM(pages[losers[0]])).sub.includes('다음 판에서'));
    check('몇 초 뒤 점수판·결과 띠·팀 색 띠가 사라짐', await until(async () => !(await TM(A)).on && !(await TM(A)).board && !(await TM(C)).result && (await T(B, (id) => window.__snow.team.band(id), 'h')) === null && (await T(A, () => window.__snow.team.band('h'))) === null, 9000));
    // 팀전이 아니면 예전처럼 "명중!"
    await idle(pages[hx]);
    await stand(pages[hy], 4.5, 8.5); await stand(pages[hx], 1.5, 8.5);
    for (const id of all) if (id !== hy) await seen(pages[id], hy, 4.5, 8.5);
    await sleep(800);
    await T(pages[hx], () => window.__snow.throwAt(4.5, 8.5));
    check('판이 끝나면 다시 개인 눈싸움 ("명중! ❄️", 점수판 없음)', await until(async () => (await pages[hx].textContent('#toast')).includes('명중'), 3000) && !(await TM(pages[hx])).board, await pages[hx].textContent('#toast'));

    /* 손님이 시작, 판 중에 들어온 사람은 구경, 시작한 사람이 나가면 취소 */
    await stand(B, 4.5, 7.5); await sleep(300);
    await T(B, () => window.__snow.set(true));
    check('손님(꾸미는 사람)도 팀전을 시작할 수 있음', await until(() => B.isVisible('#teamBtn'), 2000) && (await B.tap('#teamBtn'), await until(async () => (await TM(A)).on && (await TM(A)).lead === bid && (await TM(C)).lead === bid, 3000)));
    const D = await open(ctx, `${BASE}${Q}&ns=td#v=${rid}`);
    await until(async () => (await T(D, () => window.__duo.others)).length === 3, 20000);
    const did = await T(D, () => window.__duo.me);
    check('판 중에 들어온 사람에게도 점수판이 보이고, 그 사람은 팀이 없음(구경)', await until(async () => { const d = await TM(D); return d.on && d.mid === (await TM(A)).mid && d.board.includes('🔴') && ![...d.red, ...d.green].includes(did); }, 6000), await TM(D));
    await B.close();
    check('시작한 사람이 나가면 모두의 화면에서 판이 취소됨', await until(async () => !(await TM(A)).on && !(await TM(C)).on && !(await TM(D)).on && !(await TM(A)).board, 9000), [await TM(A), await TM(D)]);
    check('취소 알림', (await A.textContent('#toast')).includes('취소') || (await C.textContent('#toast')).includes('취소') || (await D.textContent('#toast')).includes('취소'));

    /* 이상한 소식 */
    await T(C, () => { for (const m of [
      { t: 'fx', id: 'h', k: 'team', v: 'g,abc' }, { t: 'fx', id: 'h', k: 'team', v: 'g,mmmmmm,3000,zz,yy' }, { t: 'fx', id: 'h', k: 'team', v: 'g,mmmmmm,3000,h,h' },
      { t: 'fx', id: 'h', k: 'team', v: 'g,mmmmmm,3000,h,' }, { t: 'fx', id: 'h', k: 'team', v: 'g,mm,3000,h,g1' }, { t: 'fx', id: 'h', k: 'team', v: 's,mmmmmm,5,5' },
      { t: 'fx', id: 'h', k: 'team', v: 'e,mmmmmm,1,1' }, { t: 'fx', id: 'h', k: 'team', v: 'g,mmmmmm,abc,h,g1' }, { t: 'fx', id: 'h', k: 'team', v: 7 }, { t: 'fx', id: 'h', k: 'team', v: 'g'.repeat(300) },
      { t: 'fx', id: 'h', k: 'team', v: 'g,mmmmmm,3000,<b>,h' },
    ]) window.__duo.feed(m); });
    await sleep(300);
    check('이상한 팀전 소식이 와도 버팀 (판이 열리지 않음)', !(await TM(C)).on && !(await TM(C)).board);
    check('화면의 단추가 모두 44px 이상·화면 안', (await audit(A)).length === 0 && (await audit(C)).length === 0, [await audit(A), await audit(C)]);
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
