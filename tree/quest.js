// 숨은 황금열쇠와 퀘스트.
//   1층 거실 뒤쪽 구석 바닥에 작은 금빛 열쇠가 놓여 있다. 누르면 퀘스트 판이 열리고, 퀘스트를 모두 깨면 "황금열쇠 쓰기" 로
//   마스터키와 같은 권한을 얻는다(master.js 의 earn). 암호는 묻지 않는다. 암호로 켠 마스터는 사람별로 이 열쇠를 끄고 켤 수 있다.
//   퀘스트 진행은 이 기기에 남는다(localStorage 의 tree.quest). 놀이 코드가 mark(퀘스트, 값) 으로 알린다:
//     kind 'max'   가장 높은 값이 goal 이상이면 달성 (점수)
//     kind 'count' 부를 때마다 더해서 goal 이상이면 달성
//     kind 'set'   서로 다른 값이 goal 가지 모이면 달성
//   열쇠를 한 번이라도 찾은 뒤에만 달성 알림이 뜬다(찾기 전에는 퀘스트가 있는 줄 모른다).
import { THREE } from './kit.js';

const NS = (() => { try { const n = new URLSearchParams(location.search).get('ns'); return n ? '.' + n : ''; } catch (_) { return ''; } })();
const SLOT = 'tree.quest' + NS, SEEN = 'tree.quest.seen' + NS;
export const KEY_AT = { x: -3.72, y: 0.03, z: -3.72 };
export const QUESTS = [
  { id: 'dart', icon: '🎯', name: '다트 한 판에 150점', kind: 'max', goal: 150 },
  { id: 'fire', icon: '🔥', name: '마시멜로 굽기 95점', kind: 'max', goal: 95 },
  { id: 'arcade', icon: '🕹️', name: '오락기 별 받기 40점', kind: 'max', goal: 40 },
  { id: 'pool', icon: '🎱', name: '당구 90점 (일곱 번 안에 공 여섯)', kind: 'max', goal: 90 },
  { id: 'sing', icon: '🎤', name: '노래방 95점', kind: 'max', goal: 95 },
  { id: 'songs', icon: '🎶', name: '노래 세 곡 모두 85점 넘기', kind: 'set', goal: 3 },
  { id: 'cook', icon: '👨‍🍳', name: '요리 대결 심사 90점', kind: 'max', goal: 90 },
  { id: 'brew', icon: '☕', name: '완벽한 커피 열 잔 내리기', kind: 'count', goal: 10 },
  { id: 'menu', icon: '🥛', name: '커피 세 가지를 모두 완벽하게', kind: 'set', goal: 3 },
  { id: 'pizza', icon: '🍕', name: '완벽하게 구운 피자 세 판', kind: 'count', goal: 3 },
  { id: 'foods', icon: '🍽️', name: '서로 다른 먹을 것 서른 가지 먹기', kind: 'set', goal: 30 },
  { id: 'books', icon: '📖', name: '이야기책 세 권 끝까지 읽기', kind: 'set', goal: 3 },
  { id: 'snow', icon: '❄️', name: '눈싸움에서 친구 쉰 번 맞히기', kind: 'count', goal: 50 },
  { id: 'team', icon: '🚩', name: '눈싸움 팀전 세 번 이기기', kind: 'set', goal: 3 },
  { id: 'snowman', icon: '⛄', name: '눈사람 다섯 개 만들기', kind: 'count', goal: 5 },
  { id: 'seek', icon: '🔎', name: '숨바꼭질 술래로 세 번 이기기', kind: 'set', goal: 3 },
  { id: 'hider', icon: '🙈', name: '숨바꼭질에서 숨어서 세 번 이기기', kind: 'set', goal: 3 },
  { id: 'santa', icon: '🎅', name: '몰래 산타로 두 번 이기기', kind: 'set', goal: 2 },
  { id: 'town', icon: '🕵️', name: '시민으로 몰래 산타 두 번 잡기', kind: 'set', goal: 2 },
  { id: 'hunt', icon: '🎁', name: '선물 찾기에서 혼자 다 찾기 세 번', kind: 'set', goal: 3 },
  { id: 'claw', icon: '🐰', name: '인형뽑기로 토끼 인형 다섯 개', kind: 'count', goal: 5 },
  { id: 'star', icon: '⭐', name: '친구 어깨에 올라 꼭대기 별 달기', kind: 'count', goal: 1 },
  { id: 'cheers', icon: '🥂', name: '친구와 "짠" 열 번', kind: 'count', goal: 10 },
  { id: 'gifts', icon: '💝', name: '트리 밑에 선물 다섯 개 두기', kind: 'count', goal: 5 },
  { id: 'light', icon: '🎄', name: '트리 점등식 열기', kind: 'count', goal: 1 },
  { id: 'props', icon: '🎉', name: '폭죽·지구본·불가마·젤리 트램펄린 다 써 보기', kind: 'set', goal: 4 },
  { id: 'kiln', icon: '♨️', name: '불가마 찜질 열 번', kind: 'count', goal: 10 },
  { id: 'bounce', icon: '🟣', name: '젤리 트램펄린에서 서른 번 뛰기', kind: 'count', goal: 30 },
  { id: 'rock', icon: '🪑', name: '흔들의자에 3분 앉아 있기', kind: 'count', goal: 180 },
];
const BY = new Map(QUESTS.map((q) => [q.id, q]));
let data = null;
const hooks = [];
function load() {
  if (data) return data;
  data = {};
  try { const o = JSON.parse(localStorage.getItem(SLOT) || '{}'); if (o && typeof o === 'object') data = o; } catch (_) {}
  return data;
}
function save() { try { localStorage.setItem(SLOT, JSON.stringify(data)); } catch (_) {} }
// 지금까지 한 만큼(0 ~ goal)
export function progress(id) {
  const q = BY.get(id), v = load()[id];
  if (!q) return 0;
  const n = q.kind === 'set' ? (Array.isArray(v) ? v.length : 0) : Number(v) || 0;
  return Math.max(0, Math.min(q.goal, Math.floor(n)));
}
export const done = (id) => { const q = BY.get(id); return !!q && progress(id) >= q.goal; };
export const allDone = () => QUESTS.every((q) => done(q.id));
// 놀이 코드가 부른다. 모르는 퀘스트나 이상한 값은 버린다
export function mark(id, v) {
  const q = BY.get(id);
  if (!q) return;
  const d = load(), was = done(id);
  if (q.kind === 'max') { const n = Number(v); if (!Number.isFinite(n) || n <= (Number(d[id]) || 0)) return; d[id] = n; }
  else if (q.kind === 'count') { const n = v === undefined ? 1 : Number(v); if (!Number.isFinite(n) || n <= 0 || was) return; d[id] = (Number(d[id]) || 0) + n; }
  else { const s = String(v).slice(0, 24), a = Array.isArray(d[id]) ? d[id] : []; if (!s || was || a.includes(s)) return; a.push(s); d[id] = a; }
  save();
  for (const f of hooks) f(q, !was && done(id));
}

const CSS = `
#questP{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(20,14,28,.45)}
#questP .sheet{width:100%;max-width:400px;max-height:100%;display:flex;flex-direction:column}
#questList{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;overflow-y:auto;overscroll-behavior:contain;min-height:0;flex:1}
#questList li{display:flex;align-items:center;gap:8px;min-height:38px;padding:3px 10px;border-radius:10px;background:#fff;border:1.5px solid var(--line);font-size:13px;font-weight:700}
#questList li b{flex:none;width:24px;text-align:center}
#questList li span{flex:1;min-width:0;line-height:1.25}
#questList li em{flex:none;font-style:normal;font-weight:900;font-size:12.5px;color:var(--sub)}
#questList li.ok{background:#FFF1C4;border-color:var(--choc)}
#questList li.ok em{color:inherit}
#questSay{font-size:13px;font-weight:700;color:var(--sub);text-align:center}
`;
// K = { scene, ray(px, py) → THREE.Ray, shown() 1층이 보이는지, toast(글), gold() → 'on' | 'off' | '', earn() → 켰는지, master() 암호 마스터인지, dirty() }
export function makeQuest(K) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  /* 열쇠: 거실 뒤쪽 구석 바닥의 작은 금빛 열쇠 */
  const mat = new THREE.MeshStandardMaterial({ color: 0xE9B93A, metalness: 0.7, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 14), mat), stem = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.014, 0.018), mat), tooth = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.014, 0.04), mat);
  ring.rotation.x = Math.PI / 2; stem.position.x = 0.085; tooth.position.set(0.12, 0, 0.022);
  const key = new THREE.Group();
  key.add(ring, stem, tooth); key.position.set(KEY_AT.x, KEY_AT.y, KEY_AT.z); key.rotation.y = 0.6;
  if (K.scene) K.scene.add(key);
  const hit = new THREE.Sphere(new THREE.Vector3(KEY_AT.x + 0.05, KEY_AT.y, KEY_AT.z + 0.03), 0.16); // 손가락으로도 누를 수 있게 조금 넉넉히
  /* 판 */
  const P = document.createElement('div');
  P.id = 'questP'; P.hidden = true; P.setAttribute('role', 'dialog'); P.setAttribute('aria-label', '황금열쇠 퀘스트');
  P.innerHTML = '<div class="sheet"><h2>🗝️ 황금열쇠 <small id="questCount"></small></h2><ol id="questList"></ol><div id="questSay"></div>'
    + '<div class="row"><button type="button" class="btn main" id="questUse" style="flex:1">🗝️ 황금열쇠 쓰기</button><button type="button" class="btn" id="questClose" style="flex:1">닫기</button></div></div>';
  document.body.appendChild(P);
  const $ = (id) => document.getElementById(id);
  const seen = () => { try { return localStorage.getItem(SEEN) === '1'; } catch (_) { return false; } };
  function paint() {
    const ol = $('questList'), n = QUESTS.filter((q) => done(q.id)).length, all = n === QUESTS.length, g = K.gold();
    $('questCount').textContent = `퀘스트 ${n}/${QUESTS.length}`;
    ol.textContent = '';
    for (const q of QUESTS) {
      const li = document.createElement('li'), ic = document.createElement('b'), nm = document.createElement('span'), pt = document.createElement('em'), ok = done(q.id);
      if (ok) li.className = 'ok';
      li.dataset.id = q.id; ic.textContent = q.icon; nm.textContent = q.name; pt.textContent = ok ? '✅' : `${progress(q.id)}/${q.goal}`;
      li.append(ic, nm, pt); ol.appendChild(li);
    }
    $('questUse').disabled = !all || g === 'on' || g === 'off' || K.master();
    $('questSay').textContent = K.master() ? '이미 마스터키를 켠 기기예요'
      : g === 'on' ? '황금열쇠를 쓰는 중이에요. 아래 "🔑 마스터" 탭에서 설정해요'
        : g === 'off' ? '방장이 이 기기의 황금열쇠를 꺼 두었어요'
          : all ? '퀘스트를 모두 깼어요! 황금열쇠를 쓸 수 있어요' : '퀘스트를 모두 깨면 황금열쇠를 쓸 수 있어요';
  }
  function open() { try { localStorage.setItem(SEEN, '1'); } catch (_) {} paint(); P.hidden = false; $('questClose').focus({ preventScroll: true }); }
  function close() { P.hidden = true; }
  $('questClose').addEventListener('click', close);
  $('questUse').addEventListener('click', () => {
    if (!allDone()) return;
    if (K.earn()) { K.toast('🗝️ 황금열쇠를 썼어요! 아래 "🔑 마스터" 탭이 생겼어요'); close(); } else paint();
  });
  P.addEventListener('click', (e) => { if (e.target === P) close(); });
  P.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); e.stopPropagation(); });
  function tap(px, py) {
    if (!K.shown()) return false;
    const r = K.ray(px, py);
    if (!r || !r.intersectsSphere(hit)) return false;
    open();
    return true;
  }
  hooks.push((q, fresh) => {
    if (!P.hidden) paint();
    if (!fresh || !seen()) return;
    const left = QUESTS.filter((x) => !done(x.id)).length;
    K.toast(left ? `🗝️ 퀘스트 달성: ${q.icon} ${q.name} (남은 퀘스트 ${left}개)` : '🗝️ 퀘스트를 모두 깼어요! 황금열쇠를 누르면 쓸 수 있어요');
  });
  return {
    tap, open, close, paint,
    test: {
      key: KEY_AT, QUESTS, mark, progress, done, allDone, open, get shown() { return !P.hidden; },
      finishAll() { for (const q of QUESTS) { if (q.kind === 'set') for (let k = 0; k < q.goal; k++) mark(q.id, 't' + k); else mark(q.id, q.goal); } },
      reset() { data = {}; save(); if (!P.hidden) paint(); },
    },
  };
}
