const canvas = document.querySelector('#water');
const ctx = canvas.getContext('2d', { alpha: false });
const fish = document.querySelector('#fish');
const welcome = document.querySelector('#welcome');
const enterButton = document.querySelector('#enter-button');
const quietButton = document.querySelector('#quiet-button');
const stateLabel = document.querySelector('#state-label');
const counter = document.querySelector('#counter');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {
  width: 0,
  height: 0,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  started: false,
  startedAt: 0,
  lastFrame: 0,
  lastTouch: 0,
  pointer: { x: 0.54, y: 0.5, targetX: 0.54, targetY: 0.5 },
  tilt: { x: 0, y: 0 },
  ripples: [],
  motes: []
};

function resize() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = Math.round(state.width * state.dpr);
  canvas.height = Math.round(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  state.motes = Array.from({ length: Math.max(80, Math.min(180, Math.floor(state.width * state.height / 7200))) }, () => ({
    x: Math.random() * state.width,
    y: Math.random() * state.height,
    r: 0.3 + Math.random() * 1.1,
    phase: Math.random() * Math.PI * 2,
    speed: 0.25 + Math.random() * 0.75
  }));
}

function addRipple(x, y, power = 1) {
  const now = performance.now();
  state.ripples.push({ x, y, power, born: now, seed: Math.random() * 90 });
  if (state.ripples.length > 16) state.ripples.shift();
  state.lastTouch = now;
  stateLabel.textContent = 'WATER / LISTENING';
}

function calm() {
  const now = performance.now();
  state.ripples = state.ripples.slice(-2).map((ripple) => ({ ...ripple, born: now - 3200 }));
  state.lastTouch = 0;
  stateLabel.textContent = 'WATER / RESTING';
}

function drawBackground(time) {
  const x = state.pointer.x * state.width;
  const y = state.pointer.y * state.height;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(state.width, state.height) * 0.75);
  gradient.addColorStop(0, '#0b3270');
  gradient.addColorStop(0.44, '#082557');
  gradient.addColorStop(1, '#041229');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.strokeStyle = 'rgba(236, 207, 154, 0.055)';
  ctx.lineWidth = 1;
  const spacing = Math.max(46, Math.round(state.width / 16));
  const drift = Math.sin(time * 0.00018) * 8;
  for (let xLine = -spacing; xLine < state.width + spacing; xLine += spacing) {
    ctx.beginPath();
    ctx.moveTo(xLine + drift, 0);
    ctx.lineTo(xLine - drift, state.height);
    ctx.stroke();
  }
}

function drawWaterThreads(time) {
  ctx.lineWidth = 0.65;
  for (let line = 0; line < 12; line += 1) {
    const baseY = state.height * (0.18 + line * 0.065);
    ctx.beginPath();
    for (let x = -10; x <= state.width + 10; x += 9) {
      const pull = Math.exp(-Math.abs(x - state.pointer.x * state.width) / (state.width * 0.28));
      const y = baseY + Math.sin(x * 0.018 + time * 0.0004 + line) * (5 + pull * 7) + state.tilt.y * line * 0.6;
      if (x < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(183, 218, 223, ${0.035 + line * 0.003})`;
    ctx.stroke();
  }
}

function drawMotes(time, delta) {
  for (const mote of state.motes) {
    mote.x += (Math.sin(time * 0.00031 + mote.phase) + state.tilt.x) * mote.speed * delta * 0.018;
    mote.y += Math.cos(time * 0.00023 + mote.phase) * mote.speed * delta * 0.01;
    if (mote.x < -5) mote.x = state.width + 5;
    if (mote.x > state.width + 5) mote.x = -5;
    if (mote.y < -5) mote.y = state.height + 5;
    if (mote.y > state.height + 5) mote.y = -5;
    ctx.fillStyle = `rgba(245, 220, 166, ${0.08 + (Math.sin(time * 0.001 + mote.phase) + 1) * 0.05})`;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRipple(ripple, time) {
  const age = (time - ripple.born) / 1000;
  if (age > 6.8) return false;
  const spread = 1 - Math.exp(-age * 1.16);
  const radius = (16 + spread * Math.max(state.width, state.height) * 0.54) * ripple.power;
  const opacity = Math.pow(1 - age / 6.8, 1.75) * 0.34;
  const ringCount = prefersReducedMotion ? 2 : 4;

  for (let ring = 0; ring < ringCount; ring += 1) {
    const innerRadius = radius + ring * 24;
    ctx.beginPath();
    for (let point = 0; point <= 100; point += 1) {
      const angle = point / 100 * Math.PI * 2;
      const wobble = Math.sin(angle * 4 + ripple.seed + age * 2.3) * (2.6 + ring) + Math.cos(angle * 7 - age) * 1.8;
      const x = ripple.x + Math.cos(angle) * (innerRadius + wobble);
      const y = ripple.y + Math.sin(angle) * (innerRadius * 0.39 + wobble);
      if (point === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(245, 222, 174, ${opacity * (1 - ring * 0.16)})`;
    ctx.lineWidth = 1.15 - ring * 0.15;
    ctx.stroke();
  }
  return true;
}

function updateFish(time) {
  const idle = Math.sin(time * 0.00026);
  const x = (state.pointer.x - 0.54) * 24 + state.tilt.x * 9;
  const y = (state.pointer.y - 0.5) * 18 + state.tilt.y * 8 + idle * 3;
  const rotate = -17 + (state.pointer.x - 0.54) * 13 + state.tilt.x * 5;
  fish.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rotate}deg)`;
}

function frame(time) {
  const delta = Math.min(40, time - state.lastFrame || 16.7);
  state.lastFrame = time;
  state.pointer.x += (state.pointer.targetX - state.pointer.x) * 0.042;
  state.pointer.y += (state.pointer.targetY - state.pointer.y) * 0.042;
  drawBackground(time);
  drawWaterThreads(time);
  drawMotes(time, delta);
  state.ripples = state.ripples.filter((ripple) => drawRipple(ripple, time));
  updateFish(time);

  if (state.started) {
    const seconds = Math.floor((time - state.startedAt) / 1000);
    counter.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    if (state.lastTouch && time - state.lastTouch > 4200) {
      stateLabel.textContent = 'WATER / REMEMBERING';
    }
  }
  requestAnimationFrame(frame);
}

function begin() {
  if (state.started) return;
  state.started = true;
  state.startedAt = performance.now();
  welcome.classList.add('is-hidden');
  addRipple(state.width * 0.57, state.height * 0.53, 1.2);
  requestMotion();
}

function requestMotion() {
  if (typeof DeviceOrientationEvent === 'undefined') return;
  const attach = () => window.addEventListener('deviceorientation', (event) => {
    const targetX = Math.max(-1, Math.min(1, (event.gamma || 0) / 28));
    const targetY = Math.max(-1, Math.min(1, (event.beta || 0) / 42));
    state.tilt.x += (targetX - state.tilt.x) * 0.075;
    state.tilt.y += (targetY - state.tilt.y) * 0.075;
  }, true);
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then((permission) => {
      if (permission === 'granted') attach();
    }).catch(() => {});
  } else {
    attach();
  }
}

function movePointer(event) {
  state.pointer.targetX = Math.max(0, Math.min(1, event.clientX / state.width));
  state.pointer.targetY = Math.max(0, Math.min(1, event.clientY / state.height));
}

window.addEventListener('pointermove', movePointer, { passive: true });
window.addEventListener('pointerdown', (event) => {
  if (!state.started) return;
  movePointer(event);
  addRipple(event.clientX, event.clientY, event.pointerType === 'touch' ? 1 : 0.78);
}, { passive: true });
window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (!state.started || event.code !== 'Space') return;
  event.preventDefault();
  addRipple(state.width * 0.5, state.height * 0.52, 0.9);
});
enterButton.addEventListener('click', begin);
quietButton.addEventListener('click', calm);
window.addEventListener('load', () => window.setTimeout(begin, 350), { once: true });

resize();
ctx.fillStyle = '#061632';
ctx.fillRect(0, 0, state.width, state.height);
requestAnimationFrame(frame);
