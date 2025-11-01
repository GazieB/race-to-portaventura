// =============================
// Race to PortAventura - client.js (Anti-Cheat Fixed + Debug + Custom Message)
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

let raceInProgress = false;
let holdTimer = null;
let holdStartTime = null;

// === Cheater Sound ===
const buzzer = new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg");
buzzer.volume = 0.6;

// === Join / Start / Reset ===
joinBtn.addEventListener("click", () => {
  const name = nameInput.value.trim() || "Player";
  socket.emit("join", name);
});

startBtn.addEventListener("click", () => socket.emit("start"));
resetBtn.addEventListener("click", () => socket.emit("reset"));

// === Spacebar Controls (with Anti-Cheat) ===
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && raceInProgress) {
    if (!holdTimer) {
      holdStartTime = Date.now();
      console.log("🟡 Holding space...");

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
    console.log("🟢 Released space.");
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

// === Global Cheat Alert ===
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

// === Game State Updates ===
socket.on("state", (state) => {
  raceInProgress = state.inProgress;
  tracks.innerHTML = "";
  leaderboard.innerHTML = "";

  const sortedPlayers = [...state.players].sort((a, b) => b.distance - a.distance);

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
});

// === Rotating Fact Sections ===
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
});
