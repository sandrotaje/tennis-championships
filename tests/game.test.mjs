import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const source = ts.transpileModule(
  readFileSync(new URL("../src/game.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  },
).outputText;
const { Match } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
const empty = new Set();
const make = () =>
  new Match(
    ["YOU", "COM"],
    [
      [5, 5, 5, 5, 0, 0],
      [5, 5, 5, 5, 5, 0],
    ],
  );
test("deuce and advantage require two consecutive points", () => {
  const m = make();
  m.points = [3, 3];
  assert.equal(m.score(), "DEUCE");
  m.award(0);
  assert.equal(m.score(), "ADVANTAGE YOU");
  m.phase = "rally";
  m.award(1);
  assert.equal(m.score(), "DEUCE");
  m.phase = "rally";
  m.award(0);
  m.phase = "rally";
  m.award(0);
  assert.deepEqual(m.games, [1, 0]);
  assert.equal(m.phase, "game");
});
test("second service fault awards receiver, first does not", () => {
  const m = make();
  m.fault();
  assert.deepEqual(m.points, [0, 0]);
  for (let i = 0; i < 30; i++) m.step(empty, empty);
  assert.equal(m.faults, 1);
  m.fault();
  assert.deepEqual(m.points, [0, 1]);
  assert.equal(m.message, "DOUBLE FAULT");
});
test("a lost point alternates service court and clears faults", () => {
  const m = make();
  m.award(1);
  for (let i = 0; i < 40; i++) m.step(empty, empty);
  assert.equal(m.serveSide, -1);
  assert.equal(m.phase, "serve");
  assert.equal(m.server, 0);
});
test("space tosses and a timed second press produces a legal service", () => {
  const m = make();
  m.step(empty, new Set(["Space"]));
  for (let i = 0; i < 21; i++) m.step(empty, empty);
  m.step(empty, new Set(["Space"]));
  for (let i = 0; i < 3; i++) m.step(empty, empty);
  assert.equal(m.rally, 1);
  assert.equal(m.phase, "rally");
  assert.ok(m.ball.vy < 0);
  for (let i = 0; i < 18; i++) m.step(empty, empty);
  assert.ok(m.ball.y < 360);
});
test("player stays on own side of net and keyboard movement works", () => {
  const m = make();
  m.actors[0].pose = "wait";
  for (let i = 0; i < 100; i++) m.step(new Set(["ArrowUp"]), empty);
  assert.equal(m.actors[0].y, 20);
});
test("match ends only with three games and a two-game lead", () => {
  const m = make();
  m.games = [2, 2];
  m.points = [3, 0];
  m.award(0);
  assert.equal(m.phase, "game");
  m.step(empty, new Set(["Space"]));
  m.points = [3, 0];
  m.phase = "rally";
  m.award(0);
  assert.equal(m.phase, "over");
  assert.deepEqual(m.games, [4, 2]);
});

test("computer returns a playable service after reacting to its landing position", () => {
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    const m = make();
    m.step(empty, new Set(["Space"]));
    for (let i = 0; i < 21; i++) m.step(empty, empty);
    m.step(empty, new Set(["Space"]));
    for (let i = 0; i < 80 && m.rally < 2; i++) m.step(empty, empty);
    assert.ok(
      m.rally >= 2,
      `rally=${m.rally}, phase=${m.phase}, ball=${JSON.stringify(m.ball)}`,
    );
    assert.equal(m.ball.side, 1);
    assert.ok(m.ball.vy > 0);
  } finally {
    Math.random = random;
  }
});

test("a player cannot hit their own outgoing ball a second time", () => {
  const m = make();
  m.phase = "rally";
  m.rally = 2;
  m.ball = {
    x: m.actors[0].x + 10,
    y: m.actors[0].y,
    z: 20,
    vx: 0,
    vy: 0,
    rise: 0,
    fall: 0,
    bounces: 0,
    side: 0,
    moving: true,
  };
  m.swing(0);
  for (let i = 0; i < 3; i++) m.step(empty, empty);
  assert.equal(m.rally, 2);
});

test("a complete match progresses through faults, computer service, games and victory without stalling", () => {
  const m = make();
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    let frames = 0;
    while (m.phase !== "over" && frames++ < 20000) {
      const input =
        m.phase === "game" ||
        (m.phase === "serve" && m.actors[0].pose === "serve")
          ? new Set(["Space"])
          : empty;
      m.step(empty, input);
      for (const value of Object.values(m.ball))
        if (typeof value === "number") assert.ok(Number.isFinite(value));
    }
    assert.equal(m.phase, "over");
    assert.equal(m.winner, 1);
    assert.deepEqual(m.games, [0, 3]);
    assert.ok(frames < 20000);
  } finally {
    Math.random = random;
  }
});

function netBall(m, rally = 1) {
  m.phase = "rally";
  m.rally = rally;
  m.ball = {
    x: -50,
    y: 5,
    z: 20,
    vx: 1,
    vy: -10,
    rise: 0,
    fall: 0,
    bounces: 0,
    side: 0,
    moving: true,
  };
}
test("service NET repeats the same attempt without points or additional faults", () => {
  const m = make();
  m.fault();
  for (let i = 0; i < 30; i++) m.step(empty, empty);
  assert.equal(m.faults, 1);
  netBall(m);
  m.step(empty, empty);
  assert.equal(m.message, "NET");
  assert.equal(m.winner, -1);
  assert.equal(m.faults, 1);
  assert.deepEqual(m.points, [0, 0]);
  for (let i = 0; i < 30; i++) m.step(empty, empty);
  assert.equal(m.phase, "serve");
  assert.equal(m.server, 0);
  assert.equal(m.serveSide, 1);
  assert.equal(m.faults, 1);
  m.fault();
  assert.equal(m.message, "DOUBLE FAULT");
  assert.deepEqual(m.points, [0, 1]);
});
test("NET during a rally awards exactly one point and does not affect service faults", () => {
  const m = make();
  netBall(m, 2);
  m.step(empty, empty);
  assert.equal(m.message, "NET");
  assert.deepEqual(m.points, [0, 1]);
  assert.equal(m.faults, 0);
  for (let i = 0; i < 20; i++) m.step(empty, empty);
  assert.deepEqual(m.points, [0, 1]);
});
test("after an error ball physics and player controls continue without changing the result", () => {
  const m = make();
  netBall(m);
  m.step(empty, empty);
  const y = m.ball.y,
    x = m.actors[0].x;
  const points = [...m.points];
  m.step(new Set(["ArrowRight"]), empty);
  assert.notEqual(m.ball.y, y);
  assert.ok(m.actors[0].x > x);
  assert.deepEqual(m.points, points);
  assert.equal(m.message, "NET");
  m.fault();
  assert.equal(m.faults, 0);
  assert.deepEqual(m.points, points);
});
test("an out service keeps bouncing after the fault instead of freezing", () => {
  const m = make();
  m.phase = "rally";
  m.rally = 1;
  m.ball = {
    x: 210,
    y: -160,
    z: 0.1,
    vx: 2,
    vy: -2,
    rise: 0,
    fall: 5,
    bounces: 0,
    side: 0,
    moving: true,
  };
  m.step(empty, empty);
  assert.equal(m.message, "FAULT");
  const x = m.ball.x;
  m.step(empty, empty);
  assert.notEqual(m.ball.x, x);
  assert.ok(m.ball.z > 0);
  assert.equal(m.faults, 1);
  assert.deepEqual(m.points, [0, 0]);
});
test("hitting the dead ball is visual only and cannot restart scoring", () => {
  const m = make();
  m.fault();
  m.actors[0].pose = "fore";
  m.actors[0].tick = 2;
  m.ball = {
    x: m.actors[0].x + 10,
    y: m.actors[0].y,
    z: 50,
    vx: 0,
    vy: 0,
    rise: 0,
    fall: 0,
    bounces: 1,
    side: 1,
    moving: true,
  };
  m.step(empty, empty);
  assert.equal(m.phase, "point");
  assert.equal(m.message, "FAULT");
  assert.equal(m.faults, 1);
  assert.deepEqual(m.points, [0, 0]);
  assert.ok(m.ball.vy < 0);
});
