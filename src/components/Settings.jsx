import { useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "/src/App.css";

function Settings() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get("mode");

  const [boardWidth, setBoardWidth] = useState(3);
  const [boardHeight, setBoardHeight] = useState(3);
  const [customActive, setCustomActive] = useState(false);

  const presetOptions = [
    { boardWidth: 3, boardHeight: 3 },
    { boardWidth: 4, boardHeight: 4 },
    { boardWidth: 5, boardHeight: 5 },
  ];

  useEffect(() => {
    if (!mode) {
      navigate("/");
    }
  }, [mode, navigate]);

  const startGame = () => {
    if (
      boardWidth < 3 ||
      boardHeight < 3 ||
      boardWidth > 20 ||
      boardHeight > 20
    ) {
      alert("Please enter valid board dimensions (3-20).");
      return;
    }

    navigate(`/game?mode=${mode}&width=${boardWidth}&height=${boardHeight}`);
  };

  const handleBoardDimensionChange = (value, setter) => {
    if (value === "" || /^\d+$/.test(value)) {
      setter(value === "" ? "" : parseInt(value, 10));
    }
  };

  return (
    <div className="menu">
      <button onClick={() => navigate("/")} className="back-button">
        ← Back
      </button>
      <h2>Board Settings</h2>
      <p>
        Mode:{" "}
        <strong>{mode === "vs-computer" ? "Vs Computer" : "Vs Player"}</strong>
      </p>

      <div>
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
              <>
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
              </>
            ) : (
              "Custom"
            )}
          </div>
        </div>

        <p>
          Selected Board Size:{" "}
          <strong>
            {boardWidth} x {boardHeight} (3-20)
          </strong>
        </p>
      </div>

      <button
        className="startGame-button"
        onClick={startGame}
        disabled={
          boardWidth < 3 ||
          boardWidth > 20 ||
          boardHeight < 3 ||
          boardHeight > 20
        }
      >
        Start Game
      </button>
    </div>
  );
}

export default Settings;
