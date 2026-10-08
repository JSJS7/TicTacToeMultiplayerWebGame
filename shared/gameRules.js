export const BOARD_SIZES = [3, 4, 5];
export const WIN_LENGTH = 3;

export function isValidBoardSize(width, height) {
  return Number.isInteger(width) && width === height && BOARD_SIZES.includes(width);
}

export function calculateWinner(squares, boardWidth, boardHeight) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let row = 0; row < boardHeight; row++) {
    for (let col = 0; col < boardWidth; col++) {
      const player = squares[row * boardWidth + col];
      if (!player) continue;
      for (const [dr, dc] of directions) {
        const endRow = row + (WIN_LENGTH - 1) * dr;
        const endCol = col + (WIN_LENGTH - 1) * dc;
        if (endRow >= boardHeight || endCol < 0 || endCol >= boardWidth) continue;
        const line = Array.from(
          { length: WIN_LENGTH },
          (_, i) => (row + i * dr) * boardWidth + col + i * dc
        );
        if (line.every((index) => squares[index] === player)) return { player, line };
      }
    }
  }
  return null;
}
