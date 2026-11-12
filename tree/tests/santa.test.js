// 같이 놀기 · 몰래 산타 검사 (몰래 뽑기, 슬쩍과 15초 간격, 방의 상태는 그대로, 모이기·이야기·투표, 빠지기, 표가 같을 때, 시민 승·산타 승(다 훔침·시간), 산타가 나가면 취소, 폰 화면).
// 실행: cd tree/tests && node santa.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8194, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__games && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; window.__skip = 0; window.__now = () => Date.now() + window.__skip; });
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
const overlap = (p, a, b) => p.evaluate(([a, b]) => { const x = document.querySelector(a).getBoundingClientRect(), y = document.querySelector(b).getBoundingClientRect(); return !(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top); }, [a, b]);
const stand = (p, x, z) => T(p, ([x, z]) => { const t = window.__tree; t.me.stop(); t.me.place(x, z); t.snapView(); }, [x, z]);
const G = (p) => T(p, () => window.__games.state);
const band = (p) => T(p, () => window.__games.band);
const skip = (ps, ms) => Promise.all(ps.map((p) => T(p, (ms) => { window.__skip += ms; }, ms)));
const shot = (p, n) => p.screenshot({ path: path.join(__dirname, 'out', n) });
// A(심판) 화면에서 몰래 산타가 id 가 되게 시작한다
const startAs = (p, id) => T(p, (id) => { const ids = [window.__duo.me, ...window.__duo.others.map((o) => o.id)], k = ids.indexOf(id), r = Math.random; Math.random = () => (k + 0.5) / ids.length; const ok = window.__games.start('santa'); Math.random = r; return ok; }, id);
const voteOn = (p, id) => T(p, (id) => { const b = document.querySelector(`#gameVoteList button[data-id="${id}"]`); if (!b) return false; b.click(); return true; }, id);

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=sa`);
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], rid = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=sb#r=${room}`);
    check('둘이면 몰래 산타는 고를 수 없음 (3명 이상)', await until(async () => (await T(A, () => window.__duo.count)) === 2, 15000) && (await T(A, () => window.__games.why('santa'))).includes('3명'), await T(A, () => window.__games.why('santa')));
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=sc#r=${room}`);
    const D = await open(ctx, `${BASE}?net=bc&door=0&ns=sd#v=${rid}`);
    const all = [A, B, C, D];
    await until(async () => (await T(A, () => window.__duo.count)) === 4 && (await Promise.all(all.map((p) => T(p, () => window.__duo.others.length)))).every((n) => n === 3), 25000);
    const bid = await T(B, () => window.__duo.me), cid = await T(C, () => window.__duo.me), did = await T(D, () => window.__duo.me);
    check('트리에 장식이 없으면 몰래 산타를 시작할 수 없음', (await T(A, () => window.__games.why('santa'))).includes('장식'));
    // 트리에 장식 7개
    await T(A, () => { for (let k = 0; k < 7; k++) { const a = k * 0.9, r = 0.7; window.__tree.dispatch({ t: 'orn', id: 'o' + k, k: 'red', x: Math.round(Math.sin(a) * r * 1000) / 1000, y: 1.1, z: Math.round(Math.cos(a) * r * 1000) / 1000 }); } });
    await until(async () => (await Promise.all(all.map((p) => T(p, () => window.__tree.S.orns.size)))).every((n) => n === 7), 5000);
    check('넷이고 장식이 있으면 시작할 수 있음', (await T(A, () => window.__games.why('santa'))) === '');

    /* 시작: 몰래 산타는 C (A 가 심판) */
    check('시작', await startAs(A, cid));
    check('모두의 화면에 같은 판, 목표는 장식 5개', await until(async () => (await Promise.all(all.map(G))).every((g) => g && g.g === 'santa' && g.goal === 5 && g.pl.length === 4), 3000));
    check('몰래 산타 화면에만 역할이 보임', (await T(C, () => window.__games.amSanta)) && !(await T(A, () => window.__games.amSanta)) && !(await T(B, () => window.__games.amSanta)) && !(await T(D, () => window.__games.amSanta)));
    check('몰래 산타의 띠: "너는 몰래 산타"', (await band(C)).role.includes('너는 몰래 산타'), await band(C));
    check('나머지의 띠: "누군가 장식을 훔치고 있어요"', (await band(B)).role.includes('누군가 장식을 훔치고') && (await band(D)).role.includes('누군가 장식을 훔치고'));
    check('몰래 산타 화면의 알림', (await C.textContent('#toast')).includes('몰래 산타'));
    check('받은 상태에 몰래 산타의 이름이 그대로 들어 있지 않음 (짧은 표만)', await T(B, (c) => { const s = window.__games.state; return !('santa' in s) && !('who' in s) && s.t && s.t !== c && window.__games.santa === null; }, cid));
    check('심판 화면은 알지만 보여 주지는 않음', (await T(A, () => window.__games.santa)) === cid && !(await band(A)).role.includes('산타') && !(await A.textContent('#gameBand')).includes('친구'));
    check('5분 시계', /^[45]:[0-5]\d$/.test((await band(B)).clock), await band(B));
    check('누구나 "🔔 모이기"를 볼 수 있음 (구경하는 사람 포함)', (await band(B)).meet && (await band(D)).meet && (await band(C)).meet);
    await shot(C, 'santa-band.png');
    await shot(A, 'santa-band-ref.png');
    check('심판 화면(모이기·그만하기)도 단추가 44px 이상·화면 안', (await audit(A)).length === 0 && (await band(A)).stop && (await band(A)).meet, await audit(A));
    check('놀이 중 화면의 단추가 모두 44px 이상·화면 안, 띠가 겹치지 않음', (await audit(C)).length === 0 && !(await overlap(C, '#gameBand', '#top a')) && !(await overlap(C, '#gameBand', '#tools')), await audit(C));

    /* 슬쩍 */
    await stand(C, 4, 3); await sleep(300);
    check('트리에서 멀면 슬쩍할 수 없음', (await T(C, () => window.__tree.nearAction())) === null);
    await stand(C, 1.9, 0.4); await sleep(300);
    check('트리 가까이에서 "🤫 슬쩍" (처음 15초는 기다림)', /🤫 슬쩍 \(\d+초\)/.test(await T(C, () => window.__tree.nearAction())), await T(C, () => window.__tree.nearAction()));
    await stand(B, 1.9, -0.4); await sleep(300);
    check('몰래 산타가 아닌 사람은 트리 앞에서도 슬쩍이 없음', !String(await T(B, () => window.__tree.nearAction())).includes('슬쩍'));
    await T(C, () => window.__games.act());
    await sleep(300);
    check('기다리는 중에 누르면 "조금만 기다려요"', (await C.textContent('#toast')).includes('기다려요') && (await G(A)).st.length === 0);
    await skip(all, 15500); await sleep(300);
    check('15초가 지나면 "🤫 슬쩍"', (await T(C, () => window.__tree.nearAction())) === '🤫 슬쩍');
    await C.keyboard.press('Space');
    check('스페이스로 슬쩍: 모두에게 "장식이 하나 사라졌어요! (1/5)"', await until(async () => { const t = await Promise.all(all.map((p) => p.textContent('#toast'))); return t.every((x) => x.includes('장식이 하나 사라졌어요! (1/5)')); }, 3000), await Promise.all(all.map((p) => p.textContent('#toast'))));
    const o1 = (await G(A)).st[0];
    check('훔친 장식은 모두의 화면에서 안 보임', await until(async () => (await Promise.all(all.map((p) => T(p, (o) => window.__games.ornHidden(o), o1)))).every(Boolean), 2000));
    check('방의 상태는 그대로 (장식 7개, 모두의 방 지문이 같음)', (await Promise.all(all.map((p) => T(p, () => window.__tree.S.orns.size)))).every((n) => n === 7) && new Set(await Promise.all(all.map((p) => T(p, () => window.__duo.hash())))).size === 1);
    check('알림에 누가 했는지는 없음', !(await B.textContent('#toast')).includes('친구') && !(await B.textContent('#toast')).includes('방장'));
    check('훔치는 몸짓 없음 (다른 사람 화면의 산타가 행동을 하지 않음)', (await T(B, (c) => window.__duo.others.find((o) => o.id === c).acting, cid)) === null);
    check('몰래 산타 띠: 장식 1/5, 다음 슬쩍까지 기다림', /장식 1\/5/.test((await band(C)).role) && /슬쩍 \d+초 뒤/.test((await band(C)).role), await band(C));
    // 심판 시계로 15초가 안 지났으면 받지 않는다 (산타 화면 시계만 앞당김)
    await skip([C], 15500);
    await T(C, () => window.__games.steal()); await sleep(500);
    check('15초에 한 번: 심판 시계로 간격이 안 됐으면 받지 않음', (await G(A)).st.length === 1);
    await skip(all, 15500);
    await T(C, () => window.__games.steal());
    check('간격이 지나면 두 번째 슬쩍 (2/5)', await until(async () => (await G(B)).st.length === 2, 3000));

    /* 모이기 → 이야기 → 투표: B 가 빠짐 */
    const main0 = (await G(A)).left;
    await B.tap('#gameMeet');
    check('"🔔 모이기"를 누르면 모두 이야기 시간 (30초)', await until(async () => (await Promise.all(all.map(G))).every((g) => g.ph === 'talk'), 3000) && /이야기 0:(29|30)/.test((await band(D)).clock), await band(D));
    check('모두에게 누가 불렀는지 알림', (await D.textContent('#toast')).includes('모이기를 불렀어요'));
    check('모이기는 한 판에 한 번: 부른 사람에게는 단추가 없음', !(await band(B)).meet);
    check('모이기 중에는 슬쩍할 수 없음', (await T(C, () => window.__tree.nearAction())) !== '🤫 슬쩍' && !(await T(C, () => window.__games.steal())));
    await T(D, () => window.__duo.say('누가 훔쳤어?'));
    check('이야기 시간에 채팅이 됨', await until(async () => (await T(A, () => window.__duo.chatLog)).some((l) => l.includes('누가 훔쳤어')), 3000));
    await skip(all, 30500);
    check('30초 뒤 투표: 남은 사람 모두에게 투표 판', await until(async () => (await Promise.all(all.map((p) => T(p, () => window.__games.voting)))).every(Boolean), 3000));
    const names = await T(A, () => [...document.querySelectorAll('#gameVoteList button')].map((b) => b.textContent));
    check('투표 판: 나를 뺀 사람들과 "건너뛰기"', names.length === 4 && names.includes('건너뛰기') && !names.includes('나'), names);
    await shot(D, 'santa-vote.png');
    check('투표 판의 단추도 44px 이상·화면 안', (await audit(D)).length === 0, await audit(D));
    await A.tap(`#gameVoteList button[data-id="${bid}"]`);
    await voteOn(C, bid); await voteOn(B, '');
    check('표를 내면 "기다리는 중"', (await T(C, () => document.getElementById('gameVoteSub').textContent)).includes('기다리는 중'));
    await voteOn(D, '');
    check('모두 표를 내면 시간 전이라도 바로 셈: B 가 빠짐 (몰래 산타 아님)', await until(async () => (await Promise.all(all.map(G))).every((g) => g.ph === 'play' && g.out.includes(bid)), 3000), await G(A));
    check('모두에게 "몰래 산타가 아니었어요" 알림', (await A.textContent('#toast')).includes('몰래 산타가 아니었어요') && (await B.textContent('#toast')).includes('구경'));
    check('빠진 사람: "빠졌어요 · 구경", 머리 위에 "🚫 빠짐"', (await band(B)).role.includes('빠졌어요') && await until(async () => (await T(A, () => window.__games.tags)).includes(bid), 2000));
    const main1 = (await G(A)).left;
    check('모이기 동안 판 시계는 멈춰 있었음', main0 - main1 < 15000, { main0, main1 });
    check('투표 판이 닫히고 판이 이어짐', !(await T(A, () => window.__games.voting)) && (await band(A)).clock.match(/^[34]:/));

    /* 두 번째 모이기: 표가 같으면 아무도 안 빠짐 */
    await T(D, () => window.__games.meet());
    await until(async () => (await G(A)).ph === 'talk', 3000);
    check('빠진 사람은 모이기를 부를 수 없음', !(await band(B)).meet && !(await T(B, () => window.__games.meet())));
    await skip(all, 30500);
    await until(async () => (await G(A)).ph === 'vote', 3000);
    check('빠진 사람에게는 투표 판이 없음', !(await T(B, () => window.__games.voting)) && (await T(A, () => window.__games.voting)));
    await voteOn(A, did); await voteOn(D, 'h'); await voteOn(C, '');
    check('표가 같으면 아무도 빠지지 않고 이어짐', await until(async () => (await G(A)).ph === 'play' && (await G(A)).out.length === 1, 3000) && (await D.textContent('#toast')).includes('표가 같아서'));

    /* 세 번째 모이기(C 가 부름): 몰래 산타를 잡음 → 시민 승 */
    await T(C, () => window.__games.meet());
    await until(async () => (await G(A)).ph === 'talk', 3000);
    await skip(all, 30500);
    await until(async () => (await G(A)).ph === 'vote', 3000);
    await voteOn(A, cid); await voteOn(D, cid); await voteOn(C, 'h');
    check('가장 많은 표를 받은 사람이 몰래 산타면 시민 승: 결과 판이 모두에게', await until(async () => (await Promise.all(all.map((p) => T(p, () => window.__games.result)))).every(Boolean), 3000));
    const rA = await T(A, () => window.__games.result), rC = await T(C, () => window.__games.result), rB = await T(B, () => window.__games.result);
    check('결과 판에서 몰래 산타가 누구였는지 밝힘', rA.main.includes('몰래 산타는') && rA.main.includes('친구') && rC.main.includes('나였어요'), { rA, rC });
    check('시민 승리, 훔친 장식 수, 이겼는지', rA.sub.includes('시민 승리') && rA.sub.includes('2/5') && rA.sub.includes('이겼어요') && rC.sub.includes('졌어요') && rB.sub.includes('이겼어요'), { rA, rB, rC });
    check('판이 끝나면 훔친 장식이 모두 돌아옴', (await Promise.all(all.map((p) => T(p, () => ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6'].some((o) => window.__games.ornHidden(o)))))).every((x) => !x));
    await shot(A, 'santa-result.png');
    for (const p of all) await T(p, () => window.__games.closeEnd());

    /* 몰래 산타가 다 훔치면 산타 승 (심판이 산타) */
    check('심판이 몰래 산타여도 됨', await startAs(A, 'h') && (await T(A, () => window.__games.amSanta)));
    await until(async () => (await G(D)) !== null, 3000);
    await stand(A, -1.9, 0.4); await sleep(200);
    for (let k = 0; k < 5; k++) { await skip(all, 15500); await sleep(150); await T(A, () => window.__games.act()); await sleep(250); }
    check('목표만큼 훔치면 몰래 산타 승', await until(async () => { const r = await T(B, () => window.__games.result); return r && r.sub.includes('몰래 산타 승리') && r.sub.includes('다 훔쳤어요') && r.main.includes('방장'); }, 3000), await T(B, () => window.__games.result));
    check('장식이 다시 다 보임', !(await T(B, () => ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6'].some((o) => window.__games.ornHidden(o)))));
    for (const p of all) await T(p, () => window.__games.closeEnd());

    /* 시간이 끝나도 안 잡히면 산타 승 */
    await startAs(A, bid);
    await until(async () => (await G(D)) !== null, 3000);
    await skip(all, 301000);
    check('5분이 지날 때까지 안 잡히면 몰래 산타 승', await until(async () => { const r = await T(D, () => window.__games.result); return r && r.sub.includes('몰래 산타 승리') && r.sub.includes('시간'); }, 3000), await T(D, () => window.__games.result));
    for (const p of all) await T(p, () => window.__games.closeEnd());

    /* 장식이 적으면 있는 만큼, 산타가 나가면 취소 */
    await T(A, () => { for (const k of [3, 4, 5, 6]) window.__tree.dispatch({ t: 'ornDel', id: 'o' + k }); });
    await until(async () => (await T(D, () => window.__tree.S.orns.size)) === 3, 3000);
    await startAs(A, did);
    check('장식이 5개보다 적으면 있는 만큼이 목표 (3)', await until(async () => (await G(D)) && (await G(D)).goal === 3, 3000));
    check('구경하는 사람도 몰래 산타가 될 수 있음', await T(D, () => window.__games.amSanta));
    await D.close();
    check('몰래 산타가 나가면 판이 취소되고 모두에게 알림', await until(async () => { const r = await T(B, () => window.__games.result); return r && r.main.includes('취소') && r.sub.includes('몰래 산타'); }, 15000), await T(B, () => window.__games.result));
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
