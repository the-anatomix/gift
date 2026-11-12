// 방명록과 이 방 최고 기록 검사. 실행: cd tree/tests && node book.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8175, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__book && window.__tree.frames > 3)), 20000);
async function open(ctx, url, page) {
  const p = page || await ctx.newPage();
  if (!page) p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
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
    if (!b.closest('.scroll') && !b.closest('#bookList') && (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5)) bad.push(`${name}: 화면 밖`);
  }
  const s = document.getElementById('playP').getBoundingClientRect();
  if (s.top < 0 || s.right > innerWidth + 0.5 || s.left < 0) bad.push('판이 화면 밖');
  return bad;
});
const idOf = (p, k) => T(p, (k) => { for (const it of window.__tree.S.items.values()) if (it.k === k) return it.id; return null; }, k);
const notes = (p) => T(p, () => [...window.__tree.S.notes.values()].map((n) => n.text).sort());
const toastHas = (p, t) => until(async () => (await p.textContent('#toast')).includes(t), 4000);

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);

    /* 상태 규칙 (state.js) */
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ba`);
    const rules = await T(A, async () => {
      const m = await import('./state.js'), S = m.makeState(), ap = (op) => m.apply(S, op, () => false), at = Date.now();
      const r = {};
      r.ok = ap({ t: 'note', id: 'n1', name: '산타', text: '메리 크리스마스 🎄', at });
      r.dupId = ap({ t: 'note', id: 'n1', name: '산타', text: '또', at });
      r.longName = ap({ t: 'note', id: 'n2', name: '가'.repeat(11), text: '안녕', at });
      r.name10 = ap({ t: 'note', id: 'n3', name: '가'.repeat(10), text: '안녕', at });
      r.longText = ap({ t: 'note', id: 'n4', name: '루돌프', text: '가'.repeat(81), at });
      r.text80 = ap({ t: 'note', id: 'n5', name: '루돌프', text: '😀'.repeat(80), at });
      r.empty = ap({ t: 'note', id: 'n6', name: '루돌프', text: '', at }) || ap({ t: 'note', id: 'n6', name: '', text: '안녕', at }) || ap({ t: 'note', id: 'n6', name: '루돌프', text: '   ', at });
      r.ctrl = ap({ t: 'note', id: 'n7', name: '루돌프', text: '줄\n바꿈', at }) || ap({ t: 'note', id: 'n7', name: 'a\u0000', text: '안녕', at }) || ap({ t: 'note', id: 'n7', name: '루돌프', text: '\u202e거꾸로', at });
      r.badAt = ap({ t: 'note', id: 'n8', name: '루돌프', text: '안녕', at: 'x' }) || ap({ t: 'note', id: 'n8', name: '루돌프', text: '안녕', at: -1 }) || ap({ t: 'note', id: 'n8', name: 5, text: '안녕', at });
      r.badId = ap({ t: 'note', id: 'A B', name: '루돌프', text: '안녕', at });
      r.count3 = S.notes.size;
      for (let k = 0; k < 70; k++) ap({ t: 'note', id: 'z' + k, name: '눈사람', text: '글 ' + k, at: at + 1000 + k });
      r.max = S.notes.size;
      r.oldGone = !S.notes.has('n1') && !S.notes.has('z0') && S.notes.has('z69');
      r.order = m.notesList(S)[0].id === 'z69';
      r.del = m.apply(S, { t: 'noteDel', id: 'z69' }) && !S.notes.has('z69') && !m.apply(S, { t: 'noteDel', id: 'z69' });
      r.b1 = ap({ t: 'best', k: 'dart', v: 120, name: '산타' });
      r.bLow = ap({ t: 'best', k: 'dart', v: 120, name: '루돌프' }) || ap({ t: 'best', k: 'dart', v: 80, name: '루돌프' });
      r.bUp = ap({ t: 'best', k: 'dart', v: 121, name: '루돌프' });
      r.bBad = ap({ t: 'best', k: 'dart', v: 181, name: '루돌프' }) || ap({ t: 'best', k: 'fire', v: 101, name: '루돌프' }) || ap({ t: 'best', k: 'tv', v: 5, name: '루돌프' }) || ap({ t: 'best', k: '__proto__', v: 5, name: '루돌프' }) || ap({ t: 'best', k: 'fire', v: 50.5, name: '루돌프' }) || ap({ t: 'best', k: 'fire', v: 0, name: '루돌프' }) || ap({ t: 'best', k: 'fire', v: 50, name: '' });
      r.fire = ap({ t: 'best', k: 'fire', v: 100, name: '루돌프' });
      // 저장했다가 다시 열기
      const d = JSON.parse(JSON.stringify(m.serialize(S))), S2 = m.makeState();
      for (const op of m.ops(d)) m.apply(S2, op, () => false);
      r.v = d.v;
      r.round = S2.notes.size === S.notes.size && JSON.stringify(m.notesList(S2)) === JSON.stringify(m.notesList(S)) && JSON.stringify(S2.best) === JSON.stringify(S.best);
      // 방명록이 없던 때의 방
      const old = { v: 2, at: 1, sync: 0, items: [], orns: [], lights: ['off', 'on'], wall: 'cream', floor: 'oak' }, S3 = m.makeState();
      for (const op of m.ops(old)) m.apply(S3, op, () => false);
      r.old = S3.notes.size === 0 && Object.keys(S3.best).length === 0 && Array.isArray(m.serialize(S3).notes);
      r.clean = m.cleanWords('  안녕\n\n  하세요\t ', 80) === '안녕 하세요' && m.cleanWords('가'.repeat(20), 10) === '가'.repeat(10) && m.cleanWords(5, 10) === '' && [...m.cleanWords('😀'.repeat(90), 80)].length === 80;
      return r;
    });
    check('방명록 글 남기기: 이름 1~10자, 글 1~80자(이모지도 한 글자)만 받음', rules.ok && !rules.dupId && !rules.longName && rules.name10 && !rules.longText && rules.text80 && !rules.empty, rules);
    check('제어 문자·줄바꿈·글 방향 문자, 이상한 때·id 는 받지 않음', !rules.ctrl && !rules.badAt && !rules.badId && rules.count3 === 3, rules);
    check('60개가 넘으면 가장 오래된 것부터 빠지고, 최근 것이 맨 앞', rules.max === 60 && rules.oldGone && rules.order, rules);
    check('글 지우기', rules.del, rules);
    check('최고 기록은 더 높을 때만, 다트 0~180·마시멜로 0~100 정수만', rules.b1 && !rules.bLow && rules.bUp && !rules.bBad && rules.fire, rules);
    check('저장했다 다시 열어도 방명록과 기록이 그대로 (저장 형식 v 2 그대로)', rules.round && rules.v === 2, rules);
    check('방명록이 없던 때의 방은 빈 방명록으로 열림, 글 다듬기', rules.old && rules.clean, rules);

    /* 기본으로 놓이는 방명록 가구 */
    const gid = await idOf(A, 'guest');
    const gi = await T(A, (id) => { const it = window.__tree.S.items.get(id); return it && { i: it.i, j: it.j, r: it.r, shown: window.__tree.itemShown(id) }; }, gid);
    check('새 방에는 현관 안쪽 옆(6, 16)에 북쪽을 보는 방명록이 놓여 있음', gi && gi.i === 6 && gi.j === 16 && gi.r === 2 && gi.shown, gi);
    const cat = await T(A, async () => { const c = await import('./catalog.js'); const f = c.FURNITURE.find((x) => x.id === 'guest'); return f && { w: f.w, d: f.d, solid: f.solid, play: f.play, icon: f.icon, name: f.name }; });
    check('가구 목록에 방명록(📖, 1×1, 밟을 수 없음, 놀이 guest)', cat && cat.w === 1 && cat.d === 1 && cat.solid && cat.play === 'guest' && cat.icon === '📖' && cat.name === '방명록', cat);

    /* 가구를 누르면 걸어가서 판이 열림 */
    await T(A, (id) => { const t = window.__tree, it = t.S.items.get(id); t.me.place(...[t.box.x0 + (it.i + 0.5) * t.CELL + 1.2, t.box.z0 + (it.j + 0.5) * t.CELL - 1.4]); }, gid);
    await T(A, (id) => window.__play.start(id), gid);
    check('방명록을 누르면 그 앞으로 걸어가서 판이 열림', await until(() => T(A, () => window.__book.shown && window.__play.on), 15000));
    check('판에 "아직 남긴 글이 없어요"와 이름·글 칸, 남기기 단추', (await A.textContent('#bookList')).includes('아직 남긴 글이 없어요') && (await A.isVisible('#bookName')) && (await A.isVisible('#bookText')) && (await A.isVisible('#bookSend')));
    check('이름 칸이 비어 있으면 기존 이름(방장)이 흐리게 보임', (await A.getAttribute('#bookName', 'placeholder')) === '방장');
    let bad = await audit(A);
    check('폰(375×812)에서 단추·칸이 44px 이상이고 화면 밖으로 나가지 않음', bad.length === 0, bad);
    await A.fill('#bookText', '<img src=x onerror=alert(1)> 메리 크리스마스!');
    await A.tap('#bookSend');
    await until(async () => (await T(A, () => window.__book.list)).length === 1);
    let L = await T(A, () => window.__book.list);
    check('남기기를 누르면 목록 맨 위에 이름과 글이 생기고 글 칸은 비워짐', L.length === 1 && L[0].name === '방장' && L[0].text === '<img src=x onerror=alert(1)> 메리 크리스마스!' && (await A.inputValue('#bookText')) === '', L);
    check('태그는 글자 그대로 보이고 실행되지 않음', (await A.locator('#bookList img').count()) === 0 && errors.length === 0, errors);
    check('날짜가 함께 보임', /\d+월 \d+일 \d\d:\d\d/.test(await A.textContent('#bookList .bk small')));
    await A.fill('#bookText', '두 번째');
    await A.press('#bookText', 'Enter');
    check('5초 안에 또 남기면 막히고 알려 줌', (await toastHas(A, '초 뒤에 다시')) && (await T(A, () => window.__book.list)).length === 1);
    await T(A, () => window.__book.resetGap());
    await A.fill('#bookName', '  산타  할아버지 ');
    await A.dispatchEvent('#bookName', 'change');
    await A.fill('#bookText', '   ');
    await A.tap('#bookSend');
    check('빈 글은 남지 않음', (await toastHas(A, '남길 말을 적어')) && (await T(A, () => window.__book.list)).length === 1);
    await A.fill('#bookText', '두 번째');
    await A.tap('#bookSend');
    await until(async () => (await T(A, () => window.__book.list)).length === 2);
    L = await T(A, () => window.__book.list);
    check('이름 칸에 적은 이름(다듬어서)으로 남고, 최근 것이 위', L.length === 2 && L[0].name === '산타 할아버지' && L[0].text === '두 번째' && L[1].name === '방장', L);
    check('꾸밀 수 있는 사람에게는 지우기 단추가 있음', L.every((x) => x.del));
    bad = await audit(A);
    check('글이 있어도 폰 화면 안에 들어옴', bad.length === 0, bad);
    await A.screenshot({ path: path.join(__dirname, 'out', 'book-phone.png') });
    await A.tap('#bookList .bk:nth-child(2) button');
    await until(async () => (await T(A, () => window.__book.list)).length === 1);
    check('지우기를 누르면 그 글이 지워짐', JSON.stringify((await T(A, () => window.__book.list)).map((x) => x.text)) === '["두 번째"]');
    await A.tap('#playQuit');
    check('닫기를 누르면 판이 닫힘', await until(() => T(A, () => !window.__book.shown && !window.__play.on)));
    // 가까이 서면 스페이스바 안내
    const near = await until(() => T(A, () => window.__tree.nearAction()), 3000);
    check('방명록 앞에서 스페이스바 안내 "📖 방명록 쓰기"', near === '📖 방명록 쓰기', near);

    /* 이 방 최고 기록: 다트 */
    const dartId = await idOf(A, 'dart');
    await T(A, (id) => window.__play.open(id), dartId);
    await sleep(300);
    check('다트 판에 "아직 이 방 기록이 없어요"', (await A.textContent('#playSub')).includes('아직 이 방 기록이 없어요'));
    for (let k = 0; k < 3; k++) { await T(A, () => window.__play.throwAt(0, 0)); await until(() => T(A, () => window.__play.state.phase !== 'fly'), 3000); }
    await until(() => T(A, () => window.__play.state.phase === 'done'), 3000);
    check('다트 150점을 내면 이 방 최고 기록이 되고 알림이 뜸', (await T(A, () => JSON.stringify(window.__tree.S.best.dart))) === JSON.stringify({ v: 150, name: '산타 할아버지' }) && (await toastHas(A, '최고 기록! 150점')));
    check('다트 판에 "이 방 최고 기록 150점 (산타 할아버지)"', (await A.textContent('#playSub')).includes('이 방 최고 기록 150점 (산타 할아버지)'), await A.textContent('#playSub'));
    await T(A, () => window.__play.close());

    /* 마시멜로 */
    const fireId = await idOf(A, 'fire');
    await T(A, (id) => window.__play.open(id), fireId);
    await A.click('#playGo'); await T(A, () => { window.__play.setHeat(0.66); document.getElementById('playGo').click(); }); // 정한 온도에서 바로 꺼낸다
    const fv = await until(() => T(A, () => window.__tree.S.best.fire && window.__tree.S.best.fire.v));
    check('마시멜로 점수도 이 방 기록으로 남고 판에 보임', fv >= 95 && (await A.textContent('#playSub')).includes(`이 방 최고 기록 ${fv}점`), fv);
    await A.click('#playGo'); await A.click('#playGo'); await T(A, () => { window.__play.setHeat(0.4); document.getElementById('playGo').click(); });
    check('기록보다 낮으면 그대로', (await T(A, () => window.__tree.S.best.fire.v)) === fv);
    await T(A, () => window.__play.close());

    /* 다시 열어도 그대로 */
    await sleep(600);
    await open(ctx, `${BASE}?net=bc&door=0&ns=ba`, A);
    check('다시 열어도 방명록·기록·이름이 그대로', JSON.stringify(await notes(A)) === '["두 번째"]' && (await T(A, () => window.__tree.S.best.dart.v)) === 150 && (await A.inputValue('#bookName')) === '산타 할아버지');

    /* 여럿이: 방장 A, 꾸미는 B, 구경하는 C */
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=bb#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=bc#v=${rid}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(C, () => window.__duo.others)).length === 2 && (await T(B, () => window.__duo.others)).length === 2, 20000);
    check('친구들도 방장의 방명록을 받음', JSON.stringify(await notes(B)) === '["두 번째"]' && JSON.stringify(await notes(C)) === '["두 번째"]');
    check('세 사람의 방 지문이 같음 (방명록·기록 포함)', await until(async () => { const h = await T(A, () => window.__duo.hash()); return h === await T(B, () => window.__duo.hash()) && h === await T(C, () => window.__duo.hash()); }, 6000));
    await T(C, (id) => window.__play.open(id), gid);
    await sleep(300);
    L = await T(C, () => window.__book.list);
    check('구경하는 사람도 방명록을 열 수 있고, 지우기 단추는 없음', (await T(C, () => window.__book.shown)) && L.length === 1 && !L[0].del && (await C.getAttribute('#bookName', 'placeholder')).startsWith('친구'), L);
    bad = await audit(C);
    check('구경하는 사람 폰 화면에서도 44px 이상, 화면 안', bad.length === 0, bad);
    await C.fill('#bookName', '루돌프'); await C.dispatchEvent('#bookName', 'change');
    await C.fill('#bookText', '구경 왔다 가요~');
    await C.tap('#bookSend');
    check('구경하는 사람이 남긴 글이 방장과 꾸미는 사람에게 보임', await until(async () => (await notes(A)).includes('구경 왔다 가요~') && (await notes(B)).includes('구경 왔다 가요~')));
    check('판을 열어 두지 않은 사람에게는 알림이 뜸', await toastHas(B, '루돌프님이 방명록에 글을 남겼어요'));
    // 화면의 막음을 건너뛰고 5초 안에 또 보내면 방장이 거른다
    await T(C, () => window.__duo.rawOp({ t: 'note', id: 'zzraw1', name: '루돌프', text: '도배', at: Date.now() }));
    await sleep(800);
    check('구경하는 사람이 5초 안에 또 보낸 글은 방장이 거름', !(await notes(A)).includes('도배') && !(await notes(B)).includes('도배'));
    await T(C, () => window.__duo.rawOp({ t: 'noteDel', id: [...window.__tree.S.notes.keys()][0] }));
    await sleep(800);
    check('구경하는 사람이 보낸 지우기는 방장이 받지 않음', (await notes(A)).length === 2);
    check('구경하는 사람의 화면에서도 지우기는 막힘', (await T(C, () => window.__tree.dispatch({ t: 'noteDel', id: [...window.__tree.S.notes.keys()][0] }))) === false);
    await sleep(4300);
    await T(C, () => window.__duo.rawOp({ t: 'note', id: 'zzraw2', name: '루돌프', text: '5초 지났어요', at: Date.now() }));
    check('5초가 지나면 다시 받음', await until(async () => (await notes(A)).includes('5초 지났어요') && (await notes(B)).includes('5초 지났어요')));
    // 꾸미는 사람의 지우기
    await T(B, (id) => window.__play.open(id), gid);
    await sleep(300);
    const bl = await T(B, () => window.__book.list);
    check('꾸미는 사람의 판에는 글이 최근 것부터, 지우기 단추가 있음', bl.length === 3 && bl[0].text === '5초 지났어요' && bl.every((x) => x.del), bl);
    await B.tap(`#bookList .bk[data-id="${bl[0].id}"] button`);
    check('꾸미는 사람이 지운 글은 모두에게서 지워짐', await until(async () => !(await notes(A)).includes('5초 지났어요') && !(await notes(C)).includes('5초 지났어요')));
    check('열어 둔 판도 바로 고쳐짐', await until(async () => (await T(C, () => window.__book.list)).length === 2));
    await T(B, () => window.__play.close());

    // 기록: 구경하는 사람의 기록도 받고, 깨지면 모두에게 알림
    await T(C, () => window.__play.close());
    check('구경하는 사람의 기록도 받음 (이름은 방명록 이름)', (await T(C, () => window.__book.record('dart', 170))) === true && await until(async () => (await T(A, () => JSON.stringify(window.__tree.S.best.dart))) === JSON.stringify({ v: 170, name: '루돌프' }) && (await T(B, () => window.__tree.S.best.dart.v)) === 170));
    check('기록이 깨지면 다른 사람들에게 알림', (await toastHas(A, '루돌프님이 이 방 다트 최고 기록을 세웠어요! 170점')) && (await toastHas(B, '루돌프님이 이 방 다트 최고 기록을 세웠어요')));
    check('기록보다 낮은 점수는 남기지 않음', (await T(B, () => window.__book.record('dart', 160))) === false);
    await T(B, (v) => window.__book.record('fire', v), fv);
    await sleep(500);
    check('같은 점수로는 기록이 바뀌지 않음', (await T(A, () => window.__tree.S.best.fire.name)) === '산타 할아버지');
    await T(B, (id) => window.__play.open(id), dartId);
    await sleep(300);
    check('친구의 다트 판에도 이 방 기록이 보임', (await B.textContent('#playSub')).includes('이 방 최고 기록 170점 (루돌프)'), await B.textContent('#playSub'));
    // 이름을 적지 않은 꾸미는 사람의 기록은 기존 이름(친구N)으로
    await T(B, () => window.__book.record('dart', 180));
    check('이름 칸이 비었으면 기존 이름으로 기록', await until(async () => /^친구\d*$/.test(await T(A, () => window.__tree.S.best.dart.name))), await T(A, () => window.__tree.S.best.dart));
    check('판이 열린 채로 기록이 바뀌면 판도 고쳐짐', await until(async () => (await B.textContent('#playSub')).includes('이 방 최고 기록 180점')));
    await T(B, () => window.__play.close());
    check('마지막에도 세 사람의 방 지문이 같음', await until(async () => { const h = await T(A, () => window.__duo.hash()); return h === await T(B, () => window.__duo.hash()) && h === await T(C, () => window.__duo.hash()); }, 6000));
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) {
    console.log('검사 중 오류:', e);
    results.push(false);
  } finally {
    await browser.close();
    server.close();
    const pass = results.filter(Boolean).length;
    console.log(`\n${pass}/${results.length} 통과`);
    process.exit(pass === results.length ? 0 : 1);
  }
})();
