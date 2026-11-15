// 요리 대결 검사 (조리대·재료 진열대·심사석 가구 · 재료 고르기 → 조리법 → 요리(불·소리·시간) → 접시 · 요리표(부분 맞추기·셰프의 요리) · 심사위원 셋의 점수
//   · 🔔 요리 대결(혼자·시간 끝·여럿이·순위) · 친구 화면 · 늦게 온 사람 · 같이 열 때 · 심판이 나가면 취소 · 이상한 소식) (포트 8235)
// 실행: cd tree/tests && node cook.test.js
const PORT = 8235;
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(50); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__cook && window.__sfx && window.__play && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
  // 빈 방에서 시작하고, 시계를 앞당길 수 있게 한다 (window.__skip 밀리초만큼)
  await p.addInitScript(() => { window.__bare = true; window.__skip = 0; window.__now = () => Date.now() + window.__skip; });
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
// 폰 화면에서 보이는 단추가 화면 안에 있고 44px 이상이며 sel 안의 단추끼리 겹치지 않는지
const audit = (p, sel) => p.evaluate((sel) => {
  const bad = [], shown = (b) => b.getBoundingClientRect().width && !b.closest('[hidden]') && getComputedStyle(b).display !== 'none';
  for (const b of document.querySelectorAll('button, a, input[type=range]')) {
    if (!shown(b)) continue;
    const r = b.getBoundingClientRect(), name = (b.textContent || b.getAttribute('aria-label') || '').trim();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (!b.closest('.scroll') && (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5)) bad.push(`${name}: 화면 밖`);
  }
  const bs = [...document.querySelectorAll(sel)].filter(shown).map((b) => [b.textContent || b.id, b.getBoundingClientRect()]);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i][1], c = bs[j][1]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) bad.push(`겹침: ${bs[i][0]} / ${bs[j][0]}`); }
  return bad;
}, sel);
const near = (p) => T(p, () => window.__tree.nearAction());
const mode = (p) => T(p, () => window.__tree.mode);
const heard = (p, n) => T(p, (n) => window.__sfx.heard(n), n);
const hush = (p) => T(p, () => window.__sfx.clear());
const toastHas = (p, t, ms = 3000) => until(async () => (await p.textContent('#toast')).includes(t), ms);
const stand = async (p, x, z) => { await T(p, (a) => { const W = window.__tree; W.me.stop(); W.me.onArrive = null; W.me.place(a[0], a[1]); W.snapView(); }, [x, z]); await sleep(350); };
const shot = (p, name) => p.screenshot({ path: path.join(__dirname, 'out', name) });
const serve = () => http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
const PHONE = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
const put = (p, list) => T(p, (list) => list.every(([id, k, i, j, r]) => window.__tree.dispatch({ t: 'put', id, k, i, j, r })), list);
// 친구 한 명을 같은 방에 들인다
async function join(ctx, host, ns, n) {
  if (!['waiting', 'on'].includes(await T(host, () => window.__duo.mode))) { await T(host, () => window.__duo.invite()); await until(() => T(host, () => window.__duo.mode === 'waiting')); }
  const room = (await T(host, () => window.__duo.inviteUrl())).split('#r=')[1];
  const p = await open(ctx, `${BASE}?net=bc&door=0&ns=${ns}#r=${room}`);
  await until(async () => (await T(host, () => window.__duo.count)) === n, 20000);
  return p;
}
const mine = (p) => T(p, () => window.__cook.mine);
const step = (p) => T(p, () => window.__cook.step);
const kind = (p) => T(p, () => window.__cook.kind);
const views = (p) => T(p, () => window.__cook.views);
const contest = (p) => T(p, () => window.__cook.contest);
const band = (p) => T(p, () => window.__cook.band);
const result = (p) => T(p, () => window.__cook.result);
const ranked = (p) => T(p, () => window.__cook.ranked);
const flames = (p, id = 'ck') => T(p, (id) => window.__cook.flames(id), id);
const secs = (s) => { const [m, x] = String(s).split(':').map(Number); return m * 60 + x; };
const go = async (p, sel = '#playGo') => { await p.tap(sel); await sleep(150); };
// 조리대 판을 바로 열어 재료와 조리법을 고르고 요리를 시작한다 (fast 면 기다리지 않고 바로 끝낸다)
async function cook(p, ings, m, fast = true) {
  await T(p, () => window.__play.open('ck')); await sleep(250);
  if ((await step(p)) === 'done') await go(p, '#ckNew');
  await T(p, (a) => { window.__cook.basket = a[0]; window.__cook.method = a[1]; }, [ings, m]);
  await go(p); await go(p);
  if (fast) { await T(p, () => window.__cook.finish()); await until(async () => { const x = await mine(p); return x && !x.c; }, 4000); }
}
// 심사석 판을 바로 열어 낸다 (맛보는 시간 뒤 점수표)
async function present(p) {
  await T(p, () => window.__play.open('jd'));
  return until(() => result(p), 6000);
}

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = serve();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext(PHONE);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ka`);
    await A.tap('#c');

    // ── 기본은 그대로 ──
    check('요리 대결 가구를 놓기 전에는 띠·접시·판이 하나도 없음', await T(A, () => { const C = window.__cook; return !C.band && !C.contest && !C.mine && !C.views.length && !C.result && !C.ranked && !document.body.classList.contains('ck') && ['cookBand', 'cookRes', 'cookRank'].every((id) => document.getElementById(id).hidden); }));
    const cat = await T(A, async () => { const { FURNITURE } = await import('./catalog.js'); return ['cookst', 'pantry', 'judge'].map((id) => { const f = FURNITURE.find((x) => x.id === id); return f && [f.name, f.w, f.d, f.play, !!f.solid]; }); });
    check('가구 목록에 조리대(2×1)·재료 진열대(2×1)·심사석(3×1)', JSON.stringify(cat) === JSON.stringify([['요리 대결 조리대', 2, 1, 'cook', true], ['재료 진열대', 2, 1, 'pantry', true], ['심사석', 3, 1, 'judge', true]]), cat);

    // ── 가구 ──
    check('조리대·재료 진열대·심사석을 놓음', await put(A, [['ck', 'cookst', 13, 2, 0], ['pt', 'pantry', 16, 2, 0], ['jd', 'judge', 14, 7, 0]]) && await T(A, () => ['ck', 'pt', 'jd'].every((id) => window.__tree.itemShown(id))));
    check('조리대의 불꽃(냄비·팬)은 처음에는 꺼져 있음', JSON.stringify(await flames(A)) === JSON.stringify({ pot: false, pan: false, pan3: false }), await flames(A));
    await T(A, () => { const W = window.__tree; W.me.stop(); W.me.place(3.6, -1.4); W.snapView(); W.zoomBy(2.1); W.me.root.visible = false; });
    await sleep(800); await shot(A, 'cook-stations.png');
    await T(A, () => { window.__tree.me.root.visible = true; });
    await stand(A, 3.0, -2.05);
    check('조리대 앞에서 "🍳 요리하기"', (await near(A)) === '🍳 요리하기', await near(A));
    await stand(A, 4.5, -2.05);
    check('재료 진열대 앞에서 "🧺 재료 고르기"', (await near(A)) === '🧺 재료 고르기', await near(A));
    await stand(A, 3.75, 0.4);
    check('요리 없이 심사석 앞에서는 "🔔 요리 대결"', (await near(A)) === '🔔 요리 대결', await near(A));

    // ── 재료 진열대 ──
    await stand(A, 4.5, -2.05);
    await T(A, () => window.__tree.pressSpace());
    check('스페이스바로 재료 진열대 판이 열림', await until(async () => (await mode(A)) === 'play' && (await kind(A)) === 'pantry', 8000));
    check('진열대 판: 재료 16가지 단추가 폰 화면 안에 있고 44px 이상, 서로 안 겹침', (await T(A, () => document.querySelectorAll('#playBtns [id^="ckIng-"]').length)) === 16 && (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    for (const x of ['tomato', 'noodle', 'cheese', 'onion']) await go(A, '#ckIng-' + x);
    await go(A, '#ckIng-beef');
    check('재료는 4가지까지 (다섯째는 안내만)', JSON.stringify(await T(A, () => window.__cook.basket)) === JSON.stringify(['tomato', 'noodle', 'cheese', 'onion']) && await toastHas(A, '4가지까지'), await T(A, () => window.__cook.basket));
    check('고른 재료는 눌린 단추로 보임', await T(A, () => document.getElementById('ckIng-tomato').getAttribute('aria-pressed') === 'true' && document.getElementById('ckIng-beef').getAttribute('aria-pressed') === 'false'));
    await go(A, '#ckIng-onion');
    check('다시 누르면 뺌', JSON.stringify(await T(A, () => window.__cook.basket)) === JSON.stringify(['tomato', 'noodle', 'cheese']));
    await go(A);
    check('"🧺 다 담았어요"로 판이 닫히고 안내', await until(async () => (await mode(A)) === null, 3000) && await toastHas(A, '담았어요'));

    // ── 조리대: 재료 → 조리법 → 요리 ──
    await stand(A, 3.0, -2.05);
    await T(A, () => window.__tree.pressSpace());
    check('스페이스바로 조리대 판이 열림 (재료 고르기)', await until(async () => (await kind(A)) === 'cook', 8000) && (await step(A)) === 'pick');
    check('진열대에서 담은 재료가 그대로 담겨 있음', JSON.stringify(await T(A, () => window.__cook.basket)) === JSON.stringify(['tomato', 'noodle', 'cheese']) && (await A.textContent('#playSub')).includes('토마토'));
    check('재료 고르기 판: 폰 화면 안·44px 이상·안 겹침', (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    await shot(A, 'cook-panel.png');
    await T(A, () => { window.__cook.basket = ['tomato']; });
    await go(A);
    check('재료 한 가지로는 조리법으로 넘어가지 않음', (await step(A)) === 'pick' && await toastHas(A, '2가지 이상'));
    await T(A, () => { window.__cook.basket = ['kimchi', 'rice', 'egg']; });
    await go(A);
    check('조리법 고르기: 볶기·굽기·끓이기·튀기기·찌기, 폰 화면 안·44px 이상·안 겹침', (await step(A)) === 'method' && JSON.stringify(await T(A, () => [...document.querySelectorAll('#playBtns [id^="ckM-"]')].map((b) => b.textContent.split('\n')[1]))) === JSON.stringify(['볶기', '굽기', '끓이기', '튀기기', '찌기']) && (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    await go(A);
    check('조리법을 안 고르면 시작하지 않음', (await step(A)) === 'method' && await toastHas(A, '조리법을 골라요') && !(await mine(A)));
    await go(A, '#ckM-fry');
    await hush(A);
    const t0 = Date.now();
    await go(A);
    check('요리 시작: 팬 아래 불이 켜지고 팬 속 재료가 들썩임 (냄비 불은 꺼짐)', await until(async () => { const f = await flames(A); return f.pan && f.pan3 && !f.pot; }, 2000) && (await step(A)) === 'cooking', await flames(A));
    check('칼질·지글지글 소리', await until(async () => (await heard(A, 'chop')) && (await heard(A, 'sizzle')), 2500));
    await sleep(Math.max(0, 1800 - (Date.now() - t0)));
    check('2초쯤에는 아직 요리 중이고 진행률이 보임', (await mine(A)).c === 1 && /\d+%/.test(await A.textContent('#playSub')), await A.textContent('#playSub'));
    check('4초쯤 완성: 띵 소리·"완성!" 안내·불이 꺼짐', await until(async () => { const x = await mine(A); return x && !x.c; }, 6000) && Date.now() - t0 >= 3500 && (await heard(A, 'ovenDing')) > 0 && await toastHas(A, '완성!') && await until(async () => { const f = await flames(A); return !f.pan && !f.pot && !f.pan3; }, 1500), Date.now() - t0);
    check('완성 판: 김치볶음밥 · 들고 가기·새로 만들기·치우기·그만하기 (폰 화면 안)', (await step(A)) === 'done' && (await A.textContent('#playMain')).includes('김치볶음밥') && await T(A, () => ['playGo', 'ckNew', 'ckClear', 'playQuit'].every((id) => document.getElementById(id))) && (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    check('접시가 조리대 위에 놓임', JSON.stringify((await views(A)).map((v) => [v.owner, v.where, v.at, v.shown])) === JSON.stringify([['h', 's:ck', 'ck', true]]), await views(A));

    // ── 요리표 (부분 맞추기·셰프의 요리) ──
    const R = await T(A, () => { const C = window.__cook; const n = (a, m) => C.cook(a, m).name; return {
      a: n(['kimchi', 'rice', 'egg'], 'fry'), b: n(['egg', 'kimchi', 'rice'], 'fry'), c: n(['salmon', 'kimchi', 'rice'], 'fry'), d: n(['kimchi', 'rice', 'salmon', 'tomato'], 'fry'),
      e: n(['kimchi', 'pork'], 'boil'), f: n(['pork', 'kimchi'], 'grill'), g: n(['chicken', 'potato'], 'steam'), h: n(['chicken', 'potato'], 'deep'),
      i: C.cook(['salmon', 'cheese'], 'boil'), j: C.cook(['cheese', 'beef'], 'deep'), k: n(['noodle', 'shrimp', 'chili', 'onion'], 'boil'),
      counts: [C.INGS.length, C.METHODS.length, C.DISHES.length], icons: C.INGS.every((x) => x.icon && x.name) && C.METHODS.every((x) => x.icon && x.name),
      miss: C.DISHES.filter((d) => C.cook(d.need.length >= 2 ? d.need : [d.need[0], d.opt[0]], d.m[0]).id !== d.id).map((d) => d.id),
    }; });
    check('재료 16가지·조리법 5가지·요리 30가지 이상 (모두 그림 글자와 이름)', R.counts[0] === 16 && R.counts[1] === 5 && R.counts[2] >= 30 && R.icons, R.counts);
    check('김치·밥·달걀 + 볶기 = 김치볶음밥 (재료 순서는 상관없음)', R.a === '김치볶음밥' && R.b === '김치볶음밥', [R.a, R.b]);
    check('같은 재료도 조리법에 따라: 김치찌개(끓이기)·삼겹살 구이(굽기)·찜닭(찌기)·후라이드 치킨(튀기기)', R.e === '김치찌개' && R.f === '삼겹살 구이' && R.g === '찜닭' && R.h === '후라이드 치킨', [R.e, R.f, R.g, R.h]);
    check('부분 맞추기: 엉뚱한 재료 하나는 "연어 김치볶음밥", 둘이면 "모둠 김치볶음밥", 어울리는 재료는 그대로 "짬뽕"', R.c === '연어 김치볶음밥' && R.d === '모둠 김치볶음밥' && R.k === '짬뽕', [R.c, R.d, R.k]);
    check('요리표에 없는 조합은 "셰프의 ○○ ○○" (재료 순서대로, 조리법 이름)', R.i.name === '셰프의 연어 치즈 탕' && R.i.id === 'x' && R.j.name === '셰프의 소고기 치즈 튀김', [R.i, R.j]);
    check('요리표의 모든 요리를 꼭 있어야 하는 재료로 만들 수 있음', R.miss.length === 0, R.miss);

    // ── 심사 셈 ──
    const J = await T(A, () => { const C = window.__cook, out = [];
      const combos = C.DISHES.map((d) => [d.need.length >= 2 ? d.need : [d.need[0], d.opt[0]], d.m[0]]).concat([[['salmon', 'cheese'], 'boil'], [['rice', 'noodle', 'potato', 'salmon'], 'deep'], [['tomato', 'tofu'], 'steam'], [['kimchi', 'rice', 'salmon', 'tomato'], 'fry']]);
      for (const [a, m] of combos) for (const s of ['', 'r1:h', 'zzz:abc']) out.push(C.judge(a, m, s));
      const x = C.judge(['kimchi', 'rice', 'egg'], 'fry', 'q'), y = C.judge(['egg', 'rice', 'kimchi'], 'fry', 'q');
      return { out, same: JSON.stringify(x) === JSON.stringify(y), good: C.judge(['kimchi', 'rice', 'egg'], 'fry').total, weird: C.judge(['rice', 'noodle', 'potato', 'salmon'], 'deep').total,
        spread: C.DISHES.every((d) => { const a = d.need.length >= 2 ? d.need : [d.need[0], d.opt[0]], p = C.judge(a, d.m[0], 'a'), q = C.judge(a, d.m[0], 'b'); return p.sc.every((v, k) => Math.abs(v - q.sc[k]) <= 4); }) }; });
    check('점수 범위: 맛 8~40 · 창의 5~30 · 완성도 6~30, 합계 = 세 점수의 합 (100점 만점)', J.out.every((r) => r.sc[0] >= 8 && r.sc[0] <= 40 && r.sc[1] >= 5 && r.sc[1] <= 30 && r.sc[2] >= 6 && r.sc[2] <= 30 && r.total === r.sc[0] + r.sc[1] + r.sc[2] && r.notes.length === 3 && r.notes.every((t) => typeof t === 'string' && t)), J.out.find((r) => !(r.total === r.sc[0] + r.sc[1] + r.sc[2])));
    check('같은 요리·같은 씨앗이면 늘 같은 점수 (재료 순서 상관없음), 씨앗에 따른 흔들림은 작음 (±2)', J.same && J.spread);
    check('요리표의 요리가 엉뚱한 조합보다 점수가 높음', J.good > J.weird, [J.good, J.weird]);

    // ── 들고 가서 심사받기 ──
    await go(A);
    check('🧤 들고 가기: 판이 닫히고 접시를 손에 듦', await until(async () => (await mode(A)) === null, 3000) && (await mine(A)).w === 'h' && await until(async () => (await views(A)).some((v) => v.where === 'h:h' && v.shown), 2000) && await toastHas(A, '접시를 들었어요'), await views(A));
    await stand(A, 3.0, -2.05);
    check('접시를 들고 조리대 앞에서는 "🍽️ 접시 내려놓기"', (await near(A)) === '🍽️ 접시 내려놓기', await near(A));
    await stand(A, 3.75, 0.4);
    check('접시를 들고 심사석 앞에서는 "🍽️ 심사받기"', (await near(A)) === '🍽️ 심사받기', await near(A));
    await hush(A);
    await T(A, () => window.__tree.pressSpace());
    check('심사받기: 접시가 심사석으로 가고 종소리, 심사위원이 맛보는 중', await until(async () => (await kind(A)) === 'judge' && (await step(A)) === 'taste', 8000) && await until(async () => (await views(A)).some((v) => v.where === 'j:jd' && v.at === 'jd'), 2000) && (await heard(A, 'tableBell')) > 0, await views(A));
    check('맛보는 동안에는 점수가 아직 안 나옴', !(await result(A)));
    check('잠시 뒤 점수표: 심사위원 셋의 점수와 한마디', await until(() => result(A), 5000) && (await result(A)).cards === 3);
    const want = await T(A, () => { const m = window.__cook.mine; return window.__cook.judge(m.i, m.m, ''); }), res = await result(A);
    check('점수표의 점수가 심사 셈과 같음 (김치볶음밥)', res.name === '김치볶음밥' && JSON.stringify(res.sc) === JSON.stringify(want.sc) && res.total === want.total && (await A.textContent('#ckResTotal')).includes(String(want.total)), [res, want]);
    check('박수 소리, 심사위원이 심사석 위에서 점수판을 듦', ((await heard(A, 'hooray')) + (await heard(A, 'pop'))) > 0 && await until(async () => { const c = await T(A, () => window.__cook.cards('jd')); return c && c.shown; }, 2000));
    check('점수표 판의 단추: 폰 화면 안·44px 이상', (await audit(A, '#cookRes button')).length === 0, await audit(A, '#cookRes button'));
    await sleep(500); await shot(A, 'cook-judge.png');
    await go(A, '#ckResClose');
    check('닫으면 심사석 판: 내 점수와 "🔔 요리 대결 시작 (2분)", 다시 볼 수 있는 📋 점수표', !(await result(A)) && (await A.textContent('#playSub')).includes(`${want.total}점`) && (await A.textContent('#ckStart')) === '🔔 요리 대결 시작 (2분)' && !!(await A.$('#ckCard')) && (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    await sleep(900); await shot(A, 'cook-cards.png');

    // ── 혼자 대결: 시간이 끝나면 ──
    await hush(A);
    await go(A, '#ckStart');
    const c1 = await contest(A);
    check('🔔 요리 대결 시작 (혼자): 띠에 2분 시계·종소리·안내', c1 && c1.ph === 'cook' && c1.ref === 'h' && JSON.stringify(c1.pl) === JSON.stringify(['h']) && /^(2:00|1:5\d)$/.test((await band(A)).clock) && (await heard(A, 'bells')) > 0 && await toastHas(A, '요리 대결 시작') && await T(A, () => document.body.classList.contains('ck')), [c1, await band(A)]);
    check('심판의 심사석 판: "🔔 요리 대결 중" · 대결 그만하기, 띠에도 그만하기', (await A.textContent('#playMain')).includes('요리 대결 중') && !!(await A.$('#ckStop')) && (await band(A)).stop && (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    const k0 = secs((await band(A)).clock);
    await sleep(2300);
    check('시계가 줄어듦', secs((await band(A)).clock) < k0, [(await band(A)).clock, k0]);
    check('대결 전에 만든 요리는 이미 심사받아서 심사석에서는 "🔔 요리 대결"', await T(A, () => { window.__play.close(); return true; }) && (await stand(A, 3.75, 0.4), (await near(A)) === '🔔 요리 대결'), await near(A));
    await T(A, () => { window.__skip += 125000; });
    check('시간이 끝나면 띠가 사라지고 순위 판: "아무도 요리를 내지 않았어요"', await until(async () => { const r = await ranked(A); return r && r.items.length === 1 && r.items[0].includes('아무도'); }, 4000) && !(await band(A)) && (await contest(A)).ph === 'over', await ranked(A));
    await go(A, '#ckRankClose');

    // ── 혼자 대결: 한 접시 내기 ──
    check('대결 열기', await T(A, () => window.__cook.start()) && (await contest(A)).ph === 'cook');
    await cook(A, ['beef', 'onion'], 'grill');
    check('대결 중에 만든 요리: 완성 판과 띠가 "심사석에 내요"', (await A.textContent('#playSub')).includes('대결에 제출') && await until(async () => (await band(A)).sub.includes('심사석에 내요'), 2000), [await A.textContent('#playSub'), await band(A)]);
    await hush(A);
    check('심사석에 내면 점수표 (불고기)', await present(A) && (await result(A)).name === '불고기');
    const solo = await contest(A);
    check('한 사람뿐이라 내자마자 대결이 끝남 (낸 요리 1)', solo.ph === 'over' && solo.sub.length === 1 && solo.sub[0][0] === 'h', solo);
    check('순위 판은 점수표를 닫은 뒤에 보임', !(await ranked(A)));
    await go(A, '#ckResClose');
    const r1 = await ranked(A), tot1 = (await T(A, () => window.__cook.rank))[0].total;
    check('혼자 대결 결과: 🥇 불고기와 점수, 내 최고 점수 (기억함)', r1 && r1.sub === '혼자 대결' && r1.items.length === 1 && r1.items[0].startsWith('🥇') && r1.items[0].includes('불고기') && r1.win.includes(`${tot1}점`) && r1.win.includes('내 최고 점수') && (await T(A, () => Number(localStorage.getItem('tree.cookBest')))) >= tot1 && (await heard(A, 'hooray')) > 0, r1);
    check('결과 판 단추: 폰 화면 안·44px 이상', (await audit(A, '#cookRank button')).length === 0, await audit(A, '#cookRank button'));
    await go(A, '#ckRankClose');
    await T(A, () => window.__play.close());

    // ── 친구: 내 접시가 보이고, 친구 요리의 불·소리가 보이고 들림 ──
    const B = await join(ctx, A, 'kb', 2);
    const bid = await T(B, () => window.__duo.me);
    check('친구 화면에도 내 접시가 심사석 위에 보이고, 심사위원이 내 점수판을 듦', await until(async () => (await views(B)).some((v) => v.owner === 'h' && v.where === 'j:jd' && v.shown) && (await T(B, () => window.__cook.cards('jd') && window.__cook.cards('jd').shown)), 8000), await views(B));
    await hush(A);
    await cook(B, ['beef', 'onion', 'mushroom'], 'boil', false);
    check('친구가 끓이면 내 화면에서도 그 조리대의 냄비 불이 켜지고 냄비 속이 보이며 보글보글 소리', await until(async () => { const f = await flames(A); return f.pot && !f.pan && f.pan3; }, 4000) && await until(() => heard(A, 'bubble'), 3000), await flames(A));
    check('친구 요리가 다 되면 내 화면에서도 띵, 조리대 위에 친구 접시', await until(async () => (await views(A)).some((v) => v.owner === bid && v.where === 's:ck' && v.shown), 8000) && (await heard(A, 'ovenDing')) > 0 && await until(async () => !(await flames(A)).pot, 2000), await views(A));
    check('친구 요리 이름도 같은 셈 (버섯 전골)', (await mine(B)).name === '버섯 전골' && (await T(A, (b) => window.__cook.peers.find((p) => p.id === b), bid)).m === 'boil');
    await T(B, () => window.__play.close());

    // ── 여럿이 대결 ──
    await stand(A, 1.0, -2.6); // 친구 화면의 심사석을 가리지 않게 비켜 선다
    await T(A, () => window.__play.open('jd')); await sleep(250);
    await hush(B);
    await go(A, '#ckStart');
    const c2 = await contest(A);
    check('방장이 대결을 열면 친구에게도 같은 대결 (띠·시계·종소리·안내), 친구 띠에는 그만하기 없음', c2 && c2.ph === 'cook' && c2.pl.includes(bid) && await until(async () => { const c = await contest(B); return c && c.rid === c2.rid && c.ph === 'cook'; }, 4000) && await until(() => band(B), 2000) && !(await band(B)).stop && (await heard(B, 'bells')) > 0 && await toastHas(B, '요리 대결 시작'), [c2, await contest(B), await band(B)]);
    check('친구의 띠 시계도 2분 안쪽', secs((await band(B)).clock) <= 120 && secs((await band(B)).clock) >= 100, await band(B));
    await present(B);
    check('대결 전에 만든 요리를 내면 점수는 받지만 대결에는 안 들어감', !!(await result(B)) && await toastHas(B, '대결이 시작되기 전에') && (await contest(A)).sub.length === 0);
    await go(B, '#ckResClose'); await T(B, () => window.__play.close());
    await cook(B, ['shrimp', 'chili', 'noodle'], 'boil');
    await go(B);
    check('친구가 접시를 들면 내 화면에서는 친구 손에 접시', await until(async () => (await views(A)).some((v) => v.owner === bid && v.where === 'h:' + bid && v.shown), 4000), await views(A));
    await present(B);
    check('친구가 내면 심판(방장)이 받아서 모두에게 알림 (1/2)', await until(async () => (await contest(A)).sub.some((s) => s[0] === bid) && (await contest(B)).sub.some((s) => s[0] === bid), 6000) && await until(async () => (await band(B)).sub.includes('냈어요'), 2000) && (await band(A)).sub.includes('1/2'), [await contest(A), await band(B)]);
    check('아직 다 안 내서 대결은 계속', (await contest(A)).ph === 'cook');
    await go(B, '#ckResClose');
    await cook(A, ['chicken', 'potato'], 'steam');
    await hush(A); await hush(B);
    await present(A);
    check('모두 내면 대결이 끝남 (방장·친구 화면 모두)', await until(async () => (await contest(A)).ph === 'over' && (await contest(B)).ph === 'over', 5000));
    await go(A, '#ckResClose');
    const ra = await ranked(A), rb = await until(() => ranked(B), 4000);
    const rka = await T(A, () => window.__cook.rank), rkb = await T(B, () => window.__cook.rank);
    check('순위가 두 화면에서 같음 (🥇🥈, 점수 높은 순)', ra && rb && rka.length === 2 && JSON.stringify(rka) === JSON.stringify(rkb) && rka[0].total >= rka[1].total && ra.items[0].startsWith('🥇') && ra.items[1].startsWith('🥈') && rb.items[0].startsWith('🥇'), [rka, rkb, ra, rb]);
    check('우승 요리가 모두에게 보임 (우승한 사람 화면에는 "나"), "2명이 냈어요"', [ra, rb].every((r) => r.win.includes('🏆 우승 요리') && r.win.includes(rka[0].name) && r.sub === '2명이 냈어요') && (rka[0].id === 'h' ? ra : rb).win.includes('(나)') && !(rka[0].id === 'h' ? rb : ra).win.includes('(나)') && (await heard(B, 'hooray')) > 0, [ra, rb]);
    await sleep(300); await shot(B, 'cook-rank.png');
    await go(A, '#ckRankClose'); await go(B, '#ckRankClose');
    await T(A, () => window.__play.close()); await T(B, () => window.__play.close());

    // ── 늦게 온 사람 ──
    check('대결 열기 (다시)', await T(A, () => window.__cook.start()));
    const c3 = await contest(A);
    const C = await join(ctx, A, 'kc', 3);
    const cid = await T(C, () => window.__duo.me);
    check('늦게 온 사람도 심사석 위의 두 접시와 점수판을 봄', await until(async () => { const v = await views(C); return ['h', bid].every((o) => v.some((x) => x.owner === o && x.where === 'j:jd' && x.shown)); }, 8000) && await until(() => T(C, () => window.__cook.cards('jd') && window.__cook.cards('jd').shown), 3000), await views(C));
    check('늦게 온 사람도 하던 대결을 보고 같이 함 (띠·같이 하는 사람)', await until(async () => { const c = await contest(C); return c && c.rid === c3.rid && c.ph === 'cook'; }, 8000) && await until(async () => (await contest(A)).pl.includes(cid), 6000) && !!(await band(C)), [await contest(C), await contest(A)]);
    check('늦게 온 사람의 띠: 폰 화면 안·44px 이상', (await audit(C, '#cookBand button')).length === 0, await audit(C, '#cookBand button'));
    await go(A, '#ckBandStop');
    check('심판이 그만하면 모두의 대결이 꺼짐 (띠도)', !(await contest(A)) && await until(async () => !(await contest(B)) && !(await contest(C)) && !(await band(C)) && !(await band(B)), 4000) && await toastHas(C, '그만했어요'));
    check('끝난 대결의 늦은 소식은 무시함', await T(C, (a) => window.__cook.peerFx({ k: 'cook', v: JSON.stringify({ a: 'r', rid: a, ref: 'h', ph: 'cook', left: 60000, pl: ['h'], sub: [] }) }, 'h'), c3.rid) === true && !(await contest(C)) && (await T(C, () => window.__cook.ended())).includes(c3.rid));

    // ── 둘이 같이 열면 ──
    await Promise.all([T(A, () => window.__cook.start()), T(C, () => window.__cook.start())]);
    check('둘이 같이 열어도 먼저 연 대결 하나로 모임', await until(async () => { const a = await contest(A), b = await contest(B), c = await contest(C); return a && b && c && a.rid === b.rid && b.rid === c.rid && a.ref === c.ref; }, 8000), [await contest(A), await contest(B), await contest(C)]);
    const refP = (await contest(A)).ref === 'h' ? A : C;
    await T(refP, () => window.__cook.stop());
    check('그만하면 셋 다 꺼짐', await until(async () => !(await contest(A)) && !(await contest(B)) && !(await contest(C)), 4000));

    // ── 이상한 소식 ──
    const before = JSON.stringify([await views(C), await T(C, () => window.__cook.peers.map((p) => [p.id, p.s, p.i, p.m, p.w]))]);
    const bad = await T(C, () => {
      const f = (o, id = 'h') => window.__cook.peerFx({ k: 'cook', v: typeof o === 'string' ? o : JSON.stringify(o) }, id);
      const P = { a: 'p', s: 1, st: 'ck', i: ['egg', 'rice'], m: 'fry', w: 's', at: '', c: 0, r: '', j: 0 }, Rd = { a: 'r', rid: 'abcd1234', ref: 'h', ph: 'cook', left: 60000, pl: ['h'], sub: [] };
      return [
        f('not json'), f('x'.repeat(1700)), f([1, 2]), f({ a: 'zz' }), f(P, 'BAD ID'), f(P, window.__duo.me),
        f({ ...P, st: 'nope' }), f({ ...P, st: 'jd' }), f({ ...P, i: ['egg', 'gold'] }), f({ ...P, i: ['egg', 'egg'] }), f({ ...P, i: ['egg'] }),
        f({ ...P, i: ['egg', 'rice', 'kimchi', 'onion', 'chili'] }), f({ ...P, i: 'egg,rice' }), f({ ...P, m: 'bake' }), f({ ...P, w: 'j', at: 'ck' }), f({ ...P, at: 'jd' }), f({ ...P, w: 'x' }),
        f({ ...P, s: -1 }), f({ ...P, s: 1.5 }), f({ ...P, c: 2 }), f({ ...P, j: true }), f({ ...P, r: 'BAD!' }),
        f({ ...Rd, ref: 'zz' }), f(Rd, 'zz'), f({ ...Rd, rid: 'ab' }), f({ ...Rd, ph: 'play' }), f({ ...Rd, left: -5 }), f({ ...Rd, left: 1e9 }), f({ ...Rd, left: '60' }),
        f({ ...Rd, pl: 'h' }), f({ ...Rd, pl: ['BAD ID'] }), f({ ...Rd, sub: [['h', ['egg', 'gold'], 'fry']] }), f({ ...Rd, sub: [['h', ['egg', 'rice'], 'fry'], ['h', ['egg', 'rice'], 'fry']] }), f({ ...Rd, sub: [['h', ['egg', 'rice'], 'bake']] }),
        f({ a: 'sub', rid: 'abcd1234', i: ['egg'], m: 'fry' }), f({ a: 'sub', rid: 'x', i: ['egg', 'rice'], m: 'fry' }), f({ a: 'q', rid: 1 }),
      ];
    });
    check('이상한 소식은 받지 않음 (모양·길이·모르는 재료·조리법·가구·자리·대결 번호·심판이 아닌 사람)', bad.every((v) => v === false), bad.map((v, k) => (v ? k : null)).filter((v) => v !== null));
    check('이상한 소식 뒤에도 접시·대결 상태는 그대로', JSON.stringify([await views(C), await T(C, () => window.__cook.peers.map((p) => [p.id, p.s, p.i, p.m, p.w]))]) === before && !(await contest(C)) && !(await band(C)));
    // 방장이 받아서 전하는 길 (app.js 의 놀이 소식): 옳은 것만 다른 사람에게 전해진다
    await T(A, (c) => { const D = window.__duo; D.feed({ t: 'fx', k: 'cook', v: '{"a":"p","s":1' }, c); D.feed({ t: 'fx', k: 'cook', v: JSON.stringify({ a: 'p', s: 7, st: 'ck', i: ['tomato', 'cheese'], m: 'boil', w: 's', at: '', c: 0, r: '', j: 0 }) }, c); }, cid);
    check('방장이 받은 친구의 접시 소식은 다른 친구에게도 전해짐 (요리 이름도 같음)', await until(async () => { const p = (await T(B, () => window.__cook.peers)).find((x) => x.id === cid); return p && p.s === 7 && p.i.join() === 'cheese,tomato'; }, 4000) && await until(async () => (await views(B)).some((v) => v.owner === cid && v.where === 's:ck'), 3000));
    await T(A, (c) => window.__duo.feed({ t: 'fx', k: 'cook', v: '{"a":"x"}' }, c), cid);
    check('치웠다는 소식도 전해짐', await until(async () => !(await T(B, () => window.__cook.peers)).some((x) => x.id === cid), 4000));

    // ── 심판이 나가면 ──
    check('친구도 대결을 열 수 있음', await T(B, () => window.__cook.start()) && await until(async () => { const a = await contest(A), c = await contest(C); return a && c && a.ref === bid && c.ref === bid; }, 5000));
    const c4 = await contest(B);
    await B.close();
    check('대결을 연 친구가 나가면 남은 사람의 대결이 취소됨', await until(async () => !(await contest(A)) && !(await contest(C)), 20000) && (await T(A, () => window.__cook.ended())).includes(c4.rid) && !(await band(A)));
    check('나간 친구의 접시도 사라짐', await until(async () => !(await views(A)).some((v) => v.owner === bid) && !(await views(C)).some((v) => v.owner === bid), 8000), await views(A));
    check('남은 사람 화면에서 내 접시는 그대로', (await views(C)).some((v) => v.owner === 'h' && v.where === 'j:jd'));
    check('가구를 치우면 그 위의 접시·불꽃·점수판도 사라짐', await T(A, () => window.__tree.dispatch({ t: 'del', id: 'jd' })) && await until(async () => !(await T(A, () => window.__cook.cards('jd'))) && (await mine(A)) && (await mine(A)).w !== 'j', 3000) && await until(async () => !(await T(C, () => window.__cook.cards('jd'))), 4000));
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
