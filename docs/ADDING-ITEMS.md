# Adding items and quests

The game has an **item ladder** (lame → awesome) and **real-world quests** that unlock each item.

## Add a quest (no coding)

Edit `src/quests.js` and add an entry:

```js
{
  id: 'grandma-pie',
  unlocks: 'frying-pan',            // must match an item id in src/items/index.js
  task: "Ask Grandma what her favorite pie is.",
  word: 'pecan',                    // tell Grandma this word before you play!
  decoys: ['apple', 'pumpkin', 'cherry'],
},
```

The player sees the task on the Item Board (press **A** or **X**), does it in real life, gets the
secret word from the person, and picks it from the four buttons. A wrong guess locks the buttons for 10 s.

## Add an item

1. Copy `src/items/wetNoodle.js` to `src/items/<yourItem>.js`.
2. Change `id`, `name`, `blurb`, and tune the numbers (`hitRadius`, `minSwingSpeed`).
3. Change what it looks like in `create()`. It gets `update(dt, grip)` every frame with the
   controller it's held in, and `hits(target)` should return `true` when it hits the turkey.
4. Add it to the `ITEMS` list in `src/items/index.js`, in ladder order.
5. Add a quest for it in `src/quests.js`.

### Item types

| Type | Status | How it hits | Ideas |
| --- | --- | --- | --- |
| `touch` | done | hand touches the turkey | bare hands |
| `swing` | done (wet noodle) | a moving stick/chain passes through the turkey fast enough (`swingHits` in `src/combat.js`) | frying pan, baguette, pool noodle |
| `launch` | to build | pull back + release, projectile flies with gravity | slingshot, cranberry cannon, water balloons |
| `spray` | to build | anything in a cone in front of the hand | leaf blower, flamethrower, gravy hose |

When building `launch` or `spray`, add the hit math to `src/combat.js` with a unit test, like `swingHits`.

## Test it

```sh
npm test           # unit tests (fast)
npm run test:e2e   # plays the game in the headset emulator
```

On desktop, open `/?emulate`. To skip the quest while testing, run this in the browser console and reload:

```js
localStorage.setItem('turkey-xr-progress-v1', JSON.stringify({ unlocked: ['wet-noodle'], equipped: 'wet-noodle' }))
```

To reset progress on the headset: `localStorage.removeItem('turkey-xr-progress-v1')`, or add `?reset` to the URL.
