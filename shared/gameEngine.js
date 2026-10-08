import { calculateWinner, isValidBoardSize } from "./gameRules.js";
import { applyEffect, availableMoves, createChaos, finishChaosTurn, refreshTargets, spawnEffect } from "./chaosRules.js";

export function createGame(boardWidth, boardHeight, mode = "classic") {
  if (!isValidBoardSize(boardWidth, boardHeight)) throw new Error("Invalid board size.");
  if (!["classic", "chaos"].includes(mode)) throw new Error("Invalid game mode.");
  if (mode === "chaos" && boardWidth !== 5) throw new Error("Chaos requires a 5x5 board.");
  const game = {
    mode,
    boardWidth,
    boardHeight,
    squares: Array(boardWidth * boardHeight).fill(null),
    xIsNext: true,
    firstPlayer: "X",
    roundId: 1,
    winner: null,
    isDraw: false,
    gameOver: false,
    scores: { X: 0, O: 0 },
  };
  if (mode === "chaos") game.chaos = createChaos();
  return game;
}

export function playMove(game, index, random = Math.random) {
  if (game.gameOver) throw new Error("Game is over.");
  if (!Number.isInteger(index) || index < 0 || index >= game.squares.length) {
    throw new Error("Invalid square index.");
  }
  if (game.squares[index] !== null) throw new Error("Square already taken.");
  if (!availableMoves(game).includes(index)) throw new Error("This tile is blocked or outside your bonus move range.");
  const next = { ...game, squares: [...game.squares], scores: { ...game.scores } };
  const player = game.xIsNext ? "X" : "O";
  next.squares[index] = player;
  if (game.chaos) {
    next.chaos = structuredClone(game.chaos);
    const effect = next.chaos.effects.find((item) => item.index === index);
    next.chaos.effects = next.chaos.effects.filter((item) => item.index !== index);
    if (game.chaos.bonus) {
      next.chaos.bonus = null;
      next.chaos.skippedTurns[player] += 1;
      next.chaos.lastEvent = `${player} placed the bonus mark and will skip their next turn.`;
    } else if (effect) {
      applyEffect(next, effect, player, random);
      next.chaos.nextSpawnAt = next.chaos.turnNumber + 5;
    }
  }
  next.winner = calculateWinner(next.squares, next.boardWidth, next.boardHeight);
  if (next.winner && next.chaos) next.chaos.bonus = null;
  if (next.chaos && !next.chaos.bonus) finishChaosTurn(next);
  else if (!next.chaos) next.xIsNext = !game.xIsNext;
  next.isDraw = !next.winner && availableMoves(next).length === 0;
  next.gameOver = Boolean(next.winner || next.isDraw);
  if (next.winner) next.scores[next.winner.player] += 1;
  if (next.chaos) {
    refreshTargets(next, random);
    if (!next.gameOver && !next.chaos.bonus) spawnEffect(next, random);
  }
  return next;
}

export function resetGame(game) {
  const next = createGame(game.boardWidth, game.boardHeight, game.mode);
  next.firstPlayer = game.firstPlayer === "X" ? "O" : "X";
  next.xIsNext = next.firstPlayer === "X";
  next.roundId = game.roundId + 1;
  next.scores = { ...game.scores };
  return next;
}
