import * as THREE from 'three';

// The Item Board: a floating panel for equipping items and unlocking them with real-world quests.
// Point a controller at it and pull the trigger. Buttons are drawn on a canvas and hit-tested by UV.

const W = 1024;
const H = 768;
const PANEL_W = 0.8; // metres
const PANEL_H = PANEL_W * (H / W);

export function createBoard({ items, progress, onEquip, now = () => performance.now() }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_W, PANEL_H),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false }),
  );
  mesh.name = 'item-board';
  mesh.renderOrder = 999; // always on top, so the turkey or fence never cuts through it
  mesh.visible = false;

  let view = { name: 'items' };
  let buttons = [];
  let message = '';
  let lastLockoutShown = -1;

  function wrap(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function button(id, label, x, y, w, h, { primary = false, disabled = false } = {}) {
    buttons.push({ id, x, y, w, h, disabled });
    ctx.fillStyle = disabled ? '#6b5a48' : primary ? '#ffd166' : '#f4ecdc';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.fill();
    ctx.fillStyle = disabled ? '#cbb89c' : '#3b2412';
    ctx.font = `bold ${Math.round(h * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 2);
  }

  function title(text) {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(text, W / 2, 34);
  }

  function para(text, y, size = 38, color = '#f4ecdc') {
    ctx.fillStyle = color;
    ctx.font = `${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    wrap(text, W - 140).forEach((line, i) => ctx.fillText(line, W / 2, y + i * size * 1.3));
  }

  function draw() {
    buttons = [];
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(30, 20, 10, 0.92)';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 40);
    ctx.fill();

    if (view.name === 'items') {
      title('Item Board');
      items.forEach((item, i) => {
        const y = 130 + i * 120;
        const unlocked = progress.isUnlocked(item.id);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = unlocked ? '#ffd166' : '#a8957c';
        ctx.font = 'bold 42px system-ui, sans-serif';
        ctx.fillText(`${unlocked ? '' : '🔒 '}${item.name}`, 60, y);
        ctx.fillStyle = '#d8ccb6';
        ctx.font = '28px system-ui, sans-serif';
        ctx.fillText(unlocked ? item.blurb : 'Locked. Do a real-world task to unlock.', 60, y + 52);
        if (progress.equipped === item.id) button(`equip:${item.id}`, 'Equipped', 744, y, 220, 84, { disabled: true });
        else if (unlocked) button(`equip:${item.id}`, 'Equip', 744, y, 220, 84, { primary: true });
        else if (progress.questFor(item.id)) button(`quest:${item.id}`, 'Unlock', 744, y, 220, 84);
      });
      button('close', 'Back to the turkey', 262, H - 130, 500, 90, { primary: true });
    } else if (view.name === 'quest') {
      title(`Unlock: ${view.item.name}`);
      para('Real-world task:', 150, 34, '#d8ccb6');
      para(view.quest.task, 210, 48, '#ffffff');
      button('did-it', 'I did it! Enter the secret word', 162, H - 250, 700, 96, { primary: true });
      button('back', 'Back', 362, H - 130, 300, 84);
    } else if (view.name === 'word') {
      title("What's the secret word?");
      const remaining = progress.lockoutRemaining(now());
      lastLockoutShown = Math.ceil(remaining);
      if (remaining > 0) {
        para(`Nope! Go ask again. Try in ${Math.ceil(remaining)}s.`, 160, 42, '#ff9b85');
      } else if (message) {
        para(message, 160, 38, '#d8ccb6');
      }
      view.choices.forEach((word, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        button(`word:${word}`, word, 112 + col * 420, 260 + row * 140, 380, 110, { disabled: remaining > 0 });
      });
      button('back', 'Back', 362, H - 130, 300, 84);
    } else if (view.name === 'unlocked') {
      title('Unlocked!');
      para(`You got the ${view.item.name}.`, 170, 52, '#ffffff');
      para(view.item.blurb, 260, 36, '#d8ccb6');
      button(`equip:${view.item.id}`, 'Equip it', 262, H - 250, 500, 96, { primary: true });
      button('back-items', 'Back to items', 312, H - 130, 400, 84);
    }
    texture.needsUpdate = true;
  }

  const board = {
    mesh,
    get isOpen() {
      return mesh.visible;
    },
    get view() {
      return view.name;
    },
    open(headPos, headQuat) {
      view = { name: 'items' };
      message = '';
      draw();
      // 1.1 m in front of the player, at chest height, facing them.
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(headQuat);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
      fwd.normalize();
      mesh.position.copy(headPos).addScaledVector(fwd, 1.1);
      mesh.position.y = Math.max(1.0, headPos.y - 0.25);
      mesh.lookAt(headPos.x, mesh.position.y, headPos.z);
      mesh.visible = true;
    },
    close() {
      mesh.visible = false;
    },
    /** Called each frame so the lockout countdown ticks. */
    tick() {
      if (mesh.visible && view.name === 'word') {
        const r = Math.ceil(progress.lockoutRemaining(now()));
        if (r !== lastLockoutShown) draw();
      }
    },
    /** uv from a raycast hit on the panel. Returns the pressed button id or null. */
    selectUV(uv) {
      const x = uv.x * W;
      const y = (1 - uv.y) * H;
      const b = buttons.find((b) => !b.disabled && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      if (!b) return null;
      board.press(b.id);
      return b.id;
    },
    /** Press a button by id (used by the ray, and by tests). */
    press(id) {
      if (id === 'close') return board.close();
      if (id === 'back' || id === 'back-items') {
        view = view.name === 'word' ? { ...view, name: 'quest' } : { name: 'items' };
      } else if (id.startsWith('equip:')) {
        const itemId = id.slice(6);
        if (progress.equip(itemId)) onEquip(itemId);
        view = { name: 'items' };
      } else if (id.startsWith('quest:')) {
        const item = items.find((i) => i.id === id.slice(6));
        view = { name: 'quest', item, quest: progress.questFor(item.id) };
      } else if (id === 'did-it') {
        view = { ...view, name: 'word', choices: progress.choices(view.quest) };
        message = 'Pick the word they told you.';
      } else if (id.startsWith('word:')) {
        const result = progress.guess(view.quest, id.slice(5), now());
        if (result === 'unlocked') view = { name: 'unlocked', item: view.item };
      }
      draw();
    },
  };
  return board;
}
