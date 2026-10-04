// GameManager.js — Manages all active rooms
const { Room } = require('./Room');

class GameManager {
  constructor() {
    this.rooms = new Map(); // code -> Room
    this.playerRooms = new Map(); // socketId -> roomCode
  }

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let code;
    do {
      code = '';
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostId, hostNickname) {
    const code = this.generateCode();
    const room = new Room(code, hostId, hostNickname);
    this.rooms.set(code, room);
    this.playerRooms.set(hostId, code);
    return room;
  }

  joinRoom(code, playerId, nickname) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { error: 'Room not found' };

    const result = room.addPlayer(playerId, nickname);
    if (result.error) return result;

    this.playerRooms.set(playerId, code.toUpperCase());
    return { success: true, room, nickname: result.nickname };
  }

  getRoom(code) {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomByPlayer(playerId) {
    const code = this.playerRooms.get(playerId);
    if (!code) return null;
    return this.rooms.get(code);
  }

  removePlayer(playerId) {
    const code = this.playerRooms.get(playerId);
    if (!code) return null;

    const room = this.rooms.get(code);
    if (!room) {
      this.playerRooms.delete(playerId);
      return null;
    }

    const remaining = room.removePlayer(playerId);
    this.playerRooms.delete(playerId);

    if (remaining === 0) {
      this.rooms.delete(code);
      return { roomClosed: true, code };
    }

    return { roomClosed: false, code, room };
  }

  // Cleanup stale rooms (older than 2 hours with no game)
  cleanup() {
    const now = Date.now();
    const twoHours = 2 * 60 * 60 * 1000;
    for (const [code, room] of this.rooms) {
      if (!room.inGame && now - room.createdAt > twoHours) {
        // Remove all player mappings
        for (const player of room.players) {
          this.playerRooms.delete(player.id);
        }
        this.rooms.delete(code);
      }
    }
  }
}

module.exports = { GameManager };
