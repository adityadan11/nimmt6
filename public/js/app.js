// app.js — 6 Nimmt! Frontend Application
(function () {
  'use strict';

  // ── Socket Connection ──
  const socket = io();

  // ── State ──
  let myPlayerId = null;
  let myNickname = '';
  let currentRoom = null;
  let isHost = false;
  let selectedCard = null;
  let cardConfirmed = false;
  let choosingRow = false;
  let gameState = null;

  // ── DOM References ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const screens = {
    home: $('#screen-home'),
    lobby: $('#screen-lobby'),
    game: $('#screen-game'),
  };

  // Home
  const nicknameInput = $('#nickname-input');
  const roomCodeJoinInput = $('#room-code-join');
  const btnCreateRoom = $('#btn-create-room');
  const btnJoinRoom = $('#btn-join-room');

  // Lobby
  const lobbyRoomCode = $('#lobby-room-code');
  const playerList = $('#player-list');
  const playerCount = $('#player-count');
  const waitingText = $('#waiting-text');
  const btnStartGame = $('#btn-start-game');
  const btnLeaveRoom = $('#btn-leave-room');

  // Game
  const roundNumber = $('#round-number');
  const totalRounds = $('#total-rounds');
  const playersStatus = $('#players-status');
  const gameRoomCode = $('#game-room-code');
  const statusArea = $('#status-area');
  const statusText = $('#status-text');
  const revealArea = $('#reveal-area');
  const tableArea = $('#table-area');
  const handCards = $('#hand-cards');
  const confirmArea = $('#confirm-area');
  const btnConfirmCard = $('#btn-confirm-card');
  const btnScoreboard = $('#btn-scoreboard');

  // Overlays
  const scoreboardOverlay = $('#scoreboard-overlay');
  const scoreTableBody = $('#score-table-body');
  const btnCloseScoreboard = $('#btn-close-scoreboard');
  const gameoverOverlay = $('#gameover-overlay');
  const winnerName = $('#winner-name');
  const gameoverScoresBody = $('#gameover-scores-body');
  const btnPlayAgain = $('#btn-play-again');
  const btnBackToLobby = $('#btn-back-to-lobby');

  // History
  const historySection = $('#history-section');
  const historyList = $('#history-list');

  // ════════════════════════════════
  // SCREEN MANAGEMENT
  // ════════════════════════════════

  function showScreen(name) {
    const doSwitch = () => {
      Object.values(screens).forEach(s => s.classList.remove('active'));
      screens[name].classList.add('active');
      // Close overlays when switching screens
      scoreboardOverlay.classList.remove('active');
      gameoverOverlay.classList.remove('active');
    };

    if (!document.startViewTransition) {
      doSwitch();
      return;
    }

    document.documentElement.classList.add('zoom-transition');
    const transition = document.startViewTransition(doSwitch);
    transition.finished.finally(() => {
      document.documentElement.classList.remove('zoom-transition');
    });
  }

  // ════════════════════════════════
  // TOAST NOTIFICATIONS
  // ════════════════════════════════

  function showToast(message, type = 'info') {
    const container = $('#toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  // ════════════════════════════════
  // CARD RENDERING
  // ════════════════════════════════

  function createCardElement(card, extraClasses = '') {
    const div = document.createElement('div');
    div.className = `game-card ${extraClasses}`;
    div.dataset.number = card.number;
    div.dataset.bulls = card.bullHeads;
    div.dataset.num = card.number;

    const numberSpan = document.createElement('span');
    numberSpan.className = 'card-number';
    numberSpan.textContent = card.number;

    const bullsSpan = document.createElement('span');
    bullsSpan.className = 'card-bulls';
    bullsSpan.textContent = '🌶️'.repeat(card.bullHeads);

    div.appendChild(numberSpan);
    div.appendChild(bullsSpan);
    return div;
  }

  // ════════════════════════════════
  // GAME HISTORY (localStorage)
  // ════════════════════════════════

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem('nimmt6_history') || '[]');
    } catch { return []; }
  }

  function saveGameToHistory(scores) {
    const history = getHistory();
    const sorted = [...scores].sort((a, b) => a.totalPenalty - b.totalPenalty);
    history.unshift({
      date: new Date().toISOString(),
      winner: sorted[0].nickname,
      winnerScore: sorted[0].totalPenalty,
      players: sorted.map(s => ({ name: s.nickname, score: s.totalPenalty })),
    });
    // Keep last 20
    if (history.length > 20) history.length = 20;
    localStorage.setItem('nimmt6_history', JSON.stringify(history));
  }

  function renderHistory() {
    const history = getHistory();
    if (history.length === 0) {
      historySection.style.display = 'none';
      return;
    }
    historySection.style.display = 'block';
    historyList.innerHTML = '';
    history.forEach(g => {
      const div = document.createElement('div');
      div.className = 'history-item';
      const d = new Date(g.date);
      div.innerHTML = `
        <span class="winner">🏆 ${escapeHtml(g.winner)} (${g.winnerScore} 🌶️)</span>
        <span class="date">${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      `;
      historyList.appendChild(div);
    });
  }

  // ════════════════════════════════
  // HOME SCREEN EVENTS
  // ════════════════════════════════

  // Load saved nickname
  const savedNick = localStorage.getItem('nimmt6_nickname') || '';
  nicknameInput.value = savedNick;

  btnCreateRoom.addEventListener('click', () => {
    const nick = nicknameInput.value.trim();
    if (!nick) {
      showToast('Please enter a nickname', 'error');
      nicknameInput.focus();
      return;
    }
    myNickname = nick;
    localStorage.setItem('nimmt6_nickname', nick);
    socket.emit('create-room', { nickname: nick });
  });

  btnJoinRoom.addEventListener('click', () => {
    const nick = nicknameInput.value.trim();
    const code = roomCodeJoinInput.value.trim().toUpperCase();
    if (!nick) {
      showToast('Please enter a nickname', 'error');
      nicknameInput.focus();
      return;
    }
    if (!code || code.length < 4) {
      showToast('Please enter a valid room code', 'error');
      roomCodeJoinInput.focus();
      return;
    }
    myNickname = nick;
    localStorage.setItem('nimmt6_nickname', nick);
    socket.emit('join-room', { roomCode: code, nickname: nick });
  });

  // Enter key support
  nicknameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnCreateRoom.click();
  });
  roomCodeJoinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnJoinRoom.click();
  });
  roomCodeJoinInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });

  // Show history on load
  renderHistory();

  // ════════════════════════════════
  // LOBBY SCREEN
  // ════════════════════════════════

  function renderLobbyPlayers(players, hostId) {
    playerList.innerHTML = '';
    playerCount.textContent = `(${players.length}/10)`;

    players.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'player-item';
      const initial = p.nickname.charAt(0).toUpperCase();
      li.innerHTML = `
        <div class="avatar avatar-${i % 10}">${initial}</div>
        <span class="name">${escapeHtml(p.nickname)}</span>
        ${p.id === hostId ? '<span class="badge">Host</span>' : ''}
        ${p.id === myPlayerId ? '<span class="you-badge">You</span>' : ''}
      `;
      playerList.appendChild(li);
    });

    // Show/hide start button (host only, 2+ players)
    if (isHost && players.length >= 2) {
      btnStartGame.style.display = 'block';
    } else {
      btnStartGame.style.display = 'none';
    }

    // Waiting text
    if (players.length < 2) {
      waitingText.style.display = 'block';
      waitingText.innerHTML = 'Need at least 2 players<span class="dots">...</span>';
    } else if (!isHost) {
      waitingText.style.display = 'block';
      waitingText.innerHTML = 'Waiting for host to start<span class="dots">...</span>';
    } else {
      waitingText.style.display = 'none';
    }
  }

  lobbyRoomCode.addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoom).then(() => {
      showToast('Room code copied!', 'success');
    }).catch(() => {
      showToast('Copy failed — select manually', 'error');
    });
  });

  btnStartGame.addEventListener('click', () => {
    socket.emit('start-game');
  });

  btnLeaveRoom.addEventListener('click', () => {
    socket.disconnect();
    socket.connect();
    currentRoom = null;
    isHost = false;
    showScreen('home');
  });

  // ════════════════════════════════
  // GAME SCREEN
  // ════════════════════════════════

  function renderRows(rows) {
    for (let r = 0; r < 4; r++) {
      const container = $(`#row-${r}`);
      container.innerHTML = '';
      const rowData = rows[r] || [];
      rowData.forEach((card, idx) => {
        const el = createCardElement(card, idx === rowData.length - 1 ? 'card-enter' : '');
        container.appendChild(el);
      });
      $(`#row-count-${r}`).textContent = `${rowData.length}/5`;

      // Highlight rows with 5 cards (danger)
      const rowEl = container.closest('.table-row');
      if (rowData.length >= 5) {
        rowEl.classList.add('highlight-danger');
      } else {
        rowEl.classList.remove('highlight-danger');
      }
    }
  }

  function renderHand(hand) {
    handCards.innerHTML = '';
    hand.forEach(card => {
      const el = createCardElement(card);
      el.addEventListener('click', () => onCardClick(card, el));
      handCards.appendChild(el);
    });
  }

  function onCardClick(card, el) {
    if (cardConfirmed || choosingRow) return;

    // Deselect previous
    $$('.hand-cards .game-card.selected').forEach(c => c.classList.remove('selected'));

    // Select this card
    el.classList.add('selected');
    selectedCard = card;
    confirmArea.style.display = 'flex';
  }

  btnConfirmCard.addEventListener('click', () => {
    if (!selectedCard || cardConfirmed) return;

    socket.emit('play-card', { cardNumber: selectedCard.number });
  });

  function renderPlayersStatus(players) {
    playersStatus.innerHTML = '';
    players.forEach(p => {
      const chip = document.createElement('div');
      chip.className = `player-status-chip ${p.hasPlayed ? 'played' : ''}`;
      chip.innerHTML = `<span class="dot"></span> ${escapeHtml(p.nickname)}`;
      playersStatus.appendChild(chip);
    });
  }

  function setSelectingState() {
    selectedCard = null;
    cardConfirmed = false;
    choosingRow = false;
    confirmArea.style.display = 'none';
    revealArea.style.display = 'none';
    statusText.textContent = 'Select a card to play';
    statusText.className = 'status-text';

    // Re-enable hand cards
    $$('.hand-cards .game-card').forEach(c => {
      c.classList.remove('selected', 'disabled');
    });

    // Remove selectable from rows
    $$('.table-row').forEach(r => {
      r.classList.remove('selectable');
      r.onclick = null;
    });
  }

  // ── Scoreboard ──

  function renderScoreboard(scores) {
    const sorted = [...scores].sort((a, b) => a.totalPenalty - b.totalPenalty);
    scoreTableBody.innerHTML = '';
    sorted.forEach((s, i) => {
      const tr = document.createElement('tr');
      if (i === 0) tr.className = 'leader';
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${escapeHtml(s.nickname)}${s.id === myPlayerId ? ' (You)' : ''}</td>
        <td>${s.totalPenalty} 🌶️</td>
      `;
      scoreTableBody.appendChild(tr);
    });
  }

  btnScoreboard.addEventListener('click', () => {
    if (gameState) renderScoreboard(gameState.scores);
    scoreboardOverlay.classList.add('active');
  });

  btnCloseScoreboard.addEventListener('click', () => {
    scoreboardOverlay.classList.remove('active');
  });

  scoreboardOverlay.addEventListener('click', (e) => {
    if (e.target === scoreboardOverlay) scoreboardOverlay.classList.remove('active');
  });

  // ── Game Over ──

  btnPlayAgain.addEventListener('click', () => {
    if (isHost) {
      socket.emit('restart-game');
    } else {
      showToast('Only the host can restart', 'info');
    }
  });

  btnBackToLobby.addEventListener('click', () => {
    if (isHost) {
      socket.emit('back-to-lobby');
    } else {
      showToast('Only the host can return to lobby', 'info');
    }
  });

  // ════════════════════════════════
  // SOCKET EVENT HANDLERS
  // ════════════════════════════════

  // ── Room Created ──
  socket.on('room-created', (data) => {
    myPlayerId = data.playerId;
    currentRoom = data.roomCode;
    isHost = true;
    lobbyRoomCode.textContent = data.roomCode;
    renderLobbyPlayers(data.players, data.hostId);
    showScreen('lobby');
    showToast('Room created!', 'success');
  });

  // ── Room Joined ──
  socket.on('room-joined', (data) => {
    myPlayerId = data.playerId;
    myNickname = data.nickname;
    currentRoom = data.roomCode;
    isHost = (data.hostId === myPlayerId);
    lobbyRoomCode.textContent = data.roomCode;
    renderLobbyPlayers(data.players, data.hostId);
    showScreen('lobby');
    showToast(`Joined room ${data.roomCode}`, 'success');
  });

  // ── Player Joined ──
  socket.on('player-joined', (data) => {
    renderLobbyPlayers(data.players, data.hostId);
    // Re-check host
    if (isHost) {
      btnStartGame.style.display = data.players.length >= 2 ? 'block' : 'none';
    }
    showToast(`${data.nickname} joined!`, 'info');
  });

  // ── Player Left ──
  socket.on('player-left', (data) => {
    isHost = (data.hostId === myPlayerId);
    renderLobbyPlayers(data.players, data.hostId);
    showToast('A player left', 'info');
  });

  // ── Game Started ──
  socket.on('game-started', (state) => {
    gameState = state;
    gameRoomCode.textContent = currentRoom;
    roundNumber.textContent = state.round;
    totalRounds.textContent = state.totalRounds;
    renderRows(state.rows);
    renderHand(state.hand);
    renderPlayersStatus(state.players);
    setSelectingState();
    showScreen('game');
    gameoverOverlay.classList.remove('active');
    showToast('Game started! Pick a card', 'success');
  });

  // ── Card Confirmed ──
  socket.on('card-confirmed', ({ cardNumber }) => {
    cardConfirmed = true;
    confirmArea.style.display = 'none';
    statusText.textContent = `You played card ${cardNumber}. Waiting for others...`;
    statusText.className = 'status-text highlight';

    // Disable hand cards
    $$('.hand-cards .game-card').forEach(c => {
      if (parseInt(c.dataset.number) !== cardNumber) {
        c.classList.add('disabled');
      } else {
        c.classList.add('selected');
      }
    });
  });

  // ── Another Player Played ──
  socket.on('player-played', ({ playerId }) => {
    if (gameState) {
      const p = gameState.players.find(pl => pl.id === playerId);
      if (p) p.hasPlayed = true;
      renderPlayersStatus(gameState.players);
    }
  });

  // ── All Cards Revealed ──
  socket.on('all-cards-revealed', ({ plays }) => {
    statusText.textContent = 'Cards revealed! Resolving...';
    statusText.className = 'status-text highlight';
    revealArea.style.display = 'flex';
    revealArea.innerHTML = '';

    plays.forEach((play, i) => {
      const item = document.createElement('div');
      item.className = 'reveal-item';
      item.style.animationDelay = `${i * 150}ms`;

      const cardEl = createCardElement(play.card, 'revealed');
      cardEl.style.animationDelay = `${i * 150}ms`;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'player-name';
      nameSpan.textContent = play.playerId === myPlayerId ? 'You' : play.nickname;

      item.appendChild(cardEl);
      item.appendChild(nameSpan);
      revealArea.appendChild(item);
    });
  });

  // ── Card Placed on Row ──
  socket.on('card-placed', (data) => {
    renderRows(data.rows);
    // Brief highlight on reveal area
    showToast(`${data.nickname} → Row ${data.rowIndex + 1}`, 'info');
  });

  // ── Row Taken ──
  socket.on('row-taken', (data) => {
    renderRows(data.rows);
    const isMe = data.playerId === myPlayerId;
    const msg = isMe
      ? `You took Row ${data.rowIndex + 1}! (+${data.penalty} 🌶️)`
      : `${data.nickname} took Row ${data.rowIndex + 1}! (+${data.penalty} 🌶️)`;
    showToast(msg, isMe ? 'error' : 'info');

    // Update scores in gameState
    if (gameState) {
      const p = gameState.scores.find(s => s.id === data.playerId);
      if (p) p.totalPenalty = data.totalPenalty;
    }

    // Penalty flash for self
    if (isMe) {
      const flash = document.createElement('div');
      flash.className = 'penalty-flash';
      flash.textContent = `+${data.penalty} 🌶️`;
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 1500);
    }
  });

  // ── Choose Row ──
  socket.on('choose-row', (data) => {
    if (data.playerId === myPlayerId) {
      choosingRow = true;
      statusText.textContent = `Your card ${data.card.number} is lower than all rows. Choose a row to take!`;
      statusText.className = 'status-text highlight';

      // Make rows clickable
      $$('.table-row').forEach((rowEl) => {
        rowEl.classList.add('selectable');
        rowEl.onclick = () => {
          const rowIndex = parseInt(rowEl.dataset.row);
          socket.emit('row-chosen', { rowIndex });
          choosingRow = false;
          $$('.table-row').forEach(r => {
            r.classList.remove('selectable');
            r.onclick = null;
          });
          statusText.textContent = 'Resolving...';
        };
      });
    } else {
      statusText.textContent = `${data.nickname} must choose a row to take...`;
      statusText.className = 'status-text';
    }
  });

  // ── Turn End ──
  socket.on('turn-end', (data) => {
    if (gameState) {
      gameState.scores = data.scores;
    }
    roundNumber.textContent = data.round;
    revealArea.style.display = 'none';
    revealArea.innerHTML = '';
  });

  // ── Hand Update ──
  socket.on('hand-update', ({ hand }) => {
    if (gameState) {
      gameState.hand = hand;
      // Reset players status
      gameState.players.forEach(p => { p.hasPlayed = false; });
      renderPlayersStatus(gameState.players);
    }
    renderHand(hand);
    setSelectingState();
  });

  // ── Game Over ──
  socket.on('game-over', (data) => {
    const sorted = [...data.scores].sort((a, b) => a.totalPenalty - b.totalPenalty);
    winnerName.textContent = `🎉 ${sorted[0].nickname} wins with ${sorted[0].totalPenalty} 🌶️!`;

    gameoverScoresBody.innerHTML = '';
    sorted.forEach((s, i) => {
      const tr = document.createElement('tr');
      if (i === 0) tr.className = 'leader';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
      tr.innerHTML = `
        <td>${medal}</td>
        <td>${escapeHtml(s.nickname)}${s.id === myPlayerId ? ' (You)' : ''}</td>
        <td>${s.totalPenalty} 🌶️</td>
      `;
      gameoverScoresBody.appendChild(tr);
    });

    gameoverOverlay.classList.add('active');

    // Save to history
    saveGameToHistory(data.scores);

    // Show/hide host buttons
    if (!isHost) {
      btnPlayAgain.textContent = 'Play Again (Host only)';
      btnBackToLobby.textContent = 'Lobby (Host only)';
    } else {
      btnPlayAgain.textContent = '🔄 Play Again';
      btnBackToLobby.textContent = '🏠 Back to Lobby';
    }
  });

  // ── Returned to Lobby ──
  socket.on('returned-to-lobby', (roomState) => {
    gameoverOverlay.classList.remove('active');
    renderLobbyPlayers(roomState.players, roomState.hostId);
    lobbyRoomCode.textContent = roomState.code;
    isHost = (roomState.hostId === myPlayerId);
    showScreen('lobby');
    showToast('Returned to lobby', 'info');
  });

  // ── Error ──
  socket.on('error-msg', ({ message }) => {
    showToast(message, 'error');
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    showToast('Disconnected from server', 'error');
  });

  socket.on('connect', () => {
    if (currentRoom) {
      // Attempt to rejoin? For now just notify
      showToast('Reconnected!', 'success');
    }
  });

  // ════════════════════════════════
  // UTILITIES
  // ════════════════════════════════

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
