// 쪽지 링크(#w=…)와 저장소 검사. 실행: cd wish/tests && node link.test.js
// 한글·이모지·글자 수 끝까지 채운 쪽지가 링크를 오가도 그대로인지, 망가진 링크와 망가진 저장소를 견디는지 본다.
const { run, until, sleep } = require('./lib.js');
const KEY = 'nolja.wish.box.v1';

run('링크', 8472, async ({ BASE, check, phone, go }) => {
  const { page, ctx } = await phone({ at: '2026-11-14T10:00:00+09:00' });
  await go(page);
  const trip = (n) => page.evaluate((n) => { const W = window.__wish, c = W.encode(n); return { c, back: W.decode(c) }; }, n);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const ko = { id: 'abc12345', to: '지우', fr: '민서', w: ['같이 제주도 한 바퀴 돌기', '매일 30분씩 책 읽기'], m: '새해에도 잘 부탁해요.\n우리 올해 진짜 잘해 보자!', p: 3, t: 202701010000 };
  let r = await trip(ko);
  check('한글 쪽지가 링크를 오가도 그대로', same(r.back, ko), r.back);
  check('링크 글자는 주소에 안전한 것만(A-Z a-z 0-9 - _)', /^[A-Za-z0-9_-]+$/.test(r.c), r.c);
  const plainB64 = Buffer.from(JSON.stringify(ko)).toString('base64');
  const peek = Buffer.from(r.c.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  check('주소를 흘끗 봐서는 읽히지 않음 (그냥 base64 가 아니고, 풀어도 한글이 안 보임)', !r.c.includes(plainB64.slice(8, 40)) && !peek.includes('제주도') && !peek.includes('지우'));
  const twice = await page.evaluate((n) => [window.__wish.encode(n), window.__wish.encode(n), window.__wish.encode(n)], ko);
  check('같은 쪽지도 접을 때마다 링크 모양이 달라짐', new Set(twice).size > 1);

  const emo = { id: 'emoji001', to: '🐰토끼', fr: '🦊', w: ['🚲 자전거 여행 🌊', '👨‍👩‍👧 가족 사진 찍기', '한글+English+日本語 섞어 쓰기 ✨'], m: '💌 잘 지내요? 🎉🎊', p: 5, t: 202702070000 };
  r = await trip(emo);
  check('이모지·여러 나라 글자가 그대로', same(r.back, emo), r.back);

  const full = { id: 'zzzzzzzzzzzz', to: '가'.repeat(12), fr: '🎍'.repeat(12), w: Array.from({ length: 5 }, (_, i) => '소원🎉'.repeat(20).slice(0, -2) + i), m: '😀'.repeat(120), p: 4, t: 203612312359 };
  full.w = full.w.map((w) => Array.from(w).slice(0, 60).join(''));
  r = await trip(full);
  check('글자 수를 끝까지 채운 쪽지(소원 5개×60자, 덧붙이는 말 120자)가 그대로', same(r.back, full) && Array.from(r.back.w[0]).length === 60 && Array.from(r.back.m).length === 120);
  check('가장 긴 링크도 4000자 안쪽', r.c.length <= 4000, r.c.length);
  await page.goto(BASE + '#w=' + r.c); await page.reload(); await until(() => page.evaluate(() => !!window.__wish));
  check('가장 긴 링크가 실제 주소로 열림', (await page.evaluate(() => window.__wish.view)) === 'note' && (await page.evaluate(() => window.__wish.cur.id)) === 'zzzzzzzzzzzz');

  const over = await page.evaluate(() => { const W = window.__wish; return W.decode(W.encode({ id: 'over0001', to: '가'.repeat(40), fr: ' 민서\n민서 ', w: ['나'.repeat(200), '', '   ', '줄\n바꿈', 'a', 'b', 'c', 'd'], m: '다'.repeat(500), p: 99, t: 202701010000, extra: 'x' })); });
  check('넘치는 글자는 잘리고 빈 소원은 빠짐', over && Array.from(over.to).length === 12 && over.fr === '민서 민서' && over.w.length === 5 && Array.from(over.w[0]).length === 60 && over.w[1] === '줄 바꿈' && Array.from(over.m).length === 120 && over.p === 0 && !('extra' in over), over);
  const none = await page.evaluate(() => { const W = window.__wish; const bad = []; for (const n of [{ id: 'nowish01', w: [], t: 202701010000 }, { id: 'nowish01', w: ['a'], t: 202702300000 }, { id: 'BAD ID!!', w: ['a'], t: 202701010000 }, null, 'x']) { try { W.encode(n); bad.push('ok'); } catch (_) { bad.push('throw'); } } return bad; });
  check('소원이 없거나 날짜·번호가 틀린 쪽지는 링크로 만들지 않음', none.every((x) => x === 'throw'), none);

  // 한 글자씩 바꿔 본다. 내용이 달라진 채로 읽히면 안 된다(끝 글자의 남는 비트만 바뀐 경우는 같은 쪽지).
  const tam = await page.evaluate((n) => {
    const W = window.__wish, rnd = Math.random; Math.random = () => 0.37;
    const c = W.encode(n); Math.random = rnd;
    const want = JSON.stringify(W.decode(c)), abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let nul = 0, sameN = 0, wrong = 0;
    for (let i = 0; i < c.length; i++) for (const k of [1, 17, 40]) {
      const ch = abc[(abc.indexOf(c[i]) + k) % 64], d = W.decode(c.slice(0, i) + ch + c.slice(i + 1));
      if (d === null) nul++; else if (JSON.stringify(d) === want) sameN++; else wrong++;
    }
    let cut = 0; for (let i = 1; i < c.length; i++) if (W.decode(c.slice(0, i)) !== null) cut++;
    return { nul, sameN, wrong, cut, len: c.length };
  }, ko);
  check('글자가 하나라도 바뀐 링크는 읽지 않음', tam.wrong === 0 && tam.nul >= tam.len * 3 - 3, tam);
  check('잘린 링크는 읽지 않음', tam.cut === 0, tam);
  const junk = await page.evaluate(() => { const W = window.__wish; return [undefined, null, 12, '', 'short', '!!!!!!!!!!!!!!!!', 'A'.repeat(4001), 'AAAAAAAAAAAAAAAAAAAA', '%E0%A4%A', 'AQEBAQEBAQEBAQEBAQEB', '=='.repeat(10)].map((x) => W.decode(x)); });
  check('엉뚱한 값(빈 값, 숫자, 이상한 글자, 너무 긴 값)은 모두 null', junk.every((x) => x === null), junk);
  await ctx.close();

  // 받는 사람 기기에서 링크 열기
  const good = (await (async () => { const a = await phone({ at: '2026-11-14T10:00:00+09:00' }); await go(a.page); const c = await a.page.evaluate((n) => window.__wish.encode(n), Object.assign({}, ko, { w: ['<img src=x onerror="window.__xss=1">', '<b>굵게</b> 되면 안 돼요'] })); await a.ctx.close(); return c; })());
  const b = await phone({ at: '2026-11-14T10:00:00+09:00' });
  await go(b.page, '#w=' + good);
  check('받은 링크: 접힌 쪽지와 보낸 사람, 받는 사람이 보임', (await b.page.isVisible('#note3')) && (await b.page.textContent('#nKicker')) === '민서 님이 보낸 쪽지' && (await b.page.textContent('#nTo')) === 'To. 지우');
  check('받은 링크: 잠긴 동안에는 소원 글자가 화면 어디에도 없음', !(await b.page.evaluate(() => document.body.innerHTML.includes('굵게'))));
  check('받은 쪽지는 이 기기 소원함에 담김', (await b.page.textContent('#boxN')) === '1');
  await b.page.clock.setSystemTime(new Date('2027-01-01T00:00:05+09:00'));
  await until(() => b.page.isVisible('#openBtn')); await b.page.click('#openBtn');
  await until(() => b.page.isVisible('#letter'));
  const txt = await b.page.$$eval('#lWishes .tx', (e) => e.map((x) => x.textContent));
  check('꺾쇠가 든 소원은 글자 그대로 보이고 실행되지 않음', txt[0] === '<img src=x onerror="window.__xss=1">' && txt[1] === '<b>굵게</b> 되면 안 돼요' && (await b.page.evaluate(() => !window.__xss && !document.querySelector('#letter img, #letter b'))), txt);
  await b.ctx.close();

  // 망가진 링크
  const c = await phone({ at: '2026-11-14T10:00:00+09:00' });
  const bad = async (hash) => { await c.page.goto(BASE + 'index.html?' + Math.random() + hash); await until(() => c.page.evaluate(() => !!window.__wish)); return (await c.page.isVisible('#scrBad')) && (await c.page.textContent('#scrBad h2')) === '쪽지를 읽을 수 없어요' && !(await c.page.isVisible('#note3')); };
  const mid = good.slice(0, 30) + (good[30] === 'A' ? 'B' : 'A') + good.slice(31);
  check('글자가 바뀐 링크 → "쪽지를 읽을 수 없어요"', await bad('#w=' + mid));
  check('잘린 링크 → "쪽지를 읽을 수 없어요"', await bad('#w=' + good.slice(0, good.length - 9)));
  check('엉뚱한 글자 링크 → "쪽지를 읽을 수 없어요"', await bad('#w=%EC%95%88%EB%85%95<script>alert(1)</script>'));
  check('빈 링크(#w=) → "쪽지를 읽을 수 없어요"', await bad('#w='));
  check('너무 긴 링크(2만 자) → "쪽지를 읽을 수 없어요"', await bad('#w=' + 'A'.repeat(20000)));
  check('읽을 수 없는 화면에서 새 쪽지 쓰기로 갈 수 있음', await (async () => { await c.page.click('#scrBad a.main'); return until(() => c.page.isVisible('#foldBtn')); })());
  check('망가진 링크는 소원함에 아무것도 남기지 않음', (await c.page.evaluate((k) => localStorage.getItem(k), KEY)) === null);
  await c.page.goto(BASE + '?x=1#something-else'); await until(() => c.page.evaluate(() => !!window.__wish));
  check('쪽지 링크가 아닌 # 은 그냥 쓰기 화면', await c.page.isVisible('#foldBtn'));
  await c.ctx.close();

  // 망가진 저장소
  const d = await phone({ at: '2026-11-14T10:00:00+09:00' });
  const withBox = async (value) => { await d.page.goto(BASE + '?' + Math.random()); await d.page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, value]); await d.page.goto(BASE + '?' + Math.random() + '#box'); await until(() => d.page.evaluate(() => !!window.__wish)); };
  const items = () => d.page.$$eval('#boxList .item .nm', (e) => e.map((x) => x.textContent));
  await withBox('{{{ not json');
  check('저장소가 깨진 글자여도 화면이 뜨고 빈 소원함으로 보임', (await d.page.isVisible('#boxEmpty')) && (await items()).length === 0);
  for (const [name, v] of [['숫자', '42'], ['null', 'null'], ['객체', '{"a":1}'], ['글자', '"hello"'], ['이상한 배열', '[1,null,"x",[],{"id":5},{"w":["a"]}]']]) {
    await withBox(v);
    check(`저장소 값이 ${name}여도 빈 소원함으로 보임`, (await d.page.isVisible('#boxEmpty')) && (await items()).length === 0);
  }
  const okE = { id: 'keepme01', to: '지우', fr: '', w: ['살아남기'], m: '', p: 1, t: 202701010000, mine: 1, opened: 0, done: [0], at: 1 };
  await withBox(JSON.stringify([{ id: 'x' }, okE, Object.assign({}, okE), { id: 'badwhen1', w: ['a'], t: 'soon' }, Object.assign({}, okE, { id: 'weird002', done: 'yes', opened: 'maybe', p: -4, w: ['<i>x</i>', 7, null, '둘'] })]));
  let it = await items();
  check('망가진 항목은 버리고 멀쩡한 쪽지만 보임 (겹친 것은 하나로)', it.length === 2 && it[0] === '지우에게 쓴 쪽지', it);
  const weird = await d.page.evaluate(() => window.__wish.box.find('weird002'));
  check('반쯤 망가진 항목은 다듬어서 씀', weird && weird.p === 0 && same(weird.w, ['<i>x</i>', '둘']) && same(weird.done, [0, 0]) && weird.opened === 1, weird);
  await withBox(JSON.stringify(Array.from({ length: 500 }, (_, i) => Object.assign({}, okE, { id: 'many' + String(i).padStart(4, '0') }))));
  check('항목이 너무 많으면 60개까지만 씀', (await items()).length === 60);
  await withBox('{{{');
  await d.page.goto(BASE + '?' + Math.random()); await until(() => d.page.evaluate(() => !!window.__wish));
  await d.page.fill('#wishes textarea >> nth=0', '망가진 뒤에도 쓰기'); await d.page.click('#foldBtn');
  await until(() => d.page.isVisible('#mineActs'));
  const saved = await d.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  check('저장소가 깨져 있어도 새 쪽지를 접으면 다시 정상으로 저장됨', Array.isArray(saved) && saved.length === 1 && saved[0].w[0] === '망가진 뒤에도 쓰기', saved);
  await d.ctx.close();

  // 저장소를 아예 못 쓰는 브라우저
  const e = await phone({ at: '2026-11-14T10:00:00+09:00' });
  await e.page.addInitScript(() => { const boom = () => { throw new Error('denied'); }; Storage.prototype.getItem = boom; Storage.prototype.setItem = boom; });
  await go(e.page);
  await e.page.fill('#wishes textarea >> nth=0', '저장 없이도'); await e.page.click('#foldBtn');
  check('저장소를 못 쓰는 브라우저에서도 접히고 링크가 나옴', (await until(() => e.page.isVisible('#mineActs'))) && /#w=[A-Za-z0-9_-]{12,}$/.test(e.page.url()));
  await e.ctx.close();
  await sleep(50);
});
