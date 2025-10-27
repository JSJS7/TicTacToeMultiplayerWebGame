import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
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
    if (r < 0 || r >= boardHeight || c < 0 || c >= boardWidth) return null;
    return squares[r * boardWidth + c];
  };

  const checkLine = (r, c, dr, dc) => {
    const first = get(r, c);
    if (!first) return null;

    for (let i = 1; i < WIN_LENGTH; i++) {
      if (get(r + i * dr, c + i * dc) !== first) return null;
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

function GameBoard({
  boardSize: { boardWidth: initialWidth, boardHeight: initialHeight } = {
    boardWidth: 3,
    boardHeight: 3,
  },
  mode,
  lobbyId,
}) {
  const navigate = useNavigate();

  const [boardWidth, setBoardWidth] = useState(initialWidth);
  const [boardHeight, setBoardHeight] = useState(initialHeight);

  const [squares, setSquares] = useState(
    Array(boardWidth * boardHeight).fill(null)
  );
  const [xIsNext, setXIsNext] = useState(true);
  const [XIsFirstPlayer, setXIsFirstPlayer] = useState(true);
  const [isComputing, setIsComputing] = useState(false);
  const [playerSymbol, setPlayerSymbol] = useState(null);
  const [winner, setWinner] = useState(null);
  const [isDraw, setIsDraw] = useState(false);
  const [playerCount, setPlayerCount] = useState(1);
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  const localWinner =
    mode === "vs-computer"
      ? calculateWinner(squares, boardWidth, boardHeight)
      : winner;

  const getStatus = () => {
    if (localWinner) {
      return `Winner: ${localWinner.player}`;
    }

    if (isDraw || (mode === "vs-computer" && squares.every(Boolean))) {
      return "It's a draw!";
    }

    if (mode === "vs-player" && playerCount < 2) {
      return "Waiting for opponent...";
    }

    return `Next: ${xIsNext ? "X" : "O"}`;
  };

  const status = getStatus();
  useEffect(() => {
    if (!xIsNext && !localWinner && mode === "vs-computer") {
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
  }, [xIsNext, localWinner, squares, mode, boardWidth, boardHeight]);

  useEffect(() => {
    if (mode !== "vs-player") return;

    socket.connect();
    setConnectionStatus("connecting");

    socket.on("connect", () => {
      setConnectionStatus("connected");
      socket.emit("joinLobby", {
        lobbyId,
        boardWidth: initialWidth,
        boardHeight: initialHeight,
      });
    });

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    socket.on(
      "gameState",
      ({
        squares: serverSquares,
        xIsNext: serverXIsNext,
        symbol,
        playerCount: count,
        boardWidth: serverWidth,
        boardHeight: serverHeight,
        winner: serverWinner,
        isDraw: serverIsDraw,
      }) => {
        setBoardWidth(serverWidth);
        setBoardHeight(serverHeight);
        setSquares(serverSquares);
        setXIsNext(serverXIsNext);
        setPlayerSymbol(symbol);
        setPlayerCount(count);
        setWinner(serverWinner);
        setIsDraw(serverIsDraw);
      }
    );

    socket.on("playerJoined", ({ playerCount: count }) => {
      setPlayerCount(count);
    });

    socket.on("playerLeft", ({ playerCount: count }) => {
      setPlayerCount(count);
    });

    socket.on(
      "moveMade",
      ({
        index,
        player,
        xIsNext: serverXIsNext,
        winner: serverWinner,
        isDraw: serverIsDraw,
      }) => {
        setSquares((prev) => {
          const copy = [...prev];
          copy[index] = player;
          return copy;
        });
        setXIsNext(serverXIsNext);

        if (serverWinner) {
          setWinner(serverWinner);
        }
        if (serverIsDraw) {
          setIsDraw(true);
        }
      }
    );

    socket.on(
      "gameReset",
      ({ squares: serverSquares, xIsNext: serverXIsNext }) => {
        setSquares(serverSquares);
        setXIsNext(serverXIsNext);
        setWinner(null);
        setIsDraw(false);
      }
    );

    socket.on("error", ({ message }) => {
      alert(`Error: ${message}`);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("gameState");
      socket.off("playerJoined");
      socket.off("playerLeft");
      socket.off("moveMade");
      socket.off("gameReset");
      socket.off("error");
      socket.disconnect();
    };
  }, [mode, lobbyId, initialWidth, initialHeight]);

  const handleClick = (i) => {
    if (mode === "vs-computer") {
      if (squares[i] || localWinner || !xIsNext || isComputing) return;

      const next = squares.slice();
      next[i] = "X";
      setSquares(next);
      setXIsNext(false);
    } else if (mode === "vs-player") {
      if (squares[i] || winner || isDraw) return;

      if (playerCount < 2) return;

      const currentPlayer = xIsNext ? "X" : "O";
      if (playerSymbol !== currentPlayer) return;

      const next = [...squares];
      next[i] = playerSymbol;
      setSquares(next);
      setXIsNext(!xIsNext);

      socket.emit("makeMove", { lobbyId, index: i });
    }
  };

  const handleReset = () => {
    if (mode === "vs-computer") {
      setSquares(Array(boardWidth * boardHeight).fill(null));

      const newFirstPlayer = !XIsFirstPlayer;
      setXIsFirstPlayer(newFirstPlayer);
      setXIsNext(newFirstPlayer);
      setIsComputing(false);
    } else if (mode === "vs-player") {
      socket.emit("resetGame", { lobbyId });
    }
  };

  return (
    <div className="game">
      <button onClick={() => navigate("/")} className="back-button">
        ← Back
      </button>

      <h2>
        {mode === "vs-computer" ? "Vs Computer" : "Vs Player"} ({boardWidth}x
        {boardHeight})
      </h2>

      {mode === "vs-player" && (
        <p
          className={`connection-status ${
            connectionStatus === "connected" ? "connected" : "disconnected"
          }`}
        >
          {connectionStatus === "connected" ? "● Connected" : "● Disconnected"}
          {playerSymbol && ` | You are: ${playerSymbol}`}
        </p>
      )}

      <div className="status">{status}</div>

      {mode === "vs-player" && lobbyId && playerCount < 2 && (
        <div className="share-link-box">
          <p className="share-link-title">
            <strong>Share this link with a friend:</strong>
          </p>
          <input
            type="text"
            readOnly
            className="share-link-input"
            value={`${window.location.origin}/game?lobby=${lobbyId}`}
            onClick={(e) => e.target.select()}
          />
        </div>
      )}

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
                  isWinning={localWinner?.line?.includes(i)}
                />
              );
            })}
          </div>
        ))}
      </div>

      <button
        onClick={handleReset}
        className={`reset-button ${
          localWinner ||
          isDraw ||
          (mode === "vs-computer" && squares.every(Boolean))
            ? "is-visible"
            : "is-hidden"
        }`}
      >
        Reset Game
      </button>
    </div>
  );
}

export default GameBoard;
