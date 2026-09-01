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
const gameShell = document.querySelector('.game-shell');
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');
const touchButtons = document.querySelectorAll('.touch-btn');
const debugStatus = document.getElementById('debug-status');

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
let gameOver = false;
let isClearing = false;
let clearEffect = [];
let clearTimeoutId = null;
let dropTimerId = null;
let dropCount = 0;
let lastInput = '-';

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
  const lineScores = [0, 100, 300, 500, 800];
  score += lineScores[cleared] * level;
  lines += cleared;
  level = Math.floor(lines / LINES_PER_LEVEL) + 1;
  dropInterval = getDropInterval(level);
  updateStats();
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
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x * size + 0.5, y * size + 0.5, size - 1, size - 1);
  ctx.restore();
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

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

  if (isPaused && !gameOver) {
    boardCtx.fillStyle = 'rgba(2, 8, 23, 0.7)';
    boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    boardCtx.fillStyle = '#f8fafc';
    boardCtx.font = 'bold 30px Segoe UI';
    boardCtx.textAlign = 'center';
    boardCtx.fillText('PAUSED', boardCanvas.width / 2, boardCanvas.height / 2);
  }
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

function resetGame() {
  if (dropTimerId) {
    clearInterval(dropTimerId);
    dropTimerId = null;
  }

  if (clearTimeoutId) {
    clearTimeout(clearTimeoutId);
    clearTimeoutId = null;
  }

  clearEffect = [];
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
  dropInterval = getDropInterval(level);
  isPaused = false;
  gameOver = false;
  lastTime = 0;
  dropAccumulator = 0;
  currentPiece = null;
  nextPiece = null;
  isRunning = true;
  spawnPiece();
  updateStats();
  drawBoard();
  drawHoldPreview();
  drawNextPreview();
  scheduleDrop();
  updateDebugStatus();
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
  gameAudio.start();
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
  if (!isRunning || isPaused || gameOver) {
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
    case 'pause':
      togglePause();
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
  gameAudio.start();

  if (key === 'KeyP') {
    togglePause();
    return;
  }

  if (!isRunning || isPaused || gameOver) {
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

startBtn.addEventListener('click', () => {
  gameAudio.start();
  resetGame();
});

menuStartBtn.addEventListener('click', hidePauseMenu);

soundBtn.addEventListener('click', () => {
  const muted = gameAudio.toggleMute();
  soundBtn.textContent = muted ? 'Sound: OFF' : 'Sound: ON';
});

volumeSlider.addEventListener('input', () => {
  const volume = Number(volumeSlider.value);
  gameAudio.setVolume(volume / 100);
  volumeValue.textContent = `${volume}%`;
  gameAudio.start();
  gameAudio.rotate();
});

touchButtons.forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    gameAudio.start();
    handleTouchAction(button.dataset.action);
  });
});

window.addEventListener('error', (event) => {
  updateDebugStatus(event.message || 'unknown');
});

resetGame();
requestAnimationFrame(tick);
