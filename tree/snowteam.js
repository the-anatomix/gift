// 눈싸움 팀전 (빨강 🔴 대 초록 🟢). 눈싸움 모드에서 "⚔️ 팀전" 을 누르면(2명 이상 접속했을 때, 누구나) 접속한 사람들을 섞어
// 빨강·초록으로 번갈아 나누고, 3초 세고 나서 DUR 초 동안 한 판. 상대 팀을 맞히면 +1, 같은 팀은 맞아도 점수가 없다(눈은 뒤집어쓴다).
// 놀이 소식 { k: 'team', v } 하나로 주고받는다. 판을 시작한 사람(이끄는 사람)이 기준이다.
//   'g,판,시작까지ms,빨강id.id,초록id.id'  판 시작 (이끄는 사람 = 보낸 사람). 판 중에 누가 들어오면 남은 시간으로 다시 보낸다
//   's,판,빨강,초록'                        점수 (이끄는 사람이 바뀔 때마다. 받은 쪽은 제가 센 것 대신 이것을 쓴다)
//   'e,판,빨강,초록'                        끝난 점수 (모두의 결과 띠가 같도록)
// 맞았는지는 snow.js 가 정하고(맞힘 소식 hit) 여기 hit(던진 사람, 맞은 사람) 으로 알려 준다. 점수는 이끄는 사람만 세고(모든 hit 이 그 사람에게 간다),
// 다른 화면은 이끄는 사람이 보낸 점수를 그대로 쓴다(맞힘 소식과 점수 소식이 오는 순서가 달라도 두 번 세지 않게).
// 이끄는 사람이 나가면 판은 취소된다. 판 중에 들어온 사람은 구경(점수판만 보인다).
import { THREE, put, ball, M } from './kit.js';

const $ = (id) => document.getElementById(id);
const now = () => (typeof window.__now === 'function' ? window.__now() : Date.now());
const Q = new URLSearchParams(location.search);
export const DUR = Math.max(3, Math.min(600, parseInt(Q.get('tm'), 10) || 90)) * 1000; // 한 판의 길이 (검사용 ?tm=초)
export const READY = 3000;   // 시작 전에 세는 시간
const SHOW = 5000;           // 끝난 뒤 결과 띠와 팀 표시가 남아 있는 시간
const WAIT_END = 1800;       // 끝난 점수를 이끄는 사람에게서 기다리는 시간 (안 오면 마지막으로 받은 점수로)
const TEAMS = [{ id: 'r', name: '빨강', icon: '🔴', col: 0xE0433A }, { id: 'g', name: '초록', icon: '🟢', col: 0x2FA35E }];
const okId = (v) => typeof v === 'string' && /^[a-z0-9]{1,8}$/.test(v);
const okMid = (v) => typeof v === 'string' && /^[a-z0-9]{4,12}$/.test(v);

// S = snow.js 가 넘겨주는 것: { on(): 눈싸움 모드인지, setOn(v), shown(): 눈싸움 단추가 보이는지, base(): 단추를 놓을 아래 높이, eye() }
export function makeTeam(K, S) {
  let match = null; // { mid, lead, red: Set, green: Set, t0(시작 시각), t1(끝 시각), score: [빨강, 초록], told(이끄는 사람의 점수를 받았는지), ended, result }
  let seen = new Set(); // 지난번에 본 접속한 사람들 (판 중에 새로 온 사람에게 다시 알리려고)
  const bands = new Map(); // 아바타 → { g(팀 표시), parts(붙인 몸) }

  /* ───────── 화면: 팀전 단추, 점수판, 세는 숫자, 결과 띠 ───────── */
  const css = document.createElement('style');
  css.textContent = '#teamBtn{position:absolute;left:10px;bottom:130px;z-index:3;width:60px;height:58px;padding:0;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;'
    + 'font-size:11px;font-weight:800;line-height:1.1;box-shadow:0 4px 14px rgba(60,30,10,.28)}#teamBtn b{font-size:21px;line-height:1}'
    + '#teamBoard{position:absolute;left:50%;top:calc(104px + env(safe-area-inset-top));transform:translateX(-50%);z-index:4;pointer-events:none;white-space:nowrap;'
    + 'padding:6px 14px;border-radius:999px;background:rgba(255,252,245,.94);color:#2B1D14;font-size:16px;font-weight:900;box-shadow:0 3px 12px rgba(0,0,0,.28);font-variant-numeric:tabular-nums}'
    + '#teamBoard small{font-size:13px;font-weight:800;color:#8A7868}'
    + '#teamCount{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);z-index:7;pointer-events:none;white-space:nowrap;font-weight:900;color:#FFF4E0;'
    + 'text-shadow:0 4px 18px rgba(0,0,0,.55),0 0 2px rgba(0,0,0,.4);font-size:110px;line-height:1}#teamCount.word{font-size:56px;color:#FFE9A8}'
    + '#teamResult{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);z-index:7;pointer-events:none;white-space:nowrap;max-width:94vw;'
    + 'padding:14px 22px;border-radius:20px;background:rgba(255,252,245,.96);color:#2B1D14;font-size:22px;font-weight:900;text-align:center;box-shadow:0 8px 26px rgba(0,0,0,.35)}'
    + '#teamResult small{display:block;font-size:14px;font-weight:700;color:#8A7868;margin-top:4px}#teamResult[data-w=r]{border:3px solid #E0433A}#teamResult[data-w=g]{border:3px solid #2FA35E}#teamResult[data-w=d]{border:3px solid #C9902B}';
  document.head.appendChild(css);
  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'teamBtn'; btn.className = 'btn'; btn.hidden = true;
  btn.setAttribute('aria-label', '눈싸움 팀전 시작');
  btn.innerHTML = '<b>⚔️</b>팀전';
  const board = document.createElement('div'); board.id = 'teamBoard'; board.hidden = true; board.setAttribute('role', 'status');
  const count = document.createElement('div'); count.id = 'teamCount'; count.hidden = true; count.setAttribute('aria-live', 'assertive');
  const result = document.createElement('div'); result.id = 'teamResult'; result.hidden = true; result.setAttribute('role', 'status');
  document.body.append(btn, board, count, result);
  btn.addEventListener('click', () => start());

  const ids = () => [K.myId(), ...K.others().keys()];
  const avatarOf = (id) => (id === K.myId() ? K.me : K.others().get(id));
  const teamOf = (id) => (!match ? null : match.red.has(id) ? 0 : match.green.has(id) ? 1 : null);
  const live = () => !!match && !match.ended && now() >= match.t0 && now() < match.t1; // 점수를 세는 중인지
  const canStart = () => K.online() && K.others().size >= 1 && !match;

  /* ───────── 판 시작 ───────── */
  function goMsg() {
    const m = match;
    return `g,${m.mid},${Math.round(m.t0 - now())},${[...m.red].join('.')},${[...m.green].join('.')}`;
  }
  // 내가 판을 시작한다: 접속한 사람들을 섞어 번갈아 나눈다
  function start() {
    if (!canStart()) return false;
    const list = ids();
    for (let k = list.length - 1; k > 0; k--) { const r = Math.floor(Math.random() * (k + 1)); [list[k], list[r]] = [list[r], list[k]]; }
    const red = new Set(), green = new Set();
    list.forEach((id, k) => (k % 2 ? green : red).add(id));
    const t = now();
    begin({ mid: t.toString(36).slice(-8) + K.myId().slice(0, 3), lead: K.myId(), red, green, t0: t + READY });
    K.fx({ k: 'team', v: goMsg() });
    return true;
  }
  function begin(m) {
    match = { ...m, t1: m.t0 + DUR, score: [0, 0], told: false, ended: false, result: null, endAt: 0, cd: null };
    seen = new Set(K.others().keys());
    result.hidden = true;
    const t = teamOf(K.myId());
    if (t !== null) { S.setOn(true); K.toast(`팀전! 나는 ${TEAMS[t].icon} ${TEAMS[t].name} 팀이에요`); }
    else K.toast('눈싸움 팀전이 시작됐어요. 이번 판은 구경해요');
    paint();
  }
  function cancel(why) {
    if (!match) return;
    match = null;
    count.hidden = true; board.hidden = true; result.hidden = true;
    clearBands();
    if (why) K.toast(why);
    paint();
  }

  /* ───────── 맞힘 ───────── */
  // 던진 사람 a 가 b 를 맞혔다. 내 화면에 띄울 알림 글을 돌려준다 (팀전이 아니면 null)
  function hit(a, b) {
    if (!live()) return null;
    const ta = teamOf(a), tb = teamOf(b);
    if (ta === null || tb === null) return null;
    if (ta === tb) return '같은 팀이에요! 점수는 없어요';
    if (match.lead === K.myId()) { match.score[ta]++; K.fx({ k: 'team', v: `s,${match.mid},${match.score[0]},${match.score[1]}` }); paint(); }
    return `${TEAMS[ta].icon} ${TEAMS[ta].name} 팀 +1!`;
  }

  /* ───────── 친구에게서 온 소식 ───────── */
  function peerFx(m, from) {
    if (typeof m.v !== 'string' || m.v.length > 160) return false;
    const p = m.v.split(',');
    if (p[0] === 'g') {
      if (p.length !== 5 || !okMid(p[1]) || !/^-?\d{1,7}$/.test(p[2])) return false;
      const red = p[3].split('.'), green = p[4].split('.');
      if (!red.every(okId) || !green.every(okId) || red.length + green.length > 16 || !red.length || !green.length) return false;
      if (!red.includes(from) && !green.includes(from)) return false; // 이끄는 사람은 자기 판에 들어 있다
      if (red.some((x) => green.includes(x))) return false;
      const ms = Math.max(-DUR, Math.min(READY + 500, +p[2]));
      if (match && match.mid === p[1]) return true; // 이미 받은 판 (새로 온 사람에게 다시 보낸 것)
      // 두 사람이 거의 같이 시작했으면 판 이름이 앞서는 쪽으로 모두 맞춘다 (세는 동안만 바꾼다)
      if (match && !match.ended && (now() >= match.t0 || match.mid < p[1])) return true;
      begin({ mid: p[1], lead: from, red: new Set(red), green: new Set(green), t0: now() + ms });
      return true;
    }
    if (p[0] === 's' || p[0] === 'e') {
      if (p.length !== 4 || !match || match.mid !== p[1] || match.lead !== from) return !!match; // 다른 판의 점수는 버린다 (방장은 그래도 전한다)
      const r = +p[2], g = +p[3];
      if (!Number.isInteger(r) || !Number.isInteger(g) || r < 0 || g < 0 || r > 9999 || g > 9999) return false;
      match.score = [r, g]; match.told = true;
      if (p[0] === 'e') finish(true);
      paint();
      return true;
    }
    return false;
  }

  /* ───────── 끝 ───────── */
  function finish(final) {
    const m = match;
    if (!m) return;
    const first = !m.ended;
    m.ended = true;
    if (first) m.endAt = now();
    const [r, g] = m.score, w = r > g ? 0 : g > r ? 1 : -1;
    result.dataset.w = w < 0 ? 'd' : TEAMS[w].id;
    result.innerHTML = '';
    result.append(w < 0 ? '무승부! ' : `${TEAMS[w].icon} ${TEAMS[w].name} 팀 승리! `, `${r} : ${g}`);
    const sub = document.createElement('small');
    const mine = teamOf(K.myId());
    sub.textContent = mine === null ? '🔴 빨강 대 초록 🟢' : w < 0 ? '아깝다! 다음 판에서 겨뤄요' : mine === w ? '우리 팀이 이겼어요! 🎉' : '다음 판에서 이겨 봐요!';
    result.appendChild(sub);
    result.hidden = false;
    if (first || (final && m.result !== `${r}:${g}`)) {
      // 이긴 팀은 다 같이 만세 (모든 화면이 같은 결과로 스스로 움직인다)
      if (w >= 0) for (const id of (w ? m.green : m.red)) { const a = avatarOf(id); if (a) a.act('cheer'); }
      K.dirty();
    }
    m.result = `${r}:${g}`;
    if (first && m.lead === K.myId()) K.fx({ k: 'team', v: `e,${m.mid},${r},${g}` });
    paint();
  }

  /* ───────── 팀 표시: 머리에 팀 색 띠와 방울 ───────── */
  const bandGeo = new THREE.TorusGeometry(0.29, 0.045, 8, 24), pomGeo = ball(0.075, 10, 8);
  function bandOn(a, t) {
    let b = bands.get(a);
    if (b && (b.parts !== a.parts || b.t !== t)) { if (b.g.parent) b.g.parent.remove(b.g); bands.delete(a); b = null; }
    if (b || !a.parts) return;
    const g = new THREE.Group(), col = TEAMS[t].col;
    const ring = put(bandGeo, M(col), 0, 0.12, -0.01, g, false); ring.rotation.x = Math.PI / 2 - 0.25; ring.scale.set(1.07, 1.03, 1);
    put(pomGeo, M(col), 0, 0.36, -0.03, g, false);
    g.userData.team = TEAMS[t].id;
    a.parts.head.add(g);
    bands.set(a, { g, parts: a.parts, t });
    K.dirty();
  }
  function clearBands(keep = new Set()) {
    for (const [a, b] of [...bands]) if (!keep.has(a)) { if (b.g.parent) b.g.parent.remove(b.g); bands.delete(a); K.dirty(); }
  }

  /* ───────── 매 장면 ───────── */
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function paint() {
    const m = match;
    // 팀전 단추: 눈싸움 모드를 켜 두었고, 2명 이상 접속했고, 판이 없을 때
    const show = S.shown() && S.on() && canStart();
    btn.hidden = !show;
    if (show) { const b = S.base(); btn.style.bottom = (S.eye() ? b + 116 : b) + 'px'; }
    board.hidden = !m;
    if (m) {
      const t = now(), left = m.ended ? 0 : t < m.t0 ? DUR : m.t1 - t;
      const main = `🔴 ${m.score[0]} : ${m.score[1]} 🟢 `, sub = '· ' + (m.ended ? '끝' : mmss(left));
      if (board.textContent !== main + sub) { // 글이 바뀔 때만 고친다
        board.innerHTML = '';
        board.append(main);
        const s = document.createElement('small'); s.textContent = sub; board.appendChild(s);
      }
    }
  }
  function tick() {
    const m = match;
    if (!m) { if (!btn.hidden !== (S.shown() && S.on() && canStart())) paint(); return; }
    const t = now();
    if (!K.online()) { cancel(''); return; }
    if (m.lead !== K.myId() && !K.others().has(m.lead)) { cancel(m.ended ? '' : '팀전을 시작한 사람이 나가서 판이 취소됐어요'); return; }
    // 판 중에 새로 온 사람: 이끄는 사람이 남은 시간과 점수를 알려 준다 (그 사람은 구경)
    if (m.lead === K.myId() && !m.ended) {
      const now2 = new Set(K.others().keys());
      if ([...now2].some((id) => !seen.has(id))) { K.fx({ k: 'team', v: goMsg() }); if (m.score[0] || m.score[1]) K.fx({ k: 'team', v: `s,${m.mid},${m.score[0]},${m.score[1]}` }); }
      seen = now2;
    }
    // 세기: 3, 2, 1, 시작!
    let cd = null;
    if (t < m.t0) cd = String(Math.ceil((m.t0 - t) / 1000));
    else if (t < m.t0 + 900 && !m.ended) cd = '시작!';
    if (cd !== m.cd) { m.cd = cd; count.hidden = !cd; count.textContent = cd || ''; count.className = cd === '시작!' ? 'word' : ''; }
    if (!m.ended && t >= m.t1) {
      if (m.lead === K.myId()) finish(true);
      else if (t >= m.t1 + WAIT_END) finish(false); // 끝난 점수가 안 오면 마지막으로 받은 점수로
    }
    if (m.ended && t > m.endAt + SHOW) { cancel(''); return; }
    // 팀 표시
    const keep = new Set();
    for (const [k, set] of [[0, m.red], [1, m.green]]) for (const id of set) { const a = avatarOf(id); if (a) { bandOn(a, k); keep.add(a); } }
    clearBands(keep);
    paint();
  }

  return {
    peerFx, hit, tick, start, cancel: () => cancel(''),
    get match() { return match; },
    test: {
      get on() { return !!match && !match.ended; }, get live() { return live(); }, get ended() { return !!match && match.ended; },
      get lead() { return match ? match.lead : null; }, get mid() { return match ? match.mid : null; },
      get red() { return match ? [...match.red] : []; }, get green() { return match ? [...match.green] : []; },
      get score() { return match ? match.score.slice() : null; }, teamOf: (id) => { const t = teamOf(id); return t === null ? null : TEAMS[t].id; },
      get board() { return board.hidden ? '' : board.textContent; }, get result() { return result.hidden ? '' : result.firstChild.textContent + result.childNodes[1].textContent; }, get resultSub() { return result.hidden ? '' : result.lastChild.textContent; },
      get count() { return count.hidden ? '' : count.textContent; }, get btn() { return !btn.hidden; },
      band: (id) => { const a = avatarOf(id), b = a && bands.get(a); return b && b.g.parent === a.parts.head ? b.g.userData.team : null; },
      start, DUR, READY,
    },
  };
}
