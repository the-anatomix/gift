// 이름별 순위.
//   점수가 나오는 놀이(catalog.js 의 BEST: 다트, 마시멜로 굽기)의 점수를 닉네임별로 방에 남긴다. 같은 이름은 가장 높은 점수만.
//   방의 상태다(state.js 의 'score' 변화와 S.rank. 저장되고 친구에게 전해지고, 구경하는 사람의 점수도 오른다).
//   이 방 최고 기록('best')을 깨는 점수는 예전처럼 'best' 로 보내고, state.js 가 그것을 순위에도 올린다(순위표가 없던 방과 맞는다).
//   놀이 판의 "🏆 순위" 단추로 1~RANK.show 위를 본다(이름·점수, 내 줄 강조, 내가 그 밖이면 내 순위 한 줄).
// app.js 가 넘겨주는 창구 K:
//   op(변화) → 받아들였는지, list(k) → 높은 점수부터 [{ name, v }], best() → { 놀이: { v, name } }, myName(), toast(글)
import { BEST, RANK } from './catalog.js';

const CSS = `
#rankP{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(20,14,28,.45)}
#rankP .sheet{width:100%;max-width:380px;max-height:100%;overflow-y:auto}
#rankTabs{display:flex;gap:6px}
#rankTabs .chip{min-height:46px}
#rankList{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
#rankList li{display:flex;align-items:center;gap:8px;min-height:36px;padding:0 10px;border-radius:10px;background:#fff;border:1.5px solid var(--line);font-size:14px;font-weight:700}
#rankList li b{flex:none;width:30px;text-align:center;font-weight:900}
#rankList li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#rankList li em{flex:none;font-style:normal;font-weight:900}
#rankList li.me{background:#FFF1C4;border-color:var(--choc)}
#rankList li.none{justify-content:center;color:var(--sub);font-weight:600;font-size:13px}
#rankMine{font-size:13px;font-weight:700;color:var(--sub);text-align:center}
`;
const MEDAL = ['🥇', '🥈', '🥉'];

export function makeRank(K) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const P = document.createElement('div');
  P.id = 'rankP'; P.hidden = true; P.setAttribute('role', 'dialog'); P.setAttribute('aria-label', '순위');
  P.innerHTML = '<div class="sheet"><h2>🏆 순위 <small>이 방에서 논 사람들</small></h2><div id="rankTabs" role="group" aria-label="놀이"></div>'
    + '<ol id="rankList"></ol><div id="rankMine" hidden></div><div class="row"><button type="button" class="btn main" id="rankClose" style="flex:1">닫기</button></div></div>';
  document.body.appendChild(P);
  const $ = (id) => document.getElementById(id);
  let kind = Object.keys(BEST)[0];
  for (const k of Object.keys(BEST)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.v = k; b.textContent = BEST[k].name;
    b.addEventListener('click', () => { kind = k; paint(); });
    $('rankTabs').appendChild(b);
  }
  // 그 놀이에서 그 이름의 등수(1부터. 없으면 0)
  const placeOf = (k, name) => K.list(k).findIndex((r) => r.name === name) + 1;

  function paint() {
    for (const b of $('rankTabs').children) b.setAttribute('aria-pressed', String(b.dataset.v === kind));
    const all = K.list(kind), mine = K.myName(), ol = $('rankList');
    ol.textContent = '';
    if (!all.length) { const li = document.createElement('li'); li.className = 'none'; li.textContent = '아직 기록이 없어요. 첫 기록을 남겨 보세요!'; ol.appendChild(li); }
    all.slice(0, RANK.show).forEach((r, i) => { // 이름은 textContent 로만 넣는다
      const li = document.createElement('li'), no = document.createElement('b'), nm = document.createElement('span'), pt = document.createElement('em');
      if (r.name === mine) li.className = 'me';
      no.textContent = MEDAL[i] || String(i + 1); nm.textContent = r.name; pt.textContent = `${r.v}점`;
      li.setAttribute('aria-label', `${i + 1}위 ${r.name} ${r.v}점`);
      li.append(no, nm, pt);
      ol.appendChild(li);
    });
    const at = all.findIndex((r) => r.name === mine), box = $('rankMine');
    box.hidden = false;
    box.textContent = at < 0 ? `${mine} · 아직 내 기록이 없어요` : at >= RANK.show ? `내 순위 ${at + 1}위 · ${all[at].v}점 (${mine})` : `내 순위 ${at + 1}위 (${mine})`;
  }
  function open(k) { if (Object.hasOwn(BEST, k)) kind = k; paint(); P.hidden = false; $('rankClose').focus({ preventScroll: true }); }
  function close() { P.hidden = true; }
  $('rankClose').addEventListener('click', close);
  P.addEventListener('click', (e) => { if (e.target === P) close(); });
  P.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); e.stopPropagation(); });

  // 끝난 판의 점수를 남긴다: 이 방 최고 기록을 깼으면 'best'(순위에도 오른다), 아니면 내 이름의 점수만 'score'
  function record(k, v) {
    if (!Object.hasOwn(BEST, k) || !Number.isFinite(v)) return false;
    const pts = Math.round(v), b = K.best()[k], name = K.myName();
    if (pts < 1 || pts > BEST[k].top) return false;
    if (!b || pts > b.v) return K.op({ t: 'best', k, v: pts, name });
    const was = K.list(k).find((r) => r.name === name);
    if (was && was.v >= pts) return false;
    return K.op({ t: 'score', k, v: pts, name });
  }
  // 방의 변화가 하나 들어왔다 ('best' 나 'score'. 저장된 방을 여는 중에는 오지 않는다)
  function onOp(op, from) {
    if (!P.hidden) paint();
    if (op.t === 'score' && from === 'me') { const n = placeOf(op.k, op.name); if (n) setTimeout(() => K.toast(`🏆 ${BEST[op.k].name} 순위 ${n}위에 올랐어요! ${op.v}점`), 900); }
  }

  window.__rank = { // 자동 검사가 쓰는 창구
    open, close, record, placeOf, list: (k) => K.list(k),
    get shown() { return !P.hidden; }, get kind() { return kind; },
    get rows() { return [...$('rankList').querySelectorAll('li:not(.none)')].map((li) => ({ no: li.querySelector('b').textContent, name: li.querySelector('span').textContent, pts: li.querySelector('em').textContent, me: li.classList.contains('me') })); },
    get mine() { return $('rankMine').textContent; },
  };
  return { open, close, record, onOp, get shown() { return !P.hidden; } };
}
