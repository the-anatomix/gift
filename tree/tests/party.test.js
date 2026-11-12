// 트리 점등식과 단체 사진 검사 (혼자, 그리고 셋이: 방장·꾸미는 친구·구경하는 친구). 실행: cd tree/tests && node party.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8175, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__party && window.__tree.frames > 3)), 20000);
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
const near = (a, b) => Math.abs(a - b) < 1e-9;
const same = (a, b) => near(a.hemi, b.hemi) && near(a.sun, b.sun) && near(a.glow, b.glow);
const bright = (p) => T(p, () => window.__party.bright());
const show = (p) => T(p, () => window.__party.show);
const photo = (p) => T(p, () => window.__party.photo);

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=pa`);

    /* 단추 */
    check('도구 단추 줄에 📷 단추가 있고, 모든 단추가 44px 이상·화면 안', (await A.isVisible('#snap')) && (await audit(A)).length === 0, await audit(A));
    await T(A, () => { document.getElementById('mic').hidden = false; });
    check('마이크 단추까지 보여도 도구 단추 줄이 폰 화면 밖으로 나가지 않음', (await audit(A)).length === 0, await audit(A));
    await T(A, () => { document.getElementById('mic').hidden = true; });
    await A.tap('#tabs button[data-m="tree"]'); await sleep(400);
    check('트리 판에 "🎄 점등식" 단추가 있고 화면 안·44px 이상', (await A.isVisible('#lightShow')) && (await audit(A)).length === 0, await audit(A));

    /* 점등식 (내려다보기) */
    await T(A, () => { window.__tree.dispatch({ t: 'put', id: 'mb', k: 'music', i: 15, j: 12, r: 3 }); window.__tree.dispatch({ t: 'lights', set: 'off', blink: 'on' }); });
    const base = await bright(A);
    await T(A, () => { window.__seen = []; new MutationObserver(() => { const t = document.getElementById('count').textContent; if (t && window.__seen[window.__seen.length - 1] !== t) window.__seen.push(t); }).observe(document.getElementById('count'), { childList: true, characterData: true, subtree: true }); });
    await A.tap('#lightShow');
    check('점등식을 누르면 큰 숫자 3 이 뜸', await until(async () => (await A.textContent('#count')) === '3', 1500), await A.textContent('#count'));
    await sleep(700);
    const t1 = (await show(A)).t;
    await A.tap('#lightShow'); await sleep(100);
    check('진행 중에 다시 눌러도 처음부터 다시 하지 않음', (await show(A)).t > t1, await show(A));
    await until(async () => (await show(A)).t > 2.8, 2000);
    let b = await bright(A);
    check('점등 직전에 방이 어두워짐 (해·하늘빛이 원래의 절반 아래)', b.hemi < base.hemi * 0.5 && b.sun < base.sun * 0.5, { b, base });
    check('"점등!"과 함께 트리 전구가 알록달록으로 켜짐', await until(async () => (await A.textContent('#count')) === '점등!' && await T(A, () => window.__tree.bulbsOn && window.__tree.S.lights.set === 'multi'), 2500));
    check('숫자가 3, 2, 1 로 줄고 "점등!"', (await T(A, () => window.__seen.join(','))) === '3,2,1,점등!', await T(A, () => window.__seen));
    await sleep(250);
    b = await bright(A);
    check('트리 둘레 빛이 확 밝아짐 (전구 켠 밝기의 두 배 넘게)', b.glow > 2.6 * 2, b);
    check('눈송이·반짝이가 내림', await T(A, () => document.querySelectorAll('#party i.snow').length) >= 10);
    check('오르골이 있으면 캐럴이 나옴', (await T(A, () => window.__play.song)) === 'jingle');
    await T(A, () => window.__tree.snapView());
    await A.screenshot({ path: path.join(__dirname, 'out', 'party-light.png') });
    await sleep(1800);
    const mid = await bright(A);
    check('방 밝기가 천천히 돌아오는 중', mid.hemi > b.hemi - 1e-6 && mid.hemi < base.hemi, { mid, b });
    check('끝나면 장면이 닫힘', await until(async () => (await show(A)) === null, 6000));
    const after = await bright(A);
    check('끝나면 조명 값이 정확히 원래대로 (트리 빛은 전구 켠 밝기)', near(after.hemi, base.hemi) && near(after.sun, base.sun) && near(after.glow, 2.6), { after, base });
    check('끝나면 큰 글이 사라짐', (await A.textContent('#count')) === '');
    await T(A, () => window.__play.setSong(null, false));

    /* 점등식 (1인칭) */
    await A.tap('#tabs button[data-m="tree"]'); await sleep(200);
    await A.tap('#pov'); await sleep(300);
    const fpBase = await bright(A);
    await T(A, () => window.__party.begin('light'));
    await until(async () => (await show(A)).t > 2.7, 4000);
    b = await bright(A);
    check('1인칭에서도 점등식: 방이 어두워짐', await T(A, () => window.__tree.eyeOn) && b.hemi < fpBase.hemi * 0.5, b);
    await T(A, () => window.__tree.dispatch({ t: 'lights', set: 'warm', blink: 'slow' })); // 장면 중에 누가 전구를 바꿈
    await sleep(200);
    check('장면 중에 전구를 바꿔도 장면의 밝기를 계속 따름', (await bright(A)).hemi < fpBase.hemi * 0.6);
    check('1인칭에서도 끝나면 조명 값이 정확히 원래대로', await until(async () => (await show(A)) === null, 8000) && same(await bright(A), fpBase), await bright(A));
    await A.tap('#pov'); await sleep(300);

    /* 단체 사진 */
    await T(A, () => window.__tree.snapView());
    await A.tap('#snap');
    check('📷 을 누르면 3초 카운트다운', await until(async () => (await A.textContent('#count')) === '3', 1500) && (await show(A)).v === 'photo');
    const fl = await T(A, () => window.__tree.screenOf(window.__tree.me.x + 1.2, window.__tree.me.z + 0.6, 0));
    await A.touchscreen.tap(fl.x, fl.y);
    check('세는 동안 걸어 다닐 수 있음', await until(() => T(A, () => window.__tree.me.moving), 1500));
    await A.tap('#emo'); await sleep(150); await A.tap('#actList .pick[data-v="wave"]');
    check('세는 동안 손을 흔들 수 있음 (포즈 잡기)', await until(() => T(A, () => window.__tree.me.acting === 'wave'), 1500));
    check('찰칵: 하얀 번쩍임', await until(() => T(A, () => document.getElementById('flash').classList.contains('on')), 4000));
    check('사진 미리보기가 뜸', await until(async () => { const ph = await photo(A); return ph && ph.open && ph.ready; }, 4000), await photo(A));
    await sleep(300);
    const ph = await photo(A);
    check('폴라로이드: 아래쪽 테두리가 더 넓고 사진은 세로로 김 (폰 화면 그대로)', ph.h > ph.w && ph.w >= 375, ph);
    check('사진에 장면이 찍힘 (한 가지 색이 아님)', (await T(A, () => window.__party.varied())) > 40, await T(A, () => window.__party.varied()));
    const foot = await T(A, () => window.__party.pixel(0.03, 0.97));
    check('사진 아래 테두리는 흰색', foot.every((c) => c > 235), foot);
    check('미리보기의 단추가 44px 이상·화면 안', (await audit(A)).length === 0 && (await A.isVisible('#photoSave')) && (await A.isVisible('#photoClose')), await audit(A));
    await A.screenshot({ path: path.join(__dirname, 'out', 'party-photo.png') });
    await T(A, () => { window.__dl = null; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__dl = { name: this.download, href: this.href.slice(0, 5) }; return; } return c.call(this); }; });
    await A.tap('#photoSave');
    const dl = await T(A, () => window.__dl);
    check('저장을 누르면 사진 파일로 내려받음 (jpg)', !!dl && /^nolja-tree-\d{8}-\d{6}\.jpg$/.test(dl.name) && dl.href === 'blob:', dl);
    await A.tap('#photoClose');
    check('닫기를 누르면 미리보기가 닫힘', (await photo(A)) === null && !(await A.isVisible('#photoP')));

    /* 셋이 같이 */
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], id = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=pb#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=pc#v=${id}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    const cid = await T(C, () => window.__duo.me);
    await A.tap('#snap');
    check('방장이 사진을 찍으면 친구들 화면에도 카운트다운', await until(async () => (await show(B)) && (await show(B)).v === 'photo' && (await show(C)) && (await show(C)).v === 'photo', 3000));
    check('찰칵 뒤에 모두에게 각자 화면의 사진 미리보기가 뜸', await until(async () => { const x = await Promise.all([A, B, C].map(photo)); return x.every((p) => p && p.open && p.ready); }, 6000), await Promise.all([A, B, C].map(photo)));
    check('구경하는 친구의 사진에도 장면이 찍힘', (await T(C, () => window.__party.varied())) > 40);
    for (const p of [A, B, C]) await p.tap('#photoClose');
    await T(A, () => window.__tree.dispatch({ t: 'lights', set: 'off', blink: 'on' }));
    await until(() => T(C, () => !window.__tree.bulbsOn), 3000);
    const cBase = await bright(C);
    await B.tap('#tabs button[data-m="tree"]'); await sleep(300);
    await B.tap('#lightShow');
    check('꾸미는 친구가 점등식을 시작하면 모두의 화면에서 시작', await until(async () => (await show(A)) && (await show(A)).v === 'light' && (await show(C)) && (await show(C)).v === 'light', 3000));
    check('모두의 화면에서 전구가 켜짐 (시작한 사람이 켬)', await until(async () => (await Promise.all([A, B, C].map((p) => T(p, () => window.__tree.bulbsOn && window.__tree.S.lights.set === 'multi')))).every(Boolean), 6000));
    check('구경하는 친구 화면도 끝나면 조명이 정확히 원래대로', await until(async () => (await show(C)) === null, 9000) && near((await bright(C)).hemi, cBase.hemi) && near((await bright(C)).glow, 2.6), await bright(C));
    await until(async () => (await show(A)) === null && (await show(B)) === null, 3000);
    await T(A, (c) => window.__duo.feed({ t: 'fx', k: 'show', v: 'light' }, c), cid);
    await sleep(300);
    check('구경하는 사람이 보낸 점등식 소식은 방장이 받지 않음', (await show(A)) === null && (await show(B)) === null);
    check('구경하는 사람에게는 점등식 단추가 없고 📷 은 있음', !(await C.isVisible('#lightShow')) && (await C.isVisible('#snap')) && (await audit(C)).length === 0, await audit(C));
    await T(B, () => { for (const m of [{ t: 'fx', k: 'show' }, { t: 'fx', k: 'show', v: 5 }, { t: 'fx', k: 'show', v: 'boom' }, { t: 'fx', k: 'show', v: 'x'.repeat(99) }]) window.__duo.feed(m); });
    await sleep(200);
    check('이상한 장면 소식은 무시', (await show(B)) === null);
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
