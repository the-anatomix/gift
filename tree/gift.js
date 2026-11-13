// 선물 교환: 트리 밑에 선물을 두고, 12월 25일 0시(현지 시간)가 되면 연다.
//   트리 앞에서 스페이스바(또는 트리 판의 🎁 단추, 트리 밑 선물 상자 누르기)로 아래 판이 열린다. 판은 세 가지 모습:
//   목록(트리 밑 선물들) · 쓰기(받는 사람, 보내는 사람, 편지, 포장 색, 🍰 케이크 한 조각 담기) · 읽기(연 선물의 편지).
//   선물은 방의 상태(state.js 의 gift, giftOpen, giftDel)라서 저장도, 같이 있는 사람에게 전하는 것도 다른 변화와 같은 길로 간다.
//   구경하는 사람도 두고 열 수 있다. 치우기는 꾸밀 수 있는 사람만. 방 하나에 GIFT.max 개, 한 사람이 GIFT.gap 에 한 번.
//   25일 0시 전에는 열 수 없고, 보낸 사람과 편지는 그때까지 화면에 보이지 않는다(방의 상태로는 같이 간다).
//   25일~31일에 둔 선물은 바로 열 수 있다(둔 해의 12월 25일 0시가 여는 때다).
//   접속해 있는 동안 시계가 25일 0시를 넘기면 모든 선물 상자가 들썩이며 알림이 뜬다(각자 자기 시계로).
// app.js 가 넘겨주는 창구 K:
//   key, store, toast, op(변화) → 받아들였는지, canEdit(), newId(), defName(), S() → 방의 상태, g0 → 1층 묶음(트리가 있는 곳),
//   me → 내 아바타, mode() → 지금 판, setMode(m), ray(px, py) → 화면의 한 점에서 나가는 빛줄기, act(행동), cakeEaten(케이크 id),
//   resized() → 판 높이가 바뀌었다, dirty()
import { THREE, M, put, rbox, ball } from './kit.js';
import { GIFT, WRAPS, NOTE } from './catalog.js';
import { cleanWords, giftsList, cakesList } from './state.js';

// 지금 시각. 검사에서는 window.__now 로 날짜를 바꾼다 (날짜는 그 사람 기기의 현지 시간)
const now = () => (typeof window.__now === 'function' ? window.__now() : Date.now());
const $ = (id) => document.getElementById(id);
const DAY = 864e5;
const hex = (v) => '#' + v.toString(16).padStart(6, '0');
// 그 선물을 여는 때: 둔 해의 12월 25일 0시 (25일~31일에 둔 것은 둔 때보다 이르니 바로 열린다)
export const openAt = (at) => new Date(new Date(at).getFullYear(), 11, 25).getTime();
export const canOpen = (g) => now() >= openAt(g.at);
// 크리스마스(이번 해 12월 25일)까지 남은 날
function dDay() { const t = new Date(now()); return Math.round((new Date(t.getFullYear(), 11, 25) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / DAY); }
const xmas = () => { const t = new Date(now()); return t.getMonth() === 11 && t.getDate() >= 25; };
const waitText = (g) => `To. ${g.to} · 12월 25일 0시에 열 수 있어요 (D-${Math.max(1, Math.round((openAt(g.at) - new Date(new Date(now()).setHours(0, 0, 0, 0))) / DAY))})`;
const hash = (s) => { let h = 7; for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0; return h; };

// 트리 밑 자리: 바깥 둘레(16자리)부터, 앞쪽(처음 보는 쪽)에서 양옆으로 번갈아 채운다.
// 트리 둘레의 걸어 들어갈 수 없는 칸(가로세로 -1 ~ 1) 안쪽에만 놓아서 걷는 길을 막지 않는다. 가지 끝 밖으로 조금 나와야 잘 보인다
const SLOTS = [], EDGE = 0.86;
for (const [n, r] of [[16, 1.12], [8, 0.7]]) for (let k = 0; k < n; k++) {
  const a = Math.PI / 4 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI * 2 / n) + (r < 1 ? Math.PI / n : 0);
  SLOTS.push([Math.max(-EDGE, Math.min(EDGE, Math.sin(a) * r)), Math.max(-EDGE, Math.min(EDGE, Math.cos(a) * r))]);
}

const CSS = `
#giftP .gl{max-height:min(30vh,220px);overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:6px}
#giftP .gr{display:flex;align-items:center;gap:8px;background:#fff;border:1.5px solid var(--line);border-radius:12px;padding:4px 4px 4px 10px}
#giftP .gr i{flex:none;width:22px;height:22px;border-radius:6px;background:var(--c);box-shadow:inset 0 0 0 2px var(--b)}
#giftP .gr div{flex:1;min-width:0;font-size:13.5px;font-weight:800;color:var(--choc);word-break:break-all}
#giftP .gr small{display:block;font-size:11.5px;font-weight:600;color:var(--sub)}
#giftP .gr .btn{padding:0 10px;font-size:12.5px}
#giftP .none{color:var(--sub);font-size:12.5px;padding:2px 0}
#giftP input{min-width:0;min-height:46px;border:1.5px solid var(--line);border-radius:12px;padding:0 10px;font:inherit;font-size:16px;font-weight:600;
  background:#fff;color:var(--ink);user-select:text;-webkit-user-select:text;outline:none;flex:1}
#giftP input:focus{border-color:var(--choc)}
#giftP .lab{width:52px}
#giftP .letter{background:#FFF8EA;border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;font-size:14.5px;font-weight:600;line-height:1.55;
  white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text;max-height:min(30vh,200px);overflow-y:auto}
#giftP .letter b{display:block;color:var(--choc);font-size:13px;margin-bottom:4px}
#giftP .letter small{display:block;margin-top:6px;font-size:12.5px;color:var(--sub);text-align:right}
#giftP .btns{display:flex;gap:6px;flex-wrap:wrap}
#giftP .btns .btn{flex:1 0 auto}
#giftP .chip[aria-disabled=true]{opacity:.5}
`;

export function makeGift(K) {
  const NAME_KEY = K.key('name'); // 방명록과 같은 이름 칸 기억
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const panel = document.createElement('div');
  panel.id = 'giftP'; panel.className = 'sheet'; panel.hidden = true; panel.setAttribute('aria-label', '트리 밑 선물');
  $('bottom').insertBefore(panel, $('tabs'));
  { // 트리 판의 장식 목록 맨 앞에도 "선물" 단추를 둔다 (누르면 선물 판이 열린다)
    const list = $('ornList'), b = document.createElement('button');
    b.type = 'button'; b.className = 'pick'; b.id = 'giftTree'; b.dataset.v = 'gift'; b.setAttribute('aria-label', '트리 밑 선물');
    const i = document.createElement('b'); i.textContent = '🎁'; b.append(i, '선물');
    b.addEventListener('click', () => openPanel());
    if (list) list.insertBefore(b, list.firstChild);
  }
  let view = 'list', reading = null, wrap = WRAPS[0].id, withCake = false, lastAt = -Infinity;
  let draft = { to: '', from: '', text: '' };
  const myName = () => cleanWords(K.store.get(NAME_KEY), NOTE.name) || cleanWords(K.defName(), NOTE.name) || '친구';
  const S = () => K.S();
  const shown = () => K.mode() === 'gift';
  // 한 조각 담을 수 있는 케이크 (조각이 남았고, 촛불이 꺼져 있고, 아무도 들고 있지 않은 것). 없으면 null
  function cakeToPack() { for (const [id, c] of cakesList(S())) if (c.left > 0 && !c.lit && !c.by) return id; return null; }

  /* ───────── 판 ───────── */
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const button = (label, fn, main, id) => { const b = el('button', 'btn' + (main ? ' main' : ''), label); b.type = 'button'; if (id) b.id = id; b.addEventListener('click', fn); return b; };
  function paint() {
    if (!shown()) return;
    panel.textContent = '';
    if (view === 'write') paintWrite(); else if (view === 'read' && S().gifts.has(reading)) paintRead(); else { view = 'list'; paintList(); }
    K.resized();
  }
  function paintList() {
    const list = giftsList(S()), edit = K.canEdit();
    const h = el('h2', '', '🎁 트리 밑 선물 '), sm = el('small', '', `${list.length}/${GIFT.max}`);
    h.appendChild(sm);
    const d = dDay();
    const hint = el('div', 'hint');
    hint.appendChild(el('small', '', xmas() ? '메리 크리스마스! 선물을 열어 보세요. 25일~31일에 두는 선물은 바로 열 수 있어요.' : `12월 25일 0시에 열 수 있어요 (D-${d}). 그때까지 보낸 사람과 편지는 비밀이에요.`));
    const box = el('div', 'gl');
    box.setAttribute('role', 'list');
    if (!list.length) box.appendChild(el('div', 'none', '아직 트리 밑에 선물이 없어요. 첫 선물을 두어 보세요!'));
    for (const g of list) {
      const w = WRAPS.find((x) => x.id === g.wrap) || WRAPS[0], row = el('div', 'gr'), sw = el('i'), who = el('div', '', `To. ${g.to}`);
      row.dataset.id = g.id; row.setAttribute('role', 'listitem');
      sw.style.setProperty('--c', hex(w.box)); sw.style.setProperty('--b', hex(w.band));
      const ok = canOpen(g);
      who.appendChild(el('small', '', g.open ? `From. ${g.from} · 열었어요${g.cake ? ' · 🍰' : ''}` : ok ? '열 수 있어요!' : '🔒 12월 25일 0시에 열려요'));
      row.append(sw, who);
      if (g.open) row.appendChild(button('읽기', () => read(g.id)));
      else if (ok) row.appendChild(button('열기', () => openGift(g.id), true));
      else row.appendChild(button('🔒', () => K.toast(waitText(g))));
      if (edit) row.appendChild(button('치우기', () => { if (K.op({ t: 'giftDel', id: g.id })) K.toast('선물을 치웠어요'); }));
      box.appendChild(row);
    }
    const btns = el('div', 'btns');
    btns.append(button('🎁 선물 두기', () => { view = 'write'; paint(); }, true, 'giftNew'), button('닫기', close, false, 'giftClose'));
    panel.append(h, hint, box, btns);
  }
  function paintWrite() {
    const h = el('h2', '', '🎁 선물 두기 '), sm = el('small', '', '트리 밑에 놓여요');
    h.appendChild(sm);
    const field = (lab, id, max, val, ph) => { const i = el('input'); i.id = id; i.type = 'text'; i.maxLength = max; i.value = val; i.placeholder = ph; i.autocomplete = 'off'; i.setAttribute('aria-label', lab); return i; };
    const toIn = field('받는 사람', 'giftTo', GIFT.name, draft.to, '받는 사람'), fromIn = field('보내는 사람', 'giftFrom', GIFT.name, draft.from || myName(), '보내는 사람');
    const textIn = field('편지', 'giftText', GIFT.text, draft.text, '편지 (25일에 보여요)');
    textIn.setAttribute('enterkeyhint', 'done');
    const keep = () => { draft = { to: toIn.value, from: fromIn.value, text: textIn.value }; };
    for (const i of [toIn, fromIn, textIn]) i.addEventListener('input', keep);
    const r1 = el('div', 'row'); r1.append(el('span', 'lab', 'To.'), toIn);
    const r2 = el('div', 'row'); r2.append(el('span', 'lab', 'From.'), fromIn);
    const r3 = el('div', 'row'); r3.appendChild(textIn);
    const r4 = el('div', 'row'), wl = el('div', 'row');
    wl.id = 'giftWraps'; wl.setAttribute('role', 'group'); wl.setAttribute('aria-label', '포장 색'); wl.style.gap = '5px'; wl.style.flexWrap = 'wrap';
    for (const w of WRAPS) {
      const b = el('button', 'sw'); b.type = 'button'; b.dataset.v = w.id; b.title = w.name; b.setAttribute('aria-label', `포장 ${w.name}`);
      b.style.setProperty('--c', hex(w.box)); b.setAttribute('aria-pressed', String(w.id === wrap));
      b.addEventListener('click', () => { wrap = w.id; keep(); paint(); });
      wl.appendChild(b);
    }
    r4.appendChild(wl);
    const cid = cakeToPack();
    if (!cid) withCake = false;
    const ck = el('button', 'chip', withCake ? '🍰 케이크 한 조각 담았어요' : '🍰 케이크 한 조각 담기');
    ck.type = 'button'; ck.id = 'giftCake'; ck.setAttribute('aria-pressed', String(withCake)); ck.style.flex = '1';
    if (!cid) { ck.setAttribute('aria-disabled', 'true'); ck.textContent = '🍰 케이크 한 조각 담기 (남은 케이크가 없어요)'; }
    ck.addEventListener('click', () => { keep(); if (!cakeToPack()) { K.toast('조각이 남은 케이크가 없어요. 주방에서 구워 보세요'); return; } withCake = !withCake; paint(); });
    const r5 = el('div', 'row'); r5.appendChild(ck);
    const btns = el('div', 'btns');
    btns.append(button('🎄 트리 밑에 두기', () => { keep(); send(); }, true, 'giftSend'), button('뒤로', () => { keep(); view = 'list'; paint(); }, false, 'giftBack'));
    textIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); keep(); send(); } });
    panel.append(h, r1, r2, r3, r4, r5, btns);
  }
  function paintRead() {
    const g = S().gifts.get(reading);
    const h = el('h2', '', `🎁 To. ${g.to}`);
    const letter = el('div', 'letter');
    letter.appendChild(el('b', '', `From. ${g.from}`));
    letter.appendChild(document.createTextNode(g.text || '(편지 없이 마음만 담았어요)'));
    if (g.cake) letter.appendChild(el('small', '', '🍰 케이크 한 조각이 들어 있었어요'));
    const btns = el('div', 'btns');
    btns.append(button('목록', () => { view = 'list'; paint(); }, false, 'giftList'), button('닫기', close, true, 'giftClose'));
    panel.append(h, letter, btns);
  }
  function openPanel(v = 'list') {
    view = v;
    if (!shown()) K.setMode('gift');
    paint();
    return shown();
  }
  function close() { if (shown()) K.setMode(null); }
  function read(id) { reading = id; view = 'read'; if (!shown()) K.setMode('gift'); paint(); }

  // 선물 두기. 두었으면 true
  function send() {
    const to = cleanWords(draft.to, GIFT.name), from = cleanWords(draft.from, GIFT.name) || myName(), text = cleanWords(draft.text, GIFT.text);
    if (!to) { K.toast('받는 사람 이름을 적어 주세요'); const i = $('giftTo'); if (i) i.focus(); return false; }
    if (S().gifts.size >= GIFT.max) { K.toast(`선물은 ${GIFT.max}개까지 둘 수 있어요`); return false; }
    const wait = lastAt + GIFT.gap - performance.now();
    if (wait > 0) { K.toast(`${Math.ceil(wait / 1000)}초 뒤에 다시 둘 수 있어요`); return false; }
    const cake = withCake ? cakeToPack() : '';
    if (withCake && !cake) { K.toast('조각이 남은 케이크가 없어요'); withCake = false; paint(); return false; }
    if (!K.op({ t: 'gift', id: K.newId(), to, from, text, wrap, at: Math.round(now()), cake: cake || '' })) { K.toast('선물을 두지 못했어요'); return false; }
    if (cleanWords(draft.from, GIFT.name) && from !== cleanWords(K.defName(), NOTE.name)) { if (K.setName) K.setName(from); else K.store.set(NAME_KEY, from); }
    lastAt = performance.now();
    draft = { to: '', from, text: '' }; withCake = false;
    for (const i of panel.querySelectorAll('input')) i.blur();
    view = 'list'; paint();
    K.toast(cake ? `To. ${to} 선물을 트리 밑에 두었어요 🎁🍰` : `To. ${to} 선물을 트리 밑에 두었어요 🎁`);
    return true;
  }
  // 선물 열기. 열었으면 true
  function openGift(id) {
    const g = S().gifts.get(id);
    if (!g) return false;
    if (g.open) { read(id); return false; }
    if (!canOpen(g)) { K.toast(waitText(g)); return false; }
    if (!K.op({ t: 'giftOpen', id })) return false;
    return true;
  }

  /* ───────── 트리 밑 상자 ───────── */
  const root = new THREE.Group();
  root.name = 'gifts';
  K.g0.add(root);
  const views = new Map(); // 선물 id → { g, lid, tag, tex, jig, drop, opening }
  function tagTexture(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 112;
    const x = c.getContext('2d');
    x.fillStyle = '#FFF8EA'; x.fillRect(0, 0, 256, 112);
    x.strokeStyle = '#C9A06B'; x.lineWidth = 6; x.strokeRect(3, 3, 250, 106);
    x.fillStyle = '#5A3824'; x.textAlign = 'center'; x.textBaseline = 'middle';
    let size = 44; x.font = `bold ${size}px sans-serif`;
    while (x.measureText(text).width > 232 && size > 16) { size -= 2; x.font = `bold ${size}px sans-serif`; }
    x.fillText(text, 128, 58);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  function build(g) {
    const w = WRAPS.find((x) => x.id === g.wrap) || WRAPS[0], hsh = hash(g.id), s = 0.22 + (hsh % 5) * 0.018, h = 0.18 + ((hsh >> 3) % 5) * 0.025;
    const grp = new THREE.Group(), body = h * 0.8, lh = h * 0.24;
    grp.userData.gift = g.id;
    put(rbox(s, body, s, 0.015), w.box, 0, body / 2, 0, grp);
    put(new THREE.BoxGeometry(s + 0.006, body + 0.002, 0.045), w.band, 0, body / 2, 0, grp, false);
    put(new THREE.BoxGeometry(0.045, body + 0.002, s + 0.006), w.band, 0, body / 2, 0, grp, false);
    put(new THREE.BoxGeometry(s * 0.9, 0.01, s * 0.9), 0x3A2A20, 0, body - 0.004, 0, grp, false); // 열면 보이는 안쪽
    // 뚜껑: 뒤쪽 모서리를 축으로 열린다
    const lid = new THREE.Group(); lid.position.set(0, body, -s / 2 - 0.006); grp.add(lid);
    const L = new THREE.Group(); L.position.set(0, lh / 2, s / 2 + 0.006); lid.add(L);
    put(rbox(s + 0.012, lh, s + 0.012, 0.012), w.box, 0, 0, 0, L);
    put(new THREE.BoxGeometry(s + 0.018, lh + 0.002, 0.045), w.band, 0, 0, 0, L, false);
    put(new THREE.BoxGeometry(0.045, lh + 0.002, s + 0.018), w.band, 0, 0, 0, L, false);
    for (const k of [-1, 1]) put(ball(0.04, 8, 6), w.band, 0.035 * k, lh / 2 + 0.02, 0, L).scale.set(1.15, 0.65, 0.65);
    put(ball(0.02, 8, 6), w.band, 0, lh / 2 + 0.018, 0, L, false);
    // "To. 이름" 꼬리표: 앞면에 비스듬히
    const tex = tagTexture(`To. ${g.to}`), tag = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.066), new THREE.MeshBasicMaterial({ map: tex }));
    tag.position.set(s * 0.18, body * 0.55, s / 2 + 0.008); tag.rotation.z = -0.12;
    grp.add(tag);
    // 편지: 열면 상자에서 비죽 나온다
    const letter = put(new THREE.BoxGeometry(s * 0.6, 0.12, 0.008), 0xFFF8EA, 0, body + 0.02, 0, grp, false);
    letter.rotation.x = -0.25; letter.visible = false;
    return { g: grp, lid, tex, tag, letter, jig: 0, drop: 0, open: 0, wasOpen: false };
  }
  function place() { // 둔 차례대로 자리를 잡는다
    giftsList(S()).forEach((g, n) => {
      const v = views.get(g.id), [x, z] = SLOTS[n % SLOTS.length];
      v.g.position.x = x; v.g.position.z = z;
      v.g.rotation.y = Math.atan2(x, z) + ((hash(g.id) % 7) - 3) * 0.06; // 꼬리표가 바깥을 본다
    });
  }
  // 상자 모양을 방 상태에 맞춘다
  function sync(newId = null) {
    const gifts = S().gifts;
    for (const [id, v] of [...views]) if (!gifts.has(id)) { root.remove(v.g); v.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); v.tex.dispose(); v.tag.material.dispose(); views.delete(id); }
    for (const g of gifts.values()) {
      let v = views.get(g.id);
      if (!v) { v = build(g); views.set(g.id, v); root.add(v.g); if (g.id === newId) v.drop = 1; if (g.open) { v.open = 1; v.wasOpen = true; } }
    }
    place();
    K.dirty();
  }
  const rc = new THREE.Raycaster();
  // 화면을 눌렀을 때 선물 상자를 눌렀으면 그 선물을 연다(열 수 없으면 언제 열리는지 알려 준다). 처리했으면 true
  function tap(px, py) {
    if (!root.visible || !views.size || !root.parent || !isShownLevel()) return false;
    rc.ray.copy(K.ray(px, py));
    const hits = rc.intersectObjects(root.children, true);
    if (!hits.length) return false;
    let o = hits[0].object; while (o && !o.userData.gift) o = o.parent;
    if (!o) return false;
    const g = S().gifts.get(o.userData.gift);
    if (!g) return false;
    if (g.open) read(g.id);
    else if (canOpen(g)) openGift(g.id);
    else { K.toast(waitText(g)); const v = views.get(g.id); if (v) v.jig = Math.max(v.jig, 0.5); }
    return true;
  }
  const isShownLevel = () => K.g0.visible !== false && K.me.level === 0;
  // 트리 앞에 서 있으면 스페이스바(#act 단추)로 할 수 있는 일
  function near() {
    if (!isShownLevel()) return null;
    const me = K.me;
    if (Math.hypot(me.x, me.z) > 1.8) return null;
    const ready = [...S().gifts.values()].some((g) => !g.open && canOpen(g));
    return { label: ready ? '🎁 선물 열기' : '🎁 트리 밑 선물', run: () => openPanel() };
  }

  /* ───────── 방의 변화 ───────── */
  function onOp(op, from) {
    const mine = from === 'me' || from === 'mine';
    if (op.t === 'gift') {
      sync(from === 'load' ? null : op.id);
      if (op.cake && op.cake !== true && from !== 'load') K.cakeEaten(op.cake);
      if (from === 'peer') K.toast(`🎁 트리 밑에 To. ${op.to} 선물이 놓였어요`);
    } else if (op.t === 'giftOpen') {
      sync();
      const g = S().gifts.get(op.id), v = views.get(op.id);
      if (v && from !== 'load') { v.jig = 0.4; v.open = 0.001; }
      if (g && mine) {
        read(g.id);
        if (g.cake) { K.act('eat'); K.toast('🍰 케이크 한 조각이 들어 있었어요! 냠냠'); } else K.toast(`🎁 From. ${g.from} 선물을 열었어요`);
      } else if (g && from === 'peer') K.toast(`🎁 To. ${g.to} 선물이 열렸어요`);
    } else if (op.t === 'giftDel') {
      sync();
      if (reading === op.id && view === 'read') view = 'list';
    }
    if (shown() && from !== 'load') paint();
  }

  /* ───────── 매 장면 ───────── */
  let wasXmas = null, since = 1, giftsRef = null, clock = 0;
  function tick(dt) {
    clock += dt; since += dt;
    if (since > 0.25) {
      since = 0;
      if (S().gifts !== giftsRef || S().gifts.size !== views.size) { giftsRef = S().gifts; sync(); } // 방이 통째로 바뀌었다
      const x = xmas();
      if (wasXmas === false && x) { // 지금 막 12월 25일 0시가 됐다: 모든 선물 상자가 들썩인다
        for (const v of views.values()) v.jig = 2.6;
        if (views.size) K.toast('선물을 열 수 있어요! 🎁');
        if (shown()) paint();
      }
      wasXmas = x;
      if (shown() && view !== 'write' && (clock % 30) < 0.26) paint(); // 남은 날 글을 가끔 고친다
    }
    let moving = false;
    for (const v of views.values()) {
      if (v.drop > 0) { v.drop = Math.max(0, v.drop - dt * 2.2); const u = v.drop; v.g.position.y = u * u * 1.2; v.g.scale.setScalar(1 - u * 0.4); moving = true; }
      else if (v.jig > 0) {
        v.jig = Math.max(0, v.jig - dt);
        const a = Math.min(1, v.jig);
        v.g.position.y = Math.abs(Math.sin(clock * 14 + v.g.position.x * 9)) * 0.06 * a;
        v.g.rotation.z = Math.sin(clock * 22 + v.g.position.z * 7) * 0.12 * a;
        moving = true;
      } else if (v.g.position.y || v.g.rotation.z) { v.g.position.y = 0; v.g.rotation.z = 0; v.g.scale.setScalar(1); moving = true; }
      if (v.open > 0 && v.open < 1) { v.open = Math.min(1, v.open + dt * 2.4); moving = true; }
      const e = v.open >= 1 ? 1 : v.open * v.open * (3 - 2 * v.open);
      v.lid.rotation.x = -1.9 * e;
      v.letter.visible = v.open > 0.5;
      if (v.letter.visible) v.letter.position.y = v.g.children[0].position.y * 2 + 0.02 * e + 0.03;
    }
    if (moving) K.dirty();
    // 판이 닫혔으면 입력 칸의 포커스를 놓는다
    if (!shown() && panel.contains(document.activeElement)) document.activeElement.blur();
  }

  window.__gift = { // 자동 검사가 쓰는 창구
    openPanel, close, send, openGift, read, tap, near, canOpen, openAt,
    get view() { return shown() ? view : null; },
    set draft(d) { draft = { to: d.to || '', from: d.from || '', text: d.text || '' }; if (d.wrap) wrap = d.wrap; withCake = !!d.cake; if (shown()) paint(); },
    get boxes() { return [...views].map(([id, v]) => { v.g.updateMatrixWorld(); const p = v.g.getWorldPosition(new THREE.Vector3()); return { id, x: p.x, z: p.z, y: p.y, jig: v.jig, lid: v.lid.rotation.x, letter: v.letter.visible }; }); },
    get rows() { return [...panel.querySelectorAll('.gr')].map((r) => ({ id: r.dataset.id, text: r.querySelector('div').textContent, btns: [...r.querySelectorAll('button')].map((b) => b.textContent) })); },
    get text() { return panel.textContent; },
    resetGap() { lastAt = -Infinity; },
    boxPoint(id) { const v = views.get(id); if (!v) return null; v.g.updateMatrixWorld(); const p = v.g.localToWorld(new THREE.Vector3(0, 0.1, 0)); return { x: p.x, y: p.y, z: p.z }; },
  };
  return { onOp, tick, tap, near, open: openPanel };
}
