// 둘이 굽기 자동 검사. 실행법은 README.md 참고.
//   node duo.test.js            같은 기기 안 통신(BroadcastChannel)으로 동기화 로직 검사 + 모바일 화면 검사
//   node duo.test.js --peer     위에 더해, 로컬 PeerJS 브로커(npm i 필요)로 실제 WebRTC 데이터 채널 검사
//   node duo.test.js --public   위에 더해, PeerJS 공개 브로커로 검사 (인터넷이 열려 있어야 함)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8137, BROKER_PORT = 9137;
const BASE = `http://localhost:${PORT}/kitchen/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.txt': 'text/plain' };
const args = process.argv.slice(2);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && detail !== undefined ? '  → ' + JSON.stringify(detail) : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000) {
  const t = Date.now();
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch (_) { /* 다시 */ }
    if (Date.now() - t > ms) return false;
    await sleep(100);
  }
}
const mode = (p) => p.evaluate(() => window.__duo && window.__duo.mode);
const role = (p) => p.evaluate(() => window.__duo.role);
const grains = (p) => p.evaluate(() => window.__kitchen.S.grains.map((g) => `${g.id}|${g.k}|${g.s}|${g.u}|${g.c}`).sort());
const layers = (p) => p.evaluate(() => JSON.stringify(window.__kitchen.S.layers));
const text = (p) => p.evaluate(() => window.__kitchen.S.text);
const station = (p) => p.evaluate(() => window.__kitchen.S.station);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function open(ctx, url) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('   (페이지 오류)', e.message));
  await p.goto(url);
  await until(() => p.evaluate(() => !!(window.__kitchen && window.__duo)));
  return p;
}
async function tab(p, name) { await p.click(`#tabs button:text-is("${name}")`); await sleep(1100); }
async function rub(p, from = 0.1, to = 0.6) { // 과자 위를 마우스로 문지른다
  const sc = await p.evaluate(() => window.__kitchen.stickScreen());
  const y = (k) => sc.tip.y + (sc.end.y - sc.tip.y) * k;
  await p.mouse.move(sc.tip.x, y(from)); await p.mouse.down();
  await p.mouse.move(sc.tip.x + 3, y(to), { steps: 14 }); await p.mouse.up();
}

async function duoSuite(browser, label, query) {
  console.log(`\n── 둘이 굽기 (${label}) ──`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const rid = 'test' + Math.random().toString(36).slice(2, 8);
  const url = `${BASE}?${query}&st=4000#r=${rid}`;

  const A = await open(ctx, url);
  check('A 가 방 주인으로 기다린다', await until(async () => (await mode(A)) === 'waiting') && (await role(A)) === 'host', await mode(A));
  await tab(A, '초콜릿');
  await A.mouse.move(195, 300); await A.mouse.down(); await A.mouse.move(195, 480, { steps: 8 }); await A.mouse.up();
  await tab(A, '토핑'); await rub(A, 0.1, 0.4);
  await A.fill('#carve', '사랑');
  const before = await grains(A);
  check('A 가 혼자 먼저 꾸밈 (코팅 1겹, 토핑 여러 알)', before.length > 3 && (await layers(A)).includes('len'), before.length);

  const B = await open(ctx, url);
  check('연결 성립 (A·B 모두 "둘이 굽는 중")', await until(async () => (await mode(A)) === 'on' && (await mode(B)) === 'on', 15000), [await mode(A), await mode(B)]);
  check('B 는 손님', (await role(B)) === 'guest');
  check('늦게 들어온 B 에 토핑 상태 복원', await until(async () => same(await grains(B), before)), [(await grains(B)).length, before.length]);
  check('늦게 들어온 B 에 코팅 상태 복원', (await layers(B)) === (await layers(A)));
  check('늦게 들어온 B 에 새긴 글자 복원', (await text(B)) === '사랑', await text(B));
  check('B 가 A 와 같은 자리(토핑)로 이동', await until(async () => (await station(B)) === 'top'));
  await sleep(1100);

  await rub(A, 0.45, 0.7);
  const a2 = await grains(A);
  check('A 가 뿌린 토핑이 B 에 같은 자리로 나타남', a2.length > before.length && await until(async () => same(await grains(B), a2)), [a2.length, (await grains(B)).length]);
  await B.click('.chip:has-text("하트")'); await rub(B, 0.2, 0.5);
  const b2 = await grains(B);
  check('B 가 뿌린 토핑이 A 에 같은 자리로 나타남', b2.length > a2.length && await until(async () => same(await grains(A), b2)), [b2.length, (await grains(A)).length]);

  await B.fill('#carve', '사랑해요');
  check('글자 새기기 반영 (B → A, 입력칸에도 표시)', await until(async () => (await text(A)) === '사랑해요' && (await A.inputValue('#carve')) === '사랑해요'), await text(A));
  await A.evaluate(() => window.__kitchen.dispatch({ t: 'text', v: '<b>일곱글자넘는글</b>' }));
  check('글자는 6자로 잘리고 글자 그대로만 다뤄짐', (await text(A)) === '<b>일곱글' && (await A.evaluate(() => !document.querySelector('#panel b'))), await text(A));
  await A.fill('#carve', '사랑해요');

  // 둘이 동시에
  const scA = await A.evaluate(() => window.__kitchen.stickScreen());
  const yA = (k) => scA.tip.y + (scA.end.y - scA.tip.y) * k;
  await A.mouse.move(scA.tip.x, yA(0.1)); await B.mouse.move(scA.tip.x, yA(0.75));
  await A.mouse.down(); await B.mouse.down();
  for (let i = 1; i <= 10; i++) { await A.mouse.move(scA.tip.x, yA(0.1 + i * 0.03)); await B.mouse.move(scA.tip.x, yA(0.75 - i * 0.03)); }
  const handSeen = await until(() => B.evaluate(() => document.getElementById('hand').classList.contains('on')), 2000);
  await A.mouse.up(); await B.mouse.up();
  check('동시에 뿌려도 두 화면이 같아짐', await until(async () => { const x = await grains(A); return x.length > b2.length && same(x, await grains(B)); }), [(await grains(A)).length, (await grains(B)).length]);
  check('상대 손 위치 표시가 보임', handSeen);

  const n0 = (await grains(A)).length;
  await A.click('#undo');
  check('되돌리기 반영 (A 의 마지막 획만 사라짐)', await until(async () => { const x = await grains(A); return x.length < n0 && same(x, await grains(B)); }));
  await B.click('#clear');
  check('지우기 반영', await until(async () => (await grains(A)).length === 0 && (await grains(B)).length === 0));
  await A.click('#undo');
  check('지운 것 되돌리기 반영', await until(async () => { const x = await grains(A); return x.length > 0 && same(x, await grains(B)); }));

  await tab(B, '초콜릿');
  check('자리 이동 반영 (B → A)', await until(async () => (await station(A)) === 'choco'));
  await sleep(1100);
  await B.click('.sw[aria-label="딸기 초콜릿"]');
  check('초콜릿 색 선택 반영', await until(() => A.evaluate(() => window.__kitchen.S.color === 3)));
  await B.mouse.move(195, 300); await B.mouse.down(); await B.mouse.move(195, 420, { steps: 8 }); await B.mouse.up();
  check('코팅 반영', await until(async () => { const l = await layers(A); return l === (await layers(B)) && l.includes('"c":3'); }), [await layers(A), await layers(B)]);
  await A.click('#uncoat');
  check('코팅 지우기 반영', await until(async () => (await layers(B)) === '[]'));
  await B.click('#duo .emoji >> nth=0');
  check('이모지 반영', await until(() => A.evaluate(() => document.querySelectorAll('#emos .emo').length > 0), 2000));

  const C = await open(ctx, url);
  check('세 번째 입장 거절 ("방이 찼어요")', await until(async () => (await mode(C)) === 'full', 15000) && (await C.textContent('#duo')).includes('방이 찼어요'), await mode(C));
  check('세 번째가 와도 A·B 연결 유지', (await mode(A)) === 'on' && (await mode(B)) === 'on');
  await C.click('#solo');
  check('거절된 쪽은 혼자 굽기로 전환', (await mode(C)) === 'solo' && !(await C.evaluate(() => location.hash)));
  await C.close();

  await tab(A, '토핑'); await rub(A, 0.1, 0.6);
  const fin = await grains(A);
  await until(async () => same(await grains(B), fin));
  await B.close();
  check('한쪽을 닫으면 솔로로 전환', await until(async () => (await mode(A)) === 'lost', 15000), await mode(A));
  check('끊긴 뒤에도 만든 상태 유지', same(await grains(A), fin));
  await rub(A, 0.62, 0.72);
  check('끊긴 뒤 혼자 계속 뿌릴 수 있음', (await grains(A)).length > fin.length);
  check('다시 연결·이어 굽기 링크 버튼이 보임', (await A.isVisible('#retry')) && (await A.isVisible('#continue')));

  const cont = await A.evaluate(() => window.__duo.continueUrl());
  check('이어 굽기 링크 생성 (#s=…, 4000자 이하)', /#s=[A-Za-z0-9_-]+$/.test(cont) && cont.length < 4000, cont.length);
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const D = await open(ctx2, cont);
  const cmp = await D.evaluate(() => window.__kitchen.S.grains.map((g) => [g.k, g.s, g.u])), src = await A.evaluate(() => window.__kitchen.S.grains.map((g) => [g.k, g.s, g.u]));
  const close = cmp.length === src.length && cmp.every((g, i) => g[0] === src[i][0] && Math.abs(g[1] - src[i][1]) < 0.004 && Math.abs(g[2] - src[i][2]) < 0.001);
  check('이어 굽기 링크를 연 쪽에 같은 과자가 나타남', close && (await D.evaluate(() => window.__duo.mode)) === 'solo', [cmp.length, src.length]);
  check('이어 굽기 링크에 새긴 글자도 담김', (await text(D)) === '사랑해요', await text(D));
  await sleep(1200);
  await D.screenshot({ path: path.join(__dirname, 'out', `continue-${label}.png`) }).catch(() => {});
  await rub(D, 0.3, 0.5);
  check('받은 사람이 그 상태에서 마저 꾸밀 수 있음', (await D.evaluate(() => window.__kitchen.S.grains.length)) > src.length);
  await ctx2.close();

  const B2 = await open(ctx, url);
  check('다시 들어오면 재연결', await until(async () => (await mode(A)) === 'on' && (await mode(B2)) === 'on', 15000), [await mode(A), await mode(B2)]);
  check('재연결한 쪽에 현재 상태 복원', await until(async () => same(await grains(B2), await grains(A))));
  await A.click('#duo .emoji >> nth=1'); // 연결 상태 화면 확인용
  await A.screenshot({ path: path.join(__dirname, 'out', `duo-${label}.png`) }).catch(() => {});
  await ctx.close();
}

async function failSuite(browser) {
  console.log('\n── 연결 실패 처리 ──');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await open(ctx, `${BASE}?broker=localhost:1&ct=3000#r=nobroker1`);
  check('링크로 들어오면 누를 것 없이 바로 연결 시도 ("주방에 들어가는 중…" 표시)', ['connecting', 'lost'].includes(await mode(p)) && (await p.isVisible('#duo')));
  check('브로커에 닿지 못하면 솔로로 전환 ("연결이 안 됐어요" 표시)', await until(async () => (await mode(p)) === 'lost', 15000) && (await p.textContent('#duo')).includes('연결이 안 됐어요'), await mode(p));
  check('넘어가기 전에 한 번 자동으로 다시 시도함', (await p.evaluate(() => window.__duo.tries)) === 2, await p.evaluate(() => window.__duo.tries));
  check('이어 굽기 링크 버튼이 보임', await p.isVisible('#continue'));
  await tab(p, '토핑'); await rub(p);
  check('연결 실패 뒤에도 혼자 꾸밀 수 있음', (await p.evaluate(() => window.__kitchen.S.grains.length)) > 0);
  await p.click('#solo');
  check('닫기를 누르면 일반 솔로 화면으로', (await mode(p)) === 'solo');
  await ctx.close();
}

async function extraSuite(browser) {
  console.log('\n── 앱 안 브라우저 · WebGL 없음 · 저사양 · 개인정보 ──');
  const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5';
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, userAgent: UA });
  const p = await open(ctx, `${BASE}?net=bc`);
  const box = async (sel) => { const b = await p.locator(sel).boundingBox(); return b && b.width >= 44 && b.height >= 44 && b.x >= 0 && b.x + b.width <= 375; };
  check('앱 안 브라우저(카카오톡 UA)에서 "기본 브라우저로 열기" 안내가 뜸', (await p.isVisible('#inapp')) && (await p.textContent('#inapp')).includes('기본 브라우저'));
  check('안내의 주소 복사·닫기 버튼이 44px 이상', (await box('#inapp .copyurl')) && (await box('#inappClose')));
  await p.tap('#inappClose');
  check('안내를 닫을 수 있음', !(await p.isVisible('#inapp')));
  const ctxN = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const n = await open(ctxN, BASE);
  check('일반 브라우저에서는 안내가 뜨지 않음', !(await n.isVisible('#inapp')));

  // 저사양 단계
  await n.evaluate(() => window.__kitchen.lowerQuality());
  await tab(n, '토핑'); await rub(n);
  check('품질을 낮춘 뒤에도 그대로 동작', (await n.evaluate(() => window.__kitchen.quality)) === 'low' && (await n.evaluate(() => window.__kitchen.S.grains.length)) > 0);
  check('계절 판 설정이 한 곳(theme.js)에서 읽힘', (await n.evaluate(() => window.__kitchen.theme)) === '기본');

  // 개인정보: 저장소에 아무것도 남기지 않는다
  await n.evaluate(() => window.__duo.createRoom());
  await until(async () => (await mode(n)) === 'waiting');
  await n.click('#solo');
  const kept = await n.evaluate(() => ({ ls: localStorage.length, ss: sessionStorage.length, ck: document.cookie.length, hash: location.hash }));
  check('방을 나간 뒤 브라우저 저장소·쿠키·주소에 남는 것이 없음', kept.ls === 0 && kept.ss === 0 && kept.ck === 0 && !kept.hash, kept);
  await ctx.close(); await ctxN.close();

  // 브로커로 나가는 요청에는 방 id 말고는 담기지 않는다 (로컬 브로커로 확인)
  if (args.includes('--peer') || args.includes('--public')) {
    const ctxP = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const pp = await ctxP.newPage();
    const seen = [];
    pp.on('request', (r) => { if (r.url().includes(String(BROKER_PORT))) seen.push(r.url()); });
    pp.on('websocket', (w) => seen.push(w.url()));
    await pp.goto(`${BASE}?broker=127.0.0.1:${BROKER_PORT}#r=privacy${Math.random().toString(36).slice(2, 7)}`);
    await until(async () => (await mode(pp)) === 'waiting', 10000);
    await pp.evaluate(() => { const K = window.__kitchen; K.dispatch({ t: 'text', v: '비밀글자' }); K.dispatch({ t: 'coat', c: 3, len: 0.4 }); });
    await sleep(800);
    const leak = seen.filter((u) => /%EB%B9%84|비밀|text=|state=/.test(u));
    check('브로커로 가는 주소에 방 id 외의 내용(글자·과자 상태)이 없음', seen.length > 0 && leak.length === 0, seen.slice(0, 3));
    await ctxP.close();
  }

  // WebGL 을 끈 브라우저
  const b2 = await chromium.launch({ args: ['--disable-3d-apis'] });
  const c2 = await b2.newContext({ viewport: { width: 375, height: 812 }, userAgent: UA });
  const f = await c2.newPage();
  await f.goto(BASE); await sleep(1500);
  check('WebGL 이 꺼져 있으면 안내가 뜸', (await f.isVisible('#fallback')) && (await f.textContent('#fallback')).includes('3D 주방을 열 수 없어요'));
  check('2D 판으로 가는 버튼이 있음 (../)', (await f.getAttribute('#fallback a', 'href')) === '../' && (await f.isVisible('#fallback a')));
  check('안내 화면에 주소 복사 버튼과 기본 브라우저 안내가 있음', (await f.isVisible('#fallback .copyurl')) && (await f.isVisible('#fbInapp')));
  await b2.close();

  // 화면 문구 검사
  const banned = ['빼' + '빼로', '무' + '료', '0' + '원', '돈 안 드는', '돈신' + '호등', 'kcal', '칼로리'];
  const files = ['index.html', 'app.js', 'duo.js', 'net.js', 'theme.js'].map((x) => fs.readFileSync(path.join(__dirname, '..', x), 'utf8')).join('\n');
  const hit = banned.filter((w) => files.includes(w));
  check('쓰지 않기로 한 문구가 kitchen/ 화면 코드에 없음', hit.length === 0, hit);
  check('사용자 글자를 innerHTML 로 넣는 곳이 없음', !/innerHTML|insertAdjacentHTML|document\.write/.test(files));
}

async function mobileSuite(browser) {
  console.log('\n── 모바일 화면 (375×812, 터치) ──');
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await open(ctx, `${BASE}?net=bc`);
  const audit = (where) => p.evaluate((where) => {
    const bad = [];
    for (const b of document.querySelectorAll('button, a')) {
      const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
      if (!r.width || cs.visibility === 'hidden' || b.closest('[hidden]') || b.closest('#labels.off') || b.closest('#fallback')) continue;
      const name = (b.textContent || b.getAttribute('aria-label') || '').trim();
      if (r.width < 44 || r.height < 44) bad.push(`${where}/${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
      if (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) bad.push(`${where}/${name}: 화면 밖`);
    }
    return bad;
  }, where);
  let bad = [];
  for (const t of ['전체', '반죽', '초콜릿', '토핑']) { await p.tap(`#tabs button:text-is("${t}")`); await sleep(1100); bad = bad.concat(await audit(t)); }
  check('솔로: 모든 버튼이 화면 안에 있고 44px 이상', bad.length === 0, bad);

  // 진짜 터치 이벤트로 과자를 문지른다
  const cdp = await ctx.newCDPSession(p);
  const sc = await p.evaluate(() => window.__kitchen.stickScreen());
  const pt = (k) => [{ x: sc.tip.x, y: sc.tip.y + (sc.end.y - sc.tip.y) * k }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(0.1) });
  for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(0.1 + i * 0.045) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(300);
  const st = await p.evaluate(() => ({ n: window.__kitchen.S.grains.length, y: window.scrollY, top: document.scrollingElement.scrollTop, vy: visualViewport.pageTop }));
  check('한 손가락 터치로 문지르면 토핑이 붙음', st.n > 3, st);
  await p.tap('#carve'); await p.keyboard.type('메리'); await p.keyboard.press('Enter');
  check('토핑 자리에서 글자 새기기 입력', (await text(p)) === '메리', await text(p));
  await sleep(300);
  await p.screenshot({ path: path.join(__dirname, 'out', 'mobile-top.png') }).catch(() => {});
  check('캔버스를 문질러도 페이지가 스크롤되지 않음', st.y === 0 && st.top === 0 && st.vy === 0, st);

  // 터치로 초콜릿 담그기
  await p.tap('#tabs button:text-is("초콜릿")'); await sleep(1100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 187, y: 280 }] });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 187, y: 280 + i * 18 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(300);
  check('한 손가락 터치로 끌어 담그면 코팅이 입혀짐', (await p.evaluate(() => window.__kitchen.S.layers.length)) === 1);

  // 둘이 굽기 상태별 버튼
  await p.tap('#tabs button:text-is("전체")'); await sleep(1100);
  await p.tap('#homeAction');
  await until(async () => (await mode(p)) === 'waiting');
  await sleep(500);
  bad = await audit('기다리는 중');
  const inv = await p.evaluate(() => window.__duo.inviteUrl());
  check('"같이 굽기" → 초대 링크(#r=방id) 생성', /#r=[a-z0-9]{10}$/.test(inv), inv);
  const q = await open(ctx, inv);
  await until(async () => (await mode(p)) === 'on' && (await mode(q)) === 'on');
  await sleep(500);
  bad = bad.concat(await audit('둘이 굽는 중'));
  await q.close();
  await until(async () => (await mode(p)) === 'lost', 15000);
  await sleep(500);
  bad = bad.concat(await audit('끊김'));
  check('둘이 굽기: 상태별 버튼이 화면 안에 있고 44px 이상', bad.length === 0, bad);
  await p.screenshot({ path: path.join(__dirname, 'out', 'mobile-lost.png') }).catch(() => {});
  const idle = await p.evaluate(async () => { const a = window.__kitchen.frames; await new Promise((r) => setTimeout(r, 1500)); return window.__kitchen.frames - a; });
  check('가만히 두면 다시 그리지 않음 (배터리 절약)', idle === 0, idle);
  await ctx.close();
}

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); } });
  }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  let broker = null;
  try {
    await duoSuite(browser, 'BroadcastChannel', 'net=bc');
    if (args.includes('--peer') || args.includes('--public')) {
      broker = require('peer').PeerServer({ host: '127.0.0.1', port: BROKER_PORT, path: '/' });
      await sleep(500);
      await duoSuite(browser, 'WebRTC·로컬 브로커', `broker=127.0.0.1:${BROKER_PORT}`);
    }
    if (args.includes('--public')) await duoSuite(browser, 'WebRTC·공개 브로커', 'pub=1');
    await failSuite(browser);
    await extraSuite(browser);
    await mobileSuite(browser);
  } catch (e) {
    check('검사 도중 오류 없음', false, String(e && e.message));
  }
  await browser.close(); server.close();
  if (broker) process.nextTick(() => process.exit(results.some((r) => !r.ok) ? 1 : 0));
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\n합계: ${results.length}개 중 통과 ${results.length - fail}, 실패 ${fail}`);
  process.exitCode = fail ? 1 : 0;
})();
