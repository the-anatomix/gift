// 자랑 카드: 받은 선물(상자·꺼낸 과자·편지)을 사진 한 장으로 만들어 저장·공유한다.
// 원하면 자기 사진을 폴라로이드처럼 흰 테두리에 넣어 사진 속에 붙일 수 있다.
// 사진은 이 기기 안에서 그림에 합쳐질 뿐, 어디에도 보내거나 저장하지 않는다.
import { kitchen as K } from './app.js';
import { SITE } from './theme.js';

const $ = (id) => document.getElementById(id);
const W = 1080, H = 1350, SCENE_H = 850;
const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
const c = cv.getContext('2d');
let gift = null, photo = null, scene = null, lastUrl = null, lastBlob = null;
const FONT = '"Gaegu","Jua","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
const SANS = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
// 상자, 꺼낸 과자, 반죽이가 한 화면에 들어오는 구도
const SHOT = { tgt: [0.5, 1.62, -1.5], dir: [0.1, 0.2, 1], w: 1.55, h: 1.7 };

function rr(x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function wrap(text, maxW, maxLines) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of Array.from(para)) {
      if (c.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; } else line += ch;
    }
    out.push(line);
  }
  if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].slice(0, -1) + '…'; }
  return out;
}
function polaroid(x, y, rot) { // 흰 테두리 사진
  const fw = 330, fh = 400, ph = 290;
  c.save(); c.translate(x, y); c.rotate(rot);
  c.shadowColor = 'rgba(59,38,25,.35)'; c.shadowBlur = 30; c.shadowOffsetY = 14;
  c.fillStyle = '#FFFFFF'; rr(-fw / 2, -fh / 2, fw, fh, 8); c.fill();
  c.shadowColor = 'transparent';
  const px = -ph / 2, py = -fh / 2 + 20;
  c.save(); c.beginPath(); c.rect(px, py, ph, ph); c.clip();
  const s = Math.max(ph / photo.width, ph / photo.height), w = photo.width * s, h = photo.height * s;
  c.drawImage(photo, -w / 2, py + ph / 2 - h / 2, w, h); c.restore();
  c.fillStyle = '#D9483B'; c.textAlign = 'center'; c.font = `700 46px ${FONT}`; c.fillText('잘 받았어 ♥', 0, fh / 2 - 26);
  c.fillStyle = 'rgba(217,72,59,.5)'; c.save(); c.translate(0, -fh / 2 - 2); c.rotate(-0.06); c.fillRect(-56, -16, 112, 32); c.restore(); // 붙인 테이프
  c.restore();
}
function draw() {
  const bg = c.createRadialGradient(W / 2, 520, 80, W / 2, 620, 1000);
  bg.addColorStop(0, '#FFF8EA'); bg.addColorStop(0.55, '#FBE6D2'); bg.addColorStop(1, '#F0CDB4');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  if (scene) c.drawImage(scene, 0, 30, W, SCENE_H);
  // 등급 띠
  if (gift && gift.q) {
    const t = gift.q === 2 ? '🥇 최고급 수제 과자' : gift.q === 1 ? '🥈 고급 수제 과자' : '🥉 수제 과자';
    c.textAlign = 'center'; c.font = `900 38px ${SANS}`; const tw = c.measureText(t).width + 70;
    const gg = c.createLinearGradient(0, 40, 0, 110);
    if (gift.q === 2) { gg.addColorStop(0, '#F9E3A2'); gg.addColorStop(1, '#E7B441'); } else if (gift.q === 1) { gg.addColorStop(0, '#F1F2F4'); gg.addColorStop(1, '#C3C7CE'); } else { gg.addColorStop(0, '#F3D9BF'); gg.addColorStop(1, '#D29A66'); }
    c.fillStyle = gg; rr(50, 44, tw, 68, 34); c.fill();
    c.fillStyle = '#4A3312'; c.fillText(t, 50 + tw / 2, 92);
  }
  if (photo) polaroid(852, 300, 0.09);
  // 편지지
  const px = 70, py = 870, pw = W - 140, ph = 390;
  c.save();
  c.shadowColor = 'rgba(59,38,25,.3)'; c.shadowBlur = 40; c.shadowOffsetY = 16;
  const pg = c.createRadialGradient(W / 2, py, 40, W / 2, py + ph, 700); pg.addColorStop(0, '#FFFEFA'); pg.addColorStop(1, '#FBEBD3');
  c.fillStyle = pg; rr(px, py, pw, ph, 30); c.fill();
  c.shadowColor = 'transparent'; c.strokeStyle = '#E6CFA2'; c.lineWidth = 3; rr(px + 13, py + 13, pw - 26, ph - 26, 20); c.stroke();
  c.restore();
  c.strokeStyle = '#E0C79A'; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2 - 110, py + 52); c.lineTo(W / 2 - 34, py + 52); c.moveTo(W / 2 + 34, py + 52); c.lineTo(W / 2 + 110, py + 52); c.stroke();
  c.fillStyle = '#D9483B'; c.textAlign = 'center'; c.font = `400 30px ${SANS}`; c.fillText('♥', W / 2, py + 63);
  c.fillStyle = '#4A2F1F'; c.textAlign = 'left';
  let y = py + 122;
  if (gift && gift.to) { c.font = `700 52px ${FONT}`; c.fillText(gift.to + '에게', px + 56, y); y += 66; }
  c.font = `400 48px ${FONT}`;
  const room = gift && gift.fr ? 3 : 4;
  wrap(gift ? gift.m : '', pw - 112, gift && gift.to ? room : room + 1).forEach((ln) => { c.fillText(ln, px + 56, y); y += 60; });
  if (gift && gift.fr) { c.textAlign = 'right'; c.font = `700 46px ${FONT}`; c.fillText('— ' + gift.fr + ' 드림', px + pw - 56, py + ph - 44); }
  c.textAlign = 'center'; c.fillStyle = '#8A6A55'; c.font = `700 28px ${SANS}`;
  c.fillText('갓 구운 선물 · 미니 주방' + (SITE.account ? ' · @' + SITE.account : ''), W / 2, 1312);
}
function refresh() {
  draw();
  $('bgPhoto').textContent = photo ? '다른 사진으로' : '내 사진 넣기';
  $('bgNoPhoto').hidden = !photo;
  cv.toBlob((b) => {
    if (!b) return;
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastBlob = b; lastUrl = URL.createObjectURL(b); $('bgImg').src = lastUrl; // 그림으로 보여 줘서 길게 눌러 저장할 수도 있게
  }, 'image/png');
}
export async function openBrag(g) {
  gift = g;
  scene = K.snapScene(W, SCENE_H, SHOT);
  $('brag').hidden = false;
  refresh();
  try { await document.fonts.load('700 60px Gaegu'); refresh(); } catch (_) { /* 기본 글꼴로 */ }
}
$('bgClose').addEventListener('click', () => { $('brag').hidden = true; });
$('bgNoPhoto').addEventListener('click', () => { photo = null; refresh(); });
$('bgPhoto').addEventListener('click', () => $('bgFile').click());
$('bgFile').addEventListener('change', () => {
  const f = $('bgFile').files && $('bgFile').files[0]; $('bgFile').value = '';
  if (!f || !/^image\//.test(f.type)) return;
  const url = URL.createObjectURL(f), img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); photo = img; refresh(); };
  img.onerror = () => { URL.revokeObjectURL(url); K.toast('사진을 읽지 못했어요'); };
  img.src = url;
});
function save() {
  if (!lastBlob) return;
  const a = document.createElement('a'); a.href = lastUrl; a.download = 'gift-card.png';
  document.body.appendChild(a); a.click(); a.remove();
  K.toast('저장이 안 되면 그림을 길게 눌러 저장하세요');
}
$('bgSave').addEventListener('click', save);
$('bgShare').addEventListener('click', async () => {
  if (!lastBlob) return;
  try {
    const f = new File([lastBlob], 'gift-card.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: '갓 구운 선물' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  save();
});

window.__brag = { openBrag, canvas: cv, hasPhoto: () => !!photo, hasScene: () => !!scene };
