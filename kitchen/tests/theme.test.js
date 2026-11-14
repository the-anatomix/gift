// 계절 판(크리스마스 판) 검사. 실행: cd kitchen/tests && node theme.test.js
// 날짜는 브라우저 시계를 고정해서 바꾼다(page.clock.setFixedTime). 화면 사진은 out/theme-*.png
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8149, BASE = `http://localhost:${PORT}/kitchen/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 10000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(80); } }
const JULY = '2026-07-10T12:00:00', DEC = '2026-12-10T12:00:00';
// when: 고정할 날짜(현지 시각). 주방이 다 뜰 때까지 기다린다
async function open(ctx, when, tail) {
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('   (페이지 오류)', e.message));
  await p.clock.setFixedTime(new Date(when));
  await p.goto(BASE + (tail || ''));
  await until(() => p.evaluate(() => !!(window.__kitchen && window.__duo && window.__gift && window.__brag)));
  await sleep(700);
  return p;
}
const look = (p) => p.evaluate(() => { const K = window.__kitchen, cs = getComputedStyle(document.documentElement);
  return { id: K.themeId, name: K.theme, tag: document.getElementById('season').hidden ? '' : document.getElementById('season').textContent,
    choc: cs.getPropertyValue('--choc').trim(), data: document.documentElement.dataset.theme, room: K.season().room, stage: K.season().stage }; });
const audit = (p) => p.evaluate(() => {
  const bad = [];
  for (const b of document.querySelectorAll('button, a, input, textarea')) {
    const r = b.getBoundingClientRect();
    if (!r.width || b.closest('[hidden]') || b.closest('#labels.off') || b.closest('#fallback') || getComputedStyle(b).display === 'none') continue;
    const name = (b.textContent || b.getAttribute('aria-label') || b.id || '').trim();
    if (r.width < 44 || r.height < 44) bad.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) bad.push(`${name}: 화면 밖`);
  }
  return bad;
});
// 꾸민 과자를 포장하고 편지를 적은 뒤 선물 링크를 만든다
async function makeGift(p, box) {
  await p.evaluate((box) => { const K = window.__kitchen; K.dispatch({ t: 'st', s: 'oven', d: { start: 1 } }); K.dispatch({ t: 'st', s: 'oven', d: { out: 0.65 } });
    K.dispatch({ t: 'coat', c: 3, len: 0.45 }); K.dispatch({ t: 'text', v: '메리' }); K.dispatch({ t: 'tcolor', c: 3 });
    for (let i = 0; i < 20; i++) K.dispatch({ t: 'grain', k: 0, s: 0.05 + i * 0.02, u: (i % 3 - 1) * 0.02, sp: i, sc: 1, c: i % 5, st: K.me + '1', id: K.me + '1.' + i });
    K.dispatch({ t: 'go', s: 'pack' }); K.dispatch({ t: 'st', s: 'pack', d: { box } }); K.dispatch({ t: 'st', s: 'pack', d: { pack: 1, seal: 0 } });
    document.getElementById('ltTo').value = '사랑하는 지우에게'; document.getElementById('ltFrom').value = '민서가'; document.getElementById('ltMsg').value = '메리 크리스마스!';
  }, box);
  await until(() => p.evaluate(() => window.__kitchen.getState().x.pack.packed === 1));
  return p.evaluate(() => window.__gift.giftUrl());
}
const decode = (url) => JSON.parse(Buffer.from(url.split('#g=')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
const tailOf = (url) => url.slice(BASE.length);

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const shot = (p, n) => p.screenshot({ path: path.join(__dirname, 'out', `theme-${n}.png`) });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    console.log('── 날짜로 고르기 ──');
    const J = await open(ctx, JULY);
    const pure = await J.evaluate(async () => { const T = await import('./theme.js'); const d = (m, day) => T.seasonOf(new Date(2026, m, day, 12));
      return { nov30: d(10, 30), dec1: d(11, 1), dec25: d(11, 25), dec26: d(11, 26), jan1: d(0, 1),
        url: T.themeId('?theme=base', '', new Date(2026, 11, 10)), url2: T.themeId('?theme=xmas', '', new Date(2026, 6, 10)), odd: T.themeId('?theme=nope', '', new Date(2026, 6, 10)),
        bad: T.themeId('', '#g=AAAAAAAAAAAA', new Date(2026, 11, 10)), room: T.themeId('', '#r=abc', new Date(2026, 11, 10)) }; });
    check('날짜 함수: 11/30 기본, 12/1·12/25 크리스마스, 12/26·1/1 기본', pure.nov30 === 'base' && pure.dec1 === 'xmas' && pure.dec25 === 'xmas' && pure.dec26 === 'base' && pure.jan1 === 'base', pure);
    check('고르는 순서: ?theme= 이 날짜보다 먼저, 모르는 이름은 무시, 읽지 못한 선물 링크는 기본 판', pure.url === 'base' && pure.url2 === 'xmas' && pure.odd === 'base' && pure.bad === 'base' && pure.room === 'xmas', pure);
    const lj = await look(J);
    check('7월: 기본 판, 이름표 없음, 계절 소품 없음', lj.id === 'base' && lj.name === '기본' && lj.tag === '' && lj.choc.toUpperCase() === '#5A3824' && lj.room.length === 0, lj);
    check('기본 판: 쉬는 동안에는 그리지 않음', (await J.evaluate(async () => { const K = window.__kitchen, a = K.frames + K.propFrames; await new Promise((r) => setTimeout(r, 1200)); return K.frames + K.propFrames - a; })) === 0);
    check('기본 판 상자·글자색은 그대로 (크림·빨강·초콜릿·분홍)', await J.evaluate(async () => { const K = window.__kitchen; K.dispatch({ t: 'go', s: 'pack' }); await new Promise((r) => setTimeout(r, 300));
      return Array.from(document.querySelectorAll('#panel .sw span')).map((s) => s.textContent).join() === '크림,빨강,초콜릿,분홍'; }));
    await shot(J, 'base-july');

    const D = await open(ctx, DEC);
    const ld = await look(D);
    check('12월 10일: 주소에 아무것도 없어도 크리스마스 판', ld.id === 'xmas' && ld.data === 'xmas' && ld.choc.toUpperCase() === '#1F5A41', ld);
    check('"크리스마스 판" 이름표가 보임', ld.tag.includes('크리스마스 판') && (await D.isVisible('#season')), ld.tag);
    check('소품: 트리·리스·꼬마전구·눈 내리는 창이 장면에 있음', ['tree', 'wreath', 'lights', 'snow'].every((n) => ld.room.includes(n)), ld.room);
    const anim = await D.evaluate(async () => { const K = window.__kitchen; await new Promise((r) => setTimeout(r, 800)); const a = K.frames, b = K.propFrames; await new Promise((r) => setTimeout(r, 1500)); return { main: K.frames - a, prop: K.propFrames - b }; });
    check('눈과 전구는 쉬는 동안에도 드문드문 움직임 (1.5초에 3~20번, 본 그리기는 0번)', anim.main === 0 && anim.prop >= 3 && anim.prop <= 20, anim);
    check('이름표가 위쪽 버튼과 겹치지 않고, 버튼은 화면 안·44px 이상', (await D.evaluate(() => document.getElementById('season').getBoundingClientRect().right < document.getElementById('snd').getBoundingClientRect().left)) && (await audit(D)).length === 0, await audit(D));
    await shot(D, 'xmas-home');
    check('초대 링크에 판이 적혀 상대도 같은 판으로 열림', /[?&]theme=xmas/.test(await D.evaluate(() => window.__duo.inviteUrl())) && !/theme=/.test(await J.evaluate(() => window.__duo.inviteUrl())));
    await D.evaluate(() => window.__kitchen.dispatch({ t: 'go', s: 'pack' })); await sleep(1200);
    check('크리스마스 포장 상자 4종 (크림·빨강·초록·금빛)', (await D.evaluate(() => Array.from(document.querySelectorAll('#panel .sw span')).map((s) => s.textContent).join())) === '크림,빨강,초록,금빛');
    check('포장 자리 버튼이 화면 안·44px 이상', (await audit(D)).length === 0, await audit(D));
    await shot(D, 'xmas-pack');

    console.log('\n── 주소로 고르기 ──');
    const DB = await open(ctx, DEC, '?theme=base');
    const ldb = await look(DB);
    check('12월이라도 ?theme=base 면 기본 판 (이름표·소품 없음)', ldb.id === 'base' && ldb.tag === '' && ldb.room.length === 0 && ldb.choc.toUpperCase() === '#5A3824', ldb);
    const JX = await open(ctx, JULY, '?theme=xmas');
    const ljx = await look(JX);
    check('7월이라도 ?theme=xmas 면 크리스마스 판', ljx.id === 'xmas' && ljx.tag.includes('크리스마스') && ljx.room.includes('tree'), ljx);
    const D26 = await open(ctx, '2026-12-26T09:00:00');
    check('12월 26일에는 다시 기본 판', (await look(D26)).id === 'base');
    await D26.close();

    console.log('\n── 선물 링크 ──');
    const baseUrl = await makeGift(DB, 1), xUrl = await makeGift(JX, 2);
    const bo = decode(baseUrl), xo = decode(xUrl);
    check('기본 판 선물 링크는 예전 모양 그대로 (판 이름 없음)', !('t' in bo) && Object.keys(bo).join() === 'v,f,p,s,b,q,to,fr,m' && !/theme=/.test(baseUrl), Object.keys(bo));
    check('크리스마스 판 선물 링크에는 판 이름이 담김 (나머지는 같은 모양)', xo.t === 'xmas' && xo.v === 1 && xo.b === 2 && Object.keys(xo).join() === 'v,f,p,s,b,q,to,fr,m,t', xo);
    // 예전 링크: f 도 t 도 없던 때의 모양으로 다시 싸서, 12월에 연다
    const legacy = Object.assign({}, bo, { to: '지우', fr: '민서' }); delete legacy.f;
    const legacyTail = '#g=' + Buffer.from(JSON.stringify(legacy), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    for (const [name, tail] of [['지금 기본 판 링크', tailOf(baseUrl)], ['예전 링크(판 이름·f 없음)', legacyTail]]) {
      const R = await open(ctx, DEC, tail);
      const l = await look(R);
      check(`${name}: 12월에 열어도 기본 판 모습으로 열림`, l.id === 'base' && l.tag === '' && l.stage.length === 0 && (await R.isVisible('#rcOpen')) && (await R.textContent('#rcHint')).startsWith('선물이 도착했어요.')
        && (await R.evaluate(() => !document.getElementById('snowfx').children.length)), l);
      check(`${name}: 상자·과자·편지가 그대로`, await R.evaluate(() => { const s = window.__kitchen.getState(); return s.x.pack.box === 1 && s.x.pack.packed === 1 && s.text === '메리' && s.grains.length === 20 && document.getElementById('rcMsg').textContent === '메리 크리스마스!'; }));
      if (tail === legacyTail) { check('예전 링크: 이름에 "에게" / "드림" 을 붙여 줌', (await R.textContent('#rcTo')) === '지우에게' && (await R.textContent('#rcFrom')) === '민서 드림'); await shot(R, 'gift-old'); }
      await R.close();
    }
    // 크리스마스 판 선물: 7월에 열어도 크리스마스 모습
    const RX = await open(ctx, JULY, tailOf(xUrl));
    const lx = await look(RX);
    check('크리스마스 선물 링크: 7월에 열어도 크리스마스 판으로 열림', lx.id === 'xmas' && lx.tag.includes('크리스마스') && lx.choc.toUpperCase() === '#1F5A41' && (await RX.isVisible('#rcOpen')), lx);
    check('받는 화면: "크리스마스 선물이 도착했어요", 받침 위 트리, 내리는 눈', (await RX.textContent('#rcHint')).startsWith('크리스마스 선물이 도착했어요.') && lx.stage.includes('tree')
      && (await RX.evaluate(() => getComputedStyle(document.getElementById('snowfx')).display === 'block' && document.getElementById('snowfx').children.length > 8)), lx.stage);
    check('초록 상자(2번)와 초록 글자색이 그대로 전해짐', await RX.evaluate(() => { const s = window.__kitchen.getState(); return s.x.pack.box === 2 && s.tc === 3 && s.text === '메리'; }));
    check('받는 화면 버튼이 화면 안·44px 이상', (await audit(RX)).length === 0, await audit(RX));
    await shot(RX, 'gift-xmas-closed');
    await RX.tap('#rcOpen');
    check('열어 보기 → 봉투가 나옴', await until(() => RX.isVisible('#env'), 9000));
    await RX.tap('#env'); await sleep(900);
    check('편지가 펼쳐지고 머리 장식이 눈꽃', (await RX.isVisible('#rcard')) && (await RX.textContent('#rcMsg')) === '메리 크리스마스!' && (await RX.textContent('#rcard .orn')) === '❄');
    await shot(RX, 'gift-xmas-letter');
    await RX.tap('#rcClose'); await sleep(500); await RX.tap('#rcBrag');
    check('자랑 카드가 만들어짐 (크리스마스 판 장면 포함)', await until(() => RX.evaluate(() => window.__brag.hasScene() && document.getElementById('bgImg').src.length > 20), 9000));
    const px = await RX.evaluate(() => { const d = window.__brag.canvas.getContext('2d').getImageData(8, 1340, 1, 1).data; return [d[0], d[1], d[2]]; });
    check('자랑 카드 바탕이 초록빛 (크리스마스 색)', px[1] > px[0] && px[1] > px[2], px);
    check('자랑 카드 버튼이 화면 안·44px 이상', (await audit(RX)).length === 0, await audit(RX));
    await sleep(600); await shot(RX, 'gift-xmas-brag');
    await RX.close();
    const RB = await open(ctx, JULY, '?theme=base' + tailOf(xUrl));
    check('크리스마스 선물 링크라도 ?theme=base 가 붙으면 기본 판 (주소가 먼저)', (await look(RB)).id === 'base' && (await RB.isVisible('#rcOpen')));
    await RB.close();

    console.log('\n── 움직임 줄이기 설정 ──');
    const calm = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const C = await open(calm, DEC);
    check('움직임 줄이기: 소품은 그대로 있고 눈은 멈춰 있음', (await look(C)).room.includes('snow') && (await C.evaluate(async () => { const K = window.__kitchen; await new Promise((r) => setTimeout(r, 900)); const a = K.propFrames; await new Promise((r) => setTimeout(r, 900)); return K.propFrames - a; })) === 0
      && (await C.evaluate(() => !document.getElementById('snowfx').children.length)));
    await calm.close();
  } finally {
    await browser.close(); server.close();
  }
  const fail = results.filter((r) => !r).length;
  console.log(`\n합계: ${results.length}개 중 통과 ${results.length - fail}, 실패 ${fail}`);
  process.exitCode = fail ? 1 : 0;
})();
