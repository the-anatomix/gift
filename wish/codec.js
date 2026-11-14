// 쪽지 ↔ 링크. 쪽지 내용은 링크의 # 뒤(#w=…)에만 담긴다. 서버로 가지 않는다.
// 주소창을 흘끗 봐서는 읽히지 않게 가볍게 섞어 둘 뿐이다. 암호가 아니다(마음먹으면 풀 수 있다).
import { fromStamp } from './dates.js';

export const LIM = { name: 12, wish: 60, wishes: 5, msg: 120 };
export const PAPERS = 6;
export const HASH_RE = /^#w=([A-Za-z0-9_-]{12,4000})$/;

export const clip = (v, n) => Array.from(typeof v === 'string' ? v : '').slice(0, n).join('');
const clean = (v, n) => clip(typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B-\u001F\u007F\u2028\u2029]/g, '') : '', n).trim();
export const newId = () => { let s = ''; while (s.length < 8) s += Math.random().toString(36).slice(2); return s.slice(0, 8); };

// 어디서 온 것이든(링크, 저장소, 입력칸) 같은 규칙으로 다듬는다. 쪽지가 못 되면 null
export function tidy(o) {
  if (!o || typeof o !== 'object') return null;
  const w = (Array.isArray(o.w) ? o.w : []).slice(0, LIM.wishes * 2).map((x) => clean(x, LIM.wish).replace(/\s+/g, ' ')).filter(Boolean).slice(0, LIM.wishes);
  if (!w.length || !fromStamp(o.t)) return null;
  const p = Number.isInteger(o.p) && o.p >= 0 && o.p < PAPERS ? o.p : 0;
  const id = typeof o.id === 'string' && /^[a-z0-9]{6,12}$/.test(o.id) ? o.id : null;
  if (!id) return null;
  const name = (v) => clean(typeof v === 'string' ? v.replace(/\s+/g, ' ') : '', LIM.name);
  return { id, to: name(o.to), fr: name(o.fr), w, m: clean(o.m, LIM.msg), p, t: o.t };
}

// 섞기: 첫 바이트(무작위)로 씨앗을 정해 나머지를 XOR 한다. 끝 두 바이트는 내용이 바뀌었는지 보는 합계.
function stream(seed) { let x = (seed * 2654435761 + 97) >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x & 255; }; }
function sum16(bytes) { let h = 0x811c9dc5; for (const b of bytes) { h ^= b; h = Math.imul(h, 16777619) >>> 0; } return (h ^ (h >>> 16)) & 0xffff; }
const toB64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64 = (txt) => Uint8Array.from(atob(txt.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const VER = 1;
export function encode(note) {
  const n = tidy(note); if (!n) throw new Error('note');
  const body = new TextEncoder().encode(JSON.stringify([n.id, n.t, n.p, n.to, n.fr, n.m, n.w]));
  const seed = 1 + Math.floor(Math.random() * 255), next = stream(seed), c = sum16(body);
  const out = new Uint8Array(body.length + 4);
  out[0] = VER; out[1] = seed;
  body.forEach((b, i) => { out[i + 2] = b ^ next(); });
  out[body.length + 2] = (c >> 8) ^ next(); out[body.length + 3] = (c & 255) ^ next();
  return toB64(out);
}
// 읽을 수 없으면(잘림, 바뀜, 너무 김, 엉뚱한 글자) null
export function decode(txt) {
  try {
    if (typeof txt !== 'string' || !/^[A-Za-z0-9_-]{12,4000}$/.test(txt)) return null;
    const raw = fromB64(txt);
    if (raw.length < 8 || raw[0] !== VER) return null;
    const next = stream(raw[1]), plain = raw.slice(2).map((b) => b ^ next());
    const body = plain.slice(0, -2), c = (plain[plain.length - 2] << 8) | plain[plain.length - 1];
    if (sum16(body) !== c) return null;
    const a = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
    if (!Array.isArray(a) || a.length !== 7) return null;
    return tidy({ id: a[0], t: a[1], p: a[2], to: a[3], fr: a[4], m: a[5], w: a[6] });
  } catch (_) { return null; }
}
export const linkOf = (note) => location.origin + location.pathname + '#w=' + encode(note);
// 주소의 # 뒤에서 쪽지를 꺼낸다. 쪽지 링크가 아니면 undefined, 쪽지 링크인데 못 읽으면 null
export function fromHash(hash) {
  if (!/^#w=/.test(hash || '')) return undefined;
  const m = HASH_RE.exec(hash);
  return m ? decode(m[1]) : null;
}
