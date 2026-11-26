import { test, expect } from '@playwright/test';

// Plays the game in Meta's IWER headset emulator (emulated Quest 3) in headless Chromium.

async function enter(page, buttonId, extra = '') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?emulate&nodevui${extra}`);
  await expect(page.locator(buttonId)).toBeEnabled({ timeout: 15_000 });
  await page.click(buttonId);
  await page.waitForFunction(() => document.body.classList.contains('in-xr'), null, { timeout: 15_000 });
  return errors;
}

test('desktop preview loads without errors and the turkey moves', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__game);
  const a = await page.evaluate(() => ({ x: window.__game.turkey.x, z: window.__game.turkey.z }));
  await page.waitForTimeout(1500);
  const b = await page.evaluate(() => ({ x: window.__game.turkey.x, z: window.__game.turkey.z }));
  expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.05);
  await page.screenshot({ path: 'test-results/preview.png' });
  expect(errors).toEqual([]);
});

for (const mode of ['vr', 'ar']) {
  test(`${mode.toUpperCase()}: tagging the turkey with a controller scores a point`, async ({ page }) => {
    const errors = await enter(page, `#enter-${mode}`);
    expect(await page.evaluate(() => window.__game.mode)).toBe(mode);

    // Controllers should be connected and reported.
    await page.waitForFunction(() => window.__game.hands.length === 2, null, { timeout: 10_000 });

    // Chase: each animation frame, put the right controller on the turkey's back.
    await page.evaluate(() => {
      const device = window.__xrDevice;
      const step = () => {
        const t = window.__game.turkey;
        const h = window.__game.hands[1];
        if (h && window.__game.score === 0) {
          // Correct for any offset between IWER's global space and the game's local-floor space.
          const c = device.controllers.right.position;
          c.x += t.x - h.x;
          c.y += window.__game.cfg.bodyHeight - h.y;
          c.z += t.z - h.z;
        }
        if (window.__game.score === 0) requestAnimationFrame(step);
      };
      step();
    });
    await page.waitForFunction(() => window.__game.score >= 1, null, { timeout: 15_000 });
    expect(await page.evaluate(() => window.__game.turkey.mode)).toBe('caught');
    await page.screenshot({ path: `test-results/${mode}-caught.png` });
    expect(errors).toEqual([]);
  });
}

test('turkey runs from the player in VR', async ({ page }) => {
  await enter(page, '#enter-vr');
  // Walk the headset to just behind the turkey.
  await page.evaluate(() => {
    const t = window.__game.turkey;
    const p = window.__xrDevice.position;
    p.x = t.x + 1.0;
    p.z = t.z + 1.0;
  });
  await page.waitForFunction(() => window.__game.turkey.mode === 'flee', null, { timeout: 5_000 });
});

test('easy mode (default in emulator): walking at emulator speed catches the turkey', async ({ page }) => {
  await enter(page, '#enter-vr');
  await page.waitForFunction(() => window.__game.hands.length === 2, null, { timeout: 10_000 });
  // Walk the headset (and both controllers with it, at chest height) toward the turkey at 2 m/s.
  await page.evaluate(() => {
    const d = window.__xrDevice;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = window.__game.turkey;
      const p = d.position;
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      const dist = Math.hypot(dx, dz) || 1;
      const move = Math.min(dist, 2 * dt);
      p.x += (dx / dist) * move;
      p.z += (dz / dist) * move;
      d.controllers.left.position.set(p.x - 0.25, p.y - 0.1, p.z);
      d.controllers.right.position.set(p.x + 0.25, p.y - 0.1, p.z);
      if (window.__game.score === 0) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  await page.waitForFunction(() => window.__game.score >= 1, null, { timeout: 30_000 });
});

test('catching 1 turkey unlocks the wet noodle; swinging it stuns the turkey, then a grab catches it', async ({ page }) => {
  const errors = await enter(page, '#enter-vr', '&hard');
  await page.waitForFunction(() => window.__game.hands.length === 2, null, { timeout: 10_000 });
  expect(await page.evaluate(() => window.__game.progress.isUnlocked('wet-noodle'))).toBe(false);

  // Catch one turkey by hand.
  await page.evaluate(() => {
    const d = window.__xrDevice;
    const step = () => {
      const t = window.__game.turkey;
      const h = window.__game.hands[0];
      const c = d.controllers.left.position;
      c.x += t.x - h.x;
      c.y += window.__game.cfg.bodyHeight - h.y;
      c.z += t.z - h.z;
      if (window.__game.score === 0) requestAnimationFrame(step);
      else c.set(d.position.x - 0.25, d.position.y - 0.1, d.position.z - 0.4); // hand back by your side
    };
    step();
  });
  await page.waitForFunction(() => window.__game.score === 1, null, { timeout: 10_000 });

  // That unlocks the noodle and puts it straight in your hand.
  expect(await page.evaluate(() => window.__game.lastUnlock)).toBe('wet-noodle');
  expect(await page.evaluate(() => window.__game.equipped)).toBe('wet-noodle');
  await page.waitForFunction(() => window.__game.turkey.mode !== 'caught', null, { timeout: 5_000 });

  // Open the board with the A button on the right controller.
  await page.evaluate(() => {
    const d = window.__xrDevice;
    d.controllers.right.updateButtonValue('a-button', 1);
    setTimeout(() => d.controllers.right.updateButtonValue('a-button', 0), 150);
  });
  await page.waitForFunction(() => window.__game.board.isOpen);

  // Close the board with a real controller ray + trigger pull on "Back to the turkey".
  await page.evaluate(() => {
    const d = window.__xrDevice;
    const m = window.__game.board.mesh;
    m.updateMatrixWorld();
    const target = m.localToWorld(m.position.clone().set(0, (0.111 - 0.5) * 0.6, 0));
    const normal = m.position.clone().set(0, 0, 1).transformDirection(m.matrixWorld);
    const q = m.quaternion;
    const c = d.controllers.right;
    c.position.set(target.x + normal.x * 0.4, target.y + normal.y * 0.4, target.z + normal.z * 0.4);
    c.quaternion.set(q.x, q.y, q.z, q.w);
    setTimeout(() => c.updateButtonValue('trigger', 1), 100);
    setTimeout(() => c.updateButtonValue('trigger', 0), 250);
  });
  await page.waitForFunction(() => !window.__game.board.isOpen, null, { timeout: 5_000 });

  // Swing the noodle back and forth in front of the turkey, standing far enough away that a hand can't touch it.
  await page.evaluate(() => {
    const d = window.__xrDevice;
    const c = d.controllers.right;
    c.quaternion.set(-0.5, 0, 0, 0.866); // tilt the noodle down toward the turkey
    d.position.set(d.position.x + 20, d.position.y, d.position.z); // keep the head away so it doesn't run
    const t0 = performance.now();
    const step = () => {
      const t = window.__game.turkey;
      const s = (performance.now() - t0) / 1000;
      c.position.set(t.x + Math.sin(s * 8) * 0.5, 0.75, t.z + 0.75);
      if (window.__game.turkey.mode !== 'stunned') requestAnimationFrame(step);
    };
    step();
  });
  // A noodle hit stuns (no point yet)...
  await page.waitForFunction(() => window.__game.turkey.mode === 'stunned', null, { timeout: 15_000 });
  expect(await page.evaluate(() => window.__game.score)).toBe(1);
  // ...then walk over at emulator speed (2 m/s), controllers at chest height, and grab it while it's dizzy.
  await page.evaluate(() => {
    const d = window.__xrDevice;
    let last = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = window.__game.turkey;
      const p = d.position;
      const dx = t.x - p.x, dz = t.z - p.z;
      const dist = Math.hypot(dx, dz) || 1;
      const move = Math.min(dist, 2 * dt);
      p.x += (dx / dist) * move;
      p.z += (dz / dist) * move;
      d.controllers.left.position.set(p.x - 0.25, p.y - 0.3, p.z - 0.3);
      d.controllers.right.position.set(p.x + 0.25, p.y - 0.3, p.z - 0.3);
      if (window.__game.score === 1) requestAnimationFrame(step);
    };
    // Start from where the noodle swing was (about 1 m behind the hand).
    const t = window.__game.turkey;
    d.position.set(t.x, d.position.y, t.z + 2.6);
    requestAnimationFrame(step);
  });
  await page.waitForFunction(() => window.__game.score >= 2, null, { timeout: 5_000 });
  expect(errors).toEqual([]);
});

test('look-and-click: aiming your head at a board button and pulling the trigger presses it', async ({ page }) => {
  const errors = await enter(page, '#enter-vr', '&reset');
  await page.waitForFunction(() => window.__game.hands.length === 2, null, { timeout: 10_000 });
  await page.evaluate(() => window.__game.toggleBoard());
  await page.evaluate(() => {
    const d = window.__xrDevice;
    const m = window.__game.board.mesh;
    m.updateMatrixWorld();
    // The "Back to the turkey" button.
    const target = m.localToWorld(m.position.clone().set(0, (0.5 - 683 / 768) * 0.6, 0));
    d.position.set(target.x, target.y, target.z + 1); // stand 1 m back, looking straight at it
    d.quaternion.set(0, 0, 0, 1);
    const c = d.controllers.right;
    c.quaternion.set(0, 1, 0, 0); // controller points away, so only the gaze can hit
    setTimeout(() => c.updateButtonValue('trigger', 1), 200);
    setTimeout(() => c.updateButtonValue('trigger', 0), 350);
  });
  await page.waitForFunction(() => !window.__game.board.isOpen, null, { timeout: 5_000 });
  expect(errors).toEqual([]);
});

test('fake yard: left stick glides, right stick snap-turns with ?snap', async ({ page }) => {
  const errors = await enter(page, '#enter-vr', '&snap');
  await page.waitForFunction(() => window.__game.hands.length === 2, null, { timeout: 10_000 });
  // Push the left stick forward for a moment.
  await page.evaluate(() => window.__xrDevice.controllers.left.updateAxes('thumbstick', 0, -1));
  await page.waitForFunction(() => Math.hypot(window.__game.rig.x, window.__game.rig.z) > 0.5, null, { timeout: 5_000 });
  await page.evaluate(() => window.__xrDevice.controllers.left.updateAxes('thumbstick', 0, 0));
  // Flick the right stick right: one 30-degree turn.
  await page.evaluate(() => window.__xrDevice.controllers.right.updateAxes('thumbstick', 1, 0));
  await page.waitForFunction(() => window.__game.rig.yaw < -0.5, null, { timeout: 5_000 });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__game.rig.yaw)).toBeCloseTo(-Math.PI / 6);
  expect(errors).toEqual([]);
});
test('fake yard: right stick turns smoothly by default, snap with ?snap', async ({ page }) => {
  await enter(page, '#enter-vr');
  await page.waitForFunction(() => window.__game.hands.length === 2, null, { timeout: 10_000 });
  await page.evaluate(() => window.__xrDevice.controllers.right.updateAxes('thumbstick', 1, 0));
  // Sample the turn over time: it should keep growing in small steps, not jump.
  const samples = await page.evaluate(() => new Promise((res) => {
    const out = [];
    const f = () => { out.push(window.__game.rig.yaw); if (out.length < 40) requestAnimationFrame(f); else res(out); };
    requestAnimationFrame(f);
  }));
  await page.evaluate(() => window.__xrDevice.controllers.right.updateAxes('thumbstick', 0, 0));
  const steps = samples.slice(1).map((y, i) => samples[i] - y);
  expect(samples.at(-1)).toBeLessThan(-0.2); // turned right
  expect(Math.max(...steps)).toBeLessThan(0.1); // no frame jumps more than ~6 degrees
});


test('AR yard: sticks do not move the player', async ({ page }) => {
  await enter(page, '#enter-ar');
  await page.waitForFunction(() => window.__game.hands.length === 2, null, { timeout: 10_000 });
  await page.evaluate(() => window.__xrDevice.controllers.left.updateAxes('thumbstick', 0, -1));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__game.rig.x === 0 && window.__game.rig.z === 0)).toBe(true);
});

test('catches start over on every page load unless ?save is in the URL', async ({ page }) => {
  const catches = () => page.evaluate(() => window.__game.progress.totalCatches);
  await page.goto('/?emulate&nodevui');
  await page.waitForFunction(() => window.__game?.progress);
  await page.evaluate(() => window.__game.progress.recordCatch());
  expect(await catches()).toBe(1);
  await page.reload();
  await page.waitForFunction(() => window.__game?.progress);
  expect(await catches()).toBe(0);

  await page.goto('/?emulate&nodevui&save&reset');
  await page.waitForFunction(() => window.__game?.progress);
  await page.evaluate(() => window.__game.progress.recordCatch());
  await page.goto('/?emulate&nodevui&save');
  await page.waitForFunction(() => window.__game?.progress);
  expect(await catches()).toBe(1);
});

test('fake yard: ?invert flips forward/back on the left stick', async ({ page }) => {
  await enter(page, '#enter-vr', '&invert');
  await page.waitForFunction(() => window.__game.hands.length === 2, null, { timeout: 10_000 });
  // Head faces -Z. Pushing forward should now move toward +Z (backward).
  await page.evaluate(() => window.__xrDevice.controllers.left.updateAxes('thumbstick', 0, -1));
  await page.waitForFunction(() => window.__game.rig.z > 0.5, null, { timeout: 5_000 });
  await page.evaluate(() => window.__xrDevice.controllers.left.updateAxes('thumbstick', 0, 0));
});

test('red whip: cracking it on the ground pulls you toward that spot', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('turkey-xr-progress-v2', JSON.stringify({ totalCatches: 5, equipped: 'whip' })));
  const errors = await enter(page, '#enter-vr', '&save&hard');
  await page.waitForFunction(() => window.__game.hands.length === 2, null, { timeout: 10_000 });
  expect(await page.evaluate(() => window.__game.equipped)).toBe('whip');
  const before = await page.evaluate(() => ({ ...window.__game.rig }));

  // Raise the whip, then flick it down hard in front of you, over and over until it grapples.
  await page.evaluate(() => {
    const d = window.__xrDevice;
    const c = d.controllers.right;
    const t0 = performance.now();
    const step = () => {
      const s = ((performance.now() - t0) / 1000) % 1.2; // one flick every 1.2 s
      const down = Math.min(1, Math.max(0, (s - 0.8) / 0.15)); // hold up, then snap down
      const a = (-0.8 + 1.6 * down) / 2; // tilt from 45 degrees up to 45 degrees down
      c.quaternion.set(Math.sin(-a), 0, 0, Math.cos(a));
      const p = d.position;
      c.position.set(p.x + 0.25, p.y - 0.3 - 0.3 * down, p.z - 0.3 - 0.2 * down);
      if (!window.__game.grapples) requestAnimationFrame(step);
    };
    step();
  });
  await page.waitForFunction(() => window.__game.grapples >= 1, null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__game.rig.pull === null, null, { timeout: 3_000 });
  const after = await page.evaluate(() => ({ ...window.__game.rig }));
  // Pulled forward (toward -Z, where you're facing), along the ground.
  expect(before.z - after.z).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});
