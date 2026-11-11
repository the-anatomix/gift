// 포장 · 편지 · 선물 링크 검사. 실행: cd kitchen/tests && node pack.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8144, BASE = `http://localhost:${PORT}/kitchen/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 10000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(80); } }
const pack = (p) => p.evaluate(() => window.__kitchen.getState().x.pack);
async function open(ctx, url) { const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('   (페이지 오류)', e.message)); await p.goto(url); await until(() => p.evaluate(() => !!(window.__kitchen && window.__duo && window.__gift))); return p; }
const tab = async (p, n) => { await p.click(`#tabs button:text-is("${n}")`); await sleep(1100); };
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

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const rid = 'pack' + Math.random().toString(36).slice(2, 8);
    const A = await open(ctx, `${BASE}?net=bc#r=${rid}`);
    const B = await open(ctx, `${BASE}?net=bc#r=${rid}`);
    await until(() => B.evaluate(() => window.__duo.mode === 'on'));
    // 꾸민 과자 준비
    await A.evaluate(() => { const K = window.__kitchen; K.dispatch({ t: 'st', s: 'oven', d: { start: 1 } }); K.dispatch({ t: 'st', s: 'oven', d: { out: 0.65 } });
      K.dispatch({ t: 'coat', c: 3, len: 0.45 }); K.dispatch({ t: 'text', v: '메리' }); K.dispatch({ t: 'tcolor', c: 2 });
      for (let i = 0; i < 12; i++) K.dispatch({ t: 'grain', k: i % 4, s: 0.05 + i * 0.04, u: (i % 3 - 1) * 0.02, sp: i, sc: 1, c: 0, st: K.me + '1', id: K.me + '1.' + i }); });
    await tab(A, '포장');
    check('포장 자리: 상자 4종과 "포장 완료" 버튼이 보임', (await A.locator('#panel .sw').count()) === 4 && (await A.isVisible('#packDone')));
    check('포장 자리 버튼이 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    await A.screenshot({ path: path.join(__dirname, 'out', 'pack-open.png') });
    await A.tap('#panel .sw[data-box="1"]');
    check('상자 고르기 (상대에게도 반영)', await until(async () => (await pack(A)).box === 1 && (await pack(B)).box === 1));
    await A.tap('#packDone');
    check('포장 완료 (상대에게도 반영)', await until(async () => (await pack(A)).packed === 1 && (await pack(B)).packed === 1));
    check('포장이 끝나면 누른 사람에게 편지 쓰기 칸이 뜸', await until(() => A.isVisible('#letter'), 12000));
    check('상대 화면에는 편지 칸이 뜨지 않음', !(await B.isVisible('#letter')));
    await A.screenshot({ path: path.join(__dirname, 'out', 'pack-letter.png') });
    check('편지 칸 입력·버튼이 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    await A.tap('#ltShare');
    check('편지를 비우면 보내지 않고 안내', (await A.textContent('#toast')).includes('한 줄'));
    await A.fill('#ltTo', '지우'); await A.fill('#ltFrom', '민서'); await A.fill('#ltMsg', '메리 크리스마스!\n<b>굵게</b> & "따옴표"');
    const url = await A.evaluate(() => window.__gift.giftUrl());
    check('선물 링크 생성 (#g=…, 6000자 이하)', /#g=[A-Za-z0-9_-]+$/.test(url) && url.length < 6000, url.length);
    await A.tap('#ltShare'); await sleep(400);
    check('보내기를 누르면 공유·복사, 안 되면 링크를 보여 줌', (await A.isVisible('#ltUrl')) || (await A.textContent('#toast')).includes('복사'));
    await A.tap('#ltClose');
    check('포장 뒤 패널에 "편지 쓰기 / 다시 열기"', (await A.isVisible('#packLetter')) && (await A.isVisible('#packOpen')));
    await A.screenshot({ path: path.join(__dirname, 'out', 'pack-done.png') });
    const idle = await A.evaluate(async () => { await new Promise((r) => setTimeout(r, 600)); const a = window.__kitchen.frames; await new Promise((r) => setTimeout(r, 1500)); return window.__kitchen.frames - a; });
    check('가만히 두면 다시 그리지 않음', idle === 0, idle);

    // 받는 사람
    const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const R = await open(ctx2, url);
    check('받는 사람: "선물이 도착했어요"와 열어 보기 버튼, 탭은 숨김', (await R.isVisible('#rcOpen')) && !(await R.isVisible('#tabs')) && (await R.textContent('#recv')).includes('선물이 도착했어요'));
    check('받는 사람: 방 연결을 시도하지 않음', (await R.evaluate(() => window.__duo.mode)) === 'solo');
    const got = await R.evaluate(() => { const s = window.__kitchen.getState(); return { n: s.grains.length, t: s.text, tc: s.tc, lv: s.x.oven.lv, c: s.layers[0] && s.layers[0].c, box: s.x.pack.box, packed: s.x.pack.packed }; });
    check('받는 사람: 같은 과자·상자가 담겨 있음', got.n === 12 && got.t === '메리' && got.tc === 2 && got.lv === 2 && got.c === 3 && got.box === 1 && got.packed === 1, got);
    await sleep(800);
    await R.screenshot({ path: path.join(__dirname, 'out', 'recv-closed.png') });
    check('칭호가 없는 선물에는 칭호 띠가 보이지 않음', !(await R.isVisible('#rcTitle')));
    check('받는 사람: 주방은 숨기고 선물만 보임', await R.evaluate(() => window.__kitchen.stage === true));
    // 한 손가락으로 밀어 시점 돌리기
    const yaw0 = await R.evaluate(() => window.__kitchen.yaw);
    await R.mouse.move(120, 380); await R.mouse.down(); await R.mouse.move(260, 380, { steps: 8 }); await R.mouse.up();
    check('받은 선물을 밀면 시점이 돌아감', (await R.evaluate(() => window.__kitchen.yaw)) !== yaw0);
    await R.tap('#rcOpen');
    await R.waitForTimeout(2300);
    const out = await R.evaluate(() => { const K = window.__kitchen, s = K.stickScreen(); return { p: K.presenting, st: K.S.station, tip: s.tip, end: s.end }; });
    check('열면 과자가 상자 밖으로 완전히 나와 크게 보임', out.p === 2 && out.st === 'pack' && Math.abs(out.end.y - out.tip.y) > 250, out);
    await R.screenshot({ path: path.join(__dirname, 'out', 'recv-stick.png') });
    check('상자 옆에 봉투가 나타남 (편지는 아직 접혀 있음)', await until(() => R.isVisible('#env'), 8000) && !(await R.isVisible('#rcard')));
    const eb = await R.locator('#env').boundingBox();
    check('봉투가 화면 안에 있고 44px 이상', eb.width >= 44 && eb.height >= 44 && eb.x >= 0 && eb.x + eb.width <= 375 && eb.y + eb.height <= 812, eb);
    await sleep(800);
    await R.screenshot({ path: path.join(__dirname, 'out', 'recv-env.png') });
    await R.tap('#env');
    check('봉투를 누르면 편지가 나옴', await until(() => R.isVisible('#rcard'), 3000) && (await R.evaluate(() => document.getElementById('env').classList.contains('open'))));
    check('편지 글이 글자 그대로 보임 (태그로 바뀌지 않음)', (await R.textContent('#rcMsg')) === '메리 크리스마스!\n<b>굵게</b> & "따옴표"' && (await R.evaluate(() => !document.querySelector('#rcMsg b')))
      && (await R.textContent('#rcTo')) === '지우에게' && (await R.textContent('#rcFrom')) === '민서 드림');
    await sleep(900);
    await R.screenshot({ path: path.join(__dirname, 'out', 'recv-letter.png') });
    const lay = await R.evaluate(() => { const s = window.__kitchen.stickScreen(), p = document.querySelector('.letterpaper').getBoundingClientRect(); return { tip: s.tip.y, end: s.end.y, paperTop: p.top, paperBottom: p.bottom, bar: document.getElementById('bottom').getBoundingClientRect().top }; });
    check('편지를 펼쳐도 과자를 가리지 않음 (과자는 위, 편지는 아래)', Math.max(lay.tip, lay.end) < lay.paperTop + 4 && Math.min(lay.tip, lay.end) > 40 && lay.paperBottom <= lay.bar + 46, lay);
    check('편지를 펼쳤을 때도 과자가 충분히 큼 (화면 높이의 1/4 이상)', Math.abs(lay.end - lay.tip) / 0.8 > 812 * 0.25, Math.abs(lay.end - lay.tip) / 0.8);
    check('편지가 나오면 배경음악이 흐름', await R.evaluate(() => window.__bgm.playing === true));
    await R.tap('#rcSound');
    check('음악 끄기 버튼으로 끌 수 있음', await R.evaluate(() => window.__bgm.playing === false && window.__bgm.muted === true));
    await R.tap('#rcSound');
    check('다시 누르면 음악이 켜짐', await R.evaluate(() => window.__bgm.playing === true));
    await R.tap('#rcClose');
    check('편지를 넣으면 음악이 멈춤', await until(() => R.evaluate(() => window.__bgm.playing === false), 2000));
    check('편지지의 ✕ 로 봉투에 다시 넣을 수 있음', await until(async () => !(await R.isVisible('#rcard'))) && !(await R.evaluate(() => document.getElementById('env').classList.contains('open'))));
    await R.tap('#env'); await sleep(300);
    check('봉투를 다시 누르면 다시 나옴', await R.isVisible('#rcard'));
    await R.tap('#env');
    check('열린 봉투를 누르면 편지가 들어감', await until(async () => !(await R.isVisible('#rcard'))));
    // 자랑 카드
    await R.tap('#rcBrag');
    check('자랑 카드가 열리고 그림이 만들어짐 (1080×1350, 선물 장면 포함)', await until(() => R.evaluate(() => { const i = document.getElementById('bgImg'); return !document.getElementById('brag').hidden && i.naturalWidth === 1080 && i.naturalHeight === 1350 && window.__brag.hasScene(); }), 8000));
    const px = await R.evaluate(() => { const d = window.__brag.canvas.getContext('2d'); const n = (x, y) => Array.from(d.getImageData(x, y, 1, 1).data); return { box: n(560, 640), paper: n(540, 1150) }; });
    check('그림에 선물 상자(빨강)와 편지지(상아색)가 함께 담김', px.box[0] > 150 && px.box[1] < 110 && px.paper[0] > 240 && px.paper[1] > 225, px);
    check('찍은 뒤에도 화면 크기가 그대로', await R.evaluate(() => { const c = document.getElementById('c'); return Math.abs(c.width / c.height - innerWidth / innerHeight) < 0.01; }));
    check('자랑 카드 버튼이 화면 안·44px 이상', (await audit(R)).length === 0, await audit(R));
    await sleep(500);
    await R.screenshot({ path: path.join(__dirname, 'out', 'brag-sheet.png') });
    fs.writeFileSync(path.join(__dirname, 'out', 'brag-card.png'), Buffer.from((await R.evaluate(() => window.__brag.canvas.toDataURL('image/png'))).split(',')[1], 'base64'));
    const reqs = []; R.on('request', (r) => { if (r.method() !== 'GET') reqs.push(r.url()); });
    await R.setInputFiles('#bgFile', path.join(__dirname, 'face.png'));
    check('내 사진을 고르면 폴라로이드로 사진 속에 들어감', await until(() => R.evaluate(() => window.__brag.hasPhoto() && !document.getElementById('bgNoPhoto').hidden), 5000));
    await sleep(500);
    const pol = await R.evaluate(() => Array.from(window.__brag.canvas.getContext('2d').getImageData(700, 300, 1, 1).data));
    check('폴라로이드의 흰 테두리가 그려짐', pol[0] > 245 && pol[1] > 245 && pol[2] > 245, pol);
    fs.writeFileSync(path.join(__dirname, 'out', 'brag-photo-card.png'), Buffer.from((await R.evaluate(() => window.__brag.canvas.toDataURL('image/png'))).split(',')[1], 'base64'));
    await R.tap('#bgNoPhoto'); await sleep(300);
    check('"사진 빼기"를 누르면 사진이 빠짐', !(await R.evaluate(() => window.__brag.hasPhoto())));
    check('사진을 넣는 동안 밖으로 보내는 요청이 없음', reqs.length === 0, reqs);
    await R.tap('#bgClose'); await sleep(200);
    check('자랑 카드를 닫을 수 있음', !(await R.isVisible('#brag')));
    const before = await R.evaluate(() => window.__kitchen.S.grains.length);
    await R.mouse.move(187, 300); await R.mouse.down(); await R.mouse.move(187, 420, { steps: 8 }); await R.mouse.up();
    check('받은 과자는 문질러도 바뀌지 않음', (await R.evaluate(() => window.__kitchen.S.grains.length)) === before);
    check('받는 화면 버튼이 화면 안·44px 이상', (await audit(R)).length === 0, await audit(R));
    await R.tap('#rcMake');
    await until(() => R.evaluate(() => !!(window.__kitchen && !location.hash)));
    await sleep(800);
    check('나도 만들기 → 빈 주방으로', !(await R.evaluate(() => location.hash)) && (await R.isVisible('#tabs')) && (await R.evaluate(() => window.__kitchen.S.grains.length)) === 0);
    await ctx2.close();

    // 포장한 채로 토핑 자리로 가면 다시 열림
    await tab(A, '토핑');
    check('포장한 채 토핑 자리로 가면 상자가 다시 열림 (양쪽)', await until(async () => (await pack(A)).packed === 0 && (await pack(B)).packed === 0));
    const bad = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const X = await open(bad, `${BASE}#g=AAAAAAAAAAAA`);
    check('깨진 선물 링크는 안내만 하고 주방은 그대로 열림', (await X.isVisible('#tabs')) && (await X.textContent('#toast')).includes('읽지 못했어요'));
    await bad.close(); await ctx.close();
  } catch (e) { check('검사 도중 오류 없음', false, String(e && e.message)); }
  await browser.close(); server.close();
  const fail = results.filter((x) => !x).length;
  console.log(`\n합계: ${results.length}개 중 통과 ${results.length - fail}, 실패 ${fail}`);
  process.exitCode = fail ? 1 : 0;
})();
