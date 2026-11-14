// 쓰기 → 접기 → 소원함 → 남은 시간 → 펼치기 → 이뤘어요 → 답장. 실행: cd wish/tests && node flow.test.js
// 시계는 page.clock 으로 움직인다. 화면 사진은 out/ 에 남는다.
const { run, until, sleep } = require('./lib.js');

async function write(page, o) {
  if (o.to != null) await page.fill('#fTo', o.to);
  for (let i = 0; i < o.w.length; i++) { if (i >= 3) await page.click('#addWish'); await page.fill(`#wishes textarea >> nth=${i}`, o.w[i]); }
  if (o.m) await page.fill('#fMsg', o.m);
  if (o.fr != null) await page.fill('#fFr', o.fr);
  if (o.p != null) await page.click(`#papers button:nth-child(${o.p + 1})`);
  if (o.when) await page.click(`#whens button[data-k="${o.when}"]`);
}
const sealed = (page) => until(() => page.evaluate(() => !document.getElementById('mineActs').hidden && document.getElementById('note3').classList.contains('sealed')));
const text = (page, sel) => page.textContent(sel);

run('흐름', 8473, async ({ BASE, check, phone, go, shot }) => {
  /* ── A: 민서가 지우에게 쓴다 (2026년 11월 14일 오전 10시) ── */
  const A = await phone({ at: '2026-11-14T10:00:00+09:00', clip: true });
  await go(A.page);
  check('제목과 놀자방 홈 링크', (await A.page.title()) === '새해 소원 쪽지 | 놀자방' && (await A.page.getAttribute('.top a.pill', 'href')) === '../nolja/' && (await text(A.page, 'footer a')) === '놀자방 홈');
  check('잠금이 완벽하지 않다는 것과 이름·연락처를 받지 않는다는 안내가 있음', (await text(A.page, 'footer')).includes('잠금은 이 화면 안에서만') && (await text(A.page, 'footer')).includes('이름이나 연락처는 받지 않아요'));
  const ext = await A.page.evaluate(() => [...document.querySelectorAll('link[href], script[src], img[src]')].map((e) => e.href || e.src).filter((u) => !u.startsWith(location.origin)));
  check('바깥에서 불러오는 글꼴·그림·스크립트가 없음', ext.length === 0, ext);
  await A.page.click('#foldBtn');
  check('소원을 안 적으면 접히지 않고 안내가 나옴', (await text(A.page, '#wErr')) === '소원을 하나라도 적어 주세요.' && (await A.page.evaluate(() => window.__wish.view)) === 'write');
  await A.page.fill('#wishes textarea >> nth=0', '가'.repeat(80));
  check('소원 한 칸은 60자까지만 적힘', (await A.page.inputValue('#wishes textarea >> nth=0')).length === 60);
  await A.page.fill('#fMsg', '😀'.repeat(130));
  check('덧붙이는 말은 120자까지만 적힘(이모지도 한 글자)', Array.from(await A.page.inputValue('#fMsg')).length === 120 && (await text(A.page, '#msgCnt')) === '120 / 120');
  await A.page.fill('#fMsg', '');
  await A.page.click('#addWish'); await A.page.click('#addWish');
  check('소원 칸은 5개까지', (await A.page.locator('#wishes textarea').count()) === 5 && !(await A.page.isVisible('#addWish')));
  await write(A.page, { to: '지우', fr: '민서', w: ['같이 제주도 한 바퀴 돌기 🚲', '매일 30분씩 책 읽기', '건강하기'], m: '새해에도 잘 부탁해요.\n우리 올해 진짜 잘해 보자!', p: 0 });
  check('기본으로 다가오는 1월 1일 0시가 골라져 있음', (await A.page.getAttribute('#whens button[data-k="ny"]', 'aria-checked')) === 'true' && (await text(A.page, '#whenSum')) === '2027년 1월 1일 (금) 0시에 열려요 · D-48', await text(A.page, '#whenSum'));
  await sleep(300); await shot(A.page, 'write.png');
  await A.page.click('#foldBtn');
  check('접는 동안에는 보내기 버튼이 안 보이고, 다 접히면 도장이 찍히고 버튼이 나옴', (await A.page.isHidden('#mineActs')) && (await sealed(A.page)));
  const played = await A.page.evaluate(() => window.__wish.sfx.played);
  check('접는 소리 두 번, 도장 소리 한 번', played.fold === 2 && played.seal === 1, played);
  const link = A.page.url();
  check('주소가 쪽지 링크(#w=…)로 바뀜', /\/wish\/#w=[A-Za-z0-9_-]{20,}$/.test(link) && !decodeURIComponent(link).includes('제주도'), link);
  check('접힌 쪽지: D-48 과 열리는 날이 보임', (await text(A.page, '#cdBig')) === 'D-48' && (await text(A.page, '#cdSmall')).startsWith('47일 13시간') && (await text(A.page, '#cdWhen')) === '2027년 1월 1일 (금) 0시에 열려요', [await text(A.page, '#cdBig'), await text(A.page, '#cdSmall')]);
  check('소원함 숫자가 1', (await text(A.page, '#boxN')) === '1');
  await sleep(900); await shot(A.page, 'sealed.png');

  // 보내기: 복사, 직접 복사, 공유 창
  await A.page.click('#keepBtn');
  const copied = await A.page.evaluate(() => navigator.clipboard.readText());
  check('"나에게 보관": 링크가 복사되고 풀면 같은 쪽지', copied.startsWith(BASE + '#w=') && (await A.page.evaluate((u) => window.__wish.decode(u.split('#w=')[1]).w[2], copied)) === '건강하기', copied);
  await A.page.evaluate(() => navigator.clipboard.writeText(''));
  await A.page.click('#sendBtn');
  check('"친구·연인에게 보내기": 공유 창이 없으면 링크를 복사하고 알려 줌', (await A.page.evaluate(() => navigator.clipboard.readText())).startsWith(BASE + '#w=') && (await text(A.page, '#toast')).includes('복사했어요'));
  await A.page.evaluate(() => { window.__shared = null; navigator.share = async (d) => { window.__shared = d; }; });
  await A.page.click('#sendBtn');
  const sh = await A.page.evaluate(() => window.__shared);
  check('공유 창이 있으면 공유 창으로 보냄 (링크와 열리는 날)', sh && sh.url.startsWith(BASE + '#w=') && sh.text.includes('2027년 1월 1일'), sh);
  await A.page.evaluate(() => { navigator.share = undefined; navigator.clipboard.writeText = async () => { throw new Error('no'); }; });
  let asked = '';
  A.page.once('dialog', (d) => { asked = d.defaultValue(); d.accept(); });
  await A.page.click('#sendBtn');
  check('복사도 안 되면 링크를 직접 복사하게 보여 줌', asked.startsWith(BASE + '#w=') && (await A.page.inputValue('#manual')).startsWith(BASE + '#w='), asked);

  // 다시 열어도 소원함에 있음
  await A.page.reload(); await until(() => A.page.evaluate(() => !!window.__wish));
  check('새로 고쳐도 같은 쪽지가 접힌 채로 보임 (내가 쓴 쪽지)', (await text(A.page, '#nKicker')) === '내가 쓴 쪽지' && (await text(A.page, '#cdBig')) === 'D-48' && (await A.page.isVisible('#mineActs')));
  await A.page.goto(BASE + '#box'); await A.page.reload(); await until(() => A.page.evaluate(() => !!window.__wish));
  check('소원함에 쪽지가 남아 있음 (받는 사람, D-48, 열리는 날)', (await text(A.page, '#boxList .nm')) === '지우에게 쓴 쪽지' && (await text(A.page, '#boxList .st')) === 'D-482027년 1월 1일 (금) 0시', await text(A.page, '#boxList .st'));
  check('쓰기 칸은 접은 뒤 비워짐', await (async () => { await A.page.click('#tabWrite'); return (await A.page.inputValue('#wishes textarea >> nth=0')) === '' && (await A.page.inputValue('#fTo')) === ''; })());
  await A.page.click('#tabBox'); await A.page.click('#boxList .item a');
  check('소원함에서 누르면 그 쪽지가 열림(아직 접힌 채)', (await until(() => A.page.isVisible('#note3'))) && A.page.url().includes('#w='));

  // 잠금
  await A.page.click('#note3');
  check('잠긴 쪽지를 눌러도 펼쳐지지 않고 언제 열리는지 알려 줌', (await A.page.isHidden('#letter')) && (await text(A.page, '#toast')).includes('아직 열 수 없어요') && (await A.page.isHidden('#openBtn')) && !(await A.page.evaluate(() => window.__wish.cur.opened)));
  check('잠긴 동안에는 소원 글자가 화면에 없음', !(await A.page.evaluate(() => document.body.innerText.includes('제주도'))));
  await A.page.clock.pauseAt(new Date('2026-12-30T23:00:00+09:00')); await A.page.clock.runFor(300);
  check('12월 30일 밤 11시: D-2', (await text(A.page, '#cdBig')) === 'D-2' && (await text(A.page, '#cdSmall')) === '1일 남았어요', [await text(A.page, '#cdBig'), await text(A.page, '#cdSmall')]);
  await A.page.clock.pauseAt(new Date('2026-12-31T10:54:50+09:00')); await A.page.clock.runFor(1000);
  check('마지막 날에는 시:분:초 (10:54:51 → 13:05:09)', (await text(A.page, '#cdBig')) === '13:05:09', await text(A.page, '#cdBig'));
  await A.page.clock.runFor(3000);
  check('초가 흐르면 줄어듦 (13:05:06)', (await text(A.page, '#cdBig')) === '13:05:06', await text(A.page, '#cdBig'));
  await sleep(300); await shot(A.page, 'lastday.png');
  await A.page.clock.pauseAt(new Date('2026-12-31T23:59:58+09:00')); await A.page.clock.runFor(1000);
  check('1초 전(23:59:59): 00:00:01 이고 아직 잠김', (await text(A.page, '#cdBig')) === '00:00:01' && (await A.page.isHidden('#openBtn')) && !(await A.page.evaluate(() => document.getElementById('stage').classList.contains('ready'))), await text(A.page, '#cdBig'));
  await A.page.click('#note3'); await A.page.clock.runFor(100);
  check('1초 전에 눌러도 펼쳐지지 않음', (await A.page.isHidden('#letter')) && !(await A.page.evaluate(() => window.__wish.cur.opened)));
  await A.page.clock.runFor(900);
  const atT = await A.page.evaluate(() => ({ now: new Date().getTime(), ready: document.getElementById('stage').classList.contains('ready'), btn: !document.getElementById('openBtn').hidden, big: document.getElementById('cdBig').textContent }));
  check('정각(1월 1일 0시 0분 0초)이 되는 순간 열 수 있게 바뀌고 빛남', atT.now === +new Date('2027-01-01T00:00:00+09:00') && atT.ready && atT.btn && atT.big === 'D-DAY', atT);
  await sleep(700); await shot(A.page, 'ready.png');

  // 펼치기 (빛나는 쪽지는 위아래로 흔들려서 Playwright 가 멈추기를 기다린다. 기다리지 않고 누른다)
  await A.page.click('#note3', { force: true }); await A.page.clock.runFor(2500);
  check('누르면 펼쳐지고 소원이 보임', (await A.page.isVisible('#letter')) && (await A.page.isHidden('#note3')) && (await A.page.$$eval('#lWishes .tx', (e) => e.map((x) => x.textContent).join('|'))) === '같이 제주도 한 바퀴 돌기 🚲|매일 30분씩 책 읽기|건강하기');
  check('펼친 쪽지에 받는 사람·덧붙이는 말·보낸 사람·열린 날', (await text(A.page, '#lTo')) === 'To. 지우' && (await text(A.page, '#lMsg')) === '새해에도 잘 부탁해요.\n우리 올해 진짜 잘해 보자!' && (await text(A.page, '#lFr')) === 'From. 민서' && (await text(A.page, '#lDate')) === '2027년 1월 1일 (금) 0시에 열린 쪽지');
  check('1월 1일에 열리는 쪽지에는 해돋이가 보임', await A.page.isVisible('#sun'));
  await A.page.clock.runFor(120);
  const ink = await A.page.evaluate(() => { const c = document.getElementById('fx'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  check('펼칠 때 색종이가 날림', ink > 200, ink);
  check('펼치는 소리가 남', (await A.page.evaluate(() => window.__wish.sfx.played.open)) === 1);
  await A.page.clock.resume(); await sleep(900); await shot(A.page, 'opened.png');

  // 이뤘어요
  check('펼친 직후: 이룬 소원 0 / 3', (await text(A.page, '#nTally')) === '이룬 소원 0 / 3');
  await A.page.click('#lWishes li:nth-child(2) .ok');
  check('"이뤘어요"를 누르면 표시되고 1 / 3', (await text(A.page, '#nTally')) === '이룬 소원 1 / 3' && (await A.page.getAttribute('#lWishes li:nth-child(2) .ok', 'aria-pressed')) === 'true');
  await A.page.click('#lWishes li:nth-child(3) .ok');
  await A.page.reload(); await until(() => A.page.evaluate(() => !!window.__wish));
  check('새로 고쳐도 펼친 채이고 이룬 소원 2 / 3 이 남아 있음', (await A.page.isVisible('#letter')) && (await text(A.page, '#nTally')) === '이룬 소원 2 / 3' && (await A.page.$$eval('#lWishes .ok', (b) => b.map((x) => x.getAttribute('aria-pressed')).join())) === 'false,true,true');
  await A.page.click('#lWishes li:nth-child(3) .ok');
  check('다시 누르면 취소됨 (1 / 3)', (await text(A.page, '#nTally')) === '이룬 소원 1 / 3');
  await A.page.click('#toBox');
  check('소원함: "펼쳐 봤어요"와 이룬 소원 1 / 3, 위쪽 합계도 1 / 3', (await until(() => A.page.isVisible('#boxList .item'))) && (await text(A.page, '#boxList .st')) === '펼쳐 봤어요이룬 소원 1 / 3' && (await text(A.page, '#boxTally')) === '이룬 소원 1 / 3', await text(A.page, '#boxList .st'));
  await shot(A.page, 'box.png');

  /* ── B: 지우가 링크를 받는다 (11월 20일) → 답장 ── */
  const B = await phone({ at: '2026-11-20T21:00:00+09:00' });
  await go(B.page, '#' + link.split('#')[1]);
  check('받은 사람: "민서 님이 보낸 쪽지", D-42, 답장 버튼', (await text(B.page, '#nKicker')) === '민서 님이 보낸 쪽지' && (await text(B.page, '#cdBig')) === 'D-42' && (await B.page.isVisible('#replyBtn')) && (await B.page.isHidden('#mineActs')), await text(B.page, '#cdBig'));
  await B.page.click('#note3');
  check('받은 사람도 그날 전에는 펼칠 수 없음', (await B.page.isHidden('#letter')) && !(await B.page.evaluate(() => document.body.innerText.includes('제주도'))));
  await B.page.click('#replyBtn');
  check('답장: 받는 사람·보내는 사람이 채워져 있음', (await until(() => B.page.isVisible('#foldBtn'))) && (await B.page.inputValue('#fTo')) === '민서' && (await B.page.inputValue('#fFr')) === '지우');
  check('답장: 받은 쪽지와 같은 날로 맞춰져 있고 안내가 보임', (await text(B.page, '#whenSum')).startsWith('2027년 1월 1일 (금) 0시에 열려요') && (await text(B.page, '#replyNote')) === '민서 님에게 보내는 답장이에요. 받은 쪽지와 같은 날 열리게 맞춰 뒀어요.', await text(B.page, '#replyNote'));
  await write(B.page, { w: ['민서랑 벚꽃 보러 가기 🌸'], p: 5 });
  await B.page.click('#foldBtn'); await sealed(B.page);
  const reply = B.page.url();
  check('답장도 접혀서 새 링크가 됨 (받는 사람 민서, 같은 날)', reply !== link && (await B.page.evaluate(() => { const c = window.__wish.cur; return c.to === '민서' && c.fr === '지우' && c.t === 202701010000 && c.mine === 1; })));
  check('답장 뒤 소원함에는 받은 쪽지와 쓴 쪽지 둘', (await text(B.page, '#boxN')) === '2');
  await B.page.goto(BASE + '#box'); await until(() => B.page.isVisible('#boxList .item'));
  check('소원함에서 받은 쪽지와 쓴 쪽지가 구분됨', (await B.page.$$eval('#boxList .nm', (e) => e.map((x) => x.textContent).join('|'))) === '민서에게 쓴 쪽지|민서 님이 보낸 쪽지');
  B.page.once('dialog', (d) => d.accept());
  await B.page.click('#boxList .item:nth-child(2) .del');
  check('소원함에서 지울 수 있음', (await B.page.locator('#boxList .item').count()) === 1 && (await text(B.page, '#boxN')) === '1');

  // 설날로 맞춘 쪽지에 답장하면 설날로, 직접 고른 시각이면 그 시각으로
  await B.page.click('#tabWrite');
  await write(B.page, { to: '', fr: '지우', w: ['떡국 두 그릇'], when: 'custom' });
  await B.page.fill('#cDate', '2026-11-20'); await B.page.fill('#cTime', '21:05');
  await B.page.click('#foldBtn'); await sealed(B.page);
  const soon = B.page.url();
  check('5분 뒤로 맞춘 쪽지: 마지막 날이라 시:분:초로 보임', /^00:0[34]:\d\d$/.test(await text(B.page, '#cdBig')), await text(B.page, '#cdBig'));

  /* ── A 가 답장을 받는다 (1월 1일) ── */
  await A.page.goto(BASE + '#' + reply.split('#')[1]); await A.page.reload(); await until(() => A.page.evaluate(() => !!window.__wish));
  check('답장을 받은 쪽: "지우 님이 보낸 쪽지"이고 이미 열 수 있는 날이라 빛남', (await text(A.page, '#nKicker')) === '지우 님이 보낸 쪽지' && (await until(() => A.page.isVisible('#openBtn'))));
  await A.page.click('#openBtn');
  check('답장을 펼치면 지우의 소원이 보임', (await until(() => A.page.isVisible('#letter'))) && (await text(A.page, '#lWishes .tx')) === '민서랑 벚꽃 보러 가기 🌸');
  await A.page.click('#lWishes .ok');
  check('소원을 모두 이루면 축하 문구', (await text(A.page, '#toast')).includes('모두 이뤘어요'));
  await A.page.click('#toBox');
  check('소원함 합계는 펼쳐 본 쪽지를 모두 셈 (2 / 4)', (await until(() => A.page.isVisible('#boxList .item'))) && (await text(A.page, '#boxTally')) === '이룬 소원 2 / 4', await text(A.page, '#boxTally'));
  await A.page.goto(BASE + '#' + soon.split('#')[1]); await A.page.reload(); await until(() => A.page.evaluate(() => !!window.__wish));
  await A.page.click('#replyBtn'); await until(() => A.page.isVisible('#foldBtn'));
  check('이미 지난 날의 쪽지에 답장하면 기본(다가오는 1월 1일)으로', (await A.page.getAttribute('#whens button[data-k="ny"]', 'aria-checked')) === 'true' && (await text(A.page, '#replyNote')) === '지우 님에게 보내는 답장이에요.', await text(A.page, '#replyNote'));
  await A.ctx.close(); await B.ctx.close();

  /* ── 1월 1일이 아닌 날에 열리는 쪽지에는 해돋이가 없다 ── */
  const C = await phone({ at: '2027-01-20T09:00:00+09:00', calm: true });
  await go(C.page);
  await write(C.page, { w: ['세뱃돈 저금하기'], when: 'seol', p: 3 });
  const t0 = Date.now(); await C.page.click('#foldBtn'); await sealed(C.page);
  check('움직임 줄이기를 켠 사람: 접는 움직임 없이 바로 접힘', Date.now() - t0 < 1200, Date.now() - t0);
  check('설날 쪽지: D-18', (await text(C.page, '#cdBig')) === 'D-18', await text(C.page, '#cdBig'));
  await C.page.clock.setSystemTime(new Date('2027-02-07T00:00:00+09:00'));
  await until(() => C.page.isVisible('#openBtn')); await C.page.click('#openBtn'); await until(() => C.page.isVisible('#letter'));
  check('설날에 펼치면 해돋이는 없고, 받는 사람을 비운 쪽지는 "To. 나에게"', (await C.page.isHidden('#sun')) && (await text(C.page, '#lTo')) === 'To. 나에게');
  const ink2 = await C.page.evaluate(() => { const c = document.getElementById('fx'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  check('움직임 줄이기를 켠 사람에게는 색종이를 날리지 않음', ink2 === 0, ink2);
  await C.ctx.close();

  /* ── 좁은 폰·넓은 폰, 누르는 곳 크기, 키보드 ── */
  for (const w of [360, 390, 430]) {
    const P = await phone({ w, h: 780, at: '2026-11-14T10:00:00+09:00' });
    await go(P.page);
    const probe = () => P.page.evaluate(() => {
      const small = [], out = [];
      for (const e of document.querySelectorAll('button, a, input, textarea')) {
        const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
        if (r.height < 43.5 || r.width < 43.5) small.push((e.id || e.className || e.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        if (r.left < -0.5 || r.right > innerWidth + 0.5) out.push(e.id || e.className || e.tagName);
      }
      return { small, out, over: document.documentElement.scrollWidth - innerWidth };
    });
    let r = await probe();
    check(`${w}px 쓰기 화면: 옆으로 넘치지 않고 누르는 곳이 44px 이상`, r.over <= 0 && !r.small.length && !r.out.length, r);
    await P.page.click('#whens button[data-k="custom"]'); r = await probe();
    check(`${w}px 직접 고르기 칸도 넘치지 않음`, r.over <= 0 && !r.small.length && !r.out.length, r);
    await P.page.click('#whens button[data-k="ny"]');
    await write(P.page, { to: '가나다라마바사아자차카타', fr: '가나다라마바사아자차카타', w: ['가'.repeat(60), 'W'.repeat(60), '🎉'.repeat(60)], m: 'M'.repeat(120) });
    await P.page.click('#foldBtn'); await sealed(P.page); r = await probe();
    check(`${w}px 접힌 쪽지 화면: 넘치지 않고 누르는 곳이 44px 이상`, r.over <= 0 && !r.small.length && !r.out.length, r);
    await P.page.clock.setSystemTime(new Date('2027-01-01T00:00:00+09:00'));
    await until(() => P.page.isVisible('#openBtn')); await P.page.click('#openBtn'); await until(() => P.page.isVisible('#letter')); await sleep(700); r = await probe();
    check(`${w}px 펼친 쪽지: 긴 글자(띄어쓰기 없는 60자)도 넘치지 않음`, r.over <= 0 && !r.small.length && !r.out.length, r);
    if (w === 360) await shot(P.page, 'opened-360-long.png');
    await P.page.click('#toBox'); await until(() => P.page.isVisible('#boxList .item')); r = await probe();
    check(`${w}px 소원함: 넘치지 않고 누르는 곳이 44px 이상`, r.over <= 0 && !r.small.length && !r.out.length, r);
    await P.ctx.close();
  }
  // 키보드가 올라오면 보이는 화면이 줄어든다: 낮은 화면에서 맨 아래 칸을 눌러 본다
  const K = await phone({ w: 390, h: 844 });
  await go(K.page);
  await K.page.setViewportSize({ width: 390, height: 440 });
  for (const sel of ['#fMsg', '#fFr', '#wishes textarea >> nth=2']) {
    await K.page.locator(sel).focus(); await sleep(900);
    const bb = await K.page.locator(sel).boundingBox();
    check(`키보드가 올라온 만큼 낮은 화면(440px)에서 ${sel} 칸이 화면 안에 보임`, bb.y >= 40 && bb.y + bb.height <= 440 - 40, bb);
  }
  await K.page.locator('#wishes textarea >> nth=0').fill('첫 소원'); await K.page.locator('#wishes textarea >> nth=0').press('Enter');
  check('소원 칸에서 엔터를 누르면 줄이 바뀌지 않고 다음 칸으로', (await K.page.inputValue('#wishes textarea >> nth=0')) === '첫 소원' && (await K.page.evaluate(() => document.activeElement === document.querySelectorAll('#wishes textarea')[1])));
  await K.page.click('#snd');
  check('소리 끄기 버튼: 끄면 접어도 소리를 내지 않음', await (async () => { await K.page.click('#foldBtn'); await sealed(K.page); const p = await K.page.evaluate(() => window.__wish.sfx.played); return !p.fold && !p.seal && (await K.page.getAttribute('#snd', 'aria-label')) === '소리 켜기'; })());
  await K.ctx.close();
});
