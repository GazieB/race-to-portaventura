// =============================
// Race to PortAventura - server.js (Hold Detection Anti-Cheat)
// =============================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));
console.log("📦 Serving static files from:", __dirname + "/public");

// === Game Settings ===
const MAX_PLAYERS = 10;
const FINISH_DISTANCE = 1000;
const START_COUNTDOWN_MS = 3000;
const HOLD_THRESHOLD_MS = 1200; // Max hold before flagged
const FREEZE_MS = 1500;

// === Lobby Data ===
const lobby = {
  players: new Map(),
  inProgress: false,
  startedAt: null,
  finishedOrder: [],
};

// === Helper ===
function getLobbyState() {
  return {
    inProgress: lobby.inProgress,
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

// === Reset Race ===
function resetRace() {
  for (const player of lobby.players.values()) {
    Object.assign(player, {
      distance: 0,
      finished: false,
      rank: null,
      frozen: false,
      holdStart: null,
    });
  }
  lobby.inProgress = false;
  lobby.startedAt = null;
  lobby.finishedOrder = [];
  io.emit("state", getLobbyState());
  console.log("🏁 Race reset!");
}

// === Handle Cheating ===
function handleCheating(player) {
  console.log(`🤡 ${player.name} is holding Space too long!`);
  const message = `${player.name} held Space too long — frozen for 1.5s!`;

  io.emit("cheatAlert", { name: player.name, reason: message });
  player.frozen = true;
  io.emit("state", getLobbyState());

  setTimeout(() => {
    player.frozen = false;
    io.emit("state", getLobbyState());
  }, FREEZE_MS);
}

// === Socket Events ===
io.on("connection", (socket) => {
  console.log("📶 New connection:", socket.id);

  // --- Join ---
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
      holdStart: null,
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
      io.emit("state", getLobbyState());
      console.log("🏁 Race started!");
    }, START_COUNTDOWN_MS);
  });

  // --- Hold Start ---
  socket.on("holdStart", () => {
    const player = lobby.players.get(socket.id);
    if (player && lobby.inProgress && !player.frozen) {
      player.holdStart = Date.now();
    }
  });

  // --- Hold End ---
  socket.on("holdEnd", () => {
    const player = lobby.players.get(socket.id);
    if (!player || !lobby.inProgress || player.frozen || !player.holdStart) return;

    const holdDuration = Date.now() - player.holdStart;
    player.holdStart = null;

    if (holdDuration >= HOLD_THRESHOLD_MS) {
      handleCheating(player);
    }
  });

  // --- Tap ---
  socket.on("tap", () => {
    const player = lobby.players.get(socket.id);
    if (!player || !lobby.inProgress || player.finished || player.frozen) return;

    player.distance += 2;

    if (player.distance >= FINISH_DISTANCE && !player.finished) {
      player.finished = true;
      lobby.finishedOrder.push({ id: socket.id, name: player.name });
      player.rank = lobby.finishedOrder.length;

      if (player.rank === 1) {
        console.log(`🏆 ${player.name} won the race!`);
        lobby.inProgress = false;
      }
    }

    io.emit("state", getLobbyState());
  });

  // --- Reset ---
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

// === Start Server ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
