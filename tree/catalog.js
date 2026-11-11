// 고를 수 있는 것들의 목록. 화면과 상관없는 자료만 둔다.
// 가구: w × d 는 차지하는 바닥 칸 수(돌리지 않았을 때). solid 가 false 면 밟고 지나갈 수 있다(러그).
// play 가 있으면 눌러서 놀 수 있는 가구다(놀이는 play.js).
export const FURNITURE = [
  { id: 'sofa', name: '소파', icon: '🛋️', w: 4, d: 2, solid: true },
  { id: 'chair', name: '안락의자', icon: '🪑', w: 2, d: 2, solid: true },
  { id: 'fire', name: '벽난로', icon: '🔥', w: 4, d: 2, solid: true, play: 'fire' },
  { id: 'table', name: '탁자', icon: '☕', w: 3, d: 2, solid: true },
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
];

// 새로 시작하는 방에 처음부터 놓여 있는 가구 [종류, i, j, 돌린 횟수]. 놀 수 있는 가구들이고, 다른 가구처럼 옮기거나 치울 수 있다.
export const STARTER = [['fire', 6, 0, 0], ['tv', 0, 6, 1], ['dart', 11, 0, 0], ['music', 15, 12, 3]];

// 다트판: 가운데 높이 y, 판 겉면 z(가구 기준), 고리마다 [반지름, 점수] (안쪽부터)
export const DART = { y: 1.3, z: 0.036, rings: [[0.045, 50], [0.11, 30], [0.19, 20], [0.28, 10]] };
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

export const MAX_ITEMS = 60;   // 가구는 이만큼까지
export const MAX_ORNS = 150;   // 트리 장식은 이만큼까지
