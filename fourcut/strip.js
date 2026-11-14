// 네 컷 띠 그리기. 프레임은 그림 파일 없이 모두 여기서 그린다.
// 띠 크기는 1080 x 3240 (가로:세로 1:3). 컷 하나는 960 x 720 (4:3) 으로 담고, 띠에는 900 x 675 로 넣는다.
// 새 프레임은 FRAMES 에 한 줄: { id, name, sw(고르기 단추 색), ink(글자색), sub(작은 글자색), paint(ctx, rnd) }
export const W = 1080, H = 3240, CUT_W = 960, CUT_H = 720;
const PAD = 90, GAP = 36, PW = W - PAD * 2, PH = PW * 0.75, FOOT_Y = PAD + PH * 4 + GAP * 3; // 2898 부터 아래가 글자 자리
const inText = (x, y) => y > FOOT_Y + 20 && x > 240 && x < W - 240; // 글자 자리에는 무늬를 뿌리지 않는다
const FONT = "'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',system-ui,sans-serif";

// 두 폰에서 같은 무늬가 나오도록 씨앗이 정해진 난수를 쓴다.
function seeded(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const fill = (c, col) => { c.fillStyle = col; c.fillRect(0, 0, W, H); };
function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function star(c, x, y, r, col) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); }
  c.closePath(); c.fill();
}
function tree(c, x, y, s) { // 발치가 (x, y) 인 작은 트리
  c.fillStyle = '#7A4A2B'; c.fillRect(x - s * 0.1, y - s * 0.22, s * 0.2, s * 0.22);
  c.fillStyle = '#3FA06F';
  for (let i = 0; i < 3; i++) {
    const top = y - s * (1.05 - i * 0.02) + i * s * 0.26, half = s * (0.26 + i * 0.12), bot = top + s * 0.42;
    c.beginPath(); c.moveTo(x, top); c.lineTo(x + half, bot); c.lineTo(x - half, bot); c.closePath(); c.fill();
  }
  star(c, x, y - s * 1.06, s * 0.14, '#F7D48F');
  [['#D9483B', -0.14, -0.5], ['#F7D48F', 0.12, -0.36], ['#FFFFFF', -0.05, -0.27], ['#D9483B', 0.2, -0.24]].forEach(([col, dx, dy]) => {
    c.fillStyle = col; c.beginPath(); c.arc(x + dx * s, y + dy * s, s * 0.045, 0, 7); c.fill();
  });
}
function burst(c, x, y, r, col, n = 14) { // 불꽃놀이 한 송이
  c.strokeStyle = col; c.lineWidth = 5; c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke();
    c.fillStyle = col; c.beginPath(); c.arc(x + Math.cos(a) * r * 1.18, y + Math.sin(a) * r * 1.18, 4, 0, 7); c.fill();
  }
}

export const FRAMES = [
  { id: 'cream', name: '크림', sw: '#FFF8EC', ink: '#5A3824', sub: '#8A6A55',
    paint(c) {
      fill(c, '#FFF8EC'); c.fillStyle = '#EBD8B8';
      for (let y = 22; y < H; y += 44) for (let x = 22; x < W; x += 44) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
    } },
  { id: 'choco', name: '초코', sw: '#5A3824', ink: '#FFF3DA', sub: '#E8CFA8',
    paint(c, rnd) {
      fill(c, '#5A3824');
      const cols = ['#F7D48F', '#F6D6CF', '#D9F0E7', '#FFFFFF', '#F28B7D'];
      c.lineWidth = 9; c.lineCap = 'round';
      for (let i = 0; i < 260; i++) {
        const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI, col = cols[(rnd() * cols.length) | 0];
        if (inText(x, y)) continue;
        c.strokeStyle = col; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20); c.stroke();
      }
    } },
  { id: 'check', name: '딸기 체크', sw: 'repeating-linear-gradient(90deg,#F2A79E 0 6px,#FFFDF8 6px 12px)', ink: '#A8352B', sub: '#C0685F', plate: '#FFFDF8',
    paint(c) {
      fill(c, '#FFFDF8'); c.fillStyle = 'rgba(217,72,59,.34)';
      for (let x = 0; x < W; x += 108) c.fillRect(x, 0, 54, H);
      for (let y = 0; y < H; y += 108) c.fillRect(0, y, W, 54);
    } },
  { id: 'mint', name: '민트', sw: 'repeating-linear-gradient(135deg,#BFE5D6 0 6px,#E6F5EF 6px 12px)', ink: '#2B6F5B', sub: '#3E9A7E', plate: '#F4FBF8',
    paint(c) {
      fill(c, '#E6F5EF'); c.strokeStyle = '#BFE5D6'; c.lineWidth = 34;
      for (let k = -H; k < W + H; k += 96) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k - H, H); c.stroke(); }
    } },
  { id: 'night', name: '까만 필름', sw: '#1E1A18', ink: '#FFFFFF', sub: '#BDB5AE',
    paint(c) {
      fill(c, '#1E1A18'); c.fillStyle = '#F4EFE8';
      for (let y = 40; y < H - 40; y += 96) { rr(c, 24, y, 40, 54, 9); c.fill(); rr(c, W - 64, y, 40, 54, 9); c.fill(); }
    } },
  { id: 'xmas', name: '크리스마스', sw: 'linear-gradient(135deg,#1F5B43 0 55%,#D9483B 55%)', ink: '#FFF8EC', sub: '#F7D48F',
    paint(c, rnd) {
      fill(c, '#1F5B43');
      for (let i = 0; i < 300; i++) { // 눈
        const x = rnd() * W, y = rnd() * H, r = 3 + rnd() * 7, al = 0.35 + rnd() * 0.6;
        if (inText(x, y)) continue;
        c.fillStyle = `rgba(255,255,255,${al})`; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      }
      for (const y of [0, H - 26]) { // 위아래 사탕 줄무늬
        c.save(); c.beginPath(); c.rect(0, y, W, 26); c.clip(); c.fillStyle = '#FFFFFF'; c.fillRect(0, y, W, 26);
        c.strokeStyle = '#D9483B'; c.lineWidth = 16;
        for (let x = -40; x < W + 40; x += 44) { c.beginPath(); c.moveTo(x, y + 30); c.lineTo(x + 30, y - 4); c.stroke(); }
        c.restore();
      }
      tree(c, 130, H - 56, 190); tree(c, W - 130, H - 56, 190);
    } },
  { id: 'newyear', name: '새해', sw: 'linear-gradient(160deg,#1B2148 0 60%,#F2B84B 60%)', ink: '#FFE9A8', sub: '#F3C977',
    paint(c, rnd) {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#141A3C'); g.addColorStop(0.8, '#2A2458'); g.addColorStop(1, '#5B3466');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const cols = ['#F7D48F', '#F2B84B', '#FFFFFF', '#F28B7D'];
      for (let i = 0; i < 320; i++) { // 금빛 색종이
        const x = rnd() * W, y = rnd() * H, s = 5 + rnd() * 9;
        if (inText(x, y)) { rnd(); rnd(); rnd(); rnd(); continue; }
        c.save(); c.translate(x, y); c.rotate(rnd() * 3.14); c.globalAlpha = 0.55 + rnd() * 0.45; c.fillStyle = cols[(rnd() * cols.length) | 0];
        if (rnd() < 0.5) c.fillRect(-s, -s / 3, s * 2, s / 1.5); else { c.beginPath(); c.arc(0, 0, s / 2, 0, 7); c.fill(); }
        c.restore();
      }
      burst(c, 128, H - 190, 74, '#F7D48F'); burst(c, W - 128, H - 190, 74, '#F28B7D'); burst(c, W - 200, H - 70, 36, '#FFFFFF', 10); burst(c, 196, H - 62, 30, '#F3C977', 10);
    } },
];
export const frameOf = (id) => FRAMES.find((f) => f.id === id) || FRAMES[0];

// 컷 하나 그리기. 둘이 찍은 컷은 왼쪽 반이 방 주인, 오른쪽 반이 손님.
// cut = { full: 내 사진(4:3), split: 둘이 찍은 컷인지, host / guest: 반쪽 사진(2:3) }
export function drawCut(c, cut, x, y, w, h) {
  if (cut && cut.split && cut.host && cut.guest) {
    c.drawImage(cut.host, x, y, w / 2, h); c.drawImage(cut.guest, x + w / 2, y, w / 2, h);
  } else if (cut && cut.full) c.drawImage(cut.full, x, y, w, h);
  else {
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(90,56,36,.35)'; c.font = `900 ${Math.round(h * 0.3)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('?', x + w / 2, y + h / 2);
  }
}

// opt = { frame, caption, date(보일지), dateText }
export function drawStrip(cv, cuts, opt) {
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), f = frameOf(opt.frame);
  f.paint(c, seeded(20261114));
  for (let i = 0; i < 4; i++) {
    const y = PAD + i * (PH + GAP);
    c.save(); rr(c, PAD, y, PW, PH, 14); c.clip(); drawCut(c, cuts[i], PAD, y, PW, PH); c.restore();
  }
  // 아래 글자: 한마디, 날짜, 작은 간판
  const cap = (opt.caption || '').trim(), lines = [];
  if (cap) lines.push({ t: cap, size: 76, w: 900, col: f.ink });
  if (opt.date && opt.dateText) lines.push({ t: opt.dateText, size: cap ? 44 : 60, w: 700, col: cap ? f.sub : f.ink });
  lines.push({ t: '놀자방 · 네 컷 사진관', size: 28, w: 600, col: f.sub });
  const total = lines.reduce((s, l) => s + l.size * 1.32, 0);
  let y = FOOT_Y + (H - FOOT_Y - total) / 2 - 4;
  if (f.plate) { c.fillStyle = f.plate; rr(c, 200, y - 16, W - 400, total + 36, 30); c.fill(); }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const l of lines) {
    let size = l.size;
    const maxW = Math.min(l.w, W - 500);
    c.font = `${l.size > 30 ? 800 : 600} ${size}px ${FONT}`;
    while (c.measureText(l.t).width > maxW && size > 20) { size -= 2; c.font = `800 ${size}px ${FONT}`; }
    c.fillStyle = l.col; c.fillText(l.t, W / 2, y + l.size * 0.66);
    y += l.size * 1.32;
  }
  return cv;
}
