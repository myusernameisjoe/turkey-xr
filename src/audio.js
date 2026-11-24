// Synthesised gobble: no audio files to load.

export async function renderGobbleBuffer(sampleRate = 44100) {
  const duration = 0.9;
  const ctx = new OfflineAudioContext(1, Math.ceil(sampleRate * duration), sampleRate);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(520, 0);
  osc.frequency.linearRampToValueAtTime(380, duration);

  // Fast warble is what makes it sound like "gobble-obble-obble".
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.setValueAtTime(16, 0);
  lfo.frequency.linearRampToValueAtTime(11, duration);
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 170;
  lfo.connect(lfoDepth).connect(osc.frequency);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value = 1.4;

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, 0);
  amp.gain.linearRampToValueAtTime(0.9, 0.04);
  amp.gain.setValueAtTime(0.9, duration * 0.6);
  amp.gain.linearRampToValueAtTime(0, duration);

  // Amplitude tremolo in sync with the warble.
  const trem = ctx.createGain();
  trem.gain.value = 0.6;
  const tremLfo = ctx.createOscillator();
  tremLfo.frequency.value = 16;
  const tremDepth = ctx.createGain();
  tremDepth.gain.value = 0.4;
  tremLfo.connect(tremDepth).connect(trem.gain);

  osc.connect(filter).connect(trem).connect(amp).connect(ctx.destination);
  osc.start(0);
  lfo.start(0);
  tremLfo.start(0);
  return ctx.startRendering();
}

export async function renderChimeBuffer(sampleRate = 44100) {
  const duration = 0.5;
  const ctx = new OfflineAudioContext(1, Math.ceil(sampleRate * duration), sampleRate);
  [660, 880, 1320].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    const t0 = i * 0.08;
    g.gain.setValueAtTime(0, 0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.4, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, duration);
    o.connect(g).connect(ctx.destination);
    o.start(0);
  });
  return ctx.startRendering();
}

// Wet "bonk" for the noodle.
export async function renderBonkBuffer(sampleRate = 44100) {
  const duration = 0.35;
  const ctx = new OfflineAudioContext(1, Math.ceil(sampleRate * duration), sampleRate);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(420, 0);
  o.frequency.exponentialRampToValueAtTime(90, 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.9, 0);
  g.gain.exponentialRampToValueAtTime(0.001, duration);
  o.connect(g).connect(ctx.destination);
  // A little splat of noise on top.
  const noise = ctx.createBuffer(1, Math.ceil(sampleRate * 0.12), sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  const ng = ctx.createGain();
  ng.gain.value = 0.5;
  src.connect(lp).connect(ng).connect(ctx.destination);
  o.start(0);
  src.start(0);
  return ctx.startRendering();
}
