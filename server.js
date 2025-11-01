// =============================
// Race to PortAventura - server.js (Hold Detection Only)
// =============================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ✅ Serve static files
app.use(express.static("public"));
console.log("📦 Serving static files from:", __dirname + "/public");

// === Game Settings ===
const MAX_PLAYERS = 10;
const FINISH_DISTANCE = 1000;
const START_COUNTDOWN_MS = 3000;

// === Lobby Data ===
const lobby = {
  players: new Map(), // socket.id -> { name, distance, finished, rank, frozen }
  inProgress: false,
  startedAt: null,
  finishedOrder: [],
};

// === Helper: Get current lobby state ===
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

// === Reset Race ===
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

// === Handle Cheating ===
function handleCheating(player) {
  console.log(`🤡 ${player.name} is holding Space too long!`);
  const message = `${player.name}, stop cheating please — it's only a game!`;

  // Broadcast message to everyone
  io.emit("cheatAlert", { name: player.name, message });

  // Freeze cheater temporarily
  player.frozen = true;
  io.emit("state", getLobbyState());

  setTimeout(() => {
    player.frozen = false;
    io.emit("state", getLobbyState());
  }, 1500);
}

// === Main Socket Logic ===
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
      io.emit("state", getLobbyState());
      console.log("🏁 Race started!");
    }, START_COUNTDOWN_MS);
  });

  // --- Player Tap (move forward) ---
  socket.on("tap", () => {
    const player = lobby.players.get(socket.id);
    if (!player || !lobby.inProgress || player.finished || player.frozen) return;

    player.distance += 2;

    // Finish check
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

  // --- Cheat Detected (from client) ---
  socket.on("cheatDetected", () => {
    const player = lobby.players.get(socket.id);
    if (player && !player.frozen && lobby.inProgress) {
      handleCheating(player);
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

// === Start Server ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
