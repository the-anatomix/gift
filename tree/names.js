// 닉네임과 머리 위 이름표.
//   닉네임: 캐릭터 고르기 판(#look) 맨 위의 이름 칸에서 정한다(처음 들어올 때도, 나중에도). 이 기기에 기억하고(key('name'),
//   방명록·어드벤트·선물·순위가 쓰는 이름과 같은 것), 생김새(look.name)에 실려 친구에게 간다. 그래서 늦게 온 사람도
//   명단의 look 으로 받는다. 규칙은 방명록 이름과 같다(state.js 의 cleanWords / okWords, catalog.js 의 NOTE.name 글자).
//   이름표: 모든 캐릭터 머리 위에 DOM 한 줄(그리기 호출은 늘지 않는다). 닉네임이 없으면 기존 이름("방장", "친구2").
//   안 보이는 때: 그 아바타가 안 보일 때(다른 층·옷장 안), 1인칭의 나, 말풍선이 떠 있는 동안, 카메라 뒤,
//   숨바꼭질에서 술래가 보는 아직 안 찾힌 사람(K.quiet — 이름표가 가구 너머로 자리를 알려 주지 않게).
// app.js 가 넘겨주는 창구 K:
//   key, store, me, others() → Map(id → 아바타), myId(), online(), look() → 내 생김새, setLook(patch), defName(id) → 닉네임이 없을 때의 이름,
//   eye() → 1인칭인지, project(v) → 화면 좌표로 바꾼 THREE.Vector3(카메라 기준), quiet(id), tagged(id) → 놀이 표시("👀 찾음")가 붙었는지,
//   talking(who) → 말풍선이 떠 있는지, off() → 이름표를 모두 숨길 때(집 밖)
import { THREE } from './kit.js';
import { NOTE } from './catalog.js';
import { cleanWords } from './state.js';

const CSS = `
#nameTags{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1}
#nameTags i{position:absolute;left:0;top:0;font-style:normal;padding:1px 7px;border-radius:999px;background:rgba(255,252,245,.86);color:#3B2619;
  font-size:12px;font-weight:800;line-height:1.5;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;will-change:transform;
  box-shadow:0 1px 4px rgba(0,0,0,.25)}
#nameTags i.me{background:rgba(255,236,170,.92)}
#nameRow input{flex:1;min-width:0;min-height:46px;border:1.5px solid var(--line);border-radius:12px;padding:0 10px;font:inherit;font-size:16px;font-weight:600;
  background:#fff;color:var(--ink);user-select:text;-webkit-user-select:text;outline:none}
#nameRow input:focus{border-color:var(--choc)}
`;

export function makeNames(K) {
  const NAME_KEY = K.key('name');
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  /* ───────── 닉네임 ───────── */
  const nick = () => K.look().name || '';
  // 방명록·순위·선물에 쓰는 내 이름: 닉네임, 없으면 기존 이름("방장", "친구2")
  const myName = () => nick() || cleanWords(K.defName(K.myId()), NOTE.name) || '친구';
  // 닉네임을 정한다(빈 글이면 지운다). 이 기기에 기억하고 친구에게 알린다. 돌려주는 값 = 다듬은 이름
  function set(v) {
    const n = cleanWords(v, NOTE.name);
    if (n !== nick()) K.setLook({ name: n || undefined });
    if (n) K.store.set(NAME_KEY, n); else K.store.del(NAME_KEY);
    if (input.value !== n) input.value = n;
    return n;
  }

  // 캐릭터 고르기 판의 이름 칸
  const row = document.createElement('label'), lab = document.createElement('span'), input = document.createElement('input');
  row.className = 'row'; row.id = 'nameRow';
  lab.className = 'lab'; lab.textContent = '이름';
  input.id = 'nameIn'; input.type = 'text'; input.maxLength = NOTE.name; input.autocomplete = 'off'; input.placeholder = `닉네임 (${NOTE.name}자까지)`;
  input.setAttribute('aria-label', '닉네임'); input.setAttribute('enterkeyhint', 'done');
  row.append(lab, input);
  const sheet = document.getElementById('look');
  sheet.insertBefore(row, sheet.querySelector('h2').nextSibling);
  input.value = nick();
  input.addEventListener('input', () => { // 적는 대로 머리 위에 보인다 (다듬은 값이 같으면 칸은 건드리지 않는다)
    const n = cleanWords(input.value, NOTE.name);
    if (n !== nick()) K.setLook({ name: n || undefined });
    if (n) K.store.set(NAME_KEY, n); else K.store.del(NAME_KEY);
  });
  input.addEventListener('change', () => set(input.value));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); input.blur(); } e.stopPropagation(); });

  /* ───────── 머리 위 이름표 ───────── */
  const box = document.createElement('div');
  box.id = 'nameTags'; box.setAttribute('aria-hidden', 'true');
  document.body.appendChild(box);
  const tags = new Map(); // id('me' 또는 친구 id) → { el, text, tf, shown }
  const v = new THREE.Vector3();
  function tagOf(id) {
    let t = tags.get(id);
    if (!t) { t = { el: document.createElement('i'), text: '', tf: '', shown: true }; if (id === 'me') t.el.className = 'me'; box.appendChild(t.el); tags.set(id, t); }
    return t;
  }
  const show = (t, on) => { if (t.shown !== on) { t.shown = on; t.el.style.display = on ? '' : 'none'; } };
  function place(id, a, text, on) {
    const t = tagOf(id);
    if (!on || !text) { show(t, false); return; }
    v.set(a.root.position.x, a.root.position.y + (a.rest ? 1.2 : 1.95), a.root.position.z);
    K.project(v);
    if (v.z > 1 || v.z < -1) { show(t, false); return; } // 카메라 뒤
    if (t.text !== text) { t.text = text; t.el.textContent = text; }
    // 놀이 표시("👀 찾음")가 붙어 있으면 그 위로 올린다
    const tf = `translate(${Math.round((v.x + 1) / 2 * window.innerWidth)}px, ${Math.round((1 - v.y) / 2 * window.innerHeight) - (K.tagged(id === 'me' ? K.myId() : id) ? 24 : 0)}px) translate(-50%, -100%)`;
    if (t.tf !== tf) { t.tf = tf; t.el.style.transform = tf; }
    show(t, true);
  }
  // 그릴 때마다: 이름표를 머리 위로 옮긴다
  function tick() {
    const off = K.off(), others = K.others();
    for (const id of tags.keys()) if (id !== 'me' && !others.has(id)) { tags.get(id).el.remove(); tags.delete(id); }
    // 나: 닉네임이 있거나 같이 있을 때만 (혼자 있는 방에서 "방장"은 띄우지 않는다)
    place('me', K.me, nick() || (K.online() ? myName() : ''), !off && K.me.root.visible && !K.eye() && !K.talking('me'));
    for (const [id, a] of others) place(id, a, a.look.name || K.defName(id), !off && a.root.visible && !K.quiet(id) && !K.talking(id));
  }

  window.__names = { // 자동 검사가 쓰는 창구
    set, myName, get nick() { return nick(); }, get input() { return input.value; },
    // 보이는 이름표 { id: { text, x, y(이름표 아래 가운데) } }
    get tags() {
      const out = {};
      for (const [id, t] of tags) if (t.shown) { const r = t.el.getBoundingClientRect(); out[id] = { text: t.text, x: r.left + r.width / 2, y: r.bottom, h: r.height }; }
      return out;
    },
  };
  return { tick, set, myName, get nick() { return nick(); } };
}
