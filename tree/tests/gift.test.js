// 트리 밑 선물 교환 검사. 실행: cd tree/tests && node gift.test.js
// 날짜는 window.__now 로 바꾼다 (setNow). 처음에는 2026년 11월 12일 낮.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8192, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__gift && window.__tree.frames > 3)), 20000);
const NOV12 = new Date(2026, 10, 12, 13, 0).getTime();
const clockInit = (ctx) => ctx.addInitScript(() => {
  const b = +sessionStorage.getItem('giftNow') || 0, t0 = Date.now(); if (b) window.__now = () => b + (Date.now() - t0);
  window.__toasts = []; // 지나간 알림도 볼 수 있게 적어 둔다
  addEventListener('DOMContentLoaded', () => { const t = document.getElementById('toast'); if (t) new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); });
});
async function open(ctx, url, page, base = NOV12) {
  const p = page || await ctx.newPage();
  if (!page) { p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); }); await p.goto(BASE + 'tests/none.html'); }
  await p.evaluate((b) => sessionStorage.setItem('giftNow', String(b)), base);
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const setNow = (p, ms) => p.evaluate((b) => { sessionStorage.setItem('giftNow', String(b)); const t0 = Date.now(); window.__now = () => b + (Date.now() - t0); }, ms);
const audit = (p) => p.evaluate(() => {
  const bad = [];
  for (const b of document.querySelectorAll('button, a, input:not([type=file])')) {
    const r = b.getBoundingClientRect();
    if (!r.width || b.closest('[hidden]') || getComputedStyle(b).display === 'none') continue;
    const name = (b.textContent || b.getAttribute('aria-label') || b.id || '').trim();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (!b.closest('.scroll') && !b.closest('.gl') && (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5)) bad.push(`${name}: 화면 밖`);
  }
  return bad;
});
const toastHas = (p, t) => until(() => p.evaluate((t) => window.__toasts.some((x) => x.includes(t)), t), 4000);
const gifts = (p) => T(p, () => [...window.__tree.S.gifts.values()].map((g) => ({ ...g })));
const cakeLeft = (p) => T(p, () => window.__tree.cakes().map((c) => c.left).join(','));

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(p.endsWith('none.html') ? 200 : 404, { 'content-type': 'text/html' }); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    await clockInit(ctx);

    /* 상태 규칙 (state.js) */
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ga`);
    const rules = await T(A, async () => {
      const m = await import('./state.js'), g = await import('./gift.js'), S = m.makeState(), ap = (op) => m.apply(S, op, () => false), at = Date.now(), r = {};
      const G = (o) => ({ t: 'gift', id: 'g1', to: '엄마', from: '나', text: '사랑해요', wrap: 'red', at, cake: '', ...o });
      r.ok = ap(G());
      r.dup = ap(G());
      r.noText = ap(G({ id: 'g2', text: '' }));
      r.bad = ap(G({ id: 'g3', to: '' })) || ap(G({ id: 'g3', to: '가'.repeat(11) })) || ap(G({ id: 'g3', from: '' })) || ap(G({ id: 'g3', text: '가'.repeat(81) })) || ap(G({ id: 'g3', text: '줄\n바꿈' }))
        || ap(G({ id: 'g3', wrap: 'zebra' })) || ap(G({ id: 'g3', at: -1 })) || ap(G({ id: 'A B' })) || ap(G({ id: 'g3', cake: 'nocake' }));
      r.n2 = S.gifts.size;
      for (let k = 0; k < 30; k++) ap(G({ id: 'm' + k }));
      r.max = S.gifts.size;
      r.open = ap({ t: 'giftOpen', id: 'g1' }) && S.gifts.get('g1').open && !ap({ t: 'giftOpen', id: 'g1' }) && !ap({ t: 'giftOpen', id: 'zz' });
      r.del = ap({ t: 'giftDel', id: 'm0' }) && !S.gifts.has('m0') && !ap({ t: 'giftDel', id: 'm0' });
      // 케이크 한 조각 담기: 작업대 위의 케이크가 한 조각 준다
      const S2 = m.makeState(), ap2 = (op) => m.apply(S2, op, () => false);
      ap2({ t: 'put', id: 'bench', k: 'cake', i: 2, j: 2, r: 0 });
      r.cake = ap2(G({ id: 'c1', cake: 'bench' })) && S2.cakes.get('bench').left === 7 && S2.gifts.get('c1').cake === true;
      ap2({ t: 'cakeTop', id: 'bench', k: 'candle', x: -0.1, z: -0.1 }); ap2({ t: 'cakeLit', id: 'bench', n: 1 });
      r.litNo = !ap2(G({ id: 'c2', cake: 'bench' })) && !S2.gifts.has('c2') && S2.cakes.get('bench').left === 7;
      ap2({ t: 'cakeLit', id: 'bench', n: 0 });
      for (let k = 0; k < 7; k++) ap2(G({ id: 'e' + k, cake: 'bench' }));
      r.gone = !ap2(G({ id: 'c3', cake: 'bench' })) && S2.cakes.get('bench').gone;
      // 저장했다가 다시 열기 (케이크는 다시 줄지 않는다)
      const d = JSON.parse(JSON.stringify(m.serialize(S2))), S3 = m.makeState();
      for (const op of m.ops(d)) m.apply(S3, op, () => false);
      r.v = d.v;
      r.round = S3.gifts.size === S2.gifts.size && S3.gifts.get('c1').cake === true && S3.cakes.get('bench').gone && JSON.stringify(m.giftsList(S3)) === JSON.stringify(m.giftsList(S2));
      const d1 = JSON.parse(JSON.stringify(m.serialize(S))), S4 = m.makeState();
      for (const op of m.ops(d1)) m.apply(S4, op, () => false);
      r.roundOpen = S4.gifts.get('g1').open === true && S4.gifts.get('g2').open === false && S4.gifts.size === S.gifts.size;
      const old = { v: 2, at: 1, sync: 0, items: [], orns: [], lights: ['off', 'on'], wall: 'cream', floor: 'oak' }, S5 = m.makeState();
      for (const op of m.ops(old)) m.apply(S5, op, () => false);
      r.old = S5.gifts.size === 0 && Array.isArray(m.serialize(S5).gifts);
      // 여는 때: 둔 해의 12월 25일 0시 (25일~31일에 둔 것은 바로)
      r.openAt = g.openAt(new Date(2026, 10, 12).getTime()) === new Date(2026, 11, 25).getTime() && g.openAt(new Date(2026, 11, 27).getTime()) === new Date(2026, 11, 25).getTime();
      return r;
    });
    check('선물 두기: 받는 사람·보내는 사람 1~10자, 편지 0~80자, 포장 색, 때, id 를 거름', rules.ok && !rules.dup && rules.noText && !rules.bad && rules.n2 === 2, rules);
    check('방 하나에 24개까지', rules.max === 24, rules);
    check('선물 열기(한 번만), 치우기', rules.open && rules.del, rules);
    check('케이크 한 조각 담기: 그 케이크가 한 조각 줄고, 촛불이 켜져 있거나 다 먹은 케이크는 안 됨', rules.cake && rules.litNo && rules.gone, rules);
    check('저장했다 다시 열어도 선물·열림·케이크가 그대로 (케이크는 다시 줄지 않음, 저장 형식 v 2)', rules.round && rules.roundOpen && rules.v === 2, rules);
    check('선물이 없던 때의 방은 빈 트리 밑으로 열림, 여는 때 계산', rules.old && rules.openAt, rules);

    /* 트리 앞에서 */
    await T(A, () => window.__tree.me.place(1.25, 1.25));
    const near = await until(() => T(A, () => window.__tree.nearAction()), 3000);
    check('트리 앞에서 스페이스바 안내 "🎁 트리 밑 선물"', near === '🎁 트리 밑 선물', near);
    check('스페이스바 안내 단추(#act)가 화면 안에 보임', await until(() => A.isVisible('#act'), 3000));
    await A.tap('#act');
    check('누르면 선물 판이 열림 (빈 트리 밑, D-43)', await until(async () => (await T(A, () => window.__gift.view)) === 'list' && (await A.textContent('#giftP')).includes('아직 트리 밑에 선물이 없어요') && (await A.textContent('#giftP')).includes('D-43'), 3000), await A.textContent('#giftP'));
    check('판이 열려 있을 때 #act·눈싸움 단추는 숨음', !(await A.isVisible('#act')) && !(await A.isVisible('#snowBtn')));
    let bad = await audit(A);
    check('폰(375×812) 목록 판: 44px 이상, 화면 안', bad.length === 0, bad);
    await A.tap('#giftNew');
    check('선물 두기를 누르면 쓰는 판 (보내는 사람은 내 이름이 기본)', (await T(A, () => window.__gift.view)) === 'write' && (await A.inputValue('#giftFrom')) === '방장');
    check('케이크가 있으면 "케이크 한 조각 담기"를 켤 수 있음', (await A.getAttribute('#giftCake', 'aria-disabled')) === null);
    bad = await audit(A);
    check('폰(375×812) 쓰는 판: 44px 이상, 화면 안', bad.length === 0, bad);
    await A.fill('#giftTo', '루돌프'); await A.fill('#giftText', '<b>메리</b> 크리스마스! 🎄');
    await A.tap('#giftWraps .sw[data-v="blue"]');
    await A.tap('#giftCake');
    check('포장 색과 케이크 담기를 누르면 눌린 표시', (await A.getAttribute('#giftWraps .sw[data-v="blue"]', 'aria-pressed')) === 'true' && (await A.getAttribute('#giftCake', 'aria-pressed')) === 'true');
    await A.screenshot({ path: path.join(__dirname, 'out', 'gift-write.png') });
    const left0 = await cakeLeft(A);
    await A.tap('#giftSend');
    check('트리 밑에 두면 상자가 생기고 목록으로 돌아감', await until(async () => (await gifts(A)).length === 1 && (await T(A, () => window.__gift.boxes)).length === 1 && (await T(A, () => window.__gift.view)) === 'list'));
    let g1 = (await gifts(A))[0];
    check('선물에 받는 사람·보낸 사람·편지·포장·케이크가 담김', g1.to === '루돌프' && g1.from === '방장' && g1.text === '<b>메리</b> 크리스마스! 🎄' && g1.wrap === 'blue' && g1.cake === true && !g1.open, g1);
    check('케이크가 한 조각 줄어듦 (주방 케이크와 이어짐)', left0 === '8' && (await cakeLeft(A)) === '7', [left0, await cakeLeft(A)]);
    const panelText = await A.textContent('#giftP');
    check('25일 전에는 목록에 "To. 루돌프"만 보이고 보낸 사람·편지는 숨김', panelText.includes('To. 루돌프') && !panelText.includes('크리스마스! 🎄') && !panelText.includes('From.'), panelText);
    const box = (await T(A, () => window.__gift.boxes))[0];
    check('상자는 트리 둘레의 걸을 수 없는 칸 안에 놓여 걷는 길을 막지 않음', Math.abs(box.x) <= 1 && Math.abs(box.z) <= 1 && Math.hypot(box.x, box.z) > 0.45 && (await T(A, () => { const W = window.__tree; return W.grid.free(10, 7) && W.grid.free(7, 10) && W.grid.free(10, 10) && W.grid.free(5, 8) && !W.grid.free(9, 9); })), box);
    await A.tap('#giftNew'); await A.fill('#giftTo', '엄마'); await A.tap('#giftSend');
    check('5초 안에 또 두면 막히고 알려 줌', (await toastHas(A, '초 뒤에 다시')) && (await gifts(A)).length === 1);
    await T(A, () => window.__gift.resetGap());
    await A.fill('#giftTo', '');
    await A.tap('#giftSend');
    check('받는 사람이 비어 있으면 두지 않음', (await toastHas(A, '받는 사람 이름을')) && (await gifts(A)).length === 1);
    await A.tap('#giftBack');
    // 상자를 누르면
    await T(A, () => window.__gift.close());
    await T(A, () => window.__tree.snapView());
    const tapRes = await T(A, (id) => { const W = window.__tree, b = window.__gift.boxes.find((x) => x.id === id), s = W.screenOf(b.x, b.z, 0.12); return window.__gift.tap(s.x, s.y); }, g1.id);
    check('25일 전에 상자를 누르면 "To. 루돌프 · 12월 25일 0시에 열 수 있어요 (D-43)"', tapRes && (await toastHas(A, 'To. 루돌프 · 12월 25일 0시에 열 수 있어요 (D-43)')));
    check('25일 전에는 열리지 않음', (await T(A, (id) => window.__gift.openGift(id), g1.id)) === false && !(await gifts(A))[0].open);

    /* 25일 0시가 되는 순간 */
    await setNow(A, new Date(2026, 11, 24, 23, 59, 58).getTime());
    await sleep(600);
    check('24일 밤에도 아직 열 수 없음', (await T(A, (id) => window.__gift.canOpen(window.__tree.S.gifts.get(id)), g1.id)) === false);
    check('0시가 지나면 "선물을 열 수 있어요! 🎁" 알림', await until(async () => (await A.textContent('#toast')).includes('선물을 열 수 있어요! 🎁'), 6000));
    check('그 순간 모든 선물 상자가 들썩임', (await T(A, () => window.__gift.boxes)).every((b) => b.jig > 0.5));
    check('트리 앞 스페이스바 안내가 "🎁 선물 열기"로 바뀜', await until(() => T(A, () => window.__tree.nearAction() === '🎁 선물 열기'), 3000));
    await A.tap('#act');
    await until(async () => (await T(A, () => window.__gift.view)) === 'list');
    await A.tap(`#giftP .gr[data-id="${g1.id}"] .btn.main`);
    check('열면 뚜껑이 열리고 편지가 보임 (보낸 사람·편지, 태그는 글자 그대로)', await until(async () => { const b = (await T(A, () => window.__gift.boxes))[0]; return b.lid < -1.5 && b.letter && (await T(A, () => window.__gift.view)) === 'read'; }, 4000) && (await A.textContent('#giftP')).includes('From. 방장') && (await A.textContent('#giftP')).includes('<b>메리</b> 크리스마스! 🎄') && (await A.locator('#giftP .letter b').count()) === 1);
    check('케이크 조각이 담겨 있으면 냠냠', (await toastHas(A, '냠냠')) && (await A.textContent('#giftP')).includes('케이크 한 조각'));
    bad = await audit(A);
    check('폰(375×812) 읽는 판: 44px 이상, 화면 안', bad.length === 0, bad);
    await A.screenshot({ path: path.join(__dirname, 'out', 'gift-read.png') });
    await A.tap('#giftList');
    check('연 선물은 목록에 "읽기"로 남음', await until(async () => (await T(A, () => window.__gift.rows))[0].btns.includes('읽기')));
    await T(A, () => window.__gift.close());
    // 25일~31일에 둔 선물은 바로 열린다
    await setNow(A, new Date(2026, 11, 27, 10, 0).getTime());
    await T(A, () => { window.__gift.resetGap(); window.__gift.openPanel(); window.__gift.draft = { to: '아빠', text: '고마워요', wrap: 'gold' }; });
    check('27일에 둔 선물은 바로 열 수 있음', (await T(A, () => window.__gift.send())) && (await T(A, () => { const g = [...window.__tree.S.gifts.values()].find((x) => x.to === '아빠'); return window.__gift.openGift(g.id); })));
    await sleep(600);
    // 다시 열어도
    await open(ctx, `${BASE}?net=bc&door=0&ns=ga`, A, new Date(2026, 11, 27, 10, 0).getTime());
    const re = await gifts(A);
    check('다시 열어도 선물과 연 모습이 그대로 (열린 상자로 보임)', re.length === 2 && re.every((g) => g.open) && (await until(async () => (await T(A, () => window.__gift.boxes)).every((b) => b.lid < -1.5 && b.letter), 3000)));
    await T(A, (id) => window.__gift.read(id), g1.id);
    check('연 선물을 다시 읽을 수 있음', (await A.textContent('#giftP')).includes('<b>메리</b> 크리스마스! 🎄'));
    await T(A, () => window.__gift.close());
    // 24개까지
    const cap = await T(A, () => { const W = window.__tree; for (let k = 0; k < 30; k++) W.dispatch({ t: 'gift', id: 'cap' + k, to: '친구' + k, from: '나', text: '', wrap: 'red', at: window.__now(), cake: '' }); return W.S.gifts.size; });
    check('선물은 24개까지, 상자도 24개', cap === 24 && (await until(async () => (await T(A, () => window.__gift.boxes)).length === 24, 3000)));
    const spread = await T(A, () => { const b = window.__gift.boxes; let min = 9; for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) min = Math.min(min, Math.hypot(b[i].x - b[j].x, b[i].z - b[j].z)); return { min, inside: b.every((x) => Math.abs(x.x) <= 1 && Math.abs(x.z) <= 1) }; });
    check('24개가 겹치지 않고 트리 둘레에 놓임', spread.min > 0.2 && spread.inside, spread);
    await T(A, () => window.__tree.setZoomMul(2.2)); await sleep(800);
    await A.screenshot({ path: path.join(__dirname, 'out', 'gift-tree.png') });
    await T(A, () => { const W = window.__tree; W.setZoomMul(1); for (const g of [...W.S.gifts.values()]) if (g.id.startsWith('cap')) W.dispatch({ t: 'giftDel', id: g.id }); });
    await sleep(700); // 저장될 때까지

    /* 여럿이: 방장 A, 꾸미는 B, 구경하는 C (11월 20일) */
    const NOV20 = new Date(2026, 10, 20, 20, 0).getTime();
    await open(ctx, `${BASE}?net=bc&door=0&ns=ga`, A, NOV20);
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=gb#r=${room}`, null, NOV20);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=gc#v=${rid}`, null, NOV20);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(C, () => window.__duo.others)).length === 2 && (await T(B, () => window.__duo.others)).length === 2, 20000);
    check('친구들도 방장의 트리 밑 선물을 받음', (await gifts(B)).length === 2 && (await gifts(C)).length === 2 && (await T(C, () => window.__gift.boxes)).length === 2);
    await T(C, () => window.__tree.me.place(1.25, 1.25));
    check('구경하는 사람도 트리 앞에서 선물 판을 열 수 있음', await until(() => T(C, () => window.__tree.nearAction() === '🎁 트리 밑 선물'), 3000));
    await C.tap('#act');
    await until(async () => (await T(C, () => window.__gift.view)) === 'list');
    check('구경하는 사람에게는 치우기 단추가 없음', (await T(C, () => window.__gift.rows)).every((r) => !r.btns.includes('치우기')));
    bad = await audit(C);
    check('구경하는 사람 폰 화면에서도 44px 이상, 화면 안', bad.length === 0, bad);
    await C.tap('#giftNew');
    await C.fill('#giftTo', '방장'); await C.fill('#giftFrom', '구경꾼'); await C.fill('#giftText', '비밀 편지');
    await C.tap('#giftSend');
    check('구경하는 사람이 둔 선물이 모두에게 보임', await until(async () => (await gifts(A)).some((g) => g.from === '구경꾼') && (await gifts(B)).some((g) => g.from === '구경꾼')));
    check('다른 사람에게 "트리 밑에 To. 방장 선물이 놓였어요" 알림', await toastHas(B, '트리 밑에 To. 방장 선물이 놓였어요'));
    await T(B, () => window.__gift.openPanel());
    const bText = await B.textContent('#giftP');
    check('25일 전에는 다른 사람 화면에도 보낸 사람·편지가 보이지 않음', bText.includes('To. 방장') && !bText.includes('구경꾼') && !bText.includes('비밀 편지'), bText);
    await T(C, () => window.__duo.rawOp({ t: 'gift', id: 'zzraw1', to: '도배', from: '구경꾼', text: '', wrap: 'red', at: Date.now(), cake: '' }));
    await sleep(900);
    check('구경하는 사람이 5초 안에 또 보낸 선물은 방장이 거름', !(await gifts(A)).some((g) => g.to === '도배') && !(await gifts(B)).some((g) => g.to === '도배'));
    const cg = (await gifts(A)).find((g) => g.from === '구경꾼');
    check('구경하는 사람의 화면에서 치우기는 막힘', (await T(C, (id) => window.__tree.dispatch({ t: 'giftDel', id }), cg.id)) === false);
    await T(C, (id) => window.__duo.rawOp({ t: 'giftDel', id }), cg.id);
    await sleep(800);
    check('구경하는 사람이 보낸 치우기는 방장이 받지 않음', (await gifts(A)).some((g) => g.id === cg.id));
    // 25일: 각자 시계로 열리고, 연 것은 모두에게 열린다
    for (const p of [A, B, C]) await setNow(p, new Date(2026, 11, 25, 9, 0).getTime());
    await sleep(700);
    await T(C, () => { window.__gift.close(); });
    check('구경하는 사람도 25일에는 선물을 열 수 있음', await T(C, (id) => window.__gift.openGift(id), cg.id));
    check('연 선물은 모두에게 열린 모습으로 보이고 알림', await until(async () => (await gifts(A)).find((g) => g.id === cg.id).open && (await gifts(B)).find((g) => g.id === cg.id).open) && (await toastHas(A, 'To. 방장 선물이 열렸어요')));
    check('연 사람에게 편지가 보임', (await C.textContent('#giftP')).includes('비밀 편지'));
    await T(B, () => window.__gift.openPanel());
    await B.tap(`#giftP .gr[data-id="${cg.id}"] button:text("치우기")`);
    check('꾸미는 사람이 치우면 모두에게서 없어짐', await until(async () => !(await gifts(A)).some((g) => g.id === cg.id) && !(await gifts(C)).some((g) => g.id === cg.id) && (await T(C, () => window.__gift.boxes)).length === 2));
    check('세 사람의 방 상태가 같음 (선물)', await until(async () => { const s = (p) => T(p, () => JSON.stringify(window.__tree.serialize().gifts)); const a = await s(A); return a === await s(B) && a === await s(C); }, 6000));
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) {
    console.log('검사 중 오류:', e);
    results.push(false);
  } finally {
    await browser.close();
    server.close();
  }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
