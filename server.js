const express = require("express");
const path = require("path");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = process.env.PORT || 3000;

// Percorso assoluto della cartella /public
const publicPath = path.join(__dirname, "public");

// Serve i file statici (index.html, css, js ecc.)
app.use(express.static(publicPath));

// Route per la homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Avvia server HTTP
const server = app.listen(PORT, () => {
  console.log(`Server in ascolto su http://localhost:${PORT}`);
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Nuovo client connesso");

  ws.on("message", (msg) => {
    console.log("Messaggio ricevuto:", msg.toString());

    // Invia il messaggio a tutti i client connessi
    wss.clients.forEach((client) => {
      if (client.readyState === ws.OPEN) {
        client.send(msg.toString());
      }
    });
  });
});
