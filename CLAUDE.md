# turkey-xr

WebXR game (three.js + Vite) for Meta Quest, played in Quest Browser via GitHub Pages.

- Primary target is AR (passthrough) outdoors in a large backyard, `local-floor` reference space, flat ground at y=0. VR "fake yard" mode is for desktop/emulator testing and as a fallback.
- Keep game logic out of three.js where practical (see `src/turkeyBrain.js`) so it stays unit-testable.
- Check changes with `npm test` and `npm run test:e2e` (IWER emulator in headless Chromium). The e2e tests read `window.__game` and drive `window.__xrDevice`; keep those hooks working.
- Things only a real headset can verify: scale, comfort, passthrough look, audio, how it feels to chase. Say so when a change depends on these.
- Items and unlocks: see `docs/ADDING-ITEMS.md`. Items live in `src/items/` (registry in `index.js`, ordered lame to awesome); items unlock by total turkeys caught (`src/unlocks.js`); the count starts at 0 on every page load unless the URL has `?save` (then it's kept in localStorage); a newly unlocked item is auto-equipped. (The Grandpa secret-word quest was removed on 2026-11-26 at Joe's request.) Hit math goes in `src/combat.js` with unit tests.
- Built item types: touch, swing (wet noodle at 1 catch), talons (eagle mode at 2 catches: grip grabs, A/B fly up/down in VR, high drop makes it dizzy, then touch catches; in AR no flying, just lift your arm). A red whip was tried and removed on 2026-11-26; may come back later. Not built yet: launch (slingshot), spray (flamethrower, keep it cartoony).
- The player is a 12-year-old; Joe builds features with him on Thanksgiving. Keep changes small and explainable.
