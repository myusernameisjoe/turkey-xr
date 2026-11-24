# turkey-xr

WebXR game (three.js + Vite) for Meta Quest, played in Quest Browser via GitHub Pages.

- Primary target is AR (passthrough) outdoors in a large backyard, `local-floor` reference space, flat ground at y=0. VR "fake yard" mode is for desktop/emulator testing and as a fallback.
- Keep game logic out of three.js where practical (see `src/turkeyBrain.js`) so it stays unit-testable.
- Check changes with `npm test` and `npm run test:e2e` (IWER emulator in headless Chromium). The e2e tests read `window.__game` and drive `window.__xrDevice`; keep those hooks working.
- Things only a real headset can verify: scale, comfort, passthrough look, audio, how it feels to chase. Say so when a change depends on these.
- Items and quests: see `docs/ADDING-ITEMS.md`. Items live in `src/items/` (registry in `index.js`, ordered lame to awesome); quests in `src/quests.js` unlock items via a secret word a relative gives the player. Hit math goes in `src/combat.js` with unit tests.
- Built item types: touch, swing (wet noodle). Not built yet: launch (slingshot), spray (flamethrower, keep it cartoony).
- The player is a 12-year-old; Joe builds features with him on Thanksgiving. Keep changes small and explainable.
