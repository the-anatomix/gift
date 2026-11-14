// 둘이 같이 꾸미기 검사. 실행법은 README.md 참고.
//   node duo.test.js          같은 브라우저 안 통신(BroadcastChannel)으로 방 만들기·들어가기·맞추기·끊김 검사
//   node duo.test.js --peer   위에 더해, 로컬 PeerJS 브로커(npm i 필요)로 실제 WebRTC 데이터 채널 검사
// 한 브라우저 안의 두 사람은 저장소를 같이 쓰므로 주소에 ?ns=a, ?ns=b 를 붙여 저장 이름을 가른다.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8163, BROKER_PORT = 9163, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const args = process.argv.slice(2);
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(80); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url);
  await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const mode = (p) => T(p, () => window.__duo.mode);
const role = (p) => T(p, () => window.__duo.role);
const hash = (p) => T(p, () => window.__duo.hash());
const other = (p) => T(p, () => window.__duo.other);
const me = (p) => T(p, () => ({ x: window.__tree.me.x, z: window.__tree.me.z }));
const counts = (p) => T(p, () => ({ items: window.__tree.S.items.size, orns: window.__tree.S.orns.size, objs: window.__tree.itemObjs, ornObjs: window.__tree.ornObjs }));
const put = (p, id, k, i, j, r = 0) => T(p, (o) => window.__tree.dispatch({ t: 'put', ...o }), { id, k, i, j, r });
const same = (A, B) => until(async () => (await hash(A)) === (await hash(B)), 6000);
const on = (A, B) => until(async () => (await mode(A)) === 'on' && (await mode(B)) === 'on', 15000);
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

async function suite(browser, label, query, twoContexts) {
  console.log(`\n── 둘이 같이 꾸미기 (${label}) ──`);
  const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
  const ctxA = await browser.newContext(vp), ctxB = twoContexts ? await browser.newContext(vp) : ctxA;
  const url = (ns, room) => `${BASE}?${query}&door=0&ns=${ns}&st=3000&rt=500&cap=4&ecap=3${room ? '#r=' + room : ''}`; // 검사에서는 정원 4명, 꾸미는 사람 3명

  /* 방 만들기 */
  const A = await open(ctxA, url('a'));
  await put(A, 'a1', 'sofa', 1, 6, 1); await put(A, 'a2', 'lamp', 0, 15);
  await T(A, () => window.__tree.dispatch({ t: 'orn', id: 'ao1', k: 'red', x: 0.3, y: 1.2, z: 0.4 }));
  check('혼자일 때는 연결 표시가 없음', (await mode(A)) === 'solo' && !(await A.isVisible('#net')));
  await A.tap('#tabs button[data-m="duo"]'); await sleep(200);
  check('같이 탭: 친구 초대하기 단추가 보이고 44px 이상', (await A.isVisible('#duoInvite')) && (await A.textContent('#duoInvite')) === '같이 꾸밀 친구 초대' && (await A.isVisible('#duoInviteV')) && !(await A.isVisible('#duoLeave')) && (await audit(A)).length === 0, await audit(A));
  await A.tap('#duoInvite');
  check('친구 초대하기를 누르면 방이 만들어지고 주인으로 기다림', await until(async () => (await mode(A)) === 'waiting') && (await role(A)) === 'host', await mode(A));
  const id = await T(A, () => window.__duo.room), inv = await T(A, () => window.__duo.inviteUrl()), vinv = await T(A, () => window.__duo.inviteUrl(false));
  const room = inv.split('#r=')[1]; // 방이름-열쇠
  check('같이 꾸미기 링크는 #r=방이름(10자)-열쇠(6자), 검사용 옵션은 붙지 않음', /^[a-z0-9]{10}$/.test(id) && new RegExp(`^${id}-[a-z0-9]{6}$`).test(room) && inv === `${BASE}#r=${room}` && (await A.evaluate(() => location.hash)) === '#r=' + room, inv);
  check('구경 링크는 #v=방이름 (열쇠가 없다)', vinv === `${BASE}#v=${id}`, vinv);
  check('위에 "친구 기다리는 중" 표시, 단추는 초대 두 가지 · 혼자 놀기', (await A.textContent('#net')) === '친구 기다리는 중' && (await A.isVisible('#duoInvite')) && (await A.isVisible('#duoInviteV')) && (await A.textContent('#duoLeave')) === '혼자 놀기' && (await audit(A)).length === 0, await audit(A));
  check('방을 만들어도 꾸민 것은 그대로', (await counts(A)).items === 2 && (await counts(A)).orns === 1);
  await A.screenshot({ path: path.join(__dirname, 'out', `duo-waiting-${label}.png`) });

  /* 들어오기 */
  // 이어지기 전에 손님이 빈 방에 뭔가 놓아 둔 경우: 주인의 방을 받으면서 사라져야 한다 (주인이 꾸민 방이 지워지면 안 된다)
  const B = await open(ctxB, url('b'));
  await T(B, (r) => localStorage.setItem('nolja-tree-room.b-' + r.split('-')[0], JSON.stringify({ v: 1, at: Date.now() + 5000, sync: 0, items: [['b9', 'plant', 15, 15, 0]], orns: [], lights: ['off', 'on'], wall: 'cream', floor: 'oak' })), room);
  await B.goto(url('b', room)); await sleep(400); await ready(B);
  if (await B.isVisible('#lookDone')) await B.click('#lookDone');
  check('링크로 들어오면 둘이 이어짐', await on(A, B) && (await role(B)) === 'guest', { a: await mode(A), b: await mode(B) });
  await sleep(600);
  check('들어온 사람의 방이 주인의 방과 같아짐', await same(A, B), { a: await hash(A), b: await hash(B) });
  const cA = await counts(A), cB = await counts(B);
  check('처음 온 손님은 주인의 방을 받음 (주인이 꾸민 것은 그대로, 손님이 이어지기 전에 놓은 것은 사라짐)', cA.items === 2 && cA.orns === 1 && cB.items === 2 && cB.orns === 1 && cB.items === cB.objs && cB.orns === cB.ornObjs && !(await T(B, () => window.__tree.S.items.has('b9'))), { cA, cB });
  check('서로의 아바타가 보임', !!(await other(A)) && !!(await other(B)));
  const mA = await me(A), oB = await other(B);
  check('친구 아바타는 친구가 서 있는 자리에 있음', Math.hypot(mA.x - oB.x, mA.z - oB.z) < 0.05, { mA, oB });
  await until(async () => !(await T(B, () => window.__tree.me.moving)), 5000); await sleep(300);
  const mB = await me(B);
  check('같은 자리에 겹쳐 서지 않게 들어온 쪽이 비켜섬', Math.hypot(mA.x - mB.x, mA.z - mB.z) > 0.5, { mA, mB });
  check('위에 "같이 노는 중 · 2명" 표시', (await A.textContent('#net')) === '같이 노는 중 · 2명' && (await B.textContent('#net')) === '같이 노는 중 · 2명');

  /* 서로 놓은 것이 바로 보임 */
  await put(A, 'a3', 'table', 4, 6, 1);
  check('주인이 놓은 가구가 손님 방에 나타남', await until(() => T(B, () => window.__tree.S.items.has('a3') && window.__tree.itemObjs === window.__tree.S.items.size)));
  await put(B, 'b1', 'chair', 12, 2);
  check('손님이 놓은 가구가 주인 방에 나타남', await until(() => T(A, () => window.__tree.S.items.has('b1') && !window.__tree.grid.free(12, 2))));
  await T(B, () => window.__tree.dispatch({ t: 'move', id: 'a3', i: 4, j: 11, r: 0 }));
  check('손님이 주인의 가구를 옮기면 주인 방에서도 옮겨짐', await until(() => T(A, () => { const it = window.__tree.S.items.get('a3'); return it.j === 11 && it.r === 0 && window.__tree.grid.free(4, 6); })));
  await T(A, () => window.__tree.dispatch({ t: 'del', id: 'b1' }));
  check('주인이 손님의 가구를 치우면 손님 방에서도 사라짐', await until(() => T(B, () => !window.__tree.S.items.has('b1') && window.__tree.grid.free(12, 2))));
  await T(B, () => window.__tree.dispatch({ t: 'orn', id: 'bo1', k: 'star', x: -0.3, y: 1.5, z: 0.35 }));
  await T(A, () => window.__tree.dispatch({ t: 'ornDel', id: 'ao1' }));
  check('트리 장식 달기·떼기가 서로에게 보임', await until(async () => (await T(A, () => window.__tree.S.orns.has('bo1') && window.__tree.ornObjs === 1)) && (await T(B, () => !window.__tree.S.orns.has('ao1') && window.__tree.ornObjs === 1))));
  await T(B, () => window.__tree.dispatch({ t: 'lights', set: 'multi', blink: 'slow' }));
  await T(A, () => window.__tree.dispatch({ t: 'wall', v: 'sage' }));
  await T(B, () => window.__tree.dispatch({ t: 'floor', v: 'walnut' }));
  check('전구·벽지·바닥이 서로에게 보임', await until(async () => (await T(A, () => window.__tree.S.lights.set === 'multi' && window.__tree.bulbsOn && window.__tree.S.floor === 'walnut')) && (await T(B, () => window.__tree.S.wall === 'sage'))));
  check('여기까지 두 방이 똑같음', await same(A, B));

  /* 아바타 */
  await T(A, () => window.__tree.goTo(-3.2, 3.2));
  check('주인이 걸어가면 손님 화면의 친구 아바타가 걷기 시작', await until(async () => { const o = await other(B); return o && o.moving; }, 3000));
  await until(() => T(A, () => !window.__tree.me.moving && !window.__tree.me.path.length), 12000);
  check('다 걸으면 친구 아바타도 같은 자리에 섬', await until(async () => { const a = await me(A), o = await other(B); return Math.hypot(a.x - o.x, a.z - o.z) < 0.08 && !o.moving; }, 6000), { a: await me(A), o: await other(B) });
  await T(B, () => window.__tree.setLook({ gender: 'm', outfit: 'rudolph' }));
  check('캐릭터를 바꾸면 친구 화면에서도 바뀜', await until(async () => { const o = await other(A); return o.look.gender === 'm' && o.look.outfit === 'rudolph'; }, 4000), await other(A));
  // 친구가 서 있는 칸에는 가구를 놓을 수 없다
  const bPos = await me(B);
  await T(A, (p) => { window.__tree.ghostNew('giftR'); window.__tree.ghostMoveTo(p.x, p.z); }, bPos);
  check('친구가 서 있는 칸에는 가구를 놓을 수 없음', (await T(A, () => window.__tree.ghost)).ok === false);
  await T(A, () => window.__tree.ghostCancel());
  // 내가 들고 있던 가구를 친구가 치움
  await T(A, () => window.__tree.ghostPick('a1'));
  await T(B, () => window.__tree.dispatch({ t: 'del', id: 'a1' }));
  check('내가 들고 있는 가구를 친구가 치우면 손에서 사라짐', await until(async () => !(await T(A, () => window.__tree.ghost)) && !(await T(A, () => window.__tree.S.items.has('a1')))) && !(await A.isVisible('#furnBar')));
  // 트리 꾸밀 때 둘이 다른 쪽에 선다
  await A.tap('#tabs button[data-m="tree"]'); await B.tap('#tabs button[data-m="tree"]');
  await until(async () => !(await T(A, () => window.__tree.me.moving)) && !(await T(B, () => window.__tree.me.moving)) && !(await T(A, () => window.__tree.me.path.length)) && !(await T(B, () => window.__tree.me.path.length)), 12000);
  await sleep(500);
  const tA = await me(A), tB = await me(B);
  check('둘 다 트리를 꾸밀 때 서로 다른 쪽에 섬', Math.hypot(tA.x - tB.x, tA.z - tB.z) > 1.5 && Math.hypot(tA.x, tA.z) < 2.8 && Math.hypot(tB.x, tB.z) < 2.8, { tA, tB });
  await sleep(600);
  await B.screenshot({ path: path.join(__dirname, 'out', `duo-tree-${label}.png`) });
  await A.tap('#tabs button[data-m="tree"]'); await B.tap('#tabs button[data-m="tree"]');

  /* 같은 순간에 같은 자리 */
  await Promise.all([put(A, 'ca', 'giftR', 8, 14), put(B, 'cb', 'giftG', 8, 14)]);
  check('둘이 같은 순간 같은 칸에 놓으면 한쪽(주인) 것으로 맞춰짐', await same(A, B) && await T(A, () => window.__tree.S.items.has('ca')) && await T(B, () => window.__tree.S.items.has('ca') && !window.__tree.S.items.has('cb') && window.__tree.itemObjs === window.__tree.S.items.size), { a: await hash(A), b: await hash(B) });
  await Promise.all([T(A, () => window.__tree.dispatch({ t: 'lights', set: 'warm', blink: 'on' })), T(B, () => window.__tree.dispatch({ t: 'lights', set: 'ice', blink: 'twinkle' }))]);
  check('둘이 같은 순간 전구를 다르게 바꿔도 결국 같은 방이 됨', await until(async () => (await hash(A)) === (await hash(B)), 12000), { a: await T(A, () => window.__tree.S.lights), b: await T(B, () => window.__tree.S.lights) });

  /* 이상한 말이 와도 버틴다 */
  const before = await hash(A);
  const bad = await T(A, () => { const D = window.__duo; for (const m of [null, 5, 'x', {}, { t: 5 }, { t: 'op' }, { t: 'op', op: { t: 'put', id: '<b>', k: 'sofa', i: 0, j: 0, r: 0 } }, { t: 'op', op: { t: 'put', id: 'z1', k: 'sofa', i: 99, j: 0, r: 0 } },
    { t: 'state' }, { t: 'state', state: 'no' }, { t: 'hello', state: { v: 1, at: 9e13, items: 'x' } }, { t: 'look', look: { gender: '<script>' } }, { t: 'pos', x: 'a', z: 1 }, { t: 'pos', x: 999, z: 0 }, { t: 'ping', h: 5 }, { t: 'nope' }]) D.feed(m); return D.mode; });
  await sleep(400);
  check('규칙에 어긋난 말이 와도 방이 망가지지 않음', bad === 'on' && (await hash(A)) === before && errors.length === 0 && (await other(A)).look.outfit === 'rudolph', { bad, errors });
  await sleep(1500);
  check('잠시 뒤에도 두 방이 똑같음', await same(A, B));

  /* 세 번째: 구경하러 온 사람 */
  const C = await open(ctxB, `${url('c')}#v=${id}`);
  check('구경 링크로 들어오면 구경하는 사람으로 이어짐', await until(async () => (await mode(C)) === 'on' && (await T(C, () => window.__duo.canEdit)) === false, 15000), await mode(C));
  await sleep(500);
  check('구경하는 사람도 방을 그대로 봄', await same(A, C) && await T(C, () => window.__tree.itemObjs === window.__tree.S.items.size && window.__tree.ornObjs === window.__tree.S.orns.size));
  const seen = async (p) => (await T(p, () => window.__duo.others)).length;
  check('세 사람이 서로 보임', await until(async () => (await seen(A)) === 2 && (await seen(B)) === 2 && (await seen(C)) === 2, 5000), { a: await seen(A), b: await seen(B), c: await seen(C) });
  check('사람 수 표시: 꾸미는 사람은 "같이 노는 중 · 3명", 구경하는 사람은 "구경 중 · 3명"', (await A.textContent('#net')) === '같이 노는 중 · 3명' && (await B.textContent('#net')) === '같이 노는 중 · 3명' && (await C.textContent('#net')) === '구경 중 · 3명', [await A.textContent('#net'), await B.textContent('#net'), await C.textContent('#net')]);
  check('구경하는 사람에게는 가구·트리·벽바닥 탭이 없고 캐릭터·같이 탭만 있음', !(await C.isVisible('#tabs button[data-m="furn"]')) && !(await C.isVisible('#tabs button[data-m="tree"]')) && !(await C.isVisible('#tabs button[data-m="paint"]')) && (await C.isVisible('#tabs button[data-m="look"]')) && (await C.isVisible('#tabs button[data-m="duo"]')) && (await audit(C)).length === 0, await audit(C));
  await C.tap('#tabs button[data-m="duo"]'); await sleep(200);
  check('구경하는 사람은 구경 링크만 보낼 수 있음', !(await C.isVisible('#duoInvite')) && (await C.isVisible('#duoInviteV')) && (await C.textContent('#duoLeave')) === '내 방으로 가기' && (await T(C, () => window.__duo.inviteUrl())) === `${BASE}#v=${id}` && (await audit(C)).length === 0);
  await C.tap('#tabs button[data-m="duo"]');
  const hA = await hash(A);
  check('구경하는 사람은 방을 바꿀 수 없음 (화면에서 막힘)', (await put(C, 'c1', 'lamp', 9, 14)) === false && (await hash(C)) === hA);
  await T(C, () => window.__duo.rawOp({ t: 'put', id: 'c2', k: 'lamp', i: 9, j: 14, r: 0 }));
  await T(C, () => window.__duo.rawOp({ t: 'wall', v: 'rose' }));
  await sleep(700);
  check('구경하는 사람이 억지로 보낸 변화는 주인이 받지 않음', (await hash(A)) === hA && (await hash(B)) === hA && !(await T(A, () => window.__tree.S.items.has('c2'))));
  await T(C, () => window.__tree.goTo(3.2, -3.2));
  const cid = await T(C, () => window.__duo.me);
  await until(() => T(C, () => !window.__tree.me.moving && !window.__tree.me.path.length), 40000);
  const far = async (p) => { const o = (await T(p, () => window.__duo.others)).find((x) => x.id === cid), c = await me(C); return o ? Math.hypot(o.x - c.x, o.z - c.z) : 9; };
  check('구경하는 사람이 걸어다니는 것이 주인과 다른 손님 모두에게 보임', await until(async () => (await far(A)) < 0.1 && (await far(B)) < 0.1, 20000), { a: await far(A), b: await far(B) });
  await put(B, 'b2', 'giftG', 2, 13);
  check('손님이 놓은 가구가 주인을 거쳐 구경하는 사람에게도 보임', await until(() => T(C, () => window.__tree.S.items.has('b2') && window.__tree.itemObjs === window.__tree.S.items.size), 5000), { b: await T(B, () => window.__tree.S.items.has('b2')), a: await T(A, () => window.__tree.S.items.has('b2')), c: await T(C, () => [...window.__tree.S.items.keys()]) });
  await T(C, () => window.__tree.setLook({ gender: 'm', outfit: 'santa' }));
  check('구경하는 사람이 옷을 바꾸면 다른 손님에게도 보임', await until(async () => { const o = (await T(B, () => window.__duo.others)).find((x) => x.id === cid); return o && o.look.outfit === 'santa'; }, 5000));

  /* 네 번째: 꾸미는 사람이 한 명 더 */
  const D = await open(ctxB, url('d', room));
  check('같이 꾸미기 링크로 세 번째 꾸미는 사람이 들어옴', await until(async () => (await mode(D)) === 'on' && (await T(D, () => window.__duo.canEdit)) === true && (await T(D, () => window.__duo.others)).length > 0, 15000) && await same(A, D));
  await sleep(400);
  check('네 사람이 서로 보임', await until(async () => (await seen(A)) === 3 && (await seen(B)) === 3 && (await seen(C)) === 3 && (await seen(D)) === 3, 5000) && (await T(A, () => window.__duo.editors)) === 3, { s: [await seen(A), await seen(B), await seen(C), await seen(D)], e: await T(A, () => window.__duo.editors) });
  await put(D, 'd1', 'plant', 15, 15);
  check('새로 온 사람이 놓은 것이 모두에게 보임', await until(async () => (await T(A, () => window.__tree.S.items.has('d1'))) && (await T(B, () => window.__tree.S.items.has('d1'))) && (await T(C, () => window.__tree.S.items.has('d1'))), 5000) && await same(B, D) && await same(C, D));
  await T(A, () => window.__tree.dispatch({ t: 'orn', id: 'ao9', k: 'bell', x: 0.2, y: 2.0, z: 0.2 }));
  check('주인이 단 장식도 모두에게 보임', await until(async () => (await T(B, () => window.__tree.S.orns.has('ao9'))) && (await T(C, () => window.__tree.S.orns.has('ao9'))) && (await T(D, () => window.__tree.S.orns.has('ao9'))), 5000));
  const slots = [await T(A, () => window.__duo.slot), await T(B, () => window.__duo.slot), await T(C, () => window.__duo.slot), await T(D, () => window.__duo.slot)];
  check('트리 옆에 설 자리가 사람마다 다름', new Set(slots).size === 4, slots);
  await A.screenshot({ path: path.join(__dirname, 'out', `duo-four-${label}.png`) });

  /* 다섯 번째: 정원(검사에서는 4명)이 참 */
  const E = await open(ctxB, url('e', room));
  check('정원이 차면 더 들어오지 못하고 안내를 봄', await until(async () => (await mode(E)) === 'full', 15000) && (await E.textContent('#net')) === '방이 찼어요', await mode(E));
  await E.tap('#tabs button[data-m="duo"]'); await sleep(200);
  await E.tap('#duoLeave'); await ready(E);
  check('"내 방으로 가기"를 누르면 혼자 노는 내 방으로, 다른 사람들의 연결은 그대로', (await mode(E)) === 'solo' && (await E.evaluate(() => location.hash)) === '' && (await counts(E)).items === 0 && (await mode(A)) === 'on' && (await seen(A)) === 3);
  await E.close();

  /* 구경하던 사람이 나가고, 꾸미는 자리가 다 찬 방에 꾸미기 링크로 들어옴 */
  await C.close();
  check('한 명이 나가면 남은 사람들에게서 그 아바타만 사라짐', await until(async () => (await seen(A)) === 2 && (await seen(B)) === 2 && (await seen(D)) === 2, 12000) && (await A.textContent('#net')) === '같이 노는 중 · 3명');
  const F = await open(ctxB, url('f', room));
  check('꾸미는 자리(검사에서는 3명)가 다 차면 꾸미기 링크로 와도 구경으로 들어옴', await until(async () => (await mode(F)) === 'on' && (await T(F, () => window.__duo.canEdit)) === false && (await F.textContent('#net')).startsWith('구경 중'), 15000) && !(await F.isVisible('#tabs button[data-m="furn"]')), { m: await mode(F), e: await T(F, () => window.__duo.canEdit), n: await F.textContent('#net'), ed: await T(A, () => window.__duo.editors) });
  await F.close(); await D.close();
  check('둘이 나가면 다시 두 명', await until(async () => (await seen(A)) === 1 && (await seen(B)) === 1, 12000) && (await mode(A)) === 'on' && (await A.textContent('#net')) === '같이 노는 중 · 2명');

  /* 구경 온 사람은 방을 대신 맡지 않는다 */
  const V = await open(ctxB, `${url('v')}#v=zzzznobody`);
  check('주인이 없는 방에 구경 오면 기다리라는 안내를 보고, 방을 꾸밀 수 없음', await until(async () => (await mode(V)) === 'away', 12000) && (await V.textContent('#net')) === '주인 없음' && (await T(V, () => window.__duo.role)) === null && (await put(V, 'v1', 'lamp', 3, 3)) === false && !(await V.isVisible('#tabs button[data-m="furn"]')));
  await V.close();

  /* 손님이 나갔다 돌아옴 */
  const hBefore = await hash(A);
  await B.close();
  check('손님이 나가면 주인은 다시 기다리고 친구 아바타가 사라짐', await until(async () => (await mode(A)) === 'waiting' && !(await other(A)), 12000), await mode(A));
  await put(A, 'a7', 'snowman', 14, 12);
  check('혼자서도 계속 꾸밀 수 있음', (await hash(A)) !== hBefore);
  const B2 = await open(ctxB, url('b', room));
  check('손님이 같은 링크로 돌아오면 다시 이어지고 그동안 바뀐 방을 받음', await on(A, B2) && await same(A, B2) && await T(B2, () => window.__tree.S.items.has('a7')));

  /* 주인이 나가면 손님이 방을 이어받음 */
  await A.close();
  check('주인이 나가면 손님이 방 주인이 되어 기다림 (방은 그대로)', await until(async () => (await mode(B2)) === 'waiting' && (await role(B2)) === 'host', 20000) && await T(B2, () => window.__tree.S.items.has('a7')), { m: await mode(B2), r: await role(B2) });
  await put(B2, 'b5', 'shelf', 8, 0);
  await sleep(500);
  const A2 = await open(ctxA, url('a')); // 방 주소 없이 그냥 열어도 들어가 있던 방으로 간다
  check('방 주소 없이 열어도 들어가 있던 방으로 이어짐', (await A2.evaluate(() => location.hash)) === '#r=' + room && await on(A2, B2) && (await role(A2)) === 'guest');
  check('돌아온 사람이 그동안 친구가 꾸민 것을 받음', await same(A2, B2) && await T(A2, () => window.__tree.S.items.has('b5') && window.__tree.itemObjs === window.__tree.S.items.size));

  /* 따로 꾸민 뒤 다시 만남: 더 최근에 꾸민 쪽 */
  await B2.close();
  await until(async () => (await mode(A2)) !== 'on', 12000);
  await A2.close();
  const B3 = await open(ctxB, url('b', room)); // 손님이었던 쪽이 혼자 먼저 열어 주인이 됨 (예전 그대로)
  await until(async () => (await mode(B3)) === 'waiting', 12000);
  await B3.close();
  const A3 = await open(ctxA, url('a', room));
  await until(async () => (await mode(A3)) === 'waiting', 12000);
  await put(A3, 'a8', 'plant', 0, 0); // 혼자 있을 때 더 꾸밈
  await sleep(500); await A3.close();
  const B4 = await open(ctxB, url('b', room));
  await until(async () => (await mode(B4)) === 'waiting', 12000); // 예전 방을 가진 쪽이 주인
  const A4 = await open(ctxA, url('a', room)); // 더 최근에 꾸민 쪽이 손님으로 들어옴
  check('따로 꾸민 뒤 다시 만나면 더 최근에 꾸민 방으로 맞춰짐', await on(A4, B4) && await same(A4, B4) && await T(B4, () => window.__tree.S.items.has('a8') && window.__tree.itemObjs === window.__tree.S.items.size) && await T(A4, () => window.__tree.S.items.has('a8')), { a: await counts(A4), b: await counts(B4) });

  /* 나가기 */
  const nA = (await counts(A4)).items;
  await A4.tap('#tabs button[data-m="duo"]'); await sleep(200);
  check('연결 중에도 초대할 수 있고, 내가 만든 방이면 "혼자 놀기" 단추가 보임', (await A4.textContent('#duoLeave')) === '혼자 놀기' && (await A4.isVisible('#duoInvite')) && (await A4.isVisible('#duoInviteV')) && (await A4.textContent('#duoMain')).includes('2명') && (await audit(A4)).length === 0, await audit(A4));
  await A4.screenshot({ path: path.join(__dirname, 'out', `duo-on-${label}.png`) });
  await A4.tap('#duoLeave'); await ready(A4);
  check('방을 만든 사람이 나가면 지금 방 모습 그대로 혼자 이어서 꾸밈', (await mode(A4)) === 'solo' && (await A4.evaluate(() => location.hash)) === '' && (await counts(A4)).items === nA && !(await A4.isVisible('#net')));
  await B4.tap('#tabs button[data-m="duo"]'); await sleep(200);
  await until(async () => (await mode(B4)) === 'waiting', 12000);
  check('초대받은 사람의 단추는 "내 방으로 가기"', (await B4.textContent('#duoLeave')) === '내 방으로 가기');
  await B4.tap('#duoLeave'); await ready(B4);
  check('초대받은 사람이 나가면 자기 방(혼자 꾸미던 방)으로 돌아감', (await mode(B4)) === 'solo' && (await counts(B4)).items === 0);
  await A4.reload(); await ready(A4);
  check('나간 뒤 다시 열어도 혼자 노는 방 그대로', (await mode(A4)) === 'solo' && (await counts(A4)).items === nA);
  await ctxA.close(); if (twoContexts) await ctxB.close();
}

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  let broker = null;
  try {
    await suite(browser, 'bc', 'net=bc', false);
    if (args.includes('--peer')) {
      const { PeerServer } = require('peer');
      broker = PeerServer({ port: BROKER_PORT, path: '/', host: '127.0.0.1' });
      await sleep(500);
      await suite(browser, 'peer', `broker=localhost:${BROKER_PORT}`, true); // 서로 다른 브라우저 창(저장소도 따로)
    }
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
    if (broker && broker.close) broker.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
