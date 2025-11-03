// === IMPORTS ===
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));
console.log("📦 Serving static files from:", __dirname + "/public");

// === CONSTANTS ===
const MAX_PLAYERS = 10;
const FINISH_DISTANCE = 1000;
const START_COUNTDOWN_MS = 3000;

// === GLOBAL BROADCAST CONTROLS ===
let lastBroadcast = 0;
const BROADCAST_INTERVAL = 100; // send updates 10x per second

// === LOBBY STATE ===
const lobby = {
  players: new Map(),
  inProgress: false,
  startedAt: null,
  finishedOrder: [],
};

// === UTILITIES ===
function getLobbyState() {
  return {
    inProgress: lobby.inProgress,
    startedAt: lobby.startedAt,
    players: Array.from(lobby.players.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      distance: p.distance,
      finished: p.finished,
      rank: p.rank ?? null,
      frozen: p.frozen,
    })),
    finishedOrder: lobby.finishedOrder,
    finishDistance: FINISH_DISTANCE,
  };
}

function resetRace() {
  for (const player of lobby.players.values()) {
    player.distance = 0;
    player.finished = false;
    player.rank = null;
    player.frozen = false;
  }
  lobby.inProgress = false;
  lobby.startedAt = null;
  lobby.finishedOrder = [];
  io.emit("state", getLobbyState());
  console.log("🏁 Race reset!");
}

function handleCheating(player) {
  console.log(`🤡 Cheat detected: ${player.name} is holding Space too long!`);
  const message = `Come on ${player.name}, stop cheating — it's only a game!`;

  io.emit("cheatAlert", { name: player.name, message });

  player.frozen = true;
  io.emit("state", getLobbyState());

  setTimeout(() => {
    player.frozen = false;
    io.emit("state", getLobbyState());
  }, 2000);
}

// === SOCKET EVENTS ===
io.on("connection", (socket) => {
  console.log("📶 New connection:", socket.id);

  // --- Join Lobby ---
  socket.on("join", (name) => {
    if (lobby.players.size >= MAX_PLAYERS) {
      socket.emit("reject", "Lobby full (10 players max).");
      return;
    }

    name = String(name || "Player").trim().slice(0, 20) || "Player";

    lobby.players.set(socket.id, {
      name,
      distance: 0,
      finished: false,
      rank: null,
      frozen: false,
    });

    io.emit("state", getLobbyState());
    console.log(`👤 ${name} joined the lobby.`);
  });

  // --- Start Race ---
  socket.on("start", () => {
    if (lobby.inProgress || lobby.players.size === 0) return;
    resetRace();

    io.emit("countdown", { ms: START_COUNTDOWN_MS });
    console.log("🚦 Race starting in 3 seconds...");

    setTimeout(() => {
      lobby.inProgress = true;
      lobby.startedAt = Date.now();

      io.emit("raceStarted");
      io.emit("state", getLobbyState());
      console.log("🏁 Race started!");
    }, START_COUNTDOWN_MS);
  });

  // --- Player Tap (movement + throttle) ---
  socket.on("tap", () => {
    const player = lobby.players.get(socket.id);
    if (!player || !lobby.inProgress || player.finished || player.frozen) return;

    const now = Date.now();

    // 🧠 NEW: Anti-spam throttle (ignore taps <80ms apart)
    if (player.lastTap && now - player.lastTap < 80) return;
    player.lastTap = now;

    // ✈️ Move player forward
    player.distance += 2;

    // Check finish
    if (player.distance >= FINISH_DISTANCE && !player.finished) {
      player.finished = true;
      lobby.finishedOrder.push({ id: socket.id, name: player.name });
      player.rank = lobby.finishedOrder.length;

      if (player.rank === 1) {
        console.log(`🏆 ${player.name} won the race!`);
        lobby.inProgress = false;
      }
    }

    // ⚙️ NEW: Broadcast limiter (send 10x/sec)
    if (now - lastBroadcast > BROADCAST_INTERVAL) {
      lastBroadcast = now;
      io.emit("state", getLobbyState());
    }
  });

  // --- Cheat Detection (existing logic) ---
  socket.on("cheatDetected", () => {
    const player = lobby.players.get(socket.id);
    console.log(`📩 cheatDetected received from ${player?.name || "unknown player"}`);

    if (player && !player.frozen && lobby.inProgress) {
      handleCheating(player);
    } else {
      console.log("⚠️ cheatDetected ignored (no player / not inProgress / already frozen)");
    }
  });

  // --- Reset Race ---
  socket.on("reset", resetRace);

  // --- Disconnect ---
  socket.on("disconnect", () => {
    const player = lobby.players.get(socket.id);
    if (player) {
      console.log(`👋 ${player.name} disconnected.`);
      lobby.players.delete(socket.id);
      lobby.finishedOrder = lobby.finishedOrder.filter((p) => p.id !== socket.id);
      io.emit("state", getLobbyState());
    }
  });
});

// === STABILITY & SAFETY ===

// Prevent crash on uncaught errors
process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection at:", promise, "reason:", reason);
});

// Graceful shutdown for Render restarts
process.on("SIGTERM", () => {
  console.log("🛑 Graceful shutdown...");
  server.close(() => {
    console.log("✅ Server closed cleanly");
    process.exit(0);
  });
});

// === START SERVER ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
