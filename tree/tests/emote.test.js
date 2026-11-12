// 표정과 행동 검사 (표정 6가지, 행동 7가지(냠냠 포함), 친구에게 보이는지). 실행: cd tree/tests && node emote.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8169, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
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

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ea`);
    const me = (p) => T(p, () => { const m = window.__tree.me, a = m.parts.arms; return { acting: m.acting, az: [a[0].rotation.z, a[1].rotation.z], ax: a[0].rotation.x, by: m.parts.body.position.y, bx: m.parts.body.rotation.x, face: m.look.face, eyes: m.parts.eyes.length, kids: m.parts.head.children.length }; });

    /* 표정과 행동 판 */
    check('도구 단추에 표정·행동 단추(👋)가 있고 화면 안·44px 이상', (await A.isVisible('#emo')) && (await audit(A)).length === 0, await audit(A));
    await A.tap('#emo'); await sleep(400);
    check('누르면 표정 6가지와 행동 7가지(냠냠 포함)가 한 줄씩 다 보임 (옆으로 넘기지 않아도)', (await A.isVisible('#emoP')) && (await A.locator('#faceList .pick').count()) === 6 && (await A.locator('#actList .pick').count()) === 7 && (await audit(A)).length === 0 && await T(A, () => [...document.querySelectorAll('#emoP .pick')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })), await audit(A));
    check('처음 표정은 "기본"이 눌려 있음', (await A.getAttribute('#faceList .pick[data-v="smile"]', 'aria-pressed')) === 'true' && (await me(A)).face === 'smile' && (await me(A)).eyes === 2);
    await T(A, () => window.__tree.snapView());
    await A.screenshot({ path: path.join(__dirname, 'out', 'emote-panel.png') });

    /* 표정 */
    const base = (await me(A)).kids;
    await A.tap('#faceList .pick[data-v="happy"]'); await sleep(200);
    let m = await me(A);
    check('"활짝"을 누르면 웃느라 눈을 감은 얼굴이 됨', m.face === 'happy' && m.eyes === 0 && (await A.getAttribute('#faceList .pick[data-v="happy"]', 'aria-pressed')) === 'true' && (await A.getAttribute('#faceList .pick[data-v="smile"]', 'aria-pressed')) === 'false', m);
    await A.tap('#faceList .pick[data-v="wink"]'); await sleep(200);
    check('"윙크"는 한쪽 눈만 감음', (await me(A)).eyes === 1);
    await A.tap('#faceList .pick[data-v="sad"]'); await sleep(200);
    m = await me(A);
    check('"시무룩"은 눈썹과 눈물이 더해짐', m.face === 'sad' && m.eyes === 2 && m.kids === base + 3, { m, base });
    for (const f of ['wow', 'angry']) { await A.tap(`#faceList .pick[data-v="${f}"]`); await sleep(120); }
    check('표정은 기기에 기억됨', (await T(A, () => JSON.parse(localStorage.getItem('nolja-tree-look.ea')).face)) === 'angry');
    check('옷을 바꿔도 표정은 그대로', await T(A, () => { window.__tree.setLook({ outfit: 'rudolph' }); return window.__tree.me.look.face === 'angry' && window.__tree.look.outfit === 'rudolph'; }));
    check('모르는 표정은 받지 않고 기본으로', await T(A, () => { window.__tree.setLook({ face: '<x>' }); return window.__tree.look.face === 'smile'; }));

    /* 행동 */
    m = await me(A);
    check('가만히 있을 때는 행동 없음, 팔은 내려와 있음', m.acting === null && Math.abs(m.az[0] + 0.28) < 0.01 && Math.abs(m.az[1] - 0.28) < 0.01, m);
    await A.tap('#actList .pick[data-v="wave"]'); await sleep(500);
    m = await me(A);
    check('"안녕"을 누르면 한 손을 들어 흔듦', m.acting === 'wave' && m.az[0] < -1.3 && Math.abs(m.az[1] - 0.28) < 0.05, m);
    check('잠깐 하고 나면 원래 몸짓으로 돌아옴', await until(async () => { const x = await me(A); return x.acting === null && Math.abs(x.az[0] + 0.28) < 0.02; }, 4000), await me(A));
    await A.tap('#actList .pick[data-v="cheer"]'); await sleep(500);
    m = await me(A);
    check('"만세"는 두 손을 듦', m.acting === 'cheer' && m.az[0] < -1.5 && m.az[1] > 1.5, m);
    await A.tap('#actList .pick[data-v="clap"]'); await sleep(500);
    m = await me(A);
    check('하는 중에 다른 행동을 누르면 바로 바뀜: "박수"는 두 팔을 앞으로', m.acting === 'clap' && m.ax < -0.9, m);
    await A.tap('#actList .pick[data-v="jump"]');
    check('"폴짝"은 몸이 떠오름', await until(async () => (await me(A)).by > 0.15, 1500));
    await A.tap('#actList .pick[data-v="bow"]'); await sleep(800);
    m = await me(A);
    check('"꾸벅"은 몸을 숙임', m.acting === 'bow' && m.bx > 0.25, m);
    await A.tap('#actList .pick[data-v="eat"]'); await sleep(500);
    check('"냠냠"은 먹는 몸짓', (await me(A)).acting === 'eat' && (await A.getAttribute('#actList .pick[data-v="eat"]', 'aria-label') || await A.textContent('#actList .pick[data-v="eat"]')).includes('냠냠'), await me(A));
    await A.tap('#actList .pick[data-v="dance"]'); await sleep(600);
    check('"춤"을 추는 중', (await me(A)).acting === 'dance');
    await A.screenshot({ path: path.join(__dirname, 'out', 'emote-dance.png') });
    const fl = await T(A, () => window.__tree.screenOf(window.__tree.me.x + 1.2, window.__tree.me.z + 0.6, 0));
    await A.touchscreen.tap(fl.x, fl.y);
    check('표정·행동 판이 열려 있어도 바닥을 누르면 걸어가고, 걸으면 하던 행동은 그만둠', await until(async () => (await me(A)).acting === null && await T(A, () => window.__tree.me.moving), 2500));
    await until(() => T(A, () => !window.__tree.me.moving), 6000);
    check('모르는 행동은 하지 않음', await T(A, () => window.__tree.doAct('fly') === false && window.__tree.me.acting === null));

    /* 1인칭 */
    await A.tap('#emo'); await sleep(200);
    await A.tap('#pov'); await sleep(300);
    check('1인칭으로 보는 중에는 내 모습이 안 보임', await T(A, () => window.__tree.eyeOn && !window.__tree.meShown));
    await A.tap('#emo'); await sleep(300);
    check('표정·행동 판을 열면 내 모습이 보이게 잠깐 내려다봄', await T(A, () => !window.__tree.eyeOn && window.__tree.meShown) && (await A.isVisible('#emoP')));
    await A.tap('#emo'); await sleep(300);
    check('판을 닫으면 다시 1인칭', await T(A, () => window.__tree.eyeOn && !window.__tree.meShown) && !(await A.isVisible('#emoP')));
    await A.tap('#pov'); await sleep(200);

    /* 친구에게 보임 */
    await T(A, () => window.__tree.setLook({ outfit: 'basic', face: 'wink' }));
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], id = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=eb#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=ec#v=${id}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    const seen = (p, who) => T(p, (w) => { const o = window.__duo.others.find((x) => x.id === w); return o ? { face: o.look.face, acting: o.acting } : null; }, who);
    check('새로 온 친구에게 방장의 표정이 그대로 보임', (await seen(B, 'h')).face === 'wink' && (await seen(C, 'h')).face === 'wink', await seen(B, 'h'));
    await T(A, () => window.__tree.setLook({ face: 'happy' }));
    check('표정을 바꾸면 꾸미는 친구와 구경하는 친구 모두에게 바로 보임', await until(async () => (await seen(B, 'h')).face === 'happy' && (await seen(C, 'h')).face === 'happy', 4000));
    await T(A, () => window.__tree.doAct('dance'));
    check('방장이 춤을 추면 모두에게 춤추는 모습이 보임', await until(async () => (await seen(B, 'h')).acting === 'dance' && (await seen(C, 'h')).acting === 'dance', 3000), await seen(B, 'h'));
    const bid = await T(B, () => window.__duo.me), cid = await T(C, () => window.__duo.me);
    await B.tap('#emo'); await sleep(200); await B.tap('#actList .pick[data-v="wave"]');
    check('친구가 손을 흔들면 방장과 다른 친구에게 보임', await until(async () => (await seen(A, bid)).acting === 'wave' && (await seen(C, bid)).acting === 'wave', 3000), { a: await seen(A, bid), c: await seen(C, bid) });
    check('구경하는 사람에게도 표정·행동 단추가 있음', (await C.isVisible('#emo')) && (await audit(C)).length === 0, await audit(C));
    await C.tap('#emo'); await sleep(200); await C.tap('#faceList .pick[data-v="wow"]'); await C.tap('#actList .pick[data-v="cheer"]');
    check('구경하는 사람의 표정과 행동도 모두에게 보임', await until(async () => { const a = await seen(A, cid), b = await seen(B, cid); return a.face === 'wow' && b.face === 'wow' && a.acting === 'cheer' && b.acting === 'cheer'; }, 3000), { a: await seen(A, cid), b: await seen(B, cid) });
    check('행동은 한 사람의 것만 바뀜 (다른 사람은 그대로)', (await seen(A, bid)).acting !== 'cheer' && (await T(A, () => window.__tree.me.acting)) !== 'cheer');
    await A.screenshot({ path: path.join(__dirname, 'out', 'emote-friends.png') });

    /* 이상한 소식 */
    await sleep(2500);
    await T(B, () => { for (const m of [{ t: 'fx', k: 'act' }, { t: 'fx', k: 'act', v: 5 }, { t: 'fx', k: 'act', v: 'fly' }, { t: 'fx', k: 'act', v: 'x'.repeat(99) }, { t: 'fx', id: 'zzz', k: 'act', v: 'wave' }, { t: 'look', id: 'h', look: { gender: 'f', outfit: 'basic', face: '<script>' } }, { t: 'look', id: 'h', look: { gender: 'f', outfit: 'basic', face: 7 } }]) window.__duo.feed(m); });
    check('이상한 행동·표정 소식이 와도 버팀 (바뀌지 않음)', (await seen(B, 'h')).face === 'happy' && (await T(B, () => window.__duo.others.every((o) => o.acting === null || o.acting === 'dance' || o.acting === 'cheer'))) && (await T(B, () => window.__tree.me.acting)) === null);
    await T(B, () => window.__duo.feed({ t: 'look', id: 'h', look: { gender: 'm', outfit: 'santa' } }));
    check('표정이 없던 때의 생김새 소식도 받음 (기본 표정)', (await seen(B, 'h')).face === 'smile' && await T(B, () => window.__duo.others.find((o) => o.id === 'h').look.outfit === 'santa'));
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
