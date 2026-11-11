// 편지 쓰기 · 선물 링크 보내기 · 받은 선물 열기.
// 선물은 링크의 # 뒤에만 담긴다(#g=…). 서버에도 브라우저 저장소에도 남기지 않는다.
// 사용자 글자는 value / textContent 로만 다룬다.
import { kitchen as K } from './app.js';
import { packState, unpackState, share, canGive, give, takeGift } from './duo.js';
import { openBrag } from './brag.js';
import { bgm } from './bgm.js';

const $ = (id) => document.getElementById(id);
const LIM = { to: 20, fr: 20, m: 200 }; // 첫 줄·끝 줄은 쓴 그대로 보여 준다 (예: "사랑하는 지우에게", "너를 아끼는 민서가")
const clip = (v, n) => Array.from(String(v == null ? '' : v)).slice(0, n).join('');
const b64 = {
  enc(str) { let s = ''; for (const x of new TextEncoder().encode(str)) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(txt) { const s = atob(txt.replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0))); },
};

function giftText() {
  const st = K.getState();
  const gr = K.grades();
  const o = { v: 1, f: 1, p: [gr.dough, gr.cut, gr.oven, gr.choco], s: packState(st), b: (st.x.pack && st.x.pack.box) | 0, q: (st.x.pack && st.x.pack.seal) | 0, to: clip($('ltTo').value.trim(), LIM.to), fr: clip($('ltFrom').value.trim(), LIM.fr), m: clip($('ltMsg').value.trim(), LIM.m) };
  return b64.enc(JSON.stringify(o));
}
const giftUrl = () => location.origin + location.pathname + '#g=' + giftText();
function readGift(txt) {
  const o = JSON.parse(b64.dec(txt));
  if (!o || o.v !== 1 || typeof o.s !== 'string') throw new Error('gift');
  const st = unpackState(o.s);
  st.station = 'pack'; st.x = st.x || {}; const q = o.q === 1 || o.q === 2 || o.q === 3 ? o.q : 0; // 2 최고급 수제, 1 고급 수제, 3 수제
  st.x.pack = { box: o.b | 0, packed: 1, seal: q };
  // f 가 없는 예전 링크는 이름만 담겨 있어서 "에게" / "드림" 을 붙여 준다
  const to = clip(o.to, LIM.to), fr = clip(o.fr, LIM.fr);
  const p = Array.isArray(o.p) && o.p.length === 4 ? o.p.map((v) => (v === 2 ? 2 : v === 1 ? 1 : 0)) : null; // 만든 과정: 자리별 0 안 함, 1 GOOD, 2 PERFECT
  return { st, q, p, to: o.f || !to ? to : to + '에게', fr: o.f || !fr ? fr : fr + ' 드림', m: clip(o.m, LIM.m) };
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
// 미리보기: 받는 사람이 볼 편지지 모양 그대로 보여 준다
$('ltPreview').addEventListener('click', () => {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  const to = clip($('ltTo').value.trim(), LIM.to), fr = clip($('ltFrom').value.trim(), LIM.fr), m = clip($('ltMsg').value.trim(), LIM.m);
  $('pvTo').textContent = to; $('pvTo').hidden = !to;
  $('pvMsg').textContent = m || '(편지를 적으면 여기에 보여요)';
  $('pvFrom').textContent = fr; $('pvFrom').hidden = !fr;
  $('ltPrev').hidden = false;
});
$('pvClose').addEventListener('click', () => { $('ltPrev').hidden = true; });
$('ltPrev').addEventListener('click', (e) => { if (e.target === $('ltPrev')) $('ltPrev').hidden = true; });
$('ltGive').addEventListener('click', () => { // 서로 선물: 연결된 상대에게 바로 보낸다
  if (!$('ltMsg').value.trim()) { K.toast('편지를 한 줄이라도 적어 주세요'); $('ltMsg').focus(); return; }
  if (give(giftText())) { K.toast('상대에게 선물을 보냈어요'); closeLetter(); } else K.toast('지금은 연결되어 있지 않아요. 링크로 보내 주세요');
});

/* ───────── 받은 선물 ───────── */
let cur = null; // 지금 보고 있는 선물
let best = 0; // 받은 선물의 칭호 (0 없음, 1 고급, 2 최고급)
let back = null; // 서로 선물에서 받은 선물을 보고 내 주방으로 돌아갈 때 쓰는 내 상태
// 받은 선물은 주방 없이 무대 위에서만 보여 준다
const VIEW_BOX = { tgt: [0.52, 1.42, -1.72], dir: [0.1, 0.34, 1], w: 1.5, h: 1.55 };
const VIEW_STICK = { tgt: [0.62, 1.95, -1.32], dir: [0.06, 0.14, 1], w: 0.7, h: 1.1 };  // 상자 앞에 꺼내 든 과자
const VIEW_READ = { tgt: [0.62, 1.95, -1.32], dir: [0.06, 0.1, 1], w: 0.36, h: 0.9 };   // 편지를 펼쳤을 때: 과자만 크게
let timers = [];
const later = (ms, fn) => timers.push(setTimeout(fn, ms));
// 편지는 봉투에서 꺼내고, 다시 봉투로 넣는다
let closing = 0;
function showLetter(on) {
  clearTimeout(closing);
  const card = $('rcard'), env = $('env');
  env.classList.toggle('open', on);
  env.setAttribute('aria-label', on ? '편지를 봉투에 넣기' : '봉투를 열어 편지 읽기');
  if (on) {
    card.classList.remove('closing'); card.hidden = false;
    // 편지는 아래에, 과자는 위에: 서로 가리지 않게 카메라를 옮긴다
    K.setView(Object.assign({}, VIEW_READ, { pad: card.querySelector('.letterpaper').offsetHeight + 70 }), 450);
    bgm.play();
    return;
  }
  bgm.stop();
  if (card.hidden) return;
  K.setView(VIEW_STICK, 450);
  card.classList.add('closing');                      // 봉투 쪽으로 들어가는 움직임이 끝난 뒤 숨긴다
  closing = setTimeout(() => { card.hidden = true; card.classList.remove('closing'); }, 320);
}
function setBar(opened) {
  $('rcOpen').hidden = opened; $('rcOpen').disabled = false; $('rcRow2').hidden = !opened;
  $('rcSub').textContent = opened ? '' : '화면을 밀면 돌려 볼 수 있어요.';
  $('rcHint').firstChild.textContent = opened ? (best === 2 ? '완벽하게 만든 막대과자예요.' : best === 1 ? '정성껏 만든 막대과자예요.' : '직접 구운 막대과자예요.') : '선물이 도착했어요.';
  $('rcMake').textContent = back ? '내 주방으로' : '나도 만들기';
  document.documentElement.style.setProperty('--barh', $('bottom').offsetHeight + 'px'); // 봉투를 아래 막대 바로 위에 둔다
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
  back = mine || null; cur = g;
  closeLetter();
  document.body.classList.add('recv');
  K.setLocked(true);
  K.present(false);
  K.setState(g.st, true);           // 과자는 포장된 상자 안에
  K.dispatch({ t: 'go', s: 'pack' }, true);
  K.setStage(true); K.setOrbit(true);
  K.setView(VIEW_BOX, 0);
  $('rcTo').textContent = g.to;
  $('rcMsg').textContent = g.m;
  $('rcFrom').textContent = g.fr;
  $('rcTo').hidden = !g.to; $('rcFrom').hidden = !g.fr;
  $('rcTitle').hidden = !g.q; best = g.q;
  $('rcChip').textContent = g.q === 2 ? '🥇 최고급 수제 과자' : g.q === 1 ? '🥈 고급 수제 과자' : '🥉 수제 과자';
  $('rcChip').classList.toggle('silver', g.q === 1); $('rcChip').classList.toggle('bronze', g.q === 3);
  $('recv').hidden = false; $('rcard').hidden = true; $('env').hidden = true; $('env').classList.remove('open');
  setBar(false);
}
function endReceive() {
  timers.forEach(clearTimeout); timers = [];
  document.body.classList.remove('recv'); $('recv').hidden = true; $('rcard').hidden = true; $('env').hidden = true;
  bgm.stop();
  K.present(false); K.setStage(false); K.setOrbit(false); K.setView(null, 0); K.setLocked(false);
}
$('rcOpen').addEventListener('click', () => {
  $('rcOpen').disabled = true;
  K.present(true);                                             // 상자 안에서 꾸민 면이 앞을 보게 돌려 두고
  K.dispatch({ t: 'st', s: 'pack', d: { open: 1 } }, true);     // 뚜껑이 열리면 솟아오른다
  later(700, () => { K.dispatch({ t: 'st', s: 'pack', d: { cheer: 1 } }, true); sparkle(); });
  later(1150, () => { K.setOrbit(false); K.setOrbit(true); K.present(2); // 돌려 둔 시점은 정면으로 되돌린다
    K.setView(VIEW_STICK, 900); setBar(true); $('rcHint').firstChild.textContent = '화면을 밀면 돌려 볼 수 있어요.'; }); // 상자 밖으로 꺼내 든다
  later(2500, () => { if (document.body.classList.contains('recv')) { $('env').hidden = false; $('rcHint').firstChild.textContent = '봉투를 눌러 편지를 읽어 보세요.'; } });
});
$('env').addEventListener('click', () => showLetter(!$('env').classList.contains('open')));
$('rcClose').addEventListener('click', () => showLetter(false));
$('rcSound').addEventListener('click', () => {
  bgm.setMuted(!bgm.muted); if (!bgm.muted) bgm.play();
  $('rcSound').textContent = bgm.muted ? '🔇' : '🔈'; $('rcSound').setAttribute('aria-label', bgm.muted ? '음악 켜기' : '음악 끄기');
});
// 만든 사람의 자랑 카드: 찍어 둔 과정 사진과 결과, 등급, 완성된 과자
window.addEventListener('kitchen:brag', () => {
  const st = K.getState(), gr = K.grades();
  openBrag({ mine: true, q: (st.x.pack && st.x.pack.seal) | 0, p: [gr.dough, gr.cut, gr.oven, gr.choco], shots: K.shots,
    to: clip($('ltTo').value.trim(), LIM.to), fr: clip($('ltFrom').value.trim(), LIM.fr), m: clip($('ltMsg').value.trim(), LIM.m) });
});
$('rcBrag').addEventListener('click', () => { if (!$('rcard').hidden) showLetter(false); if (cur) openBrag(cur); });
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
