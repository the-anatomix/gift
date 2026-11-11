// 초인종 입장과 방장의 허락·내보내기 검사. 실행: cd tree/tests && node door.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8168, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__door && window.__tree.frames > 3)), 20000);
async function open(ctx, url, look = true) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (look && await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const mode = (p) => T(p, () => window.__duo.mode);
const hash = (p) => T(p, () => window.__duo.hash());
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
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const url = (ns, h) => `${BASE}?net=bc&ns=${ns}&st=3000&rt=500${h || ''}`;
    const A = await open(ctx, url('da'));
    await T(A, () => { const W = window.__tree; W.dispatch({ t: 'put', id: 'a1', k: 'sofa', i: 1, j: 6, r: 1 }); W.dispatch({ t: 'orn', id: 'o1', k: 'red', x: 0.3, y: 1.2, z: 0.4 }); });
    await T(A, () => window.__duo.invite());
    await until(async () => (await mode(A)) === 'waiting');
    const inv = await T(A, () => window.__duo.inviteUrl()), room = inv.split('#r=')[1], id = room.split('-')[0];
    check('방을 만든 사람은 집 밖 장면 없이 바로 방 안에 있음', !(await T(A, () => window.__door.shown)) && (await A.isVisible('#tabs')));

    /* 초대받은 사람: 집 밖 → 초인종 */
    const B = await open(ctx, url('db', '#r=' + room), false);
    check('초대 링크로 오면 집 밖(문 앞)에서 시작함: 1인칭, 탭 없음, 초인종 단추', await until(async () => (await mode(B)) === 'door', 15000) && (await T(B, () => window.__door.shown && window.__tree.eyeOn)) && !(await B.isVisible('#tabs')) && !(await B.isVisible('#tools')) && (await B.isVisible('#bell')) && (await B.textContent('#doorMain')).includes('집 앞') && !(await B.isVisible('#look')), await mode(B));
    check('문 앞 화면의 단추가 화면 안·44px 이상', (await audit(B)).length === 0, await audit(B));
    await sleep(600);
    await B.screenshot({ path: path.join(__dirname, 'out', 'door-outside.png') });
    check('초인종을 누르기 전에는 방 안에 들어와 있지 않음 (방장에게도 안 보임)', (await T(A, () => window.__duo.others.length)) === 0 && (await T(A, () => window.__duo.knocks.length)) === 0 && (await T(B, () => window.__tree.S.items.size)) === 0 && (await mode(A)) === 'waiting');
    const bp = await T(B, () => { const p = window.__door.bellPoint(); return window.__tree.screenOf(p[0], p[2], p[1]); });
    check('초인종이 화면 안에 보임', bp.x > 10 && bp.x < 365 && bp.y > 60 && bp.y < 600, bp);
    await B.touchscreen.tap(bp.x, bp.y);
    check('집 앞의 초인종을 누르면 방장에게 "문 앞에 있어요" 알림과 두 단추가 뜸', await until(async () => (await T(A, () => window.__duo.knocks.length)) === 1 && (await A.isVisible('#knock')), 5000) && (await A.textContent('#knock')).includes('같이 꾸미러 온') && (await A.locator('#knock button').count()) === 2 && (await A.textContent('#toast')).includes('딩동') && (await audit(A)).length === 0, await audit(A));
    check('누른 사람은 기다리라는 안내를 보고, 아직 방 안은 아님', (await T(B, () => window.__duo.rang)) && (await B.textContent('#doorMain')).includes('기다려요') && (await B.textContent('#bell')).includes('다시 누르기') && (await mode(B)) === 'door' && (await T(A, () => window.__duo.others.length)) === 0);
    await A.screenshot({ path: path.join(__dirname, 'out', 'door-knock.png') });
    await A.tap('#knock button.main');
    check('방장이 "들어오게 하기"를 누르면 문이 열리고 걸어 들어감', await until(() => T(B, () => window.__door.opening), 3000));
    check('다 들어가면 방 안: 연결되고, 방장의 방을 받고, 서로 보임', await until(async () => (await mode(B)) === 'on' && !(await T(B, () => window.__door.shown)) && (await hash(A)) === (await hash(B)) && (await T(A, () => window.__duo.others.length)) === 1 && (await T(B, () => window.__duo.others.length)) === 1, 10000), { b: await mode(B) });
    const me = await T(B, () => [window.__tree.me.x, window.__tree.me.z]);
    check('들어온 사람은 현관문 앞에 서 있음', Math.hypot(me[0] + 2.2, me[1] - 4.3) < 0.8, me);
    check('처음 온 사람은 들어온 다음에 캐릭터를 고름', (await B.isVisible('#look')) && !(await T(A, () => window.__duo.knocks.length)) && !(await A.isVisible('#knock')));
    await B.tap('#lookDone'); await sleep(300);
    check('들어온 뒤에는 문 앞 카메라가 남지 않고 원래처럼 방을 내려다봄', await T(B, () => !window.__tree.eyeOn && window.__tree.meShown && window.__tree.pov === 'iso') && (await B.isVisible('#turn')));
    check('들어온 뒤에는 아래 탭이 다시 보임', (await B.isVisible('#tabs')) && (await B.isVisible('#tools')) && (await B.textContent('#net')) === '같이 노는 중 · 2명');

    /* 한 번 들인 친구는 다음부터 초인종만 누르면 바로 */
    await B.reload(); await ready(B);
    await until(async () => (await mode(B)) === 'door', 15000);
    await until(async () => (await T(A, () => window.__duo.others.length)) === 0, 12000);
    await B.tap('#bell');
    check('전에 들인 친구는 초인종만 누르면 방장에게 묻지 않고 바로 들어옴', await until(async () => (await mode(B)) === 'on', 10000) && (await T(A, () => window.__duo.knocks.length)) === 0 && !(await B.isVisible('#look')));

    /* 구경 온 사람: 돌려보내기 */
    const C = await open(ctx, url('dc', '#v=' + id));
    await until(async () => (await mode(C)) === 'door', 15000);
    await C.tap('#bell');
    check('구경 링크로 온 사람도 초인종을 눌러야 하고, 방장에게 "구경하러 온"으로 보임', await until(async () => (await T(A, () => window.__duo.knocks.length)) === 1, 5000) && (await A.textContent('#knock')).includes('구경하러 온'));
    check('방 안의 다른 사람에게도 딩동 알림이 감', await until(async () => (await B.textContent('#toast')).includes('딩동'), 4000));
    await A.tap('#knock button:not(.main)');
    check('방장이 "돌려보내기"를 누르면 들어오지 못하고 안내를 봄', await until(async () => (await mode(C)) === 'denied', 5000) && (await C.textContent('#doorMain')).includes('들어갈 수 없어요') && (await C.textContent('#doorSub')).includes('열어 주지 않았어요') && !(await C.isVisible('#bell')) && (await C.isVisible('#doorHome')) && (await T(A, () => window.__duo.others.length)) === 1 && !(await A.isVisible('#knock')) && (await audit(C)).length === 0);
    await C.tap('#doorHome'); await ready(C);
    check('"내 방으로 가기"를 누르면 내 방으로 돌아감', (await mode(C)) === 'solo' && !(await T(C, () => window.__door.shown)) && (await C.isVisible('#tabs')));
    await C.close();

    /* 방장이 내보내기 */
    await A.tap('#tabs button[data-m="duo"]'); await sleep(300);
    check('방장의 같이 판에 방 안 사람 목록과 "내보내기" 단추가 있음', (await A.locator('#duoPeople .row').count()) === 1 && (await A.textContent('#duoPeople')).includes('같이 꾸미는 중') && (await A.textContent('#duoPeople button')) === '내보내기' && (await audit(A)).length === 0, await audit(A));
    await B.tap('#tabs button[data-m="duo"]'); await sleep(200);
    check('손님에게도 방 안 사람 목록은 보이지만 내보내기 단추는 없음', (await B.locator('#duoPeople .row').count()) === 1 && (await B.locator('#duoPeople button').count()) === 0);
    await A.screenshot({ path: path.join(__dirname, 'out', 'door-people.png') });
    await A.tap('#duoPeople button');
    check('방장이 내보내면 그 사람은 방에서 나가고 안내를 봄', await until(async () => (await mode(B)) === 'denied', 6000) && (await T(B, () => window.__duo.why)) === 'kick' && (await B.textContent('#doorSub')).includes('내보냈어요') && await until(async () => (await T(A, () => window.__duo.others.length)) === 0 && (await mode(A)) === 'waiting', 6000));
    await B.reload(); await ready(B);
    await until(async () => (await mode(B)) === 'door', 15000);
    await B.tap('#bell');
    check('내보낸 사람은 같은 링크로 다시 와도 들어오지 못함', await until(async () => (await mode(B)) === 'denied', 6000) && (await T(B, () => window.__duo.why)) === 'ban' && (await T(A, () => window.__duo.knocks.length)) === 0 && (await T(A, () => window.__duo.others.length)) === 0);
    // 다른 기기의 친구는 들어올 수 있다
    const D = await open(ctx, url('dd', '#r=' + room));
    await until(async () => (await mode(D)) === 'door', 15000);
    await T(D, () => window.__door.ring());
    await until(async () => (await T(A, () => window.__duo.knocks.length)) === 1, 5000);
    await T(A, () => window.__duo.admit(window.__duo.knocks[0].id));
    check('다른 친구는 그대로 들어올 수 있음', await until(async () => (await mode(D)) === 'on' && (await hash(A)) === (await hash(D)), 10000));
    // 문 앞에서 기다리던 사람이 그냥 가 버리면 알림이 사라진다
    const E = await open(ctx, url('de', '#r=' + room));
    await until(async () => (await mode(E)) === 'door', 15000);
    await T(E, () => window.__door.ring());
    await until(async () => (await T(A, () => window.__duo.knocks.length)) === 1, 5000);
    await E.close();
    check('문 앞에서 기다리던 사람이 가 버리면 방장의 알림이 사라짐', await until(async () => (await T(A, () => window.__duo.knocks.length)) === 0 && !(await A.isVisible('#knock')), 12000));
    await ctx.close();
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
