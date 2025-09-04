const express = require("express");
const path = require("path");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = process.env.PORT || 3000;

// Servire i file statici (index.html, css, js ecc.)
app.use(express.static(path.join(__dirname, "public")));

// Se l’utente apre la root "/", mandiamo index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- WebSocket server ---
const server = app.listen(PORT, () => {
  console.log(`Server in ascolto su http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Nuovo client connesso");
  ws.on("message", (msg) => {
    // Inoltra il messaggio a tutti
    wss.clients.forEach((client) => {
      if (client.readyState === ws.OPEN) {
        client.send(msg.toString());
      }
    });
  });
});
