// Room.js — Manages a single game room
const { Game } = require('./Game');

class Room {
  constructor(code, hostId, hostNickname) {
    this.code = code;
    this.hostId = hostId;
    this.players = [{ id: hostId, nickname: hostNickname }];
    this.game = null;
    this.inGame = false;
    this.createdAt = Date.now();
  }

  addPlayer(id, nickname) {
    if (this.players.length >= 10) return { error: 'Room is full (max 10 players)' };
    if (this.inGame) return { error: 'Game already in progress' };
    if (this.players.find(p => p.id === id)) return { error: 'Already in room' };

    // Check for duplicate nickname
    let finalNickname = nickname;
    const existingNames = this.players.map(p => p.nickname);
    let counter = 2;
    while (existingNames.includes(finalNickname)) {
      finalNickname = `${nickname} (${counter++})`;
    }

    this.players.push({ id, nickname: finalNickname });
    return { success: true, nickname: finalNickname };
  }

  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id);

    // If host left, assign new host
    if (id === this.hostId && this.players.length > 0) {
      this.hostId = this.players[0].id;
    }

    return this.players.length;
  }

  startGame() {
    if (this.players.length < 2) return { error: 'Need at least 2 players' };
    if (this.inGame) return { error: 'Game already in progress' };

    this.game = new Game(this.players);
    this.game.deal();
    this.inGame = true;
    return { success: true };
  }

  restartGame() {
    if (!this.inGame) return { error: 'No game to restart' };
    this.game = new Game(this.players);
    this.game.deal();
    return { success: true };
  }

  endGame() {
    this.game = null;
    this.inGame = false;
  }

  getPublicState() {
    return {
      code: this.code,
      hostId: this.hostId,
      players: this.players.map(p => ({ id: p.id, nickname: p.nickname })),
      inGame: this.inGame,
    };
  }
}

module.exports = { Room };
