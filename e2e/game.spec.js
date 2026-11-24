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

test('quest unlocks the wet noodle, and swinging it bonks the turkey', async ({ page }) => {
  const errors = await enter(page, '#enter-vr', '&hard');
  await page.waitForFunction(() => window.__game.hands.length === 2, null, { timeout: 10_000 });

  // Open the board with the A button on the right controller.
  await page.evaluate(() => {
    const d = window.__xrDevice;
    d.controllers.right.updateButtonValue('a-button', 1);
    setTimeout(() => d.controllers.right.updateButtonValue('a-button', 0), 150);
  });
  await page.waitForFunction(() => window.__game.board.isOpen);

  // Walk through the quest: wrong word first, then the right one after the lockout.
  const res = await page.evaluate(() => {
    const g = window.__game;
    const q = g.progress.questFor('wet-noodle');
    g.board.press('quest:wet-noodle');
    g.board.press('did-it');
    const views = [g.board.view];
    g.board.press(`word:${q.decoys[0]}`);
    views.push(g.board.view, g.progress.isUnlocked('wet-noodle'));
    return { views, word: q.word };
  });
  expect(res.views).toEqual(['word', 'word', false]);
  await page.evaluate(() => { performance.now = ((n) => () => n() + 60_000)(performance.now.bind(performance)); });
  await page.evaluate((w) => window.__game.board.press(`word:${w}`), res.word);
  expect(await page.evaluate(() => window.__game.board.view)).toBe('unlocked');
  await page.evaluate(() => window.__game.board.press('equip:wet-noodle'));
  expect(await page.evaluate(() => window.__game.equipped)).toBe('wet-noodle');

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
      if (window.__game.score === 0) requestAnimationFrame(step);
    };
    step();
  });
  await page.waitForFunction(() => window.__game.score >= 1, null, { timeout: 15_000 });
  expect(await page.evaluate(() => window.__game.lastCatchBy)).toBe('Wet Noodle');
  await page.screenshot({ path: 'test-results/noodle.png' });
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
    // The "Unlock" button on the Wet Noodle row.
    const target = m.localToWorld(m.position.clone().set((854 / 1024 - 0.5) * 0.8, (0.5 - 292 / 768) * 0.6, 0));
    d.position.set(target.x, target.y, target.z + 1); // stand 1 m back, looking straight at it
    d.quaternion.set(0, 0, 0, 1);
    const c = d.controllers.right;
    c.quaternion.set(0, 1, 0, 0); // controller points away, so only the gaze can hit
    setTimeout(() => c.updateButtonValue('trigger', 1), 200);
    setTimeout(() => c.updateButtonValue('trigger', 0), 350);
  });
  await page.waitForFunction(() => window.__game.board.view === 'quest', null, { timeout: 5_000 });
  expect(errors).toEqual([]);
});
