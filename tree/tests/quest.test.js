// 황금열쇠와 퀘스트 검사: 1층 바닥의 숨은 열쇠 → 퀘스트 판(암호 없음), 퀘스트를 다 깨야 쓸 수 있음, 쓰면 마스터 권한,
//   암호 마스터가 사람 줄의 🗝️ 로 다른 사람의 마스터키를 켜고 끔. 실행: cd tree/tests && node quest.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8243, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const HASH = '9262b0baa88add8fdc882f6772709ebfbd645aaa651e904e4e3d795898a71a7d'; // 암호 자체는 검사에 적지 않는다: 켠 상태는 저장값을 직접 넣어 만든다
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
    const tapKey = async (p) => { await T(p, () => window.__tree.setMode(null)); await sleep(200); const kp = await T(p, () => { const s = window.__tree.screenOf(-3.67, -3.69, 0.03); return [s.x, s.y]; }); if (kp[0] > 8 && kp[0] < 367 && kp[1] > 60 && kp[1] < 700) await p.touchscreen.tap(kp[0], kp[1]); else await T(p, () => window.__quest.open()); }; // 열쇠가 화면 밖이면(카메라가 다른 쪽을 볼 때) 판만 연다. 실제로 누르는 것은 master.test.js 가 본다
    const audit = (p) => T(p, () => [...document.querySelectorAll('#questP button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44 || r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5; }).map((b) => b.id));
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=qa`, { master: true });
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=qb#r=${room}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 2 && (await T(B, () => window.__duo.others)).length === 1, 20000);
    let asked = 0; B.on('dialog', () => { asked++; });

    /* 열쇠와 판 */
    const N = await T(B, () => window.__quest.QUESTS.length);
    check('퀘스트가 스무 개 넘고 이름이 모두 다름', N >= 20 && (await T(B, () => new Set(window.__quest.QUESTS.map((q) => q.id)).size)) === N, N);
    await T(B, () => window.__quest.mark('dart', 160));
    check('열쇠를 찾기 전에는 퀘스트를 깨도 알림이 없음', !(await T(B, () => (document.getElementById('toast') || {}).textContent || '').catch(() => '')).includes('퀘스트'));
    await tapKey(B);
    check('바닥의 황금열쇠를 누르면 암호 없이 퀘스트 판이 열림', await until(() => T(B, () => window.__quest.shown), 3000) && asked === 0);
    check('판에 퀘스트가 모두 보이고 단추는 44px 이상·화면 안', (await B.locator('#questList li').count()) === N && (await audit(B)).length === 0, await audit(B));
    check('깬 퀘스트는 ✅, 나머지는 진행 수 (다트 160점 → 달성 1개)', (await B.textContent('#questCount')) === `퀘스트 1/${N}` && (await B.textContent('#questList li[data-id="dart"] em')) === '✅' && (await B.textContent('#questList li[data-id="brew"] em')) === '0/10');
    check('다 깨기 전에는 "황금열쇠 쓰기"가 꺼져 있음', await B.isDisabled('#questUse'));
    await T(B, () => { const q = window.__quest; q.mark('brew'); q.mark('brew'); q.mark('menu', 'latte'); q.mark('menu', 'latte'); q.mark('fire', 80); q.mark('fire', 60); });
    check('횟수는 쌓이고, 같은 것은 한 번만, 점수는 가장 높은 것', (await T(B, () => [window.__quest.progress('brew'), window.__quest.progress('menu'), window.__quest.progress('fire')])).join() === '2,1,80');
    check('열린 판이 바로 따라감', (await B.textContent('#questList li[data-id="brew"] em')) === '2/10');
    await B.tap('#questClose');
    check('놀이 점수가 퀘스트에 이어짐 (음식을 다 먹으면 "먹을 것" 하나)', await (async () => { await T(B, () => window.__food.take('macaron')); for (let k = 0; k < 2; k++) { const h = await T(B, () => window.__food.holding); await T(B, () => window.__tree.pressSpace()); await until(async () => { const n = await T(B, () => window.__food.holding); return !n || (n.shown < h.shown && (n.ready || n.ending)); }, 6000); } return until(() => T(B, () => window.__quest.progress('foods') === 1), 20000); })(), await T(B, () => [window.__quest.progress('foods'), window.__food.holding, window.__tree.nearAction(), localStorage.getItem('tree.quest.qb')]));
    await T(B, () => window.__quest.finishAll());
    check('마지막 퀘스트를 깨면 알려 줌', await until(async () => (await B.textContent('#toast').catch(() => '')).includes('퀘스트를 모두 깼어요'), 4000));
    check('다 깨도 열쇠를 쓰기 전에는 마스터 탭이 없음', (await T(B, () => window.__quest.allDone())) && !(await B.isVisible('#tabs button[data-m="master"]')) && (await locks(B)) > 0);
    await until(async () => (await T(B, () => window.__food.holding)) === null, 8000);
    await tapKey(B); await until(() => T(B, () => window.__quest.shown), 3000);
    check('다 깨면 "황금열쇠 쓰기"가 켜짐', !(await B.isDisabled('#questUse')));
    await B.tap('#questUse');
    check('쓰면 암호 없이 마스터 탭이 생기고 잠금이 풀림', await until(async () => (await B.isVisible('#tabs button[data-m="master"]')) && (await locks(B)) === 0, 5000) && asked === 0 && (await T(B, () => window.__master.gold)) === 'on' && !(await T(B, () => window.__master.on)));
    await B.tap('#tabs button[data-m="master"]'); await sleep(400);
    check('황금열쇠의 마스터 판: 하늘·방 불·불꽃놀이는 있고, 사람 줄과 끄기는 없음', (await B.isVisible('#mkSky')) && (await B.isVisible('#mkLamp')) && (await B.isVisible('#fireShow')) && !(await B.isVisible('#mkPeople')) && !(await B.isVisible('#masterOff')));
    await T(B, () => window.__tree.setMode(null));

    /* 암호 마스터가 켜고 끔 */
    await A.tap('#tabs button[data-m="master"]');
    check('마스터의 사람 줄 맨 앞 🗝️ 가 켜진 채로 보임', await until(() => T(A, () => { const b = document.querySelector('#mkPeople .who [data-gold]'); return b && b.getAttribute('aria-pressed') === 'true' && b === document.querySelector('#mkPeople .who .chip'); }), 8000), await T(A, () => window.__master.golds));
    await A.tap('#mkPeople .who [data-gold]');
    check('🗝️ 를 끄면 친구의 마스터 탭이 사라지고 잠금이 돌아옴', await until(async () => !(await B.isVisible('#tabs button[data-m="master"]')) && (await locks(B)) > 0, 5000) && (await T(B, () => window.__master.gold)) === 'off');
    await tapKey(B); await until(() => T(B, () => window.__quest.shown), 3000);
    check('꺼 둔 동안에는 퀘스트를 다 깼어도 열쇠를 못 씀', (await B.isDisabled('#questUse')) && (await B.textContent('#questSay')).includes('꺼 두었어요'));
    await B.tap('#questClose');
    await B.reload(); await until(() => B.evaluate(() => !!(window.__tree && window.__tree.frames > 3)), 60000);
    await until(async () => (await T(A, () => window.__duo.count)) === 2, 20000);
    check('다시 들어와도 꺼진 채', (await T(B, () => window.__master.gold)) === 'off' && !(await B.isVisible('#tabs button[data-m="master"]')));
    await T(A, () => window.__tree.setMode(null)); await A.tap('#tabs button[data-m="master"]');
    await until(() => T(A, () => { const b = document.querySelector('#mkPeople .who [data-gold]'); return b && b.getAttribute('aria-pressed') === 'false'; }), 8000);
    await A.tap('#mkPeople .who [data-gold]');
    check('🗝️ 를 다시 켜면 친구에게 마스터 탭이 돌아옴', await until(async () => (await B.isVisible('#tabs button[data-m="master"]')) && (await locks(B)) === 0, 6000) && (await T(B, () => window.__master.gold)) === 'on');
    check('마스터 자신의 열쇠 판은 "이미 마스터키를 켠 기기"', await (async () => { await T(A, () => window.__tree.setMode(null)); await tapKey(A); await until(() => T(A, () => window.__quest.shown), 3000); return (await A.textContent('#questSay')).includes('이미 마스터키') && await A.isDisabled('#questUse'); })());
  } catch (e) { check('검사가 끝까지 돌았음', false, String(e && e.stack || e).slice(0, 400)); }
  await browser.close(); server.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} 통과`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
