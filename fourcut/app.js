// 네 컷 사진관: 화면 흐름(처음 → 찍기 → 컷 보기 → 꾸미고 저장), 카메라, 앨범, 저장·공유.
// 프레임 그리기는 strip.js, 소리는 sfx.js, 둘이 찍기 통신은 duo.js.
// 화면에 넣는 글자는 모두 textContent 로 넣고, 사진은 이 브라우저 밖으로 올리지 않는다.
import { FRAMES, frameOf, CUT_W, CUT_H, drawStrip, drawCut } from './strip.js';
import { sfx } from './sfx.js';
import { createDuo } from './duo.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const TICK = Math.max(30, Math.min(2000, +q.get('tick') || 1000)); // 카운트다운 한 칸(밀리초). 검사 때만 줄인다
const INAPP = /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps/i.test(navigator.userAgent);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p2 = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`; };
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const roomInHash = () => (/^#r=([a-z0-9]{4,16})$/.exec(location.hash) || [])[1] || null;

// S.cuts[i] = null | { full, split, g, host, guest }  (strip.js 의 drawCut 참고)
const S = {
  screen: 'start', duo: false, role: null, cuts: [null, null, null, null],
  src: 'cam',      // cam | album : 컷을 어디서 가져왔는지
  cam: 'idle',     // idle | starting | ok | fail
  camWhy: '', retake: -1, busy: false, counting: false, peerCam: null, lostNote: '',
  opt: { frame: 'cream', caption: '', date: true, dateText: today() },
};
const video = $('video'), stripCv = mkCanvas(8, 8);
let stream = null, camP = null, wantCam = false, picks = [], run = 0, serial = 0, room = null;
let inbox = {}, chain = Promise.resolve(), outUrl = null, outBlob = null, renderT = 0, renders = 0;

/* ───────── 작은 도구 ───────── */
function toast(msg, ms = 3200) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.k); toast.k = setTimeout(() => { t.hidden = true; }, ms);
}
// 가운데를 기준으로 잘라 채운다 (세로 사진이든 가로 사진이든)
function cover(c, src, sw, sh, w, h, mirror) {
  const s = Math.max(w / sw, h / sh), cw = w / s, ch = h / s;
  c.save(); if (mirror) { c.translate(w, 0); c.scale(-1, 1); }
  c.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h); c.restore();
}
async function fileToCanvas(file, max = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = mkCanvas(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return cv;
  } finally { URL.revokeObjectURL(url); }
}
const loadImg = (url) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
const duoOn = () => S.duo && duo.mode === 'on';
const empties = () => S.cuts.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);

/* ───────── 카메라 ───────── */
function startCam() {
  wantCam = true;
  if (stream) return Promise.resolve(true);
  if (camP) return camP;
  S.cam = 'starting';
  camP = (async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('no api'), { name: 'NoApi' });
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (!wantCam) { s.getTracks().forEach((t) => t.stop()); S.cam = 'idle'; return false; } // 그새 화면을 떠났다
      stream = s; video.srcObject = s;
      await video.play().catch(() => {});
      for (let i = 0; i < 40 && !video.videoWidth; i++) await sleep(50);
      S.cam = 'ok';
    } catch (e) { S.cam = 'fail'; S.camWhy = (e && e.name) || 'Error'; }
    return S.cam === 'ok';
  })();
  camP.then(() => { camP = null; if (S.duo) duo.send({ t: 'cam', ok: S.cam === 'ok' }); paintBooth(); });
  return camP;
}
function stopCam() {
  wantCam = false;
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; video.srcObject = null; }
  if (S.cam === 'ok') S.cam = 'idle';
}
// 지금 보이는 장면을 w x h 로 담는다. 카메라가 없으면 앨범에서 고른 사진, 그것도 없으면 빈 자리 그림.
function grab(w, h, i) {
  const cv = mkCanvas(w, h), c = cv.getContext('2d');
  if (S.cam === 'ok' && video.videoWidth) cover(c, video, video.videoWidth, video.videoHeight, w, h, true);
  else if (picks.length) { const p = picks[i % picks.length]; cover(c, p, p.width, p.height, w, h, false); }
  else {
    c.fillStyle = '#F7D48F'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#5A3824'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `${Math.round(h * 0.26)}px sans-serif`; c.fillText('🙂', w / 2, h * 0.45);
    c.font = `700 ${Math.round(h * 0.06)}px sans-serif`; c.fillText('카메라 없이 참여', w / 2, h * 0.72);
  }
  return cv;
}
function camFailText() {
  if (INAPP) return '이 앱 안에서는 카메라가 막혀 있어요. 메뉴에서 "다른 브라우저로 열기"를 누르거나, 앨범에서 사진을 골라 주세요.';
  if (S.camWhy === 'NotAllowedError' || S.camWhy === 'SecurityError') return '카메라 권한이 꺼져 있어요. 브라우저 설정에서 카메라를 허용하거나, 앨범에서 사진을 골라 주세요.';
  return '카메라를 찾지 못했어요. 앨범에서 사진을 골라도 네 컷을 만들 수 있어요.';
}

/* ───────── 화면 바꾸기 ───────── */
function show(name) {
  S.screen = name;
  for (const n of ['start', 'booth', 'review', 'finish']) $('scr-' + n).hidden = n !== name;
  // 카메라는 찍는 화면에서만 켠다. 둘이 찍는 중에는 컷 보기에서도 켜 둔다(친구가 다시 찍자고 할 수 있어서).
  if (name === 'booth' || (name === 'review' && S.duo && S.src === 'cam')) startCam(); else stopCam();
  if (name === 'review') paintReview();
  if (name === 'finish') { paintFinish(); render(); }
  paintBooth();
  scrollTo(0, 0);
}
function cancelRun() { run++; S.busy = false; S.counting = false; $('count').textContent = ''; $('hud').hidden = true; }

function pillText() {
  if (!S.duo) return S.lostNote ? ['off', S.lostNote] : null;
  const m = duo.mode;
  if (m === 'on') return ['on', S.peerCam === false ? '친구랑 연결됐어요 (친구는 카메라 없이 참여)' : '친구랑 연결됐어요'];
  if (m === 'waiting') return ['wait', '친구가 들어오기를 기다리는 중이에요'];
  return ['wait', '연결하는 중이에요'];
}
function paintBooth() {
  const p = pillText();
  for (const [box, txt] of [['pill', 'pill-t'], ['pill2', 'pill2-t']]) {
    $(box).hidden = !p; if (p) { $(box).className = 'pill ' + p[0]; $(txt).textContent = p[1]; }
  }
  if (S.screen !== 'booth') return;
  const f = $('finder'), duoView = S.duo && (duo.mode === 'on' || duo.mode === 'waiting' || duo.mode === 'connecting');
  f.className = 'finder' + (duoView ? ' duo' : '') + (duoView && S.role === 'guest' ? ' guest' : '');
  $('mate').hidden = !duoView; $('me').hidden = !duoView;
  $('mate-t').textContent = duo.mode === 'on' ? (S.peerCam === null ? '친구가 준비하는 중' : '친구 자리') : '친구를 기다리는 중';
  video.hidden = S.cam !== 'ok';
  const pk = $('pick'); pk.hidden = !(S.cam !== 'ok' && picks.length);
  if (!pk.hidden) { pk.width = 480; pk.height = 720; cover(pk.getContext('2d'), picks[0], picks[0].width, picks[0].height, 480, 720, false); }
  $('off-t').textContent = S.cam === 'fail' ? '카메라를 쓸 수 없어요' : '카메라를 켜는 중이에요';
  $('nocam').hidden = S.cam !== 'fail'; if (S.cam === 'fail') $('nocam').textContent = camFailText();
  $('pick-album').hidden = S.cam !== 'fail';
  $('share-box').hidden = !(S.duo && duo.mode === 'waiting');
  $('to-solo').hidden = !S.duo;

  const b = $('shoot'); let label = '찍기', off = S.busy;
  if (S.busy) label = '찍는 중이에요';
  else if (S.duo && duo.mode !== 'on') { label = '친구가 들어오면 찍을 수 있어요'; off = true; }
  else if (S.duo && S.role === 'guest') { label = '친구가 찍기를 누르면 같이 찍혀요'; off = true; }
  else if (S.duo && S.peerCam === null) { label = '친구가 준비하는 중이에요'; off = true; }
  else if (S.retake >= 0) label = `${S.retake + 1}번 컷 다시 찍기`;
  else if (empties().length && empties().length < 4) label = '남은 컷 찍기';
  else label = '📸 찍기 (네 컷 연속)';
  b.textContent = label; b.disabled = off;
  $('back').textContent = S.retake >= 0 && !S.duo ? '그만두고 컷 보기로' : '처음으로';
  b.hidden = !S.duo && S.cam === 'fail'; // 혼자인데 카메라가 없으면 앨범 단추만 보인다
  paintThumbs();
}
function paintThumbs() {
  const box = $('thumbs');
  if (!box.children.length) for (let i = 0; i < 4; i++) box.appendChild(mkCanvas(240, 180));
  S.cuts.forEach((cut, i) => { const cv = box.children[i], c = cv.getContext('2d'); c.clearRect(0, 0, 240, 180); if (cut) drawCut(c, cut, 0, 0, 240, 180); });
}
function retakeLabel(i) {
  if (!S.cuts[i]) return S.src === 'album' ? '사진 넣기' : '이 컷 찍기';
  return S.src === 'album' ? '사진 바꾸기' : '다시 찍기';
}
function paintReview() {
  const box = $('cuts');
  if (!box.children.length) {
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('div'); d.className = 'cut';
      const no = document.createElement('span'); no.className = 'no'; no.textContent = i + 1;
      const w = document.createElement('span'); w.className = 'wait'; w.textContent = '친구 사진 받는 중';
      const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i;
      b.addEventListener('click', () => retake(i));
      d.append(mkCanvas(480, 360), no, w, b); box.appendChild(d);
    }
  }
  S.cuts.forEach((cut, i) => {
    const d = box.children[i], c = d.firstChild.getContext('2d');
    c.clearRect(0, 0, 480, 360); if (cut) drawCut(c, cut, 0, 0, 480, 360);
    d.querySelector('.wait').hidden = !(cut && cut.split && !(cut.host && cut.guest));
    d.querySelector('button').textContent = retakeLabel(i);
  });
  $('to-finish').disabled = empties().length > 0;
  $('to-finish').textContent = empties().length ? '네 컷을 다 채우면 넘어갈 수 있어요' : '프레임 고르러 가기';
  $('review-hint').textContent = S.src === 'album' ? '마음에 안 드는 사진은 그 칸만 바꿀 수 있어요.'
    : S.duo ? '다시 찍기를 누르면 친구 화면에서도 같이 다시 찍어요.' : '마음에 안 드는 컷은 그 컷만 다시 찍을 수 있어요.';
}
function paintFinish() {
  const box = $('frames');
  if (!box.children.length) {
    for (const f of FRAMES) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.id = f.id; b.style.background = f.sw;
      b.setAttribute('aria-label', f.name + ' 프레임');
      b.addEventListener('click', () => setOpt({ frame: f.id }));
      box.appendChild(b);
    }
  }
  for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.id === S.opt.frame));
  $('frame-name').textContent = frameOf(S.opt.frame).name;
  if ($('caption').value !== S.opt.caption && document.activeElement !== $('caption')) $('caption').value = S.opt.caption;
  $('date').checked = S.opt.date;
}
// 컷이나 꾸밈이 바뀌면 보이는 것을 모두 다시 그린다
function repaint() {
  paintThumbs();
  if (S.screen === 'review') paintReview();
  if (S.screen === 'finish') { paintFinish(); render(); }
}

/* ───────── 찍기 ───────── */
async function shootOne(i, g, my) {
  if (my !== run) return false;
  S.counting = true; $('hud').hidden = false; $('hud').textContent = `${i + 1} / 4`;
  const cnt = $('count');
  for (const n of [3, 2, 1]) {
    cnt.textContent = n; cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop'); sfx.tick();
    await sleep(TICK);
    if (my !== run) return false;
  }
  cnt.textContent = '';
  if (camP) await Promise.race([camP, sleep(1500)]); // 카메라가 막 켜지는 중이면 잠깐 기다린다
  const fl = $('flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); sfx.shutter();
  const cut = { full: grab(CUT_W, CUT_H, i), split: false, g, host: null, guest: null };
  S.cuts[i] = cut; S.src = 'cam';
  if (duoOn()) { // 둘이 찍는 컷: 같은 순간의 반쪽을 따로 담아 보내고, 나도 보낸 것과 똑같은 JPEG 을 쓴다
    cut.split = true;
    const url = grab(CUT_W / 2, CUT_H, i).toDataURL('image/jpeg', 0.72);
    duo.sendHalf(i, g, url);
    cut[S.role] = await loadImg(url);
    settle(i);
  }
  S.counting = false; repaint();
  return true;
}
// 주인(또는 혼자)이 차례로 찍는다
async function shoot(list) {
  if (S.busy || !list.length) return;
  S.busy = true; const my = run; paintBooth();
  for (const i of list) {
    const g = ++serial;
    if (duoOn()) duo.send({ t: 'cut', i, g, last: i === list[list.length - 1] });
    if (!(await shootOne(i, g, my))) return;
    await sleep(TICK * 0.7);
    if (my !== run) return;
  }
  S.busy = false; S.retake = -1; $('hud').hidden = true;
  if (duoOn()) sendOpt();
  show('review');
}
// 친구가 보낸 반쪽이 내 컷과 같은 번호(g)면 끼워 넣는다
function settle(i) {
  const cut = S.cuts[i], m = inbox[i];
  if (!cut || !m || !cut.split || cut.g !== m.g) return;
  cut[S.role === 'host' ? 'guest' : 'host'] = m.img; delete inbox[i];
}
function retake(i) {
  if (S.src === 'album' || (S.cam === 'fail' && !S.duo)) { $('one').dataset.i = i; $('one').click(); return; }
  if (duoOn() && S.role === 'guest') { duo.send({ t: 'req', i }); toast('친구한테 다시 찍자고 했어요. 곧 같이 카운트다운해요'); return; }
  S.retake = i;
  if (duoOn()) { show('booth'); startCam().then(() => shoot([i])); } // 둘이면 누르자마자 같이 다시 찍는다
  else show('booth');
}
function resetAll() {
  cancelRun(); S.cuts = [null, null, null, null]; S.retake = -1; S.src = 'cam'; inbox = {};
}

/* ───────── 앨범에서 고르기 ───────── */
async function onAlbum(files) {
  const list = Array.from(files).filter((f) => /^image\//.test(f.type)).slice(0, 4);
  if (!list.length) return;
  const cvs = [];
  for (const f of list) { try { cvs.push(await fileToCanvas(f)); } catch (_) { /* 못 읽는 사진은 건너뛴다 */ } }
  if (!cvs.length) { toast('사진을 읽지 못했어요. 다른 사진으로 해 볼까요?'); return; }
  if (S.duo) { picks = cvs; toast('고른 사진으로 같이 찍을게요'); paintBooth(); return; } // 둘이 찍을 때는 내 자리에 이 사진이 들어간다
  cancelRun(); S.src = 'album';
  const slots = empties().length ? empties() : [0, 1, 2, 3];
  if (slots.length === 4) S.cuts = [null, null, null, null];
  cvs.forEach((cv, k) => { if (k < slots.length) S.cuts[slots[k]] = albumCut(cv); });
  if (cvs.length < slots.length) toast(`${cvs.length}장을 넣었어요. 남은 칸도 채워 주세요`);
  show('review');
}
function albumCut(src) {
  const full = mkCanvas(CUT_W, CUT_H); cover(full.getContext('2d'), src, src.width, src.height, CUT_W, CUT_H, false);
  return { full, split: false, g: ++serial, host: null, guest: null };
}

/* ───────── 꾸미기 · 저장 · 공유 ───────── */
function render() {
  drawStrip(stripCv, S.cuts, S.opt); renders++;
  clearTimeout(renderT);
  renderT = setTimeout(() => stripCv.toBlob((b) => {
    if (!b) return;
    outBlob = b; if (outUrl) URL.revokeObjectURL(outUrl);
    outUrl = URL.createObjectURL(b); $('out').src = outUrl;
  }, 'image/jpeg', 0.92), 60);
}
const blobNow = () => new Promise((ok) => stripCv.toBlob(ok, 'image/jpeg', 0.92));
const fileName = () => `fourcut-${S.opt.dateText.replace(/\./g, '')}.jpg`;
function sendOpt() { duo.send(Object.assign({ t: 'opt' }, S.opt)); }
function setOpt(o) { Object.assign(S.opt, o); repaint(); if (duoOn()) sendOpt(); }
async function save(quiet) {
  const b = await blobNow(); if (!b) return;
  const a = document.createElement('a'), url = URL.createObjectURL(b);
  a.href = url; a.download = fileName(); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  window.__fourcut.saved = (window.__fourcut.saved || 0) + 1;
  if (!quiet) toast(INAPP ? '저장이 안 되면 사진을 길게 눌러 저장해 주세요' : '사진을 저장했어요');
}
async function share() {
  const b = await blobNow(); if (!b) return;
  const file = new File([b], fileName(), { type: 'image/jpeg' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: '네 컷 사진관' }); return; }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // 공유 창을 그냥 닫음
  }
  await save(true); // 파일 공유가 안 되는 브라우저: 저장으로 대신한다
  toast('이 브라우저는 바로 공유가 안 돼서 사진을 저장했어요. 갤러리에서 보내 주세요', 4500);
}

/* ───────── 둘이 찍기 ───────── */
const duo = createDuo({
  state(mode, role) {
    S.role = role;
    if (mode === 'on') {
      S.peerCam = null; S.lostNote = '';
      toast('친구랑 연결됐어요!');
      if (S.cam === 'ok' || S.cam === 'fail') duo.send({ t: 'cam', ok: S.cam === 'ok' });
      if (role === 'host') sendOpt();
    } else if (mode === 'lost') endDuo('친구가 나갔어요. 혼자 이어서 찍을 수 있어요', '친구가 나갔어요. 찍은 컷은 그대로 두고, 남은 컷은 혼자 찍을 수 있어요');
    else if (mode === 'full') endDuo('', '이미 두 명이 찍고 있는 방이에요. 혼자 찍거나 새 방을 만들어 주세요');
    else if (mode === 'fail') endDuo('', '친구랑 연결하지 못했어요. 링크를 다시 받아 보거나 혼자 찍어 주세요');
    paintBooth();
  },
  cut(i, g, last) { // 손님: 주인이 누른 카운트다운을 같이 시작한다
    chain = chain.then(async () => {
      if (!S.duo) return;
      if (S.screen !== 'booth') show('booth');
      S.busy = true; paintBooth();
      const my = run, ok = await shootOne(i, g, my);
      if (!ok) return;
      if (last || !S.duo) {
        await sleep(TICK * 0.7);
        if (my !== run) return;
        S.busy = false; $('hud').hidden = true;
        if (last || !empties().length) show('review'); else paintBooth();
      }
    }).catch(() => {});
  },
  req(i) { // 주인: 손님이 다시 찍자고 함
    if (S.busy) return;
    toast(`친구가 ${i + 1}번 컷을 다시 찍자고 해요`);
    S.retake = i; show('booth'); startCam().then(() => shoot([i]));
  },
  half(i, g, img) { inbox[i] = { g, img }; settle(i); repaint(); },
  opt(o) {
    if (FRAMES.some((f) => f.id === o.frame)) S.opt.frame = o.frame;
    S.opt.caption = o.caption; S.opt.date = o.date; if (o.dateText) S.opt.dateText = o.dateText;
    repaint();
  },
  cam(ok) { S.peerCam = ok; paintBooth(); },
});
// 둘이 찍기를 끝내고 혼자 모드로. 친구 반쪽이 안 온 컷은 내 사진만으로 채운다.
function endDuo(note, msg) {
  S.duo = false; S.lostNote = note; S.peerCam = null; inbox = {};
  for (const c of S.cuts) if (c && c.split && !(c.host && c.guest)) c.split = false;
  if (!S.counting && S.role === 'guest') { S.busy = false; $('hud').hidden = true; }
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  if (msg) toast(msg, 5000);
  if (S.screen === 'review' && S.src !== 'cam') stopCam();
  repaint();
}
const inviteUrl = () => location.origin + location.pathname + location.search + '#r=' + room;
function startDuo(asHost) {
  if (asHost) {
    const a = new Uint8Array(8); crypto.getRandomValues(a);
    room = Array.from(a, (v) => 'abcdefghijkmnpqrstuvwxyz23456789'[v % 32]).join('');
    history.replaceState(null, '', '#r=' + room);
  }
  resetAll(); S.duo = true; S.lostNote = ''; $('link').textContent = inviteUrl();
  duo.open(room); show('booth');
}

/* ───────── 단추 연결 ───────── */
room = roomInHash();
$('invited').hidden = $('go-join').hidden = !room;
if (room) { $('go-solo').className = 'btn paper'; $('go-duo').hidden = true; }
$('inapp').hidden = !INAPP;
document.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
$('snd').addEventListener('click', () => { const on = sfx.toggle(); $('snd').textContent = on ? '🔈' : '🔇'; $('snd').setAttribute('aria-label', on ? '소리 끄기' : '소리 켜기'); });
$('go-solo').addEventListener('click', () => { resetAll(); S.lostNote = ''; show('booth'); });
$('go-duo').addEventListener('click', () => startDuo(true));
$('go-join').addEventListener('click', () => startDuo(false));
$('go-album').addEventListener('click', () => { resetAll(); $('album').click(); });
$('pick-album').addEventListener('click', () => $('album').click());
$('album').addEventListener('change', (e) => { onAlbum(e.target.files); e.target.value = ''; });
$('one').addEventListener('change', async (e) => {
  const f = e.target.files[0], i = +e.target.dataset.i; e.target.value = '';
  if (!f) return;
  try { S.cuts[i] = albumCut(await fileToCanvas(f)); if (S.cuts.every((c) => !c || !c.split)) S.src = 'album'; repaint(); }
  catch (_) { toast('사진을 읽지 못했어요. 다른 사진으로 해 볼까요?'); }
});
$('shoot').addEventListener('click', () => {
  if (S.duo && (duo.mode !== 'on' || S.role !== 'host')) return;
  const e = empties();
  shoot(S.retake >= 0 ? [S.retake] : e.length ? e : [0, 1, 2, 3]);
});
$('back').addEventListener('click', () => {
  if (S.retake >= 0 && !S.duo) { cancelRun(); S.retake = -1; show('review'); return; } // 다시 찍기를 그만두면 찍어 둔 컷으로 돌아간다
  if (S.duo) duo.leave(); S.duo = false; S.lostNote = ''; resetAll(); if (location.hash) history.replaceState(null, '', location.pathname + location.search); show('start'); });
$('to-solo').addEventListener('click', () => { duo.leave(); endDuo('', '혼자 찍기로 바꿨어요'); paintBooth(); });
$('link-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(inviteUrl()); toast('링크를 복사했어요. 친구한테 붙여 넣어 보내 주세요'); }
  catch (_) { prompt('이 링크를 복사해서 보내 주세요', inviteUrl()); }
});
$('link-share').addEventListener('click', async () => {
  try {
    if (navigator.share) { await navigator.share({ title: '네 컷 사진관', text: '우리 네 컷 같이 찍자 📸', url: inviteUrl() }); return; }
    await navigator.clipboard.writeText(inviteUrl()); toast('링크를 복사했어요. 친구한테 붙여 넣어 보내 주세요');
  } catch (e) { if (!e || e.name !== 'AbortError') prompt('이 링크를 복사해서 보내 주세요', inviteUrl()); }
});
$('to-finish').addEventListener('click', () => { if (!empties().length) show('finish'); });
$('redo-all').addEventListener('click', () => {
  if (duoOn() && S.role === 'guest') { toast('처음부터 다시 찍기는 방을 만든 친구가 누를 수 있어요'); return; }
  const album = S.src === 'album'; S.cuts = [null, null, null, null]; S.retake = -1;
  if (album) $('album').click(); else show('booth');
});
$('caption').addEventListener('input', (e) => setOpt({ caption: e.target.value.slice(0, 16) }));
$('date').addEventListener('change', (e) => setOpt({ date: e.target.checked }));
$('save').addEventListener('click', () => save(false));
$('share').addEventListener('click', share);
$('to-review').addEventListener('click', () => show('review'));
$('restart').addEventListener('click', () => { if (S.duo) duo.leave(); S.duo = false; S.lostNote = ''; resetAll(); if (location.hash) history.replaceState(null, '', location.pathname + location.search); show('start'); });
addEventListener('pagehide', () => { stopCam(); if (S.duo) duo.leave(); }); // 떠날 때 카메라를 끈다
addEventListener('hashchange', () => { if (roomInHash() && roomInHash() !== room) location.reload(); });

// 자동 검사에서 들여다보는 창
window.__fourcut = {
  S, FRAMES, strip: stripCv, tick: TICK, inapp: INAPP,
  get mode() { return duo.mode; }, get role() { return duo.role; }, get renders() { return renders; },
  get camLive() { return !!(stream && stream.getTracks().some((t) => t.readyState === 'live')); },
  get blob() { return outBlob; },
};
