import test from "node:test";
import assert from "node:assert/strict";
import { calculateWinner, isValidBoardSize } from "../shared/gameRules.js";

test("only square 3x3, 4x4 and 5x5 boards are accepted", () => {
  for (const size of [3, 4, 5]) assert.equal(isValidBoardSize(size, size), true);
  for (const [w, h] of [[3.5, 3], ["3", 3], [3, 4], [6, 6], [null, null], [Infinity, Infinity]]) {
    assert.equal(isValidBoardSize(w, h), false);
  }
});

test("all 19,683 possible 3x3 positions agree with independent winning lines", () => {
  const lines = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]];
  for (let code = 0; code < 3 ** 9; code++) {
    let remaining = code;
    const board = Array.from({ length: 9 }, () => {
      const value = [null, "X", "O"][remaining % 3];
      remaining = Math.floor(remaining / 3);
      return value;
    });
    const winningLines = lines.filter((line) => board[line[0]] && line.every((i) => board[i] === board[line[0]]));
    const winner = calculateWinner(board, 3, 3);
    assert.equal(Boolean(winner), winningLines.length > 0);
    if (winner) assert.ok(winningLines.some((line) => line.every((i) => winner.line.includes(i))));
  }
});

test("three signs still win in every direction on 4x4 and 5x5; rows cannot wrap", () => {
  for (const size of [4, 5]) {
    for (const [dr, dc] of [[0,1], [1,0], [1,1], [1,-1]]) {
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
        if (r + 2 * dr >= size || c + 2 * dc < 0 || c + 2 * dc >= size) continue;
        const board = Array(size * size).fill(null);
        const line = [0,1,2].map((i) => (r + i * dr) * size + c + i * dc);
        for (const i of line) board[i] = "O";
        assert.equal(calculateWinner(board, size, size)?.player, "O");
      }
    }
    const board = Array(size * size).fill(null);
    for (const i of [size - 1, size, size + 1]) board[i] = "X";
    assert.equal(calculateWinner(board, size, size), null);
  }
});
