// The BOSS: a giant three-headed turkey. Pure logic (no three.js) so it can be unit-tested.
// It walks slowly toward you, pecks when it gets close (then hops back), and has 10,000 health.
// Punch it with your rubber arms. A punch on a head does double damage.
// Coordinates: x/z on the ground, metres. Heading 0 faces +z (same as the normal turkey).

export const BOSS = {
  unlockCatches: 10, // you need rubber arms (10 catches) to fight it
  maxHealth: 10000,
  punchDamage: 50, // a punch on the body. 200 body punches to win.
  headDamage: 100, // a punch on one of the three heads
  prizeCatches: 10, // beating the boss counts as this many catches
  scale: 2.5, // how much bigger than the normal turkey
  walkSpeed: 0.5, // m/s, slow, so seated players don't have to chase it
  spawnDistance: 5, // starts this far in front of you
  peckDistance: 1.4, // gets this close, then pecks
  hopBack: 1.5, // after a peck it hops back this far
  peckSeconds: 0.6, // how long a peck takes
  bodyRadius: 0.6, // how close a fist must pass to the body centre to hit (m)
  headRadius: 0.25, // ...or to a head
  bodyHeight: 0.9, // body centre height (m)
  // The three heads, relative to the body: x = sideways, y = height, z = forward.
  heads: [
    { x: -0.32, y: 1.55, z: 0.45 },
    { x: 0, y: 1.75, z: 0.55 },
    { x: 0.32, y: 1.55, z: 0.45 },
  ],
};

/** Make a boss standing `spawnDistance` in front of the player. player: { x, z, yaw } (yaw 0 = looking toward -z). */
export function createBoss(player, opts = BOSS) {
  const fx = -Math.sin(player.yaw || 0);
  const fz = -Math.cos(player.yaw || 0);
  const x = player.x + fx * opts.spawnDistance;
  const z = player.z + fz * opts.spawnDistance;
  return {
    x,
    z,
    heading: Math.atan2(player.x - x, player.z - z), // facing you
    health: opts.maxHealth,
    maxHealth: opts.maxHealth,
    mode: 'walk', // 'walk' | 'peck' | 'defeated'
    timer: 0,
    speed: 0,
    hits: 0,
    headHits: 0,
    time: 0, // seconds the fight has lasted
    flash: 0, // > 0 right after a hit (the model flashes red)
  };
}

/** Move the boss one frame. Returns 'peck' on the frame it pecks you, else null. */
export function stepBoss(b, player, dt, opts = BOSS) {
  b.flash = Math.max(0, b.flash - dt);
  if (b.mode === 'defeated') {
    b.speed = 0;
    b.timer += dt;
    return null;
  }
  b.time += dt;
  const dx = player.x - b.x;
  const dz = player.z - b.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 1e-3) b.heading = Math.atan2(dx, dz);

  if (b.mode === 'peck') {
    b.speed = 0;
    b.timer -= dt;
    if (b.timer <= 0) {
      // Hop back so it doesn't stand on top of you.
      if (dist > 1e-3) {
        b.x -= (dx / dist) * opts.hopBack;
        b.z -= (dz / dist) * opts.hopBack;
      }
      b.mode = 'walk';
    }
    return null;
  }

  if (dist <= opts.peckDistance) {
    b.mode = 'peck';
    b.timer = opts.peckSeconds;
    b.speed = 0;
    return 'peck';
  }
  const step = Math.min(opts.walkSpeed * dt, dist - opts.peckDistance);
  b.x += (dx / dist) * step;
  b.z += (dz / dist) * step;
  b.speed = opts.walkSpeed;
  return null;
}

/** Where the body and heads are in the world: [{ x, y, z, radius, head }]. Heads first. */
export function bossTargets(b, opts = BOSS) {
  const s = Math.sin(b.heading);
  const c = Math.cos(b.heading);
  const heads = opts.heads.map((h) => ({
    x: b.x + h.x * c + h.z * s,
    y: h.y,
    z: b.z - h.x * s + h.z * c,
    radius: opts.headRadius,
    head: true,
  }));
  return [...heads, { x: b.x, y: opts.bodyHeight, z: b.z, radius: opts.bodyRadius, head: false }];
}

/** A fist hit the boss. Returns true if this hit finished it off. */
export function hitBoss(b, onHead, opts = BOSS) {
  if (b.mode === 'defeated') return false;
  const dmg = onHead ? opts.headDamage : opts.punchDamage;
  b.health = Math.max(0, b.health - dmg);
  b.hits++;
  if (onHead) b.headHits++;
  b.flash = 0.15;
  if (b.health === 0) {
    b.mode = 'defeated';
    b.timer = 0;
    return true;
  }
  return false;
}
