import * as THREE from 'three';

// EAGLE: not something you hold. At 2 catches you turn into an eagle!
//   - Your hands become talons. Squeeze the grip button over the turkey's back to grab it.
//   - Fly up with A, down with B (VR yard only; in AR you can't really fly, so just lift your arm).
//   - Let go of the grip up high and the turkey lands dizzy. Touch it to catch it.
//   - Let go too low and it lands on its feet and runs off.
// The grab/drop rules are in src/turkeyBrain.js (grabWithTalons, dropTurkey, EAGLE),
// flying is in src/flight.js, and main.js wires them to the buttons.
export const eagle = {
  id: 'eagle',
  name: 'Eagle',
  type: 'talons',
  blurb: 'You ARE the eagle! Grip to grab, A/B to fly up and down, drop it from high up.',
  create: null,
};

/** A cartoon eagle foot: a yellow foot with three front claws and one back claw. */
export function createTalons() {
  const foot = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 });
  const claw = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 });
  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), skin);
  pad.scale.set(1, 0.7, 1);
  foot.add(pad);
  // Three toes spread out forward and one back, each sloping down and ending in a black claw
  // that hooks downward. (Grip space: -Z is forward out of your fist, -Y is down.)
  for (const spread of [-0.55, 0, 0.55, Math.PI]) {
    const toe = new THREE.Group();
    toe.rotation.set(0, spread, 0);
    const slope = new THREE.Group();
    slope.rotation.x = -0.6; // tilt the toe down
    toe.add(slope);
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.07, 6), skin);
    bone.rotation.x = Math.PI / 2; // lie along -Z
    bone.position.z = -0.035;
    slope.add(bone);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.045, 6), claw);
    tip.rotation.x = Math.PI - 0.6; // hook down and a bit forward
    tip.position.set(0, -0.015, -0.072);
    slope.add(tip);
    foot.add(toe);
  }
  foot.position.y = -0.02;
  foot.scale.setScalar(1.4); // a bit bigger than a hand, so it reads as a big bird foot
  return foot;
}
