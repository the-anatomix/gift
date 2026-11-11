// 편지 쓰기 · 선물 링크 보내기 · 받은 선물 열기.
// 선물은 링크의 # 뒤에만 담긴다(#g=…). 서버에도 브라우저 저장소에도 남기지 않는다.
// 사용자 글자는 value / textContent 로만 다룬다.
import { kitchen as K } from './app.js';
import { packState, unpackState, share, canGive, give, takeGift } from './duo.js';

const $ = (id) => document.getElementById(id);
const LIM = { to: 12, fr: 12, m: 200 };
const clip = (v, n) => Array.from(String(v == null ? '' : v)).slice(0, n).join('');
const b64 = {
  enc(str) { let s = ''; for (const x of new TextEncoder().encode(str)) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(txt) { const s = atob(txt.replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0))); },
};

function giftText() {
  const st = K.getState();
  const o = { v: 1, s: packState(st), b: (st.x.pack && st.x.pack.box) | 0, to: clip($('ltTo').value.trim(), LIM.to), fr: clip($('ltFrom').value.trim(), LIM.fr), m: clip($('ltMsg').value.trim(), LIM.m) };
  return b64.enc(JSON.stringify(o));
}
const giftUrl = () => location.origin + location.pathname + '#g=' + giftText();
function readGift(txt) {
  const o = JSON.parse(b64.dec(txt));
  if (!o || o.v !== 1 || typeof o.s !== 'string') throw new Error('gift');
  const st = unpackState(o.s);
  st.station = 'pack'; st.x = st.x || {}; st.x.pack = { box: o.b | 0, packed: 1 };
  return { st, to: clip(o.to, LIM.to), fr: clip(o.fr, LIM.fr), m: clip(o.m, LIM.m) };
}

/* ───────── 편지 쓰기 ───────── */
function openLetter() { $('letter').hidden = false; $('ltGive').hidden = !canGive(); $('ltShare').classList.toggle('main', !canGive()); $('ltCount').textContent = Array.from($('ltMsg').value).length + ' / ' + LIM.m; }
function closeLetter() { $('letter').hidden = true; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
window.addEventListener('kitchen:letter', openLetter);
$('ltClose').addEventListener('click', closeLetter);
$('ltMsg').addEventListener('input', () => { $('ltCount').textContent = Array.from($('ltMsg').value).length + ' / ' + LIM.m; });
$('ltShare').addEventListener('click', async () => {
  if (!$('ltMsg').value.trim()) { K.toast('편지를 한 줄이라도 적어 주세요'); $('ltMsg').focus(); return; }
  const url = giftUrl();
  const how = await share(url, '갓 구운 선물이 도착했어요. 눌러서 열어 보세요.');
  if (how === 'manual') { const i = $('ltUrl'); i.value = url; i.hidden = false; $('ltUrlHint').hidden = false; }
});
$('ltUrl').addEventListener('focus', () => $('ltUrl').select());
$('ltGive').addEventListener('click', () => { // 서로 선물: 연결된 상대에게 바로 보낸다
  if (!$('ltMsg').value.trim()) { K.toast('편지를 한 줄이라도 적어 주세요'); $('ltMsg').focus(); return; }
  if (give(giftText())) { K.toast('상대에게 선물을 보냈어요'); closeLetter(); } else K.toast('지금은 연결되어 있지 않아요. 링크로 보내 주세요');
});

/* ───────── 받은 선물 ───────── */
let back = null; // 서로 선물에서 받은 선물을 보고 내 주방으로 돌아갈 때 쓰는 내 상태
// 받은 선물은 주방 없이 무대 위에서만 보여 준다
const VIEW_BOX = { tgt: [0.52, 1.42, -1.72], dir: [0.1, 0.34, 1], w: 1.5, h: 1.55 };
const VIEW_STICK = { tgt: [0.6, 2.02, -1.82], dir: [0.04, 0.16, 1], w: 0.8, h: 1.3 };
let timers = [];
const later = (ms, fn) => timers.push(setTimeout(fn, ms));
function showLetter(on) {
  $('rcard').hidden = !on;
  $('rcToggle').textContent = on ? '편지 접기' : '💌 편지 열기';
}
function setBar(opened) {
  $('rcOpen').hidden = opened; $('rcOpen').disabled = false; $('rcToggle').hidden = !opened; $('rcMake').hidden = !opened;
  $('rcHint').textContent = opened ? '직접 구운 막대과자예요.' : '선물이 도착했어요.';
  $('rcMake').textContent = back ? '내 주방으로' : '나도 만들기';
  K.refit();
}
function sparkle() {
  for (let i = 0; i < 7; i++) later(i * 110, () => {
    const e = document.createElement('div'); e.className = 'emo'; e.textContent = i % 2 ? '✨' : '💛';
    e.style.left = 14 + Math.random() * 72 + '%'; e.style.bottom = 30 + Math.random() * 25 + '%'; e.style.fontSize = 22 + Math.random() * 18 + 'px';
    $('emos').appendChild(e); setTimeout(() => e.remove(), 1700);
  });
}
function receive(g, mine) {
  back = mine || null;
  closeLetter();
  document.body.classList.add('recv');
  K.setLocked(true);
  K.present(false);
  K.setState(g.st, true);           // 과자는 포장된 상자 안에
  K.dispatch({ t: 'go', s: 'pack' }, true);
  K.setStage(true);
  K.setView(VIEW_BOX, 0);
  $('rcTo').textContent = g.to ? g.to + '에게' : '';
  $('rcMsg').textContent = g.m;
  $('rcFrom').textContent = g.fr ? g.fr + ' 드림' : '';
  $('rcTo').hidden = !g.to; $('rcFrom').hidden = !g.fr;
  $('recv').hidden = false; showLetter(false);
  setBar(false);
}
function endReceive() {
  timers.forEach(clearTimeout); timers = [];
  document.body.classList.remove('recv'); $('recv').hidden = true; $('rcard').hidden = true;
  K.present(false); K.setStage(false); K.setView(null, 0); K.setLocked(false);
}
$('rcOpen').addEventListener('click', () => {
  $('rcOpen').disabled = true;
  K.present(true);                                             // 상자 안에서 꾸민 면이 앞을 보게 돌려 두고
  K.dispatch({ t: 'st', s: 'pack', d: { open: 1 } }, true);     // 뚜껑이 열리면 솟아오른다
  later(700, () => { K.dispatch({ t: 'st', s: 'pack', d: { cheer: 1 } }, true); sparkle(); });
  later(1000, () => { K.setView(VIEW_STICK, 1000); setBar(true); });
  later(2600, () => { if (document.body.classList.contains('recv')) showLetter(true); });
});
$('rcToggle').addEventListener('click', () => showLetter($('rcard').hidden));
$('rcClose').addEventListener('click', () => showLetter(false));
$('rcard').addEventListener('click', (e) => { if (e.target === $('rcard')) showLetter(false); }); // 편지 바깥을 눌러도 접힌다
$('rcMake').addEventListener('click', () => {
  if (!back) { location.href = location.pathname + location.search; return; }
  const st = back; back = null;
  endReceive(); K.setState(st); K.refit();
});
// 서로 선물: 상대가 보낸 선물을 연다. 내 과자는 따로 두었다가 돌아오면 되돌린다.
window.addEventListener('kitchen:gift-open', () => {
  const txt = takeGift(); if (!txt) return;
  try { const g = readGift(txt); receive(g, K.getState()); }
  catch (_) { K.toast('선물을 읽지 못했어요'); }
});

const m = /^#g=([A-Za-z0-9_-]{8,12000})$/.exec(location.hash);
if (m) {
  try { receive(readGift(m[1])); }
  catch (_) { K.toast('선물 링크를 읽지 못했어요'); }
}

window.__gift = { giftUrl, giftText, readGift, openLetter };
