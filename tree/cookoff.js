// 요리 대결: 크리스마스 요리 대결. 조리대(cookst)에서 재료 2~4가지와 조리법을 골라 요리하고, 심사석(judge)에서 심사위원 셋에게 점수를 받는다.
//   재료 진열대(pantry)에서 재료를 미리 담아 가도 된다. 가구 모양은 furniture.js, 놀이 판은 play.js 의 것을 같이 쓴다(play.add).
//
// 요리
//   - 재료(INGS) 16가지 중 2~4가지 → 조리법(METHODS) 5가지 중 하나 → "🔥 요리 시작". COOK_T 동안 화구에 불이 켜지고 지글지글·보글보글 소리, 팬·냄비 속 재료가 들썩인다.
//   - 다 되면 조리대 위 접시에 담긴다(모두에게 보인다). 이름은 요리표(DISHES)에서 고른다: 꼭 있어야 하는 재료(need)가 다 있고 조리법이 맞는 요리 가운데
//     need 하나에 3점 + 어울리는 재료(opt) 하나에 1점 - 엉뚱한 재료 하나에 2점이 가장 높은 것. 엉뚱한 재료가 하나면 "연어 김치볶음밥", 둘이면 "모둠 ○○".
//     맞는 요리가 없거나 점수가 0 이하면 "셰프의 ○○ ○○ 볶음·구이·탕·튀김·찜"(앞의 재료 둘과 조리법).
//   - "🧤 들고 가기"로 접시를 들고(두 팔을 내민다) 심사석에서 "🍽️ 심사받기". 조리대에 둔 채 심사석에 가도 접시가 따라간다.
// 심사
//   - 심사위원 셋: 🎅 산타 할아버지(맛 40점), 🍪 진저 셰프(창의 30점), ⛄ 눈사람 미식가(완성도 30점). 합계 100점.
//   - 점수는 요리표의 기본 맛, 어울리는 재료·엉뚱한 재료·조리법이 맞는지로 정하고, 정해진 작은 흔들림(씨앗, ±2)을 더한다. 같은 요리는 늘 같은 점수(judgeDish).
//   - 결과는 점수표 판(#cookRes)으로 보이고, 심사석 위에서 심사위원이 점수판을 든다(접시가 심사석에 있는 동안 모두에게 보인다).
// 요리 대결 (🔔)
//   - 꾸밀 수 있는 사람이 심사석이나 조리대 판에서 연다(조리대와 심사석이 있어야 한다). 연 사람의 화면이 심판(시간·제출·순위). 혼자서도(시간과 겨루기), 여럿이서도.
//   - CONTEST(2분) 안에 한 사람이 한 접시. 대결이 시작된 뒤에 만든 요리를 심사석에 내면 제출된다. 모두 내거나 시간이 끝나면 순위(🥇🥈🥉)와 우승 요리.
//   - 도중에 들어온 사람도 낼 수 있다. 심판이 나가면 대결은 취소된다.
// 동기화: 놀이 소식 { k: 'cook', v: JSON 글 } (길어서 app.js 의 20자 검사보다 먼저 받는다). 방의 상태가 아니다(저장하지 않는다).
//   { a: 'p', s, st, i, m, w, at, c, r, j }  내 접시: s 번호, st 조리대, i 재료들, m 조리법, w 있는 곳('s' 조리대 | 'h' 손 | 'j' 심사석 at),
//                                          c 요리 중(1), r 만들 때의 대결 번호, j 심사받았는지(1). 바뀔 때마다·4초마다·새로 온 사람이 있으면 다시 알린다
//   { a: 'x' }                              내 접시를 치웠다
//   { a: 'r', rid, ref, ph, left, pl, sub } 심판이 알리는 대결 상태(ph 'cook' | 'over', left 남은 ms, pl 같이 하는 사람, sub [[사람, 재료들, 조리법]])
//   { a: 'sub', rid, i, m }                 심판에게 낸 요리 (받았다는 상태가 올 때까지 3초마다 다시 낸다)
//   { a: 'q', rid }                         심판이 대결을 취소했다
//   점수는 소식에 싣지 않는다: 받은 쪽이 재료·조리법·대결 번호로 같은 셈을 해서 같은 점수를 본다.
import { THREE, M, G, put, cbox, cyl, ball, bake } from './kit.js';
import { sfx } from './sfx.js';
import { mark } from './quest.js';

const now = () => (typeof window.__now === 'function' ? window.__now() : Date.now()); // 놀이 시계 (대결 시간·요리 시간)
const clock = () => performance.now(); // 실제로 흐른 시간 (소식이 끊겼는지, 다시 알릴 때)
const SEC = 1000;
export const COOK_T = 4 * SEC;    // 요리에 걸리는 시간
export const CONTEST = 120 * SEC; // 요리 대결 한 판
const BEAT = 4 * SEC, LOST = 13 * SEC, TASTE = 1.8 * SEC; // 다시 알리는 간격, 소식이 끊긴 것으로 보는 때, 심사위원이 맛보는 시간
const BEST_KEY = 'tree.cookBest';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const okId = (v) => typeof v === 'string' && /^[a-z0-9]{1,8}$/.test(v);
const okItem = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(v);
const okRid = (v) => typeof v === 'string' && /^[a-z0-9]{4,16}$/.test(v);
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / SEC)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
// 이름 뒤 조사: 받침이 있으면 a, 없으면 b
function josa(w, a, b) {
  const c = w.charCodeAt(w.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return w + ((c - 0xAC00) % 28 ? a : b);
  if (c >= 48 && c <= 57) return w + ('0136781'.includes(w[w.length - 1]) ? a : b);
  return w + b;
}

/* ───────── 재료·조리법·요리표 ───────── */
// 재료: 앞에 있을수록 이름에 먼저 나온다(셰프의 ○○ ○○)
export const INGS = [
  { id: 'beef', name: '소고기', icon: '🥩', col: 0x8B3A2B }, { id: 'pork', name: '돼지고기', icon: '🥓', col: 0xE9A27E },
  { id: 'chicken', name: '닭고기', icon: '🍗', col: 0xE2B36E }, { id: 'salmon', name: '연어', icon: '🐟', col: 0xF28C5B },
  { id: 'shrimp', name: '새우', icon: '🦐', col: 0xF5875F }, { id: 'tofu', name: '두부', icon: '🧊', col: 0xF4EEDC },
  { id: 'egg', name: '달걀', icon: '🥚', col: 0xF7D046 }, { id: 'kimchi', name: '김치', icon: '🥬', col: 0xD24A2F },
  { id: 'cheese', name: '치즈', icon: '🧀', col: 0xF6C445 }, { id: 'tomato', name: '토마토', icon: '🍅', col: 0xD9382E },
  { id: 'mushroom', name: '버섯', icon: '🍄', col: 0xB08A64 }, { id: 'potato', name: '감자', icon: '🥔', col: 0xE8C66A },
  { id: 'onion', name: '양파', icon: '🧅', col: 0xF1E6C8 }, { id: 'chili', name: '고추', icon: '🌶️', col: 0xC8231B },
  { id: 'rice', name: '밥', icon: '🍚', col: 0xFAF6EC }, { id: 'noodle', name: '면', icon: '🍜', col: 0xF2D9A0 },
];
// 조리법: noun = 셰프의 요리 이름 끝, fb = 그때의 그림 글자, look = 그때의 접시 모양, pot = 냄비에서 한다(아니면 프라이팬), snd = 요리하는 소리
export const METHODS = [
  { id: 'fry', name: '볶기', icon: '🍳', noun: '볶음', fb: '🥘', look: 'stir', snd: 'sizzle', doing: '지글지글 볶는 중…' },
  { id: 'grill', name: '굽기', icon: '🔥', noun: '구이', fb: '🍢', look: 'skewer', snd: 'sizzle', doing: '노릇노릇 굽는 중…' },
  { id: 'boil', name: '끓이기', icon: '🍲', noun: '탕', fb: '🍲', look: 'stew', snd: 'bubble', pot: true, doing: '보글보글 끓이는 중…' },
  { id: 'deep', name: '튀기기', icon: '🍤', noun: '튀김', fb: '🍤', look: 'fried', snd: 'sizzle', pot: true, doing: '바삭바삭 튀기는 중…' },
  { id: 'steam', name: '찌기', icon: '♨️', noun: '찜', fb: '♨️', look: 'braise', snd: 'bubble', pot: true, doing: '모락모락 찌는 중…' },
];
const ING = new Map(INGS.map((x, n) => [x.id, { ...x, n }]));
const MET = new Map(METHODS.map((x) => [x.id, x]));
// 요리표: [id, 이름, 그림 글자, 조리법(앞의 것이 제 조리법), 꼭 있어야 하는 재료, 어울리는 재료, 접시 모양, 색, 기본 맛(40점 중)]
const D = (id, name, icon, m, need, opt, look, col, t) => ({ id, name, icon, m: m.split(','), need: need.split(','), opt: opt ? opt.split(',') : [], look, col, t });
export const DISHES = [
  D('kfr', '김치볶음밥', '🍳', 'fry', 'kimchi,rice', 'egg,pork,onion,cheese,chili', 'rice', 0xE0763E, 34),
  D('sfr', '새우볶음밥', '🍤', 'fry', 'shrimp,rice', 'egg,onion,mushroom', 'rice', 0xF0D49A, 33),
  D('efr', '달걀볶음밥', '🍚', 'fry', 'egg,rice', 'onion,cheese,mushroom', 'rice', 0xF5DC7A, 30),
  D('omu', '오므라이스', '🍳', 'fry', 'egg,rice,tomato', 'onion,chicken,mushroom,cheese', 'omelet', 0xF6CF4A, 33),
  D('oml', '치즈 오믈렛', '🧀', 'fry', 'egg,cheese', 'tomato,onion,mushroom', 'omelet', 0xF8D45A, 32),
  D('emk', '달걀말이', '🥚', 'fry', 'egg,onion', 'cheese,mushroom,chili', 'roll', 0xF5D05A, 31),
  D('bul', '불고기', '🥩', 'fry,grill', 'beef,onion', 'mushroom,rice,chili', 'stir', 0x7A3B22, 35),
  D('jey', '제육볶음', '🌶️', 'fry', 'pork,chili', 'onion,kimchi,rice', 'stir', 0xB8452A, 34),
  D('mpd', '마파두부', '🌶️', 'fry', 'tofu,chili', 'pork,beef,onion,rice', 'tofu', 0xC8432A, 33),
  D('tbu', '두부 부침', '🍳', 'fry', 'tofu', 'egg,onion,chili,kimchi', 'tofu', 0xE8C88A, 29),
  D('ptc', '감자전', '🥔', 'fry', 'potato', 'onion,chili,cheese', 'pancake', 0xE6BE62, 31),
  D('kjn', '김치전', '🥬', 'fry', 'kimchi', 'onion,chili,pork,shrimp,egg', 'pancake', 0xDB6B3C, 32),
  D('nfr', '볶음면', '🍜', 'fry', 'noodle', 'onion,mushroom,pork,beef,shrimp,chili,egg', 'pasta', 0xC98A45, 31),
  D('mfr', '버섯볶음', '🍄', 'fry', 'mushroom', 'onion,beef,pork,chili', 'stir', 0xA4774E, 29),
  D('stk', '소고기 스테이크', '🥩', 'grill', 'beef', 'potato,mushroom,onion', 'steak', 0x6B3220, 35),
  D('slm', '연어 스테이크', '🐟', 'grill', 'salmon', 'potato,onion,mushroom,tomato', 'fillet', 0xF08A5D, 34),
  D('sdn', '연어 덮밥', '🍱', 'grill', 'salmon,rice', 'onion,egg', 'donburi', 0xF08A5D, 33),
  D('sgp', '삼겹살 구이', '🥓', 'grill,fry', 'pork', 'kimchi,mushroom,onion,chili', 'belly', 0xE9A27E, 34),
  D('ccs', '치킨 스테이크', '🍗', 'grill', 'chicken', 'potato,mushroom,onion,tomato', 'steak', 0xC98A45, 33),
  D('skw', '닭꼬치', '🍢', 'grill', 'chicken,onion', 'chili,mushroom', 'skewer', 0xC9773A, 33),
  D('sgr', '새우구이', '🍤', 'grill', 'shrimp', 'onion,mushroom,chili', 'shrimp', 0xF5875F, 32),
  D('pcg', '치즈 감자구이', '🧀', 'grill', 'potato,cheese', 'onion,mushroom,beef', 'gratin', 0xF2C04A, 33),
  D('kjj', '김치찌개', '🍲', 'boil', 'kimchi', 'pork,tofu,onion,chili', 'stew', 0xC9442B, 35),
  D('sdb', '순두부찌개', '🍲', 'boil', 'tofu,chili', 'egg,shrimp,onion,mushroom', 'stew', 0xD0502E, 33),
  D('bdj', '부대찌개', '🍲', 'boil', 'kimchi,noodle', 'pork,cheese,tofu,onion,chili', 'stew', 0xD8572E, 34),
  D('rmn', '라면', '🍜', 'boil', 'noodle,egg', 'onion,chili,kimchi,cheese', 'noodle', 0xE07A3A, 33),
  D('jjp', '짬뽕', '🍜', 'boil', 'noodle,shrimp,chili', 'onion,mushroom,pork', 'noodle', 0xC8321E, 34),
  D('tps', '토마토 파스타', '🍝', 'boil,fry', 'noodle,tomato', 'onion,mushroom,cheese,shrimp,beef', 'pasta', 0xD5442E, 33),
  D('rst', '크림 리조또', '🧀', 'boil', 'rice,cheese', 'mushroom,onion,chicken,shrimp', 'risotto', 0xF3E2B0, 33),
  D('gbp', '소고기 국밥', '🍲', 'boil', 'beef,rice', 'onion,egg,mushroom', 'stew', 0xB9784A, 33),
  D('djk', '닭죽', '🍲', 'boil', 'chicken,rice', 'onion,mushroom,egg', 'risotto', 0xF0E2C0, 31),
  D('gjt', '감자탕', '🍲', 'boil', 'pork,potato', 'kimchi,chili,onion', 'stew', 0xC24A2A, 34),
  D('tms', '토마토 수프', '🍅', 'boil', 'tomato,onion', 'potato,cheese,mushroom', 'soup', 0xD9482E, 31),
  D('mjg', '버섯 전골', '🍄', 'boil', 'mushroom,beef', 'tofu,onion,egg,noodle', 'stew', 0x9A6A45, 33),
  D('fch', '후라이드 치킨', '🍗', 'deep', 'chicken', 'potato', 'fried', 0xD69A45, 35),
  D('dgj', '닭강정', '🍗', 'deep', 'chicken,chili', 'onion', 'glazed', 0xB5452A, 35),
  D('stp', '새우튀김', '🍤', 'deep', 'shrimp', 'onion', 'tempura', 0xE7B65A, 33),
  D('fry', '감자튀김', '🍟', 'deep', 'potato', 'cheese', 'fries', 0xF0C24A, 32),
  D('dgs', '돈가스', '🍖', 'deep', 'pork', 'onion', 'cutlet', 0xC98A3A, 34),
  D('cdg', '치즈 돈가스', '🧀', 'deep', 'pork,cheese', 'onion', 'cutlet', 0xC98A3A, 35),
  D('sct', '연어 커틀릿', '🐟', 'deep', 'salmon', 'potato,onion', 'cutlet', 0xD69A45, 32),
  D('egs', '달걀찜', '🥚', 'steam', 'egg', 'onion,shrimp,mushroom', 'custard', 0xF6D266, 31),
  D('jjd', '찜닭', '🍗', 'steam,boil', 'chicken,potato', 'onion,chili,noodle,mushroom', 'braise', 0x7A4A2A, 35),
  D('hmj', '해물찜', '🦐', 'steam', 'shrimp', 'salmon,chili,onion,mushroom', 'braise', 0xD0502E, 33),
];
// 셰프의 요리(요리표에 없는 조합)의 맛: 어울리는 짝은 더하고, 안 어울리는 짝은 뺀다
const PAIRS = [
  ['tomato', 'cheese', 3], ['beef', 'mushroom', 3], ['pork', 'kimchi', 3], ['egg', 'cheese', 3], ['shrimp', 'chili', 3], ['salmon', 'potato', 3], ['chicken', 'potato', 3],
  ['tofu', 'kimchi', 3], ['beef', 'onion', 3], ['egg', 'rice', 3], ['noodle', 'egg', 3], ['mushroom', 'cheese', 3], ['chicken', 'chili', 3], ['potato', 'cheese', 3],
  ['salmon', 'kimchi', -3], ['rice', 'noodle', -3], ['potato', 'noodle', -3], ['tomato', 'tofu', -3],
];
export const JUDGES = [
  { icon: '🎅', name: '산타 할아버지', what: '맛', max: 40, col: '#C8302A' },
  { icon: '🍪', name: '진저 셰프', what: '창의', max: 30, col: '#B8743F' },
  { icon: '⛄', name: '눈사람 미식가', what: '완성도', max: 30, col: '#2F7D56' },
];
const NOTES = [
  ['썰매가 날아오를 맛!', '든든하고 따뜻해요', '간을 조금만 더!', '루돌프 입맛일지도?'],
  ['이런 조합은 처음!', '나만의 한 끗이 있어요', '정석을 잘 따랐어요', '다음엔 더 과감하게!'],
  ['불 조절이 완벽해요', '깔끔하게 담았어요', '조금만 더 정성껏!', '녹아내릴 뻔했어요'],
];
const grade = (f) => (f >= 0.85 ? 0 : f >= 0.7 ? 1 : f >= 0.5 ? 2 : 3);
const verdict = (v) => (v >= 90 ? '🌟 최고의 요리!' : v >= 75 ? '👏 훌륭해요' : v >= 60 ? '😊 맛있어요' : '🙂 다음엔 더 잘할 수 있어요');
export const okIngs = (a) => Array.isArray(a) && a.length >= 2 && a.length <= 4 && a.every((x) => typeof x === 'string' && ING.has(x)) && new Set(a).size === a.length;
const canon = (a) => [...a].sort((x, y) => ING.get(x).n - ING.get(y).n);
const icons = (a) => a.map((x) => ING.get(x).icon).join(' ');
function hash(s) { let h = 2166136261; for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); } return h >>> 0; }
const wob = (key, n) => (hash(key + '#' + n) % 5) - 2; // 심사위원마다 정해진 흔들림 -2 ~ 2

// 재료와 조리법으로 무슨 요리가 되는지 (화면과 상관없는 셈. 모두가 같은 답을 낸다)
export function cookDish(ings, m) {
  const I = canon(ings), set = new Set(I);
  let best = null, bs = 0;
  for (const d of DISHES) {
    if (!d.m.includes(m) || !d.need.every((x) => set.has(x))) continue;
    const hit = d.opt.filter((x) => set.has(x)), extra = I.filter((x) => !d.need.includes(x) && !d.opt.includes(x));
    const s = 3 * d.need.length + hit.length - 2 * extra.length;
    if (s > bs) { bs = s; best = { d, hit, extra }; }
  }
  if (best) {
    const { d, hit, extra } = best;
    const name = extra.length === 1 ? `${ING.get(extra[0]).name} ${d.name}` : extra.length > 1 ? `모둠 ${d.name}` : d.name;
    return { id: d.id, name, icon: d.icon, look: d.look, col: d.col, d, hit, extra, I, m };
  }
  const M0 = MET.get(m); // 모르는 조합: 셰프의 ○○ ○○ (앞의 재료 둘)
  return { id: 'x', name: `셰프의 ${I.slice(0, 2).map((x) => ING.get(x).name).join(' ')} ${M0.noun}`, icon: M0.fb, look: M0.look, col: ING.get(I[0]).col, d: null, hit: [], extra: I, I, m };
}
// 심사: 맛(40)·창의(30)·완성도(30). seed 가 같으면 늘 같은 점수 (대결에서는 대결 번호와 사람)
export function judgeDish(ings, m, seed = '') {
  const c = cookDish(ings, m), n = c.I.length, key = `${seed}|${c.I.join(',')}|${m}`;
  let t, i, f;
  if (c.d) {
    const prim = c.d.m[0] === m, h = c.hit.length, e = c.extra.length;
    t = c.d.t + Math.min(h, 3) * 1.5 + (prim ? 1 : -2) - e * 4;
    i = 12 + (c.d.need.length - 1) * 2 + (n - 2) * 2 + e * 4 + (prim ? 0 : 3);
    f = 19 + h * 2 + (prim ? 3 : 0) - e * 3 + (n >= 3 ? 1 : 0);
  } else {
    let p = 0;
    for (const [a, b, v] of PAIRS) if (c.I.includes(a) && c.I.includes(b)) p += v;
    t = 20 + p; i = 24 + (n - 2) * 1.5; f = 14 + n;
  }
  const sc = [clamp(Math.round(t + wob(key, 0)), 8, 40), clamp(Math.round(i + wob(key, 1)), 5, 30), clamp(Math.round(f + wob(key, 2)), 6, 30)];
  return { dish: c, sc, total: sc[0] + sc[1] + sc[2], notes: sc.map((v, k) => NOTES[k][grade(v / JUDGES[k].max)]) };
}

/* ───────── 접시 위의 요리 모양 (모양마다 몇 줄. bake 로 한 덩어리) ───────── */
const W = 0xFFFAF2, ONI = 0xF1E6C8, GRN = 0x4CA64C, BRN = 0x4A3326;
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const nug = (r) => new THREE.DodecahedronGeometry(r, 0);
function bowl(g, r = 0.068, h = 0.05, col = W) { // 그릇: 테 높이를 돌려준다
  put(cyl(r, r * 0.68, h, 16), G(col), 0, h / 2, 0, g);
  put(new THREE.TorusGeometry(r, 0.005, 4, 16), G(col), 0, h, 0, g, false).rotation.x = Math.PI / 2;
  return h;
}
const soup = (g, y, r, col) => put(cyl(r, r, 0.004, 16), col, 0, y, 0, g, false);
function bits(g, cols, n, r, y, s = 0.014) { // 재료 색 조각을 고루 흩뿌린다
  for (let k = 0; k < n; k++) {
    const a = k * 2.39996, d = r * Math.sqrt((k + 0.5) / n);
    put(bx(s, s * 0.7, s), cols[k % cols.length], Math.cos(a) * d, y + (k % 3) * 0.003, Math.sin(a) * d, g, false).rotation.y = a;
  }
}
function heap(g, cols, n, r, y, s, main) { // 볶음처럼 쌓인 덩이
  for (let k = 0; k < n; k++) {
    const a = k * 2.4, d = 0.012 + r * ((k * 37) % 10) / 10;
    put(nug(s), k % 3 ? main : cols[k % cols.length], Math.cos(a) * d, y + (k % 2) * 0.01, Math.sin(a) * d, g, false).scale.y = 0.65;
  }
}
const LOOKS = {
  rice: (g, c, cols) => { put(ball(0.062, 12, 8), c, 0, 0.012, 0, g).scale.set(1, 0.55, 1); bits(g, cols, 7, 0.04, 0.042, 0.013); },
  omelet: (g, c) => { const o = put(new THREE.CapsuleGeometry(0.034, 0.07, 4, 10), c, 0, 0.034, 0, g); o.rotation.z = Math.PI / 2; o.scale.set(1, 0.8, 1.25); for (let k = 0; k < 4; k++) put(bx(0.011, 0.004, 0.05), 0xC8231B, -0.04 + k * 0.027, 0.064, 0, g, false).rotation.y = k % 2 ? 0.6 : -0.6; },
  roll: (g, c) => { for (let k = -1; k <= 1; k++) { put(cyl(0.026, 0.026, 0.03, 12), c, k * 0.034, 0.028, 0, g).rotation.x = Math.PI / 2; put(cyl(0.012, 0.012, 0.031, 8), 0xFBE7A0, k * 0.034, 0.028, 0, g, false).rotation.x = Math.PI / 2; } bits(g, [GRN], 4, 0.05, 0.056, 0.008); },
  stir: (g, c, cols) => { heap(g, cols, 10, 0.045, 0.018, 0.018, c); bits(g, [GRN, ...cols], 5, 0.05, 0.045, 0.009); },
  tofu: (g, c) => { put(cyl(0.075, 0.075, 0.008, 18), c, 0, 0.006, 0, g, false); for (let k = 0; k < 6; k++) { const a = k * 1.05; put(bx(0.024, 0.022, 0.024), 0xF7F2E4, Math.cos(a) * 0.035, 0.02, Math.sin(a) * 0.035, g, false).rotation.y = a; } bits(g, [GRN], 4, 0.05, 0.034, 0.008); },
  pancake: (g, c, cols) => { put(cyl(0.072, 0.07, 0.014, 18), c, 0, 0.009, 0, g); put(new THREE.TorusGeometry(0.07, 0.005, 4, 18), 0x9A5A2A, 0, 0.012, 0, g, false).rotation.x = Math.PI / 2; bits(g, cols, 8, 0.055, 0.017, 0.012); },
  pasta: (g, c, cols) => { for (let k = 0; k < 4; k++) put(new THREE.TorusGeometry(0.046 - k * 0.01, 0.007, 5, 14), 0xF2D9A0, 0, 0.008 + k * 0.008, 0, g, false).rotation.x = Math.PI / 2; put(ball(0.03, 10, 6), c, 0, 0.034, 0, g, false).scale.y = 0.5; bits(g, cols, 4, 0.035, 0.04, 0.011); },
  steak: (g, c) => { put(cbox(0.1, 0.028, 0.07, 0.012), c, -0.012, 0.015, 0, g); for (let k = -1; k <= 1; k++) put(bx(0.006, 0.002, 0.07), 0x2B1A12, -0.012 + k * 0.025, 0.03, 0, g, false).rotation.y = 0.5; for (let k = 0; k < 3; k++) put(bx(0.02, 0.016, 0.03), 0xE8C66A, 0.05, 0.01, -0.035 + k * 0.035, g, false).rotation.y = k; put(ball(0.016, 6, 4), GRN, 0.045, 0.022, 0.05, g, false); },
  fillet: (g, c) => { put(cbox(0.11, 0.028, 0.055, 0.012), c, 0, 0.015, 0, g); for (let k = 0; k < 4; k++) put(bx(0.004, 0.03, 0.057), 0xFBD3BF, -0.04 + k * 0.027, 0.016, 0, g, false); put(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 10, 1, false, 0, Math.PI), 0xF7E05A, 0.04, 0.01, 0.045, g, false); },
  donburi: (g, c) => { const y = bowl(g); put(ball(0.06, 12, 8), 0xFAF6EC, 0, y - 0.008, 0, g, false).scale.set(1, 0.4, 1); for (let k = -1; k <= 1; k++) put(cbox(0.04, 0.012, 0.022, 0.005), c, k * 0.028, y + 0.012, 0, g, false).rotation.y = 0.4; },
  belly: (g, c) => { for (let k = 0; k < 4; k++) { put(bx(0.09, 0.008, 0.022), c, 0, 0.008, -0.04 + k * 0.026, g, false); put(bx(0.09, 0.004, 0.022), 0xFBEDE4, 0, 0.014, -0.04 + k * 0.026, g, false); } put(ball(0.03, 8, 5), GRN, 0.06, 0.012, 0.03, g, false).scale.set(1, 0.3, 1.4); },
  skewer: (g, c, cols) => { for (const z of [-0.025, 0.025]) { put(cyl(0.003, 0.003, 0.18, 4), 0xD9B285, 0, 0.02, z, g, false).rotation.z = Math.PI / 2; for (let k = 0; k < 4; k++) put(nug(0.014), k % 2 ? cols[k % cols.length] : c, -0.045 + k * 0.03, 0.02, z, g, false); } },
  shrimp: (g, c) => { for (let k = 0; k < 3; k++) { const s = put(new THREE.TorusGeometry(0.022, 0.009, 5, 10, Math.PI * 1.3), c, -0.035 + k * 0.035, 0.012, 0, g, false); s.rotation.set(Math.PI / 2, 0, k); } put(ball(0.012, 6, 4), 0xF7E05A, 0.05, 0.01, 0.04, g, false); },
  gratin: (g, c) => { const d = put(cyl(0.07, 0.06, 0.03, 16), G(0xF6EEDD), 0, 0.015, 0, g); d.scale.x = 1.25; put(cyl(0.064, 0.064, 0.006, 16), c, 0, 0.03, 0, g, false).scale.x = 1.25; for (let k = 0; k < 6; k++) put(ball(0.008, 5, 3), 0xA8642A, -0.05 + k * 0.02, 0.033, (k % 2 - 0.5) * 0.04, g, false).scale.y = 0.4; },
  stew: (g, c, cols) => { const y = bowl(g, 0.07, 0.055, BRN); soup(g, y - 0.006, 0.064, c); bits(g, cols, 7, 0.048, y - 0.003, 0.014); },
  noodle: (g, c, cols) => { const y = bowl(g, 0.072, 0.05); soup(g, y - 0.006, 0.066, c); for (let k = 0; k < 3; k++) put(new THREE.TorusGeometry(0.03 - k * 0.008, 0.004, 4, 12), 0xF2D9A0, 0, y - 0.003, 0, g, false).rotation.x = Math.PI / 2; bits(g, cols, 4, 0.05, y - 0.002, 0.012); put(ball(0.018, 8, 5), W, 0.035, y, -0.02, g, false).scale.y = 0.6; },
  risotto: (g, c, cols) => { const y = bowl(g, 0.075, 0.035); put(ball(0.064, 12, 8), c, 0, y - 0.012, 0, g, false).scale.set(1, 0.32, 1); bits(g, cols, 6, 0.045, y + 0.006, 0.011); },
  soup: (g, c) => { const y = bowl(g); soup(g, y - 0.006, 0.062, c); put(new THREE.TorusGeometry(0.025, 0.003, 3, 14, Math.PI * 1.5), W, 0, y - 0.003, 0, g, false).rotation.x = Math.PI / 2; put(ball(0.008, 5, 3), GRN, 0.01, y, 0.01, g, false); },
  fried: (g, c) => { for (let k = 0; k < 6; k++) { const a = k * 1.05; put(nug(0.02), c, Math.cos(a) * 0.04, 0.02 + (k % 2) * 0.006, Math.sin(a) * 0.04, g, false); } put(ball(0.015, 6, 4), GRN, 0, 0.022, 0, g, false); },
  glazed: (g, c) => { for (let k = 0; k < 7; k++) { const a = k * 0.9; put(nug(0.019), G(c), Math.cos(a) * 0.035 * (k % 2 ? 1 : 0.4), 0.02 + (k % 3) * 0.008, Math.sin(a) * 0.035 * (k % 2 ? 1 : 0.4), g, false); } for (let k = 0; k < 6; k++) put(ball(0.003, 4, 3), W, -0.02 + k * 0.008, 0.045, (k % 2) * 0.01, g, false); },
  tempura: (g, c) => { for (let k = 0; k < 3; k++) { const s = put(new THREE.CapsuleGeometry(0.014, 0.07, 3, 8), c, -0.02 + k * 0.02, 0.016, 0, g, false); s.rotation.set(Math.PI / 2, 0, 0.3 - k * 0.3); put(new THREE.ConeGeometry(0.01, 0.025, 5), 0xE85A3A, -0.02 + k * 0.02 + Math.sin(0.3 - k * 0.3) * 0.05, 0.016, -0.05, g, false).rotation.x = -Math.PI / 2; } },
  fries: (g, c) => { put(cyl(0.035, 0.028, 0.06, 10), 0xC8302A, 0, 0.03, 0, g); for (let k = 0; k < 8; k++) { const a = k * 0.8; put(bx(0.008, 0.07, 0.008), c, Math.cos(a) * 0.018, 0.07, Math.sin(a) * 0.018, g, false).rotation.set(Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25); } },
  cutlet: (g, c) => { put(cbox(0.1, 0.02, 0.07, 0.01), c, -0.015, 0.012, 0, g); for (let k = -1; k <= 1; k++) put(bx(0.003, 0.022, 0.071), 0xE8C68A, -0.015 + k * 0.025, 0.012, 0, g, false); for (let k = -1; k <= 1; k++) put(bx(0.004, 0.004, 0.06), 0x5A2E1A, -0.015 + k * 0.02, 0.024, 0, g, false).rotation.y = 0.6; put(ball(0.03, 8, 5), 0xDDEDB0, 0.055, 0.012, 0, g, false).scale.set(0.7, 0.6, 1.2); },
  custard: (g, c) => { const y = bowl(g, 0.06, 0.05, BRN); put(ball(0.056, 12, 8), c, 0, y - 0.004, 0, g, false).scale.y = 0.7; bits(g, [GRN], 4, 0.03, y + 0.034, 0.008); },
  braise: (g, c, cols) => { put(cyl(0.085, 0.06, 0.03, 18), G(W), 0, 0.015, 0, g); soup(g, 0.026, 0.078, c); heap(g, cols, 7, 0.05, 0.032, 0.016, cols[0]); },
};
const PLATE_GOLD = 0xE7B441;
function plated(c) { // 접시에 담긴 요리 (모두 같은 크기: 지름 0.2)
  const g = new THREE.Group();
  put(cyl(0.1, 0.07, 0.014, 22), G(W), 0, 0.007, 0, g);
  put(new THREE.TorusGeometry(0.093, 0.006, 4, 22), G(0xF1E4CC), 0, 0.014, 0, g, false).rotation.x = Math.PI / 2;
  put(new THREE.TorusGeometry(0.082, 0.002, 3, 22), PLATE_GOLD, 0, 0.0155, 0, g, false).rotation.x = Math.PI / 2;
  const top = new THREE.Group(); top.position.y = 0.014; g.add(top);
  (LOOKS[c.look] || LOOKS.stir)(top, c.col, c.I.map((x) => ING.get(x).col));
  bake(g);
  g.traverse((o) => { o.raycast = () => {}; });
  return g;
}
const freeGeo = (g) => g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
const STEAM = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.35, depthWrite: false });
const steamGeo = new THREE.SphereGeometry(1, 8, 6), blobGeo = new THREE.SphereGeometry(0.016, 7, 5);
// 심사위원이 드는 점수판 그림
function cardMat(k, v) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 112;
  const x = c.getContext('2d'), j = JUDGES[k];
  x.fillStyle = '#FFFAF2'; x.fillRect(0, 0, 128, 112);
  x.fillStyle = j.col; x.fillRect(0, 0, 128, 26);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#FFFFFF'; x.font = 'bold 18px sans-serif'; x.fillText(j.what, 64, 14);
  x.fillStyle = '#2B2420'; x.font = 'bold 54px sans-serif'; x.fillText(String(v), 64, 64);
  x.fillStyle = '#8A7868'; x.font = 'bold 16px sans-serif'; x.fillText('/ ' + j.max, 64, 99);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map: t });
}
const HAND = [0, 0.6, 0.4]; // 든 사람 몸 기준 (두 팔을 내민 손 위)

/* ───────── 화면 ───────── */
const CSS = `
#cookBand{position:absolute;left:10px;right:10px;top:calc(56px + env(safe-area-inset-top));margin:0 auto;max-width:460px;z-index:6;display:flex;align-items:center;gap:6px;min-height:48px;
  padding:4px 4px 4px 12px;border-radius:16px;background:rgba(255,252,245,.96);border:1.5px solid var(--line);box-shadow:0 4px 14px rgba(0,0,0,.28);font-size:13px;font-weight:700;color:var(--ink)}
#cookBand.low{top:calc(112px + env(safe-area-inset-top))}
#cookBand .ct{flex:1;min-width:0;line-height:1.3}#cookBand .ct b{font-weight:900}
#cookBand .clk{font-variant-numeric:tabular-nums;color:var(--choc);margin-left:6px;font-weight:900}
#cookBand.hurry .clk{color:#D9483B}
#cookBand small{display:block;font-size:12px;font-weight:700;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#cookBand .btn{padding:0 10px}
body.ck #toast{top:calc(118px + env(safe-area-inset-top))}
.ckP{position:absolute;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;padding:calc(12px + env(safe-area-inset-top)) 14px calc(12px + env(safe-area-inset-bottom));background:rgba(20,14,28,.55)}
.ckP .sheet{width:100%;max-width:420px;max-height:100%;overflow-y:auto}
.ckDish{display:flex;align-items:center;gap:10px}
.ckDish>b{font-size:40px;font-weight:400;line-height:1}
.ckDish>span{flex:1;min-width:0;font-size:18px;font-weight:900;line-height:1.3;word-break:keep-all}
.ckDish small{display:block;font-size:12.5px;font-weight:700;color:var(--sub)}
.ckCards{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;perspective:400px}
.ckCard{background:#fff;border:1.5px solid var(--line);border-radius:12px;padding:6px 4px 8px;text-align:center;animation:ckUp .45s both}
.ckCard:nth-child(2){animation-delay:.35s}.ckCard:nth-child(3){animation-delay:.7s}
@keyframes ckUp{from{opacity:0;transform:translateY(14px) rotateX(70deg)}to{opacity:1;transform:none}}
.ckCard i{display:block;font-size:24px;font-style:normal;line-height:1.2}
.ckCard em{display:block;font-style:normal;font-size:11.5px;font-weight:800;color:var(--sub);word-break:keep-all}.ckCard em u{display:block;text-decoration:none;font-size:13px;font-weight:900}
.ckCard b{display:block;font-size:26px;font-weight:900;line-height:1.15}
.ckCard b small{font-size:12px;color:var(--sub);font-weight:700}
.ckCard p{margin:3px 0 0;font-size:11.5px;font-weight:700;line-height:1.3;word-break:keep-all}
.ckTotal{text-align:center;font-size:15px;font-weight:800}.ckTotal b{font-size:24px;font-weight:900;color:var(--choc)}
#ckRankList{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
#ckRankList li{display:flex;align-items:center;gap:8px;min-height:44px;padding:2px 10px;border-radius:10px;background:#fff;border:1.5px solid var(--line);font-size:14px;font-weight:700}
#ckRankList li>b{flex:none;width:28px;text-align:center;font-size:18px}
#ckRankList li>span{flex:1;min-width:0;line-height:1.3}
#ckRankList li>span small{display:block;font-size:12px;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ckRankList li>em{flex:none;font-style:normal;font-weight:900}
#ckRankList li.me{background:#FFF1C4;border-color:var(--choc)}
#ckRankList li.none{justify-content:center;color:var(--sub);font-weight:600;font-size:13px}
#playBtns .chip[id^="ckIng-"]{flex:0 0 calc(25% - 4.5px) !important;white-space:pre-line;line-height:1.15;font-size:12.5px;padding:3px 0;min-height:48px}
#playBtns .chip[id^="ckM-"]{flex:0 0 calc(20% - 4.8px) !important;white-space:pre-line;line-height:1.15;font-size:12.5px;padding:3px 0;min-height:48px}
`;

// K = { play, S(), itemObj(id), me(내 아바타), avatar(id), others(): Map, myId(), nameOf(id), online(), canEdit(), fx(m), toast(m), close(), setPose(p), busy(), reseat(), dirty() }
export function makeCookoff(K) {
  const $ = (id) => document.getElementById(id);
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = (tag, attrs, html) => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (html) e.innerHTML = html; e.hidden = true; return e; };
  const band = el('div', { id: 'cookBand', role: 'status' }, '<div class="ct"><b>🔔 요리 대결</b><span class="clk" id="ckClock"></span><small id="ckBandSub"></small></div><button type="button" class="btn" id="ckBandStop">그만하기</button>');
  const resP = el('div', { id: 'cookRes', class: 'ckP', role: 'dialog', 'aria-label': '심사 결과' },
    '<div class="sheet"><div class="ckDish"><b id="ckResIcon"></b><span><span id="ckResName"></span><small id="ckResIngs"></small></span></div>'
    + '<div class="ckCards" id="ckResCards"></div><div class="ckTotal" id="ckResTotal"></div><div class="row"><button type="button" class="btn main" id="ckResClose" style="flex:1">닫기</button></div></div>');
  const rankP = el('div', { id: 'cookRank', class: 'ckP', role: 'dialog', 'aria-label': '요리 대결 결과' },
    '<div class="sheet"><h2>🏆 요리 대결 결과 <small id="ckRankSub"></small></h2><ol id="ckRankList"></ol><div class="ckTotal" id="ckRankWin"></div>'
    + '<div class="row"><button type="button" class="btn main" id="ckRankClose" style="flex:1">닫기</button></div></div>');
  document.body.append(band, resP, rankP);
  $('ckResClose').addEventListener('click', () => { resP.hidden = true; if (rankWait) { rankWait = false; showRank(); } }); // 점수표를 닫으면 기다리던 순위를 보인다
  $('ckRankClose').addEventListener('click', () => { rankP.hidden = true; });
  $('ckBandStop').addEventListener('click', () => cancelContest());

  const me = () => K.myId();
  const who = (id) => (id === me() ? '나' : K.nameOf(id));
  const here = (id) => id === me() || (K.online() && K.others().has(id));
  const itemK = (id) => { const it = okItem(id) && K.S().items.get(id); return it ? it.k : null; };
  const has = (k) => { for (const it of K.S().items.values()) if (it.k === k) return true; return false; };
  const v3 = new THREE.Vector3();
  const world = (g, x, y, z) => { g.updateMatrixWorld(); const p = g.localToWorld(v3.set(x, y, z)); return [p.x, p.y, p.z]; };
  const tall = () => window.innerWidth < window.innerHeight;

  let mine = null;      // 내 요리 { s, st, i, m, w, at, c(요리 중이면 다 되는 때), r, j, jt(심사받은 때), sub(대결에 냈는지), subAt }
  let serial = 0, beatAt = 0, soundAt = 0, uiAt = 0, carrySig = '';
  let cur = null;       // 열린 놀이 판 (play.js 의 c: kind 'cook' | 'pantry' | 'judge')
  let basket = [], method = null; // 고른 재료(진열대에서 담아 온 것도), 조리법
  const peers = new Map();  // 친구의 접시 (사람 → 접시. t = 받은 때, c0 = 요리를 시작한 것을 본 때)
  const views = new Map();  // 접시 모양 (주인 → { g, key })
  const pans = new Map();   // 요리 중인 팬·냄비 속 (조리대 → { root, blobs, puffs, key, parent })
  const cards = new Map();  // 심사위원이 든 점수판 (심사석 → { root, key, parent, t0, mats })
  const known = new Set();  // 아는 사람 (새로 온 사람에게 내 접시를 바로 알린다)
  let C = null, R = null;   // 요리 대결의 공개 상태 { rid, ref, ph, end, pl, sub, at }, 심판만: { beat, seen, overAt }
  const ended = new Set();  // 취소된 대결 (늦게 온 소식을 무시한다)
  let lastRes = null, rankWait = false;

  /* ───────── 소식 ───────── */
  const send = (o) => { if (K.online()) K.fx({ k: 'cook', v: JSON.stringify(o) }); };
  const wire = (p) => ({ a: 'p', s: p.s, st: p.st, i: p.i, m: p.m, w: p.w, at: p.at || '', c: p.c ? 1 : 0, r: p.r || '', j: p.j ? 1 : 0 });
  function tellMine() { beatAt = clock(); send(mine ? wire(mine) : { a: 'x' }); K.dirty(); }
  const seedOf = (owner, p) => (p.r ? `${p.r}:${owner}` : '');
  const plates = () => { const out = []; if (mine) out.push([me(), mine]); for (const [o, p] of peers) out.push([o, p]); return out; };

  /* ───────── 내 요리 ───────── */
  function cookGo(c) {
    if (basket.length < 2) { K.toast('재료를 2가지 이상 골라요'); return; }
    if (!method) { K.toast('조리법을 골라요'); return; }
    if (mine && mine.c) { K.toast('지금 요리하는 중이에요'); return; }
    if (itemK(c.id) !== 'cookst') return;
    mine = { s: ++serial, st: c.id, i: canon(basket), m: method, w: 's', at: '', c: now() + COOK_T, r: C && C.ph === 'cook' ? C.rid : '', j: 0, jt: 0, sub: 0, subAt: 0 };
    sfx('chop'); soundAt = clock() - 400;
    c.step = 'cooking'; tellMine(); cookPaint(c);
  }
  function done() {
    mine.c = 0;
    const d = cookDish(mine.i, mine.m);
    sfx('ovenDing'); K.toast(`완성! ${d.icon} ${d.name}`);
    tellMine();
    if (cur && cur.kind === 'cook' && cur.id === mine.st) { cur.step = 'done'; cookPaint(cur); }
  }
  function clearMine() { if (!mine) return; mine = null; tellMine(); sfx('wipe'); }
  function carry() {
    if (!mine || mine.c) return;
    if (K.busy()) { K.toast('들고 있는 케이크나 피자를 내려놓고 들어요'); return; }
    mine.w = 'h'; mine.at = ''; tellMine(); sfx('carry'); K.close();
    K.toast('접시를 들었어요. 심사석에 가서 "🍽️ 심사받기"를 눌러요');
  }
  // 심사석에 낸다: 접시가 심사석으로 가고, 심사위원이 맛을 본 뒤(TASTE) 점수를 낸다
  function present(c) {
    if (!mine || mine.c || mine.j || itemK(c.id) !== 'judge') return;
    mine.w = 'j'; mine.at = c.id; tellMine(); sfx('tableBell');
    c.phase = 'taste'; c.t0 = now(); judgePaint(c);
  }
  function reveal(c) {
    c.phase = null;
    if (!mine || mine.j) { if (cur === c) judgePaint(c); return; }
    mine.j = 1; mine.jt = now(); tellMine();
    const res = judgeDish(mine.i, mine.m, seedOf(me(), mine));
    showResult(res); mark('cook', res.total);
    sfx(res.total >= 80 ? 'hooray' : 'pop');
    if (C && C.ph === 'cook') {
      if (mine.r === C.rid) submit();
      else K.toast('대결이 시작되기 전에 만든 요리라서 대결에는 들어가지 않아요. 새로 만들어 내요');
    }
    if (cur === c) judgePaint(c);
  }

  /* ───────── 요리 대결 ───────── */
  const copyC = () => (C ? { ...C, pl: [...C.pl], sub: C.sub.map((s) => [...s]) } : null);
  const subbed = (id) => !!C && C.sub.some((s) => s[0] === id);
  function whyNot() {
    if (C && C.ph === 'cook') return '지금 요리 대결 중이에요';
    if (!K.canEdit()) return '요리 대결은 꾸밀 수 있는 사람이 열어요';
    if (!has('cookst') || !has('judge')) return '조리대와 심사석이 있어야 요리 대결을 열 수 있어요';
    return '';
  }
  function startContest() {
    const w = whyNot();
    if (w) { K.toast(w); return false; }
    const prev = copyC(), pl = [me(), ...(K.online() ? [...K.others().keys()] : [])].filter(okId).slice(0, 16);
    C = { rid: now().toString(36) + Math.random().toString(36).slice(2, 5).padEnd(3, '0'), ref: me(), ph: 'cook', end: now() + CONTEST, pl, sub: [], at: clock() };
    R = { beat: 0, seen: new Set(pl), overAt: 0 };
    push(prev);
    return true;
  }
  const snapRound = () => ({ a: 'r', rid: C.rid, ref: C.ref, ph: C.ph, left: C.ph === 'cook' ? Math.max(0, Math.round(C.end - now())) : 0, pl: C.pl, sub: C.sub });
  function push(prev) { R.beat = clock(); send(snapRound()); changed(prev); }
  const amRef = () => !!C && !!R && C.ref === me();
  function finishContest(prev) { C.ph = 'over'; C.end = now(); R.overAt = clock(); push(prev); }
  function cancelContest(text) {
    if (!C || C.ph !== 'cook') return;
    if (amRef()) send({ a: 'q', rid: C.rid });
    ended.add(C.rid); C = null; R = null;
    K.toast(text || '🔔 요리 대결을 그만했어요');
    paintBand(); if (cur) repaint();
  }
  // 심판: 낸 요리를 받는다 (한 사람에 한 접시)
  function accept(from, i, m) {
    if (!amRef() || C.ph !== 'cook' || subbed(from) || C.sub.length >= 16 || !okIngs(i) || !MET.has(m)) return false;
    const prev = copyC();
    C.sub.push([from, canon(i), m]);
    if (!C.pl.includes(from) && C.pl.length < 16) C.pl.push(from);
    push(prev);
    return true;
  }
  function submit() {
    if (!C || C.ph !== 'cook' || !mine || mine.r !== C.rid || mine.sub) return false;
    mine.sub = 1; mine.subAt = clock();
    if (amRef()) accept(me(), mine.i, mine.m); else send({ a: 'sub', rid: C.rid, i: mine.i, m: mine.m });
    paintBand();
    return true;
  }
  // 심판: 시간과 사람을 본다
  function refTick(t, rt) {
    if (!amRef()) return;
    if (C.ph === 'over') { if (rt - R.overAt < 12 * SEC && rt - R.beat > BEAT) push(copyC()); return; } // 끝난 뒤에도 잠깐 결과를 다시 알린다
    const prev = copyC();
    let moved = false;
    if (C.pl.some((id) => !here(id))) { C.pl = C.pl.filter(here); moved = true; } // 나간 사람
    if (K.online()) for (const id of K.others().keys()) if (!R.seen.has(id)) { R.seen.add(id); if (okId(id) && C.pl.length < 16 && !C.pl.includes(id)) C.pl.push(id); moved = true; } // 도중에 온 사람도 같이 한다
    if (t >= C.end || (C.sub.length && C.pl.every((id) => subbed(id)))) { finishContest(prev); return; }
    if (moved || rt - R.beat > BEAT) push(prev);
  }
  // 다른 사람: 심판이 나갔거나 소식이 끊겼으면 취소
  function watch(rt) {
    if (!C || C.ph !== 'cook' || amRef()) return;
    if (!here(C.ref)) cancelContest(`대결을 연 ${josa(who(C.ref), '이', '가')} 나가서 요리 대결이 취소됐어요`);
    else if (rt - C.at > 14 * SEC) cancelContest('심판의 소식이 끊겨서 요리 대결이 취소됐어요');
  }
  function ranking(c = C) { return c ? c.sub.map(([id, i, m], n) => ({ id, n, res: judgeDish(i, m, `${c.rid}:${id}`) })).sort((a, b) => b.res.total - a.res.total || a.n - b.n) : []; }
  function changed(prev) {
    const fresh = !prev || prev.rid !== C.rid;
    if (fresh && C.ph === 'cook') {
      rankP.hidden = true;
      if (mine && mine.c) mine.r = C.rid; // 막 요리하던 것은 이번 대결의 요리로 친다
      K.toast(`🔔 요리 대결 시작! ${Math.round((C.end - now()) / 60000) || 1}분 안에 요리 한 접시를 만들어 심사석에 내요`);
      sfx('bells');
    }
    if (!fresh && prev.ph === 'cook') for (const s of C.sub) {
      if (prev.sub.some((x) => x[0] === s[0])) continue;
      if (s[0] === me()) K.toast('🍽️ 대결에 요리를 냈어요!');
      else K.toast(`🍽️ ${josa(who(s[0]), '이', '가')} 요리를 냈어요 (${C.sub.length}/${Math.max(C.pl.length, C.sub.length)})`);
    }
    if (C.ph === 'over' && !fresh && prev.ph === 'cook') showRank();
    paintBand();
    // 판은 대결이 바뀌었을 때만 새로 그린다 (4초마다 오는 같은 상태에 단추가 바뀌면 누르던 손가락이 헛누른다. 시계는 띠와 tick 이 바꾼다)
    if (cur && (fresh || prev.ph !== C.ph || prev.ref !== C.ref || prev.sub.length !== C.sub.length || prev.pl.length !== C.pl.length)) repaint();
  }
  function takeRound(o, from) {
    if (!okRid(o.rid) || !okId(o.ref) || !['cook', 'over'].includes(o.ph) || typeof o.left !== 'number' || !(o.left >= 0 && o.left <= 600 * SEC)) return false;
    if (!Array.isArray(o.pl) || o.pl.length > 16 || !o.pl.every(okId) || !Array.isArray(o.sub) || o.sub.length > 16) return false;
    const sub = [];
    for (const s of o.sub) {
      if (!Array.isArray(s) || s.length !== 3 || !okId(s[0]) || !okIngs(s[1]) || !MET.has(s[2]) || sub.some((x) => x[0] === s[0])) return false;
      sub.push([s[0], canon(s[1]), s[2]]);
    }
    if (from !== o.ref) return false; // 심판이 스스로 보낸 상태만 받는다
    if (ended.has(o.rid) || (C && C.rid === o.rid && C.ph === 'over' && o.ph === 'cook')) return true;
    if (C && C.rid !== o.rid) {
      if (C.ph === 'cook' && o.ph === 'cook' && o.rid > C.rid) return true; // 둘이 같이 열었으면 먼저 연 대결만 남는다
      if (C.ph === 'cook' && o.ph === 'over') return true;                  // 지난 대결의 결과
      if (C.ph === 'over' && o.ph === 'over' && o.rid < C.rid) return true;
      if (C.ph === 'cook') { ended.add(C.rid); R = null; }
    }
    const prev = copyC();
    C = { rid: o.rid, ref: o.ref, ph: o.ph, end: now() + o.left, pl: o.pl.slice(), sub, at: clock() };
    if (!prev || prev.rid !== C.rid) { if (C.ph === 'over') { paintBand(); if (cur) repaint(); return true; } } // 다 끝난 대결을 처음 들었으면 결과 판은 띄우지 않는다
    changed(prev);
    return true;
  }

  /* ───────── 친구에게서 온 소식 ───────── */
  function takePlate(o, from) {
    if (!Number.isInteger(o.s) || o.s < 1 || o.s > 1e9 || itemK(o.st) !== 'cookst' || !okIngs(o.i) || !MET.has(o.m) || !['s', 'h', 'j'].includes(o.w)) return false;
    if (o.w === 'j' ? itemK(o.at) !== 'judge' : o.at !== '') return false;
    if ((o.c !== 0 && o.c !== 1) || (o.j !== 0 && o.j !== 1) || !(o.r === '' || okRid(o.r))) return false;
    const old = peers.get(from), t = clock();
    const p = { s: o.s, st: o.st, i: canon(o.i), m: o.m, w: o.w, at: o.w === 'j' ? o.at : '', c: o.c, r: o.r, j: o.j, t };
    p.c0 = o.c ? (old && old.c && old.s === o.s ? old.c0 : t) : 0;
    p.jt = o.j ? (old && old.j && old.s === o.s ? old.jt : t) : 0;
    peers.set(from, p);
    if (old && old.s === p.s) {
      if (old.c && !p.c) sfx('ovenDing', K.itemObj(p.st)); // 친구 요리가 다 됐다
      if (!old.j && p.j) { // 친구가 방금 심사받았다
        const res = judgeDish(p.i, p.m, seedOf(from, p));
        K.toast(`🍽️ ${who(from)}의 ${res.dish.icon} ${res.dish.name}: ${res.total}점!`);
        sfx('tableBell', K.itemObj(p.at));
      }
    }
    K.dirty();
    return true;
  }
  function peerFx(m, from) {
    if (!m || typeof m.v !== 'string' || m.v.length > 1600 || !okId(from) || from === me()) return false;
    let o;
    try { o = JSON.parse(m.v); } catch (_) { return false; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    if (o.a === 'p') return takePlate(o, from);
    if (o.a === 'x') { if (peers.delete(from)) K.dirty(); return true; }
    if (o.a === 'r') return takeRound(o, from);
    if (o.a === 'sub') { // 심판에게 낸 요리 (심판이 아니면 전하기만 한다)
      if (!okRid(o.rid) || !okIngs(o.i) || !MET.has(o.m)) return false;
      if (amRef() && C.rid === o.rid) accept(from, o.i, o.m);
      return true;
    }
    if (o.a === 'q') {
      if (!okRid(o.rid)) return false;
      if (C && C.rid === o.rid && from === C.ref && C.ph === 'cook') cancelContest('🔔 심판이 요리 대결을 그만했어요');
      else ended.add(o.rid);
      return true;
    }
    return false;
  }

  /* ───────── 그리기: 접시, 팬·냄비 속, 불꽃, 점수판 ───────── */
  function dropView(o) { const v = views.get(o); if (!v) return; if (v.g.parent) v.g.parent.remove(v.g); freeGeo(v.g); views.delete(o); K.dirty(); }
  function dropPan(id) { const p = pans.get(id); if (!p) return; if (p.root.parent) p.root.parent.remove(p.root); if (p.liq) p.liq.geometry.dispose(); pans.delete(id); K.dirty(); } // 재료 알갱이·김은 도형을 나눠 쓴다
  function dropCards(id) { const c = cards.get(id); if (!c) return; if (c.root.parent) c.root.parent.remove(c.root); freeGeo(c.root); for (const m of c.mats) { m.map.dispose(); m.dispose(); } cards.delete(id); K.dirty(); }
  function makePan(g, u, ck) {
    const M0 = MET.get(ck.m), at = M0.pot ? u.pot : u.pan, root = new THREE.Group();
    root.position.set(...at); g.add(root);
    const cols = ck.i.map((x) => ING.get(x).col), red = ck.i.some((x) => x === 'kimchi' || x === 'chili' || x === 'tomato');
    let liq = null;
    if (M0.pot) liq = put(cyl(0.072, 0.072, 0.006, 16), M0.id === 'deep' ? 0xE8B04A : M0.id === 'steam' ? 0xDCE6E8 : red ? 0xC9442B : 0xE3C27E, 0, -0.012, 0, root, false);
    const blobs = [];
    for (let k = 0; k < 7; k++) { const b = put(blobGeo, M(cols[k % cols.length]), 0, 0, 0, root, false); b.userData.a = k * 0.9; blobs.push(b); }
    const puffs = [];
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(steamGeo, STEAM); s.renderOrder = 4; root.add(s); puffs.push(s); }
    for (const o of [root, ...blobs, ...puffs]) o.raycast = () => {};
    if (liq) liq.raycast = () => {};
    return { root, blobs, puffs, liq, pot: !!M0.pot, key: ck.key, parent: g };
  }
  function animPan(p, t) {
    const s = t / 1000;
    p.blobs.forEach((b, k) => {
      const a = b.userData.a + s * (p.pot ? 0.8 : 1.6), r = 0.025 + (k % 3) * 0.013;
      b.position.set(Math.cos(a) * r, p.pot ? -0.004 + 0.004 * Math.sin(s * 5 + k) : 0.006 + Math.abs(Math.sin(s * 7 + k * 0.9)) * 0.035, Math.sin(a) * r);
    });
    p.puffs.forEach((q, k) => { const f = (s * 0.7 + k / 3) % 1; q.position.set(Math.sin(k * 2.1 + s) * 0.02, 0.03 + f * 0.25, Math.cos(k * 1.7) * 0.02); q.scale.setScalar(0.015 + f * 0.04); });
  }
  function makeCards(g, u, res) {
    const root = new THREE.Group(), mats = [], parts = [];
    g.add(root);
    res.sc.forEach((v, k) => {
      const arm = new THREE.Group(); arm.position.set(...u.cards[k]); root.add(arm);
      put(cyl(0.006, 0.006, 0.16, 5), 0xC99A6B, 0, -0.1, 0, arm, false);
      const mat = cardMat(k, v); mats.push(mat);
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.15), mat); card.position.y = 0.04; arm.add(card);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.15), M(0xFFFAF2)); back.rotation.y = Math.PI; back.position.y = 0.04; arm.add(back);
      parts.push(arm);
    });
    root.traverse((o) => { o.raycast = () => {}; });
    return { root, mats, parts, parent: g, t0: clock() };
  }
  function animCards(c, t) {
    c.parts.forEach((arm, k) => { const e = clamp((t - c.t0 - k * 250) / 400, 0, 1), q = 1 - (1 - e) * (1 - e); arm.scale.setScalar(Math.max(0.001, q)); arm.position.y = c.base[k] - 0.25 * (1 - q); });
  }
  function sync(rt) {
    const S = K.S(), all = plates();
    // 요리 중인 조리대: 불꽃·팬 속·소리
    const cooking = new Map();
    for (const [o, p] of all) if (p.c && itemK(p.st) === 'cookst' && !cooking.has(p.st)) cooking.set(p.st, { o, m: p.m, i: p.i, key: o + ':' + p.s });
    for (const [id, it] of S.items) {
      if (it.k !== 'cookst') continue;
      const g = K.itemObj(id), u = g && g.userData.cook;
      if (!u) continue;
      const ck = cooking.get(id), pot = !!ck && !!MET.get(ck.m).pot;
      if (u.fl.pot.visible !== (!!ck && pot)) { u.fl.pot.visible = !!ck && pot; K.dirty(); }
      if (u.fl.pan.visible !== (!!ck && !pot)) { u.fl.pan.visible = !!ck && !pot; K.dirty(); }
      let pn = pans.get(id);
      if (pn && (!ck || pn.key !== ck.key || pn.parent !== g)) { dropPan(id); pn = null; }
      if (ck && !pn) { pn = makePan(g, u, ck); pans.set(id, pn); }
      if (pn) animPan(pn, rt);
    }
    for (const id of [...pans.keys()]) if (itemK(id) !== 'cookst') dropPan(id);
    if (cooking.size && rt - soundAt > 800) {
      soundAt = rt;
      for (const [st, ck] of cooking) { const n = MET.get(ck.m).snd; if (ck.o === me()) sfx(n); else sfx(n, K.itemObj(st)); }
    }
    // 접시: 조리대의 빈자리, 든 사람의 손, 심사석의 빈자리 (주인 id 차례로 자리를 나눈다. 모두에게 같다)
    const place = (o, p) => (p.w === 'h' && K.avatar(o) ? 'h:' + o : p.w === 'j' && itemK(p.at) === 'judge' ? 'j:' + p.at : 's:' + p.st);
    const groups = new Map();
    for (const [o, p] of all) { if (p.c) continue; const k = place(o, p); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); }
    for (const l of groups.values()) l.sort();
    const live = new Set();
    for (const [o, p] of all) {
      if (p.c) continue;
      const k = place(o, p), n = groups.get(k).indexOf(o);
      let parent = null, pos = null;
      if (k[0] === 'h') { parent = K.avatar(o).root; pos = HAND; }
      else {
        const g = K.itemObj(k.slice(2)), u = g && (k[0] === 'j' ? g.userData.judge : g.userData.cook);
        if (!u || n >= u.spots.length) continue;
        parent = g; pos = u.spots[n];
      }
      live.add(o);
      const key = p.i.join(',') + '|' + p.m;
      let v = views.get(o);
      if (v && v.key !== key) { dropView(o); v = null; }
      if (!v) { v = { g: plated(cookDish(p.i, p.m)), key }; views.set(o, v); }
      if (v.g.parent !== parent) { parent.add(v.g); K.dirty(); }
      if (v.k !== k || v.n !== n) { v.k = k; v.n = n; v.g.position.set(...pos); K.dirty(); }
    }
    for (const o of [...views.keys()]) if (!live.has(o)) dropView(o);
    // 심사위원이 든 점수판: 그 심사석에서 가장 마지막에 심사받은 접시의 점수
    for (const [id, it] of S.items) {
      if (it.k !== 'judge') continue;
      const g = K.itemObj(id), u = g && g.userData.judge;
      if (!u) continue;
      let best = null;
      for (const [o, p] of all) if (!p.c && p.w === 'j' && p.at === id && p.j && (!best || p.jt > best[1].jt)) best = [o, p];
      const key = best ? `${best[0]}:${best[1].s}:${best[1].r}` : '';
      let cd = cards.get(id);
      if (cd && (cd.key !== key || cd.parent !== g)) { dropCards(id); cd = null; }
      if (!cd && best) { cd = makeCards(g, u, judgeDish(best[1].i, best[1].m, seedOf(best[0], best[1]))); cd.key = key; cd.base = u.cards.map((q) => q[1]); cards.set(id, cd); }
      if (cd && rt - cd.t0 < 1500) { animCards(cd, rt); K.dirty(); }
    }
    for (const id of [...cards.keys()]) if (itemK(id) !== 'judge') dropCards(id);
    // 접시를 든 사람은 두 팔을 내민다 (app.js 의 seatCakes)
    const cs = all.filter(([o, p]) => !p.c && p.w === 'h' && K.avatar(o)).map(([o]) => o).sort().join(',');
    if (cs !== carrySig) { carrySig = cs; K.reseat(); }
  }

  /* ───────── 판 ───────── */
  const quit = { label: '그만하기', id: 'playQuit', fn: () => K.close() };
  const startBtn = (main) => (!whyNot() ? [{ label: main ? '🔔 요리 대결 시작 (2분)' : '🔔 대결', main: !!main, id: 'ckStart', fn: () => startContest() }] : []);
  const liveTag = () => (C && C.ph === 'cook' ? '🔔 대결 중 · ' : ''); // 남은 시간은 위의 띠에
  function pickChips(c, paint) {
    return INGS.map((x) => ({ label: `${x.icon}\n${x.name}`, chip: true, id: 'ckIng-' + x.id, on: basket.includes(x.id), fn: () => {
      if (basket.includes(x.id)) basket = basket.filter((y) => y !== x.id);
      else if (basket.length >= 4) { K.toast('재료는 4가지까지 골라요'); return; } else basket.push(x.id);
      paint(c);
    } }));
  }
  const basketText = () => basket.map((x) => `${ING.get(x).icon} ${ING.get(x).name}`).join(' · ');
  function cookPaint(c) {
    const p = mine && mine.st === c.id ? mine : null;
    if (c.step === 'cooking' && p && p.c) {
      const M0 = MET.get(p.m);
      K.play.panel(`${M0.doing} ${M0.icon}`, `${icons(p.i)} · ${Math.round(clamp(1 - (p.c - now()) / COOK_T, 0, 1) * 100)}%`, [quit]);
    } else if (c.step === 'done' && p && !p.c) {
      const d = cookDish(p.i, p.m), live = C && C.ph === 'cook' && p.r === C.rid;
      K.play.panel(`완성! ${d.icon} ${d.name}`, liveTag() + (live ? '심사석에 가져가 내면 대결에 제출돼요' : '들고 가서 심사석에서 "🍽️ 심사받기"를 눌러요'), [
        { label: '🧤 들고 가기', main: true, id: 'playGo', fn: () => carry() },
        { label: '🍳 새로 만들기', id: 'ckNew', fn: () => { c.step = 'pick'; cookPaint(c); } },
        { label: '🗑️ 치우기', id: 'ckClear', fn: () => { clearMine(); c.step = 'pick'; cookPaint(c); } },
        quit]);
    } else if (c.step === 'method') {
      const M0 = method && MET.get(method);
      K.play.panel('조리법 고르기', `${liveTag()}${icons(basket)} → ${M0 ? M0.icon + ' ' + M0.name : '어떻게 요리할까요?'}`, [
        ...METHODS.map((x) => ({ label: `${x.icon}\n${x.name}`, chip: true, id: 'ckM-' + x.id, on: method === x.id, fn: () => { method = x.id; cookPaint(c); } })),
        { label: '🔥 요리 시작', main: true, id: 'playGo', fn: () => cookGo(c) },
        { label: '← 재료', id: 'ckBack', fn: () => { c.step = 'pick'; cookPaint(c); } },
        quit]);
    } else {
      c.step = 'pick';
      K.play.panel(`재료 고르기 (${basket.length}/4)`, liveTag() + (basket.length ? basketText() : '2~4가지를 골라요. 재료 진열대에서 담아 와도 돼요'), [
        ...pickChips(c, cookPaint),
        { label: '다음: 조리법 →', main: true, id: 'playGo', fn: () => { if (basket.length < 2) { K.toast('재료를 2가지 이상 골라요'); return; } c.step = 'method'; cookPaint(c); } },
        ...startBtn(false), quit]);
    }
  }
  function pantryPaint(c) {
    K.play.panel(`재료 담기 (${basket.length}/4)`, basket.length ? basketText() : '요리에 쓸 재료를 2~4가지 담아요', [
      ...pickChips(c, pantryPaint),
      { label: '🧺 다 담았어요', main: true, id: 'playGo', fn: () => { if (basket.length < 2) { K.toast('재료를 2가지 이상 담아요'); return; } K.close(); K.toast(`재료 ${basket.length}가지를 담았어요 🧺 조리대에서 "🍳 요리하기"`); } },
      ...(basket.length ? [{ label: '비우기', id: 'ckEmpty', fn: () => { basket = []; pantryPaint(c); } }] : []),
      quit]);
  }
  function judgePaint(c) {
    if (c.phase === 'taste') { K.play.panel('심사 중… 🔔', '심사위원 셋이 맛을 보고 있어요', [quit]); return; }
    const p = mine, d = p && cookDish(p.i, p.m), res = p && p.j ? judgeDish(p.i, p.m, seedOf(me(), p)) : null, live = C && C.ph === 'cook';
    const main = live ? `🔔 요리 대결 중 · ${fmt(C.end - now())}` : '🍽️ 심사석';
    let sub;
    if (p && p.c) sub = '요리가 다 되면 가져와요';
    else if (res) sub = `내 요리 ${d.icon} ${d.name}: ${res.total}점` + (live && subbed(me()) ? ' · 대결에 냈어요' : '');
    else if (p) sub = `${d.icon} ${josa(d.name, '을', '를')} 내면 맛·창의·완성도를 봐요`;
    else sub = '조리대에서 요리를 만들어 오면 심사위원 셋이 맛·창의·완성도를 봐요';
    K.play.panel(main, sub, [
      ...(p && !p.c && !p.j ? [{ label: '🍽️ 심사받기', main: true, id: 'playGo', fn: () => present(c) }] : []),
      ...(res ? [{ label: '📋 점수표', id: 'ckCard', fn: () => showResult(res) }] : []),
      ...startBtn(!(p && !p.c && !p.j)),
      ...(C && C.ph === 'over' ? [{ label: '🏆 대결 결과', id: 'ckRank', fn: () => showRank() }] : []),
      ...(live && amRef() ? [{ label: '대결 그만하기', id: 'ckStop', fn: () => cancelContest() }] : []),
      quit]);
  }
  const repaint = () => { if (!cur) return; if (cur.kind === 'cook') cookPaint(cur); else if (cur.kind === 'pantry') pantryPaint(cur); else if (cur.kind === 'judge') judgePaint(cur); };
  function pose(c, x, y, z, ax, ay, az, fov) { K.setPose({ pos: world(c.g, x, y, z), at: world(c.g, ax, ay, az), fov, inside: true }); }
  K.play.add('cook', {
    start(c) {
      if (mine && mine.c && mine.st !== c.id) { K.toast('다른 조리대에서 요리하는 중이에요'); return false; }
      cur = c;
      if (mine && !mine.c && mine.w === 'h') { mine.st = c.id; mine.w = 's'; tellMine(); sfx('setDown'); } // 든 접시는 이 조리대에 내려놓는다
      c.step = mine && mine.c ? 'cooking' : mine && mine.st === c.id && mine.w === 's' ? 'done' : 'pick';
      if (tall()) pose(c, 0.02, 1.95, 1.0, 0.02, 0.88, 0.02, 60); else pose(c, 0.02, 1.65, 0.85, 0.02, 0.88, 0.02, 44);
      cookPaint(c);
    },
    paint: (c) => cookPaint(c), tick() {}, tap() {},
    stop() { cur = null; },
  });
  K.play.add('pantry', {
    start(c) { cur = c; if (tall()) pose(c, 0, 1.25, 1.75, 0, 0.75, 0, 58); else pose(c, 0, 1.15, 1.45, 0, 0.78, 0, 46); pantryPaint(c); },
    paint: (c) => pantryPaint(c), tick() {}, tap() {},
    stop() { cur = null; },
  });
  K.play.add('judge', {
    start(c) {
      cur = c; c.phase = null;
      if (tall()) pose(c, 0, 1.78, 2.6, 0, 0.92, 0, 58); else pose(c, 0, 1.45, 1.8, 0, 0.88, 0, 46); // 심사위원 셋과 점수판이 다 들어오게
      if (mine && !mine.c && !mine.j) present(c); else judgePaint(c);
    },
    paint: (c) => judgePaint(c),
    tick(c) { if (c.phase === 'taste' && now() - c.t0 >= TASTE) reveal(c); },
    tap() {},
    stop(c) { cur = null; if (c.phase === 'taste') reveal(c); }, // 맛보는 중에 닫아도 점수는 나온다
  });

  /* ───────── 점수표·순위 판 ───────── */
  function showResult(res) {
    lastRes = res;
    const d = res.dish;
    $('ckResIcon').textContent = d.icon; $('ckResName').textContent = d.name;
    $('ckResIngs').textContent = d.I.map((x) => `${ING.get(x).icon} ${ING.get(x).name}`).join(' · ') + ' · ' + MET.get(d.m).name;
    const box = $('ckResCards'); box.textContent = '';
    JUDGES.forEach((j, k) => {
      const c = document.createElement('div'); c.className = 'ckCard';
      const i = document.createElement('i'), em = document.createElement('em'), b = document.createElement('b'), sm = document.createElement('small'), p = document.createElement('p');
      i.textContent = j.icon; em.textContent = j.name; const w = document.createElement('u'); w.textContent = j.what; w.style.color = j.col; em.appendChild(w); b.textContent = String(res.sc[k]); sm.textContent = '/' + j.max; b.appendChild(sm); p.textContent = res.notes[k];
      c.append(i, em, b, p); box.appendChild(c);
    });
    $('ckResTotal').innerHTML = `총점 <b>${res.total | 0}</b> / 100 · ${verdict(res.total)}`;
    rankP.hidden = true; resP.hidden = false;
  }
  function showRank() {
    if (!C) return;
    if (!resP.hidden) { rankWait = true; return; } // 방금 받은 점수표를 다 본 뒤에
    const list = ranking(C), ol = $('ckRankList'), MEDAL = ['🥇', '🥈', '🥉'];
    ol.textContent = '';
    if (!list.length) { const li = document.createElement('li'); li.className = 'none'; li.textContent = '아무도 요리를 내지 않았어요'; ol.appendChild(li); }
    list.forEach((r, n) => { // 이름은 textContent 로만 넣는다
      const li = document.createElement('li'), no = document.createElement('b'), nm = document.createElement('span'), sm = document.createElement('small'), pt = document.createElement('em');
      if (r.id === me()) li.className = 'me';
      no.textContent = MEDAL[n] || String(n + 1); nm.textContent = who(r.id); sm.textContent = `${r.res.dish.icon} ${r.res.dish.name}`; nm.appendChild(sm); pt.textContent = `${r.res.total}점`;
      li.append(no, nm, pt); ol.appendChild(li);
    });
    const solo = C.pl.length <= 1 && list.length <= 1, mineR = list.find((r) => r.id === me());
    let best = 0;
    if (mineR) { try { best = Math.max(mineR.res.total, Number(localStorage.getItem(BEST_KEY)) || 0); localStorage.setItem(BEST_KEY, String(best)); } catch (_) { best = mineR.res.total; } }
    $('ckRankSub').textContent = solo ? '혼자 대결' : `${list.length}명이 냈어요`;
    const win = list[0];
    $('ckRankWin').textContent = !win ? '' : solo ? `${win.res.dish.icon} ${win.res.dish.name} ${win.res.total}점! · 내 최고 점수 ${best}점` : `🏆 우승 요리: ${win.res.dish.icon} ${win.res.dish.name} (${who(win.id)})`;
    resP.hidden = true; rankP.hidden = false;
    sfx('hooray');
  }
  function paintBand() {
    const on = !!C && C.ph === 'cook';
    if (band.hidden === on) { band.hidden = !on; document.body.classList.toggle('ck', on); }
    if (!on) return;
    const gb = $('gameBand'), left = C.end - now();
    band.classList.toggle('low', !!gb && !gb.hidden);
    band.classList.toggle('hurry', left < 20 * SEC);
    $('ckClock').textContent = fmt(left);
    const what = subbed(me()) ? '✅ 냈어요' : mine && mine.sub ? '🍽️ 내는 중…' : mine && mine.r === C.rid && !mine.c ? '🍽️ 심사석에 내요' : mine && mine.c ? '🍳 요리하는 중' : '🍳 조리대에서 요리해요';
    $('ckBandSub').textContent = `${what} · 낸 사람 ${C.sub.length}/${Math.max(C.pl.length, C.sub.length)}`;
    $('ckBandStop').hidden = !amRef();
  }

  /* ───────── 매 프레임 ───────── */
  function tick() {
    const t = now(), rt = clock();
    // 친구의 접시: 나갔거나 소식이 끊기면 치운다
    for (const [id, p] of [...peers]) if (!K.online() || (!K.others().has(id) && rt - p.t > 3000) || rt - p.t > LOST) { peers.delete(id); K.dirty(); }
    if (K.online()) {
      let fresh = false;
      for (const id of K.others().keys()) if (!known.has(id)) { known.add(id); fresh = true; }
      for (const id of [...known]) if (!K.others().has(id)) known.delete(id);
      if (fresh && mine) tellMine(); // 새로 온 사람도 내 접시를 본다
    } else known.clear();
    if (mine) {
      if (mine.w !== 'h' && itemK(mine.st) !== 'cookst' && !(mine.w === 'j' && itemK(mine.at) === 'judge')) { mine = null; tellMine(); K.toast('조리대가 치워져서 요리도 치웠어요'); }
      else {
        if (mine.c && t >= mine.c) done();
        if (mine.w === 'j' && itemK(mine.at) !== 'judge') { mine.w = 's'; mine.at = ''; tellMine(); }
        if (mine.w === 'h' && (K.busy() || (K.me && K.me.rest))) { // 케이크·피자를 들었거나 누웠으면 접시는 조리대로
          if (itemK(mine.st) === 'cookst') { mine.w = 's'; tellMine(); K.toast('접시를 조리대에 두었어요'); } else { mine = null; tellMine(); }
        }
        if (mine && K.online() && rt - beatAt > BEAT) tellMine();
        if (mine && mine.sub && C && C.ph === 'cook' && !amRef() && mine.r === C.rid && !subbed(me()) && rt - mine.subAt > 3 * SEC) { mine.subAt = rt; send({ a: 'sub', rid: C.rid, i: mine.i, m: mine.m }); } // 받았다는 소식이 없으면 다시 낸다
      }
    }
    if (C) { if (amRef()) refTick(t, rt); else watch(rt); }
    sync(rt);
    if (rt - uiAt > 250) { // 시계·진행률 글만 바꾼다 (판을 새로 그리지 않는다)
      uiAt = rt;
      paintBand();
      if (cur && cur.kind === 'cook' && cur.step === 'cooking' && mine && mine.c) $('playSub').textContent = `${icons(mine.i)} · ${Math.round(clamp(1 - (mine.c - t) / COOK_T, 0, 1) * 100)}%`;
      if (cur && cur.kind === 'judge' && !cur.phase && C && C.ph === 'cook') $('playMain').textContent = `🔔 요리 대결 중 · ${fmt(C.end - t)}`;
    }
  }

  return {
    tick, peerFx,
    // 가구 앞에서 할 수 있는 일의 이름 (app.js 의 actionOf). 요리 대결 가구가 아니면 null
    label(it) {
      if (it.k === 'cookst') return mine && !mine.c && mine.w === 'h' ? '🍽️ 접시 내려놓기' : '🍳 요리하기';
      if (it.k === 'pantry') return '🧺 재료 고르기';
      if (it.k === 'judge') return mine && !mine.c && !mine.j ? '🍽️ 심사받기' : '🔔 요리 대결';
      return null;
    },
    carriers() { return plates().filter(([o, p]) => !p.c && p.w === 'h').map(([o]) => o); }, // 접시를 든 사람들 (두 팔을 내민다)
    get on() { return !!C && C.ph === 'cook'; },
    test: {
      INGS, METHODS, DISHES, JUDGES, COOK_T, CONTEST,
      cook(ings, m) { const d = cookDish(ings, m); return { id: d.id, name: d.name, icon: d.icon, extra: d.extra.slice() }; },
      judge(ings, m, seed) { const r = judgeDish(ings, m, seed); return { name: r.dish.name, sc: r.sc.slice(), total: r.total, notes: r.notes.slice() }; },
      get basket() { return basket.slice(); }, set basket(a) { basket = Array.isArray(a) ? a.filter((x) => ING.has(x)).slice(0, 4) : []; if (cur) repaint(); },
      get method() { return method; }, set method(m) { method = MET.has(m) ? m : null; if (cur) repaint(); },
      get step() { return cur ? cur.step || cur.phase || null : null; }, get kind() { return cur ? cur.kind : null; },
      get mine() { return mine ? { ...mine, i: mine.i.slice(), c: mine.c ? 1 : 0, name: cookDish(mine.i, mine.m).name } : null; },
      get peers() { return [...peers].map(([id, p]) => ({ id, ...p, i: p.i.slice() })); },
      get views() { return [...views].map(([o, v]) => ({ owner: o, where: v.k, n: v.n, shown: !!v.g.parent, at: v.g.parent && v.g.parent.userData.item ? v.g.parent.userData.item : null })); },
      flames(id) { const g = K.itemObj(id), u = g && g.userData.cook; return u ? { pot: u.fl.pot.visible, pan: u.fl.pan.visible, pan3: pans.has(id) } : null; },
      cards(id) { const c = cards.get(id); return c ? { key: c.key, shown: !!c.root.parent } : null; },
      get contest() { return C ? { rid: C.rid, ref: C.ref, ph: C.ph, left: Math.max(0, C.end - now()), pl: C.pl.slice(), sub: C.sub.map((s) => [...s]) } : null; },
      get rank() { return ranking(C).map((r) => ({ id: r.id, name: r.res.dish.name, total: r.res.total })); },
      get band() { return band.hidden ? null : { clock: $('ckClock').textContent, sub: $('ckBandSub').textContent, stop: !$('ckBandStop').hidden, low: band.classList.contains('low') }; },
      get result() { return resP.hidden ? null : { name: $('ckResName').textContent, total: lastRes ? lastRes.total : null, sc: lastRes ? lastRes.sc.slice() : null, cards: $('ckResCards').children.length }; },
      get ranked() { return rankP.hidden ? null : { items: [...$('ckRankList').children].map((li) => li.textContent), win: $('ckRankWin').textContent, sub: $('ckRankSub').textContent }; },
      start: () => startContest(), stop: () => cancelContest(), why: () => whyNot(),
      finish() { if (mine && mine.c) mine.c = now(); }, // 검사용: 요리를 바로 끝낸다 (다음 프레임에 다 된다)
      peerFx: (m, id) => peerFx(m, id),
      ended: () => [...ended],
    },
  };
}
