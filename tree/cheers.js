// 건배 "짠". 마실 것을 든 사람끼리 가까이 서면 할 일 단추가 "🥂 짠!" 으로 바뀌고, 누르면 서로 마주 보고 잔을 내밀어 부딪힌다.
// 방의 상태가 아니다(저장하지 않는다). 놀이 소식 하나로만 오간다:
//   { k: 'cheers', v: 'x,z' }   이 자리(모인 사람들의 한가운데)에서 짠! 을 한다
// 받은 쪽은 그 자리 가까이에서 마실 것을 든 사람(나도 포함)을 모두 같이 건배시킨다. 그래서 셋 이상이 모여 있으면 한 번에 다 같이 한다.
// 잔을 내미는 몸짓은 food.js 의 clink, 소리는 sfx.js 의 'cheers'.
// K (app.js 가 준다): food, me, others() → Map(id → 아바타), fx(소식), online(), toast, dirty
import { THREE } from './kit.js';
import { levelOf } from './path.js';
import { sfx } from './sfx.js';

const R = 1.5;       // 이만큼 가까이 있어야 잔이 닿는다
const COOL = 6;      // 한 번 한 뒤 이만큼은 "마시기"가 먼저다 (바로 또 눌리지 않게)
const MSG = /^-?\d{1,3}\.\d\d,-?\d{1,3}\.\d\d$/;

export function makeCheers(K) {
  let clock = 0, last = -99, hintT = 0, count = 0;
  const events = [], hinted = new Set(), heard = new Map(), v = new THREE.Vector3(), sum = new THREE.Vector3();
  const near = (a, x, z, r) => !a.rest && a.root.visible && Math.hypot(a.x - x, a.z - z) <= r;
  // 나와 건배할 수 있는 사람들: 같은 층에서 가까이 있고 마실 것을 들었다
  function partners() {
    const out = [];
    for (const [id, a] of K.others()) if (a.level === K.me.level && near(a, K.me.x, K.me.z, R) && K.food.drink(id)) out.push(id);
    return out;
  }
  // (x, z) 에 모인 사람들이 다 같이 잔을 부딪힌다. 둘이 안 되면 하지 않는다
  function start(x, z) {
    const lv = levelOf(x), who = [];
    const all = [['me', K.me], ...K.others()];
    for (const [id, a] of all) if (a.level === lv && near(a, x, z, R + 0.3) && K.food.drink(id)) who.push([id, a]);
    if (who.length < 2) return false;
    for (const [id, a] of who) {
      if (!a.moving) a.face = Math.atan2(x - a.x, z - a.z); // 한가운데를 바라본다
      K.food.clink(id);
    }
    const mine = who.some(([id]) => id === 'me');
    if (mine) last = clock;
    events.push({ t: 0, x, z, who: who.map(([id]) => id), mine, hit: false });
    count++;
    K.dirty();
    return true;
  }
  function run() {
    const ps = partners();
    if (!K.food.drink('me')) return false;
    if (!ps.length) { K.toast('🥂 마실 것을 든 친구가 가까이 있어야 짠 할 수 있어요'); return false; }
    let x = K.me.x, z = K.me.z;
    for (const id of ps) { const a = K.others().get(id); x += a.x; z += a.z; }
    x /= ps.length + 1; z /= ps.length + 1;
    if (!start(x, z)) return false;
    if (K.online()) K.fx({ k: 'cheers', v: `${x.toFixed(2)},${z.toFixed(2)}` });
    return true;
  }
  function peerFx(m, who) {
    const a = K.others().get(who);
    if (!a || typeof m.v !== 'string' || !MSG.test(m.v)) return false;
    const [x, z] = m.v.split(',').map(Number);
    if (!K.food.drink(who) || Math.hypot(a.x - x, a.z - z) > R + 0.6) return false; // 잔을 든 사람이, 자기가 선 곳 가까이에서만
    if (clock - (heard.get(who) || -9) < 1.5) return false; // 도배 막기
    heard.set(who, clock);
    start(x, z); // 내 화면에서 둘이 안 모였어도(자리가 조금 어긋났을 때) 소식은 그대로 전한다
    return true;
  }
  function tick(dt) {
    clock += dt;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      e.t += dt;
      if (!e.hit && e.t >= 0.45) { // 잔이 닿는 순간: 짠 소리와 반짝이
        e.hit = true;
        let n = 0; sum.set(0, 0, 0);
        for (const id of e.who) if (K.food.glassAt(id, v)) { sum.add(v); n++; }
        if (n) sum.multiplyScalar(1 / n); else sum.set(e.x, 1, e.z);
        sfx('cheers', e.mine ? null : { x: e.x, z: e.z });
        for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, s = 0.5 + Math.random() * 0.7; K.food.spark(sum.x, sum.y, sum.z, k % 2 ? 0xFFF3B0 : 0xFFFFFF, Math.cos(a) * s, 0.5 + Math.random() * 0.9, Math.sin(a) * s, 0.45 + Math.random() * 0.3, 2.6); }
        if (e.mine) K.toast(e.who.length > 2 ? `🥂 다 같이 짠! (${e.who.length}명)` : '🥂 짠!');
        K.dirty();
      }
      if (e.t > 1.35) events.splice(i, 1);
    }
    // 내가 잔을 들었는데 가까운 친구는 빈손일 때: 한 번만 알려 준다
    if ((hintT -= dt) > 0) return;
    hintT = 0.5;
    if (!K.food.drink('me')) { hinted.clear(); return; }
    for (const [id, a] of K.others()) {
      const close = a.level === K.me.level && near(a, K.me.x, K.me.z, R);
      if (!close) { hinted.delete(id); continue; }
      if (K.food.drink(id) || hinted.has(id)) continue;
      hinted.add(id);
      if (!partners().length) K.toast('🥂 친구도 마실 것을 들면 "짠" 할 수 있어요 (냉장고·와인 냉장고)');
    }
  }
  return {
    tick, peerFx,
    // 할 일 단추 (app.js 의 nearAction. 손에 든 것 마시기보다 먼저다)
    action() {
      if (clock - last < COOL || !K.food.drink('me')) return null;
      const n = partners().length;
      return n ? { label: n > 1 ? `🥂 다 같이 짠! (${n + 1}명)` : '🥂 짠!', run } : null;
    },
    test: {
      get partners() { return partners(); }, get events() { return events.map((e) => ({ who: e.who.slice(), hit: e.hit, mine: e.mine, x: e.x, z: e.z })); },
      get count() { return count; }, get cooling() { return clock - last < COOL; },
      rest() { last = -99; }, run, peerFx,
    },
  };
}
