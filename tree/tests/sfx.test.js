// 효과음 검사 (첫 누르기 뒤에만 소리 · 켜고 끄기와 음량 기억 · 방의 변화마다 맞는 소리 · 굽기·먹기·걷기·단추 · 겹침 제한 · 친구 소리는 거리에 따라 작게) (포트 8211)
// 실제로 들리는지는 재지 않는다. window.__sfx.log 에 쌓이는 "어떤 소리가 요청됐는지"를 본다
const PORT = 8211;
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(50); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__food && window.__sfx && window.__cheers && window.__tree.frames > 3)), 20000);
async function open(ctx, url, bare = true) {
  const p = await ctx.newPage();
  if (bare) await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
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
const holding = (p) => T(p, () => window.__food.holding);
const doors = (p) => T(p, () => window.__food.doors);
const others = (p) => T(p, () => window.__food.others);
const heard = (p, n) => T(p, (n) => window.__sfx.log.filter((r) => r.n === n), n); // 요청된 소리의 기록
const hush = (p) => T(p, () => window.__sfx.clear());
const toastHas = (p, t, ms = 3000) => until(async () => (await p.textContent('#toast')).includes(t), ms);
const stand = async (p, x, z) => { await T(p, (a) => { const W = window.__tree; W.me.stop(); W.me.onArrive = null; W.me.place(a[0], a[1]); W.snapView(); }, [x, z]); await sleep(350); };
const shot = (p, name) => p.screenshot({ path: path.join(__dirname, 'out', name) });
// 한 입 먹고(한 모금 마시고) 그 입이 닿을 때까지 기다린다
const bite = async (p) => { const h = await holding(p); await T(p, () => window.__food.bite()); await until(async () => { const n = await holding(p); return !n || (n.shown < h.shown && (n.ready || n.ending)); }, 6000); };
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
const finish = async (browser, server) => {
  await browser.close(); server.close();
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass} / ${results.length} 통과`);
  process.exit(pass === results.length ? 0 : 1);
};
const names = (p) => T(p, () => window.__sfx.log.map((r) => r.n));
const D = (p, op) => T(p, (op) => window.__tree.dispatch(op), op);

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = serve();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext(PHONE);
    const A = await ctx.newPage(); // 캐릭터 고르기 단추도 누르지 않은 채로 연다
    await A.addInitScript(() => { window.__bare = true; });
    A.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
    await A.goto(`${BASE}?net=bc&door=0&ns=sa`); await ready(A);
    check('소리 60가지 넘게 준비됨(파일 없이 만들어 냄)', (await T(A, () => window.__sfx.names.length)) >= 60, await T(A, () => window.__sfx.names.length));
    check('소리 파일을 하나도 받지 않음', (await T(A, () => performance.getEntriesByType('resource').filter((r) => /\.(mp3|ogg|wav|m4a)(\?|$)/.test(r.name)).length)) === 0);

    /* 첫 누르기 전 */
    await hush(A);
    check('화면을 누르기 전에는 소리 장치를 만들지 않음', (await T(A, () => window.__sfx.unlocked)) === false && (await T(A, () => window.__sfx.state)) === null);
    await put(A, [['t1', 'table', 6, 12, 0]]);
    check('그때도 요청은 기록됨(가구 놓기 = place)', (await names(A)).join() === 'place', await names(A));
    if (await A.isVisible('#lookDone')) await A.tap('#lookDone'); else await A.tap('#c');
    check('한 번 누른 뒤에는 소리가 남', (await T(A, () => window.__sfx.unlocked)) === true && await until(() => T(A, () => window.__sfx.state === 'running'), 3000), await T(A, () => window.__sfx.state));

    /* 켜고 끄기, 음량 */
    await A.tap('#tabs button[data-m="duo"]'); await sleep(300);
    check('"같이" 판에 효과음 단추와 음량 막대가 있음(도구 줄에는 더하지 않음)', await A.isVisible('#sfxOn') && await A.isVisible('#sfxVol') && (await A.locator('#tools #sfxOn').count()) === 0 && (await A.textContent('#sfxOn')).includes('켬'));
    check('폰(375×812)에서 화면 안·44px 이상·겹치지 않음', (await audit(A, '#duoP button, #duoP input, #tabs button')).length === 0, await audit(A, '#duoP button, #duoP input, #tabs button'));
    await shot(A, 'sfx-panel.png');
    await A.tap('#sfxOn');
    check('누르면 꺼지고 기기에 기억됨', (await T(A, () => window.__sfx.on)) === false && (await A.textContent('#sfxOn')).includes('끔') && (await T(A, () => JSON.parse(localStorage.getItem('tree.sfx')).on)) === false);
    await hush(A); await D(A, { t: 'wall', v: await T(A, () => window.__tree.S.wall) });
    check('꺼 두면 요청은 있어도 소리를 내지 않음', (await heard(A, 'paint')).length === 1 && (await heard(A, 'paint'))[0].played === false, await T(A, () => window.__sfx.log));
    await A.reload(); await ready(A);
    check('다시 열어도 꺼진 채로 있음', (await T(A, () => window.__sfx.on)) === false);
    await A.tap('#tabs button[data-m="duo"]'); await sleep(300); await A.tap('#sfxOn');
    await T(A, () => { const r = document.getElementById('sfxVol'); r.value = '40'; r.dispatchEvent(new Event('input', { bubbles: true })); });
    check('다시 켜고 음량을 바꾸면 기억됨', (await T(A, () => window.__sfx.on)) === true && Math.abs((await T(A, () => window.__sfx.vol)) - 0.4) < 0.01 && Math.abs((await T(A, () => JSON.parse(localStorage.getItem('tree.sfx')).vol)) - 0.4) < 0.01);
    await T(A, () => window.__sfx.setVol(0.7));
    await A.tap('#tabs button[data-m="duo"]'); await sleep(200);

    /* 방의 변화마다 맞는 소리 */
    const one = async (label, want, fn) => { await hush(A); await fn(); await sleep(60); const n = await names(A); check(label, want.every((w) => n.includes(w)), n); };
    await one('가구 고르기 = 들기(lift), 돌리기 = turn', ['lift', 'turn'], async () => { await T(A, () => { window.__tree.ghostNew('chair'); window.__tree.ghostTurn(); window.__tree.ghostCancel(); }); });
    await one('가구 놓기 = place', ['place'], () => put(A, [['ck', 'cake', 24, 4, 0], ['ov', 'stove', 23, 0, 0], ['fr', 'fridge', 14, 0, 0]]));
    await one('가구 옮기기 = place', ['place'], () => D(A, { t: 'move', id: 't1', i: 5, j: 12, r: 0 }));
    await one('장식 달기 = orn, 떼기 = ornOff', ['orn', 'ornOff'], async () => { await D(A, { t: 'orn', id: 'o1', k: 'red', x: 0.3, y: 1.2, z: 0.3 }); await D(A, { t: 'ornDel', id: 'o1' }); });
    await one('벽지·바닥 = paint', ['paint'], async () => { await D(A, { t: 'floor', v: await T(A, () => window.__tree.S.floor) }); });
    await one('꼭대기 별 = star', ['star'], () => D(A, { t: 'star', on: true, name: '가', help: '나' }));
    await one('크림 짜기 = cream, 토핑 = top, 촛불 = candle, 불기 = blow', ['cream', 'top', 'candle', 'blow'], async () => { await D(A, { t: 'cakeCream', id: 'ck', v: 1 }); await D(A, { t: 'cakeTop', id: 'ck', k: 'candle', x: 0.05, z: 0.05 }); await D(A, { t: 'cakeLit', id: 'ck', n: 1 }); await D(A, { t: 'cakeBlow', id: 'ck' }); });
    await one('케이크 한 조각 먹기 = bite', ['bite'], () => D(A, { t: 'cakeEat', id: 'ck' }));
    await one('방명록 = note', ['note'], () => D(A, { t: 'note', id: 'n1', name: '검사', text: '안녕', at: Date.now() }));

    /* 케이크 굽기: 반죽 붓기 → 휘젓기 → 오븐 → 땡 */
    await T(A, () => { const W = window.__tree; W.dispatch({ t: 'cakeTake', id: 'ck', by: window.__duo.me }); W.putDown('t1'); });
    await until(() => T(A, () => window.__tree.cakeAt('ck').on === 't1'), 20000);
    check('케이크 들기 = carry, 탁자에 놓기 = setDown', (await names(A)).includes('carry') && (await names(A)).includes('setDown'), await names(A));
    await hush(A);
    await T(A, () => window.__play.open('ov')); await sleep(400);
    await A.tap('#playGo');
    check('굽기 시작: 반죽 붓기(pour) → 휘젓기(whisk) → 오븐 켜기(ovenOn) 순서', await until(async () => { const n = (await names(A)).filter((x) => ['pour', 'whisk', 'ovenOn'].includes(x)); return n.join() === 'pour,whisk,ovenOn'; }, 4000), await names(A));
    await T(A, () => window.__play.setHeat(0.7)); await A.tap('#playGo');
    check('잘 구워 꺼내면 오븐 "땡"(ovenDing)', await until(async () => (await heard(A, 'ovenDing')).length === 1, 3000), await names(A));
    await T(A, () => window.__tree.setMode(null)); await sleep(200);

    /* 먹기·마시기·냉장고 */
    await hush(A);
    await T(A, () => window.__food.openNow('fr')); await sleep(200);
    await T(A, () => window.__food.take('pizza')); await until(async () => (await doors(A)).length === 0, 4000);
    check('냉장고 문 열기 = fridgeOpen, 닫기 = fridgeShut, 꺼내기 = pop', (await heard(A, 'fridgeOpen')).length === 1 && (await heard(A, 'fridgeShut')).length === 1 && (await heard(A, 'pop')).length >= 1, await names(A));
    await bite(A); await bite(A); await bite(A);
    check('피자: 늘어나는 치즈(cheese) 두 번, 마지막 꼬다리는 바삭(crisp)', (await heard(A, 'cheese')).length === 2 && (await heard(A, 'crisp')).length === 1, await names(A));
    await until(async () => (await holding(A)) === null, 4000);
    await hush(A); await T(A, () => window.__food.take('cocoa')); await bite(A);
    check('코코아 = 호로록(slurp)', (await heard(A, 'slurp')).length === 1, await names(A));
    for (let i = 0; i < 3; i++) await bite(A);
    check('다 마시고 컵 내려놓기 = cupDown', await until(async () => (await heard(A, 'cupDown')).length === 1, 4000), await names(A));
    const kinds = await T(A, () => window.__food.kinds);
    await hush(A);
    for (const f of kinds.filter((k) => ['cookie', 'milk', 'choco', 'icecream'].includes(k.id))) { await T(A, (k) => window.__food.take(k), f.id); await bite(A); await T(A, () => window.__food.stow()); }
    check('종류마다 소리가 다름: 쿠키 바삭(crisp)·우유 꿀꺽(gulp)·초콜릿 똑(snap)·아이스크림(lick)', (await names(A)).filter((n) => ['crisp', 'gulp', 'snap', 'lick'].includes(n)).sort().join() === 'crisp,gulp,lick,snap', await names(A));

    /* 걷기·단추·몸짓 */
    await hush(A); await stand(A, 0, 2.5);
    await T(A, () => window.__tree.goTo(2.5, 2.5)); await until(() => T(A, () => !window.__tree.me.moving && Math.abs(window.__tree.me.x - 2.5) < 0.2), 15000);
    const steps = await heard(A, 'step');
    check('걸으면 발걸음 소리가 살짝(크기 0.6 이하) 나고 너무 잦지 않음', steps.length >= 3 && steps.length <= 40 && steps.every((s) => s.v <= 0.6), steps.length);
    await sleep(600); await hush(A); await sleep(500);
    check('서 있을 때는 발걸음 소리가 없음', (await heard(A, 'step')).length === 0);
    await A.tap('#tabs button[data-m="furn"]'); await sleep(150); await A.tap('#tabs button[data-m="furn"]');
    check('단추를 누르면 가벼운 소리(tap)', (await heard(A, 'tap')).length === 2, await names(A));
    await hush(A); await T(A, () => window.__tree.doAct('clap'));
    check('박수 치면 박수 소리(clap)', (await heard(A, 'clap')).length === 1);

    /* 겹침 제한 */
    await hush(A);
    const burst = await T(A, () => { for (let i = 0; i < 6; i++) window.__sfx.play('orn'); return window.__sfx.log.filter((r) => r.played).length; });
    check('같은 소리를 한꺼번에 여섯 번 청해도 한 번만 냄', burst === 1, burst);
    await hush(A);
    const many = await T(A, () => { for (const n of window.__sfx.names.slice(0, 20)) window.__sfx.play(n); return { played: window.__sfx.log.filter((r) => r.played).length, voices: window.__sfx.voices }; });
    check('서로 다른 소리도 한꺼번에는 10개까지만', many.played === 10 && many.voices <= 10, many);
    await sleep(1600); await hush(A);
    const all = await T(A, async () => { const bad = []; for (const n of window.__sfx.names) { window.__sfx.clear(); if (!window.__sfx.play(n)) bad.push(n); } return bad; });
    check('모든 소리가 오류 없이 만들어짐', all.length === 0, all);

    /* 친구가 낸 소리: 거리에 따라 작게 */
    await sleep(1500);
    const B = await join(ctx, A, 'sb', 2);
    await B.tap('#c');
    const far = async (bx, bz) => { await stand(B, bx, bz); await T(B, () => { const W = window.__tree; W.goTo(W.me.x + 0.01, W.me.z); }); await until(async () => { const o = (await T(A, () => window.__duo.others))[0]; return o && Math.hypot(o.x - bx, o.z - bz) < 0.3 && !o.moving; }, 8000); await sleep(300); await hush(A); await T(B, () => window.__tree.doAct('clap')); await until(async () => (await heard(A, 'clap')).length > 0, 4000); return (await heard(A, 'clap'))[0]; };
    await stand(A, 0, 2.5);
    const close = await far(0.8, 2.5), away = await far(-3.2, -2.5);
    check('가까운 친구의 박수는 크게, 먼 친구의 박수는 작게 들림', close && away && close.far && away.far && close.v > 0.5 && away.v < close.v * 0.5, { close, away });
    check('남이 낸 소리는 내 소리보다 크지 않음', close.v <= 0.8, close);
    await hush(A); await put(B, [['c9', 'chair', 2, 2, 0]]);
    check('친구가 가구를 놓으면 내 화면에서도 놓는 소리(먼 소리로)', await until(async () => (await heard(A, 'place')).some((r) => r.far), 4000), await heard(A, 'place'));
    await hush(A); await T(B, () => window.__duo.say('안녕'));
    check('친구가 말하면 말풍선 소리(pop)', await until(async () => (await heard(A, 'pop')).some((r) => r.far), 4000), await names(A));

    /* 기존 소리와 겹치지 않음 */
    check('오르골·점등식·불꽃놀이·초인종의 소리는 그대로 따로 냄(효과음 이름에 없음)', (await T(A, () => ['music', 'bell', 'firework', 'show'].every((n) => !window.__sfx.names.includes(n)))));
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) { check('검사 도중 오류 없음', false, String(e && e.stack || e)); }
  await finish(browser, server);
})();
