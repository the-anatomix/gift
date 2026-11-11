// 도형 도우미. 방·아바타·가구가 같이 쓴다.
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

export { THREE };

const mats = new Map();
// 같은 색은 재질 하나를 나눠 쓴다. flat = true 면 면이 각져 보인다(로우폴리).
export function M(hex, flat = false) {
  const key = hex + (flat ? 'f' : '');
  let m = mats.get(key);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: hex, flatShading: flat }); mats.set(key, m); }
  return m;
}
export function put(geo, mat, x, y, z, parent, cast = true) {
  const m = new THREE.Mesh(geo, typeof mat === 'number' ? M(mat) : mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function rbox(w, h, d, r = 0.03) {
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
}
export const cyl = (rt, rb, h, seg = 18) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const ball = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
export const cap = (r, len, seg = 10) => new THREE.CapsuleGeometry(r, len, 4, seg);
