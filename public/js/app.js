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

  // ── Animation & Pacing ──
  let speedMultiplier = parseFloat(localStorage.getItem('nimmt6_speed') || '1');
  let animationQueue = [];
  let isAnimating = false;

  const TIMING = {
    REVEAL_DELAY: 800,
    MOVE_DURATION: 600,
    PICKUP_POPUP_DURATION: 2500,
    BETWEEN_CARDS_DELAY: 800,
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms * speedMultiplier));

  // ── Event Log ──
  function logEvent(msg) {
    const content = $('#event-log-content');
    const item = document.createElement('div');
    item.className = 'event-log-item';
    item.textContent = msg;
    content.prepend(item);
  }


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
  const maxRoundsEl = $('#max-rounds');
  const turnNumber = $('#turn-number');
  const totalTurns = $('#total-turns');
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
  const scoreboardSubtitle = $('#scoreboard-subtitle');
  const scoreboardTableWrap = $('#scoreboard-table-wrap');
  const btnCloseScoreboard = $('#btn-close-scoreboard');
  const roundendOverlay = $('#roundend-overlay');
  const roundendProgress = $('#roundend-progress');
  const roundendTitle = $('#roundend-title');
  const roundendWinner = $('#roundend-winner');
  const roundendTableWrap = $('#roundend-table-wrap');
  const roundendHostActions = $('#roundend-host-actions');
  const roundendWaiting = $('#roundend-waiting');
  const btnNextRound = $('#btn-next-round');
  const btnFinishMatch = $('#btn-finish-match');
  const gameoverOverlay = $('#gameover-overlay');
  const gameoverSubtitle = $('#gameover-subtitle');
  const winnerName = $('#winner-name');
  const gameoverTableWrap = $('#gameover-table-wrap');
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
      roundendOverlay.classList.remove('active');
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
    div.style.backgroundImage = `url('img/cards/card-${card.number}.jpg')`;
    div.setAttribute('aria-label', `Card ${card.number}, ${card.bullHeads} chilli${card.bullHeads > 1 ? 's' : ''}`);

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

  // Speed Control
  const speedSelect = $('#game-speed-select');
  if (speedSelect) {
    speedSelect.value = speedMultiplier.toString();
    speedSelect.addEventListener('change', (e) => {
      speedMultiplier = parseFloat(e.target.value);
      localStorage.setItem('nimmt6_speed', e.target.value);
    });
  }

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
    
    // Clear dims
    tableArea.classList.remove('dimmed');
    $$('.table-row').forEach(r => r.classList.remove('highlight-choice'));

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

  // ── Round-by-round score table ──

  // Builds a table: rank | player | R1..R{maxRounds} | total.
  // `liveRound` (optional) is the round currently being played; its column
  // shows the in-progress penalty for each player.
  function buildRoundTable(scores, { maxRounds = 10, liveRound = null } = {}) {
    const completed = Math.max(0, ...scores.map(s => (s.roundScores || []).length));
    const totalOf = (s) => s.totalPenalty;
    const sorted = [...scores].sort((a, b) => totalOf(a) - totalOf(b));
    const bestTotal = sorted.length ? totalOf(sorted[0]) : 0;

    // Lowest penalty in each completed round (to highlight)
    const bestPerRound = [];
    for (let r = 0; r < completed; r++) {
      bestPerRound[r] = Math.min(...scores.map(s => (s.roundScores || [])[r] ?? Infinity));
    }

    const table = document.createElement('table');
    table.className = 'round-table';

    // Header
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.innerHTML = '<th class="col-rank">#</th><th class="col-player">Player</th>';
    for (let r = 1; r <= maxRounds; r++) {
      const th = document.createElement('th');
      th.className = 'col-round';
      if (r === liveRound) th.classList.add('current');
      else if (r > completed) th.classList.add('future');
      th.textContent = `R${r}`;
      th.title = `Round ${r}`;
      headRow.appendChild(th);
    }
    headRow.insertAdjacentHTML('beforeend', '<th class="col-total">Total 🌶️</th>');
    thead.appendChild(headRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    let rank = 0;
    let prevTotal = null;
    sorted.forEach((s, i) => {
      if (totalOf(s) !== prevTotal) rank = i + 1; // ties share a rank
      prevTotal = totalOf(s);

      const tr = document.createElement('tr');
      if (totalOf(s) === bestTotal) tr.classList.add('leader');
      if (s.id === myPlayerId) tr.classList.add('me');
      tr.style.animationDelay = `${i * 60}ms`;

      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
      tr.innerHTML = `
        <td class="col-rank">${medal}</td>
        <td class="col-player" title="${escapeHtml(s.nickname)}">${escapeHtml(s.nickname)}${s.id === myPlayerId ? ' <span class="you-tag">You</span>' : ''}</td>
      `;

      for (let r = 1; r <= maxRounds; r++) {
        const td = document.createElement('td');
        td.className = 'col-round';
        const val = (s.roundScores || [])[r - 1];
        if (val !== undefined) {
          td.textContent = val;
          if (val === bestPerRound[r - 1]) td.classList.add('best');
        } else if (r === liveRound) {
          td.classList.add('current');
          td.textContent = s.penalty || 0;
        } else {
          td.classList.add('future');
          td.textContent = '–';
        }
        tr.appendChild(td);
      }

      const totalTd = document.createElement('td');
      totalTd.className = 'col-total';
      totalTd.textContent = totalOf(s);
      tr.appendChild(totalTd);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function renderInto(wrap, table) {
    wrap.innerHTML = '';
    wrap.appendChild(table);
  }

  // ── Scoreboard (live, during play) ──

  function renderScoreboard() {
    if (!gameState) return;
    const inProgress = gameState.state !== 'ROUND_END' && gameState.state !== 'GAME_OVER';
    scoreboardSubtitle.textContent = inProgress
      ? `Round ${gameState.round} of ${gameState.maxRounds} • in progress`
      : `Round ${gameState.round} of ${gameState.maxRounds} • complete`;
    renderInto(scoreboardTableWrap, buildRoundTable(gameState.scores, {
      maxRounds: gameState.maxRounds,
      liveRound: inProgress ? gameState.round : null,
    }));
  }

  btnScoreboard.addEventListener('click', () => {
    renderScoreboard();
    scoreboardOverlay.classList.add('active');
  });

  btnCloseScoreboard.addEventListener('click', () => {
    scoreboardOverlay.classList.remove('active');
  });

  scoreboardOverlay.addEventListener('click', (e) => {
    if (e.target === scoreboardOverlay) scoreboardOverlay.classList.remove('active');
  });

  // ── Round End ──

  function renderRoundProgress(round, maxRounds) {
    roundendProgress.innerHTML = '';
    for (let r = 1; r <= maxRounds; r++) {
      const pip = document.createElement('span');
      pip.className = 'pip' + (r < round ? ' done' : r === round ? ' just-done' : '');
      roundendProgress.appendChild(pip);
    }
  }

  function updateRoundEndActions() {
    roundendHostActions.style.display = isHost ? 'flex' : 'none';
    roundendWaiting.style.display = isHost ? 'none' : 'block';
  }

  btnNextRound.addEventListener('click', () => {
    if (!isHost) return;
    btnNextRound.disabled = true;
    socket.emit('next-round');
    setTimeout(() => { btnNextRound.disabled = false; }, 1500);
  });

  btnFinishMatch.addEventListener('click', () => {
    if (!isHost) return;
    if (confirm('End the match now? Final scores will be based on the rounds played so far.')) {
      socket.emit('finish-match');
    }
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

  // Shared setup when a new round's cards are dealt
  function startRound(state) {
    gameState = state;
    gameRoomCode.textContent = currentRoom;
    roundNumber.textContent = state.round;
    maxRoundsEl.textContent = state.maxRounds;
    turnNumber.textContent = state.turn;
    totalTurns.textContent = state.totalTurns;
    renderRows(state.rows);
    renderHand(state.hand);
    renderPlayersStatus(state.players);
    setSelectingState();
    roundendOverlay.classList.remove('active');
    gameoverOverlay.classList.remove('active');
    scoreboardOverlay.classList.remove('active');
    $('#event-log-content').innerHTML = ''; // clear log on new round
  }

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
    if (roundendOverlay.classList.contains('active')) updateRoundEndActions();
    showToast('A player left', 'info');
  });

  // ── Game Started (new match) ──
  socket.on('game-started', (state) => {
    startRound(state);
    showScreen('game');
    showToast(`Match started! Round 1 of ${state.maxRounds}`, 'success');
  });

  // ── Next Round Started ──
  socket.on('round-started', (state) => {
    startRound(state);
    showToast(`Round ${state.round} of ${state.maxRounds} — pick a card!`, 'success');
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
      // If we respect prefers-reduced-motion, animationDelay could be 0, but for now just use constant delays
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

  // ── Resolution Sequence ──
  socket.on('resolution-sequence', ({ events }) => {
    animationQueue.push(...events);
    processQueue();
  });

  async function processQueue() {
    if (isAnimating || animationQueue.length === 0) return;
    isAnimating = true;

    while (animationQueue.length > 0) {
      const event = animationQueue.shift();
      await playEventAnimation(event);
      // Brief pause between events for readability
      await delay(TIMING.BETWEEN_CARDS_DELAY);
    }

    isAnimating = false;
  }

  async function playEventAnimation(data) {
    if (data.type === 'card-placed') {
      renderRows(data.rows);
      const isMe = data.playerId === myPlayerId;
      const name = isMe ? 'You' : data.nickname;
      showToast(`${name} → Row ${data.rowIndex + 1}`, 'info');
      logEvent(`${name} played ${data.card.number} in Row ${data.rowIndex + 1}`);
      await delay(TIMING.MOVE_DURATION);
    }
    else if (data.type === 'row-taken') {
      const isMe = data.playerId === myPlayerId;
      const name = isMe ? 'You' : data.nickname;
      
      const reasonText = data.reason === 'SIXTH_CARD' 
        ? `${name} played ${data.card.number} as the 6th card.`
        : `${name}'s card ${data.card.number} was lower than all rows, and picked Row ${data.rowIndex + 1}.`;

      logEvent(`🚨 ${name} took Row ${data.rowIndex + 1} (${data.penalty} 🌶️). ${reasonText}`);

      // Highlight the row
      const rowEl = $(`#row-${data.rowIndex}`).closest('.table-row');
      rowEl.classList.add('highlight-danger');

      // Show Popup
      const popup = $('#row-taken-popup');
      $('#popup-header').textContent = `${name} took Row ${data.rowIndex + 1}!`;
      $('#popup-reason').textContent = reasonText;
      $('#popup-penalty').textContent = `+${data.penalty} 🌶️`;
      popup.classList.add('active');

      // Update scores in gameState
      if (gameState) {
        const p = gameState.scores.find(s => s.id === data.playerId);
        if (p) {
          p.totalPenalty = data.totalPenalty;
          p.penalty = data.roundPenalty;
        }
      }

      // Penalty flash for self
      if (isMe) {
        const flash = document.createElement('div');
        flash.className = 'penalty-flash';
        flash.textContent = `+${data.penalty} 🌶️`;
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 1500);
      }

      await delay(TIMING.PICKUP_POPUP_DURATION);

      popup.classList.remove('active');
      rowEl.classList.remove('highlight-danger');
      renderRows(data.rows);
    }
    else if (data.type === 'choose-row') {
      if (data.playerId === myPlayerId) {
        choosingRow = true;
        statusText.textContent = `Your card ${data.card.number} is lower than all rows. Choose a row to take!`;
        statusText.className = 'status-text highlight';
        
        // Highlight rows
        $$('.table-row').forEach((rowEl) => {
          rowEl.classList.add('selectable', 'highlight-choice');
          rowEl.onclick = () => {
            const rowIndex = parseInt(rowEl.dataset.row);
            socket.emit('row-chosen', { rowIndex });
            choosingRow = false;
            tableArea.classList.remove('dimmed');
            $$('.table-row').forEach(r => {
              r.classList.remove('selectable', 'highlight-choice');
              r.onclick = null;
            });
            statusText.textContent = 'Resolving...';
          };
        });
      } else {
        statusText.textContent = `${data.nickname} must choose a row to take...`;
        statusText.className = 'status-text';
        tableArea.classList.add('dimmed');
        // keep the chooser's rows locked out for other players
      }
    }
    else if (data.type === 'turn-end') {
      if (gameState) {
        gameState.scores = data.scores;
        gameState.turn = data.turn;
      }
      turnNumber.textContent = data.turn;
      revealArea.style.display = 'none';
      revealArea.innerHTML = '';
      logEvent(`--- Turn ${data.turn - 1} ended ---`);
    }
    else if (data.type === 'round-end') {
      handleRoundEnd(data);
    }
    else if (data.type === 'game-over') {
      handleGameOver(data);
    }
  }

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

  // Clears the board UI once all cards of a round have been played
  function clearAfterRound(message) {
    revealArea.style.display = 'none';
    revealArea.innerHTML = '';
    confirmArea.style.display = 'none';
    renderHand([]);
    statusText.textContent = message;
    statusText.className = 'status-text highlight';
    scoreboardOverlay.classList.remove('active');
  }

  function handleRoundEnd(data) {
    if (gameState) {
      gameState.scores = data.scores;
      gameState.state = 'ROUND_END';
      gameState.round = data.round;
      gameState.maxRounds = data.maxRounds;
    }
    clearAfterRound(`Round ${data.round} complete!`);

    const thisRound = data.scores.map(s => ({ ...s, r: s.roundScores[data.round - 1] }));
    const best = Math.min(...thisRound.map(s => s.r));
    const roundWinners = thisRound.filter(s => s.r === best)
      .map(s => (s.id === myPlayerId ? 'You' : s.nickname));
    roundendWinner.textContent = `⭐ Best this round: ${roundWinners.join(', ')} (${best} 🌶️)`;

    roundendTitle.textContent = `Round ${data.round} of ${data.maxRounds} Complete!`;
    renderRoundProgress(data.round, data.maxRounds);
    renderInto(roundendTableWrap, buildRoundTable(data.scores, { maxRounds: data.maxRounds }));

    const remaining = data.maxRounds - data.round;
    btnNextRound.textContent = `▶ Next Round (${data.round + 1}/${data.maxRounds})`;
    btnNextRound.title = `${remaining} round${remaining === 1 ? '' : 's'} left`;
    btnNextRound.disabled = false;
    updateRoundEndActions();

    roundendOverlay.classList.add('active');
  }

  function handleGameOver(data) {
    if (gameState) {
      gameState.scores = data.scores;
      gameState.state = 'GAME_OVER';
    }
    clearAfterRound('Match over!');
    roundendOverlay.classList.remove('active');

    const sorted = [...data.scores].sort((a, b) => a.totalPenalty - b.totalPenalty);
    const best = sorted[0].totalPenalty;
    const winners = sorted.filter(s => s.totalPenalty === best).map(s => s.nickname);
    winnerName.textContent = winners.length > 1
      ? `🤝 Tie: ${winners.join(' & ')} with ${best} 🌶️!`
      : `🎉 ${winners[0]} wins with ${best} 🌶️!`;

    const played = data.round;
    gameoverSubtitle.textContent = played < data.maxRounds
      ? `Finished early after ${played} of ${data.maxRounds} rounds`
      : `After all ${played} rounds`;

    renderInto(gameoverTableWrap, buildRoundTable(data.scores, { maxRounds: data.maxRounds }));

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
    roundendOverlay.classList.remove('active');
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
