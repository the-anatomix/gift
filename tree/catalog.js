// 고를 수 있는 것들의 목록. 화면과 상관없는 자료만 둔다.
// 가구: w × d 는 차지하는 바닥 칸 수(돌리지 않았을 때). solid 가 false 면 밟고 지나갈 수 있다(러그).
// play 가 있으면 눌러서 놀 수 있는 가구다(놀이는 play.js). lie = 누울 수 있다(침대), snack = 간식을 꺼내 먹는다(냉장고), dress = 옷을 갈아입는다(옷장).
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
  { id: 'wine', name: '와인 냉장고', icon: '🍷', w: 1, d: 1, solid: true, snack: true }, // 유리문 와인 셀러. 모양과 꺼내 마시기는 food.js
  { id: 'pizza', name: '피자 화덕', icon: '🍕', w: 2, d: 1, solid: true, play: 'pizza' }, // 도마에서 피자를 만들고 화덕에 굽는다. 모양과 놀이는 pizza.js
  // 방
  { id: 'bed', name: '침대', icon: '🛏️', w: 3, d: 4, solid: true, lie: true },
  { id: 'closet', name: '옷장', icon: '🚪', w: 3, d: 1, solid: true, dress: true }, // 열면 옷을 갈아입는다
  { id: 'stand', name: '협탁', icon: '🕯️', w: 1, d: 1, solid: true },
  // 현관
  { id: 'guest', name: '방명록', icon: '📖', w: 1, d: 1, solid: true, play: 'guest' }, // 놀러 온 사람이 한마디 남긴다 (book.js)
  { id: 'advent', name: '어드벤트 달력', icon: '🗓️', w: 2, d: 1, solid: true, play: 'advent' }, // 벽에 붙여 두는 달력. 12월 하루에 한 칸씩 연다 (advent.js)
  // 어드벤트 달력의 칸을 열어야 놓을 수 있는 특별 가구 (day = 12월 며칠 칸. 모양은 advent.js)
  { id: 'deer', name: '루돌프 인형', icon: '🦌', w: 1, d: 1, solid: true, day: 3 },
  { id: 'bigcane', name: '큰 사탕 지팡이', icon: '🍭', w: 1, d: 1, solid: true, day: 7 },
  { id: 'pile', name: '선물 더미', icon: '🎁', w: 2, d: 2, solid: true, day: 11 },
  { id: 'train', name: '장난감 기차', icon: '🚂', w: 3, d: 1, solid: true, day: 15 },
  { id: 'snowlamp', name: '눈 결정 조명', icon: '✨', w: 1, d: 1, solid: true, day: 18 },
  { id: 'ginger', name: '진저브레드 집', icon: '🏠', w: 2, d: 2, solid: true, day: 22 },
  { id: 'sled', name: '산타 썰매', icon: '🛷', w: 3, d: 2, solid: true, day: 24 },
];

// 큰 가구: 방에 다른 사람이 있으면 놓인 것을 옮길 때 둘이 든다 (coop.js). 혼자 있으면 그대로 혼자 옮긴다
for (const f of FURNITURE) if (f.id === 'sofa' || f.id === 'bed') f.heavy = true;

// 3층 영화관 (cinema.js 가 모양을 만든다). 스크린은 TV 와 같은 화면을 크게 비춘다(play: 'tv').
// sit = 앉을 수 있다(두 자리), rise = 계단식 좌석의 단 높이, munch = 팝콘을 꺼내 먹는다. 그림은 벽에 붙여 두고 밟고 지나갈 수 있다.
// set = 영화관 묶음: 가구 탭의 목록에는 나오지 않고(폰에서 목록이 넘치지 않게) 영화관을 차릴 때만 놓인다. 놓인 뒤에는 보통 가구처럼 옮기고 치운다
FURNITURE.push(
  { id: 'screen', name: '영화관 스크린', icon: '🎬', w: 8, d: 1, set: 'cinema', solid: true, play: 'tv' },
  { id: 'seat', name: '영화관 좌석', icon: '💺', w: 4, d: 2, set: 'cinema', solid: true, sit: true, rise: 0 },
  { id: 'seat2', name: '영화관 좌석 2단', icon: '💺', w: 4, d: 2, set: 'cinema', solid: true, sit: true, rise: 0.2 },
  { id: 'seat3', name: '영화관 좌석 3단', icon: '💺', w: 4, d: 2, set: 'cinema', solid: true, sit: true, rise: 0.4 },
  { id: 'guide', name: '바닥 유도등', icon: '🔆', w: 6, d: 2, set: 'cinema', solid: false },
  { id: 'popcorn', name: '팝콘 기계', icon: '🍿', w: 2, d: 1, set: 'cinema', solid: true, munch: true },
  { id: 'art1', name: '그림: 겨울 언덕', icon: '🖼️', w: 2, d: 1, set: 'cinema', solid: false },
  { id: 'art2', name: '그림: 트리', icon: '🖼️', w: 2, d: 1, set: 'cinema', solid: false },
  { id: 'art3', name: '그림: 추상화', icon: '🖼️', w: 2, d: 1, set: 'cinema', solid: false },
  { id: 'art4', name: '그림: 눈사람', icon: '🖼️', w: 2, d: 1, set: 'cinema', solid: false },
  { id: 'art5', name: '그림: 오로라', icon: '🖼️', w: 2, d: 1, set: 'cinema', solid: false },
);
// 3층 영화관의 배치 [종류, 집 기준 칸 a, j, 돌린 횟수]. 서쪽 벽의 스크린, 계단식 좌석 세 줄(가운데 통로), 통로 유도등, 동쪽 벽의 팝콘 기계, 북·남쪽 벽의 그림
export const CINEMA = [
  ['screen', 0, 5, 1],
  ['seat', 7, 4, 3], ['seat', 7, 10, 3], ['seat2', 11, 4, 3], ['seat2', 11, 10, 3], ['seat3', 15, 4, 3], ['seat3', 15, 10, 3],
  ['guide', 5, 8, 0], ['guide', 11, 8, 0], ['guide', 17, 8, 0],
  ['popcorn', 29, 6, 3],
  ['art1', 0, 0, 0], ['art2', 7, 0, 0], ['art3', 11, 0, 0], ['art4', 17, 0, 0], ['art5', 21, 0, 0], ['art5', 8, 17, 2], ['art1', 15, 17, 2],
];
export const ADMINS = 8; // 공동 관리자 수 (admin.js)

// 새로 시작하는 방에 처음부터 놓여 있는 가구 [종류, i, j, 돌린 횟수]. 놀 수 있는 가구들이고, 다른 가구처럼 옮기거나 치울 수 있다.
export const STARTER = [['fire', 6, 0, 0], ['tv', 0, 6, 1], ['dart', 11, 0, 0], ['music', 15, 12, 3]];
// 주방과 방에 처음부터 놓여 있는 가구. 거실만 있던 때(저장 형식 v 1)에 꾸민 방을 열 때도 이것만 더해 준다.
export const STARTER_EAST = [
  ['counter', 21, 0, 0], ['stove', 23, 0, 0], ['counter', 25, 0, 0], ['fridge', 28, 0, 0], ['cake', 24, 4, 0],
  ['bed', 26, 12, 3], ['stand', 29, 11, 3], ['closet', 22, 17, 2],
  ['wine', 27, 0, 0], // 조리대와 냉장고 사이. 맨 끝에 더해서 앞의 것들의 이름(east0…)이 바뀌지 않게
];

// 마당과 위층에 처음부터 놓여 있는 가구. 마당·위층이 없던 때에 꾸민 방을 열 때도 이것만 더해 준다.
// 칸 번호: 마당은 j 19~26, 2층은 i 에 32 를, 3층은 64 를 더한 칸(path.js 의 YARD, FLOOR_DI).
export const STARTER_UP = [
  ['snowman', 14, 21, 0], ['giftR', 12, 20, 0], ['giftG', 13, 21, 0],                                   // 마당
  ['rug', 32 + 8, 7, 0], ['sofa', 32 + 8, 4, 0], ['table', 32 + 8, 10, 0], ['shelf', 32 + 3, 0, 0], ['lamp', 32 + 13, 4, 0], // 2층: 쉬는 방
  ...CINEMA.map(([k, a, j, r]) => [k, 64 + a, j, r]),                                                   // 3층: 영화관 (예전에는 다락방)
  ['guest', 6, 16, 2],                                                                                  // 현관 안쪽 옆의 방명록 (북쪽을 본다)
  ['advent', 14, 0, 0],                                                                                 // 거실 북쪽 벽, 리스와 액자 사이의 어드벤트 달력
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
  // 어드벤트 달력의 칸을 열어야 달 수 있는 특별 장식 (day = 12월 며칠 칸. 모양은 advent.js)
  { id: 'flake', name: '눈 결정', icon: '❄️', day: 1 },
  { id: 'cookie', name: '진저쿠키', icon: '🍪', day: 2 },
  { id: 'sock', name: '양말', icon: '🧦', day: 4 },
  { id: 'cone', name: '솔방울', icon: '🌰', day: 6 },
  { id: 'hat', name: '산타 모자', icon: '🎅', day: 8 },
  { id: 'gem', name: '보석', icon: '💎', day: 10 },
  { id: 'icicle', name: '고드름', icon: '🧊', day: 12 },
  { id: 'kid', name: '꼬마 눈사람', icon: '⛄', day: 13 },
  { id: 'heart', name: '하트', icon: '💗', day: 16 },
  { id: 'apple', name: '사과', icon: '🍎', day: 17 },
  { id: 'angel', name: '천사', icon: '👼', day: 19 },
  { id: 'penguin', name: '펭귄', icon: '🐧', day: 21 },
  { id: 'moon', name: '달', icon: '🌙', day: 23 },
  { id: 'king', name: '황금 왕별', icon: '🌟', day: 25 }, // 25일: 스스로 빛나는 큰 별
];

// 전구 색 묶음과 깜빡임
export const LIGHT_SETS = [
  { id: 'off', name: '끄기', colors: [] },
  { id: 'warm', name: '따뜻한', colors: [0xFFE9A8, 0xFFD37A] },
  { id: 'multi', name: '알록달록', colors: [0xFF3B30, 0x34D36B, 0x3D8BFF, 0xFFD21F] },
  { id: 'rg', name: '빨강초록', colors: [0xFF3B30, 0x34D36B] },
  { id: 'ice', name: '얼음', colors: [0x8FD3FF, 0xFFFFFF] },
  { id: 'pink', name: '분홍', colors: [0xFF8FB8, 0xFFFFFF, 0xFFC2D6], day: 5, mark: '🌸' },      // 어드벤트 달력 5일 칸
  { id: 'aurora', name: '오로라', colors: [0x5CF2C8, 0x9B7BFF, 0x4FC3FF, 0xB8FF8A], day: 20, mark: '🌌' }, // 어드벤트 달력 20일 칸
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
  { id: 'night', name: '눈 오는 밤', wall: 0x2F3D6B, panel: 0xE9DCC3, day: 9, mark: '🌃' }, // 어드벤트 달력 9일 칸
];
export const FLOORS = [
  { id: 'oak', name: '밝은 나무', tones: ['#D9B285', '#D2A978', '#DDB98E', '#CDA472'] },
  { id: 'walnut', name: '짙은 나무', tones: ['#9C6B4A', '#8F6042', '#A67452', '#855838'] },
  { id: 'ash', name: '흰 나무', tones: ['#EADFCB', '#E3D6BF', '#EFE6D4', '#DDD0B8'] },
  { id: 'candy', name: '사탕 마루', tones: ['#F4C6CF', '#FBEDEA', '#EFB3BF', '#FFF6F2'], day: 14, mark: '🍬' }, // 어드벤트 달력 14일 칸
];

export const MAX_ITEMS = 100;  // 가구는 이만큼까지
export const MAX_ORNS = 150;   // 트리 장식은 이만큼까지
export const SNOWMEN = 8;      // 마당에서 같이 만들어 놓는 눈사람('snowman' 변화)은 방에 눈사람이 이만큼 있을 때까지
// 방명록: 글은 이만큼까지(넘치면 가장 오래된 것부터 빠진다), 이름·글의 글자 수, 한 사람이 다시 남기기까지 기다리는 시간
export const NOTE = { max: 60, name: 10, text: 80, gap: 5000 };
// 이 방 최고 기록을 남기는 놀이와 그 점수의 끝 (다트 = 화살 3개의 합, 마시멜로 = 구운 점수)
export const BEST = { dart: { name: '다트', top: 180 }, fire: { name: '마시멜로 굽기', top: 100 } };
// 이름별 순위(rank.js): 놀이마다 방에 남기는 사람 수, 순위 판에 보이는 등수
export const RANK = { keep: 20, show: 10 };

// 어드벤트 달력 (advent.js): 12월 d 일이 되면 d 번 칸을 열 수 있고, 열면 그 방에 그날의 것이 풀린다.
// 위 목록들에서 day 가 붙은 것이 그 칸의 선물이다. 하루에 하나씩, 25 칸 모두 다르다.
// kind = 'furn'(가구) | 'orn'(트리 장식) | 'light'(전구) | 'wall'(벽지) | 'floor'(바닥)
export const ADVENT_LISTS = { furn: FURNITURE, orn: ORNAMENTS, light: LIGHT_SETS, wall: WALLS, floor: FLOORS };
export const ADVENT = Array.from({ length: 25 }, (_, k) => {
  for (const [kind, list] of Object.entries(ADVENT_LISTS)) {
    const x = list.find((o) => o.day === k + 1);
    if (x) return { d: k + 1, kind, id: x.id, name: x.name, icon: x.icon || x.mark };
  }
  return null;
});
// 트리 밑 선물 (gift.js): 방 하나에 max 개까지, 이름·편지 글자 수, 한 사람이 다시 두기까지 기다리는 시간
export const GIFT = { max: 24, name: 10, text: 80, gap: 5000 };
// 포장지: box = 상자 색, band = 리본 색
export const WRAPS = [
  { id: 'red', name: '빨강', box: 0xD23A30, band: 0xE9B93A },
  { id: 'green', name: '초록', box: 0x2F8F5F, band: 0xFFF4E0 },
  { id: 'blue', name: '파랑', box: 0x3E6FC4, band: 0xDDE8FF },
  { id: 'gold', name: '금빛', box: 0xE0AE3A, band: 0xC8332B },
  { id: 'pink', name: '분홍', box: 0xF19BB6, band: 0xFFFFFF },
  { id: 'white', name: '눈빛', box: 0xF6F2EA, band: 0x3E9A7E },
];

// 피자 (pizza.js). r = 토핑을 올릴 수 있는 반지름, slices = 구운 피자의 조각 수, max = 토핑 수 제한
export const PIZZA = { r: 0.15, slices: 8, max: 24 };
export const PIZZA_TOPS = [
  { id: 'pep', name: '페퍼로니', icon: '🔴' }, { id: 'mush', name: '버섯', icon: '🍄' }, { id: 'bell', name: '피망', icon: '🫑' }, { id: 'olive', name: '올리브', icon: '🫒' },
  { id: 'pine', name: '파인애플', icon: '🍍' }, { id: 'shrimp', name: '새우', icon: '🍤' }, { id: 'bacon', name: '베이컨', icon: '🥓' }, { id: 'corn', name: '옥수수', icon: '🌽' },
];
