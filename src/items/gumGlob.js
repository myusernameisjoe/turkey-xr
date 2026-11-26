import * as THREE from 'three';
import { createLob, throwLob, stepLob, lobHits } from '../combat.js';

// LAUNCH item: a glob of chewed bubblegum. Unlocks at 8 catches.
// Point and pull the trigger: the gum flies in an arc. SPLAT on (or right next to) the turkey,
// and its feet are glued to the ground for 10 seconds. Run over and tag it before it breaks free.
export const gumGlob = {
  id: 'gum-glob',
  name: 'Gum Glob',
  type: 'launch',
  blurb: 'Point and pull the trigger to lob sticky gum. SPLAT: the turkey is stuck for 10 seconds!',
  throwSpeed: 8, // m/s. Aimed 45° up from chest height, it lands about 7 m away.
  gravity: 9.8,
  reloadSeconds: 1, // a new gum ball appears in your hand this long after it lands
  hitRadius: 0.3, // flying through the turkey's body counts (m)
  splatRadius: 0.5, // landing this close to the turkey's feet counts too (m)
  effect: 'stick',
  stuckSeconds: 10,
  create,
};

const PINK = 0xff6fb5;

function create(scene) {
  const lob = createLob();
  const gum = new THREE.MeshStandardMaterial({ color: PINK, roughness: 0.35, emissive: 0x401028 });

  // The gum ball: a lumpy pink sphere (squashed a bit, so it looks chewed).
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), gum);
  ball.scale.set(1.15, 0.85, 1);
  // A flat pink splat left on the ground where it lands.
  const splat = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), gum);
  splat.rotation.x = -Math.PI / 2;
  splat.visible = false;
  // The puddle the turkey is stuck in, with stretchy strings up to its legs.
  const puddle = new THREE.Group();
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), gum);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.005;
  puddle.add(pool);
  const strings = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.025, 1, 6), gum);
    const a = (i / 6) * Math.PI * 2;
    s.position.set(Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12);
    s.userData.phase = i * 1.7;
    puddle.add(s);
    strings.push(s);
  }
  puddle.visible = false;
  scene.add(ball, splat, puddle);

  const hand = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  let triggerWasDown = false;
  let time = 0;

  /** grip: the controller you hold it in. input: { trigger, aim, turkey } (turkey = the turkey's state). */
  function update(dt, grip, input = {}) {
    time += dt;
    grip.getWorldPosition(hand);
    const trigger = !!input.trigger;
    if (trigger && !triggerWasDown && lob.phase === 'ready') {
      (input.aim || grip).getWorldQuaternion(quat);
      dir.set(0, 0, -1).applyQuaternion(quat).normalize();
      throwLob(lob, hand, dir, gumGlob.throwSpeed);
    }
    triggerWasDown = trigger;
    stepLob(lob, dt, gumGlob);

    // Ball: in your hand, flying, or gone (splatted).
    ball.visible = lob.phase !== 'landed';
    if (lob.phase === 'ready') ball.position.copy(hand);
    else ball.position.set(lob.pos.x, lob.pos.y, lob.pos.z);
    ball.rotation.x += dt * (lob.phase === 'flying' ? 12 : 0);
    splat.visible = lob.phase === 'landed';
    if (splat.visible) splat.position.set(lob.pos.x, 0.004, lob.pos.z);

    // Gum puddle under a stuck turkey. The strings stretch up and down as it tries to pull free.
    const t = input.turkey;
    puddle.visible = !!t && t.mode === 'stunned' && !!t.stuck;
    if (puddle.visible) {
      puddle.position.set(t.x, 0, t.z);
      for (const s of strings) {
        const h = 0.12 + 0.08 * (0.5 + 0.5 * Math.sin(time * 9 + s.userData.phase));
        s.scale.y = h;
        s.position.y = h / 2;
      }
    }
  }

  /** target: {x,y,z} centre of the turkey's body. */
  function hits(target) {
    return lobHits(lob, target, gumGlob.hitRadius, gumGlob.splatRadius);
  }

  function dispose() {
    scene.remove(ball, splat, puddle);
    ball.geometry.dispose();
    splat.geometry.dispose();
    pool.geometry.dispose();
    for (const s of strings) s.geometry.dispose();
    gum.dispose();
  }

  return { update, hits, dispose, lob, puddle };
}
