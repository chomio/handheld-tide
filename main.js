const canvas = document.querySelector('#tide');
const context = canvas.getContext('2d', { alpha: false });
const opening = document.querySelector('#opening');
const enterButton = document.querySelector('#enter-button');
const resetButton = document.querySelector('#reset-button');
const soundButton = document.querySelector('#sound-button');
const statusText = document.querySelector('#status-text');
const statusDot = document.querySelector('.status-dot');
const clock = document.querySelector('#clock');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {
  width: 0,
  height: 0,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  started: false,
  lastTime: 0,
  startTime: 0,
  lastInteraction: 0,
  pointer: { x: 0.5, y: 0.54, active: false },
  drift: { x: 0, y: 0 },
  waves: [],
  motes: [],
  audio: { context: null, master: null, oscillator: null, enabled: false }
};

function resize() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = Math.round(state.width * state.dpr);
  canvas.height = Math.round(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  createMotes();
}

function createMotes() {
  const amount = Math.min(210, Math.max(105, Math.round((state.width * state.height) / 6200)));
  state.motes = Array.from({ length: amount }, () => ({
    x: Math.random() * state.width,
    y: Math.random() * state.height,
    z: 0.25 + Math.random() * 0.9,
    phase: Math.random() * Math.PI * 2,
    hue: 184 + Math.random() * 34
  }));
}

function addWave(x, y, intensity = 1) {
  const now = performance.now();
  const normalizedX = Math.max(0, Math.min(1, x / state.width));
  const normalizedY = Math.max(0, Math.min(1, y / state.height));
  state.pointer = { x: normalizedX, y: normalizedY, active: true };
  state.lastInteraction = now;
  state.waves.push({ x, y, born: now, intensity, seed: Math.random() * 100 });
  if (state.waves.length > 22) state.waves.shift();
  emitTone(intensity);
}

function calm() {
  state.waves = state.waves.slice(-2).map((wave) => ({ ...wave, born: performance.now() - 2500 }));
  state.lastInteraction = 0;
  statusText.textContent = '고요를 회복하는 중';
  statusDot.classList.remove('active');
}

function drawBackground(time) {
  const px = state.pointer.x * state.width + state.drift.x * state.width * 0.18;
  const py = state.pointer.y * state.height + state.drift.y * state.height * 0.18;
  const breathing = 0.07 + Math.sin(time * 0.00023) * 0.025;
  const gradient = context.createRadialGradient(px, py, 0, px, py, Math.max(state.width, state.height) * 0.85);
  gradient.addColorStop(0, `rgba(19, 65, 94, ${breathing})`);
  gradient.addColorStop(0.38, 'rgba(5, 25, 45, 0.09)');
  gradient.addColorStop(1, 'rgba(1, 5, 14, 0.16)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, state.width, state.height);
}

function drawMotes(time, delta) {
  for (const mote of state.motes) {
    const stream = Math.sin(time * 0.0003 + mote.phase + mote.y * 0.007) * 0.2;
    mote.x += (stream + state.drift.x * 0.42) * mote.z * delta * 0.025;
    mote.y += (Math.cos(time * 0.00021 + mote.phase + mote.x * 0.004) * 0.15 + state.drift.y * 0.28) * mote.z * delta * 0.025;
    if (mote.x < -8) mote.x = state.width + 8;
    if (mote.x > state.width + 8) mote.x = -8;
    if (mote.y < -8) mote.y = state.height + 8;
    if (mote.y > state.height + 8) mote.y = -8;
    const shimmer = 0.09 + (Math.sin(time * 0.0011 + mote.phase) + 1) * 0.055;
    context.fillStyle = `hsla(${mote.hue}, 90%, 78%, ${shimmer})`;
    context.beginPath();
    context.arc(mote.x, mote.y, mote.z * 0.7, 0, Math.PI * 2);
    context.fill();
  }
}

function drawWave(wave, time) {
  const age = (time - wave.born) / 1000;
  if (age < 0 || age > 8.5) return false;
  const progress = 1 - Math.exp(-age * 1.35);
  const maxRadius = Math.hypot(state.width, state.height) * 0.44;
  const radius = 4 + progress * maxRadius * wave.intensity;
  const alpha = Math.max(0, (1 - age / 8.5) ** 1.75) * 0.35 * wave.intensity;
  const rings = reducedMotion ? 2 : 4;

  for (let ring = 0; ring < rings; ring += 1) {
    const offset = ring * 24 + Math.sin(age * 2 + wave.seed + ring) * 5;
    context.beginPath();
    const wobble = 1.5 + ring * 0.65;
    for (let step = 0; step <= 90; step += 1) {
      const angle = (step / 90) * Math.PI * 2;
      const noise = Math.sin(angle * 3 + wave.seed + age * 1.8) * wobble + Math.sin(angle * 7 - age) * wobble * 0.45;
      const x = wave.x + Math.cos(angle) * (radius + offset + noise);
      const y = wave.y + Math.sin(angle) * (radius + offset + noise) * 0.46;
      if (step === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.strokeStyle = `hsla(${190 + ring * 8}, 95%, 79%, ${alpha * (1 - ring / (rings + 1))})`;
    context.lineWidth = Math.max(0.35, 1.15 - age * 0.08 - ring * 0.12);
    context.stroke();
  }

  const glow = context.createRadialGradient(wave.x, wave.y, 0, wave.x, wave.y, radius * 0.72);
  glow.addColorStop(0, `hsla(194, 90%, 74%, ${alpha * 0.19})`);
  glow.addColorStop(1, 'rgba(25, 120, 180, 0)');
  context.fillStyle = glow;
  context.fillRect(wave.x - radius, wave.y - radius, radius * 2, radius * 2);
  return true;
}

function draw(time) {
  const delta = Math.min(40, time - state.lastTime || 16.7);
  state.lastTime = time;
  context.fillStyle = 'rgba(2, 7, 17, 0.06)';
  context.fillRect(0, 0, state.width, state.height);
  drawBackground(time);
  drawMotes(time, delta);
  state.waves = state.waves.filter((wave) => drawWave(wave, time));

  if (state.started) {
    const elapsed = Math.floor((time - state.startTime) / 1000);
    clock.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    const quietFor = time - state.lastInteraction;
    if (quietFor > 5200 && state.lastInteraction !== 0) {
      statusText.textContent = '고요를 듣는 중';
      statusDot.classList.remove('active');
      state.pointer.active = false;
    }
  }
  requestAnimationFrame(draw);
}

function initializeAudio() {
  if (state.audio.context) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const audioContext = new AudioContext();
  const master = audioContext.createGain();
  const oscillator = audioContext.createOscillator();
  const lfo = audioContext.createOscillator();
  const lfoGain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 53;
  lfo.frequency.value = 0.045;
  lfoGain.gain.value = 3.4;
  master.gain.value = 0;
  lfo.connect(lfoGain).connect(oscillator.frequency);
  oscillator.connect(master).connect(audioContext.destination);
  oscillator.start();
  lfo.start();
  state.audio = { context: audioContext, master, oscillator, enabled: false };
}

function toggleSound() {
  initializeAudio();
  if (!state.audio.context) return;
  state.audio.enabled = !state.audio.enabled;
  state.audio.context.resume();
  state.audio.master.gain.cancelScheduledValues(state.audio.context.currentTime);
  state.audio.master.gain.linearRampToValueAtTime(state.audio.enabled ? 0.043 : 0, state.audio.context.currentTime + 0.6);
  soundButton.setAttribute('aria-pressed', String(state.audio.enabled));
  soundButton.setAttribute('aria-label', state.audio.enabled ? '소리 끄기' : '소리 켜기');
  statusText.textContent = state.audio.enabled ? '파동을 듣는 중' : '고요를 듣는 중';
}

function emitTone(intensity) {
  if (!state.audio.enabled) return;
  const audio = state.audio;
  const now = audio.context.currentTime;
  const gain = audio.context.createGain();
  const oscillator = audio.context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(200 + intensity * 90, now);
  oscillator.frequency.exponentialRampToValueAtTime(95, now + 1.4);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.025 * intensity, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
  oscillator.connect(gain).connect(audio.master);
  oscillator.start(now);
  oscillator.stop(now + 1.55);
}

function start() {
  if (state.started) return;
  state.started = true;
  state.startTime = performance.now();
  state.lastInteraction = state.startTime;
  opening.classList.add('is-gone');
  addWave(state.width / 2, state.height / 2, 1.15);
  statusText.textContent = '파동을 기다리는 중';
  statusDot.classList.add('active');
  requestMotionPermission();
}

function requestMotionPermission() {
  if (typeof DeviceOrientationEvent === 'undefined') return;
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then((result) => {
        if (result === 'granted') window.addEventListener('deviceorientation', onOrientation, true);
      })
      .catch(() => {});
  } else {
    window.addEventListener('deviceorientation', onOrientation, true);
  }
}

function onOrientation(event) {
  if (!state.started || event.gamma === null) return;
  state.drift.x += ((event.gamma || 0) / 35 - state.drift.x) * 0.06;
  state.drift.y += ((event.beta || 0) / 45 - state.drift.y) * 0.06;
}

let lastPointerWave = 0;
function handlePointer(event) {
  if (!state.started) return;
  const now = performance.now();
  if (event.type === 'pointermove' && now - lastPointerWave < 75) return;
  lastPointerWave = now;
  const intensity = event.pointerType === 'touch' ? 0.88 : 0.56;
  addWave(event.clientX, event.clientY, intensity);
  statusText.textContent = '당신의 흔적이 번지는 중';
  statusDot.classList.add('active');
}

enterButton.addEventListener('click', start);
canvas.addEventListener('pointerdown', handlePointer);
canvas.addEventListener('pointermove', handlePointer);
resetButton.addEventListener('click', calm);
soundButton.addEventListener('click', toggleSound);
window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && state.started) {
    event.preventDefault();
    addWave(state.width / 2, state.height / 2, 0.9);
  }
  if (event.key.toLowerCase() === 's') toggleSound();
});

resize();
context.fillStyle = '#020711';
context.fillRect(0, 0, state.width, state.height);
requestAnimationFrame(draw);
