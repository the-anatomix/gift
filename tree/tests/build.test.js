// 마스터키로 층 더하기·지우기와 층 테마 검사 (build.js): 마스터 판의 "층"·"테마" 줄 · 새 층과 사다리(오르기·비워 둘 칸·사다리 앞 가구 옮기기) ·
// 친구에게도 같게 · 테마 적용·바꾸기·지우기(사람이 놓은 가구는 그대로, 막힌 자리는 건너뜀) · 테마는 2층과 더한 층만 · 🏗️ 권한 주기 · 8층까지 ·
// 더한 층만 지우기(두 번 눌러 확인, 그 층 가구와 테마가 없어지고 그 층 사람은 아래층으로) · 다시 열어도 그대로 · 예전 방은 4층.
// 실행: cd tree/tests && node build.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8236, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const HASH = '9262b0baa88add8fdc882f6772709ebfbd645aaa651e904e4e3d795898a71a7d'; // 마스터키를 켠 상태는 저장값을 직접 넣어 만든다 (암호는 적지 않는다)
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__build && window.__tree.frames > 3)), 60000);
async function open(ctx, url, o = {}) {
  const p = await ctx.newPage();
  // 기본 가구 없이 빈 방에서 시작한다. 마스터는 마스터키를 켠 채로
  await p.addInitScript((mk) => { window.__bare = true; if (mk) localStorage.setItem('tree.master.' + new URLSearchParams(location.search).get('ns'), mk); }, o.master ? HASH : '');
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
// 단추는 44px 이상이고 화면 안에 있어야 한다 (옆으로 넘기는 목록 안은 화면 밖으로 넘겨도 된다)
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
const shot = (p, n) => p.screenshot({ path: path.join(__dirname, 'out', `build-${n}.png`) });
const cxz = (i, j) => [-4 + (i + 0.5) * 0.5, -4 + (j + 0.5) * 0.5]; // 칸 → 자리(가운데)
const DI = 32; // 층마다 격자에서 밀어 둔 칸 수 (path.js 의 FLOOR_DI)
const lvOf = (i) => Math.min(7, Math.floor(i / DI));
const levels = (p) => T(p, () => window.__build.levels);
const themes = (p) => T(p, () => JSON.stringify(window.__build.themes));
const itemsOn = (p, lv) => T(p, (lv) => [...window.__tree.S.items.values()].filter((it) => Math.min(7, Math.floor(it.i / 32)) === lv).map((it) => [it.id, it.k, it.i, it.j, it.r].join(':')).sort().join(','), lv);
const has = (p, id) => T(p, (id) => window.__tree.S.items.has(id), id);
const item = (p, id) => T(p, (id) => window.__tree.S.items.get(id) || null, id);
const put = (p, id, k, i, j, r = 0) => T(p, (a) => window.__tree.dispatch({ t: 'put', id: a[0], k: a[1], i: a[2], j: a[3], r: a[4] }), [id, k, i, j, r]);
const toast = (p) => T(p, () => document.getElementById('toast').textContent);
const settle = (p) => until(() => T(p, () => { const m = window.__tree.me; return !m.moving && !m.path.length && !m.climbing; }), 30000);
const same = async (a, b) => (await T(a, () => window.__duo.hash())) === (await T(b, () => window.__duo.hash()));
const openMaster = async (p) => { if (!(await p.isVisible('#masterP'))) await p.tap('#tabs button[data-m="master"]'); await until(() => p.isVisible('#masterP'), 4000); await sleep(200); };

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ba`, { master: true });

    /* 처음: 4층 집 그대로 */
    const info = await T(A, () => { const W = window.__tree, d = W.serialize(); return { lv: W.LEVELS, lad: W.LADDERS.length, floors: W.room.floors.length, lamps: W.S.lamps.length, gx: W.GX, key: 'levels' in d || 'themes' in d }; });
    check('처음에는 4층 집: 사다리 셋, 층 넷, 불 넷, 저장값에 층 수·테마 항목 없음', info.lv === 4 && info.lad === 3 && info.floors === 4 && info.lamps === 4 && info.gx === 126 && !info.key, info);
    await T(A, () => window.__duo.invite());
    await until(() => T(A, () => window.__duo.mode === 'waiting'));
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=bb#r=${room}`);
    check('둘이 이어짐', await until(async () => (await T(A, () => window.__duo.count)) === 2 && (await T(B, () => window.__duo.mode)) === 'on' && await same(A, B), 25000));

    /* 권한: 마스터가 아니면 줄이 없다 */
    check('친구(마스터 아님)에게는 마스터 탭도 층·테마 줄도 없고, 층을 더할 수 없음', !(await B.isVisible('#tabs button[data-m="master"]')) && !(await T(B, () => window.__build.shown)) && (await T(B, () => window.__build.add())) === 0 && (await levels(A)) === 4);
    await openMaster(A);
    const ui = await T(A, () => ({ lab: document.querySelector('#mkLevels .lab').textContent, del: document.getElementById('mkDel').disabled, add: document.getElementById('mkAdd').disabled, fl: [...document.querySelectorAll('#mkTheme [data-lv]')].map((b) => b.dataset.lv).join(), th: document.querySelectorAll('#mkThemes .chip').length }));
    check('마스터 판에 "층" 줄(4층 집, ＋ 층 더하기, 맨 위 층 지우기는 꺼짐)과 "테마" 줄(2층만, 테마 여덟 가지)', (await A.isVisible('#mkLevels')) && (await A.isVisible('#mkTheme')) && (await A.isVisible('#mkThemes')) && ui.lab === '4층 집' && ui.del && !ui.add && ui.fl === '1' && ui.th === 8, ui);
    check('마스터 판의 단추는 모두 44px 이상이고 화면 안 (375×812)', (await audit(A)).length === 0, await audit(A));
    await shot(A, 'panel');

    /* 층 더하기 */
    check('4층 집에서는 4층 (24, 4) 칸에 가구를 놓을 수 있음 (예전 그대로)', await put(B, 'rl', 'lamp', 3 * DI + 24, 4) && await until(() => has(A, 'rl'), 5000));
    await A.tap('#mkAdd');
    check('"＋ 층 더하기" 를 누르면 나와 친구 모두 5층 집이 됨', await until(async () => (await levels(A)) === 5 && (await levels(B)) === 5, 6000), [await levels(A), await levels(B)]);
    const i5 = async (p) => T(p, () => { const W = window.__tree; return { lad: W.LADDERS.map((l) => [l.lv, l.a.join(':'), l.b.join(':')].join('/')).pop(), n: W.LADDERS.length, floors: W.room.floors.length, lamps: W.S.lamps.length, ser: W.serialize().levels }; });
    const a5 = await i5(A), b5 = await i5(B);
    check('사다리 넷(4층 (120,4) → 5층 (153,4)), 층 다섯, 불 다섯, 저장값 levels: 5 — 친구도 같음', a5.n === 4 && a5.lad === '3/120:4/153:4' && a5.floors === 5 && a5.lamps === 5 && a5.ser === 5 && JSON.stringify(a5) === JSON.stringify(b5), { a5, b5 });
    check('친구 화면에 새 층이 생겼다는 알림', await until(async () => (await toast(B)).includes('5층이 생겼어요'), 4000), await toast(B));
    const rl = [await item(A, 'rl'), await item(B, 'rl')];
    check('새 사다리 앞에 있던 가구는 4층의 가까운 빈자리로 옮겨짐 (둘 다 같은 자리)', rl[0] && rl[1] && rl[0].i === rl[1].i && rl[0].j === rl[1].j && !(rl[0].i === 120 && rl[0].j === 4) && lvOf(rl[0].i) === 3 && Math.hypot(rl[0].i - 120, rl[0].j - 4) <= 2, rl);
    const rules = await T(A, () => { const W = window.__tree, p = (i, j) => W.dispatch({ t: 'put', id: 'q' + i + 'x' + j, k: 'lamp', i, j, r: 0 }); return { foot: p(120, 4), top: p(153, 4), hole: p(152, 4), free: p(140, 14) }; });
    check('새 사다리 앞·올라선 칸·구멍에는 놓을 수 없고 5층 빈칸에는 놓을 수 있음', !rules.foot && !rules.top && !rules.hole && rules.free, rules);
    await T(A, () => window.__tree.dispatch({ t: 'del', id: 'q140x14' }));
    check('5층 불도 따로 켜고 끔 (친구에게도)', await T(A, () => window.__tree.dispatch({ t: 'lamp', lv: 4, on: false })) && await until(async () => (await T(B, () => window.__lights.lamps.join())) === '1,1,1,1,0', 4000) && await T(A, () => window.__tree.dispatch({ t: 'lamp', lv: 4, on: true })));
    check('마스터 판: "5층 집", 지우기 단추가 켜지고, 테마 층에 5층이 생김', await until(() => T(A, () => document.querySelector('#mkLevels .lab').textContent === '5층 집' && !document.getElementById('mkDel').disabled && [...document.querySelectorAll('#mkTheme [data-lv]')].map((b) => b.dataset.lv).join() === '1,4'), 3000));

    /* 사다리로 5층에 오르기 */
    await T(A, () => window.__tree.setMode(null));
    await T(A, (p) => { const W = window.__tree; W.me.stop(); W.me.place(p[0], p[1]); W.snapView(); }, cxz(3 * DI + 23, 4)); await sleep(300);
    check('4층 새 사다리 앞에 서면 "🪜 5층으로 올라가기"', (await T(A, () => window.__tree.nearAction())) === '🪜 5층으로 올라가기', await T(A, () => window.__tree.nearAction()));
    await T(A, () => window.__tree.pressSpace());
    const climbed = await until(() => T(A, () => window.__tree.me.climbing), 8000) && await settle(A);
    const up5 = await T(A, () => { const W = window.__tree; return { lv: W.level, y: W.me.root.position.y, cell: [Math.floor((W.me.x + 4) / 0.5), Math.floor((W.me.z + 4) / 0.5)].join(), vis: W.room.floors.map((f) => f.g.visible).join() }; });
    check('스페이스바로 사다리를 타고 5층(높이 11.2)의 올라선 칸 (153,4) 에 섬, 5층만 보임', climbed && up5.lv === 4 && Math.abs(up5.y - 11.2) < 0.05 && up5.cell === '153,4' && up5.vis === 'false,false,false,false,true', up5);
    const aid = await T(A, () => window.__duo.me);
    check('친구 화면에서도 내가 5층에 있음', await until(() => T(B, (id) => { const o = window.__duo.others.find((x) => x.id === id); return !!o && o.level === 4 && !o.moving; }, aid), 15000), await T(B, () => window.__duo.others));
    await T(A, () => { window.__tree.setZoomMul(0.01); window.__tree.snapView(); }); await sleep(500);
    await shot(A, '5f-empty');

    /* 테마: 적용 · 바꾸기 · 지우기 */
    check('친구가 5층에 직접 가구를 놓음 (스탠드, 북쪽 벽의 선물)', await put(B, 'pl1', 'lamp', 4 * DI + 20, 14) && await put(B, 'pg1', 'giftR', 4 * DI + 5, 0) && await until(async () => (await has(A, 'pl1')) && (await has(A, 'pg1')), 5000));
    await openMaster(A);
    await A.tap('#mkTheme [data-lv="4"]'); await A.tap('#mkThemes [data-id="party"]'); await A.tap('#mkApply');
    const kp = await T(A, () => window.__build.known('party'));
    check('5층을 고르고 🎉 파티룸을 적용하면 나와 친구 모두 5층 테마가 파티룸', await until(async () => (await themes(A)) === '[[4,"party"]]' && (await themes(B)) === '[[4,"party"]]', 5000) && (await T(A, () => window.__tree.room.themeOf(4))) === 'party' && (await T(B, () => window.__tree.room.themeOf(4))) === 'party', [await themes(A), await themes(B)]);
    const np = await T(A, () => window.__build.themeItems(4));
    check('테마 가구가 빈 칸에만 놓임: 선물이 놓인 자리의 TV 만 빠짐 (알림에도 나옴)', np === kp - 1 && !(await T(A, () => [...window.__tree.S.items.values()].some((it) => /^4t/.test(it.id) && it.k === 'tv'))) && (await toast(A)).includes('자리가 없어 1개는'), { np, kp, t: await toast(A) });
    check('테마 가구는 친구 방에도 같은 id·같은 자리 (방 지문도 같음)', await until(async () => (await itemsOn(A, 4)) === (await itemsOn(B, 4)) && await same(A, B), 5000), [await itemsOn(A, 4), await itemsOn(B, 4)]);
    check('사람이 놓은 가구는 그대로', (await has(A, 'pl1')) && (await has(A, 'pg1')) && (await has(B, 'pl1')) && (await has(B, 'pg1')));
    check('층 단추에 그 층의 테마 그림이 붙음 (5층 🎉)', await until(() => T(A, () => document.querySelector('#mkTheme [data-lv="4"]').textContent.includes('🎉')), 3000));
    await T(A, () => window.__tree.setMode(null)); await sleep(400);
    await shot(A, '5f-party');
    await openMaster(A);
    await A.tap('#mkThemes [data-id="cafe"]'); await A.tap('#mkApply');
    const PARTY_ONLY = ['beanbag', 'pool', 'dart', 'arcade', 'claw', 'bigbunny', 'bunny', 'bunny2', 'bunny3'];
    const cafeOk = (p) => T(p, (only) => { const its = [...window.__tree.S.items.values()].filter((it) => /^4t/.test(it.id)); return its.length > 0 && !its.some((it) => only.includes(it.k)) && its.some((it) => it.k === 'counter'); }, PARTY_ONLY);
    check('☕ 카페를 적용하면 파티룸 가구는 치워지고 카페 가구로 바뀜 (친구도)', await until(async () => (await themes(B)) === '[[4,"cafe"]]' && await cafeOk(A) && await cafeOk(B) && (await itemsOn(A, 4)) === (await itemsOn(B, 4)), 5000), [await themes(B), await itemsOn(B, 4)]);
    check('테마를 바꿔도 사람이 놓은 가구는 그대로', (await has(B, 'pl1')) && (await has(B, 'pg1')) && (await has(A, 'rl')));
    await A.tap('#mkClear');
    check('"테마 지우기": 테마 가구만 치우고 원래 모습으로 (친구도)', await until(async () => (await themes(A)) === '[]' && (await themes(B)) === '[]' && (await T(B, () => window.__build.themeItems(4))) === 0 && (await T(B, () => window.__tree.room.themeOf(4))) === '', 5000) && (await has(B, 'pl1')) && (await has(B, 'pg1')) && (await T(A, () => document.getElementById('mkClear').disabled)));

    /* 테마는 2층과 더한 층만 */
    const no = await T(A, () => { const W = window.__tree; return [0, 2, 3, 5].map((lv) => W.dispatch({ t: 'theme', lv, id: 'cafe' })); });
    check('1층·3층(영화관)·4층(게임방)·없는 6층에는 테마를 입힐 수 없음', no.every((v) => v === false), no);
    const nl = await T(A, () => window.__build.apply(1, 'library')), kl = await T(A, () => window.__build.known('library'));
    check('2층에 📚 서재를 입힐 수 있음 (빈 2층이라 테마 가구 모두, 친구도)', nl === kl && await until(async () => (await themes(B)) === '[[1,"library"]]' && (await T(B, () => window.__build.themeItems(1))) === kl, 5000), { nl, kl });
    check('2층 사다리로 올라선 칸·3층 사다리 앞은 테마 가구로 막히지 않음', await T(A, () => { const W = window.__tree; return W.grid.free(52, 8) && W.grid.free(56, 8) && !W.grid.free(51, 8); }));

    /* 🏗️ 권한 주기 */
    await openMaster(A);
    check('마스터 판 사람 줄에 🏗️ 단추(층 더하기·테마 꾸미기)가 있음', await until(() => T(A, () => !!document.querySelector('#mkPeople .who [data-bit="128"]')), 4000));
    await A.tap('#mkPeople .who [data-bit="128"]');
    check('🏗️ 를 켜 주면 친구에게 마스터 탭과 층·테마 줄이 생김', await until(async () => (await B.isVisible('#tabs button[data-m="master"]')) && (await T(B, () => window.__build.shown)), 6000));
    await openMaster(B);
    check('친구의 마스터 판에는 층·테마 줄만 (하늘·불·사람 줄·끄기는 없음), 단추는 44px 이상', (await B.isVisible('#mkLevels')) && !(await B.isVisible('#mkSky')) && !(await B.isVisible('#mkLamp')) && !(await B.isVisible('#mkPeople')) && !(await B.isVisible('#masterOff')) && (await audit(B)).length === 0, await audit(B));
    await B.tap('#mkAdd');
    check('권한을 받은 친구가 층을 더하면 마스터 화면도 6층 집', await until(async () => (await levels(A)) === 6 && (await levels(B)) === 6, 6000), [await levels(A), await levels(B)]);
    await A.tap('#mkPeople .who [data-bit="128"]');
    check('🏗️ 를 끄면 친구의 층·테마 줄이 사라지고 층을 더할 수 없음', await until(() => T(B, () => !window.__build.shown), 6000) && (await T(B, () => window.__build.add())) === 0 && (await levels(A)) === 6);

    /* 8층까지 */
    await A.tap('#mkAdd'); await until(async () => (await levels(A)) === 7, 4000);
    await A.tap('#mkAdd');
    const cap = await until(async () => (await levels(A)) === 8 && (await levels(B)) === 8, 6000);
    const c8 = await T(A, () => { const W = window.__tree; return { add: document.getElementById('mkAdd').disabled, more: window.__build.add(), op: W.dispatch({ t: 'levels', n: 9 }), lad: W.LADDERS.length, floors: W.room.floors.length, lamps: W.S.lamps.length, chips: document.querySelectorAll('#mkLamp [data-lv]').length, lv: window.__build.levels }; });
    check('8층까지만: 더하기 단추가 꺼지고 9층은 안 됨 (사다리 일곱, 층 여덟, 불 여덟, 마스터 판 방 불 단추 여덟)', cap && c8.add && c8.more === 0 && !c8.op && c8.lad === 7 && c8.floors === 8 && c8.lamps === 8 && c8.chips === 8 && c8.lv === 8, c8);
    check('8층 집에서도 마스터 판(사람 줄 포함)의 단추는 44px 이상이고 화면 안', (await audit(A)).length === 0, await audit(A));
    await shot(A, 'panel-8f');

    /* 맨 위 층 지우기: 친구가 8층에 있을 때 */
    await T(B, () => window.__tree.setMode(null));
    check('친구가 8층에 가구를 놓고 8층에 섬', await put(B, 'p8', 'plant', 7 * DI + 10, 10) && await T(B, (p) => { const W = window.__tree; W.me.stop(); W.me.place(p[0], p[1]); return true; }, cxz(7 * DI + 12, 12)) && await until(() => T(B, () => window.__tree.level === 7), 5000) && await until(() => has(A, 'p8'), 5000));
    check('6층에 🍳 요리 대결장 (목록에 있는 가구만 놓이고 오류 없음)', (await T(A, () => window.__build.apply(5, 'cook'))) === (await T(A, () => window.__build.known('cook'))) && await until(async () => (await themes(B)) === '[[1,"library"],[5,"cook"]]', 5000), await themes(B));
    await openMaster(A);
    await A.tap('#mkDel');
    const armedTxt = await T(A, () => document.getElementById('mkDel').textContent);
    check('"맨 위 층 지우기" 를 한 번 누르면 지우지 않고 다시 물음 (8층과 가구 수)', (await levels(A)) === 8 && armedTxt.includes('한 번 더') && armedTxt.includes('8층') && armedTxt.includes('1개') && (await T(A, () => window.__build.armed)), armedTxt);
    check('물을 때도 단추는 44px 이상이고 화면 안', (await audit(A)).length === 0, await audit(A));
    await A.tap('#mkDel');
    check('한 번 더 누르면 나와 친구 모두 7층 집', await until(async () => (await levels(A)) === 7 && (await levels(B)) === 7, 6000), [await levels(A), await levels(B)]);
    check('8층의 가구가 없어짐 (둘 다)', !(await has(A, 'p8')) && !(await has(B, 'p8')) && (await itemsOn(A, 7)) === '' && (await itemsOn(B, 7)) === '');
    const [fx, fz] = cxz(6 * DI + 19, 8);
    const bpos = await T(B, () => ({ lv: window.__tree.level, x: window.__tree.me.x, z: window.__tree.me.z, y: window.__tree.me.root.position.y }));
    check('8층에 있던 친구는 7층 사다리 앞으로 내려옴', bpos.lv === 6 && Math.hypot(bpos.x - fx, bpos.z - fz) < 0.6 && Math.abs(bpos.y - 6 * 2.8) < 0.05, bpos);
    check('친구에게 "8층이 없어져서 7층으로 내려왔어요"', await until(async () => (await toast(B)).includes('내려왔어요'), 3000), await toast(B));
    const bid = await T(B, () => window.__duo.me);
    check('내 화면에서도 친구가 7층에 있음', await until(() => T(A, (id) => { const o = window.__duo.others.find((x) => x.id === id); return !!o && o.level === 6; }, bid), 8000));
    for (let n = 7; n > 4; n--) { await A.tap('#mkDel'); await A.tap('#mkDel'); await until(async () => (await levels(A)) === n - 1, 4000); if (n - 1 === 5) check('6층을 지우면 6층의 테마도 없어짐', (await themes(A)) === '[[1,"library"]]', await themes(A)); }
    check('더한 층을 모두 지우면 4층 집 (친구도, 방 지문도 같음)', await until(async () => (await levels(B)) === 4 && await same(A, B), 6000) && (await T(A, () => window.__tree.LADDERS.length)) === 3 && (await T(A, () => window.__tree.room.floors.length)) === 4);
    const keep = await T(A, () => { const W = window.__tree; return { dis: document.getElementById('mkDel').disabled, drop: window.__build.drop(), op: W.dispatch({ t: 'levels', n: 3 }), lv: W.LEVELS, ser: 'levels' in W.serialize(), t: document.getElementById('toast').textContent }; });
    check('처음부터 있는 4층까지는 지울 수 없음 (단추도 꺼짐), 저장값에 층 수 항목이 없어짐', keep.dis && keep.drop === 0 && !keep.op && keep.lv === 4 && !keep.ser, keep);
    check('5층에 있던 사람 가구(스탠드·선물)도 5층과 함께 없어지고, 4층의 옮긴 가구와 2층 테마는 그대로', !(await has(A, 'pl1')) && !(await has(A, 'pg1')) && (await has(A, 'rl')) && (await themes(A)) === '[[1,"library"]]');
    check('다시 5층을 더하면 빈 층이고 테마도 없음', (await T(A, () => window.__build.add())) === 5 && (await itemsOn(A, 4)) === '' && (await T(A, () => window.__tree.room.themeOf(4))) === '' && await until(async () => (await levels(B)) === 5, 5000));

    /* 다시 열어도 그대로 (혼자 노는 내 방) */
    const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const P = await open(ctx2, `${BASE}?ns=bp`, { master: true });
    await T(P, () => { window.__build.add(); window.__build.add(); window.__build.apply(5, 'karaoke'); });
    check('혼자 노는 방: 6층 집, 6층에 🎤 노래방, 6층에 직접 놓은 가구', (await levels(P)) === 6 && await put(P, 'own6', 'chair', 5 * DI + 20, 14) && (await themes(P)) === '[[5,"karaoke"]]');
    const before = await itemsOn(P, 5), nk = await T(P, () => window.__build.themeItems(5));
    await sleep(800);
    await P.reload(); await ready(P);
    const after = await T(P, () => { const W = window.__tree; return { lv: W.LEVELS, floors: W.room.floors.length, lad: W.LADDERS.length, look: W.room.themeOf(5), n: window.__build.themeItems(5), lamps: W.S.lamps.length }; });
    check('다시 열어도 6층 집, 6층 노래방 테마와 테마 가구·직접 놓은 가구가 그대로', after.lv === 6 && after.floors === 6 && after.lad === 5 && after.look === 'karaoke' && after.n === nk && after.lamps === 6 && (await themes(P)) === '[[5,"karaoke"]]' && (await itemsOn(P, 5)) === before && (await has(P, 'own6')), after);
    await T(P, (p) => { const W = window.__tree; W.me.stop(); W.me.place(p[0], p[1]); W.setZoomMul(0.01); W.snapView(); }, cxz(5 * DI + 22, 12));
    await until(() => T(P, () => window.__tree.level === 5), 4000); await sleep(500);
    await shot(P, '6f-karaoke');
    // 층 수·테마 항목이 없던 때의 방
    await T(P, () => localStorage.setItem('nolja-tree-room.bp', JSON.stringify({ v: 2, up: 1, at: 1700000000000, sync: 0, items: [['o1', 'sofa', 1, 6, 1], ['o4', 'lamp', 96 + 10, 10, 0]], orns: [], cakes: [], lights: ['off', 'on'], wall: 'cream', floor: 'oak', lamps: [1, 1, 0, 1] })));
    await P.reload(); await ready(P);
    const old = await T(P, () => { const W = window.__tree; return { lv: W.LEVELS, floors: W.room.floors.length, th: window.__build.themes.length, o4: W.S.items.has('o4'), lamps: W.S.lamps.join() }; });
    check('층 수 항목이 없던 예전 방은 4층 집 (4층 가구·불 그대로, 테마 없음)', old.lv === 4 && old.floors === 4 && old.th === 0 && old.o4 && old.lamps === '1,1,0,1', old);
    await ctx2.close();

    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) { check('검사가 끝까지 돌았음', false, String(e && e.stack || e).slice(0, 600)); }
  await browser.close(); server.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} 통과`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
