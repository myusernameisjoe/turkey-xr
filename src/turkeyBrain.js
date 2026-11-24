// Turkey behaviour, kept free of three.js so it can be unit-tested in Node.
// Coordinates: x/z on the ground plane, metres. Heading 0 faces +z.

export const DEFAULTS = {
  areaRadius: 6, // play area radius around the session origin
  walkSpeed: 0.6,
  fleeSpeed: 2.6,
  tiredSpeed: 1.1,
  fleeDistance: 2.5, // starts running when the player is this close
  calmDistance: 4.0, // stops running when the player is this far
  turnRate: 5, // rad/s
  sprintSeconds: 4, // how long it can sprint before tiring
  restSeconds: 2.5, // how long it stays tired
  caughtSeconds: 2.2, // celebration time before respawn
  catchRadius: 0.4, // hand-to-body distance that counts as a catch
  bodyHeight: 0.35,
  reachHeight: 0, // if > 0, any hand below this height over the turkey counts (no crouching needed)
};

export const STUNNED_GRAB = { radius: 0.8, maxHeight: 1.6 };

// Easier tuning: on by default in the desktop emulator, or with ?easy on the headset.
export const EASY = {
  fleeSpeed: 1.6, // slower than the emulator's 2 m/s walk
  tiredSpeed: 0.8,
  sprintSeconds: 2.5,
  restSeconds: 3.5,
  catchRadius: 0.7,
  reachHeight: 1.6,
};

export function createTurkey(cfg = DEFAULTS, rng = Math.random) {
  const t = {
    x: 0,
    z: -3,
    heading: Math.PI,
    speed: 0,
    mode: 'wander', // wander | peck | flee | stunned | caught
    target: null,
    timer: 0,
    stamina: cfg.sprintSeconds,
    tired: 0,
    zig: 0,
    knockX: 0, // knockback velocity while stunned (m/s)
    knockZ: 0,
  };
  t.target = randomPoint(cfg, rng);
  return t;
}

export function randomPoint(cfg, rng, avoid = null, minDist = 0) {
  for (let i = 0; i < 20; i++) {
    const r = cfg.areaRadius * 0.85 * Math.sqrt(rng());
    const a = rng() * Math.PI * 2;
    const p = { x: Math.sin(a) * r, z: Math.cos(a) * r };
    if (!avoid || Math.hypot(p.x - avoid.x, p.z - avoid.z) >= minDist) return p;
  }
  return { x: 0, z: 0 };
}

function angleTo(fromX, fromZ, toX, toZ) {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function turnToward(t, desired, rate, dt) {
  const diff = wrap(desired - t.heading);
  const max = rate * dt;
  t.heading = wrap(t.heading + Math.max(-max, Math.min(max, diff)));
}

/**
 * Advance the turkey by dt seconds.
 * player: {x, z} of the player's head on the ground plane.
 * Returns the turkey (mutated) for convenience.
 */
export function stepTurkey(t, player, dt, cfg = DEFAULTS, rng = Math.random) {
  const distToPlayer = Math.hypot(t.x - player.x, t.z - player.z);

  if (t.mode === 'caught') {
    t.speed = 0;
    t.timer -= dt;
    if (t.timer <= 0) respawn(t, player, cfg, rng);
    return t;
  }

  if (t.mode === 'stunned') {
    // Dizzy: slides from the knockback, then shakes it off.
    t.speed = 0;
    t.x += t.knockX * dt;
    t.z += t.knockZ * dt;
    const friction = Math.exp(-5 * dt);
    t.knockX *= friction;
    t.knockZ *= friction;
    clampToArea(t, cfg);
    t.timer -= dt;
    if (t.timer <= 0) {
      t.mode = 'wander';
      t.target = randomPoint(cfg, rng);
    }
    return t;
  }

  if (t.tired > 0) t.tired = Math.max(0, t.tired - dt);

  // Decide mode.
  if (distToPlayer < cfg.fleeDistance) {
    if (t.mode !== 'flee') t.zig = rng() < 0.5 ? -1 : 1;
    t.mode = 'flee';
  } else if (t.mode === 'flee' && distToPlayer > cfg.calmDistance) {
    t.mode = 'wander';
    t.target = randomPoint(cfg, rng, player, cfg.fleeDistance);
  }

  let desiredHeading = t.heading;
  let desiredSpeed = 0;

  if (t.mode === 'flee') {
    // Run directly away, with a zigzag, pulled back toward the centre near the edge.
    const away = angleTo(player.x, player.z, t.x, t.z);
    t.timer += dt;
    if (t.timer > 0.6 + rng() * 0.5) {
      t.timer = 0;
      t.zig = -t.zig;
    }
    let ax = Math.sin(away + t.zig * 0.5);
    let az = Math.cos(away + t.zig * 0.5);
    const r = Math.hypot(t.x, t.z);
    const edge = Math.max(0, (r - cfg.areaRadius * 0.7) / (cfg.areaRadius * 0.3));
    if (r > 0.001) {
      ax = ax * (1 - edge) + (-t.x / r) * edge;
      az = az * (1 - edge) + (-t.z / r) * edge;
    }
    desiredHeading = Math.atan2(ax, az);

    if (t.tired > 0) {
      desiredSpeed = cfg.tiredSpeed;
    } else {
      desiredSpeed = cfg.fleeSpeed;
      t.stamina -= dt;
      if (t.stamina <= 0) {
        t.tired = cfg.restSeconds;
        t.stamina = cfg.sprintSeconds;
      }
    }
  } else {
    // Recover stamina while calm.
    t.stamina = Math.min(cfg.sprintSeconds, t.stamina + dt * 0.5);
    if (t.mode === 'peck') {
      t.timer -= dt;
      if (t.timer <= 0) {
        t.mode = 'wander';
        t.target = randomPoint(cfg, rng);
      }
    } else {
      const d = Math.hypot(t.target.x - t.x, t.target.z - t.z);
      if (d < 0.3) {
        t.mode = 'peck';
        t.timer = 0.8 + rng() * 1.6;
      } else {
        desiredHeading = angleTo(t.x, t.z, t.target.x, t.target.z);
        desiredSpeed = cfg.walkSpeed;
      }
    }
  }

  turnToward(t, desiredHeading, t.mode === 'flee' ? cfg.turnRate * 1.6 : cfg.turnRate, dt);
  // Ease speed so starts and stops are not instant.
  const accel = t.mode === 'flee' ? 8 : 3;
  t.speed += (desiredSpeed - t.speed) * Math.min(1, accel * dt);

  t.x += Math.sin(t.heading) * t.speed * dt;
  t.z += Math.cos(t.heading) * t.speed * dt;

  clampToArea(t, cfg);
  return t;
}

function clampToArea(t, cfg) {
  const r = Math.hypot(t.x, t.z);
  if (r > cfg.areaRadius) {
    t.x *= cfg.areaRadius / r;
    t.z *= cfg.areaRadius / r;
  }
}

/**
 * Knock the turkey dizzy. (fromX, fromZ) is where the hit came from; it gets pushed
 * `distance` metres directly away from there, then stays put for `seconds`.
 */
export function stunTurkey(t, fromX, fromZ, seconds, distance = 1) {
  if (t.mode === 'caught' || t.mode === 'stunned') return false;
  let dx = t.x - fromX;
  let dz = t.z - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d;
  dz /= d;
  // With friction e^(-5t), total slide = v0 / 5.
  t.knockX = dx * distance * 5;
  t.knockZ = dz * distance * 5;
  t.mode = 'stunned';
  t.timer = seconds;
  t.speed = 0;
  t.heading = Math.atan2(-dx, -dz); // faces whoever bonked it
  return true;
}

/** True if a hand at (hx, hy, hz) is touching the turkey's body. */
export function isTouching(t, hand, cfg = DEFAULTS) {
  if (t.mode === 'caught') return false;
  const dx = hand.x - t.x;
  const dz = hand.z - t.z;
  // A dizzy turkey is easy to grab: any hand below head height, close by, counts (no crouching).
  if (t.mode === 'stunned') {
    return hand.y < STUNNED_GRAB.maxHeight && Math.hypot(dx, dz) < STUNNED_GRAB.radius;
  }
  if (cfg.reachHeight > 0) {
    return hand.y < cfg.reachHeight && Math.hypot(dx, dz) < cfg.catchRadius;
  }
  const dy = hand.y - cfg.bodyHeight;
  return Math.hypot(dx, dy, dz) < cfg.catchRadius;
}

export function catchTurkey(t, cfg = DEFAULTS) {
  t.mode = 'caught';
  t.timer = cfg.caughtSeconds;
  t.speed = 0;
}

export function respawn(t, player, cfg = DEFAULTS, rng = Math.random) {
  const p = randomPoint(cfg, rng, player, 3);
  t.x = p.x;
  t.z = p.z;
  t.mode = 'wander';
  t.timer = 0;
  t.stamina = cfg.sprintSeconds;
  t.tired = 0;
  t.knockX = 0;
  t.knockZ = 0;
  t.target = randomPoint(cfg, rng);
}
