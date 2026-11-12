// 고를 수 있는 것들의 목록. 화면과 상관없는 자료만 둔다.
// 가구: w × d 는 차지하는 바닥 칸 수(돌리지 않았을 때). solid 가 false 면 밟고 지나갈 수 있다(러그).
// play 가 있으면 눌러서 놀 수 있는 가구다(놀이는 play.js). lie = 누울 수 있다(침대), snack = 간식을 꺼내 먹는다(냉장고).
export const FURNITURE = [
  { id: 'sofa', name: '소파', icon: '🛋️', w: 4, d: 2, solid: true },
  { id: 'chair', name: '안락의자', icon: '🪑', w: 2, d: 2, solid: true },
  { id: 'fire', name: '벽난로', icon: '🔥', w: 4, d: 2, solid: true, play: 'fire' },
  { id: 'table', name: '탁자', icon: '☕', w: 3, d: 2, solid: true, holds: 0.465 }, // holds = 케이크를 올려놓을 수 있는 윗면 높이
  { id: 'shelf', name: '책장', icon: '📚', w: 3, d: 1, solid: true },
  { id: 'giftR', name: '빨간 선물', icon: '🎁', w: 1, d: 1, solid: true },
  { id: 'giftG', name: '초록 선물', icon: '🎁', w: 1, d: 1, solid: true },
  { id: 'plant', name: '포인세티아', icon: '🌺', w: 1, d: 1, solid: true },
  { id: 'lamp', name: '스탠드', icon: '💡', w: 1, d: 1, solid: true },
  { id: 'snowman', name: '눈사람', icon: '⛄', w: 1, d: 1, solid: true },
  { id: 'rug', name: '러그', icon: '🟦', w: 3, d: 2, solid: false },
  { id: 'dart', name: '다트판', icon: '🎯', w: 1, d: 1, solid: true, play: 'dart' },
  { id: 'tv', name: 'TV', icon: '📺', w: 3, d: 1, solid: true, play: 'tv' },
  { id: 'music', name: '오르골', icon: '🎶', w: 1, d: 1, solid: true, play: 'music' },
  // 주방
  { id: 'cake', name: '케이크 작업대', icon: '🎂', w: 3, d: 2, solid: true, play: 'cake' },
  { id: 'counter', name: '조리대', icon: '🔪', w: 2, d: 1, solid: true },
  { id: 'stove', name: '오븐', icon: '🍳', w: 2, d: 1, solid: true, play: 'bake' }, // 새 케이크를 굽는다
  { id: 'fridge', name: '냉장고', icon: '🧊', w: 2, d: 1, solid: true, snack: true },
  // 방
  { id: 'bed', name: '침대', icon: '🛏️', w: 3, d: 4, solid: true, lie: true },
  { id: 'closet', name: '옷장', icon: '🚪', w: 3, d: 1, solid: true },
  { id: 'stand', name: '협탁', icon: '🕯️', w: 1, d: 1, solid: true },
  // 현관
  { id: 'guest', name: '방명록', icon: '📖', w: 1, d: 1, solid: true, play: 'guest' }, // 놀러 온 사람이 한마디 남긴다 (book.js)
];

// 새로 시작하는 방에 처음부터 놓여 있는 가구 [종류, i, j, 돌린 횟수]. 놀 수 있는 가구들이고, 다른 가구처럼 옮기거나 치울 수 있다.
export const STARTER = [['fire', 6, 0, 0], ['tv', 0, 6, 1], ['dart', 11, 0, 0], ['music', 15, 12, 3]];
// 주방과 방에 처음부터 놓여 있는 가구. 거실만 있던 때(저장 형식 v 1)에 꾸민 방을 열 때도 이것만 더해 준다.
export const STARTER_EAST = [
  ['counter', 21, 0, 0], ['stove', 23, 0, 0], ['counter', 25, 0, 0], ['fridge', 28, 0, 0], ['cake', 24, 4, 0],
  ['bed', 26, 12, 3], ['stand', 29, 11, 3], ['closet', 22, 17, 2],
];

// 마당과 2층에 처음부터 놓여 있는 가구. 마당·2층이 없던 때에 꾸민 방을 열 때도 이것만 더해 준다(칸 번호는 path.js 의 YARD, LOFT).
export const STARTER_UP = [
  ['snowman', 14, 21, 0], ['giftR', 12, 20, 0], ['giftG', 13, 21, 0],          // 마당
  ['rug', 35, 5, 0], ['chair', 35, 2, 0], ['lamp', 41, 0, 0], ['shelf', 37, 0, 0], // 2층
  ['guest', 6, 16, 2],                                                             // 현관 안쪽 옆의 방명록 (북쪽을 본다)
];

// 케이크: 크림 색, 올릴 수 있는 장식, 치수(케이크 작업대 기준). r = 윗면 반지름, y = 윗면 높이, max = 장식 개수
export const CREAMS = [
  { id: 'white', name: '생크림', hex: 0xFFF8EA }, { id: 'pink', name: '딸기크림', hex: 0xF7B6C2 },
  { id: 'choco', name: '초코크림', hex: 0x7B4A2D }, { id: 'matcha', name: '말차크림', hex: 0xB7CF8A },
];
export const TOPPINGS = [
  { id: 'berry', name: '딸기', icon: '🍓' }, { id: 'cherry', name: '체리', icon: '🍒' }, { id: 'choco', name: '초콜릿', icon: '🍫' },
  { id: 'star', name: '별', icon: '⭐' }, { id: 'tree', name: '트리', icon: '🎄' }, { id: 'candle', name: '초', icon: '🕯️' },
];
export const CAKE = { r: 0.3, y: 1.14, max: 40, base: 0.895, onTable: 0.9, inHand: 0.5, slices: 8, many: 12 }; // slices = 한 판의 조각 수, many = 방에 있을 수 있는 케이크 수 // base = 접시 바닥 높이, onTable·inHand = 탁자 위·손에 들었을 때의 크기

// 다트판: 가운데 높이 y, 판 겉면 z(가구 기준), R = 점수가 나는 바깥 끝, out = 숫자가 적힌 테까지의 반지름.
// nums = 맨 위부터 시계 방향으로 칸의 숫자. 고리는 R 에 대한 비율: 한가운데 50점, 그 둘레 25점,
// 3배 칸(t0~t1), 2배 칸(d0~끝). 실제 다트판보다 좁은 칸을 조금 넓혀서 폰에서도 맞힐 수 있게 했다.
export const DART = {
  y: 1.3, z: 0.036, R: 0.28, out: 0.335,
  nums: [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5],
  bull: 0.07, bull2: 0.16, t0: 0.52, t1: 0.63, d0: 0.87,
};
// 다트판의 (x, y) 자리에 맞았을 때의 점수 (판 가운데가 0, 0, 위가 +y, 보는 사람 오른쪽이 +x)
export function dartScore(x, y) {
  const r = Math.hypot(x, y) / DART.R;
  if (r > 1) return { pts: 0, say: '빗나갔어요', miss: true };
  if (r <= DART.bull) return { pts: 50, say: '한가운데! 50점' };
  if (r <= DART.bull2) return { pts: 25, say: '가운데 둘레 25점' };
  const a = (Math.atan2(x, y) + Math.PI * 2 + Math.PI / 20) % (Math.PI * 2);
  const n = DART.nums[Math.floor(a / (Math.PI / 10)) % 20];
  if (r >= DART.t0 && r <= DART.t1) return { pts: n * 3, say: `${n}의 3배! ${n * 3}점` };
  if (r >= DART.d0) return { pts: n * 2, say: `${n}의 2배! ${n * 2}점` };
  return { pts: n, say: `${n}점` };
}
// TV 화면: 가로 w, 세로 h, 가운데 높이 y, 화면 z
export const TV = { w: 1.18, h: 0.664, y: 0.87, z: 0.014 };
// 오르골 캐럴(모두 오래된 곡). notes = [음 높이(미디 번호, 0 은 쉼), 박자 수]
const n = (txt) => txt.trim().split(/\s+/).map((t) => { const [a, b] = t.split(':'); return [+a, +(b || 1)]; });
export const SONGS = [
  { id: 'jingle', name: '징글벨', bpm: 190, notes: n(`64 64 64:2 64 64 64:2 64 67 60:1.5 62:.5 64:4 65 65 65:1.5 65:.5 65 64 64 64:.5 64:.5 64 62 62 64 62:2 67:2
    64 64 64:2 64 64 64:2 64 67 60:1.5 62:.5 64:4 65 65 65:1.5 65:.5 65 64 64 64:.5 64:.5 67 67 65 62 60:4`) },
  { id: 'wish', name: '위 위시 유', bpm: 150, notes: n(`67 72 72:.5 74:.5 72:.5 71:.5 69 69 69 74 74:.5 76:.5 74:.5 72:.5 71 67 67 76 76:.5 77:.5 76:.5 74:.5 72 69 67:.5 67:.5 69 74 71 72:2`) },
  { id: 'silent', name: '고요한 밤', bpm: 96, notes: n(`67:1.5 69:.5 67 64:3 67:1.5 69:.5 67 64:3 74:2 74 71:3 72:2 72 67:3
    69:2 69 72:1.5 71:.5 69 67:1.5 69:.5 67 64:3 69:2 69 72:1.5 71:.5 69 67:1.5 69:.5 67 64:3
    74:2 74 77:1.5 74:.5 71 72:3 76:3 72:1.5 67:.5 64 67:1.5 65:.5 62 60:3`) },
];

// 트리 장식. 'cut' 은 장식이 아니라 떼는 도구라 여기에 없다.
export const ORNAMENTS = [
  { id: 'red', name: '빨강', icon: '🔴' },
  { id: 'gold', name: '금', icon: '🟡' },
  { id: 'blue', name: '파랑', icon: '🔵' },
  { id: 'silver', name: '은', icon: '⚪' },
  { id: 'star', name: '별', icon: '⭐' },
  { id: 'cane', name: '사탕', icon: '🍬' },
  { id: 'bow', name: '리본', icon: '🎀' },
  { id: 'bell', name: '종', icon: '🔔' },
];

// 전구 색 묶음과 깜빡임
export const LIGHT_SETS = [
  { id: 'off', name: '끄기', colors: [] },
  { id: 'warm', name: '따뜻한', colors: [0xFFE9A8, 0xFFD37A] },
  { id: 'multi', name: '알록달록', colors: [0xFF3B30, 0x34D36B, 0x3D8BFF, 0xFFD21F] },
  { id: 'rg', name: '빨강초록', colors: [0xFF3B30, 0x34D36B] },
  { id: 'ice', name: '얼음', colors: [0x8FD3FF, 0xFFFFFF] },
];
export const BLINKS = [
  { id: 'on', name: '그대로' },
  { id: 'slow', name: '천천히' },
  { id: 'twinkle', name: '반짝반짝' },
];

export const WALLS = [
  { id: 'cream', name: '크림', wall: 0xF3E6D0, panel: 0xD8BE9A },
  { id: 'sage', name: '세이지', wall: 0xDCE6D2, panel: 0xA9BF9E },
  { id: 'sky', name: '하늘', wall: 0xDCE8F0, panel: 0xA9C0D4 },
  { id: 'rose', name: '분홍', wall: 0xF4DAD6, panel: 0xDDA9A2 },
  { id: 'pine', name: '짙은 초록', wall: 0x4F7A63, panel: 0xE9DCC3 },
];
export const FLOORS = [
  { id: 'oak', name: '밝은 나무', tones: ['#D9B285', '#D2A978', '#DDB98E', '#CDA472'] },
  { id: 'walnut', name: '짙은 나무', tones: ['#9C6B4A', '#8F6042', '#A67452', '#855838'] },
  { id: 'ash', name: '흰 나무', tones: ['#EADFCB', '#E3D6BF', '#EFE6D4', '#DDD0B8'] },
];

export const MAX_ITEMS = 100;  // 가구는 이만큼까지
export const MAX_ORNS = 150;   // 트리 장식은 이만큼까지
// 방명록: 글은 이만큼까지(넘치면 가장 오래된 것부터 빠진다), 이름·글의 글자 수, 한 사람이 다시 남기기까지 기다리는 시간
export const NOTE = { max: 60, name: 10, text: 80, gap: 5000 };
// 이 방 최고 기록을 남기는 놀이와 그 점수의 끝 (다트 = 화살 3개의 합, 마시멜로 = 구운 점수)
export const BEST = { dart: { name: '다트', top: 180 }, fire: { name: '마시멜로 굽기', top: 100 } };
