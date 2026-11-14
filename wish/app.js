// 새해 소원 쪽지: 쓰기 → 접기 → 소원함/링크 → 남은 시간 → 펼치기 → 답장 · 이뤘어요.
// 쪽지는 링크의 # 뒤와 이 기기의 소원함에만 있다. 사용자 글자는 value / textContent 로만 다룬다.
import * as D from './dates.js';
import { LIM, PAPERS, clip, tidy, newId, encode, decode, fromHash } from './codec.js';
import * as box from './store.js';
import { sfx } from './sfx.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches; // 움직임 줄이기를 켠 사람
const wait = (ms) => new Promise((r) => setTimeout(r, calm() ? 0 : ms));
const count = (v) => Array.from(v).length;
const PAPER_NAMES = ['크림 편지지', '복주머니 빨강', '민트 모눈', '새벽 별밤', '한지', '분홍 줄무늬'];

function toast(msg, ms = 2800) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.k); toast.k = setTimeout(() => t.classList.remove('on'), ms); }

/* ───────── 화면 바꾸기 ───────── */
let view = '';
function show(name) {
  view = name;
  for (const k of ['Write', 'Note', 'Box', 'Bad']) $('scr' + k).hidden = k.toLowerCase() !== name;
  $('tabWrite').classList.toggle('on', name === 'write');
  $('tabBox').classList.toggle('on', name === 'box');
  const n = box.load().length;
  $('boxN').textContent = n ? String(n) : '';
}
function route() {
  const note = fromHash(location.hash);
  if (note === null) { cur = null; show('bad'); return; }
  if (note) { openNote(note); return; }
  cur = null;
  if (location.hash === '#box') { renderBox(); show('box'); return; }
  renderWhens(); show('write');
}
addEventListener('hashchange', () => { route(); scrollTo(0, 0); });

/* ───────── 1. 쓰기 ───────── */
let paper = 0;
let when = 'ny';      // ny 새해 첫날, seol 설날, d100 100일 뒤, y1 1년 뒤, custom 직접
let replyTo = null;   // 답장을 쓰는 중이면 받은 쪽지

function fit(t) { t.style.height = 'auto'; t.style.height = Math.max(44, t.scrollHeight) + 'px'; }
function addWish(text = '') {
  const list = $('wishes');
  if (list.children.length >= LIM.wishes) return null;
  const li = el('li'), t = el('textarea');
  t.rows = 1; t.value = text; t.enterKeyHint = 'next';
  t.placeholder = ['올해 꼭 이루고 싶은 것', '해 보고 싶은 것', '바라는 것'][list.children.length] || '또 하나의 소원';
  t.setAttribute('aria-label', '소원 ' + (list.children.length + 1));
  t.addEventListener('input', () => { // 줄바꿈 없이 한 줄 소원으로, 글자 수는 넘지 않게
    const v = clip(t.value.replace(/\n/g, ' '), LIM.wish);
    if (v !== t.value) t.value = v;
    fit(t); $('wErr').textContent = '';
  });
  t.addEventListener('keydown', (e) => { // 엔터는 다음 소원 칸으로
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    const next = li.nextElementSibling ? li.nextElementSibling.querySelector('textarea') : (t.value.trim() && addWish());
    if (next) next.focus();
  });
  li.appendChild(t); list.appendChild(li);
  $('addWish').hidden = list.children.length >= LIM.wishes;
  fit(t);
  return t;
}
function resetForm(o = {}) {
  $('wishes').textContent = '';
  for (let i = 0; i < 3; i++) addWish();
  $('fTo').value = o.to || ''; $('fFr').value = o.fr || ''; $('fMsg').value = '';
  $('msgCnt').textContent = '0 / ' + LIM.msg; $('wErr').textContent = '';
  fit($('fMsg'));
}
function limitName(i) { const v = clip(i.value, LIM.name); if (v !== i.value) i.value = v; }
$('fTo').addEventListener('input', () => limitName($('fTo')));
$('fFr').addEventListener('input', () => limitName($('fFr')));
$('fMsg').addEventListener('input', () => {
  const m = $('fMsg'), v = clip(m.value, LIM.msg);
  if (v !== m.value) m.value = v;
  $('msgCnt').textContent = count(m.value) + ' / ' + LIM.msg; fit(m);
});
$('addWish').addEventListener('click', () => { const t = addWish(); if (t) t.focus(); });
// 폰 키보드가 올라온 뒤에도 적는 칸이 보이게 가운데로 옮긴다
$('scrWrite').addEventListener('focusin', (e) => {
  if (!e.target.matches('input[type="text"], textarea')) return;
  setTimeout(() => { if (document.activeElement === e.target) e.target.scrollIntoView({ block: 'center', behavior: calm() ? 'auto' : 'smooth' }); }, 320);
});
if (window.visualViewport) visualViewport.addEventListener('resize', () => {
  const a = document.activeElement;
  if (view === 'write' && a && a.matches('input[type="text"], textarea')) a.scrollIntoView({ block: 'center' });
});

function setPaper(i) {
  paper = i;
  $('sheet').className = 'paper pp' + i;
  [...$('papers').children].forEach((b, k) => b.setAttribute('aria-checked', k === i ? 'true' : 'false'));
  $('paperName').textContent = PAPER_NAMES[i];
}
for (let i = 0; i < PAPERS; i++) {
  const b = el('button', 'pp' + i); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', PAPER_NAMES[i]);
  b.addEventListener('click', () => setPaper(i));
  $('papers').appendChild(b);
}

// 열리는 날: 고를 때마다 "지금"을 기준으로 다시 계산한다
function target(now = Date.now()) {
  if (when === 'ny') return D.nextNewYear(now);
  if (when === 'seol') return D.nextSeollal(now);
  if (when === 'd100') return D.plusDays(now, 100);
  if (when === 'y1') return D.plusYear(now);
  return D.customDate($('cDate').value, $('cTime').value || '00:00');
}
function renderWhens() {
  const now = Date.now(), seol = D.nextSeollal(now);
  if (when === 'seol' && !seol) when = 'ny';
  const opts = [['ny', '새해 첫날', D.nextNewYear(now)], ['seol', '설날', seol], ['d100', '100일 뒤', D.plusDays(now, 100)], ['y1', '1년 뒤', D.plusYear(now)], ['custom', '직접 고르기', null]];
  const wrap = $('whens'); wrap.textContent = '';
  for (const [k, name, d] of opts) {
    if (k === 'seol' && !d) continue;
    const b = el('button', '', name); b.type = 'button'; b.dataset.k = k; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', k === when ? 'true' : 'false');
    b.appendChild(el('small', '', d ? `${d.getFullYear()}년 ${D.fmtDay(d)}` : '날짜와 시각'));
    b.addEventListener('click', () => { when = k; renderWhens(); });
    wrap.appendChild(b);
  }
  $('custom').hidden = when !== 'custom';
  if (when === 'custom') {
    $('cDate').min = D.inputDate(new Date(now));
    if (!$('cDate').value) $('cDate').value = D.inputDate(D.plusDays(now, 30));
  }
  const t = target(now), sum = $('whenSum'); sum.textContent = '';
  if (!D.pickable(t, now)) { sum.textContent = '앞으로 올 날을 골라 주세요 (10년 안쪽).'; return; }
  sum.append(el('b', '', D.fmtWhen(t)), '에 열려요 · ', D.countdownText(t, now).big);
}
$('cDate').addEventListener('input', renderWhens);
$('cTime').addEventListener('input', renderWhens);

function formNote() {
  const w = [...$('wishes').querySelectorAll('textarea')].map((t) => t.value);
  const t = target();
  return { t, note: t && tidy({ id: newId(), to: $('fTo').value, fr: $('fFr').value, w, m: $('fMsg').value, p: paper, t: D.toStamp(t) }) };
}
$('foldBtn').addEventListener('click', () => {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  const { t, note } = formNote(), err = $('wErr');
  if (!D.pickable(t, Date.now())) { err.textContent = '열리는 날을 앞으로 올 날로 골라 주세요.'; return; }
  if (!note) { err.textContent = '소원을 하나라도 적어 주세요.'; const f = $('wishes').querySelector('textarea'); if (f) f.focus(); return; }
  err.textContent = '';
  box.keep(note, 1, Date.now());
  history.pushState(null, '', '#w=' + encode(note)); // 접는 모습을 보여 주려고 화면은 직접 바꾼다
  replyTo = null; $('replyNote').hidden = true; resetForm();
  openNote(note, true);
  scrollTo(0, 0);
});

/* ───────── 2~4. 쪽지 보기 ───────── */
let cur = null;      // 지금 보고 있는 쪽지 (소원함에 든 것)
let busy = false;    // 접거나 펼치는 중
const curTarget = () => D.fromStamp(cur.t);

function openNote(note, fresh) {
  // 소원함에 있으면 그것을 쓴다(펼쳐 봤는지, 이룬 소원). 처음 보는 쪽지는 받은 쪽지로 담아 둔다.
  const had = box.find(note.id);
  cur = had || box.keep(note, 0, Date.now()) || Object.assign({ mine: 0, opened: 0, done: note.w.map(() => 0), at: 0 }, note);
  if (!had && !fresh) toast('이 기기의 소원함에 담아 뒀어요');
  show('note');
  const n3 = $('note3'), st = $('stage');
  n3.className = 'note3 pp' + cur.p + (fresh ? '' : ' f1 folded sealed');
  $('letter').className = 'paper letter pp' + cur.p;
  st.classList.remove('ready');
  n3.hidden = false; $('letter').hidden = true; $('sun').hidden = true; $('manual').hidden = true;
  $('nKicker').textContent = fresh ? '쪽지를 접고 있어요' : cur.mine ? '내가 쓴 쪽지' : cur.fr ? `${cur.fr} 님이 보낸 쪽지` : '소원 쪽지가 도착했어요';
  $('nTo').textContent = cur.to ? 'To. ' + cur.to : cur.mine ? '나에게' : '';
  $('mineActs').hidden = !cur.mine || !!fresh; $('replyBtn').hidden = !!cur.mine;
  $('cdWhen').textContent = D.fmtWhen(curTarget()) + '에 열려요';
  if (fresh) { $('lock').hidden = true; $('openBtn').hidden = true; $('nTally').hidden = true; foldAnim(); return; }
  if (cur.opened) showLetter(false); else tick();
}
async function foldAnim() {
  busy = true;
  const n3 = $('note3'), id = cur.id;
  await wait(450); if (!cur || cur.id !== id) { busy = false; return; }
  n3.classList.add('f1'); sfx.play('fold');
  await wait(560); n3.classList.add('folded'); sfx.play('fold');
  await wait(640); n3.classList.add('sealed'); sfx.play('seal');
  if (navigator.vibrate) { try { navigator.vibrate(18); } catch (_) { /* 무시 */ } }
  await wait(380);
  busy = false;
  if (!cur || cur.id !== id) return;
  $('nKicker').textContent = '쪽지를 접어 두었어요';
  $('mineActs').hidden = false;
  toast('이 기기의 소원함에 담아 뒀어요');
  tick();
}
// 1초에 몇 번씩 남은 시간을 고친다. 그 순간이 되면 저절로 "펼치기"로 바뀐다.
function tick() {
  if (view !== 'note' || !cur || busy || cur.opened) return;
  const now = Date.now(), t = curTarget(), open = D.isUnlocked(t, now), c = D.countdownText(t, now);
  $('lock').hidden = false; $('nTally').hidden = true;
  $('cdBig').textContent = c.big; $('cdBig').classList.toggle('clock', c.big.includes(':'));
  $('cdSmall').textContent = c.small;
  $('cdWhen').hidden = open;
  $('openBtn').hidden = !open;
  $('stage').classList.toggle('ready', open);
  $('note3').setAttribute('aria-label', open ? '쪽지 펼치기' : '아직 열 수 없는 쪽지');
}
setInterval(tick, 250);
document.addEventListener('visibilitychange', tick);

async function unfold() {
  if (busy || !cur || cur.opened) return;
  if (!D.isUnlocked(curTarget(), Date.now())) { // 아직 잠긴 쪽지
    const n3 = $('note3'); n3.classList.remove('nudge'); void n3.offsetWidth; n3.classList.add('nudge');
    sfx.play('tap'); toast('아직 열 수 없어요. ' + D.fmtWhen(curTarget()) + '에 열려요');
    return;
  }
  busy = true;
  const n3 = $('note3'), id = cur.id;
  $('stage').classList.remove('ready'); $('openBtn').hidden = true; $('lock').hidden = true;
  n3.classList.remove('sealed'); sfx.play('open');
  await wait(260); n3.classList.remove('folded');
  await wait(480); n3.classList.remove('f1');
  await wait(620);
  busy = false;
  if (!cur || cur.id !== id) return;
  cur = box.patch(id, (e) => { e.opened = 1; }) || Object.assign(cur, { opened: 1 });
  showLetter(true);
}
$('note3').addEventListener('click', unfold);
$('openBtn').addEventListener('click', unfold);

function showLetter(party) {
  const t = curTarget();
  $('note3').hidden = true; $('lock').hidden = true; $('openBtn').hidden = true; $('stage').classList.remove('ready');
  $('lTo').textContent = cur.to ? 'To. ' + cur.to : cur.mine ? 'To. 나에게' : ''; $('lTo').hidden = !$('lTo').textContent;
  $('lMsg').textContent = cur.m; $('lMsg').hidden = !cur.m;
  $('lFr').textContent = cur.fr ? 'From. ' + cur.fr : ''; $('lFr').hidden = !cur.fr;
  $('lDate').textContent = D.fmtWhen(t) + '에 열린 쪽지';
  const ul = $('lWishes'); ul.textContent = '';
  cur.w.forEach((w, i) => {
    const li = el('li', cur.done[i] ? 'did' : ''), b = el('button', 'ok', cur.done[i] ? '이뤘어요 ✓' : '이뤘어요');
    b.type = 'button'; b.setAttribute('aria-pressed', cur.done[i] ? 'true' : 'false');
    b.addEventListener('click', () => {
      const on = !cur.done[i];
      cur = box.patch(cur.id, (e) => { e.done[i] = on ? 1 : 0; }) || Object.assign(cur, { done: cur.done.map((v, k) => (k === i ? (on ? 1 : 0) : v)) });
      li.classList.toggle('did', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.textContent = on ? '이뤘어요 ✓' : '이뤘어요';
      if (on) { sfx.play('done'); if (cur.done.every(Boolean)) { confetti(50); toast('소원을 모두 이뤘어요. 축하해요!'); } }
      renderTally();
    });
    li.append(el('span', 'tx', w), b); ul.appendChild(li);
  });
  $('nKicker').textContent = cur.mine ? '내가 쓴 쪽지' : cur.fr ? `${cur.fr} 님이 보낸 쪽지` : '받은 소원 쪽지';
  $('nTo').textContent = '';
  // 1월 1일에 열리는 쪽지이거나 오늘이 1월 1일이면 해돋이
  $('sun').hidden = !(D.isNewYearsDay(t) || D.isNewYearsDay(new Date()));
  const letter = $('letter'); letter.hidden = false;
  letter.classList.toggle('unfold', !!party);
  $('mineActs').hidden = !cur.mine;
  renderTally();
  if (party) confetti(110);
}
function renderTally() {
  const p = $('nTally'), n = cur.done.filter(Boolean).length; p.hidden = false; p.textContent = '';
  p.append('이룬 소원 ', el('b', '', String(n)), ' / ' + cur.w.length);
}

/* ───────── 링크 보내기 · 답장 ───────── */
const curUrl = () => location.origin + location.pathname + '#w=' + encode(cur);
function manual(url) { const i = $('manual'); i.value = url; i.hidden = false; }
$('manual').addEventListener('focus', () => $('manual').select());
// 놀자방 홈과 같은 순서: 공유 창 → 복사 → 직접 복사
$('sendBtn').addEventListener('click', async () => {
  const url = curUrl(), d = curTarget();
  const text = `소원 쪽지를 보냈어요. ${d.getFullYear()}년 ${D.fmtDay(d)}에 열려요.`;
  try {
    if (navigator.share) { await navigator.share({ title: '새해 소원 쪽지', text, url }); return; }
    await navigator.clipboard.writeText(url);
    toast('링크를 복사했어요. 친구·연인에게 붙여 넣어 보내세요');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    manual(url); prompt('이 링크를 복사해서 보내세요', url);
  }
});
$('keepBtn').addEventListener('click', async () => {
  const url = curUrl();
  try {
    await navigator.clipboard.writeText(url);
    toast('소원함에 담겨 있어요. 링크도 복사했으니 메모나 나와의 채팅에 붙여 두면 다른 기기에서도 열 수 있어요', 4200);
  } catch (_) {
    manual(url); prompt('소원함에 담겨 있어요. 이 링크를 복사해 메모에 붙여 두면 다른 기기에서도 열 수 있어요', url);
  }
});
// 답장: 받는 사람을 채워 두고, 받은 쪽지와 같은 날에 열리게 맞춘다
$('replyBtn').addEventListener('click', () => {
  if (!cur) return;
  replyTo = cur;
  resetForm({ to: cur.fr, fr: cur.to });
  const t = curTarget(), now = Date.now(), same = D.pickable(t, now);
  if (same) {
    const hit = ['ny', 'seol', 'd100', 'y1'].find((k) => { when = k; const d = target(now); return d && +d === +t; });
    if (!hit) { when = 'custom'; $('cDate').value = D.inputDate(t); $('cTime').value = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); }
  } else when = 'ny';
  const n = $('replyNote'); n.hidden = false;
  n.textContent = (cur.fr ? `${cur.fr} 님에게 보내는 답장이에요.` : '받은 쪽지에 보내는 답장이에요.') + (same ? ' 받은 쪽지와 같은 날 열리게 맞춰 뒀어요.' : '');
  location.hash = '#write';
});

/* ───────── 내 소원함 ───────── */
function renderBox() {
  const list = box.load(), now = Date.now(), wrap = $('boxList'), tl = box.tally(list);
  wrap.textContent = '';
  $('boxEmpty').hidden = list.length > 0;
  $('boxSumText').textContent = tl.all ? '펼쳐 본 쪽지에서' : '쪽지를 펼친 뒤에 이룬 소원을 표시할 수 있어요';
  $('boxTally').textContent = tl.all ? `이룬 소원 ${tl.done} / ${tl.all}` : '';
  for (const e of list) {
    const t = D.fromStamp(e.t), item = el('div', 'item'), a = el('a'), txt = el('div');
    a.href = '#w=' + encode(e);
    a.appendChild(el('span', 'mini pp' + e.p + (e.opened ? ' opened' : '')));
    txt.appendChild(el('p', 'nm', e.mine ? (e.to ? `${e.to}에게 쓴 쪽지` : '나에게 쓴 쪽지') : (e.fr ? `${e.fr} 님이 보낸 쪽지` : '받은 쪽지')));
    const st = el('p', 'st');
    if (e.opened) st.append(el('b', 'dn', '펼쳐 봤어요'), `이룬 소원 ${e.done.filter(Boolean).length} / ${e.w.length}`);
    else if (D.isUnlocked(t, now)) st.append(el('b', 'go', '열 수 있어요'), '눌러서 펼쳐 보세요');
    else { const c = D.countdownText(t, now); st.append(el('b', '', c.big.includes(':') ? '오늘 열려요' : c.big), D.fmtWhen(t)); }
    txt.appendChild(st); a.appendChild(txt);
    const del = el('button', 'del', '×'); del.type = 'button'; del.setAttribute('aria-label', '소원함에서 지우기');
    del.addEventListener('click', () => {
      if (!confirm('이 쪽지를 소원함에서 지울까요? 링크를 따로 두지 않았다면 다시 볼 수 없어요.')) return;
      box.remove(e.id); renderBox(); show('box');
    });
    item.append(a, del); wrap.appendChild(item);
  }
}

/* ───────── 색종이 ───────── */
let fxRun = 0;
function confetti(n) {
  if (calm()) return;
  const cv = $('fx'), g = cv.getContext('2d'); if (!g) return;
  const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight, run = ++fxRun;
  cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ['#D9483B', '#F7D48F', '#3E9A7E', '#F28B7D', '#FFFDF8', '#F2B544'];
  const bits = Array.from({ length: n }, (_, i) => ({
    x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.34, vx: (Math.random() - 0.5) * 9, vy: -5 - Math.random() * 8,
    s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length], round: i % 4 === 0,
  }));
  const t0 = performance.now();
  (function step(now) {
    if (run !== fxRun) return;
    const age = (now - t0) / 1000;
    g.clearRect(0, 0, W, H);
    if (age > 3.2) return;
    g.globalAlpha = Math.min(1, (3.2 - age) / 0.8);
    for (const b of bits) {
      b.vy += 0.28; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.fillStyle = b.c;
      if (b.round) { g.beginPath(); g.arc(0, 0, b.s / 2, 0, 7); g.fill(); } else g.fillRect(-b.s / 2, -b.s / 3, b.s, b.s * 0.66 * Math.abs(Math.cos(b.r * 2)) + 1);
      g.restore();
    }
    requestAnimationFrame(step);
  })(t0);
}

/* ───────── 소리 버튼 · 시작 ───────── */
$('snd').addEventListener('click', () => {
  sfx.setMuted(!sfx.muted);
  $('snd').classList.toggle('off', sfx.muted); $('snd').setAttribute('aria-label', sfx.muted ? '소리 켜기' : '소리 끄기');
});

resetForm(); setPaper(0); route();
window.__wish = { D, box, encode, decode, sfx, get cur() { return cur; }, get view() { return view; } };
