// 협동 놀이 검사: 꼭대기 별 달기(받쳐 주기·올라가기·혼자서는 안 됨·구경하는 사람·떼기·저장), 큰 가구 둘이 들기(기다리기·같이 들기·옮기기·취소·시간 끝·손 놓기·혼자일 때).
// 실행: cd tree/tests && node coop.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8196, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__coop && window.__tree.frames > 3)), 20000);
async function open(ctx, url, bare = true) {
  const p = await ctx.newPage();
  if (bare) await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
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
// 두 상자가 겹치는지
const boxOf = (p, sel) => T(p, (s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; }, sel);
const overlap = (a, b) => !!a && !!b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
// 자리 (x, z) 에 서서 화면이 자리를 잡게 한다
const stand = (p, x, z) => T(p, ([x, z]) => { const t = window.__tree; t.me.stop(); t.me.onArrive = null; t.me.place(x, z); t.snapView(); }, [x, z]);
const C_ = (p) => T(p, () => window.__coop);
const near = (p) => T(p, () => window.__coop.near());
// A 의 화면에서 가구 (x, z) 를 누른다 (화면이 자리를 잡은 다음에)
let A = null;
const tapItem = async (x, z) => { const q = await T(A, ([x, z]) => { window.__tree.snapView(); return window.__tree.screenOf(x, z, 0.35); }, [x, z]); await A.touchscreen.tap(q.x, q.y); };
const act = (p) => until(async () => (await p.isVisible('#act')) && (await p.textContent('#act')), 2000);

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);

    /* ───── 처음: 새 방과 예전 방 모두 별이 없이 시작 ───── */
    const N = await open(ctx, `${BASE}?net=bc&door=0&ns=cn`, false);
    let c = await C_(N);
    check('새 방은 꼭대기 별이 달리지 않은 채로 시작 (흐릿한 별 자리만 보임)', c.star === null && c.slotShown && !c.starShown, c);
    check('별은 트리 꼭대기에 있음', await T(N, () => { const p = window.__coop.starPos(); return Math.abs(p[0]) < 0.01 && Math.abs(p[2]) < 0.01 && p[1] > 2.68; }));
    await T(N, () => localStorage.setItem('nolja-tree-room.cn', JSON.stringify({ v: 2, up: 1, at: 1700000000000, sync: 0, items: [['s1', 'sofa', 10, 12, 0]], orns: [['o1', 'red', 0.3, 1.2, 0.4]], cakes: [], lights: ['warm', 'on'], wall: 'cream', floor: 'oak', notes: [], best: {} })));
    await N.reload(); await ready(N);
    c = await C_(N);
    check('예전에 꾸민 방(별 항목이 없는 저장값)도 그대로 열리고 별은 안 달린 채', c.star === null && c.slotShown && (await T(N, () => window.__tree.S.items.has('s1') && window.__tree.S.orns.size === 1)), c);
    check('저장 모양은 그대로 v 2, 별이 없으면 star 항목도 없음', await T(N, () => { const d = window.__tree.serialize(); return d.v === 2 && !('star' in d); }));
    // 저장된 별은 다시 열어도 그대로
    await T(N, () => window.__tree.dispatch({ t: 'star', on: true, by: 'h', name: '방장', help: '친구1' }, 'load'));
    await T(N, () => localStorage.setItem('nolja-tree-room.cn', JSON.stringify(Object.assign(window.__tree.serialize(), { up: 1 }))));
    await N.reload(); await ready(N);
    c = await C_(N);
    check('달린 별은 저장되고 다시 열어도 달려 있음 (누가 달았는지도)', c.star && c.star.name === '방장' && c.star.help === '친구1' && c.starShown && !c.slotShown, c);
    const bad = await T(N, () => { const S = window.__tree.S, d = (o) => window.__tree.dispatch(o, 'load'); const r = []; for (const o of [{ t: 'star', on: true, name: 'a', help: 'b' }, { t: 'star', on: 'yes' }, { t: 'star' }]) r.push(d(o)); d({ t: 'star', on: false }); for (const o of [{ t: 'star', on: true, name: '', help: 'b' }, { t: 'star', on: true, name: 'a'.repeat(11), help: 'b' }, { t: 'star', on: true, name: 'a', help: 5 }, { t: 'star', on: true, name: 'a\nb', help: 'b' }, { t: 'star', on: true, name: 'a', help: 'b', by: '<x>' }]) r.push(d(o)); r.push(S.star); return r; });
    check('규칙: 이미 달린 별은 또 달 수 없고, 이상한 이름·값은 받지 않음', bad.every((x) => !x), bad);
    await N.close();

    /* ───── 혼자 ───── */
    A = await open(ctx, `${BASE}?net=bc&door=0&ns=ca`);
    await T(A, () => window.__tree.dispatch({ t: 'put', id: 'sf', k: 'sofa', i: 10, j: 13, r: 0 }));
    await stand(A, 1.6, 0.4); await sleep(300);
    check('혼자 트리 옆에 서면 단추는 "🎁 트리 밑 선물"이 먼저이고, 별 달기는 약한 안내로만 남음', ((await act(A)) || '').includes('🎁') && (await T(A, () => { const n = window.__coop.nearAct(); return n && n.weak && n.label; })) === '⭐ 별 달기', await A.textContent('#act'));
    await T(A, () => window.__coop.nearAct().run()); await sleep(150);
    check('혼자서는 눌러도 "손이 닿지 않아요. 친구가 받쳐 주면 달 수 있어요" 알림만 (별은 안 달림)', (await A.textContent('#toast')).includes('손이 닿지 않아요. 친구가 받쳐 주면 달 수 있어요') && (await C_(A)).star === null && !(await C_(A)).propping);
    const actBox = await boxOf(A, '#act');
    check('단추는 44px 이상, 화면 안', actBox && actBox.h >= 44 && (await audit(A)).length === 0, { actBox, bad: await audit(A) });
    await A.screenshot({ path: path.join(__dirname, 'out', 'coop-solo-star.png') });
    await stand(A, 4.5, 0.0); await sleep(300);
    check('트리에서 멀어지면 별 단추가 사라짐', (await near(A)) === null);
    // 혼자일 때 큰 가구는 지금처럼 혼자 옮긴다
    await T(A, () => window.__tree.setMode('furn'));
    await stand(A, 2, 4.4); await sleep(400);
    const sofaAt = () => T(A, () => { window.__tree.snapView(); return window.__tree.screenOf(2, 3, 0.35); });
    let at = await sofaAt();
    await tapItem(2, 3); await sleep(300);
    let g = await T(A, () => window.__tree.ghost);
    check('혼자 있으면 소파를 누르면 바로 들림 (지금 그대로)', g && g.id === 'sf' && !(await C_(A)).job, g);
    await T(A, () => window.__tree.ghostCancel());
    await T(A, () => window.__tree.setMode(null));

    /* ───── 여럿이: 방장 A, 꾸미는 B, 구경하는 C ───── */
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=cb#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=cc#v=${rid}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    const bid = await T(B, () => window.__duo.me), cid = await T(C, () => window.__duo.me);
    check('셋이 같은 방 (C 는 구경)', !(await T(C, () => window.__duo.canEdit)) && (await T(B, () => window.__duo.canEdit)));
    const seenAt = (p, id, x, z) => until(() => T(p, ([id, x, z]) => { const o = window.__duo.others.find((q) => q.id === id); return o && Math.abs(o.x - x) < 0.05 && Math.abs(o.z - z) < 0.05; }, [id, x, z]), 5000);
    await stand(A, 1.6, 0.4); await stand(B, 1.4, 1.2); await stand(C, -2.5, -2.5);
    await seenAt(B, 'h', 1.6, 0.4); await seenAt(A, bid, 1.4, 1.2); await seenAt(C, 'h', 1.6, 0.4); await seenAt(C, bid, 1.4, 1.2);
    await sleep(300);

    /* 꼭대기 별: A 가 받치고 B 가 올라가 단다 */
    check('친구가 있으면 트리 옆에서 "🙌 받쳐 주기"', ((await act(A)) || '').includes('🙌 받쳐 주기'), await A.textContent('#act'));
    await A.tap('#act'); await sleep(200);
    check('받쳐 주기를 누르면 두 손을 모아 받치는 자세 (트리 쪽을 봄)', (await C_(A)).propping && await T(A, () => { const a = window.__coop.arms('me'); return a[0][0] < -0.7 && a[0][1] > 0.3 && a[1][1] < -0.3; }), await T(A, () => window.__coop.arms('me')));
    check('받치는 자세가 친구와 구경하는 사람에게도 보임', await until(async () => (await T(B, () => window.__coop.props().some(([id]) => id === 'h'))) && (await T(C, () => window.__coop.props().some(([id]) => id === 'h'))) && (await T(B, () => window.__coop.arms('h')[0][0] < -0.7)), 3000));
    check('받치는 사람 가까이(1.2m 안)의 친구에게는 "⭐ 올라가서 별 달기"', await until(async () => ((await act(B)) || '').includes('⭐ 올라가서 별 달기'), 3000), await B.textContent('#act'));
    check('받치는 사람은 "🙌 그만 받치기"', ((await act(A)) || '').includes('그만 받치기'));
    await A.screenshot({ path: path.join(__dirname, 'out', 'coop-prop-a.png') });
    await B.screenshot({ path: path.join(__dirname, 'out', 'coop-prop-b.png') });
    // 멀리 있는 구경하는 사람에게는 올라가기 단추가 없다
    check('멀리 있는 사람에게는 올라가기 단추가 없음', (await near(C)) === null);
    await B.tap('#act');
    check('B 가 누르면 받치는 사람 어깨 위로 올라감 (모두의 화면에서)', await until(async () => (await T(B, () => window.__coop.rides.some((r) => r.y > 0.9))) && (await T(A, () => window.__coop.rides.some((r) => r.y > 0.9))), 2500), [await T(B, () => window.__coop.rides), await T(A, () => window.__coop.rides)]);
    check('올라탄 사람은 두 팔을 뻗고, 받치는 사람은 다리를 잡음', await until(() => T(A, (b) => { const up = window.__coop.arms(b), base = window.__coop.arms('me'); return up && up[0][0] < -2.5 && base[0][0] < -2.5; }, bid), 2500));
    await sleep(150);
    await B.screenshot({ path: path.join(__dirname, 'out', 'coop-ride-b.png') });
    await A.screenshot({ path: path.join(__dirname, 'out', 'coop-ride-a.png') });
    check('별이 달리고 모두에게 "○○님이 받치고 △△님이 별을 달았어요! ⭐" 알림', await until(async () => (await C_(A)).star && (await C_(C)).star && (await C_(B)).star && (await C.textContent('#toast')).includes('님이 받치고') && (await C.textContent('#toast')).includes('별을 달았어요! ⭐'), 3000), [await C_(A), await C.textContent('#toast')]);
    const st = await C_(C);
    check('누가 받치고 누가 달았는지 남음', st.star.help === '방장' && st.star.name !== '방장' && st.star.name.startsWith('친구') && st.starShown && !st.slotShown, st.star);
    check('달리는 순간 반짝이가 튐', (await T(A, () => window.__coop.sparks)) > 0 || (await T(C, () => window.__coop.sparks)) > 0);
    await C.screenshot({ path: path.join(__dirname, 'out', 'coop-star-c.png') });
    check('다 단 뒤에는 내려오고 받치던 손도 내림', await until(async () => (await T(B, () => window.__coop.rides.length)) === 0 && !(await C_(A)).propping && (await T(B, () => window.__coop.props().length)) === 0, 4000));
    check('올라간 사람은 원래 자리로 내려옴', await T(B, () => Math.abs(window.__tree.me.root.position.y) < 0.01 && Math.abs(window.__tree.me.x - 1.4) < 0.01));
    check('별이 달리면 트리 옆의 별 단추가 사라짐', (await near(A)) === null && (await near(B)) === null);
    check('방장 기기에 별이 저장됨', await until(() => T(A, (k) => { const d = JSON.parse(localStorage.getItem(k) || 'null'); return d && Array.isArray(d.star) && d.star[1] === '방장'; }, 'nolja-tree-room.ca-' + rid), 2000));
    check('같이 있는 방의 지문(방 비교)은 그대로 맞음', (await T(A, () => window.__duo.hash())) === (await T(B, () => window.__duo.hash())));

    /* 트리 판: 누가 달았는지, 별 떼기 */
    await T(A, () => window.__tree.setMode('tree')); await sleep(500);
    check('트리 판에 누가 달았는지 보이고 "별 떼기" 단추가 있음', (await A.textContent('#starInfo')).includes('방장님이 받치고') && (await A.isVisible('#starOff')) && (await audit(A)).length === 0, [await A.textContent('#starInfo'), await audit(A)]);
    await A.screenshot({ path: path.join(__dirname, 'out', 'coop-tree-panel.png') });
    await A.tap('#starOff');
    check('별 떼기: 모두의 트리에서 별이 떨어지고 별 자리만 남음', await until(async () => (await C_(A)).star === null && (await C_(B)).star === null && (await C_(C)).star === null && (await C_(C)).slotShown, 3000));
    check('뗀 뒤에는 별 줄과 "별 떼기" 단추가 숨음 (트리 판이 예전 높이)', !(await A.isVisible('#starOff')) && !(await A.isVisible('#starRow')));
    await T(A, () => window.__tree.setMode(null)); await sleep(300);

    /* 구경하는 사람도 단다: B 가 받치고 C 가 올라감 */
    await stand(B, 1.4, 1.2); await stand(C, 0.6, 1.9);
    await seenAt(C, bid, 1.4, 1.2); await seenAt(B, cid, 0.6, 1.9); await seenAt(A, cid, 0.6, 1.9);
    await sleep(300);
    await T(B, () => window.__coop.startProp());
    check('구경하는 사람에게도 "⭐ 올라가서 별 달기"', await until(async () => ((await act(C)) || '').includes('올라가서 별 달기'), 3000), await near(C));
    await C.tap('#act');
    check('구경하는 사람이 올라가 단 별도 방장이 받아서 모두에게 달림', await until(async () => { const a = (await C_(A)).star, b = (await C_(B)).star, cc = (await C_(C)).star; return a && b && cc && a.help === b.help && a.name === cc.name; }, 5000), [await C_(A), await C_(C)]);
    await until(async () => (await T(C, () => window.__coop.rides.length)) === 0 && !(await C_(B)).propping, 4000);
    await T(A, () => window.__tree.dispatch({ t: 'star', on: false }));
    await until(async () => (await C_(C)).star === null, 2000);

    /* 움직이면 받치기가 풀린다 */
    await T(A, () => window.__coop.startProp());
    await until(() => T(B, () => window.__coop.props().some(([id]) => id === 'h')), 2000);
    await T(A, () => window.__tree.goTo(3.5, 0.5));
    check('받치다 걸으면 풀리고 친구 화면에서도 풀림', await until(async () => !(await C_(A)).propping && !(await T(B, () => window.__coop.props().some(([id]) => id === 'h'))), 3000));
    check('이상한 협동 소식이 와도 버팀', await T(B, () => { for (const m of [{ t: 'fx', id: 'h', k: 'prop', v: 'x'.repeat(30) }, { t: 'fx', id: 'h', k: 'climb', v: 'nobody' }, { t: 'fx', id: 'zz', k: 'prop', v: 'a' }, { t: 'fx', id: 'h', k: 'heavy', v: 'nope' }, { t: 'fx', id: 'h', k: 'help', v: '<x>' }, { t: 'fx', id: 'h', k: 'prop', v: 5 }]) window.__duo.feed(m); return window.__coop.props().length === 0 && window.__coop.rides.length === 0 && window.__coop.waits().length === 0; }));

    /* ───── 큰 가구 둘이 들기 ───── */
    await stand(A, 2, 4.4); await stand(B, 3.9, 3.0); await stand(C, 2, 5.0);
    await seenAt(B, 'h', 2, 4.4); await seenAt(A, bid, 3.9, 3.0);
    await T(A, () => window.__tree.setMode('furn')); await sleep(400);
    at = await sofaAt();
    await tapItem(2, 3); await sleep(300);
    c = await C_(A);
    check('친구가 있으면 소파를 눌러도 바로 들리지 않고 기다림', c.job && c.job.role === 'wait' && c.job.id === 'sf' && !(await T(A, () => window.__tree.ghost)), c.job);
    check('"소파는 둘이 들어야 해요. 친구가 반대쪽에서 \'🤝 같이 들기\'를 눌러 주세요" 알림', (await A.textContent('#toast')).includes('소파는 둘이 들어야 해요. 친구가 반대쪽에서'), await A.textContent('#toast'));
    check('A 는 소파 한쪽 끝으로 가서 드는 자세', await until(async () => (await C_(A)).job.phase === 'wait' && await T(A, () => { const a = window.__coop.arms('me'); return a[0][0] < -0.5 && a[0][0] > -0.8; }), 4000), await C_(A));
    check('기다리는 동안 띠(남은 시간, 치우기, 취소)가 보이고 단추는 44px 이상·화면 안', (await A.isVisible('#coopWait')) && (await A.textContent('#coopWait')).includes('초') && (await audit(A)).length === 0 && !overlap(await boxOf(A, '#coopWait'), await boxOf(A, '#furn')), await audit(A));
    await A.screenshot({ path: path.join(__dirname, 'out', 'coop-heavy-wait.png') });
    check('친구 화면에도 A 가 소파를 들고 기다리는 것이 보임', await until(() => T(B, () => window.__coop.waits().some(([id, it]) => id === 'h' && it === 'sf')), 2000));
    check('가까이 있는 친구에게 "🤝 같이 들기"', await until(async () => ((await act(B)) || '').includes('🤝 같이 들기'), 2000), await near(B));
    check('멀리 있는 사람에게는 없음', (await near(C)) !== '🤝 같이 들기', await near(C));
    await B.tap('#act');
    check('B 가 반대쪽 끝에 서서 들면 A 에게 옮기기 화면이 열림', await until(async () => { const g = await T(A, () => window.__tree.ghost); return g && g.id === 'sf' && (await C_(B)).job && (await C_(B)).job.phase === 'hold'; }, 6000), [await T(A, () => window.__tree.ghost), await C_(B)]);
    const ends = await T(A, (b) => { const me = window.__tree.me, o = window.__duo.others.find((q) => q.id === b); return [me.x, me.z, o.x, o.z]; }, bid);
    check('두 사람이 소파의 양쪽 끝에 섬', (ends[0] < 1.05 && ends[2] > 2.95) || (ends[2] < 1.05 && ends[0] > 2.95), ends);
    check('B 도 드는 자세 (A 화면에서도)', await T(A, (b) => { const a = window.__coop.arms(b); return a && a[0][0] < -0.5 && a[0][0] > -0.8; }, bid));
    check('A 의 가구 판은 평소의 옮기기 화면', (await A.isVisible('#furnBar')) && (await A.isVisible('#gDone')) && !(await A.isVisible('#coopWait')));
    await A.screenshot({ path: path.join(__dirname, 'out', 'coop-heavy-place.png') });
    await T(A, () => { if (window.__tree.ghost) window.__tree.ghostMoveTo(4, 1.5); });
    check('새 자리가 놓을 수 있는 자리', ((await T(A, () => window.__tree.ghost)) || {}).ok);
    await A.tap('#gDone');
    check('놓으면 두 사람이 소파를 들고 옮기는 몸짓이 모두에게 보임', await until(async () => (await T(A, () => window.__coop.carrying)) > 0 && (await T(B, () => window.__coop.carrying)) > 0 && (await T(C, () => window.__coop.carrying)) > 0, 1500));
    await sleep(500);
    await C.screenshot({ path: path.join(__dirname, 'out', 'coop-heavy-carry-c.png') });
    check('다 옮기면 소파가 새 자리에 있고 모두 손을 놓음', await until(async () => {
      for (const p of [A, B, C]) { const s = await T(p, () => { const it = window.__tree.S.items.get('sf'); return [it.i, it.j, window.__coop.carrying, window.__coop.job, window.__coop.waits().length, window.__coop.helps().length]; }); if (s[0] !== 14 || s[1] !== 10 || s[2] || s[3] || s[4] || s[5]) return false; }
      return true;
    }, 4000), await T(C, () => [window.__tree.S.items.get('sf'), window.__coop.carrying, window.__coop.waits(), window.__coop.helps()]));
    check('두 사람이 새 자리의 양쪽 끝에 섬', await until(() => T(A, (b) => { const me = window.__tree.me, o = window.__duo.others.find((q) => q.id === b); return Math.abs(me.z - 1.5) < 0.4 && Math.abs(o.z - 1.5) < 0.4 && Math.abs(me.x - o.x) > 2 && !o.moving; }, bid), 3000), await T(A, (b) => [window.__tree.me.x, window.__tree.me.z, window.__duo.others.find((q) => q.id === b)], bid));

    // 취소
    await stand(A, 4, 3.0); await sleep(300);
    at = await T(A, () => { window.__tree.snapView(); return window.__tree.screenOf(4, 1.5, 0.35); });
    await tapItem(4, 1.5); await sleep(300);
    check('다시 누르면 다시 기다림', ((await C_(A)).job || {}).role === 'wait');
    await until(() => T(B, () => window.__coop.waits().length === 1), 2000);
    await A.tap('#coopStop');
    check('"취소"를 누르면 그만두고 친구 화면에서도 사라짐', !(await C_(A)).job && !(await A.isVisible('#coopWait')) && await until(() => T(B, () => window.__coop.waits().length === 0), 2000));
    // 시간이 지나면 그만둔다
    await tapItem(4, 1.5); await sleep(300);
    await T(A, () => { const t0 = Date.now(); window.__now = () => Date.now() + 21000 + (Date.now() - t0) * 0; });
    check('20초가 지나도 아무도 안 오면 그만둠', await until(async () => !(await C_(A)).job && (await A.textContent('#toast')).includes('오지 않았어요'), 2000), await A.textContent('#toast'));
    await T(A, () => { delete window.__now; });
    // 치우기는 그대로 혼자 한다
    await tapItem(4, 1.5); await sleep(300);
    await A.tap('#coopDel');
    check('기다리는 띠의 "치우기"로 혼자 치울 수 있음', await until(async () => !(await T(A, () => window.__tree.S.items.has('sf'))) && !(await T(B, () => window.__tree.S.items.has('sf'))), 2000));
    await T(A, () => window.__tree.dispatch({ t: 'put', id: 'sf2', k: 'sofa', i: 10, j: 13, r: 0 }));
    await until(() => T(B, () => window.__tree.S.items.has('sf2')), 2000);
    // B 가 손을 놓으면 A 의 옮기기도 내려놓는다
    await stand(A, 2, 4.4); await stand(B, 3.9, 3.0);
    await seenAt(B, 'h', 2, 4.4); await seenAt(A, bid, 3.9, 3.0);
    at = await sofaAt();
    await tapItem(2, 3);
    await until(() => T(B, () => window.__coop.waits().length === 1), 2000);
    await until(async () => (await near(B)) === '🤝 같이 들기', 3000);
    await T(B, () => window.__coop.help('h'));
    await until(async () => { const g = await T(A, () => window.__tree.ghost); return g && g.id === 'sf2'; }, 6000);
    check('같이 드는 사람에게는 "🤝 손 놓기"', (await near(B)) === '🤝 손 놓기');
    await T(B, () => window.__tree.goTo(5, 5));
    check('B 가 걸어가면 손을 놓고, A 의 옮기기 화면도 닫히며 소파는 제자리', await until(async () => !(await T(A, () => window.__tree.ghost)) && !(await C_(A)).job && !(await C_(B)).job && (await A.textContent('#toast')).includes('손을 놓'), 3000), [await T(A, () => window.__tree.ghost), await A.textContent('#toast')]);
    check('소파는 그대로', await T(A, () => { const it = window.__tree.S.items.get('sf2'); return it.i === 10 && it.j === 13; }));
    // 구경하는 사람도 같이 든다, 친구가 나가면 그만둔다
    await stand(A, 2, 4.4); await stand(C, 3.9, 3.0);
    await seenAt(C, 'h', 2, 4.4); await seenAt(A, cid, 3.9, 3.0);
    await tapItem(2, 3);
    await until(() => T(C, () => window.__coop.waits().length === 1), 2000);
    check('구경하는 사람에게도 "🤝 같이 들기"', await until(async () => (await near(C)) === '🤝 같이 들기', 3000), await near(C));
    await T(C, () => window.__coop.help('h'));
    check('구경하는 사람이 들어도 A 에게 옮기기 화면이 열림', await until(async () => { const g = await T(A, () => window.__tree.ghost); return g && g.id === 'sf2'; }, 6000));
    await C.close();
    check('같이 들던 사람이 나가면 내려놓음', await until(async () => !(await T(A, () => window.__tree.ghost)) && !(await C_(A)).job, 8000), await T(A, () => window.__tree.ghost));
    // 침대도 큰 가구
    check('침대도 큰 가구, 다른 가구는 아님', await T(A, async () => { const m = await import('./catalog.js'); const h = m.FURNITURE.filter((f) => f.heavy).map((f) => f.id).sort().join(); return h === 'bed,sofa'; }));
    await B.close();
    await until(async () => (await T(A, () => window.__duo.others)).length === 0, 8000);
    await stand(A, 2, 4.4); await sleep(300);
    await tapItem(2, 3); await sleep(300);
    g = await T(A, () => window.__tree.ghost);
    check('다시 혼자가 되면 혼자 옮김', g && g.id === 'sf2' && !(await C_(A)).job, g);
    await T(A, () => window.__tree.ghostCancel());
    check('화면의 단추가 모두 44px 이상·화면 안', (await audit(A)).length === 0, await audit(A));
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
