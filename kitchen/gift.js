// 편지 쓰기 · 선물 링크 보내기 · 받은 선물 열기.
// 선물은 링크의 # 뒤에만 담긴다(#g=…). 서버에도 브라우저 저장소에도 남기지 않는다.
// 사용자 글자는 value / textContent 로만 다룬다.
import { kitchen as K } from './app.js';
import { packState, unpackState, share } from './duo.js';

const $ = (id) => document.getElementById(id);
const LIM = { to: 12, fr: 12, m: 200 };
const clip = (v, n) => Array.from(String(v == null ? '' : v)).slice(0, n).join('');
const b64 = {
  enc(str) { let s = ''; for (const x of new TextEncoder().encode(str)) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(txt) { const s = atob(txt.replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0))); },
};

function giftUrl() {
  const st = K.getState();
  const o = { v: 1, s: packState(st), b: (st.x.pack && st.x.pack.box) | 0, to: clip($('ltTo').value.trim(), LIM.to), fr: clip($('ltFrom').value.trim(), LIM.fr), m: clip($('ltMsg').value.trim(), LIM.m) };
  return location.origin + location.pathname + '#g=' + b64.enc(JSON.stringify(o));
}
function readGift(txt) {
  const o = JSON.parse(b64.dec(txt));
  if (!o || o.v !== 1 || typeof o.s !== 'string') throw new Error('gift');
  const st = unpackState(o.s);
  st.station = 'pack'; st.x = st.x || {}; st.x.pack = { box: o.b | 0, packed: 1 };
  return { st, to: clip(o.to, LIM.to), fr: clip(o.fr, LIM.fr), m: clip(o.m, LIM.m) };
}

/* ───────── 편지 쓰기 ───────── */
function openLetter() { $('letter').hidden = false; $('ltCount').textContent = Array.from($('ltMsg').value).length + ' / ' + LIM.m; }
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

/* ───────── 받은 선물 ───────── */
function receive(g) {
  document.body.classList.add('recv');
  K.setLocked(true);
  K.setState(g.st);
  $('rcTo').textContent = g.to ? g.to + '에게' : '';
  $('rcMsg').textContent = g.m;
  $('rcFrom').textContent = g.fr ? g.fr + ' 드림' : '';
  $('rcTo').hidden = !g.to; $('rcFrom').hidden = !g.fr;
  const bar = $('recv'); bar.hidden = false;
  const setBar = (opened) => { $('rcOpen').hidden = opened; $('rcToggle').hidden = !opened; $('rcMake').hidden = !opened; $('rcHint').textContent = opened ? '직접 구운 막대과자와 편지예요.' : '선물이 도착했어요.'; K.refit(); };
  setBar(false);
  $('rcOpen').addEventListener('click', () => {
    $('rcOpen').disabled = true;
    K.dispatch({ t: 'st', s: 'pack', d: { open: 1 } });
    setTimeout(() => { K.dispatch({ t: 'go', s: 'top' }); setBar(true); }, 1300);
    setTimeout(() => { $('rcard').hidden = false; $('rcToggle').textContent = '과자 보기'; }, 2300);
  });
  $('rcToggle').addEventListener('click', () => {
    const show = $('rcard').hidden; $('rcard').hidden = !show; $('rcToggle').textContent = show ? '과자 보기' : '편지 보기';
  });
  $('rcMake').addEventListener('click', () => { location.href = location.pathname + location.search; });
}

const m = /^#g=([A-Za-z0-9_-]{8,12000})$/.exec(location.hash);
if (m) {
  try { receive(readGift(m[1])); }
  catch (_) { K.toast('선물 링크를 읽지 못했어요'); }
}

window.__gift = { giftUrl, readGift, openLetter };
