// 열리는 날 계산 검사. 실행: cd wish/tests && node dates.test.js
// dates.js 의 작은 함수들을 브라우저 안에서 불러 값만 확인하고, 해가 바뀌는 밤의 화면도 본다.
const { run, until } = require('./lib.js');

run('날짜', 8471, async ({ check, phone, go }) => {
  const { page, ctx } = await phone();
  await go(page);
  // 날짜는 YYYYMMDDHHmm 숫자로 바꿔서 받는다
  const calc = (fn, ...a) => page.evaluate(([fn, a]) => {
    const D = window.__wish.D, d = (s) => new Date(s);
    const r = D[fn](...a.map((x) => (typeof x === 'string' && /^\d{4}-/.test(x) && x.length > 10 ? d(x) : x)));
    return r instanceof Date ? D.toStamp(r) : r;
  }, [fn, a]);

  check('새해 첫날: 11월 14일 → 다음 해 1월 1일 0시', (await calc('nextNewYear', '2026-11-14T10:00:00')) === 202701010000);
  check('새해 첫날: 12월 31일 23:59:59 → 1초 뒤의 1월 1일', (await calc('nextNewYear', '2026-12-31T23:59:59')) === 202701010000);
  check('새해 첫날: 1월 1일 0시 정각 → 그다음 해 1월 1일', (await calc('nextNewYear', '2027-01-01T00:00:00')) === 202801010000);
  check('설날: 2026년 11월 → 2027년 2월 7일', (await calc('nextSeollal', '2026-11-14T10:00:00')) === 202702070000);
  check('설날: 전날 밤 → 그날 0시', (await calc('nextSeollal', '2027-02-06T23:59:00')) === 202702070000);
  check('설날: 설날 당일 → 다음 해 설날(2028년 1월 27일)', (await calc('nextSeollal', '2027-02-07T00:00:00')) === 202801270000);
  check('설날: 2028년 12월 → 2029년 2월 13일', (await calc('nextSeollal', '2028-12-31T12:00:00')) === 202902130000);
  check('설날: 표에 없는 해는 null', (await calc('nextSeollal', '2036-03-01T00:00:00')) === null);
  check('100일 뒤: 11월 14일 → 해를 넘겨 2월 22일 0시', (await calc('plusDays', '2026-11-14T10:00:00', 100)) === 202702220000);
  check('1일 뒤: 12월 31일 → 1월 1일', (await calc('plusDays', '2026-12-31T23:30:00', 1)) === 202701010000);
  check('100일 뒤: 윤년 2월을 지나도 맞음 (2027-12-01 → 2028-03-10)', (await calc('plusDays', '2027-12-01T08:00:00', 100)) === 202803100000);
  check('1년 뒤: 11월 14일 → 다음 해 11월 14일 0시', (await calc('plusYear', '2026-11-14T10:00:00')) === 202711140000);
  check('1년 뒤: 2월 29일 → 2월 28일', (await calc('plusYear', '2028-02-29T10:00:00')) === 202902280000);
  check('직접 고르기: 날짜와 시각', (await calc('customDate', '2027-03-14', '09:30')) === 202703140930);
  check('직접 고르기: 없는 날(2월 30일)은 null', (await calc('customDate', '2027-02-30', '00:00')) === null);
  check('직접 고르기: 엉뚱한 글자는 null', (await calc('customDate', 'abc', '00:00')) === null && (await calc('customDate', '2027-03-14', '25:00')) === null);

  const stamps = await page.evaluate(() => { const D = window.__wish.D; return [202701010000, 202702300000, 202713010000, 2027.5, '202701010000', 999, 202701012460, null].map((n) => { const d = D.fromStamp(n); return d ? D.toStamp(d) : null; }); });
  check('시각 숫자: 맞는 것만 날짜가 됨', JSON.stringify(stamps) === JSON.stringify([202701010000, null, null, null, null, null, null, null]), stamps);

  const lock = await page.evaluate(() => { const D = window.__wish.D, t = new Date(2027, 0, 1, 0, 0, 0, 0); return [D.isUnlocked(t, +t - 1), D.isUnlocked(t, +t), D.isUnlocked(t, +t + 1), D.isUnlocked(t, new Date(2026, 10, 14))]; });
  check('잠금: 1밀리초 전에는 잠김, 정각부터 열림', JSON.stringify(lock) === '[false,true,true,false]', lock);

  const cd = (target, now) => page.evaluate(([t, n]) => window.__wish.D.countdownText(new Date(t), new Date(n)), [target, now]);
  let c = await cd('2027-01-01T00:00:00', '2026-11-14T10:00:00');
  check('남은 시간: 11월 14일 10시 → D-48, 47일 14시간', c.big === 'D-48' && c.small === '47일 14시간 남았어요', c);
  c = await cd('2027-01-01T00:00:00', '2026-12-30T23:00:00');
  check('남은 시간: 25시간 전 → D-2', c.big === 'D-2' && c.small === '1일 1시간 남았어요', c);
  c = await cd('2027-01-01T00:00:00', '2026-12-31T00:00:00');
  check('남은 시간: 딱 24시간 전부터 시:분:초', c.big === '24:00:00', c);
  c = await cd('2027-01-01T00:00:00', '2026-12-31T10:54:51');
  check('남은 시간: 마지막 날 13:05:09', c.big === '13:05:09', c);
  c = await cd('2027-01-01T00:00:00', '2026-12-31T23:59:59.500');
  check('남은 시간: 0.5초 전에는 00:00:01', c.big === '00:00:01', c);
  c = await cd('2027-01-01T00:00:00', '2027-01-01T00:00:00');
  check('남은 시간: 정각에는 D-DAY', c.big === 'D-DAY', c);
  const pick = await page.evaluate(() => { const D = window.__wish.D, now = new Date(2026, 10, 14, 10); return [D.pickable(new Date(2026, 10, 14, 9), now), D.pickable(new Date(2026, 10, 14, 10, 1), now), D.pickable(new Date(2040, 0, 1), now), D.pickable(null, now)]; });
  check('고를 수 있는 날: 지난 때·너무 먼 때·빈 값은 안 됨', JSON.stringify(pick) === '[false,true,false,false]', pick);
  await ctx.close();

  // 화면: 12월 31일 밤 11시 50분
  const a = await phone({ at: '2026-12-31T23:50:00+09:00' });
  await go(a.page);
  const chips = () => a.page.$$eval('#whens button', (bs) => bs.map((b) => b.dataset.k + ':' + b.querySelector('small').textContent));
  let ch = await chips();
  check('12월 31일 밤: 새해 첫날은 내일(2027년 1월 1일), 설날은 2027년 2월 7일', ch[0] === 'ny:2027년 1월 1일' && ch[1] === 'seol:2027년 2월 7일', ch);
  check('12월 31일 밤: 100일 뒤 2027년 4월 10일, 1년 뒤 2027년 12월 31일', ch[2] === 'd100:2027년 4월 10일' && ch[3] === 'y1:2027년 12월 31일', ch);
  const sum = await a.page.textContent('#whenSum');
  check('12월 31일 밤: 기본은 새해 첫날이고 남은 시간이 시:분:초로 보임', /^2027년 1월 1일 \(금\) 0시에 열려요 · 00:\d\d:\d\d$/.test(sum), sum);
  await a.page.fill('#wishes textarea >> nth=0', '해돋이 보기');
  await a.page.click('#foldBtn');
  check('12월 31일 밤에 접은 쪽지는 2027년 1월 1일 0시에 열림', (await a.page.evaluate(() => window.__wish.cur.t)) === 202701010000);
  await a.ctx.close();

  // 화면: 해가 바뀐 직후
  const b = await phone({ at: '2027-01-01T00:00:30+09:00' });
  await go(b.page);
  ch = await b.page.$$eval('#whens button', (bs) => bs.map((x) => x.dataset.k + ':' + x.querySelector('small').textContent));
  check('1월 1일 새벽: 새해 첫날은 2028년 1월 1일, 설날은 2027년 2월 7일', ch[0] === 'ny:2028년 1월 1일' && ch[1] === 'seol:2027년 2월 7일', ch);
  await b.page.click('#whens button[data-k="seol"]');
  check('설날을 고르면 요약이 바뀜 (2027년 2월 7일 일요일, D-37)', (await b.page.textContent('#whenSum')) === '2027년 2월 7일 (일) 0시에 열려요 · D-37', await b.page.textContent('#whenSum'));
  await b.page.click('#whens button[data-k="custom"]');
  await b.page.fill('#cDate', '2026-12-25');
  await b.page.fill('#wishes textarea >> nth=0', '지난 날 소원');
  check('직접 고르기: 지난 날을 넣으면 안내가 나옴', (await b.page.textContent('#whenSum')).includes('앞으로 올 날'));
  await b.page.click('#foldBtn');
  check('지난 날로는 접을 수 없음', (await b.page.textContent('#wErr')).includes('앞으로 올 날') && (await b.page.evaluate(() => window.__wish.view)) === 'write');
  await b.page.fill('#cDate', '2027-03-14'); await b.page.fill('#cTime', '09:30');
  check('직접 고르기: 날짜와 시각이 요약에 보임', (await b.page.textContent('#whenSum')).startsWith('2027년 3월 14일 (일) 9시 30분에 열려요'), await b.page.textContent('#whenSum'));
  await b.page.click('#foldBtn');
  check('직접 고른 날로 접힘', await until(() => b.page.evaluate(() => window.__wish.cur && window.__wish.cur.t === 202703140930)));
  await b.ctx.close();

  // 표에 없는 먼 해: 설날 고르기가 없음
  const f = await phone({ at: '2036-06-01T12:00:00+09:00' });
  await go(f.page);
  check('설날 표가 끝난 해에는 설날 고르기를 숨김', (await f.page.$$eval('#whens button', (bs) => bs.map((x) => x.dataset.k).join())) === 'ny,d100,y1,custom');
  await f.ctx.close();
});
