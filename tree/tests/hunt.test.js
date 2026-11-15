// 같이 놀기 · 선물 찾기 검사 (혼자: 고르기 판, 숨긴 자리, 걸어가 줍기, 다른 층, 결과와 최고 기록, 시간 끝 / 여럿: 같은 자리, 먼저 주운 사람, 도중에 온 사람, 순위).
// 실행: cd tree/tests && node hunt.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8234, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__games && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
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
const stand = (p, x, z) => T(p, ([x, z]) => { const t = window.__tree; t.me.stop(); t.me.place(x, z); t.snapView(); }, [x, z]);
const G = (p) => T(p, () => window.__games.state);
const band = (p) => T(p, () => window.__games.band);
const skip = (p, ms) => T(p, (ms) => { window.__skip += ms; }, ms);
const shot = (p, n) => p.screenshot({ path: path.join(__dirname, 'out', n) });
const toastOf = (p) => T(p, () => document.getElementById('toast').textContent);
// 자리 (x, z) 가 어디인지: 층(f0~f3)이나 마당
const areaOf = (p, x, z) => T(p, ([x, z]) => { const t = window.__tree, lv = Math.max(0, Math.min(3, Math.floor((x - t.box.x0) / t.CELL / 32))); if (lv) return 'f' + lv; return z > t.box.z1 ? 'yard' : 'f0'; }, [x, z]);

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ua`);

    /* 혼자: 고르기 판 */
    await A.tap('#gameBtn'); await sleep(200);
    const pk = await T(A, () => { const h = document.querySelector('#gamePick [data-g="hunt"]'); return h && { dis: h.disabled, txt: document.getElementById('gamePick').textContent, why: document.getElementById('gamePickWhy').textContent }; });
    check('놀이 고르기 판에 "🎁 선물 찾기 · 혼자서도 · 같이도"', !!pk && pk.txt.includes('선물 찾기 · 혼자서도 · 같이도'), pk);
    check('혼자여도 선물 찾기는 고를 수 있고 안내가 나옴', !!pk && !pk.dis && pk.why.includes('혼자서도'), pk);
    check('고르기 판 단추가 44px 이상·화면 안', (await audit(A)).length === 0, await audit(A));
    await shot(A, 'hunt-pick.png');
    await T(A, () => document.querySelector('#gamePick [data-g="hunt"]').click());
    let g = await G(A);
    check('고르면 바로 시작: 심판은 나, 선물 8개, 3분', !!g && g.g === 'hunt' && g.ref === 'h' && g.ph === 'play' && g.sp.length === 8 && g.got.every((x) => x === '') && g.left > 175000 && g.left <= 180000, g);
    const areas = g ? await Promise.all(g.sp.map(([x, z]) => areaOf(A, x, z))) : [];
    check('선물이 여러 곳에 고루 숨음 (1~4층·마당 가운데 네 곳 이상)', new Set(areas).size >= 4, areas);
    const spotOk = await T(A, (sp) => { const t = window.__tree; return sp.every(([x, z]) => t.grid.freeAt(x, z)); }, g.sp);
    check('선물은 모두 걸어서 설 수 있는 빈칸에', spotOk);
    let far = Infinity;
    for (let a = 0; a < g.sp.length; a++) for (let b = a + 1; b < g.sp.length; b++) far = Math.min(far, Math.hypot(g.sp[a][0] - g.sp[b][0], g.sp[a][1] - g.sp[b][1]));
    check('선물끼리 서로 떨어져 있음 (2.2 이상)', far >= 2.2, far);
    let bd = await band(A);
    check('상태 띠: "🎁 선물 찾기", 남은 시간, 층마다 남은 선물 수', !!bd && bd.name.includes('선물 찾기') && /^[23]:\d\d · /.test(bd.clock) && bd.clock.includes('내 선물 0개') && bd.role.includes('남은 선물') && bd.role.includes('📍1층'), bd);
    check('시작 알림 "집 곳곳에 숨은 선물 8개를 찾아요!"', (await toastOf(A)).includes('숨은 선물 8개'));
    let gs = await T(A, () => window.__games.gifts());
    const lv0 = gs.filter((v) => areas[v.n] === 'f0' || areas[v.n] === 'yard'), up = gs.filter((v) => areas[v.n] !== 'f0' && areas[v.n] !== 'yard');
    check('선물 모양이 8개, 내가 있는 층(1층·마당)의 것만 보임', gs.length === 8 && lv0.every((v) => v.shown) && up.every((v) => !v.shown), gs);
    await sleep(400);
    await shot(A, 'hunt-play.png');

    /* 누르면 그 선물로 걸어간다 */
    const near = lv0[0];
    if (near) {
      await T(A, () => window.__tree.snapView());
      const pt = await T(A, ([x, z]) => window.__tree.screenOf(x, z, 0.14), [near.x, near.z]);
      const tapped = await T(A, ([x, y]) => window.__games.tap(x, y), [pt.x, pt.y]);
      await sleep(300);
      const moving = await T(A, () => { const m = window.__tree.me; return !!(m.path && m.path.length) || !!m.moving; });
      check('보이는 선물을 누르면 그리로 걸어감', tapped === true, { tapped, moving, pt });
      await T(A, () => window.__tree.me.stop());
    }

    /* 걸어가 닿으면 줍는다 */
    const n0 = lv0[0] ? lv0[0].n : 0;
    await stand(A, g.sp[n0][0], g.sp[n0][1]);
    check('선물 자리에 서면 주움', await until(async () => (await G(A)).got[n0] === 'h', 3000));
    check('주우면 알림 "찾았다!" 와 상자 여는 소리', (await toastOf(A)).includes('찾았다') && (await T(A, () => window.__sfx ? window.__sfx.heard('giftOpen') : 1)) > 0);
    check('주운 선물은 톡 튀어 오르고 사라짐', await until(async () => !(await T(A, () => window.__games.gifts())).some((v) => v.n === n0), 2000));
    bd = await band(A);
    check('띠의 내 선물 수가 늘어남', bd.clock.includes('내 선물 1개'), bd);
    const bw = await T(A, () => { const e = document.querySelector('#gameBand small'); return { sw: e.scrollWidth, cw: e.clientWidth }; });
    check('폰에서 띠의 남은 선물 글이 잘리지 않음', bw.sw <= bw.cw + 1, bw);

    /* 다른 층의 선물: 그 층에 가면 보이고 주울 수 있다 */
    const nu = g.sp.findIndex((p, n) => areas[n] !== 'f0' && areas[n] !== 'yard');
    if (nu >= 0) {
      await stand(A, g.sp[nu][0] + 0.9, g.sp[nu][1]);
      await sleep(400);
      const vis = (await T(A, () => window.__games.gifts())).find((v) => v.n === nu);
      check(`다른 층(${areas[nu]})에 가면 그 층의 선물이 보임`, !!vis && vis.shown, vis);
      await stand(A, g.sp[nu][0], g.sp[nu][1]);
      check('다른 층의 선물도 서면 주움', await until(async () => (await G(A)).got[nu] === 'h', 3000));
    }

    /* 나머지를 모두 줍기 → 결과와 첫 기록 */
    await skip(A, 40000); // 40초 걸렸다고 치기
    for (let n = 0; n < g.sp.length; n++) {
      if ((await G(A)) && (await G(A)).got[n]) continue;
      await stand(A, g.sp[n][0], g.sp[n][1]);
      await until(async () => { const s = await G(A); return !s || s.got[n]; }, 3000);
    }
    let res = await until(() => T(A, () => window.__games.result), 3000);
    check('다 찾으면 결과 판: "선물 8개를 다 찾았어요!"·걸린 시간·첫 기록', !!res && res.main.includes('8개를 다 찾았어요') && /걸린 시간 0:4\d/.test(res.sub) && res.sub.includes('첫 기록'), res);
    check('판이 끝나면 선물·상태 띠가 사라짐', !(await G(A)) && !(await band(A)) && (await T(A, () => window.__games.gifts())).length === 0);
    const best = await T(A, () => window.__games.best);
    check('최고 기록이 이 기기에 남음', best >= 40000 && best < 50000, best);
    await shot(A, 'hunt-result.png');
    await T(A, () => window.__games.closeEnd());

    /* 시간이 끝나면 */
    await T(A, () => window.__games.start('hunt'));
    check('다시 시작할 수 있음', (await G(A)).ph === 'play');
    await skip(A, 181000);
    res = await until(() => T(A, () => window.__games.result), 3000);
    check('3분이 지나면 끝: "선물 0/8개 찾았어요"·"시간이 끝났어요"', !!res && res.main.includes('0/8') && res.sub.includes('시간이 끝났어요'), res);
    await T(A, () => window.__games.closeEnd());

    /* 다시 다 찾으면: 더 느리면 최고 기록은 그대로 */
    await T(A, () => window.__games.start('hunt'));
    g = await G(A);
    await skip(A, 90000);
    for (let n = 0; n < g.sp.length; n++) { await stand(A, g.sp[n][0], g.sp[n][1]); await until(async () => { const s = await G(A); return !s || s.got[n]; }, 3000); }
    res = await until(() => T(A, () => window.__games.result), 3000);
    check('더 느리면 "내 최고 기록은 …" (기록은 그대로)', !!res && res.sub.includes('내 최고 기록은 0:4') && (await T(A, () => window.__games.best)) === best, res);
    await T(A, () => window.__games.closeEnd());
    await stand(A, 1.5, 2);

    /* 여럿: A 방장, B 꾸미기, C 구경 */
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=ub#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=uc#v=${rid}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    const bid = await T(B, () => window.__duo.me), cid = await T(C, () => window.__duo.me);
    await T(C, () => document.getElementById('gameBtn').click());
    check('구경하는 사람은 선물 찾기를 시작할 수 없음 (꾸밀 수 있는 사람이 시작)', await T(C, () => document.querySelector('#gamePick [data-g="hunt"]').disabled));
    await T(C, () => document.getElementById('gamePickClose').click());
    await stand(B, 1.5, 2.6); await stand(C, 2.2, 2.6);
    await T(A, () => window.__games.start('hunt'));
    g = await G(A);
    check('셋이면 모두가 명단에, 모두에게 같은 자리', g.pl.length === 3 && await until(async () => { const b = await G(B), c = await G(C); return b && c && b.gid === g.gid && JSON.stringify(b.sp) === JSON.stringify(g.sp) && JSON.stringify(c.sp) === JSON.stringify(g.sp); }, 3000), g);
    check('친구 화면에도 선물 모양', await until(async () => (await T(B, () => window.__games.gifts())).length === 8, 3000));
    // B 가 한 개 줍는다
    await stand(B, g.sp[0][0], g.sp[0][1]);
    check('친구가 서면 그 친구가 주움 (심판이 받아들임)', await until(async () => (await G(A)).got[0] === bid, 4000));
    check('모두에게 그 선물이 사라짐', await until(async () => !(await T(A, () => window.__games.gifts())).some((v) => v.n === 0) && !(await T(C, () => window.__games.gifts())).some((v) => v.n === 0), 3000));
    check('다른 사람에게 "…가 선물을 찾았어요" 알림', (await toastOf(A)).includes('선물을 찾았어요'));
    // 이미 주운 것은 다시 못 줍는다 (같은 자리에 A 가 서도)
    await stand(A, g.sp[0][0], g.sp[0][1]); await sleep(600);
    check('이미 주운 선물은 다른 사람이 못 줍는다', (await G(A)).got[0] === bid);
    // 심판이 받지 않는 소식
    check('규칙에 어긋난 줍기는 받아들이지 않음 (없는 번호·남의 판·주운 것·방에 없는 사람)', await T(A, ([gid, bid]) => { const s = () => JSON.stringify(window.__games.state.got); const h = s();
      const bad = [[{ a: 'grab', gid, n: 99 }, bid], [{ a: 'grab', gid, n: -1 }, bid], [{ a: 'grab', gid, n: 'x' }, bid], [{ a: 'grab', gid: 'nope', n: 1 }, bid], [{ a: 'grab', gid, n: 0 }, 'h'], [{ a: 'grab', gid, n: 2 }, 'zz9'], [{ a: 'grab', gid, n: 2.5 }, bid]];
      for (const [m, f] of bad) window.__games.peer(m, f); return h === s(); }, [g.gid, bid]));
    // C(구경하는 사람, 명단에 있음)도 줍는다
    await stand(C, g.sp[1][0], g.sp[1][1]);
    check('구경으로 들어온 사람도 같이 주울 수 있음', await until(async () => (await G(A)).got[1] === cid, 4000));
    // 나머지는 A 가 줍는다 → A 1등
    for (let n = 2; n < g.sp.length; n++) { await stand(A, g.sp[n][0], g.sp[n][1]); await until(async () => { const s = await G(A); return !s || s.got[n]; }, 3000); }
    const rs = await Promise.all([A, B, C].map((p) => until(() => T(p, () => window.__games.result), 4000)));
    check('다 주우면 모두에게 결과: 1등과 순위', rs.every((r) => r && r.main.includes('1등') && r.sub.includes('🥇') && r.sub.includes('6개')), rs);
    check('1등에게 "이겼어요!", 다른 사람에게는 내가 찾은 수', rs[0].sub.includes('이겼어요') && rs[1].sub.includes('나는 1개') && rs[2].sub.includes('나는 1개'), rs);
    await shot(B, 'hunt-rank.png');
    for (const p of [A, B, C]) await T(p, () => window.__games.closeEnd());

    /* 도중에 온 사람 */
    await T(A, () => window.__games.start('hunt'));
    g = await G(A);
    const D = await open(ctx, `${BASE}?net=bc&door=0&ns=ud#r=${room}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 4, 20000);
    const did = await T(D, () => window.__duo.me);
    check('도중에 온 사람도 판을 받음', await until(async () => { const d = await G(D); return d && d.gid === g.gid; }, 6000));
    await stand(D, g.sp[0][0], g.sp[0][1]);
    check('도중에 온 사람이 주우면 명단에 들어감', await until(async () => { const s = await G(A); return s.got[0] === did && s.pl.includes(did); }, 4000));
    check('심판이 "그만하기"로 끝낼 수 있음', await T(A, () => { document.getElementById('gameStop').click(); return !window.__games.state; }));
    check('그만하면 모두의 선물 모양이 사라짐', await until(async () => (await Promise.all([B, C, D].map((p) => T(p, () => window.__games.gifts().length)))).every((n) => n === 0), 3000));
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} 통과`);
  process.exit(pass === results.length ? 0 : 1);
})();
