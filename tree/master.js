// 마스터키: 이 기기에서만 켜는 숨은 열쇠. 제목 "트리 같이 꾸미기" 를 빠르게 일곱 번 누르고 암호를 넣으면 켜진다
//   한 번 켜면 이 기기에서는 끌 때까지 그대로이고, 아래 탭에 "🔑 마스터" 가 생긴다. 암호는 주인만 안다.
//   황금열쇠(quest.js): 1층 바닥의 숨은 열쇠. 퀘스트를 모두 깨면 암호 없이 쓸 수 있고, 쓰면 아래 권한을 모두 가진다(GOLD = 'on').
//     암호로 켠 마스터는 마스터 탭의 사람 줄 맨 앞 🗝️ 로 그 사람의 황금열쇠를 켜고 끈다. 끄면 'off' 로 남아 퀘스트를 다 깼어도 다시 켜 줄 때까지 못 쓴다.
//     황금열쇠로는 다른 사람의 권한을 바꾸지 못한다(사람 줄과 끄기 단추는 암호 마스터에게만 보인다).
//   켜면(권한을 모두 가진다):
//     LOCK 어드벤트 달력으로 잠긴 가구·장식·전구·벽지·바닥을 잠금 없이 쓴다 (달력 칸은 그대로라 다른 사람은 예전처럼 하루에 한 칸씩 연다)
//     FIRE 불꽃놀이를 아무 날에나 터뜨린다 (불꽃놀이 단추는 이 권한이 있는 사람에게만 보인다)
//     SKY  하늘을 낮·노을·밤으로 바꾼다 (방 사람 모두에게)
//     GIFT 트리 밑 선물을 12월 25일 전에도 연다
//     SUIT 비행 슈트를 입고 난다 (costume.js, fly.js),  SLED 마당에서 루돌프 썰매를 타고 하늘을 난다 (fly.js, sleigh.js)
//     CINE 3층을 한 번에 영화관으로 바꾸는 단추 (cinema.js), 4층을 한 번에 게임방으로 꾸미는 단추 (gameroom.js)
//     BUILD 맨 위에 층 더하기·더한 층 지우기, 층에 테마 입히기 (build.js)
//   마스터 탭에서 방에 있는 사람마다 이 권한들을 따로 켜고 끌 수 있다. 받은 권한은 그 사람 기기에 남아 다음에도 그대로다.
//   소식: { k: 'mk', v: '<받는 사람 id>:<권한 숫자>' } 주기, { k: 'mk', v: '?' } 지금 권한 묻기, { k: 'mk', v: '=<권한 숫자>' } 답(황금열쇠가 켜져 있으면 뒤에 g, 꺼 두었으면 x),
//         { k: 'mk', v: '<받는 사람 id>:g1' | ':g0' } 황금열쇠 켜기·끄기.
// 암호는 코드에 해시(SHA-256)로만 둔다. 사이트 코드는 누구나 볼 수 있고 소식도 흉내 낼 수 있으니 완벽한 보안은 아니고, 모르는 사람이 우연히 켜지 못하게 하는 정도다.
const NS = (() => { try { const n = new URLSearchParams(location.search).get('ns'); return n ? '.' + n : ''; } catch (_) { return ''; } })(); // 자동 검사는 ?ns= 로 창마다 저장값을 나눈다
const HASH = '9262b0baa88add8fdc882f6772709ebfbd645aaa651e904e4e3d795898a71a7d', SLOT = 'tree.master' + NS, GRANT = 'tree.grant' + NS, GOLD = 'tree.gold' + NS;
export const LOCK = 1, FIRE = 2, SKY = 4, GIFT = 8, SUIT = 16, SLED = 32, CINE = 64, BUILD = 128, ALL = 255;
const get = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
export function isMaster() { return get(SLOT) === HASH; }
export function gold() { const v = get(GOLD); return v === 'on' || v === 'off' ? v : ''; } // 황금열쇠: 'on' 쓰는 중, 'off' 마스터가 꺼 둠, '' 아직
export function can(bit) { return isMaster() || gold() === 'on' || ((parseInt(get(GRANT), 10) || 0) & bit) !== 0; }
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
// K = { toast, sky: { time(), setTime(v) }, lamp: { on(lv), toggle(lv), count() 지금 층 수 }, changed(), fx(m), myId(), others(): [id], nameOf(id), setMode(m), mode(), resized() }
export function makeMaster(K) {
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const given = new Map(); // 이번에 알게 된 다른 사람들의 권한
  const golds = new Map(); // 이번에 알게 된 다른 사람들의 황금열쇠 ('on' | 'off')
  /* 아래 탭과 판 */
  const tab = el('button'); tab.type = 'button'; tab.dataset.m = 'master'; tab.innerHTML = '<b>🔑</b>마스터'; tab.hidden = true;
  $('tabs').appendChild(tab);
  const panel = el('div', 'sheet'); panel.id = 'masterP'; panel.hidden = true;
  const css = el('style');
  css.textContent = '#masterP .who{display:flex;flex-wrap:wrap;align-items:center;gap:3px}#masterP .who span{flex:1 0 100%;min-width:0;font-size:13px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '#masterP .chip{min-width:44px;min-height:44px;padding:0 4px}#masterP #mkPeople{display:flex;flex-direction:column;gap:6px;max-height:150px;overflow-y:auto}'
    + '#masterP{max-height:calc(100dvh - 130px);overflow-y:auto;overscroll-behavior:contain}#masterP>*{flex-shrink:0}#mkLamp .scroll .chip{flex:0 0 52px}'; // 줄이 많아져도 판이 화면 위로 넘치지 않게
  document.head.appendChild(css);
  const h = el('h2', '', '🔑 마스터'), skyRow = el('div', 'row'), people = el('div'), off = el('button', 'btn', '마스터키 끄기'), foot = el('div', 'row');
  people.id = 'mkPeople'; off.type = 'button'; off.id = 'masterOff'; skyRow.id = 'mkSky';
  skyRow.appendChild(el('span', 'lab', '하늘'));
  const skyBox = el('div', 'row'); skyBox.style.flex = '1'; skyBox.setAttribute('role', 'group'); skyBox.setAttribute('aria-label', '하늘');
  for (const [v, label] of [['auto', '자동'], ['day', '☀️ 낮'], ['dusk', '🌇 노을'], ['night', '🌙 밤']]) {
    const b = el('button', 'chip', label); b.type = 'button'; b.dataset.v = v; b.style.flex = '1';
    b.addEventListener('click', () => { K.sky.setTime(v); paint(); });
    skyBox.appendChild(b);
  }
  skyRow.appendChild(skyBox); foot.appendChild(off);
  // 방 불: 층마다 켜고 끈다 (lights.js). 걸어가서 스위치를 누르지 않아도 된다
  const lampRow = el('div', 'row'), lampBox = el('div', 'row'); lampRow.id = 'mkLamp';
  lampRow.appendChild(el('span', 'lab', '방 불')); lampBox.style.flex = '1'; lampBox.setAttribute('role', 'group'); lampBox.setAttribute('aria-label', '방 불');
  // 층마다 단추 하나. 마스터키로 층을 더하면 단추도 늘어난다(다섯 층부터는 글자를 줄이고 옆으로 넘기는 목록으로)
  function lampChips() {
    const n = K.lamp.count ? K.lamp.count() : 4;
    if (lampBox.children.length === n) return;
    lampBox.textContent = ''; lampBox.className = n > 4 ? 'scroll' : 'row';
    for (let lv = 0; lv < n; lv++) {
      const b = el('button', 'chip', n > 4 ? `${lv + 1}층` : `💡 ${lv + 1}층`); b.type = 'button'; b.dataset.lv = lv; if (n <= 4) b.style.flex = '1';
      b.addEventListener('click', () => { K.lamp.toggle(lv); paint(); });
      lampBox.appendChild(b);
    }
  }
  lampChips();
  lampRow.appendChild(lampBox);
  // 불꽃놀이: 글자·길이·예약을 고르는 판을 연다 (sky.js). FIRE 권한이 있는 사람에게만 보인다
  const fireRow = el('div', 'row'), fireBtn = el('button', 'btn main', '🎆 불꽃놀이'); fireRow.id = 'mkFire';
  fireBtn.type = 'button'; fireBtn.id = 'fireShow'; fireBtn.style.flex = '1';
  fireBtn.addEventListener('click', () => K.fire());
  fireRow.appendChild(fireBtn);
  { // 새해 해돋이 미리 보기: 카운트다운 → 불꽃 → 밝아 오는 하늘과 첫 해 (sky.js). 방 모두에게 보인다
    const b = el('button', 'btn', '🌅 새해 해돋이'); b.type = 'button'; b.id = 'dawnShow'; b.style.flex = '1';
    b.addEventListener('click', () => { if (K.dawn()) K.setMode(null); });
    fireRow.appendChild(b);
  }
  panel.append(h, skyRow, lampRow, fireRow, people, foot);
  $('tabs').parentNode.insertBefore(panel, $('tabs'));
  const BITS = [[LOCK, '🔓', '달력 잠금 없이 쓰기'], [FIRE, '🎆', '불꽃놀이'], [SKY, '🌙', '하늘 바꾸기'], [GIFT, '🎁', '선물 미리 열기'], [SUIT, '🚀', '비행 슈트'], [SLED, '🦌', '루돌프 썰매'], [CINE, '🎬', '3층 영화관·4층 게임방 차리기'], [BUILD, '🏗️', '층 더하기·테마 꾸미기']];
  let listKey = '';
  function paint() {
    const m = isMaster(), full = m || gold() === 'on', show = full || can(SKY) || can(FIRE) || can(CINE) || can(BUILD);
    if (tab.hidden === show) { tab.hidden = !show; $('tabs').style.gridTemplateColumns = `repeat(${[...$('tabs').children].filter((b) => !b.hidden).length}, 1fr)`; // 탭이 하나 늘어도 한 줄
      if (!show && K.mode() === 'master') K.setMode(null); K.resized(); }
    for (const b of skyBox.children) b.setAttribute('aria-pressed', String(b.dataset.v === K.sky.time()));
    lampChips();
    for (const b of lampBox.children) b.setAttribute('aria-pressed', String(K.lamp.on(+b.dataset.lv)));
    lampRow.hidden = !full; skyRow.hidden = !(m || can(SKY));
    if (fireRow.hidden === can(FIRE)) { fireRow.hidden = !can(FIRE); K.resized(); }
    people.hidden = !m; foot.hidden = !m;
    if (!m) return;
    const ids = K.others(), key = ids.map((id) => id + ':' + (given.get(id) || 0) + (golds.get(id) || '')).join(',');
    if (key === listKey) return;
    listKey = key;
    people.textContent = '';
    if (!ids.length) people.appendChild(el('small', 'hint', '방에 다른 사람이 들어오면 여기서 그 사람에게 열어 줄 것을 골라요.'));
    for (const id of ids) {
      const row = el('div', 'who'); row.dataset.id = id;
      row.appendChild(el('span', '', K.nameOf(id)));
      { // 황금열쇠(마스터키 권한 전부)를 켜고 끈다
        const b = el('button', 'chip', '🗝️'), on = golds.get(id) === 'on'; b.type = 'button'; b.dataset.gold = '1'; b.title = '마스터키'; b.setAttribute('aria-label', `${K.nameOf(id)}: 마스터키`);
        b.setAttribute('aria-pressed', String(on));
        b.addEventListener('click', () => { golds.set(id, on ? 'off' : 'on'); K.fx({ k: 'mk', v: `${id}:g${on ? 0 : 1}` }); K.toast(`${K.nameOf(id)}: 마스터키 ${on ? '끔' : '켬'}`); paint(); });
        row.appendChild(b);
      }
      for (const [bit, icon, name] of BITS) {
        const b = el('button', 'chip', icon); b.type = 'button'; b.dataset.bit = String(bit); b.title = name; b.setAttribute('aria-label', `${K.nameOf(id)}: ${name}`);
        b.setAttribute('aria-pressed', String(((given.get(id) || 0) & bit) !== 0));
        b.addEventListener('click', () => { const v = (given.get(id) || 0) ^ bit; given.set(id, v); K.fx({ k: 'mk', v: `${id}:${v}` }); K.toast(`${K.nameOf(id)}: ${name} ${v & bit ? '켬' : '끔'}`); paint(); });
        row.appendChild(b);
      }
      people.appendChild(row);
    }
  }
  off.addEventListener('click', () => { try { localStorage.removeItem(SLOT); } catch (_) {} K.changed(); paint(); K.toast('마스터키를 껐어요'); });
  // 퀘스트를 다 깨고 황금열쇠를 쓴다 (quest.js). 마스터가 꺼 두었으면 못 쓴다
  function earn() {
    if (isMaster() || gold() === 'off') return false;
    try { localStorage.setItem(GOLD, 'on'); } catch (_) { return false; }
    K.changed(); paint(); K.fx({ k: 'mk', v: '=' + (parseInt(get(GRANT), 10) || 0) + 'g' });
    return gold() === 'on';
  }
  function open() { paint(); if (K.mode() !== 'master') K.setMode('master'); if (isMaster()) K.fx({ k: 'mk', v: '?' }); }
  async function ask() {
    const p = window.prompt('암호');
    if (p == null || !p.trim()) return;
    let ok = false;
    try { ok = (await sha(p.trim())) === HASH; } catch (_) {}
    if (!ok) { K.toast('맞지 않아요'); return; }
    try { localStorage.setItem(SLOT, HASH); } catch (_) {}
    K.changed(); K.toast('🔑 마스터키를 켰어요. 아래 "마스터" 탭에서 설정해요'); open();
  }
  // 다른 사람이 보낸 소식
  function peerFx(m, id) {
    const v = typeof m.v === 'string' ? m.v : '';
    if (v === '?') { const g = parseInt(get(GRANT), 10) || 0, gd = gold(); if ((g || gd) && !isMaster()) K.fx({ k: 'mk', v: '=' + g + (gd === 'on' ? 'g' : gd === 'off' ? 'x' : '') }); return true; }
    let x = /^=(\d{1,3})([gx]?)$/.exec(v);
    if (x) { if (+x[1] <= ALL) { given.set(id, +x[1]); if (x[2]) golds.set(id, x[2] === 'g' ? 'on' : 'off'); else golds.delete(id); listKey = ''; if (K.mode() === 'master') paint(); } return true; }
    x = /^([a-z0-9]{1,8}):g([01])$/.exec(v);
    if (x) { // 마스터가 내 황금열쇠를 켜거나 껐다
      if (x[1] === K.myId() && !isMaster()) {
        const was = gold(), now = x[2] === '1' ? 'on' : 'off';
        try { localStorage.setItem(GOLD, now); } catch (_) {}
        if (now !== was) { K.changed(); paint(); K.toast(now === 'on' ? '🗝️ 방장이 마스터키를 켜 줬어요. 아래 "🔑 마스터" 탭에서 설정해요' : '🗝️ 방장이 마스터키를 껐어요'); }
      }
      return true;
    }
    x = /^([a-z0-9]{1,8}):(\d{1,3})$/.exec(v);
    if (!x || +x[2] > ALL) return false;
    if (x[1] === K.myId() && !isMaster()) {
      const was = parseInt(get(GRANT), 10) || 0, now = +x[2];
      try { if (now) localStorage.setItem(GRANT, String(now)); else localStorage.removeItem(GRANT); } catch (_) {}
      if (now !== was) { K.changed(); paint(); K.toast(now & ~was ? '🔑 새로 할 수 있는 것이 생겼어요: ' + BITS.filter(([b]) => now & ~was & b).map(([, i, n]) => i + ' ' + n).join(', ') : '🔑 할 수 있는 것이 바뀌었어요'); }
    }
    return true;
  }
  /* 제목 일곱 번 */
  const brand = document.querySelector('#top .brand');
  let taps = [];
  if (brand) {
    brand.style.pointerEvents = 'auto';
    brand.addEventListener('click', () => {
      const t = Date.now();
      taps = taps.filter((x) => t - x < 5000); taps.push(t);
      if (taps.length < 7) return;
      taps = [];
      if (isMaster()) open(); else ask();
    });
  }
  // 판이 보이는 동안에는 사람 목록을 따라가고, 열릴 때 한 번 다른 사람들의 권한을 묻는다
  let wasOpen = false;
  setInterval(() => { const on = !panel.hidden; if (on) { if (!wasOpen && isMaster()) K.fx({ k: 'mk', v: '?' }); paint(); } wasOpen = on; }, 500);
  paint();
  return { open, earn, peerFx, paint, get on() { return isMaster(); }, test: { get given() { return [...given]; }, get golds() { return [...golds]; }, get gold() { return gold(); } } };
}
