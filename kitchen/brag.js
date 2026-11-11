// 자랑 카드: 받은 과자를 먹는 모습의 그림 한 장을 만들어 저장·공유한다.
// 아바타(반죽이) 또는 자기 사진을 넣을 수 있다. 사진은 이 기기 안에서 그림에 합쳐질 뿐, 어디에도 보내거나 저장하지 않는다.
import { kitchen as K } from './app.js';
import { SITE } from './theme.js';

const $ = (id) => document.getElementById(id);
const W = 1080, H = 1350;
const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
const c = cv.getContext('2d');
let gift = null, photo = null, stickImg = null, lastUrl = null, lastBlob = null;
const FONT = '"Gaegu","Jua","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
const SANS = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';

function rr(x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function wrap(text, maxW, maxLines) {
  const out = []; let line = '';
  for (const ch of Array.from(String(text).replace(/\s+/g, ' ').trim())) {
    if (c.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; if (out.length === maxLines) break; } else line += ch;
  }
  if (out.length < maxLines && line) out.push(line);
  else if (out.length === maxLines && line) out[maxLines - 1] = out[maxLines - 1].slice(0, -1) + '…';
  return out;
}
function hat(cx, top, s) { // 요리사 모자
  c.fillStyle = '#FFFFFF'; c.strokeStyle = '#E3D2B6'; c.lineWidth = 5 * s;
  rr(cx - 62 * s, top + 40 * s, 124 * s, 70 * s, 12 * s); c.fill(); c.stroke();
  for (const [dx, dy, r] of [[-52, 22, 46], [52, 22, 46], [0, -6, 56]]) { c.beginPath(); c.arc(cx + dx * s, top + dy * s, r * s, 0, 7); c.fill(); c.stroke(); }
  c.beginPath(); c.arc(cx, top + 20 * s, 50 * s, 0, 7); c.fill(); rr(cx - 56 * s, top + 20 * s, 112 * s, 60 * s, 4 * s); c.fill();
}
function avatar(cx, cy, r) { // 반죽이
  const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#FFE9B8'); g.addColorStop(1, '#F1C877');
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
  c.strokeStyle = '#3B2619'; c.lineWidth = 12; c.lineCap = 'round';   // 웃는 눈
  for (const sx of [-1, 1]) { c.beginPath(); c.arc(cx + sx * r * 0.36, cy - r * 0.02, r * 0.13, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  c.fillStyle = 'rgba(242,139,125,.8)';
  for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(cx + sx * r * 0.58, cy + r * 0.24, r * 0.16, r * 0.1, 0, 0, 7); c.fill(); }
  hat(cx, cy - r - 96, 1.5);
}
function face(cx, cy, r) { // 자기 사진: 가운데를 동그랗게 잘라 넣는다
  c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip();
  const s = Math.max((2 * r) / photo.width, (2 * r) / photo.height), w = photo.width * s, h = photo.height * s;
  c.drawImage(photo, cx - w / 2, cy - h / 2, w, h); c.restore();
  c.strokeStyle = '#FFFFFF'; c.lineWidth = 18; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
  c.strokeStyle = '#E9C9A6'; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, r + 9, 0, 7); c.stroke();
  hat(cx, cy - r - 80, 1.25);
}
function draw() {
  const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#FFF8EA'); bg.addColorStop(1, '#F8D9C2');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  const dots = ['#F28B9B', '#F6C85F', '#9AD0C2', '#D9483B', '#FFFFFF'];
  for (let i = 0; i < 46; i++) { // 뿌려진 색종이 (늘 같은 자리)
    const x = (i * 197 + 61) % W, y = (i * 331 + 97) % H; if (y > 250 && y < 1000 && x > 150 && x < 930) continue;
    c.fillStyle = dots[i % 5]; c.globalAlpha = 0.75; c.save(); c.translate(x, y); c.rotate(i); rr(-13, -5, 26, 10, 5); c.fill(); c.restore();
  }
  c.globalAlpha = 1;
  c.textAlign = 'center'; c.fillStyle = '#5A3824'; c.font = `700 78px ${FONT}`;
  c.fillText('갓 구운 선물을 받았어요!', W / 2, 138);
  if (gift && gift.q) {
    const t = gift.q === 2 ? '🏅 최고급 수제 초콜릿' : '🎖 고급 수제 초콜릿';
    c.font = `900 38px ${SANS}`; const tw = c.measureText(t).width + 70;
    const gg = c.createLinearGradient(0, 170, 0, 240);
    if (gift.q === 2) { gg.addColorStop(0, '#F9E3A2'); gg.addColorStop(1, '#E7B441'); } else { gg.addColorStop(0, '#F1F2F4'); gg.addColorStop(1, '#C3C7CE'); }
    c.fillStyle = gg; rr(W / 2 - tw / 2, 172, tw, 68, 34); c.fill();
    c.fillStyle = '#4A3312'; c.fillText(t, W / 2, 220);
  }
  // 주인공과 과자
  const cx = 420, cy = 640, r = 250;
  if (photo) face(cx, cy, r); else avatar(cx, cy, r);
  const mx = photo ? cx + 10 : cx + 30, my = photo ? cy + r * 0.46 : cy + r * 0.42; // 입 자리(사진은 어림)
  if (!photo) { c.fillStyle = '#3B2619'; c.beginPath(); c.ellipse(mx, my, 44, 38, 0, 0, 7); c.fill(); }
  if (stickImg) {
    const len = 570, sw = (stickImg.width / stickImg.height) * len;
    c.save(); c.translate(mx, my); c.rotate((-52 * Math.PI) / 180);
    c.shadowColor = 'rgba(59,38,25,.28)'; c.shadowBlur = 24; c.shadowOffsetY = 12;
    c.drawImage(stickImg, -sw / 2, -34, sw, len); c.restore();
  }
  c.fillStyle = '#C8935A'; for (const [dx, dy, s] of [[-70, 66, 9], [-36, 96, 6], [60, -70, 7]]) { c.beginPath(); c.arc(mx + dx, my + dy, s, 0, 7); c.fill(); } // 부스러기
  // 말풍선
  c.save(); c.translate(820, 360); c.rotate(0.1); c.fillStyle = '#FFFFFF'; rr(-130, -64, 260, 128, 60); c.fill();
  c.beginPath(); c.moveTo(-70, 56); c.lineTo(-118, 112); c.lineTo(-22, 60); c.fill();
  c.fillStyle = '#D9483B'; c.font = `700 74px ${FONT}`; c.fillText('냠냠!', 0, 26); c.restore();
  // 편지 한 줄 (과자와 겹치지 않게 아래에)
  if (gift && gift.m) {
    c.save(); c.translate(W / 2, 1118); c.rotate(-0.02);
    c.shadowColor = 'rgba(59,38,25,.22)'; c.shadowBlur = 26; c.shadowOffsetY = 10; c.fillStyle = '#FFFDF6'; rr(-450, -110, 900, 220, 10); c.fill();
    c.shadowColor = 'transparent'; c.fillStyle = 'rgba(217,72,59,.5)'; c.save(); c.rotate(-0.05); c.fillRect(-70, -128, 140, 34); c.restore();
    c.fillStyle = '#3B2619'; c.textAlign = 'left'; c.font = `400 50px ${FONT}`;
    wrap(gift.m, 800, 2).forEach((ln, i) => c.fillText(ln, -400, -34 + i * 62));
    if (gift.fr) { c.textAlign = 'right'; c.font = `700 44px ${FONT}`; c.fillText(gift.fr + ' 드림', 400, 84); }
    c.restore();
  }
  c.textAlign = 'center'; c.fillStyle = '#8A6A55'; c.font = `700 30px ${SANS}`;
  c.fillText('갓 구운 선물 · 미니 주방' + (SITE.account ? ' · @' + SITE.account : ''), W / 2, 1305);
}
function refresh() {
  draw();
  $('bgAvatar').setAttribute('aria-pressed', String(!photo)); $('bgPhoto').setAttribute('aria-pressed', String(!!photo));
  cv.toBlob((b) => {
    if (!b) return;
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastBlob = b; lastUrl = URL.createObjectURL(b); $('bgImg').src = lastUrl; // 그림으로 보여 줘서 길게 눌러 저장할 수도 있게
  }, 'image/png');
}
export async function openBrag(g) {
  gift = g;
  stickImg = K.snapStick();
  $('brag').hidden = false;
  refresh();
  try { await document.fonts.load(`700 60px Gaegu`); refresh(); } catch (_) { /* 기본 글꼴로 */ }
}
function close() { $('brag').hidden = true; }
$('bgClose').addEventListener('click', close);
$('bgAvatar').addEventListener('click', () => { photo = null; refresh(); });
$('bgPhoto').addEventListener('click', () => $('bgFile').click());
$('bgFile').addEventListener('change', () => {
  const f = $('bgFile').files && $('bgFile').files[0]; $('bgFile').value = '';
  if (!f || !/^image\//.test(f.type)) return;
  const url = URL.createObjectURL(f), img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); photo = img; refresh(); };
  img.onerror = () => { URL.revokeObjectURL(url); K.toast('사진을 읽지 못했어요'); };
  img.src = url;
});
const fileOf = () => new File([lastBlob], 'gift-card.png', { type: 'image/png' });
$('bgShare').addEventListener('click', async () => {
  if (!lastBlob) return;
  try {
    const f = fileOf();
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: '갓 구운 선물' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  save();
});
function save() {
  if (!lastBlob) return;
  const a = document.createElement('a'); a.href = lastUrl; a.download = 'gift-card.png';
  document.body.appendChild(a); a.click(); a.remove();
  K.toast('저장이 안 되면 그림을 길게 눌러 저장하세요');
}
$('bgSave').addEventListener('click', save);

window.__brag = { openBrag, canvas: cv, hasPhoto: () => !!photo, hasStick: () => !!stickImg };
