// 방 사람들이 다 같이 보는 짧은 장면들: 트리 점등식, 단체 사진.
//   점등식: 3·2·1 → 방이 어두워짐 → "점등!" 트리 전구가 켜지고 트리 둘레 빛이 확 밝아짐 → 방 밝기가 천천히 돌아옴. 눈과 반짝이가 내리고 오르골이 있으면 캐럴.
//   단체 사진: 3·2·1 → 찰칵(하얀 번쩍임과 셔터 소리) → 각자 자기 화면을 찍어 폴라로이드로 보여 준다. 세는 동안 걷고 손을 흔들 수 있다.
// 시작 소식은 놀이 소식 { k: 'show', v: 'light' | 'photo' } 으로 방 사람 모두에게 간다. 받은 사람은 각자 자기 화면에서 같은 장면을 본다.
// app.js 가 넘겨주는 창구 K 로 조명 밝기, 전구, 오르골, 캔버스를 다룬다.

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const now = () => performance.now() / 1000;

// 점등식 시간표 (초)
const LIGHT = { at: 3, dimFrom: 0.6, dark: 0.22, glowTo: 4.2, backFrom: 5.2, end: 8.5 };
// 단체 사진: 세는 시간
const PHOTO = { at: 3 };
const SHOWS = ['light', 'photo'];

export function makeParty(K) {
  let show = null;      // 지금 벌어지는 장면 { v, t0, n(보여 준 숫자), lit(점등했는지), mine(내가 시작했는지) }
  let want = false;     // 다음 그림이 그려지면 바로 찍는다
  let photo = null;     // 미리보기 중인 사진 { blob, url, name }
  let snowAt = 0, ac = null;
  const count = $('count'), flash = $('flash'), box = $('party');

  /* ───────── 화면에 크게 뜨는 글 ───────── */
  function big(text, cls = '') {
    count.textContent = text;
    count.className = cls;
    void count.offsetWidth; // 같은 글을 다시 띄워도 몸짓이 처음부터 다시 나오게
    count.classList.add('on');
  }
  function clearBig() { count.textContent = ''; count.className = ''; }

  // 눈송이와 반짝이 몇 개를 위에서 떨어뜨린다 (#party 의 축하 효과와 같은 방식)
  function snow(n) {
    for (let k = 0; k < n; k++) {
      const e = document.createElement('i'), sparkle = Math.random() < 0.35, dur = 3.2 + Math.random() * 2.2;
      e.textContent = sparkle ? '✨' : '❄️';
      e.className = 'snow';
      e.style.left = (2 + Math.random() * 96) + '%';
      e.style.animationDuration = dur + 's';
      e.style.animationDelay = (Math.random() * 0.5) + 's';
      e.style.fontSize = (sparkle ? 14 : 12) + Math.random() * 14 + 'px';
      e.style.opacity = String(0.65 + Math.random() * 0.35);
      box.appendChild(e);
      setTimeout(() => e.remove(), (dur + 0.6) * 1000);
    }
  }

  /* ───────── 소리 ───────── */
  function audio() {
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { ac = null; }
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  // 찰칵: 짧은 잡음 두 번(셔터가 열리고 닫힘)
  function shutter() {
    const a = audio();
    if (!a) return;
    try {
      const len = Math.floor(a.sampleRate * 0.05), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      for (const [at, vol] of [[0, 0.5], [0.09, 0.32]]) {
        const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t0 = a.currentTime + at;
        s.buffer = buf; f.type = 'highpass'; f.frequency.value = 1400; g.gain.value = vol;
        s.connect(f); f.connect(g); g.connect(a.destination); s.start(t0);
      }
    } catch (_) { /* 소리를 못 내도 사진은 찍힌다 */ }
  }
  // 카운트다운 똑딱 (점등식은 조금 낮게, 마지막 "점등!"은 반짝)
  function tick(f, len = 0.12, vol = 0.12) {
    const a = audio();
    if (!a) return;
    try {
      const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + len + 0.05);
    } catch (_) { /* 무시 */ }
  }

  /* ───────── 시작 ───────── */
  // v = 'light' | 'photo'. mine = 내가 단추를 눌렀다 (그러면 방 사람들에게 알린다)
  function begin(v, mine) {
    if (!SHOWS.includes(v)) return false;
    if (show) { if (mine) K.toast(show.v === 'light' ? '점등식이 끝나면 다시 할 수 있어요' : '사진을 찍는 중이에요'); return false; }
    if (v === 'light' && mine && !K.canEdit()) { K.toast('점등식은 꾸미는 사람만 시작할 수 있어요'); return false; }
    show = { v, t0: now(), n: 0, lit: false, mine };
    snowAt = 0;
    if (mine) K.fx({ k: 'show', v });
    if (!mine) K.toast(v === 'light' ? '트리 점등식이 시작돼요! 🎄' : '단체 사진을 찍어요! 📷 포즈~');
    else if (v === 'photo') K.toast('3초 뒤에 찍어요. 포즈~ 📷');
    audio(); // 누른 김에 소리를 낼 수 있게 깨워 둔다
    return true;
  }
  function end() {
    if (!show) return;
    if (show.v === 'light') K.bright(1, 1); // 조명을 정확히 원래대로
    show = null;
    clearBig();
  }

  /* ───────── 매 그림마다 ───────── */
  function stepLight(t) {
    const L = LIGHT;
    if (t < L.at) {
      const n = 3 - Math.floor(t);
      if (n !== show.n) { show.n = n; big(String(n), 'num'); tick(520, 0.12, 0.1); }
      K.bright(1 - (1 - L.dark) * ease((t - L.dimFrom) / (L.at - 0.1 - L.dimFrom)), 1);
      return;
    }
    if (!show.lit) {
      show.lit = true;
      big('점등!', 'word');
      tick(880, 0.5, 0.14); setTimeout(() => tick(1320, 0.6, 0.1), 90);
      if (show.mine && !K.lightsOn() && K.canEdit()) K.lightUp(); // 꺼져 있던 전구를 켠다 (방의 상태라 모두에게 간다)
      if (K.hasMusic()) K.song('jingle');
      snow(16);
    }
    // 트리 둘레 빛: 확 밝아졌다가 천천히 원래대로. 방: 어두운 채로 있다가 천천히 돌아온다
    const u = t - L.at, tree = 1 + (L.glowTo - 1) * Math.min(1, u / 0.25) * (1 - ease((u - 0.4) / (L.end - L.at - 0.6)));
    const room = L.dark + (1 - L.dark) * ease((t - L.backFrom) / (L.end - 0.2 - L.backFrom));
    K.bright(room, tree);
    if (t - snowAt > 0.45 && t < L.end - 2) { snowAt = t; snow(5); }
    if (t > L.at + 1.6 && count.textContent) clearBig();
    if (t >= L.end) end();
  }
  function stepPhoto(t) {
    if (t < PHOTO.at) {
      const n = 3 - Math.floor(t);
      if (n !== show.n) { show.n = n; big(String(n), 'num small'); tick(660, 0.1, 0.09); }
      return;
    }
    // 찰칵: 이번 그림이 그려진 직후에 찍는다
    clearBig();
    want = true;
    shutter();
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    show = null;
  }

  /* ───────── 사진 ───────── */
  const pad2 = (n) => String(n).padStart(2, '0');
  // 그려진 3D 화면(캔버스)을 폴라로이드에 담는다
  function develop(src) {
    const MAXW = 1200, s = Math.min(1, MAXW / src.width), w = Math.round(src.width * s), h = Math.round(src.height * s);
    const pad = Math.round(w * 0.05), foot = Math.round(w * 0.19);
    const c = document.createElement('canvas');
    c.width = w + pad * 2; c.height = h + pad + foot;
    const g = c.getContext('2d');
    g.fillStyle = '#FFFDF7'; g.fillRect(0, 0, c.width, c.height);
    // 3D 화면은 뒤가 비쳐서(투명) 페이지 배경과 같은 밤하늘 색을 먼저 깐다
    const bg = g.createRadialGradient(pad + w / 2, pad + h * 0.42, 0, pad + w / 2, pad + h * 0.42, Math.max(w, h) * 0.75);
    bg.addColorStop(0, '#4A3B5C'); bg.addColorStop(0.55, '#33294A'); bg.addColorStop(1, '#211A30');
    g.fillStyle = bg; g.fillRect(pad, pad, w, h);
    g.drawImage(src, pad, pad, w, h);
    g.strokeStyle = 'rgba(43,29,20,.12)'; g.lineWidth = Math.max(1, w / 600); g.strokeRect(pad, pad, w, h);
    const d = new Date(), date = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
    const font = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
    g.fillStyle = '#5A3824'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${Math.round(foot * 0.24)}px ${font}`;
    g.fillText('놀자방 · 트리 같이 꾸미기', c.width / 2, pad + h + foot * 0.42);
    g.fillStyle = '#8A7868'; g.font = `600 ${Math.round(foot * 0.16)}px ${font}`;
    g.fillText(date, c.width / 2, pad + h + foot * 0.72);
    return { c, name: `nolja-tree-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}.jpg` };
  }
  function preview(c, name) {
    closePhoto();
    const img = $('photoImg');
    img.src = c.toDataURL('image/jpeg', 0.9); // 바로 보이게 (파일은 아래에서 따로 만든다)
    photo = { blob: null, url: null, name, w: c.width, h: c.height };
    const mine = photo;
    c.toBlob((b) => {
      if (photo !== mine || !b) return;
      photo.blob = b; photo.url = URL.createObjectURL(b);
      paintShare();
    }, 'image/jpeg', 0.92);
    paintShare();
    $('photoP').hidden = false;
  }
  function file() { return photo && photo.blob ? new File([photo.blob], photo.name, { type: 'image/jpeg' }) : null; }
  function canShareFile() {
    const f = file();
    try { return !!(f && navigator.share && navigator.canShare && navigator.canShare({ files: [f] })); } catch (_) { return false; }
  }
  function paintShare() { $('photoShare').hidden = !canShareFile(); }
  function save() {
    if (!photo) return;
    const a = document.createElement('a');
    a.href = photo.url || $('photoImg').src; a.download = photo.name;
    document.body.appendChild(a); a.click(); a.remove();
    K.toast('사진을 저장했어요');
  }
  async function share() {
    const f = file();
    if (!f) return;
    try { await navigator.share({ files: [f], title: '트리 같이 꾸미기', text: '우리 트리 🎄' }); }
    catch (e) { if (!e || e.name !== 'AbortError') K.toast('공유하지 못했어요. 저장해서 보내 주세요'); }
  }
  function closePhoto() {
    if (photo && photo.url) URL.revokeObjectURL(photo.url);
    photo = null;
    $('photoP').hidden = true;
    $('photoImg').removeAttribute('src');
  }

  $('lightShow').addEventListener('click', () => begin('light', true));
  $('snap').addEventListener('click', () => begin('photo', true));
  $('photoSave').addEventListener('click', save);
  $('photoShare').addEventListener('click', share);
  $('photoClose').addEventListener('click', closePhoto);
  flash.addEventListener('animationend', () => flash.classList.remove('on'));

  return {
    get on() { return show ? show.v : null; },
    // 그리기 전에: 장면을 한 걸음 진행한다
    tick() {
      if (!show) return;
      const t = now() - show.t0;
      if (show.v === 'light') stepLight(t); else stepPhoto(t);
    },
    // 그린 직후에 (같은 그림 안에서): 찍기로 했으면 캔버스를 옮겨 담는다
    shot() {
      if (!want) return;
      want = false;
      try { const { c, name } = develop(K.canvas); preview(c, name); }
      catch (_) { K.toast('사진을 찍지 못했어요'); }
    },
    // 친구가 시작한 장면. 받을 만한 소식이면 true (방장이 다른 사람들에게 전해 준다)
    peerFx(m, id) {
      if (!SHOWS.includes(m.v)) return false;
      if (m.v === 'light' && !K.mayLead(id)) return false; // 구경하는 사람은 점등식을 시작할 수 없다
      begin(m.v, false);
      return true;
    },
    // 자동 검사가 쓰는 창구
    test: {
      get show() { return show ? { v: show.v, t: now() - show.t0, lit: show.lit, n: show.n } : null; },
      get photo() { return photo ? { name: photo.name, w: photo.w, h: photo.h, ready: !!photo.blob, open: !$('photoP').hidden } : null; },
      begin: (v) => begin(v, true), end, closePhoto,
      // 미리보기 사진의 한 점 색 (사진 안 비율 x, y)
      async pixel(x, y) {
        const img = $('photoImg');
        if (!img.src) return null;
        if (!img.complete) await new Promise((r) => { img.onload = r; });
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        return [...g.getImageData(Math.floor(x * (c.width - 1)), Math.floor(y * (c.height - 1)), 1, 1).data.slice(0, 3)];
      },
      // 사진 안 장면 부분이 한 가지 색이 아닌지 (빈 화면이 찍히지 않았는지)
      async varied() {
        const img = $('photoImg');
        if (!img.src) return 0;
        if (!img.complete) await new Promise((r) => { img.onload = r; });
        const c = document.createElement('canvas'); c.width = 120; c.height = Math.round(120 * img.naturalHeight / img.naturalWidth);
        const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
        const d = g.getImageData(8, 8, c.width - 16, Math.round(c.height * 0.7)).data, seen = new Set();
        for (let i = 0; i < d.length; i += 4) seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4));
        return seen.size;
      },
    },
  };
}
