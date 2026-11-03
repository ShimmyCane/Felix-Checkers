/**
 * Felix Checkers Game Engine
 * Supports standard checkers, 2-row kid quick mode, 3-row classic mode,
 * and the Felix chess-piece hybrid rules foundation.
 */

const PLAYER_RED = 'red';
const PLAYER_BLACK = 'black';

// Material values used by the computer opponent
const PIECE_VALUES = { checker: 100, king: 170, bishop: 130, queen: 260 };
const WIN_SCORE = 100000;

// Computer levels (1-5).
//  depth:        plies the computer looks ahead
//  randomChance: chance it ignores its thinking and plays a random legal move
//  noise:        random +/- wobble added to each move's score (less precise play)
const AI_LEVELS = {
  1: { name: 'Gentle', depth: 1, randomChance: 0.6, noise: 0 },
  2: { name: 'Easy', depth: 1, randomChance: 0, noise: 20 },
  3: { name: 'Smart', depth: 2, randomChance: 0, noise: 0 },
  4: { name: 'Tricky', depth: 3, randomChance: 0, noise: 0 },
  5: { name: 'Master', depth: 4, randomChance: 0, noise: 0 }
};

function pieceValue(piece) {
  if (piece.type === 'checker') return piece.isKing ? PIECE_VALUES.king : PIECE_VALUES.checker;
  return PIECE_VALUES[piece.type] || 0;
}

class CheckersEngine {
  constructor(config = {}) {
    this.rowsOption = config.rowsOption || 3; // 2 or 3 rows
    this.variant = config.variant || 'standard'; // 'standard' or 'felix'
    this.opponentType = config.opponentType || 'pvp'; // 'pvp' or 'ai'
    
    this.board = [];
    this.turn = PLAYER_RED;
    this.selectedSquare = null;
    this.validMovesForSelected = [];
    this.isMultiJumping = false;
    this.multiJumpingPiece = null;
    this.history = [];
    this.winner = null;
    this.moveCount = 0;

    this.resetBoard();
  }

  resetBoard() {
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    this.turn = PLAYER_RED;
    this.selectedSquare = null;
    this.validMovesForSelected = [];
    this.isMultiJumping = false;
    this.multiJumpingPiece = null;
    this.history = [];
    this.winner = null;
    this.moveCount = 0;

    // Determine row placement
    // 3 rows: Black rows 0,1,2; Red rows 5,6,7
    // 2 rows: Black rows 0,1; Red rows 6,7
    const blackRows = this.rowsOption === 2 ? [0, 1] : [0, 1, 2];
    const redRows = this.rowsOption === 2 ? [6, 7] : [5, 6, 7];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isDark = (r + c) % 2 === 1;
        if (isDark) {
          if (blackRows.includes(r)) {
            this.board[r][c] = {
              player: PLAYER_BLACK,
              isKing: false,
              type: 'checker'
            };
          } else if (redRows.includes(r)) {
            this.board[r][c] = {
              player: PLAYER_RED,
              isKing: false,
              type: 'checker'
            };
          }
        }
      }
    }

    // Felix Variant pieces on light squares:
    // Light squares have (r + c) % 2 === 0
    // Red back rank (Rank 1 = row 7):
    // B1: row 7, col 1 (Bishop)
    // D1: row 7, col 3 (Queen)
    // F1: row 7, col 5 (Bishop)
    // Black back rank (Rank 8 = row 0, 180° rotation / light squares C8, E8, G8):
    // C8: row 0, col 2 (Bishop)
    // E8: row 0, col 4 (Queen)
    // G8: row 0, col 6 (Bishop)
    if (this.variant === 'felix') {
      // Red Side
      this.board[7][1] = {
        player: PLAYER_RED,
        type: 'bishop',
        isKing: false
      };
      this.board[7][3] = {
        player: PLAYER_RED,
        type: 'queen',
        isKing: false
      };
      this.board[7][5] = {
        player: PLAYER_RED,
        type: 'bishop',
        isKing: false
      };

      // Opposing Side (Black)
      this.board[0][2] = {
        player: PLAYER_BLACK,
        type: 'bishop',
        isKing: false
      };
      this.board[0][4] = {
        player: PLAYER_BLACK,
        type: 'queen',
        isKing: false
      };
      this.board[0][6] = {
        player: PLAYER_BLACK,
        type: 'bishop',
        isKing: false
      };
    }

    this.saveHistory();
  }

  saveHistory() {
    const boardCopy = this.board.map(row => 
      row.map(cell => cell ? { ...cell } : null)
    );
    this.history.push({
      board: boardCopy,
      turn: this.turn,
      moveCount: this.moveCount,
      winner: this.winner
    });
    // Cap history length for memory
    if (this.history.length > 50) this.history.shift();
  }

  undo() {
    if (this.history.length <= 1) return false;
    
    // If playing against AI and it's player's turn, undo both AI and player moves
    const stepsToUndo = (this.opponentType === 'ai' && this.history.length >= 3) ? 2 : 1;
    
    for (let i = 0; i < stepsToUndo; i++) {
      if (this.history.length > 1) {
        this.history.pop(); // remove current
      }
    }

    const previousState = this.history[this.history.length - 1];
    this.board = previousState.board.map(row => 
      row.map(cell => cell ? { ...cell } : null)
    );
    this.turn = previousState.turn;
    this.moveCount = previousState.moveCount;
    this.winner = previousState.winner;
    this.selectedSquare = null;
    this.validMovesForSelected = [];
    this.isMultiJumping = false;
    this.multiJumpingPiece = null;
    return true;
  }

  getPiece(r, c) {
    if (r < 0 || r >= 8 || c < 0 || c >= 8) return null;
    return this.board[r][c];
  }

  getPieceCounts() {
    let red = 0;
    let black = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p) {
          if (p.player === PLAYER_RED) red++;
          else if (p.player === PLAYER_BLACK) black++;
        }
      }
    }
    return { red, black };
  }

  // Mandatory capture: if any piece of `player` can jump, only jumps are legal.
  getAllValidMovesForPlayer(player) {
    const rawMoves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && piece.player === player) {
          rawMoves.push(...this.getRawMoves(r, c));
        }
      }
    }

    // Captures are compulsory for checkers. Queens and bishops are exempt: they can
    // always make any legal move, and their captures stay optional.
    const isChessPiece = (m) => {
      const type = this.board[m.from.r][m.from.c].type;
      return type === 'queen' || type === 'bishop';
    };
    const jumpMoves = rawMoves.filter(m => m.isJump);
    const checkerJumps = rawMoves.filter(m => m.isJump && this.board[m.from.r][m.from.c].type === 'checker');
    const allMoves = checkerJumps.length > 0
      ? rawMoves.filter(m => m.isJump || isChessPiece(m))
      : rawMoves;
    return { allMoves, jumpMoves };
  }

  getValidMoves(r, c) {
    const piece = this.board[r][c];
    if (!piece) return [];

    // Locked in a multi-jump: only that piece, only jumps (handled in getRawMoves)
    if (this.isMultiJumping) return this.getRawMoves(r, c);

    const { allMoves } = this.getAllValidMovesForPlayer(piece.player);
    return allMoves.filter(m => m.from.r === r && m.from.c === c);
  }

  // Every geometric move for the piece on (r, c), before the mandatory-capture rule
  getRawMoves(r, c) {
    const piece = this.board[r][c];
    if (!piece) return [];

    // If currently locked in a multi-jump sequence, only this piece can move and only jumps
    if (this.isMultiJumping) {
      if (this.multiJumpingPiece.r !== r || this.multiJumpingPiece.c !== c) {
        return [];
      }
      return this.getJumpMoves(r, c, piece);
    }

    const jumps = this.getJumpMoves(r, c, piece);
    const steps = this.getStepMoves(r, c, piece);
    return [...jumps, ...steps];
  }

  getStepMoves(r, c, piece) {
    const moves = [];

    // Standard Checkers Movement
    if (piece.type === 'checker') {
      const forwardDir = piece.player === PLAYER_RED ? -1 : 1;
      const rowDirections = piece.isKing ? [-1, 1] : [forwardDir];
      const colDirections = [-1, 1];

      for (const dr of rowDirections) {
        for (const dc of colDirections) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            // Must land on an empty dark square
            if (!this.board[nr][nc] && (nr + nc) % 2 === 1) {
              moves.push({
                from: { r, c },
                to: { r: nr, c: nc },
                isJump: false,
                captured: null
              });
            }
          }
        }
      }
    }

    // Felix Mode: Bishop movement (diagonals on light squares)
    if (piece.type === 'bishop') {
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const target = this.board[nr][nc];
          if (!target) {
            moves.push({
              from: { r, c },
              to: { r: nr, c: nc },
              isJump: false,
              captured: null
            });
          } else {
            if (target.player !== piece.player) {
              // Can attack opponent piece
              moves.push({
                from: { r, c },
                to: { r: nr, c: nc },
                isJump: true,
                captured: { r: nr, c: nc }
              });
            }
            break; // Path blocked
          }
          nr += dr;
          nc += dc;
        }
      }
    }

    // Felix Mode: Queen movement (ranks, files, diagonals on light squares & attacking)
    if (piece.type === 'queen') {
      const dirs = [
        [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [-1, 1], [1, -1], [1, 1]
      ];
      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const target = this.board[nr][nc];
          if (!target) {
            // Can move freely onto empty squares
            moves.push({
              from: { r, c },
              to: { r: nr, c: nc },
              isJump: false,
              captured: null
            });
          } else {
            if (target.player !== piece.player) {
              moves.push({
                from: { r, c },
                to: { r: nr, c: nc },
                isJump: true,
                captured: { r: nr, c: nc }
              });
            }
            break; // Blocked after contact
          }
          nr += dr;
          nc += dc;
        }
      }
    }

    return moves;
  }

  getJumpMoves(r, c, piece) {
    const jumps = [];

    if (piece.type === 'checker') {
      const forwardDir = piece.player === PLAYER_RED ? -1 : 1;
      const rowDirections = piece.isKing ? [-1, 1] : [forwardDir];
      const colDirections = [-1, 1];

      // Standard diagonal checker jumps
      for (const dr of rowDirections) {
        for (const dc of colDirections) {
          const midR = r + dr;
          const midC = c + dc;
          const endR = r + dr * 2;
          const endC = c + dc * 2;

          if (endR >= 0 && endR < 8 && endC >= 0 && endC < 8) {
            const midPiece = this.board[midR][midC];
            const endPiece = this.board[endR][endC];

            if (midPiece && midPiece.player !== piece.player && !endPiece) {
              // Valid jump over enemy
              jumps.push({
                from: { r, c },
                to: { r: endR, c: endC },
                isJump: true,
                captured: { r: midR, c: midC }
              });
            }
          }
        }
      }

      // Felix Mode Extra Rules for Checkers:
      // "checkers can now jump forward and sideways to attack the light squares. once king'd they can move back."
      if (this.variant === 'felix') {
        const attackDirs = [];
        // Forward jump
        attackDirs.push([forwardDir * 2, 0, forwardDir, 0]);
        // Sideways jump left/right
        attackDirs.push([0, -2, 0, -1]);
        attackDirs.push([0, 2, 0, 1]);
        // If king, can also jump backward
        if (piece.isKing) {
          attackDirs.push([-forwardDir * 2, 0, -forwardDir, 0]);
        }

        for (const [drEnd, dcEnd, drMid, dcMid] of attackDirs) {
          const midR = r + drMid;
          const midC = c + dcMid;
          const endR = r + drEnd;
          const endC = c + dcEnd;

          if (endR >= 0 && endR < 8 && endC >= 0 && endC < 8) {
            const midPiece = this.board[midR][midC];
            const endPiece = this.board[endR][endC];

            if (midPiece && midPiece.player !== piece.player && !endPiece) {
              jumps.push({
                from: { r, c },
                to: { r: endR, c: endC },
                isJump: true,
                captured: { r: midR, c: midC },
                isFelixJump: true
              });
            }
          }
        }
      }
    }

    return jumps;
  }

  makeMove(move) {
    const { from, to, isJump, captured } = move;
    const piece = this.board[from.r][from.c];
    if (!piece) return { success: false };

    // 1. Remove captured piece first (if landing directly on target like Queen/Bishop, or jumped over)
    let wasCaptured = false;
    if (isJump && captured) {
      this.board[captured.r][captured.c] = null;
      wasCaptured = true;
    }

    // 2. Clear origin square
    this.board[from.r][from.c] = null;

    // 3. Place piece on destination (guarantees Queen and any attacking piece remains on the board!)
    this.board[to.r][to.c] = piece;

    // Check King Promotion (for checkers reaching the opposite end)
    let becameKing = false;
    if (piece.type === 'checker' && !piece.isKing) {
      if (piece.player === PLAYER_RED && to.r === 0) {
        piece.isKing = true;
        becameKing = true;
      } else if (piece.player === PLAYER_BLACK && to.r === 7) {
        piece.isKing = true;
        becameKing = true;
      }
    }

    this.moveCount++;

    // Check Multi-Jump sequence (for checkers only):
    // If it was a jump and not newly crowned king, check if further jumps are available
    if (isJump && !becameKing && piece.type === 'checker') {
      const nextJumps = this.getJumpMoves(to.r, to.c, piece);
      if (nextJumps.length > 0) {
        this.isMultiJumping = true;
        this.multiJumpingPiece = { r: to.r, c: to.c };
        this.selectedSquare = { r: to.r, c: to.c };
        this.validMovesForSelected = nextJumps;

        this.saveHistory();
        return {
          success: true,
          wasCaptured,
          becameKing,
          multiJumpAvailable: true,
          nextTurn: this.turn
        };
      }
    }

    // End turn
    this.isMultiJumping = false;
    this.multiJumpingPiece = null;
    this.selectedSquare = null;
    this.validMovesForSelected = [];
    this.turn = (this.turn === PLAYER_RED) ? PLAYER_BLACK : PLAYER_RED;

    this.saveHistory();

    // Check Game Over
    const gameOverInfo = this.checkGameOver();
    if (gameOverInfo.isOver) {
      this.winner = gameOverInfo.winner;
    }

    return {
      success: true,
      wasCaptured,
      becameKing,
      multiJumpAvailable: false,
      nextTurn: this.turn,
      gameOver: gameOverInfo
    };
  }

  checkGameOver() {
    const { red, black } = this.getPieceCounts();
    if (red === 0) return { isOver: true, winner: PLAYER_BLACK, reason: 'Red has no pieces left!' };
    if (black === 0) return { isOver: true, winner: PLAYER_RED, reason: 'Black has no pieces left!' };

    // Check if current player has any legal moves left
    const moves = this.getAllValidMovesForPlayer(this.turn);
    if (moves.allMoves.length === 0) {
      const opposing = this.turn === PLAYER_RED ? PLAYER_BLACK : PLAYER_RED;
      return { isOver: true, winner: opposing, reason: `${this.turn} has no legal moves remaining!` };
    }

    return { isOver: false, winner: null };
  }

  // ---------------------------------------------------------------------------
  // Computer opponent: alpha-beta search over clones of the engine, so the live
  // game is never mutated. Strength is set by the level (see AI_LEVELS).
  // ---------------------------------------------------------------------------

  // Score from Black's (the computer's) point of view. Positive favours Black.
  evaluate() {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) continue;

        let value = pieceValue(p);
        if (p.type === 'checker' && !p.isKing) {
          // Reward checkers for advancing toward promotion (Black heads down, Red heads up)
          const progress = p.player === PLAYER_BLACK ? r : 7 - r;
          value += progress * 4;
        }
        // Mild preference for central files
        value += (3.5 - Math.abs(c - 3.5)) * 1.5;

        score += p.player === PLAYER_BLACK ? value : -value;
      }
    }
    return score;
  }

  cloneForSearch() {
    const copy = Object.create(CheckersEngine.prototype);
    copy.rowsOption = this.rowsOption;
    copy.variant = this.variant;
    copy.opponentType = this.opponentType;
    copy.board = this.board.map(row => row.map(cell => (cell ? { ...cell } : null)));
    copy.turn = this.turn;
    copy.selectedSquare = null;
    copy.validMovesForSelected = [];
    copy.isMultiJumping = this.isMultiJumping;
    copy.multiJumpingPiece = this.multiJumpingPiece ? { ...this.multiJumpingPiece } : null;
    copy.history = [];
    copy.winner = this.winner;
    copy.moveCount = this.moveCount;
    copy.saveHistory = () => {}; // search doesn't need undo history
    return copy;
  }

  // Captures first (most valuable target first), then promotions
  orderMoves(moves) {
    const scoreOf = (m) => {
      let s = 0;
      if (m.isJump && m.captured) {
        const target = this.board[m.captured.r][m.captured.c];
        s += 1000 + (target ? pieceValue(target) : 0);
      }
      const piece = this.board[m.from.r][m.from.c];
      if (piece && piece.type === 'checker' && !piece.isKing && (m.to.r === 0 || m.to.r === 7)) {
        s += 500;
      }
      return s;
    };
    return moves
      .map(m => ({ m, s: scoreOf(m) }))
      .sort((a, b) => b.s - a.s)
      .map(x => x.m);
  }

  // Minimax with alpha-beta pruning. `depth` counts plies; a multi-jump keeps the
  // same player on move, so it does not use up a ply.
  search(depth, alpha, beta) {
    if (this.winner) {
      // Faster wins (more depth left) score higher
      return this.winner === PLAYER_BLACK ? WIN_SCORE + depth : -WIN_SCORE - depth;
    }
    if (depth <= 0) return this.evaluate();

    const { allMoves } = this.getAllValidMovesForPlayer(this.turn);
    if (allMoves.length === 0) {
      return this.turn === PLAYER_BLACK ? -WIN_SCORE : WIN_SCORE;
    }

    const maximizing = this.turn === PLAYER_BLACK;
    let best = maximizing ? -Infinity : Infinity;

    for (const move of this.orderMoves(allMoves)) {
      const child = this.cloneForSearch();
      const res = child.makeMove(move);
      const nextDepth = res.multiJumpAvailable ? depth : depth - 1;
      const score = child.search(nextDepth, alpha, beta);

      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, best);
      }
      if (beta <= alpha) break;
    }
    return best;
  }

  getBestAIMove(level = 3) {
    const cfg = AI_LEVELS[level] || AI_LEVELS[3];
    const { allMoves } = this.getAllValidMovesForPlayer(PLAYER_BLACK);
    if (allMoves.length === 0) return null;

    if (Math.random() < cfg.randomChance) {
      return allMoves[Math.floor(Math.random() * allMoves.length)];
    }

    let bestMove = null;
    let bestScore = -Infinity;
    let alpha = -Infinity;

    for (const move of this.orderMoves(allMoves)) {
      const child = this.cloneForSearch();
      const res = child.makeMove(move);
      const nextDepth = res.multiJumpAvailable ? cfg.depth : cfg.depth - 1;

      let score = child.search(nextDepth, alpha, Infinity);
      if (cfg.noise) score += (Math.random() * 2 - 1) * cfg.noise;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, bestScore);
    }
    return bestMove;
  }
}

CheckersEngine.LEVELS = AI_LEVELS;

if (typeof window !== 'undefined') {
  window.CheckersEngine = CheckersEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CheckersEngine;
}
