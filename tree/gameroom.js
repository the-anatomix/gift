// 4층 게임방: 오락기(별 받기), 인형뽑기, 당구대, 빈백, 토끼 인형.
//   가구 모양(addShape)과 놀이(play.js 의 play.add) 두 가지를 여기서 더한다. 4층의 벽·바닥(짙은 남보라, 바둑판 카펫)은 room.js 가 늘 그렇게 짓는다.
//   가구 탭의 목록에 모두 나와서 누구나 어느 층에든 직접 놓을 수 있고(catalog.js 의 set: 'game'),
//   "🎮 4층을 게임방으로 꾸미기"(마스터 판)는 4층의 가구를 치우고 GAMEROOM 배치를 한 번에 놓는다. 권한은 영화관과 같은 것(master.js 의 CINE)을 쓴다.
//   오락기: 판 위에 뜨는 작은 화면(2D 그림)에서 40초 동안 떨어지는 별을 바구니로 받는다. 점수는 이 방 기록·이름별 순위에 남는다(BEST.arcade).
//   인형뽑기: 좌우로 오가는 집게를 인형 위에서 내린다(한 판에 세 번). 뽑으면 토끼 인형 하나가 내 옆에 놓인다(꾸밀 수 있는 사람만, 방에 열두 개까지).
//   놀이는 하는 사람 화면의 일이다. 방 상태로는 점수(score·best)와 뽑은 인형(put)만 남는다.
//   토끼 인형은 직접 지은 모양이다(늘어진 목도리, 세모 코와 웃는 입, 볼 터치). 남의 캐릭터를 따라 그리지 않는다.
import { THREE, L, put, cbox, rbox, cyl, ball, cap } from './kit.js';
import { addShape } from './furniture.js';
import { GAMEROOM, MAX_ITEMS } from './catalog.js';
import { FLOOR_DI } from './path.js';
import { sfx } from './sfx.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GAME_LV = 3; // 4층

/* ───────── 토끼 인형 ───────── */
const FUR = 0xFFFDF8, PINK = 0xF4A9B8, INK = 0x3B2A22;
// s = 크기 배수, col = 목도리 색, col2 = 옷(멜빵바지) 색
function bunny(g, s, col, col2, x = 0, z = 0, ry = 0) {
  const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; b.scale.setScalar(s); g.add(b);
  put(ball(0.105, 14, 10), FUR, 0, 0.125, 0, b).scale.set(1, 1.12, 0.92);                         // 몸
  put(cyl(0.098, 0.112, 0.1, 14), col2, 0, 0.085, 0, b, false).scale.set(1, 1, 0.94);             // 멜빵바지
  for (const sx of [-1, 1]) {
    put(new THREE.BoxGeometry(0.022, 0.1, 0.012), col2, sx * 0.045, 0.175, 0.093, b, false).rotation.x = -0.22; // 멜빵
    put(ball(0.012, 6, 5), 0xFFD166, sx * 0.045, 0.14, 0.104, b, false);                            // 단추
    put(ball(0.036, 8, 6), FUR, sx * 0.112, 0.165, 0.02, b, false).scale.set(0.9, 1.25, 0.9);       // 팔
    put(ball(0.046, 8, 6), FUR, sx * 0.056, 0.028, 0.07, b, false).scale.set(1, 0.6, 1.35);         // 발
    put(cyl(0.022, 0.022, 0.004, 8), PINK, sx * 0.056, 0.03, 0.131, b, false).rotation.x = Math.PI / 2; // 발바닥
    const ear = put(cap(0.034, 0.15, 8), FUR, sx * 0.058, 0.505, -0.005, b); ear.rotation.z = -sx * 0.16; ear.scale.z = 0.62; // 귀
    const inn = put(cap(0.018, 0.11, 6), PINK, sx * 0.06, 0.5, 0.014, b, false); inn.rotation.z = -sx * 0.16; inn.scale.z = 0.4;
    put(ball(0.0125, 8, 6), INK, sx * 0.046, 0.345, 0.112, b, false);                               // 눈
    put(ball(0.022, 8, 6), PINK, sx * 0.08, 0.308, 0.098, b, false).scale.set(1, 0.6, 0.4);         // 볼
  }
  put(ball(0.125, 16, 12), FUR, 0, 0.33, 0, b).scale.set(1.08, 0.95, 0.95);                        // 머리
  put(new THREE.ConeGeometry(0.013, 0.014, 3), PINK, 0, 0.318, 0.124, b, false).rotation.set(Math.PI / 2 + 0.2, 0, Math.PI); // 세모 코
  const m = put(new THREE.TorusGeometry(0.016, 0.0035, 4, 8, Math.PI), INK, 0, 0.305, 0.119, b, false); m.rotation.z = Math.PI; // 웃는 입
  put(new THREE.TorusGeometry(0.078, 0.024, 6, 14), col, 0, 0.228, 0, b, false).rotation.x = Math.PI / 2;  // 목도리
  put(cbox(0.045, 0.1, 0.02, 0.008), col, 0.05, 0.17, 0.1, b, false).rotation.z = -0.2;            // 목도리 끝
  put(ball(0.035, 8, 6), FUR, 0, 0.1, -0.1, b, false);                                             // 꼬리
  return b;
}
const DOLLS = { bunny: [0xD9483B, 0x3E7CB8], bunny2: [0x4FA3D9, 0xF2B544], bunny3: [0xF2B544, 0xD9577E] };
for (const [k, [c1, c2]] of Object.entries(DOLLS)) addShape(k, (g) => { bunny(g, 1, c1, c2); });
addShape('bigbunny', (g) => { bunny(g, 2.1, 0x3E9A7E, 0xD9483B); }); // 2 × 2 칸을 차지하는 큰 인형

/* ───────── 오락기 ───────── */
function screenTex() { // 오락기 화면: 밤하늘과 별, 바구니 (직접 그린 그림)
  const c = document.createElement('canvas'); c.width = 96; c.height = 72;
  const g = c.getContext('2d');
  g.fillStyle = '#161A3E'; g.fillRect(0, 0, 96, 72);
  g.fillStyle = '#FFD166'; for (const [x, y, r] of [[18, 14, 4], [50, 26, 5], [78, 12, 3], [66, 46, 4], [30, 40, 3]]) star(g, x, y, r);
  g.fillStyle = '#E8776A'; g.fillRect(36, 60, 24, 7);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
}
function star(g, x, y, r) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); g.fill(); }
let scrMat = null;
addShape('arcade', (g) => { // 1 × 1
  const body = 0x3B3FA8, trim = 0xF2B544;
  put(cbox(0.44, 0.62, 0.42, 0.02), body, 0, 0.31, -0.01, g);                       // 아랫몸
  put(cbox(0.44, 0.1, 0.2, 0.02), 0x23265E, 0, 0.66, 0.11, g).rotation.x = 0.2;     // 조작판
  put(cbox(0.44, 0.62, 0.3, 0.02), body, 0, 0.98, -0.07, g);                        // 윗몸
  put(cbox(0.46, 0.13, 0.36, 0.02), trim, 0, 1.33, -0.04, g);                       // 간판
  put(new THREE.PlaneGeometry(0.34, 0.07), L(0xFFF1B8), 0, 1.33, 0.142, g, false);
  for (const sx of [-1, 1]) put(new THREE.BoxGeometry(0.012, 1.22, 0.3), trim, sx * 0.226, 0.66, -0.05, g, false); // 옆 띠
  if (!scrMat) { scrMat = new THREE.MeshBasicMaterial({ map: screenTex() }); }
  const scr = put(new THREE.PlaneGeometry(0.34, 0.26), scrMat, 0, 0.98, 0.083, g, false); scr.rotation.x = -0.12;
  put(new THREE.BoxGeometry(0.38, 0.3, 0.01), 0x14163A, 0, 0.98, 0.076, g, false).rotation.x = -0.12; // 화면 테
  put(cyl(0.008, 0.008, 0.07, 6), 0xD8D0C4, -0.1, 0.73, 0.1, g, false).rotation.x = 0.2;   // 조이스틱
  put(ball(0.024, 8, 6), 0xD9483B, -0.1, 0.77, 0.107, g, false);
  for (const [x, col] of [[0.04, 0x6FD08C], [0.11, 0xFFD166]]) put(cyl(0.02, 0.02, 0.012, 10), col, x, 0.71, 0.115, g, false).rotation.x = 0.2; // 단추
  put(new THREE.BoxGeometry(0.1, 0.04, 0.005), 0x14163A, 0, 0.42, 0.202, g, false);  // 동전 넣는 곳
  g.userData.arcade = { y: 0.98 };
});

/* ───────── 인형뽑기 ───────── */
const CLAW = { floor: 0.56, top: 1.2, half: 0.15, chute: -0.16, tries: 3, tol: 0.036, dolls: [-0.11, 0.01, 0.12] };
let glassMat = null;
addShape('claw', (g) => { // 1 × 1
  const body = 0xE0569A;
  put(cbox(0.46, 0.5, 0.46, 0.02), body, 0, 0.25, 0, g);
  put(cbox(0.46, 0.14, 0.46, 0.02), body, 0, 1.33, 0, g);
  put(new THREE.PlaneGeometry(0.36, 0.08), L(0xFFF1B8), 0, 1.33, 0.232, g, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(new THREE.BoxGeometry(0.03, 0.78, 0.03), 0xFFFFFF, sx * 0.21, 0.88, sz * 0.21, g, false); // 기둥
  if (!glassMat) glassMat = new THREE.MeshLambertMaterial({ color: 0xCFE9FF, transparent: true, opacity: 0.16, depthWrite: false });
  for (const [x, z, ry] of [[0, 0.215, 0], [0, -0.215, 0], [0.215, 0, Math.PI / 2], [-0.215, 0, Math.PI / 2]]) { const p = put(new THREE.PlaneGeometry(0.4, 0.76), glassMat, x, 0.88, z, g, false); p.rotation.y = ry; p.material.side = THREE.DoubleSide; }
  put(new THREE.BoxGeometry(0.42, 0.02, 0.42), 0xFFF4E0, 0, 0.51, 0, g, false);       // 안쪽 바닥
  const pile = [0xF7B6C2, 0xA9D8F0, 0xFFE08A, 0xB7E3B0, 0xD7BFF2];
  for (let k = 0; k < 14; k++) { const a = k * 2.4, r = 0.05 + (k % 5) * 0.028; put(ball(0.04, 8, 6), pile[k % 5], Math.cos(a) * r + 0.02, 0.545, Math.sin(a) * r - 0.04, g, false); } // 바닥에 깔린 솜 공
  put(new THREE.BoxGeometry(0.03, 0.02, 0.4), 0xB9B2A8, 0, CLAW.top + 0.05, 0, g, false); // 집게가 달린 레일
  put(new THREE.BoxGeometry(0.11, 0.11, 0.012), 0x2B1E3A, CLAW.chute, 0.3, 0.232, g, false); // 인형 나오는 곳
  put(cyl(0.008, 0.008, 0.06, 6), 0xD8D0C4, 0.1, 0.53, 0.2, g, false);                 // 조이스틱
  put(ball(0.02, 8, 6), 0x3E7CB8, 0.1, 0.565, 0.2, g, false);
  put(cyl(0.02, 0.02, 0.012, 10), 0xFFD166, 0.17, 0.505, 0.2, g, false);
});
function clawRig() { // 집게: 줄, 몸통, 세 갈래 (놀이를 연 사람 화면에만 있다)
  const g = new THREE.Group();
  const rope = put(cyl(0.004, 0.004, 1, 5), 0x8A8378, 0, 0.5, 0, g, false);
  put(cyl(0.025, 0.03, 0.03, 8), 0xB9B2A8, 0, 0, 0, g, false);
  const prongs = [];
  for (let k = 0; k < 3; k++) { const p = new THREE.Group(); p.rotation.y = k * 2.094; g.add(p); const m = put(new THREE.BoxGeometry(0.008, 0.07, 0.014), 0xD8D0C4, 0.03, -0.04, 0, p, false); m.rotation.z = 0.5; prongs.push(m); }
  return { g, rope, prongs };
}

/* ───────── 당구대, 빈백 ───────── */
addShape('pool', (g) => { // 4 × 2
  put(cbox(1.9, 0.14, 0.94, 0.03), 0x7A4A2B, 0, 0.44, 0, g);
  put(new THREE.BoxGeometry(1.72, 0.02, 0.76), 0x2F8F5B, 0, 0.515, 0, g, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(cbox(0.1, 0.38, 0.1, 0.015), 0x5C3620, sx * 0.82, 0.19, sz * 0.36, g);
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) put(cyl(0.035, 0.035, 0.006, 10), 0x1E1A16, sx * 0.85, 0.528, sz * 0.37, g, false); // 구멍
  const cols = [0xD9483B, 0xF2B544, 0x3E7CB8, 0x7A4FB8, 0x2B2A28, 0xE8776A];
  cols.forEach((c, k) => { const row = k < 1 ? 0 : k < 3 ? 1 : 2, n = k - [0, 1, 3][row]; put(ball(0.028, 8, 6), c, 0.4 + row * 0.05, 0.553, (n - row / 2) * 0.058, g, false); });
  put(ball(0.028, 8, 6), 0xFFFFFF, -0.45, 0.553, 0.02, g, false);
  const cue = put(cyl(0.008, 0.012, 1.1, 6), 0xD9B382, -0.25, 0.545, 0.26, g, false); cue.rotation.z = Math.PI / 2; cue.rotation.y = 0.12;
});
addShape('beanbag', (g) => { // 2 × 2
  put(ball(0.4, 14, 10), 0xE8776A, 0, 0.2, 0, g).scale.set(1, 0.5, 1);
  put(ball(0.3, 12, 8), 0xE8776A, 0, 0.36, -0.14, g).scale.set(1.05, 0.72, 0.62);
  put(ball(0.03, 6, 5), 0xFFF4E0, 0, 0.4, 0.0, g, false).scale.y = 0.4;
});

// K = { play, S(), itemObj(id), op(o), newId(), canEdit(), isMaster(), toast, close, setPose, aspect(), levelOfCell(i), mode(), measure(), record(k, v), bestLine(k), prize() 뽑은 인형을 내 옆에 놓는다 }
export function makeGameroom(K) {
  const $ = (id) => document.getElementById(id);
  const portrait = () => window.innerWidth < window.innerHeight;
  const v3 = new THREE.Vector3();
  const world = (g, x, y, z) => { g.updateMatrixWorld(); const p = g.localToWorld(v3.set(x, y, z)); return [p.x, p.y, p.z]; };
  const quit = { label: '그만하기', id: 'playQuit', fn: () => K.close() };
  let cur = null;

  /* ───────── 오락기: 별 받기 ───────── */
  const GAME = { secs: 40, lives: 3, w: 300, h: 190, pad: 46 };
  const cv = document.createElement('canvas'); cv.id = 'arcCv'; cv.hidden = true; cv.width = GAME.w * 2; cv.height = GAME.h * 2;
  cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', '오락기 화면: 떨어지는 별을 바구니로 받는 놀이');
  cv.style.cssText = `display:block;width:100%;max-width:${GAME.w}px;aspect-ratio:${GAME.w}/${GAME.h};margin:0 auto;border-radius:12px;border:3px solid #3B3FA8;background:#161A3E;touch-action:none;flex:none`;
  $('playBtns').parentNode.insertBefore(cv, $('playBtns'));
  const ctx = cv.getContext('2d');
  const aimAt = (e) => { if (!cur || cur.kind !== 'arcade' || cur.phase !== 'run') return; const r = cv.getBoundingClientRect(); cur.goal = clamp((e.clientX - r.left) / r.width, 0, 1); e.preventDefault(); };
  cv.addEventListener('pointerdown', aimAt); cv.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) aimAt(e); });
  let hold = 0; // ◀ ▶ 를 누르고 있는 쪽
  const holdBtn = (label, id, dir) => ({ label, id, fn: () => { if (cur && cur.kind === 'arcade') cur.goal = clamp(cur.goal + dir * 0.16, 0, 1); } });
  window.addEventListener('keydown', (e) => { if (cur && cur.kind === 'arcade' && cur.phase === 'run' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { hold = e.key === 'ArrowLeft' ? -1 : 1; e.preventDefault(); e.stopPropagation(); } }, true);
  window.addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') hold = 0; }, true);
  function arcStart(c) { c.phase = 'run'; c.t = 0; c.score = 0; c.lives = GAME.lives; c.x = c.goal = 0.5; c.drops = []; c.next = 0.4; c.pops = []; hold = 0; arcPaint(c); sfx('whoosh'); }
  function arcOver(c) {
    c.phase = 'over'; sfx(c.score > 0 ? 'ovenDing' : 'wipe');
    if (c.score > 0) K.record('arcade', Math.min(c.score, 999));
    arcPaint(c);
  }
  function arcPaint(c) {
    cv.hidden = false;
    if (c.phase === 'run') K.play.panel('별 받기', '화면을 누르거나 끌어서 바구니를 옮겨요. 까만 돌은 피해요!', [holdBtn('◀', 'arcL', -1), holdBtn('▶', 'arcR', 1), quit]);
    else if (c.phase === 'over') K.play.panel(`별 ${c.score}개를 받았어요! ⭐`, '한 판 더 할까요?' + (K.bestLine('arcade') ? ' · ' + K.bestLine('arcade') : ''), [{ label: '🕹️ 한 판 더', main: true, id: 'playGo', fn: () => arcStart(c) }, quit]);
    else K.play.panel('오락기 · 별 받기', `${GAME.secs}초 동안 떨어지는 별을 바구니로 받아요. 큰 별은 3점, 까만 돌은 세 번까지` + (K.bestLine('arcade') ? ' · ' + K.bestLine('arcade') : ''), [{ label: '🕹️ 시작하기', main: true, id: 'playGo', fn: () => arcStart(c) }, quit]);
  }
  function arcDraw(c) {
    const W = GAME.w, H = GAME.h, g = ctx;
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.fillStyle = '#161A3E'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.5)'; for (let k = 0; k < 24; k++) g.fillRect((k * 53 + 17) % W, (k * 31 + 9) % (H - 30), 1.5, 1.5); // 먼 별
    g.fillStyle = '#EEF3FA'; g.fillRect(0, H - 10, W, 10); // 눈밭
    if (c.phase !== 'run' && c.phase !== 'over') {
      g.fillStyle = '#FFD166'; star(g, W / 2, H / 2 - 18, 26);
      g.fillStyle = '#FFF4E0'; g.font = '800 17px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('별 받기', W / 2, H / 2 + 36);
      return;
    }
    for (const d of c.drops) {
      if (d.k === 'rock') { g.fillStyle = '#2B2A28'; g.beginPath(); g.arc(d.x * W, d.y * H, 8, 0, 7); g.fill(); g.fillStyle = '#55524D'; g.beginPath(); g.arc(d.x * W - 2, d.y * H - 3, 2.5, 0, 7); g.fill(); }
      else { g.fillStyle = d.k === 'big' ? '#FF9F6B' : '#FFD166'; star(g, d.x * W, d.y * H, d.k === 'big' ? 12 : 8); }
    }
    const bx = c.x * W;
    g.fillStyle = '#E8776A'; g.beginPath(); g.moveTo(bx - GAME.pad / 2, H - 30); g.lineTo(bx + GAME.pad / 2, H - 30); g.lineTo(bx + GAME.pad / 2 - 6, H - 12); g.lineTo(bx - GAME.pad / 2 + 6, H - 12); g.closePath(); g.fill();
    g.fillStyle = '#FFF4E0'; g.fillRect(bx - GAME.pad / 2, H - 33, GAME.pad, 4);
    for (const p of c.pops) { g.fillStyle = `rgba(255,244,224,${1 - p.t})`; g.font = '800 13px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(p.s, p.x * W, H - 40 - p.t * 22); }
    g.fillStyle = '#FFF4E0'; g.font = '800 13px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(`⭐ ${c.score}`, 8, 18);
    g.textAlign = 'right'; g.fillText(`${'●'.repeat(c.lives)}${'○'.repeat(GAME.lives - c.lives)}  ${Math.max(0, Math.ceil(GAME.secs - c.t))}초`, W - 8, 18);
    if (c.phase === 'over') { g.fillStyle = 'rgba(10,12,34,.62)'; g.fillRect(0, 0, W, H); g.fillStyle = '#FFD166'; g.font = '800 22px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(`별 ${c.score}개!`, W / 2, H / 2 + 6); }
  }
  function arcStep(c, dt) {
    c.t += dt;
    if (hold) c.goal = clamp(c.goal + hold * dt * 1.3, 0, 1);
    c.x += (c.goal - c.x) * Math.min(1, dt * 14);
    const hard = clamp(c.t / GAME.secs, 0, 1);
    c.next -= dt;
    if (c.next <= 0) { const r = Math.random(); c.drops.push({ k: r < 0.16 + hard * 0.1 ? 'rock' : r > 0.9 ? 'big' : 'star', x: 0.06 + Math.random() * 0.88, y: -0.05, v: 0.42 + hard * 0.45 + Math.random() * 0.12 }); c.next = 0.62 - hard * 0.3; }
    const half = GAME.pad / 2 / GAME.w + 0.025, yCatch = (GAME.h - 30) / GAME.h;
    for (let k = c.drops.length - 1; k >= 0; k--) {
      const d = c.drops[k], y0 = d.y; d.y += d.v * dt;
      if (y0 < yCatch && d.y >= yCatch && Math.abs(d.x - c.x) <= half) {
        c.drops.splice(k, 1);
        if (d.k === 'rock') { c.lives--; c.pops.push({ x: d.x, t: 0, s: '앗!' }); sfx('wipe'); }
        else { const n = d.k === 'big' ? 3 : 1; c.score += n; c.pops.push({ x: d.x, t: 0, s: '+' + n }); sfx('top'); }
      } else if (d.y > 1.05) c.drops.splice(k, 1);
    }
    for (let k = c.pops.length - 1; k >= 0; k--) { c.pops[k].t += dt * 1.6; if (c.pops[k].t >= 1) c.pops.splice(k, 1); }
    if (c.lives <= 0 || c.t >= GAME.secs) arcOver(c);
  }
  K.play.add('arcade', {
    start(c) {
      cur = c; c.phase = 'ready'; c.score = 0; c.lives = GAME.lives; c.drops = []; c.pops = []; c.x = c.goal = 0.5; c.t = 0;
      K.setPose({ pos: world(c.g, 0, 1.18, portrait() ? 1.55 : 1.25), at: world(c.g, 0, 1.0, 0), fov: portrait() ? 58 : 42, inside: true });
      arcPaint(c); arcDraw(c);
    },
    paint: arcPaint,
    tick(c, dt) { if (c.phase === 'run') arcStep(c, Math.min(dt, 0.05)); arcDraw(c); },
    tap() {},
    stop() { cur = null; cv.hidden = true; hold = 0; },
  });

  /* ───────── 인형뽑기 ───────── */
  function clawPaint(c) {
    const go = { label: '⬇️ 집게 내리기', main: true, id: 'playGo', fn: () => clawDrop(c) };
    if (c.phase === 'aim') K.play.panel('인형뽑기', `집게가 인형 바로 위에 왔을 때 내려요 · 남은 집게 ${c.left}번`, [go, quit]);
    else if (c.phase === 'done') K.play.panel(c.won ? `토끼 인형 ${c.won}개를 뽑았어요! 🐰` : '아깝다! 하나도 못 뽑았어요', c.won ? (c.placed ? '뽑은 인형은 내 옆에 놓였어요. 가구처럼 옮길 수 있어요' : '방에 인형이 많아서 이번 인형은 기계에 돌려놓았어요') : '집게가 인형 한가운데에 오는 순간을 노려 봐요', [{ label: '🧸 한 판 더', main: true, id: 'playGo', fn: () => clawReset(c) }, quit]);
    else K.play.panel('인형뽑기', c.phase === 'out' ? '뽑았다! 🐰' : '두근두근…', []);
  }
  function clawReset(c) {
    c.phase = 'aim'; c.t = 0; c.left = CLAW.tries; c.won = 0; c.placed = false; c.got = null;
    c.dolls.forEach((d, k) => { d.taken = false; d.g.visible = true; d.g.position.set(CLAW.dolls[k], CLAW.floor, 0.03); });
    clawPaint(c);
  }
  function clawDrop(c) {
    if (c.phase !== 'aim') return;
    c.phase = 'down'; c.t = 0; c.left--; sfx('whoosh'); clawPaint(c);
  }
  const DOLL_H = 0.2; // 기계 안 인형의 키
  K.play.add('claw', {
    start(c) {
      cur = c;
      c.m = new THREE.Group(); c.g.add(c.m);
      c.rig = clawRig(); c.m.add(c.rig.g);
      c.dolls = Object.values(DOLLS).map(([c1, c2]) => ({ g: bunny(c.m, 0.42, c1, c2), taken: false }));
      K.setPose({ pos: world(c.g, 0, 1.02, portrait() ? 1.5 : 1.2), at: world(c.g, 0, 0.88, 0), fov: portrait() ? 56 : 40, inside: true });
      clawReset(c);
    },
    paint: clawPaint,
    tick(c, dt) {
      const r = c.rig;
      c.t += dt;
      let y = CLAW.top;
      if (c.phase === 'aim') c.x = CLAW.half * Math.sin(c.t * (2.1 + (CLAW.tries - c.left) * 0.55));
      else if (c.phase === 'down') {
        const k = clamp(c.t / 0.7, 0, 1); y = CLAW.top - (CLAW.top - CLAW.floor - DOLL_H) * k;
        if (k >= 1) { c.got = c.dolls.find((d) => !d.taken && Math.abs(d.g.position.x - c.x) <= CLAW.tol) || null; c.phase = 'up'; c.t = 0; sfx(c.got ? 'carry' : 'wipe'); }
      } else if (c.phase === 'up') {
        const k = clamp(c.t / 0.8, 0, 1); y = CLAW.floor + DOLL_H + (CLAW.top - CLAW.floor - DOLL_H) * k;
        if (k >= 1) { c.t = 0; if (c.got) c.phase = 'carry'; else if (c.left > 0) { c.phase = 'aim'; clawPaint(c); } else { c.phase = 'done'; clawPaint(c); } }
      } else if (c.phase === 'carry') {
        const k = clamp(c.t / 0.7, 0, 1); c.x += (CLAW.chute - c.x) * Math.min(1, dt * 6);
        if (k >= 1) { c.phase = 'out'; c.t = 0; clawPaint(c); sfx('ovenDing'); }
      } else if (c.phase === 'out') { // 인형이 구멍으로 떨어진다
        const k = clamp(c.t / 0.5, 0, 1);
        if (c.got) { c.got.g.position.y = CLAW.top - DOLL_H - k * 0.5; if (k >= 1) { c.got.g.visible = false; c.got.taken = true; c.got = null; c.won++; if (K.prize()) c.placed = true; } }
        if (k >= 1) { c.t = 0; if (c.left > 0 && c.dolls.some((d) => !d.taken)) { c.phase = 'aim'; } else c.phase = 'done'; clawPaint(c); }
      }
      r.g.position.set(c.x, y, 0.03);
      r.rope.scale.y = Math.max(0.01, CLAW.top + 0.05 - y); r.rope.position.y = r.rope.scale.y / 2;
      const grip = c.phase === 'down' ? 0.5 : c.got || c.phase === 'up' ? 0.15 : 0.5;
      for (const p of r.prongs) p.rotation.z = grip;
      if (c.got && c.phase !== 'out') c.got.g.position.set(c.x, y - DOLL_H, 0.03);
      K.dirty();
    },
    tap() {},
    stop(c) { cur = null; if (c.m) { c.g.remove(c.m); c.m.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); c.m = null; } K.dirty(); },
  });

  /* ───────── 4층을 한 번에 게임방으로 (마스터 판) ───────── */
  const onLv = (it) => K.levelOfCell(it.i) === GAME_LV;
  const row = document.createElement('div'), btn = document.createElement('button');
  row.className = 'row'; row.id = 'gameRow'; row.hidden = true;
  btn.type = 'button'; btn.className = 'btn'; btn.id = 'gameBtn4'; btn.style.flex = '1';
  row.appendChild(btn);
  let armed = 0;
  const label = () => { btn.textContent = armed ? `한 번 더 누르면 4층 가구 ${[...K.S().items.values()].filter(onLv).length}개를 치우고 게임방을 꾸며요` : '🎮 4층을 게임방으로 꾸미기'; btn.classList.toggle('main', !!armed); };
  label();
  // 4층의 가구를 모두 치우고 게임방을 꾸민다. 놓은 가구 수를 돌려준다 (못 했으면 -1)
  function convert() {
    if (!K.isMaster() || !K.canEdit()) return -1;
    const S = K.S(), old = [...S.items.values()].filter(onLv).map((it) => it.id);
    if (S.items.size - old.length + GAMEROOM.length > MAX_ITEMS) { K.toast('가구가 너무 많아서 게임방을 꾸밀 수 없어요. 다른 층의 가구를 조금 치워 주세요'); return -1; }
    for (const id of old) K.op({ t: 'del', id });
    let n = 0;
    for (const [k, a, j, r] of GAMEROOM) if (K.op({ t: 'put', id: K.newId(), k, i: GAME_LV * FLOOR_DI + a, j, r })) n++;
    K.toast('🎮 4층이 게임방이 됐어요! 3층 사다리로 올라가 보세요');
    return n;
  }
  btn.addEventListener('click', () => {
    if (armed && performance.now() - armed < 5000) { armed = 0; label(); convert(); return; }
    armed = performance.now(); label();
  });
  return {
    convert,
    tick() {
      const show = K.isMaster() && K.canEdit(), panel = $('masterP');
      if (panel && row.parentNode !== panel) panel.insertBefore(row, panel.lastChild); // 마스터 탭이 만들어진 뒤에 그 안에 넣는다 ('마스터키 끄기' 줄 위)
      if (armed && performance.now() - armed >= 5000) { armed = 0; label(); }
      if (row.hidden !== !show) { row.hidden = !show; if (K.mode() === 'master') K.measure(); }
    },
    test: {
      get state() { return cur ? { kind: cur.kind, phase: cur.phase, score: cur.score, lives: cur.lives, left: cur.left, won: cur.won, x: cur.x, t: cur.t, placed: cur.placed, drops: cur.drops ? cur.drops.length : 0 } : null; },
      get dolls() { return cur && cur.dolls ? cur.dolls.map((d) => ({ x: d.g.position.x, taken: d.taken })) : []; },
      get row() { return !row.hidden; },
      // 검사용: 오락기에 별·돌 하나를 바구니 바로 위에 떨어뜨린다, 남은 시간을 줄인다, 집게를 그 자리에 세운다
      spawn(k, x) { if (cur && cur.drops) cur.drops.push({ k, x: x == null ? cur.x : x, y: 0.7, v: 0.6 }); },
      setT(t) { if (cur) cur.t = t; },
      aim(x) { if (cur && cur.kind === 'claw' && cur.phase === 'aim') { cur.x = x; cur.t = Math.asin(clamp(x / CLAW.half, -1, 1)) / (2.1 + (CLAW.tries - cur.left) * 0.55); } },
    },
  };
}
