const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const PREVIEW_SIZE = 4;
const LINES_PER_LEVEL = 10;

const boardCanvas = document.getElementById('game');
const boardCtx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const startBtn = document.getElementById('start-btn');
const soundBtn = document.getElementById('sound-btn');
const menuScreen = document.getElementById('menu-screen');
const menuStartBtn = document.getElementById('menu-start-btn');
const startScreen = document.getElementById('start-screen');
const titleStartBtn = document.getElementById('title-start-btn');
const musicPreviewBtn = document.getElementById('music-preview-btn');
const musicScreen = document.getElementById('music-screen');
const previewLevel = document.getElementById('preview-level');
const previewLevelValue = document.getElementById('preview-level-value');
const previewPlayBtn = document.getElementById('preview-play-btn');
const previewStopBtn = document.getElementById('preview-stop-btn');
const previewBackBtn = document.getElementById('preview-back-btn');
const gameShell = document.querySelector('.game-shell');
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');
const musicVolumeSlider = document.getElementById('music-volume-slider');
const musicVolumeValue = document.getElementById('music-volume-value');
const actionButtons = document.querySelectorAll('[data-action]');
const debugStatus = document.getElementById('debug-status');
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');

const COLORS = {
  I: '#38bdf8',
  O: '#facc15',
  T: '#a78bfa',
  S: '#4ade80',
  Z: '#f87171',
  J: '#60a5fa',
  L: '#fb923c'
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ]
};

const TYPE_ORDER = Object.keys(SHAPES);
const board = createBoard();
let currentPiece = null;
let nextPiece = null;
let holdType = null;
let heldThisTurn = false;
let queue = [];
let score = 0;
let lines = 0;
let level = 1;
let dropInterval = getDropInterval(level);
let lastTime = 0;
let dropAccumulator = 0;
let isPaused = false;
let isRunning = false;
let isGameStarted = false;
let gameOver = false;
let isClearing = false;
let clearEffect = [];
let clearTimeoutId = null;
let dropTimerId = null;
let dropCount = 0;
let lastInput = '-';
let combo = 0;
let particles = [];
let floatingTexts = [];
let shakeTime = 0;
let shockwave = null;
let backgroundImpact = 0;
let backgroundFlash = 0;
let backgroundHue = 190;
const backgroundStars = Array.from({ length: 90 }, () => ({
  x: Math.random() * 2 - 1,
  y: Math.random() * 2 - 1,
  depth: 0.15 + Math.random() * 0.85,
  size: 0.5 + Math.random() * 2
}));

function updateDebugStatus(message = '') {
  if (!debugStatus) return;
  const piece = currentPiece ? `${currentPiece.type}@${currentPiece.x},${currentPiece.y}` : '-';
  debugStatus.textContent =
    `診断: running=${isRunning} paused=${isPaused} over=${gameOver} ` +
    `timer=${Boolean(dropTimerId)} drops=${dropCount} piece=${piece} input=${lastInput}` +
    (message ? ` error=${message}` : '');
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function resizeBackground() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  bgCanvas.width = Math.floor(window.innerWidth * ratio);
  bgCanvas.height = Math.floor(window.innerHeight * ratio);
  bgCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawBackground(timestamp) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const time = timestamp * 0.001;
  const levelIndex = Math.max(0, level - 1);
  const targetHue = (190 + levelIndex * 31) % 360;
  const hueDelta = ((targetHue - backgroundHue + 540) % 360) - 180;
  backgroundHue = (backgroundHue + hueDelta * 0.035 + 360) % 360;
  const hue = backgroundHue;
  const pattern = levelIndex % 4;
  const intensity = Math.min(0.9, 0.28 + levelIndex * 0.035);
  const pulse = 0.5 + Math.sin(time * (2.2 + pattern * 0.35)) * 0.5;
  const impact = backgroundImpact;
  document.documentElement.style.setProperty('--level-hue', hue);

  bgCtx.clearRect(0, 0, width, height);
  const gradient = bgCtx.createRadialGradient(
    width * 0.5,
    height * 0.32,
    0,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.75
  );
  gradient.addColorStop(0, `hsla(${hue}, 80%, 35%, ${intensity})`);
  gradient.addColorStop(1, 'rgba(2, 8, 23, 0.96)');
  bgCtx.fillStyle = gradient;
  bgCtx.fillRect(0, 0, width, height);

  for (let wave = 0; wave < 5; wave += 1) {
    bgCtx.beginPath();
    for (let x = -20; x <= width + 20; x += 14) {
      const y = height * (0.2 + wave * 0.2)
        + Math.sin(x * (0.004 + pattern * 0.001) + time * (0.42 + wave * 0.08)) * (24 + levelIndex * 2 + impact * 24)
        + Math.cos(x * 0.012 - time * (0.24 + pattern * 0.05)) * 14;
      if (x === -20) bgCtx.moveTo(x, y);
      else bgCtx.lineTo(x, y);
    }
    const waveHue = (hue + wave * 38 + pattern * 18) % 360;
    bgCtx.shadowColor = `hsl(${waveHue} 90% 65%)`;
    bgCtx.shadowBlur = 16;
    bgCtx.strokeStyle = wave % 2 === 0
      ? `hsla(${waveHue}, 90%, 65%, ${0.2 + intensity * 0.18 + impact * 0.2})`
      : `hsla(${waveHue}, 90%, 72%, ${0.14 + intensity * 0.14 + impact * 0.14})`;
    bgCtx.lineWidth = 2.2;
    bgCtx.stroke();
    bgCtx.shadowBlur = 0;
  }

  bgCtx.save();
  bgCtx.globalAlpha = 0.12 + intensity * 0.12;
  bgCtx.strokeStyle = `hsl(${(hue + 120) % 360} 90% 65%)`;
  bgCtx.lineWidth = 1;
  for (let ring = 0; ring < 4; ring += 1) {
    const radius = 80 + ring * 110 + ((time * (18 + pattern * 7)) % 110);
    bgCtx.beginPath();
    bgCtx.arc(width * 0.5, height * 0.52, radius, 0, Math.PI * 2);
    bgCtx.stroke();
  }
  bgCtx.restore();

  bgCtx.save();
  bgCtx.translate(width / 2, height / 2);
  bgCtx.globalCompositeOperation = 'screen';
  if (pattern === 0) {
    bgCtx.strokeStyle = `hsla(${hue}, 90%, 65%, ${0.12 + intensity * 0.1})`;
    bgCtx.lineWidth = 1;
    for (let line = -12; line <= 12; line += 1) {
      bgCtx.beginPath();
      bgCtx.moveTo(line * 80, height * 0.62);
      bgCtx.lineTo(line * 28, -height * 0.62);
      bgCtx.stroke();
    }
    for (let row = 0; row < 9; row += 1) {
      const y = Math.pow(row / 9, 1.7) * height * 1.1;
      bgCtx.beginPath();
      bgCtx.moveTo(-width, y);
      bgCtx.lineTo(width, y);
      bgCtx.stroke();
    }
  } else if (pattern === 1) {
    backgroundStars.forEach((star) => {
      const travel = (time * (0.08 + levelIndex * 0.006) * star.depth) % 1;
      const x = star.x * width * (0.35 + travel * 0.9);
      const y = star.y * height * (0.35 + travel * 0.9);
      const alpha = (0.18 + travel * 0.6) * (0.5 + star.depth * 0.5);
      bgCtx.fillStyle = `hsla(${(hue + 50) % 360}, 95%, 78%, ${alpha})`;
      bgCtx.fillRect(x, y, star.size * (1 + travel * 4), star.size * (1 + travel * 4));
    });
  } else if (pattern === 2) {
    bgCtx.globalAlpha = 0.22 + intensity * 0.18;
    for (let band = 0; band < 4; band += 1) {
      const bandHue = (hue + band * 55) % 360;
      bgCtx.fillStyle = `hsla(${bandHue}, 90%, 55%, 0.12)`;
      bgCtx.beginPath();
      bgCtx.moveTo(-width, -height * 0.1 + band * 70);
      for (let x = -width; x <= width; x += 24) {
        bgCtx.lineTo(x, Math.sin(x * 0.004 + time + band) * (45 + impact * 30) + band * 70);
      }
      bgCtx.lineTo(width, height);
      bgCtx.lineTo(-width, height);
      bgCtx.closePath();
      bgCtx.fill();
    }
  } else {
    bgCtx.strokeStyle = `hsla(${(hue + 100) % 360}, 95%, 70%, ${0.1 + intensity * 0.1})`;
    bgCtx.lineWidth = 1.3;
    const size = 42;
    for (let y = -height; y < height; y += size * 1.72) {
      for (let x = -width; x < width; x += size * 1.5) {
        const offset = (Math.floor(y / (size * 1.72)) % 2) * size * 0.75;
        const pulseCell = 0.5 + Math.sin(time * 2 + x * 0.01 + y * 0.008) * 0.5;
        bgCtx.globalAlpha = 0.04 + pulseCell * 0.12;
        bgCtx.beginPath();
        for (let side = 0; side < 6; side += 1) {
          const angle = Math.PI / 3 * side;
          const px = x + offset + Math.cos(angle) * size * 0.42;
          const py = y + Math.sin(angle) * size * 0.42;
          if (side === 0) bgCtx.moveTo(px, py);
          else bgCtx.lineTo(px, py);
        }
        bgCtx.closePath();
        bgCtx.stroke();
      }
    }
  }
  bgCtx.restore();

  if (backgroundFlash > 0) {
    bgCtx.fillStyle = `hsla(${hue}, 100%, 75%, ${backgroundFlash * 0.16})`;
    bgCtx.fillRect(0, 0, width, height);
  }
}

function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getDropInterval(currentLevel) {
  return Math.max(120, 800 - (currentLevel - 1) * 70);
}

function refillQueue() {
  queue.push(...shuffle(TYPE_ORDER));
}

function takeFromQueue() {
  if (queue.length < 7) {
    refillQueue();
  }
  return queue.shift();
}

function createPiece(type) {
  const matrix = SHAPES[type].map((row) => row.slice());
  const width = matrix[0].length;
  return {
    type,
    matrix,
    x: Math.floor((COLS - width) / 2),
    y: -1
  };
}

function rotateMatrix(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      rotated[x][rows - 1 - y] = matrix[y][x];
    }
  }

  return rotated;
}

function collides(piece, offsetX = 0, offsetY = 0, testMatrix = piece.matrix) {
  for (let y = 0; y < testMatrix.length; y += 1) {
    for (let x = 0; x < testMatrix[y].length; x += 1) {
      if (!testMatrix[y][x]) continue;

      const newX = piece.x + x + offsetX;
      const newY = piece.y + y + offsetY;

      if (newX < 0 || newX >= COLS || newY >= ROWS) {
        return true;
      }

      if (newY >= 0 && board[newY][newX]) {
        return true;
      }
    }
  }

  return false;
}

function mergePiece() {
  currentPiece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const boardY = currentPiece.y + y;
      const boardX = currentPiece.x + x;
      if (boardY >= 0) {
        board[boardY][boardX] = currentPiece.type;
      }
    });
  });
}

function clearLines() {
  const rowsToClear = [];

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      rowsToClear.push(y);
    }
  }

  if (rowsToClear.length === 0) {
    return 0;
  }

  isClearing = true;
  const cells = [];
  rowsToClear.forEach((y) => {
    for (let x = 0; x < COLS; x += 1) {
      if (board[y][x]) {
        cells.push({ x, y });
      }
    }
  });

  clearEffect = cells;
  const cleared = rowsToClear.length;
  rowsToClear.forEach((y) => {
    for (let x = 0; x < COLS; x += 1) {
      if (board[y][x]) {
        createParticles(x * BLOCK, y * BLOCK, COLORS[board[y][x]], cleared === 4 ? 10 : 5);
      }
    }
  });
  shakeTime = cleared === 4 ? 18 : 5;
  backgroundImpact = cleared === 4 ? 1 : 0.45;
  backgroundFlash = cleared === 4 ? 1 : 0.45;
  if (cleared === 4) {
    floatingTexts.push({ text: 'TETRIS!', x: boardCanvas.width / 2, y: boardCanvas.height / 2, color: '#facc15', scale: 0.55, alpha: 1 });
    shockwave = { radius: 20, alpha: 0.9 };
  } else if (combo > 0) {
    floatingTexts.push({
      text: `COMBO x ${combo + 1}`,
      x: boardCanvas.width / 2,
      y: boardCanvas.height / 2 + 42,
      color: '#fbbf24',
      scale: 0.48,
      alpha: 1
    });
  }
  const lineScores = [0, 100, 300, 500, 800];
  const nextCombo = combo + 1;
  score += lineScores[cleared] * level + Math.max(0, nextCombo - 1) * 50 * level;
  lines += cleared;
  combo = nextCombo;
  const previousLevel = level;
  level = Math.floor(lines / LINES_PER_LEVEL) + 1;
  dropInterval = getDropInterval(level);
  gameAudio.setMusicLevel(level);
  updateMusicState(cleared);
  updateStats();
  if (combo > 1) {
    gameAudio.combo(combo);
  }
  if (level > previousLevel) {
    floatingTexts.push({
      text: `LEVEL ${level}!`,
      x: boardCanvas.width / 2,
      y: boardCanvas.height / 2 - 42,
      color: '#67e8f9',
      scale: 0.58,
      alpha: 1
    });
    backgroundFlash = 1;
    shakeTime = Math.max(shakeTime, 8);
    gameAudio.levelUp(level);
  }
  if (cleared === 4) {
    gameAudio.tetris();
  } else {
    gameAudio.clear(cleared);
  }

  const boardSnapshot = board.map((row) => row.slice());
  clearTimeoutId = setTimeout(() => {
    const rows = new Set(rowsToClear);
    const remaining = boardSnapshot.filter((_, y) => !rows.has(y));
    while (remaining.length < ROWS) {
      remaining.unshift(Array(COLS).fill(null));
    }
    board.splice(0, board.length, ...remaining);
    clearEffect = [];
    isClearing = false;
    clearTimeoutId = null;
    spawnPiece();
    scheduleDrop();
    drawBoard();
    drawHoldPreview();
    drawNextPreview();
  }, 140);

  return cleared;
}

function updateStats() {
  scoreEl.textContent = String(score);
  linesEl.textContent = String(lines);
  levelEl.textContent = String(level);
}

function updateMusicState(clearedLines = 0) {
  let highestRow = ROWS;
  let occupied = 0;

  board.forEach((row, y) => {
    row.forEach((cell) => {
      if (cell) {
        occupied += 1;
        highestRow = Math.min(highestRow, y);
      }
    });
  });

  const stackHeight = highestRow === ROWS ? 0 : ROWS - highestRow;
  const danger = Math.max(
    stackHeight / ROWS,
    (occupied / (COLS * ROWS)) * 1.35
  );
  gameAudio.setMusicState({ danger, clearedLines, combo });
}

function spawnPiece() {
  if (currentPiece === null) {
    currentPiece = createPiece(takeFromQueue());
    nextPiece = createPiece(takeFromQueue());
  } else {
    currentPiece = createPiece(nextPiece.type);
    nextPiece = createPiece(takeFromQueue());
  }

  currentPiece.x = Math.floor((COLS - currentPiece.matrix[0].length) / 2);
  currentPiece.y = -1;
  heldThisTurn = false;

  if (collides(currentPiece)) {
    endGame();
  }
}

function lockPiece() {
  mergePiece();
  const cleared = clearLines();

  if (cleared === 0) {
    combo = 0;
    updateMusicState();
    spawnPiece();
    drawBoard();
    drawHoldPreview();
    drawNextPreview();
  }
}

function movePiece(offsetX, offsetY) {
  if (!currentPiece || isPaused || gameOver || !isRunning) return;

  if (!collides(currentPiece, offsetX, offsetY)) {
    currentPiece.x += offsetX;
    currentPiece.y += offsetY;
    if (offsetX !== 0) {
      gameAudio.move();
    } else if (offsetY > 0) {
      gameAudio.softDrop();
    }
    drawBoard();
  } else if (offsetY > 0) {
    lockPiece();
  }
}

function rotatePiece() {
  if (!currentPiece || isPaused || gameOver || !isRunning) return;

  const rotated = rotateMatrix(currentPiece.matrix);
  const kicks = [0, -1, 1, -2, 2, -3, 3];

  for (const kick of kicks) {
    if (!collides(currentPiece, kick, 0, rotated)) {
      currentPiece.matrix = rotated;
      currentPiece.x += kick;
      gameAudio.rotate();
      drawBoard();
      return;
    }
  }
}

function hardDrop() {
  if (!currentPiece || isPaused || gameOver || !isRunning) return;

  let distance = 0;
  while (!collides(currentPiece, 0, 1)) {
    currentPiece.y += 1;
    distance += 1;
  }

  score += distance * 2;
  gameAudio.hardDrop();
  updateStats();
  lockPiece();
}

function holdCurrentPiece() {
  if (!currentPiece || isPaused || gameOver || !isRunning || heldThisTurn) return;

  const currentType = currentPiece.type;

  if (holdType === null) {
    holdType = currentType;
    spawnPiece();
  } else {
    const nextType = holdType;
    holdType = currentType;
    currentPiece = createPiece(nextType);
    currentPiece.x = Math.floor((COLS - currentPiece.matrix[0].length) / 2);
    currentPiece.y = -1;

    if (collides(currentPiece)) {
      endGame();
      return;
    }
  }

  heldThisTurn = true;
  gameAudio.hold();
  drawBoard();
  drawHoldPreview();
  drawNextPreview();
}

function getGhostY() {
  if (!currentPiece) return 0;

  const ghostPiece = {
    ...currentPiece,
    matrix: currentPiece.matrix.map((row) => row.slice())
  };

  while (!collides(ghostPiece, 0, 1)) {
    ghostPiece.y += 1;
  }

  return ghostPiece.y;
}

function drawCell(ctx, x, y, color, size, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const px = x * size;
  const py = y * size;
  const gradient = ctx.createLinearGradient(px, py, px + size, py + size);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.08, color);
  gradient.addColorStop(1, '#0f172a');
  ctx.fillStyle = gradient;
  ctx.shadowColor = color;
  ctx.shadowBlur = alpha > 0.5 ? 5 : 0;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(px + 2, py + 2, size - 4, 3);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
  ctx.restore();
}

function createParticles(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x: x + BLOCK / 2,
      y: y + BLOCK / 2,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 4 - 1,
      size: 2 + Math.random() * 4,
      color,
      alpha: 1,
      life: 0.92 + Math.random() * 0.05
    });
  }
}

function updateEffects(delta) {
  const frame = Math.min(delta / 16.67, 2);
  particles = particles.filter((particle) => {
    particle.x += particle.vx * frame;
    particle.y += particle.vy * frame;
    particle.vy += 0.22 * frame;
    particle.alpha *= Math.pow(particle.life, frame);
    return particle.alpha > 0.05;
  });

  floatingTexts = floatingTexts.filter((text) => {
    text.y -= 0.7 * frame;
    text.scale += 0.018 * frame;
    text.alpha -= 0.018 * frame;
    return text.alpha > 0;
  });

  shakeTime = Math.max(0, shakeTime - frame);
  backgroundImpact = Math.max(0, backgroundImpact - 0.045 * frame);
  backgroundFlash = Math.max(0, backgroundFlash - 0.06 * frame);
  if (shockwave) {
    shockwave.radius += 8 * frame;
    shockwave.alpha -= 0.045 * frame;
    if (shockwave.alpha <= 0) shockwave = null;
  }
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardCtx.save();
  if (shakeTime > 0) {
    boardCtx.translate(
      (Math.random() - 0.5) * shakeTime * 0.7,
      (Math.random() - 0.5) * shakeTime * 0.7
    );
  }

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = board[y][x];
      if (cell) {
        drawCell(boardCtx, x, y, COLORS[cell], BLOCK);
      } else {
        boardCtx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
        boardCtx.strokeRect(x * BLOCK + 0.5, y * BLOCK + 0.5, BLOCK - 1, BLOCK - 1);
      }
    }
  }

  if (currentPiece) {
    const ghostY = getGhostY();

    currentPiece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (!value) return;
        const ghostX = currentPiece.x + x;
        const ghostDrawY = ghostY + y;
        if (ghostDrawY >= 0) {
          drawCell(boardCtx, ghostX, ghostDrawY, COLORS[currentPiece.type], BLOCK, 0.22);
        }
      });
    });

    currentPiece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (!value) return;
        const drawX = currentPiece.x + x;
        const drawY = currentPiece.y + y;
        if (drawY >= 0) {
          drawCell(boardCtx, drawX, drawY, COLORS[currentPiece.type], BLOCK, 1);
        }
      });
    });
  }

  if (clearEffect.length) {
    const pulse = 0.45 + ((Math.sin(performance.now() / 28) + 1) * 0.55);
    clearEffect.forEach(({ x, y }) => {
      drawCell(boardCtx, x, y, '#f8fafc', BLOCK, pulse);
    });
    boardCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  }

  particles.forEach((particle) => {
    boardCtx.save();
    boardCtx.globalAlpha = particle.alpha;
    boardCtx.fillStyle = particle.color;
    boardCtx.shadowColor = particle.color;
    boardCtx.shadowBlur = 7;
    boardCtx.fillRect(particle.x, particle.y, particle.size, particle.size);
    boardCtx.restore();
  });

  if (shockwave) {
    boardCtx.save();
    boardCtx.globalAlpha = shockwave.alpha;
    boardCtx.strokeStyle = '#facc15';
    boardCtx.lineWidth = 4;
    boardCtx.shadowColor = '#facc15';
    boardCtx.shadowBlur = 16;
    boardCtx.beginPath();
    boardCtx.arc(boardCanvas.width / 2, boardCanvas.height / 2, shockwave.radius, 0, Math.PI * 2);
    boardCtx.stroke();
    boardCtx.restore();
  }

  floatingTexts.forEach((text) => {
    boardCtx.save();
    boardCtx.globalAlpha = text.alpha;
    boardCtx.fillStyle = text.color;
    boardCtx.textAlign = 'center';
    boardCtx.font = `900 ${Math.floor(30 * text.scale)}px Segoe UI`;
    boardCtx.shadowColor = text.color;
    boardCtx.shadowBlur = 14;
    boardCtx.fillText(text.text, text.x, text.y);
    boardCtx.restore();
  });

  if (isPaused && !gameOver) {
    boardCtx.fillStyle = 'rgba(2, 8, 23, 0.7)';
    boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    boardCtx.fillStyle = '#f8fafc';
    boardCtx.font = 'bold 30px Segoe UI';
    boardCtx.textAlign = 'center';
    boardCtx.fillText('PAUSED', boardCanvas.width / 2, boardCanvas.height / 2);
  }
  boardCtx.restore();
}

function drawPreview(ctx, canvas, piece) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!piece) return;

  const matrix = piece.matrix;
  const cellSize = canvas.width / PREVIEW_SIZE;
  const offsetX = Math.floor((PREVIEW_SIZE - matrix[0].length) / 2);
  const offsetY = Math.floor((PREVIEW_SIZE - matrix.length) / 2);

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const px = (x + offsetX) * cellSize;
      const py = (y + offsetY) * cellSize;
      ctx.fillStyle = COLORS[piece.type];
      ctx.fillRect(px, py, cellSize, cellSize);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
    });
  });
}

function drawHoldPreview() {
  drawPreview(holdCtx, holdCanvas, holdType ? createPiece(holdType) : null);
}

function drawNextPreview() {
  drawPreview(nextCtx, nextCanvas, nextPiece);
}

function resetGame(startImmediately = true) {
  gameAudio.stopMusic();
  if (dropTimerId) {
    clearInterval(dropTimerId);
    dropTimerId = null;
  }

  if (clearTimeoutId) {
    clearTimeout(clearTimeoutId);
    clearTimeoutId = null;
  }

  clearEffect = [];
  particles = [];
  floatingTexts = [];
  shakeTime = 0;
  shockwave = null;
  backgroundImpact = 0;
  backgroundFlash = 0;
  backgroundHue = 190;
  isClearing = false;
  dropCount = 0;
  lastInput = 'reset';

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      board[y][x] = null;
    }
  }

  queue = [];
  holdType = null;
  heldThisTurn = false;
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  dropInterval = getDropInterval(level);
  gameAudio.setMusicLevel(level);
  updateMusicState();
  isPaused = false;
  gameOver = false;
  menuScreen.hidden = true;
  menuScreen.classList.remove('is-visible');
  lastTime = 0;
  dropAccumulator = 0;
  currentPiece = null;
  nextPiece = null;
  isRunning = startImmediately;
  spawnPiece();
  updateStats();
  drawBoard();
  drawHoldPreview();
  drawNextPreview();
  if (startImmediately) {
    scheduleDrop();
  }
  updateDebugStatus();
}

async function startGame() {
  if (isGameStarted) return;
  isGameStarted = true;
  gameAudio.stopMusic();
  musicScreen.hidden = true;
  musicScreen.classList.remove('is-visible');
  startScreen.hidden = true;
  startScreen.classList.remove('is-visible');
  resetGame(true);
  await gameAudio.start();
  await gameAudio.startMusic();
}

async function playMusicPreview() {
  const selectedLevel = Number(previewLevel.value);
  gameAudio.stopMusic();
  gameAudio.setMusicLevel(selectedLevel);
  await gameAudio.start();
  await gameAudio.startMusic();
  previewPlayBtn.textContent = 'PLAYING...';
}

function stopMusicPreview() {
  gameAudio.stopMusic();
  previewPlayBtn.textContent = 'PLAY MUSIC';
}

function showPauseMenu() {
  if (!isRunning || gameOver) return;
  isPaused = true;
  menuScreen.hidden = false;
  menuScreen.classList.add('is-visible');
  gameAudio.start();
  drawBoard();
}

function hidePauseMenu() {
  menuScreen.hidden = true;
  menuScreen.classList.remove('is-visible');
  isPaused = false;
  isRunning = true;
  if (!dropTimerId) {
    scheduleDrop();
  }
  gameAudio.start();
  gameAudio.startMusic();
  drawBoard();
}

function scheduleDrop() {
  if (dropTimerId) {
    clearInterval(dropTimerId);
  }

  dropTimerId = setInterval(() => {
    if (isRunning && !isPaused && !gameOver && !isClearing) {
      dropCount += 1;
      movePiece(0, 1);
    }
    updateDebugStatus();
  }, dropInterval);
  updateDebugStatus();
}

function endGame() {
  gameOver = true;
  isRunning = false;
  if (dropTimerId) {
    clearInterval(dropTimerId);
    dropTimerId = null;
  }
  gameAudio.gameOver();
  drawBoard();
  drawNextPreview();
  boardCtx.fillStyle = 'rgba(2, 8, 23, 0.7)';
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardCtx.fillStyle = '#f8fafc';
  boardCtx.font = 'bold 28px Segoe UI';
  boardCtx.textAlign = 'center';
  boardCtx.fillText('GAME OVER', boardCanvas.width / 2, boardCanvas.height / 2);
}

function tick(timestamp) {
  if (!isRunning) {
    requestAnimationFrame(tick);
    return;
  }

  if (!lastTime) lastTime = timestamp;
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  updateEffects(delta);
  drawBoard();
  requestAnimationFrame(tick);
}

function togglePause() {
  if (!isRunning || gameOver) return;
  if (isPaused) {
    hidePauseMenu();
  } else {
    showPauseMenu();
  }
}

function handleTouchAction(action) {
  lastInput = `touch:${action}`;
  updateDebugStatus();
  if (action === 'pause') {
    togglePause();
    return;
  }

  if (isPaused || gameOver) {
    return;
  }

  switch (action) {
    case 'left':
      movePiece(-1, 0);
      break;
    case 'right':
      movePiece(1, 0);
      break;
    case 'down':
      movePiece(0, 1);
      score += 1;
      updateStats();
      break;
    case 'rotate':
      rotatePiece();
      break;
    case 'drop':
      hardDrop();
      break;
    case 'hold':
      holdCurrentPiece();
      break;
    default:
      break;
  }
}

window.addEventListener('keydown', (event) => {
  const key = event.code;
  lastInput = `key:${key}`;
  updateDebugStatus();

  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(key)) {
    event.preventDefault();
  }
  if (!isGameStarted) {
    if (key === 'Space' || key === 'Enter') {
      event.preventDefault();
      startGame();
    }
    return;
  }

  if (typeof gameAudio !== 'undefined') {
    gameAudio.start();
    gameAudio.startMusic();
  }

  if (key === 'KeyP') {
    togglePause();
    return;
  }

  if (!isRunning && !gameOver) {
    isRunning = true;
    isPaused = false;
    if (!dropTimerId) {
      scheduleDrop();
    }
  }

  if (isPaused || gameOver) {
    return;
  }

  switch (key) {
    case 'ArrowLeft':
      movePiece(-1, 0);
      break;
    case 'ArrowRight':
      movePiece(1, 0);
      break;
    case 'ArrowDown':
      movePiece(0, 1);
      score += 1;
      updateStats();
      break;
    case 'ArrowUp':
      hardDrop();
      break;
    case 'Space':
    case 'KeyX':
      rotatePiece();
      break;
    case 'KeyC':
      holdCurrentPiece();
      break;
    default:
      break;
  }
});

startBtn.addEventListener('click', async () => {
  if (typeof gameAudio !== 'undefined') {
    gameAudio.start();
  }
  isGameStarted = true;
  resetGame();
  await gameAudio.startMusic();
});

menuStartBtn.addEventListener('click', hidePauseMenu);
titleStartBtn.addEventListener('click', startGame);
musicPreviewBtn.addEventListener('click', () => {
  musicScreen.hidden = false;
  musicScreen.classList.add('is-visible');
  startScreen.hidden = true;
  startScreen.classList.remove('is-visible');
});
previewPlayBtn.addEventListener('click', playMusicPreview);
previewStopBtn.addEventListener('click', stopMusicPreview);
previewBackBtn.addEventListener('click', () => {
  stopMusicPreview();
  musicScreen.hidden = true;
  musicScreen.classList.remove('is-visible');
  startScreen.hidden = false;
  startScreen.classList.add('is-visible');
});
previewLevel.addEventListener('input', () => {
  previewLevelValue.textContent = previewLevel.value;
  gameAudio.setMusicLevel(Number(previewLevel.value));
});

soundBtn.addEventListener('click', () => {
  const muted = gameAudio.toggleMute();
  soundBtn.textContent = muted ? 'Sound: OFF' : 'Sound: ON';
});

volumeSlider.addEventListener('input', () => {
  const volume = Number(volumeSlider.value);
  gameAudio.setVolume(volume / 100);
  volumeValue.textContent = `${volume}%`;
  gameAudio.start();
  gameAudio.preview(volume / 150);
});

musicVolumeSlider.addEventListener('input', () => {
  const volume = Number(musicVolumeSlider.value);
  gameAudio.setMusicVolume(volume / 100);
  musicVolumeValue.textContent = `${volume}%`;
});

actionButtons.forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(8);
    }
    if (typeof gameAudio !== 'undefined') {
      gameAudio.start();
    }
    handleTouchAction(button.dataset.action);
  });
});

window.addEventListener('error', (event) => {
  updateDebugStatus(event.message || 'unknown');
});

resetGame(false);
resizeBackground();
window.addEventListener('resize', resizeBackground);
window.requestAnimationFrame(function animateBackground(timestamp) {
  drawBackground(timestamp);
  window.requestAnimationFrame(animateBackground);
});
requestAnimationFrame(tick);
