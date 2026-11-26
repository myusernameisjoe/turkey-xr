import { describe, it, expect } from 'vitest';
import { segmentPointDistance, swingHits } from '../src/combat.js';
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

  it('the wet noodle unlocks after 1 catch, the eagle after 2, and progress is saved', () => {
    const storage = fakeStorage();
    const p = createProgress(UNLOCKS, storage);
    expect(p.isUnlocked('hands')).toBe(true);
    expect(p.isUnlocked('wet-noodle')).toBe(false);
    expect(p.equip('wet-noodle')).toBe(false);

    expect(p.recordCatch()).toEqual(['wet-noodle']);
    expect(p.isUnlocked('wet-noodle')).toBe(true);
    expect(p.recordCatch()).toEqual(['eagle']); // 2nd catch: you turn into an eagle
    expect(p.recordCatch()).toEqual([]); // each unlock is only announced once
    expect(p.equip('wet-noodle')).toBe(true);

    const reloaded = createProgress(UNLOCKS, storage);
    expect(reloaded.totalCatches).toBe(3);
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
