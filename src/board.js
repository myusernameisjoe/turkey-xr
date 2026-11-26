import * as THREE from 'three';

// The Item Board: a floating panel showing which items you've unlocked (by catching turkeys) and equipping them.
// Point a controller at it and pull the trigger. Buttons are drawn on a canvas and hit-tested by UV.

const W = 1024;
const H = 768;
const PANEL_W = 0.8; // metres
const PANEL_H = PANEL_W * (H / W);

export function createBoard({ items, progress, onEquip }) {
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

  let buttons = [];

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

    title('Item Board');
    para(`Turkeys caught: ${progress.totalCatches}`, 100, 30, '#d8ccb6');
    items.forEach((item, i) => {
      const y = 160 + i * 120;
      const unlocked = progress.isUnlocked(item.id);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = unlocked ? '#ffd166' : '#a8957c';
      ctx.font = 'bold 42px system-ui, sans-serif';
      ctx.fillText(`${unlocked ? '' : '🔒 '}${item.name}`, 60, y);
      ctx.fillStyle = '#d8ccb6';
      ctx.font = '28px system-ui, sans-serif';
      const need = progress.required(item.id);
      const n = need ?? 0;
      ctx.fillText(unlocked ? item.blurb : `Catch ${n} turkey${n === 1 ? '' : 's'} to unlock (${progress.totalCatches}/${n})`, 60, y + 52);
      if (progress.equipped === item.id) button(`equip:${item.id}`, 'Equipped', 744, y, 220, 84, { disabled: true });
      else if (unlocked) button(`equip:${item.id}`, 'Equip', 744, y, 220, 84, { primary: true });
    });
    button('close', 'Back to the turkey', 262, H - 130, 500, 90, { primary: true });
    texture.needsUpdate = true;
  }

  const board = {
    mesh,
    get isOpen() {
      return mesh.visible;
    },
    get view() {
      return 'items';
    },
    open(headPos, headQuat) {
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
    /** Called every frame by the game loop. Nothing on the board animates right now. */
    tick() {},
    /** Redraw (e.g. after a catch changes the counts). */
    refresh() {
      if (mesh.visible) draw();
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
      if (id.startsWith('equip:')) {
        const itemId = id.slice(6);
        if (progress.equip(itemId)) onEquip(itemId);
      }
      draw();
    },
  };
  return board;
}
