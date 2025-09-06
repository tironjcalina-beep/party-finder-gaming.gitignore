const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const { v4: uuidv4 } = require("uuid");

app.use(express.static("public"));

let lobbies = [];

io.on("connection", socket => {
  socket.on("createLobby", (data, cb) => {
    const id = uuidv4();
    const lobby = {
      id,
      game: data.game,
      host: data.host,
      maxPlayers: data.maxPlayers,
      private: data.private,
      players: [{ name: data.host, id: socket.id }]
    };
    lobbies.push(lobby);
    socket.join(id);
    cb(id);
    io.to(socket.id).emit("joinedLobby", lobby);
  });

  socket.on("getLobbies", game => {
    const filtered = lobbies.filter(l => l.game === game && !l.private);
    socket.emit("lobbyList", filtered);
  });

  socket.on("joinLobby", (lobbyId, nickname) => {
    const lobby = lobbies.find(l => l.id === lobbyId);
    if (!lobby) return;
    if (lobby.players.find(p => p.name === nickname)) return;
    if (lobby.players.length >= lobby.maxPlayers) return;
    lobby.players.push({ name: nickname, id: socket.id });
    socket.join(lobbyId);
    io.to(socket.id).emit("joinedLobby", lobby);
    io.to(lobbyId).emit("lobbyUpdate", lobby);
  });

  socket.on("kickPlayer", (lobbyId, playerName) => {
    const lobby = lobbies.find(l => l.id === lobbyId);
    if (!lobby) return;
    if (lobby.host !== lobby.players.find(p => p.id === socket.id)?.name) return;
    const idx = lobby.players.findIndex(p => p.name === playerName);
    if (idx !== -1) {
      const kicked = lobby.players.splice(idx, 1)[0];
      io.to(kicked.id).emit("joinedLobby", { id: null, players: [] });
      io.to(lobbyId).emit("lobbyUpdate", lobby);
      io.sockets.sockets.get(kicked.id)?.leave(lobbyId);
    }
  });

  socket.on("chatMessage", data => {
    io.to(data.lobbyId).emit("chatMessage", { nickname: data.nickname, msg: data.msg });
  });

  socket.on("disconnect", () => {
    lobbies.forEach(lobby => {
      const idx = lobby.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        lobby.players.splice(idx, 1);
        io.to(lobby.id).emit("lobbyUpdate", lobby);
      }
    });
    lobbies = lobbies.filter(l => l.players.length > 0);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
