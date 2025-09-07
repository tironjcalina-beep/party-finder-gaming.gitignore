const socket = io();
let nickname = "Anonimo";
let currentLobby = null;
let selectedGame = null;
let gameToCreate = null;
let lobbyIsPrivate = false; // stato privato

const allGames = ["Fortnite","Minecraft","Valorant","Five Nights at Freddy's","FIFA 24","Call of Duty","League of Legends","Among Us","GTA V","Overwatch"];
const mainGames = ["Fortnite","Minecraft","Valorant"];

const gameList = document.getElementById("game-list");
const searchInput = document.getElementById("search");
const suggestions = document.getElementById("search-suggestions");
const playerListDiv = document.getElementById("player-list");

function renderGameList(games) {
  gameList.innerHTML = "";
  games.forEach(game => {
    const li = document.createElement("li");
    li.dataset.game = game;
    li.className = "flex items-center justify-between bg-panelBg rounded-xl p-2 hover:bg-panelHover transition";
    li.innerHTML = `
      <span>${game}</span>
      <div class="flex gap-2">
        <button class="see-lobbies bg-neonBlue px-2 py-1 rounded-lg">Lobby</button>
        <button class="create-lobby bg-neonPink px-2 py-1 rounded-lg">+ Lobby</button>
      </div>
    `;
    gameList.appendChild(li);

    // crea lobby
    li.querySelector(".create-lobby").addEventListener("click", () => {
      gameToCreate = game;
      document.getElementById("lobby-modal").classList.remove("hidden");
      document.getElementById("max-players").value = 4;
    });

    // mostra lobby
    li.querySelector(".see-lobbies").addEventListener("click", () => {
      socket.emit("getLobbies", game);
    });
  });
}

renderGameList(mainGames);

// ricerca giochi
searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase().trim();
  suggestions.innerHTML = "";
  if (!query) {
    suggestions.classList.add("hidden");
    renderGameList(mainGames);
    return;
  }
  const filtered = allGames.filter(g => g.toLowerCase().includes(query));
  if (filtered.length === 0) {
    suggestions.classList.add("hidden");
    renderGameList([]);
    return;
  }
  filtered.forEach(game => {
    const li = document.createElement("li");
    li.className = "px-3 py-2 hover:bg-panelHover cursor-pointer rounded-xl";
    li.innerText = game;
    li.addEventListener("click", () => {
      searchInput.value = game;
      suggestions.classList.add("hidden");
      renderGameList([game]);
      selectedGame = game;
    });
    suggestions.appendChild(li);
  });
  suggestions.classList.remove("hidden");
});

document.addEventListener("click", e => {
  if (!searchInput.contains(e.target)) suggestions.classList.add("hidden");
});

// nickname
function generateConfetti() {
  const colors=['#f87171','#fbbf24','#34d399','#60a5fa','#a78bfa'];
  for(let i=0;i<20;i++){
    const c=document.createElement('span');
    c.className='confetti';
    c.style.backgroundColor=colors[Math.floor(Math.random()*colors.length)];
    c.style.left=`${Math.random()*100}%`;
    c.style.animationDuration=`${0.8+Math.random()*0.7}s`;
    document.body.appendChild(c);
    setTimeout(()=>c.remove(),1500);
  }
}

document.getElementById("set-nickname").addEventListener("click", () => {
  const val=document.getElementById("nickname").value.trim();
  if(!val) return;
  nickname=val;
  const toast=document.getElementById("nickname-toast");
  const msgDiv=toast.querySelector("div");
  msgDiv.innerText=`Nome cambiato in "${nickname}"`;
  toast.classList.remove("pointer-events-none");
  msgDiv.classList.remove("opacity-0","scale-90");
  msgDiv.classList.add("opacity-100","scale-100");
  generateConfetti();
  setTimeout(()=>{
    msgDiv.classList.remove("opacity-100","scale-100");
    msgDiv.classList.add("opacity-0","scale-90");
    toast.classList.add("pointer-events-none");
  },2000);
});

// toggle lobby privata
const privateBtn = document.getElementById("private-toggle-btn");
const privateIcon = document.getElementById("private-icon");
const privateLabel = document.getElementById("private-label");

privateBtn.addEventListener("click", () => {
  lobbyIsPrivate = !lobbyIsPrivate;
  if (lobbyIsPrivate) {
    privateBtn.classList.remove("bg-slate-700","hover:bg-slate-600");
    privateBtn.classList.add("bg-red-600","hover:bg-red-500");
    privateIcon.innerText = "🔒";
    privateLabel.innerText = "Lobby privata";
  } else {
    privateBtn.classList.remove("bg-red-600","hover:bg-red-500");
    privateBtn.classList.add("bg-slate-700","hover:bg-slate-600");
    privateIcon.innerText = "🔓";
    privateLabel.innerText = "Lobby pubblica";
  }
});

// modale lobby
document.getElementById("cancel-lobby").addEventListener("click", () => {
  document.getElementById("lobby-modal").classList.add("hidden");
  gameToCreate=null;
  lobbyIsPrivate=false;
});

document.getElementById("confirm-lobby").addEventListener("click", () => {
  const maxPlayers=parseInt(document.getElementById("max-players").value);
  if(!maxPlayers||maxPlayers<1||maxPlayers>8){
    alert("Numero giocatori non valido (1-8)");
    return;
  }
  socket.emit("createLobby",{game:gameToCreate,maxPlayers,host:nickname,private:lobbyIsPrivate},lobbyId=>{
    currentLobby=lobbyId;
  });
  document.getElementById("lobby-modal").classList.add("hidden");
  gameToCreate=null;
  lobbyIsPrivate=false;
  // reset pulsante
  privateBtn.classList.remove("bg-red-600","hover:bg-red-500");
  privateBtn.classList.add("bg-slate-700","hover:bg-slate-600");
  privateIcon.innerText = "🔓";
  privateLabel.innerText = "Lobby pubblica";
});

// ricevi lista lobby
socket.on("lobbyList", lobbies => {
  const list=document.getElementById("lobby-list");
  list.innerHTML="";
  list.classList.remove("hidden");
  if(lobbies.length===0){
    list.innerHTML="<p class='text-sm text-slate-400'>Nessuna lobby disponibile.</p>";
    return;
  }
  lobbies.forEach(lobby=>{
    const div=document.createElement("div");
    div.className="p-3 bg-panelBg rounded-xl flex justify-between items-center transition hover:bg-panelHover";
    const lockIcon = lobby.private ? "🔒 " : "";
    div.innerHTML=`
      <span>${lockIcon}${lobby.host}'s Lobby — ${lobby.players.length}/${lobby.maxPlayers}</span>
      <button class="px-3 py-1 rounded-xl bg-neonBlue hover:bg-neonPink">Entra</button>
    `;
    div.querySelector("button").addEventListener("click",()=>{
      if(currentLobby===lobby.id){
        alert("Sei già in questa lobby!");
        return;
      }
      socket.emit("joinLobby",lobby.id,nickname);
    });
    list.appendChild(div);
  });
});

// lobby join
socket.on("joinedLobby", lobby=>{
  currentLobby=lobby.id;
  document.getElementById("room-title").innerText=`Lobby di ${lobby.host} — ${lobby.game}`;
  document.getElementById("messages").innerHTML="";
  document.getElementById("msg").disabled=false;
  document.querySelector("#send-form button").disabled=false;
  document.getElementById("user-count").innerText=`${lobby.players.length}/${lobby.maxPlayers}`;
  updatePlayerList(lobby);
});

function updatePlayerList(lobby){
  playerListDiv.innerHTML="";
  lobby.players.forEach(p=>{
    const span=document.createElement("span");
    span.className="px-3 py-1 bg-panelHover rounded-full flex items-center gap-2";
    span.innerText=p.name;
    if(lobby.host===nickname&&p.name!==nickname){
      const kickBtn=document.createElement("button");
      kickBtn.innerText="✖";
      kickBtn.className="ml-2 text-red-500 hover:text-red-700";
      kickBtn.addEventListener("click",()=>socket.emit("kickPlayer",lobby.id,p.name));
      span.appendChild(kickBtn);
    }
    playerListDiv.appendChild(span);
  });
}

socket.on("lobbyUpdate", lobby=>{
  if(currentLobby===lobby.id){
    document.getElementById("user-count").innerText=`${lobby.players.length}/${lobby.maxPlayers}`;
    updatePlayerList(lobby);
  }
});

// chat
document.getElementById("send-form").addEventListener("submit", e=>{
  e.preventDefault();
  const msg=document.getElementById("msg").value.trim();
  if(!msg||!currentLobby) return;
  socket.emit("chatMessage",{lobbyId:currentLobby,nickname,msg});
  document.getElementById("msg").value="";
});

socket.on("chatMessage", data=>{
  const div=document.createElement("div");
  div.className="bg-panelHover px-3 py-2 rounded-xl";
  div.innerHTML=`<b>${data.nickname}:</b> ${data.msg}`;
  const messages=document.getElementById("messages");
  messages.appendChild(div);
  messages.scrollTop=messages.scrollHeight;
});
