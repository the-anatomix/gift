// 의상 검사 (옷 12가지 · 색 · 소품 · 고르는 판(폰) · 저장 · 친구에게 보이기 · 방장만 입는 비행 슈트의 잠금). 실행: cd tree/tests && node costume.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8199, BASE = `http://localhost:${PORT}/tree/`;
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
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ca`);
    const meshes = (p) => T(p, () => { let n = 0; window.__tree.me.root.traverse((o) => { if (o.isMesh) n++; }); return n; });
    const colors = (p) => T(p, () => { const s = new Set(); window.__tree.me.root.traverse((o) => { if (o.isMesh && o.material.color) s.add(o.material.color.getHex()); }); return [...s]; });
    const look = (p) => T(p, () => window.__tree.look);
    const shot = async (p, name) => { await T(p, () => window.__tree.snapView()); await sleep(250); await p.screenshot({ path: path.join(__dirname, 'out', name) }); };

    /* 고르는 판 */
    await A.tap('#tabs button[data-m="look"]'); await sleep(400);
    const outfits = await A.locator('#pickOutfit .chip').allTextContents();
    check('옷 12가지(평상복·산타·루돌프·눈사람·엘프·펭귄·곰 잠옷·한복·정장·후드티·패딩·비행 슈트)', outfits.length === 12 && ['눈사람', '엘프', '펭귄', '곰 잠옷', '한복', '정장', '후드티', '패딩', '비행 슈트'].every((n) => outfits.some((t) => t.includes(n))), outfits);
    check('갈래 단추 6개(옷·색·모자·목·안경·등), 처음은 옷', (await A.locator('#cosTabs .chip').count()) === 6 && (await A.getAttribute('#cosTabs .chip[data-v="outfit"]', 'aria-pressed')) === 'true' && (await A.isVisible('#pickOutfit')) && !(await A.isVisible('#pickHat')));
    check('고르기 판의 단추가 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    const sheetH = await T(A, () => document.getElementById('look').getBoundingClientRect().height);
    check('판이 폰 화면의 절반을 넘지 않음', sheetH < 330, sheetH);
    const n0 = await meshes(A);
    const counts = {};
    for (const g of ['f', 'm']) for (const o of ['snowman', 'elf', 'penguin', 'bear', 'hanbok', 'suit', 'hoodie', 'padding']) {
      await A.tap(`#pickGender .chip[data-v="${g}"]`); await A.tap(`#pickOutfit .chip[data-v="${o}"]`); await sleep(80);
      counts[g + o] = await meshes(A);
      if (g === 'f') await shot(A, `costume-${o}.png`);
    }
    check('새 옷 8가지 × 성별 2가지를 모두 눌러도 오류 없이 몸이 만들어짐', errors.length === 0 && Object.values(counts).every((n) => n > 20) && (await look(A)).outfit === 'padding', counts);
    check('옷마다 도형 수가 크게 늘지 않음 (90개 이하)', Object.values(counts).every((n) => n <= 90), counts);
    check('누른 옷이 눌린 모양으로 표시됨', (await A.getAttribute('#pickOutfit .chip[data-v="padding"]', 'aria-pressed')) === 'true' && (await A.getAttribute('#pickOutfit .chip[data-v="basic"]', 'aria-pressed')) === 'false');

    /* 색 */
    await A.tap('#cosTabs .chip[data-v="tint"]'); await sleep(200);
    check('색 갈래: 색 10가지(기본 포함)가 보이고 옷 목록은 숨음', (await A.locator('#pickTint .sw').count()) === 10 && (await A.isVisible('#pickTint')) && !(await A.isVisible('#pickOutfit')) && (await audit(A)).length === 0, await audit(A));
    const c0 = await colors(A);
    await A.tap('#pickTint .sw[data-v="purple"]'); await sleep(120);
    const c1 = await colors(A);
    check('색을 고르면 옷 색이 바뀜 (패딩이 보라색)', (await look(A)).tint === 'purple' && c1.includes(0x8C6BC8) && !c0.includes(0x8C6BC8) && !c1.includes(0xF08A3C), c1.map((x) => x.toString(16)));
    await T(A, () => window.__tree.setLook({ outfit: 'santa' }));
    check('색이 없는 옷(산타)은 그대로 빨강', (await colors(A)).includes(0xD23A30) && !(await colors(A)).includes(0x8C6BC8));
    await A.tap('#pickTint .sw[data-v=""]'); await sleep(100);
    check('"기본 색"을 누르면 색을 뺌', (await look(A)).tint === '');

    /* 소품 */
    await T(A, () => window.__tree.setLook({ outfit: 'basic', gender: 'f' }));
    const nb = await meshes(A);
    const add = {};
    for (const [tab, box, ids] of [['hat', 'pickHat', ['beanie', 'cap', 'party', 'ribbon', 'crown', 'muff']], ['neck', 'pickNeck', ['scarf', 'bow', 'bell']], ['eye', 'pickEye', ['round', 'sun']], ['back', 'pickBack', ['pack', 'wing', 'cape']]]) {
      await A.tap(`#cosTabs .chip[data-v="${tab}"]`); await sleep(150);
      if (tab === 'hat') check('모자 갈래: 없음 + 6가지, 단추 44px 이상', (await A.locator('#pickHat .pick').count()) === 7 && (await audit(A)).length === 0, await audit(A));
      for (const id of ids) { await A.tap(`#${box} .pick[data-v="${id}"]`); await sleep(60); add[id] = (await meshes(A)) - nb; await A.tap(`#${box} .pick[data-v=""]`); await sleep(40); }
    }
    check('소품 14가지(모자 6·목 3·안경 2·등 3)를 하나씩 쓰면 몸에 붙고, "없음"을 누르면 떨어짐', Object.keys(add).length === 14 && Object.values(add).every((n) => n >= 1 && n <= 8) && (await meshes(A)) === nb, add);
    await T(A, () => window.__tree.setLook({ hat: 'crown', neck: 'scarf', eye: 'round', back: 'wing', tint: 'blue' }));
    const full = await meshes(A);
    check('옷과 소품 넷을 한꺼번에 (섞어 쓰기)', full > nb + 8 && (await look(A)).hat === 'crown' && (await look(A)).back === 'wing' && (await colors(A)).includes(0x4F7FD0), full - nb);
    await shot(A, 'costume-mix.png');
    await A.tap('#cosTabs .chip[data-v="hat"]'); await sleep(100);
    await T(A, () => window.__tree.setLook({ outfit: 'rudolph', eye: '', neck: '', back: '' }));
    const deer = await meshes(A);
    await A.tap('#pickHat .pick[data-v="party"]'); await sleep(150);
    check('모자가 달린 옷(루돌프)에서는 모자 소품이 안 보이고 알려 줌 (고른 것은 기억)', (await meshes(A)) === deer && (await look(A)).hat === 'party' && /모자/.test(await A.textContent('#toast')), await A.textContent('#toast'));
    await T(A, () => window.__tree.setLook({ outfit: 'hoodie' }));
    check('다른 옷으로 바꾸면 고른 모자가 다시 보임', (await T(A, () => { let n = 0; window.__tree.me.parts.head.traverse((o) => { if (o.isMesh) n++; }); return n; })) > 0 && (await look(A)).hat === 'party');
    check('옷을 바꿔도 표정은 그대로, 행동도 됨', await T(A, () => { const t = window.__tree; t.setLook({ face: 'wink' }); t.setLook({ outfit: 'bear' }); return t.look.face === 'wink' && t.me.act('wave'); }));

    /* 저장 */
    await T(A, () => window.__tree.setLook({ gender: 'm', outfit: 'hanbok', tint: 'green', hat: 'cap', neck: 'bell', eye: 'sun', back: 'pack', face: 'smile' }));
    await A.tap('#lookDone'); await sleep(200);
    await A.reload(); await ready(A);
    const lk = await look(A);
    check('다시 열어도 고른 옷·색·소품 그대로', lk.gender === 'm' && lk.outfit === 'hanbok' && lk.tint === 'green' && lk.hat === 'cap' && lk.neck === 'bell' && lk.eye === 'sun' && lk.back === 'pack' && !(await A.isVisible('#look')), lk);
    await A.evaluate(() => localStorage.setItem('nolja-tree-look.ca', '{"gender":"f","outfit":"elf","tint":"<b>","hat":5,"neck":"nope","eye":{"a":1},"back":"wing"}'));
    await A.reload(); await ready(A);
    const lk2 = await look(A);
    check('저장된 값이 이상하면 아는 값만 받음', lk2.outfit === 'elf' && lk2.tint === '' && lk2.hat === '' && lk2.neck === '' && lk2.eye === '' && lk2.back === 'wing' && errors.length === 0, lk2);
    await A.evaluate(() => localStorage.setItem('nolja-tree-look.ca', '{"gender":"m","outfit":"santa","face":"happy"}'));
    await A.reload(); await ready(A);
    const lk3 = await look(A);
    check('소품이 없던 때에 저장한 캐릭터도 그대로 열림', lk3.gender === 'm' && lk3.outfit === 'santa' && lk3.face === 'happy' && lk3.hat === '' && lk3.tint === '', lk3);

    /* 방장만 입는 비행 슈트 (고르는 판) */
    await A.tap('#tabs button[data-m="look"]'); await sleep(300);
    check('내 방(혼자)에서는 비행 슈트가 열려 있음', (await A.getAttribute('#pickOutfit .chip[data-v="jet"]', 'data-lock')) === '' && (await A.textContent('#pickOutfit .chip[data-v="jet"]')).includes('🚀'));
    await A.tap('#pickOutfit .chip[data-v="jet"]'); await sleep(200);
    check('방장이 누르면 입음', (await look(A)).outfit === 'jet' && (await colors(A)).includes(0xC2261F) && (await colors(A)).includes(0xE2B33C) && (await colors(A)).includes(0xBFF4FF));
    await shot(A, 'costume-jet.png');
    await T(A, () => window.__tree.setLook({ hat: 'crown', eye: 'sun' }));
    const jetN = await meshes(A);
    await T(A, () => window.__tree.setLook({ hat: '', eye: '' }));
    check('비행 슈트는 헬멧이라 모자·안경이 안 붙음', (await meshes(A)) === jetN, jetN);
    await A.tap('#lookDone'); await sleep(200);

    /* 친구에게 보임 */
    await T(A, () => window.__tree.setLook({ gender: 'f', outfit: 'penguin', hat: 'ribbon', neck: 'scarf', tint: 'pink' }));
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], id = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=cb#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=cc#v=${id}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    const seen = async (p, who) => { const o = (await T(p, () => window.__duo.others)).find((x) => x.id === who); return o ? o.look : null; };
    const hb = await seen(B, 'h');
    check('들어온 친구에게 방장의 옷·색·소품이 보임', hb && hb.outfit === 'penguin' && hb.neck === 'scarf' && hb.tint === 'pink' && hb.hat === 'ribbon', hb);
    await T(B, () => window.__tree.setLook({ gender: 'm', outfit: 'padding', tint: 'yellow', back: 'cape', eye: 'round' }));
    const bid = (await T(A, () => window.__duo.others))[0].id;
    check('친구가 고르면 방장과 구경하는 사람에게도 보임', await until(async () => { const a = await seen(A, bid), c = await seen(C, bid); return a && c && a.outfit === 'padding' && a.back === 'cape' && c.tint === 'yellow' && c.eye === 'round'; }));
    await T(A, () => window.__tree.setLook({ outfit: 'jet' }));
    check('방장이 비행 슈트를 입으면 친구들에게 보임', await until(async () => (await seen(B, 'h')).outfit === 'jet' && (await seen(C, 'h')).outfit === 'jet'));
    await B.tap('#tabs button[data-m="look"]'); await sleep(300);
    check('친구(방장이 아님)의 판에서는 비행 슈트가 잠겨 보임 (🔒)', (await B.getAttribute('#pickOutfit .chip[data-v="jet"]', 'data-lock')) === '1' && (await B.textContent('#pickOutfit .chip[data-v="jet"]')).includes('🔒') && (await audit(B)).length === 0, await audit(B));
    await B.tap('#pickOutfit .chip[data-v="jet"]'); await sleep(250);
    check('잠긴 옷을 누르면 안 입혀지고 방장만 된다고 알려 줌', (await look(B)).outfit === 'padding' && /방장/.test(await B.textContent('#toast')), await B.textContent('#toast'));
    await shot(B, 'costume-locked.png');
    await B.tap('#lookDone');
    await T(B, () => window.__duo.feed({ t: 'look', id: 'zz', look: { gender: 'f', outfit: 'jet', face: 'smile' } }));
    await T(A, (who) => window.__duo.feed({ t: 'look', look: { gender: 'm', outfit: 'jet', face: 'smile', hat: 'crown' } }, who), bid);
    await sleep(500);
    check('방장이 아닌 사람이 비행 슈트를 입었다는 소식은 평상복으로 받음', (await seen(A, bid)).outfit === 'basic' && (await seen(A, bid)).hat === 'crown' && (await seen(C, bid)).outfit === 'basic', await seen(A, bid));
    await T(B, () => { for (const lk of [{ gender: 'f', outfit: 'bear', face: 'smile', tint: 'x'.repeat(999), hat: ['a'], neck: null, back: 7 }, { gender: 'f', outfit: 'nope' }, null, 5]) window.__duo.feed({ t: 'look', id: 'h', look: lk }); });
    const h2 = await seen(B, 'h');
    check('이상한 색·소품 소식은 아는 값만 받고, 모르는 옷은 안 받음', h2.outfit === 'bear' && h2.tint === '' && h2.hat === '' && h2.back === '' && errors.length === 0, h2);
    await T(B, () => window.__duo.feed({ t: 'look', id: 'h', look: { gender: 'm', outfit: 'santa' } }));
    check('소품이 없던 때의 생김새 소식도 받음', (await seen(B, 'h')).outfit === 'santa' && (await seen(B, 'h')).hat === '');
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
