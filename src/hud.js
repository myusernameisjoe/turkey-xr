import * as THREE from 'three';

// Small text panel drawn on a canvas. Used on the left wrist in XR.
export function createTextPanel(widthM = 0.16, heightM = 0.06) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round(512 * (heightM / widthM));
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(widthM, heightM),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );

  function setText(main, sub = '') {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(20, 14, 8, 0.78)';
    const r = 36;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, r);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(canvas.height * (sub ? 0.42 : 0.55))}px system-ui, sans-serif`;
    ctx.fillText(main, canvas.width / 2, canvas.height * (sub ? 0.38 : 0.5));
    if (sub) {
      ctx.fillStyle = '#f4ecdc';
      ctx.font = `${Math.round(canvas.height * 0.24)}px system-ui, sans-serif`;
      ctx.fillText(sub, canvas.width / 2, canvas.height * 0.76);
    }
    texture.needsUpdate = true;
  }

  return { mesh, setText };
}
