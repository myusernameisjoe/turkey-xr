// Item registry. Order = the unlock ladder, from lame to awesome.
//
// Every item has:
//   id, name, blurb       - shown on the Item Board
//   type                  - 'touch' | 'swing' | 'launch' | 'spray'  (only touch + swing exist so far)
//   create(scene)         - optional; returns { update(dt, grip), hits(target), dispose() }
//
// To add an item, see docs/ADDING-ITEMS.md.

import { wetNoodle } from './wetNoodle.js';

export const bareHands = {
  id: 'hands',
  name: 'Bare Hands',
  type: 'touch',
  blurb: 'Tag the turkey with your hand.',
  create: null,
};

export const ITEMS = [bareHands, wetNoodle];

export function getItem(id) {
  return ITEMS.find((i) => i.id === id) || bareHands;
}
