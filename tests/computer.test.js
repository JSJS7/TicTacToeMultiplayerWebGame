import test from "node:test";
import assert from "node:assert/strict";
import { calculateWinner } from "../shared/gameRules.js";
import { findBestMove } from "../src/game/computer.js";

test("the computer takes a winning move before blocking the opponent", () => {
  for (const size of [3, 4, 5]) {
    for (const player of ["X", "O"]) {
      const opponent = player === "X" ? "O" : "X";
      const board = Array(size * size).fill(null);
      for (let col = 0; col < size - 1; col++) {
        board[col] = player;
        board[size + col] = opponent;
      }
      const original = [...board];
      const index = findBestMove(board, size, size, player);
      assert.equal(index, size - 1);
      assert.deepEqual(board, original);
      const result = [...board];
      result[index] = player;
      assert.equal(calculateWinner(result, size, size)?.player, player);
    }
  }
});

test("the computer blocks immediate threats in every direction, including index zero", () => {
  for (const size of [3, 4, 5]) {
    const lines = [
      Array.from({ length: size }, (_, i) => i),
      Array.from({ length: size }, (_, i) => i * size),
      Array.from({ length: size }, (_, i) => i * (size + 1)),
      Array.from({ length: size }, (_, i) => (i + 1) * (size - 1)),
    ];
    for (const player of ["X", "O"]) {
      const opponent = player === "X" ? "O" : "X";
      for (const line of lines) {
        for (const missing of line) {
          const board = Array(size * size).fill(null);
          for (const index of line) if (index !== missing) board[index] = opponent;
          assert.equal(findBestMove(board, size, size, player), missing);
        }
      }
    }
  }
});

test("without an immediate win or threat, the computer chooses an empty tile and leaves the input unchanged", () => {
  for (const size of [3, 4, 5]) {
    const board = Array(size * size).fill(null);
    board[0] = "X";
    board[1] = "O";
    const original = [...board];
    const index = findBestMove(board, size, size, "O");
    assert.ok(Number.isInteger(index) && index >= 0 && index < board.length);
    assert.equal(board[index], null);
    assert.deepEqual(board, original);
    assert.equal(findBestMove(Array(size * size).fill("X"), size, size, "O"), undefined);
  }
});
