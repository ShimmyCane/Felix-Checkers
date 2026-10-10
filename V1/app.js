/**
 * Felix Checkers - UI & Interaction Controller
 * Tailored for iPad and kid-friendly play.
 */

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

  // Win Modal
  const winModalOverlay = document.getElementById('winModalOverlay');
  const winTitle = document.getElementById('winTitle');
  const winSubtitle = document.getElementById('winSubtitle');
  const btnPlayAgain = document.getElementById('btnPlayAgain');

  // State Configuration
  let currentConfig = {
    rowsOption: 3,
    variant: 'standard',
    opponentType: 'pvp'
  };

  let pendingConfig = { ...currentConfig };
  let engine = new CheckersEngine(currentConfig);
  let isAiThinking = false;

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
    const rowText = currentConfig.rowsOption === 2 ? 'Quick (2 Rows)' : 'Classic (3 Rows)';
    const variantText = currentConfig.variant === 'felix' ? 'Felix Mode ✨' : 'Standard';
    modeTag.textContent = `${variantText} &bull; ${rowText}`;
    modeTag.innerHTML = `${variantText} &bull; ${rowText}`;

    // Message Banner
    if (engine.isMultiJumping) {
      messageBanner.textContent = "Great jump! Another jump is available!";
    } else if (isAiThinking) {
      messageBanner.textContent = "Computer is thinking... 🤖";
    } else {
      const turnName = engine.turn === PLAYER_RED ? "Red" : (currentConfig.opponentType === 'ai' ? "Computer" : "Black");
      messageBanner.textContent = `${turnName}'s Turn - Choose a piece to move!`;
    }
  }

  // Handle Square Interaction
  function handleSquareClick(r, c) {
    if (isAiThinking) return;
    if (engine.winner) return;

    // In AI mode, ignore clicks when it's black's turn
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
      if (moves.length > 0) {
        engine.selectedSquare = { r, c };
        engine.validMovesForSelected = moves;
        window.soundEffects.playMove();
      } else {
        // Piece has no valid moves
        engine.selectedSquare = { r, c };
        engine.validMovesForSelected = [];
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

  // Execute Move
  function executeMove(move) {
    const result = engine.makeMove(move);
    if (!result.success) return;

    // Sound effect
    if (result.becameKing) {
      window.soundEffects.playKing();
    } else if (result.wasCaptured) {
      window.soundEffects.playCapture();
    } else {
      window.soundEffects.playMove();
    }

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

    // If opponent is AI and it's Black's turn, trigger AI move after a short friendly delay
    if (currentConfig.opponentType === 'ai' && engine.turn === PLAYER_BLACK) {
      triggerAiMove();
    }
  }

  // AI Turn handling with kid-friendly pacing
  function triggerAiMove() {
    isAiThinking = true;
    updateStatusUI();

    setTimeout(() => {
      if (engine.winner) {
        isAiThinking = false;
        return;
      }

      const aiMove = engine.getBestAIMove();
      if (aiMove) {
        // Select piece briefly to show intent
        engine.selectedSquare = aiMove.from;
        engine.validMovesForSelected = [aiMove];
        renderBoard();

        setTimeout(() => {
          const res = engine.makeMove(aiMove);
          if (res.becameKing) {
            window.soundEffects.playKing();
          } else if (res.wasCaptured) {
            window.soundEffects.playCapture();
          } else {
            window.soundEffects.playMove();
          }

          renderBoard();

          if (res.gameOver && res.gameOver.isOver) {
            triggerGameOver(res.gameOver);
            isAiThinking = false;
            return;
          }

          // Handle AI multi-jumps if any
          if (res.multiJumpAvailable) {
            setTimeout(() => {
              triggerAiMove();
            }, 600);
          } else {
            isAiThinking = false;
            renderBoard();
          }
        }, 350);
      } else {
        isAiThinking = false;
      }
    }, 600);
  }

  // Game Over Handling
  function triggerGameOver(info) {
    window.soundEffects.playWin();
    const winnerName = info.winner === PLAYER_RED ? 'Red' : 'Black';
    winTitle.textContent = `${winnerName} Wins! 🏆`;
    winSubtitle.textContent = info.reason;
    winModalOverlay.classList.add('open');
  }

  // Settings Drawer Toggle
  function openSettings() {
    pendingConfig = { ...currentConfig };
    syncSettingsPills();
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

    // Opponent
    opponentToggleGroup.querySelectorAll('.pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.opponent === pendingConfig.opponentType);
    });
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

  soundToggle.addEventListener('change', () => {
    window.soundEffects.enabled = soundToggle.checked;
  });

  btnApplySettings.addEventListener('click', () => {
    currentConfig = { ...pendingConfig };
    engine = new CheckersEngine(currentConfig);
    closeSettings();
    winModalOverlay.classList.remove('open');
    renderBoard();
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
      engine.resetBoard();
      winModalOverlay.classList.remove('open');
      renderBoard();
    }
  });

  // Win modal play again
  btnPlayAgain.addEventListener('click', () => {
    winModalOverlay.classList.remove('open');
    engine.resetBoard();
    renderBoard();
  });

  btnOpenSettings.addEventListener('click', openSettings);
  btnCloseSettings.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });

  // Initialize
  createBoardDOM();
  renderBoard();
});
