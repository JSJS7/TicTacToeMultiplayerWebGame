import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "/src/App.css";

function Square({ value, onClick, isWinning }) {
  return (
    <button
      className={`square ${isWinning ? "winning" : ""}`}
      onClick={onClick}
    >
      {value}
    </button>
  );
}

const WIN_LENGTH = 3;
const COMPUTER_DELAY_MS = 500;

function calculateWinner(squares, boardWidth, boardHeight) {
  const get = (r, c) => {
    if (r < 0 || r >= boardHeight || c < 0 || c >= boardWidth) {
      return null;
    }
    return squares[r * boardWidth + c];
  };

  const checkLine = (r, c, dr, dc) => {
    const first = get(r, c);
    if (!first) return null;

    for (let i = 1; i < WIN_LENGTH; i++) {
      if (get(r + i * dr, c + i * dc) !== first) {
        return null;
      }
    }

    const line = Array.from(
      { length: WIN_LENGTH },
      (_, i) => (r + i * dr) * boardWidth + (c + i * dc)
    );
    return { player: first, line };
  };

  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let r = 0; r < boardHeight; r++) {
    for (let c = 0; c < boardWidth; c++) {
      for (const [dr, dc] of directions) {
        if (
          (dr === 0 && c + WIN_LENGTH > boardWidth) ||
          (dr !== 0 && r + WIN_LENGTH > boardHeight) ||
          (dc > 0 && c + WIN_LENGTH > boardWidth) ||
          (dc < 0 && c - WIN_LENGTH + 1 < 0)
        ) {
          continue;
        }

        const res = checkLine(r, c, dr, dc);
        if (res) return res;
      }
    }
  }

  return null;
}

function findBestMove(squares, boardWidth, boardHeight, player) {
  const opponent = player === "X" ? "O" : "X";
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  const checkMove = (targetPlayer) => {
    for (let r = 0; r < boardHeight; r++) {
      for (let c = 0; c < boardWidth; c++) {
        for (const [dr, dc] of directions) {
          const line = [];
          for (let i = 0; i < WIN_LENGTH; i++) {
            const row = r + i * dr;
            const col = c + i * dc;
            if (row < 0 || row >= boardHeight || col < 0 || col >= boardWidth) {
              line.length = 0;
              break;
            }
            line.push(squares[row * boardWidth + col]);
          }

          if (line.length === WIN_LENGTH) {
            const emptyIndex = line.indexOf(null);
            const filledCount = line.filter((s) => s === targetPlayer).length;
            if (emptyIndex !== -1 && filledCount === WIN_LENGTH - 1) {
              const row = r + emptyIndex * dr;
              const col = c + emptyIndex * dc;
              return row * boardWidth + col;
            }
          }
        }
      }
    }
    return null;
  };

  const winningMove = checkMove(player);
  if (winningMove !== null) return winningMove;

  const blockingMove = checkMove(opponent);
  if (blockingMove !== null) return blockingMove;

  const emptySquares = squares
    .map((val, i) => (val === null ? i : null))
    .filter((i) => i !== null);
  return emptySquares[Math.floor(Math.random() * emptySquares.length)];
}

function GameBoard({ boardSize: { boardWidth, boardHeight }, mode }) {
  const navigate = useNavigate();
  const [squares, setSquares] = useState(
    Array(boardWidth * boardHeight).fill(null)
  );
  const [xIsNext, setXIsNext] = useState(true);
  const [isComputing, setIsComputing] = useState(false);

  const winner = calculateWinner(squares, boardWidth, boardHeight);
  const status = winner
    ? `Winner: ${winner.player}`
    : squares.every(Boolean)
    ? "It's a draw!"
    : `Next: ${xIsNext ? "X" : "O"}`;

  useEffect(() => {
    if (!xIsNext && !winner && mode === "vs-computer") {
      setIsComputing(true);
      const timeout = setTimeout(() => {
        const choice = findBestMove(squares, boardWidth, boardHeight, "O");

        if (choice !== undefined) {
          const next = squares.slice();
          next[choice] = "O";
          setSquares(next);
          setXIsNext(true);
        }
        setIsComputing(false);
      }, COMPUTER_DELAY_MS);
      return () => clearTimeout(timeout);
    }
  }, [xIsNext, winner, squares, mode, boardWidth, boardHeight]);

  const handleClick = (i) => {
    if (!xIsNext || isComputing || squares[i] || winner) return;
    const next = squares.slice();
    next[i] = "X";
    setSquares(next);
    setXIsNext(false);
  };

  const handleReset = () => {
    setSquares(Array(boardWidth * boardHeight).fill(null));
    setXIsNext(true);
    setIsComputing(false);
  };

  return (
    <div className="game">
      <button
        onClick={() => navigate(`/settings?mode=${mode}`)}
        className="back-button"
      >
        ← Back
      </button>
      <h2>
        {mode === "vs-computer" ? "Vs Computer" : "Vs Player"} ({boardWidth}x
        {boardHeight})
      </h2>
      <div className="status">{status}</div>
      <div className="board">
        {Array.from({ length: boardHeight }).map((_, row) => (
          <div key={row} className="board-row">
            {Array.from({ length: boardWidth }).map((_, col) => {
              const i = row * boardWidth + col;
              return (
                <Square
                  key={i}
                  value={squares[i]}
                  onClick={() => handleClick(i)}
                  isWinning={winner?.line?.includes(i)}
                />
              );
            })}
          </div>
        ))}
      </div>
      <button
        onClick={handleReset}
        className={`reset-button ${
          winner || squares.every(Boolean) ? "is-visible" : "is-hidden"
        }`}
      >
        Reset Game
      </button>
    </div>
  );
}

export default GameBoard;
