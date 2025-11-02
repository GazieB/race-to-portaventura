// =============================
// Race to PortAventura - client.js (Dynamic Commentary Edition)
// =============================
console.log("✅ client.js loaded");

const socket = io();

const nameInput = document.getElementById("name");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const leaderboard = document.getElementById("leaderboard");
const countdown = document.getElementById("countdown");
const tracks = document.getElementById("tracks");
const commentaryBox = document.getElementById("commentaryBox");

let raceInProgress = false;
let holdTimer = null;
let holdStartTime = null;
let commentaryInterval = null;
let latestState = null;

const buzzer = new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg");
buzzer.volume = 0.6;

// === Utility: Show commentary messages ===
function showCommentary(text, color = "white") {
  if (!commentaryBox) return;
  commentaryBox.innerHTML = `🎤 ${text}`;
  commentaryBox.style.borderColor = color === "gold" ? "#ffd700" : "#007bff";
  commentaryBox.classList.add("show");
  setTimeout(() => commentaryBox.classList.remove("show"), 4500);
}

// === Join / Start / Reset ===
joinBtn.addEventListener("click", () => {
  const name = nameInput.value.trim() || "Player";
  socket.emit("join", name);
});

startBtn.addEventListener("click", () => socket.emit("start"));
resetBtn.addEventListener("click", () => socket.emit("reset"));

// === Spacebar Controls (Anti-Cheat) ===
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && raceInProgress) {
    if (!holdTimer) {
      holdStartTime = Date.now();
      holdTimer = setTimeout(() => {
        const holdDuration = Date.now() - holdStartTime;
        if (holdDuration >= 1200) {
          console.log("🚨 Cheat detected — sending to server!");
          socket.emit("cheatDetected");
        }
      }, 1200);
    }
    socket.emit("tap");
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
});

// === Countdown ===
socket.on("countdown", ({ ms }) => {
  let seconds = ms / 1000;
  countdown.textContent = seconds;
  const interval = setInterval(() => {
    seconds--;
    countdown.textContent = seconds > 0 ? seconds : "GO!";
    if (seconds <= 0) {
      clearInterval(interval);
      setTimeout(() => (countdown.textContent = ""), 1000);
    }
  }, 1000);
});

// === Cheat Alert ===
socket.on("cheatAlert", ({ name, message }) => {
  buzzer.currentTime = 0;
  buzzer.play().catch(() => {});
  const alert = document.createElement("div");
  alert.textContent = `🚨 ${message}`;
  Object.assign(alert.style, {
    position: "fixed",
    bottom: "30px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#ff0000",
    color: "#fff",
    padding: "14px 24px",
    borderRadius: "999px",
    fontSize: "1.2rem",
    fontWeight: "bold",
    fontFamily: "Poppins, sans-serif",
    boxShadow: "0 0 25px rgba(255,0,0,0.6)",
    textAlign: "center",
    zIndex: 9999,
  });
  document.body.appendChild(alert);
  setTimeout(() => alert.remove(), 3000);
});

// === Update Game State ===
socket.on("state", (state) => {
  latestState = state;
  raceInProgress = state.inProgress;
  tracks.innerHTML = "";
  leaderboard.innerHTML = "";

  const sortedPlayers = [...state.players].sort((a, b) => b.distance - a.distance);

  // Build Track
  state.players.forEach((p) => {
    const lane = document.createElement("div");
    lane.className = "lane";

    const plane = document.createElement("img");
    plane.src = "plane.png";
    plane.className = "plane";

    const ratio = Math.min(1, p.distance / state.finishDistance);
    plane.style.left = ratio * 90 + "%";

    const label = document.createElement("div");
    label.className = "player-name";
    label.textContent = p.name;

    if (p.finished) plane.classList.add("finished");
    if (p.frozen) {
      label.textContent += " ❄️ (Frozen)";
      plane.style.filter = "grayscale(100%) brightness(0.6)";
    }

    lane.appendChild(plane);
    lane.appendChild(label);
    tracks.appendChild(lane);
  });

  // Build Leaderboard
  sortedPlayers.forEach((p, idx) => {
    const li = document.createElement("li");
    const pct = Math.min(100, Math.round((p.distance / state.finishDistance) * 100));
    li.textContent = p.finished
      ? `#${p.rank || idx + 1} ${p.name} – Finished`
      : `${p.name} – ${pct}%`;

    if (idx === 0) li.style.background = "linear-gradient(90deg, #ffd700, #fff4b3)";
    else if (idx === 1) li.style.background = "linear-gradient(90deg, #c0c0c0, #f0f0f0)";
    else if (idx === 2) li.style.background = "linear-gradient(90deg, #cd7f32, #ffddb0)";
    li.style.fontWeight = "bold";

    leaderboard.appendChild(li);
  });

  startBtn.disabled = state.inProgress || state.players.length === 0;
  resetBtn.disabled = state.players.length === 0;

  // 🏁 End-of-Race Commentary
  const finishedAll = state.players.every((p) => p.finished);
  if (finishedAll && !state.inProgress && state.players.length > 0) {
    clearInterval(commentaryInterval);
    const winner = sortedPlayers[0]?.name || "Someone";
    showCommentary(`🏆 ${winner} has landed first at PortAventura!`, "gold");
    setTimeout(() => showCommentary("🎉 Thank you for taking part in the race!", "gold"), 5000);
    setTimeout(() => showCommentary("🎧 Thank you for taking part!", "blue"), 9000);
    setTimeout(() => showCommentary("🎢 I hope you enjoyed the experience!", "gold"), 13000);
  }
});

// === Dynamic Live Commentary ===
function startLiveCommentary() {
  const neutralComments = [
    "💨 The planes are off to a flying start!",
    "🔥 Things are heating up mid-race!",
    "🎢 It’s neck and neck over the Mediterranean!",
    "🌟 The crowd at PortAventura is cheering!",
    "🚀 Someone just gained serious altitude!",
    "🎯 Smooth flying — what control!",
    "👏 It’s still anyone’s race!"
  ];

  commentaryInterval = setInterval(() => {
    if (!raceInProgress || !latestState) return;
    const players = latestState.players;
    if (!players || players.length === 0) return;

    const sorted = [...players].sort((a, b) => b.distance - a.distance);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const randomRoll = Math.random();

    // 🥇 Leader callouts
    if (randomRoll < 0.4 && first && !first.finished) {
      const leaderComments = [
        `🔥 ${first.name} is leading the race right now!`,
        `✈️ ${first.name} is flying ahead of the pack!`,
        `🚀 ${first.name} looks unstoppable!`,
        `🏁 ${first.name} is showing everyone how it’s done!`
      ];
      const message = leaderComments[Math.floor(Math.random() * leaderComments.length)];
      showCommentary(message, "gold");

      // 💫 Highlight the leader on leaderboard
      const leaderboardItems = document.querySelectorAll("#leaderboard li");
      leaderboardItems.forEach(li => {
        if (li.textContent.includes(first.name)) {
          li.classList.add("leader-flash");
          setTimeout(() => li.classList.remove("leader-flash"), 1200);
        }
      });
    }

    // 😎 Neutral updates
    else if (randomRoll < 0.8) {
      showCommentary(neutralComments[Math.floor(Math.random() * neutralComments.length)], "blue");
    }

    // 🐢 Cheeky comments for last place
    else if (last && !last.finished) {
      const cheekyComments = [
        `😴 Looks like ${last.name} can’t be bothered today!`,
        `🐢 ${last.name} might still be on the runway!`,
        `☕ ${last.name} stopped for a coffee break!`,
        `🛬 ${last.name} taking the scenic route again?`
      ];
      showCommentary(cheekyComments[Math.floor(Math.random() * cheekyComments.length)], "blue");
    }
  }, 7000);
}

// === Facts Rotation ===
const portaventuraFacts = [
  "🎢 PortAventura World has **6 themed areas** including China and the Far West.",
  "🏨 Hotel guests get **free park access** during their stay.",
  "🚆 Only 10 minutes from **Salou** and 1 hour from **Barcelona**.",
  "🎟️ Includes **Ferrari Land** and **Caribe Aquatic Park**.",
  "🍴 Over **50 restaurants** and snack spots in the resort.",
  "🌙 Night shows, fireworks, and character parades every evening."
];

const airportFacts = [
  "🛫 Newcastle Airport serves **over 5 million passengers** per year.",
  "🍔 Great dining with **Greggs, Burger King, Cabin Bar**, and more.",
  "💺 The airport provides **special assistance** and priority lanes.",
  "🛍️ Duty-free includes **World Duty Free** and **JD Sports**.",
  "🚖 Around 15 minutes from **Newcastle city centre**.",
  "🧳 Offers lounges, car rentals, and on-site parking."
];

const reusFacts = [
  "🛬 Airlines like **Jet2, Ryanair, and TUI** operate direct seasonal flights.",
  "🌍 Handles **over 1 million passengers** annually.",
  "🧳 Features **wheelchair access**, accessible toilets, and assistance staff.",
  "🚗 Car hire available with **Avis, Hertz, Europcar, and Goldcar**.",
  "🚌 Shuttle buses to **Salou, Tarragona, and PortAventura** every 30 mins.",
  "☕ Cafés, duty-free, and family facilities available."
];

function rotateFacts() {
  const factText = document.getElementById("factText");
  const airportFact = document.getElementById("airportFact");
  const reusFact = document.getElementById("reusFact");

  if (!factText || !airportFact || !reusFact) return;

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  factText.innerHTML = pick(portaventuraFacts);
  airportFact.innerHTML = pick(airportFacts);
  reusFact.innerHTML = pick(reusFacts);
}

window.addEventListener("DOMContentLoaded", () => {
  rotateFacts();
  setInterval(rotateFacts, 10000);
  startLiveCommentary();
});
