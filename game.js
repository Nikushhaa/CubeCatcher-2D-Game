// -----------------------------------------------------------
// Constants
// -----------------------------------------------------------
const ENEMY_TYPES = {
  scout: { health: 1, minSpeed: 120, maxSpeed: 180, color: "#dc3c3c", size: 28, score: 10, pattern: "straight" },
  zigzag: { health: 2, minSpeed: 90, maxSpeed: 140, color: "#3c6edc", size: 32, score: 20, pattern: "zigzag" },
  tank: { health: 5, minSpeed: 50, maxSpeed: 80, color: "#aa46c8", size: 46, score: 40, pattern: "straight" }
};

const POWERUP_TYPES = {
  fireRate: { color: "#e6d23c", label: "F", duration: 8 },
  tripleShot: { color: "#3cdcdc", label: "T", duration: 8 },
  shield: { color: "#3c6edc", label: "S", duration: 10 },
  extraLife: { color: "#3cc864", label: "+", duration: 0 },
  bigBullets: { color: "#e69c3c", label: "B", duration: 8 }
};

// Selectable ship classes. Each one tweaks the base silhouette's size,
// handling and combat stats, plus its own hull/wing/stripe color scheme.
const SHIP_TYPES = {
  interceptor: {
    name: "Interceptor",
    tagline: "Balanced all-rounder. A safe first choice.",
    speed: 380,
    maxHealth: 100,
    baseFireDelay: 0.35,
    width: 48,
    height: 56,
    colors: { hull: "#c6d0e1", stripe: "#3cdcdc", wing: "#aab4c8" }
  },
  falcon: {
    name: "Falcon",
    tagline: "Fast and fragile. Outrun the danger instead of tanking it.",
    speed: 460,
    maxHealth: 70,
    baseFireDelay: 0.30,
    width: 42,
    height: 50,
    colors: { hull: "#e1d8c6", stripe: "#e69c3c", wing: "#c8ba9a" }
  },
  bulwark: {
    name: "Bulwark",
    tagline: "Slow and heavily armored. Built to soak up hits.",
    speed: 300,
    maxHealth: 140,
    baseFireDelay: 0.42,
    width: 56,
    height: 64,
    colors: { hull: "#c6e1d0", stripe: "#3cc864", wing: "#9ac8aa" }
  },
  vanguard: {
    name: "Vanguard",
    tagline: "Rapid-fire specialist. High output, paper-thin hull.",
    speed: 400,
    maxHealth: 60,
    baseFireDelay: 0.22,
    width: 44,
    height: 52,
    colors: { hull: "#d8c6e1", stripe: "#aa46c8", wing: "#b89ac8" }
  }
};

// An original ship silhouette made of a handful of polygons, defined as
// fractions of (width, height) with the nose pointing up (fy=0 is the top).
// Shared by every ship class; only size and color vary per class.
const SHIP_HULL_POINTS = [
  [0.50, 0.00], [0.62, 0.20], [0.72, 0.42], [0.60, 0.62],
  [0.62, 0.92], [0.50, 1.00], [0.38, 0.92], [0.40, 0.62],
  [0.28, 0.42], [0.38, 0.20]
];
const SHIP_STRIPE_POINTS = [
  [0.50, 0.06], [0.55, 0.40], [0.53, 0.88], [0.47, 0.88], [0.45, 0.40]
];
const SHIP_WING_LEFT_POINTS = [[0.30, 0.40], [0.00, 0.64], [0.30, 0.78], [0.40, 0.62]];
const SHIP_WING_RIGHT_POINTS = [[0.70, 0.40], [1.00, 0.64], [0.70, 0.78], [0.60, 0.62]];
const SHIP_COCKPIT_RECT = { fx: 0.40, fy: 0.14, fw: 0.20, fh: 0.22 };

// Colors that stay the same across every ship class.
const SHIP_COLORS = {
  hullOutline: "#5a6478",
  stripeShielded: "#ffffff",
  cockpit: "#32466e",
  cockpitGlow: "#78c8ff",
  navLeft: "#dc3c3c",
  navRight: "#3cc864",
  engineOuter: "#f0963c",
  engineInner: "#e6d23c",
  shieldRing: "#3cdcdc"
};

// -----------------------------------------------------------
// Small helpers
// -----------------------------------------------------------
function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getDayName() {
  const days = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday"
  ];
  return days[new Date().getDay()];
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// -----------------------------------------------------------
// Accounts (username + password, checked on every launch) and
// per-player profiles (stats + ship choice). Both live in
// localStorage, so they persist on this device/browser until the
// user clears their browsing data - there's no server involved.
// -----------------------------------------------------------
const ACCOUNTS_KEY = "spaceShooter_accounts";

function getAccounts() {
  const raw = localStorage.getItem(ACCOUNTS_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function randomSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(salt + ":" + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Verifies an existing account, or creates one on first sign-in.
// The account itself only ever stores a salted hash, never the password.
async function attemptLogin(username, password) {
  const accounts = getAccounts();
  const existing = accounts[username];

  if (existing) {
    const hash = await hashPassword(password, existing.salt);
    if (hash !== existing.passwordHash) {
      return { success: false, error: "Incorrect access code for that callsign." };
    }
    return { success: true };
  }

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  accounts[username] = { salt, passwordHash };
  saveAccounts(accounts);
  return { success: true, isNew: true };
}

function getProfileKey(username) {
  return "spaceShooter_profile_" + username;
}

function loadProfile(username) {
  const raw = localStorage.getItem(getProfileKey(username));
  if (raw) {
    const profile = JSON.parse(raw);
    if (!profile.selectedShip || !SHIP_TYPES[profile.selectedShip]) {
      profile.selectedShip = "interceptor";
    }
    return profile;
  }
  return {
    username: username,
    gamesPlayed: 0,
    bestScore: 0,
    totalScore: 0,
    daily: {},
    weekly: {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0,
      Friday: 0, Saturday: 0, Sunday: 0
    },
    selectedShip: "interceptor"
  };
}

function saveProfile(profile) {
  localStorage.setItem(getProfileKey(profile.username), JSON.stringify(profile));
}

function recordGameResult(profile, score) {
  const today = getToday();
  const day = getDayName();

  profile.gamesPlayed += 1;
  profile.totalScore += score;

  if (score > profile.bestScore) profile.bestScore = score;

  if (!profile.daily[today]) profile.daily[today] = 0;
  if (score > profile.daily[today]) profile.daily[today] = score;

  if (score > profile.weekly[day]) profile.weekly[day] = score;

  saveProfile(profile);
}

// -----------------------------------------------------------
// Background stars
// -----------------------------------------------------------
class Star {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.x = randomRange(0, canvasWidth);
    this.y = randomRange(0, canvasHeight);
    this.speed = randomRange(20, 80);
    this.size = Math.random() < 0.7 ? 1 : 2;
    this.brightness = Math.floor(randomRange(120, 255));
  }
  update(dt) {
    this.y += this.speed * dt;
    if (this.y > this.canvasHeight) {
      this.y = 0;
      this.x = randomRange(0, this.canvasWidth);
    }
  }
  draw(ctx) {
    ctx.fillStyle = `rgb(${this.brightness},${this.brightness},${this.brightness})`;
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}

// -----------------------------------------------------------
// Bullets
// -----------------------------------------------------------
class Bullet {
  constructor(x, y, vx = 0, big = false) {
    this.width = big ? 10 : 6;
    this.height = big ? 26 : 18;
    this.x = x - this.width / 2;
    this.y = y;
    this.vx = vx;
    this.vy = -520;
    this.big = big;
    this.color = big ? "#e69c3c" : "#3cdcdc";
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  getRect() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
  isOffscreen(canvasWidth) {
    return this.y + this.height < 0 || this.x < -20 || this.x > canvasWidth + 20;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

// -----------------------------------------------------------
// Player
// -----------------------------------------------------------
class Player {
  constructor(canvasWidth, canvasHeight, shipKey = "interceptor") {
    const ship = SHIP_TYPES[shipKey] || SHIP_TYPES.interceptor;
    this.shipKey = shipKey;
    this.colors = ship.colors;

    this.width = ship.width;
    this.height = ship.height;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.x = canvasWidth / 2 - this.width / 2;
    this.y = canvasHeight - this.height - 20;
    this.speed = ship.speed;

    this.maxHealth = ship.maxHealth;
    this.health = ship.maxHealth;
    this.lives = 3;

    this.baseFireDelay = ship.baseFireDelay;
    this.fireTimer = 0;

    this.fireRateTimer = 0;
    this.tripleShotTimer = 0;
    this.shieldTimer = 0;
    this.bigBulletsTimer = 0;

    this.engineTime = 0; // used to animate the pulsing engine glow
  }
  resize(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.y = canvasHeight - this.height - 20;
    this.x = clamp(this.x, 0, canvasWidth - this.width);
  }
  handleInput(dt, keys) {
    if (keys.left) this.x -= this.speed * dt;
    if (keys.right) this.x += this.speed * dt;
    this.x = clamp(this.x, 0, this.canvasWidth - this.width);
  }
  updateTimers(dt) {
    this.fireTimer -= dt;
    this.fireRateTimer = Math.max(0, this.fireRateTimer - dt);
    this.tripleShotTimer = Math.max(0, this.tripleShotTimer - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    this.bigBulletsTimer = Math.max(0, this.bigBulletsTimer - dt);
    this.engineTime += dt;
  }
  hasShield() {
    return this.shieldTimer > 0;
  }
  canShoot() {
    return this.fireTimer <= 0;
  }
  getFireDelay() {
    return this.fireRateTimer > 0 ? this.baseFireDelay * 0.4 : this.baseFireDelay;
  }
  shoot() {
    // Returns an array of new Bullet objects based on active power-ups
    this.fireTimer = this.getFireDelay();
    const cx = this.x + this.width / 2;
    const big = this.bigBulletsTimer > 0;

    if (this.tripleShotTimer > 0) {
      return [
        new Bullet(cx, this.y, -160, big),
        new Bullet(cx, this.y, 0, big),
        new Bullet(cx, this.y, 160, big)
      ];
    }
    return [new Bullet(cx, this.y, 0, big)];
  }
  takeDamage(amount) {
    // Returns true if the hit actually landed (no shield absorbed it)
    if (this.hasShield()) return false;
    this.health -= amount;
    return true;
  }
  applyPowerup(name) {
    const info = POWERUP_TYPES[name];
    if (name === "extraLife") {
      this.lives += 1;
    } else if (name === "shield") {
      this.shieldTimer = info.duration;
      this.health = Math.min(this.maxHealth, this.health + 20);
    } else {
      this[name + "Timer"] = info.duration;
    }
  }
  getRect() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
  toPx(fx, fy) {
    return { x: this.x + fx * this.width, y: this.y + fy * this.height };
  }

  drawPolygon(ctx, points, fillColor, strokeColor) {
    ctx.beginPath();
    points.forEach(([fx, fy], i) => {
      const p = this.toPx(fx, fy);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  draw(ctx) {
    this.drawEngineGlow(ctx);
    this.drawWings(ctx);
    this.drawHull(ctx);
    this.drawCockpit(ctx);
    this.drawNavLights(ctx);
    if (this.hasShield()) this.drawShieldRing(ctx);
  }

  drawEngineGlow(ctx) {
    // A pulsing thruster flame behind the ship, driven by engineTime
    const flicker = 0.6 + 0.4 * Math.abs(Math.sin(this.engineTime * 14));
    const center = this.toPx(0.5, 1.02);
    const outerR = Math.max(1, this.width * 0.22 * flicker);

    ctx.fillStyle = SHIP_COLORS.engineOuter;
    ctx.beginPath();
    ctx.arc(center.x, center.y, outerR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = SHIP_COLORS.engineInner;
    ctx.beginPath();
    ctx.arc(center.x, center.y, outerR * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWings(ctx) {
    this.drawPolygon(ctx, SHIP_WING_LEFT_POINTS, this.colors.wing, SHIP_COLORS.hullOutline);
    this.drawPolygon(ctx, SHIP_WING_RIGHT_POINTS, this.colors.wing, SHIP_COLORS.hullOutline);
  }

  drawHull(ctx) {
    this.drawPolygon(ctx, SHIP_HULL_POINTS, this.colors.hull, SHIP_COLORS.hullOutline);
    const stripeColor = this.hasShield() ? SHIP_COLORS.stripeShielded : this.colors.stripe;
    this.drawPolygon(ctx, SHIP_STRIPE_POINTS, stripeColor, null);
  }

  drawCockpit(ctx) {
    const { fx, fy, fw, fh } = SHIP_COCKPIT_RECT;
    const cx = this.x + (fx + fw / 2) * this.width;
    const cy = this.y + (fy + fh / 2) * this.height;
    const rx = (fw / 2) * this.width;
    const ry = (fh / 2) * this.height;

    ctx.fillStyle = SHIP_COLORS.cockpit;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = SHIP_COLORS.cockpitGlow;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawNavLights(ctx) {
    // Small red/green navigation lights, aviation-style, on the wingtips
    const left = this.toPx(0.30, 0.66);
    const right = this.toPx(0.70, 0.66);

    ctx.fillStyle = SHIP_COLORS.navLeft;
    ctx.beginPath();
    ctx.arc(left.x, left.y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = SHIP_COLORS.navRight;
    ctx.beginPath();
    ctx.arc(right.x, right.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawShieldRing(ctx) {
    const center = this.toPx(0.5, 0.55);
    ctx.strokeStyle = SHIP_COLORS.shieldRing;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, this.width * 0.9, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// -----------------------------------------------------------
// Enemies
// -----------------------------------------------------------
class Enemy {
  constructor(typeName, canvasWidth, difficulty) {
    const info = ENEMY_TYPES[typeName];
    this.typeName = typeName;
    this.size = info.size;
    this.color = info.color;
    this.scoreValue = info.score;
    this.pattern = info.pattern;

    this.health = info.health;
    this.maxHealth = info.health;

    this.speed = randomRange(info.minSpeed, info.maxSpeed) * difficulty;

    this.canvasWidth = canvasWidth;
    this.x = randomRange(0, canvasWidth - this.size);
    this.y = -this.size;

    this.zigzagDir = Math.random() < 0.5 ? -1 : 1;
    this.zigzagSpeed = randomRange(60, 120);
  }
  update(dt) {
    this.y += this.speed * dt;

    if (this.pattern === "zigzag") {
      this.x += this.zigzagDir * this.zigzagSpeed * dt;
      if (this.x <= 0 || this.x >= this.canvasWidth - this.size) {
        this.zigzagDir *= -1;
        this.x = clamp(this.x, 0, this.canvasWidth - this.size);
      }
    }
  }
  getRect() {
    return { x: this.x, y: this.y, width: this.size, height: this.size };
  }
  isOffscreen(canvasHeight) {
    return this.y > canvasHeight;
  }
  takeDamage(amount) {
    // Returns true if this hit destroyed the enemy
    this.health -= amount;
    return this.health <= 0;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);

    if (this.maxHealth > 1) {
      const ratio = Math.max(0, this.health / this.maxHealth);
      ctx.fillStyle = "#3c3c3c";
      ctx.fillRect(this.x, this.y - 8, this.size, 4);
      ctx.fillStyle = "#3cc864";
      ctx.fillRect(this.x, this.y - 8, this.size * ratio, 4);
    }
  }
}

// -----------------------------------------------------------
// Explosions
// -----------------------------------------------------------
class Explosion {
  constructor(x, y, color) {
    this.particles = [];
    const count = Math.floor(randomRange(10, 16));
    for (let i = 0; i < count; i++) {
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(60, 220);
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: randomRange(0.3, 0.6),
        color: color
      });
    }
  }
  update(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }
  isFinished() {
    return this.particles.length === 0;
  }
  draw(ctx) {
    for (const p of this.particles) {
      const size = Math.max(1, p.life * 6);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// -----------------------------------------------------------
// Power-ups
// -----------------------------------------------------------
class PowerUp {
  constructor(canvasWidth) {
    const keys = Object.keys(POWERUP_TYPES);
    this.typeName = keys[Math.floor(Math.random() * keys.length)];
    const info = POWERUP_TYPES[this.typeName];
    this.color = info.color;
    this.label = info.label;
    this.size = 26;
    this.x = randomRange(0, canvasWidth - this.size);
    this.y = -this.size;
    this.speed = 140;
  }
  update(dt) {
    this.y += this.speed * dt;
  }
  getRect() {
    return { x: this.x, y: this.y, width: this.size, height: this.size };
  }
  isOffscreen(canvasHeight) {
    return this.y > canvasHeight;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.fillStyle = "#141414";
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(this.label, this.x + this.size / 2, this.y + 4);
  }
}

// -----------------------------------------------------------
// Game (one play session; created and torn down by App)
// -----------------------------------------------------------
class Game {
  constructor(canvas, profile, onGameOver) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.profile = profile;
    this.onGameOver = onGameOver;

    this.width = canvas.width;
    this.height = canvas.height;

    this.player = new Player(this.width, this.height, profile.selectedShip);
    this.bullets = [];
    this.enemies = [];
    this.powerups = [];
    this.explosions = [];

    this.stars = [];
    for (let i = 0; i < 80; i++) {
      this.stars.push(new Star(this.width, this.height));
    }

    this.score = 0;
    this.highScore = this.profile.bestScore;

    this.elapsed = 0;
    this.spawnTimer = 0;

    this.shakeTimer = 0;
    this.shakeStrength = 0;

    this.keys = { left: false, right: false, shoot: false };
    this.running = true;
    this.lastTime = null;

    this._onKeyDown = this.handleKeyDown.bind(this);
    this._onKeyUp = this.handleKeyUp.bind(this);
    this._onResize = this.handleResize.bind(this);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("resize", this._onResize);

    requestAnimationFrame((t) => this.loop(t));
  }

  handleKeyDown(e) {
    if (e.key === "a" || e.key === "A") this.keys.left = true;
    if (e.key === "d" || e.key === "D") this.keys.right = true;
    if (e.key === " ") {
      this.keys.shoot = true;
      e.preventDefault();
    }
  }
  handleKeyUp(e) {
    if (e.key === "a" || e.key === "A") this.keys.left = false;
    if (e.key === "d" || e.key === "D") this.keys.right = false;
    if (e.key === " ") this.keys.shoot = false;
  }
  handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.player.resize(this.width, this.height);
  }

  // Removes all listeners this session attached to the window. Must be
  // called whenever a Game instance is discarded (game over, restart, or
  // returning to the menu) so the next session doesn't double up on input.
  destroy() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("resize", this._onResize);
    this.running = false;
  }

  // -- Difficulty & spawning -----------------------------
  difficultyMultiplier() {
    // Enemies get faster the longer the game runs, capped at 2.5x speed
    return 1 + Math.min(this.elapsed / 60, 1.5);
  }
  currentSpawnInterval() {
    // Enemies spawn more often over time, but never faster than every 0.45s
    return Math.max(0.45, 1.4 - this.elapsed * 0.01);
  }
  pickEnemyType() {
    const weights = { scout: 5, zigzag: 2, tank: 1 };
    if (this.elapsed > 20) weights.zigzag += 2;
    if (this.elapsed > 40) weights.tank += 2;

    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * total;
    for (const [name, w] of entries) {
      if (roll < w) return name;
      roll -= w;
    }
    return "scout";
  }
  spawnEnemy() {
    const typeName = this.pickEnemyType();
    this.enemies.push(new Enemy(typeName, this.width, this.difficultyMultiplier()));
  }
  maybeSpawnPowerup(x, y) {
    if (Math.random() < 0.15) {
      const p = new PowerUp(this.width);
      p.x = x;
      p.y = y;
      this.powerups.push(p);
    }
  }
  triggerShake(strength = 8, duration = 0.25) {
    this.shakeStrength = strength;
    this.shakeTimer = duration;
  }

  // -- Main loop --------------------------------------------
  loop(timestamp) {
    if (!this.running) return;
    if (this.lastTime === null) this.lastTime = timestamp;
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();

    if (this.running) requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.elapsed += dt;
    this.player.handleInput(dt, this.keys);
    this.player.updateTimers(dt);

    if (this.keys.shoot && this.player.canShoot()) {
      this.bullets.push(...this.player.shoot());
    }

    this.spawnTimer += dt;
    if (this.spawnTimer >= this.currentSpawnInterval()) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updatePowerups(dt);
    this.updateExplosions(dt);
    this.updateStars(dt);
    if (this.shakeTimer > 0) this.shakeTimer -= dt;

    this.checkCollisions();
    this.highScore = Math.max(this.highScore, this.score);
    this.checkPlayerDeath();
  }

  updateBullets(dt) {
    for (const b of this.bullets) b.update(dt);
    this.bullets = this.bullets.filter((b) => !b.isOffscreen(this.width));
  }
  updateEnemies(dt) {
    for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter((e) => !e.isOffscreen(this.height));
  }
  updatePowerups(dt) {
    for (const p of this.powerups) p.update(dt);
    this.powerups = this.powerups.filter((p) => !p.isOffscreen(this.height));
  }
  updateExplosions(dt) {
    for (const ex of this.explosions) ex.update(dt);
    this.explosions = this.explosions.filter((ex) => !ex.isFinished());
  }
  updateStars(dt) {
    for (const s of this.stars) s.update(dt);
  }

  checkPlayerDeath() {
    if (this.player.health <= 0) {
      this.player.lives -= 1;
      if (this.player.lives > 0) {
        // Respawn with full health and a brief grace-period shield
        this.player.health = this.player.maxHealth;
        this.player.shieldTimer = 2;
      } else {
        this.endGame();
      }
    }
  }

  // -- Collisions -----------------------------------------------
  checkCollisions() {
    this.checkBulletEnemyCollisions();
    this.checkPlayerEnemyCollisions();
    this.checkPlayerPowerupCollisions();
  }
  checkBulletEnemyCollisions() {
    for (const bullet of [...this.bullets]) {
      for (const enemy of [...this.enemies]) {
        if (rectsOverlap(bullet.getRect(), enemy.getRect())) {
          const damage = bullet.big ? 2 : 1;
          const destroyed = enemy.takeDamage(damage);
          this.bullets = this.bullets.filter((b) => b !== bullet);

          if (destroyed) {
            this.enemies = this.enemies.filter((e) => e !== enemy);
            this.score += enemy.scoreValue;
            this.explosions.push(
              new Explosion(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.color)
            );
            this.maybeSpawnPowerup(enemy.x, enemy.y);
          }
          break;
        }
      }
    }
  }
  checkPlayerEnemyCollisions() {
    const prect = this.player.getRect();
    for (const enemy of [...this.enemies]) {
      if (rectsOverlap(prect, enemy.getRect())) {
        this.enemies = this.enemies.filter((e) => e !== enemy);
        this.explosions.push(
          new Explosion(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.color)
        );
        if (this.player.takeDamage(25)) this.triggerShake();
      }
    }
  }
  checkPlayerPowerupCollisions() {
    const prect = this.player.getRect();
    for (const p of [...this.powerups]) {
      if (rectsOverlap(prect, p.getRect())) {
        this.powerups = this.powerups.filter((pu) => pu !== p);
        this.player.applyPowerup(p.typeName);
      }
    }
  }

  // -- Game over --------------------------------------------------
  endGame() {
    if (!this.running) return; // avoid double-firing
    this.destroy();
    if (this.onGameOver) this.onGameOver(this.score);
  }

  // -- Drawing ------------------------------------------------------
  getShakeOffset() {
    if (this.shakeTimer <= 0) return { x: 0, y: 0 };
    return {
      x: randomRange(-this.shakeStrength, this.shakeStrength),
      y: randomRange(-this.shakeStrength, this.shakeStrength)
    };
  }

  draw() {
    const ctx = this.ctx;
    const offset = this.getShakeOffset();

    ctx.save();
    ctx.translate(offset.x, offset.y);

    ctx.fillStyle = "#08081a";
    ctx.fillRect(-20, -20, this.width + 40, this.height + 40);

    for (const s of this.stars) s.draw(ctx);
    for (const p of this.powerups) p.draw(ctx);
    for (const e of this.enemies) e.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);
    for (const ex of this.explosions) ex.draw(ctx);
    this.player.draw(ctx);

    ctx.restore();

    this.drawHud(ctx);
  }

  drawHud(ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";

    ctx.textAlign = "left";
    ctx.font = "26px sans-serif";
    ctx.fillText("Score: " + this.score, 20, 15);
    ctx.font = "20px sans-serif";
    ctx.fillText("Lives: " + this.player.lives, 20, 48);

    ctx.textAlign = "right";
    ctx.font = "26px sans-serif";
    ctx.fillText("High Score: " + this.highScore, this.width - 20, 15);

    // Health bar
    const barW = 220;
    const ratio = Math.max(0, this.player.health / this.player.maxHealth);
    ctx.fillStyle = "#3c3c3c";
    ctx.fillRect(this.width / 2 - barW / 2, 15, barW, 16);
    ctx.fillStyle = "#3cc864";
    ctx.fillRect(this.width / 2 - barW / 2, 15, barW * ratio, 16);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "14px sans-serif";
    ctx.fillText("HEALTH", this.width / 2, 34);

    // Active power-up indicators
    const active = [];
    if (this.player.fireRateTimer > 0) active.push("Fire Rate");
    if (this.player.tripleShotTimer > 0) active.push("Triple Shot");
    if (this.player.shieldTimer > 0) active.push("Shield");
    if (this.player.bigBulletsTimer > 0) active.push("Big Bullets");
    if (active.length > 0) {
      ctx.font = "18px sans-serif";
      ctx.fillText(active.join("  |  "), this.width / 2, this.height - 30);
    }
  }
}

// -----------------------------------------------------------
// App: owns the screen flow (login -> menu -> hangar/stats -> play
// -> game over) and all the DOM overlay wiring. The canvas is only
// ever driven by an active Game instance; between sessions it just
// sits idle behind whichever overlay is showing.
// -----------------------------------------------------------
class App {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    this.username = null;
    this.profile = null;
    this.game = null;

    this.screens = {
      login: document.getElementById("loginScreen"),
      menu: document.getElementById("mainMenu"),
      shipSelect: document.getElementById("shipSelect"),
      stats: document.getElementById("statsScreen"),
      gameOver: document.getElementById("gameOverScreen"),
      exit: document.getElementById("exitScreen")
    };

    this.bindLogin();
    this.bindMenu();
    this.bindShipSelect();
    this.bindStats();
    this.bindGameOver();

    this.showScreen("login");
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.game) {
      this.game.width = this.canvas.width;
      this.game.height = this.canvas.height;
    }
  }

  showScreen(name) {
    Object.entries(this.screens).forEach(([key, el]) => {
      el.classList.toggle("hidden", key !== name);
    });
  }

  hideAllScreens() {
    Object.values(this.screens).forEach((el) => el.classList.add("hidden"));
  }

  // -- Login --------------------------------------------------------
  bindLogin() {
    const form = document.getElementById("loginForm");
    const usernameInput = document.getElementById("loginUsername");
    const passwordInput = document.getElementById("loginPassword");
    const errorEl = document.getElementById("loginError");
    const submitBtn = form.querySelector("button[type=submit]");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username || !password) {
        errorEl.textContent = "Enter a callsign and access code.";
        return;
      }

      submitBtn.disabled = true;
      errorEl.textContent = "Checking...";

      try {
        const result = await attemptLogin(username, password);
        if (!result.success) {
          errorEl.textContent = result.error;
          passwordInput.value = "";
          passwordInput.focus();
          return;
        }
        errorEl.textContent = "";
        passwordInput.value = "";
        this.username = username;
        this.profile = loadProfile(username);
        this.enterMenu();
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // -- Main menu ------------------------------------------------------
  enterMenu() {
    document.getElementById("menuWelcome").textContent = "Welcome, " + this.username;
    this.showScreen("menu");
  }

  bindMenu() {
    document.getElementById("btnPlay").addEventListener("click", () => this.startGame());
    document.getElementById("btnShips").addEventListener("click", () => this.openShipSelect());
    document.getElementById("btnStats").addEventListener("click", () => this.openStats());
    document.getElementById("btnLogout").addEventListener("click", () => this.logout());
  }

  logout() {
    this.username = null;
    this.profile = null;
    document.getElementById("loginUsername").value = "";
    this.showScreen("login");
  }

  // -- Hangar / ship select ---------------------------------------------
  openShipSelect() {
    this.renderShipSelect();
    this.showScreen("shipSelect");
  }

  renderShipSelect() {
    const container = document.getElementById("shipList");
    container.innerHTML = "";
    Object.entries(SHIP_TYPES).forEach(([key, ship]) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "ship-card" + (this.profile.selectedShip === key ? " selected" : "");
      card.innerHTML =
        '<div class="ship-swatch" style="background:' + ship.colors.hull +
        "; border-color:" + ship.colors.stripe + '"></div>' +
        '<div class="ship-info">' +
        "<h3>" + ship.name + (this.profile.selectedShip === key ? " (equipped)" : "") + "</h3>" +
        "<p>" + ship.tagline + "</p>" +
        '<div class="ship-stats">' +
        "<span>Speed " + ship.speed + "</span>" +
        "<span>Health " + ship.maxHealth + "</span>" +
        "<span>Fire " + ship.baseFireDelay.toFixed(2) + "s</span>" +
        "</div></div>";
      card.addEventListener("click", () => {
        this.profile.selectedShip = key;
        saveProfile(this.profile);
        this.renderShipSelect();
      });
      container.appendChild(card);
    });
  }

  bindShipSelect() {
    document.getElementById("btnShipBack").addEventListener("click", () => this.showScreen("menu"));
  }

  // -- Stats ----------------------------------------------------------
  openStats() {
    this.renderStats();
    this.showScreen("stats");
  }

  renderStats() {
    const p = this.profile;
    const today = getToday();
    const day = getDayName();
    const avg = p.gamesPlayed > 0 ? Math.round(p.totalScore / p.gamesPlayed) : 0;
    const el = document.getElementById("statsBody");
    el.innerHTML =
      this.statRow("Games Played", p.gamesPlayed) +
      this.statRow("Best Score", p.bestScore) +
      this.statRow("Total Score", p.totalScore) +
      this.statRow("Average Score", avg) +
      this.statRow("Today's Best", p.daily[today] || 0) +
      this.statRow("This Week's Best (" + day + ")", p.weekly[day] || 0);
  }

  statRow(label, value) {
    return '<div class="stat-row"><span>' + label + "</span><span>" + value + "</span></div>";
  }

  bindStats() {
    document.getElementById("btnStatsBack").addEventListener("click", () => this.showScreen("menu"));
  }

  // -- Gameplay session -------------------------------------------------
  startGame() {
    if (this.game) this.game.destroy();
    this.hideAllScreens();
    this.resizeCanvas();
    this.game = new Game(this.canvas, this.profile, (finalScore) => this.onGameOver(finalScore));
  }

  onGameOver(finalScore) {
    recordGameResult(this.profile, finalScore);
    document.getElementById("goScore").textContent = finalScore;
    document.getElementById("goBest").textContent = this.profile.bestScore;
    this.showScreen("gameOver");
  }

  bindGameOver() {
    document.getElementById("btnGoRestart").addEventListener("click", () => this.startGame());
    document.getElementById("btnGoMenu").addEventListener("click", () => {
      this.game = null;
      this.enterMenu();
    });
    document.getElementById("btnGoExit").addEventListener("click", () => this.exitGame());
  }

  exitGame() {
    this.game = null;
    window.close();
    // Most browsers refuse to close a tab a script didn't open itself.
    // If we're still here shortly after, show a manual "you can close
    // this tab" screen instead of a silently dead Exit button.
    setTimeout(() => {
      this.hideAllScreens();
      this.showScreen("exit");
    }, 150);
  }
}

window.addEventListener("load", () => {
  new App();
});