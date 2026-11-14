// 보이스와 TV 같이 보기 검사. 실제 WebRTC 가 있어야 해서 로컬 PeerJS 브로커(npm i 필요)로만 돌린다.
//   실행: cd tree/tests && node media.test.js
// 마이크는 브라우저의 가짜 마이크를 쓴다.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8169, BROKER_PORT = 9169, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 15000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(100); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__media && window.__tree.frames > 3)), 20000);
async function open(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, permissions: ['microphone'] });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; });
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const mode = (p) => T(p, () => window.__duo.mode);
const red = async (p) => { const c = await T(p, () => window.__play.pixel(240, 200)); return c[0] > 140 && c[1] < 100 && c[2] < 100; };
const night = async (p) => { const c = await T(p, () => window.__play.pixel(20, 20)); return c[2] > c[0] + 20; };

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const { PeerServer } = require('peer');
  const broker = PeerServer({ port: BROKER_PORT, path: '/', host: '127.0.0.1' });
  await sleep(500);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const url = (h) => `${BASE}?broker=localhost:${BROKER_PORT}&door=0&st=6000${h || ''}`;
    const A = await open(browser, url());
    check('혼자일 때는 마이크 단추가 없음', !(await A.isVisible('#mic')) && !(await T(A, () => window.__media.can)));
    await T(A, () => { window.__tree.dispatch({ t: 'put', id: 'tv', k: 'tv', i: 0, j: 6, r: 1 }); window.__duo.invite(); });
    await until(async () => (await mode(A)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1];
    const B = await open(browser, url('#r=' + room));
    const C = await open(browser, url('#r=' + room));
    check('세 명이 실제 연결로 이어짐', await until(async () => (await mode(B)) === 'on' && (await mode(C)) === 'on' && (await T(A, () => window.__duo.others.length)) === 2 && (await T(B, () => window.__duo.others.length)) === 2 && (await T(C, () => window.__duo.others.length)) === 2, 30000));
    check('이어지면 마이크 단추가 보임 (화면 안·44px 이상)', (await A.isVisible('#mic')) && (await B.isVisible('#mic')) && await A.evaluate(() => { const r = document.getElementById('mic').getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth; }));

    /* 보이스 */
    await A.tap('#mic');
    check('마이크를 켜면 켜짐 표시가 됨', await until(() => T(A, () => window.__media.micOn), 8000) && (await A.getAttribute('#mic', 'aria-pressed')) === 'true');
    check('방장의 목소리가 다른 두 사람에게 들림 (소리 흐름이 살아 있음)', await until(async () => { const b = await T(B, () => window.__media.audioOf('h')), c = await T(C, () => window.__media.audioOf('h')); return b && c && b.live && c.live && !b.muted; }, 20000), { b: await T(B, () => window.__media.voices), c: await T(C, () => window.__media.voices) });
    const bid = await T(B, () => window.__duo.me);
    await B.tap('#mic');
    check('손님끼리도 목소리가 직접 전해짐', await until(async () => { const c = await T(C, (id) => window.__media.audioOf(id), bid), a = await T(A, (id) => window.__media.audioOf(id), bid); return c && c.live && a && a.live; }, 20000));
    await C.tap('#tabs button[data-m="duo"]'); await sleep(400);
    check('같이 판의 사람 목록에 말하는 사람 표시(🎤)와 소리 끄기 단추가 있음', (await C.textContent('#duoPeople')).includes('🎤') && (await C.locator('#duoPeople button').count()) === 2 && (await C.textContent('#duoPeople button')).includes('소리 끄기'));
    await C.screenshot({ path: path.join(__dirname, 'out', 'voice-people.png') });
    await C.tap('#duoPeople button'); await sleep(300);
    const first = await T(C, () => window.__duo.others[0].id);
    check('"소리 끄기"를 누르면 그 사람 목소리만 내 쪽에서 꺼짐', (await T(C, (id) => window.__media.audioOf(id).muted, first)) === true && (await T(C, (id) => window.__media.isMuted(id), first)) && (await C.textContent('#duoPeople button')).includes('소리 켜기') && (await T(A, (id) => window.__media.audioOf(id).muted, bid)) === false);
    const D = await open(browser, url('#r=' + room));
    check('나중에 들어온 사람에게도 켜져 있던 목소리가 들림', await until(async () => { const v = await T(D, () => window.__media.voices); return v.includes('h') && v.includes(bid); }, 30000), await T(D, () => window.__media.voices));
    await A.tap('#mic');
    check('마이크를 끄면 다른 사람들에게서 그 목소리가 사라짐', await until(async () => !(await T(B, () => window.__media.voices)).includes('h') && !(await T(D, () => window.__media.voices)).includes('h'), 10000) && !(await T(A, () => window.__media.micOn)));

    /* TV 같이 보기 */
    check('동영상을 넣기 전에는 모두 눈 내리는 밤', (await night(A)) && (await night(B)));
    const clip = (ms) => A.evaluate((ms) => new Promise((ok, no) => {
      const c = document.createElement('canvas'); c.width = 96; c.height = 54;
      const g = c.getContext('2d'); let k = 0;
      const paint = () => { g.fillStyle = '#E01010'; g.fillRect(0, 0, 96, 54); g.fillStyle = '#fff'; g.fillRect(k++ % 90, 20, 6, 6); };
      paint(); const iv = setInterval(paint, 40);
      const rec = new MediaRecorder(c.captureStream(25), { mimeType: 'video/webm' }), parts = [];
      rec.ondataavailable = (e) => parts.push(e.data);
      rec.onstop = () => { clearInterval(iv); const fr = new FileReader(); fr.onload = () => ok(fr.result.split(',')[1]); fr.onerror = no; fr.readAsDataURL(new Blob(parts, { type: 'video/webm' })); };
      rec.start(); setTimeout(() => rec.stop(), ms);
    }), ms);
    let b64 = ''; // 느린 기기에서는 빈 영상이 녹화되기도 한다: 그때는 더 길게 다시 찍는다
    for (const ms of [1200, 3000, 6000, 10000]) { b64 = await clip(ms); if (b64.length > 3000) break; }
    await T(A, () => window.__play.open('tv')); await sleep(300);
    console.log('   (검사용 영상 크기)', b64.length);
    await A.setInputFiles('#tvFile', { name: 'clip.webm', mimeType: 'video/webm', buffer: Buffer.from(b64, 'base64') });
    check('동영상을 넣으면 내 TV 에 나오고, 방 사람들에게 보내기 시작함', await until(async () => (await red(A)) && (await T(A, () => window.__media.tvOn)), 60000));
    check('다른 사람들의 TV 에도 그 동영상이 나옴', await until(async () => (await red(B)) && (await red(C)) && (await red(D)), 90000), { b: await T(B, () => window.__play.remote), c: await T(C, () => window.__play.remote) });
    check('받는 쪽은 누가 보내는지 알고 있음', (await T(B, () => window.__media.tvFrom)) === 'h' && (await T(B, () => window.__play.remote.from)) === 'h');
    await T(B, () => window.__play.open('tv')); await sleep(500);
    check('받는 사람의 TV 판에는 "친구가 넣은 동영상"과 소리 단추가 나옴', (await B.textContent('#playMain')).includes('친구가 넣은 동영상') && (await B.isVisible('#playSound')) && !(await B.isVisible('#playDrop')) && (await T(B, () => window.__play.remote.muted)));
    await B.tap('#playSound'); await sleep(200);
    check('소리 켜기를 누르면 친구 영상의 소리가 켜짐', !(await T(B, () => window.__play.remote.muted)));
    await B.screenshot({ path: path.join(__dirname, 'out', 'tv-shared.png') });
    await B.tap('#playQuit');
    check('그만 보면 소리는 꺼지고 화면은 계속 나옴', await until(async () => (await T(B, () => window.__play.remote.muted)) && (await red(B)), 15000));
    const E = await open(browser, url('#r=' + room));
    check('나중에 들어온 사람의 TV 에도 나옴', await until(() => red(E), 30000));
    await A.tap('#playDrop');
    check('넣은 사람이 동영상을 빼면 모두 다시 눈 내리는 밤', await until(async () => (await night(B)) && (await night(C)) && (await night(E)) && !(await T(B, () => window.__play.remote)), 15000));
    await T(A, () => window.__play.close());
    await E.context().close();
    check('사람이 나가도 오류 없이 이어짐', await until(async () => (await T(A, () => window.__duo.others.length)) === 3, 15000) && errors.length === 0, errors);
    for (const p of [B, C, D, A]) await p.context().close();
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
    if (broker && broker.close) broker.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
