// 액자에 내 사진 넣기 검사: 그림 앞의 "사진 바꾸기" · 사진첩에서 고르기(가운데 잘라 작게) · 방의 상태에는 지문만 · 친구·나중에 온 사람·구경하는 사람에게 보이기
//   · 구경하는 사람은 못 바꿈 · 원래 그림으로 · 이상한 사진 걸러 내기 · 다시 열어도 그대로 · 액자를 치우면 사진도
// 실행: cd tree/tests && node photo.test.js   (화면 사진은 out/photo-*.png, 포트 8217)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8217, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__cinema && window.__photo && window.__tree.frames > 3)), 20000);
async function open(ctx, url, bare = false) {
  const p = await ctx.newPage();
  if (bare) await p.addInitScript(() => { window.__bare = true; });
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const items = (p) => T(p, () => window.__tree.serialize().items);
const kinds = (list, lv) => { const n = {}; for (const it of list) if (lv === undefined || Math.floor(it[2] / 32) === lv) { const k = it[1].replace(/\d$/, ''); n[k] = (n[k] || 0) + 1; } return n; };
// 층 lv 의 집 기준 칸 (a, j) 한가운데로 옮겨 선다
const stand = (p, lv, a, j) => T(p, ([lv2, a2, j2]) => { const W = window.__tree; W.me.stop(); W.me.place(W.box.x0 + (lv2 * 32 + a2 + 0.5) * W.CELL, W.box.z0 + (j2 + 0.5) * W.CELL); }, [lv, a, j]);
const audit = (p) => p.evaluate(() => {
  const bad = [];
  for (const b of document.querySelectorAll('button, a')) {
    const r = b.getBoundingClientRect();
    if (!r.width || b.closest('[hidden]') || getComputedStyle(b).display === 'none') continue;
    const name = (b.textContent || b.getAttribute('aria-label') || '').trim();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (!b.closest('.scroll') && (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5)) bad.push(`${name}: 화면 밖`);
  }
  return bad;
});
// 시험용 사진(PNG): 세로로 긴 w × h. 위 20% 는 빨강, 아래 20% 는 파랑, 가운데는 흰 바탕에 color 네모
const picture = (p, w, h, color) => p.evaluate(([w2, h2, c2]) => {
  const c = document.createElement('canvas'); c.width = w2; c.height = h2;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w2, h2);
  g.fillStyle = '#E01010'; g.fillRect(0, 0, w2, h2 * 0.2);
  g.fillStyle = '#1030E0'; g.fillRect(0, h2 * 0.8, w2, h2 * 0.2);
  g.fillStyle = c2; g.fillRect(w2 * 0.3, h2 * 0.4, w2 * 0.4, h2 * 0.2);
  return c.toDataURL('image/png').split(',')[1];
}, [w, h, color]).then((b64) => Buffer.from(b64, 'base64'));
// 그 지문의 사진을 풀어서 크기와 몇 군데의 색을 본다
const decode = (p, h) => p.evaluate((h2) => new Promise((ok) => {
  const d = window.__photo.get(h2), im = new Image();
  im.onload = () => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const px = (x, y) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3); ok({ w: c.width, h: c.height, len: d.length, head: d.slice(0, 23), mid: px(c.width >> 1, c.height >> 1), top: px(c.width >> 1, 3), bottom: px(c.width >> 1, c.height - 4) }); };
  im.onerror = () => ok(null); im.src = d;
}), h);
const shown = (p, id) => T(p, (id2) => ({ of: window.__photo.of(id2), ...window.__photo.shown(id2) }), id);

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const url = (ns, h) => `${BASE}?net=bc&door=0&ns=${ns}&st=3000&rt=500${h || ''}`;

    /* 그림 앞에서 "사진 바꾸기" */
    await ctx.addInitScript(() => { if (new URLSearchParams(location.search).get('ns') === 'ph') localStorage.setItem('tree.master.ph', 'de94e28d7a302b52374831e94e8c70adddf861c691e77ab53f0646f55543a3e7'); }); // 방 주인은 마스터키를 켠 사람
    const H = await open(ctx, url('ph'));
    await T(H, () => window.__cinema.convert()); await sleep(600); // 새 방의 3층은 다락방이라, 그림이 걸린 영화관을 먼저 차린다
    const all = await items(H), arts = all.filter((it) => it[1].startsWith('art') && it[4] === 0).sort((a, b) => a[2] - b[2]);
    const [a1, a2] = [arts[1][0], arts[2][0]]; // 북쪽 벽의 두 액자 (칸 7, 11)
    await stand(H, 2, 7, 2); await T(H, () => window.__tree.me.turnTo(0, -1)); await sleep(900);
    check('그림 앞에 서면 "🖼️ 사진 바꾸기" 단추가 뜸 (화면 안·44px 이상)', (await T(H, () => window.__tree.nearAction())) === '🖼️ 사진 바꾸기' && (await H.isVisible('#act')) && (await audit(H)).length === 0, [await T(H, () => window.__tree.nearAction()), await audit(H)]);
    await T(H, () => window.__tree.pressSpace());
    check('누르면 액자 판이 열림: 사진 고르기 · 그만 보기 (원래 그림일 때는 되돌리기 없음)', await until(async () => (await T(H, () => window.__tree.mode)) === 'play' && (await H.isVisible('#playGo')), 8000) && (await H.textContent('#playGo')).includes('사진 고르기') && !(await H.isVisible('#picReset')) && (await H.isVisible('#playQuit')), await T(H, () => window.__tree.mode));
    check('액자 판의 단추가 화면 안·44px 이상', (await audit(H)).length === 0, await audit(H));
    check('사진 고르는 칸은 사진첩을 여는 image/* 파일 칸', (await H.getAttribute('#picFile', 'accept')) === 'image/*' && (await H.getAttribute('#picFile', 'type')) === 'file');

    /* 사진첩에서 고르기: 가운데를 잘라 작게 줄여 액자에 건다 */
    await H.setInputFiles('#picFile', { name: 'me.png', mimeType: 'image/png', buffer: await picture(H, 1200, 1600, '#10C040') });
    check('사진을 고르면 그 액자에 사진이 걸림', await until(async () => { const s = await shown(H, a1); return s.of && s.h === s.of; }, 10000), await shown(H, a1));
    const h1 = (await shown(H, a1)).of, d1 = await decode(H, h1);
    check('사진은 액자 비율(512×374)의 작은 JPEG (9만 글자 이하)', d1 && d1.w === 512 && d1.h === 374 && d1.head === 'data:image/jpeg;base64,' && d1.len <= 90000 && (await shown(H, a1)).w === 512, d1);
    check('세로로 긴 사진은 가운데를 잘라 넣음 (가운데의 초록은 남고 위아래 끝의 빨강·파랑은 잘림)', d1 && d1.mid[1] > 150 && d1.mid[0] < 90 && d1.top[0] > 200 && d1.top[1] > 200 && d1.bottom[2] > 200 && d1.bottom[0] > 200, d1);
    const st = await T(H, () => window.__tree.serialize());
    check('방의 상태에는 사진의 지문만 들어감 (사진 자체는 없음)', JSON.stringify(st.pics) === JSON.stringify([[a1, h1]]) && /^[a-z0-9]{8,16}$/.test(h1) && !JSON.stringify(st).includes('data:image') && JSON.stringify(st).length < 6000, [st.pics, JSON.stringify(st).length]);
    check('사진을 건 뒤에는 "다른 사진 고르기"와 "원래 그림으로"가 생김 (화면 안·44px 이상)', await until(async () => (await H.textContent('#playGo')).includes('다른 사진'), 3000) && (await H.isVisible('#picReset')) && (await audit(H)).length === 0, await audit(H));
    await sleep(500);
    await H.screenshot({ path: path.join(__dirname, 'out', 'photo-frame.png') });
    await H.tap('#playQuit'); await sleep(300);
    check('그만 보기를 누르면 판이 닫힘', (await T(H, () => window.__tree.mode)) === null);

    /* 여럿이: 친구·나중에 온 사람·구경하는 사람 */
    await T(H, () => window.__duo.invite());
    await until(async () => (await T(H, () => window.__duo.mode)) === 'waiting');
    const inv = await T(H, () => window.__duo.inviteUrl()), view = await T(H, () => window.__duo.inviteUrl(false));
    const G = await open(ctx, url('pg', '#r=' + inv.split('#r=')[1]), true);
    check('나중에 들어온 친구에게도 그 사진이 보임 (없는 사진은 달라고 해서 받는다)', await until(async () => (await T(G, () => window.__duo.mode)) === 'on' && (await shown(G, a1)).h === h1, 15000), await shown(G, a1));
    check('친구의 방도 지문만 같고(방의 지문 일치) 사진은 따로 받은 것', (await T(G, () => window.__duo.hash())) === (await T(H, () => window.__duo.hash())) && (await T(G, (h) => window.__photo.get(h), h1)) === (await T(H, (h) => window.__photo.get(h), h1)));
    // 친구(꾸미는 사람)가 다른 액자에 자기 사진을 넣는다
    await T(G, (id) => window.__play.open(id), a2); await sleep(500);
    await G.setInputFiles('#picFile', { name: 'pal.png', mimeType: 'image/png', buffer: await picture(G, 900, 500, '#E0A010') });
    check('친구가 다른 액자에 넣은 사진이 방장에게도 보임', await until(async () => { const s = await shown(H, a2); return s.of && s.h === s.of && s.of !== h1; }, 10000), await shown(H, a2));
    const h2 = (await shown(H, a2)).of, d2 = await decode(H, h2);
    check('가로로 긴 사진도 액자 비율로 잘려서 옴', d2 && d2.w === 512 && d2.h === 374 && d2.mid[0] > 150 && d2.mid[2] < 90, d2);
    await T(G, () => window.__play.close());
    const V = await open(ctx, url('pv', '#v=' + view.split('#v=')[1]), true);
    check('구경하는 사람에게도 두 사진이 보임', await until(async () => (await T(V, () => window.__duo.mode)) === 'on' && (await shown(V, a1)).h === h1 && (await shown(V, a2)).h === h2, 15000), [await shown(V, a1), await shown(V, a2)]);
    await stand(V, 2, 7, 2); await T(V, () => window.__tree.me.turnTo(0, -1)); await sleep(700);
    check('구경하는 사람에게는 "사진 바꾸기"가 없고, 눌러도 판이 열리지 않음', !(await T(V, () => window.__duo.canEdit)) && (await T(V, () => window.__tree.nearAction())) !== '🖼️ 사진 바꾸기' && !(await T(V, (id) => window.__play.start(id), a1)) && (await T(V, () => window.__tree.mode)) === null, await T(V, () => window.__tree.nearAction()));
    await T(V, (id) => { window.__duo.rawOp({ t: 'pic', id, h: '' }); window.__duo.rawOp({ t: 'pic', id, h: 'zzzzzzzzzzzz' }); }, a1); await sleep(900);
    check('구경하는 사람이 변화를 직접 보내도 방장이 받지 않음', (await shown(H, a1)).of === h1 && (await shown(G, a1)).of === h1, await shown(H, a1));

    /* 이상한 사진은 받지 않는다 */
    const n0 = await T(H, () => window.__photo.count);
    await T(H, ([good, h]) => {
      const D = window.__duo;
      D.feed({ t: 'photo', h: 'aaaaaaaaaaaaaa', d: good });                                                  // 지문이 맞지 않음
      D.feed({ t: 'photo', h: 'bbbbbbbbbbbbbb', d: 'data:text/html;base64,PGI+aGk8L2I+' + 'A'.repeat(200) }); // 사진이 아님
      D.feed({ t: 'photo', h: 'cccccccccccccc', d: 'data:image/jpeg;base64,' + 'A'.repeat(200000) });          // 너무 큼
      D.feed({ t: 'photo', h: 'dddddddddddddd', d: 'data:image/jpeg;base64,AAAA" onerror="x' + 'A'.repeat(200) }); // 이상한 글자
      D.feed({ t: 'photo', h, d: 12345 }); D.feed({ t: 'photo' }); D.feed({ t: 'photoq', h: 42 });
    }, [await T(H, (h) => window.__photo.get(h), h1), h1]);
    await sleep(400);
    check('지문이 틀리거나, 사진이 아니거나, 너무 크거나, 이상한 글자가 든 것은 받지 않음', (await T(H, () => window.__photo.count)) === n0 && (await T(H, () => window.__photo.get('aaaaaaaaaaaaaa'))) === null, [n0, await T(H, () => window.__photo.count)]);
    const bad = await T(H, ([id, other]) => { const W = window.__tree; return [W.dispatch({ t: 'pic', id, h: 'x'.repeat(200) }), W.dispatch({ t: 'pic', id, h: 'data:image/jpeg;base64,AAAA' }), W.dispatch({ t: 'pic', id, h: 'ABCDEFGH12' }), W.dispatch({ t: 'pic', id: other, h: 'abcdefgh12' }), W.dispatch({ t: 'pic', id: 'nope', h: 'abcdefgh12' }), W.dispatch({ t: 'pic', id, h: 7 })]; }, [a1, all.find((it) => it[1] === 'popcorn')[0]]);
    check('방의 상태는 짧은 지문만 받음 (긴 글·사진 데이터·액자가 아닌 가구·없는 가구는 안 됨)', bad.every((v) => v === false) && (await shown(H, a1)).of === h1, bad);
    check('없는 지문을 걸어도(사진을 못 받았어도) 원래 그림이 보이고 오류가 없음', (await T(H, (id) => window.__tree.dispatch({ t: 'pic', id, h: 'abcdefgh12' }), arts[3][0])) === true && await until(async () => (await shown(G, arts[3][0])).of === 'abcdefgh12', 5000) && (await shown(H, arts[3][0])).h === '' && (await shown(G, arts[3][0])).h === '');
    await T(H, (id) => window.__tree.dispatch({ t: 'pic', id, h: '' }), arts[3][0]);

    /* 원래 그림으로 */
    await T(H, (id) => window.__play.open(id), a1); await sleep(500);
    await H.tap('#picReset');
    check('"원래 그림으로"를 누르면 그 액자가 원래 그림으로 돌아가고 친구·구경하는 사람에게도 같음', await until(async () => (await shown(H, a1)).of === '' && (await shown(H, a1)).h === '' && (await shown(G, a1)).h === '' && (await shown(G, a1)).of === '' && (await shown(V, a1)).h === '', 8000) && (await shown(H, a2)).h === h2, [await shown(H, a1), await shown(G, a1)]);
    check('되돌린 뒤 판은 다시 "사진 고르기"만', (await H.textContent('#playGo')).includes('사진 고르기') && !(await H.isVisible('#picReset')) && (await audit(H)).length === 0);
    await T(H, () => window.__play.close());

    /* 다시 열어도 남아 있다 (친구가 넣은 사진을 받아 둔 기기에서도) */
    await sleep(600); await V.close(); await G.close(); await sleep(400);
    await H.reload(); await ready(H);
    check('방을 다시 열어도 친구가 넣었던 사진이 그대로 걸려 있음 (기기에 따로 기억해 둔 것)', await until(async () => (await shown(H, a2)).h === h2, 10000) && (await shown(H, a1)).of === '' && JSON.stringify((await T(H, () => window.__tree.serialize())).pics) === JSON.stringify([[a2, h2]]), await shown(H, a2));
    await stand(H, 2, 11, 3); await sleep(1200);
    await H.screenshot({ path: path.join(__dirname, 'out', 'photo-room.png') });

    /* 액자를 치우면 사진도 같이 */
    await T(H, (id) => window.__tree.dispatch({ t: 'del', id }), a2); await sleep(300);
    check('액자를 치우면 그 사진의 지문도 방에서 빠짐', (await T(H, () => window.__tree.serialize())).pics === undefined);
    await ctx.close();
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
