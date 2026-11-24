// Loaded only with ?emulate. Installs Meta's IWER headset emulator so the game
// can be played and tested in a normal desktop browser.
import { XRDevice, metaQuest3 } from 'iwer';

export async function installEmulator() {
  const device = new XRDevice(metaQuest3);
  device.installRuntime({ forceInstall: true });
  if (!new URLSearchParams(location.search).has('nodevui')) {
    try {
      const { DevUI } = await import('@iwer/devui');
      device.installDevUI(DevUI);
    } catch (e) {
      console.warn('IWER DevUI failed to load', e);
    }
  }
  window.__xrDevice = device; // used by the automated tests
  return device;
}
