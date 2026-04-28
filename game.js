const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlaySubtitle = document.getElementById("overlay-subtitle");
const startBtn = document.getElementById("start-btn");
const scoreDisplay = document.getElementById("score-display");
const copsDisplay = document.getElementById("cops-display");

// Resize canvas to fill screen
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Game state
let gameState = "menu";
let score = 0;
let highScore = parseInt(localStorage.getItem("getawayHighScore")) || 0;
let player,
  cops = [],
  particles = [],
  skidMarks = [],
  lastSpawnTime = 0;
const initialSpawnInterval = 3000;
const minSpawnInterval = 600;

// Input handling
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  keys[e.code] = true;
});
window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
  keys[e.code] = false;
});

// Player Car class
class PlayerCar {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 20;
    this.height = 36;
    this.speed = 5;
    this.color = "#00ffff";
    this.angle = -Math.PI / 2; // Pointing up by default
    this.velocity = { x: 0, y: 0 };
    this.driftAngle = 0;
  }

  update() {
    // Movement input
    let inputX = 0,
      inputY = 0;
    if (keys["w"] || keys["arrowup"]) inputY -= 1;
    if (keys["s"] || keys["arrowdown"]) inputY += 1;
    if (keys["a"] || keys["arrowleft"]) inputX -= 1;
    if (keys["d"] || keys["arrowright"]) inputX += 1;

    // Normalize diagonal input
    if (inputX !== 0 || inputY !== 0) {
      const len = Math.sqrt(inputX * inputX + inputY * inputY);
      inputX /= len;
      inputY /= len;

      // Calculate target angle from input direction
      const targetAngle = Math.atan2(inputY, inputX);

      // Smoothly rotate towards target angle
      let angleDiff = targetAngle - this.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.angle += angleDiff * 0.2;

      // Move in the direction the car is facing
      const forwardX = Math.cos(this.angle);
      const forwardY = Math.sin(this.angle);

      this.velocity.x = forwardX * this.speed;
      this.velocity.y = forwardY * this.speed;
    } else {
      // Slow down when no input
      this.velocity.x *= 0.9;
      this.velocity.y *= 0.9;
    }

    // Apply velocity
    this.x += this.velocity.x;
    this.y += this.velocity.y;

    // Calculate drift angle (difference between facing angle and movement direction)
    const moveSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    if (moveSpeed > 0.5) {
      const moveAngle = Math.atan2(this.velocity.y, this.velocity.x);
      let driftDiff = moveAngle - this.angle;
      while (driftDiff > Math.PI) driftDiff -= Math.PI * 2;
      while (driftDiff < -Math.PI) driftDiff += Math.PI * 2;
      this.driftAngle = driftDiff;
    } else {
      this.driftAngle = 0;
    }

    // Add skid marks when drifting
    if (Math.abs(this.driftAngle) > 0.5 && moveSpeed > 3 && Math.random() < 0.4) {
      skidMarks.push(new SkidMark(this.x, this.y, this.angle));
    }

    // Keep in bounds
    this.x = Math.max(this.width, Math.min(canvas.width - this.width, this.x));
    this.y = Math.max(this.height, Math.min(canvas.height - this.height, this.y));
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);

    const w = this.width;
    const h = this.height;

    // Tires
    ctx.fillStyle = "#111";
    ctx.fillRect(-w / 2 - 2, -h / 2 + 4, 4, 8);
    ctx.fillRect(w / 2 - 2, -h / 2 + 4, 4, 8);
    ctx.fillRect(-w / 2 - 2, h / 2 - 10, 4, 8);
    ctx.fillRect(w / 2 - 2, h / 2 - 10, 4, 8);

    // Main body (rounded car shape)
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 2, -h / 2);
    ctx.lineTo(w / 2 - 2, -h / 2);
    ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 4);
    ctx.lineTo(w / 2, h / 2 - 4);
    ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 2, h / 2);
    ctx.lineTo(-w / 2 + 2, h / 2);
    ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 4);
    ctx.lineTo(-w / 2, -h / 2 + 4);
    ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 2, -h / 2);
    ctx.fill();

    // Neon outline
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 15;
    ctx.stroke();

    // Windshield
    ctx.fillStyle = "rgba(0, 200, 255, 0.4)";
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 3, -h / 4);
    ctx.lineTo(w / 2 - 3, -h / 4);
    ctx.lineTo(w / 2 - 4, 0);
    ctx.lineTo(-w / 2 + 4, 0);
    ctx.fill();

    // Headlights
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(-w / 4, -h / 2 + 2, 3, 0, Math.PI * 2);
    ctx.arc(w / 4, -h / 2 + 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Taillights
    ctx.fillStyle = "#ff0000";
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur = 10;
    ctx.fillRect(-w / 4 - 2, h / 2 - 3, 4, 2);
    ctx.fillRect(w / 4 - 2, h / 2 - 3, 4, 2);

    ctx.restore();
    ctx.shadowBlur = 0;
  }
}

// Police Car class
class PoliceCar {
  constructor(x, y, speed) {
    this.segments = [{ x, y, angle: 0 }];
    this.segmentLength = 25;
    this.numSegments = 5;
    this.color = "rgb(255, 50, 50)";
    this.speed = speed;
    this.alive = true;
    this.targetHistory = [];
    this.maxHistory = 30;
    this.lightPhase = 0;
    this.velocity = { x: 0, y: 0 };
  }

  update(player) {
    if (!this.alive) return;

    const head = this.segments[0];

    // Store target history (where player was)
    this.targetHistory.push({ x: player.x, y: player.y });
    if (this.targetHistory.length > this.maxHistory) {
      this.targetHistory.shift();
    }

    // Target is player's past position
    const targetIndex = Math.max(0, this.targetHistory.length - 8);
    const target = this.targetHistory[targetIndex] || player;

    // Move head towards target
    const dx = target.x - head.x;
    const dy = target.y - head.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      // Calculate target angle
      const targetAngle = Math.atan2(dy, dx);
      // Smoothly rotate towards target
      let angleDiff = targetAngle - head.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      head.angle += angleDiff * 0.1;

      // Move in the direction the car is facing (with some drift)
      const forwardX = Math.cos(head.angle);
      const forwardY = Math.sin(head.angle);
      head.x += forwardX * this.speed * 0.7;
      head.y += forwardY * this.speed * 0.7;

      // Add some velocity for drift effect
      this.velocity.x += forwardX * 0.3;
      this.velocity.y += forwardY * 0.3;
    }

    // Apply friction to velocity
    this.velocity.x *= 0.92;
    this.velocity.y *= 0.92;

    // Update segments (each follows the one before it)
    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1];
      const curr = this.segments[i];

      const segDx = prev.x - curr.x;
      const segDy = prev.y - curr.y;
      const segDist = Math.sqrt(segDx * segDx + segDy * segDy);

      if (segDist > this.segmentLength) {
        const angle = Math.atan2(segDy, segDx);
        curr.x = prev.x - Math.cos(angle) * this.segmentLength;
        curr.y = prev.y - Math.sin(angle) * this.segmentLength;
        curr.angle = angle;
      }
    }

    // Check wall collision
    if (head.x < 0 || head.x > canvas.width || head.y < 0 || head.y > canvas.height) {
      this.alive = false;
      if (gameState === "playing") score++;
      createExplosion(head.x, head.y, this.color);
      createDebris(head.x, head.y);
    }

    // Check self collision
    for (let i = 1; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const segDist = Math.sqrt((head.x - seg.x) ** 2 + (head.y - seg.y) ** 2);
      if (segDist < this.segmentLength / 2) {
        this.alive = false;
        if (gameState === "playing") score++;
        createExplosion(head.x, head.y, this.color);
        createDebris(head.x, head.y);
        break;
      }
    }

    this.lightPhase++;
  }

  draw() {
    if (!this.alive) return;

    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const isHead = i === 0;
      const w = isHead ? 22 : 18;
      const h = isHead ? 40 : 32;

      // Use stored angle or calculate from movement
      const angle = seg.angle || 0;

      ctx.save();
      ctx.translate(seg.x, seg.y);
      // Police car sprite is drawn facing right by default, so add 90 degrees (PI/2) to point forward
      ctx.rotate(angle + Math.PI / 2);

      // Tires
      ctx.fillStyle = "#111";
      ctx.fillRect(-w / 2 - 2, -h / 2 + 4, 4, 8);
      ctx.fillRect(w / 2 - 2, -h / 2 + 4, 4, 8);
      ctx.fillRect(-w / 2 - 2, h / 2 - 10, 4, 8);
      ctx.fillRect(w / 2 - 2, h / 2 - 10, 4, 8);

      // Car body
      ctx.fillStyle = "#0a0a15";
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 2, -h / 2);
      ctx.lineTo(w / 2 - 2, -h / 2);
      ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 4);
      ctx.lineTo(w / 2, h / 2 - 4);
      ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 2, h / 2);
      ctx.lineTo(-w / 2 + 2, h / 2);
      ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 4);
      ctx.lineTo(-w / 2, -h / 2 + 4);
      ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 2, -h / 2);
      ctx.fill();

      // Police outline
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 15;
      ctx.stroke();

      if (isHead) {
        // Windshield
        ctx.fillStyle = "rgba(200, 200, 255, 0.3)";
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 3, -h / 4);
        ctx.lineTo(w / 2 - 3, -h / 4);
        ctx.lineTo(w / 2 - 4, 0);
        ctx.lineTo(-w / 2 + 4, 0);
        ctx.fill();

        // Headlights
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(-w / 4, -h / 2 + 2, 3, 0, Math.PI * 2);
        ctx.arc(w / 4, -h / 2 + 2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Taillights
        ctx.fillStyle = "#ff0000";
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = 10;
        ctx.fillRect(-w / 4 - 2, h / 2 - 3, 4, 2);
        ctx.fillRect(w / 4 - 2, h / 2 - 3, 4, 2);
      }

      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  getHead() {
    return this.segments[0];
  }
}

// Skid mark particle
class SkidMark {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.life = 1;
  }

  update() {
    this.life -= 0.02;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = `rgba(50, 50, 50, ${this.life * 0.5})`;
    ctx.fillRect(-10, -2, 20, 4);
    ctx.restore();
  }
}

// Debris from crashed cars
class Debris {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1;
    this.decay = Math.random() * 0.01 + 0.01;
    this.size = Math.random() * 4 + 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.life -= this.decay;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color.replace(")", `, ${this.life})`).replace("rgb", "rgba");
    ctx.fill();
  }
}

// Particle class for explosions
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1;
    this.decay = Math.random() * 0.03 + 0.02;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.life -= this.decay;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = this.color.replace(")", `, ${this.life})`).replace("rgb", "rgba");
    ctx.fill();
  }
}

function createExplosion(x, y, color) {
  for (let i = 0; i < 30; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function createDebris(x, y) {
  for (let i = 0; i < 15; i++) {
    particles.push(new Debris(x, y, "rgb(100, 100, 100)"));
  }
}

// Spawn a single police car at a random location away from the player
function spawnPoliceCar() {
  const baseSpeed = 3 + Math.min(score / 12, 3);
  let spawnX, spawnY, dist;
  let attempts = 0;

  // Try to find a position away from player (at least 400px or 40% of screen)
  const minDistance = Math.min(canvas.width, canvas.height) * 0.4;

  do {
    spawnX = 50 + Math.random() * (canvas.width - 100);
    spawnY = 50 + Math.random() * (canvas.height - 100);
    const dx = spawnX - player.x;
    const dy = spawnY - player.y;
    dist = Math.sqrt(dx * dx + dy * dy);
    attempts++;
  } while (dist < minDistance && attempts < 20);

  const cop = new PoliceCar(spawnX, spawnY, baseSpeed + Math.random() * 0.5);
  cops.push(cop);
}

// Check collisions between police cars
function checkCopCollisions() {
  for (let i = 0; i < cops.length; i++) {
    for (let j = i + 1; j < cops.length; j++) {
      const copA = cops[i];
      const copB = cops[j];

      if (!copA.alive || !copB.alive) continue;

      const headA = copA.getHead();
      const headB = copB.getHead();

      // Check if A hits B's body
      for (let k = 0; k < copB.segments.length; k++) {
        const seg = copB.segments[k];
        const dist = Math.sqrt((headA.x - seg.x) ** 2 + (headA.y - seg.y) ** 2);
        if (dist < 15) {
          copA.alive = false;
          score++;
          createExplosion(headA.x, headA.y, copA.color);
          createDebris(headA.x, headA.y);
          break;
        }
      }

      // Check if B hits A's body
      if (copB.alive) {
        for (let k = 0; k < copA.segments.length; k++) {
          const seg = copA.segments[k];
          const dist = Math.sqrt((headB.x - seg.x) ** 2 + (headB.y - seg.y) ** 2);
          if (dist < 15) {
            copB.alive = false;
            score++;
            createExplosion(headB.x, headB.y, copB.color);
            createDebris(headB.x, headB.y);
            break;
          }
        }
      }
    }
  }
}

// Check player collision with police cars
function checkPlayerCollision() {
  for (const cop of cops) {
    if (!cop.alive) continue;

    for (const seg of cop.segments) {
      const dist = Math.sqrt((player.x - seg.x) ** 2 + (player.y - seg.y) ** 2);
      if (dist < player.width) {
        return true;
      }
    }
  }
  return false;
}

// Track game metrics
// score is now the total number of cops destroyed

// Draw road grid
function drawRoadGrid() {
  ctx.strokeStyle = "rgba(50, 50, 80, 0.3)";
  ctx.lineWidth = 2;
  const gridSize = 100;

  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

// Initialize game
function initGame() {
  player = new PlayerCar(canvas.width / 2, canvas.height / 2);
  particles = [];
  skidMarks = [];
  cops = [];
  score = 0;
  lastSpawnTime = Date.now();

  // Initial cops
  for (let i = 0; i < 3; i++) {
    spawnPoliceCar();
  }

  gameState = "playing";
  overlay.classList.add("hidden");
  updateUI();
}

// Update UI
function updateUI() {
  const aliveCops = cops.filter((c) => c.alive).length;
  scoreDisplay.textContent = `Busted: ${score}`;
  copsDisplay.textContent = `Cops: ${aliveCops}`;
}

// Game loop
function gameLoop() {
  // Clear screen with road background
  ctx.fillStyle = "#1a1a25";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw road grid
  drawRoadGrid();

  if (gameState === "playing") {
    // Update and draw skid marks
    for (let i = skidMarks.length - 1; i >= 0; i--) {
      skidMarks[i].update();
      skidMarks[i].draw();
      if (skidMarks[i].life <= 0) {
        skidMarks.splice(i, 1);
      }
    }

    player.update();
    player.draw();

    // Update and draw cops, clean up dead ones
    for (let i = cops.length - 1; i >= 0; i--) {
      cops[i].update(player);
      cops[i].draw();
      if (!cops[i].alive) {
        cops.splice(i, 1);
      }
    }

    // Check collisions
    checkCopCollisions();

    // Check player death
    if (checkPlayerCollision()) {
      gameState = "lost";
      if (score > highScore) {
        highScore = score;
        localStorage.setItem("getawayHighScore", highScore);
      }
      showGameOver(false);
    }

    // Periodic spawning - interval reduces exponentially with score
    const now = Date.now();
    const currentInterval = Math.max(minSpawnInterval, initialSpawnInterval * Math.pow(0.75, score));
    if (now - lastSpawnTime > currentInterval) {
      spawnPoliceCar();
      lastSpawnTime = now;
    }

    updateUI();
  }

  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw();
    if (particles[i].life <= 0) {
      particles.splice(i, 1);
    }
  }

  requestAnimationFrame(gameLoop);
}

// Show game over screen
function showGameOver(won) {
  overlay.classList.remove("hidden");

  // Reset title classes to base and then add specific gradient
  overlayTitle.className = "text-6xl mb-2 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,255,255,0.3)] font-bold bg-gradient-to-r";

  if (won) {
    overlayTitle.textContent = "You Escaped!";
    overlayTitle.classList.add("from-green-400", "to-cyan-400");
    overlaySubtitle.textContent = `Busted: ${score}`;
  } else {
    overlayTitle.textContent = "BUSTED!";
    overlayTitle.classList.add("from-red-500", "to-orange-500");
    overlaySubtitle.textContent = `Score: ${score} | High Score: ${highScore}`;
  }
  startBtn.textContent = "Play Again";
}

// Start button
startBtn.addEventListener("click", () => {
  initGame();
});

// Restart on Enter
window.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (gameState === "lost" || gameState === "won" || gameState === "menu")) {
    initGame();
  }
});

// Start game loop
gameLoop();
