// 방명록과 이 방 최고 기록.
//   방명록 가구를 누르면 그 앞으로 걸어가서 아래 판이 열린다(play.js 의 놀이 하나로 더해진다). 지난 글 목록(최근 것이 위),
//   이름 칸(이 기기에 기억), 글 칸, 남기기. 구경하는 사람도 남길 수 있고, 지우기는 꾸밀 수 있는 사람만 한다.
//   이 방 최고 기록: 다트와 마시멜로 굽기의 점수가 지금 기록보다 높으면 방의 상태에 남기고, 모두에게 알린다.
// 글과 기록은 방의 상태(state.js 의 note, noteDel, best)라서 저장도, 같이 있는 사람에게 전하는 것도 다른 변화와 같은 길로 간다.
// app.js 가 넘겨주는 창구 K:
//   key, store, toast, op(변화) → 받아들였는지, canEdit(), newId(), defName() → 이름 칸이 비었을 때 쓸 이름,
//   notes() → 최근 것부터 [{ id, name, text, at }], best() → { 놀이: { v, name } }, play → play.js 가 만든 것, close()
import { NOTE, BEST } from './catalog.js';
import { cleanWords } from './state.js';

const CSS = `
#bookBox{display:flex;flex-direction:column;gap:8px;min-width:0}
#bookList{max-height:min(30vh,210px);overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:6px;
  user-select:text;-webkit-user-select:text}
#bookList .bk{background:#fff;border:1.5px solid var(--line);border-radius:12px;padding:6px 6px 6px 10px;display:flex;gap:6px;align-items:flex-start}
#bookList .bk>div{flex:1;min-width:0}
#bookList .bk b{font-size:13px;font-weight:800;color:var(--choc);margin-right:6px;word-break:break-all}
#bookList .bk small{font-size:11.5px;color:var(--sub);font-weight:600;white-space:nowrap}
#bookList .bk p{margin:2px 0 0;font-size:13.5px;font-weight:600;line-height:1.45;word-break:break-word;white-space:pre-wrap}
#bookList .bk .btn{min-height:44px;padding:0 10px;font-size:12px;color:var(--sub)}
#bookList .none{color:var(--sub);font-size:12.5px;padding:2px 0}
#bookForm{display:flex;gap:6px;min-width:0}
#bookForm input{min-width:0;min-height:46px;border:1.5px solid var(--line);border-radius:12px;padding:0 10px;font:inherit;font-size:16px;font-weight:600;
  background:#fff;color:var(--ink);user-select:text;-webkit-user-select:text;outline:none}
#bookForm input:focus{border-color:var(--choc)}
#bookName{flex:0 0 104px;width:104px}
#bookText{flex:1}
`;

const pad = (n) => String(n).padStart(2, '0');
function when(at) {
  const d = new Date(at), now = new Date();
  const day = `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.getFullYear() === now.getFullYear() ? day : `${d.getFullYear()}년 ${day}`;
}

export function makeBook(K) {
  const $ = (id) => document.getElementById(id);
  const NAME_KEY = K.key('name');
  let lastAt = -Infinity;         // 내가 마지막으로 남긴 때 (performance.now)

  /* ───────── 판 (아래 판 안에 끼워 넣는 목록과 글 칸) ───────── */
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const box = document.createElement('div');
  box.id = 'bookBox'; box.hidden = true;
  const list = document.createElement('div');
  list.id = 'bookList'; list.setAttribute('role', 'log'); list.setAttribute('aria-label', '방명록 글');
  const form = document.createElement('form');
  form.id = 'bookForm';
  const nameIn = document.createElement('input'), textIn = document.createElement('input');
  nameIn.id = 'bookName'; nameIn.type = 'text'; nameIn.maxLength = NOTE.name; nameIn.autocomplete = 'off'; nameIn.setAttribute('aria-label', '내 이름');
  textIn.id = 'bookText'; textIn.type = 'text'; textIn.maxLength = NOTE.text; textIn.autocomplete = 'off'; textIn.placeholder = '한마디 남겨 주세요'; textIn.setAttribute('aria-label', '남길 말');
  textIn.setAttribute('enterkeyhint', 'send');
  form.append(nameIn, textIn);
  box.append(list, form);
  $('playP').insertBefore(box, $('playBtns'));
  const saved = K.store.get(NAME_KEY);
  if (typeof saved === 'string') nameIn.value = cleanWords(saved, NOTE.name);
  form.addEventListener('submit', (e) => { e.preventDefault(); write(); });
  // 칸이 둘이고 보내기 단추는 판 아래에 있어서 Enter 로는 저절로 보내지지 않는다. 글 칸에서 Enter 를 누르면 남긴다
  textIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); write(); } });
  nameIn.addEventListener('change', () => { // 이름은 이 기기에 기억한다 (지우면 기억도 지운다)
    const n = cleanWords(nameIn.value, NOTE.name);
    nameIn.value = n;
    if (n) K.store.set(NAME_KEY, n); else K.store.del(NAME_KEY);
  });

  // 방명록과 기록에 쓰는 내 이름: 이름 칸에 적은 것, 없으면 기존 이름("방장", "친구2")
  const myName = () => cleanWords(nameIn.value, NOTE.name) || cleanWords(K.defName(), NOTE.name) || '친구';

  function paintList() {
    const notes = K.notes(), edit = K.canEdit();
    list.textContent = '';
    if (!notes.length) {
      const none = document.createElement('div');
      none.className = 'none'; none.textContent = '아직 남긴 글이 없어요. 첫 글을 남겨 보세요!';
      list.appendChild(none);
    }
    for (const n of notes) { // 글은 모두 textContent 로만 넣는다 (태그가 실행되지 않게)
      const row = document.createElement('div'), body = document.createElement('div'), nm = document.createElement('b'), at = document.createElement('small'), p = document.createElement('p');
      row.className = 'bk'; row.dataset.id = n.id;
      nm.textContent = n.name; at.textContent = when(n.at); p.textContent = n.text;
      body.append(nm, at, p);
      row.appendChild(body);
      if (edit) {
        const del = document.createElement('button');
        del.type = 'button'; del.className = 'btn'; del.textContent = '지우기'; del.setAttribute('aria-label', `${n.name}의 글 지우기`);
        del.addEventListener('click', () => { if (K.op({ t: 'noteDel', id: n.id })) K.toast('글을 지웠어요'); });
        row.appendChild(del);
      }
      list.appendChild(row);
    }
  }
  function paint() {
    nameIn.placeholder = cleanWords(K.defName(), NOTE.name) || '이름';
    box.hidden = false;
    paintList();
    const n = K.notes().length;
    K.play.panel('📖 방명록', n ? `글 ${n}개 · 최근 것이 위에 있어요. 놀러 온 사람 누구나 남길 수 있어요.` : '놀러 온 사람 누구나 한마디 남길 수 있어요.', [
      { label: '남기기', main: true, id: 'bookSend', fn: () => write() },
      { label: '닫기', id: 'playQuit', fn: () => K.close() }]);
  }
  // 한마디 남기기. 남겼으면 true
  function write() {
    const text = cleanWords(textIn.value, NOTE.text);
    if (!text) { K.toast('남길 말을 적어 주세요'); textIn.focus(); return false; }
    const wait = lastAt + NOTE.gap - performance.now();
    if (wait > 0) { K.toast(`${Math.ceil(wait / 1000)}초 뒤에 다시 남길 수 있어요`); return false; }
    const name = myName();
    if (cleanWords(nameIn.value, NOTE.name)) K.store.set(NAME_KEY, name);
    if (!K.op({ t: 'note', id: K.newId(), name, text, at: Date.now() })) { K.toast('남기지 못했어요'); return false; }
    lastAt = performance.now();
    textIn.value = '';
    textIn.blur();
    K.toast('방명록에 남겼어요 📖');
    return true;
  }

  const kind = {
    start(c) { c.phase = 'book'; paint(); },
    paint() { paint(); },
    tick() {}, tap() {},
    stop() { box.hidden = true; nameIn.blur(); textIn.blur(); },
  };
  K.play.add('guest', kind);
  const open = () => K.play.kind === 'guest';

  /* ───────── 이 방 최고 기록 ───────── */
  // " 이 방 최고 기록 120점 (이름)" (놀이 판에 붙는다)
  function bestLine(k) {
    const b = K.best()[k];
    return b ? `이 방 최고 기록 ${b.v}점 (${b.name})` : '아직 이 방 기록이 없어요';
  }
  // 끝난 판의 점수. 이 방 기록보다 높으면 남긴다 (구경하는 사람의 기록도 남는다)
  function record(k, v) {
    if (!Object.hasOwn(BEST, k) || !Number.isFinite(v)) return false;
    const pts = Math.round(v), b = K.best()[k];
    if (pts < 1 || pts > BEST[k].top || (b && pts <= b.v)) return false;
    return K.op({ t: 'best', k, v: pts, name: myName() });
  }

  // 방의 변화가 하나 들어왔다 (내 것이든 남의 것이든. 저장된 방을 여는 중에는 오지 않는다)
  function onOp(op, from) {
    if (op.t === 'note' || op.t === 'noteDel') {
      if (open()) paint();
      if (op.t === 'note' && from === 'peer' && !open()) K.toast(`${op.name}님이 방명록에 글을 남겼어요 📖`);
    } else if (op.t === 'best') {
      const g = BEST[op.k].name;
      // 놀이 판의 점수 알림이 먼저 보이고 조금 뒤에 기록 알림이 뜬다
      setTimeout(() => K.toast(from === 'me' ? `🏆 이 방 ${g} 최고 기록! ${op.v}점` : `🏆 ${op.name}님이 이 방 ${g} 최고 기록을 세웠어요! ${op.v}점`), 900);
      if (K.play.kind === op.k) K.play.refresh(K.play.id); // 그 놀이 판의 기록 줄을 고친다
    }
  }

  window.__book = { // 자동 검사가 쓰는 창구
    write, record, bestLine, myName,
    get shown() { return !box.hidden; },
    get list() { return [...list.querySelectorAll('.bk')].map((r) => ({ id: r.dataset.id, name: r.querySelector('b').textContent, text: r.querySelector('p').textContent, del: !!r.querySelector('button') })); },
    resetGap() { lastAt = -Infinity; },
  };
  return { onOp, record, bestLine };
}
