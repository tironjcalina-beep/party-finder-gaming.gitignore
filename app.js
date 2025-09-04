const socket = io();

// Stato UI
let nickname = null;
let currentRoom = null;
let allGames = []; // {key, name, users}

// Helpers
const el = (sel) => document.querySelector(sel);
const listEl = el("#game-list");
const searchEl = el("#search");
const meEl = el("#me");
const roomTitleEl = el("#room-title");
const userCountEl = el("#user-count");
const messagesEl = el("#messages");
const msgInput = el("#msg");
const sendForm = el("#send-form");
const customForm = el("#custom-form");
const customName = el("#custom-name");

const renderGames = () => {
  const q = (searchEl.value || "").toLowerCase();
  listEl.innerHTML = "";
  allGames
    .filter(g => g.name.toLowerCase().includes(q))
    .forEach(g => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between bg-slate-800 rounded-xl p-2";
      li.innerHTML = `
        <div>
          <div class="font-medium">${g.name}</div>
          <div class="text-xs text-slate-400">${g.users} online</div>
        </div>
        <button class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500">Entra</button>
      `;
      li.querySelector("button").addEventListener("click", () => joinGame(g.key || g.name));
      listEl.appendChild(li);
    });
};

const joinGame = (gameNameOrKey) => {
  socket.emit("join_game", { gameNameOrKey });
};

const addMessage = (html, kind="msg") => {
  const div = document.createElement("div");
  if (kind === "sys") {
    div.className = "text-xs text-slate-400";
  } else {
    div.className = "bg-slate-800 rounded-xl px-3 py-2";
  }
  div.innerHTML = html;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
};

// Socket events
socket.on("hello", async ({ nickname: n, presets }) => {
  nickname = n;
  meEl.textContent = `Sei: ${nickname}`;
  // Precarica lista giochi dal server
  const res = await fetch("/api/games");
  allGames = await res.json();
  // Assicura che i preset siano visibili anche senza utenti
  presets.forEach(p => {
    if (!allGames.some(g => g.key === p.key)) {
      allGames.push({ key: p.key, name: p.name, users: 0 });
    }
  });
  allGames.sort((a,b) => b.users - a.users);
  renderGames();
});

socket.on("joined", ({ key, name }) => {
  currentRoom = key;
  roomTitleEl.textContent = `Stanza: ${name}`;
  msgInput.disabled = false;
  sendForm.querySelector("button").disabled = false;
  messagesEl.innerHTML = "";
  addMessage(`<span class="text-slate-300">Sei entrato in <b>${name}</b></span>`, "sys");
});

socket.on("user_count", (count) => {
  userCountEl.textContent = `${count} nella stanza`;
  // Aggiorna lista giochi localmente
  const res = allGames.find(g => g.key === currentRoom);
  if (res) res.users = count;
  renderGames();
});

socket.on("system", ({ text }) => addMessage(`🛈 ${text}`, "sys"));

socket.on("message", ({ from, text, ts }) => {
  const time = new Date(ts).toLocaleTimeString();
  addMessage(`<div class="text-sm text-slate-400">${from} • ${time}</div><div>${text}</div>`);
});

let typingTimer;
msgInput?.addEventListener("input", () => {
  socket.emit("typing", true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit("typing", false), 1000);
});

socket.on("typing", ({ user, isTyping }) => {
  // Optional: potresti mostrare "user sta scrivendo..." (omesso per semplicità)
});

// Invio messaggi
sendForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text) return;
  socket.emit("message", { text });
  msgInput.value = "";
});

// Cerca gioco
searchEl.addEventListener("input", renderGames);

// Aggiungi gioco custom
customForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = customName.value.trim();
  if (!name) return;
  joinGame(name);
  customName.value = "";
});

// Aggiorna periodicamente la lista utenti per gioco (soft refresh)
setInterval(async () => {
  try {
    const res = await fetch("/api/games");
    allGames = await res.json();
    renderGames();
  } catch {}
}, 8000);