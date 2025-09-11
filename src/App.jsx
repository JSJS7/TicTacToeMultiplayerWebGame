import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  Navigate,
  useSearchParams,
} from "react-router-dom";
import { useEffect } from "react";
import "./App.css";
import Settings from "./components/Settings";
import GameBoard from "./components/GameBoard";

function Menu() {
  const navigate = useNavigate();

  const handleModeSelect = (mode) => {
    navigate(`/settings?mode=${mode}`);
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
    </div>
  );
}

function GameLoader() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = searchParams.get("mode");
  const widthParam = parseInt(searchParams.get("width"), 10);
  const heightParam = parseInt(searchParams.get("height"), 10);
  const lobbyId = searchParams.get("lobby");

  const requiredParams = ["mode", "width", "height"];
  const isValid =
    requiredParams.every((param) => searchParams.get(param)) &&
    !isNaN(widthParam) &&
    !isNaN(heightParam) &&
    widthParam >= 3 &&
    heightParam >= 3 &&
    widthParam <= 20 &&
    heightParam <= 20;

  useEffect(() => {
    if (mode === "vs-player" && !lobbyId && isValid) {
      const newLobby = Math.random().toString(36).substring(2, 8);
      navigate(
        `/game?mode=${mode}&width=${widthParam}&height=${heightParam}&lobby=${newLobby}`,
        { replace: true }
      );
    }
  }, [mode, lobbyId, isValid, widthParam, heightParam, navigate]);

  if (!isValid) {
    return <Navigate to="/" replace />;
  }

  if (mode === "vs-player" && !lobbyId) {
    return null;
  }

  return (
    <GameBoard
      mode={mode}
      boardSize={{ boardWidth: widthParam, boardHeight: heightParam }}
      lobbyId={lobbyId}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/game" element={<GameLoader />} />
        <Route path="*" element={<Menu />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
