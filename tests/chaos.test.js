import test from "node:test";
import assert from "node:assert/strict";
import { createGame, playMove, resetGame } from "../shared/gameEngine.js";
import { areNeighbors, availableMoves, refreshTargets, spawnEffect } from "../shared/chaosRules.js";

const start = () => createGame(5, 5, "chaos");
const withEffect = (type, index = 12) => {
  const game = start();
  game.squares[0] = "X";
  game.squares[24] = "O";
  game.chaos.turnNumber = 2;
  game.chaos.nextSpawnAt = 6;
  game.chaos.effects = [{ id: 1, type, index, ...(type === "erase" ? { targets: { X: 0, O: 24 } } : {}), ...(type === "block" ? { target: 1 } : {}) }];
  return game;
};

test("Chaos only accepts 5x5; the first effect appears after one move each", () => {
  assert.throws(() => createGame(4, 4, "chaos"));
  let game = start();
  game = playMove(game, 0, () => 0);
  assert.equal(game.chaos.effects.length, 0);
  game = playMove(game, 24, () => 0);
  assert.equal(game.chaos.effects.length, 1);
  assert.equal(game.chaos.turnNumber, 2);
  assert.equal(game.squares[game.chaos.effects[0].index], null);
});

test("effect countdown resets after collection, waits four following turns and caps the board at two", () => {
  let game = playMove(withEffect("erase"), 12, () => 0);
  assert.equal(game.chaos.effects.length, 0);
  assert.equal(game.chaos.nextSpawnAt, 7);
  for (const index of [0, 24, 1]) {
    game = playMove(game, index, () => 0);
    assert.equal(game.chaos.effects.length, 0);
  }
  game = playMove(game, 23, () => 0);
  assert.equal(game.chaos.effects.length, 1);
  game.chaos.turnNumber = game.chaos.nextSpawnAt;
  spawnEffect(game, () => 0);
  assert.equal(game.chaos.effects.length, 2);
  game.chaos.turnNumber = game.chaos.nextSpawnAt;
  spawnEffect(game, () => 0);
  assert.equal(game.chaos.effects.length, 2);
  assert.equal(new Set(game.chaos.effects.map((effect) => effect.index)).size, 2);
});

test("Wild mark and Double step spawn away from both players, including diagonals", () => {
  for (const randomValue of [0.25, 0.5]) {
    const game = withEffect("erase");
    game.chaos.effects = [];
    game.chaos.turnNumber = 6;
    spawnEffect(game, () => randomValue);
    const effect = game.chaos.effects[0];
    assert.ok(["scatter", "double"].includes(effect.type));
    assert.equal(areNeighbors(effect.index, 0, 5), false);
    assert.equal(areNeighbors(effect.index, 24, 5), false);
  }
  assert.equal(areNeighbors(4, 5, 5), false);
  assert.equal(areNeighbors(12, 6, 5), true);
});

test("Dead tile blocks only an empty tile and blocked tiles cannot receive moves", () => {
  const original = withEffect("block");
  const game = playMove(original, 12, () => 0);
  assert.deepEqual(game.chaos.blocked, [1]);
  assert.equal(game.squares[0], "X");
  assert.equal(game.squares[24], "O");
  assert.throws(() => playMove(game, 1), /blocked/);
  assert.equal(availableMoves(game).includes(1), false);
  assert.deepEqual(original.chaos.blocked, []);
});

test("Dead tile uses the previewed target without rerolling on collection", () => {
  const original = withEffect("block");
  original.chaos.effects[0].target = 7;
  refreshTargets(original, () => 0.99);
  assert.equal(original.chaos.effects[0].target, 7);
  const game = playMove(original, 12, () => 0);
  assert.deepEqual(game.chaos.blocked, [7]);
});

test("Dead tile replaces an occupied or blocked target with an empty tile other than its own", () => {
  const game = withEffect("block");
  game.chaos.effects[0].target = 0;
  refreshTargets(game, () => 0);
  assert.equal(game.chaos.effects[0].target, 1);
  game.chaos.blocked = [1];
  refreshTargets(game, () => 0);
  assert.equal(game.chaos.effects[0].target, 2);
  game.squares = Array(25).fill("X");
  game.squares[12] = null;
  refreshTargets(game, () => 0);
  assert.equal(game.chaos.effects[0].target, null);
});

test("Wild mark adds exactly one distant mark, without covering another power-up", () => {
  const original = withEffect("scatter");
  original.chaos.effects.push({ id: 2, type: "block", index: 2 });
  const game = playMove(original, 12, () => 0);
  const added = game.squares.flatMap((value, index) => value === "X" && original.squares[index] !== "X" ? [index] : []);
  assert.deepEqual(added, [3, 12]);
  assert.equal(areNeighbors(3, 0, 5), false);
  assert.equal(areNeighbors(3, 12, 5), false);
  assert.equal(game.chaos.blocked.length, 0);
  assert.equal(game.chaos.effects.length, 1);
  assert.equal(game.chaos.effects[0].index, 2);
});

test("Double step allows one adjacent bonus, then skips exactly the collector's next turn", () => {
  let game = playMove(withEffect("double"), 12, () => 0);
  assert.equal(game.xIsNext, true);
  assert.equal(game.chaos.turnNumber, 2);
  assert.deepEqual(availableMoves(game), [6, 7, 8, 11, 13, 16, 17, 18]);
  assert.throws(() => playMove(game, 3), /bonus/);
  game = playMove(game, 6, () => 0);
  assert.equal(game.xIsNext, false);
  assert.equal(game.chaos.bonus, null);
  assert.equal(game.chaos.skippedTurns.X, 1);
  game = playMove(game, 4, () => 0);
  assert.equal(game.xIsNext, false);
  assert.equal(game.chaos.skippedTurns.X, 0);
  game = playMove(game, 3, () => 0);
  assert.equal(game.xIsNext, true);
});

test("Double step with no available neighbors does not skip a turn", () => {
  const original = withEffect("double");
  original.chaos.blocked = [6, 7, 8, 11, 13, 16, 17, 18];
  const game = playMove(original, 12, () => 0);
  assert.equal(game.chaos.bonus, null);
  assert.equal(game.xIsNext, false);
  assert.equal(game.chaos.skippedTurns.X, 0);
});

test("Equal sacrifice removes exactly the previewed marks and preserves its collected mark", () => {
  const original = withEffect("erase");
  original.squares[1] = "X";
  original.squares[23] = "O";
  refreshTargets(original, () => 0.99);
  assert.deepEqual(original.chaos.effects[0].targets, { X: 0, O: 24 });
  const game = playMove(original, 12, () => 0.99);
  assert.equal(game.squares[0], null);
  assert.equal(game.squares[24], null);
  assert.equal(game.squares[12], "X");
  assert.equal(game.squares[1], "X");
  assert.equal(game.squares[23], "O");
  assert.equal(original.squares[0], "X");
});

test("sacrifice targets are refreshed only when their selected mark disappears", () => {
  const game = withEffect("erase");
  game.squares[0] = null;
  game.squares[4] = "X";
  refreshTargets(game, () => 0);
  assert.deepEqual(game.chaos.effects[0].targets, { X: 4, O: 24 });
});

test("blocked tiles count toward a full-board draw; a reset clears all Chaos state and preserves scores", () => {
  const original = start();
  original.squares = ["X","O","X","O","X", "X","O","X","O","O", "O","X","O","X","X", "X","O","X","O","O", "O","X","O","X",null];
  original.chaos.effects = [{ id: 1, type: "block", index: 24, target: 23 }];
  original.squares[23] = null;
  const game = playMove(original, 24, () => 0);
  assert.equal(game.isDraw, true);
  assert.equal(game.winner, null);
  game.scores = { X: 2, O: 1 };
  const reset = resetGame(game);
  assert.equal(reset.mode, "chaos");
  assert.deepEqual(reset.chaos.blocked, []);
  assert.deepEqual(reset.chaos.effects, []);
  assert.deepEqual(reset.chaos.skippedTurns, { X: 0, O: 0 });
  assert.equal(reset.chaos.bonus, null);
  assert.equal(reset.chaos.turnNumber, 0);
  assert.equal(reset.xIsNext, false);
  assert.equal(reset.roundId, 2);
  assert.deepEqual(reset.scores, { X: 2, O: 1 });
});

test("Chaos still requires five signs and a winning bonus counts exactly one point", () => {
  const game = withEffect("double", 3);
  game.squares[1] = "X";
  game.squares[2] = "X";
  let next = playMove(game, 3, () => 0);
  assert.equal(next.gameOver, false);
  next = playMove(next, 4, () => 0);
  assert.equal(next.winner.player, "X");
  assert.deepEqual(next.winner.line, [0, 1, 2, 3, 4]);
  assert.deepEqual(next.scores, { X: 1, O: 0 });
  assert.throws(() => playMove(next, 5), /over/);
});

const crowdedBoard = (empty) => {
  const game = start();
  game.squares = ["X","O","X","O","X", "X","O","X","O","O", "O","X","O","X","X", "X","O","X","O","O", "O","X","O","X","O"];
  for (const index of empty) game.squares[index] = null;
  game.chaos.turnNumber = 20;
  game.chaos.nextSpawnAt = 20;
  return game;
};

test("Dead tile never targets another power-up, including with only two empty tiles", () => {
  const game = crowdedBoard([12, 13]);
  game.chaos.effects = [{ id: 1, type: "erase", index: 12, targets: { X: 0, O: 1 } }];
  game.chaos.effectSequence = 1;
  spawnEffect(game, () => 0);
  assert.equal(game.chaos.effects.length, 2);
  assert.equal(game.chaos.effects[1].type, "erase");
  assert.equal(game.chaos.effects[1].index, 13);

  const original = withEffect("block");
  original.chaos.effects[0].target = 13;
  original.chaos.effects.push({ id: 2, type: "erase", index: 13, targets: { X: 0, O: 24 } });
  refreshTargets(original, () => 0);
  assert.equal(original.chaos.effects[0].target, 1);
  const next = playMove(original, 12, () => 0);
  assert.deepEqual(next.chaos.blocked, [1]);
  assert.equal(next.chaos.effects[0].type, "erase");
  assert.equal(next.chaos.effects[0].index, 13);
});

test("a newly spawned effect cannot cover the previewed target of an existing Dead tile", () => {
  const game = crowdedBoard([12, 13]);
  game.chaos.effects = [{ id: 1, type: "block", index: 12, target: 13 }];
  game.chaos.effectSequence = 1;
  spawnEffect(game, () => 0.99);
  assert.equal(game.chaos.effects.length, 1);
  assert.equal(game.chaos.effects[0].target, 13);
});

test("Wild mark does not spawn when both remaining remote tiles are next to each other", () => {
  for (let value = 0; value < 1; value += 0.05) {
    const game = start();
    game.squares[0] = "X";
    game.squares[24] = "O";
    game.chaos.blocked = Array.from({ length: 25 }, (_, index) => index).filter((index) => ![0, 12, 13, 24].includes(index));
    game.chaos.turnNumber = 2;
    spawnEffect(game, () => value);
    assert.notEqual(game.chaos.effects[0]?.type, "scatter");
  }
});

test("Double step cannot consume a neighboring power-up and does not charge a skip if it is the only neighbor", () => {
  const game = withEffect("double");
  game.chaos.effects.push({ id: 2, type: "erase", index: 13, targets: { X: 0, O: 24 } });
  const next = playMove(game, 12, () => 0);
  assert.equal(availableMoves(next).includes(13), false);
  assert.throws(() => playMove(next, 13), /bonus/);
  game.chaos.blocked = [6, 7, 8, 11, 16, 17, 18];
  const noBonus = playMove(game, 12, () => 0);
  assert.equal(noBonus.chaos.bonus, null);
  assert.equal(noBonus.chaos.skippedTurns.X, 0);
  assert.equal(noBonus.chaos.effects[0].index, 13);
});

test("two sacrifices cannot delete only one side; neither blocked tiles nor other power-ups are sacrificed", () => {
  const game = withEffect("erase");
  game.chaos.blocked = [3];
  game.chaos.effects.push({ id: 2, type: "erase", index: 13, targets: { X: 0, O: 24 } });
  const first = playMove(game, 12, () => 0);
  assert.deepEqual(first.chaos.effects[0].targets, { X: 12, O: null });
  const second = playMove(first, 13, () => 0);
  assert.equal(second.squares[12], "X");
  assert.equal(second.squares[13], "O");
  assert.deepEqual(second.chaos.blocked, [3]);
  assert.match(second.chaos.lastEvent, /No marks were removed/);
});

test("with one empty tile only sacrifice can spawn, and it opens exactly the previewed two tiles", () => {
  for (const randomValue of [0, 0.5, 0.99]) {
    const game = crowdedBoard([24]);
    spawnEffect(game, () => randomValue);
    assert.equal(game.chaos.effects[0].type, "erase");
    const targets = Object.values(game.chaos.effects[0].targets);
    const next = playMove(game, 24, () => randomValue);
    assert.equal(next.gameOver, false);
    assert.deepEqual(availableMoves(next).sort((a, b) => a - b), targets.sort((a, b) => a - b));
    assert.equal(next.squares[24], "X");
  }
});

test("existing effects on the last empty tile finish cleanly when their extra action is impossible", () => {
  for (const type of ["block", "scatter", "double"]) {
    const game = crowdedBoard([24]);
    game.chaos.effects = [{ id: 1, type, index: 24, ...(type === "block" ? { target: null } : {}) }];
    const next = playMove(game, 24, () => 0);
    assert.equal(next.isDraw, true);
    assert.equal(next.chaos.bonus, null);
    assert.equal(next.chaos.skippedTurns.X, 0);
    assert.equal(next.chaos.effects.length, 0);
    assert.equal(next.chaos.blocked.length, 0);
  }
});

test("the last neighboring bonus move ends a full-board draw without getting stuck", () => {
  const game = crowdedBoard([23, 24]);
  game.chaos.effects = [{ id: 1, type: "double", index: 24 }];
  const first = playMove(game, 24, () => 0);
  assert.equal(first.gameOver, false);
  assert.deepEqual(availableMoves(first), [23]);
  const second = playMove(first, 23, () => 0);
  assert.equal(second.isDraw, true);
  assert.equal(second.chaos.bonus, null);
  assert.deepEqual(second.scores, { X: 0, O: 0 });
  assert.deepEqual(second.chaos.skippedTurns, { X: 0, O: 0 });
  assert.match(second.chaos.lastEvent, /draw/);
});

test("winning on the Double step tile ends immediately without asking for a bonus or skipping a future turn", () => {
  const game = withEffect("double", 4);
  for (const index of [0, 1, 2, 3]) game.squares[index] = "X";
  game.chaos.skippedTurns.O = 1;
  const next = playMove(game, 4, () => 0);
  assert.equal(next.winner.player, "X");
  assert.equal(next.chaos.bonus, null);
  assert.deepEqual(next.chaos.skippedTurns, { X: 0, O: 0 });
  assert.match(next.chaos.lastEvent, /won/);
  assert.doesNotMatch(next.chaos.lastEvent, /choose|skips/);
  assert.deepEqual(next.scores, { X: 1, O: 0 });
});

test("a winning bonus does not promise a skipped turn after the round is over", () => {
  const game = withEffect("double", 3);
  game.squares[1] = "X";
  game.squares[2] = "X";
  const next = playMove(playMove(game, 3, () => 0), 4, () => 0);
  assert.equal(next.winner.player, "X");
  assert.deepEqual(next.chaos.skippedTurns, { X: 0, O: 0 });
  assert.match(next.chaos.lastEvent, /won/);
  assert.doesNotMatch(next.chaos.lastEvent, /skip/);
});

test("sacrifice resolves before checking a completed line and prevents a transient win from counting", () => {
  const game = withEffect("erase", 4);
  for (const index of [0, 1, 2, 3]) game.squares[index] = "X";
  const next = playMove(game, 4, () => 0);
  assert.equal(next.squares[0], null);
  assert.equal(next.squares[24], null);
  assert.equal(next.squares[4], "X");
  assert.equal(next.winner, null);
  assert.equal(next.gameOver, false);
  assert.deepEqual(next.scores, { X: 0, O: 0 });
});

test("Double step behaves symmetrically for O and consecutive doubles clear both skip debts", () => {
  const game = withEffect("double", 6);
  game.xIsNext = false;
  let next = playMove(game, 6, () => 0);
  assert.equal(next.chaos.bonus.player, "O");
  next = playMove(next, 7, () => 0);
  assert.equal(next.xIsNext, true);
  assert.equal(next.chaos.skippedTurns.O, 1);
  next.chaos.effects.push({ id: 2, type: "double", index: 18 });
  next = playMove(next, 18, () => 0);
  next = playMove(next, 17, () => 0);
  assert.equal(next.xIsNext, false);
  assert.deepEqual(next.chaos.skippedTurns, { X: 0, O: 0 });
  assert.equal(next.chaos.turnNumber, 6);
});

test("sacrifice previews retarget after another effect erases the selected marks", () => {
  const game = withEffect("erase");
  game.squares[1] = "X";
  game.squares[23] = "O";
  game.chaos.effects.push({ id: 2, type: "erase", index: 13, targets: { X: 0, O: 24 } });
  const next = playMove(game, 12, () => 0);
  assert.deepEqual(next.chaos.effects[0].targets, { X: 1, O: 23 });
  const final = playMove(next, 13, () => 0.99);
  assert.equal(final.squares[1], null);
  assert.equal(final.squares[23], null);
  assert.equal(final.squares[12], "X");
  assert.equal(final.squares[13], "O");
});
