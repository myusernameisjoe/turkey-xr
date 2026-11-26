import * as THREE from 'three';
import { createNoodleSim } from './noodleSim.js';
import { swingHits } from '../combat.js';

// SWING item: a long red whip. Swing it like the noodle, but when it hits, it GRABS
// the turkey and yanks it right up to you (grabTurkey in src/turkeyBrain.js). Then tag it!
export const whip = {
  id: 'whip',
  name: 'Red Whip',
  type: 'swing',
  blurb: 'Long reach. Whip the turkey and it gets yanked right to you. Then tag it!',
  color: 0xd01818, // red!
  length: 2.5, // metres of whip
  hitRadius: 0.3,
  minSwingSpeed: 2,
  effect: 'grab', // 'stun' pushes the turkey away; 'grab' pulls it to you
  stunSeconds: 2.5,
  stopAt: 0.7, // the turkey lands this far in front of you (m)
  create,
};

function create(scene) {
  const sim = createNoodleSim({ segments: 16, length: whip.length, stiffness: 0.05, gravity: 9.8 });
  const material = new THREE.MeshStandardMaterial({ color: whip.color, roughness: 0.5 });
  let mesh = null;
  const curvePoints = sim.points.map(() => new THREE.Vector3());
  const curve = new THREE.CatmullRomCurve3(curvePoints);

  const anchor = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  function update(dt, grip) {
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

  function dispose() {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
    }
    material.dispose();
  }

  return { update, hits, dispose, sim };
}
