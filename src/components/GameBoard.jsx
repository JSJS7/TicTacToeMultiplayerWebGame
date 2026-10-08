import { useState, useEffect, useRef } from "react";
import { calculateWinner } from "../../shared/gameRules.js";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
import "/src/App.css";

function Square({ value, onClick, isWinning, disabled, label }) {
  return (
    <button
      className={`square ${value ? `player-${value.toLowerCase()}` : ""} ${isWinning ? "winning" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <span>{value}</span>
    </button>
  );
}

const COMPUTER_DELAY_MS = 500;

function findBestMove(squares, boardWidth, boardHeight, player) {
  const opponent = player === "X" ? "O" : "X";
  const emptySquares = squares
    .map((value, index) => (value === null ? index : null))
    .filter((index) => index !== null);

  const findWinningMove = (symbol) => {
    for (const index of emptySquares) {
      const testBoard = [...squares];
      testBoard[index] = symbol;
      const winner = calculateWinner(testBoard, boardWidth, boardHeight);

      if (winner?.player === symbol) {
        return index;
      }
    }

    return null;
  };

  const winningMove = findWinningMove(player);
  if (winningMove !== null) return winningMove;

  const blockingMove = findWinningMove(opponent);
  if (blockingMove !== null) return blockingMove;

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
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const [playerCount, setPlayerCount] = useState(1);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [ready, setReady] = useState(false);
  const [roundId, setRoundId] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(null);

  const localWinner =
    mode === "vs-computer"
      ? calculateWinner(squares, boardWidth, boardHeight)
      : winner;

  const getStatus = () => {
    if (localWinner) {
      return <>Winner: <span className={`player-${localWinner.player.toLowerCase()}`}>{localWinner.player}</span></>;
    }

    if (isDraw || (mode === "vs-computer" && squares.every(Boolean))) {
      return "It's a draw!";
    }

    if (mode === "vs-player" && playerCount < 2) {
      return "Waiting for opponent...";
    }

    return <>Next: <span className={xIsNext ? "player-x" : "player-o"}>{xIsNext ? "X" : "O"}</span></>;
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
          const result = calculateWinner(next, boardWidth, boardHeight);
          if (result) {
            setScores((previous) => ({
              ...previous,
              [result.player]: previous[result.player] + 1,
            }));
          }
        }
        setIsComputing(false);
      }, COMPUTER_DELAY_MS);
      return () => clearTimeout(timeout);
    }
  }, [xIsNext, localWinner, squares, mode, boardWidth, boardHeight]);

  useEffect(() => {
    if (mode !== "vs-player") return;

    let active = true;
    const onConnect = () => {
      setConnectionStatus("connected");
      setReady(false);
      setError("");
      socket.timeout(5000).emit("joinLobby", {
        lobbyId, boardWidth: initialWidth, boardHeight: initialHeight,
      }, (err, response) => {
        if (!active) return;
        if (err || !response?.ok) {
          setError(err ? "Could not join the lobby. Please retry." : response.message);
        }
      });
    };
    const onDisconnect = () => {
      setConnectionStatus("disconnected");
      setReady(false);
      setPlayerSymbol(null);
      setPlayerCount(0);
      requestRef.current = null;
      setPending(false);
    };
    const onConnectError = () => {
      onDisconnect();
      setError("Cannot connect to the server. Retrying...");
    };
    const onState = (state) => {
      setBoardWidth(state.boardWidth);
      setBoardHeight(state.boardHeight);
      setSquares(state.squares);
      setXIsNext(state.xIsNext);
      setPlayerSymbol(state.symbol);
      setPlayerCount(state.playerCount);
      setWinner(state.winner);
      setIsDraw(state.isDraw);
      setScores(state.scores);
      setRoundId(state.roundId);
      setReady(true);
    };
    const onError = ({ message }) => setError(message);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("gameState", onState);
    socket.on("error", onError);
    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      active = false;
      requestRef.current = null;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("gameState", onState);
      socket.off("error", onError);
      socket.disconnect();
    };
  }, [mode, lobbyId, initialWidth, initialHeight]);

  const sendAction = (event, data = {}) => {
    // Wait for authoritative state; never buffer actions while offline.
    if (!socket.connected || !ready || requestRef.current) return;
    const request = Symbol(event);
    requestRef.current = request;
    setPending(true);
    setError("");
    socket.timeout(5000).emit(event, { lobbyId, roundId, ...data }, (err, response) => {
      if (requestRef.current !== request) return;
      requestRef.current = null;
      setPending(false);
      if (err) {
        setError("Could not confirm the action. Reconnecting to synchronize the board...");
        setReady(false);
        socket.disconnect();
        socket.connect();
      } else if (!response?.ok) {
        setError(response?.message || "The server rejected the action.");
      }
    });
  };

  const handleClick = (i) => {
    if (mode === "vs-computer") {
      if (squares[i] || localWinner || !xIsNext || isComputing) return;

      const next = squares.slice();
      next[i] = "X";
      setSquares(next);
      setXIsNext(false);
      const result = calculateWinner(next, boardWidth, boardHeight);
      if (result) {
        setScores((previous) => ({
          ...previous,
          [result.player]: previous[result.player] + 1,
        }));
      }
    } else if (mode === "vs-player") {
      if (squares[i] || winner || isDraw) return;

      if (playerCount < 2) return;

      const currentPlayer = xIsNext ? "X" : "O";
      if (playerSymbol !== currentPlayer) return;

      sendAction("makeMove", { index: i });
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
      if (winner || isDraw) sendAction("resetGame");
    }
  };

  const gameFinished = Boolean(localWinner || isDraw || squares.every(Boolean));
  const canPlay = !gameFinished && (mode === "vs-computer"
    ? xIsNext && !isComputing
    : ready && connectionStatus === "connected" && !pending && playerCount === 2 &&
      playerSymbol === (xIsNext ? "X" : "O"));

  return (
    <div className="game">
      <button onClick={() => navigate("/")} className="back-button">
        ← Back
      </button>

      <h2>
        {mode === "vs-computer" ? "Vs Computer" : "Vs Player"} ({boardWidth}x
        {boardHeight})
      </h2>

      <p
        className="scoreboard"
        aria-label={`Score: X ${scores.X}, O ${scores.O}`}
        aria-live="polite"
      >
        <span className="player-x">X {scores.X}</span>
        <span className="score-divider"> : </span>
        <span className="player-o">{scores.O} O</span>
      </p>

      {mode === "vs-player" && (
        <p
          className={`connection-status ${
            connectionStatus === "connected" ? "connected" : "disconnected"
          }`}
        >
          {connectionStatus === "connecting" ? "● Connecting..." : connectionStatus === "connected" ? "● Connected" : "● Disconnected"}
          {playerSymbol && <> | You are: <span className={`player-${playerSymbol.toLowerCase()}`}>{playerSymbol}</span></>}
        </p>
      )}

      <div className="status" role="status" aria-live="polite">{status}</div>
      {pending && <p role="status">Waiting for server confirmation...</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {mode === "vs-player" && error && !ready && (
        <button className="back-button" onClick={() => { socket.disconnect(); socket.connect(); }}>Retry connection</button>
      )}

      {mode === "vs-player" && lobbyId && playerCount < 2 && (
        <div className="share-link-box">
          <p className="share-link-title">
            <strong>Share this link with a friend:</strong>
          </p>
          <input
            type="text"
            readOnly
            className="share-link-input"
            aria-label="Invitation link"
            value={`${window.location.origin}/game?lobby=${lobbyId}`}
            onClick={(e) => e.target.select()}
          />
        </div>
      )}

      <div className="board" data-next-player={xIsNext ? "X" : "O"}>
        {Array.from({ length: boardHeight }).map((_, row) => (
          <div key={row} className="board-row">
            {Array.from({ length: boardWidth }).map((_, col) => {
              const i = row * boardWidth + col;
              return (
                <Square
                  key={i}
                  value={squares[i]}
                  disabled={!canPlay || Boolean(squares[i])}
                  label={`Row ${row + 1}, column ${col + 1}: ${squares[i] || "empty"}`}
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
        disabled={mode === "vs-player" && (!ready || connectionStatus !== "connected" || pending)}
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
