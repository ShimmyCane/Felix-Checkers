/**
 * Felix Checkers - UI & Interaction Controller
 * Tailored for iPad and kid-friendly play.
 */

const LEVEL_HELP = {
  1: 'Gentle: makes lots of random moves. Great for beginners.',
  2: 'Easy: grabs quick captures but misses tricks.',
  3: 'Smart: thinks two moves ahead.',
  4: 'Tricky: looks three moves ahead.',
  5: 'Master: looks four moves ahead. Good luck!'
};

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const boardGrid = document.getElementById('boardGrid');
  const redIndicator = document.getElementById('redIndicator');
  const blackIndicator = document.getElementById('blackIndicator');
  const redCountEl = document.getElementById('redCount');
  const blackCountEl = document.getElementById('blackCount');
  const modeTag = document.getElementById('modeTag');
  const messageBanner = document.getElementById('messageBanner');
  const btnUndo = document.getElementById('btnUndo');
  const btnRestart = document.getElementById('btnRestart');

  // Settings Elements
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const btnApplySettings = document.getElementById('btnApplySettings');
  const soundToggle = document.getElementById('soundToggle');
  const rowToggleGroup = document.getElementById('rowToggleGroup');
  const variantToggleGroup = document.getElementById('variantToggleGroup');
  const opponentToggleGroup = document.getElementById('opponentToggleGroup');
  const levelSettingGroup = document.getElementById('levelSettingGroup');
  const levelToggleGroup = document.getElementById('levelToggleGroup');
  const levelHelp = document.getElementById('levelHelp');

  // Scoreboard Elements
  const scoreAiEl = document.getElementById('scoreAi');
  const scorePvpEl = document.getElementById('scorePvp');
  const scoreChipsEl = document.getElementById('scoreChips');
  const btnResetScores = document.getElementById('btnResetScores');

  // Maintenance: win-chance bar (hidden unless switched on)
  const boardRow = document.getElementById('boardRow');
  const evalBar = document.getElementById('evalBar');
  const evalBlack = document.getElementById('evalBlack');
  const evalRed = document.getElementById('evalRed');
  const evalLabel = document.getElementById('evalLabel');
  const evalToggle = document.getElementById('evalToggle');

  // Win Modal
  const winModalOverlay = document.getElementById('winModalOverlay');
  const winTitle = document.getElementById('winTitle');
  const winSubtitle = document.getElementById('winSubtitle');
  const btnPlayAgain = document.getElementById('btnPlayAgain');

  // State Configuration
  let currentConfig = {
    rowsOption: 3,
    variant: 'standard',
    opponentType: 'pvp',
    aiLevel: 3
  };

  let pendingConfig = { ...currentConfig };
  let engine = new CheckersEngine(currentConfig);
  let isAiThinking = false;
  // Bumped whenever the board is replaced, so a computer move scheduled for an
  // old game can never land on a new one.
  let gameId = 0;
  let stats = FelixStats.load();

  // Win-chance bar preference: off by default, remembered on this device
  const EVAL_KEY = 'felixShowEvalBar';
  let showEvalBar = false;
  try {
    showEvalBar = localStorage.getItem(EVAL_KEY) === '1';
  } catch (e) {
    showEvalBar = false; // storage blocked: fall back to hidden
  }
  evalToggle.checked = showEvalBar;

  // Shows Black's (computer's) and Red's estimated chance of winning
  function updateEvalBar() {
    if (!showEvalBar) {
      evalBar.hidden = true;
      boardRow.classList.remove('with-eval');
      return;
    }
    boardRow.classList.add('with-eval');
    evalBar.hidden = false;

    const blackChance = engine.winChance(3);
    const blackPct = Math.round(blackChance * 100);
    evalBlack.style.height = `${blackPct}%`;
    evalRed.style.height = `${100 - blackPct}%`;

    const leaderPct = Math.max(blackPct, 100 - blackPct);
    evalLabel.textContent = `${leaderPct}%`;
    evalBar.title = `Chance to win: Red ${100 - blackPct}% · Black ${blackPct}%`;
  }

  evalToggle.addEventListener('change', () => {
    showEvalBar = evalToggle.checked;
    try {
      localStorage.setItem(EVAL_KEY, showEvalBar ? '1' : '0');
    } catch (e) {
      // ignore: preference just won't persist
    }
    updateEvalBar();
  });

  function startFreshGame(config) {
    if (config) engine = new CheckersEngine(config);
    else engine.resetBoard();
    gameId++;
    isAiThinking = false;
    winModalOverlay.classList.remove('open');
    renderBoard();
  }

  // Render the initial 8x8 Board DOM
  function createBoardDOM() {
    boardGrid.innerHTML = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = document.createElement('div');
        sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        sq.dataset.row = r;
        sq.dataset.col = c;

        sq.addEventListener('click', (e) => handleSquareClick(r, c, e));
        boardGrid.appendChild(sq);
      }
    }
  }

  // Update Board Display & Piece Elements
  function renderBoard() {
    const squares = boardGrid.querySelectorAll('.square');
    squares.forEach(sq => {
      const r = parseInt(sq.dataset.row, 10);
      const c = parseInt(sq.dataset.col, 10);
      const piece = engine.getPiece(r, c);

      // Clear existing highlight classes
      sq.classList.remove('selected-origin', 'valid-move', 'valid-jump');
      sq.innerHTML = '';

      // Check highlights
      if (engine.selectedSquare && engine.selectedSquare.r === r && engine.selectedSquare.c === c) {
        sq.classList.add('selected-origin');
      }

      const move = engine.validMovesForSelected.find(m => m.to.r === r && m.to.c === c);
      if (move) {
        if (move.isJump) {
          sq.classList.add('valid-jump');
        } else {
          sq.classList.add('valid-move');
        }
      }

      // Render Piece if present
      if (piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className = `piece ${piece.player}`;

        if (piece.isKing) {
          pieceEl.classList.add('is-king');
        }

        if (piece.type === 'queen') {
          pieceEl.classList.add('chess-queen');
        } else if (piece.type === 'bishop') {
          pieceEl.classList.add('chess-bishop');
        }

        if (engine.selectedSquare && engine.selectedSquare.r === r && engine.selectedSquare.c === c) {
          pieceEl.classList.add('selected');
        }

        sq.appendChild(pieceEl);
      }
    });

    updateStatusUI();
  }

  // Update Status Pill, Header Tags, and Counts
  function updateStatusUI() {
    const counts = engine.getPieceCounts();
    redCountEl.textContent = counts.red;
    blackCountEl.textContent = counts.black;

    // Turn indicator active states
    if (engine.turn === PLAYER_RED) {
      redIndicator.classList.add('active');
      blackIndicator.classList.remove('active');
    } else {
      blackIndicator.classList.add('active');
      redIndicator.classList.remove('active');
    }

    // Mode Tag
    const rowText = currentConfig.rowsOption === 2 ? '2 Rows' : '3 Rows';
    const variantText = currentConfig.variant === 'felix' ? 'Felix ✨' : 'Standard';
    const playersText = currentConfig.opponentType === 'ai'
      ? `1 Player · Lv ${currentConfig.aiLevel}`
      : '2 Players';
    modeTag.textContent = `${variantText} • ${rowText} • ${playersText}`;

    updateEvalBar();

    // Message Banner
    if (engine.isMultiJumping) {
      messageBanner.textContent = "Great jump! Another jump is available!";
    } else if (isAiThinking) {
      messageBanner.textContent = "Computer is thinking... 🤖";
    } else {
      const turnName = engine.turn === PLAYER_RED
        ? (currentConfig.opponentType === 'ai' ? 'Your' : 'Red')
        : (currentConfig.opponentType === 'ai' ? "Computer's" : 'Black');
      messageBanner.textContent = `${turnName} Turn - Choose a piece to move!`;
    }
  }

  // Handle Square Interaction
  function handleSquareClick(r, c) {
    if (isAiThinking) return;
    if (engine.winner) return;

    // In 1 Player mode, ignore clicks when it's the computer's turn
    if (currentConfig.opponentType === 'ai' && engine.turn === PLAYER_BLACK) {
      return;
    }

    const clickedPiece = engine.getPiece(r, c);

    // 1. If currently a piece is selected and the clicked square is a valid target move
    const targetMove = engine.validMovesForSelected.find(m => m.to.r === r && m.to.c === c);
    if (targetMove) {
      executeMove(targetMove);
      return;
    }

    // 2. If locked in a multi-jump, cannot select other pieces
    if (engine.isMultiJumping) {
      return;
    }

    // 3. Selecting a piece belonging to the active player
    if (clickedPiece && clickedPiece.player === engine.turn) {
      const moves = engine.getValidMoves(r, c);
      engine.selectedSquare = { r, c };
      engine.validMovesForSelected = moves;
      if (moves.length > 0) {
        window.soundEffects.playMove();
      }
      renderBoard();
      return;
    }

    // 4. Clicked an empty square or opponent piece when not moving: deselect
    if (engine.selectedSquare) {
      engine.selectedSquare = null;
      engine.validMovesForSelected = [];
      renderBoard();
    }
  }

  function playMoveSound(result) {
    if (result.becameKing) {
      window.soundEffects.playKing();
    } else if (result.wasCaptured) {
      window.soundEffects.playCapture();
    } else {
      window.soundEffects.playMove();
    }
  }

  // Execute Move
  function executeMove(move) {
    const result = engine.makeMove(move);
    if (!result.success) return;

    playMoveSound(result);
    renderBoard();

    // Check Win Condition
    if (result.gameOver && result.gameOver.isOver) {
      triggerGameOver(result.gameOver);
      return;
    }

    // If multi-jump is available, wait for player's next jump
    if (result.multiJumpAvailable) {
      return;
    }

    // If opponent is the computer and it's Black's turn, trigger its move after a short friendly delay
    if (currentConfig.opponentType === 'ai' && engine.turn === PLAYER_BLACK) {
      triggerAiMove();
    }
  }

  // Computer turn handling with kid-friendly pacing
  function triggerAiMove() {
    const myGame = gameId;
    isAiThinking = true;
    updateStatusUI();

    setTimeout(() => {
      if (myGame !== gameId) return; // board was replaced while thinking
      if (engine.winner) {
        isAiThinking = false;
        return;
      }

      const aiMove = engine.getBestAIMove(currentConfig.aiLevel);
      if (!aiMove) {
        isAiThinking = false;
        return;
      }

      // Select piece briefly to show intent
      engine.selectedSquare = aiMove.from;
      engine.validMovesForSelected = [aiMove];
      renderBoard();

      setTimeout(() => {
        if (myGame !== gameId) return;
        const res = engine.makeMove(aiMove);
        playMoveSound(res);
        renderBoard();

        if (res.gameOver && res.gameOver.isOver) {
          isAiThinking = false;
          triggerGameOver(res.gameOver);
          return;
        }

        // Computer multi-jumps continue with the same pacing
        if (res.multiJumpAvailable) {
          setTimeout(() => {
            if (myGame !== gameId) return;
            triggerAiMove();
          }, 600);
        } else {
          isAiThinking = false;
          renderBoard();
        }
      }, 350);
    }, 600);
  }

  // Name shown for a side: in 1 Player mode Red is "You" and Black is "Computer"
  function sideName(player) {
    if (currentConfig.opponentType === 'ai') {
      return player === PLAYER_RED ? 'You' : 'Computer';
    }
    return player === PLAYER_RED ? 'Red' : 'Black';
  }

  // Game Over Handling
  function triggerGameOver(info) {
    window.soundEffects.playWin();

    // Record the result (once per finished game) in the cookie
    if (currentConfig.opponentType === 'ai') {
      stats = FelixStats.recordGame(stats, { mode: 'ai', winner: info.winner, level: currentConfig.aiLevel });
    } else {
      stats = FelixStats.recordGame(stats, { mode: 'pvp', winner: info.winner });
    }
    FelixStats.save(stats);
    renderScoreboard();

    const winnerName = sideName(info.winner);
    if (winnerName === 'You') {
      winTitle.textContent = 'You Win! 🏆';
    } else {
      winTitle.textContent = `${winnerName} Wins! 🏆`;
    }

    const scoreText = currentConfig.opponentType === 'ai'
      ? `Score: You ${stats.ai.wins[currentConfig.aiLevel]} – ${stats.ai.losses[currentConfig.aiLevel]} Computer at Level ${currentConfig.aiLevel}`
      : `Score: Red ${stats.pvp.red} – ${stats.pvp.black} Black`;
    winSubtitle.textContent = `${info.reason} ${scoreText}`;
    winModalOverlay.classList.add('open');
  }

  // Scoreboard (numbers only, read from the cookie-backed stats)
  function renderScoreboard() {
    const totals = FelixStats.totals(stats);
    scoreAiEl.textContent = `${totals.playerWins} – ${totals.computerWins}`;
    scorePvpEl.textContent = `${stats.pvp.red} – ${stats.pvp.black}`;

    scoreChipsEl.innerHTML = '';
    FelixStats.LEVELS.forEach(level => {
      const chip = document.createElement('div');
      chip.className = 'score-chip';
      const label = document.createElement('span');
      label.textContent = `Lv ${level}`;
      const record = document.createElement('b');
      record.textContent = `${stats.ai.wins[level]} – ${stats.ai.losses[level]}`;
      chip.append(label, record);
      scoreChipsEl.appendChild(chip);
    });
  }

  // Settings Drawer Toggle
  function openSettings() {
    pendingConfig = { ...currentConfig };
    syncSettingsPills();
    renderScoreboard();
    settingsOverlay.classList.add('open');
  }

  function closeSettings() {
    settingsOverlay.classList.remove('open');
  }

  function syncSettingsPills() {
    // Row Count
    rowToggleGroup.querySelectorAll('.pill-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.rows, 10) === pendingConfig.rowsOption);
    });

    // Variant
    variantToggleGroup.querySelectorAll('.pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.variant === pendingConfig.variant);
    });

    // Players (1 Player = vs computer, 2 Players = pass & play)
    opponentToggleGroup.querySelectorAll('.pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.opponent === pendingConfig.opponentType);
    });

    // Computer level: only relevant for 1 Player
    const vsComputer = pendingConfig.opponentType === 'ai';
    levelSettingGroup.hidden = !vsComputer;
    levelToggleGroup.querySelectorAll('.level-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.level, 10) === pendingConfig.aiLevel);
    });
    levelHelp.textContent = LEVEL_HELP[pendingConfig.aiLevel];
  }

  // Settings Pill Clicks
  rowToggleGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    pendingConfig.rowsOption = parseInt(btn.dataset.rows, 10);
    syncSettingsPills();
  });

  variantToggleGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    pendingConfig.variant = btn.dataset.variant;
    syncSettingsPills();
  });

  opponentToggleGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    pendingConfig.opponentType = btn.dataset.opponent;
    syncSettingsPills();
  });

  levelToggleGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.level-btn');
    if (!btn) return;
    pendingConfig.aiLevel = parseInt(btn.dataset.level, 10);
    syncSettingsPills();
  });

  soundToggle.addEventListener('change', () => {
    window.soundEffects.enabled = soundToggle.checked;
  });

  btnApplySettings.addEventListener('click', () => {
    currentConfig = { ...pendingConfig };
    closeSettings();
    startFreshGame(currentConfig);
  });

  btnResetScores.addEventListener('click', () => {
    if (!confirm('Reset all scores on this device?')) return;
    stats = FelixStats.reset();
    FelixStats.save(stats);
    renderScoreboard();
  });

  // Undo button
  btnUndo.addEventListener('click', () => {
    if (isAiThinking) return;
    const success = engine.undo();
    if (success) {
      window.soundEffects.playMove();
      renderBoard();
    }
  });

  // Restart / New Game button
  btnRestart.addEventListener('click', () => {
    if (confirm("Start a fresh new game?")) {
      startFreshGame();
    }
  });

  // Win modal play again
  btnPlayAgain.addEventListener('click', () => {
    startFreshGame();
  });

  btnOpenSettings.addEventListener('click', openSettings);
  btnCloseSettings.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });

  // Initialize
  createBoardDOM();
  renderScoreboard();
  renderBoard();
});
