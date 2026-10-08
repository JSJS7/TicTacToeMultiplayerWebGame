import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { io } from "socket.io-client";

const request = (socket, event, data) => new Promise((resolve, reject) => {
  socket.timeout(2000).emit(event, data, (err, response) => err ? reject(err) : resolve(response));
});
const waitState = (socket, predicate) => new Promise((resolve, reject) => {
  if (socket.lastState && predicate(socket.lastState)) return resolve(socket.lastState);
  const timer = setTimeout(() => { socket.off("gameState", listener); reject(new Error("State timeout")); }, 2000);
  const listener = (state) => {
    if (!predicate(state)) return;
    clearTimeout(timer);
    socket.off("gameState", listener);
    resolve(state);
  };
  socket.on("gameState", listener);
});

test("Socket.IO validation, authoritative moves and one reset per finished round", async (t) => {
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(), env: { ...process.env, PORT: "0", NODE_ENV: "test" }, stdio: ["ignore", "pipe", "pipe"],
  });
  const sockets = [];
  t.after(() => { for (const socket of sockets) socket.disconnect(); child.kill(); });
  const port = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("Server startup timeout: " + output)), 5000);
    child.stdout.on("data", (data) => {
      output += data;
      const match = output.match(/Server listening on port (\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    child.stderr.on("data", (data) => { output += data; });
    child.once("error", (err) => { clearTimeout(timer); reject(err); });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  const connect = async () => {
    const socket = io(`http://127.0.0.1:${port}`, { autoConnect: false, reconnection: false });
    sockets.push(socket);
    socket.on("gameState", (state) => { socket.lastState = state; });
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve); socket.once("connect_error", reject); socket.connect();
    });
    return socket;
  };
  const x = await connect();
  const o = await connect();
  const outsider = await connect();
  const lobbyId = "regression-test";
  const join = { lobbyId, boardWidth: 5, boardHeight: 5 };
  const action = { lobbyId, roundId: 1 };

  await t.test("malformed messages never crash the server", async () => {
    for (const event of ["joinLobby", "makeMove", "resetGame"]) {
      for (const data of [null, [], "text", 42, {}]) assert.equal((await request(x, event, data)).ok, false);
      await new Promise((resolve, reject) => {
        const onError = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => {
          x.off("error", onError);
          reject(new Error(`No error response for ${event}`));
        }, 2000);
        x.once("error", onError);
        x.emit(event);
      });
    }
    for (const [boardWidth, boardHeight] of [[3.5, 3], ["3", "3"], [3, 4], [20, 20]]) {
      assert.equal((await request(x, "joinLobby", { ...join, boardWidth, boardHeight })).ok, false);
    }
    for (const id of ["", {}, "../invalid", "x".repeat(65)]) {
      assert.equal((await request(x, "joinLobby", { ...join, lobbyId: id })).ok, false);
    }
    assert.equal((await request(x, "joinLobby", join)).ok, true);
    assert.equal(x.lastState.squares.length, 25);
    assert.deepEqual(x.lastState.scores, { X: 0, O: 0 });
    assert.equal((await request(x, "makeMove", { ...action, index: 0 })).ok, false);
    assert.equal((await request(o, "joinLobby", { ...join, boardWidth: 3, boardHeight: 3 })).ok, true);
    await waitState(x, (state) => state.playerCount === 2);
    assert.equal(o.lastState.boardWidth, 5);
    assert.deepEqual(o.lastState.scores, { X: 0, O: 0 });
  });

  await t.test("capacity, membership, integer index, turn and reset checks", async () => {
    assert.equal((await request(outsider, "joinLobby", join)).ok, false);
    assert.equal(outsider.lastState, undefined);
    assert.equal((await request(outsider, "makeMove", { ...action, index: 0 })).ok, false);
    assert.equal((await request(outsider, "resetGame", action)).ok, false);
    for (const index of [-1, 25, 0.5, "0", null, {}]) {
      assert.equal((await request(x, "makeMove", { ...action, index })).ok, false);
    }
    assert.equal((await request(o, "makeMove", { ...action, index: 0 })).ok, false);
    assert.equal((await request(x, "resetGame", action)).ok, false);
    assert.ok(x.lastState.squares.every((square) => square === null));
  });

  await t.test("both clients receive the same accepted board; only five signs end a 5x5 round", async () => {
    for (const [socket, index] of [[x,0], [o,5], [x,1], [o,6], [x,2], [o,7], [x,3], [o,8], [x,4]]) {
      assert.equal((await request(socket, "makeMove", { ...action, index })).ok, true);
      await waitState(x, (state) => state.squares[index] !== null);
      await waitState(o, (state) => state.squares[index] !== null);
      assert.deepEqual(x.lastState.squares, o.lastState.squares);
      assert.deepEqual(x.lastState.scores, { X: index === 4 ? 1 : 0, O: 0 });
      assert.equal(x.lastState.gameOver, index === 4);
      assert.deepEqual(o.lastState.scores, x.lastState.scores);
      if (index === 0) assert.equal((await request(o, "makeMove", { ...action, index: 0 })).ok, false);
    }
    assert.equal(x.lastState.winner.player, "X");
    assert.equal(x.lastState.gameOver, true);
    assert.equal((await request(o, "makeMove", { ...action, index: 10 })).ok, false);
    assert.deepEqual(x.lastState.scores, { X: 1, O: 0 });
  });

  await t.test("simultaneous resets advance one round and alternate the starter once", async () => {
    const responses = await Promise.all([request(x, "resetGame", action), request(o, "resetGame", action)]);
    assert.equal(responses.filter((response) => response.ok).length, 1);
    await waitState(x, (state) => state.roundId === 2);
    await waitState(o, (state) => state.roundId === 2);
    assert.equal(x.lastState.xIsNext, false);
    assert.equal(x.lastState.winner, null);
    assert.deepEqual(x.lastState.scores, { X: 1, O: 0 });
    assert.deepEqual(o.lastState.scores, { X: 1, O: 0 });
    assert.ok(x.lastState.squares.every((square) => square === null));
    assert.equal((await request(x, "makeMove", { ...action, index: 0 })).ok, false);
    assert.equal((await request(o, "makeMove", { lobbyId, roundId: 2, index: 0 })).ok, true);
    assert.equal((await request(o, "resetGame", { lobbyId, roundId: 2 })).ok, false);
  });

  await t.test("disconnect freezes moves; a rejoining player gets a complete snapshot", async () => {
    o.disconnect();
    await waitState(x, (state) => state.playerCount === 1);
    assert.equal((await request(x, "makeMove", { lobbyId, roundId: 2, index: 1 })).ok, false);
    const rejoined = await connect();
    assert.equal((await request(rejoined, "joinLobby", join)).ok, true);
    assert.equal(rejoined.lastState.symbol, "O");
    assert.equal(rejoined.lastState.squares[0], "O");
    assert.equal(rejoined.lastState.roundId, 2);
    assert.deepEqual(rejoined.lastState.scores, { X: 1, O: 0 });
    await waitState(x, (state) => state.playerCount === 2);

    for (const [player, index] of [[x, 5], [rejoined, 1], [x, 6], [rejoined, 2], [x, 7], [rejoined, 3], [x, 8], [rejoined, 4]]) {
      assert.equal((await request(player, "makeMove", { lobbyId, roundId: 2, index })).ok, true);
    }
    await Promise.all([x, rejoined].map((socket) =>
      waitState(socket, (state) => state.roundId === 2 && state.winner?.player === "O")
    ));
    assert.deepEqual(x.lastState.scores, { X: 1, O: 1 });
    assert.deepEqual(rejoined.lastState.scores, { X: 1, O: 1 });
    assert.equal((await request(x, "resetGame", { lobbyId, roundId: 2 })).ok, true);

    for (const [player, index] of [[x, 0], [rejoined, 5], [x, 1], [rejoined, 6], [x, 2], [rejoined, 7], [x, 3], [rejoined, 8], [x, 4]]) {
      assert.equal((await request(player, "makeMove", { lobbyId, roundId: 3, index })).ok, true);
    }
    await Promise.all([x, rejoined].map((socket) =>
      waitState(socket, (state) => state.roundId === 3 && state.winner?.player === "X")
    ));
    assert.deepEqual(x.lastState.scores, { X: 2, O: 1 });
    assert.deepEqual(rejoined.lastState.scores, { X: 2, O: 1 });
  });

  await t.test("3x3 and 4x4 presets work; a draw also permits one reset", async () => {
    for (const size of [3, 4]) {
      const first = await connect();
      const second = await connect();
      const id = `preset-${size}`;
      const settings = { lobbyId: id, boardWidth: size, boardHeight: size };
      assert.equal((await request(first, "joinLobby", settings)).ok, true);
      assert.equal((await request(second, "joinLobby", settings)).ok, true);
      assert.equal(second.lastState.squares.length, size * size);
      if (size === 3) {
        const moves = [0, 1, 2, 4, 3, 5, 7, 6, 8];
        for (const [turn, index] of moves.entries()) {
          assert.equal((await request(turn % 2 === 0 ? first : second, "makeMove", {
            lobbyId: id, roundId: 1, index,
          })).ok, true);
        }
        await waitState(first, (state) => state.isDraw);
        assert.equal(first.lastState.winner, null);
        assert.equal(first.lastState.gameOver, true);
        assert.deepEqual(first.lastState.scores, { X: 0, O: 0 });
        assert.equal((await request(first, "resetGame", { lobbyId: id, roundId: 1 })).ok, true);
        assert.equal(first.lastState.isDraw, false);
        assert.equal(first.lastState.roundId, 2);
        assert.deepEqual(first.lastState.scores, { X: 0, O: 0 });
      } else {
        for (const [turn, index] of [0, 4, 1, 5, 2, 6, 3].entries()) {
          assert.equal((await request(turn % 2 === 0 ? first : second, "makeMove", {
            lobbyId: id, roundId: 1, index,
          })).ok, true);
          await waitState(first, (state) => state.squares[index] !== null);
          assert.equal(first.lastState.gameOver, index === 3);
        }
        assert.equal(first.lastState.winner.player, "X");
        assert.deepEqual(first.lastState.winner.line, [0, 1, 2, 3]);
      }
      first.disconnect();
      second.disconnect();
    }
  });
});
