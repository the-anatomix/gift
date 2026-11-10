// 계절 판 설정. 주방의 색과 계절 소품은 여기 한 곳에서 바꾼다.
// 새 판을 만들 때: THEMES 에 항목을 하나 더 넣고 colors / ui / props 만 채운다.
// 주소에 ?theme=이름 을 붙이면 그 판으로 열린다. 없으면 DEFAULT_THEME.

// 화면에 계정 이름을 표기할 자리. 확정되면 여기만 채운다(비워 두면 아무것도 나오지 않는다).
export const SITE = { account: '' };

const base = {
  name: '기본',
  // 3D 주방 색
  colors: {
    cream: 0xFBF3E4, wall: 0xF4E4CA, floor: 0xE6CDAA, slab: 0xD3B48C, top: 0x7A5137, wood: 0xC99A6B,
    choc: 0x5A3824, dark: 0x3B2619, accent: 0xD9483B, accentSoft: 0xE8776A, dough: 0xF1D9A8, biscuit: 0xDDAA66,
    metal: 0xD9D0C3, white: 0xFFFAF0, window: 0xFFF1CC, ovenGlow: 0xF7B25A,
  },
  // 화면(버튼·배경) 색. index.html 의 CSS 변수로 들어간다.
  ui: { '--bg': '#FFF8EC', '--choc': '#5A3824', '--accent': '#D9483B' },
  // 계절 소품. k = { THREE, scene, put, rbox, cyl, C, TOP_Y } 로 도형을 놓는다.
  props(k) {
    // 러그
    k.put(k.rbox(1.9, 0.025, 0.6, 0.012), k.C.accent, 0.1, 0.02, 1.9, k.scene, false);
    k.put(k.rbox(1.6, 0.027, 0.36, 0.012), k.C.accentSoft, 0.1, 0.021, 1.9, k.scene, false);
  },
};

export const THEMES = { base };
export const DEFAULT_THEME = 'base';

export function pickTheme() {
  const q = new URLSearchParams(location.search).get('theme');
  return (q && Object.prototype.hasOwnProperty.call(THEMES, q)) ? THEMES[q] : THEMES[DEFAULT_THEME];
}
