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
const { Match, shotInput } = await import(
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
test("a shot key tosses and a timed second press produces a legal service", () => {
  const m = make();
  m.step(empty, new Set(["KeyD"]));
  for (let i = 0; i < 21; i++) m.step(empty, empty);
  m.step(empty, new Set(["KeyD"]));
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
  m.step(empty, new Set(["Enter"]));
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
    m.step(empty, new Set(["KeyD"]));
    for (let i = 0; i < 21; i++) m.step(empty, empty);
    m.step(empty, new Set(["KeyD"]));
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
    shot: "normal",
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
        m.phase === "game"
          ? new Set(["Enter"])
          : m.phase === "serve" && m.actors[0].pose === "serve"
            ? new Set(["KeyD"])
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
    shot: "normal",
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
    shot: "normal",
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
    shot: "normal",
  };
  m.step(empty, empty);
  assert.equal(m.phase, "point");
  assert.equal(m.message, "FAULT");
  assert.equal(m.faults, 1);
  assert.deepEqual(m.points, [0, 0]);
  assert.ok(m.ball.vy < 0);
});

test("W/S/A/D start their shots directly and Space has no action", () => {
  for (const [key, shot] of [
    ["KeyW", "lob"],
    ["KeyS", "drop"],
    ["KeyA", "slice"],
    ["KeyD", "topspin"],
  ]) {
    const m = make();
    m.phase = "rally";
    m.rally = 2;
    m.actors[0].pose = "wait";
    m.step(new Set([key]), new Set([key]));
    assert.equal(m.actors[0].shot, shot);
    assert.ok(["fore", "back", "smash"].includes(m.actors[0].pose));
  }
  assert.equal(shotInput(new Set(["Space"])), undefined);
  const m = make();
  m.step(new Set(["Space"]), new Set(["Space"]));
  assert.equal(m.actors[0].pose, "serve");
});
test("the selected shot remains fixed after releasing its key and pressing another", () => {
  const m = make();
  m.phase = "rally";
  m.rally = 2;
  m.actors[0].pose = "wait";
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
    shot: "normal",
  };
  m.step(new Set(["KeyW"]), new Set(["KeyW"]));
  for (let i = 0; i < 3; i++) m.step(new Set(["KeyD"]), empty);
  assert.equal(m.ball.shot, "lob");
  assert.equal(m.rally, 3);
});
function flight(shot, side = 0) {
  const m = make();
  m.phase = "rally";
  m.rally = 2;
  m.actors[side].shot = shot;
  m.actors[side].pose = "fore";
  m.ball = {
    x: 0,
    y: side ? -340 : 340,
    z: 50,
    vx: 0,
    vy: 0,
    rise: 0,
    fall: 0,
    bounces: 0,
    side: 1 - side,
    moving: true,
    shot: "normal",
  };
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    m.launch(side, 1, 1);
  } finally {
    Math.random = random;
  }
  let peak = 50,
    netHeight = 0,
    frames = 0;
  while (m.ball.bounces === 0 && frames++ < 200) {
    const previous = m.ball.y;
    m.moveBall();
    peak = Math.max(peak, m.ball.z);
    if (Math.sign(previous) !== Math.sign(m.ball.y)) netHeight = m.ball.z;
  }
  const firstBounce = { ...m.ball };
  const bouncePeak =
    firstBounce.rise ** 2 /
    (shot === "topspin" ? 2.2 : shot === "slice" ? 0.96 : 1.6);
  return { m, peak, netHeight, frames, firstBounce, bouncePeak };
}
test("lob flies over a net player and lands deep on either side of court", () => {
  for (const side of [0, 1]) {
    const lob = flight("lob", side),
      normal = flight("normal", side);
    assert.ok(lob.peak > normal.peak + 80);
    assert.ok(lob.netHeight > 120);
    assert.ok(
      Math.abs(lob.firstBounce.y) > 230 && Math.abs(lob.firstBounce.y) < 360,
    );
    assert.ok(lob.frames > normal.frames);
  }
});
test("drop shot lands close to net and loses speed and height at bounce", () => {
  const drop = flight("drop"),
    normal = flight("normal");
  assert.ok(drop.netHeight > 40);
  assert.ok(Math.abs(drop.firstBounce.y) < 100);
  assert.ok(drop.bouncePeak < normal.bouncePeak);
  assert.ok(Math.abs(drop.firstBounce.vy) < Math.abs(normal.firstBounce.vy));
});
test("net clearance cannot produce unbounded flight or sky-high arcs", () => {
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    for (const shot of ["normal", "lob", "drop", "slice", "topspin"])
      for (const side of [0, 1])
        for (const y of [1, 5, 25, 380])
          for (const z of [5, 50, 120])
            for (const x of [-250, 0, 250]) {
              const m = make();
              m.phase = "rally";
              m.rally = 2;
              m.actors[side].shot = shot;
              m.actors[side].pose = "fore";
              Object.assign(m.ball, {
                x, y: side ? -y : y, z, moving: true,
                bounces: 0, side: 1 - side,
              });
              m.launch(side, 1, 1);
              let frames = 0, peak = z;
              while (!m.ball.bounces && frames < 45) {
                m.moveBall();
                frames++;
                peak = Math.max(peak, m.ball.z);
              }
              const context = `${shot} side=${side} x=${x} y=${y} z=${z}`;
              const limit = shot === "lob" ? 44 : shot === "drop" ? 38 : 36;
              assert.equal(m.ball.bounces, 1, context);
              assert.ok(frames <= limit, `${context}: ${frames} frames`);
              assert.ok(peak < 280, `${context}: peak ${peak}`);
              assert.ok(Math.abs(m.ball.x - m.target.x) < 1e-6, context);
              assert.ok(Math.abs(m.ball.y - m.target.y) < 1e-6, context);
            }
  } finally {
    Math.random = random;
  }
});
test("drop shot keeps enough pace and rebound to remain playable", () => {
  const m = make();
  Object.assign(m.ball, {
    z: 0.1, rise: 0, fall: 10, vx: 5, vy: -8,
    moving: true, bounces: 0, shot: "drop",
  });
  m.moveBall();
  assert.equal(m.ball.bounces, 1);
  assert.ok(m.ball.moving);
  assert.ok(m.ball.vx / 5 >= 0.55 && m.ball.vx / 5 < 0.6);
  assert.ok(m.ball.vy / -8 >= 0.55 && m.ball.vy / -8 < 0.6);
  assert.ok(m.ball.rise >= 5.5 && m.ball.rise < 6.5);
});
test("CPU movement has the same pace on straight and diagonal paths", () => {
  for (const footwork of [0, 5, 10]) {
    for (const direction of [[200, 0], [0, 200], [200, 200], [-200, -200]]) {
      const m = make();
      const cpu = m.actors[1];
      cpu.stats[3] = footwork;
      cpu.pose = "wait";
      const start = { x: cpu.x, y: cpu.y };
      m.aiDestination = {
        x: start.x + direction[0], y: start.y + direction[1],
      };
      m.continueAfterPoint(empty);
      assert.ok(Math.abs(
        Math.hypot(cpu.x - start.x, cpu.y - start.y) - (6 + 0.3 * footwork),
      ) < 1e-6);
    }
  }
});
test("slice stays lower and topspin kicks higher and faster after bounce", () => {
  const slice = flight("slice"),
    topspin = flight("topspin");
  assert.ok(slice.peak < topspin.peak);
  assert.ok(slice.bouncePeak < topspin.bouncePeak);
  assert.ok(Math.abs(slice.firstBounce.vy) < Math.abs(topspin.firstBounce.vy));
  assert.ok(slice.netHeight > 40 && topspin.netHeight > 40);
});
test("all shot profiles remain finite and land in court across contact positions", () => {
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    for (const shot of ["lob", "drop", "slice", "topspin"])
      for (const side of [0, 1])
        for (const y of [30, 150, 380])
          for (const z of [10, 50, 110])
            for (const h of [0, 1, 2]) {
              const m = make();
              m.rally = 2;
              m.phase = "rally";
              m.actors[side].shot = shot;
              m.actors[side].pose = "fore";
              m.ball = {
                x: 0,
                y: side ? -y : y,
                z,
                vx: 0,
                vy: 0,
                rise: 0,
                fall: 0,
                bounces: 0,
                side: 1 - side,
                moving: true,
                shot: "normal",
              };
              m.launch(side, h, 1);
              let frames = 0;
              while (!m.ball.bounces && frames++ < 300) m.moveBall();
              assert.ok(frames < 300, `${shot} stalled`);
              assert.ok(
                Math.abs(m.ball.x) <= 180 && Math.abs(m.ball.y) <= 360,
                `${shot} landing ${JSON.stringify(m.ball)}`,
              );
              for (const n of Object.values(m.ball))
                if (typeof n === "number") assert.ok(Number.isFinite(n));
            }
  } finally {
    Math.random = random;
  }
});

test("CPU returns a reachable drop shot instead of waiting for it to pass", () => {
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    for (const position of [-70, -150, -260]) {
      const m = make();
      m.phase = "rally";
      m.rally = 2;
      m.actors[0].pose = "wait";
      m.actors[0].shot = "drop";
      m.actors[0].y = 200;
      m.actors[1].pose = "wait";
      m.actors[1].x = 0;
      m.actors[1].y = position;
      m.aim.x = 0;
      m.launch(0, 1, 1);
      for (let t = 0; t < 120 && m.rally === 3 && m.phase === "rally"; t++)
        m.step(empty, empty);
      assert.ok(
        m.rally >= 4,
        `CPU at ${position}: ${m.message}, ball ${JSON.stringify(m.ball)}, actor ${JSON.stringify(m.actors[1])}`,
      );
      assert.equal(m.ball.side, 1);
    }
  } finally {
    Math.random = random;
  }
});
test("CPU chooses lob against a net player and drop against a distant player", () => {
  const m = make(),
    random = Math.random;
  Math.random = () => 0.5;
  try {
    m.rally = 2;
    m.ball.z = 20;
    m.ball.rise = 0;
    m.ball.fall = 0;
    m.actors[0].y = 80;
    assert.equal(m.cpuShot(), "lob");
    m.actors[0].y = 350;
    m.actors[1].y = -100;
    assert.equal(m.cpuShot(), "drop");
    m.actors[1].y = -350;
    Math.random = () => 0.2;
    assert.equal(m.cpuShot(), "topspin");
    Math.random = () => 0.7;
    assert.equal(m.cpuShot(), "slice");
  } finally {
    Math.random = random;
  }
});
test("CPU shot planning clears net at low contact heights, including wide targets", () => {
  const random = Math.random;
  let paths = 0;
  try {
    for (const r of [0.02, 0.5, 0.98]) {
      Math.random = () => r;
      for (const y of [-25, -70, -180, -350])
        for (const z of [5, 20, 80])
          for (const x of [-160, 0, 160])
            for (const shot of ["normal", "slice", "topspin", "drop", "lob"]) {
              const m = make();
              m.rally = 2;
              m.phase = "rally";
              m.actors[1].pose = "fore";
              m.actors[1].shot = shot;
              m.ball = {
                x,
                y,
                z,
                vx: 0,
                vy: 0,
                rise: 0,
                fall: 0,
                bounces: 0,
                side: 0,
                moving: true,
                shot: "normal",
              };
              m.launch(1, 2, 2);
              let crossed = false;
              for (let t = 0; t < 250 && !m.ball.bounces; t++) {
                const before = m.ball.y;
                m.moveBall();
                if (before < 0 && m.ball.y >= 0) {
                  assert.ok(
                    m.ball.z >= 40,
                    `${shot} at ${x},${y},${z} hit net height=${m.ball.z}`,
                  );
                  crossed = true;
                }
              }
              assert.ok(crossed);
              paths++;
            }
    }
    assert.equal(paths, 540);
  } finally {
    Math.random = random;
  }
});
test("aim selects direction immediately and the launched target matches the marker", () => {
  const m = make();
  m.rally = 2;
  m.phase = "rally";
  m.actors[0].pose = "wait";
  m.updateAim(new Set(["ArrowRight", "ArrowUp", "KeyW"]));
  const before = m.aimMarker();
  assert.equal(before.shot, "lob");
  assert.equal(before.locked, false);
  assert.ok(before.point.x > 0);
  m.actors[0].shot = "lob";
  m.launch(0, 1, 1);
  assert.deepEqual(m.target, before.point);
  assert.equal(m.aimMarker().locked, true);
  const target = { ...m.target };
  for (let i = 0; i < 100; i++)
    m.updateAim(new Set(["ArrowLeft", "ArrowDown"]));
  assert.deepEqual(m.aimMarker().point, target);
  assert.equal(m.aim.x, -120);
  assert.equal(m.aim.y, -25);
});

test("CPU actually launches each tactical shot through the gameplay loop", () => {
  const random = Math.random;
  try {
    for (const [shot, userY, cpuY, roll] of [
      ["lob", 80, -150, 0.5],
      ["drop", 350, -70, 0.5],
      ["topspin", 220, -350, 0.2],
      ["slice", 220, -350, 0.7],
    ]) {
      Math.random = () => roll;
      const m = make();
      m.phase = "rally";
      m.rally = 2;
      m.actors[0].pose = "wait";
      m.actors[0].y = userY;
      m.actors[1].pose = "wait";
      m.actors[1].x = 0;
      m.actors[1].y = cpuY;
      m.ball = {
        x: 0,
        y: cpuY + 20,
        z: 20,
        vx: 0,
        vy: -2,
        rise: 0,
        fall: 0,
        bounces: 1,
        side: 0,
        moving: true,
        shot: "normal",
      };
      for (let t = 0; t < 15 && m.rally === 2; t++) m.step(empty, empty);
      assert.equal(m.rally, 3, `${shot} was not hit`);
      assert.equal(m.ball.side, 1);
      assert.equal(m.ball.shot, shot);
    }
  } finally {
    Math.random = random;
  }
});
test("reticle matches the first bounce and does not switch type mid swing", () => {
  const m = make();
  m.phase = "rally";
  m.rally = 2;
  m.actors[0].pose = "wait";
  m.swing(0, "lob");
  m.updateAim(new Set(["KeyD", "ArrowRight"]));
  assert.equal(m.aimMarker().shot, "lob");
  const point = { ...m.aimMarker().point };
  m.launch(0, 1, 1);
  let frames = 0;
  while (!m.ball.bounces && frames++ < 250) m.moveBall();
  assert.ok(Math.abs(m.ball.x - point.x) < 1e-6);
  assert.ok(Math.abs(m.ball.y - point.y) < 1e-6);
});

function aimedHit(direction, shot = "topspin", tap = false) {
  const m = make();
  m.phase = "rally";
  m.rally = 2;
  m.actors[0].pose = "wait";
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
    shot: "normal",
  };
  const key =
    shot === "lob"
      ? "KeyW"
      : shot === "drop"
        ? "KeyS"
        : shot === "slice"
          ? "KeyA"
          : "KeyD";
  const arrows = new Set(direction);
  m.step(new Set([key, ...arrows]), new Set([key, ...arrows]));
  for (let i = 0; i < 3; i++) m.step(tap ? empty : arrows, empty);
  assert.equal(m.rally, 3);
  return m;
}
test("left/right arrows direct actual shots immediately for every shot type", () => {
  for (const shot of ["lob", "drop", "slice", "topspin"]) {
    const left = aimedHit(["ArrowLeft"], shot),
      right = aimedHit(["ArrowRight"], shot);
    assert.equal(left.target.x, -120);
    assert.equal(right.target.x, 120);
    assert.ok(left.ball.vx < 0);
    assert.ok(right.ball.vx > 0);
  }
});
test("up/down arrows change shot depth and diagonal direction combines both axes", () => {
  for (const shot of ["lob", "drop", "slice", "topspin"]) {
    const deep = aimedHit(["ArrowUp", "ArrowRight"], shot),
      short = aimedHit(["ArrowDown", "ArrowLeft"], shot);
    assert.ok(deep.target.y < short.target.y);
    assert.equal(deep.target.x, 120);
    assert.equal(short.target.x, -120);
  }
});
test("a brief directional tap at swing start survives until impact", () => {
  const m = aimedHit(["ArrowLeft", "ArrowUp"], "topspin", true);
  assert.deepEqual(m.target, { x: -120, y: -350 });
});
test("direction can be changed during wind-up but never steers an airborne ball", () => {
  const m = make();
  m.phase = "rally";
  m.rally = 2;
  m.actors[0].pose = "wait";
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
    shot: "normal",
  };
  m.step(new Set(["KeyD", "ArrowLeft"]), new Set(["KeyD"]));
  m.step(new Set(["ArrowRight"]), empty);
  m.step(empty, empty);
  m.step(empty, empty);
  assert.equal(m.target.x, 120);
  const target = { ...m.target },
    vx = m.ball.vx;
  m.step(new Set(["ArrowLeft"]), empty);
  assert.deepEqual(m.target, target);
  assert.equal(m.ball.vx, vx);
});
test("positioning before the swing does not leave a stale directional aim", () => {
  const m = make();
  m.rally = 2;
  m.actors[0].pose = "wait";
  m.updateAim(new Set(["ArrowLeft"]));
  assert.equal(m.aim.x, -120);
  m.updateAim(empty);
  assert.equal(m.aim.x, 0);
});
