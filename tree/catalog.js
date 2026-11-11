// 고를 수 있는 것들의 목록. 화면과 상관없는 자료만 둔다.
// 가구: w × d 는 차지하는 바닥 칸 수(돌리지 않았을 때). solid 가 false 면 밟고 지나갈 수 있다(러그).
export const FURNITURE = [
  { id: 'sofa', name: '소파', icon: '🛋️', w: 4, d: 2, solid: true },
  { id: 'chair', name: '안락의자', icon: '🪑', w: 2, d: 2, solid: true },
  { id: 'fire', name: '벽난로', icon: '🔥', w: 4, d: 2, solid: true },
  { id: 'table', name: '탁자', icon: '☕', w: 3, d: 2, solid: true },
  { id: 'shelf', name: '책장', icon: '📚', w: 3, d: 1, solid: true },
  { id: 'giftR', name: '빨간 선물', icon: '🎁', w: 1, d: 1, solid: true },
  { id: 'giftG', name: '초록 선물', icon: '🎁', w: 1, d: 1, solid: true },
  { id: 'plant', name: '포인세티아', icon: '🌺', w: 1, d: 1, solid: true },
  { id: 'lamp', name: '스탠드', icon: '💡', w: 1, d: 1, solid: true },
  { id: 'snowman', name: '눈사람', icon: '⛄', w: 1, d: 1, solid: true },
  { id: 'rug', name: '러그', icon: '🟦', w: 3, d: 2, solid: false },
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
