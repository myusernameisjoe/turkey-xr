// Real-world tasks that unlock items.
//
// Before playing, tell the person in the task what the secret word is.
// They give it to the player once the task is done, and the player picks it on the Item Board.
// `decoys` are the wrong answers shown next to it.

export const QUESTS = [
  {
    id: 'grandpa-handshake',
    unlocks: 'wet-noodle',
    task: "Go shake Grandpa's hand. He knows the secret word.",
    word: 'gravy',
    decoys: ['stuffing', 'drumstick', 'cranberry'],
  },
];
