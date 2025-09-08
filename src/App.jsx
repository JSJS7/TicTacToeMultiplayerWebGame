import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  Navigate,
  useSearchParams,
} from "react-router-dom";
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
  const mode = searchParams.get("mode");

  const requiredParams = ["mode", "width", "height"];

  const boardWidth = parseInt(searchParams.get("width"), 10);
  const boardHeight = parseInt(searchParams.get("height"), 10);

  const isValid =
    requiredParams.every((param) => searchParams.get(param)) &&
    !isNaN(boardWidth) &&
    !isNaN(boardHeight) &&
    boardWidth >= 3 &&
    boardHeight >= 3 &&
    boardWidth <= 20 &&
    boardHeight <= 20;

  if (!isValid) {
    return <Navigate to="/" replace />;
  }


  return <GameBoard mode={mode} boardSize={{ boardWidth, boardHeight }} />;
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
