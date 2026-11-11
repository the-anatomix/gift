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
const SHOT_MINE = { tgt: [0.52, 1.6, -1.5], dir: [0.1, 0.2, 1], w: 2.2, h: 1.62 };
const STEPS = ['반죽', '자르기', '굽기', '초콜릿'], KEYS = ['dough', 'cut', 'oven', 'choco'];
const verdict = (v) => (v === 2 ? 'PERFECT' : v === 1 ? 'GOOD' : '—');

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
  c.fillStyle = '#D9483B'; c.textAlign = 'center'; c.font = `700 46px ${FONT}`; c.fillText(gift && gift.mine ? '내가 만들었어 ♥' : '잘 받았어 ♥', 0, fh / 2 - 26);
  c.fillStyle = 'rgba(217,72,59,.5)'; c.save(); c.translate(0, -fh / 2 - 2); c.rotate(-0.06); c.fillRect(-56, -16, 112, 32); c.restore(); // 붙인 테이프
  c.restore();
}
function chipTitle(x, y) { // 등급 띠
  if (!gift || !gift.q) return;
  const t = gift.q === 2 ? '🥇 최고급 수제 과자' : gift.q === 1 ? '🥈 고급 수제 과자' : '🥉 수제 과자';
  c.textAlign = 'center'; c.font = `900 38px ${SANS}`; const tw = c.measureText(t).width + 70;
  const gg = c.createLinearGradient(0, y, 0, y + 68);
  if (gift.q === 2) { gg.addColorStop(0, '#F9E3A2'); gg.addColorStop(1, '#E7B441'); } else if (gift.q === 1) { gg.addColorStop(0, '#F1F2F4'); gg.addColorStop(1, '#C3C7CE'); } else { gg.addColorStop(0, '#F3D9BF'); gg.addColorStop(1, '#D29A66'); }
  c.fillStyle = gg; rr(x, y, tw, 68, 34); c.fill();
  c.fillStyle = '#4A3312'; c.fillText(t, x + tw / 2, y + 48);
}
function background() {
  const bg = c.createRadialGradient(W / 2, 520, 80, W / 2, 620, 1000);
  bg.addColorStop(0, '#FFF8EA'); bg.addColorStop(0.55, '#FBE6D2'); bg.addColorStop(1, '#F0CDB4');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
}
function footer() {
  c.textAlign = 'center'; c.fillStyle = '#8A6A55'; c.font = `700 28px ${SANS}`;
  c.fillText('갓 구운 선물 · 미니 주방' + (SITE.account ? ' · @' + SITE.account : ''), W / 2, 1312);
}
// 만든 사람의 카드: 완성된 과자 + 과정 사진 네 장 + 한마디
function drawMine() {
  background();
  if (scene) c.drawImage(scene, 0, 20, W, 600);
  chipTitle(50, 44);
  if (photo) polaroid(880, 250, 0.09);
  c.textAlign = 'left'; c.fillStyle = '#5A3824'; c.font = `700 54px ${FONT}`; c.fillText('이렇게 만들었어요', 56, 690);
  const fw = 236, gap = 12, x0 = (W - (fw * 4 + gap * 3)) / 2, y0 = 718;
  STEPS.forEach((name, i) => {
    const x = x0 + i * (fw + gap), v = gift.p ? gift.p[i] : 0, shot = gift.shots && gift.shots[KEYS[i]];
    c.save(); c.translate(x + fw / 2, y0 + 165); c.rotate((i % 2 ? 1 : -1) * 0.018);
    c.shadowColor = 'rgba(59,38,25,.25)'; c.shadowBlur = 22; c.shadowOffsetY = 10; c.fillStyle = '#FFFFFF'; rr(-fw / 2, -165, fw, 330, 10); c.fill();
    c.shadowColor = 'transparent';
    if (shot) c.drawImage(shot, -fw / 2 + 12, -153, fw - 24, fw - 24);
    else { c.fillStyle = '#F7E9D2'; c.fillRect(-fw / 2 + 12, -153, fw - 24, fw - 24); c.fillStyle = '#C9B299'; c.textAlign = 'center'; c.font = `700 34px ${SANS}`; c.fillText(v ? '완성' : '안 함', 0, -34); }
    c.textAlign = 'center'; c.fillStyle = '#4A2F1F'; c.font = `900 34px ${SANS}`; c.fillText(name, 0, 100);
    c.fillStyle = v === 2 ? '#E0A21B' : '#8A6A55'; c.font = `900 ${v === 2 ? 30 : 28}px ${SANS}`; c.fillText(verdict(v), 0, 142);
    c.restore();
  });
  // 한마디
  const py = 1090, ph = 170;
  c.save(); c.shadowColor = 'rgba(59,38,25,.25)'; c.shadowBlur = 30; c.shadowOffsetY = 12; c.fillStyle = '#FFFDF6'; rr(70, py, W - 140, ph, 26); c.fill(); c.restore();
  c.strokeStyle = '#E6CFA2'; c.lineWidth = 3; rr(82, py + 12, W - 164, ph - 24, 18); c.stroke();
  c.fillStyle = '#4A2F1F'; c.textAlign = 'left'; c.font = `400 46px ${FONT}`;
  const lines = wrap(gift.m || '반죽하고, 자르고, 굽고, 꾸며서 직접 만든 막대과자예요.', W - 250, 2);
  lines.forEach((ln, i) => c.fillText(ln, 120, py + (lines.length === 1 ? 102 : 72) + i * 58));
  footer();
}
function draw() {
  if (gift && gift.mine) { drawMine(); return; }
  background();
  if (scene) c.drawImage(scene, 0, 30, W, SCENE_H);
  chipTitle(50, 44);
  if (photo) polaroid(852, 300, 0.09);
  // 편지지
  let py = 870, ph = 390;
  if (gift && gift.p && gift.p.some((v) => v)) { // 만든 과정: 자리별 결과
    const cw = 232, gap = 12, x0 = (W - (cw * 4 + gap * 3)) / 2;
    STEPS.forEach((name, i) => {
      const v = gift.p[i], x = x0 + i * (cw + gap);
      c.fillStyle = 'rgba(255,253,246,.92)'; rr(x, 840, cw, 58, 29); c.fill();
      c.textAlign = 'center'; c.font = `900 26px ${SANS}`; c.fillStyle = v === 2 ? '#C98A0E' : '#6E5646';
      c.fillText(name + ' ' + verdict(v), x + cw / 2, 878);
    });
    py = 918; ph = 348;
  }
  const px = 70, pw = W - 140;
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
  if (gift && gift.to) { c.font = `700 52px ${FONT}`; c.fillText(gift.to, px + 56, y); y += 66; }
  c.font = `400 48px ${FONT}`;
  const room = gift && gift.fr ? 3 : 4;
  wrap(gift ? gift.m : '', pw - 112, (gift && gift.to ? room : room + 1) - (ph < 380 ? 1 : 0)).forEach((ln) => { c.fillText(ln, px + 56, y); y += 60; });
  if (gift && gift.fr) { c.textAlign = 'right'; c.font = `700 46px ${FONT}`; c.fillText(gift.fr, px + pw - 56, py + ph - 44); }
  footer();
}
function refresh() {
  draw();
  $('bgPhoto').textContent = photo ? '다른 사진으로' : '내 사진 넣기';
  $('bgNoPhoto').hidden = !photo;
  cv.toBlob((b) => {
    if (!b) return;
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastBlob = b; lastUrl = URL.createObjectURL(b);
    // 그림으로 보여 줘서 길게 눌러 저장할 수도 있게. 앱 안 브라우저는 주소형(blob) 그림을 저장하지 못하는 경우가 많아 그림 내용을 직접 넣는다
    $('bgImg').src = window.__inapp ? cv.toDataURL('image/png') : lastUrl;
  }, 'image/png');
}
export async function openBrag(g) {
  gift = g;
  scene = g.mine ? K.snapScene(W, 600, SHOT_MINE, true) : K.snapScene(W, SCENE_H, SHOT);
  $('brag').hidden = false;
  $('bgNote').hidden = true;
  if (window.__inapp && !canShareFiles()) noShare(false); // 앱 안 브라우저면 처음부터 알려 준다
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
  noShare(true);
});
// 그림 공유가 안 되는 브라우저(카카오톡 안 등): 말없이 내려받지 않고 방법을 알려 준다
function canShareFiles() {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'a.png', { type: 'image/png' })] })); } catch (_) { return false; }
}
function noShare(clicked) {
  const kakaoGift = window.__inappKind === 'kakao' && gift && !gift.mine && /^#g=/.test(location.hash); // 받은 선물은 주소에 담겨 있어 기본 브라우저로 그대로 넘어간다
  $('bgNote').hidden = false;
  $('bgExternal').hidden = !kakaoGift;
  $('bgNoteSub').textContent = kakaoGift ? '기본 브라우저로 열면 바로 공유할 수 있어요. 또는 그림을 길게 눌러 저장하세요.' : '그림을 길게 눌러 저장하거나 "저장"을 누른 뒤 보내 주세요.';
  if (clicked) K.toast('이 브라우저에서는 그림 공유가 막혀 있어요');
}

window.__brag = { openBrag, canvas: cv, hasPhoto: () => !!photo, hasScene: () => !!scene };
