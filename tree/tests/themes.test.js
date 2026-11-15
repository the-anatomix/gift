// 테마 소품 검사 (spots.js, karaoke.js, costume.js 의 수면양말): 가구 목록 · 소파·의자에 앉기 · 커피 내리기(갈기·추출·맛·들고 마시기) · 디저트·코코아·구운 계란·젤리 꺼내 먹기
// · 책 읽기 · 폭죽·지구본·불가마·트램펄린(친구 화면에도) · 찜질 매트에 눕기 · 안마의자 · 노래방(가사와 음 수·부르기·점수·기록·친구에게 알림) · 찜질방·젤리방 테마 · 수면양말·양머리 수건·찜질복
// 실행: cd tree/tests && node themes.test.js   (화면 사진은 out/themes-*.png)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8241, BASE = `http://localhost:${PORT}/tree/`, OUT = path.join(__dirname, 'out');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const HASH = '784fab8e1ed8c33f4f76b49522a65591e94c9d7834cd8a4ad625fbc1a87bdb10';
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const T = (p, fn, arg) => p.evaluate(fn, arg);
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__spots && window.__sing && window.__tree.frames > 3)), 30000);
async function open(ctx, url, master) {
  const p = await ctx.newPage();
  await p.addInitScript((mk) => { window.__bare = true; if (mk) localStorage.setItem('tree.master.' + new URLSearchParams(location.search).get('ns'), mk); }, master ? HASH : '');
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const shot = (p, name) => p.screenshot({ path: path.join(OUT, `themes-${name}.png`) });
const mode = (p) => T(p, () => window.__tree.mode);
const toast = (p) => p.textContent('#toast');
const toastHas = (p, t, ms = 4000) => until(async () => (await toast(p)).includes(t), ms);
const holding = (p) => T(p, () => window.__food.holding);
const idOf = (p, k, n = 0) => T(p, ([k, n]) => { const l = [...window.__tree.S.items.values()].filter((x) => x.k === k && /^1t/.test(x.id)); return l[n] ? l[n].id : null; }, [k, n]);
// 2층의 그 가구 앞에 세운다 (걸어가는 시간을 줄인다)
const front = (p, id) => T(p, (id) => { const W = window.__tree, it = W.S.items.get(id); W.getUp(); W.me.stop(); W.me.place(-4 + (it.i + 0.5) * 0.5, -4 + (it.j + 0.5) * 0.5 + 0.5); W.snapView(); }, id);
const use = async (p, id) => { await T(p, () => { if (window.__tree.mode !== null) window.__tree.setMode(null); window.__tree.getUp(); }); await T(p, (id) => window.__tree.useItem(id), id); };
const theme = async (p, id) => { await T(p, () => { if (window.__tree.mode !== null) window.__tree.setMode(null); window.__tree.getUp(); }); const n = await T(p, (id) => window.__build.apply(1, id), id); await sleep(500); return n; };
const rest = (p) => T(p, () => { const m = window.__tree.me; return m.rest ? { id: m.rest.id, sit: !!m.rest.sit, y: m.root.position.y - window.__tree.FLOOR_H } : null; });
const bite = async (p) => { const h = await holding(p); await T(p, () => window.__tree.pressSpace()); await until(async () => { const n = await holding(p); return !n || (n.shown < h.shown && (n.ready || n.ending)); }, 6000); };
const audit = (p, sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((b) => b.getBoundingClientRect().width && !b.closest('[hidden]')).map((b) => [b.textContent.trim(), b.getBoundingClientRect()]).filter(([, r]) => r.width < 43.5 || r.height < 43.5 || r.left < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5).map(([t, r]) => `${t}: ${Math.round(r.width)}×${Math.round(r.height)}`), sel);
const serve = () => http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = serve();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=ta`, true);
    await T(A, () => window.__duo.invite());
    await until(() => T(A, () => window.__duo.mode === 'waiting'));
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=tb#r=${room}`, false);
    await until(async () => (await T(A, () => window.__duo.count)) === 2, 20000);
    const aid = await T(A, () => window.__duo.me);
    await A.bringToFront();
    // 둘 다 2층으로
    for (const p of [A, B]) await T(p, () => { const W = window.__tree; W.me.place(-4 + (32 + 8.5) * 0.5, -4 + 9.5 * 0.5); W.snapView(); });
    await sleep(600);

    /* 가구 목록 */
    await A.tap('#tabs button[data-m="furn"]'); await sleep(300);
    const picks = await T(A, () => [...document.querySelectorAll('#furnList .pick')].map((b) => b.textContent.trim()));
    const NEW = ['에스프레소 머신', '디저트 진열장', '카페 탁자', '카페 의자', '메뉴판', '노래방 기계', '미러볼', '스피커', '흔들의자', '무쇠 난로', '장작 더미', '풍선 다발', '파티 폭죽', '독서 책상', '지구본', '불가마', '찜질 매트', '찜질방 매점', '안마의자', '젤리 기계', '큰 곰젤리 (딸기)', '큰 곰젤리 (멜론)', '큰 곰젤리 (레몬)', '젤리 방석', '젤리 트램펄린'];
    check('가구 탭에 테마 소품 25가지가 나옴 (모두 79가지, 누구나 직접 놓는다)', NEW.every((n) => picks.some((t) => t.includes(n))) && picks.length === 79, [picks.length, NEW.filter((n) => !picks.some((t) => t.includes(n)))]);
    await A.tap('#tabs button[data-m="furn"]'); await sleep(200);
    const themesUi = await T(A, () => window.__build && [...document.querySelectorAll('#mkThemes .chip')].map((b) => b.dataset.id));
    check('테마가 여덟 가지: 찜질방과 젤리방이 더해짐', themesUi.length === 8 && themesUi.includes('jjim') && themesUi.includes('jelly'), themesUi);

    /* 카페: 앉기 */
    check('2층에 ☕ 카페 테마 (에스프레소 머신·디저트 진열장·카페 탁자 넷·의자 여덟·메뉴판)', (await theme(A, 'cafe')) === (await T(A, () => window.__build.known('cafe'))) && await T(A, () => { const k = [...window.__tree.S.items.values()].filter((x) => /^1t/.test(x.id)).map((x) => x.k); const n = (q) => k.filter((x) => x === q).length; return n('espresso') === 1 && n('dessert') === 1 && n('cafetable') === 4 && n('cafechair') === 8 && n('menu') === 1; }));
    await until(async () => (await idOf(B, 'espresso')) !== null, 5000);
    const sofa = await idOf(A, 'sofa'), cch = await idOf(A, 'cafechair'), esp = await idOf(A, 'espresso'), des = await idOf(A, 'dessert');
    await front(A, cch);
    check('카페 의자 앞: "💺 앉기"', (await T(A, () => window.__tree.nearAction())) === '💺 앉기', await T(A, () => window.__tree.nearAction()));
    await use(A, cch);
    check('카페 의자에 앉음 (한 자리, 앉는 판 높이)', await until(async () => { const r = await rest(A); return r && r.id === cch && r.sit && Math.abs(r.y - 0.13) < 0.03; }, 8000), await rest(A));
    check('친구 화면에서도 그 의자에 앉아 있음', await until(() => T(B, (c) => window.__duo.others.some((o) => o.lying && o.lying.id === c), cch), 4000), await T(B, () => window.__duo.others.map((o) => o.lying)));
    await sleep(300); await shot(A, 'cafe-sit');
    await T(A, (id) => { const W = window.__tree, it = W.S.items.get(id); W.getUp(); W.me.place(-4 + (it.i + 2) * 0.5, -4 + (it.j - 1.5) * 0.5); W.snapView(); }, sofa); // 소파 앞(북쪽)에 세운다
    await use(A, sofa);
    check('소파에도 앉을 수 있음 (두 자리)', await until(async () => { const r = await rest(A); return r && r.id === sofa && r.sit && Math.abs(r.y - 0.18) < 0.03; }, 12000), await rest(A));
    await T(A, () => window.__tree.getUp());
    check('일어나면 바닥으로', (await rest(A)) === null);

    /* 커피 내리기 */
    await front(A, esp);
    check('에스프레소 머신 앞: "☕ 커피 내리기"', (await T(A, () => window.__tree.nearAction())) === '☕ 커피 내리기', await T(A, () => window.__tree.nearAction()));
    await use(A, esp);
    check('누르면 커피 내리기 놀이가 열림 (마실 것 네 가지)', await until(async () => (await mode(A)) === 'play' && (await T(A, () => window.__spots.brew)) !== null, 6000) && (await A.locator('#playBtns [id^="drink-"]').count()) === 4 && (await T(A, () => window.__spots.brew.phase)) === 'menu');
    check('폰(375×812)에서 단추가 화면 안·44px 이상', (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    await A.tap('#drink-latte');
    check('카페라떼를 고름', (await T(A, () => window.__spots.brew.drink)) === 'latte' && (await A.getAttribute('#drink-latte', 'aria-pressed')) === 'true');
    for (let k = 0; k < 4; k++) { await A.tap('#playGo'); await sleep(120); }
    check('원두 갈기: 네 번 누르면 아직 가는 중', await T(A, () => { const b = window.__spots.brew; return b.phase === 'grind' && b.ground === 4 && !b.bar; }), await T(A, () => window.__spots.brew));
    await A.tap('#playGo');
    check('다섯 번째에 추출이 시작됨 (눈금이 보이고 커피 줄기가 내려옴)', await until(() => T(A, () => { const b = window.__spots.brew; return b.phase === 'brew' && b.bar && b.stream && b.heat > 0.02; }), 3000), await T(A, () => window.__spots.brew));
    await sleep(400); await shot(A, 'cafe-brew');
    await T(A, () => { window.__spots.setHeat(0.74); document.getElementById('playGo').click(); });
    check('초록 칸 한가운데에서 멈추면 "완벽한 한 잔"', (await T(A, () => window.__spots.brew.q)) === 'perfect' && (await A.textContent('#playMain')).includes('완벽한 한 잔'), await T(A, () => window.__spots.brew));
    await A.tap('#playGo');
    check('들고 가기: 놀이가 닫히고 카페라떼를 손에 듦 (네 모금)', await until(async () => { const h = await holding(A); return (await mode(A)) === null && h && h.kind === 'latte' && h.left === 4; }, 3000), await holding(A));
    check('친구 화면에서도 카페라떼를 들고 있음', await until(() => T(B, () => window.__food.others.some((o) => o.kind === 'latte' && o.left === 4)), 5000), await T(B, () => window.__food.others));
    await bite(A);
    check('마시면 한 모금 줄어듦', (await holding(A)).left === 3, await holding(A));
    await use(A, cch);
    check('커피를 든 채로 카페 의자에 앉을 수 있고, 앉아서도 마심', await until(async () => { const r = await rest(A); return r && r.sit; }, 8000) && (await bite(A), (await holding(A)).left === 2), [await rest(A), await holding(A)]);
    await sleep(300); await shot(A, 'cafe-sip');
    await T(A, () => window.__food.stow());
    // 맛: 연하게, 쓰게
    await use(A, esp); await until(async () => (await mode(A)) === 'play', 6000);
    for (let k = 0; k < 5; k++) { await A.tap('#playGo'); await sleep(80); }
    await T(A, () => window.__spots.setHeat(0.2)); await A.tap('#playGo');
    check('너무 일찍 멈추면 "조금 연해요"', (await T(A, () => window.__spots.brew.q)) === 'weak');
    await A.tap('#playAgain');
    for (let k = 0; k < 5; k++) { await A.tap('#playGo'); await sleep(80); }
    await T(A, () => window.__spots.setHeat(1.2));
    check('끝까지 두면 저절로 멈추고 "조금 써요", 그래도 들고 갈 수 있음 (아메리카노)', await until(() => T(A, () => window.__spots.brew.q === 'bitter'), 3000) && (await A.tap('#playGo'), await until(async () => { const h = await holding(A); return h && h.kind === 'americano'; }, 3000)), await T(A, () => window.__spots.brew));
    await T(A, () => window.__food.stow());

    /* 디저트 진열장 */
    await use(A, des);
    check('디저트 진열장: 다섯 가지 중에 고름', await until(async () => (await mode(A)) === 'play', 6000) && (await A.locator('#playBtns [id^="serve-"]').count()) === 5 && (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    await A.tap('#serve-macaron');
    check('마카롱을 꺼내 듦 (두 입)', await until(async () => { const h = await holding(A); return (await mode(A)) === null && h && h.kind === 'macaron' && h.left === 2; }, 3000), await holding(A));
    await bite(A); await bite(A);
    check('두 입에 다 먹음', await until(async () => { const h = await holding(A); return !h || h.left === 0; }, 4000), await holding(A));
    await until(async () => (await holding(A)) === null, 5000);

    /* 산장 */
    await theme(A, 'lodge');
    const pot = await idOf(A, 'potbelly'), rock = await idOf(A, 'rocker');
    await front(A, pot);
    check('무쇠 난로 앞: "☕ 코코아 따르기"', (await T(A, () => window.__tree.nearAction())) === '☕ 코코아 따르기', await T(A, () => window.__tree.nearAction()));
    await use(A, pot);
    check('누르면 바로 코코아를 듦 (판이 열리지 않음)', await until(async () => { const h = await holding(A); return h && h.kind === 'cocoa' && (await mode(A)) === null; }, 6000), [await holding(A), await mode(A)]);
    await T(A, () => window.__food.stow());
    await use(A, rock);
    check('흔들의자에 앉음', await until(async () => { const r = await rest(A); return r && r.id === rock && r.sit; }, 10000), await rest(A));
    await sleep(300); await shot(A, 'lodge');

    /* 서재 */
    await theme(A, 'library');
    const desk = await idOf(A, 'readdesk'), globe = await idOf(A, 'globe');
    await use(A, desk);
    check('독서 책상: 이야기의 첫 장이 펼쳐짐', await until(async () => (await mode(A)) === 'play' && (await T(A, () => window.__spots.reading)) !== null, 8000) && (await A.textContent('#playMain')).includes('(1/4)') && (await A.textContent('#playSub')).length > 20, await A.textContent('#playMain'));
    const b0 = (await T(A, () => window.__spots.reading)).book;
    for (let k = 0; k < 3; k++) await A.tap('#playGo');
    check('다음 장을 넘겨 끝까지 읽음 (4/4, 앞 장으로도 갈 수 있음)', (await T(A, () => window.__spots.reading.page)) === 3 && (await A.textContent('#playSub')).includes('끝') && await A.isVisible('#readPrev') && (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    await sleep(200); await shot(A, 'library-read');
    await A.tap('#playGo');
    check('다 읽으면 다른 책을 읽을 수 있음', await T(A, (b0) => { const r = window.__spots.reading; return r.book !== b0 && r.page === 0; }, b0));
    check('이야기는 세 편, 네 장씩', await T(A, () => window.__spots.STORIES.length === 3 && window.__spots.STORIES.every((s) => s.pages.length === 4)));
    await use(A, globe);
    check('지구본을 누르면 빠르게 돎 (친구 화면에서도)', await until(() => T(A, (id) => window.__spots.stateOf(id).vel > 3, globe), 6000) && await until(() => T(B, (id) => window.__spots.stateOf(id).vel > 1, globe), 3000));
    check('멈추면 어디인지 알려 줌', await toastHas(A, '🌍', 6000), await toast(A));

    /* 파티룸 */
    await theme(A, 'party');
    const pop = await idOf(A, 'popper');
    await front(A, pop);
    check('파티 폭죽 앞: "🎉 폭죽 터뜨리기"', (await T(A, () => window.__tree.nearAction())) === '🎉 폭죽 터뜨리기', await T(A, () => window.__tree.nearAction()));
    const sp0 = await T(B, () => window.__food.sparks);
    await use(A, pop);
    check('터뜨리면 색종이가 쏟아지고 만세를 함 (친구 화면에도 색종이)', await until(() => T(A, () => window.__food.sparks > 20 && window.__tree.me.doing && window.__tree.me.doing.id === 'cheer'), 6000) && await until(() => T(B, () => window.__food.sparks > 20), 3000), [await T(A, () => window.__food.sparks), sp0]);
    await sleep(250); await shot(A, 'party-pop');
    check('파티룸에 풍선 다발과 미러볼', await T(A, () => { const k = [...window.__tree.S.items.values()].filter((x) => /^1t/.test(x.id)).map((x) => x.k); return k.filter((x) => x === 'balloons').length >= 4 && k.includes('mirrorball'); }));

    /* 찜질방 */
    check('2층에 ♨️ 찜질방 테마 (불가마·찜질 매트·매점·안마의자)', (await theme(A, 'jjim')) === (await T(A, () => window.__build.known('jjim'))) && (await T(A, () => window.__tree.room.themeOf(1))) === 'jjim' && await until(() => T(B, () => window.__tree.room.themeOf(1) === 'jjim'), 5000));
    const mat = await idOf(A, 'jjimmat'), kiln = await idOf(A, 'kiln'), snack = await idOf(A, 'snackbar'), chairM = await idOf(A, 'massage', 1);
    await sleep(400); await shot(A, 'jjim');
    await use(A, mat);
    check('찜질 매트에 누움 (한 사람, 바닥 가까이)', await until(async () => { const r = await rest(A); return r && r.id === mat && !r.sit && Math.abs(r.y - 0.09) < 0.03; }, 10000) && (await toast(A)).includes('찜질 매트에 누웠어요'), [await rest(A), await toast(A)]);
    check('누워 있는 동안의 판에 "찜질 매트에 누워 있어요"', (await A.textContent('#lieP .hint')).includes('찜질 매트'), await A.textContent('#lieP .hint'));
    await sleep(300); await shot(A, 'jjim-lie');
    await use(A, kiln);
    check('불가마 찜질: 땀방울이 나고 (친구 화면에서도 그 사람에게), 끝나면 "시원하다"', await until(() => T(A, () => window.__spots.sweating.includes('me')), 10000) && await until(() => T(B, (a) => window.__spots.sweating.includes(a), aid), 3000) && await toastHas(A, '시원하다', 8000), [await T(A, () => window.__spots.sweating), await T(B, () => window.__spots.sweating)]);
    await use(A, snack);
    await until(async () => (await mode(A)) === 'play', 8000);
    await A.tap('#serve-egg');
    check('매점에서 구운 계란을 꺼냄', await until(async () => { const h = await holding(A); return h && h.kind === 'egg' && h.left === 3; }, 3000), await holding(A));
    await bite(A);
    check('첫 입은 껍데기를 "탁!" 깸', (await holding(A)).said === '탁!', await holding(A));
    await T(A, () => window.__food.stow());
    await use(A, snack); await until(async () => (await mode(A)) === 'play', 8000); await A.tap('#serve-sikhye');
    check('식혜도 마실 수 있음 (네 모금)', await until(async () => { const h = await holding(A); return h && h.kind === 'sikhye' && h.left === 4; }, 3000) && (await bite(A), (await holding(A)).said === '시원~'), await holding(A));
    await T(A, () => window.__food.stow());
    await use(A, chairM);
    check('안마의자에 앉으면 의자가 덜덜 떨림', await until(async () => { const r = await rest(A); return r && r.id === chairM && r.sit; }, 12000) && await until(() => T(A, () => window.__sfx.log.some((l) => l.n === 'hum')), 3000), await rest(A));

    /* 젤리방 */
    check('2층에 🍬 젤리방 테마 (젤리 기계·큰 곰젤리 세 가지 색·젤리 방석·트램펄린)', (await theme(A, 'jelly')) === (await T(A, () => window.__build.known('jelly'))) && await T(A, () => { const k = [...window.__tree.S.items.values()].filter((x) => /^1t/.test(x.id)).map((x) => x.k); return ['jellybar', 'jellybear', 'jellybear2', 'jellybear3', 'jellycube', 'jellypad'].every((q) => k.includes(q)); }));
    const jbar = await idOf(A, 'jellybar'), cube = await idOf(A, 'jellycube'), pad = await idOf(A, 'jellypad');
    await sleep(400); await shot(A, 'jelly');
    await use(A, jbar); await until(async () => (await mode(A)) === 'play', 8000);
    check('젤리 기계: 곰젤리·꿈틀이·하트 젤리·푸딩', (await A.locator('#playBtns [id^="serve-"]').count()) === 4 && (await A.textContent('#playMain')).includes('젤리 기계'));
    await A.tap('#serve-gummy');
    check('곰젤리를 꺼내 먹음 ("쫀득")', await until(async () => { const h = await holding(A); return h && h.kind === 'gummy' && h.left === 3; }, 3000) && (await bite(A), (await holding(A)).said === '쫀득'), await holding(A));
    await T(A, () => window.__food.stow());
    await use(A, cube);
    check('젤리 방석에 앉음', await until(async () => { const r = await rest(A); return r && r.id === cube && r.sit; }, 10000), await rest(A));
    await use(A, pad);
    check('젤리 트램펄린: 그 위로 올라가 통통 뜀 (친구 화면에서도 출렁임)', await until(() => T(A, (id) => window.__spots.stateOf(id).kick > 0 && window.__tree.me.doing && window.__tree.me.doing.id === 'jump', pad), 10000)
      && await T(A, (id) => { const W = window.__tree, it = W.S.items.get(id); return Math.hypot(W.me.x - (-4 + (it.i + 1) * 0.5), W.me.z - (-4 + (it.j + 1) * 0.5)) < 0.3; }, pad) && await until(() => T(B, (id) => window.__spots.stateOf(id).kick > 0, pad), 4000), await T(A, (id) => window.__spots.stateOf(id), pad));
    await sleep(300); await shot(A, 'jelly-bounce');
    await until(() => T(A, () => window.__spots.hops === 0), 8000);

    /* 노래방 */
    await theme(A, 'karaoke');
    const kara = await idOf(A, 'karaoke');
    check('노래마다 가사의 글자 수와 음 수가 같음', await T(A, () => Object.keys(window.__sing.KARA).every((id) => { const c = window.__sing.chart(id); return c && c.notes.length === c.lines.reduce((n, l) => n + l.length, 0) && c.notes.every((n) => c.lines[n.line] && c.lines[n.line][n.k]); })), await T(A, () => Object.keys(window.__sing.KARA).map((id) => { const c = window.__sing.chart(id); return [id, c.notes.length, c.lines.reduce((n, l) => n + l.length, 0)]; })));
    await front(A, kara);
    check('노래방 기계 앞: "🎤 노래 부르기"', (await T(A, () => window.__tree.nearAction())) === '🎤 노래 부르기', await T(A, () => window.__tree.nearAction()));
    await use(A, kara);
    check('누르면 노래 고르기 (세 곡)', await until(async () => (await mode(A)) === 'play' && (await T(A, () => window.__sing.state)) !== null, 8000) && (await A.locator('#playBtns [id^="sing-"]').count()) === 3 && (await T(A, () => window.__sing.state.phase)) === 'pick' && (await audit(A, '#playBtns button')).length === 0, await audit(A, '#playBtns button'));
    await A.tap('#sing-wish');
    check('노래를 고르면 시작: 화면에 가사와 음 막대, 🎤 단추', await until(() => T(A, () => { const s = window.__sing.state; return s.phase === 'run' && s.song === 'wish' && s.shown && s.notes === 30; }), 3000) && (await A.textContent('#playGo')).includes('🎤') && (await audit(A, '#playBtns button')).length === 0, await T(A, () => window.__sing.state));
    check('친구에게 알림: "노래를 불러요", 같은 층이라 반주가 들림', await toastHas(B, '노래를 불러요', 4000) && await T(B, () => { const s = window.__sing.singers; return s.length === 1 && s[0].song === 'wish' && s[0].heard; }), [await toast(B), await T(B, () => window.__sing.singers)]);
    await T(A, () => { window.__sing.seek(-0.5); window.__sing.hit(); });
    check('음이 없는 곳에서 누르면 "삑!"', (await T(A, () => window.__sing.state.say)) === '삑!' && (await T(A, () => window.__sing.state.hits)) === 0);
    await sleep(500); await shot(A, 'karaoke-sing');
    // 음마다 제때 누른다
    await T(A, () => { const c = window.__sing.chart('wish'); for (const n of c.notes) { window.__sing.seek(n.t + 0.01); window.__sing.hit(); } });
    check('모든 음을 제때 누르면 PERFECT 서른 번', await T(A, () => { const s = window.__sing.state; return s.hits === 30 && s.sum === 3000 && s.say === 'PERFECT'; }), await T(A, () => window.__sing.state));
    await T(A, () => window.__sing.seek(window.__sing.chart('wish').end + 0.1));
    check('끝나면 100점, 만세, 이 방 기록과 순위에 남음', await until(() => T(A, () => window.__sing.state.phase === 'done'), 3000) && (await A.textContent('#playMain')).includes('100점') && await until(() => T(A, () => { const b = window.__tree.S.best.sing; return b && b.v === 100; }), 3000), [await A.textContent('#playMain'), await T(A, () => window.__tree.S.best)]);
    check('친구에게 점수가 알려짐', await toastHas(B, '100점', 4000) && await until(() => T(B, () => window.__sing.singers.length === 0), 2000), await toast(B));
    await sleep(300); await shot(A, 'karaoke-score');
    await A.tap('#playAgain'); await A.tap('#sing-jingle');
    await until(() => T(A, () => window.__sing.state.phase === 'run'), 3000);
    await T(A, () => window.__sing.seek(window.__sing.chart('jingle').end + 0.1));
    check('하나도 안 누르면 0점 (기록에 안 남음)', await until(() => T(A, () => window.__sing.state.phase === 'done' && window.__sing.state.score === 0), 3000) && (await T(A, () => window.__tree.S.best.sing.v)) === 100);
    await A.tap('#sing-jingle').catch(() => {}); await A.tap('#playGo'); await until(() => T(A, () => window.__sing.state.phase === 'run'), 3000);
    await A.tap('#playQuit');
    check('부르다 그만두면 친구 쪽에서도 멈춤', (await mode(A)) === null && await until(() => T(B, () => window.__sing.singers.length === 0), 3000));
    check('노래방 테마에 노래방 기계 둘, 스피커, 미러볼', await T(A, () => { const k = [...window.__tree.S.items.values()].filter((x) => /^1t/.test(x.id)).map((x) => x.k); const n = (q) => k.filter((x) => x === q).length; return n('karaoke') === 2 && n('speaker') === 4 && n('mirrorball') === 2; }));

    /* 수면양말, 양머리 수건, 찜질복 */
    const meshes = () => T(A, () => { let n = 0; window.__tree.me.root.traverse((o) => { if (o.isMesh) n++; }); return n; });
    const m0 = await meshes();
    await T(A, () => window.__tree.openLook(true)); await sleep(300);
    check('캐릭터 판에 "양말" 갈래가 있고, 갈래 단추가 화면 안·44px 이상', (await A.isVisible('#cosTabs [data-v="sock"]')) && (await audit(A, '#cosTabs button')).length === 0, await audit(A, '#cosTabs button'));
    await A.tap('#cosTabs [data-v="sock"]'); await sleep(200);
    check('양말 갈래: 없음과 수면양말 네 가지 색', (await A.locator('#pickSock [data-v]').count()) === 5 && (await A.textContent('#pickSock')).includes('수면 분홍'));
    await A.tap('#pickSock [data-v="sleep"]'); await sleep(300);
    check('수면양말을 신으면 생김새에 남고 두 발에 양말이 생김', (await T(A, () => window.__tree.look.sock)) === 'sleep' && (await meshes()) >= m0 + 10, [await T(A, () => window.__tree.look), m0, await meshes()]);
    check('친구 화면에서도 수면양말을 신고 있음', await until(() => T(B, () => window.__duo.others.some((o) => o.look.sock === 'sleep')), 4000), await T(B, () => window.__duo.others.map((o) => o.look)));
    await sleep(200); await shot(A, 'socks');
    check('양머리 수건(모자)과 찜질복(옷)도 고를 수 있음', await T(A, () => { const W = window.__tree; W.setLook({ outfit: 'jjim', hat: 'yang' }); return W.look.outfit === 'jjim' && W.look.hat === 'yang' && W.look.sock === 'sleep'; }));
    await sleep(300); await shot(A, 'jjim-look');
    check('모르는 양말 값은 "없음"으로', await T(A, () => { const W = window.__tree; W.setLook({ sock: 'zzz' }); return W.look.sock === ''; }));
    await T(A, () => window.__tree.openLook(false));

    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) { console.log('검사 중 오류:', e); results.push(false); }
  await browser.close(); server.close();
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok}/${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
