// 마스터키로 층 더하기·지우기와 층 테마. 마스터 판(master.js 의 #masterP)의 "층"·"테마" 줄. BUILD 권한이 있는 꾸미는 사람에게만 보인다.
//   층: "＋ 층 더하기" 는 맨 위에 빈 층을 하나 더한다(MAX_LEVELS 층까지). 새 층은 그 아래층의 사다리로 올라간다(path.js 의 LADDERS).
//       "맨 위 층 지우기" 는 마스터키로 더한 층만 지운다(처음부터 있는 4층까지는 그대로). 한 번 누르면 지울 가구 수를 알려 주며 다시 묻고,
//       5초 안에 한 번 더 누르면 지운다. 그 층의 가구·테마·불이 같이 없어지고, 그 층에 있던 사람은 아래층 사다리 앞으로 내려온다(app.js 의 keepOnFloors).
//   테마: 층(2층과 더한 층)과 테마(catalog.js 의 THEMES)를 골라 "적용" 하면 그 층의 벽·바닥·천장이 바뀌고 테마 가구가 빈 칸에 놓인다.
//       다른 테마를 적용하면 지난 테마 가구는 치워지고 새 테마로 바뀐다. "테마 지우기" 는 테마 가구만 치우고 원래 모습으로 돌린다.
//       사람이 직접 놓은 가구는 건드리지 않는다. 1층(트리·마당), 3층 영화관, 4층 게임방에는 입히지 않는다.
//   변화는 방의 상태 하나씩이다: { t: 'levels', n }, { t: 'theme', lv, id } (state.js 가 풀어서 모두에게 같게 한다). 저장된다.
//
// K = { S(), op(o), canEdit(), allowed() BUILD 권한이 있는지, toast(m), mode(), measure(), level() }
import { THEMES } from './catalog.js';
import { BASE_LEVELS, MAX_LEVELS, levelOfCell } from './path.js';
import { canTheme, isThemeItem, kindOf } from './state.js';

export function makeBuild(K) {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const button = (cls, text, id) => { const b = el('button', cls, text); b.type = 'button'; if (id) b.id = id; return b; };
  const css = el('style');
  css.textContent = '#mkTheme .row{flex:1;min-width:0;gap:6px;flex-wrap:wrap}#mkTheme .row .chip{flex:1 0 auto}#mkTheme .btn{padding:0 10px}'
    + '#mkThemes{gap:6px}#mkThemes .chip{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;line-height:1.05;font-size:11px;padding:0 2px}#mkThemes .chip b{font-size:18px}'
    + '#mkLevels .btn{flex:1;padding:0 8px}#mkDel.main{white-space:normal;line-height:1.25;font-size:12.5px}';
  document.head.appendChild(css);
  /* 층 줄 */
  const lvRow = el('div', 'row'), lvLab = el('span', 'lab'), addBtn = button('btn', '＋ 층 더하기', 'mkAdd'), delBtn = button('btn', '', 'mkDel');
  lvRow.id = 'mkLevels'; lvRow.append(lvLab, addBtn, delBtn);
  /* 테마 줄: 층 고르기와 적용·지우기, 그 아래 테마 고르기 (층 단추에는 그 층의 지금 테마 그림이 붙는다) */
  const thRow = el('div', 'row'), floorBox = el('div', 'row'), applyBtn = button('btn main', '적용', 'mkApply'), clearBtn = button('btn', '테마 지우기', 'mkClear');
  thRow.id = 'mkTheme'; floorBox.setAttribute('role', 'group'); floorBox.setAttribute('aria-label', '테마를 입힐 층');
  thRow.append(el('span', 'lab', '테마'), floorBox, applyBtn, clearBtn);
  const pickRow = el('div', 'row'); pickRow.id = 'mkThemes'; pickRow.setAttribute('role', 'group'); pickRow.setAttribute('aria-label', '테마');
  for (const th of THEMES) {
    const b = button('chip'); b.dataset.id = th.id; b.title = th.name; b.setAttribute('aria-label', th.name);
    b.append(el('b', '', th.icon), th.short);
    b.addEventListener('click', () => { pick = th.id; paint(); });
    pickRow.appendChild(b);
  }
  const rows = [lvRow, thRow, pickRow];
  for (const r of rows) r.hidden = true;

  let lv = 1, pick = THEMES[0].id, armed = 0, floorsKey = '', known = BASE_LEVELS; // known = 바로 전 프레임의 층 수 (친구가 더했는지 지웠는지 알리려고)
  const S = () => K.S();
  const may = () => K.allowed() && K.canEdit();
  const themeName = (id) => { const t = THEMES.find((x) => x.id === id); return t ? `${t.icon} ${t.name}` : '없음'; };
  // '으로' / '로': 받침이 없거나 ㄹ 받침이면 '로' (카페로, 서재로, 산장으로)
  const ro = (w) => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c < 11172 && c % 28 !== 0 && c % 28 !== 8 ? '으로' : '로'; };
  const floorsOn = () => { const out = []; for (let k = 1; k < S().levels; k++) if (canTheme(S(), k)) out.push(k); return out; };
  const itemsOn = (k) => [...S().items.values()].filter((it) => levelOfCell(it.i) === k);
  const themeItems = (k) => [...S().items.keys()].filter((id) => isThemeItem(id, k)).length;

  // 맨 위에 층 하나 더하기. 바뀐 층 수 (못 했으면 0)
  function add() {
    if (!may()) return 0;
    const n = S().levels;
    if (n >= MAX_LEVELS) { K.toast(`${MAX_LEVELS}층까지만 지을 수 있어요`); return 0; }
    if (!K.op({ t: 'levels', n: n + 1 })) return 0;
    K.toast(`🏗️ ${n + 1}층을 지었어요! ${n}층의 사다리로 올라가 보세요`);
    return n + 1;
  }
  // 맨 위 층 지우기 (마스터키로 더한 층만). 바뀐 층 수 (못 했으면 0)
  function drop() {
    if (!may()) return 0;
    const n = S().levels;
    if (n <= BASE_LEVELS) { K.toast(`처음부터 있는 ${BASE_LEVELS}층까지는 지울 수 없어요`); return 0; }
    if (!K.op({ t: 'levels', n: n - 1 })) return 0;
    K.toast(`${n}층을 지웠어요`);
    return n - 1;
  }
  // 층 k 에 테마 id 입히기. 놓은 테마 가구 수 (못 했으면 -1)
  function apply(k = lv, id = pick) {
    if (!may()) return -1;
    if (!canTheme(S(), k)) { K.toast('그 층에는 테마를 입힐 수 없어요'); return -1; }
    const th = THEMES.find((t) => t.id === id);
    if (!th || !K.op({ t: 'theme', lv: k, id })) return -1;
    const n = themeItems(k), skip = th.items.filter(([kind]) => kindOf(kind)).length - n;
    K.toast(`${th.icon} ${k + 1}층을 ${th.name}${ro(th.name)} 꾸몄어요 (가구 ${n}개${skip > 0 ? `, 자리가 없어 ${skip}개는 못 놓았어요` : ''})`);
    return n;
  }
  // 층 k 의 테마 지우기. 치운 테마 가구 수 (못 했으면 -1)
  function clear(k = lv) {
    if (!may() || !S().themes.has(k)) return -1;
    const n = themeItems(k);
    if (!K.op({ t: 'theme', lv: k, id: '' })) return -1;
    K.toast(`${k + 1}층의 테마를 지웠어요 (테마 가구 ${n}개를 치웠어요)`);
    return n;
  }
  addBtn.addEventListener('click', () => { armed = 0; add(); paint(); });
  delBtn.addEventListener('click', () => {
    if (S().levels <= BASE_LEVELS) { armed = 0; drop(); paint(); return; }
    if (armed && performance.now() - armed < 5000) { armed = 0; drop(); paint(); return; }
    armed = performance.now(); paint();
  });
  applyBtn.addEventListener('click', () => { apply(); paint(); });
  clearBtn.addEventListener('click', () => { clear(); paint(); });

  function paint() {
    const s = S(), n = s.levels;
    lvLab.textContent = `${n}층 집`;
    addBtn.disabled = n >= MAX_LEVELS;
    addBtn.hidden = !!armed;
    delBtn.disabled = n <= BASE_LEVELS;
    delBtn.textContent = armed ? `한 번 더 누르면 ${n}층과 그 층 가구 ${itemsOn(n - 1).length}개를 지워요` : '맨 위 층 지우기';
    delBtn.classList.toggle('main', !!armed);
    const fl = floorsOn();
    if (!fl.includes(lv)) lv = fl[0] || 1;
    const key = fl.map((k) => k + ':' + (s.themes.get(k) || '')).join(',');
    if (key !== floorsKey) {
      floorsKey = key;
      floorBox.textContent = '';
      for (const k of fl) {
        const t = THEMES.find((x) => x.id === s.themes.get(k)), b = button('chip', `${k + 1}층${t ? ' ' + t.icon : ''}`);
        b.dataset.lv = String(k); b.setAttribute('aria-label', `${k + 1}층${t ? ': ' + t.name : ''}`);
        b.addEventListener('click', () => { lv = k; const cur = S().themes.get(k); if (cur) pick = cur; paint(); });
        floorBox.appendChild(b);
      }
    }
    for (const b of floorBox.children) b.setAttribute('aria-pressed', String(+b.dataset.lv === lv));
    for (const b of pickRow.children) b.setAttribute('aria-pressed', String(b.dataset.id === pick));
    applyBtn.setAttribute('aria-label', `${lv + 1}층에 ${themeName(pick)} 테마 적용`);
    clearBtn.disabled = !s.themes.get(lv);
  }
  return {
    // 다른 사람이 층을 더하거나 지웠고, 테마를 바꿨다. down = 지운 층에 있던 내가 아래층으로 내려왔다 (그 알림이 먼저다)
    onOp(op, from, down) {
      floorsKey = '';
      if (!rows[0].hidden) paint();
      const was = known; known = S().levels;
      if (from !== 'peer' || down) return;
      if (op.t === 'levels') K.toast(op.n > was ? `🏗️ ${op.n}층이 생겼어요! ${op.n - 1}층의 사다리로 올라가 봐요` : `${was}층이 없어졌어요. 이제 ${op.n}층 집이에요`);
      else if (op.t === 'theme' && op.lv === K.level()) K.toast(op.id ? `누가 이 층을 ${themeName(op.id)}${ro(themeName(op.id))} 꾸몄어요` : '누가 이 층의 테마를 지웠어요');
    },
    // 프레임마다: 마스터 판에 줄을 넣고, 권한에 따라 보이거나 숨긴다
    tick() {
      known = S().levels;
      const show = may(), panel = document.getElementById('masterP');
      if (panel && rows[0].parentNode !== panel) for (const r of rows) panel.insertBefore(r, panel.lastChild); // 마스터 탭이 만들어진 뒤에 그 안에 넣는다 ('마스터키 끄기' 줄 위)
      if (armed && performance.now() - armed >= 5000) { armed = 0; paint(); }
      if (rows[0].hidden !== !show) { for (const r of rows) r.hidden = !show; if (show) paint(); if (K.mode() === 'master') K.measure(); }
    },
    test: {
      add, drop, apply, clear, paint,
      get levels() { return S().levels; }, get themes() { return [...S().themes]; }, get shown() { return !rows[0].hidden; },
      get floor() { return lv; }, get pick() { return pick; }, get armed() { return !!armed; },
      themeItems, // 그 층의 테마 가구 수
      known: (id) => { const t = THEMES.find((x) => x.id === id); return t ? t.items.filter(([k]) => kindOf(k)).length : 0; }, // 그 테마에서 목록에 있는 가구 수
    },
  };
}
