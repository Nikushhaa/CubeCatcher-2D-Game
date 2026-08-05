const COLORS = {
  RED: "#dc3c3c",
  BLUE: "#3c6edc",
  GREEN: "#3cc864",
  YELLOW: "#e6d23c",
  PURPLE: "#aa46c8",
};
const COLOR_NAMES = Object.keys(COLORS);
function getToday() {
  return new Date().toISOString().split("T")[0];
}
function getDayName() {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];
  return days[new Date().getDay()];
}
function loadPlayer() {
  let username = localStorage.getItem("cubeCatcher_username");
  if (!username) {
    username = prompt("Enter your username:");
    if (!username || username.trim() === "") {
      username = "Guest";
    }
    localStorage.setItem(
      "cubeCatcher_username",
      username
    );
  }
  let data = localStorage.getItem(
    "cubeCatcher_" + username
  );
  if (!data) {
    data = {
      username: username,
      gamesPlayed: 0,
      bestScore: 0,
      totalScore: 0,
      daily: {},
      weekly: {
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
        Sunday: 0
      }
    };
  } else {
    data = JSON.parse(data);
  }
  return data;
}
function savePlayer(playerData) {
  localStorage.setItem(
    "cubeCatcher_" + playerData.username,
    JSON.stringify(playerData)
  );
}
function updateStats(playerData, score) {
  const today = getToday();
  const day = getDayName();
  playerData.gamesPlayed += 1;
  playerData.totalScore += score;
  if (score > playerData.bestScore) {
    playerData.bestScore = score;
  }
  if (!playerData.daily[today]) {
    playerData.daily[today] = 0;
  }
  if (score > playerData.daily[today]) {
    playerData.daily[today] = score;
  }
  if (score > playerData.weekly[day]) {
    playerData.weekly[day] = score;
  }
  savePlayer(playerData);
}
function randomColorName() {
  return COLOR_NAMES[
    Math.floor(Math.random() * COLOR_NAMES.length)
  ];
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
    this.x =
      canvasWidth / 2 - this.width / 2;
    this.y =
      canvasHeight - this.height - 20;
    this.speed = 500;
    this.colorName =
      randomColorName();
  }
  resize(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.y =
      canvasHeight - this.height - 20;
    this.x =
      Math.max(
        0,
        Math.min(
          this.x,
          canvasWidth - this.width
        )
      );
  }
  handleInput(dt, keys) {
    if (keys.left)
      this.x -= this.speed * dt;
    if (keys.right)
      this.x += this.speed * dt;
    this.x =
      Math.max(
        0,
        Math.min(
          this.x,
          this.canvasWidth - this.width
        )
      );
  }
  changeColor() {
    this.colorName = randomColorName();
  }
  getRect() {
    return {
      x:this.x,
      y:this.y,
      width:this.width,
      height:this.height
    };
  }
  draw(ctx) {
    ctx.fillStyle =
      COLORS[this.colorName];
    ctx.fillRect(
      this.x,
      this.y,
      this.width,
      this.height
    );
  }
}
class FallingCube {
  constructor(canvasWidth) {
    this.size = 30;
    this.x =
      randomRange(
        0,
        canvasWidth - this.size
      );
    this.y = -this.size;
    this.speed =
      randomRange(180,320);
    this.colorName =
      randomColorName();
  }
  update(dt) {
    this.y += this.speed * dt;
  }
  isOffScreen(canvasHeight) {
    return this.y > canvasHeight;
  }
  getRect() {
    return {
      x:this.x,
      y:this.y,
      width:this.size,
      height:this.size
    };
  }
  draw(ctx) {
    ctx.fillStyle =
      COLORS[this.colorName];
    ctx.fillRect(
      this.x,
      this.y,
      this.size,
      this.size
    );
  }
}
function rectsOverlap(a,b){
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
class Game {
  constructor(canvas){
    this.canvas = canvas;
    this.ctx =
      canvas.getContext("2d");
    this.resizeCanvas();
    this.player =
      new Player(
        this.width,
        this.height
      );
    this.cubes = [];
    this.score = 0;
    this.playerData =
      loadPlayer();
    this.spawnTimer = 0;
    this.spawnInterval =
      randomRange(0.5,1.0);
    this.keys = {
      left:false,
      right:false
    };
    this.running = true;
    this.lastTime = null;
    this.bindEvents();
    requestAnimationFrame(
      (t)=>this.loop(t)
    );
  }
  resizeCanvas(){
    this.canvas.width =
      window.innerWidth;
    this.canvas.height =
      window.innerHeight;
    this.width =
      this.canvas.width;
    this.height =
      this.canvas.height;
  }
  endGame(){
    this.running = false;
    updateStats(
      this.playerData,
      this.score
    );
    alert(
      "Game Over\n\n" +
      "Player: " +
      this.playerData.username +
      "\nScore: " +
      this.score +
      "\nBest Score: " +
      this.playerData.bestScore
    );
  }
  bindEvents(){
    window.addEventListener(
      "keydown",
      (e)=>{
        if(e.key==="a" || e.key==="A")
          this.keys.left=true;
        if(e.key==="d" || e.key==="D")
          this.keys.right=true;
      }
    );
    window.addEventListener(
      "keyup",
      (e)=>{
        if(e.key==="a" || e.key==="A")
          this.keys.left=false;
        if(e.key==="d" || e.key==="D")
          this.keys.right=false;
      }
    );
    window.addEventListener(
      "resize",
      ()=>{
        this.resizeCanvas();
        this.player.resize(
          this.width,
          this.height
        );
      }
    );
  }
  loop(timestamp){
    if(!this.running)
      return;
    if(this.lastTime===null)
      this.lastTime=timestamp;
    const dt =
      (timestamp-this.lastTime)/1000;
    this.lastTime=timestamp;
    this.update(dt);
    this.draw();
    requestAnimationFrame(
      (t)=>this.loop(t)
    );
  }
  update(dt){
    this.player.handleInput(
      dt,
      this.keys
    );
    this.spawnCubes(dt);
    this.updateCubes(dt);
  }
  spawnCubes(dt){
    this.spawnTimer += dt;
    if(this.spawnTimer >= this.spawnInterval){
      this.spawnTimer=0;
      this.spawnInterval =
        randomRange(0.5,1.0);
      this.cubes.push(
        new FallingCube(
          this.width
        )
      );
    }
  }
  updateCubes(dt){

    const playerRect =
      this.player.getRect();
    for(
      let i=this.cubes.length-1;
      i>=0;
      i--
    ){
      const cube =
        this.cubes[i];
      cube.update(dt);
      if(
        rectsOverlap(
          cube.getRect(),
          playerRect
        )
      ){
        if(
          cube.colorName ===
          this.player.colorName
        ){
          this.cubes.splice(i,1);
          this.score++;
          this.player.changeColor();
        }
        else{
          this.endGame();
          return;
        }
        continue;
      }
      if(
        cube.isOffScreen(
          this.height
        )
      ){
        this.cubes.splice(i,1);
      }
    }
  }
  draw(){
    const ctx=this.ctx;
    ctx.fillStyle="#141414";

    ctx.fillRect(
      0,
      0,
      this.width,
      this.height
    );
    this.player.draw(ctx);
    for(
      const cube of this.cubes
    )
      cube.draw(ctx);
    this.drawScore(ctx);
  }
  drawScore(ctx){
    ctx.fillStyle="#ffffff";
    ctx.font =
      "40px sans-serif";
    ctx.textAlign="center";
    ctx.textBaseline="top";
    ctx.fillText(
      String(this.score),
      this.width/2,
      20
    );

  }
}
window.addEventListener(
  "load",
  ()=>{
    const canvas =
      document.getElementById(
        "gameCanvas"
      );
    new Game(canvas);
  }
);