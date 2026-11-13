// 마스터키 검사: 숨은 열쇠·제목 일곱 번 → 암호 → 마스터 탭, 잠금 없이 쓰기(다른 사람 달력은 그대로), 불꽃놀이 단추, 하늘 낮·밤(친구에게도), 선물 미리 열기, 사람별 권한 주기(비행 슈트 🚀 포함). 실행: cd tree/tests && node master.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8191, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const HASH = 'de94e28d7a302b52374831e94e8c70adddf861c691e77ab53f0646f55543a3e7'; // 암호 자체는 검사에 적지 않는다: 켠 상태는 저장값을 직접 넣어 만든다
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const T = (p, fn, arg) => p.evaluate(fn, arg);
const NOV20 = new Date(2026, 10, 20, 12, 0, 0).getTime();
async function open(ctx, url, o = {}) {
  const p = await ctx.newPage();
  await p.addInitScript((a) => { const d = a.t - Date.now(); window.__now = () => Date.now() + d; if (a.mk) localStorage.setItem('tree.master.' + new URLSearchParams(location.search).get('ns'), a.mk); }, { t: NOV20, mk: o.master ? HASH : '' });
  p.on('pageerror', (e) => console.log('   (페이지 오류)', e.message));
  p.on('dialog', (d) => d.accept(o.pass || ''));
  await p.goto(url); await until(() => p.evaluate(() => !!(window.__tree && window.__tree.frames > 3)), 60000);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const phase = (p) => T(p, () => window.__sky.state.phase);
const locks = (p) => T(p, () => document.querySelectorAll('.locked').length);
const server = http.createServer((q, s) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith(path.sep)) f += 'index.html'; fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); s.end(b); } }); });
(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
    /* 암호 */
    const W = await open(ctx, `${BASE}?net=bc&door=0&ns=mw`, { pass: '틀린암호' });
    check('처음에는 마스터 탭이 없고 잠긴 것이 있음', !(await W.isVisible('#tabs button[data-m="master"]')) && (await locks(W)) > 0, await locks(W));
    const kp = await T(W, () => { const k = window.__master.key, s = window.__tree.screenOf(k.x + 0.05, k.z + 0.03, k.y); return [s.x, s.y]; });
    await W.touchscreen.tap(kp[0], kp[1]); await sleep(500);
    check('숨은 열쇠를 눌러도 틀린 암호로는 켜지지 않음', !(await T(W, () => window.__master.on)) && (await W.textContent('#toast')).includes('맞지 않아요'), [kp, await W.textContent('#toast')]);
    for (let i = 0; i < 7; i++) await W.click('#top .brand');
    await sleep(400);
    check('제목 일곱 번도 같은 암호 물음 (틀리면 안 켜짐)', !(await T(W, () => window.__master.on)));
    await W.close();

    /* 켠 사람 */
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ma`, { master: true });
    check('켠 기기에는 아래에 "마스터" 탭이 있고 잠금이 없음', (await A.isVisible('#tabs button[data-m="master"]')) && (await locks(A)) === 0, await locks(A));
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=mb#r=${room}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 2 && (await T(B, () => window.__duo.others)).length === 1, 20000);
    const lockedOrn = await T(B, () => { const b = document.querySelector('#ornList .locked'); return b && b.dataset.v; });
    check('친구에게는 잠금이 그대로', !!lockedOrn && !(await B.isVisible('#tabs button[data-m="master"]')), lockedOrn);
    const put = await T(A, (k) => window.__tree.dispatch({ t: 'orn', id: 'mo1', k, x: 0.3, y: 1.2, z: 0.3 }), lockedOrn);
    check('마스터는 잠긴 장식을 달 수 있고 친구 방에도 달림', put && await until(() => T(B, () => window.__tree.S.orns.has('mo1')), 5000), put);
    check('달력 칸은 그대로 (친구는 예전처럼 하루에 한 칸씩)', (await T(A, () => window.__tree.S.adv.size)) === 0 && (await locks(B)) > 0);
    check('친구가 같은 장식을 달려 하면 여전히 안 됨', !(await T(B, (k) => window.__tree.dispatch({ t: 'orn', id: 'mo2', k, x: 0.3, y: 1.0, z: 0.3 }), lockedOrn)));
    await A.tap('#tabs button[data-m="master"]'); await sleep(900);
    check('마스터 탭을 누르면 판이 열림: 하늘, 사람별 권한, 끄기', (await A.isVisible('#masterP')) && (await A.isVisible('#mkSky')) && (await A.isVisible('#masterOff')) && (await T(A, () => document.querySelectorAll('#mkPeople .who').length)) === 1);
    const bad = await T(A, () => [...document.querySelectorAll('#masterP button, #tabs button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && (r.height < 43.5 || r.width < 43.5 || r.left < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5); }).map((b) => b.textContent));
    check('마스터 판과 탭의 단추는 44px 이상, 화면 안', bad.length === 0, bad);
    await A.screenshot({ path: path.join(__dirname, 'out', 'master-panel.png') });
    /* 하늘 */
    await A.tap('#mkSky [data-v="night"]');
    check('밤으로 바꾸면 내 하늘과 친구 하늘이 밤', await until(async () => (await phase(A)) === 'night' && (await phase(B)) === 'night', 8000), [await phase(A), await phase(B)]);
    await A.tap('#mkSky [data-v="day"]');
    check('낮으로 바꾸면 둘 다 낮', await until(async () => (await phase(A)) === 'day' && (await phase(B)) === 'day', 8000));
    await A.tap('#mkSky [data-v="night"]'); await sleep(300); await A.tap('#mkSky [data-v="auto"]');
    check('자동으로 돌리면 실제 시각(낮 12시)', await until(async () => (await phase(A)) === 'day' && (await phase(B)) === 'day', 8000));
    /* 방 불 */
    await A.tap('#mkLamp [data-lv="2"]');
    check('마스터 판에서 3층 불을 끄면 나와 친구에게 꺼지고 단추도 꺼진 표시', await until(async () => (await T(A, () => window.__lights.lamps.join())) === '1,1,0' && (await T(B, () => window.__lights.lamps.join())) === '1,1,0', 4000) && (await A.getAttribute('#mkLamp [data-lv="2"]', 'aria-pressed')) === 'false');
    await A.tap('#mkLamp [data-lv="2"]');
    check('다시 누르면 켜짐', await until(async () => (await T(B, () => window.__lights.lamps.join())) === '1,1,1', 4000));
    /* 불꽃놀이·선물 */
    await T(A, () => window.__tree.dispatch({ t: 'gift', id: 'g1', to: '나', from: '친구', text: '메리 크리스마스', wrap: 'red', at: Date.now() }));
    check('마스터는 선물을 12월 25일 전에도 열 수 있고 친구는 못 엶', (await T(A, () => window.__gift.canOpen(window.__tree.S.gifts.get('g1')))) && await until(() => T(B, () => { const g = window.__tree.S.gifts.get('g1'); return !!g && !window.__gift.canOpen(g); }), 5000));
    check('불꽃놀이 단추는 마스터에게만', (await T(A, () => window.__sky.button)) && !(await T(B, () => window.__sky.button)));
    /* 권한 주기 */
    await A.tap('#mkPeople .who [data-bit="1"]');
    check('🔓 를 켜 주면 친구의 잠금이 사라짐', await until(async () => (await locks(B)) === 0, 5000), await locks(B));
    check('이제 친구도 잠긴 장식을 달 수 있음', await T(B, (k) => window.__tree.dispatch({ t: 'orn', id: 'mo2', k, x: 0.3, y: 1.0, z: 0.3 }), lockedOrn));
    await A.tap('#mkPeople .who [data-bit="2"]'); await A.tap('#mkPeople .who [data-bit="4"]'); await A.tap('#mkPeople .who [data-bit="8"]');
    check('🎆 🌙 🎁 도 켜 주면 친구에게 불꽃놀이 단추, 마스터 탭(하늘만), 선물 미리 열기', await until(async () => (await T(B, () => window.__sky.button)) && (await B.isVisible('#tabs button[data-m="master"]')) && (await T(B, () => window.__gift.canOpen(window.__tree.S.gifts.get('g1')))), 5000));
    /* 비행 슈트 권한 */
    const jetChip = (p) => T(p, () => { const c = document.querySelector('#pickOutfit .chip[data-v="jet"]'); return !!c && !c.hidden; });
    await T(B, () => window.__tree.setLook({ outfit: 'jet' })); await sleep(200);
    check('🚀 를 받기 전: 친구의 옷 목록에 비행 슈트가 없고 입을 수도 날 수도 없음', !(await jetChip(B)) && (await T(B, () => window.__tree.look.outfit)) !== 'jet' && !(await T(B, () => window.__fly.shown)) && (await jetChip(A)));
    await A.tap('#mkPeople .who [data-bit="16"]');
    check('🚀 를 켜 주면 친구의 옷 목록에 비행 슈트가 생김', await until(() => jetChip(B), 5000));
    await T(B, () => window.__tree.setLook({ outfit: 'jet' }));
    check('친구가 비행 슈트를 입으면 날기 단추가 뜨고 마스터 화면에도 그 옷으로 보임', await until(async () => (await T(B, () => window.__tree.look.outfit === 'jet' && window.__fly.shown)) && (await T(A, () => window.__duo.others[0].look.outfit)) === 'jet', 5000));
    const bid = await T(B, () => window.__duo.me);
    await T(B, () => window.__fly.start());
    check('친구가 날면 마스터 화면에서도 떠 있음', await until(async () => (await T(B, () => window.__fly.on && window.__fly.alt > 0.5)) && await T(A, (id) => { const f = window.__fly.peer(id); return !!f && f.y > 0.4; }, bid), 8000), await T(A, (id) => window.__fly.peer(id), bid));
    await T(B, () => window.__fly.land(true));
    await B.tap('#tabs button[data-m="master"]'); await sleep(300);
    check('친구의 마스터 판에는 하늘만 있고 권한 주기·끄기는 없음', (await B.isVisible('#mkSky')) && !(await B.isVisible('#masterOff')) && !(await B.isVisible('#mkPeople')));
    await B.tap('#mkSky [data-v="night"]');
    check('친구가 하늘을 밤으로 바꾸면 마스터 화면도 밤', await until(async () => (await phase(A)) === 'night', 8000), await phase(A));
    await B.reload(); await until(() => B.evaluate(() => !!(window.__tree && window.__tree.frames > 3)), 60000);
    check('받은 권한은 다시 들어와도 그대로', (await locks(B)) === 0 && (await B.isVisible('#tabs button[data-m="master"]')));
    await until(async () => (await T(A, () => window.__duo.count)) === 2, 20000);
    await A.tap('#tabs button[data-m="master"]'); await sleep(200); if (!(await A.isVisible('#masterP'))) await A.tap('#tabs button[data-m="master"]');
    check('마스터 판을 다시 열면 친구가 가진 권한이 켜진 채로 보임', await until(() => T(A, () => [...document.querySelectorAll('#mkPeople .who .chip')].length === 5 && [...document.querySelectorAll('#mkPeople .who .chip')].every((b) => b.getAttribute('aria-pressed') === 'true')), 6000), await T(A, () => window.__master.given));
    check('다시 들어와도 비행 슈트를 입은 채이고 날기 단추가 있음', await until(() => T(B, () => window.__tree.look.outfit === 'jet' && window.__fly.shown), 5000), await T(B, () => window.__tree.look.outfit));
    await A.tap('#mkPeople .who [data-bit="16"]');
    check('🚀 를 끄면 친구는 평상복으로 바뀌고 날기 단추와 옷 목록의 비행 슈트가 사라짐', await until(async () => (await T(B, () => window.__tree.look.outfit === 'basic' && !window.__fly.shown)) && !(await jetChip(B)), 5000), await T(B, () => window.__tree.look.outfit));
    await A.tap('#mkPeople .who [data-bit="16"]');
    check('🚀 를 다시 켜 주면 (같은 화면에서) 비행 슈트를 돌려 입음', await until(() => T(B, () => window.__tree.look.outfit === 'jet' && window.__fly.shown), 5000), await T(B, () => window.__tree.look.outfit));
    await A.tap('#mkPeople .who [data-bit="1"]');
    check('🔓 를 끄면 친구에게 잠금이 돌아옴', await until(async () => (await locks(B)) > 0, 5000), [await T(A, () => window.__master.given), await T(B, () => [localStorage.getItem('tree.grant.mb'), window.__duo.me]), await A.textContent('#toast')]);
    /* 다시 열어도 마스터가 놓은 것이 남음 */
    await sleep(1500); await A.reload(); await until(() => A.evaluate(() => !!(window.__tree && window.__tree.frames > 3)), 60000);
    check('방을 다시 열어도 마스터가 단 잠긴 장식이 남아 있음', await T(A, () => window.__tree.S.orns.has('mo1')));
    await A.tap('#tabs button[data-m="master"]'); await sleep(300); await A.tap('#masterOff'); await sleep(300);
    check('끄면 마스터 탭이 사라지고 잠금이 돌아옴', !(await T(A, () => window.__master.on)) && !(await A.isVisible('#tabs button[data-m="master"]')) && (await locks(A)) > 0);
  } catch (e) { check('검사가 끝까지 돌았음', false, String(e && e.stack || e).slice(0, 400)); }
  await browser.close(); server.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} 통과`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
