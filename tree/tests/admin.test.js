// 공동 관리자 검사: 방장의 지정·해제 · 🔑 표시 · 초인종 없이 들어오기 · 문 열어 주기·돌려보내기·내보내기 · 꾸미기·영화관·불 · 흉내 내기 막기 · 구경 온 사람 지정 · 방장이 없을 때 · 저장
// 실행: cd tree/tests && node admin.test.js   (화면 사진은 out/admin-*.png)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8203, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__door && window.__admin && window.__tree.frames > 3)), 20000);
async function open(ctx, url, look = true) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; });
  // 시계: 12월 10일 낮 (크리스마스가 아닌 날의 불꽃놀이를 보려고)
  await p.addInitScript(() => { window.__clk = { base: new Date(2026, 11, 10, 13, 0, 0).getTime(), t0: performance.now() }; window.__now = () => window.__clk.base + (performance.now() - window.__clk.t0); });
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (look && await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const mode = (p) => T(p, () => window.__duo.mode);
const hash = (p) => T(p, () => window.__duo.hash());
const adm = (p) => T(p, () => ({ me: window.__admin.isMe, owner: window.__admin.isOwner, can: window.__admin.canManage, pass: window.__admin.hasPass, list: window.__admin.list, here: window.__admin.here, tag: window.__admin.tag }));
// 문 앞에서 초인종을 누르고, 방장(P)이 들여 준다
async function ringIn(G, P) {
  const t0 = Date.now();
  while (Date.now() - t0 < 40000) {
    const m = await mode(G);
    if (m === 'on') break;
    if (m === 'door' && !(await T(G, () => window.__duo.rang))) { await sleep(400); await T(G, () => window.__door.ring()); }
    const k = await T(P, () => window.__duo.knocks);
    if (k.length) await T(P, (id) => window.__duo.admit(id), k[0].id);
    await sleep(200);
  }
  if (await G.isVisible('#lookDone')) await G.click('#lookDone');
}
const audit = (p) => p.evaluate(() => {
  const bad = [];
  for (const b of document.querySelectorAll('button, a')) {
    const r = b.getBoundingClientRect();
    if (!r.width || b.closest('[hidden]') || getComputedStyle(b).display === 'none') continue;
    const name = (b.textContent || b.getAttribute('aria-label') || '').trim();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (!b.closest('.scroll') && (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5)) bad.push(`${name}: 화면 밖`);
  }
  // 한 줄의 단추끼리 겹치지 않는지
  const bs = [...document.querySelectorAll('#duoPeople button, #knock button')].filter((b) => !b.closest('[hidden]')).map((b) => [b.textContent, b.getBoundingClientRect()]);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i][1], c = bs[j][1]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) bad.push(`${bs[i][0]} 과 ${bs[j][0]} 가 겹침`); }
  return bad;
});

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const url = (ns, h) => `${BASE}?net=bc&ns=${ns}&st=6000&rt=500${h || ''}`;
    const A = await open(ctx, url('aa'));
    await T(A, () => window.__tree.dispatch({ t: 'put', id: 'a1', k: 'sofa', i: 1, j: 6, r: 1 }));
    await T(A, () => window.__duo.invite());
    await until(async () => (await mode(A)) === 'waiting');
    const inv = await T(A, () => window.__duo.inviteUrl()), room = inv.split('#r=')[1], id = room.split('-')[0];
    const a0 = await adm(A);
    check('방을 만든 사람은 방장: 지정할 수 있고, 공동 관리자 표는 비어 있음', a0.owner && a0.can && !a0.me && a0.list.length === 0, a0);

    /* 지정 */
    const B = await open(ctx, url('ab', '#r=' + room), false);
    await ringIn(B, A);
    const b0 = await adm(B);
    check('처음 온 친구는 초인종을 눌러야 했고, 보통 손님(공동 관리자 아님)', (await mode(B)) === 'on' && !b0.me && !b0.owner && !b0.can && !b0.pass, b0);
    await A.tap('#tabs button[data-m="duo"]'); await sleep(300);
    check('방장의 같이 판, 사람 줄에 "내보내기"와 "🔑 지정" 단추가 있음 (겹치지 않고 화면 안·44px 이상)', (await A.locator('#duoPeople button').allTextContents()).join('|') === '내보내기|🔑 지정' && (await audit(A)).length === 0, [await A.locator('#duoPeople button').allTextContents(), await audit(A)]);
    await B.tap('#tabs button[data-m="duo"]'); await sleep(200);
    check('손님에게는 지정·내보내기 단추가 없음', (await B.locator('#duoPeople button').count()) === 0);
    await A.tap('#duoPeople button[data-adm]');
    check('방장이 "🔑 지정"을 누르면 그 친구가 공동 관리자가 됨 (모두의 방 상태에 표가 하나)', await until(async () => (await adm(B)).me, 5000) && (await adm(A)).list.length === 1 && (await adm(B)).list.join() === (await adm(A)).list.join() && (await adm(A)).list[0] === (await adm(B)).tag, [await adm(A), await adm(B)]);
    check('지정된 사람에게 알림이 뜨고, 위 표시에 🔑', (await B.textContent('#toast')).includes('공동 관리자로 지정') && (await B.textContent('#net')).includes('🔑') && (await B.textContent('#duoSub')).includes('공동 관리자'), await B.textContent('#net'));
    check('방장의 목록에 🔑 표시와 "🔑 해제" 단추', await until(async () => (await A.textContent('#duoPeople .hint')).includes('🔑'), 4000) && (await A.locator('#duoPeople button').allTextContents()).join('|') === '내보내기|🔑 해제' && (await audit(A)).length === 0, await A.textContent('#duoPeople'));
    await A.screenshot({ path: path.join(__dirname, 'out', 'admin-people.png') });
    const leak = await T(A, () => { const txt = JSON.stringify(window.__tree.serialize()), k = Object.keys(localStorage).find((x) => x.startsWith('nolja-tree-sec.ab')); const sec = JSON.parse(localStorage.getItem(k)); return { hasTag: txt.includes(window.__admin.list[0]), sec: txt.includes(sec), n: window.__admin.list[0].length }; });
    const tkB = await T(B, () => window.__admin.tk);
    check('방 상태에는 표(지문)만 있고 비밀값·비밀표는 없음', leak.hasTag && !leak.sec && leak.n === 20 && !(await T(A, (tk) => JSON.stringify(window.__tree.serialize()).includes(tk), tkB)) && (await T(A, (tk) => window.__admin.tagOf(tk), tkB)) === (await adm(B)).tag, leak);
    check('두 사람의 방 지문이 같음', await until(async () => (await hash(A)) === (await hash(B)), 5000));

    /* 초인종 없이 들어오기 */
    await B.reload(); await ready(B);
    check('공동 관리자는 다시 올 때 초인종 없이 바로 들어옴 (방장이 누르지 않아도)', await until(async () => (await mode(B)) === 'on', 15000) && (await T(A, () => window.__duo.knocks.length)) === 0 && !(await A.isVisible('#knock')) && (await adm(B)).me);
    check('방장에게 "공동 관리자가 들어와요" 알림', await until(async () => (await T(A, () => window.__duo.others.length)) === 1, 5000) && (await adm(A)).here.length === 1);

    /* 방장에 가까운 권한: 문 열어 주기, 돌려보내기, 내보내기 */
    const C = await open(ctx, url('ac', '#v=' + id), false);
    await until(async () => (await mode(C)) === 'door', 15000); await sleep(500);
    await T(C, () => window.__door.ring());
    check('문 앞에 누가 오면 공동 관리자에게도 "들어오게 하기 / 돌려보내기"가 뜸', await until(async () => (await T(B, () => window.__duo.knocks.length)) === 1 && (await B.isVisible('#knock')), 6000) && (await B.textContent('#knock')).includes('구경하러 온') && (await B.locator('#knock button').count()) === 2 && (await audit(B)).length === 0, await audit(B));
    await B.tap('#knock button.main');
    check('공동 관리자가 "들어오게 하기"를 누르면 들어옴', await until(async () => (await mode(C)) === 'on', 12000) && await until(async () => (await T(A, () => window.__duo.knocks.length)) === 0 && (await T(B, () => window.__duo.knocks.length)) === 0, 5000));
    if (await C.isVisible('#lookDone')) await C.click('#lookDone');
    await B.tap('#tabs button[data-m="duo"]'); await sleep(400);
    const rowsB = await T(B, () => [...document.querySelectorAll('#duoPeople .row')].map((r) => [r.querySelector('.hint').textContent, [...r.querySelectorAll('button')].map((b) => b.textContent).join('|')]));
    check('공동 관리자의 목록: 방장은 내보낼 수 없고, 다른 손님에게만 "내보내기"(지정 단추는 없음)', rowsB.length === 2 && rowsB.some(([h, b]) => h.startsWith('방장') && b === '') && rowsB.some(([h, b]) => !h.startsWith('방장') && b === '내보내기') && (await audit(B)).length === 0, rowsB);
    check('보통 손님(구경)에게는 문 알림도 단추도 없음', (await T(C, () => window.__duo.knocks.length)) === 0 && !(await adm(C)).can);
    await B.tap('#duoPeople button');
    check('공동 관리자가 내보내면 그 사람은 방에서 나감', await until(async () => (await mode(C)) === 'denied', 6000) && (await T(C, () => window.__duo.why)) === 'kick' && await until(async () => (await T(A, () => window.__duo.others.length)) === 1, 6000));
    await C.close();
    const D = await open(ctx, url('ad', '#r=' + room), false);
    await until(async () => (await mode(D)) === 'door', 15000); await sleep(500);
    await T(D, () => window.__door.ring());
    await until(async () => (await T(B, () => window.__duo.knocks.length)) === 1, 6000);
    await T(B, () => window.__duo.deny(window.__duo.knocks[0].id));
    check('공동 관리자가 돌려보낼 수도 있음', await until(async () => (await mode(D)) === 'denied', 6000) && (await T(D, () => window.__duo.why)) === 'no');
    await D.close();

    /* 꾸미기·영화관·불·불꽃놀이 */
    check('영화관으로 한 번에 바꾸는 단추는 마스터키 전용: 공동 관리자에게도 보이지 않고 직접 불러도 바뀌지 않음', !(await B.isVisible('#cineBtn')) && !(await B.isVisible('#tabs button[data-m="master"]')) && (await adm(B)).can && (await T(B, () => window.__cinema.convert())) === -1 && !(await T(A, () => window.__cinema.has)));
    await T(B, () => window.__tree.dispatch({ t: 'put', id: 'admscr', k: 'screen', i: 64 + 0, j: 5, r: 1 }));
    check('공동 관리자가 영화관 소품(스크린)을 직접 놓으면 방장의 방에도 놓임', await until(async () => (await T(A, () => window.__cinema.has)) && (await hash(A)) === (await hash(B)), 8000));
    await T(B, () => window.__tree.setMode(null));
    check('공동 관리자가 불을 끄면 모두에게 꺼짐', (await T(B, () => window.__lights.toggle(2))) && await until(async () => (await T(A, () => window.__lights.lamps.join())) === '1,1,0', 4000));
    check('불꽃놀이는 마스터키를 켠 사람만: 공동 관리자도 못 터뜨림', !(await T(B, () => window.__sky.press())), await T(B, () => document.getElementById('toast').textContent));

    /* 흉내 내기 막기 */
    const E = await ctx.newPage();
    await E.addInitScript((r) => { window.__bare = true; localStorage.setItem('nolja-tree-pass.ae', JSON.stringify([r])); }, id); // 초인종 없이 들어갈 수 있다고 스스로 적어 둔 기기
    E.on('pageerror', (e) => { errors.push(e.message); });
    await E.goto(url('ae', '#r=' + room)); await ready(E);
    await sleep(2500);
    check('지정받지 않은 기기가 스스로 들어오려 해도 들어오지 못하고 초인종 앞에 섬 (방장에게 알림도 안 감)', (await mode(E)) === 'door' && !(await T(E, () => window.__duo.rang)) && (await T(A, () => window.__duo.knocks.length)) === 0 && (await T(A, () => window.__duo.others.length)) === 1 && !(await adm(E)).pass, [await mode(E), await adm(E)]);
    await ringIn(E, A);
    const tagB = (await adm(B)).tag;
    await T(E, (tag) => { window.__duo.rawOp({ t: 'adm', tag: window.__admin.tag, on: true }); window.__duo.rawOp({ t: 'adm', tag, on: false }); }, tagB);
    await sleep(900);
    check('손님이 공동 관리자 지정·해제를 억지로 보내도 방장이 받지 않음', (await adm(A)).list.join() === tagB && (await adm(B)).me && !(await adm(E)).me && (await adm(E)).list.join() === tagB, [await adm(A), await adm(E)]);
    await T(E, () => window.__duo.admit('g1')); await T(E, () => window.__duo.kick(window.__duo.others.find((o) => o.id !== 'h').id)); await sleep(900);
    check('보통 손님이 내보내기를 억지로 보내도 아무 일 없음', (await mode(B)) === 'on' && (await T(A, () => window.__duo.others.length)) === 2);
    await T(E, () => window.__tree.setMode(null));
    check('보통 손님은 크리스마스가 아닌 날에 불꽃놀이를 못 함', !(await T(E, () => { window.__sky.refresh(); return window.__sky.press(); })));

    /* 구경으로 온 사람을 지정 */
    const F = await open(ctx, url('af', '#v=' + id), false);
    await ringIn(F, A);
    check('구경으로 온 친구는 꾸밀 수 없음', !(await T(F, () => window.__duo.canEdit)));
    const fid = await T(A, () => window.__duo.people.find((p) => !p.edit).id);
    check('방장이 구경 온 친구를 지정함', await T(A, (pid) => window.__admin.grant(pid), fid) && await until(async () => (await adm(F)).me, 5000));
    check('지정된 친구는 꾸밀 수 있게 되고(탭이 생김), 주소가 꾸미기 링크로 바뀌어 다음부터 열쇠를 갖고 들어옴', await until(() => T(F, () => window.__duo.canEdit), 5000) && (await F.isVisible('#tabs button[data-m="furn"]')) && (await T(F, () => location.hash)) === '#r=' + room && (await T(A, () => window.__admin.list.length)) === 2);
    check('공동 관리자가 놓은 가구가 방장의 방에 놓임', await T(F, () => window.__tree.dispatch({ t: 'put', id: 'f1', k: 'plant', i: 12, j: 12, r: 0 })) && await until(async () => (await T(A, () => window.__tree.serialize().items.some((it) => it[0] === 'f1'))), 4000));

    /* 해제 */
    await A.tap('#tabs button[data-m="duo"]'); await sleep(200); await A.tap('#tabs button[data-m="duo"]'); await sleep(300);
    if (!(await A.isVisible('#duoPeople'))) { await A.tap('#tabs button[data-m="duo"]'); await sleep(300); }
    const bid = await T(A, () => window.__admin.here[0]);
    check('사람이 셋일 때도 목록의 단추가 겹치지 않고 화면 안·44px 이상', (await A.locator('#duoPeople .row').count()) === 3 && (await audit(A)).length === 0, await audit(A));
    await A.screenshot({ path: path.join(__dirname, 'out', 'admin-three.png') });
    await A.tap(`#duoPeople button[data-adm][data-pid="${bid}"]`);
    check('방장이 "🔑 해제"를 누르면 공동 관리자가 아니게 됨(알림)', await until(async () => !(await adm(B)).me && (await B.textContent('#toast')).includes('해제'), 5000) && (await adm(A)).list.length === 1 && !(await adm(B)).can && !(await adm(B)).pass, await adm(B));
    check('해제된 사람은 문 알림을 더 받지 않음', (await T(B, () => window.__duo.canEdit)));
    await B.reload(); await ready(B);
    await sleep(2500);
    check('해제된 사람은 다시 올 때 초인종을 눌러야 함', (await mode(B)) === 'door' && (await T(A, () => window.__duo.knocks.length)) === 0);
    await ringIn(B, A);

    /* 지금 없는 공동 관리자, 저장 */
    await F.close();
    await until(async () => (await T(A, () => window.__duo.others.length)) === 2, 12000);
    check('지금 없는 공동 관리자가 방장의 목록에 줄로 나옴', await until(async () => (await A.textContent('#duoPeople')).includes('지금 없는 공동 관리자 1명'), 5000) && (await audit(A)).length === 0, await A.textContent('#duoPeople'));
    await sleep(600);
    const disk = await T(A, (r) => JSON.parse(localStorage.getItem('nolja-tree-room.aa-' + r)), id);
    check('공동 관리자 표는 방과 같이 저장됨', disk && Array.isArray(disk.adm) && disk.adm.length === 1, disk && disk.adm);
    await A.tap('#duoPeople button[data-pid="absent"]');
    check('"모두 해제"를 누르면 표가 비고, 손님들에게도 전해짐', await until(async () => (await adm(A)).list.length === 0 && (await adm(B)).list.length === 0, 5000));

    /* 방장이 없을 때: 공동 관리자가 방을 대신 맡으면 다른 공동 관리자를 초인종 없이 들인다 */
    await T(A, (pid) => window.__admin.grant(pid), await T(A, () => window.__duo.people.find((p) => window.__duo.others.some((o) => o.id === p.id)).id));
    const both = await T(A, () => window.__duo.people.map((p) => p.id));
    for (const pid of both) await T(A, (x) => window.__admin.grant(x), pid);
    check('두 손님(B, E)을 모두 지정함', await until(async () => (await adm(B)).me && (await adm(E)).me && (await adm(A)).list.length === 2, 6000), await adm(A));
    await sleep(800);
    await A.close(); await E.close();
    check('방장이 나가면 공동 관리자(B)가 방을 대신 맡음', await until(async () => (await T(B, () => window.__duo.role)) === 'host' && (await mode(B)) === 'waiting', 30000), [await mode(B), await T(B, () => window.__duo.role)]);
    const b2 = await adm(B);
    check('대신 맡은 사람은 방장처럼 관리할 수 있지만 지정·해제는 못 함(방을 만든 방장만)', b2.can && !b2.owner && b2.list.length === 2, b2);
    const E2 = await open(ctx, url('ae', '#r=' + room), false);
    check('방장이 없어도 다른 공동 관리자(E)는 초인종 없이 들어옴', await until(async () => (await mode(E2)) === 'on', 20000) && (await T(B, () => window.__duo.others.length)) === 1 && (await adm(E2)).me, [await mode(E2), await adm(E2)]);
    await B.tap('#tabs button[data-m="duo"]'); await sleep(400);
    if (!(await B.isVisible('#duoPeople'))) { await B.tap('#tabs button[data-m="duo"]'); await sleep(300); }
    check('대신 맡은 사람의 목록에는 "내보내기"만 있고 지정 단추는 없음', (await B.locator('#duoPeople button').allTextContents()).join('|') === '내보내기' && (await B.textContent('#duoPeople .hint')).includes('🔑'), await B.textContent('#duoPeople'));
    await ctx.close();
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
