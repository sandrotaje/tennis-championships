import "./style.css";
import manifest from "./art.json";
import { Match, SHOT_KEYS, type Stats } from "./game";
const canvas = document.createElement("canvas");
canvas.width = canvas.height = 600;
canvas.setAttribute(
  "aria-label",
  "Tennis Championships — frecce per muoversi, W lob, S drop shot, A slice, D topspin",
);
canvas.tabIndex = 0;
document.querySelector("#app")!.replaceChildren(canvas);
const c = canvas.getContext("2d")!;
type Screen = "menu" | "setup" | "select" | "bracket" | "match" | "champion";
let screen: Screen = "menu",
  match: Match | undefined,
  round = 0,
  selected = 0,
  hover = 0,
  tournament = false;
const keys = new Set<string>(),
  pressed = new Set<string>();
const roster = [
  "SELES",
  "VENUS",
  "DOKICI",
  "CHRIS",
  "ANNA",
  "CLIJSTER",
  "GRAF",
  "SABATINI",
  "SANCHEZ",
  "DATEKIMI",
  "DAVENPO",
  "NAVRATIL",
  "HINGIS",
  "PIERCE",
  "SHARAPO",
  "NOVOTNA",
];
const codes = [
  "787765",
  "989520",
  "567420",
  "687789",
  "346430",
  "768524",
  "979746",
  "887657",
  "465999",
  "364735",
  "878620",
  "677999",
  "786879",
  "467338",
  "567350",
  "466698",
];
const stats = codes.map((s) => s.split("").map(Number) as Stats);
let bracket = [...roster],
  opponent = 1;
let user: Stats = [0, 0, 0, 0, 0, 0],
  cpu: Stats = [5, 5, 5, 5, 5, 0];
const images = new Map<string, HTMLImageElement>();
function art(name: string, x = 0, y = 0, s = 1) {
  const a = manifest[name as keyof typeof manifest],
    img = images.get(name);
  if (a && img) c.drawImage(img, x - a.ox * s, y - a.oy * s, a.w * s, a.h * s);
}
function text(
  t: string,
  x: number,
  y: number,
  size = 20,
  color = "#fff",
  align: CanvasTextAlign = "left",
  font = "Vagabond",
) {
  c.font = `${size}px ${font}`;
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = "top";
  c.fillText(t, x, y);
}
function enterButton(y: number) {
  c.fillStyle = "#666";
  c.beginPath();
  c.roundRect(222, y, 144, 34, 8);
  c.fill();
  c.fillStyle = "#fff";
  c.beginPath();
  c.roundRect(226, y + 2, 136, 27, 6);
  c.fill();
  text("Enter", 294, y + 5, 18, "#666", "center");
}
function bars(s: Stats, x: number, y: number) {
  for (let i = 0; i < 4; i++) {
    art("barbase", x, y + i * 30);
    c.save();
    c.translate(x, y + i * 30);
    c.scale((s[i]! + 1) / 10, 1);
    art("barfill");
    c.restore();
    text(String(s[i]! + 1), x + 212, y + i * 30 - 2, 20);
  }
}
function start() {
  match = new Match(
    tournament ? [roster[selected]!, bracket[opponent]!] : ["YOU", "COM"],
    [user, cpu],
  );
  screen = "match";
  canvas.focus();
}
function pickOpponent() {
  const first = 2 ** round;
  let best = -Infinity;
  opponent = first;
  for (let i = first; i < first * 2; i++) {
    const candidate = stats[roster.indexOf(bracket[i]!)]!;
    const strength =
      candidate.reduce((sum, n, j) => sum + (j === 4 ? 0 : n), 0) +
      Math.random() * 20;
    if (strength > best) {
      best = strength;
      opponent = i;
    }
  }
  cpu = stats[roster.indexOf(bracket[opponent]!)]!;
}
function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
function branch(index: number) {
  let x = index < 8 ? 160 : 440,
    y = 150 + (index % 8) * 40,
    dx = index < 8 ? 40 : -40;
  c.strokeStyle = "#ff9900";
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(x, y);
  for (let level = 0; level <= round; level++) {
    x += dx;
    c.lineTo(x, y);
    if (level < round) {
      const group = Math.floor((index % 8) / 2 ** level);
      y += (group % 2 ? -1 : 1) * 20 * 2 ** level;
      c.lineTo(x, y);
    }
  }
  c.stroke();
}
function advance() {
  if (screen === "setup") {
    tournament = false;
    start();
  } else if (screen === "bracket") start();
  else if (screen === "match" && match?.phase === "over") {
    if (tournament && match.winner === 0) {
      round++;
      if (round === 4) screen = "champion";
      else {
        pickOpponent();
        screen = "bracket";
      }
    } else screen = "menu";
  }
}
addEventListener("keydown", (e) => {
  if (
    [
      ...SHOT_KEYS.map(([key]) => key),
      "Enter",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Escape",
    ].includes(e.code)
  ) {
    e.preventDefault();
    if (!keys.has(e.code)) {
      pressed.add(e.code);
      if (e.code === "Enter") {
        const before = screen;
        advance();
        if (screen !== before) pressed.delete(e.code);
      }
      if (e.code === "Escape") {
        screen = "menu";
        match = undefined;
      }
    }
    keys.add(e.code);
  }
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => {
  keys.clear();
  pressed.clear();
});
canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect(),
    x = ((e.clientX - r.left) * 600) / r.width,
    y = ((e.clientY - r.top) * 600) / r.height;
  if (screen === "select") {
    const i = Math.floor((y - 100) / 30) + (x > 300 ? 8 : 0);
    if (y >= 100 && y < 340 && x > 100 && x < 500)
      hover = Math.max(0, Math.min(15, i));
  }
  canvas.style.cursor = screen === "match" ? "default" : "pointer";
});
canvas.addEventListener("click", (e) => {
  const r = canvas.getBoundingClientRect(),
    x = ((e.clientX - r.left) * 600) / r.width,
    y = ((e.clientY - r.top) * 600) / r.height;
  canvas.focus();
  if (screen === "menu") {
    if (y > 315 && y < 352) {
      screen = "setup";
    } else if (y >= 352 && y < 385) screen = "select";
  } else if (screen === "setup") {
    const edit = (s: Stats, bx: number, by: number) => {
      const i = Math.floor((y - by) / 30);
      if (x >= bx && x < bx + 200 && i >= 0 && i < 4 && y < by + i * 30 + 22)
        s[i] = Math.floor((x - bx) / 20);
    };
    edit(cpu, 184, 86);
    edit(user, 284, 266);
    if (y >= 480 && y <= 520 && x >= 220 && x <= 370) advance();
    if (x > 200 && x < 400 && y > 380 && y < 435) {
      cpu = cpu.map((_, i) =>
        i < 4 ? Math.floor(Math.random() * 10) : 0,
      ) as Stats;
      user = user.map((_, i) =>
        i < 4 ? Math.floor(Math.random() * 10) : 0,
      ) as Stats;
    }
  } else if (screen === "select") {
    if (y >= 100 && y < 340 && x > 100 && x < 500) {
      selected = Math.floor((y - 100) / 30) + (x > 300 ? 8 : 0);
      user = [...stats[selected]!];
      bracket = [
        roster[selected]!,
        ...shuffle(roster.filter((_, i) => i !== selected)),
      ];
      round = 0;
      opponent = 1;
      cpu = stats[roster.indexOf(bracket[1]!)]!;
      tournament = true;
      screen = "bracket";
    }
  } else if (screen === "bracket") advance();
  else if (screen === "match" && x > 555 && y < 40) {
    screen = "menu";
  } else if (screen === "champion") screen = "menu";
});
function player(i: number) {
  const a = match!.actors[i]!,
    s = 0.6 * (1 + a.y / 360 / 10),
    x = 300 + a.x * (1 + a.y / 360 / 10),
    y = 300 + a.y / 2;
  art("shadow", x, y, s);
  const prefix = `p${i}-${a.pose}-`;
  const frames = Object.keys(manifest).filter((n) =>
    n.startsWith(prefix),
  ).length;
  const frame = ["fore", "back", "smash", "toss"].includes(a.pose)
    ? Math.min(a.tick, frames - 1)
    : a.tick % frames;
  art(prefix + frame, x, y, s);
}
function render() {
  c.clearRect(0, 0, 600, 600);
  if (screen === "menu") {
    art("menu");
    text("Arrow keys: move / aim", 300, 130, 18, "#fff", "center");
    text(
      "W Lob   S Drop shot   A Slice   D Topspin",
      300,
      156,
      17,
      "#fff",
      "center",
    );
    text("Serve: press a shot key twice", 300, 182, 17, "#fff", "center");
    text("First to 3 games, win by 2", 300, 208, 17, "#fff", "center");
  } else if (screen === "setup") {
    art("setup");
    enterButton(480);
    bars(cpu, 184, 86);
    bars(user, 284, 266);
  } else if (screen === "select") {
    art("select");
    for (let i = 0; i < 16; i++)
      text(
        roster[i]!,
        i < 8 ? 122 : 352,
        106 + (i % 8) * 30,
        20,
        i === hover ? "#ffea99" : "#fff",
      );
    bars(stats[hover]!, 234, 406);
  } else if (screen === "bracket") {
    art("bracket");
    enterButton(484);
    branch(0);
    branch(opponent);
    for (let i = 0; i < 16; i++)
      text(
        bracket[i]!,
        i < 8 ? 154 : 449,
        140 + (i % 8) * 40,
        22,
        i === 0 || i === opponent ? "#ffdd66" : "#fff",
        i < 8 ? "right" : "left",
        "Monotone",
      );
    text(
      ["1st MATCH", "2nd MATCH", "SEMI FINAL", "FINAL MATCH"][round]!,
      300,
      35,
      32,
      "#fff",
      "center",
      "Monotone",
    );
    text(
      `${bracket[0]}  vs  ${bracket[opponent]}`,
      300,
      77,
      24,
      "#ccaa55",
      "center",
      "Monotone",
    );
  } else if (screen === "champion") {
    art("champion");
    text(roster[selected]!, 300, 380, 32, "#fff", "center");
    text("CLICK TO PLAY AGAIN", 300, 510, 20, "#fff", "center");
  } else if (match) {
    art("court");
    const marker = match.aimMarker(),
      mp = 1 + marker.point.y / 360 / 10;
    const mx = 300 + marker.point.x * mp,
      my = 300 + marker.point.y / 2;
    c.save();
    c.strokeStyle = marker.locked ? "#ffdc68" : "#75ffff";
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(mx, my, 12, 6, 0, 0, Math.PI * 2);
    c.moveTo(mx - 19, my);
    c.lineTo(mx + 19, my);
    c.moveTo(mx, my - 10);
    c.lineTo(mx, my + 10);
    c.stroke();
    text(marker.shot.toUpperCase(), mx, my - 23, 11, c.strokeStyle, "center");
    c.restore();
    player(1);
    const b = match.ball,
      per = 1 + b.y / 360 / 10;
    if ((b.moving || b.bounces > 0) && b.y < 0) {
      art("ballshadow", 300 + b.x * per, 300 + b.y / 2, per);
      art("ball", 300 + b.x * per, 300 + b.y / 2 - b.z * per, per);
    }
    art("net", 293, 300);
    player(0);
    if ((b.moving || b.bounces > 0) && b.y >= 0) {
      art("ballshadow", 300 + b.x * per, 300 + b.y / 2, per);
      art("ball", 300 + b.x * per, 300 + b.y / 2 - b.z * per, per);
    }
    art("exit", 575, 5);
    text(
      "W LOB   S DROP SHOT   A SLICE   D TOPSPIN",
      300,
      548,
      12,
      "#fff",
      "center",
    );
    text(
      `${match.names[match.server]} ${match.score()} ${match.names[1 - match.server]}    ${match.games[0]} - ${match.games[1]}`,
      6,
      570,
      20,
    );
    if (match.message) {
      art(
        match.phase === "point"
          ? match.winner === -1 ||
            ["OUT", "NET", "DOUBLE FAULT", "VOLLEY FAULT"].includes(
              match.message,
            )
            ? "message"
            : "point"
          : "gamepanel",
        0,
        132,
      );
      text(match.message, 300, 205, 30, "#fff", "center");
      if (match.phase === "game" || match.phase === "over") {
        enterButton(356);
        text(match.names[0], 186, 225, 24, "#ffea99", "left", "Dot");
        text(match.names[1], 186, 270, 24, "#ffea99", "left", "Dot");
        text(String(match.games[0]), 369, 225, 24, "#ffea99", "left", "Dot");
        text(String(match.games[1]), 369, 270, 24, "#ffea99", "left", "Dot");
      }
    }
  }
}
async function boot() {
  await Promise.all(
    Object.keys(manifest).map(async (n) => {
      const img = new Image();
      img.src = `art/${n}.svg`;
      await img.decode();
      images.set(n, img);
    }),
  );
  await Promise.all(
    [
      ["Vagabond", "7_Vagabond.ttf"],
      ["Monotone", "320_Monotone.ttf"],
      ["Dot", "262_Lt-alphaDot.ttf"],
    ].map(async ([name, file]) => {
      const f = new FontFace(name!, `url(fonts/${file})`);
      document.fonts.add(await f.load());
    }),
  );
  let last = performance.now(),
    acc = 0;
  function frame(now: number) {
    acc += Math.min(100, now - last);
    last = now;
    while (acc >= 1000 / 30) {
      if (screen === "match" && match) {
        const tickKeys = new Set([...keys, ...pressed]);
        match.step(tickKeys, pressed);
      }
      pressed.clear();
      acc -= 1000 / 30;
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
boot().catch((e) => {
  text("Unable to load artwork", 30, 30, 24, "#111");
  console.error(e);
});
