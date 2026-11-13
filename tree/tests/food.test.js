// 냉장고와 먹기 검사 (문 열기·진열·고르는 판 · 한 입씩 줄어드는 모양 · 종류마다 · 김과 부스러기 · 도로 넣기 · 케이크와 겹칠 때 · 친구와 구경하는 사람에게 보이기 · 이상한 소식 · 폰 화면). 실행: cd tree/tests && node food.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8199, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__food && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__bare = true; }); // 기본 가구 없이 빈 방에서 시작한다
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
  // 단추끼리 겹치지 않는지 (같은 판 안)
  const bs = [...document.querySelectorAll('#fridgeP button, #act')].filter((b) => b.getBoundingClientRect().width && !b.closest('[hidden]')).map((b) => [b.textContent, b.getBoundingClientRect()]);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i][1], c = bs[j][1]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) bad.push(`겹침: ${bs[i][0]} / ${bs[j][0]}`); }
  return bad;
});
const near = (p) => T(p, () => window.__tree.nearAction());
const mode = (p) => T(p, () => window.__tree.mode);
const holding = (p) => T(p, () => window.__food.holding);
const doors = (p) => T(p, () => window.__food.doors);
const shape = (p) => T(p, () => window.__food.shape);
const toastHas = (p, t, ms = 3000) => until(async () => (await p.textContent('#toast')).includes(t), ms);
const stand = async (p, x, z) => { await T(p, (a) => { const W = window.__tree; W.me.stop(); W.me.place(a[0], a[1]); }, [x, z]); await sleep(350); };
const shot = (p, name) => p.screenshot({ path: path.join(__dirname, 'out', name) });
// 한 입 먹고 그 입이 닿을 때까지 기다린다
const bite = async (p) => { const h = await holding(p); const ok = await T(p, () => (window.__tree.pressSpace(), true)); await until(async () => { const n = await holding(p); return !n || (n.shown < h.shown && (n.ready || n.ending)); }, 6000); return ok; };

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=fa`);
    check('냉장고, 케이크 작업대, 탁자를 놓음', await T(A, () => { const W = window.__tree; return [['fr', 'fridge', 14, 0, 0], ['ck', 'cake', 24, 4, 0], ['tb', 'table', 6, 12, 0]].every(([id, k, i, j, r]) => W.dispatch({ t: 'put', id, k, i, j, r })); }));
    check('먹을 것이 10가지 넘게 있고(먹는 것·마시는 것 모두), 종류마다 입 수가 정해져 있음', await T(A, () => { const k = window.__food.kinds; return k.length >= 12 && k.filter((f) => f.sip).length >= 4 && k.filter((f) => !f.sip).length >= 6 && k.every((f) => f.n >= 2 && f.n <= 5) && new Set(k.map((f) => f.id)).size === k.length; }), await T(A, () => window.__food.kinds.length));

    /* 냉장고 열기 */
    await stand(A, 3.5, -3.0);
    check('냉장고 앞: "🧊 냉장고 열기", 닫혀 있을 때는 열린 모양을 만들지 않음', (await near(A)) === '🧊 냉장고 열기' && (await doors(A)).length === 0, await near(A));
    await A.tap('#act');
    check('단추를 누르면 냉장고 판이 열림', await until(async () => (await mode(A)) === 'fridge', 3000) && await A.isVisible('#fridgeP'));
    check('문이 실제로 열리고(경첩에서 100도 넘게) 안에 불이 켜짐', await until(async () => { const d = (await doors(A))[0]; return d && d.a === 1 && d.angle < -1.7 && d.lit > 0.2; }, 4000), await doors(A));
    const kinds = await T(A, () => window.__food.kinds);
    check('선반에 모든 종류가 진열됨', (await doors(A))[0].shelf === kinds.length, (await doors(A))[0]);
    check('판에 종류마다 단추가 있음', (await A.locator('#fridgeList .fd').count()) === kinds.length && !(await A.isVisible('#fridgeBack')));
    check('폰(375×812)에서 판의 단추가 화면 안·44px 이상·겹치지 않음', (await audit(A)).length === 0, await audit(A));
    await sleep(300); await shot(A, 'food-fridge.png');
    await A.tap('#fridgeClose');
    check('닫기를 누르면 판이 닫히고 문도 닫힘', (await mode(A)) === null && await until(async () => (await doors(A)).length === 0, 4000), await doors(A));

    /* 선반의 음식을 직접 누르기 */
    await T(A, () => window.__tree.useItem('fr')); await until(async () => (await mode(A)) === 'fridge' && (await doors(A))[0].a === 1, 5000);
    const pt = await T(A, () => { const w = window.__food.shelfPoint('pudding'); window.__tree.snapView(); return window.__tree.screenOf(w[0], w[2], w[1] + 0.03); });
    await A.touchscreen.tap(pt.x, pt.y);
    check('열린 냉장고 안의 푸딩을 누르면 푸딩을 꺼내 듦', await until(async () => { const h = await holding(A); return h && h.kind === 'pudding' && h.left === 3; }, 3000), { h: await holding(A), pt });
    check('꺼내면 판이 닫히고 문도 닫힘, 무엇을 꺼냈는지 알려 줌', (await mode(A)) === null && await until(async () => (await doors(A)).length === 0, 4000) && await toastHas(A, '푸딩 꺼냈어요'));

    /* 한 입씩 먹기 */
    await sleep(300);
    check('들고 있으면 할 일 단추가 "🍮 푸딩 먹기 ●●●"', (await near(A)) === '🍮 푸딩 먹기 ●●●' && (await A.textContent('#act')).includes('푸딩 먹기'), await near(A));
    const s0 = await shape(A);
    check('손에 든 음식은 팔이 움직여도 바로 서 있고, 팔을 내밀어 앞에 듦', s0 && s0.up > 0.97 && s0.y > 0.45, s0);
    check('들고 있을 때 단추가 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    await shot(A, 'food-hold.png');
    await A.tap('#act');
    check('먹기 단추를 누르면 먹는 몸짓("eat")', await until(() => T(A, () => window.__tree.me.acting === 'eat'), 2000));
    check('바로 줄지 않고 입에 닿았을 때 줄어듦', (await holding(A)).left === 2 && (await holding(A)).shown === 3, await holding(A));
    check('한 입 먹으면 모양이 줄고 말("탱글")이 뜨고 부스러기가 날림', await until(async () => (await holding(A)).shown === 2, 2000) && (await holding(A)).said === '탱글' && (await T(A, () => window.__food.sparks)) > 0 && (await shape(A)).sig !== s0.sig, { h: await holding(A), s: await shape(A) });
    await shot(A, 'food-bite.png');
    await until(async () => (await holding(A)).ready, 4000);
    check('할 일 단추가 남은 입 수를 보여 줌', (await near(A)) === '🍮 푸딩 먹기 ●●○', await near(A));
    check('연달아 눌러도 한꺼번에 줄지 않음(한 입씩)', (await T(A, () => (window.__tree.pressSpace(), window.__tree.pressSpace(), window.__food.holding.left))) === 1);
    await until(async () => (await holding(A)).ready, 4000);
    await A.keyboard.press('Space');
    check('스페이스바로도 먹음. 다 먹으면 빈 접시가 잠깐 남고 알려 줌', await until(async () => { const h = await holding(A); return h && h.shown === 0 && h.ending; }, 3000) && await toastHas(A, '접시만 남았네요') && (await shape(A)).n >= 1 && (await near(A)) === '🍮 잘 먹었어요', { h: await holding(A), s: await shape(A), near: await near(A) });
    check('잠시 뒤 손이 비고 할 일 단추는 다시 냉장고', await until(async () => (await holding(A)) === null, 4000) && await until(async () => (await near(A)) === '🧊 냉장고 열기', 2000), await near(A));

    /* 종류마다: 한 입마다 모양이 달라지고, 입 수만큼 먹으면 끝난다 */
    for (const f of kinds) {
      await T(A, (k) => window.__food.take(k), f.id);
      const sigs = [(await shape(A)).sig];
      let ok = true;
      for (let k = 0; k < f.n; k++) { await bite(A); const h = await holding(A), s = await shape(A); if (!h || h.shown !== f.n - k - 1) ok = false; sigs.push(s ? s.sig : ''); }
      const label = f.sip ? '마시기' : '먹기';
      check(`${f.id}: ${f.n}번 ${label}, 한 입마다 모양이 달라지고 끝남`, ok && new Set(sigs).size === sigs.length && await until(async () => (await holding(A)) === null, 4000), { sigs: sigs.length, uniq: new Set(sigs).size, h: await holding(A) });
      if (f.id === 'milk') check('우유를 마시면 입가에 우유가 묻음', (await T(A, () => window.__food.stache)) === 1);
    }
    check('마시는 것의 단추는 "마시기"', await T(A, () => { window.__food.take('cocoa'); return window.__tree.nearAction(); }) === '☕ 코코아 마시기 ●●●●');
    check('코코아는 들고만 있어도 김이 남', await until(() => T(A, () => window.__food.sparks > 0), 2000));
    await shot(A, 'food-cocoa.png');

    /* 도로 넣기, 바꿔 들기 */
    await T(A, () => window.__tree.useItem('fr')); await until(async () => (await mode(A)) === 'fridge', 4000);
    check('들고서 냉장고를 누르면 판에 "도로 넣기"가 보이고 든 것이 표시됨', await A.isVisible('#fridgeBack') && (await A.getAttribute('#fridgeList .fd[data-v="cocoa"]', 'aria-pressed')) === 'true' && (await audit(A)).length === 0, await audit(A));
    await A.tap('#fridgeList .fd[data-v="pizza"]');
    check('다른 것을 고르면 바꿔 듦', (await holding(A)).kind === 'pizza' && (await mode(A)) === null);
    await T(A, () => window.__tree.useItem('fr')); await until(async () => (await mode(A)) === 'fridge', 4000);
    await A.tap('#fridgeBack');
    check('"도로 넣기"를 누르면 손이 빔', (await holding(A)) === null && !(await A.isVisible('#fridgeBack')));
    await T(A, () => window.__tree.goTo(0, 2)); 
    check('냉장고에서 멀어지면 판이 닫히고 문도 닫힘', await until(async () => (await mode(A)) === null && (await doors(A)).length === 0, 8000), { m: await mode(A), d: await doors(A) });

    /* 케이크와 겹칠 때 */
    await T(A, () => { window.__tree.me.stop(); window.__food.take('cookie'); window.__tree.dispatch({ t: 'cakeTake', id: 'ck', by: window.__duo.me }); });
    check('케이크를 들면 들고 있던 음식은 내려놓음', await until(async () => (await holding(A)) === null, 2000));
    check('케이크를 든 채로는 꺼낼 수 없고 알려 줌', (await T(A, () => window.__food.take('cookie'))) === false && await toastHas(A, '케이크를 내려놓고'));
    await T(A, () => window.__tree.putDown('tb')); await until(() => T(A, () => window.__tree.cakeAt('ck').on === 'tb'), 15000);

    /* 여럿이 */
    await T(A, () => window.__duo.invite());
    await until(() => T(A, () => window.__duo.mode === 'waiting'));
    await stand(A, 3.5, -3.0);
    await T(A, () => window.__food.take('juice'));
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=fb#r=${room}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 2, 20000);
    const others = (p) => T(p, () => window.__food.others);
    check('나중에 온 친구에게도 내가 든 주스가 보임(손에 붙어 있음)', await until(async () => { const o = (await others(B))[0]; return o && o.kind === 'juice' && o.left === 3 && o.onArm; }, 8000), await others(B));
    await bite(A);
    check('한 모금 마시면 친구 화면에서도 마시는 몸짓을 하고 음료가 줄고 말이 뜸', await until(async () => { const o = (await others(B))[0]; return o && o.shown === 2 && o.said === '쪼옥'; }, 4000), await others(B));
    await bite(A); await bite(A);
    check('다 마시면 친구 화면에서도 빈 컵이 잠깐 남았다가 없어짐', await until(async () => (await others(B)).length === 0, 6000), await others(B));
    await T(A, () => window.__tree.useItem('fr')); await until(async () => (await mode(A)) === 'fridge', 4000);
    check('냉장고를 열면 친구 화면에서도 문이 열리고 선반이 보임', await until(async () => { const d = (await doors(B))[0]; return d && d.id === 'fr' && d.a === 1 && d.shelf === kinds.length; }, 5000), await doors(B));
    await A.tap('#fridgeList .fd[data-v="chicken"]');
    check('닫으면 친구 화면에서도 닫히고, 꺼낸 치킨이 보임', await until(async () => (await doors(B)).length === 0 && ((await others(B))[0] || {}).kind === 'chicken', 5000), { d: await doors(B), o: await others(B) });
    await T(A, () => window.__tree.useItem('fr')); await until(async () => (await mode(A)) === 'fridge', 4000);
    await A.tap('#fridgeBack'); await A.tap('#fridgeClose');
    check('도로 넣으면 친구 화면에서도 없어짐', await until(async () => (await others(B)).length === 0, 4000), await others(B));

    /* 이상한 소식 */
    await until(async () => (await doors(B)).length === 0, 4000);
    const aid = await T(B, () => window.__duo.others[0].id);
    const bad = await T(B, (id) => ['h:bomb:2', 'h:cookie:9', 'h:cookie:-1', 'h:cookie', 'o:nope', 'o:fr:1', 'z:1', 'h:cookie:1:' + 'x'.repeat(40), 5].map((v) => window.__food.peerFx({ k: 'food', v }, id)), aid);
    check('없는 종류·틀린 입 수·없는 냉장고·긴 소식은 받지 않음', bad.every((x) => x === false) && (await others(B)).length === 0 && (await doors(B)).length === 0, bad);
    check('모르는 사람의 소식은 받지 않음', (await T(B, () => window.__food.peerFx({ k: 'food', v: 'h:cookie:3' }, 'nobody'))) === false);

    /* 구경하는 사람도 먹는다 */
    const C = await open(ctx, `${BASE}?net=bc&door=0&ns=fc#v=${room.split('-')[0]}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && !(await T(C, () => window.__duo.canEdit)), 20000);
    await stand(C, 3.0, -3.0); await sleep(400);
    const nc = await near(C);
    check('구경하는 사람도 냉장고를 열 수 있음', nc === '🧊 냉장고 열기' && await T(C, () => (window.__tree.pressSpace(), true)) && await until(async () => (await mode(C)) === 'fridge', 4000), { nc, mode: await mode(C), count: await T(A, () => window.__duo.count), edit: await T(C, () => window.__duo.canEdit), at: await T(C, () => [window.__tree.me.x, window.__tree.me.z, window.__tree.S.items.has('fr')]) });
    await C.tap('#fridgeList .fd[data-v="icecream"]'); await bite(C);
    const cid = await T(C, () => window.__duo.me);
    check('구경하는 사람이 먹는 것이 주인과 친구에게 보임', await until(async () => { const a = (await others(A)).find((o) => o.who === cid), b = (await others(B)).find((o) => o.who === cid); return a && b && a.kind === 'icecream' && a.shown === 3 && b.shown === 3; }, 6000), { a: await others(A), b: await others(B) });
    await C.close();
    check('먹던 사람이 나가면 그 사람의 음식도 없어짐', await until(async () => (await others(A)).length === 0 && (await others(B)).length === 0, 12000), await others(A));

    /* 냉장고를 치울 때 */
    await T(A, () => window.__tree.useItem('fr')); await until(async () => (await mode(A)) === 'fridge' && (await doors(B)).length === 1, 5000);
    await T(A, () => window.__tree.dispatch({ t: 'del', id: 'fr' }));
    check('열어 둔 냉장고를 치우면 판이 닫히고 양쪽에서 문 기록이 없어짐', await until(async () => (await mode(A)) === null && (await doors(A)).length === 0 && (await doors(B)).length === 0, 5000), { a: await doors(A), b: await doors(B) });
    check('방의 상태는 그대로 같음(먹는 것은 방에 저장되지 않음)', (await T(A, () => window.__duo.hash())) === (await T(B, () => window.__duo.hash())) && !JSON.stringify(await T(A, () => window.__tree.serialize())).includes('cookie'));
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) { check('검사 도중 오류 없음', false, String(e && e.stack || e)); }
  await browser.close(); server.close();
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass} / ${results.length} 통과`);
  process.exit(pass === results.length ? 0 : 1);
})();
