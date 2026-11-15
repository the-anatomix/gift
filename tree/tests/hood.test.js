// 이웃 검사: 친구 목록(이름·자동 입장·공동 관리자·내보내기) · 나간 사람이 남지 않음 · 같은 기기 다시 오기 · 내 집 주소는 그대로 · 이웃집 목록과 집 오가기. 실행: cd tree/tests && node hood.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8239, BASE = `http://localhost:${PORT}/tree/`;
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
  await p.goto(url, { timeout: 120000 }); await ready(p);
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
    await ctx.addInitScript(() => { // 닉네임을 미리 정해 둔다 (ns 마다)
      const ns = new URLSearchParams(location.search).get('ns'), names = { ha: '지우', hb: '민지', hc: '서준', hd: '하늘' };
      if (names[ns] && !localStorage.getItem('nolja-tree-name.' + ns)) localStorage.setItem('nolja-tree-name.' + ns, JSON.stringify(names[ns]));
      if (!localStorage.getItem('nolja-tree-look.' + ns)) localStorage.setItem('nolja-tree-look.' + ns, JSON.stringify({ gender: 'f', outfit: 'basic' })); // 캐릭터 고르기를 건너뛴다
    });
    const url = (ns, h) => `${BASE}?net=bc&ns=${ns}&st=6000&rt=500${h || ''}`;
    const H = (p) => T(p, () => { const h = window.__hood; return { home: h.home, friends: h.friends, hoods: h.hoods, open: h.open, autoIn: h.autoIn }; });
    const others = (p) => T(p, () => window.__duo.others.length);
    const toast = (p) => p.textContent('#toast');
    const openDuo = async (p) => { if (!(await p.isVisible('#duoP'))) { await p.tap('#tabs button[data-m="duo"]'); await sleep(250); } };
    const reopen = async (p) => { await p.reload(); await ready(p); };

    /* 내 집 만들기 */
    const A = await open(ctx, url('ha'));
    await T(A, () => { const W = window.__tree; W.dispatch({ t: 'put', id: 'a1', k: 'sofa', i: 1, j: 6, r: 1 }); });
    check('초대하기 전에는 내 집 주소도 친구 목록·이웃집 단추도 없음', (await H(A)).home === null && !(await A.isVisible('#hoodBar')));
    await T(A, () => window.__duo.invite());
    await until(async () => (await mode(A)) === 'waiting');
    const inv = await T(A, () => window.__duo.inviteUrl()), room = inv.split('#r=')[1], id = room.split('-')[0];
    check('처음 초대하면 내 집 주소(방 이름·열쇠)가 정해짐', (await H(A)).home && (await H(A)).home.id === id && (await H(A)).home.open === true, (await H(A)).home);

    /* 친구가 온다: 이름이 보이고, 들이면 친구 목록에 남는다 */
    const B = await open(ctx, url('hb', '#r=' + room), false);
    await until(async () => (await mode(B)) === 'door', 15000);
    await T(B, () => window.__door.ring());
    check('문 앞 알림에 친구의 닉네임이 보이고 단추가 화면 안·44px 이상', await until(async () => (await A.isVisible('#knock')) && (await A.textContent('#knock')).includes('민지님이 문 앞에'), 5000) && (await audit(A)).length === 0, [await A.textContent('#knock'), await audit(A)]);
    await A.screenshot({ path: path.join(__dirname, 'out', 'hood-knock.png') });
    check('문 앞에서 기다리는 사람은 방 안 사람 수에 세지 않음', (await T(A, () => window.__duo.count)) === 1 && (await mode(A)) === 'waiting');
    await A.tap('#knock button.main');
    await until(async () => (await mode(B)) === 'on' && (await others(A)) === 1, 15000);
    const fa = (await H(A)).friends;
    check('들어온 친구가 방장의 친구 목록에 이름과 함께 남음', fa.length === 1 && fa[0].name === '민지' && fa[0].tag.length === 20 && !fa[0].auto && !fa[0].ban && fa[0].at > 0, fa);
    const hb = (await H(B)).hoods;
    check('친구 기기에는 이 집이 이웃집으로 남음 (방장의 닉네임, 꾸미기 열쇠)', hb.length === 1 && hb[0].id === id && hb[0].name === '지우' && hb[0].key === room.split('-')[1] && !hb[0].view, hb);

    /* 친구 목록 판 */
    await openDuo(A);
    check('방장의 "같이" 판에 "👥 친구 목록 1" 단추가 보임', (await A.isVisible('#frBtn')) && (await A.textContent('#frBtn')).includes('친구 목록 1') && !(await A.isVisible('#frList')));
    await A.tap('#frBtn'); await sleep(250);
    check('누르면 목록이 펼쳐지고, 지금 방에 있는 친구로 보임 (단추가 화면 안·44px 이상)', (await A.isVisible('#frList')) && (await A.textContent('#frList')).includes('민지') && (await A.textContent('#frList')).includes('지금 방에 있어요') && (await audit(A)).length === 0, [await A.textContent('#frList'), await audit(A)]);
    await A.screenshot({ path: path.join(__dirname, 'out', 'hood-friends.png') });
    check('손님에게는 친구 목록 단추가 없고 이웃집 단추가 있음', await (async () => { await openDuo(B); return !(await B.isVisible('#frBtn')) && (await B.isVisible('#hoodBtn')); })());

    /* 자동 입장 */
    await A.tap('#frList button[data-act="auto"]'); await sleep(300);
    check('"🚪 자동입장"을 켜면 친구에게 알림이 가고 그 기기에 적힘', (await H(A)).friends[0].auto === true && (await A.getAttribute('#frList button[data-act="auto"]', 'aria-pressed')) === 'true'
      && await until(async () => (await H(B)).autoIn === true && (await toast(B)).includes('자동 입장을 허락'), 6000), [await toast(B), (await H(B)).autoIn]);
    await reopen(B);
    check('다음에 오면 초인종 없이 바로 들어옴 (방장에게 문 앞 알림이 뜨지 않음)', await until(async () => (await mode(B)) === 'on' && (await others(A)) === 1, 20000) && (await T(A, () => window.__duo.knocks.length)) === 0 && !(await A.isVisible('#knock')), [await mode(B), await toast(A)]);
    check('새로 고쳐 다시 들어와도 방장 화면에 예전 모습이 남지 않음 (한 명만 보임)', (await others(A)) === 1 && (await T(A, () => window.__duo.count)) === 2 && (await T(A, () => window.__duo.people.length)) === 1, [await others(A), await T(A, () => window.__duo.count)]);

    /* 같은 기기가 다른 창으로 또 오면 예전 연결은 바로 지워진다 */
    const B2 = await open(ctx, url('hb', '#r=' + room), false);
    check('같은 기기가 다른 창으로 들어오면 예전 창은 밀려나고, 방장 화면에는 한 명만 남음', await until(async () => (await mode(B2)) === 'on' && (await mode(B)) === 'denied', 20000) && (await T(B, () => window.__duo.why)) === 'dup' && (await B.textContent('#doorSub')).includes('다른 창')
      && await until(async () => (await others(A)) === 1 && (await T(A, () => window.__duo.count)) === 2, 5000), [await mode(B2), await mode(B), await others(A)]);
    await B.close();

    /* 나가면 바로 사라진다 */
    await T(B2, () => window.__duo.leaveRoom());
    check('친구가 "내 방으로 가기"로 나가면 방장 화면에서 바로(1.5초 안에) 사라짐', await until(async () => (await others(A)) === 0 && (await T(A, () => window.__duo.count)) === 1 && (await mode(A)) === 'waiting', 1500), [await others(A), await mode(A)]);
    await sleep(700); await ready(B2);
    check('나간 친구는 혼자 노는 자기 방으로 가고, 이웃집 목록은 남아 있음', (await mode(B2)) === 'solo' && (await H(B2)).hoods.length === 1 && (await B2.evaluate(() => location.hash)) === '');
    await openDuo(A); // 친구 목록은 펼쳐 둔 채
    check('나간 친구도 방장의 친구 목록에 그대로 보임 (마지막으로 온 날)', (await A.textContent('#frList')).includes('민지') && (await A.textContent('#frList')).includes('마지막으로 온 날'), await A.textContent('#frList'));

    /* 이웃집으로 가기 */
    await openDuo(B2);
    await B2.tap('#hoodBtn'); await sleep(250);
    check('이웃집 목록에 "지우네 집"과 가기 단추가 보임 (화면 안·44px 이상)', (await B2.textContent('#hoodList')).includes('지우네 집') && (await B2.isVisible('#hoodList button[data-act="go"]')) && (await audit(B2)).length === 0, [await B2.textContent('#hoodList'), await audit(B2)]);
    await B2.screenshot({ path: path.join(__dirname, 'out', 'hood-list.png') });
    await B2.tap('#hoodList button[data-act="go"]'); await sleep(900); await ready(B2);
    check('"가기"를 누르면 그 집으로 가고, 자동 입장이라 초인종 없이 들어감', await until(async () => (await mode(B2)) === 'on' && (await others(A)) === 1, 20000) && (await B2.evaluate(() => location.hash)) === '#r=' + room, [await mode(B2), await B2.evaluate(() => location.hash)]);

    /* 자동 입장 끄기, 공동 관리자, 내보내기 */
    await A.tap('#frList button[data-act="auto"]'); await sleep(300);
    check('자동 입장을 끄면 친구에게 알림이 가고', (await H(A)).friends[0].auto === false && await until(async () => (await H(B2)).autoIn === false && (await toast(B2)).includes('꺼졌어요'), 6000), await toast(B2));
    await reopen(B2);
    check('다음에 오면 다시 초인종을 눌러야 함', await until(async () => (await mode(B2)) === 'door', 15000) && !(await T(B2, () => window.__duo.rang)) && (await sleep(1500), (await mode(B2)) === 'door') && (await others(A)) === 0);
    await T(B2, () => window.__door.ring());
    await until(async () => (await A.isVisible('#knock')), 5000);
    await A.tap('#knock button:has-text("늘 들이기")');
    check('문 앞 알림의 "늘 들이기"를 누르면 들어오고 자동 입장이 켜짐', await until(async () => (await mode(B2)) === 'on' && (await others(A)) === 1 && (await H(B2)).autoIn === true, 20000) && (await H(A)).friends[0].auto === true, [(await H(A)).friends, (await H(B2)).autoIn]);
    await A.tap('#frList button[data-act="adm"]'); await sleep(300);
    check('친구 목록에서 "🔑 관리자"를 켜면 그 친구가 공동 관리자가 됨 (문 열어 주기·내보내기 권한)', await until(async () => (await T(B2, () => window.__admin.isMe)) === true, 6000) && (await A.textContent('#frList')).includes('🔑') && (await A.getAttribute('#frList button[data-act="adm"]', 'aria-pressed')) === 'true');
    await A.tap('#frList button[data-act="adm"]'); await sleep(300);
    check('다시 누르면 해제됨', await until(async () => (await T(B2, () => window.__admin.isMe)) === false, 6000));
    await A.tap('#frList button[data-act="kick"]');
    check('친구 목록에서 "내보내기"를 누르면 나가고, 목록에 내보낸 사람으로 남음', await until(async () => (await mode(B2)) === 'denied' && (await others(A)) === 0, 6000) && await until(async () => (await H(A)).friends[0].ban === true && !(await H(A)).friends[0].auto && (await A.textContent('#frList')).includes('내보낸 사람'), 3000), [(await H(A)).friends, await A.textContent('#frList')]);
    await reopen(B2);
    check('내보낸 사람은 다시 와도 들어오지 못함 (자동 입장도 꺼짐)', await until(async () => (await mode(B2)) === 'denied' && (await T(B2, () => window.__duo.why)) === 'ban', 15000), [await mode(B2), await T(B2, () => window.__duo.why)]);
    await A.tap('#frList button[data-act="unban"]'); await sleep(300);
    await reopen(B2);
    check('"다시 받기"를 누르면 다시 올 수 있음 (초인종부터)', (await H(A)).friends[0].ban === false && await until(async () => (await mode(B2)) === 'door', 15000), [(await H(A)).friends, await mode(B2)]);
    await T(B2, () => window.__door.ring());
    await until(async () => (await A.isVisible('#knock')), 5000);
    await A.tap('#knock button.main');
    await until(async () => (await mode(B2)) === 'on' && (await others(A)) === 1, 20000);

    /* 내 집 주소는 그대로: 닫았다가 다시 열어도 같은 주소 */
    await T(A, () => window.__duo.leaveRoom()); await sleep(900); await ready(A);
    check('"혼자 놀기"로 집을 닫아도 꾸민 것과 친구 목록이 남고, 내 집 주소는 그대로', (await mode(A)) === 'solo' && (await T(A, () => window.__tree.S.items.has('a1'))) && (await H(A)).friends.length === 1 && (await H(A)).home.id === id && (await H(A)).home.open === false, (await H(A)).home);
    await openDuo(A);
    check('집을 닫아 둔 동안에도 친구 목록을 볼 수 있음', (await A.isVisible('#frBtn')));
    await T(A, () => window.__duo.invite());
    await until(async () => ['waiting', 'on', 'door'].includes(await mode(A)), 15000);
    check('다시 초대하면 같은 주소로 열림 (친구가 적어 둔 이웃집 주소가 그대로 통함)', (await T(A, () => window.__duo.inviteUrl())) === inv && (await H(A)).home.open === true, [await T(A, () => window.__duo.inviteUrl()), inv, await mode(A)]);

    /* 내 집이 있는 사람이 이웃집에 다녀오기 */
    const C = await open(ctx, url('hc'));
    await T(C, () => { window.__tree.dispatch({ t: 'put', id: 'c1', k: 'sofa', i: 3, j: 6, r: 1 }); });
    await T(C, () => window.__duo.invite());
    await until(async () => (await mode(C)) === 'waiting');
    const invC = await T(C, () => window.__duo.inviteUrl());
    await sleep(500);
    await C.goto(url('hc', '#r=' + room)); await sleep(700); await ready(C);
    await until(async () => (await mode(C)) === 'door', 15000);
    check('내 집을 열어 둔 채 친구 집 링크를 열면 그 집 문 앞으로 감', (await mode(C)) === 'door' && (await T(C, () => window.__duo.mine)) === false);
    await T(C, () => window.__door.ring());
    const hostPage = (await mode(A)) === 'on' || (await mode(A)) === 'waiting' ? A : B2; // 방을 맡고 있는 쪽이 문을 연다
    await until(async () => (await hostPage.isVisible('#knock')), 8000);
    await hostPage.tap('#knock button.main');
    await until(async () => (await mode(C)) === 'on', 20000);
    await openDuo(C);
    await C.tap('#hoodBtn'); await sleep(250);
    check('이웃집 목록 맨 위에 "🏠 내 집", 지금 있는 집에는 "지금 여기 있어요"', (await C.textContent('#hoodList')).includes('내 집') && (await C.textContent('#hoodList')).includes('지금 여기 있어요') && (await audit(C)).length === 0, [await C.textContent('#hoodList'), await audit(C)]);
    await C.tap('#hoodList [data-hood="home"] button'); await sleep(900); await ready(C);
    check('"내 집 · 가기"를 누르면 열어 둔 내 집으로 돌아옴 (꾸민 것 그대로, 같은 주소로 다시 열림)', await until(async () => (await mode(C)) === 'waiting', 15000) && (await T(C, () => window.__duo.mine)) === true && (await T(C, () => window.__tree.S.items.has('c1'))) && (await T(C, () => window.__duo.inviteUrl())) === invC, [await mode(C), await T(C, () => window.__duo.inviteUrl()), invC]);
    await openDuo(C);
    await C.tap('#hoodBtn'); await sleep(250);
    check('내 집에서는 이웃집 목록에 친구 집만 보임', !(await C.textContent('#hoodList')).includes('내 집') && (await C.locator('#hoodList [data-hood]').count()) === 1);
    await C.tap('#hoodList button[data-act="del"]'); await sleep(250);
    check('✕ 를 누르면 이웃집 목록에서 지워짐', (await H(C)).hoods.length === 0 && !(await C.isVisible('#hoodBtn')));
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) { check('검사가 끝까지 돌았음', false, String(e && e.stack || e).slice(0, 500)); }
  finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
