import * as THREE from 'three';
import { createPunch, firePunch, stepPunch, punchHits } from '../combat.js';

// LAUNCH item: stretchy rubber arms. Unlocks at 10 catches.
// Point at the turkey and pull the trigger: your fist shoots out on a rubbery arm,
// bonks the turkey dizzy, and snaps back. Then run over and tag it.
// You also get a straw hat (see createStrawHat; main.js puts it on your head).
export const rubberArms = {
  id: 'rubber-arms',
  name: 'Rubber Arms',
  type: 'launch',
  blurb: 'Point and pull the trigger: your fist stretches way out and bonks the turkey!',
  reach: 4, // metres the fist can fly
  outSpeed: 14, // m/s flying out (4 m in under a third of a second)
  backSpeed: 9, // m/s snapping back
  hitRadius: 0.35, // how close the fist must pass to the turkey's body (m)
  effect: 'stun',
  stunSeconds: 3,
  knockback: 1.5,
  create,
};

function create(scene) {
  const punch = createPunch();
  const skin = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.5 });
  // The fist: a big ball, a bit squashed, so it reads as a cartoon fist from far away.
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), skin);
  fist.scale.set(1, 0.85, 1.1);
  // The arm: a cylinder from your hand to the fist. It gets thinner the further it stretches.
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), skin);
  arm.frustumCulled = false;
  scene.add(fist, arm);

  const hand = new THREE.Vector3();
  const dir = new THREE.Vector3(0, 0, -1);
  const quat = new THREE.Quaternion();
  const mid = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let triggerWasDown = false;

  /** grip: the controller you hold it in. input: { trigger, aim } (aim = where the controller points). */
  function update(dt, grip, input = {}) {
    grip.getWorldPosition(hand);
    const trigger = !!input.trigger;
    if (trigger && !triggerWasDown && firePunch(punch)) {
      // Lock in the direction when you throw the punch.
      (input.aim || grip).getWorldQuaternion(quat);
      dir.set(0, 0, -1).applyQuaternion(quat).normalize();
    }
    triggerWasDown = trigger;
    if (punch.phase === 'ready') {
      // Fist in your hand points wherever the controller points.
      (input.aim || grip).getWorldQuaternion(quat);
      dir.set(0, 0, -1).applyQuaternion(quat).normalize();
    }
    stepPunch(punch, dt, rubberArms);

    fist.position.copy(hand).addScaledVector(dir, punch.dist);
    const len = punch.dist;
    arm.visible = len > 0.05;
    if (arm.visible) {
      mid.copy(hand).addScaledVector(dir, len / 2);
      arm.position.copy(mid);
      arm.quaternion.setFromUnitVectors(up, dir);
      const thick = 0.035 / Math.sqrt(1 + len); // stretchier = thinner
      arm.scale.set(thick, len, thick);
    }
  }

  /** target: {x,y,z} centre of the turkey's body. */
  function hits(target) {
    if (!punchHits(punch, hand, dir, target, rubberArms.hitRadius)) return false;
    punch.phase = 'back'; // BOING: the fist bounces off and snaps back
    return true;
  }

  function dispose() {
    scene.remove(fist, arm);
    fist.geometry.dispose();
    arm.geometry.dispose();
    skin.dispose();
  }

  return { update, hits, dispose, punch };
}

/** A straw hat: a wide flat brim, a round top, and a band. Sits on your head. */
export function createStrawHat() {
  const hat = new THREE.Group();
  const straw = new THREE.MeshStandardMaterial({ color: 0xe8c872, emissive: 0x4a3a14, roughness: 0.9, side: THREE.DoubleSide });
  const band = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.01, 32), straw);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), straw);
  top.scale.y = 0.9;
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.03, 32, 1, true), band);
  ribbon.position.y = 0.015;
  hat.add(brim, top, ribbon);
  return hat;
}
