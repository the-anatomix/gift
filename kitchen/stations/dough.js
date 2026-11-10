// 반죽 자리. app.js 가 kit(도구 모음)를 넘겨 부른다. 규칙은 stations/README.md 참고.
export default function (kit) {
  const { THREE, scene, put, rbox, cyl, C, TOP_Y } = kit;

  const g = new THREE.Group(); g.position.set(1.2, TOP_Y, -1.72); scene.add(g);
  const bowl = new THREE.MeshLambertMaterial({ color: C.white, side: THREE.DoubleSide });
  put(new THREE.CylinderGeometry(0.33, 0.2, 0.24, 22, 1, true), bowl, -0.1, 0.12, 0, g);
  put(cyl(0.2, 0.2, 0.02, 22), C.white, -0.1, 0.01, 0, g, false);
  const d = put(new THREE.SphereGeometry(0.2, 16, 12), C.dough, -0.1, 0.17, 0, g);
  d.scale.set(1.15, 0.7, 1.1);
  // 밀가루 봉지
  put(rbox(0.26, 0.36, 0.18, 0.04), C.cream, 0.42, 0.18, -0.12, g);
  put(new THREE.BoxGeometry(0.2, 0.12, 0.01), C.top, 0.42, 0.18, -0.027, g, false);
  // 밀대
  const pin = new THREE.Group(); pin.position.set(0.3, 0.05, 0.26); pin.rotation.set(0, 0.25, Math.PI / 2); g.add(pin);
  put(cyl(0.045, 0.045, 0.42, 14), C.wood, 0, 0, 0, pin);
  put(cyl(0.02, 0.02, 0.62, 10), C.top, 0, 0, 0, pin);

  return {
    // panel(p, ui) {}, enter() {}, leave() {}, down(i) {}, move(i) {}, up(i) {}, apply(d) {}, get() {}, set(v) {},
  };
}
