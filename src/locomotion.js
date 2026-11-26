// Joystick movement for the fake yard (VR mode). No three.js here, so it's easy to test.
//
// The "rig" is the player's spot in the yard: where they stand (x, z) and which
// way the whole world is turned (yaw). Walking in real life still works too; the
// sticks just move the rig on top of that.
//
//   Left stick:  glide in the direction you push (forward = where you're looking).
//   Right stick: push left/right to turn smoothly (push further = turn faster).
//                With ?snap in the URL it turns in 30-degree steps instead, which
//                some people find more comfortable if smooth turning makes them queasy.
//   ?invert:     flips forward/back on the left stick (a test switch, in case the
//                headset reports the stick upside down).

export const LOCO = {
  speed: 2.5, // meters per second at full stick (a brisk walk)
  deadzone: 0.2, // ignore tiny stick wobble
  turnMode: 'smooth', // 'smooth' or 'snap'
  turnSpeed: (90 * Math.PI) / 180, // smooth: 90 degrees per second at full stick
  snapAngle: Math.PI / 6, // snap: 30 degrees per flick
  turnPush: 0.6, // how far to push the right stick before it turns
  turnRelease: 0.3, // let go past this before the next turn
  invertY: false, // true = pulling the left stick back moves you forward (flips forward/back)
};

export function createRig() {
  return { x: 0, z: 0, yaw: 0, turnArmed: true, pull: null };
}

// input: { moveX, moveY, turnX } stick values from -1 to 1 (pushing forward makes moveY negative).
// head:  { x, z, yaw } where the player's head is in the world and which way it faces.
export function stepRig(rig, input, head, dt, opts = LOCO) {
  // Glide.
  let sx = input.moveX || 0;
  let sy = (input.moveY || 0) * (opts.invertY ? -1 : 1);
  const len = Math.hypot(sx, sy);
  if (len > opts.deadzone) {
    if (len > 1) {
      sx /= len;
      sy /= len;
    }
    const fx = -Math.sin(head.yaw); // forward, flat on the ground
    const fz = -Math.cos(head.yaw);
    const rx = Math.cos(head.yaw); // right
    const rz = -Math.sin(head.yaw);
    const step = opts.speed * dt;
    rig.x += (rx * sx - fx * sy) * step;
    rig.z += (rz * sx - fz * sy) * step;
  }

  // Turning spins around the player's head so they don't swing sideways.
  const tx = input.turnX || 0;
  if (opts.turnMode !== 'snap') {
    const mag = Math.abs(tx);
    if (mag > opts.deadzone) {
      // Ease in from the deadzone so small pushes turn slowly.
      const amount = Math.min(1, (mag - opts.deadzone) / (1 - opts.deadzone));
      turnAroundHead(rig, head, -Math.sign(tx) * opts.turnSpeed * amount * dt);
    }
    return rig;
  }
  if (rig.turnArmed && Math.abs(tx) > opts.turnPush) {
    turnAroundHead(rig, head, -Math.sign(tx) * opts.snapAngle); // push right = turn right
    rig.turnArmed = false;
  } else if (Math.abs(tx) < opts.turnRelease) {
    rig.turnArmed = true;
  }
  return rig;
}

function turnAroundHead(rig, head, a) {
  const dx = rig.x - head.x;
  const dz = rig.z - head.z;
  rig.x = head.x + dx * Math.cos(a) + dz * Math.sin(a);
  rig.z = head.z - dx * Math.sin(a) + dz * Math.cos(a);
  rig.yaw += a;
}

// ---------- Whip grapple ----------
// Crack the whip on the ground and you get pulled along the ground toward that spot.

export const PULL = {
  speed: 5, // meters per second while being pulled
  stopShort: 0.5, // stop this far before the spot the whip hit
  maxDistance: 4, // longest single pull (m)
};

// head: {x, z} where the player stands. target: {x, z} where the whip hit the ground.
// Returns true if a pull started (too-close cracks are ignored).
export function startPull(rig, head, target, opts = PULL) {
  const dx = target.x - head.x;
  const dz = target.z - head.z;
  const dist = Math.hypot(dx, dz);
  const travel = Math.min(dist - opts.stopShort, opts.maxDistance);
  if (travel < 0.3) return false;
  rig.pull = { ux: dx / dist, uz: dz / dist, left: travel };
  return true;
}

// Moves the pull along by one frame. Returns this frame's {dx, dz} step, or null when not pulling.
export function stepPull(rig, dt, opts = PULL) {
  if (!rig.pull) return null;
  const step = Math.min(rig.pull.left, opts.speed * dt);
  rig.pull.left -= step;
  const move = { dx: rig.pull.ux * step, dz: rig.pull.uz * step };
  if (rig.pull.left <= 1e-6) rig.pull = null;
  return move;
}
