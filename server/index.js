// server/index.js — Express + Socket.IO server for 6 Nimmt!
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { GameManager } = require('./game/GameManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const gm = new GameManager();

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Cleanup stale rooms every 30 minutes
setInterval(() => gm.cleanup(), 30 * 60 * 1000);

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── CREATE ROOM ──
  socket.on('create-room', ({ nickname }) => {
    if (!nickname || nickname.trim().length === 0) {
      return socket.emit('error-msg', { message: 'Nickname is required' });
    }

    const room = gm.createRoom(socket.id, nickname.trim());
    socket.join(room.code);
    socket.emit('room-created', {
      roomCode: room.code,
      playerId: socket.id,
      players: room.getPublicState().players,
      hostId: room.hostId,
    });
    console.log(`[ROOM] Created ${room.code} by ${nickname}`);
  });

  // ── JOIN ROOM ──
  socket.on('join-room', ({ roomCode, nickname }) => {
    if (!nickname || nickname.trim().length === 0) {
      return socket.emit('error-msg', { message: 'Nickname is required' });
    }
    if (!roomCode || roomCode.trim().length === 0) {
      return socket.emit('error-msg', { message: 'Room code is required' });
    }

    const result = gm.joinRoom(roomCode.trim(), socket.id, nickname.trim());
    if (result.error) {
      return socket.emit('error-msg', { message: result.error });
    }

    const room = result.room;
    socket.join(room.code);

    socket.emit('room-joined', {
      roomCode: room.code,
      playerId: socket.id,
      nickname: result.nickname,
      players: room.getPublicState().players,
      hostId: room.hostId,
    });

    // Broadcast to others
    socket.to(room.code).emit('player-joined', {
      playerId: socket.id,
      nickname: result.nickname,
      players: room.getPublicState().players,
      hostId: room.hostId,
    });

    console.log(`[ROOM] ${result.nickname} joined ${room.code}`);
  });

  // ── START GAME ──
  socket.on('start-game', () => {
    const room = gm.getRoomByPlayer(socket.id);
    if (!room) return socket.emit('error-msg', { message: 'Not in a room' });
    if (room.hostId !== socket.id) return socket.emit('error-msg', { message: 'Only host can start' });

    const result = room.startGame();
    if (result.error) return socket.emit('error-msg', { message: result.error });

    // Send each player their private hand + public game state
    for (const player of room.players) {
      const state = room.game.getPlayerState(player.id);
      io.to(player.id).emit('game-started', state);
    }

    console.log(`[GAME] Started in room ${room.code}`);
  });

  // ── PLAY CARD ──
  socket.on('play-card', ({ cardNumber }) => {
    const room = gm.getRoomByPlayer(socket.id);
    if (!room || !room.game) return socket.emit('error-msg', { message: 'No active game' });

    const result = room.game.playCard(socket.id, cardNumber);
    if (result.error) return socket.emit('error-msg', { message: result.error });

    // Confirm to the player
    socket.emit('card-confirmed', { cardNumber });

    // Broadcast that this player has played (without revealing which card)
    socket.to(room.code).emit('player-played', { playerId: socket.id });

    // If all players have played, reveal and start resolving
    if (result.allPlayed) {
      const revealed = room.game.revealCards();

      io.to(room.code).emit('all-cards-revealed', { plays: revealed });

      // Start resolving after a delay to let animations play
      setTimeout(() => resolveNextCard(room), 1500);
    }
  });

  // ── CHOOSE ROW ──
  socket.on('row-chosen', ({ rowIndex }) => {
    const room = gm.getRoomByPlayer(socket.id);
    if (!room || !room.game) return socket.emit('error-msg', { message: 'No active game' });

    const result = room.game.chooseRow(socket.id, rowIndex);
    if (result.error) return socket.emit('error-msg', { message: result.error });

    io.to(room.code).emit('row-taken', result);

    // Continue resolving
    setTimeout(() => resolveNextCard(room), 1200);
  });

  // ── RESTART GAME ──
  socket.on('restart-game', () => {
    const room = gm.getRoomByPlayer(socket.id);
    if (!room) return socket.emit('error-msg', { message: 'Not in a room' });
    if (room.hostId !== socket.id) return socket.emit('error-msg', { message: 'Only host can restart' });

    const result = room.restartGame();
    if (result.error) return socket.emit('error-msg', { message: result.error });

    for (const player of room.players) {
      const state = room.game.getPlayerState(player.id);
      io.to(player.id).emit('game-started', state);
    }

    console.log(`[GAME] Restarted in room ${room.code}`);
  });

  // ── BACK TO LOBBY ──
  socket.on('back-to-lobby', () => {
    const room = gm.getRoomByPlayer(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit('error-msg', { message: 'Only host can return to lobby' });

    room.endGame();
    io.to(room.code).emit('returned-to-lobby', room.getPublicState());
    console.log(`[ROOM] Returned to lobby: ${room.code}`);
  });

  // ── DISCONNECT ──
  socket.on('disconnect', () => {
    const result = gm.removePlayer(socket.id);
    if (result && !result.roomClosed) {
      io.to(result.code).emit('player-left', {
        playerId: socket.id,
        players: result.room.getPublicState().players,
        hostId: result.room.hostId,
      });
    }
    console.log(`[-] Disconnected: ${socket.id}`);
  });
});

// Resolve card placements one at a time
function resolveNextCard(room) {
  if (!room.game) return;

  const result = room.game.resolveNext();
  if (!result) return;

  if (result.type === 'choose-row') {
    // Notify all players that someone needs to choose a row
    io.to(room.code).emit('choose-row', {
      playerId: result.playerId,
      nickname: result.nickname,
      card: result.card,
    });
    // The choosing player will emit 'row-chosen' which continues the chain
    return;
  }

  if (result.type === 'card-placed') {
    io.to(room.code).emit('card-placed', result);
    setTimeout(() => resolveNextCard(room), 800);
    return;
  }

  if (result.type === 'row-taken') {
    io.to(room.code).emit('row-taken', result);
    setTimeout(() => resolveNextCard(room), 1200);
    return;
  }

  if (result.type === 'turn-end') {
    io.to(room.code).emit('turn-end', result);
    // Send updated hands
    for (const player of room.players) {
      const state = room.game.getPlayerState(player.id);
      io.to(player.id).emit('hand-update', { hand: state.hand });
    }
    return;
  }

  if (result.type === 'game-over') {
    io.to(room.code).emit('game-over', result);
    return;
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌶️ 6 Nimmt! server running on http://localhost:${PORT}`);
});
