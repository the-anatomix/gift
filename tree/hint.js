// 옆으로 넘기는 목록(.scroll)의 양 끝에 ‹ › 띠를 띄운다: 더 있다는 것을 알려 주고, 누르면 그쪽으로 넘긴다.
// 목록의 구조는 건드리지 않고 화면 위에 따로 띄운다(position: fixed). 보이는 목록만 0.25초마다 맞춘다.
const css = document.createElement('style');
css.textContent = '.sarrow{position:fixed;z-index:30;width:20px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#5A3A22;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation}'
  + '.sarrow.l{background:linear-gradient(90deg,rgba(255,250,242,.96) 55%,rgba(255,250,242,0));border-radius:10px 0 0 10px}.sarrow.r{background:linear-gradient(270deg,rgba(255,250,242,.96) 55%,rgba(255,250,242,0));border-radius:0 10px 10px 0}';
document.head.appendChild(css);
const made = new Map(); // 목록 → [왼쪽 띠, 오른쪽 띠]
function arrows(box) {
  let a = made.get(box);
  if (a) return a;
  a = [-1, 1].map((d) => {
    const e = document.createElement('div');
    e.className = 'sarrow ' + (d < 0 ? 'l' : 'r'); e.textContent = d < 0 ? '‹' : '›'; e.hidden = true;
    e.setAttribute('role', 'button'); e.setAttribute('aria-label', d < 0 ? '앞쪽 보기' : '더 보기');
    e.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    e.addEventListener('click', (ev) => { ev.stopPropagation(); box.scrollBy({ left: d * Math.max(120, box.clientWidth * 0.7), behavior: 'smooth' }); });
    document.body.appendChild(e);
    return e;
  });
  made.set(box, a);
  return a;
}
export function scrollHints() {
  for (const box of document.querySelectorAll('.scroll')) {
    const r = box.getBoundingClientRect(), over = box.scrollWidth - box.clientWidth;
    const vis = r.width > 0 && r.height > 0 && over > 4 && !box.classList.contains('open');
    if (!vis && !made.has(box)) continue;
    const [L, R] = arrows(box);
    L.hidden = !vis || box.scrollLeft <= 4; R.hidden = !vis || over - box.scrollLeft <= 4;
    for (const [e, x] of [[L, r.left], [R, r.right - 20]]) if (!e.hidden) { e.style.left = x + 'px'; e.style.top = r.top + 'px'; e.style.height = r.height + 'px'; }
  }
  for (const [box, a] of made) if (!box.isConnected) { a.forEach((e) => e.remove()); made.delete(box); }
}
setInterval(scrollHints, 250);
window.__hint = { get shown() { return [...document.querySelectorAll('.sarrow:not([hidden])')].map((e) => e.className.slice(-1)); } };
