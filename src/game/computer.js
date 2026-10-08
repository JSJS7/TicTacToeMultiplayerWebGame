import { calculateWinner } from "../../shared/gameRules.js";

export function findBestMove(squares, boardWidth, boardHeight, player) {
  const opponent = player === "X" ? "O" : "X";
  const emptySquares = squares.flatMap((value, index) => value === null ? [index] : []);
  const findWinningMove = (symbol) => emptySquares.find((index) => {
    const board = [...squares];
    board[index] = symbol;
    return calculateWinner(board, boardWidth, boardHeight)?.player === symbol;
  });
  return findWinningMove(player) ?? findWinningMove(opponent) ??
    emptySquares[Math.floor(Math.random() * emptySquares.length)];
}
