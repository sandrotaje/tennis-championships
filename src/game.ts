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
    }));
    this.reset();
  }
  reset() {
    this.phase = "serve";
    this.message = "";
    this.rally = 0;
    this.actors.forEach((a, i) => {
      a.x =
        (i === this.server ? this.serveSide * 20 : -this.serveSide * 120) *
        (this.server ? -1 : 1);
      a.y = i ? -380 : 380;
      a.pose = i === this.server ? "serve" : "wait";
      a.tick = 0;
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
    if (keys.has("Space")) this.swing(0);
  }
  // Once the result is fixed, keep the scene moving without adjudicating it again.
  canHit(i: number) {
    const a = this.actors[i]!;
    const b = this.ball;
    const dx = (b.x - a.x) * (i ? -1 : 1),
      dy = b.y - a.y;
    return (
      b.side !== i &&
      dx >= (a.pose === "fore" ? -10 : a.pose === "back" ? -60 : -30) &&
      dx <= (a.pose === "fore" ? 60 : a.pose === "back" ? 10 : 50) &&
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
        const speed = 6 + 0.3 * a.stats[3];
        const dx = this.aiDestination.x - a.x;
        const dy = this.aiDestination.y - a.y;
        a.x +=
          Math.abs(dx) > 10 ? Math.sign(dx) * Math.min(speed, Math.abs(dx)) : 0;
        a.y +=
          Math.abs(dy) > 10 ? Math.sign(dy) * Math.min(speed, Math.abs(dy)) : 0;
        a.pose = dx < -10 ? "left" : dx > 10 ? "right" : "wait";
      }
    });
    this.moveBall();
  }
  moveBall(): boolean {
    const b = this.ball;
    if (!b.moving) return false;
    b.z += b.rise - b.fall;
    b.fall += 0.8;
    b.x += b.vx;
    b.y += b.vy;
    if (b.z >= 0) return false;
    b.z = 0;
    b.rise = ((b.fall - b.rise) * 2) / 3;
    b.fall = 0;
    b.vx *= 0.6;
    b.vy *= 0.6;
    b.bounces++;
    if (b.rise < 1.3) b.moving = false;
    return true;
  }
  toss(i: number) {
    const a = this.actors[i]!;
    a.pose = "toss";
    a.tick = 0;
  }
  swing(i: number) {
    const a = this.actors[i]!;
    const predicted = this.ball.x + this.ball.vx * 2 - a.x;
    const sx = i ? -predicted : predicted;
    a.pose =
      this.ball.z > 70 && sx > -30 && sx < 50
        ? "smash"
        : this.ball.x + this.ball.vx * 3 >= a.x !== Boolean(i)
          ? "fore"
          : "back";
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
    if (i) {
      tx = -tx;
      ty = -ty;
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
    for (let k = 0; k < 5; k++) {
      time = Math.hypot(tx - b.x, ty - b.y) / (speed - k * 4);
      rise = ((time * (time - 1) * 0.8) / 2 - b.z) / time;
      const nt = (0 - b.y) / ((ty - b.y) / time);
      if (b.z + nt * rise - (0.8 * nt * (nt - 1)) / 2 > 50) break;
    }
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
      this.aiFreeze = 10;
      this.aiDestination = undefined;
    }
  }
  step(keys: Set<string>, pressed: Set<string>) {
    if (this.phase === "over") return;
    if (this.phase === "game") {
      if (pressed.has("Space")) {
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
        if (i ? a.tick > 10 : pressed.has("Space")) this.toss(i);
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
          b.moving = true;
        }
        if (a.tick > 8 && (i ? a.tick > 22 : pressed.has("Space")))
          this.swing(i);
        return;
      }
      const speed = 6 + 0.3 * a.stats[3];
      if (i === 0) {
        this.moveUser(keys);
      } else {
        if (this.aiFreeze > 0) {
          this.aiFreeze--;
          if (this.aiFreeze === 0) {
            this.aiDestination =
              a.y <= this.target.y
                ? { x: this.target.x + b.vx * 5, y: this.target.y + b.vy * 5 }
                : { x: (b.vx / b.vy) * (a.y - b.y) + b.x, y: a.y };
          }
          return;
        }
        const tx = this.aiDestination?.x ?? a.x,
          ty = this.aiDestination?.y ?? a.y;
        const dx = tx - a.x,
          dy = ty - a.y;
        a.x +=
          Math.abs(dx) > 10 ? Math.sign(dx) * Math.min(speed, Math.abs(dx)) : 0;
        a.y +=
          Math.abs(dy) > 10 ? Math.sign(dy) * Math.min(speed, Math.abs(dy)) : 0;
        a.pose = dx < -10 ? "left" : dx > 10 ? "right" : "wait";
        if (
          b.side === 0 &&
          this.rally &&
          Math.abs(b.x + b.vx * 4 - a.x) < 60 &&
          b.y + b.vy * 4 < a.y
        )
          this.swing(i);
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
