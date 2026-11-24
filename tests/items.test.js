import { describe, it, expect } from 'vitest';
import { segmentPointDistance, swingHits } from '../src/combat.js';
import { createNoodleSim } from '../src/items/noodleSim.js';
import { createProgress, WRONG_GUESS_LOCKOUT } from '../src/progress.js';
import { QUESTS } from '../src/quests.js';
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

describe('quests and progress', () => {
  it('every quest unlocks a real item and has its answer among the choices', () => {
    for (const q of QUESTS) {
      expect(ITEMS.some((i) => i.id === q.unlocks)).toBe(true);
      const p = createProgress(QUESTS, fakeStorage());
      expect(p.choices(q)).toContain(q.word);
      expect(q.decoys).not.toContain(q.word);
    }
  });

  it('unlocks with the right word, locks out after a wrong one, and saves', () => {
    const storage = fakeStorage();
    const p = createProgress(QUESTS, storage);
    const q = p.questFor('wet-noodle');
    expect(p.isUnlocked('wet-noodle')).toBe(false);
    expect(p.equip('wet-noodle')).toBe(false);

    expect(p.guess(q, 'stuffing', 0)).toBe('wrong');
    expect(p.guess(q, q.word, 1000)).toBe('locked-out');
    expect(p.guess(q, q.word.toUpperCase(), WRONG_GUESS_LOCKOUT * 1000 + 1)).toBe('unlocked');
    expect(p.equip('wet-noodle')).toBe(true);

    const reloaded = createProgress(QUESTS, storage);
    expect(reloaded.isUnlocked('wet-noodle')).toBe(true);
    expect(reloaded.equipped).toBe('wet-noodle');
  });

  it('works without storage', () => {
    const p = createProgress(QUESTS, null);
    expect(p.equipped).toBe('hands');
  });
});
