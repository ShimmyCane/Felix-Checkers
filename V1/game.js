/**
 * Felix Checkers Game Engine
 * Supports standard checkers, 2-row kid quick mode, 3-row classic mode,
 * and the Felix chess-piece hybrid rules foundation.
 */

const PLAYER_RED = 'red';
const PLAYER_BLACK = 'black';

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
    // Rank 1 is row 7:
    // B1: row 7, col 1 (Bishop)
    // D1: row 7, col 3 (Queen)
    // F1: row 7, col 5 (Bishop)
    if (this.variant === 'felix') {
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

  getAllValidMovesForPlayer(player) {
    const allMoves = [];
    const jumpMoves = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && piece.player === player) {
          const moves = this.getValidMoves(r, c);
          for (const m of moves) {
            allMoves.push(m);
            if (m.isJump) {
              jumpMoves.push(m);
            }
          }
        }
      }
    }

    return { allMoves, jumpMoves };
  }

  getValidMoves(r, c) {
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

    // Return jumps + normal steps
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

    // Move piece
    this.board[to.r][to.c] = piece;
    this.board[from.r][from.c] = null;

    let wasCaptured = false;
    if (isJump && captured) {
      this.board[captured.r][captured.c] = null;
      wasCaptured = true;
    }

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

    // Check Multi-Jump sequence:
    // If it was a jump and not newly crowned king, check if further jumps are available
    if (isJump && !becameKing) {
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

  // Kid-Friendly Solitaire AI
  getBestAIMove() {
    const { allMoves, jumpMoves } = this.getAllValidMovesForPlayer(PLAYER_BLACK);
    if (allMoves.length === 0) return null;

    // 1. If there are jumps available, prioritize captures
    if (jumpMoves.length > 0) {
      // Pick jump that captures high value or leads to promotion
      jumpMoves.sort((a, b) => {
        let scoreA = 10;
        let scoreB = 10;
        if (a.to.r === 7) scoreA += 5; // Promotion
        if (b.to.r === 7) scoreB += 5;
        return scoreB - scoreA;
      });
      return jumpMoves[0];
    }

    // 2. Regular moves: prioritize moving towards promotion and center
    allMoves.sort((a, b) => {
      let scoreA = a.to.r; // moving down board
      let scoreB = b.to.r;
      // Bonus for staying out of edges
      if (a.to.c > 0 && a.to.c < 7) scoreA += 1;
      if (b.to.c > 0 && b.to.c < 7) scoreB += 1;
      return scoreB - scoreA + (Math.random() * 0.5 - 0.25);
    });

    return allMoves[0];
  }
}

if (typeof window !== 'undefined') {
  window.CheckersEngine = CheckersEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CheckersEngine;
}
