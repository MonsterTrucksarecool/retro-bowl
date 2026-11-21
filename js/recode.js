"use strict";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = 960;
const H = 540;
const FIELD = { left: 100, right: 860, top: 76, bottom: 468 };
const keys = Object.create(null);

let state = "menu";
let homeScore = 0;
let awayScore = 0;
let quarter = 1;
let clock = 180;
let down = 1;
let distance = 10;
let line = 20;
let driveStart = 20;
let playStarted = false;
let playOver = false;
let snapTimer = 0;
let resultTimer = 0;
let resultText = "";
let ball = null;
let carrier = null;
let lastTime = performance.now();
let pointer = null;
let dragging = false;
let playGain = 0;

let qb;
let receivers;
let defenders;

function rnd(min, max) {
    return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function yardToX(yard) {
    return FIELD.left + (yard / 100) * (FIELD.right - FIELD.left);
}

function xToYard(x) {
    return ((x - FIELD.left) / (FIELD.right - FIELD.left)) * 100;
}

function makeRoutes() {
    return [
        { dx: rnd(155, 220), dy: rnd(-155, -90), name: "FLY" },
        { dx: rnd(120, 170), dy: rnd(-35, 45), name: "SLANT" },
        { dx: rnd(80, 120), dy: rnd(-55, 55), name: "OUT" },
        { dx: rnd(150, 210), dy: rnd(80, 145), name: "POST" },
        { dx: rnd(100, 150), dy: rnd(-110, 110), name: "CURL" }
    ];
}

function setupPlay() {
    const snapX = yardToX(line);
    const routes = makeRoutes();

    qb = { x: snapX - 38, y: H / 2, vx: 0, vy: 0 };
    receivers = [
        { x: snapX - 8, y: 130, ox: snapX - 8, oy: 130, route: routes[0], color: "#efc35d", routeProgress: 0 },
        { x: snapX - 12, y: 210, ox: snapX - 12, oy: 210, route: routes[1], color: "#efc35d", routeProgress: 0 },
        { x: snapX - 20, y: 270, ox: snapX - 20, oy: 270, route: routes[2], color: "#efc35d", routeProgress: 0, rb: true },
        { x: snapX - 12, y: 330, ox: snapX - 12, oy: 330, route: routes[3], color: "#efc35d", routeProgress: 0 },
        { x: snapX - 8, y: 410, ox: snapX - 8, oy: 410, route: routes[4], color: "#efc35d", routeProgress: 0 }
    ];
    defenders = [
        { x: snapX + 45, y: 138, target: 0, color: "#b94a43" },
        { x: snapX + 40, y: 218, target: 1, color: "#b94a43" },
        { x: snapX + 55, y: 270, target: 2, color: "#b94a43" },
        { x: snapX + 40, y: 322, target: 3, color: "#b94a43" },
        { x: snapX + 45, y: 402, target: 4, color: "#b94a43" }
    ];

    ball = null;
    carrier = null;
    pointer = null;
    dragging = false;
    playStarted = true;
    playOver = false;
    snapTimer = 30;
    playGain = 0;
}

function resetGame() {
    homeScore = 0;
    awayScore = 0;
    quarter = 1;
    clock = 180;
    down = 1;
    distance = 10;
    line = 20;
    driveStart = 20;
    resultText = "";
    state = "playing";
    setupPlay();
}

function startGame() {
    resetGame();
}

function showResult(text, frames) {
    resultText = text;
    resultTimer = frames;
}

function endPlay(reason) {
    if (playOver) return;
    playOver = true;
    dragging = false;
    pointer = null;

    if (reason === "touchdown") {
        homeScore += 7;
        showResult("TOUCHDOWN!", 150);
        line = 20;
        driveStart = 20;
        down = 1;
        distance = 10;
        setTimeout(function () {
            if (state === "playing") setupPlay();
        }, 1450);
        return;
    }

    if (reason === "incomplete") {
        playGain = 0;
    } else if (reason === "tackle" || reason === "out") {
        playGain = clamp(Math.round(xToYard(carrier ? carrier.x : qb.x) - driveStart), -3, 99);
    } else if (reason === "sack") {
        playGain = -3;
    }

    showResult(reason === "incomplete" ? "INCOMPLETE" : reason.toUpperCase(), 90);
    setTimeout(function () {
        if (state !== "playing") return;
        line = clamp(driveStart + playGain, 1, 99);

        if (line - driveStart >= distance) {
            down = 1;
            distance = 10;
        } else {
            down++;
            distance -= line - driveStart;
            if (down > 4) {
                awayScore += 3;
                line = clamp(100 - line, 20, 80);
                down = 1;
                distance = 10;
                showResult("TURNOVER", 75);
            }
        }
        driveStart = line;
        setupPlay();
    }, 1000);
}

function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * W / rect.width,
        y: (event.clientY - rect.top) * H / rect.height
    };
}

canvas.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);

    if (state === "menu") {
        startGame();
        return;
    }
    if (state === "gameover") {
        state = "menu";
        return;
    }
    if (!playStarted || playOver) return;
    dragging = true;
    pointer = point;
});

canvas.addEventListener("pointermove", function (event) {
    if (dragging) pointer = pointFromEvent(event);
});

canvas.addEventListener("pointerup", function (event) {
    if (!dragging || playOver || carrier) return;
    const point = pointFromEvent(event);
    const dx = point.x - qb.x;
    const dy = point.y - qb.y;
    const length = Math.max(1, Math.hypot(dx, dy));

    if (length > 18) {
        const speed = clamp(460 + length * 0.55, 480, 650);
        ball = {
            x: qb.x,
            y: qb.y,
            vx: dx / length * speed,
            vy: dy / length * speed,
            age: 0
        };
    }
    dragging = false;
    pointer = null;
});

window.addEventListener("keydown", function (event) {
    keys[event.key.toLowerCase()] = true;
    if (event.key === " " || event.key === "Enter") event.preventDefault();
});

window.addEventListener("keyup", function (event) {
    keys[event.key.toLowerCase()] = false;
});

function moveCarrier(dt) {
    let dx = 0;
    let dy = 0;
    if (keys.arrowleft || keys.a) dx -= 1;
    if (keys.arrowright || keys.d) dx += 1;
    if (keys.arrowup || keys.w) dy -= 1;
    if (keys.arrowdown || keys.s) dy += 1;

    if (dx === 0 && dy === 0) dx = 1;
    const length = Math.max(1, Math.hypot(dx, dy));
    carrier.x += dx / length * 190 * dt;
    carrier.y += dy / length * 190 * dt;
    carrier.x = clamp(carrier.x, FIELD.left - 20, FIELD.right - 5);
    carrier.y = clamp(carrier.y, FIELD.top + 12, FIELD.bottom - 12);
}

function moveQB(dt) {
    let dx = 0;
    let dy = 0;
    if (keys.arrowleft || keys.a) dx -= 1;
    if (keys.arrowright || keys.d) dx += 1;
    if (keys.arrowup || keys.w) dy -= 1;
    if (keys.arrowdown || keys.s) dy += 1;
    const length = Math.hypot(dx, dy) || 1;
    qb.vx = dx / length * 160;
    qb.vy = dy / length * 160;
    if (!dx && !dy) {
        qb.vx *= 0.8;
        qb.vy *= 0.8;
    }
    qb.x += qb.vx * dt;
    qb.y += qb.vy * dt;
    qb.x = clamp(qb.x, yardToX(line) - 55, yardToX(line) + 12);
    qb.y = clamp(qb.y, FIELD.top + 18, FIELD.bottom - 18);
}

function updateReceivers(dt) {
    for (const receiver of receivers) {
        if (receiver === carrier) continue;
        const tx = receiver.ox + receiver.route.dx;
        const ty = clamp(receiver.oy + receiver.route.dy, FIELD.top + 18, FIELD.bottom - 18);
        const dx = tx - receiver.x;
        const dy = ty - receiver.y;
        const length = Math.hypot(dx, dy);
        if (length > 3) {
            receiver.x += dx / length * 105 * dt;
            receiver.y += dy / length * 105 * dt;
        }
    }
}

function updateDefenders(dt) {
    for (const defender of defenders) {
        let target;
        if (carrier) {
            target = carrier;
        } else if (ball) {
            target = ball;
        } else {
            target = qb;
        }

        const dx = target.x - defender.x;
        const dy = target.y - defender.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const speed = carrier ? 205 : 155;
        defender.x += dx / length * speed * dt;
        defender.y += dy / length * speed * dt;
    }
}

function update(dt) {
    if (state !== "playing" || playOver) return;

    clock -= dt;
    if (clock <= 0) {
        clock = 180;
        quarter++;
        if (quarter > 4) {
            state = "gameover";
            return;
        }
    }
    if (snapTimer > 0) snapTimer--;
    if (resultTimer > 0) resultTimer--;

    if (carrier) moveCarrier(dt);
    else moveQB(dt);

    updateReceivers(dt);
    updateDefenders(dt);

    if (ball && !carrier) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.age += dt;

        let caught = null;
        let nearest = 28;
        for (const receiver of receivers) {
            const d = Math.hypot(receiver.x - ball.x, receiver.y - ball.y);
            if (d < nearest) {
                nearest = d;
                caught = receiver;
            }
        }
        if (caught) {
            carrier = caught;
            ball = { x: carrier.x, y: carrier.y, vx: 0, vy: 0, age: 0 };
            showResult("CAUGHT", 40);
        } else if (
            ball.age > 1.8 ||
            ball.x < FIELD.left - 20 ||
            ball.x > FIELD.right + 20 ||
            ball.y < FIELD.top ||
            ball.y > FIELD.bottom
        ) {
            endPlay("incomplete");
        }
    }

    if (carrier) {
        if (carrier.x >= FIELD.right - 4) {
            endPlay("touchdown");
            return;
        }
        for (const defender of defenders) {
            if (Math.hypot(defender.x - carrier.x, defender.y - carrier.y) < 19) {
                endPlay("tackle");
                return;
            }
        }
        if (carrier.y <= FIELD.top + 12 || carrier.y >= FIELD.bottom - 12) {
            endPlay("out");
            return;
        }
    } else if (!ball) {
        for (const defender of defenders) {
            if (Math.hypot(defender.x - qb.x, defender.y - qb.y) < 18) {
                endPlay("sack");
                return;
            }
        }
    }
}

function fill(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function text(value, x, y, size, color, align) {
    ctx.fillStyle = color || "#f7f2d8";
    ctx.font = "bold " + size + "px Courier New";
    ctx.textAlign = align || "left";
    ctx.fillText(value, x, y);
}

function drawField() {
    fill(0, 0, W, H, "#e8e1c5");
    fill(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top, "#4f9651");

    for (let i = 0; i < 10; i++) {
        const y = FIELD.top + i * 39.2;
        fill(FIELD.left, y, FIELD.right - FIELD.left, 20, i % 2 ? "#559e56" : "#4b924f");
    }

    ctx.globalAlpha = 0.78;
    for (let yard = 10; yard < 100; yard += 10) {
        const x = yardToX(yard);
        fill(x, FIELD.top, 3, FIELD.bottom - FIELD.top, "#eef1d4");
        text(String(yard > 50 ? 100 - yard : yard), x - 10, FIELD.bottom - 16, 14, "#edf1d3");
    }
    ctx.globalAlpha = 1;

    const lineX = yardToX(line);
    fill(lineX - 3, FIELD.top, 6, FIELD.bottom - FIELD.top, "#ece36a");
    fill(FIELD.left - 38, FIELD.top, 38, FIELD.bottom - FIELD.top, "#cfdde3");
    fill(FIELD.right, FIELD.top, 100, FIELD.bottom - FIELD.top, "#cfc2a4");

    fill(0, 0, W, 64, "#1f3b56");
    fill(0, 64, W, 12, "#f4f0d8");
    text("HOME  " + homeScore, 24, 44, 20, "#f4f0d8");
    text("AWAY  " + awayScore, 790, 44, 20, "#f4f0d8");
    text("Q" + quarter + "  " + String(Math.ceil(clock)).padStart(3, "0"), 430, 44, 20, "#f4f0d8", "center");
}

function drawPlayer(player, color, qbFlag) {
    const x = Math.round(player.x);
    const y = Math.round(player.y);
    fill(x - 9, y - 12, 18, 24, "#252a29");
    fill(x - 7, y - 10, 14, 20, color);
    fill(x - 5, y - 8, 10, 7, "#dfb184");
    fill(x - 8, y - 14, 16, 5, color);
    fill(x - 3, y - 16, 6, 3, "#dfb184");
    if (qbFlag) fill(x - 10, y - 19, 20, 3, "#f1d75d");
}

function drawRoute(player) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "#eef4d2";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(player.ox, player.oy);
    ctx.lineTo(clamp(player.ox + player.route.dx, FIELD.left, FIELD.right), clamp(player.oy + player.route.dy, FIELD.top, FIELD.bottom));
    ctx.stroke();
    ctx.restore();
}

function drawBall() {
    if (!ball) return;
    fill(ball.x - 5, ball.y - 3, 10, 6, "#9b6038");
    fill(ball.x - 2, ball.y - 3, 4, 6, "#f1ddb2");
}

function drawAim() {
    if (!dragging || !pointer) return;
    ctx.save();
    ctx.strokeStyle = "#fff2a6";
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo(qb.x, qb.y);
    ctx.lineTo(pointer.x, pointer.y);
    ctx.stroke();
    ctx.restore();
    fill(pointer.x - 7, pointer.y - 7, 14, 14, "#fff2a6");
}

function drawHUD() {
    const suffix = down === 1 ? "ST" : down === 2 ? "ND" : down === 3 ? "RD" : "TH";
    text(down + suffix + " & " + distance, 480, 44, 20, "#f4f0d8", "center");
    if (snapTimer > 0) text("SNAP", yardToX(line) - 18, FIELD.top - 12, 15, "#20344d");
}

function drawMenu() {
    fill(0, 0, W, H, "#1f3b56");
    fill(70, 64, 820, 412, "#eee8c9");
    fill(82, 76, 796, 388, "#4f9651");
    text("RETRO FOOTBALL", W / 2, 205, 54, "#f7f1cf", "center");
    text("DRAG TO AIM  RELEASE TO THROW", W / 2, 255, 20, "#1f3b56", "center");
    fill(310, 300, 340, 76, "#e7b34a");
    text("START GAME", W / 2, 350, 30, "#1f3b56", "center");
    text("WASD / ARROW KEYS: MOVE AFTER THE CATCH", W / 2, 418, 15, "#1f3b56", "center");
}

function drawGameOver() {
    fill(0, 0, W, H, "#1f3b56");
    fill(260, 145, 440, 250, "#eee8c9");
    text("FINAL", W / 2, 205, 24, "#1f3b56", "center");
    text(homeScore + " - " + awayScore, W / 2, 280, 48, "#1f3b56", "center");
    text("TAP TO RETURN", W / 2, 345, 18, "#9b6038", "center");
}

function draw() {
    if (state === "menu") {
        drawMenu();
        return;
    }
    if (state === "gameover") {
        drawGameOver();
        return;
    }

    drawField();
    drawHUD();
    for (const receiver of receivers) {
        drawRoute(receiver);
    }
    for (const receiver of receivers) drawPlayer(receiver, receiver.color, false);
    for (const defender of defenders) drawPlayer(defender, defender.color, false);
    drawPlayer(qb, "#4e79aa", true);
    drawBall();
    drawAim();

    if (resultTimer > 0) {
        fill(330, 210, 300, 74, "#1f3b56");
        text(resultText, W / 2, 258, 26, "#f7f1cf", "center");
    }
}

function loop(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
