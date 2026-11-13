// 3층 영화관: 큰 스크린, 계단식 좌석, 통로 유도등, 팝콘 기계, 벽에 거는 그림.
//   가구의 종류와 배치는 catalog.js(FURNITURE 의 screen·seat·seat2·seat3·guide·popcorn·art1~5, CINEMA), 여기는 모양과 영화관으로 바꾸기.
//   스크린은 TV 와 같은 화면 재질(TV_MAT)을 크게 비춘다. 그래서 TV 에 넣은 동영상·같이 보기가 그대로 스크린에도 나온다(놀이는 play.js 의 tv).
//   새 방(그리고 위층이 없던 때의 방을 처음 열 때)의 3층은 처음부터 영화관이다(catalog.js 의 STARTER_UP).
//   이미 3층을 꾸며 둔 방은 그대로 두고, 방장이나 공동 관리자가 "벽·바닥" 판의 "🎬 3층을 영화관으로 바꾸기"를 두 번 누르면
//   3층의 가구를 치우고 영화관을 차린다(가구 치우기·놓기 변화를 하나씩 보내서 모두에게 같게 된다).
//   그림은 모두 직접 그린 캔버스 그림이다(겨울 언덕, 트리, 추상화, 눈사람, 오로라).
//
// K = { S() 방 상태, kindOf(k), levelOfCell(i), op(o), newId(), canManage(), canEdit(), approach(id, then), eat(), mode(), measure(), toast(m),
//       itemObj(id) 가구 모양, wallShown(lv, side) 그 층의 그 벽(n·s·w·e)이 지금 보이는지, dirty() }
import { THREE, M, put, rbox, cyl, ball } from './kit.js';
import { addShape, TV_MAT } from './furniture.js';
import { CINEMA, MAX_ITEMS } from './catalog.js';
import { FLOOR_DI, NX, NZ } from './path.js';

export const SCREEN = { w: 3.6, h: 2.025, y: 1.4, far: 9 }; // 스크린 화면의 크기와 가운데 높이 (16:9), far = 볼 때 물러서는 가장 먼 거리(세로 화면에서는 뒷줄 뒤까지 물러서야 다 보인다)
const lit = (hex) => new THREE.MeshBasicMaterial({ color: hex });
const VELVET = 0xA02C36, VELVET_D = 0x6B1C25, STEP = 0x3B3040, FRAME = 0x8A5F3F, GOLD = 0xE7B441;
let GLOW = null; // 유도등 재질 (모두 같이 쓴다)

/* ───────── 그림 (한 번만 그려서 같은 그림은 재질 하나를 나눠 쓴다) ───────── */
const W = 192, H = 144;
const PAINT = {
  art1(g) { // 겨울 언덕: 분홍빛 하늘, 눈 덮인 언덕, 불 켜진 오두막, 전나무
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#8FB8E8'); sky.addColorStop(0.6, '#F7C9C0'); sky.addColorStop(1, '#FFE9D2');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#FFF6E0'; g.beginPath(); g.arc(150, 34, 13, 0, 7); g.fill();
    g.fillStyle = '#DCE6F5'; g.beginPath(); g.ellipse(50, 128, 110, 46, 0, 0, 7); g.fill();
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(150, 140, 110, 50, 0, 0, 7); g.fill();
    g.fillStyle = '#8A4B3A'; g.fillRect(112, 84, 34, 22);
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(106, 86); g.lineTo(129, 66); g.lineTo(152, 86); g.fill();
    g.fillStyle = '#FFD86B'; g.fillRect(124, 91, 10, 9);
    for (const [x, y, s] of [[30, 100, 1], [52, 108, 0.8], [172, 104, 0.9]]) { g.fillStyle = '#2F7D5B'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x, y - (34 - k * 9) * s); g.lineTo(x - (8 + k * 4) * s, y - (16 - k * 8) * s); g.lineTo(x + (8 + k * 4) * s, y - (16 - k * 8) * s); g.fill(); } g.fillStyle = '#6B4630'; g.fillRect(x - 2, y, 4, 7 * s); }
  },
  art2(g) { // 트리: 짙은 밤 배경, 장식과 별
    g.fillStyle = '#17324A'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#FFFFFF'; for (let k = 0; k < 26; k++) { g.beginPath(); g.arc((k * 67) % W, (k * 41) % (H - 20), 1.2, 0, 7); g.fill(); }
    g.fillStyle = '#EEF4FA'; g.fillRect(0, H - 16, W, 16);
    g.fillStyle = '#6B4630'; g.fillRect(90, 112, 12, 18);
    g.fillStyle = '#2E8B62'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(96, 22 + k * 24); g.lineTo(96 - 24 - k * 11, 62 + k * 26); g.lineTo(96 + 24 + k * 11, 62 + k * 26); g.fill(); }
    const dots = ['#E7493F', '#FFD24A', '#6FB6FF', '#FF9BC1'];
    [[88, 50], [106, 56], [78, 78], [98, 84], [116, 80], [70, 106], [90, 108], [110, 104], [126, 108]].forEach(([x, y], k) => { g.fillStyle = dots[k % 4]; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); });
    g.fillStyle = '#FFD24A'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4.5 : 10; g.lineTo(96 + Math.cos(a) * r, 20 + Math.sin(a) * r); } g.fill();
  },
  art3(g) { // 추상화: 색 네모와 동그라미, 굵은 선
    g.fillStyle = '#F4EBDD'; g.fillRect(0, 0, W, H);
    for (const [x, y, w, h, c] of [[10, 12, 70, 54, '#D9483B'], [90, 12, 92, 30, '#2F6DB5'], [90, 50, 40, 82, '#F2C230'], [10, 76, 70, 56, '#2E8B62'], [138, 50, 44, 82, '#1F2A44']]) { g.fillStyle = c; g.fillRect(x, y, w, h); }
    g.fillStyle = '#F4EBDD'; g.beginPath(); g.arc(46, 40, 16, 0, 7); g.fill();
    g.fillStyle = '#F2C230'; g.beginPath(); g.arc(160, 92, 13, 0, 7); g.fill();
    g.strokeStyle = '#1F2A44'; g.lineWidth = 5; g.beginPath(); g.moveTo(18, 124); g.lineTo(74, 84); g.stroke();
  },
  art4(g) { // 눈사람: 파란 밤, 눈송이
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#27407A'); sky.addColorStop(1, '#5E86C9');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#FFFFFF'; for (let k = 0; k < 30; k++) { g.beginPath(); g.arc((k * 53 + 11) % W, (k * 29 + 7) % (H - 24), 1.6 + (k % 3) * 0.5, 0, 7); g.fill(); }
    g.beginPath(); g.ellipse(96, 150, 140, 36, 0, 0, 7); g.fill();
    for (const [y, r] of [[104, 26], [68, 19], [42, 13]]) { g.beginPath(); g.arc(96, y, r, 0, 7); g.fill(); }
    g.fillStyle = '#2A2420'; for (const [x, y] of [[91, 39], [101, 39], [96, 62], [96, 72], [96, 98]]) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
    g.fillRect(84, 26, 24, 5); g.fillRect(88, 12, 16, 15);
    g.fillStyle = '#F08A2C'; g.beginPath(); g.moveTo(96, 43); g.lineTo(112, 46); g.lineTo(96, 48); g.fill();
    g.fillStyle = '#D9483B'; g.fillRect(82, 52, 28, 6); g.fillRect(104, 54, 6, 18);
  },
  art5(g) { // 오로라: 밤하늘의 초록·보랏빛 띠, 별, 눈밭과 전나무 그림자
    g.fillStyle = '#0D1B3A'; g.fillRect(0, 0, W, H);
    for (const [c, y0, amp] of [['rgba(92,240,170,0.55)', 40, 16], ['rgba(150,120,255,0.45)', 60, 12], ['rgba(110,220,255,0.35)', 26, 10]]) {
      g.strokeStyle = c; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath();
      for (let x = -10; x <= W + 10; x += 8) { const y = y0 + Math.sin(x / 26 + amp) * amp + x * 0.08; if (x === -10) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = '#FFFFFF'; for (let k = 0; k < 34; k++) { g.beginPath(); g.arc((k * 71 + 5) % W, (k * 37 + 3) % 90, 1, 0, 7); g.fill(); }
    g.fillStyle = '#E6EEF8'; g.beginPath(); g.ellipse(96, 150, 150, 40, 0, 0, 7); g.fill();
    g.fillStyle = '#0A2A2A'; for (const [x, s] of [[24, 1], [44, 0.7], [150, 0.9], [172, 1.1]]) { g.beginPath(); g.moveTo(x, 118 - 40 * s); g.lineTo(x - 11 * s, 120); g.lineTo(x + 11 * s, 120); g.fill(); }
  },
};
const artMats = new Map();
function artMat(k) {
  let m = artMats.get(k);
  if (!m) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    PAINT[k](c.getContext('2d'));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    m = new THREE.MeshLambertMaterial({ map: tex }); // 방 불을 끄면 그림도 어두워진다
    artMats.set(k, m);
  }
  return m;
}

/* ───────── 모양 (바닥 자리 한가운데가 (0, 0), 앞쪽이 +z) ───────── */
// 스크린: 8 × 1, 벽에 붙는 검은 판과 화면, 양옆의 빨간 막
addShape('screen', (g) => {
  put(rbox(SCREEN.w + 0.24, SCREEN.h + 0.24, 0.07, 0.02), 0x1E1A1C, 0, SCREEN.y, -0.2, g);
  const scr = put(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), TV_MAT, 0, SCREEN.y, -0.16, g, false);
  scr.receiveShadow = false;
  for (const s of [-1, 1]) put(rbox(0.16, SCREEN.h + 0.4, 0.14, 0.05), VELVET, (SCREEN.w / 2 + 0.2) * s, SCREEN.y, -0.15, g);
  put(new THREE.BoxGeometry(SCREEN.w + 0.6, 0.18, 0.16), VELVET_D, 0, SCREEN.y + SCREEN.h / 2 + 0.2, -0.15, g, false);
  g.userData.scr = SCREEN; // play.js 의 TV 보기가 이 크기에 맞춰 물러선다
});
// 좌석: 4 × 2, 두 사람이 앉는 벨벳 의자. rise = 밑에 깔린 단의 높이 (뒷줄일수록 높다). 단 앞에는 발밑 등
const seatShape = (rise) => (g) => {
  if (rise) {
    put(new THREE.BoxGeometry(1.98, rise, 0.98), STEP, 0, rise / 2, 0, g);
    if (!GLOW) GLOW = lit(0xFFC766);
    put(new THREE.BoxGeometry(1.9, 0.02, 0.02), GLOW, 0, rise - 0.012, 0.495, g, false).receiveShadow = false;
  }
  put(rbox(1.84, 0.3, 0.66, 0.06), VELVET, 0, rise + 0.19, 0.08, g);
  put(rbox(1.84, 0.82, 0.2, 0.07), VELVET, 0, rise + 0.45, -0.36, g);
  for (const x of [-0.93, 0, 0.93]) put(rbox(0.1, 0.5, 0.78, 0.04), VELVET_D, x, rise + 0.29, 0.03, g, x !== 0);
};
addShape('seat', seatShape(0)); addShape('seat2', seatShape(0.2)); addShape('seat3', seatShape(0.4));
// 유도등: 6 × 2, 통로 양쪽 가장자리의 빛나는 줄 (밟고 지나간다)
addShape('guide', (g) => {
  if (!GLOW) GLOW = lit(0xFFC766);
  for (const s of [-1, 1]) put(new THREE.BoxGeometry(2.9, 0.012, 0.035), GLOW, 0, 0.016, 0.47 * s, g, false).receiveShadow = false;
});
// 팝콘 기계: 2 × 1, 빨간 수레 위의 유리 상자
addShape('popcorn', (g) => {
  put(rbox(0.84, 0.72, 0.4, 0.04), 0xC8332B, 0, 0.36, 0, g);
  put(new THREE.BoxGeometry(0.86, 0.06, 0.42), GOLD, 0, 0.75, 0, g, false);
  put(new THREE.BoxGeometry(0.76, 0.44, 0.34), new THREE.MeshLambertMaterial({ color: 0xFFF7DA, transparent: true, opacity: 0.45 }), 0, 1.0, 0, g, false);
  put(ball(0.26, 12, 8), 0xFFE08A, 0, 0.82, 0, g, false).scale.set(1.25, 0.55, 0.55);
  put(rbox(0.9, 0.12, 0.46, 0.03), 0xC8332B, 0, 1.28, 0, g);
  put(cyl(0.05, 0.05, 0.03, 10), GOLD, 0, 1.36, 0, g, false);
});
// 그림: 2 × 1, 벽에 붙는 나무 액자 (칸의 뒤쪽 끝에 걸린다)
for (const k of Object.keys(PAINT)) addShape(k, (g) => {
  put(rbox(0.86, 0.66, 0.05, 0.02), k === 'art3' ? 0x2A2420 : k === 'art2' ? GOLD : FRAME, 0, 1.62, -0.215, g);
  put(new THREE.PlaneGeometry(0.74, 0.54), artMat(k), 0, 1.62, -0.186, g, false);
});

export function makeCinema(K) {
  const lv3 = (it) => K.levelOfCell(it.i) === 2;
  // "벽·바닥" 판의 단추. 방장과 공동 관리자에게만 보인다
  const row = document.createElement('div'), btn = document.createElement('button');
  row.className = 'row'; row.id = 'cineRow'; row.hidden = true;
  btn.type = 'button'; btn.className = 'btn'; btn.id = 'cineBtn'; btn.style.flex = '1';
  row.appendChild(btn);
  document.getElementById('paint').appendChild(row);
  let armed = 0; // 한 번 누른 때 (5초 안에 한 번 더 누르면 바꾼다)
  const label = () => { btn.textContent = armed ? `한 번 더 누르면 3층 가구 ${[...K.S().items.values()].filter(lv3).length}개를 치우고 영화관을 차려요` : '🎬 3층을 영화관으로 바꾸기'; btn.classList.toggle('main', !!armed); };
  label();
  // 3층의 가구를 모두 치우고 영화관을 차린다. 놓은 가구 수를 돌려준다 (못 했으면 -1)
  function convert() {
    if (!K.canManage() || !K.canEdit()) { K.toast('방장과 공동 관리자만 바꿀 수 있어요'); return -1; }
    const S = K.S(), old = [...S.items.values()].filter(lv3).map((it) => it.id);
    if (S.items.size - old.length + CINEMA.length > MAX_ITEMS) { K.toast('가구가 너무 많아서 영화관을 차릴 수 없어요. 다른 층의 가구를 조금 치워 주세요'); return -1; }
    for (const id of old) K.op({ t: 'del', id });
    let n = 0;
    for (const [k, a, j, r] of CINEMA) if (K.op({ t: 'put', id: K.newId(), k, i: 2 * FLOOR_DI + a, j, r })) n++;
    K.toast('🎬 3층이 영화관이 됐어요! 스크린 앞에서 영화를 틀어 보세요');
    return n;
  }
  btn.addEventListener('click', () => {
    if (armed && performance.now() - armed < 5000) { armed = 0; label(); convert(); return; }
    armed = performance.now(); label();
  });
  return {
    convert,
    // 그 가구로 할 수 있는 일의 이름 (영화관 가구가 아니면 null)
    label(it) { return it.k === 'screen' ? '🎬 영화 보기' : K.kindOf(it.k).munch ? '🍿 팝콘 먹기' : null; },
    // 가구를 눌렀을 때: 팝콘 기계면 가서 꺼내 먹는다
    use(id) {
      const it = K.S().items.get(id);
      if (!it || !K.kindOf(it.k).munch) return false;
      K.approach(id, () => { if (K.mode() === null && K.eat()) K.toast('🍿 팝콘을 한 줌 집어 먹었어요'); });
      return true;
    },
    // 3층에 영화관(스크린)이 있는지
    artShown(id) { const g = K.itemObj(id); return !!g && g.children[0].visible; }, // 그 그림이 지금 보이는지 (벽과 같이 숨는다)
    get has() { for (const it of K.S().items.values()) if (it.k === 'screen' && lv3(it)) return true; return false; },
    tick() {
      const show = K.canManage() && K.canEdit();
      if (armed && performance.now() - armed >= 5000) { armed = 0; label(); }
      if (row.hidden !== !show) { row.hidden = !show; if (K.mode() === 'paint') K.measure(); }
      // 벽에 건 그림은 그 벽이 내려가 있을 때(화면을 돌려 벽 뒤에서 볼 때) 같이 숨긴다. 안 그러면 액자 뒷면이 허공에 뜬다
      for (const it of K.S().items.values()) {
        if (!PAINT[it.k]) continue;
        const g = K.itemObj(it.id), lv = K.levelOfCell(it.i), a = it.i - lv * FLOOR_DI;
        if (!g) continue;
        const side = it.r === 0 && it.j === 0 ? 'n' : it.r === 2 && it.j === NZ - 1 ? 's' : it.r === 1 && a === 0 ? 'w' : it.r === 3 && a === NX - 1 ? 'e' : null;
        const on = !side || K.wallShown(lv, side);
        if (g.children[0].visible !== on) { for (const c of g.children) c.visible = on; K.dirty(); }
      }
    },
  };
}
