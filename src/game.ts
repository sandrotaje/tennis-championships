export type ShotType = "normal" | "lob" | "drop" | "slice" | "topspin";
export const SHOT_KEYS = [
  ["KeyW", "lob"],
  ["KeyS", "drop"],
  ["KeyA", "slice"],
  ["KeyD", "topspin"],
] as const satisfies readonly (readonly [string, ShotType])[];
export function shotInput(keys: ReadonlySet<string>): ShotType | undefined {
  return SHOT_KEYS.find(([key]) => keys.has(key))?.[1];
}
interface ShotProfile {
  gravity: number;
  speed: number;
  minimumFlight: number;
  maximumFlight: number;
  bounceHeight: number;
  bounceSpeed: number;
}
const SHOTS: Record<ShotType, ShotProfile> = {
  normal: {
    gravity: 0.8,
    speed: 1,
    minimumFlight: 0,
    maximumFlight: 36,
    bounceHeight: 2 / 3,
    bounceSpeed: 0.6,
  },
  lob: {
    gravity: 0.8,
    speed: 0.55,
    minimumFlight: 38,
    maximumFlight: 44,
    bounceHeight: 0.6,
    bounceSpeed: 0.5,
  },
  drop: {
    gravity: 0.8,
    speed: 0.85,
    minimumFlight: 14,
    maximumFlight: 38,
    bounceHeight: 0.55,
    bounceSpeed: 0.58,
  },
  slice: {
    gravity: 0.48,
    speed: 0.85,
    minimumFlight: 0,
    maximumFlight: 36,
    bounceHeight: 0.38,
    bounceSpeed: 0.65,
  },
  topspin: {
    gravity: 1.1,
    speed: 1.08,
    minimumFlight: 0,
    maximumFlight: 36,
    bounceHeight: 0.85,
    bounceSpeed: 0.8,
  },
};
function advanceBall(b: Ball): boolean {
  if (!b.moving) return false;
  const profile = SHOTS[b.shot];
  b.z += b.rise - b.fall;
  b.fall += profile.gravity;
  b.x += b.vx;
  b.y += b.vy;
  if (b.z > 1e-7) return false;
  b.z = 0;
  b.rise = (b.fall - b.rise) * profile.bounceHeight;
  b.fall = 0;
  b.vx *= profile.bounceSpeed;
  b.vy *= profile.bounceSpeed;
  b.bounces++;
  if (b.rise < 1.3) b.moving = false;
  return true;
}
export type Pose =
  | "wait"
  | "left"
  | "right"
  | "fore"
  | "back"
  | "smash"
  | "serve"
  | "toss"
  | "win"
  | "lose";
export type Stats = [number, number, number, number, number, number];
export interface Actor {
  x: number;
  y: number;
  pose: Pose;
  tick: number;
  stats: Stats;
  shot: ShotType;
}
export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  rise: number;
  fall: number;
  bounces: number;
  side: number;
  moving: boolean;
  shot: ShotType;
}
export type Phase = "serve" | "rally" | "point" | "game" | "over";
export class Match {
  actors: Actor[];
  ball: Ball = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    rise: 0,
    fall: 0,
    bounces: 0,
    side: 0,
    moving: false,
    shot: "normal",
  };
  points = [0, 0];
  games = [0, 0];
  server = 0;
  serveSide = 1;
  phase: Phase = "serve";
  message = "";
  timer = 0;
  faults = 0;
  rally = 0;
  winner = -1;
  target = { x: 0, y: -360 };
  aim = { x: 0, y: -187.5 };
  selectedShot: ShotType = "topspin";
  updateAim(keys: ReadonlySet<string>) {
    const preparing = ["fore", "back", "smash", "toss"].includes(
      this.actors[0]!.pose,
    );
    const horizontal = keys.has("ArrowLeft") || keys.has("ArrowRight");
    const vertical = keys.has("ArrowUp") || keys.has("ArrowDown");
    // Direction responds immediately, and short taps remain selected through
    // the wind-up instead of disappearing before the contact frame.
    if (horizontal || !preparing)
      this.aim.x =
        (Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"))) * 120;
    if (vertical || !preparing) {
      const direction =
        Number(keys.has("ArrowDown")) - Number(keys.has("ArrowUp"));
      this.aim.y = direction < 0 ? -350 : direction > 0 ? -25 : -187.5;
    }
    const shot = shotInput(keys);
    if (shot) this.selectedShot = shot;
  }
  aimPoint(shot: ShotType = this.selectedShot) {
    const depth = (-this.aim.y - 25) / 325;
    if (this.rally === 0) {
      const x = ((this.aim.x + 170) / 340) * 160 + 10;
      return {
        x: this.serveSide === 1 ? -170 + (x - 10) : x,
        y: -(110 + depth * 80),
      };
    }
    const range =
      shot === "drop" ? [45, 115] : shot === "lob" ? [240, 330] : [120, 350];
    return { x: this.aim.x, y: -(range[0]! + depth * (range[1]! - range[0]!)) };
  }
  aimMarker() {
    const actor = this.actors[0]!;
    const preparing = ["fore", "back", "smash"].includes(actor.pose);
    const shot =
      this.rally === 0 ? "normal" : preparing ? actor.shot : this.selectedShot;
    return this.rally > 0 && this.ball.side === 0 && this.ball.moving
      ? { point: this.target, locked: true, shot: this.ball.shot }
      : { point: this.aimPoint(shot), locked: false, shot };
  }
  predictBall(ticks: number) {
    const b = { ...this.ball };
    for (let i = 0; i < ticks; i++) advanceBall(b);
    return b;
  }
  cpuShot(): ShotType {
    if (this.rally === 0) return "normal";
    const future = this.predictBall(3),
      cpu = this.actors[1]!,
      user = this.actors[0]!;
    if (future.z > 70 && Math.abs(future.x - cpu.x) < 45 && cpu.y > -220)
      return "normal";
    if (user.y < 150) return Math.random() < 0.8 ? "lob" : "topspin";
    if (user.y > 260 && cpu.y > -250)
      return Math.random() < 0.65 ? "drop" : "slice";
    const roll = Math.random();
    return roll < 0.55
      ? "topspin"
      : roll < 0.9
        ? "slice"
        : user.y > 280
          ? "drop"
          : "lob";
  }
  interception() {
    const a = this.actors[1]!,
      speed = 6 + 0.3 * a.stats[3],
      b = { ...this.ball };
    let fallback = { x: this.target.x, y: Math.min(-25, this.target.y) },
      best = Infinity;
    for (let t = 1; t <= 150; t++) {
      advanceBall(b);
      if (!b.moving || b.bounces >= 2) break;
      if (b.y >= -20 || b.z > 110 || (this.rally === 1 && b.bounces === 0))
        continue;
      const travel =
        Math.hypot(
          Math.max(0, Math.abs(b.x - a.x) - 35),
          Math.max(0, Math.abs(b.y - a.y) - 55),
        ) / speed;
      const miss = travel - (t - 3);
      if (miss < best) {
        best = miss;
        fallback = { x: b.x, y: b.y };
      }
      if (t >= 3 && miss <= 0) return { x: b.x, y: b.y };
    }
    return fallback;
  }
  aiDestination: { x: number; y: number } | undefined;
  aiFreeze = 0;
  netApproach = false;
  constructor(
    public names: [string, string],
    stats: [Stats, Stats],
  ) {
    this.actors = stats.map((s, i) => ({
      x: 0,
      y: i ? -360 : 360,
      pose: "wait",
      tick: 0,
      stats: s,
      shot: "normal",
    }));
    this.reset();
  }
  reset() {
    this.phase = "serve";
    this.message = "";
    this.rally = 0;
    this.aim = { x: 0, y: -187.5 };
    this.actors.forEach((a, i) => {
      a.x =
        (i === this.server ? this.serveSide * 20 : -this.serveSide * 120) *
        (this.server ? -1 : 1);
      a.y = i ? -380 : 380;
      a.pose = i === this.server ? "serve" : "wait";
      a.tick = 0;
      a.shot = "normal";
    });
    const a = this.actors[this.server]!;
    this.ball = {
      x: a.x,
      y: a.y,
      z: 50,
      vx: 0,
      vy: 0,
      rise: 0,
      fall: 0,
      bounces: 0,
      side: 1 - this.server,
      moving: false,
      shot: "normal",
    };
    this.target = { x: this.actors[1]!.x, y: -380 };
    this.aiDestination = undefined;
    this.aiFreeze = 0;
    this.netApproach = false;
  }
  award(w: number, message = "") {
    if (this.phase !== "rally" && this.phase !== "serve") return;
    this.winner = w;
    this.points[w]!++;
    this.phase = "point";
    this.timer = 40;
    this.message = message || this.score();
    this.actors[w]!.pose = "win";
    this.actors[1 - w]!.pose = "lose";
    if (this.points[w]! >= 4 && this.points[w]! - this.points[1 - w]! >= 2) {
      this.games[w]!++;
      this.phase = "game";
      this.message = `${this.names[w]} WINS GAME`;
      if (this.games[w]! >= 3 && this.games[w]! - this.games[1 - w]! >= 2) {
        this.phase = "over";
        this.message = `${this.names[w]} WINS MATCH`;
      }
    }
  }
  score() {
    const p = this.points;
    const labels = ["0", "15", "30", "40"];
    if (p[0]! >= 3 && p[1]! >= 3)
      return p[0] === p[1]
        ? "DEUCE"
        : `ADVANTAGE ${this.names[p[0]! > p[1]! ? 0 : 1]}`;
    return `${labels[p[this.server]!] ?? "40"} - ${labels[p[1 - this.server]!] ?? "40"}`;
  }
  releaseServePose() {
    for (const actor of this.actors) {
      if (actor.pose === "serve" || actor.pose === "toss") {
        actor.pose = "wait";
        actor.tick = 0;
      }
    }
  }
  fault() {
    if (this.phase !== "serve" && this.phase !== "rally") return;
    this.releaseServePose();
    this.faults++;
    if (this.faults >= 2) {
      this.award(1 - this.server, "DOUBLE FAULT");
      return;
    }
    this.phase = "point";
    this.winner = -1;
    this.message = "FAULT";
    this.timer = 30;
  }
  repeatServe() {
    if (this.phase !== "rally") return;
    this.releaseServePose();
    this.phase = "point";
    this.winner = -1;
    this.message = "NET";
    this.timer = 30;
  }
  moveUser(keys: Set<string>) {
    const a = this.actors[0]!;
    const speed = 6 + 0.3 * a.stats[3];
    const x = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
    const y = Number(keys.has("ArrowDown")) - Number(keys.has("ArrowUp"));
    a.x = Math.max(-250, Math.min(250, a.x + x * speed));
    a.y = Math.max(20, Math.min(420, a.y + y * speed));
    a.pose = x < 0 ? "left" : x > 0 ? "right" : "wait";
    const shot = shotInput(keys);
    if (shot) this.swing(0, shot);
  }
  moveCpuToward(target: { x: number; y: number }) {
    const a = this.actors[1]!;
    const speed = 6 + 0.3 * a.stats[3];
    const dx = target.x - a.x, dy = target.y - a.y;
    const x = Math.abs(dx) > 10 ? dx : 0;
    const y = Math.abs(dy) > 10 ? dy : 0;
    const distance = Math.hypot(x, y);
    if (distance > 0) {
      const fraction = Math.min(1, speed / distance);
      a.x += x * fraction;
      a.y += y * fraction;
    }
    a.pose = dx < -10 ? "left" : dx > 10 ? "right" : "wait";
  }
  // Once the result is fixed, keep the scene moving without adjudicating it again.
  canHit(i: number, b: Ball = this.ball, pose: Pose = this.actors[i]!.pose) {
    const a = this.actors[i]!;
    const dx = (b.x - a.x) * (i ? -1 : 1),
      dy = b.y - a.y;
    return (
      b.side !== i &&
      dx >= (pose === "fore" ? -10 : pose === "back" ? -60 : -30) &&
      dx <= (pose === "fore" ? 60 : pose === "back" ? 10 : 50) &&
      dy >= (i ? -80 : -120) &&
      dy <= (i ? 120 : 80) &&
      b.z <= 120
    );
  }
  continueAfterPoint(keys: Set<string>) {
    this.actors.forEach((a, i) => {
      a.tick++;
      if (["fore", "back", "smash"].includes(a.pose)) {
        if (a.tick === 3 && this.ball.moving && this.canHit(i)) {
          const h = keys.has("ArrowLeft") ? 0 : keys.has("ArrowRight") ? 2 : 1;
          const v = keys.has("ArrowUp") ? 0 : keys.has("ArrowDown") ? 2 : 1;
          this.launch(i, h, v);
        }
        if (a.tick < (a.pose === "smash" ? 17 : 21)) return;
        a.pose = "wait";
        a.tick = 0;
      }
      if (a.pose === "toss" && a.tick >= 10) a.pose = "wait";
      if (i === 0) {
        if (a.pose === "toss" || a.pose === "serve") return;
        if ((a.pose === "win" || a.pose === "lose") && keys.size === 0) return;
        this.moveUser(keys);
      } else if (this.aiDestination && a.pose !== "win" && a.pose !== "lose") {
        this.moveCpuToward(this.aiDestination);
      }
    });
    this.moveBall();
  }
  moveBall(): boolean {
    return advanceBall(this.ball);
  }
  strokePose(i: number, shot: ShotType = "normal"): Pose {
    const a = this.actors[i]!,
      future = this.predictBall(3),
      sx = (future.x - a.x) * (i ? -1 : 1);
    return shot === "normal" && future.z > 70 && sx > -30 && sx < 50
      ? "smash"
      : sx >= 0
        ? "fore"
        : "back";
  }
  toss(i: number) {
    const a = this.actors[i]!;
    a.pose = "toss";
    a.tick = 0;
  }
  swing(i: number, shot: ShotType = "normal") {
    const a = this.actors[i]!;
    a.shot = this.rally === 0 ? "normal" : shot;
    a.pose = this.strokePose(i, a.shot);
    a.tick = 0;
  }
  launch(i: number, h: number, v: number) {
    const a = this.actors[i]!;
    let tx = -180 + (h + Math.random()) * 120,
      ty = -360 + (v + Math.random()) * 80;
    if (this.rally === 0) {
      tx =
        this.serveSide === 1
          ? -180 + (h + Math.random()) * 60
          : (h + Math.random()) * 60;
      ty = -200 + (v + Math.random()) * 33;
    }
    const shot = this.rally === 0 ? "normal" : a.shot;
    const profile = SHOTS[shot];
    if (this.rally > 0) {
      if (shot === "lob") ty = -(240 + (2 - v) * 25 + Math.random() * 25);
      if (shot === "drop") ty = -(45 + (2 - v) * 25 + Math.random() * 20);
    }
    if (i) {
      tx = -tx;
      ty = -ty;
    }
    if (i === 0) {
      const point = this.aimPoint(shot);
      tx = point.x;
      ty = point.y;
    }
    if (i === 1) {
      tx = Math.max(-155, Math.min(155, tx));
      ty = Math.min(this.rally === 0 ? 190 : 330, Math.max(25, ty));
    }
    const b = this.ball;
    const speed =
      a.pose === "smash"
        ? 30 + 3 * a.stats[2]
        : a.pose === "back"
          ? 20 + 0.5 * a.stats[1]
          : 20 + a.stats[0];
    let time = 1,
      rise = 0;
    time = Math.min(
      profile.maximumFlight,
      Math.ceil(
        Math.max(
          1,
          profile.minimumFlight,
          Math.hypot(tx - b.x, ty - b.y) / (speed * profile.speed),
        ),
      ),
    );
    // Check the same discrete trajectory used by the game. Bound the search:
    // low contact near the net must not create an enormous, slow parabola.
    while (time <= profile.maximumFlight) {
      rise = ((time * (time - 1) * profile.gravity) / 2 - b.z) / time;
      const probe: Ball = {
        ...b,
        vx: (tx - b.x) / time,
        vy: (ty - b.y) / time,
        rise,
        fall: 0,
        bounces: 0,
        moving: true,
        shot,
      };
      let clear = false;
      for (let t = 0; t <= Math.ceil(time); t++) {
        const before = probe.y;
        advanceBall(probe);
        if (probe.bounces) break;
        if (Math.sign(before) !== Math.sign(probe.y)) {
          clear = probe.z >= 48;
          break;
        }
      }
      if (clear || time === profile.maximumFlight) break;
      time += 1;
    }
    b.shot = shot;
    b.vx = (tx - b.x) / time;
    b.vy = (ty - b.y) / time;
    b.rise = rise;
    b.fall = 0;
    b.side = i;
    b.bounces = 0;
    b.moving = true;
    this.rally++;
    if (this.phase !== "point") this.phase = "rally";
    this.target = { x: tx, y: ty };
    if (i === 0 && this.actors[1]!.pose === "wait") {
      this.aiFreeze = 6;
      this.aiDestination = undefined;
    }
  }
  step(keys: Set<string>, pressed: Set<string>) {
    if (this.phase === "over") return;
    if (this.phase === "game") {
      if (pressed.has("Enter")) {
        this.points = [0, 0];
        this.server = 1 - this.server;
        this.serveSide = 1;
        this.faults = 0;
        this.reset();
      }
      return;
    }
    if (this.phase === "point") {
      this.continueAfterPoint(keys);
      if (--this.timer <= 0) {
        if (this.winner >= 0) {
          this.serveSide *= -1;
          this.faults = 0;
        }
        this.reset();
      }
      return;
    }
    this.updateAim(keys);
    const b = this.ball;
    this.actors.forEach((a, i) => {
      if (this.phase !== "serve" && this.phase !== "rally") return;
      a.tick++;
      const swinging = ["fore", "back", "smash"].includes(a.pose);
      if (swinging) {
        if (a.tick === 3) {
          if (this.canHit(i)) {
            if (this.rally === 1 && b.bounces === 0 && i !== this.server) {
              this.award(this.server, "VOLLEY FAULT");
              return;
            }
            const h = i
              ? a.stats[5] > Math.random() * 10
                ? this.actors[0]!.x >= 0
                  ? 2
                  : 0
                : Math.floor(Math.random() * 3)
              : keys.has("ArrowLeft")
                ? 0
                : keys.has("ArrowRight")
                  ? 2
                  : 1;
            const v = i
              ? Math.floor(Math.random() * 3)
              : keys.has("ArrowUp")
                ? 0
                : keys.has("ArrowDown")
                  ? 2
                  : 1;
            this.launch(i, h, v);
          }
        }
        if (a.tick >= (a.pose === "smash" ? 17 : 21)) {
          if (a.pose === "smash")
            a.y = i ? Math.min(0, a.y + 20) : Math.max(0, a.y - 20);
          a.pose = "wait";
          a.tick = 0;
          if (i) {
            this.netApproach ||= a.stats[4] > Math.random() * 20;
            this.aiDestination = {
              x: this.netApproach ? this.target.x / 3 : 0,
              y: this.netApproach ? -150 : -360,
            };
          }
        }
        return;
      }
      if (a.pose === "serve") {
        if (i ? a.tick > 10 : shotInput(pressed) !== undefined) this.toss(i);
        return;
      }
      if (a.pose === "toss") {
        if (a.tick === 7) {
          b.x = a.x + (i ? -10 : 10);
          b.y = a.y;
          b.z = 50;
          b.rise = 10;
          b.fall = 0;
          b.vx = b.vy = 0;
          b.side = 1 - i;
          b.shot = "normal";
          b.moving = true;
        }
        if (a.tick > 8 && (i ? a.tick > 22 : shotInput(pressed) !== undefined))
          this.swing(i, i ? "normal" : (shotInput(pressed) ?? "normal"));
        return;
      }
      if (i === 0) {
        this.moveUser(keys);
      } else {
        if (this.aiFreeze > 0 && --this.aiFreeze > 0) return;
        if (b.side === 0 && b.moving && this.rally > 0)
          this.aiDestination = this.interception();
        const tx = this.aiDestination?.x ?? a.x,
          ty = this.aiDestination?.y ?? a.y;
        this.moveCpuToward({ x: tx, y: ty });
        const predicted = this.predictBall(3),
          shot = this.cpuShot(),
          pose = this.strokePose(1, shot);
        if (
          b.side === 0 &&
          this.rally > 0 &&
          predicted.bounces < 2 &&
          (this.rally !== 1 || predicted.bounces > 0) &&
          this.canHit(1, predicted, pose)
        )
          this.swing(1, shot);
      }
    });
    if (this.phase !== "rally" && this.phase !== "serve") return;
    if (!b.moving) return;
    const previousY = b.y;
    const bounced = this.moveBall();
    if (this.rally && Math.sign(b.y) !== Math.sign(previousY) && b.z < 40) {
      if (this.rally === 1) this.repeatServe();
      else this.award(1 - b.side, "NET");
      return;
    }
    if (bounced) {
      if (!this.rally) {
        this.fault();
        return;
      }
      if (b.bounces === 1) {
        const valid =
          Math.abs(b.x) <= 180 &&
          (b.side === 0 ? b.y <= 0 && b.y >= -360 : b.y >= 0 && b.y <= 360);
        if (!valid) {
          if (this.rally === 1) this.fault();
          else this.award(1 - b.side, "OUT");
          return;
        }
        if (
          this.rally === 1 &&
          (Math.abs(b.y) > 200 ||
            (this.server === 0
              ? b.x * this.serveSide > 0
              : b.x * this.serveSide < 0))
        ) {
          this.fault();
          return;
        }
      } else this.award(b.side);
    }
  }
}
