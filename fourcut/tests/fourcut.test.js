// 네 컷 사진관 자동 검사. 실행법은 README.md 참고.
//   node fourcut.test.js           혼자 찍기(가짜 카메라) · 앨범 · 둘이 찍기(BroadcastChannel) · 모바일 화면
//   SHOTS=폴더 node fourcut.test.js  화면 사진을 그 폴더에 남긴다 (기본은 out/)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8147;
const BASE = `http://localhost:${PORT}/fourcut/`;
const OUT = process.env.SHOTS || path.join(__dirname, 'out');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.txt': 'text/plain' };
const CAM = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']; // 가짜 카메라 + 권한 자동 허용
const VIEW = { width: 390, height: 844 };

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && detail !== undefined ? '  → ' + JSON.stringify(detail) : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 10000) {
  const t = Date.now();
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch (_) { /* 다시 */ }
    if (Date.now() - t > ms) return false;
    await sleep(80);
  }
}
const st = (p) => p.evaluate(() => { const f = window.__fourcut, S = f.S; return { screen: S.screen, cam: S.cam, busy: S.busy, duo: S.duo, mode: f.mode, role: f.role, live: f.camLive, frame: S.opt.frame, caption: S.opt.caption,
  cuts: S.cuts.map((c) => (c ? { w: c.full.width, h: c.full.height, split: c.split, both: !!(c.host && c.guest), g: c.g } : null)) }; });
const screen = async (p) => (await st(p)).screen;
// 캔버스 픽셀을 한 줄 값으로 줄인다 (같은 그림인지 비교용)
const HASH = `(cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 2166136261;
  for (let i = 0; i < d.length; i += 4) { h = Math.imul(h ^ d[i], 16777619); h = Math.imul(h ^ d[i + 1], 16777619); h = Math.imul(h ^ d[i + 2], 16777619); }
  return (h >>> 0) + ':' + cv.width + 'x' + cv.height; }`;
const stripHash = (p) => p.evaluate(`(${HASH})(window.__fourcut.strip)`);
const cutHashes = (p) => p.evaluate(`window.__fourcut.S.cuts.map((c) => c ? (${HASH})(c.full) : null)`);
async function stripAfter(p, act) { // act 를 하고, 띠가 다시 그려진 뒤의 값
  const n = await p.evaluate(() => window.__fourcut.renders);
  await act();
  await until(() => p.evaluate((k) => window.__fourcut.renders > k, n), 4000);
  return stripHash(p);
}
async function open(ctx, url) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { console.log('   (페이지 오류)', e.message); results.push({ name: '페이지 오류 ' + e.message, ok: false }); });
  await p.goto(url);
  await until(() => p.evaluate(() => !!window.__fourcut));
  return p;
}
const shot = (p, name) => p.screenshot({ path: path.join(OUT, name + '.png') });
async function saveStrip(p, name) { // 완성 띠 그림 자체를 파일로
  const url = await p.evaluate(() => window.__fourcut.strip.toDataURL('image/jpeg', 0.9));
  fs.writeFileSync(path.join(OUT, name + '.jpg'), Buffer.from(url.split(',')[1], 'base64'));
}
// 화면 폭을 넘치지 않는지, 보이는 단추가 44px 이상인지
async function layout(p) {
  return p.evaluate(() => {
    const small = [];
    for (const b of document.querySelectorAll('button, a, input[type=text]')) {
      const r = b.getBoundingClientRect();
      if (r.width && r.height && (r.height < 43.5 || r.width < 43.5)) small.push((b.id || b.textContent.trim().slice(0, 8)) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    return { over: document.documentElement.scrollWidth - innerWidth, small };
  });
}
// 검사용 사진: 가장자리는 빨강, 가운데는 초록. 가운데를 잘 잘랐다면 초록만 남는다.
async function makeImages(browser) {
  const p = await browser.newPage();
  const make = (w, h, mx, my, tag) => p.evaluate(([w, h, mx, my, tag]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = '#ff0000'; x.fillRect(0, 0, w, h); x.fillStyle = '#00b050'; x.fillRect(mx, my, w - mx * 2, h - my * 2);
    x.fillStyle = '#ffffff'; x.font = '900 160px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(tag, w / 2, h / 2);
    return c.toDataURL('image/png').split(',')[1];
  }, [w, h, mx, my, tag]);
  const files = [];
  for (const [name, w, h, mx, my] of [['세로1', 600, 1200, 0, 370], ['가로1', 1600, 600, 392, 0], ['세로2', 720, 1280, 0, 362], ['가로2', 1200, 800, 60, 0]]) {
    files.push({ name: name + '.png', mimeType: 'image/png', buffer: Buffer.from(await make(w, h, mx, my, name.slice(-1) + (w > h ? 'L' : 'P')), 'base64') });
  }
  await p.close();
  return files;
}
const corners = (p, i) => p.evaluate((i) => { // i번 컷의 네 귀퉁이 색
  const c = window.__fourcut.S.cuts[i].full, x = c.getContext('2d');
  return [[3, 3], [c.width - 4, 3], [3, c.height - 4], [c.width - 4, c.height - 4]].map(([a, b]) => Array.from(x.getImageData(a, b, 1, 1).data.slice(0, 3)));
}, i);
const green = (px) => px.every(([r, g, b]) => r < 40 && g > 140 && b < 120);

/* ───────── 혼자 찍기 (가짜 카메라) ───────── */
async function soloSuite(browser) {
  console.log('\n── 혼자 찍기 (가짜 카메라) ──');
  const ctx = await browser.newContext({ viewport: VIEW, acceptDownloads: true });
  const outside = [];
  ctx.on('request', (r) => { if (!r.url().startsWith(BASE) && !/^(data|blob):/.test(r.url())) outside.push(r.url()); });
  const p = await open(ctx, BASE + '?tick=140');
  check('제목이 "네 컷 사진관 | 놀자방"', (await p.title()) === '네 컷 사진관 | 놀자방', await p.title());
  check('놀자방 홈 링크가 ../nolja/ 를 가리킴', (await p.getAttribute('.top a', 'href')) === '../nolja/' && /놀자방 홈/.test(await p.textContent('.top a')));
  check('바닥글에 "사진은 서버에 올라가지 않는다"는 한 문장', /사진은 어떤 서버에도 올라가지 않아요/.test(await p.textContent('footer')));
  check('처음 화면: 일반 브라우저에서는 앱 안 브라우저 안내가 없음', await p.isHidden('#inapp'));
  await shot(p, '01-start');

  await p.click('#go-solo');
  check('카메라가 켜짐 (앞 카메라, 거울 보기)', await until(async () => { const s = await st(p); return s.cam === 'ok' && s.live; }) &&
    (await p.evaluate(() => getComputedStyle(document.getElementById('video')).transform)) === 'matrix(-1, 0, 0, 1, 0, 0)', await st(p));
  await sleep(400); await shot(p, '02-booth');
  await p.click('#shoot');
  check('카운트다운 숫자가 보임', await until(async () => /^[123]$/.test(await p.textContent('#count')), 3000));
  await shot(p, '03-countdown');
  check('네 컷을 찍고 컷 보기 화면으로', await until(async () => (await screen(p)) === 'review', 15000), await st(p));
  let s = await st(p);
  check('컷 4장, 각각 960x720', s.cuts.every((c) => c && c.w === 960 && c.h === 720), s.cuts);
  const h1 = await cutHashes(p);
  check('네 컷이 서로 다른 순간 (가짜 카메라 화면이 움직임)', new Set(h1).size === 4, h1);
  check('컷 보기에서는 카메라가 꺼짐', !s.live);
  await sleep(300); await shot(p, '04-review');

  await p.click('#cuts .cut:nth-child(2) button');
  check('2번 컷 다시 찍기: 찍는 화면으로 가고 단추에 "2번 컷"', await until(async () => (await screen(p)) === 'booth') && /2번 컷/.test(await p.textContent('#shoot')), await p.textContent('#shoot'));
  await until(async () => (await st(p)).cam === 'ok');
  await p.click('#shoot');
  check('다시 찍고 컷 보기로 돌아옴', await until(async () => (await screen(p)) === 'review' && !(await st(p)).busy, 8000));
  const h2 = await cutHashes(p);
  check('2번 컷만 바뀌고 나머지 세 컷은 그대로', h2[1] !== h1[1] && h2[0] === h1[0] && h2[2] === h1[2] && h2[3] === h1[3], [h1, h2]);

  await p.click('#to-finish');
  await until(async () => (await screen(p)) === 'finish');
  check('완성 화면에서는 카메라가 꺼짐', !(await st(p)).live);
  check('완성 띠 캔버스 크기 1080x3240', await p.evaluate(() => window.__fourcut.strip.width === 1080 && window.__fourcut.strip.height === 3240));
  check('미리보기 그림이 채워짐 (길게 눌러 저장할 수 있는 img)', await until(() => p.evaluate(() => { const i = document.getElementById('out'); return i.complete && i.naturalWidth === 1080 && i.naturalHeight === 3240; })));
  const ids = await p.evaluate(() => window.__fourcut.FRAMES.map((f) => f.id));
  check('프레임 7종, 크리스마스와 새해 포함', ids.length === 7 && ids.includes('xmas') && ids.includes('newyear'), ids);
  const fh = {};
  for (const id of ids) {
    fh[id] = await stripAfter(p, () => p.click(`#frames button[data-id="${id}"]`));
    await saveStrip(p, 'strip-' + id);
  }
  check('프레임을 바꾸면 결과 그림이 바뀜 (7종 모두 서로 다름)', new Set(Object.values(fh)).size === ids.length, fh);
  const plain = await stripAfter(p, () => p.click('#frames button[data-id="xmas"]'));
  const withCap = await stripAfter(p, () => p.fill('#caption', '메리 크리스마스'));
  check('한마디를 쓰면 결과 그림이 바뀜', withCap !== plain);
  const noDate = await stripAfter(p, () => p.uncheck('#date'));
  check('날짜를 끄면 결과 그림이 바뀜', noDate !== withCap);
  await p.check('#date'); await sleep(250);
  await shot(p, '05-finish'); await saveStrip(p, 'strip-final-xmas');

  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  const file = path.join(OUT, 'saved.jpg'); await dl.saveAs(file);
  const buf = fs.readFileSync(file);
  check('저장하기: fourcut-날짜.jpg 로 내려받음 (JPEG)', /^fourcut-\d{8}\.jpg$/.test(dl.suggestedFilename()) && buf[0] === 0xff && buf[1] === 0xd8 && buf.length > 50000, [dl.suggestedFilename(), buf.length]);

  // 공유: 파일 공유가 되는 브라우저 흉내
  await p.evaluate(() => { window.__shared = null; navigator.canShare = (d) => !!(d && d.files); navigator.share = async (d) => { window.__shared = { n: d.files.length, type: d.files[0].type, name: d.files[0].name, size: d.files[0].size }; }; });
  await p.click('#share');
  const sh = await until(() => p.evaluate(() => window.__shared));
  check('공유하기: navigator.share 에 JPEG 파일 한 장을 넘김', sh && sh.n === 1 && sh.type === 'image/jpeg' && sh.size > 50000, sh);
  // 공유가 안 되는 브라우저: 저장으로 대신하고 알려 준다
  await p.evaluate(() => { navigator.canShare = undefined; navigator.share = undefined; });
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#share')]);
  check('공유가 안 되는 브라우저: 저장으로 대신하고 안내', /\.jpg$/.test(dl2.suggestedFilename()) && /저장했어요/.test(await p.textContent('#toast')), await p.textContent('#toast'));

  await p.click('#to-review');
  check('"컷 다시 보기"로 돌아가도 컷이 그대로', (await screen(p)) === 'review' && (await cutHashes(p)).join() === h2.join());
  check('바깥 서버로 나가는 요청이 없음 (글꼴·그림·소리 파일 포함)', outside.length === 0, outside);
  await ctx.close();
}

/* ───────── 카메라가 막혔을 때: 앨범 ───────── */
async function albumSuite(browser, files, camBrowser) {
  console.log('\n── 카메라 없음·거부 → 앨범에서 고르기 ──');
  const ctx = await browser.newContext({ viewport: VIEW });
  const p = await open(ctx, BASE + '?tick=140');
  await p.click('#go-solo');
  check('카메라를 쓸 수 없으면 안내와 "앨범에서 고르기"가 보이고 찍기 단추는 숨김', await until(async () => (await st(p)).cam === 'fail') &&
    await p.isVisible('#nocam') && await p.isVisible('#pick-album') && await p.isHidden('#shoot'), await st(p));
  check('카메라가 없을 때 안내 문구', /카메라를 찾지 못했어요/.test(await p.textContent('#nocam')), await p.textContent('#nocam'));
  await shot(p, '06-nocam');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#pick-album')]);
  check('앨범 고르기는 여러 장을 받음', fc.isMultiple());
  await fc.setFiles(files.slice(0, 2));
  check('2장만 고르면 두 칸만 채워지고 넘어가기 단추는 잠김', await until(async () => (await screen(p)) === 'review') &&
    (await st(p)).cuts.filter(Boolean).length === 2 && await p.isDisabled('#to-finish'), await st(p));
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('#cuts .cut:nth-child(3) button')]);
  await fc2.setFiles(files[2]);
  await until(async () => (await st(p)).cuts.filter(Boolean).length === 3);
  const [fc3] = await Promise.all([p.waitForEvent('filechooser'), p.click('#cuts .cut:nth-child(4) button')]);
  await fc3.setFiles(files[3]);
  check('빈 칸에 한 장씩 넣어 네 컷을 채움', await until(async () => (await st(p)).cuts.filter(Boolean).length === 4) && await p.isEnabled('#to-finish'));
  const cs = []; for (let i = 0; i < 4; i++) cs.push(await corners(p, i));
  check('세로·가로 사진 모두 가운데를 잘라 960x720 으로 (귀퉁이까지 가운데 색)', cs.every(green) && (await st(p)).cuts.every((c) => c.w === 960 && c.h === 720), cs);
  const before = await cutHashes(p);
  const [fc4] = await Promise.all([p.waitForEvent('filechooser'), p.click('#cuts .cut:nth-child(1) button')]);
  await fc4.setFiles(files[3]);
  check('앨범 컷 한 장 바꾸기', await until(async () => { const h = await cutHashes(p); return h[0] !== before[0] && h[0] === before[3] && h[1] === before[1]; }), await cutHashes(p));
  await sleep(200); await shot(p, '07-album-review');
  await p.click('#to-finish');
  check('앨범 사진으로도 완성 띠가 나옴', await until(() => p.evaluate(() => document.getElementById('out').naturalWidth === 1080)));
  await saveStrip(p, 'strip-album');

  // 처음 화면의 "앨범 사진으로 만들기" 로 바로 네 장
  const p2 = await open(ctx, BASE);
  const [fc5] = await Promise.all([p2.waitForEvent('filechooser'), p2.click('#go-album')]);
  await fc5.setFiles(files);
  check('처음 화면에서 앨범 4장 → 바로 컷 보기 (카메라는 켜지 않음)', await until(async () => (await screen(p2)) === 'review') && (await st(p2)).cuts.every(Boolean) && (await st(p2)).cam === 'idle', await st(p2));
  await ctx.close();

  // 권한을 거부했을 때 (가짜 카메라 브라우저에서 거부만 흉내)
  const dctx = await camBrowser.newContext({ viewport: VIEW });
  await dctx.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); });
  const d = await open(dctx, BASE);
  await d.click('#go-solo');
  check('권한 거부(NotAllowedError): "카메라 권한이 꺼져 있어요" 안내와 앨범 단추', await until(async () => (await st(d)).cam === 'fail') &&
    /카메라 권한이 꺼져 있어요/.test(await d.textContent('#nocam')) && await d.isVisible('#pick-album') && await d.isHidden('#shoot'), await d.textContent('#nocam'));
  const [fd] = await Promise.all([d.waitForEvent('filechooser'), d.click('#pick-album')]);
  await fd.setFiles(files);
  check('권한 거부 뒤 앨범 4장으로 네 컷 완성', await until(async () => (await screen(d)) === 'review') && (await st(d)).cuts.every(Boolean));
  await dctx.close();

  // 앱 안 브라우저(카카오톡) 흉내
  const kctx = await browser.newContext({ viewport: VIEW, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5' });
  const k = await open(kctx, BASE);
  check('카카오톡 안 브라우저: 처음 화면에 안내가 보임', await k.isVisible('#inapp') && /다른 브라우저로 열기/.test(await k.textContent('#inapp')));
  await shot(k, '08-inapp-start');
  await k.click('#go-solo');
  check('카카오톡 안 브라우저 + 카메라 막힘: "다른 브라우저로 열기" 안내와 앨범 단추', await until(async () => (await st(k)).cam === 'fail') &&
    /다른 브라우저로 열기/.test(await k.textContent('#nocam')) && await k.isVisible('#pick-album'));
  await kctx.close();
}

/* ───────── 둘이 찍기 (BroadcastChannel) ───────── */
async function duoSuite(browser) {
  console.log('\n── 둘이 찍기 (같은 기기 안 통신) ──');
  const ctx = await browser.newContext({ viewport: VIEW });
  const Q = '?net=bc&tick=160';
  const A = await open(ctx, BASE + Q);
  await A.click('#go-duo');
  check('A 가 방을 만들고 주인으로 기다림', await until(async () => { const s = await st(A); return s.mode === 'waiting' && s.role === 'host'; }), await st(A));
  const link = await A.textContent('#link');
  check('초대 링크가 #r=방 모양이고 주소에도 들어감', /\/fourcut\/\?net=bc&tick=160#r=[a-z0-9]{8}$/.test(link) && A.url() === link, link);
  check('친구가 오기 전에는 찍기 단추가 잠김', await A.isDisabled('#shoot') && await A.isVisible('#share-box'));
  await until(async () => (await st(A)).cam === 'ok'); await sleep(300); await shot(A, '09-duo-waiting');

  const B = await open(ctx, link);
  check('B 가 링크를 열면 초대 카드와 "같이 찍으러 들어가기"', await B.isVisible('#invited') && await B.isVisible('#go-join') && await B.isHidden('#go-duo'));
  await shot(B, '10-duo-invited');
  await B.click('#go-join');
  check('연결 성립 (A 주인, B 손님)', await until(async () => (await st(A)).mode === 'on' && (await st(B)).mode === 'on') && (await st(B)).role === 'guest', [await st(A), await st(B)]);
  check('연결 상태 표시: 두 쪽 모두 "친구랑 연결됐어요"', /연결됐어요/.test(await A.textContent('#pill-t')) && /연결됐어요/.test(await B.textContent('#pill-t')));
  check('손님은 찍기를 누를 수 없고, 주인은 누를 수 있게 됨', await B.isDisabled('#shoot') && await until(() => A.isEnabled('#shoot')), [await A.textContent('#shoot'), await B.textContent('#shoot')]);
  check('화면 나눔: 주인 영상은 왼쪽 반, 손님 영상은 오른쪽 반', await A.evaluate(() => { const f = document.getElementById('finder').getBoundingClientRect(), v = document.getElementById('video').getBoundingClientRect(); return Math.abs(v.left - f.left) < 8 && v.width < f.width * 0.55; }) &&
    await B.evaluate(() => { const f = document.getElementById('finder').getBoundingClientRect(), v = document.getElementById('video').getBoundingClientRect(); return Math.abs(v.right - f.right) < 8 && v.width < f.width * 0.55; }));
  await until(async () => (await st(B)).cam === 'ok'); await sleep(300);
  await shot(A, '11-duo-host-booth'); await shot(B, '12-duo-guest-booth');

  await A.click('#shoot');
  check('주인이 누르면 두 쪽이 같이 카운트다운', await until(async () => /^[123]$/.test(await A.textContent('#count')) && /^[123]$/.test(await B.textContent('#count')), 3000));
  check('두 쪽 모두 네 컷을 찍고 컷 보기로', await until(async () => (await screen(A)) === 'review' && (await screen(B)) === 'review', 15000), [await screen(A), await screen(B)]);
  const full = (s) => s.cuts.every((c) => c && c.split && c.both);
  check('네 컷 모두 두 사람 반쪽이 다 도착', await until(async () => full(await st(A)) && full(await st(B))), [await st(A), await st(B)]);
  await sleep(300); await shot(A, '13-duo-review');
  await A.click('#to-finish'); await B.click('#to-finish');
  await until(async () => (await screen(A)) === 'finish' && (await screen(B)) === 'finish');
  const eq = async () => { const a = await stripHash(A), b = await stripHash(B); return a === b ? a : false; };
  const first = await until(eq, 5000);
  check('두 쪽 완성 띠가 픽셀까지 같음', first, [await stripHash(A), await stripHash(B)]);
  check('컷은 왼쪽 반 = 주인, 오른쪽 반 = 손님 (서로 보낸 반쪽이 맞바뀌어 있음)', await A.evaluate(() => window.__fourcut.S.cuts[0].host.src.length > 1000) &&
    (await A.evaluate(() => window.__fourcut.S.cuts[0].guest.src)) === (await B.evaluate(() => window.__fourcut.S.cuts[0].guest.src)) &&
    (await A.evaluate(() => window.__fourcut.S.cuts[0].host.src)) === (await B.evaluate(() => window.__fourcut.S.cuts[0].host.src)));
  const kb = await A.evaluate(() => window.__fourcut.S.cuts.map((c) => Math.round(c.host.src.length / 1024)));
  check('주고받는 반쪽 사진은 480x720 JPEG, 한 장 200KB 아래', kb.every((k) => k < 200) && await A.evaluate(() => window.__fourcut.S.cuts[0].guest.naturalWidth === 480 && window.__fourcut.S.cuts[0].guest.naturalHeight === 720), kb);

  await A.click('#frames button[data-id="newyear"]');
  check('주인이 프레임을 바꾸면 손님 화면도 따라 바뀌고 띠가 다시 같아짐', await until(async () => (await st(B)).frame === 'newyear' && (await eq()) && (await eq()) !== first, 5000), [await st(B)]);
  await B.fill('#caption', '우리 오늘 최고');
  check('손님이 쓴 한마디가 주인 띠에도 들어감', await until(async () => (await st(A)).caption === '우리 오늘 최고' && (await eq()), 5000), (await st(A)).caption);
  await sleep(250); await shot(A, '14-duo-finish'); await saveStrip(A, 'strip-duo-host'); await saveStrip(B, 'strip-duo-guest');

  // 손님이 한 컷 다시 찍자고 하기
  const g0 = (await st(A)).cuts.map((c) => c.g);
  await B.click('#to-review'); await B.click('#cuts .cut:nth-child(3) button');
  check('손님이 3번 컷 다시 찍기를 누르면 두 쪽이 같이 다시 찍음', await until(async () => { const a = await st(A), b = await st(B);
    return a.screen === 'review' && b.screen === 'review' && a.cuts[2].g !== g0[2] && a.cuts[2].g === b.cuts[2].g && a.cuts[2].both && b.cuts[2].both && a.cuts[0].g === g0[0]; }, 12000), [await st(A), await st(B)]);
  await A.click('#to-finish'); await B.click('#to-finish');
  check('다시 찍은 뒤에도 두 쪽 띠가 같음', await until(eq, 5000));

  // 세 번째 사람
  const C = await open(ctx, link);
  await C.click('#go-join');
  check('세 번째 사람은 "이미 두 명" 안내를 받고 혼자 모드로', await until(async () => /이미 두 명/.test(await C.textContent('#toast')) && !(await st(C)).duo, 6000), await st(C));
  await C.close();

  // 손님이 중간에 나감
  await A.click('#to-review'); await until(async () => (await screen(A)) === 'review');
  await A.click('#redo-all');
  await until(async () => (await screen(A)) === 'booth' && (await st(A)).cam === 'ok');
  await A.click('#shoot');
  await until(async () => (await st(A)).cuts.filter(Boolean).length === 2, 8000);
  await B.close();
  check('손님이 나가면 주인에게 "친구가 나갔어요" 안내', await until(async () => (await st(A)).mode === 'lost' && /친구가 나갔어요/.test(await A.textContent('#toast')), 6000), await st(A));
  check('주인은 끊긴 뒤에도 남은 컷을 혼자 이어 찍어 네 컷을 채움', await until(async () => (await screen(A)) === 'review' && (await st(A)).cuts.every(Boolean), 12000), await st(A));
  let s = await st(A);
  check('앞의 두 컷은 둘이 찍은 컷, 뒤의 컷은 혼자 찍은 컷', s.cuts[0].split && s.cuts[0].both && !s.cuts[3].split && !s.duo, s.cuts);
  check('상태 표시가 "친구가 나갔어요"로 바뀌고 주소에서 방이 빠짐', /친구가 나갔어요/.test(await A.textContent('#pill2-t')) && !/#r=/.test(A.url()), A.url());
  await sleep(200); await shot(A, '15-duo-friend-left');
  await A.click('#to-finish');
  check('끊긴 뒤에도 완성 띠를 만들 수 있음', await until(() => A.evaluate(() => document.getElementById('out').naturalWidth === 1080)));
  await saveStrip(A, 'strip-duo-friend-left');
  await ctx.close();

  // 주인이 중간에 나감
  const ctx2 = await browser.newContext({ viewport: VIEW });
  const H = await open(ctx2, BASE + Q);
  await H.click('#go-duo');
  await until(async () => (await st(H)).mode === 'waiting');
  const G = await open(ctx2, await H.textContent('#link'));
  await G.click('#go-join');
  await until(async () => (await st(H)).mode === 'on' && (await st(G)).mode === 'on');
  await until(() => H.isEnabled('#shoot'));
  await H.click('#shoot');
  await until(async () => (await st(G)).cuts.filter(Boolean).length === 2, 8000);
  await H.close();
  check('주인이 나가면 손님에게 안내가 뜨고 "남은 컷 찍기"가 열림', await until(async () => (await st(G)).mode === 'lost' && !(await st(G)).busy && await G.isEnabled('#shoot') && /남은 컷/.test(await G.textContent('#shoot')), 8000), [await st(G), await G.textContent('#shoot')]);
  const kept = (await st(G)).cuts.filter(Boolean).length;
  await G.click('#shoot');
  check('손님이 남은 컷을 혼자 찍어 네 컷을 채움 (찍어 둔 컷은 그대로)', await until(async () => (await screen(G)) === 'review' && (await st(G)).cuts.every(Boolean), 12000) && kept >= 2 && kept < 4, [kept, await st(G)]);
  await ctx2.close();
}

/* ───────── 모바일 화면 (360 ~ 430) ───────── */
async function layoutSuite(browser) {
  console.log('\n── 모바일 화면 ──');
  for (const w of [360, 390, 430]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 780 } });
    const p = await open(ctx, BASE + '?net=bc&tick=60');
    const bad = [];
    const look = async (name) => { const l = await layout(p); if (l.over > 0 || l.small.length) bad.push({ name, ...l }); };
    await look('처음');
    await p.click('#go-duo'); await until(async () => (await st(p)).mode === 'waiting' && (await st(p)).cam === 'ok'); await look('둘이 기다림');
    await p.click('#to-solo'); await look('찍기');
    await p.click('#shoot'); await until(async () => (await screen(p)) === 'review', 8000); await look('컷 보기');
    await p.click('#to-finish'); await until(() => p.evaluate(() => document.getElementById('out').naturalWidth === 1080)); await look('완성');
    check(`폭 ${w}px: 가로 넘침 없음, 단추 44px 이상 (다섯 화면)`, bad.length === 0, bad);
    await ctx.close();
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  }).listen(PORT);
  const withCam = await chromium.launch({ args: CAM });
  const noCam = await chromium.launch(); // 가짜 카메라가 없어 카메라 요청이 실패한다
  try {
    const files = await makeImages(withCam);
    await soloSuite(withCam);
    await albumSuite(noCam, files, withCam);
    await duoSuite(withCam);
    await layoutSuite(withCam);
  } catch (e) { console.log('검사 중 오류:', e); results.push({ name: '오류', ok: false }); }
  await withCam.close(); await noCam.close(); server.close();
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\n결과: ${results.length - fail} 통과 / ${fail} 실패 (화면 사진: ${OUT})`);
  process.exit(fail ? 1 : 0);
})();
