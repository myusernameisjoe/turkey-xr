// Hit-testing math shared by item types. Pure JS (plain {x, y, z} objects) so it can be unit-tested.

/** Distance from point c to the segment a-b. */
export function segmentPointDistance(a, b, c) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  let t = len2 > 0 ? (acx * abx + acy * aby + acz * abz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = a.x + abx * t - c.x;
  const dy = a.y + aby * t - c.y;
  const dz = a.z + abz * t - c.z;
  return Math.hypot(dx, dy, dz);
}

/**
 * Swing hit: does any segment of a moving chain pass within `radius` of `target`
 * while moving faster than `minSpeed` (m/s)?
 * points: [{x,y,z}], speeds: [number] (speed of each point).
 */
export function swingHits(points, speeds, target, radius, minSpeed) {
  for (let i = 0; i < points.length - 1; i++) {
    const speed = Math.max(speeds[i], speeds[i + 1]);
    if (speed < minSpeed) continue;
    if (segmentPointDistance(points[i], points[i + 1], target) < radius) return true;
  }
  return false;
}

// ---------- Rubber-arm punch ----------
// The fist shoots straight out from your hand, stops at full reach, and snaps back.
// state.phase: 'ready' (fist in your hand) | 'out' (flying out) | 'back' (snapping back)
// state.dist: how far the fist is from your hand (m). state.lastDist: where it was last frame.

export function createPunch() {
  return { phase: 'ready', dist: 0, lastDist: 0 };
}

/** Pull the trigger: throw a punch, if the fist is back in your hand. Returns true if it fired. */
export function firePunch(state) {
  if (state.phase !== 'ready') return false;
  state.phase = 'out';
  return true;
}

/** Move the fist one frame. opts: { reach, outSpeed, backSpeed } in m and m/s. */
export function stepPunch(state, dt, opts) {
  state.lastDist = state.dist;
  if (state.phase === 'out') {
    state.dist += opts.outSpeed * dt;
    if (state.dist >= opts.reach) {
      state.dist = opts.reach;
      state.phase = 'back';
    }
  } else if (state.phase === 'back') {
    state.dist -= opts.backSpeed * dt;
    if (state.dist <= 0) {
      state.dist = 0;
      state.phase = 'ready';
    }
  }
}

/**
 * Did the fist hit the target this frame?
 * Checks the whole path the fist moved this frame, so a fast punch can't skip past the turkey.
 * hand: {x,y,z} where the arm starts, dir: unit {x,y,z} the punch flies along.
 */
export function punchHits(state, hand, dir, target, radius) {
  if (state.dist <= state.lastDist) return false; // only an outgoing fist hits
  const at = (d) => ({ x: hand.x + dir.x * d, y: hand.y + dir.y * d, z: hand.z + dir.z * d });
  return segmentPointDistance(at(state.lastDist), at(state.dist), target) < radius;
}

// ---------- Lobbed throw (gum glob) ----------
// You throw a ball; gravity pulls it down in an arc until it hits the ground.
// state.phase: 'ready' (in your hand) | 'flying' | 'landed' (splat on the ground, waiting to reload)
// state.pos / state.last: where the ball is now / was last frame. state.vel: its velocity (m/s).

export function createLob() {
  return { phase: 'ready', pos: { x: 0, y: 0, z: 0 }, last: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, wait: 0, hit: false };
}

/** Throw from `from` along unit vector `dir` at `speed` m/s, if the ball is in your hand. Returns true if thrown. */
export function throwLob(state, from, dir, speed) {
  if (state.phase !== 'ready') return false;
  state.phase = 'flying';
  state.pos = { ...from };
  state.last = { ...from };
  state.vel = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
  state.hit = false;
  return true;
}

/** Move the ball one frame. opts: { gravity (m/s²), reloadSeconds }. */
export function stepLob(state, dt, opts) {
  if (state.phase === 'flying') {
    state.last = { ...state.pos };
    state.vel.y -= opts.gravity * dt;
    state.pos.x += state.vel.x * dt;
    state.pos.y += state.vel.y * dt;
    state.pos.z += state.vel.z * dt;
    if (state.pos.y <= 0) {
      state.pos.y = 0;
      state.phase = 'landed';
      state.wait = opts.reloadSeconds;
    }
  } else if (state.phase === 'landed') {
    state.last = { ...state.pos };
    state.wait -= dt;
    if (state.wait <= 0) state.phase = 'ready';
  }
}

/**
 * Did the ball get the turkey this frame? Either it flew through the body (within `hitRadius`),
 * or it splatted on the ground within `splatRadius` of the turkey's feet. Each throw hits at most once.
 * target: {x,y,z} centre of the turkey's body.
 */
export function lobHits(state, target, hitRadius, splatRadius) {
  if (state.hit || state.phase === 'ready') return false;
  const justLanded = state.phase === 'landed' && state.last.y > 0;
  if (state.phase === 'landed' && !justLanded) return false; // already sitting on the ground
  let got = segmentPointDistance(state.last, state.pos, target) < hitRadius;
  if (!got && justLanded) got = Math.hypot(state.pos.x - target.x, state.pos.z - target.z) < splatRadius;
  if (got) state.hit = true;
  return got;
}
