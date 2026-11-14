// 열리는 날 계산. 화면도 저장소도 건드리지 않는 작은 함수들이라 따로 검사할 수 있다.
// 시간은 모두 이 기기의 현지 시각이다. "지금"은 늘 밖에서 넣어 준다.

// 열리는 순간은 숫자 하나(YYYYMMDDHHmm)로 적는다. 시간대가 다른 사람이 받아도 그 사람의 그 날 그 시각에 열린다.
export function toStamp(d) {
  return ((((d.getFullYear() * 100 + d.getMonth() + 1) * 100 + d.getDate()) * 100 + d.getHours()) * 100) + d.getMinutes();
}
export function fromStamp(n) {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 202001010000 || n > 210012312359) return null;
  const mi = n % 100, h = Math.floor(n / 1e2) % 100, day = Math.floor(n / 1e4) % 100, mo = Math.floor(n / 1e6) % 100, y = Math.floor(n / 1e8);
  const d = new Date(y, mo - 1, day, h, mi, 0, 0);
  // 2월 30일 같은 없는 날은 받지 않는다
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day || d.getHours() !== h || d.getMinutes() !== mi) return null;
  return d;
}

// 설날(음력 1월 1일, 한국 기준). 표에 없는 해가 되면 설날 고르기는 숨긴다.
export const SEOLLAL = { 2027: [2, 7], 2028: [1, 27], 2029: [2, 13], 2030: [2, 3], 2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19] };

const day0 = (y, m, d) => new Date(y, m, d, 0, 0, 0, 0);

// 다가오는 1월 1일 0시
export const nextNewYear = (now) => day0(new Date(now).getFullYear() + 1, 0, 1);
// 다가오는 설날 0시 (오늘이 설날이면 다음 해 설날)
export function nextSeollal(now) {
  const t = +new Date(now), y = new Date(now).getFullYear();
  for (const yy of [y, y + 1]) {
    const s = SEOLLAL[yy]; if (!s) continue;
    const d = day0(yy, s[0] - 1, s[1]);
    if (+d > t) return d;
  }
  return null;
}
// 오늘부터 n일 뒤의 0시
export function plusDays(now, n) { const d = new Date(now); return day0(d.getFullYear(), d.getMonth(), d.getDate() + n); }
// 1년 뒤 같은 날 0시 (2월 29일은 2월 28일로)
export function plusYear(now) {
  const d = new Date(now), r = day0(d.getFullYear() + 1, d.getMonth(), d.getDate());
  return r.getMonth() === d.getMonth() ? r : day0(d.getFullYear() + 1, d.getMonth() + 1, 0);
}
// 직접 고른 날짜('2027-03-14')와 시각('09:30'). 읽을 수 없으면 null
export function customDate(dateStr, timeStr) {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || ''), b = /^(\d{2}):(\d{2})$/.exec(timeStr || '00:00');
  if (!a || !b) return null;
  return fromStamp(((((+a[1] * 100 + +a[2]) * 100 + +a[3]) * 100 + +b[1]) * 100) + +b[2]);
}
// 고를 수 있는 날인지: 지금보다 뒤이고 10년 안쪽
export function pickable(target, now) {
  if (!target) return false;
  const t = +target, n = +new Date(now);
  return t > n && t <= +day0(new Date(now).getFullYear() + 10, 11, 31);
}

export const isUnlocked = (target, now) => +new Date(now) >= +target;

// 남은 시간. days 는 달력으로 센 날 수(D-days), 마지막 24시간은 lastDay 로 알린다.
export function remain(target, now) {
  const t = new Date(target), n = new Date(now), ms = Math.max(0, +t - +n);
  const sec = Math.ceil(ms / 1000); // 1초가 채 안 남아도 00:00:01 로 보여 준다
  const days = Math.round((+day0(t.getFullYear(), t.getMonth(), t.getDate()) - +day0(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
  return {
    ms, locked: ms > 0, days: Math.max(0, days), lastDay: ms > 0 && ms <= 864e5,
    h: Math.floor(sec / 3600), m: Math.floor(sec / 60) % 60, s: sec % 60,
    fullDays: Math.floor(ms / 864e5), restHours: Math.floor(ms / 36e5) % 24,
  };
}
const two = (v) => String(v).padStart(2, '0');
// 화면에 크게 보여 줄 글자: D-48 → (마지막 날) 13:05:09 → 열림
export function countdownText(target, now) {
  const r = remain(target, now);
  if (!r.locked) return { big: 'D-DAY', small: '이제 펼칠 수 있어요' };
  if (r.lastDay) return { big: `${two(r.h)}:${two(r.m)}:${two(r.s)}`, small: '조금만 더 기다리면 열려요' };
  return { big: 'D-' + r.days, small: r.restHours ? `${r.fullDays}일 ${r.restHours}시간 남았어요` : `${r.fullDays}일 남았어요` };
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
// 예: 2027년 1월 1일 (금) 0시
export function fmtWhen(d) {
  const mi = d.getMinutes();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]}) ${d.getHours()}시${mi ? ' ' + mi + '분' : ''}`;
}
export const fmtDay = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
export const isNewYearsDay = (d) => d.getMonth() === 0 && d.getDate() === 1;
// <input type="date"> 에 넣을 글자
export const inputDate = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
