import * as THREE from 'three';
import { createNoodleSim } from './noodleSim.js';
import { swingHits, groundCrack } from '../combat.js';

// SWING item with a superpower: a long red whip.
//  - Swing it through the turkey to stun it (like the noodle).
//  - Crack it on the ground in front of you and it GRAPPLES: you get pulled along
//    the ground toward that spot (see startPull in src/locomotion.js).
export const whip = {
  id: 'whip',
  name: 'Red Whip',
  type: 'swing',
  blurb: 'Crack it on the ground to zoom over there. Swing it at the turkey to stun it.',
  color: 0xd01818, // red!
  length: 2.5, // metres of whip
  hitRadius: 0.3,
  minSwingSpeed: 2,
  effect: 'stun',
  stunSeconds: 2,
  knockback: 0.5,
  crackSpeed: 4, // m/s the tip must be going when it hits the ground to grapple
  crackCooldown: 0.8, // seconds between grapples
  create,
};

function create(scene) {
  const sim = createNoodleSim({ segments: 16, length: whip.length, stiffness: 0.05, gravity: 9.8 });
  const material = new THREE.MeshStandardMaterial({ color: whip.color, roughness: 0.5 });
  let mesh = null;
  let cooldown = 0;
  const curvePoints = sim.points.map(() => new THREE.Vector3());
  const curve = new THREE.CatmullRomCurve3(curvePoints);

  const anchor = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  function update(dt, grip) {
    cooldown = Math.max(0, cooldown - dt);
    grip.getWorldPosition(anchor);
    grip.getWorldQuaternion(quat);
    dir.set(0, 0, -1).applyQuaternion(quat); // out of the top of the fist
    sim.step(anchor, dir, dt);

    sim.points.forEach((p, i) => curvePoints[i].set(p.x, p.y, p.z));
    const geometry = new THREE.TubeGeometry(curve, 40, 0.014, 6, false);
    if (mesh) {
      mesh.geometry.dispose();
      mesh.geometry = geometry;
    } else {
      mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
  }

  function hits(target) {
    return swingHits(sim.points, sim.speeds, target, whip.hitRadius, whip.minSwingSpeed);
  }

  /** Returns the {x, z} spot if the whip just cracked the ground, else null. */
  function crack() {
    if (cooldown > 0) return null;
    const spot = groundCrack(sim.points, sim.speeds, whip.crackSpeed);
    if (spot) cooldown = whip.crackCooldown;
    return spot;
  }

  function dispose() {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
    }
    material.dispose();
  }

  return { update, hits, crack, dispose, sim };
}
