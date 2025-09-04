

import express from "express";
import http from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import cors from "cors";
import Filter from "bad-words";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Sicurezza base
app.use(helmet({
  contentSecurityPolicy: false // semplice per dev; su prod valuta CSP
}));
app.use(cors());
app.use(express.static("public"));

// === DATI IN MEMORIA (no DB) ===
// Mappa: gameKey -> { name, isPreset, users: Set<socketId> }
const games = new Map();
// Preset: Fortnite, Minecraft, Rainbow Six Siege, Clash Royale, Call of Duty Warzone 2.0, altri CoD
const presetGames = [
  "Fortnite",
  "Minecraft",
  "Rainbow Six Siege",
  "Clash Royale",
  "Call of Duty: Warzone 2.0",
  "Call of Duty (altri titoli)"
];

const slugify = (s) =>
  s.toLowerCase()
   .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
   .replace(/[^a-z0-9]+/g, "-")
   .replace(/(^-|-$)/g, "");

// Inizializza preset
for (const name of presetGames) {
  games.set(slugify(name), { name, isPreset: true, users: new Set() });
}

const randomName = () => {
  const n = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `Player-${n}`;
};

const filter = new Filter();
filter.addWords("shitpost"); // puoi ampliare/italianizzare la lista

// Rate limit semplice per socket (anti-spam)
const rateState = new Map(); // socket.id -> { count, ts }
const allowMessage = (socketId) => {
  const now = Date.now();
  const windowMs = 3000; // 3s
  const max = 5; // max 5 msg / 3s
  const state = rateState.get(socketId) || { count: 0, ts: now };
  if (now - state.ts > windowMs) {
    rateState.set(socketId, { count: 1, ts: now });
    return true;
  } else {
    if (state.count < max) {
      state.count++;
      rateState.set(socketId, state);
      return true;
    }
    return false;
  }
};

// API leggere per lista/ricerca giochi (facoltative, ma utili)
app.get("/api/games", (req, res) => {
  const list = Array.from(games.entries()).map(([key, g]) => ({
    key, name: g.name, isPreset: g.isPreset, users: g.users.size
  }));
  res.json(list.sort((a,b) => b.users - a.users));
});

// Socket.IO
io.on("connection", (socket) => {
  // Anonimato: nickname random per sessione
  socket.data.nickname = randomName();

  socket.emit("hello", {
    nickname: socket.data.nickname,
    presets: presetGames.map((n) => ({ key: slugify(n), name: n }))
  });

  // Creare/entrare in una stanza di gioco
  socket.on("join_game", ({ gameNameOrKey }) => {
    let key = slugify(gameNameOrKey);
    let game = games.get(key);

    // Se non esiste, crea un gioco "custom" (non-persistente)
    if (!game) {
      const cleanName = (gameNameOrKey || "").trim().slice(0, 60);
      if (!cleanName) return;
      key = slugify(cleanName);
      game = games.get(key);
      if (!game) {
        game = { name: cleanName, isPreset: false, users: new Set() };
        games.set(key, game);
      }
    }

    // Lascia eventuale stanza precedente
    if (socket.data.gameKey) {
      const prevKey = socket.data.gameKey;
      socket.leave(prevKey);
      const prev = games.get(prevKey);
      if (prev) {
        prev.users.delete(socket.id);
        if (!prev.isPreset && prev.users.size === 0) {
          games.delete(prevKey); // pulizia giochi custom vuoti
        } else {
          io.to(prevKey).emit("user_count", prev.users.size);
        }
      }
    }

    // Entra nella nuova stanza
    socket.join(key);
    game.users.add(socket.id);
    socket.data.gameKey = key;

    socket.emit("joined", { key, name: game.name });
    io.to(key).emit("system", {
      text: `${socket.data.nickname} si è unito alla chat.`,
      ts: Date.now()
    });
    io.to(key).emit("user_count", game.users.size);
  });

  socket.on("message", ({ text }) => {
    const key = socket.data.gameKey;
    if (!key) return;
    if (!allowMessage(socket.id)) {
      socket.emit("system", { text: "Stai inviando messaggi troppo velocemente.", ts: Date.now() });
      return;
    }
    let msg = (text || "").toString().slice(0, 500);
    if (!msg.trim()) return;
    msg = filter.clean(msg);

    io.to(key).emit("message", {
      from: socket.data.nickname,
      text: msg,
      ts: Date.now()
    });
  });

  socket.on("typing", (isTyping) => {
    const key = socket.data.gameKey;
    if (!key) return;
    socket.to(key).emit("typing", {
      user: socket.data.nickname,
      isTyping: !!isTyping
    });
  });

  socket.on("disconnect", () => {
    const key = socket.data.gameKey;
    if (key) {
      const game = games.get(key);
      if (game) {
        game.users.delete(socket.id);
        if (!game.isPreset && game.users.size === 0) {
          games.delete(key);
        } else {
          io.to(key).emit("user_count", game.users.size);
          io.to(key).emit("system", {
            text: `${socket.data.nickname} ha lasciato la chat.`,
            ts: Date.now()
          });
        }
      }
    }
    rateState.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server in ascolto su http://localhost:${PORT}`);
});
