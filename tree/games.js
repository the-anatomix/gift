// 같이 놀기: 방 사람들이 한 판씩 같이 하는 놀이. 숨바꼭질(2명 이상), 몰래 산타(3명 이상).
//
// 틀 (두 놀이가 같이 쓴다)
//   - 도구 단추 "🎲 같이 놀기" → 놀이 고르기 판. 꾸밀 수 있는 사람이 시작하고, 시작한 사람의 화면이 그 판의 "심판"이다.
//     심판이 시간을 재고, 역할을 뽑고, 판정한다. 한 번에 한 판만. 심판이 나가면 판은 취소된다.
//   - 판의 진행은 방의 상태가 아니다(저장하지 않는다). 모두 놀이 소식 { k: 'gm', v: JSON 글 } 으로 전한다.
//       심판 → 모두  { a: 's', gid, g, ref, ph, left, pl, out, … }   판의 공개 상태 (바뀔 때마다, 새로 온 사람이 있을 때, 4초마다)
//       심판 → 모두  { a: 'x', gid, why }                          판 취소
//       누구 → 심판  { a: 'cl' | 'find' | 'steal' | 'meet' | 'vote', gid, … }   하고 싶은 일 (심판이 맞는지 보고 상태에 넣는다)
//     방장이 모든 소식을 모두에게 전해 주므로 심판이 손님이어도 된다. 받는 쪽은 보낸 사람이 그 판의 심판일 때만 상태를 받는다.
//   - 진행 중에는 화면 위에 상태 띠(놀이 이름, 남은 시간, 내 역할, 심판만 "그만하기"), 끝나면 결과 판.
//   - 판이 시작된 뒤에 들어온 사람은 구경만 한다(명단 pl 에 없다).
//   - 시간은 기기마다 다르므로 "남은 시간(ms)"으로 보내고, 받은 쪽은 자기 시계로 끝나는 때를 셈한다. 판정은 심판의 시계로만 한다.
//
// 숨바꼭질: 술래 한 명. 숨는 시간(HIDE) 동안 술래 화면은 어둡고 움직일 수 없다. 찾기 시간(SEEK) 안에 모두 찾으면 술래 승, 아니면 숨은 사람 승.
//   찾기: 술래가 같은 층에서 1.5 안에 있는 숨은 사람을 누르거나 스페이스바 "🔎 찾았다!". 판정은 술래 화면에서 하고 심판에게 알린다.
//   옷장에 숨기: 숨는 사람이 옷장 앞에서 스페이스바 → 아바타가 모두에게 안 보인다(다시 누르면 나옴). 술래는 옷장 앞에서 "옷장 열어 보기".
//   술래에게는 숨은 사람의 말풍선·행동이 안 보이고, 채팅은 "어디선가 소리가 났어요"로만 보인다. 숨은 사람에게는 술래가 같은 층에 오면 경고.
// 몰래 산타: 한 명이 몰래 산타(그 사람 화면에만 보인다). 트리 가까이에서 "🤫 슬쩍"으로 장식을 하나씩 훔친다(STEAL 마다 한 번).
//   훔친 장식은 판 동안 모두의 화면에서 안 보이기만 하고(방의 상태는 그대로), 판이 끝나면 돌아온다.
//   누구나 한 판에 한 번 "🔔 모이기": 이야기(TALK) → 투표(VOTE). 가장 많은 표를 받은 사람이 몰래 산타면 시민 승, 아니면 그 사람은 빠지고 계속.
//   목표만큼 훔치거나 시간(SANTA)이 끝날 때까지 안 잡히면 몰래 산타 승. 몰래 산타가 누구인지는 심판만 알고, 모두에게는 짧은 표(tag)로만 보낸다.
// app.js 가 넘겨주는 창구 K 로 아바타·장식·소식을 다룬다.
import { cellOf, zoneOf, levelOf, X0, Z0, CELL } from './path.js';
import { kindOf, footprint } from './state.js';

const $ = (id) => document.getElementById(id);
const now = () => (typeof window.__now === 'function' ? window.__now() : Date.now());
const SEC = 1000;
export const HIDE = 20 * SEC, SEEK = 120 * SEC;                                     // 숨바꼭질: 숨는 시간, 찾는 시간
export const SANTA = 300 * SEC, STEAL = 15 * SEC, TALK = 30 * SEC, VOTE = 20 * SEC; // 몰래 산타: 판 시간, 훔치는 간격, 이야기, 투표
export const FIND_R = 1.5;   // 술래가 찾을 수 있는 거리
const TREE_R = 2.4;          // 트리 (0, 0) 에서 이만큼 안이면 슬쩍할 수 있다
const NEAR = 0.8;            // 가구 앞이라고 보는 거리 (app.js 의 nearAction 과 같다)
const GOAL = 5;              // 몰래 산타가 훔칠 장식 수 (장식이 적으면 있는 만큼)
const BEAT = 4 * SEC;        // 심판이 상태를 다시 알리는 간격
export const GAMES = {
  hide: { name: '숨바꼭질', icon: '🙈', need: 2, desc: '술래 한 명이 숨은 사람을 찾아요. 숨기 20초, 찾기 2분. 옷장에도 숨을 수 있어요.' },
  santa: { name: '몰래 산타', icon: '🎅', need: 3, desc: '누군가 몰래 트리 장식을 훔쳐요. 채팅·보이스로 범인을 찾아요. 5분. 4~8명이 가장 재미있어요.' },
};
const okId = (v) => typeof v === 'string' && /^[a-z0-9]{1,8}$/.test(v);
const okIds = (a) => Array.isArray(a) && a.length <= 16 && a.every(okId);
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / SEC)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
// 몰래 산타의 표: 판 이름과 사람 이름으로 만든 짧은 글. 자기 이름으로 만들어 보고 같으면 내가 몰래 산타다
function tagOf(gid, id) {
  const s = gid + ':' + id + ':santa';
  let h = 5381;
  for (let k = 0; k < s.length; k++) h = ((h << 5) + h + s.charCodeAt(k)) | 0;
  return (h >>> 0).toString(36);
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
// 이름 뒤 조사: 받침이 있으면 a, 없으면 b (숫자는 읽는 소리로). '나'는 '내가'처럼 따로
function josa(w, a, b) {
  const c = w.charCodeAt(w.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return w + ((c - 0xAC00) % 28 ? a : b);
  if (c >= 48 && c <= 57) return w + ('0136781'.includes(w[w.length - 1]) ? a : b);
  return w + b;
}

export function makeGames(K) {
  let G = null;        // 지금 판의 공개 상태 (모두가 같다) + end(이 기기 시계로 이번 단계가 끝나는 때)
  let R = null;        // 심판만: { santa, votes: Map, last(마지막 슬쩍), mainLeft, seen: Set, beat }
  let anchor = null;   // 움직이지 못하게 붙잡아 둔 자리 [x, z] (눈 가리는 술래, 옷장 안)
  let pend = null;     // 옷장에 들어가거나 나온다고 보낸 뒤 답을 기다리는 중 { it, at }
  let cdEnd = 0;       // 몰래 산타: 다음 슬쩍을 할 수 있는 때 (내 시계)
  let voted = -1;      // 몰래 산타: 몇 번째 모이기에서 표를 냈는지
  let sameArea = false, uiAt = 0;
  const ended = new Set();            // 끝난 판 (늦게 온 소식을 무시한다)
  const shrunk = new Set();           // 옷장에 숨어서 작게 만든 아바타
  const hidOrn = new Set();           // 숨겨 둔 장식 id
  const tags = new Map();             // 찾힌 사람 머리 위 표시 (id → 요소)

  /* ───────── 화면 ───────── */
  const css = document.createElement('style');
  css.textContent = [
    '#gameBand{position:absolute;left:10px;right:10px;top:calc(56px + env(safe-area-inset-top));margin:0 auto;max-width:460px;z-index:6;display:flex;align-items:center;gap:6px;',
    'padding:4px 4px 4px 12px;border-radius:16px;background:rgba(255,252,245,.96);border:1.5px solid var(--line);box-shadow:0 4px 14px rgba(0,0,0,.28);font-size:13px;font-weight:700;color:var(--ink)}',
    '#gameBand .gt{flex:1;min-width:0;line-height:1.3}#gameBand .gt b{font-weight:900}#gameBand .gt small{display:block;font-size:12px;font-weight:700;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#gameBand .clk{font-variant-numeric:tabular-nums;color:var(--choc);margin-left:4px}#gameBand .btn{padding:0 10px}',
    '#gameBand.warn{border-color:#D9483B;box-shadow:0 0 0 2px rgba(217,72,59,.45),0 4px 14px rgba(0,0,0,.28)}',
    'body.gm #toast{top:calc(118px + env(safe-area-inset-top))}',
    '#gameBlind{position:absolute;inset:0;z-index:5;background:rgba(14,10,22,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#FFF4E0;text-align:center;padding:24px}',
    '#gameBlind b{font-size:44px;font-weight:900}#gameBlind span{font-size:14px;font-weight:600;color:#D9CDE4}',
    '.gameP{position:absolute;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;padding:calc(12px + env(safe-area-inset-top)) 16px calc(12px + env(safe-area-inset-bottom));background:rgba(20,14,28,.55)}',
    '.gameP .sheet{width:100%;max-width:420px;max-height:100%;overflow-y:auto}',
    '.gameP .opt{display:flex;align-items:center;gap:10px;text-align:left;width:100%;min-height:64px;padding:8px 12px}',
    '.gameP .opt b{font-size:28px;font-weight:400}.gameP .opt span{flex:1;min-width:0;font-size:14px;font-weight:800;line-height:1.35}.gameP .opt small{display:block;font-size:12px;font-weight:600;color:var(--sub)}',
    '.gameP .opt:disabled{opacity:.5;cursor:default}',
    '.gameP .big{font-size:18px;font-weight:900;text-align:center;margin:4px 0}.gameP .lines{font-size:13.5px;font-weight:600;line-height:1.55;text-align:center}',
    '#gameVoteList{display:grid;grid-template-columns:1fr 1fr;gap:6px}#gameVoteList .btn{min-width:0}',
    '#gameTags{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}',
    '#gameTags i{position:absolute;left:0;top:0;font-style:normal;padding:2px 8px;border-radius:999px;background:rgba(20,14,28,.82);color:#FFF4E0;font-size:12px;font-weight:800;white-space:nowrap;will-change:transform}',
    '#tools{flex-wrap:wrap-reverse}', // 도구 단추가 화면 너비를 넘으면 위 줄로 넘긴다 (폰에서 🎤 까지 보일 때)
  ].join('');
  document.head.appendChild(css);
  const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (html) e.innerHTML = html; return e; };
  // 도구 단추 (단체 사진 단추 앞)
  const btn = el('button', { type: 'button', class: 'btn', id: 'gameBtn', 'aria-label': '같이 놀기', title: '같이 놀기' }, '🎲');
  const tools = $('tools');
  tools.insertBefore(btn, $('snap') || null);
  const band = el('div', { id: 'gameBand', role: 'status' });
  band.hidden = true;
  band.innerHTML = '<div class="gt"><b id="gameName"></b><span class="clk" id="gameClock"></span><small id="gameRole"></small></div>'
    + '<button type="button" class="btn main" id="gameMeet" hidden>🔔 모이기</button><button type="button" class="btn" id="gameStop" hidden>그만하기</button>';
  const blind = el('div', { id: 'gameBlind', 'aria-live': 'polite' }, '<b id="gameBlindN"></b><span>눈을 가리고 있어요. 친구들이 숨는 동안 기다려요.</span>');
  blind.hidden = true;
  const pickP = el('div', { id: 'gamePick', class: 'gameP', role: 'dialog', 'aria-label': '같이 놀기' });
  pickP.hidden = true;
  pickP.innerHTML = '<div class="sheet"><h2>🎲 같이 놀기 <small id="gamePickSub"></small></h2>'
    + Object.entries(GAMES).map(([id, g]) => `<button type="button" class="btn opt" data-g="${id}"><b>${g.icon}</b><span>${g.name} · ${g.need}명 이상<small>${g.desc}</small></span></button>`).join('')
    + '<div class="hint"><small id="gamePickWhy"></small></div><div class="row"><button type="button" class="btn" id="gamePickClose" style="flex:1">닫기</button></div></div>';
  const voteP = el('div', { id: 'gameVote', class: 'gameP', role: 'dialog', 'aria-label': '투표' });
  voteP.hidden = true;
  voteP.innerHTML = '<div class="sheet"><h2>🔔 누가 몰래 산타일까요? <small id="gameVoteClock"></small></h2><div class="hint"><small id="gameVoteSub"></small></div>'
    + '<div id="gameVoteList"></div></div>';
  const endP = el('div', { id: 'gameEnd', class: 'gameP', role: 'dialog', 'aria-label': '놀이 결과' });
  endP.hidden = true;
  endP.innerHTML = '<div class="sheet"><div class="big" id="gameEndMain"></div><div class="lines" id="gameEndSub"></div><div class="row"><button type="button" class="btn main" id="gameEndClose" style="flex:1">닫기</button></div></div>';
  const tagBox = el('div', { id: 'gameTags', 'aria-hidden': 'true' });
  document.body.append(band, blind, pickP, voteP, endP, tagBox);

  /* ───────── 사람 ───────── */
  const me = () => K.myId();
  const here = (id) => id === me() || K.others().has(id);
  const avatarOf = (id) => (id === me() ? K.me : K.others().get(id));
  const who = (id) => (id === me() ? '나' : K.nameOf(id));
  const names = (ids) => ids.map(who).join(', ');
  const subj = (id) => (id === me() ? '내가' : josa(who(id), '이', '가'));   // 친구1이, 방장이, 내가
  const obj = (id) => josa(who(id), '을', '를');                              // 친구2를, 방장을, 나를
  const top = (id) => (id === me() ? '나는' : josa(who(id), '은', '는'));     // 친구2는
  // 있는 곳: 층(1·2·3층)이나 마당
  function area(a) {
    const lv = levelOf(a.x);
    if (lv) return 'f' + lv;
    const [i, j] = cellOf(a.x, a.z);
    return zoneOf(i, j) === 'yard' ? 'yard' : 'f0';
  }
  const AREA = { f0: '1층', f1: '2층', f2: '3층', yard: '마당' };
  const inGame = (id = me()) => !!G && G.pl.includes(id);
  const isOut = (id = me()) => !!G && G.out.includes(id);
  const alive = () => (G ? G.pl.filter((id) => !G.out.includes(id)) : []);
  const amSanta = () => !!G && G.g === 'santa' && inGame() && G.t === tagOf(G.gid, me());
  const amRef = () => !!G && G.ref === me();
  // 숨바꼭질에서 아직 안 찾힌 숨는 사람인지
  const hiding = (id) => !!G && G.g === 'hide' && G.ph !== 'over' && G.pl.includes(id) && id !== G.sk && !G.out.includes(id);
  const closetOf = (id) => (id === me() && pend ? pend.it : G && G.cl ? G.cl[id] || '' : '');

  /* ───────── 소식 보내기 ───────── */
  const send = (m) => K.fx({ k: 'gm', v: JSON.stringify(m) });
  // 심판: 공개 상태를 모두에게 알리고 내 화면도 맞춘다
  function snap() {
    const s = { a: 's', gid: G.gid, g: G.g, ref: G.ref, ph: G.ph, left: Math.max(0, Math.round(G.end - now())), pl: G.pl, out: G.out };
    if (G.g === 'hide') { s.sk = G.sk; s.cl = G.cl; }
    else { s.t = G.t; s.goal = G.goal; s.st = G.st; s.used = G.used; s.mc = G.mc; s.lo = G.lo; s.by = G.by; s.vn = R.votes.size; s.main = Math.max(0, Math.round(G.ph === 'play' ? G.end - now() : R.mainLeft)); }
    if (G.ph === 'over') Object.assign(s, { win: G.win, who: G.who, why: G.why });
    return s;
  }
  function push(prev) {
    const s = snap();
    R.beat = now();
    send(s);
    changed(prev);
  }
  const copy = () => (G ? JSON.parse(JSON.stringify(G)) : null);

  /* ───────── 시작 ───────── */
  function why(kind) {
    const g = GAMES[kind];
    if (G) return `지금 ${GAMES[G.g].name} 중이에요. 끝나면 새로 시작할 수 있어요`;
    if (!K.online()) return '친구를 초대해서 같이 있어야 놀 수 있어요 (아래 "같이" 탭)';
    if (!K.canEdit()) return '놀이는 꾸밀 수 있는 사람이 시작해요';
    const n = K.others().size + 1;
    if (n < g.need) return `${josa(g.name, '은', '는')} ${g.need}명 이상이어야 해요 (지금 ${n}명)`;
    if (kind === 'santa' && !K.orns().size) return '트리에 장식이 있어야 몰래 산타를 할 수 있어요';
    return '';
  }
  function start(kind) {
    if (!GAMES[kind]) return false;
    const w = why(kind);
    if (w) { K.toast(w); return false; }
    const pl = [me(), ...K.others().keys()].filter(okId);
    G = { gid: now().toString(36) + Math.random().toString(36).slice(2, 5), g: kind, ref: me(), pl, out: [], ph: '', end: 0 };
    R = { votes: new Map(), last: now(), mainLeft: 0, seen: new Set(pl), beat: 0 };
    if (kind === 'hide') { G.sk = pick(pl); G.cl = {}; G.ph = 'hide'; G.end = now() + HIDE; }
    else {
      R.santa = pick(pl);
      Object.assign(G, { t: tagOf(G.gid, R.santa), goal: Math.min(GOAL, K.orns().size), st: [], used: [], mc: 0, lo: '', by: '', ph: 'play', end: now() + SANTA });
    }
    pickP.hidden = true;
    push(null);
    return true;
  }
  // 판을 끝낸다 (심판만). win 과 그 까닭을 정해 모두에게 알린다
  function finish(win, text) {
    const prev = copy();
    G.ph = 'over'; G.win = win; G.why = text; G.who = G.g === 'santa' ? R.santa : G.sk; G.end = now();
    push(prev);
  }
  // 판을 취소한다. 심판이면 모두에게 알린다
  function cancel(text, tell = amRef()) {
    if (!G) return;
    if (tell) send({ a: 'x', gid: G.gid, why: text });
    const g = G.g;
    ended.add(G.gid);
    clear();
    showEnd(`${GAMES[g].icon} ${josa(GAMES[g].name, '이', '가')} 취소됐어요`, text);
  }

  /* ───────── 심판: 하고 싶은 일을 받는다 ───────── */
  function ask(m, from) {
    if (!G || !amRef() || m.gid !== G.gid || G.ph === 'over' || !G.pl.includes(from) || G.out.includes(from)) return;
    const prev = copy();
    if (G.g === 'hide') {
      if (m.a === 'cl') { // 옷장에 들어감('it' 가구 id) / 나옴('')
        if (from === G.sk) return;
        if (m.it) { const it = K.items().get(m.it); if (!it || !kindOf(it.k).dress) return; G.cl[from] = m.it; } else delete G.cl[from];
        push(prev);
      } else if (m.a === 'find') { // 술래가 찾았다 (판정은 술래 화면에서 했다)
        if (from !== G.sk || G.ph !== 'seek' || !hiding(m.id)) return;
        G.out.push(m.id); delete G.cl[m.id];
        if (!G.pl.some((id) => hiding(id))) { finish('seeker', '술래가 모두 찾았어요!'); return; }
        push(prev);
      }
      return;
    }
    // 몰래 산타
    if (m.a === 'steal') {
      if (from !== R.santa || G.ph !== 'play' || G.st.length >= G.goal) return;
      if (now() - R.last < STEAL - 1500) return; // 오는 길에 늦어지는 것을 조금 봐준다
      if (typeof m.o !== 'string' || !K.orns().has(m.o) || G.st.includes(m.o)) return;
      G.st.push(m.o); R.last = now();
      if (G.st.length >= G.goal) { finish('santa', `몰래 산타가 장식을 ${G.goal}개 다 훔쳤어요!`); return; }
      push(prev);
    } else if (m.a === 'meet') {
      if (G.ph !== 'play' || G.used.includes(from)) return;
      G.used.push(from); G.by = from;
      R.mainLeft = Math.max(0, G.end - now()); R.votes = new Map();
      G.ph = 'talk'; G.end = now() + TALK;
      push(prev);
    } else if (m.a === 'vote') {
      if (G.ph !== 'vote' || R.votes.has(from)) return;
      const t = typeof m.id === 'string' ? m.id : '';
      if (t && (t === from || !alive().includes(t))) return;
      R.votes.set(from, t);
      if (alive().every((id) => R.votes.has(id))) { tally(); return; }
      push(prev);
    }
  }
  // 몰래 산타: 표를 센다
  function tally() {
    const prev = copy(), n = new Map();
    for (const t of R.votes.values()) if (t) n.set(t, (n.get(t) || 0) + 1);
    const top = Math.max(0, ...n.values()), best = [...n].filter(([, c]) => c === top).map(([id]) => id);
    G.mc++;
    G.lo = !top ? '' : best.length > 1 ? '-' : best[0];
    if (G.lo && G.lo !== '-') {
      if (G.lo === R.santa) { finish('town', `모이기에서 ${obj(G.lo)} 골랐어요. 몰래 산타를 잡았어요!`); return; }
      G.out.push(G.lo);
      if (alive().filter((id) => id !== R.santa).length < 2) { finish('santa', '시민이 한 명만 남아서 몰래 산타를 잡을 수 없어요'); return; }
    }
    G.ph = 'play'; G.end = now() + R.mainLeft;
    push(prev);
  }
  // 심판: 시간과 사람을 본다
  function referee() {
    const t = now(), prev = copy();
    // 나간 사람
    for (const id of [...G.pl]) {
      if (here(id)) continue;
      if (G.g === 'hide' && id === G.sk) { cancel('술래가 나가서 판이 끝났어요'); return; }
      if (G.g === 'santa' && id === R.santa) { cancel(`몰래 산타(${who(id)})가 나가서 판이 끝났어요`); return; }
      G.pl = G.pl.filter((x) => x !== id); G.out = G.out.filter((x) => x !== id);
      if (G.cl) delete G.cl[id];
      if (R.votes) R.votes.delete(id);
      if (G.g === 'hide' && !G.pl.some((x) => hiding(x))) { if (G.out.length) finish('seeker', '술래가 남은 사람을 모두 찾았어요!'); else cancel('숨는 사람이 모두 나갔어요'); return; }
      if (G.g === 'santa' && alive().filter((x) => x !== R.santa).length < 1) { cancel('시민이 모두 나갔어요'); return; }
      push(prev);
      return;
    }
    // 새로 온 사람에게도 판을 알린다
    let fresh = false;
    for (const id of K.others().keys()) if (!R.seen.has(id)) { R.seen.add(id); fresh = true; }
    // 단계가 끝남
    if (t >= G.end) {
      if (G.g === 'hide') {
        if (G.ph === 'hide') { G.ph = 'seek'; G.end = t + SEEK; push(prev); return; }
        if (G.ph === 'seek') { finish('hiders', '시간이 끝났어요. 숨은 사람이 이겼어요!'); return; }
      } else {
        if (G.ph === 'play') { finish('santa', '시간이 끝날 때까지 몰래 산타를 못 잡았어요'); return; }
        if (G.ph === 'talk') { G.ph = 'vote'; G.end = t + VOTE; push(prev); return; }
        if (G.ph === 'vote') { tally(); return; }
      }
    }
    if (fresh || t - R.beat > BEAT) push(prev);
  }

  /* ───────── 받은 상태 ───────── */
  function take(s, from) {
    if (!okId(s.ref) || from !== s.ref || typeof s.gid !== 'string' || s.gid.length > 16 || ended.has(s.gid) || !GAMES[s.g]) return;
    if (!okIds(s.pl) || !okIds(s.out) || typeof s.left !== 'number' || typeof s.ph !== 'string') return;
    if (G && G.gid !== s.gid) {
      if (s.gid > G.gid) return; // 둘이 같이 시작했으면 먼저 시작한 판만 남는다
      ended.add(G.gid); clear();
    }
    const prev = copy();
    const g = { gid: s.gid, g: s.g, ref: s.ref, ph: s.ph, pl: s.pl, out: s.out, end: now() + Math.min(s.left, 600 * SEC) };
    if (s.g === 'hide') {
      if (!okId(s.sk)) return;
      g.sk = s.sk; g.cl = {};
      if (s.cl && typeof s.cl === 'object') for (const [id, it] of Object.entries(s.cl)) if (okId(id) && typeof it === 'string' && it.length <= 12) g.cl[id] = it;
    } else {
      if (typeof s.t !== 'string' || !Array.isArray(s.st) || !okIds(s.used)) return;
      Object.assign(g, { t: s.t, goal: s.goal | 0, st: s.st.filter((x) => typeof x === 'string').slice(0, 10), used: s.used, mc: s.mc | 0, lo: typeof s.lo === 'string' ? s.lo : '', by: okId(s.by) ? s.by : '', vn: s.vn | 0, main: s.main | 0 });
    }
    if (s.ph === 'over') Object.assign(g, { win: String(s.win), who: okId(s.who) ? s.who : '', why: typeof s.why === 'string' ? s.why.slice(0, 80) : '' });
    G = g;
    if (pend && (G.cl ? (G.cl[me()] || '') === pend.it : true)) pend = null;
    changed(prev);
  }

  /* ───────── 바뀐 것을 화면에 ───────── */
  function changed(prev) {
    if (!G) return;
    const fresh = !prev || prev.gid !== G.gid;
    document.body.classList.add('gm');
    if (fresh) {
      pickP.hidden = true; endP.hidden = true; voted = -1; sameArea = false;
      if (G.g === 'hide') {
        if (!inGame()) K.toast('숨바꼭질이 시작됐어요. 이번 판은 구경해요');
        else if (G.sk === me()) K.toast('🙈 술래가 됐어요! 20초 동안 눈을 가려요');
        else K.toast(`🙈 숨바꼭질! 술래는 ${who(G.sk)}. 20초 안에 숨어요`);
      } else {
        cdEnd = now() + STEAL;
        if (!inGame()) K.toast('몰래 산타가 시작됐어요. 이번 판은 구경해요');
        else if (amSanta()) K.toast('🤫 당신은 몰래 산타! 트리 가까이에서 몰래 장식을 훔쳐요');
        else K.toast('🎅 누군가 장식을 훔치고 있어요! 범인을 찾아요');
      }
    }
    if (G.g === 'hide') {
      if (prev && !fresh && prev.ph === 'hide' && G.ph === 'seek') K.toast(G.sk === me() ? '🔎 찾기 시작! 숨은 사람을 찾아요' : '술래가 찾기 시작했어요! 들키지 마요');
      if (G.ph === 'hide' && G.sk === me() && !anchor) anchor = [K.me.x, K.me.z];
      if (!fresh && prev && G.out.length > prev.out.length) {
        const f = G.out.filter((id) => !prev.out.includes(id));
        for (const id of f) {
          const inCl = prev.cl && prev.cl[id];
          if (id === me()) { anchor = null; pend = null; K.toast(inCl ? '옷장 문이 열렸어요! 들켰어요 👀 이제 구경해요' : '들켰어요! 👀 이제 구경해요'); }
          else K.toast(`🔎 ${G.sk === me() ? '' : subj(G.sk) + ' '}${inCl ? '옷장에서 ' : ''}${obj(id)} 찾았어요! (${G.out.length}/${G.pl.length - 1})`);
        }
      }
    } else {
      if (!fresh && prev && G.st.length > prev.st.length) {
        K.toast(`장식이 하나 사라졌어요! (${G.st.length}/${G.goal})`);
        if (amSanta()) cdEnd = now() + STEAL;
      }
      if (!fresh && prev && prev.ph === 'play' && G.ph === 'talk') K.toast(`🔔 ${subj(G.by)} 모이기를 불렀어요! 30초 동안 이야기해요`);
      if (!fresh && prev && prev.ph === 'vote' && G.ph !== 'vote' && G.ph !== 'over') {
        K.toast(!G.lo ? '아무도 고르지 않았어요. 계속해요' : G.lo === '-' ? '표가 같아서 아무도 빠지지 않아요' : G.lo === me() ? '내가 가장 많은 표를 받았어요… 몰래 산타가 아니었어요! 이번 판은 구경해요' : `${subj(G.lo)} 가장 많은 표를 받았지만 몰래 산타가 아니었어요! ${top(G.lo)} 빠져요`);
      }
    }
    if (G.ph === 'over') { over(); return; }
    paint();
  }
  // 결과 판
  function over() {
    const g = G;
    let main = '', lines = [];
    if (g.g === 'hide') {
      const left = g.pl.filter((id) => id !== g.sk && !g.out.includes(id));
      main = g.win === 'seeker' ? `🔎 술래(${who(g.sk)}) 승리!` : '🙈 숨은 사람 승리!';
      lines.push(g.why);
      lines.push(`찾은 사람 ${g.out.length}/${g.pl.length - 1}` + (left.length ? ` · 끝까지 안 들킨 사람: ${names(left)}` : ''));
      if (inGame()) lines.push((g.win === 'seeker') === (g.sk === me()) ? '🎉 이겼어요!' : '아쉽게 졌어요');
    } else {
      main = `🎅 몰래 산타는 ${g.who === me() ? '나였어요' : josa(who(g.who), '이었어요', '였어요')}!`;
      lines.push(g.win === 'town' ? '시민 승리! ' + g.why : '몰래 산타 승리! ' + g.why);
      lines.push(`훔친 장식 ${g.st.length}/${g.goal}`);
      if (inGame()) lines.push((g.win === 'santa') === (g.who === me()) ? '🎉 이겼어요!' : '아쉽게 졌어요');
    }
    ended.add(g.gid);
    clear();
    showEnd(main, lines.join('\n'));
  }
  function showEnd(main, sub) {
    $('gameEndMain').textContent = main;
    const box = $('gameEndSub');
    box.textContent = '';
    for (const ln of String(sub).split('\n')) { const d = document.createElement('div'); d.textContent = ln; box.appendChild(d); }
    pickP.hidden = true; voteP.hidden = true;
    endP.hidden = false;
  }
  // 판이 끝났을 때: 숨긴 것을 모두 돌려놓는다
  function clear() {
    G = null; R = null; anchor = null; pend = null;
    for (const a of shrunk) a.root.scale.setScalar(1);
    shrunk.clear();
    for (const id of hidOrn) { const g = K.orn(id); if (g) g.visible = true; }
    hidOrn.clear();
    for (const t of tags.values()) t.remove();
    tags.clear();
    band.hidden = true; blind.hidden = true; voteP.hidden = true; band.classList.remove('warn');
    document.body.classList.remove('gm');
    K.dirty();
  }

  /* ───────── 상태 띠, 투표 판 ───────── */
  function roleText() {
    if (!inGame()) return '이번 판은 구경 중';
    if (G.g === 'hide') {
      if (G.sk === me()) return G.ph === 'hide' ? '너는 술래 · 눈 가리는 중' : `너는 술래 · 찾은 사람 ${G.out.length}/${G.pl.length - 1}`;
      if (isOut()) return '찾혔어요 · 구경 중';
      return (closetOf(me()) ? '🚪 옷장 안에 숨어 있어요' : '숨는 사람') + ` · 술래 ${who(G.sk)}`;
    }
    const n = `장식 ${G.st.length}/${G.goal}`;
    if (isOut()) return `${n} · 빠졌어요 · 구경 중`;
    if (amSanta()) { const cd = cdEnd - now(); return `🤫 너는 몰래 산타 · ${n} · ${cd > 0 ? `슬쩍 ${Math.ceil(cd / SEC)}초 뒤` : '슬쩍 가능'}`; }
    return `${n} · 누군가 장식을 훔치고 있어요`;
  }
  function paint() {
    if (!G) return;
    const g = GAMES[G.g], left = G.end - now();
    band.hidden = false;
    let clk = fmt(left);
    if (G.g === 'santa' && G.ph === 'talk') clk = `이야기 ${fmt(left)}`;
    if (G.g === 'santa' && G.ph === 'vote') clk = `투표 ${fmt(left)}`;
    if (G.g === 'hide' && G.ph === 'hide') clk = `숨는 중 ${fmt(left)}`;
    $('gameName').textContent = `${g.icon} ${g.name}`;
    $('gameClock').textContent = clk;
    $('gameRole').textContent = roleText();
    $('gameStop').hidden = !amRef();
    $('gameMeet').hidden = !(G.g === 'santa' && G.ph === 'play' && inGame() && !isOut() && !G.used.includes(me()));
    band.classList.toggle('warn', G.g === 'hide' && sameArea && hiding(me()));
    // 눈 가리는 술래
    const blindOn = G.g === 'hide' && G.ph === 'hide' && G.sk === me();
    blind.hidden = !blindOn;
    if (blindOn) $('gameBlindN').textContent = `🙈 숨는 중… ${Math.max(0, Math.ceil(left / SEC))}`;
    // 투표
    const canVote = G.g === 'santa' && G.ph === 'vote' && inGame() && !isOut();
    voteP.hidden = !canVote;
    if (canVote) {
      $('gameVoteClock').textContent = fmt(left);
      const done = voted === G.mc;
      $('gameVoteSub').textContent = done ? `골랐어요. 다른 사람을 기다리는 중… (${G.vn || 0}/${alive().length})` : '가장 의심되는 사람을 골라요. 모르겠으면 건너뛰어요.';
      const list = $('gameVoteList'), want = done ? '' : alive().filter((id) => id !== me()).join(',') + '|' + G.mc;
      if (list.dataset.k !== want) {
        list.dataset.k = want; list.textContent = '';
        if (!done) {
          for (const id of alive().filter((x) => x !== me())) list.appendChild(voteBtn(who(id), id));
          list.appendChild(voteBtn('건너뛰기', ''));
        }
      }
    }
  }
  function voteBtn(label, id) {
    const b = el('button', { type: 'button', class: 'btn' + (id ? '' : ' main'), 'data-id': id });
    b.textContent = label;
    b.addEventListener('click', () => vote(id));
    return b;
  }

  /* ───────── 내가 하는 일 ───────── */
  function toRef(m) { m.gid = G.gid; if (amRef()) { ask(m, me()); pend = null; } else send(m); }
  function vote(id) {
    if (!G || G.g !== 'santa' || G.ph !== 'vote' || voted === G.mc || !alive().includes(me())) return false;
    voted = G.mc;
    toRef({ a: 'vote', id });
    paint();
    return true;
  }
  function meet() {
    if (!G || G.g !== 'santa' || G.ph !== 'play' || !alive().includes(me()) || G.used.includes(me())) return false;
    toRef({ a: 'meet' });
    return true;
  }
  // 몰래 산타: 트리에서 장식 하나를 슬쩍한다
  function steal() {
    if (!amSanta() || isOut() || G.ph !== 'play') return false;
    if (cdEnd > now()) { K.toast(`조금만 기다려요. ${Math.ceil((cdEnd - now()) / SEC)}초 뒤에 또 할 수 있어요`); return false; }
    const can = [...K.orns().keys()].filter((id) => !G.st.includes(id));
    if (!can.length) { K.toast('훔칠 장식이 없어요'); return false; }
    cdEnd = now() + STEAL; // 답이 오기 전에 또 누르지 않게
    toRef({ a: 'steal', o: pick(can) });
    return true;
  }
  // 숨바꼭질: 옷장에 숨기 / 나오기
  function closet(it) {
    if (!hiding(me())) return false;
    pend = { it: it || '', at: now() };
    if (it) { K.me.stop(); K.me.onArrive = null; anchor = [K.me.x, K.me.z]; K.toast('🚪 옷장에 숨었어요. 다시 누르면 나와요'); }
    else { anchor = null; K.toast('옷장에서 나왔어요'); }
    toRef({ a: 'cl', it: it || '' });
    paint();
    return true;
  }
  // 술래: 찾았다 (판정은 내 화면에서)
  function find(id, c = false) {
    if (!G || G.g !== 'hide' || G.ph !== 'seek' || G.sk !== me() || !hiding(id)) return false;
    toRef({ a: 'find', id, c });
    return true;
  }
  // 술래 가까이(같은 층, FIND_R 안)에 보이게 서 있는 숨은 사람
  function canSee(id) {
    const a = K.others().get(id);
    if (!a || !hiding(id) || closetOf(id)) return false;
    return levelOf(a.x) === levelOf(K.me.x) && Math.hypot(a.x - K.me.x, a.z - K.me.z) <= FIND_R;
  }
  // 내 앞의 옷장 (같은 층, NEAR 안)
  function closetNear() {
    let best = null, bestD = Infinity;
    for (const it of K.items().values()) {
      if (!kindOf(it.k).dress || levelOf(X0 + it.i * CELL) !== levelOf(K.me.x)) continue;
      const [w, d] = footprint(it.k, it.r), x0 = X0 + it.i * CELL, z0 = Z0 + it.j * CELL;
      const dist = Math.hypot(K.me.x - Math.max(x0, Math.min(K.me.x, x0 + w * CELL)), K.me.z - Math.max(z0, Math.min(K.me.z, z0 + d * CELL)));
      if (dist <= NEAR && dist < bestD) { bestD = dist; best = it.id; }
    }
    return best;
  }
  function openCloset(it) {
    const inside = G.pl.filter((id) => hiding(id) && G.cl[id] === it);
    if (!inside.length) { K.toast('옷장 안에 아무도 없어요'); return true; }
    for (const id of inside) find(id, true);
    return true;
  }
  // 스페이스바·#act 단추: 놀이 중에 할 수 있는 일 { label, run } (없으면 null 이라 원래 하던 일)
  function action() {
    if (!G || G.ph === 'over' || !inGame()) return null;
    if (G.g === 'hide') {
      if (G.sk === me()) {
        if (G.ph === 'hide') return { label: '🙈 눈 가리는 중', run: () => {} };
        const near = G.pl.filter(canSee).sort((a, b) => { const A = K.others().get(a), B = K.others().get(b); return Math.hypot(A.x - K.me.x, A.z - K.me.z) - Math.hypot(B.x - K.me.x, B.z - K.me.z); });
        if (near.length) return { label: '🔎 찾았다!', run: () => find(near[0]) };
        const c = closetNear();
        if (c) return { label: '🚪 옷장 열어 보기', run: () => openCloset(c) };
        return null;
      }
      if (!hiding(me())) return null;
      if (closetOf(me())) return { label: '🚪 옷장에서 나오기', run: () => closet('') };
      const c = closetNear();
      if (c) return { label: '🚪 옷장에 숨기', run: () => closet(c) };
      return null;
    }
    if (amSanta() && !isOut() && G.ph === 'play' && levelOf(K.me.x) === 0 && Math.hypot(K.me.x, K.me.z) <= TREE_R && K.orns().size) {
      const cd = cdEnd - now();
      return { label: cd > 0 ? `🤫 슬쩍 (${Math.ceil(cd / SEC)}초)` : '🤫 슬쩍', run: steal };
    }
    return null;
  }
  // 화면을 눌렀을 때: 술래가 숨은 사람을 누르면 찾기. 처리했으면 true (걸어가지 않는다)
  function tap(px, py) {
    if (!G || G.ph === 'over') return false;
    if (anchor) { if (closetOf(me())) K.toast('옷장 안이에요. 나오려면 "🚪 옷장에서 나오기"'); return true; } // 움직일 수 없다
    if (G.g !== 'hide' || G.sk !== me() || G.ph !== 'seek') return false;
    const ray = K.caster(px, py), list = [...K.others()].filter(([id, a]) => hiding(id) && !closetOf(id) && a.root.visible);
    const hits = ray.intersectObjects(list.map(([, a]) => a.root), true);
    if (!hits.length) return false;
    let o = hits[0].object, id = null;
    for (; o && !id; o = o.parent) { const f = list.find(([, a]) => a.root === o); if (f) id = f[0]; }
    if (!id) return false;
    if (!canSee(id)) { K.toast(`더 가까이 가야 해요 (${FIND_R}m 안)`); return true; }
    find(id);
    return true;
  }

  /* ───────── 매 장면 ───────── */
  function tick() {
    if (!G) return;
    if (!K.online()) { cancel('연결이 끊겨서 판이 취소됐어요', false); return; }
    if (amRef()) { referee(); if (!G) return; }
    else if (!here(G.ref)) { cancel(`심판(${K.nameOf(G.ref)})이 나가서 판이 취소됐어요`, false); return; }
    if (pend && now() - pend.at > 4000) pend = null; // 답이 안 오면 심판이 정한 대로
    // 움직이지 못하게: 눈 가리는 술래, 옷장 안
    const lock = (G.g === 'hide' && G.ph === 'hide' && G.sk === me()) || (G.g === 'hide' && hiding(me()) && !!closetOf(me()));
    if (lock) {
      if (!anchor) anchor = [K.me.x, K.me.z];
      K.me.stop(); K.me.onArrive = null;
      if (Math.hypot(K.me.x - anchor[0], K.me.z - anchor[1]) > 1e-4) K.me.place(anchor[0], anchor[1]);
    } else anchor = null;
    // 옷장에 숨은 사람은 아무에게도 안 보인다 (작게 만들어 둔다. 층마다 보이고 숨는 것은 app.js 가 따로 한다)
    if (G.g === 'hide') {
      const want = new Set(G.pl.filter((id) => hiding(id) && closetOf(id)).map(avatarOf).filter(Boolean));
      for (const a of want) if (!shrunk.has(a)) { a.root.scale.setScalar(0.001); shrunk.add(a); K.dirty(); }
      for (const a of [...shrunk]) if (!want.has(a)) { a.root.scale.setScalar(1); shrunk.delete(a); K.dirty(); }
      // 술래가 같은 층에 오면 숨은 사람에게 알린다
      const sk = avatarOf(G.sk);
      const same = G.ph === 'seek' && hiding(me()) && !!sk && area(sk) === area(K.me);
      if (same && !sameArea) K.toast(area(K.me) === 'yard' ? '⚠️ 술래가 마당에 왔어요!' : '⚠️ 술래가 이 층에 왔어요!');
      sameArea = same;
    } else {
      // 훔친 장식은 안 보이게
      for (const id of G.st) { const g = K.orn(id); if (g && g.visible) { g.visible = false; hidOrn.add(id); K.dirty(); } }
    }
    // 찾힌 사람 머리 위 표시
    const found = G.out;
    for (const [id, t] of tags) if (!found.includes(id)) { t.remove(); tags.delete(id); }
    for (const id of found) {
      const a = avatarOf(id);
      let t = tags.get(id);
      if (!t) { t = document.createElement('i'); t.textContent = G.g === 'hide' ? '👀 찾음' : '🚫 빠짐'; tagBox.appendChild(t); tags.set(id, t); }
      const vis = a && a.root.visible && !(a === K.me && K.eye());
      if (!vis) { t.style.display = 'none'; continue; }
      const p = K.screenOf(a.x, a.z, a.rest ? 1.2 : 1.95);
      t.style.display = '';
      t.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    }
    const t = now();
    if (t - uiAt > 200) { uiAt = t; paint(); }
  }

  /* ───────── 친구에게서 온 소식 ───────── */
  function peerFx(m, from) {
    if (typeof m.v !== 'string' || m.v.length > 1500) return false;
    let d;
    try { d = JSON.parse(m.v); } catch (_) { return false; }
    if (!d || typeof d !== 'object' || typeof d.a !== 'string') return false;
    if (d.a === 's') take(d, from);
    else if (d.a === 'x') { if (G && d.gid === G.gid && from === G.ref) cancel(typeof d.why === 'string' ? d.why.slice(0, 60) : '판이 취소됐어요', false); }
    else ask(d, from);
    return true; // 받을 만한 소식이면 방장이 다른 사람들에게도 전한다 (심판이 다른 손님일 수 있다)
  }
  // 술래에게는 숨은 사람의 말과 행동이 안 보인다
  const quiet = (id) => !!G && G.g === 'hide' && G.ph !== 'over' && G.sk === me() && hiding(id);
  // 채팅: 술래에게는 숨은 사람의 말 대신 "어디선가 소리가 났어요"만. 그렇게 했으면 true
  function muffle(id) {
    if (!quiet(id)) return false;
    const log = $('chatLog'), ln = document.createElement('div');
    if (log) {
      if (log.firstElementChild && log.firstElementChild.classList.contains('none')) log.textContent = '';
      ln.className = 'ln'; ln.textContent = '🔉 어디선가 소리가 났어요';
      log.appendChild(ln); log.scrollTop = log.scrollHeight;
    }
    K.toast('🔉 어디선가 소리가 났어요');
    return true;
  }

  /* ───────── 단추 ───────── */
  function openPick() {
    if (!pickP.hidden) { pickP.hidden = true; return; }
    for (const b of pickP.querySelectorAll('[data-g]')) b.disabled = !!why(b.dataset.g);
    const n = K.online() ? K.others().size + 1 : 1;
    $('gamePickSub').textContent = `지금 ${n}명`;
    const w = G ? why('hide') : ['hide', 'santa'].map(why).find((x) => x) || '';
    $('gamePickWhy').textContent = G ? w : !K.online() || !K.canEdit() ? w : Object.keys(GAMES).every((k) => !why(k)) ? '고르면 바로 시작해요. 시작한 사람의 화면이 심판이에요.' : w;
    pickP.hidden = false;
  }
  btn.addEventListener('click', openPick);
  for (const b of pickP.querySelectorAll('[data-g]')) b.addEventListener('click', () => start(b.dataset.g));
  $('gamePickClose').addEventListener('click', () => { pickP.hidden = true; });
  pickP.addEventListener('click', (e) => { if (e.target === pickP) pickP.hidden = true; });
  $('gameStop').addEventListener('click', () => { if (amRef()) cancel('심판이 판을 그만했어요'); });
  $('gameMeet').addEventListener('click', meet);
  $('gameEndClose').addEventListener('click', () => { endP.hidden = true; });

  // 자동 검사가 쓰는 창구
  window.__games = {
    get state() { return G ? { ...copy(), left: G.end - now(), ref: G.ref } : null; },
    get santa() { return R ? R.santa || null : null; }, // 심판만 안다
    get amSanta() { return amSanta(); }, get amRef() { return amRef(); }, get locked() { return !!anchor; },
    get band() { return band.hidden ? null : { name: $('gameName').textContent, clock: $('gameClock').textContent, role: $('gameRole').textContent, stop: !$('gameStop').hidden, meet: !$('gameMeet').hidden, warn: band.classList.contains('warn') }; },
    get blind() { return !blind.hidden; }, get pick() { return !pickP.hidden; }, get voting() { return !voteP.hidden; },
    get result() { return endP.hidden ? null : { main: $('gameEndMain').textContent, sub: $('gameEndSub').textContent }; },
    get tags() { return [...tags.keys()]; },
    shrunk: (id) => { const a = avatarOf(id); return !!a && shrunk.has(a); },
    ornHidden: (id) => { const g = K.orn(id); return !!g && !g.visible; },
    start, cancel: (t) => cancel(t || '심판이 판을 그만했어요'), openPick, closeEnd: () => { endP.hidden = true; },
    action: () => { const a = action(); return a ? a.label : null; }, act: () => { const a = action(); if (a) a.run(); return !!a; },
    find, closet, steal, meet, vote, tap, quiet, why,
  };
  return { tick, peerFx, action, tap, muffle, quiet, get on() { return !!G; } };
}
