import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { calculateWinner, isValidBoardSize } from "../shared/gameRules.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? false : "*",
    methods: ["GET", "POST"],
  },
});
const games = new Map();
const validPayload = (data) => data !== null && typeof data === "object" && !Array.isArray(data);
const validLobbyId = (id) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id);

function broadcastState(game) {
  for (const [id, symbol] of Object.entries(game.players)) {
    io.to(id).emit("gameState", {
      squares: game.squares,
      xIsNext: game.xIsNext,
      boardWidth: game.boardWidth,
      boardHeight: game.boardHeight,
      winner: game.winner,
      isDraw: game.isDraw,
      scores: game.scores,
      gameOver: game.gameOver,
      roundId: game.roundId,
      symbol,
      playerCount: Object.keys(game.players).length,
    });
  }
}

io.on("connection", (socket) => {
  const reject = (ack, message) => {
    if (typeof ack === "function") ack({ ok: false, message });
    else socket.emit("error", { message });
  };
  const accept = (ack) => {
    if (typeof ack === "function") ack({ ok: true });
  };

  socket.on("joinLobby", (data, ack) => {
    // Validate before reading fields, allocating a board or joining a room.
    if (!validPayload(data) || !validLobbyId(data.lobbyId) ||
        !isValidBoardSize(data.boardWidth, data.boardHeight)) {
      return reject(ack, "Invalid lobby or board size. Choose 3x3, 4x4 or 5x5.");
    }
    const { lobbyId, boardWidth, boardHeight } = data;
    if (socket.data.lobbyId && socket.data.lobbyId !== lobbyId) {
      return reject(ack, "Leave your current lobby before joining another one.");
    }
    let game = games.get(lobbyId);
    if (game && !game.players[socket.id] && Object.keys(game.players).length >= 2) {
      return reject(ack, "This lobby is full.");
    }
    if (!game) {
      game = {
        squares: Array(boardWidth * boardHeight).fill(null),
        xIsNext: true,
        boardWidth,
        boardHeight,
        players: {},
        winner: null,
        isDraw: false,
        scores: { X: 0, O: 0 },
        gameOver: false,
        firstPlayer: "X",
        roundId: 1,
      };
      games.set(lobbyId, game);
    }
    if (!game.players[socket.id]) {
      game.players[socket.id] = Object.values(game.players).includes("X") ? "O" : "X";
    }
    socket.data.lobbyId = lobbyId;
    socket.join(lobbyId);
    broadcastState(game);
    accept(ack);
  });

  const getGame = (data, ack) => {
    if (!validPayload(data) || !validLobbyId(data.lobbyId) ||
        !Number.isInteger(data.roundId) || data.roundId < 1) {
      reject(ack, "Invalid game request.");
      return null;
    }
    const game = games.get(data.lobbyId);
    if (!game || !game.players[socket.id]) {
      reject(ack, "You are not in this game.");
      return null;
    }
    if (game.roundId !== data.roundId) {
      reject(ack, "This round has already ended.");
      return null;
    }
    return game;
  };

  socket.on("makeMove", (data, ack) => {
    const game = getGame(data, ack);
    if (!game) return;
    if (!Number.isInteger(data.index) || data.index < 0 || data.index >= game.squares.length) {
      return reject(ack, "Invalid square index.");
    }
    if (game.gameOver) return reject(ack, "Game is over.");
    if (Object.keys(game.players).length < 2) return reject(ack, "Waiting for another player.");
    const symbol = game.players[socket.id];
    if (symbol !== (game.xIsNext ? "X" : "O")) return reject(ack, "Not your turn.");
    if (game.squares[data.index] !== null) return reject(ack, "Square already taken.");
    game.squares[data.index] = symbol;
    game.xIsNext = !game.xIsNext;
    game.winner = calculateWinner(game.squares, game.boardWidth, game.boardHeight);
    game.isDraw = !game.winner && !game.squares.includes(null);
    game.gameOver = Boolean(game.winner || game.isDraw);
    if (game.winner) game.scores[game.winner.player] += 1;
    broadcastState(game);
    accept(ack);
  });

  socket.on("resetGame", (data, ack) => {
    const game = getGame(data, ack);
    if (!game) return;
    if (!game.gameOver) return reject(ack, "You can reset only after the round ends.");
    game.firstPlayer = game.firstPlayer === "X" ? "O" : "X";
    game.squares = Array(game.boardWidth * game.boardHeight).fill(null);
    game.xIsNext = game.firstPlayer === "X";
    game.gameOver = false;
    game.winner = null;
    game.isDraw = false;
    game.roundId += 1;
    broadcastState(game);
    accept(ack);
  });

  socket.on("disconnect", () => {
    const game = games.get(socket.data.lobbyId);
    if (!game) return;
    delete game.players[socket.id];
    if (Object.keys(game.players).length === 0) games.delete(socket.data.lobbyId);
    else broadcastState(game);
  });
});

if (process.env.NODE_ENV === "production") {
  const distPath = join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  app.get("/{*splat}", (req, res) => {
    res.sendFile(join(distPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => res.send("Server is running"));
}
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`Server listening on port ${httpServer.address().port}`));
