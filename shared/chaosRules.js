export const CHAOS_EFFECTS = {
  block: {
    name: "Dead tile",
    description: "One random empty tile becomes unusable until the round ends. Hover or focus to preview the target.",
  },
  scatter: {
    name: "Wild mark",
    description:
      "Add a random extra mark, at least two tiles away from all your marks.",
  },
  double: {
    name: "Double step",
    description:
      "Place another mark on an empty neighboring tile without a power-up, including diagonals. Skip your next turn.",
  },
  erase: {
    name: "Equal sacrifice",
    description:
      "Remove one random X and one random O. Hover or focus to preview the targets. Both marks must exist.",
  },
};

export function createChaos() {
  return {
    blocked: [],
    effects: [],
    bonus: null,
    skippedTurns: { X: 0, O: 0 },
    turnNumber: 0,
    nextSpawnAt: 2,
    effectSequence: 0,
    lastEvent: "Effects appear after both players place their first mark.",
  };
}

export function areNeighbors(first, second, width) {
  return (
    first !== second &&
    Math.abs(Math.floor(first / width) - Math.floor(second / width)) <= 1 &&
    Math.abs((first % width) - (second % width)) <= 1
  );
}

export function availableMoves(game) {
  return game.squares.flatMap((value, index) => {
    if (value !== null || game.chaos?.blocked.includes(index)) return [];
    if (
      game.chaos?.bonus &&
      (!areNeighbors(index, game.chaos.bonus.anchor, game.boardWidth) ||
        game.chaos.effects.some((effect) => effect.index === index))
    )
      return [];
    return [index];
  });
}

const choose = (items, random) =>
  items.length ? items[Math.floor(random() * items.length)] : null;
const markIndices = (game, player) =>
  game.squares.flatMap((value, index) => (value === player ? [index] : []));
const emptyTiles = (game) =>
  game.squares.flatMap((value, index) =>
    value === null && !game.chaos.blocked.includes(index) ? [index] : [],
  );
const plainTiles = (game) => emptyTiles(game).filter((index) =>
  !game.chaos.effects.some((effect) => effect.index === index),
);
const scatterTargets = (game, anchor, player) => {
  const marks = markIndices(game, player);
  return plainTiles(game).filter((index) =>
    index !== anchor && !areNeighbors(index, anchor, game.boardWidth) &&
    marks.every((mark) => !areNeighbors(index, mark, game.boardWidth)),
  );
};

export function refreshTargets(game, random) {
  for (const effect of game.chaos.effects) {
    if (effect.type === "block") {
      const candidates = plainTiles(game).filter((index) => index !== effect.index);
      if (!candidates.includes(effect.target)) {
        effect.target = choose(candidates, random);
      }
      continue;
    }
    if (effect.type !== "erase") continue;
    for (const player of ["X", "O"]) {
      if (game.squares[effect.targets[player]] !== player)
        effect.targets[player] = choose(markIndices(game, player), random);
    }
  }
}

export function spawnEffect(game, random) {
  const chaos = game.chaos;
  if (chaos.turnNumber < chaos.nextSpawnAt) return;
  chaos.nextSpawnAt = chaos.turnNumber + 4;
  if (chaos.effects.length >= 2) return;
  const plain = plainTiles(game);
  const empty = plain.filter((index) =>
    !chaos.effects.some((effect) => effect.type === "block" && effect.target === index),
  );
  const remote = empty.filter((index) =>
    game.squares.every(
      (value, other) => !value || !areNeighbors(index, other, game.boardWidth),
    ),
  );
  const options = {
    block: plain.length > 1 ? empty : [],
    scatter: remote.filter((index) => ["X", "O"].every((player) => scatterTargets(game, index, player).length > 0)),
    double: remote.filter((index) =>
      plain.some((other) =>
        areNeighbors(index, other, game.boardWidth),
      ),
    ),
    erase:
      markIndices(game, "X").length && markIndices(game, "O").length
        ? empty
        : [],
  };
  const type = choose(
    Object.keys(options).filter((key) => options[key].length),
    random,
  );
  if (!type) return;
  const effect = {
    id: ++chaos.effectSequence,
    type,
    index: choose(options[type], random),
  };
  if (type === "block") effect.target = choose(plain.filter((index) => index !== effect.index), random);
  if (type === "erase")
    effect.targets = {
      X: choose(markIndices(game, "X"), random),
      O: choose(markIndices(game, "O"), random),
    };
  chaos.effects.push(effect);
  if (chaos.effectSequence === 1)
    chaos.lastEvent =
      "Power-ups are live. Place your mark on an icon to collect its effect.";
}

export function applyEffect(game, effect, player, random) {
  const chaos = game.chaos;
  const name = CHAOS_EFFECTS[effect.type].name;
  if (effect.type === "block") {
    const index = effect.target;
    if (Number.isInteger(index) && plainTiles(game).includes(index)) {
      chaos.blocked.push(index);
      chaos.lastEvent = `${player} collected ${name}: row ${Math.floor(index / game.boardWidth) + 1}, column ${(index % game.boardWidth) + 1} is blocked.`;
    } else chaos.lastEvent = `${name}: no empty tile to block.`;
  } else if (effect.type === "scatter") {
    const index = choose(
      scatterTargets(game, effect.index, player),
      random,
    );
    if (index !== null) {
      game.squares[index] = player;
      chaos.lastEvent = `${player} collected ${name}: an extra ${player} appeared on the board.`;
    } else chaos.lastEvent = `${name}: no tile far enough from your marks.`;
  } else if (effect.type === "double") {
    const neighbors = plainTiles(game).filter((index) =>
      areNeighbors(index, effect.index, game.boardWidth),
    );
    if (neighbors.length) {
      chaos.bonus = { player, anchor: effect.index };
      chaos.lastEvent = `${player} collected ${name}: choose an outlined neighboring tile.`;
    } else
      chaos.lastEvent = `${name}: no empty neighboring tile, so no turn is skipped.`;
  } else if (effect.type === "erase") {
    if (!["X", "O"].every((symbol) => Number.isInteger(effect.targets[symbol]) && game.squares[effect.targets[symbol]] === symbol)) {
      chaos.lastEvent = `${name} needs both an X and an O. No marks were removed.`;
      return;
    }
    for (const symbol of ["X", "O"]) {
      const index = effect.targets[symbol];
      game.squares[index] = null;
    }
    chaos.lastEvent = `${player} collected ${name}: the highlighted marks were removed.`;
  }
}

export function finishChaosTurn(game) {
  const chaos = game.chaos;
  chaos.turnNumber += 1;
  game.xIsNext = !game.xIsNext;
  let nextPlayer = game.xIsNext ? "X" : "O";
  while (chaos.skippedTurns[nextPlayer] > 0) {
    chaos.skippedTurns[nextPlayer] -= 1;
    chaos.turnNumber += 1;
    chaos.lastEvent += ` ${nextPlayer} skips a turn after Double step.`;
    game.xIsNext = !game.xIsNext;
    nextPlayer = game.xIsNext ? "X" : "O";
  }
}
