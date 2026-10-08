import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { useState, useEffect } from "react";
import { BOARD_SIZES, isValidBoardSize } from "../shared/gameRules.js";
import "./App.css";
import GameBoard from "./components/GameBoard";

const MODE_OPTIONS = [
  { value: "vs-computer", label: "Play vs Computer" },
  { value: "vs-player", label: "Play with a Friend" },
  { value: "chaos", label: "Chaos" },
];

function Menu() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("vs-computer");
  const [size, setSize] = useState(3);

  const startGame = () => {
    navigate("/game", {
      state: { mode, boardWidth: size, boardHeight: size },
    });
  };

  return (
    <div className="menu">
      <h1>Tic-Tac-Toe</h1>
      <div className="tiles mode-tiles" role="group" aria-label="Game mode">
        {MODE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`tile ${mode === value ? "selected" : ""}`}
            aria-pressed={mode === value}
            onClick={() => { setMode(value); if (value === "chaos") setSize(5); }}
          >
            <span className={value === "chaos" ? "chaos-title" : undefined}>{label}</span>
          </button>
        ))}
      </div>

      <h2>Board Settings</h2>
      <p>
        Mode: <strong className={mode === "chaos" ? "chaos-title" : undefined}>{mode === "chaos" ? "Chaos" : mode === "vs-computer" ? "Vs Computer" : "Vs Player"}</strong>
      </p>
      <strong>Choose Board Size:</strong>
      <div className="tiles" role="group" aria-label="Board size">
        {BOARD_SIZES.map((value) => (
          <button
            key={value}
            type="button"
            className={`tile ${size === value ? "selected" : ""}`}
            aria-pressed={size === value}
            disabled={mode === "chaos" && value !== 5}
            onClick={() => setSize(value)}
          >
            {value} x {value}
          </button>
        ))}
      </div>
      <p>Selected Board Size: <strong>{size} x {size}</strong></p>
      <p>{size} in a row wins.</p>
      {mode === "chaos" && <p>Online with a friend. Power-ups appear after the first two moves.</p>}
      <button className="startGame-button" onClick={startGame}>Start Game</button>
    </div>
  );
}

function GameLoader() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const lobbyId = searchParams.get("lobby");
  const settings = location.state;

  const mode = searchParams.get("mode") === "chaos" || (!lobbyId && settings?.mode === "chaos")
    ? "chaos" : (lobbyId || settings?.mode === "vs-player") ? "vs-player" : "vs-computer";
  const validSize = isValidBoardSize(settings?.boardWidth, settings?.boardHeight);
  const boardWidth = mode === "chaos" ? 5 : validSize ? settings.boardWidth : 3;
  const boardHeight = boardWidth;

  useEffect(() => {
    if (mode !== "vs-computer" && !lobbyId) {
      const newLobby = crypto.randomUUID();
      navigate(`/game?lobby=${newLobby}${mode === "chaos" ? "&mode=chaos" : ""}`, {
        replace: true,
        state: { mode, boardWidth, boardHeight },
      });
    }
  }, [mode, lobbyId, boardWidth, boardHeight, navigate]);

  if (mode !== "vs-computer" && !lobbyId) return null;

  return (
    <GameBoard
      key={`${mode}:${lobbyId}:${boardWidth}`}
      mode={mode}
      boardSize={{ boardWidth, boardHeight }}
      lobbyId={lobbyId}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/game" element={<GameLoader />} />
        <Route path="*" element={<Menu />} />
      </Routes>
    </BrowserRouter>
  );
}
