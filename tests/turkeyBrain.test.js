import { describe, it, expect } from 'vitest';
import { DEFAULTS, EASY, EAGLE, createTurkey, stepTurkey, isTouching, catchTurkey, stunTurkey, grabWithTalons, carryTurkey, dropTurkey } from '../src/turkeyBrain.js';

// Deterministic RNG so tests are repeatable.
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const DT = 1 / 72;
const run = (t, player, seconds, rng, cfg = DEFAULTS) => {
  for (let i = 0; i < seconds / DT; i++) stepTurkey(t, player, DT, cfg, rng);
};

describe('turkey brain', () => {
  it('wanders and moves when the player is far away', () => {
    const rng = seeded(2);
    const t = createTurkey(DEFAULTS, rng);
    const start = { x: t.x, z: t.z };
    run(t, { x: 100, z: 100 }, 5, rng);
    expect(Math.hypot(t.x - start.x, t.z - start.z)).toBeGreaterThan(0.5);
    expect(['wander', 'peck']).toContain(t.mode);
  });

  it('never leaves the play area', () => {
    const rng = seeded(3);
    const t = createTurkey(DEFAULTS, rng);
    for (let i = 0; i < 72 * 120; i++) {
      // Player circles around chasing it.
      const player = { x: t.x + Math.sin(i / 50) * 1.5, z: t.z + Math.cos(i / 50) * 1.5 };
      stepTurkey(t, player, DT, DEFAULTS, rng);
      expect(Math.hypot(t.x, t.z)).toBeLessThanOrEqual(DEFAULTS.areaRadius + 1e-6);
    }
  });

  it('runs away when the player gets close', () => {
    const rng = seeded(4);
    const t = createTurkey(DEFAULTS, rng);
    t.x = 0;
    t.z = 0;
    const player = { x: 0, z: -1.5 };
    run(t, player, 0.6, rng);
    expect(t.mode).toBe('flee');
    expect(Math.hypot(t.x - player.x, t.z - player.z)).toBeGreaterThan(1.5);
    expect(t.speed).toBeGreaterThan(DEFAULTS.walkSpeed);
  });

  it('gets tired after sprinting, so it can be caught', () => {
    const rng = seeded(5);
    const t = createTurkey(DEFAULTS, rng);
    t.x = 0;
    t.z = 0;
    let sawTired = false;
    for (let i = 0; i < 72 * 8; i++) {
      stepTurkey(t, { x: t.x, z: t.z - 1 }, DT, DEFAULTS, rng);
      if (t.tired > 0) sawTired = true;
    }
    expect(sawTired).toBe(true);
  });

  it('detects a hand touching the body and respawns after being caught', () => {
    const rng = seeded(6);
    const t = createTurkey(DEFAULTS, rng);
    expect(isTouching(t, { x: t.x, y: DEFAULTS.bodyHeight, z: t.z })).toBe(true);
    expect(isTouching(t, { x: t.x + 1, y: DEFAULTS.bodyHeight, z: t.z })).toBe(false);
    expect(isTouching(t, { x: t.x, y: 1.5, z: t.z })).toBe(false);

    catchTurkey(t);
    expect(t.mode).toBe('caught');
    expect(isTouching(t, { x: t.x, y: DEFAULTS.bodyHeight, z: t.z })).toBe(false);
    const player = { x: t.x, z: t.z };
    run(t, player, DEFAULTS.caughtSeconds + 0.1, rng);
    expect(t.mode).not.toBe('caught');
    expect(Math.hypot(t.x - player.x, t.z - player.z)).toBeGreaterThanOrEqual(2.9);
  });

  it('respects a custom area size', () => {
    const rng = seeded(7);
    const cfg = { ...DEFAULTS, areaRadius: 15 };
    const t = createTurkey(cfg, rng);
    let maxR = 0;
    run(t, { x: 100, z: 100 }, 1, rng, cfg);
    for (let i = 0; i < 72 * 200; i++) {
      stepTurkey(t, { x: 100, z: 100 }, DT, cfg, rng);
      maxR = Math.max(maxR, Math.hypot(t.x, t.z));
    }
    expect(maxR).toBeGreaterThan(6);
    expect(maxR).toBeLessThanOrEqual(15);
  });

  it('easy mode: catchable from standing height and slower than a walk', () => {
    const cfg = { ...DEFAULTS, ...EASY };
    const rng = seeded(8);
    const t = createTurkey(cfg, rng);
    expect(isTouching(t, { x: t.x + 0.5, y: 1.2, z: t.z }, cfg)).toBe(true);
    expect(isTouching(t, { x: t.x + 1.0, y: 1.2, z: t.z }, cfg)).toBe(false);
    expect(isTouching(t, { x: t.x, y: 1.8, z: t.z }, cfg)).toBe(false);
    expect(cfg.fleeSpeed).toBeLessThan(2);
  });

  it('stun: knocked back about 1 m, stays dizzy, can be tagged, then recovers', () => {
    const rng = seeded(9);
    const t = createTurkey(DEFAULTS, rng);
    t.x = 0;
    t.z = 0;
    expect(stunTurkey(t, 0, 1, 2.5, 1.0)).toBe(true); // hit from +z, so pushed toward -z
    expect(t.mode).toBe('stunned');
    expect(stunTurkey(t, 0, 1, 2.5, 1.0)).toBe(false); // no double stun
    // No instant grab by the hand that just swung (it's still sliding away).
    expect(isTouching(t, { x: t.x, y: 1.0, z: t.z + 0.3 })).toBe(false);
    const player = { x: 0, z: 0.5 }; // right next to it: a normal turkey would flee
    run(t, player, 2.0, rng);
    expect(t.mode).toBe('stunned');
    expect(t.z).toBeLessThan(-0.85);
    expect(t.z).toBeGreaterThan(-1.05);
    expect(Math.abs(t.x)).toBeLessThan(1e-6);
    expect(isTouching(t, { x: t.x, y: DEFAULTS.bodyHeight, z: t.z })).toBe(true);
    // Dizzy turkeys can be grabbed from standing height, even in hard mode.
    expect(isTouching(t, { x: t.x + 0.6, y: 1.3, z: t.z })).toBe(true);
    expect(isTouching(t, { x: t.x + 1.2, y: 1.3, z: t.z })).toBe(false);
    run(t, player, 0.6, rng);
    expect(isTouching(t, { x: t.x + 0.6, y: 1.3, z: t.z })).toBe(false);
    expect(t.mode).not.toBe('stunned');
  });

  it('stun knockback never pushes the turkey out of the play area', () => {
    const rng = seeded(10);
    const t = createTurkey(DEFAULTS, rng);
    t.x = DEFAULTS.areaRadius - 0.2;
    t.z = 0;
    stunTurkey(t, 0, 0, 2, 3);
    run(t, { x: 0, z: 0 }, 2, rng);
    expect(Math.hypot(t.x, t.z)).toBeLessThanOrEqual(DEFAULTS.areaRadius + 1e-6);
  });
});

describe('eagle talons', () => {
  const cfg = DEFAULTS;
  const fall = (t, rng) => {
    for (let i = 0; i < 300 && t.mode === 'falling'; i++) stepTurkey(t, { x: 50, z: 50 }, DT, cfg, rng);
  };

  it('grabs the turkey only when the talon is right over its back', () => {
    const t = createTurkey(cfg, seeded(1));
    expect(grabWithTalons(t, { x: t.x + 2, y: 0.6, z: t.z }, cfg)).toBe(false); // too far sideways
    expect(grabWithTalons(t, { x: t.x, y: 2.5, z: t.z }, cfg)).toBe(false); // too high
    expect(grabWithTalons(t, { x: t.x + 0.2, y: 0.7, z: t.z }, cfg)).toBe(true);
    expect(t.mode).toBe('carried');
  });

  it('carries the turkey along, dangling under the talon, and you cannot catch it while carrying', () => {
    const t = createTurkey(cfg, seeded(1));
    grabWithTalons(t, { x: t.x, y: 0.7, z: t.z }, cfg);
    carryTurkey(t, { x: 1, y: 3, z: 2 }, cfg);
    expect(t.x).toBe(1);
    expect(t.z).toBe(2);
    expect(t.y).toBeCloseTo(3 - EAGLE.hang);
    stepTurkey(t, { x: 1, z: 2 }, DT, cfg); // stays carried even with the player right there
    expect(t.mode).toBe('carried');
    expect(isTouching(t, { x: 1, y: 3, z: 2 }, cfg)).toBe(false);
  });

  it('a high drop lands it dizzy, and then a touch catches it', () => {
    const rng = seeded(4);
    const t = createTurkey(cfg, rng);
    grabWithTalons(t, { x: t.x, y: 0.7, z: t.z }, cfg);
    carryTurkey(t, { x: 0, y: 3, z: 0 }, cfg);
    dropTurkey(t);
    expect(t.mode).toBe('falling');
    fall(t, rng);
    expect(t.y).toBe(0);
    expect(t.mode).toBe('stunned');
    expect(t.lastLanding).toBe('dizzy');
    expect(isTouching(t, { x: 0.3, y: 0.8, z: 0 }, cfg)).toBe(true);
  });

  it('a low drop just makes it run away', () => {
    const rng = seeded(5);
    const t = createTurkey(cfg, rng);
    grabWithTalons(t, { x: t.x, y: 0.7, z: t.z }, cfg);
    carryTurkey(t, { x: 0, y: 1.2, z: 0 }, cfg); // feet at 0.65 m: seated-arm height
    dropTurkey(t);
    fall(t, rng);
    expect(t.lastLanding).toBe('ran');
    expect(t.mode).not.toBe('stunned');
  });

  it('a dizzy turkey is caught by touch, not grabbed', () => {
    const t = createTurkey(cfg, seeded(1));
    stunTurkey(t, t.x + 1, t.z, 3, 0);
    expect(grabWithTalons(t, { x: t.x, y: 0.7, z: t.z }, cfg)).toBe(false);
  });
});
