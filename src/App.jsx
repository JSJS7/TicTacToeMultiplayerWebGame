import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useSearchParams,
  useLocation
} from "react-router-dom";
import { useState, useEffect } from "react";
import "./App.css";
import GameBoard from "./components/GameBoard";

function Menu() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("vs-computer");
  const [boardWidth, setBoardWidth] = useState(3);
  const [boardHeight, setBoardHeight] = useState(3);
  const [customActive, setCustomActive] = useState(false);

  const presetOptions = [
    { boardWidth: 3, boardHeight: 3 },
    { boardWidth: 4, boardHeight: 4 },
    { boardWidth: 5, boardHeight: 5 },
  ];

  const handleModeSelect = (mode) => {
    setMode(mode);
  };

  const handleBoardDimensionChange = (value, setter) => {
    if (value === "" || /^\d+$/.test(value)) {
      setter(value === "" ? "" : parseInt(value, 10));
    }
  };

  const startGame = () => {
    if (
      boardWidth < 3 ||
      boardHeight < 3 ||
      boardWidth > 10 ||
      boardHeight > 10
    ) {
      return;
    }

    navigate("/game", {
      state: { mode, boardWidth, boardHeight },
    });
  };

  return (
    <div className="menu">
      <h1>Tic-Tac-Toe</h1>
      <div className="tiles">
        <div className="tile" onClick={() => handleModeSelect("vs-computer")}>
          Play vs Computer
        </div>
        <div className="tile" onClick={() => handleModeSelect("vs-player")}>
          Play with a Friend
        </div>
      </div>

      <div>
        <h2>Board Settings</h2>
        <p>
          Mode:{" "}
          <strong>
            {mode === "vs-computer" ? "Vs Computer" : "Vs Player"}
          </strong>
        </p>

        <strong>Choose Board Size:</strong>
        <div className="tiles">
          {presetOptions.map(({ boardWidth: w, boardHeight: h }) => (
            <div
              key={`${w}x${h}`}
              className={`tile ${
                !customActive && boardWidth === w && boardHeight === h
                  ? "selected"
                  : ""
              }`}
              onClick={() => {
                setBoardWidth(w);
                setBoardHeight(h);
                setCustomActive(false);
              }}
            >
              {w} x {h}
            </div>
          ))}

          <div
            className={`tile ${customActive ? "selected" : ""}`}
            onClick={() => setCustomActive(true)}
          >
            {customActive ? (
              <div>
                <input
                  type="number"
                  className="custom-inline-input"
                  value={boardWidth}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    handleBoardDimensionChange(e.target.value, setBoardWidth)
                  }
                  placeholder="width"
                />
                <span> x </span>
                <input
                  type="number"
                  className="custom-inline-input"
                  value={boardHeight}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    handleBoardDimensionChange(e.target.value, setBoardHeight)
                  }
                  placeholder="height"
                />
              </div>
            ) : (
              "Custom"
            )}
          </div>
        </div>

        <p>
          Selected Board Size:{" "}
          <strong>
            {boardWidth} x {boardHeight} (3-10)
          </strong>
        </p>

        <button
          className="startGame-button"
          onClick={startGame}
          disabled={
            boardWidth < 3 ||
            boardWidth > 10 ||
            boardHeight < 3 ||
            boardHeight > 10
          }
        >
          Start Game
        </button>
      </div>
    </div>
  );
}

function GameLoader() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const lobbyId = searchParams.get("lobby");

  const gameSettings = location.state || {
    mode: lobbyId ? "vs-player" : "vs-computer",
    boardWidth: 3,
    boardHeight: 3,
  };

  const { mode, boardWidth, boardHeight } = gameSettings;

  useEffect(() => {
    if (mode === "vs-player" && !lobbyId) {
      const newLobby = Math.random().toString(36).substring(2, 8);
      navigate(`/game?lobby=${newLobby}`, {
        replace: true,
        state: { mode, boardWidth, boardHeight }, 
      });
    }
  }, [mode, lobbyId, boardWidth, boardHeight, navigate]);

  if (mode === "vs-player" && !lobbyId) {
    return null;
  }

  return (
    <GameBoard
      mode={mode}
      boardSize={{ boardWidth, boardHeight }}
      lobbyId={lobbyId}
    />
  );
}

function App() {
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

export default App;
