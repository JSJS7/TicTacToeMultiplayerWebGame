import { useNavigate } from "react-router-dom";
import { useComputerGame } from "../hooks/useComputerGame.js";
import { useOnlineGame } from "../hooks/useOnlineGame.js";
import ChaosLegend from "./ChaosLegend.jsx";
import BoardGrid from "./BoardGrid.jsx";
import PlayerText from "./PlayerText.jsx";

function GameStatus({ game, isOnline }) {
  if (game.winner) return <PlayerText text={`Winner: ${game.winner.player}`} />;
  if (game.isDraw) return "It's a draw!";
  if (isOnline && game.playerCount !== 2) return "Waiting for opponent...";

  const player = game.xIsNext ? "X" : "O";
  const text = game.chaos?.bonus
    ? `${player}: choose a neighboring tile for your bonus mark`
    : `Next: ${player}`;
  return <PlayerText text={text} />;
}

export default function GameBoard({ boardSize: { boardWidth, boardHeight }, mode, lobbyId }) {
  const navigate = useNavigate();
  const isOnline = mode !== "vs-computer";
  const computer = useComputerGame(!isOnline, boardWidth, boardHeight);
  const online = useOnlineGame(isOnline, lobbyId, boardWidth, boardHeight, mode === "chaos" ? "chaos" : "classic");
  const { game, canPlay, play, reset } = isOnline ? online : computer;
  const isChaos = game.mode === "chaos";

  return (
    <div className={`game ${isChaos ? "chaos-game" : ""}`}>
      <button onClick={() => navigate("/")} className="back-button">← Back</button>
      <h2>{isChaos ? <span className="chaos-title">Chaos</span> : isOnline ? "Vs Player" : "Vs Computer"} ({game.boardWidth}x{game.boardHeight})</h2>
      <p className="scoreboard" aria-label={`Score: X ${game.scores.X}, O ${game.scores.O}`} aria-live="polite">
        <span className="player-x">X {game.scores.X}</span>
        <span className="score-divider"> : </span>
        <span className="player-o">{game.scores.O} O</span>
      </p>
      {isOnline && (
        <p className={`connection-status ${online.connectionStatus === "connected" ? "connected" : "disconnected"}`}>
          {online.connectionStatus === "connecting" ? "● Connecting..." : online.connectionStatus === "connected" ? "● Connected" : "● Disconnected"}
          {game.symbol && <> | You are: <span className={`player-${game.symbol.toLowerCase()}`}>{game.symbol}</span></>}
        </p>
      )}
      <div className="status" role="status" aria-live="polite"><GameStatus game={game} isOnline={isOnline} /></div>
      <div className="game-notice">
        {isChaos && <p className="chaos-event" role="status"><PlayerText text={game.chaos.lastEvent} /></p>}
      </div>
      {isOnline && online.pending && <p role="status">Waiting for server confirmation...</p>}
      {isOnline && online.error && <p className="error-message" role="alert"><PlayerText text={online.error} /></p>}
      {isOnline && online.error && !online.ready && (
        <button className="back-button" onClick={online.retry}>Retry connection</button>
      )}
      {isOnline && lobbyId && game.playerCount !== 2 && (
        <div className="share-link-box">
          <p className="share-link-title"><strong>Share this link with a friend:</strong></p>
          <input type="text" readOnly className="share-link-input" aria-label="Invitation link"
            value={window.location.href} onClick={(event) => event.target.select()} />
        </div>
      )}
      <div className="game-layout">
        <div className="play-area">
          <BoardGrid key={game.roundId} game={game} canPlay={canPlay} onMove={play} />
          <button onClick={reset}
            disabled={isOnline && (!online.ready || online.connectionStatus !== "connected" || online.pending)}
            className={`reset-button ${game.gameOver ? "is-visible" : "is-hidden"}`}>
            Reset Game
          </button>
        </div>
        {isChaos && <ChaosLegend />}
      </div>
    </div>
  );
}
