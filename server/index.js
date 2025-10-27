import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";  

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? false : "*",
    methods: ["GET", "POST"],
  },
});

const games = new Map();

const WIN_LENGTH = 3;

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

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("joinLobby", ({ lobbyId, boardWidth, boardHeight }) => {
    if (
      boardWidth < 3 ||
      boardWidth > 20 ||
      boardHeight < 3 ||
      boardHeight > 20
    ) {
      socket.emit("error", { message: "Invalid board dimensions" });
      return;
    }

    console.log("Joining lobby:", lobbyId, "by", socket.id);
    socket.join(lobbyId);

    if (!games.has(lobbyId)) {
      games.set(lobbyId, {
        squares: Array(boardWidth * boardHeight).fill(null),
        xIsNext: true,
        boardWidth,
        boardHeight,
        players: {},
        winner: null,
        isDraw: false,
        gameOver: false,
      });
    }

    const game = games.get(lobbyId);
    const clients = io.sockets.adapter.rooms.get(lobbyId);
    const playerCount = clients ? clients.size : 0;

    if (!game.players[socket.id]) {
      const assignedSymbols = Object.values(game.players);

      if (!assignedSymbols.includes("X")) {
        game.players[socket.id] = "X";
      } else if (!assignedSymbols.includes("O")) {
        game.players[socket.id] = "O";
      } else {
        socket.disconnect();
        return;
      }
    }
    const symbol = game.players[socket.id];

    socket.emit("gameState", {
      squares: game.squares,
      xIsNext: game.xIsNext,
      symbol: symbol,
      playerCount: playerCount,
      boardWidth: game.boardWidth,
      boardHeight: game.boardHeight,
      winner: game.winner,
      isDraw: game.isDraw,
      gameOver: game.gameOver,
    });

    socket.to(lobbyId).emit("playerJoined", {
      playerId: socket.id,
      playerCount: playerCount,
    });

    console.log(`Players in lobby ${lobbyId}:`, playerCount);
  });

  socket.on("makeMove", ({ lobbyId, index }) => {
    const game = games.get(lobbyId);

    if (!game) {
      socket.emit("error", { message: "Game not found" });
      return;
    }

    if (game.gameOver) {
      socket.emit("error", { message: "Game is over" });
      return;
    }

    if (game.squares[index] !== null) {
      socket.emit("error", { message: "Square already taken" });
      return;
    }

    const playerSymbol = game.players[socket.id];
    if (!playerSymbol) {
      socket.emit("error", { message: "You are not in this game" });
      return;
    }

    const playerCount = Object.keys(game.players).length;
    if (playerCount < 2) {
      socket.emit("error", { message: "Waiting for another player" });
      return;
    }

    const currentPlayer = game.xIsNext ? "X" : "O";
    if (playerSymbol !== currentPlayer) {
      socket.emit("error", { message: "Not your turn" });
      return;
    }

    // Make the move
    game.squares[index] = playerSymbol;
    game.xIsNext = !game.xIsNext;

    // Check for winner
    const winner = calculateWinner(
      game.squares,
      game.boardWidth,
      game.boardHeight
    );
    const isDraw = !winner && !game.squares.includes(null);

    if (winner || isDraw) {
      game.gameOver = true;
      game.winner = winner;
      game.isDraw = isDraw;
    }

    // Broadcast the move to all players in the lobby
    io.to(lobbyId).emit("moveMade", {
      index,
      player: playerSymbol,
      xIsNext: game.xIsNext,
      winner: winner,
      isDraw: isDraw,
    });

    console.log(`Move made in lobby ${lobbyId}:`, {
      index,
      player: playerSymbol,
    });
  });

  socket.on("resetGame", ({ lobbyId }) => {
    const game = games.get(lobbyId);

    if (!game) {
      socket.emit("error", { message: "Game not found" });
      return;
    }

    const playerSymbol = game.players[socket.id];
    if (!playerSymbol) {
      socket.emit("error", { message: "You are not in this game" });
      return;
    }

    // Reset game state
    game.squares = Array(game.boardWidth * game.boardHeight).fill(null);
    game.xIsNext = true;
    game.gameOver = false;
    game.winner = null;
    game.isDraw = false;

    // Broadcast reset to all players
    io.to(lobbyId).emit("gameReset", {
      squares: game.squares,
      xIsNext: game.xIsNext,
    });

    console.log(`Game reset in lobby ${lobbyId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // Clean up: remove player from games and notify others
    games.forEach((game, lobbyId) => {
      if (game.players[socket.id]) {
        delete game.players[socket.id];

        const clients = io.sockets.adapter.rooms.get(lobbyId);
        const playerCount = clients ? clients.size : 0;

        // Notify remaining players
        io.to(lobbyId).emit("playerLeft", {
          playerId: socket.id,
          playerCount: playerCount,
        });

        // Clean up empty lobbies
        if (playerCount === 0) {
          games.delete(lobbyId);
          console.log(`Lobby ${lobbyId} deleted (empty)`);
        }
      }
    });
  });
});

if (process.env.NODE_ENV === "production") {
  const distPath = join(__dirname, "..", "dist");
  app.use(express.static(distPath));

  app.get("*", (req, res) => {  
    res.sendFile(join(distPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("Server is running");
  });
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});