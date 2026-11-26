import { describe, it, expect } from 'vitest';
import { segmentPointDistance, swingHits, groundCrack } from '../src/combat.js';
import { createNoodleSim } from '../src/items/noodleSim.js';
import { createProgress } from '../src/progress.js';
import { UNLOCKS } from '../src/unlocks.js';
import { ITEMS } from '../src/items/index.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
}

describe('combat math', () => {
  it('measures distance to a segment', () => {
    const a = { x: 0, y: 0, z: 0 }, b = { x: 2, y: 0, z: 0 };
    expect(segmentPointDistance(a, b, { x: 1, y: 1, z: 0 })).toBeCloseTo(1);
    expect(segmentPointDistance(a, b, { x: 3, y: 0, z: 0 })).toBeCloseTo(1);
  });
  it('only counts a swing that is fast enough', () => {
    const pts = [{ x: -1, y: 0.35, z: 0 }, { x: 1, y: 0.35, z: 0 }];
    const target = { x: 0, y: 0.35, z: 0.1 };
    expect(swingHits(pts, [3, 3], target, 0.25, 1.5)).toBe(true);
    expect(swingHits(pts, [0.5, 0.5], target, 0.25, 1.5)).toBe(false);
  });
});

describe('whip ground crack', () => {
  it('only grapples when the tip slaps the ground fast', () => {
    const pts = [{ x: 0, y: 1, z: 0 }, { x: 0, y: 0.05, z: -2 }];
    expect(groundCrack(pts, [0, 6], 4)).toEqual({ x: 0, z: -2 });
    expect(groundCrack(pts, [0, 1], 4)).toBe(null); // just resting on the grass
    const high = [{ x: 0, y: 1, z: 0 }, { x: 0, y: 0.8, z: -2 }];
    expect(groundCrack(high, [0, 6], 4)).toBe(null); // fast, but in the air
  });

  it('a downward flick of the whip cracks the ground', () => {
    const sim = createNoodleSim({ segments: 16, length: 2.5, stiffness: 0.05, gravity: 9.8 });
    const dt = 1 / 72;
    // Hold it up high, then flick the hand down hard.
    for (let i = 0; i < 72; i++) sim.step({ x: 0, y: 1.2, z: 0 }, { x: 0, y: 0.7, z: -0.7 }, dt);
    let spot = null;
    for (let i = 0; i < 72 && !spot; i++) {
      const s = Math.min(1, i / 10);
      sim.step({ x: 0, y: 1.2 - 0.4 * s, z: -0.3 * s }, { x: 0, y: 0.7 - 1.4 * s, z: -0.7 }, dt);
      spot = groundCrack(sim.points, sim.speeds, 4);
    }
    expect(spot).not.toBe(null);
    expect(spot.z).toBeLessThan(-0.8); // out in front of you
  });
});

describe('noodle physics', () => {
  it('stays about 1 m long, droops, and the tip moves fast when swung', () => {
    const sim = createNoodleSim({ length: 1 });
    const dt = 1 / 72;
    const dir = { x: 0, y: 0, z: -1 };
    for (let i = 0; i < 144; i++) sim.step({ x: 0, y: 1, z: 0 }, dir, dt);
    const tip = sim.points.at(-1);
    expect(Math.hypot(tip.x, tip.y - 1, tip.z)).toBeGreaterThan(0.7);
    expect(Math.hypot(tip.x, tip.y - 1, tip.z)).toBeLessThan(1.05);
    expect(tip.y).toBeLessThan(1); // droops
    expect(Math.max(...sim.speeds)).toBeLessThan(0.5); // at rest

    let maxTip = 0;
    for (let i = 0; i < 36; i++) {
      sim.step({ x: Math.sin(i / 4) * 0.6, y: 1, z: 0 }, dir, dt);
      maxTip = Math.max(maxTip, sim.speeds.at(-1));
    }
    expect(maxTip).toBeGreaterThan(2);
  });
});

describe('unlocks and progress', () => {
  it('every unlock points at a real item, in ladder order', () => {
    let last = 0;
    for (const u of UNLOCKS) {
      expect(ITEMS.some((i) => i.id === u.item)).toBe(true);
      expect(u.catches).toBeGreaterThanOrEqual(last);
      last = u.catches;
    }
  });

  it('the wet noodle unlocks after 1 catch, and progress is saved', () => {
    const storage = fakeStorage();
    const p = createProgress(UNLOCKS, storage);
    expect(p.isUnlocked('hands')).toBe(true);
    expect(p.isUnlocked('wet-noodle')).toBe(false);
    expect(p.equip('wet-noodle')).toBe(false);

    expect(p.recordCatch()).toEqual(['wet-noodle']);
    expect(p.isUnlocked('wet-noodle')).toBe(true);
    expect(p.recordCatch()).toEqual([]); // only announced once
    expect(p.equip('wet-noodle')).toBe(true);

    const reloaded = createProgress(UNLOCKS, storage);
    expect(reloaded.totalCatches).toBe(2);
    expect(reloaded.equipped).toBe('wet-noodle');
    reloaded.reset();
    expect(reloaded.isUnlocked('wet-noodle')).toBe(false);
  });

  it('unlocks several items at the right counts', () => {
    const p = createProgress([{ item: 'a', catches: 1 }, { item: 'b', catches: 3 }], fakeStorage());
    expect(p.recordCatch()).toEqual(['a']);
    expect(p.recordCatch()).toEqual([]);
    expect(p.recordCatch()).toEqual(['b']);
    expect(p.required('b')).toBe(3);
  });

  it('works without storage', () => {
    const p = createProgress(UNLOCKS, null);
    expect(p.equipped).toBe('hands');
    expect(p.totalCatches).toBe(0);
  });
});
