import { useEffect, useRef, useState } from "react";
import { createGame } from "../../shared/gameEngine.js";
import { socket } from "../socket";

export function useOnlineGame(enabled, lobbyId, boardWidth, boardHeight, mode) {
  const [game, setGame] = useState(() => createGame(boardWidth, boardHeight, mode));
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const onConnect = () => {
      setConnectionStatus("connected");
      setReady(false);
      setError("");
      socket.timeout(5000).emit("joinLobby", { lobbyId, boardWidth, boardHeight, mode }, (err, response) => {
        if (!active) return;
        if (err || !response?.ok) setError(err ? "Could not join the lobby. Please retry." : response.message);
      });
    };
    const onDisconnect = () => {
      setConnectionStatus("disconnected");
      setReady(false);
      setGame((previous) => ({ ...previous, symbol: null, playerCount: 0 }));
      requestRef.current = null;
      setPending(false);
    };
    const onConnectError = () => {
      onDisconnect();
      setError("Cannot connect to the server. Retrying...");
    };
    const onState = (state) => {
      setGame(state);
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
  }, [enabled, lobbyId, boardWidth, boardHeight, mode]);

  const sendAction = (event, data = {}) => {
    if (!socket.connected || !ready || requestRef.current) return;
    const request = Symbol(event);
    requestRef.current = request;
    setPending(true);
    setError("");
    socket.timeout(5000).emit(event, { lobbyId, roundId: game.roundId, ...data }, (err, response) => {
      if (requestRef.current !== request) return;
      requestRef.current = null;
      setPending(false);
      if (err) {
        setError("Could not confirm the action. Reconnecting to synchronize the board...");
        setReady(false);
        socket.disconnect();
        socket.connect();
      } else if (!response?.ok) setError(response?.message || "The server rejected the action.");
    });
  };

  return {
    game, connectionStatus, ready, pending, error,
    canPlay: ready && connectionStatus === "connected" && !pending && !game.gameOver &&
      game.playerCount === 2 && game.symbol === (game.xIsNext ? "X" : "O"),
    play: (index) => sendAction("makeMove", { index }),
    reset: () => sendAction("resetGame"),
    retry: () => { socket.disconnect(); socket.connect(); },
  };
}
