// 둘이 굽기: 초대 링크(#r=방id)로 두 사람이 같은 과자를 꾸민다.
// 오가는 것은 손 위치(초당 12회 이하)와 사건(토핑 한 알, 코팅, 되돌리기, 지우기, 자리 이동, 이모지)뿐이다.
// 채팅은 없다. 글자 입력은 과자에 새기는 6자뿐이고, 화면에 넣는 글자는 모두 textContent 로 넣는다.
import { kitchen as K } from './app.js';
import { openRoom } from './net.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const NET = q.get('net') === 'bc' ? 'bc' : 'peer';
const bm = /^(localhost|127\.0\.0\.1):(\d{2,5})$/.exec(q.get('broker') || ''); // 검사용 로컬 브로커만 허용
const OPT = bm ? { broker: { host: bm[1], port: +bm[2] } } : {};
const T = { connect: +q.get('ct') || 12000, silent: +q.get('st') || 10000, ping: 2000 };
const EMOJI = ['❤️', '😋', '👍', '✨'];
const COLORS = { host: '#D9483B', guest: '#2F9E8F' };

let mode = 'solo'; // solo | waiting | connecting | on | lost | full
let room = null, role = null, link = null, gen = 0;
let last = 0, connectT = 0, manual = null, tries = 0;

/* ───────── 상태를 링크에 담기 (이어 굽기) ───────── */
const S_MAX = K.STICK.L * 0.8, U_MAX = K.STICK.R;
const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
function packState(st) {
  const b = [1, st.color & 7, st.layers.length];
  for (const l of st.layers) b.push(l.c & 7, clamp255((l.len / K.STICK.L) * 255));
  const tx = Array.from(new TextEncoder().encode(K.cleanText(st.text))).slice(0, 40);
  b.push(tx.length, ...tx);
  for (const g of st.grains) {
    b.push((g.k & 3) | ((g.c & 7) << 2) | (Math.max(0, Math.min(7, Math.round(((g.sc - 0.85) / 0.4) * 7))) << 5),
      clamp255((g.s / S_MAX) * 255), clamp255(((g.u / U_MAX + 1) / 2) * 255), clamp255((g.sp / 6.2832) * 255));
  }
  let s = ''; for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unpackState(txt) {
  const s = atob(txt.replace(/-/g, '+').replace(/_/g, '/'));
  const b = Array.from(s, (c) => c.charCodeAt(0));
  if (b[0] !== 1) throw new Error('version');
  const nC = K.CHOCO.length;
  const st = { station: 'top', color: Math.min(b[1], nC - 1), layers: [], grains: [] };
  let i = 3;
  for (let n = 0; n < Math.min(b[2], 4); n++, i += 2) st.layers.push({ c: Math.min(b[i], nC - 1), len: (b[i + 1] / 255) * K.STICK.L });
  const tn = b[i] || 0;
  try { st.text = K.cleanText(new TextDecoder().decode(new Uint8Array(b.slice(i + 1, i + 1 + tn)))); } catch (_) { st.text = ''; }
  i += 1 + tn;
  for (let n = 0; i + 3 < b.length; n++, i += 4) {
    const k = b[i] & 3, c = Math.min((b[i] >> 2) & 7, K.KINDS[k].colors.length - 1);
    st.grains.push({ k, c, sc: 0.85 + (((b[i] >> 5) & 7) / 7) * 0.4, s: (b[i + 1] / 255) * S_MAX, u: ((b[i + 2] / 255) * 2 - 1) * U_MAX,
      sp: (b[i + 3] / 255) * 6.2832, st: 'x-0', id: 'x-0.' + n });
  }
  return st;
}
const baseUrl = () => location.origin + location.pathname + location.search;
const inviteUrl = () => baseUrl() + '#r=' + room;
const continueUrl = () => baseUrl() + '#s=' + packState(K.getState());

/* ───────── 연결 ───────── */
function setMode(m) { if (m !== mode) manual = null; mode = m; render(); }
function send(m) { if (link && mode === 'on') link.send(m); }

async function start(id, again) {
  const my = ++gen;
  tries = again ? tries + 1 : 1;
  if (link) link.close();
  link = null; room = id; role = null; manual = null;
  setMode('connecting');
  clearTimeout(connectT);
  // 정해진 시간 안에 이어지지 않으면 조용히 혼자 굽기로 넘어간다 (방 주인으로 기다리는 중이면 그대로 둔다)
  connectT = setTimeout(() => { if (my === gen && mode === 'connecting') lost(); }, T.connect);
  const h = await openRoom(NET, id, {
    role(r) { if (my !== gen) return; role = r; if (r === 'host') { clearTimeout(connectT); setMode('waiting'); } },
    open() {
      if (my !== gen) return;
      clearTimeout(connectT); last = performance.now(); tries = 0; setMode('on');
      K.toast('연결됐어요. 같이 구워요!');
      // 방 주인이 기준. 손님은 가진 것을 알리고, 주인이 합쳐서 통째로 돌려준다.
      if (role === 'guest') link.send({ t: 'hello', state: K.getState() });
    },
    msg(m) { if (my === gen) onMsg(m); },
    close() { if (my === gen && mode !== 'full' && mode !== 'solo') lost(); },
    full() { if (my !== gen) return; clearTimeout(connectT); gen++; h2close(); setMode('full'); },
  }, OPT);
  const h2close = () => { try { h.close(); } catch (_) { /* 무시 */ } if (link === h) link = null; };
  if (my !== gen) { if (mode !== 'full') h.close(); return; }
  link = h;
}
function lost() {
  clearTimeout(connectT);
  // 처음 들어가다 실패하면 한 번은 자동으로 다시 시도한다
  if (mode === 'connecting' && tries === 1 && room) { K.toast('다시 연결해 보는 중…'); start(room, true); return; }
  hideHand(); K.remoteTip(null);
  if (link) { if (role === 'host') link.drop(); else { link.close(); link = null; gen++; } }
  if (mode === 'on') K.toast('연결이 끊겼어요. 혼자 이어 구워요');
  setMode('lost');
}
function leave() { // 혼자 굽기로 돌아가기
  gen++; clearTimeout(connectT);
  if (link) link.close();
  link = null; room = null; role = null; manual = null;
  hideHand();
  history.replaceState(null, '', location.pathname + location.search);
  setMode('solo');
}
function createRoom() {
  const a = new Uint8Array(10); crypto.getRandomValues(a);
  const id = Array.from(a, (x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join('');
  history.replaceState(null, '', '#r=' + id);
  start(id);
  share(inviteUrl(), '같이 막대과자 구워요. 눌러서 주방으로 들어오세요.');
}

function onMsg(m) {
  if (!m || typeof m !== 'object') return;
  last = performance.now();
  switch (m.t) {
    case 'hello': { // 주인: 손님이 가진 것을 합친 뒤 기준 상태를 통째로 보낸다
      if (role !== 'host') return;
      const mine = K.getState(), theirs = m.state || {};
      const have = new Set(mine.grains.map((g) => g.id));
      for (const g of (theirs.grains || [])) if (g && !have.has(String(g.id))) mine.grains.push(g);
      if (!mine.layers.length && Array.isArray(theirs.layers)) mine.layers = theirs.layers;
      if (!mine.text && theirs.text) mine.text = theirs.text;
      K.setState(mine, true);
      link.send({ t: 'state', state: K.getState() });
      break;
    }
    case 'state': if (role === 'guest' && m.state) K.setState(m.state); break;
    case 'ev': if (m.a && typeof m.a.t === 'string') K.dispatch(m.a, true); break;
    case 'hand': showHand(m); break;
    case 'emo': if (EMOJI[m.i]) floatEmoji(m.i, false); break;
  }
}

K.onLocal((a) => send({ t: 'ev', a }));

// 손 위치: 80ms 에 한 번으로 줄여 보낸다. 손을 뗀 것은 바로 보낸다.
let handT = 0, handNext = null, handAt = 0;
K.onHand((m) => {
  if (mode !== 'on') return;
  const flush = () => { handT = 0; if (handNext) { send(handNext); handNext = null; handAt = performance.now(); } };
  handNext = { t: 'hand', down: m.down, s: m.s, p: m.p, tip: m.tip };
  if (!m.down) { clearTimeout(handT); flush(); return; }
  const wait = 80 - (performance.now() - handAt);
  if (wait <= 0) flush(); else if (!handT) handT = setTimeout(flush, wait);
});

setInterval(() => {
  if (mode !== 'on') return;
  send({ t: 'ping' });
  if (!document.hidden && performance.now() - last > T.silent) lost();
}, T.ping);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  last = performance.now();
  if (mode === 'lost' && room && role !== 'host') start(room); // 돌아왔을 때 한 번 다시 시도
});

/* ───────── 상대 손 표시 · 이모지 ───────── */
let handHide = 0;
function showHand(m) {
  const h = $('hand');
  clearTimeout(handHide);
  if (typeof m.tip === 'number') K.remoteTip(Math.max(0.5, Math.min(2, m.tip)));
  if (!m.down || !Array.isArray(m.p) || m.s !== K.S.station) {
    if (!m.down) K.remoteTip(null);
    h.classList.remove('on'); return;
  }
  const p = K.project(+m.p[0], +m.p[1], +m.p[2]);
  h.style.background = COLORS[role === 'host' ? 'guest' : 'host'];
  h.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
  h.classList.add('on');
  handHide = setTimeout(() => { h.classList.remove('on'); K.remoteTip(null); }, 2500);
}
function hideHand() { clearTimeout(handHide); $('hand').classList.remove('on'); }
function floatEmoji(i, mine) {
  const e = document.createElement('div');
  e.className = 'emo'; e.textContent = EMOJI[i];
  e.style.left = (mine ? 62 : 28) + Math.random() * 10 + '%';
  $('emos').appendChild(e);
  setTimeout(() => e.remove(), 1700);
}

/* ───────── 공유 ───────── */
async function share(url, text) {
  manual = null;
  if (navigator.share) {
    try { await navigator.share({ title: '갓 구운 선물', text, url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); K.toast('링크를 복사했어요. 상대에게 붙여 보내세요'); return; } catch (_) { /* 아래로 */ }
  manual = url; render(); // 복사도 안 되는 브라우저: 링크를 보여 주고 직접 복사하게 한다
}

/* ───────── 아래 막대 ───────── */
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(text, fn, id, cls) { const b = el('button', cls || 'btn', text); b.type = 'button'; if (id) b.id = id; b.addEventListener('click', fn); return b; }
function hint(main, sub) { const h = el('div', 'hint', main); if (sub) h.appendChild(el('small', '', sub)); return h; }
function render() {
  const d = $('duo');
  d.textContent = ''; d.dataset.mode = mode;
  d.hidden = mode === 'solo';
  const row = () => d.appendChild(el('div', 'row'));
  if (mode === 'waiting') {
    const r = row(); r.appendChild(hint('상대를 기다리는 중…', '기다리는 동안 먼저 구워도 돼요.'));
    const r2 = row();
    r2.appendChild(btn('초대 링크 보내기', () => share(inviteUrl(), '같이 막대과자 구워요. 눌러서 주방으로 들어오세요.'), 'invite', 'btn grow main'));
    r2.appendChild(btn('혼자 굽기', leave, 'solo'));
  } else if (mode === 'connecting') {
    const r = row(); r.appendChild(hint(tries > 1 ? '다시 연결해 보는 중…' : '주방에 들어가는 중…', '잠시만 기다려 주세요.')); r.appendChild(btn('혼자 굽기', leave, 'solo'));
  } else if (mode === 'on') {
    const r = row();
    const who = el('div', 'who');
    const a = el('i'); a.style.background = COLORS[role]; const b = el('i'); b.style.background = COLORS[role === 'host' ? 'guest' : 'host'];
    who.appendChild(a); who.appendChild(b); who.appendChild(el('span', '', '둘이 굽는 중'));
    r.appendChild(who);
    EMOJI.forEach((e, i) => {
      const x = btn(e, () => { floatEmoji(i, true); send({ t: 'emo', i }); }, null, 'btn emoji');
      x.setAttribute('aria-label', '이모지 보내기 ' + e); r.appendChild(x);
    });
  } else if (mode === 'lost') {
    const r = row(); r.appendChild(hint('연결이 안 됐어요. 혼자 이어 굽는 중이에요.', '만든 과자는 그대로 있어요. 링크로 넘겨서 이어 구울 수 있어요.'));
    r.appendChild(btn('닫기', leave, 'solo'));
    const r2 = row();
    r2.appendChild(btn('다시 연결', () => start(room), 'retry', 'btn grow'));
    r2.appendChild(btn('이어 굽기 링크 보내기', () => share(continueUrl(), '굽던 막대과자예요. 눌러서 마저 꾸며 주세요.'), 'continue', 'btn grow main'));
  } else if (mode === 'full') {
    const r = row(); r.appendChild(hint('방이 찼어요', '이 주방에는 이미 두 사람이 있어요.'));
    r.appendChild(btn('혼자 굽기', leave, 'solo', 'btn main'));
  }
  if (manual) {
    const r = row(); const i = el('input', 'url'); i.readOnly = true; i.value = manual; i.setAttribute('aria-label', '보낼 링크');
    i.addEventListener('focus', () => i.select()); r.appendChild(i);
    d.appendChild(el('div', 'hint', '')).appendChild(el('small', '', '링크를 길게 눌러 복사해 보내 주세요.'));
  }
  K.setHomeAction(mode === 'solo' ? { label: '같이 굽기', fn: createRoom } : null);
  K.refit();
}

/* ───────── 시작 ───────── */
function boot() {
  const h = location.hash;
  const r = /^#r=([a-z0-9]{6,20})$/.exec(h), s = /^#s=([A-Za-z0-9_-]{4,4000})$/.exec(h);
  render();
  if (r) start(r[1]);
  else if (s) {
    try { K.setState(unpackState(s[1])); K.toast('받은 과자예요. 마저 꾸며 보세요'); }
    catch (_) { K.toast('링크를 읽지 못했어요'); }
  }
}
addEventListener('hashchange', () => location.reload());
boot();

// 자동 검사에서 쓰는 창구
window.__duo = {
  get mode() { return mode; }, get role() { return role; }, get room() { return room; }, get tries() { return tries; },
  inviteUrl, continueUrl, packState, unpackState, createRoom, leave,
};
