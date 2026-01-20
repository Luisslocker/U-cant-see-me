// 8-Bit Ring Rumble (parody-inspired, no real names/logos)
// HTML5 canvas, no libs.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const roundEl = document.getElementById("round");
const hpEl = document.getElementById("hp");
const ehpEl = document.getElementById("ehp");

const startBtn = document.getElementById("startBtn");
const muteBtn = document.getElementById("muteBtn");
const splashUrlInput = document.getElementById("splashUrl");
const setSplashBtn = document.getElementById("setSplashBtn");

let SOUND_ON = true;
muteBtn.onclick = () => {
  SOUND_ON = !SOUND_ON;
  muteBtn.textContent = `Sound: ${SOUND_ON ? "ON" : "OFF"}`;
};

let splashImg = null;
let splashUrl = "";
setSplashBtn.onclick = () => {
  splashUrl = (splashUrlInput.value || "").trim();
  if(!splashUrl) { splashImg = null; return; }
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => splashImg = img;
  img.onerror = () => splashImg = null;
  img.src = splashUrl;
};

let audioCtx;
function beep(freq=440, duration=0.06, type="square", vol=0.04){
  if(!SOUND_ON) return;
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + duration);
}
const sfx = {
  hit(){ beep(520,0.04,"square",0.05); },
  heavy(){ beep(180,0.10,"sawtooth",0.05); },
  taunt(){ beep(740,0.06,"triangle",0.05); setTimeout(()=>beep(610,0.06,"triangle",0.04),70); },
  win(){ beep(523,0.08,"triangle",0.05); setTimeout(()=>beep(659,0.08,"triangle",0.05),90); setTimeout(()=>beep(784,0.10,"triangle",0.06),190); }
};

const keys = new Set();
window.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if(["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d","z","x","c"," "].includes(k)) e.preventDefault();
  keys.add(k === " " ? "space" : k);
});
window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase() === " " ? "space" : e.key.toLowerCase()));

startBtn.onclick = () => start(true);

// Mobile controls
document.querySelectorAll(".mobile .dpad button").forEach(btn=>{
  const k = btn.dataset.k;
  btn.addEventListener("touchstart",(e)=>{e.preventDefault(); keys.add(mapMobileKey(k));},{passive:false});
  btn.addEventListener("touchend",(e)=>{e.preventDefault(); keys.delete(mapMobileKey(k));},{passive:false});
});
document.querySelectorAll(".mobile .acts button").forEach(btn=>{
  const a = btn.dataset.a;
  btn.addEventListener("touchstart",(e)=>{e.preventDefault(); tapAction(a);},{passive:false});
  btn.addEventListener("click",()=>tapAction(a));
});
function mapMobileKey(k){
  return ({up:"arrowup",down:"arrowdown",left:"arrowleft",right:"arrowright"})[k];
}
function tapAction(a){
  if(a==="punch") keys.add("z"), setTimeout(()=>keys.delete("z"),80);
  if(a==="kick") keys.add("x"), setTimeout(()=>keys.delete("x"),80);
  if(a==="taunt") keys.add("c"), setTimeout(()=>keys.delete("c"),120);
  if(a==="special") keys.add("space"), setTimeout(()=>keys.delete("space"),120);
}

const ring = {
  x: 120, y: 90, w: 660, h: 360,
  ropes: 4
};

const player = makeFighter("CHAMP", "#fbbf24");
const enemy  = makeFighter("RIVAL", "#ef4444");

let score = 0;
let round = 1;
let running = false;
let last = 0;
let message = "Tap Start";

function makeFighter(name, color){
  return {
    name, color,
    x: 0, y: 0,
    vx: 0, vy: 0,
    w: 44, h: 64,
    face: 1, // 1 right, -1 left
    hp: 100,
    meter: 0, // 0..100
    invuln: 0,
    stun: 0,
    atkCd: 0,
    tauntCd: 0
  };
}

function resetPositions(){
  player.x = ring.x + 160; player.y = ring.y + ring.h - 120;
  enemy.x  = ring.x + ring.w - 200; enemy.y = ring.y + ring.h - 120;
  player.face = 1; enemy.face = -1;
  player.vx = player.vy = enemy.vx = enemy.vy = 0;
}

function start(full){
  if(full){
    score = 0; round = 1;
  }
  player.hp = 100; enemy.hp = 100;
  player.meter = 0; enemy.meter = 0;
  player.invuln = enemy.invuln = 0;
  player.stun = enemy.stun = 0;
  message = "";
  resetPositions();
  running = true;
  last = performance.now();
  requestAnimationFrame(loop);
}

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function rectsOverlap(a,b){
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

function loop(t){
  if(!running){ draw(); return; }
  const dt = Math.min(0.033, (t-last)/1000);
  last = t;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt){
  // timers
  [player, enemy].forEach(f=>{
    f.invuln = Math.max(0, f.invuln - dt);
    f.stun = Math.max(0, f.stun - dt);
    f.atkCd = Math.max(0, f.atkCd - dt);
    f.tauntCd = Math.max(0, f.tauntCd - dt);
  });

  // player input
  if(player.stun <= 0){
    const spd = 240;
    player.vx = 0;
    player.vy = 0;
    if(keys.has("arrowleft") || keys.has("a")) player.vx = -spd;
    if(keys.has("arrowright") || keys.has("d")) player.vx = spd;
    if(keys.has("arrowup") || keys.has("w")) player.vy = -spd;
    if(keys.has("arrowdown") || keys.has("s")) player.vy = spd;

    if(player.vx !== 0) player.face = player.vx > 0 ? 1 : -1;

    if(keys.has("c") && player.tauntCd<=0){
      // taunt = brief dodge + meter gain
      player.invuln = 0.35;
      player.tauntCd = 0.6;
      player.meter = clamp(player.meter + 18, 0, 100);
      sfx.taunt();
    }

    if(keys.has("z")) tryAttack(player, enemy, "punch");
    if(keys.has("x")) tryAttack(player, enemy, "kick");
    if(keys.has("space")) tryAttack(player, enemy, "special");
  }

  // enemy AI
  aiEnemy(dt);

  // move + keep inside ring
  moveFighter(player, dt);
  moveFighter(enemy, dt);

  // face each other
  if(enemy.x < player.x) { player.face = -1; enemy.face = 1; }
  else { player.face = 1; enemy.face = -1; }

  // round end
  if(player.hp <= 0 || enemy.hp <= 0){
    running = false;
    if(enemy.hp <= 0){
      score += 250 + Math.floor(player.meter);
      message = "K.O. — YOU WIN!";
      sfx.win();
      setTimeout(()=>{ round++; start(false); }, 900);
    }else{
      message = "K.O. — TRY AGAIN";
    }
  }

  // HUD
  scoreEl.textContent = score;
  roundEl.textContent = round;
  hpEl.textContent = Math.max(0, Math.floor(player.hp));
  ehpEl.textContent = Math.max(0, Math.floor(enemy.hp));
}

function moveFighter(f, dt){
  f.x += f.vx * dt;
  f.y += f.vy * dt;

  // bounds inside ring
  f.x = clamp(f.x, ring.x + 20, ring.x + ring.w - f.w - 20);
  f.y = clamp(f.y, ring.y + 40, ring.y + ring.h - f.h - 30);
}

function tryAttack(att, def, type){
  if(att.atkCd > 0) return;

  let dmg = 0, range = 52, cd = 0.28, meterGain = 10, stun = 0.10;
  if(type === "kick"){ dmg = 14; range = 60; cd = 0.34; meterGain = 12; stun = 0.16; }
  if(type === "punch"){ dmg = 9; range = 50; cd = 0.22; meterGain = 9; stun = 0.10; }
  if(type === "special"){
    if(att.meter < 100) return;
    dmg = 28; range = 70; cd = 0.55; meterGain = 0; stun = 0.26;
    att.meter = 0;
  }

  att.atkCd = cd;

  // hitbox in front
  const hit = {
    x: att.face === 1 ? att.x + att.w : att.x - range,
    y: att.y + 10,
    w: range,
    h: att.h - 20
  };

  const hurt = { x:def.x, y:def.y, w:def.w, h:def.h };

  if(rectsOverlap(hit, hurt) && def.invuln <= 0){
    def.hp -= dmg;
    def.stun = stun;
    def.invuln = 0.18;
    att.meter = clamp(att.meter + meterGain, 0, 100);
    score += (type==="special" ? 40 : 10);
    (type==="special" ? sfx.heavy : sfx.hit)();

    // knockback
    const kb = (type==="special" ? 140 : 90);
    def.x += att.face * kb * 0.08;
  }
}

function aiEnemy(dt){
  if(enemy.stun > 0) { enemy.vx = enemy.vy = 0; return; }

  const dx = (player.x - enemy.x);
  const dy = (player.y - enemy.y);
  const dist = Math.hypot(dx, dy);

  // simple chase
  const spd = 210;
  enemy.vx = clamp(dx, -1, 1) * spd * (dist > 90 ? 1 : 0.35);
  enemy.vy = clamp(dy, -1, 1) * spd * (dist > 90 ? 1 : 0.35);

  // occasionally taunt to dodge
  if(Math.random() < 0.006 && enemy.tauntCd<=0){
    enemy.invuln = 0.25;
    enemy.tauntCd = 0.75;
    enemy.meter = clamp(enemy.meter + 14, 0, 100);
  }

  // attack if close
  if(dist < 90){
    if(enemy.meter >= 100 && Math.random()<0.15) tryAttack(enemy, player, "special");
    else if(Math.random()<0.55) tryAttack(enemy, player, "punch");
    else tryAttack(enemy, player, "kick");
  }
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // background starfield
  drawStars();

  // optional splash overlay when not running
  if(!running && splashImg){
    drawSplash(splashImg);
  }

  // ring
  drawRing();

  // crowd (simple pixels)
  drawCrowd();

  // fighters
  drawFighter(player);
  drawFighter(enemy);

  // meters + HP bars
  drawBars();

  // message
  if(!running){
    centerText(message || "Tap Start");
  }
}

function drawStars(){
  ctx.fillStyle = "rgba(255,255,255,.05)";
  for(let i=0;i<90;i++){
    const x = (i*97) % canvas.width;
    const y = (i*53) % canvas.height;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawSplash(img){
  // letterbox fit
  const cw = canvas.width, ch = canvas.height;
  const ir = img.width / img.height;
  const cr = cw / ch;
  let w,h,x,y;
  if(ir > cr){ h = ch; w = h*ir; x = (cw-w)/2; y = 0; }
  else { w = cw; h = w/ir; x = 0; y = (ch-h)/2; }

  ctx.globalAlpha = 0.25;
  ctx.drawImage(img, x, y, w, h);
  ctx.globalAlpha = 1;
}

function drawRing(){
  // mat
  ctx.fillStyle = "rgba(17,24,39,.85)";
  ctx.fillRect(ring.x, ring.y, ring.w, ring.h);

  // border
  ctx.strokeStyle = "rgba(83,172,177,.55)";
  ctx.lineWidth = 4;
  ctx.strokeRect(ring.x, ring.y, ring.w, ring.h);

  // ropes
  for(let i=1;i<=ring.ropes;i++){
    const yy = ring.y + i*(ring.h/(ring.ropes+1));
    ctx.strokeStyle = "rgba(83,172,177,.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ring.x+10, yy);
    ctx.lineTo(ring.x+ring.w-10, yy);
    ctx.stroke();
  }

  // corner posts
  ctx.fillStyle = "rgba(83,172,177,.35)";
  const post = 14;
  ctx.fillRect(ring.x-post, ring.y-post, post, post);
  ctx.fillRect(ring.x+ring.w, ring.y-post, post, post);
  ctx.fillRect(ring.x-post, ring.y+ring.h, post, post);
  ctx.fillRect(ring.x+ring.w, ring.y+ring.h, post, post);
}

function drawCrowd(){
  const top = ring.y - 70;
  const left = ring.x;
  const w = ring.w;
  const h = 60;

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(left, top, w, h);

  for(let i=0;i<140;i++){
    const x = left + (i*13)%w;
    const y = top + 10 + ((i*7)%36);
    const c = ["#60a5fa","#a78bfa","#34d399","#f87171","#fbbf24"][i%5];
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 8, 8);
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(x+2, y+2, 2, 2);
  }
}

function drawFighter(f){
  // body
  ctx.fillStyle = f.color;
  ctx.fillRect(f.x, f.y, f.w, f.h);

  // shorts
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(f.x, f.y+34, f.w, 14);

  // head highlight
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillRect(f.x+6, f.y+6, f.w-12, 10);

  // visor/eye line
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(f.x+8, f.y+18, f.w-16, 6);

  // invuln shimmer
  if(f.invuln>0){
    ctx.strokeStyle = "rgba(83,172,177,.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(f.x-2, f.y-2, f.w+4, f.h+4);
  }

  // name
  ctx.fillStyle = "rgba(229,231,235,.65)";
  ctx.font = "800 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(f.name, f.x + f.w/2, f.y - 8);
}

function drawBars(){
  // HP bars
  bar(30, 22, 260, 14, player.hp/100, "PLAYER");
  bar(canvas.width-290, 22, 260, 14, enemy.hp/100, "RIVAL");

  // meter bars
  bar(30, 44, 260, 10, player.meter/100, "METER", true);
  bar(canvas.width-290, 44, 260, 10, enemy.meter/100, "METER", true);
}

function bar(x,y,w,h,p,label,isMeter=false){
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(x,y,w,h);
  ctx.fillStyle = isMeter ? "rgba(83,172,177,.95)" : "rgba(34,197,94,.9)";
  ctx.fillRect(x,y,w*clamp(p,0,1),h);
  ctx.strokeStyle = "rgba(255,255,255,.15)";
  ctx.strokeRect(x,y,w,h);
  ctx.fillStyle = "rgba(229,231,235,.7)";
  ctx.font = "800 10px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(label, x, y-2);
}

function centerText(txt){
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.fillStyle = "rgba(229,231,235,.95)";
  ctx.font = "900 34px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(txt, canvas.width/2, canvas.height/2 - 10);

  ctx.fillStyle = "rgba(83,172,177,.95)";
  ctx.font = "800 14px system-ui";
  ctx.fillText("Move • Z Punch • X Kick • C Taunt • Space Special", canvas.width/2, canvas.height/2 + 28);
  ctx.restore();
}

// initial draw
draw();
centerText("Tap Start");
