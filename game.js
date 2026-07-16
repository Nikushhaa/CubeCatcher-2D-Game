

const COLORS = {
  RED: "#dc3c3c",
  BLUE: "#3c6edc",
  GREEN: "#3cc864",
  YELLOW: "#e6d23c",
  PURPLE: "#aa46c8",
};
const COLOR_NAMES = Object.keys(COLORS);

function randomColorName() {
  return COLOR_NAMES[Math.floor(Math.random() * COLOR_NAMES.length)];
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

class Player {
  constructor(canvasWidth, canvasHeight) {
    this.width = 90;
    this.height = 30;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    
    this.x = canvasWidth / 2 - this.width / 2;// gacentrili
    this.y = canvasHeight - this.height - 20;//vertikalurad

    this.speed = 500; 

    
    this.colorName = randomColorName();
  }

  resize(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.y = canvasHeight - this.height - 20;
    this.x = Math.max(0, Math.min(this.x, canvasWidth - this.width));//ekrans iqit rom ver gavides motamashe
  }

  
  handleInput(dt, keys) {
    if (keys.left) this.x -= this.speed * dt;
    if (keys.right) this.x += this.speed * dt;

    // Keep the catcher inside the canvas bounds
    this.x = Math.max(0, Math.min(this.x, this.canvasWidth - this.width));
  }

  changeColor() {
    this.colorName = randomColorName();
  }

  getRect() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  draw(ctx) {
    ctx.fillStyle = COLORS[this.colorName];
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}


class FallingCube {
  constructor(canvasWidth) {
    this.size = 30;
    this.x = randomRange(0, canvasWidth - this.size);// shemtxveviti koordinati 
    this.y = -this.size; //  kubi iwyebs ekranis zeda mxridan

    this.speed = randomRange(180, 320);//  kubis random sichqare
    this.colorName = randomColorName();
  }

  update(dt) {
    this.y += this.speed * dt;// delta time aris dt ramdeni wami gavida kadridan kadramde
  }

  isOffScreen(canvasHeight) {// mowmdeba gavida tuara kubi ekrans garet
    return this.y > canvasHeight;
  }

  getRect() {
    return { x: this.x, y: this.y, width: this.size, height: this.size };
  }

  draw(ctx) {
    ctx.fillStyle = COLORS[this.colorName];
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}
// amowmebs exeba tu ara ertmanets
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resizeCanvas();// canvas adzlevs swor zomas 

    this.player = new Player(this.width, this.height);// iqmneba motamashe 
    this.cubes = [];// carieli masivi kubebistvis roca kubi chndeba emateba cube1 cube2
    this.score = 0;// qula 0 dan iwyeba da +1 emateba this score++ meshveobit

    
    this.spawnTimer = 0;
    this.spawnInterval = randomRange(0.5, 1.0);

    
    this.keys = { left: false, right: false };// klaviaturis mdgomareobas inaxavs right // left is saxit

    this.running = true;
    this.lastTime = null;

    this.bindEvents();
    requestAnimationFrame((t) => this.loop(t));// yvela frame ze gamoidzaxebs loops
  }
// fanjris zomas akopirebs canvasze
  resizeCanvas() {  
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
  }

  bindEvents() {
    window.addEventListener("keydown", (e) => {
      if (e.key === "a" || e.key === "A") this.keys.left = true; //rodesac a s daacher mashin wava marcxniv 
      if (e.key === "d" || e.key === "D") this.keys.right = true;// rodesac D daacher wava marjvniv
    });
    window.addEventListener("keyup", (e) => { //rodesac klaviaturas ar acher ar imodzravebs motamashe
      if (e.key === "a" || e.key === "A") this.keys.left = false;
      if (e.key === "d" || e.key === "D") this.keys.right = false;
    });
    window.addEventListener("resize", () => {
      this.resizeCanvas();
      this.player.resize(this.width, this.height);
    });
  }

  loop(timestamp) {
    if (!this.running) return; // roca araswor kubs ejaxeba cherdeba

    if (this.lastTime === null) this.lastTime = timestamp;
    const dt = (timestamp - this.lastTime) / 1000; 
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.player.handleInput(dt, this.keys);
    this.spawnCubes(dt);
    this.updateCubes(dt);
  }

  
  spawnCubes(dt) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnInterval = randomRange(0.5, 1.0);
      this.cubes.push(new FallingCube(this.width));
    }
  }

  updateCubes(dt) {
    const playerRect = this.player.getRect();

    for (let i = this.cubes.length - 1; i >= 0; i--) {
      const cube = this.cubes[i];
      cube.update(dt);

      if (rectsOverlap(cube.getRect(), playerRect)) {
        if (cube.colorName === this.player.colorName) {
          
          this.cubes.splice(i, 1);
          this.score += 1;
          this.player.changeColor();
        } else {
      
          this.running = false;
          return;
        }
        continue;
      }

 
      if (cube.isOffScreen(this.height)) {
        this.cubes.splice(i, 1);   // ramdeni elementi unda washalos imas tvlis
      }
    }
  }

  draw() {
    const ctx = this.ctx;

    // Dark background
    ctx.fillStyle = "#141414";
    ctx.fillRect(0, 0, this.width, this.height);

    this.player.draw(ctx);
    for (const cube of this.cubes) cube.draw(ctx);

    this.drawScore(ctx);
  }

  
  drawScore(ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "40px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(String(this.score), this.width / 2, 20);
  }
}

// Start the game once the page has loaded
window.addEventListener("load", () => {
  const canvas = document.getElementById("gameCanvas");
  new Game(canvas);
});
