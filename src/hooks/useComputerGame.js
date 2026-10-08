import { useEffect, useState } from "react";
import { createGame, playMove, resetGame } from "../../shared/gameEngine.js";
import { findBestMove } from "../game/computer.js";

export function useComputerGame(enabled, boardWidth, boardHeight) {
  const [game, setGame] = useState(() => createGame(boardWidth, boardHeight));
  const isComputing = enabled && !game.xIsNext && !game.gameOver;

  useEffect(() => {
    if (!isComputing) return;
    const timer = setTimeout(() => {
      const index = findBestMove(game.squares, game.boardWidth, game.boardHeight, "O");
      if (index !== undefined) setGame(playMove(game, index));
    }, 500);
    return () => clearTimeout(timer);
  }, [game, isComputing]);

  return {
    game,
    canPlay: enabled && game.xIsNext && !game.gameOver,
    play: (index) => {
      if (game.xIsNext && !game.gameOver && game.squares[index] === null) {
        setGame(playMove(game, index));
      }
    },
    reset: () => setGame(resetGame(game)),
  };
}
