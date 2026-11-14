// 닉네임과 머리 위 이름표 검사 (캐릭터 고르기 판의 이름 칸, 글 규칙, 기억, 방명록 이름과 하나, 친구에게 보이기·늦게 온 사람,
// 1인칭, 말풍선, 다른 층, 숨바꼭질에서 술래에게 안 보이기와 "👀 찾음" 표시와 겹치지 않기).
// 실행: cd tree/tests && node name.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8201, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__names && window.__games && window.__tree.frames > 3)), 20000);
async function open(ctx, url, keepLook) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; window.__skip = 0; window.__now = () => Date.now() + window.__skip; });
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (!keepLook && await p.isVisible('#lookDone')) await p.click('#lookDone');
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
const stand = (p, x, z) => T(p, ([x, z]) => { const t = window.__tree; t.me.stop(); t.me.place(x, z); t.snapView(); }, [x, z]);
const tags = (p) => T(p, () => window.__names.tags);
const shot = (p, n) => p.screenshot({ path: path.join(__dirname, 'out', n) });
const G = (p) => T(p, () => window.__games.state);

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

    /* 글 규칙 (생김새에 실리는 이름) */
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=na`, true);
    const rules = await T(A, async () => {
      const { cleanLook } = await import('./avatar.js');
      const n = (v) => cleanLook({ gender: 'f', outfit: 'basic', name: v }).name;
      return { ok: n('루돌프'), ten: n('가'.repeat(10)), long: n('가'.repeat(11)), emoji: n('🎄'.repeat(10)), empty: n(''), space: n(' 산타'), ctrl: n('산\n타'), bidi: n('‮산타'), num: n(5), none: 'name' in cleanLook({ gender: 'f' }) };
    });
    check('생김새의 이름: 10자까지(이모지도 한 글자), 빈 글·앞뒤 빈칸·제어 문자·글 방향 문자·글이 아닌 것은 버림',
      rules.ok === '루돌프' && rules.ten === '가'.repeat(10) && rules.emoji === '🎄'.repeat(10) && [rules.long, rules.empty, rules.space, rules.ctrl, rules.bidi, rules.num].every((v) => v === undefined) && rules.none === false, rules);

    /* 처음 온 사람: 캐릭터 고르기 판의 이름 칸 */
    const first = await T(A, () => {
      const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      return { open: window.__tree.lookOpen, inLook: !!document.querySelector('#look #nameIn'), name: r('#nameIn'), gender: r('#pickGender'), done: r('#lookDone'), h2: r('#look h2'), max: document.getElementById('nameIn').maxLength, iw: innerWidth, ih: innerHeight, fs: parseFloat(getComputedStyle(document.getElementById('nameIn')).fontSize) };
    });
    check('처음 들어오면 캐릭터 고르기 판에 이름 칸이 있음 (44px 이상, 화면 안, 글자 16px 이상)', first.open && first.inLook && first.name.h >= 44 && first.name.w >= 150 && first.name.l >= 0 && first.name.r <= first.iw && first.name.b <= first.ih && first.max === 10 && first.fs >= 16, first);
    check('이름 칸이 제목·성별 줄·"다 골랐어요"와 겹치지 않음', first.h2.b <= first.name.t + 0.5 && first.name.b <= first.gender.t + 0.5 && first.gender.b <= first.done.t + 0.5, first);
    check('캐릭터 고르기 판의 단추·칸이 모두 44px 이상·화면 안', (await audit(A)).length === 0, await audit(A));
    check('이름을 안 정했고 혼자면 이름표가 없음', Object.keys(await tags(A)).length === 0, await tags(A));
    await A.tap('#nameIn'); await A.keyboard.type('루돌프'); await sleep(250);
    let t = await tags(A);
    const meAt = await T(A, () => window.__tree.screenOf(window.__tree.me.x, window.__tree.me.z, 0));
    check('적는 대로 내 머리 위에 이름표가 뜸 (발보다 위, 가로는 내 자리)', t.me && t.me.text === '루돌프' && t.me.y < meAt.y - 30 && Math.abs(t.me.x - meAt.x) < 30, { t, meAt });
    await shot(A, 'name-look.png');
    await A.keyboard.press('Enter'); await sleep(150);
    check('Enter 를 누르면 칸에서 나오고 판은 그대로', (await T(A, () => document.activeElement.id !== 'nameIn' && window.__tree.lookOpen)));
    await A.tap('#lookDone'); await sleep(200);
    check('"다 골랐어요" 뒤에도 이름표가 남고 생김새에 이름이 실림', (await tags(A)).me.text === '루돌프' && (await T(A, () => window.__tree.look.name)) === '루돌프');
    const cleaned = await T(A, () => { const n = window.__names; return [n.set('  산타\n할아버지  '), n.set('가'.repeat(14)), n.set('‮거꾸로'), n.set('<b>x</b>')]; });
    check('이름은 다듬어 받음 (줄바꿈·겹친 빈칸은 한 칸, 10자까지, 글 방향 문자 빼기)', cleaned[0] === '산타 할아버지' && cleaned[1] === '가'.repeat(10) && cleaned[2] === '거꾸로' && cleaned[3] === '<b>x</b>', cleaned);
    check('꺾쇠가 든 이름도 글자로만 보임 (태그가 되지 않음)', (await T(A, () => document.querySelectorAll('#nameTags b').length)) === 0 && (await tags(A)).me.text === '<b>x</b>');
    await T(A, () => window.__names.set(''));
    await sleep(120);
    check('이름을 지우면 이름표도 사라지고 기억도 지워짐', !(await tags(A)).me && (await T(A, () => window.__names.nick)) === '' && (await T(A, () => Object.keys(localStorage).filter((k) => /name/.test(k)).length)) === 0);
    await T(A, () => window.__names.set('루돌프'));

    /* 기억, 나중에 바꾸기, 방명록 이름과 하나 */
    await A.reload(); await ready(A);
    check('다시 열어도 이름이 기억됨 (판은 다시 뜨지 않음)', (await T(A, () => window.__names.nick)) === '루돌프' && !(await T(A, () => window.__tree.lookOpen)) && (await tags(A)).me.text === '루돌프');
    await T(A, () => window.__tree.openLook(true)); await sleep(200);
    check('나중에 캐릭터 고르기 판을 열면 이름 칸에 지금 이름이 들어 있음', (await T(A, () => window.__names.input)) === '루돌프');
    await A.fill('#nameIn', '빨간코'); await sleep(150);
    await A.tap('#lookDone'); await sleep(200);
    check('같은 판에서 이름을 바꿀 수 있음', (await T(A, () => window.__names.nick)) === '빨간코' && (await tags(A)).me.text === '빨간코');
    check('방명록·순위가 쓰는 이름도 같은 이름', (await T(A, () => window.__book.myName())) === '빨간코' || (await T(A, () => window.__names.myName())) === '빨간코');
    await T(A, () => window.__tree.dispatch({ t: 'put', id: 'gb', k: 'guest', i: 3, j: 9, r: 0 }));
    await T(A, () => window.__play.open('gb')); await sleep(300);
    check('방명록의 이름 칸에 닉네임이 들어 있음', (await T(A, () => document.getElementById('bookName').value)) === '빨간코');
    await A.fill('#bookName', '루돌프'); await T(A, () => document.getElementById('bookName').dispatchEvent(new Event('change'))); await sleep(150);
    check('방명록에서 이름을 바꾸면 닉네임과 이름표도 바뀜', (await T(A, () => window.__names.nick)) === '루돌프' && (await T(A, () => window.__tree.look.name)) === '루돌프');
    await T(A, () => window.__play.close()); await sleep(200);
    check('놀이 판을 닫으면 이름표가 다시 보임', (await tags(A)).me && (await tags(A)).me.text === '루돌프', await tags(A));

    /* 여럿이: A 방장 "루돌프", B "산타", C 는 이름 없이 구경 */
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=nb#r=${room}`, true);
    await B.tap('#nameIn'); await B.keyboard.type('산타'); await B.tap('#lookDone');
    await until(async () => (await T(A, () => window.__duo.count)) === 2 && (await T(B, () => window.__duo.others)).length === 1, 20000);
    const bid = await T(B, () => window.__duo.me);
    await stand(A, -1, 1); await stand(B, 1, 1); await sleep(500);
    check('친구 머리 위에 닉네임이 보임 (서로)', await until(async () => { const a = await tags(A), b = await tags(B); return a[bid] && a[bid].text === '산타' && b.h && b.h.text === '루돌프' && a.me.text === '루돌프' && b.me.text === '산타'; }, 5000), { a: await tags(A), b: await tags(B) });
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=nc#v=${rid}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    const cid = await T(C, () => window.__duo.me);
    await stand(C, 0, 2.5); await sleep(500);
    check('늦게 들어온 사람에게도 먼저 있던 사람들의 닉네임이 보임', await until(async () => { const c = await tags(C); return c.h && c.h.text === '루돌프' && c[bid] && c[bid].text === '산타'; }, 5000), await tags(C));
    const baseC = await T(A, (c) => window.__tree.nameOf(c), cid);
    check('이름을 안 정한 사람은 기존 이름("친구N")으로 뜸', /^친구\d+$/.test(baseC) && await until(async () => { const a = await tags(A); return a[cid] && a[cid].text === baseC; }, 4000) && (await tags(C)).me.text === baseC, { baseC, a: await tags(A), c: await tags(C) });
    await T(C, () => window.__names.set('눈사람'));
    check('구경하는 사람이 이름을 정해도 모두에게 바로 바뀜', await until(async () => (await tags(A))[cid].text === '눈사람' && (await tags(B))[cid].text === '눈사람', 5000), await tags(B));
    const pos = await T(A, (b) => { const o = window.__duo.others.find((q) => q.id === b); return { feet: window.__tree.screenOf(o.x, o.z, 0), tag: window.__names.tags[b] }; }, bid);
    check('이름표는 그 사람의 머리 위에 있음', pos.tag.y < pos.feet.y - 30 && Math.abs(pos.tag.x - pos.feet.x) < 30, pos);
    check('이름표는 사람 수만큼만 있고 눌리지 않음 (그림 위의 글자 한 줄씩)', (await T(A, () => ({ n: document.querySelectorAll('#nameTags i').length, pe: getComputedStyle(document.getElementById('nameTags')).pointerEvents }))).n === 3);
    await shot(A, 'name-three.png');
    // 이름표끼리의 일: 채팅 목록에도 닉네임
    await T(B, () => window.__duo.rawSay('메리 크리스마스'));
    check('채팅에도 닉네임으로 적힘', await until(async () => (await T(A, () => document.getElementById('chatLog').textContent)).includes('산타'), 4000), await T(A, () => document.getElementById('chatLog').textContent));
    check('말풍선이 떠 있는 동안에는 그 사람의 이름표를 접어 둠 (겹치지 않게)', await until(async () => !(await tags(A))[bid], 2000), await tags(A));
    check('이상한 이름을 보내면 이름 없이 받음', await T(A, (b) => { const o = window.__tree, ok = window.__duo.feed({ t: 'look', look: { gender: 'f', outfit: 'basic', face: 'smile', name: '가'.repeat(30) } }, b); return window.__tree.nameOf(b); }, bid).then((n) => /^친구\d+$/.test(n)));
    await T(B, () => window.__names.set('산타'));
    await T(B, () => window.__tree.setLook({ gender: 'm' })); // 다시 알린다
    await until(async () => (await T(A, (b) => window.__tree.nameOf(b), bid)) === '산타', 4000);

    /* 1인칭, 다른 층 */
    await T(A, () => window.__tree.setPov(true)); await sleep(400);
    t = await tags(A);
    check('1인칭에서는 내 이름표가 안 보이고(친구 것은 그대로 규칙대로)', !t.me && (await T(A, () => window.__tree.eyeOn)), t);
    await T(A, () => window.__tree.setPov(false)); await sleep(400);
    check('내려다보는 시점으로 돌아오면 다시 보임', !!(await tags(A)).me);
    const up = await T(A, () => window.__tree.FLOOR_DX);
    await stand(C, 2 + up, 1);
    check('다른 층에 간 사람의 이름표는 안 보임 (아바타가 안 보이면 이름표도)', await until(async () => { const o = await T(A, (c) => window.__duo.others.find((q) => q.id === c), cid); return o && !o.shown && !(await tags(A))[cid]; }, 15000), await tags(A));
    await stand(C, 0, 2.5);
    check('같은 층으로 돌아오면 다시 보임', await until(async () => !!(await tags(A))[cid], 15000));

    /* 숨바꼭질: 술래에게는 안 찾힌 사람의 이름표가 안 보임 */
    await until(async () => !(await T(B, () => window.__names.tags.me === undefined)), 6000);
    await T(A, (b) => { const ids = [window.__duo.me, ...window.__duo.others.map((o) => o.id)], k = ids.indexOf(b), r = Math.random; Math.random = () => (k + 0.5) / ids.length; window.__games.start('hide'); Math.random = r; }, bid); // 술래는 B
    await until(async () => { const g = await G(B); return g && g.sk === bid; }, 4000);
    check('숨는 동안 술래에게는 숨는 사람들의 이름표가 안 보임', await until(async () => { const b = await tags(B); return !b.h && !b[cid]; }, 3000), await tags(B));
    check('숨는 사람끼리는 서로의 이름표가 보임', !!(await tags(A))[cid] && !!(await tags(C)).h, await tags(A));
    for (const p of [A, B, C]) await T(p, () => { window.__skip += 21000; });
    await until(async () => (await G(A)).ph === 'seek', 6000);
    await sleep(300);
    check('찾는 동안에도 술래에게는 안 찾힌 사람의 이름표가 안 보임', !(await tags(B)).h && !(await tags(B))[cid] && !!(await tags(B)).me, await tags(B));
    await stand(B, 0.5, 2.5); await sleep(300);
    await T(B, (c) => window.__games.find(c), cid);
    await until(async () => (await G(A)).out.includes(cid), 4000);
    check('찾힌 사람은 술래에게도 이름표가 다시 보임', await until(async () => !!(await tags(B))[cid] && !(await tags(B)).h, 3000), await tags(B));
    const bothOf = () => T(B, (c) => { const n = [...document.querySelectorAll('#nameTags i')].find((e) => e.textContent === '눈사람').getBoundingClientRect(), g = document.querySelector('#gameTags i').getBoundingClientRect(); return { nb: n.bottom, gt: g.top, gtxt: document.querySelector('#gameTags i').textContent }; }, cid);
    await until(async () => { const v = await bothOf(); return v.nb <= v.gt + 1; }, 10000); // 느린 기기에서는 표시가 한두 장면 늦게 따라온다
    const both = await bothOf();
    check('"👀 찾음" 표시와 이름표가 겹치지 않음 (이름표가 그 위)', both.gtxt.includes('찾음') && both.nb <= both.gt + 1, both);
    await shot(B, 'name-hide.png');
    await T(A, () => window.__games.cancel());
    check('판이 끝나면 모두의 이름표가 다시 보임', await until(async () => { const b = await tags(B); return !!b.h && !!b[cid]; }, 4000), await tags(B));

    /* 나감 */
    await C.close();
    check('나간 사람의 이름표는 없어짐', await until(async () => (await T(A, () => document.querySelectorAll('#nameTags i').length)) === 2, 15000));
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass} / ${results.length} 통과`);
  process.exit(pass === results.length ? 0 : 1);
})();
