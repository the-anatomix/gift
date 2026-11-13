// 이름별 순위 검사 (상태 규칙, 예전 방과 저장, 놀이 판의 "🏆 순위" 단추와 순위 판(폰), 내 줄 강조, 같은 이름은 최고 점수만,
// 친구·구경하는 사람의 점수, 늦게 온 사람, 이상한 값).
// 실행: cd tree/tests && node rank.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8202, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__rank && window.__names && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
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
// 판 안의 단추끼리 겹치지 않는지
const clash = (p, sel) => p.evaluate((sel) => {
  const rs = [...document.querySelectorAll(sel)].filter((b) => b.getBoundingClientRect().width).map((b) => b.getBoundingClientRect());
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const x = rs[i], y = rs[j]; if (!(x.right <= y.left + 0.5 || y.right <= x.left + 0.5 || x.bottom <= y.top + 0.5 || y.bottom <= x.top + 0.5)) return true; }
  return false;
}, sel);
const idOf = (p, k) => T(p, (k) => { for (const it of window.__tree.S.items.values()) if (it.k === k) return it.id; return null; }, k);
const list = (p, k) => T(p, (k) => window.__rank.list(k), k);
const toastHas = (p, t) => until(async () => (await p.textContent('#toast')).includes(t), 4000);
const shot = (p, n) => p.screenshot({ path: path.join(__dirname, 'out', n) });

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ra`);

    /* 상태 규칙 (state.js) */
    const rules = await T(A, async () => {
      const m = await import('./state.js'), c = await import('./catalog.js'), S = m.makeState(), ap = (op) => m.apply(S, op, () => false), r = {};
      const L = (k) => m.rankList(S, k).map((x) => `${x.name}:${x.v}`).join(',');
      r.keep = c.RANK.keep; r.show = c.RANK.show;
      r.first = ap({ t: 'score', k: 'dart', v: 60, name: '산타' });
      r.same = ap({ t: 'score', k: 'dart', v: 60, name: '산타' });
      r.lower = ap({ t: 'score', k: 'dart', v: 40, name: '산타' });
      r.higher = ap({ t: 'score', k: 'dart', v: 90, name: '산타' });
      r.other = ap({ t: 'score', k: 'dart', v: 120, name: '루돌프' }) && ap({ t: 'score', k: 'dart', v: 90, name: '눈사람' });
      r.order = L('dart');
      r.bestKept = S.best.dart === undefined; // 'score' 는 이 방 최고 기록을 건드리지 않는다
      r.best = ap({ t: 'best', k: 'dart', v: 150, name: '산타' });
      r.afterBest = L('dart');
      r.bestLow = ap({ t: 'best', k: 'dart', v: 150, name: '루돌프' });
      r.fire = ap({ t: 'score', k: 'fire', v: 100, name: '산타' });
      r.fireList = L('fire');
      r.bad = [
        { t: 'score', k: 'dart', v: 181, name: '산타' }, { t: 'score', k: 'fire', v: 101, name: '산타' }, { t: 'score', k: 'dart', v: 0, name: '가' }, { t: 'score', k: 'dart', v: -5, name: '가' },
        { t: 'score', k: 'dart', v: 50.5, name: '가' }, { t: 'score', k: 'dart', v: '50', name: '가' }, { t: 'score', k: 'dart', v: NaN, name: '가' }, { t: 'score', k: 'snow', v: 50, name: '가' },
        { t: 'score', k: '__proto__', v: 50, name: '가' }, { t: 'score', k: 'constructor', v: 50, name: '가' }, { t: 'score', k: 'dart', v: 50, name: '' }, { t: 'score', k: 'dart', v: 50, name: '가'.repeat(11) },
        { t: 'score', k: 'dart', v: 50, name: ' 가' }, { t: 'score', k: 'dart', v: 50, name: '가\n나' }, { t: 'score', k: 'dart', v: 50, name: '‮가' }, { t: 'score', k: 'dart', v: 50, name: 5 }, { t: 'score', k: 'dart', v: 50 },
      ].map(ap);
      r.size = S.rank.dart.size;
      // 저장하고 다시 열기
      const data = JSON.parse(JSON.stringify(m.serialize(S))), S2 = m.makeState();
      for (const op of m.ops(data)) m.apply(S2, op, () => false);
      r.saved = JSON.stringify(data.rank);
      r.again = JSON.stringify(m.serialize(S2).rank) === r.saved && JSON.stringify(S2.best) === JSON.stringify(S.best);
      // 순위표가 없던 때의 방: 최고 기록만 순위에 오른다
      const old = { ...data }; delete old.rank;
      const S3 = m.makeState();
      for (const op of m.ops(old)) m.apply(S3, op, () => false);
      r.old = m.rankList(S3, 'dart').map((x) => `${x.name}:${x.v}`).join(',') + '|' + m.rankList(S3, 'fire').length + '|' + S3.best.dart.v;
      // 기록이 하나도 없는 방은 저장 모양이 예전과 같다 / 이상한 저장값
      r.emptyShape = !('rank' in m.serialize(m.makeState()));
      const S4 = m.makeState();
      let threw = false;
      for (const junk of [{ rank: 5 }, { rank: [] }, { rank: { dart: 'x', fire: [[1, 2], 'a', ['이름', 999], ['좋은이름', 70], [null, 5]] } }, { rank: { dart: [['가', 10, 'x'], ['가', 30]], zzz: [['가', 10]] } }]) {
        try { for (const op of m.ops({ ...old, best: {}, ...junk })) m.apply(S4, op, () => false); } catch (_) { threw = true; }
      }
      r.junk = !threw && m.rankList(S4, 'fire').map((x) => `${x.name}:${x.v}`).join(',') + '|' + m.rankList(S4, 'dart').map((x) => `${x.name}:${x.v}`).join(',');
      // 놀이마다 keep 명까지: 넘치면 낮은 점수부터 빠지고, 꼴찌보다 낮은 새 이름은 받지 않는다
      const S5 = m.makeState(), ap5 = (op) => m.apply(S5, op, () => false);
      for (let i = 0; i < c.RANK.keep; i++) ap5({ t: 'score', k: 'dart', v: 50 + i, name: '친구' + i });
      r.fullLow = ap5({ t: 'score', k: 'dart', v: 50, name: '새친구' });
      r.fullHigh = ap5({ t: 'score', k: 'dart', v: 100, name: '새친구' });
      r.fullSize = S5.rank.dart.size; r.dropped = !S5.rank.dart.has('친구0') && S5.rank.dart.has('친구1');
      r.fullOwn = ap5({ t: 'score', k: 'dart', v: 52, name: '친구1' }); // 이미 있는 이름은 자기 점수만 넘으면 된다
      return r;
    });
    check('점수는 그 이름의 지금 점수보다 높을 때만 받음 (같은 이름은 최고 점수만)', rules.first && !rules.same && !rules.lower && rules.higher, rules);
    check('높은 점수부터, 같은 점수면 이름 순', rules.other && rules.order === '루돌프:120,눈사람:90,산타:90', rules.order);
    check("'score' 는 이 방 최고 기록을 바꾸지 않고, 'best' 는 순위에도 오름", rules.bestKept && rules.best && rules.afterBest === '산타:150,루돌프:120,눈사람:90' && !rules.bestLow, rules);
    check('놀이마다 따로', rules.fire && rules.fireList === '산타:100');
    check('이상한 값은 받지 않음 (점수 범위·정수, 모르는 놀이, 이름 규칙)', rules.bad.every((v) => v === false) && rules.size === 3, rules.bad);
    check('저장했다가 열어도 순위와 최고 기록이 그대로', rules.saved === '{"dart":[["산타",150],["루돌프",120],["눈사람",90]],"fire":[["산타",100]]}' && rules.again, rules.saved);
    check('순위표가 없던 때의 방은 최고 기록만 순위에 오른 채로 열림', rules.old === '산타:150|0|150', rules.old);
    check('기록이 없는 방의 저장 모양은 예전 그대로이고, 이상한 저장값에도 버팀', rules.emptyShape && rules.junk === '좋은이름:70|가:30', rules.junk);
    check(`놀이마다 ${rules.keep}명까지: 넘치면 낮은 점수부터 빠지고 꼴찌보다 낮은 새 이름은 안 받음`, rules.keep >= 10 && rules.show === 10 && !rules.fullLow && rules.fullHigh && rules.fullSize === rules.keep && rules.dropped && rules.fullOwn, rules);

    /* 놀이 판의 "🏆 순위" 단추와 순위 판 */
    await T(A, () => window.__names.set('루돌프'));
    const dartId = await idOf(A, 'dart'), fireId = await idOf(A, 'fire');
    await T(A, (id) => window.__play.open(id), dartId); await sleep(300);
    check('다트 판에 "🏆 순위" 단추 (44px 이상, 다른 단추와 겹치지 않음)', (await A.isVisible('#playRank')) && (await A.textContent('#playRank')) === '🏆 순위' && (await audit(A)).length === 0 && !(await clash(A, '#playBtns button')), await audit(A));
    await A.tap('#playRank'); await sleep(200);
    let v = await T(A, () => ({ shown: window.__rank.shown, kind: window.__rank.kind, rows: window.__rank.rows, mine: window.__rank.mine, txt: document.getElementById('rankList').textContent }));
    check('누르면 순위 판이 그 놀이로 열리고, 기록이 없으면 안내', v.shown && v.kind === 'dart' && v.rows.length === 0 && v.txt.includes('아직 기록이 없어요') && v.mine.includes('루돌프'), v);
    check('순위 판의 단추가 44px 이상·화면 안', (await audit(A)).length === 0, await audit(A));
    await A.tap('#rankClose'); await sleep(100);
    check('닫기를 누르면 닫힘', !(await T(A, () => window.__rank.shown)));
    // 다트 한 판 (가운데 세 번 = 150점): 첫 기록은 이 방 최고 기록이자 1위
    for (let k = 0; k < 3; k++) { await T(A, () => window.__play.throwAt(0, 0)); await until(() => T(A, () => window.__play.state.phase !== 'fly'), 3000); }
    await until(() => T(A, () => window.__play.state.phase === 'done'), 3000);
    check('다트 한 판이 끝나면 닉네임으로 순위에 오름 (이 방 최고 기록도)', JSON.stringify(await list(A, 'dart')) === JSON.stringify([{ name: '루돌프', v: 150 }]) && (await T(A, () => window.__tree.S.best.dart.name)) === '루돌프' && (await toastHas(A, '최고 기록! 150점')), await list(A, 'dart'));
    check('끝난 판에도 "🏆 순위" 단추, 겹치지 않음', (await A.isVisible('#playRank')) && (await audit(A)).length === 0 && !(await clash(A, '#playBtns button')), await audit(A));
    // 다른 이름들의 점수 (예전에 논 사람들)
    await T(A, () => { const d = window.__tree.dispatch; for (let i = 1; i <= 11; i++) d({ t: 'score', k: 'dart', v: 150 - i * 10, name: '친구' + i }); });
    await A.tap('#playRank'); await sleep(200);
    v = await T(A, () => ({ rows: window.__rank.rows, mine: window.__rank.mine }));
    check('1~10위만 보이고 이름·점수가 높은 순으로, 1~3위는 메달', v.rows.length === 10 && v.rows[0].no === '🥇' && v.rows[0].name === '루돌프' && v.rows[0].pts === '150점' && v.rows[2].no === '🥉' && v.rows[3].no === '4' && v.rows[9].no === '10' && v.rows[9].name === '친구9' && v.rows[9].pts === '60점', v.rows);
    check('내 줄이 강조되고 내 순위가 적힘', v.rows.filter((r) => r.me).length === 1 && v.rows[0].me && v.mine.includes('내 순위 1위'), v);
    const lay = await T(A, () => { const s = document.querySelector('#rankP .sheet').getBoundingClientRect(), c = document.getElementById('rankClose').getBoundingClientRect(), me = getComputedStyle(document.querySelector('#rankList li.me')).backgroundColor, other = getComputedStyle(document.querySelector('#rankList li:not(.me)')).backgroundColor; return { t: s.top, b: s.bottom, l: s.left, r: s.right, cb: c.bottom, ch: c.height, me, other, ih: innerHeight, iw: innerWidth }; });
    check('순위 판이 폰 화면 안에 다 들어오고 닫기 단추가 44px 이상, 내 줄은 색이 다름', lay.t >= 0 && lay.b <= lay.ih && lay.l >= 0 && lay.r <= lay.iw && lay.cb <= lay.ih && lay.ch >= 44 && lay.me !== lay.other, lay);
    await shot(A, 'rank-dart.png');
    await T(A, () => document.querySelector('#rankTabs [data-v="fire"]').click()); await sleep(100);
    check('순위 판에서 다른 놀이(마시멜로 굽기)로 바꿔 볼 수 있음', (await T(A, () => window.__rank.kind)) === 'fire' && (await T(A, () => window.__rank.rows.length)) === 0);
    await A.tap('#rankClose');
    // 같은 이름으로 낮은 점수, 다른 이름으로 낮은 점수
    check('내 기록보다 낮은 점수는 남기지 않음', (await T(A, () => window.__rank.record('dart', 100))) === false && (await list(A, 'dart'))[0].v === 150);
    await T(A, () => window.__names.set('빨간코'));
    check('이름을 바꾸면 새 이름으로 따로 오르고 순위 알림이 뜸', (await T(A, () => window.__rank.record('dart', 95))) === true && (await T(A, () => window.__rank.placeOf('dart', '빨간코'))) === 7 && (await toastHas(A, '순위 7위')), await list(A, 'dart'));
    check('이 방 최고 기록은 그대로', (await T(A, () => window.__tree.S.best.dart.v)) === 150);
    check('범위를 벗어난 점수는 남기지 않음', (await T(A, () => [window.__rank.record('dart', 181), window.__rank.record('dart', 0), window.__rank.record('dart', NaN), window.__rank.record('snow', 10)].some(Boolean))) === false);
    await T(A, () => window.__rank.record('dart', 20)); // 11위 내 95점보다 낮아서 안 남는다
    await T(A, () => window.__names.set('꼴찌'));
    await T(A, () => window.__rank.record('dart', 15));
    await T(A, () => window.__rank.open('dart')); await sleep(150);
    v = await T(A, () => ({ rows: window.__rank.rows, mine: window.__rank.mine }));
    check('내가 10위 밖이면 목록 아래에 내 순위 한 줄', v.rows.length === 10 && !v.rows.some((r) => r.me) && v.mine.includes('내 순위 14위') && v.mine.includes('15점'), v);
    await T(A, () => window.__rank.close());
    await T(A, () => window.__play.close()); await sleep(200);
    // 마시멜로
    await T(A, () => window.__names.set('루돌프'));
    await T(A, (id) => window.__play.open(id), fireId); await sleep(300);
    check('마시멜로 판에도 "🏆 순위" 단추, 겹치지 않음', (await A.isVisible('#playRank')) && (await audit(A)).length === 0 && !(await clash(A, '#playBtns button')), await audit(A));
    await A.tap('#playGo'); await sleep(200);
    await T(A, () => window.__play.setHeat(0.5)); await A.tap('#playGo'); await sleep(300);
    const pts = await T(A, () => window.__play.state.pts);
    check('마시멜로 점수도 순위에 오름', pts >= 1 && JSON.stringify(await list(A, 'fire')) === JSON.stringify([{ name: '루돌프', v: pts }]), { pts, l: await list(A, 'fire') });
    check('구운 뒤 판(먹기·다시 굽기·순위·그만하기)의 단추가 폰에서 겹치지 않고 44px 이상', (await A.isVisible('#playRank')) && (await audit(A)).length === 0 && !(await clash(A, '#playBtns button')), await audit(A));
    await shot(A, 'rank-fire-done.png');
    await A.tap('#playRank'); await sleep(150);
    check('마시멜로 판에서 열면 마시멜로 순위', (await T(A, () => window.__rank.kind)) === 'fire' && (await T(A, () => window.__rank.rows.length)) === 1);
    await A.keyboard.press('Escape'); await sleep(100);
    await T(A, () => { window.__rank.close(); window.__play.close(); });

    /* 저장: 다시 열어도 보임 */
    await sleep(1200);
    await A.reload(); await ready(A);
    check('다시 열어도 순위가 그대로', (await list(A, 'dart')).length === 14 && (await list(A, 'dart'))[0].name === '루돌프' && (await list(A, 'fire')).length === 1, await list(A, 'dart'));

    /* 여럿이: B 꾸미기 "산타", C 구경 "눈사람" */
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=rb#r=${room}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 2 && (await T(B, () => window.__duo.others)).length === 1, 20000);
    check('나중에 들어온 사람에게도 순위가 보임', await until(async () => (await list(B, 'dart')).length === 14 && (await list(B, 'dart'))[0].name === '루돌프', 5000), await list(B, 'dart'));
    await T(B, () => window.__names.set('산타'));
    check('친구의 점수가 닉네임으로 모두의 순위에 오름', (await T(B, () => window.__rank.record('dart', 145))) === true && await until(async () => (await T(A, () => window.__rank.placeOf('dart', '산타'))) === 2, 4000), await list(A, 'dart'));
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=rc#v=${rid}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    await T(C, () => window.__names.set('눈사람'));
    check('구경하는 사람의 점수도 오름', (await T(C, () => window.__rank.record('dart', 148))) === true && await until(async () => (await T(A, () => window.__rank.placeOf('dart', '눈사람'))) === 2 && (await T(B, () => window.__rank.placeOf('dart', '눈사람'))) === 2, 4000), await list(A, 'dart'));
    await T(A, () => window.__rank.open('dart')); await sleep(100);
    await T(B, () => window.__rank.record('dart', 180));
    check('순위 판을 보고 있을 때 친구가 기록을 세우면 판이 바로 바뀜 (최고 기록 알림도)', await until(async () => { const r = await T(A, () => window.__rank.rows); return r[0].name === '산타' && r[0].pts === '180점' && r[1].me; }, 4000) && (await toastHas(A, '산타님이 이 방 다트 최고 기록')), await T(A, () => window.__rank.rows));
    await T(A, () => window.__rank.close());
    const hashes = async () => [await T(A, () => window.__duo.hash()), await T(B, () => window.__duo.hash()), await T(C, () => window.__duo.hash())];
    check('세 사람의 방이 같음', await until(async () => { const h = await hashes(); return h[0] === h[1] && h[1] === h[2]; }, 5000), await hashes());
    // 이상한 소식
    const before = JSON.stringify(await list(A, 'dart'));
    await T(B, () => { const d = window.__duo; for (const op of [{ t: 'score', k: 'dart', v: 999, name: '산타' }, { t: 'score', k: 'dart', v: 170, name: '가'.repeat(30) }, { t: 'score', k: 'zzz', v: 10, name: '산타' }, { t: 'score', k: 'dart', v: 170, name: '<b>\n' }, { t: 'score' }]) d.rawOp(op); });
    await sleep(800);
    check('이상한 점수 소식은 받지 않고 방도 그대로', JSON.stringify(await list(A, 'dart')) === before && await until(async () => { const h = await hashes(); return h[0] === h[1] && h[1] === h[2]; }, 5000), await list(A, 'dart'));
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass} / ${results.length} 통과`);
  process.exit(pass === results.length ? 0 : 1);
})();
