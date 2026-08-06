/* ================================================================
   NEON SIEGE — 2D Top-down Survivor Shooter
   Thuần HTML/CSS/JS + Canvas, không dùng thư viện ngoài.
   ================================================================ */

'use strict';

/* ============================================================
   1. CANVAS & DOM REFERENCES
   ============================================================ */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const el = {
  hud: document.getElementById('hud'),
  healthBar: document.getElementById('healthBar'),
  healthText: document.getElementById('healthText'),
  scoreVal: document.getElementById('scoreVal'),
  killsVal: document.getElementById('killsVal'),
  waveVal: document.getElementById('waveVal'),
  timeVal: document.getElementById('timeVal'),
  fpsVal: document.getElementById('fpsVal'),
  dashBar: document.getElementById('dashBar'),
  waveIntermission: document.getElementById('waveIntermission'),
  waveIntermissionText: document.getElementById('waveIntermissionText'),
  bossHealthWrap: document.getElementById('bossHealthWrap'),
  bossBar: document.getElementById('bossBar'),
  hitFlash: document.getElementById('hitFlash'),
  crosshair: document.getElementById('crosshair'),
  mainMenu: document.getElementById('mainMenu'),
  settingsMenu: document.getElementById('settingsMenu'),
  gameOverScreen: document.getElementById('gameOverScreen'),
  finalScore: document.getElementById('finalScore'),
  finalKills: document.getElementById('finalKills'),
  finalWave: document.getElementById('finalWave'),
  finalTime: document.getElementById('finalTime'),
  btnStart: document.getElementById('btnStart'),
  btnSettings: document.getElementById('btnSettings'),
  btnBack: document.getElementById('btnBack'),
  btnRetry: document.getElementById('btnRetry'),
  btnMainMenu: document.getElementById('btnMainMenu'),
  sfxVolume: document.getElementById('sfxVolume'),
  musicVolume: document.getElementById('musicVolume'),
  sfxVolumeVal: document.getElementById('sfxVolumeVal'),
  musicVolumeVal: document.getElementById('musicVolumeVal'),
};

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* ============================================================
   2. AUDIO ENGINE (Web Audio API — không cần file âm thanh)
   ============================================================ */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.sfxVolume = 0.7;
    this.musicVolume = 0.35;
    this.musicStarted = false;
  }

  // Khởi tạo sau tương tác đầu tiên của người dùng (yêu cầu trình duyệt)
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.ctx.destination);

    // Tạo buffer noise dùng chung cho tiếng nổ / va chạm
    const bufferSize = this.ctx.sampleRate * 1;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setSfxVolume(v) { this.sfxVolume = v; if (this.sfxGain) this.sfxGain.gain.value = v; }
  setMusicVolume(v) { this.musicVolume = v; if (this.musicGain) this.musicGain.gain.value = v; }

  // Tiếng bắn: xung tần số cao giảm nhanh (kiểu laser/súng năng lượng)
  shoot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(950, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.09);
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  // Tiếng nổ: noise qua bộ lọc lowpass với envelope giảm dần
  explosion(big = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(big ? 1400 : 900, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + (big ? 0.5 : 0.28));
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(big ? 0.55 : 0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (big ? 0.55 : 0.3));
    src.connect(filter).connect(gain).connect(this.sfxGain);
    src.start(t);
    src.stop(t + (big ? 0.6 : 0.32));
  }

  // Tiếng người chơi bị trúng đòn: thump trầm
  hurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.18);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  // Tiếng dash
  dash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.15);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  // Nhạc nền ambient sinh tự động (2 sóng sine trầm + LFO nhẹ)
  startMusic() {
    if (!this.ctx || this.musicStarted) return;
    this.musicStarted = true;
    const t = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine'; osc1.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine'; osc2.frequency.value = 55 * 1.5;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 8;
    lfo.connect(lfoGain).connect(osc2.frequency);

    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.5;

    osc1.connect(padGain);
    osc2.connect(padGain);
    padGain.connect(this.musicGain);

    osc1.start(t); osc2.start(t); lfo.start(t);
    this._musicNodes = [osc1, osc2, lfo];
  }

  stopMusic() {
    if (!this.musicStarted) return;
    this._musicNodes && this._musicNodes.forEach(n => { try { n.stop(); } catch (e) {} });
    this.musicStarted = false;
  }
}
const audio = new AudioEngine();

/* ============================================================
   3. INPUT
   ============================================================ */
const keys = {};
const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, down: false };

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  el.crosshair.style.transform = `translate(${mouse.x}px, ${mouse.y}px)`;
});
window.addEventListener('mousedown', (e) => { if (e.button === 0) mouse.down = true; });
window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
window.addEventListener('contextmenu', (e) => e.preventDefault());

/* ============================================================
   4. UTILITIES
   ============================================================ */
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

/* ============================================================
   5. SCREEN SHAKE
   ============================================================ */
const shake = { magnitude: 0, decay: 0.9 };
function addShake(amount) { shake.magnitude = Math.min(shake.magnitude + amount, 28); }
function updateShake() {
  shake.magnitude *= shake.decay;
  if (shake.magnitude < 0.05) shake.magnitude = 0;
  return {
    x: (Math.random() * 2 - 1) * shake.magnitude,
    y: (Math.random() * 2 - 1) * shake.magnitude,
  };
}

/* ============================================================
   6. PARTICLES & EFFECTS
   ============================================================ */
class Particle {
  constructor(x, y, color, opts = {}) {
    this.x = x; this.y = y;
    const speed = opts.speed || rand(60, 260);
    const ang = opts.angle !== undefined ? opts.angle : rand(0, TAU);
    this.vx = Math.cos(ang) * speed;
    this.vy = Math.sin(ang) * speed;
    this.life = this.maxLife = opts.life || rand(0.35, 0.8);
    this.radius = opts.radius || rand(1.5, 4);
    this.color = color;
    this.gravity = opts.gravity || 0;
    this.friction = opts.friction || 0.92;
  }
  update(dt) {
    this.vx *= this.friction; this.vy *= this.friction;
    this.vy += this.gravity * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
  }
  draw(ctx) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * t, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

class Shockwave {
  constructor(x, y, color, maxRadius = 70) {
    this.x = x; this.y = y;
    this.radius = 4;
    this.maxRadius = maxRadius;
    this.life = this.maxLife = 0.4;
    this.color = color;
  }
  update(dt) {
    this.life -= dt;
    const t = 1 - clamp(this.life / this.maxLife, 0, 1);
    this.radius = lerp(4, this.maxRadius, 1 - Math.pow(1 - t, 3));
  }
  draw(ctx) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = t * 0.8;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

let particles = [];
let shockwaves = [];

function spawnExplosion(x, y, color, count = 22, big = false) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color, {
      speed: rand(big ? 120 : 60, big ? 420 : 260),
      life: rand(0.4, big ? 1.1 : 0.7),
      radius: rand(2, big ? 6 : 4),
      friction: 0.90,
    }));
  }
  shockwaves.push(new Shockwave(x, y, color, big ? 140 : 70));
  addShake(big ? 18 : 8);
  audio.explosion(big);
}

function spawnHitSpark(x, y, angle, color) {
  for (let i = 0; i < 6; i++) {
    particles.push(new Particle(x, y, color, {
      angle: angle + rand(-0.6, 0.6),
      speed: rand(80, 220),
      life: rand(0.15, 0.35),
      radius: rand(1, 2.5),
      friction: 0.88,
    }));
  }
}

/* ============================================================
   7. ENTITIES: PLAYER
   ============================================================ */
class Player {
  constructor() {
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this.radius = 18;
    this.speed = 300;
    this.hp = this.maxHp = 100;
    this.angle = 0;
    this.fireCooldown = 0;
    this.fireRate = 0.14; // giây giữa mỗi phát bắn

    // Dash
    this.dashSpeed = 900;
    this.dashDuration = 0.16;
    this.dashCooldownMax = 1.4;
    this.dashCooldown = 0;
    this.dashTimeLeft = 0;
    this.dashDirX = 0;
    this.dashDirY = 0;
    this.invulnTime = 0;

    this.trail = [];
    this.hurtFlashTime = 0;
    this.muzzleFlash = 0;
  }

  get isDashing() { return this.dashTimeLeft > 0; }

  takeDamage(amount) {
    if (this.invulnTime > 0) return;
    this.hp -= amount;
    this.invulnTime = 0.5;
    this.hurtFlashTime = 0.15;
    el.hitFlash.classList.add('active');
    setTimeout(() => el.hitFlash.classList.remove('active'), 120);
    audio.hurt();
    addShake(10);
    if (this.hp <= 0) { this.hp = 0; endGame(); }
  }

  heal(amount) { this.hp = clamp(this.hp + amount, 0, this.maxHp); }

  update(dt) {
    // --- Aim ---
    this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

    // --- Movement input ---
    let mx = 0, my = 0;
    if (keys['KeyW']) my -= 1;
    if (keys['KeyS']) my += 1;
    if (keys['KeyA']) mx -= 1;
    if (keys['KeyD']) mx += 1;
    const moving = mx !== 0 || my !== 0;
    if (moving) { const len = Math.hypot(mx, my); mx /= len; my /= len; }

    // --- Dash trigger ---
    if ((keys['ShiftLeft'] || keys['ShiftRight']) && this.dashCooldown <= 0 && !this.isDashing) {
      this.dashTimeLeft = this.dashDuration;
      this.dashCooldown = this.dashCooldownMax;
      this.dashDirX = moving ? mx : Math.cos(this.angle);
      this.dashDirY = moving ? my : Math.sin(this.angle);
      this.invulnTime = Math.max(this.invulnTime, this.dashDuration + 0.05);
      addShake(6);
      audio.dash();
    }

    if (this.dashCooldown > 0) this.dashCooldown -= dt;

    if (this.isDashing) {
      this.x += this.dashDirX * this.dashSpeed * dt;
      this.y += this.dashDirY * this.dashSpeed * dt;
      this.dashTimeLeft -= dt;
      // Hiệu ứng vệt sáng khi dash
      this.trail.push({ x: this.x, y: this.y, life: 0.25 });
    } else if (moving) {
      this.x += mx * this.speed * dt;
      this.y += my * this.speed * dt;
    }

    // Giới hạn trong khung hình (arena)
    this.x = clamp(this.x, this.radius, canvas.width - this.radius);
    this.y = clamp(this.y, this.radius, canvas.height - this.radius);

    // Cập nhật vệt dash mờ dần
    this.trail.forEach(t => t.life -= dt);
    this.trail = this.trail.filter(t => t.life > 0);

    if (this.invulnTime > 0) this.invulnTime -= dt;
    if (this.hurtFlashTime > 0) this.hurtFlashTime -= dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.muzzleFlash > 0) this.muzzleFlash -= dt;

    // --- Bắn ---
    if (mouse.down && this.fireCooldown <= 0) {
      this.shoot();
      this.fireCooldown = this.fireRate;
    }

    // --- Cập nhật UI ---
    el.healthBar.style.width = `${(this.hp / this.maxHp) * 100}%`;
    el.healthText.textContent = `${Math.ceil(this.hp)} / ${this.maxHp}`;
    if (this.hp / this.maxHp < 0.3) {
      el.healthBar.style.background = 'linear-gradient(90deg,#ff0033,#ff5500)';
    } else {
      el.healthBar.style.background = '';
    }
    const dashPct = this.dashCooldown <= 0 ? 100 : (1 - this.dashCooldown / this.dashCooldownMax) * 100;
    el.dashBar.style.width = `${dashPct}%`;
  }

  shoot() {
    const barrelLen = this.radius + 14;
    const bx = this.x + Math.cos(this.angle) * barrelLen;
    const by = this.y + Math.sin(this.angle) * barrelLen;
    // Bắn 1 viên chính + spread nhẹ cho cảm giác súng máy
    const spread = rand(-0.03, 0.03);
    bullets.push(new Bullet(bx, by, this.angle + spread, 'player'));
    this.muzzleFlash = 0.06;
    addShake(2.2);
    audio.shoot();
  }

  draw(ctx) {
    // Vệt dash
    this.trail.forEach(t => {
      ctx.save();
      ctx.globalAlpha = clamp(t.life / 0.25, 0, 1) * 0.35;
      ctx.fillStyle = '#08f7fe';
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.radius * 0.8, 0, TAU);
      ctx.fill();
      ctx.restore();
    });

    ctx.save();
    ctx.translate(this.x, this.y);

    // Nhấp nháy khi bất tử tạm thời (sau khi trúng đòn / đang dash)
    if (this.invulnTime > 0 && Math.floor(performance.now() / 60) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Bóng đổ dưới chân
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.7, this.radius * 0.9, this.radius * 0.35, 0, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.restore();

    // Vòng hào quang
    const glowColor = this.hurtFlashTime > 0 ? '#ff3860' : '#08f7fe';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 22;

    // Thân
    ctx.beginPath();
    ctx.fillStyle = '#161327';
    ctx.arc(0, 0, this.radius, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = glowColor;
    ctx.stroke();

    // Lõi phát sáng
    ctx.beginPath();
    ctx.fillStyle = glowColor;
    ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.85;
    ctx.arc(0, 0, this.radius * 0.45, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Nòng súng hướng theo chuột
    ctx.rotate(this.angle);
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#e8e8f5';
    ctx.fillRect(this.radius * 0.3, -4, this.radius + 16, 8);

    // Chớp lửa đầu nòng
    if (this.muzzleFlash > 0) {
      ctx.save();
      ctx.translate(this.radius + 30, 0);
      ctx.fillStyle = '#fff6c8';
      ctx.shadowColor = '#ffdd66';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}

/* ============================================================
   8. ENTITIES: BULLET
   ============================================================ */
class Bullet {
  constructor(x, y, angle, owner) {
    this.x = x; this.y = y;
    this.owner = owner; // 'player' | 'enemy'
    const speed = owner === 'player' ? 900 : 420;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = owner === 'player' ? 4 : 6;
    this.damage = owner === 'player' ? 10 : 14;
    this.color = owner === 'player' ? '#08f7fe' : '#ff2e63';
    this.trail = [];
    this.dead = false;
  }
  update(dt) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < -40 || this.x > canvas.width + 40 || this.y < -40 || this.y > canvas.height + 40) {
      this.dead = true;
    }
  }
  draw(ctx) {
    ctx.save();
    // Vệt sáng
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const t = i / this.trail.length;
      ctx.globalAlpha = t * 0.5;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.radius * t, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/* ============================================================
   9. ENTITIES: ENEMY
   ============================================================ */
const ENEMY_TYPES = {
  grunt:  { radius: 17, speed: 95,  hp: 30,  damage: 10, color: '#ff2e63', glow: 'rgba(255,46,99,0.85)',  score: 10 },
  runner: { radius: 11, speed: 185, hp: 14,  damage: 6,  color: '#f9ff21', glow: 'rgba(249,255,33,0.85)', score: 15 },
  brute:  { radius: 27, speed: 55,  hp: 95,  damage: 20, color: '#9d4edd', glow: 'rgba(157,78,221,0.85)', score: 25 },
  boss:   { radius: 52, speed: 42,  hp: 900, damage: 28, color: '#ff2e63', glow: 'rgba(255,46,99,0.9)',   score: 500 },
};

class Enemy {
  constructor(type, x, y, waveScale) {
    const cfg = ENEMY_TYPES[type];
    this.type = type;
    this.x = x; this.y = y;
    this.radius = cfg.radius;
    this.speed = cfg.speed * (1 + waveScale * 0.03);
    this.maxHp = this.hp = cfg.hp * (1 + waveScale * 0.16);
    this.damage = cfg.damage * (1 + waveScale * 0.05);
    this.color = cfg.color;
    this.glow = cfg.glow;
    this.scoreValue = cfg.score;
    this.hitCooldown = 0;
    this.hitFlash = 0;
    this.bobPhase = rand(0, TAU);
    this.dead = false;

    // Boss bắn đạn
    this.shootTimer = type === 'boss' ? rand(1, 2) : 0;
  }

  takeDamage(amount, hitAngle) {
    this.hp -= amount;
    this.hitFlash = 0.08;
    spawnHitSpark(this.x + Math.cos(hitAngle) * this.radius, this.y + Math.sin(hitAngle) * this.radius, hitAngle, this.color);
    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    const big = this.type === 'boss';
    spawnExplosion(this.x, this.y, this.color, big ? 60 : 26, big);
    score += this.scoreValue;
    kills += 1;
    el.scoreVal.textContent = score;
    el.killsVal.textContent = kills;
  }

  update(dt, player) {
    const ang = Math.atan2(player.y - this.y, player.x - this.x);

    // Boss giữ khoảng cách vừa phải & bắn đạn
    let targetDist = 0;
    if (this.type === 'boss') {
      targetDist = 260;
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = rand(0.9, 1.6);
        // Bắn 3 viên toả hình quạt về phía người chơi
        for (let i = -1; i <= 1; i++) {
          bullets.push(new Bullet(this.x, this.y, ang + i * 0.22, 'enemy'));
        }
        addShake(3);
      }
    }

    const d = dist(this.x, this.y, player.x, player.y);
    let moveX = Math.cos(ang), moveY = Math.sin(ang);

    if (this.type === 'boss' && d < targetDist) {
      // lùi lại nhẹ khi quá gần
      moveX *= -0.4; moveY *= -0.4;
    }

    // Lắc nhẹ theo phương vuông góc để né đơn điệu (mọi loại trừ brute)
    if (this.type !== 'brute') {
      this.bobPhase += dt * 4;
      const perp = ang + Math.PI / 2;
      const wobble = Math.sin(this.bobPhase) * 0.5;
      moveX += Math.cos(perp) * wobble;
      moveY += Math.sin(perp) * wobble;
    }

    // Tách nhẹ khỏi các quái khác gần đó (separation) để không chồng lấp
    let sepX = 0, sepY = 0;
    for (const other of enemies) {
      if (other === this || other.dead) continue;
      const dd = dist(this.x, this.y, other.x, other.y);
      const minDist = this.radius + other.radius + 6;
      if (dd > 0 && dd < minDist) {
        sepX += (this.x - other.x) / dd;
        sepY += (this.y - other.y) / dd;
      }
    }

    const len = Math.hypot(moveX, moveY) || 1;
    moveX /= len; moveY /= len;

    this.x += (moveX * this.speed + sepX * 60) * dt;
    this.y += (moveY * this.speed + sepY * 60) * dt;

    this.x = clamp(this.x, -60, canvas.width + 60);
    this.y = clamp(this.y, -60, canvas.height + 60);

    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // Va chạm gây sát thương cho người chơi
    if (dist(this.x, this.y, player.x, player.y) < this.radius + player.radius && this.hitCooldown <= 0) {
      player.takeDamage(this.damage);
      this.hitCooldown = 0.6;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Bóng đổ
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.65, this.radius * 0.9, this.radius * 0.32, 0, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();

    const flashColor = '#ffffff';
    ctx.shadowColor = this.glow;
    ctx.shadowBlur = this.type === 'boss' ? 30 : 16;

    ctx.beginPath();
    if (this.type === 'runner') {
      // Hình thoi cho quái nhanh
      ctx.moveTo(0, -this.radius); ctx.lineTo(this.radius, 0);
      ctx.lineTo(0, this.radius); ctx.lineTo(-this.radius, 0);
      ctx.closePath();
    } else if (this.type === 'brute') {
      // Hình vuông bo góc cho quái trâu bò
      const r = this.radius;
      ctx.rect(-r, -r, r * 2, r * 2);
    } else {
      ctx.arc(0, 0, this.radius, 0, TAU);
    }
    ctx.fillStyle = this.hitFlash > 0 ? flashColor : '#161327';
    ctx.fill();
    ctx.lineWidth = this.type === 'boss' ? 5 : 3;
    ctx.strokeStyle = this.hitFlash > 0 ? flashColor : this.color;
    ctx.stroke();

    // Lõi phát sáng
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.8;
    ctx.arc(0, 0, this.radius * 0.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();

    // Thanh máu nhỏ phía trên (trừ boss — có thanh riêng ở HUD)
    if (this.type !== 'boss' && this.hp < this.maxHp) {
      const w = this.radius * 2;
      ctx.save();
      ctx.translate(this.x - this.radius, this.y - this.radius - 12);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, w, 4);
      ctx.fillStyle = this.color;
      ctx.fillRect(0, 0, w * clamp(this.hp / this.maxHp, 0, 1), 4);
      ctx.restore();
    }
  }
}

let enemies = [];
let bullets = [];

/* ============================================================
   10. SPAWN / WAVE SYSTEM
   ============================================================ */
let wave = 1;
let spawnQueue = [];      // danh sách loại quái còn phải sinh ra trong wave hiện tại
let spawnTimer = 0;
let waveActive = false;
let score = 0, kills = 0;
let elapsedTime = 0;
let currentBoss = null;

function edgeSpawnPosition(radius) {
  const side = randInt(0, 3);
  const pad = radius + 10;
  if (side === 0) return { x: rand(0, canvas.width), y: -pad };
  if (side === 1) return { x: canvas.width + pad, y: rand(0, canvas.height) };
  if (side === 2) return { x: rand(0, canvas.width), y: canvas.height + pad };
  return { x: -pad, y: rand(0, canvas.height) };
}

function buildWaveQueue(n) {
  const queue = [];
  const isBossWave = n % 5 === 0;

  if (isBossWave) {
    queue.push('boss');
    const extra = Math.min(4 + Math.floor(n / 5), 10);
    for (let i = 0; i < extra; i++) queue.push(Math.random() < 0.5 ? 'grunt' : 'runner');
  } else {
    const total = 6 + n * 2;
    for (let i = 0; i < total; i++) {
      const r = Math.random();
      if (n >= 3 && r < 0.22) queue.push('brute');
      else if (r < 0.55) queue.push('grunt');
      else queue.push('runner');
    }
  }
  // Xáo trộn thứ tự
  for (let i = queue.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

function startWave(n) {
  wave = n;
  spawnQueue = buildWaveQueue(n);
  waveActive = true;
  spawnTimer = 0;
  el.waveVal.textContent = wave;

  el.waveIntermissionText.textContent = (n % 5 === 0) ? `⚠ BOSS WAVE ${n} ⚠` : `WAVE ${n} INCOMING`;
  el.waveIntermission.classList.remove('hidden');
  // Kích hoạt lại animation
  el.waveIntermission.style.animation = 'none';
  void el.waveIntermission.offsetWidth;
  el.waveIntermission.style.animation = '';
  setTimeout(() => el.waveIntermission.classList.add('hidden'), 1800);
}

function updateSpawning(dt) {
  if (!waveActive || spawnQueue.length === 0) return;
  spawnTimer -= dt;
  const interval = Math.max(0.9 - wave * 0.03, 0.22);
  if (spawnTimer <= 0) {
    spawnTimer = interval;
    const type = spawnQueue.shift();
    const cfg = ENEMY_TYPES[type];
    const pos = edgeSpawnPosition(cfg.radius);
    const en = new Enemy(type, pos.x, pos.y, wave);
    enemies.push(en);
    if (type === 'boss') currentBoss = en;
  }
}

function checkWaveComplete() {
  if (!waveActive) return;
  if (spawnQueue.length === 0 && enemies.length === 0) {
    waveActive = false;
    // Hồi máu nhẹ khi qua wave
    player.heal(20);
    currentBoss = null;
    setTimeout(() => startWave(wave + 1), 1400);
  }
}

/* ============================================================
   11. BACKGROUND (lưới neon + vệt sáng chuyển động)
   ============================================================ */
let bgTime = 0;
function drawBackground(dt) {
  bgTime += dt;

  // Nền gradient tối
  const g = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 0,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75
  );
  g.addColorStop(0, '#14101f');
  g.addColorStop(1, '#07060c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Lưới toạ độ kiểu "sàn công nghệ"
  const gridSize = 60;
  const offset = (bgTime * 14) % gridSize;
  ctx.save();
  ctx.strokeStyle = 'rgba(120,110,200,0.08)';
  ctx.lineWidth = 1;
  for (let x = -gridSize; x < canvas.width + gridSize; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x + offset, 0);
    ctx.lineTo(x + offset, canvas.height);
    ctx.stroke();
  }
  for (let y = -gridSize; y < canvas.height + gridSize; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y + offset);
    ctx.lineTo(canvas.width, y + offset);
    ctx.stroke();
  }
  ctx.restore();

  // Vài "hạt bụi" neon trôi nổi cho chiều sâu
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const px = (i * 137.5 + bgTime * 8) % canvas.width;
    const py = (i * 91.3 + Math.sin(bgTime * 0.5 + i) * 40) % canvas.height;
    ctx.globalAlpha = 0.15 + 0.1 * Math.sin(bgTime + i);
    ctx.fillStyle = i % 2 === 0 ? '#08f7fe' : '#ff2e63';
    ctx.beginPath();
    ctx.arc(px, py, 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ============================================================
   12. GAME STATE / LOOP
   ============================================================ */
let gameStateName = 'menu'; // 'menu' | 'settings' | 'playing' | 'gameover'
let player = new Player();
let lastTimestamp = 0;
let fpsFrames = 0, fpsTimer = 0, fpsDisplay = 60;

function resetGame() {
  player = new Player();
  bullets = []; enemies = []; particles = []; shockwaves = [];
  score = 0; kills = 0; wave = 0; elapsedTime = 0; currentBoss = null;
  el.scoreVal.textContent = 0;
  el.killsVal.textContent = 0;
  el.timeVal.textContent = '00:00';
  el.bossHealthWrap.classList.add('hidden');
}

function startGame() {
  audio.init();
  audio.resume();
  audio.startMusic();
  resetGame();
  gameStateName = 'playing';
  el.mainMenu.classList.add('hidden');
  el.settingsMenu.classList.add('hidden');
  el.gameOverScreen.classList.add('hidden');
  el.hud.classList.remove('hidden');
  el.crosshair.classList.remove('hidden');
  startWave(1);
}

function endGame() {
  gameStateName = 'gameover';
  el.finalScore.textContent = score;
  el.finalKills.textContent = kills;
  el.finalWave.textContent = wave;
  el.finalTime.textContent = formatTime(elapsedTime);
  el.hud.classList.add('hidden');
  el.crosshair.classList.add('hidden');
  el.gameOverScreen.classList.remove('hidden');
  spawnExplosion(player.x, player.y, '#08f7fe', 40, true);
}

function formatTime(t) {
  const m = Math.floor(t / 60).toString().padStart(2, '0');
  const s = Math.floor(t % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function bulletHitsCircle(b, x, y, r) {
  return dist(b.x, b.y, x, y) < r + b.radius;
}

function update(dt) {
  elapsedTime += dt;
  el.timeVal.textContent = formatTime(elapsedTime);

  player.update(dt);

  // --- Bullets ---
  for (const b of bullets) b.update(dt);

  // Va chạm đạn người chơi -> quái
  for (const b of bullets) {
    if (b.dead || b.owner !== 'player') continue;
    for (const en of enemies) {
      if (en.dead) continue;
      if (bulletHitsCircle(b, en.x, en.y, en.radius)) {
        const hitAngle = Math.atan2(b.y - en.y, b.x - en.x);
        en.takeDamage(b.damage, hitAngle);
        b.dead = true;
        break;
      }
    }
  }
  // Va chạm đạn quái -> người chơi
  for (const b of bullets) {
    if (b.dead || b.owner !== 'enemy') continue;
    if (bulletHitsCircle(b, player.x, player.y, player.radius) && player.invulnTime <= 0) {
      player.takeDamage(b.damage);
      b.dead = true;
    }
  }
  bullets = bullets.filter(b => !b.dead);

  // --- Enemies ---
  for (const en of enemies) en.update(dt, player);
  enemies = enemies.filter(en => !en.dead);

  // --- Boss HUD ---
  if (currentBoss && !currentBoss.dead) {
    el.bossHealthWrap.classList.remove('hidden');
    el.bossBar.style.width = `${clamp(currentBoss.hp / currentBoss.maxHp, 0, 1) * 100}%`;
  } else {
    el.bossHealthWrap.classList.add('hidden');
  }

  // --- Particles / Shockwaves ---
  for (const p of particles) p.update(dt);
  particles = particles.filter(p => p.life > 0);
  for (const s of shockwaves) s.update(dt);
  shockwaves = shockwaves.filter(s => s.life > 0);

  // --- Spawning & Wave progression ---
  updateSpawning(dt);
  checkWaveComplete();
}

function render() {
  ctx.save();
  const off = updateShake();
  ctx.translate(off.x, off.y);

  drawBackground(1 / 60);

  for (const s of shockwaves) s.draw(ctx);
  for (const p of particles) p.draw(ctx);
  for (const en of enemies) en.draw(ctx);
  for (const b of bullets) b.draw(ctx);
  player.draw(ctx);

  ctx.restore();
}

function loop(timestamp) {
  requestAnimationFrame(loop);
  if (!lastTimestamp) lastTimestamp = timestamp;
  let dt = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  dt = Math.min(dt, 0.05); // tránh bước nhảy lớn khi tab mất focus

  // FPS counter
  fpsFrames++; fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fpsDisplay = Math.round(fpsFrames / fpsTimer);
    el.fpsVal.textContent = fpsDisplay;
    fpsFrames = 0; fpsTimer = 0;
  }

  if (gameStateName === 'playing') {
    update(dt);
    render();
  } else if (gameStateName === 'menu' || gameStateName === 'settings' || gameStateName === 'gameover') {
    // Vẫn vẽ nền động phía sau menu cho sống động
    ctx.save();
    drawBackground(dt);
    for (const p of particles) { p.update(dt); p.draw(ctx); }
    particles = particles.filter(p => p.life > 0);
    for (const s of shockwaves) { s.update(dt); s.draw(ctx); }
    shockwaves = shockwaves.filter(s => s.life > 0);
    ctx.restore();
  }
}
requestAnimationFrame(loop);

/* ============================================================
   13. UI BINDINGS
   ============================================================ */
el.btnStart.addEventListener('click', startGame);

el.btnSettings.addEventListener('click', () => {
  audio.init();
  el.mainMenu.classList.add('hidden');
  el.settingsMenu.classList.remove('hidden');
  gameStateName = 'settings';
});

el.btnBack.addEventListener('click', () => {
  el.settingsMenu.classList.add('hidden');
  el.mainMenu.classList.remove('hidden');
  gameStateName = 'menu';
});

el.btnRetry.addEventListener('click', startGame);

el.btnMainMenu.addEventListener('click', () => {
  el.gameOverScreen.classList.add('hidden');
  el.mainMenu.classList.remove('hidden');
  gameStateName = 'menu';
});

el.sfxVolume.addEventListener('input', (e) => {
  const v = e.target.value / 100;
  audio.init();
  audio.setSfxVolume(v);
  el.sfxVolumeVal.textContent = `${e.target.value}%`;
});
el.musicVolume.addEventListener('input', (e) => {
  const v = e.target.value / 100;
  audio.init();
  audio.setMusicVolume(v);
  el.musicVolumeVal.textContent = `${e.target.value}%`;
});

// Đảm bảo AudioContext được resume ở tương tác đầu tiên (yêu cầu của trình duyệt)
window.addEventListener('pointerdown', () => { audio.init(); audio.resume(); }, { once: true });
