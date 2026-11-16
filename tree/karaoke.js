// 노래방: 노래방 기계(화면·마이크·노래 책), 스피커, 미러볼. 가구 탭에서 누구나 어느 층에든 놓는다 (catalog.js 의 set: 'sing').
//   노래 부르기: 기계 앞에서 노래를 고르면 화면에 가사와 음 막대가 흐른다. 막대가 기준선에 닿을 때 🎤 단추(화면·스페이스바)를 누르면
//   그 음으로 "라~" 하고 내 목소리가 난다. 끝나면 노래방답게 점수가 나오고, 점수는 이 방 기록·이름별 순위에 남는다(BEST.sing).
//   노래는 오르골과 같은 오래된 캐럴(catalog.js 의 SONGS)이고, 가사는 음 수에 맞춰 직접 지은 글이다(남의 번안 가사를 쓰지 않는다).
//   소리는 파일 없이 WebAudio 로 그 자리에서 만든다. 방의 상태로는 점수(score·best)만 남는다.
//   친구에게는 놀이 소식 { k: 'sing', v }: 's:노래:기계id' 부르기 시작(같은 층의 친구에게 반주가 들린다) · 'e:점수' 끝 · 'x' 그만둠
import { THREE, M, E, put, cbox, cyl, ball, pool } from './kit.js';
import { addShape } from './furniture.js';
import { SONGS } from './catalog.js';
import { sfx } from './sfx.js';
import { mark } from './quest.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 노래방 빠르기(1분의 박 수)와 가사. 가사의 글자(띄어쓰기 빼고) 하나가 음 하나다
export const KARA = {
  jingle: { bpm: 150, lines: ['징글벨 징글벨 종이 울려요', '우리 함께 노래 부르면 온 세상이 반짝', '징글벨 징글벨 눈이 내려요', '오늘 밤은 트리 곁에서 다 같이 웃자'] },
  wish: { bpm: 126, lines: ['즐거운 크리스마스', '행복한 크리스마스', '따뜻한 크리스마스', '새해에도 함께'] },
  silent: { bpm: 92, lines: ['눈 내린 밤 포근한 밤', '별빛이 내려와', '작은 트리 불 반짝이고', '우리 모여서 노래하네', '꿈결 같은 이 밤에', '포근히 잠들어요'] },
};
const JUDGE = [[0.085, 100, 'PERFECT'], [0.16, 75, 'GOOD'], [0.25, 45, 'OK']]; // [늦거나 빠른 정도(초), 점수, 말]
const LEAD = 2.4; // 시작 전 셋·둘·하나
// 노래 하나의 흐름: 음마다 { t(시작, 초), d(길이), m(음 높이), line(몇째 줄), k(그 줄의 몇째 글자) }, 줄마다 글자들
export function chart(id) {
  const s = SONGS.find((x) => x.id === id), kr = KARA[id];
  if (!s || !kr) return null;
  const beat = 60 / kr.bpm, notes = [], lines = kr.lines.map((l) => [...l.replace(/\s/g, '')]);
  let t = 0, line = 0, k = 0;
  for (const [m, b] of s.notes) {
    if (m) { notes.push({ t, d: b * beat, m, line, k }); if (++k >= (lines[line] || []).length) { line++; k = 0; } }
    t += b * beat;
  }
  const ms = notes.map((n) => n.m);
  return { id, name: s.name, notes, lines, text: kr.lines, end: t + 0.9, lo: Math.min(...ms), hi: Math.max(...ms) };
}

/* ───────── 화면: 기계의 화면과 놀이 판이 같은 그림을 쓴다 ───────── */
const W = 600, H = 300;
const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
const cx = cv.getContext('2d');
const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
const SCREEN = new THREE.MeshBasicMaterial({ map: tex });
const FONT = '"Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif';
function backdrop(t) {
  const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2A1B5C'); g.addColorStop(1, '#120C2E');
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  for (let k = 0; k < 14; k++) { // 천천히 흐르는 불빛
    const x = (k * 97 + t * 14 * (1 + (k % 3))) % (W + 40) - 20, y = 20 + (k * 53) % (H - 40);
    cx.fillStyle = ['#FF5FAE', '#55D6FF', '#FFD84F', '#9B7BFF'][k % 4]; cx.globalAlpha = 0.16; cx.beginPath(); cx.arc(x, y, 5 + (k % 4) * 3, 0, TAU); cx.fill();
  }
  cx.globalAlpha = 1;
}
function idle(t, text) { // 쉬는 화면
  backdrop(t);
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillStyle = '#FFD84F'; cx.font = `900 64px ${FONT}`; cx.fillText('🎤 노래방', W / 2, 118);
  cx.fillStyle = '#FFFFFF'; cx.font = `bold 30px ${FONT}`; cx.fillText(text || '노래를 골라 주세요', W / 2, 196, W - 40);
  tex.needsUpdate = true;
}
idle(0);

/* ───────── 모양 ───────── */
const BODY = 0x23203F, TRIM = 0xFF5FAE, DARK = 0x14122B;
addShape('karaoke', (g) => { // 2 × 1: 화면이 달린 노래방 기계. 양옆에 마이크, 위에 노래 책과 리모컨
  put(cbox(0.94, 0.72, 0.42, 0.03), BODY, 0, 0.36, -0.02, g);
  put(new THREE.BoxGeometry(0.96, 0.03, 0.44), TRIM, 0, 0.735, -0.02, g, false);
  for (const sx of [-1, 1]) { // 앞면의 스피커
    put(cyl(0.13, 0.13, 0.02, 16), DARK, 0.26 * sx, 0.36, 0.192, g, false).rotation.x = Math.PI / 2;
    put(new THREE.TorusGeometry(0.13, 0.012, 5, 16), 0x8E94A8, 0.26 * sx, 0.36, 0.2, g, false);
    put(cyl(0.05, 0.05, 0.03, 12), 0x3A3F5A, 0.26 * sx, 0.36, 0.2, g, false).rotation.x = Math.PI / 2;
  }
  put(new THREE.BoxGeometry(0.16, 0.2, 0.01), DARK, 0, 0.4, 0.194, g, false);                // 동전·번호 판
  for (let k = 0; k < 6; k++) put(new THREE.BoxGeometry(0.03, 0.03, 0.01), E([0xFF5FAE, 0x55D6FF, 0xFFD84F][k % 3], 0.6), -0.04 + (k % 3) * 0.04, 0.44 - Math.floor(k / 3) * 0.05, 0.2, g, false);
  put(cbox(0.76, 0.46, 0.1, 0.02), DARK, 0, 1.03, -0.12, g);                                   // 화면 틀
  put(new THREE.PlaneGeometry(0.68, 0.34), SCREEN, 0, 1.04, -0.066, g, false).receiveShadow = false;
  put(new THREE.BoxGeometry(0.7, 0.012, 0.02), E(TRIM, 0.8), 0, 0.835, -0.07, g, false);
  put(cyl(0.03, 0.05, 0.08, 8), DARK, 0, 0.78, -0.12, g, false);
  for (const [sx, col] of [[-1, 0x55D6FF], [1, 0xFF5FAE]]) { // 마이크 걸이와 마이크
    put(new THREE.BoxGeometry(0.05, 0.03, 0.08), 0x8E94A8, 0.45 * sx, 0.62, 0.1, g, false);
    const m = new THREE.Group(); m.position.set(0.45 * sx, 0.66, 0.13); m.rotation.z = -0.25 * sx; g.add(m);
    put(cyl(0.016, 0.013, 0.17, 8), 0x2B2D3A, 0, 0.0, 0, m, false); put(ball(0.03, 10, 8), 0xC9CED3, 0, 0.1, 0, m, false); put(cyl(0.018, 0.018, 0.012, 8), col, 0, 0.075, 0, m, false);
  }
  put(new THREE.BoxGeometry(0.2, 0.03, 0.15), 0xFFD84F, -0.24, 0.765, 0.08, g, false).rotation.y = 0.2; // 노래 책
  put(new THREE.BoxGeometry(0.17, 0.004, 0.12), 0xFFFAF2, -0.24, 0.782, 0.08, g, false).rotation.y = 0.2;
  put(cbox(0.06, 0.02, 0.15, 0.008), 0x2B2D3A, 0.22, 0.76, 0.09, g, false).rotation.y = -0.3;  // 리모컨
  pool(g, 0, 0.02, 1.3, 0.8);
  pool(g, 0, 0.5, 1.0, 0.6, { hex: 0xFF5FAE, op: 0.14, add: true });
});
addShape('speaker', (g) => { // 1 × 1: 키 큰 스피커
  put(cbox(0.4, 1.1, 0.36, 0.03), BODY, 0, 0.59, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(cyl(0.03, 0.03, 0.04, 6), DARK, 0.15 * sx, 0.02, 0.13 * sz, g, false);
  for (const [y, r] of [[0.4, 0.14], [0.78, 0.1], [1.02, 0.045]]) {
    put(cyl(r, r, 0.02, 16), DARK, 0, y, 0.176, g, false).rotation.x = Math.PI / 2;
    put(new THREE.TorusGeometry(r, 0.012, 5, 16), 0x8E94A8, 0, y, 0.186, g, false);
    put(cyl(r * 0.4, r * 0.4, 0.03, 10), 0x3A3F5A, 0, y, 0.186, g, false).rotation.x = Math.PI / 2;
  }
  put(new THREE.BoxGeometry(0.42, 0.02, 0.38), TRIM, 0, 1.15, 0, g, false);
  pool(g, 0, 0, 0.6, 0.6);
});
const SPOT_COLS = [0xFF5FAE, 0x55D6FF, 0xFFD84F, 0x9B7BFF, 0x7CFF9A];
const spotMats = SPOT_COLS.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending }));
const spotGeo = (() => { const c = new THREE.CircleGeometry(0.11, 10); c.rotateX(-Math.PI / 2); return c; })();
addShape('mirrorball', (g) => { // 1 × 1, 밟고 지나간다: 천장에 매달려 도는 미러볼과 바닥을 도는 색 불빛
  put(cyl(0.012, 0.012, 0.34, 5), 0x8E94A8, 0, 2.5, 0, g, false);
  put(cyl(0.07, 0.07, 0.03, 10), 0x3A3F5A, 0, 2.67, 0, g, false);
  const b = new THREE.Group(); b.userData.own = true; b.position.y = 2.16; g.add(b);
  put(new THREE.IcosahedronGeometry(0.21, 2), M(0xE4E8F2, true), 0, 0, 0, b);
  for (let k = 0; k < 18; k++) { const a = k * 2.4, y = -0.17 + (k / 17) * 0.34, r = Math.sqrt(Math.max(0, 0.045 - y * y)); put(new THREE.BoxGeometry(0.035, 0.035, 0.004), E(0xFFFFFF, 0.9), Math.cos(a) * r, y, Math.sin(a) * r, b, false).lookAt(Math.cos(a) * 2, y * 9 + 2.16, Math.sin(a) * 2); } // 반짝이는 거울 조각
  const spots = new THREE.Group(); spots.position.y = 0.035; g.add(spots);
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, r = 0.55 + (k % 3) * 0.42, m = new THREE.Mesh(spotGeo, spotMats[k % 5]); m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); m.raycast = () => {}; m.renderOrder = 3; spots.add(m); }
  g.userData.live = (t) => { b.rotation.y = t * 0.7; spots.rotation.y = -t * 0.45; };
});

// K (app.js 가 준다): play, S(), itemObj(id), me, avatar(pid), nameOf(id), level(), levelOfCell(i), act(id), fx(m), online(), toast, close(), mode(),
//   setPose(p), record(k, v), bestLine(k), rank(k), measure(), dirty()
export function makeKaraoke(K) {
  const $ = (id) => document.getElementById(id);
  const portrait = () => window.innerWidth < window.innerHeight;
  const v3 = new THREE.Vector3();
  const world = (g, x, y, z) => { g.updateMatrixWorld(); const p = g.localToWorld(v3.set(x, y, z)); return [p.x, p.y, p.z]; };
  const quit = { label: '그만하기', id: 'playQuit', fn: () => K.close() };
  let cur = null, clock = 0, drawn = 0;

  // 놀이 판에 보이는 화면 (기계 화면과 같은 그림)
  cv.id = 'singCv'; cv.hidden = true; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', '노래방 화면: 가사와 음 막대');
  cv.style.cssText = `display:block;width:100%;max-width:340px;aspect-ratio:${W}/${H};margin:0 auto 4px;border-radius:12px;border:3px solid #FF5FAE;background:#120C2E;touch-action:none;flex:none`;
  $('playBtns').parentNode.insertBefore(cv, $('playBtns'));
  cv.addEventListener('pointerdown', (e) => { if (cur && cur.phase === 'run') { sing.hit(cur); e.preventDefault(); } });
  window.addEventListener('keydown', (e) => { if (cur && cur.phase === 'run' && (e.key === ' ' || e.code === 'Space') && !e.repeat) { sing.hit(cur); e.preventDefault(); e.stopPropagation(); } }, true);

  /* ───────── 손에 든 마이크 ───────── */
  // 노래하는 사람(나는 'me', 친구는 그 사람 id)의 팔에 마이크를 붙이고, 팔을 입 앞으로 든다. 왼손에 먹을 것을 들고 있어도 되게 오른팔에 든다
  const mics = new Map();
  const avatarOf = (who) => (who === 'me' ? K.me : K.avatar(who));
  function micOn(who) {
    if (mics.has(who)) return;
    const m = new THREE.Group();
    put(cyl(0.017, 0.013, 0.15, 8), 0x2B2D3A, 0, 0, 0, m, false); put(ball(0.032, 10, 8), 0xC9CED3, 0, 0.095, 0, m, false); put(cyl(0.019, 0.019, 0.012, 8), 0xFF5FAE, 0, 0.068, 0, m, false);
    mics.set(who, { m, arm: null }); K.dirty();
  }
  function micOff(who) { const x = mics.get(who); if (!x) return; if (x.m.parent) x.m.parent.remove(x.m); mics.delete(who); K.dirty(); }
  function tickMics() {
    for (const [who, x] of mics) {
      const a = avatarOf(who);
      if (!a || !a.parts) { micOff(who); continue; }
      const arm = a.parts.arms[1];
      if (x.m.parent !== arm) { arm.add(x.m); x.m.position.set(-0.012, -0.275, 0.03); x.m.rotation.set(-1.25, 0, 0.1); x.m.scale.setScalar(1.7); } // 생김새를 바꿔 몸을 새로 만들었으면 새 팔에 다시 붙인다
      x.m.visible = !(a.rest && !a.rest.sit);
      if (!a.hop && !a.hold && !a.push && (!a.rest || a.rest.sit)) { arm.rotation.x = -2.05 + 0.05 * Math.sin(clock * 3); arm.rotation.z = -0.55; } // 마이크를 입 앞으로
      K.dirty();
    }
  }

  /* ───────── 소리 ───────── */
  let ac = null;
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function audio() {
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume().catch(() => {}); } catch (_) { ac = null; }
    return ac;
  }
  // 반주: 음마다 은은한 종소리, 박마다 낮은 "둥". 한 번에 모두 예약하고, 돌려준 bus 를 끊으면 멈춘다
  function backing(ch, vol, lead) {
    if (!audio()) return null;
    const bus = ac.createGain(); bus.gain.value = vol; bus.connect(ac.destination);
    const t0 = ac.currentTime + lead + 0.05;
    const ping = (f, when, len, v, type = 'sine') => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(v, when + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, when + len);
      o.connect(g); g.connect(bus); o.start(when); o.stop(when + len + 0.05);
    };
    for (let k = 0; k < 3; k++) if (lead > 0) ping(k < 2 ? 660 : 880, t0 - lead + k * (lead / 3), 0.16, 0.2, 'triangle'); // 셋, 둘, 하나
    for (const n of ch.notes) { ping(freq(n.m), t0 + n.t, Math.max(0.35, n.d * 1.3), 0.16); ping(freq(n.m) * 2, t0 + n.t, 0.25, 0.04); }
    const beat = 60 / KARA[ch.id].bpm;
    for (let t = 0, k = 0; t < ch.end - 0.9; t += beat, k++) ping(k % 2 ? 98 : 65.4, t0 + t, 0.22, 0.2, 'triangle');
    return { bus, t0 };
  }
  const hush = (b) => { if (b && ac) { try { b.bus.gain.setTargetAtTime(0, ac.currentTime, 0.04); setTimeout(() => { try { b.bus.disconnect(); } catch (_) { /* 이미 끊겼다 */ } }, 400); } catch (_) { /* 소리 장치가 닫혔다 */ } } };
  function voice(m, len, off = 0) { // 내 목소리 "라~": 살짝 떨리는 음
    if (!audio()) return;
    const o = ac.createOscillator(), o2 = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain(), f = ac.createBiquadFilter(), t = ac.currentTime;
    const hz = freq(m) * Math.pow(2, off / 12);
    o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = hz; o2.frequency.value = hz * 2; lfo.frequency.value = 5.5; lg.gain.value = hz * 0.012;
    lfo.connect(lg); lg.connect(o.frequency); f.type = 'lowpass'; f.frequency.value = 1500; f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.03); g.gain.setValueAtTime(0.2, t + Math.max(0.05, len - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.12);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(ac.destination);
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + len + 0.2); }
  }

  /* ───────── 화면 그리기 ───────── */
  function draw(c) {
    const ch = c.ch, t = c.t;
    backdrop(clock);
    cx.textBaseline = 'middle';
    cx.textAlign = 'left'; cx.fillStyle = '#FFD84F'; cx.font = `bold 20px ${FONT}`; cx.fillText('♪ ' + ch.name, 14, 20);
    cx.textAlign = 'right'; cx.fillStyle = '#FFFFFF'; cx.fillText(`${c.hits}/${ch.notes.length}`, W - 14, 20);
    // 가사: 지금 줄(부른 글자는 색이 찬다)과 다음 줄
    const at = ch.notes.findIndex((n) => n.t + n.d > t), now = at < 0 ? ch.notes.length - 1 : at, n0 = ch.notes[now], li = n0 ? n0.line : 0;
    const sung = (line, k) => { const n = ch.notes.find((x) => x.line === line && x.k === k); return !!n && n.t <= t; };
    const row = (line, y, size, dim) => {
      const text = ch.text[line]; if (!text) return;
      cx.font = `900 ${size}px ${FONT}`; cx.textAlign = 'left';
      const full = cx.measureText(text).width, sc = Math.min(1, (W - 30) / full);
      let x = (W - full * sc) / 2, k = 0;
      for (const chr of text) {
        const w = cx.measureText(chr).width * sc;
        if (chr !== ' ') { cx.fillStyle = dim ? 'rgba(255,255,255,.45)' : sung(line, k) ? '#FF7FBF' : '#FFFFFF'; cx.save(); cx.translate(x, y); cx.scale(sc, 1); cx.fillText(chr, 0, 0); cx.restore(); k++; }
        x += w;
      }
    };
    row(li, 66, 38, false); row(li + 1, 108, 24, true);
    // 음 막대: 기준선에 닿을 때 누른다
    const X0 = 140, PX = 170, Y0 = 150, Y1 = 276, span = Math.max(1, ch.hi - ch.lo);
    cx.fillStyle = 'rgba(255,255,255,.07)'; cx.fillRect(0, Y0 - 8, W, Y1 - Y0 + 16);
    for (const n of ch.notes) {
      const x = X0 + (n.t - t) * PX, w = Math.max(10, n.d * PX - 5);
      if (x > W || x + w < 0) continue;
      const y = Y1 - 14 - ((n.m - ch.lo) / span) * (Y1 - Y0 - 28);
      cx.fillStyle = n.pts >= 100 ? '#FFD84F' : n.pts > 0 ? '#7CFF9A' : n.t + JUDGE[2][0] < t ? 'rgba(255,255,255,.22)' : '#8FD3FF';
      cx.beginPath(); cx.roundRect(x, y - 7, w, 14, 7); cx.fill();
    }
    cx.fillStyle = '#FF5FAE'; cx.fillRect(X0 - 2, Y0 - 8, 4, Y1 - Y0 + 16);
    if (c.flash > 0) { cx.globalAlpha = Math.min(1, c.flash * 2.5); cx.textAlign = 'left'; cx.fillStyle = c.say === 'PERFECT' ? '#FFD84F' : c.say === '삑!' ? '#FF7A6B' : '#7CFF9A'; cx.font = `900 24px ${FONT}`; cx.fillText(c.say, X0 + 12, Y0 + 6); cx.globalAlpha = 1; }
    if (t < 0) { cx.textAlign = 'center'; cx.fillStyle = '#FFFFFF'; cx.font = `900 96px ${FONT}`; cx.fillText(String(Math.max(1, Math.ceil(-t / (LEAD / 3)))), W / 2, 205); }
    tex.needsUpdate = true;
  }

  /* ───────── 노래 부르기 ───────── */
  const say = (s) => (s >= 95 ? '가수의 실력이시네요! 🎉' : s >= 80 ? '훌륭해요! 앙코르~ 👏' : s >= 60 ? '조금만 더 연습하면 가수예요 🎶' : s >= 1 ? '즐겁게 불렀으면 100점이죠 😊' : '막대가 분홍 선에 닿을 때 🎤 를 눌러 봐요');
  const tell = (v) => { if (K.online()) K.fx({ k: 'sing', v }); };
  const sing = {
    start(c) {
      cur = c; c.phase = 'pick'; c.ch = null; c.bk = null;
      K.play.song(null); // 오르골이 나오고 있으면 끈다 (나에게만)
      const d = portrait() ? 2.5 : 2.0;
      K.setPose({ pos: world(c.g, 0, 1.25, d), at: world(c.g, 0, 0.95, 0), fov: portrait() ? 50 : 36 });
      idle(clock); sing.paint(c);
    },
    paint(c) {
      cv.hidden = c.phase === 'pick';
      const best = K.bestLine ? K.bestLine('sing') : '';
      if (c.phase === 'pick') K.play.panel('🎤 노래방', '부를 노래를 골라요. 막대가 분홍 선에 닿을 때 🎤 를 누르면 그 음으로 노래해요.' + (best ? ' · ' + best : ''), [
        ...SONGS.filter((s) => KARA[s.id]).map((s) => ({ label: s.name, chip: true, id: 'sing-' + s.id, fn: () => sing.begin(c, s.id) })), { label: '🏆 순위', id: 'playRank', fn: () => K.rank('sing') }, quit]);
      else if (c.phase === 'run') K.play.panel(`🎤 ${c.ch.name}`, matchMedia('(pointer: fine)').matches ? '막대가 분홍 선에 닿을 때 단추나 스페이스바를 눌러요.' : '막대가 분홍 선에 닿을 때 단추나 화면을 눌러요.', [{ label: '🎤 라~', main: true, id: 'playGo', fn: () => sing.hit(c) }, quit]);
      else K.play.panel(`🎤 ${c.score}점!`, say(c.score) + (best ? ' · ' + best : ''), [{ label: '다시 부르기', main: true, id: 'playGo', fn: () => sing.begin(c, c.ch.id) }, { label: '다른 노래', id: 'playAgain', fn: () => { c.phase = 'pick'; idle(clock); sing.paint(c); } }, { label: '🏆 순위', id: 'playRank', fn: () => K.rank('sing') }, quit]);
      K.measure();
    },
    begin(c, id) {
      const ch = chart(id); if (!ch) return;
      for (const n of ch.notes) n.pts = 0;
      hush(c.bk);
      c.ch = ch; c.phase = 'run'; c.t = -LEAD; c.hits = 0; c.sum = 0; c.flash = 0; c.say = ''; c.score = 0;
      c.bk = backing(ch, 0.55, LEAD);
      micOn('me');
      tell(`s:${id}:${c.id}`);
      sing.paint(c); draw(c);
    },
    hit(c) {
      if (c.phase !== 'run') return;
      let best = null, bd = 9;
      for (const n of c.ch.notes) { const d = Math.abs(n.t - c.t); if (!n.pts && d < bd) { bd = d; best = n; } }
      const j = best && JUDGE.find(([w]) => bd <= w);
      if (!j) { c.say = '삑!'; c.flash = 0.5; sfx('squeak'); return; } // 음이 없는 곳에서 눌렀다
      best.pts = j[1]; c.hits++; c.sum += j[1]; c.say = j[2]; c.flash = 0.6;
      voice(best.m, clamp(best.d, 0.18, 0.9), j[1] >= 75 ? 0 : (bd > 0 ? 0.5 : -0.5) * (Math.random() < 0.5 ? 1 : 0.6)); // 박자가 어긋나면 음도 조금 흔들린다
    },
    finish(c) {
      const N = c.ch.notes.length;
      c.score = c.hits ? Math.round(30 + 70 * (c.sum / (N * 100))) : 0;
      c.phase = 'done'; hush(c.bk); c.bk = null;
      if (c.score > 0) { sfx('hooray'); K.act('cheer'); if (K.record) K.record('sing', c.score); if (c.score >= 85) mark('songs', c.ch.id); }
      tell('e:' + c.score);
      idle(clock, `${c.score}점!`); sing.paint(c);
      K.toast(`🎤 ${c.ch.name} ${c.score}점! ${say(c.score)}`);
    },
    tick(c, dt) {
      if (c.phase !== 'run') return;
      c.t = c.bk && ac && ac.state === 'running' ? ac.currentTime - c.bk.t0 : c.t + dt; // 소리가 나면 소리의 시계를 따른다
      c.flash = Math.max(0, c.flash - dt);
      draw(c);
      if (c.t >= c.ch.end) sing.finish(c);
    },
    tap() {},
    stop(c) {
      if (c.phase === 'run') tell('x');
      hush(c.bk); c.bk = null; cv.hidden = true; cur = null;
      micOff('me');
      idle(clock);
    },
  };
  K.play.add('sing', sing);

  /* ───────── 친구가 부르는 노래 ───────── */
  const singers = new Map(); // 부르는 친구 → { ch, bk, end }
  const ID_RE = /^[\w-]{1,24}$/;
  function drop(who) { const s = singers.get(who); if (s) { hush(s.bk); singers.delete(who); micOff(who); } if (!cur && !singers.size) idle(clock); }
  function peerFx(m, who) {
    const v = m && m.v;
    if (typeof v !== 'string' || v.length > 48 || !K.avatar(who)) return false;
    const [t, a, b, more] = v.split(':'), name = K.nameOf(who) || '친구';
    if (t === 'x' && a === undefined) { drop(who); return true; }
    if (t === 'e' && /^\d{1,3}$/.test(a || '') && b === undefined && Number(a) <= 100) {
      const s = singers.get(who); drop(who);
      K.toast(`🎤 ${name}님이 ${s ? s.ch.name + '에서 ' : '노래방에서 '}${Number(a)}점을 받았어요!`);
      if (Number(a) > 0) sfx('hooray', K.avatar(who), 0.6);
      return true;
    }
    if (t !== 's' || more !== undefined || !ID_RE.test(b || '')) return false;
    const ch = chart(a), it = K.S().items.get(b);
    if (!ch || !it || it.k !== 'karaoke') return false;
    drop(who);
    const near = K.levelOfCell(it.i) === K.level() && !cur; // 같은 층에 있으면 반주가 들린다 (내가 부르는 중이면 내 노래만)
    singers.set(who, { ch, bk: near ? backing(ch, 0.3, LEAD) : null, end: clock + LEAD + ch.end + 2 });
    micOn(who);
    K.toast(`🎤 ${name}님이 노래를 불러요 · ${ch.name}`);
    if (!cur) idle(clock, `♪ ${name} · ${ch.name}`);
    return true;
  }

  return {
    peerFx,
    tick(dt) {
      clock += dt;
      for (const [who, s] of singers) if (clock > s.end || !K.avatar(who)) drop(who);
      tickMics();
      if (!cur && clock - drawn > 0.25) { drawn = clock; const s = [...singers.values()][0]; idle(clock, s ? `♪ ${s.ch.name}` : ''); } // 쉬는 화면의 불빛이 흐른다
    },
    test: {
      KARA, chart, JUDGE, LEAD,
      get state() { return cur ? { phase: cur.phase, song: cur.ch ? cur.ch.id : null, t: cur.t, hits: cur.hits, sum: cur.sum, score: cur.score, say: cur.say, notes: cur.ch ? cur.ch.notes.length : 0, audio: ac ? ac.state : null, backing: !!cur.bk, shown: !cv.hidden } : null; },
      get mics() { return [...mics].map(([who, x]) => ({ who, held: !!x.m.parent, armX: (who === 'me' ? K.me : K.avatar(who)).parts.arms[1].rotation.x })); },
      get singers() { return [...singers].map(([who, s]) => ({ who, song: s.ch.id, heard: !!s.bk })); },
      // 검사: 시간을 옮긴다(소리의 시계 대신), 지금 눌러야 할 음까지의 시간
      seek(t) { if (cur && cur.phase === 'run') { if (cur.bk) { hush(cur.bk); cur.bk = null; } cur.t = t; } },
      next() { if (!cur || cur.phase !== 'run') return null; const n = cur.ch.notes.find((x) => !x.pts && x.t >= cur.t - 0.05); return n ? n.t - cur.t : null; },
      hit() { if (cur) sing.hit(cur); },
      pixel(x, y) { const d = cx.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; },
    },
  };
}
