import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);

// Allow CORS so your React frontend can talk to this server
const io = new Server(httpServer, {
  cors: {
    origin: "*", // you can replace "*" with your frontend URL later for security
    methods: ["GET", "POST"],
  },
});

// When a client connects
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("joinLobby", (lobbyId) => {

    console.log("Joining lobby:", lobbyId, "by", socket.id);
    socket.join(lobbyId);

    const clients = io.sockets.adapter.rooms.get(lobbyId);
    const players = [...clients];
    console.log("Players in lobby:", players);
    
    const symbol = players[0] === socket.id ? "X" : "O";
    socket.emit("assignSymbol", symbol);
    socket.to(lobbyId).emit("playerJoined", socket.id);
  });
  socket.on("makeMove", ({ lobbyId, index, player }) => {
    console.log("Move received:", { lobbyId, index, player });
    socket.to(lobbyId).emit("moveMade", { index, player });
  });
});

app.get("/", (req, res) => {
  res.send("TicTacToe server is running!");
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
