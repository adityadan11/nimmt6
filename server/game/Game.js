// Game.js — Core 6 Nimmt! game engine
const { Card, createDeck, shuffleDeck } = require('./Card');

const STATES = {
  DEALING: 'DEALING',
  SELECTING: 'SELECTING',
  REVEALING: 'REVEALING',
  RESOLVING: 'RESOLVING',
  CHOOSING_ROW: 'CHOOSING_ROW',
  ROUND_END: 'ROUND_END',
  GAME_OVER: 'GAME_OVER',
};

class Game {
  constructor(players, { maxRounds = 10 } = {}) {
    // players: [{ id, nickname }]
    this.players = players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      hand: [],
      penalty: 0,        // penalty in the current round
      totalPenalty: 0,   // penalty across all rounds of the match
      roundScores: [],   // penalty of each completed round
      hasPlayed: false,
      selectedCard: null,
    }));
    this.rows = [[], [], [], []]; // 4 rows
    this.state = STATES.DEALING;
    this.turn = 0;          // turn index within the current round (0-based)
    this.totalTurns = 10;   // one turn per card in hand
    this.round = 0;         // current round number (1-based once dealt)
    this.maxRounds = maxRounds;
    this.pendingPlays = []; // cards played this turn, sorted
    this.currentResolveIndex = 0;
    this.waitingForChoice = null; // playerId waiting to choose a row
  }

  // Deal 10 cards to each player and set up 4 starting rows (starts a new round)
  deal() {
    const deck = shuffleDeck(createDeck());
    let idx = 0;

    // Deal 10 cards to each player
    for (const player of this.players) {
      player.hand = deck.slice(idx, idx + 10).sort((a, b) => a.number - b.number);
      player.penalty = 0;
      player.hasPlayed = false;
      player.selectedCard = null;
      idx += 10;
    }

    // Set up 4 starting row cards
    for (let r = 0; r < 4; r++) {
      this.rows[r] = [deck[idx++]];
    }

    // Sort rows by starting card number for cleaner display
    this.rows.sort((a, b) => a[0].number - b[0].number);

    this.round++;
    this.turn = 0;
    this.state = STATES.SELECTING;
    this.pendingPlays = [];
    this.currentResolveIndex = 0;
    this.waitingForChoice = null;
  }

  // Start the next round of the match (keeps cumulative scores)
  nextRound() {
    if (this.state !== STATES.ROUND_END) return { error: 'Round is not finished yet' };
    if (this.round >= this.maxRounds) return { error: 'Maximum number of rounds reached' };
    this.deal();
    return { success: true };
  }

  // End the match early after a completed round
  finishMatch() {
    if (this.state !== STATES.ROUND_END) return { error: 'Round is not finished yet' };
    this.state = STATES.GAME_OVER;
    return this._gameOverPayload();
  }

  // Get a player's current state (private hand + public info)
  getPlayerState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    return {
      hand: player ? player.hand.map(c => c.toJSON()) : [],
      rows: this.rows.map(row => row.map(c => c.toJSON())),
      turn: this.turn + 1,
      totalTurns: this.totalTurns,
      round: this.round,
      maxRounds: this.maxRounds,
      state: this.state,
      scores: this.getScores(),
      players: this.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        hasPlayed: p.hasPlayed,
        penalty: p.penalty,
        totalPenalty: p.totalPenalty,
      })),
    };
  }

  getScores() {
    return this.players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      penalty: p.penalty,
      totalPenalty: p.totalPenalty,
      roundScores: [...p.roundScores],
    }));
  }

  // Player selects a card to play
  playCard(playerId, cardNumber) {
    if (this.state !== STATES.SELECTING) return { error: 'Not in selecting phase' };

    const player = this.players.find(p => p.id === playerId);
    if (!player) return { error: 'Player not found' };
    if (player.hasPlayed) return { error: 'Already played this round' };

    const cardIndex = player.hand.findIndex(c => c.number === cardNumber);
    if (cardIndex === -1) return { error: 'Card not in hand' };

    player.selectedCard = player.hand.splice(cardIndex, 1)[0];
    player.hasPlayed = true;

    return { success: true, allPlayed: this.players.every(p => p.hasPlayed) };
  }

  // Reveal all played cards (sorted ascending)
  revealCards() {
    this.state = STATES.REVEALING;
    this.pendingPlays = this.players
      .map(p => ({ playerId: p.id, nickname: p.nickname, card: p.selectedCard }))
      .sort((a, b) => a.card.number - b.card.number);
    this.currentResolveIndex = 0;
    return this.pendingPlays.map(p => ({
      playerId: p.playerId,
      nickname: p.nickname,
      card: p.card.toJSON(),
    }));
  }

  // Resolve the next card placement
  resolveNext() {
    if (this.currentResolveIndex >= this.pendingPlays.length) {
      return this._endTurn();
    }

    this.state = STATES.RESOLVING;
    const play = this.pendingPlays[this.currentResolveIndex];
    const card = play.card;

    // Find which row this card fits into (closest lower ending card)
    let bestRow = -1;
    let bestDiff = Infinity;

    for (let r = 0; r < 4; r++) {
      const rowEnd = this.rows[r][this.rows[r].length - 1].number;
      if (card.number > rowEnd) {
        const diff = card.number - rowEnd;
        if (diff < bestDiff) {
          bestDiff = diff;
          bestRow = r;
        }
      }
    }

    if (bestRow === -1) {
      // Card is lower than all row-ending cards — player must choose a row
      this.state = STATES.CHOOSING_ROW;
      this.waitingForChoice = play.playerId;
      return {
        type: 'choose-row',
        playerId: play.playerId,
        nickname: play.nickname,
        card: card.toJSON(),
      };
    }

    return this._placeCard(play, bestRow);
  }

  // Player chooses a row (when card is lower than all)
  chooseRow(playerId, rowIndex) {
    if (this.state !== STATES.CHOOSING_ROW) return { error: 'Not choosing a row' };
    if (this.waitingForChoice !== playerId) return { error: 'Not your turn to choose' };
    if (rowIndex < 0 || rowIndex > 3) return { error: 'Invalid row index' };

    const play = this.pendingPlays[this.currentResolveIndex];
    this.waitingForChoice = null;

    return this._takeRowAndPlace(play, rowIndex);
  }

  // Internal: place a card on a row
  _placeCard(play, rowIndex) {
    const row = this.rows[rowIndex];

    if (row.length >= 5) {
      // 6th card — player takes the row
      return this._takeRowAndPlace(play, rowIndex);
    }

    // Add card to row
    row.push(play.card);
    this.currentResolveIndex++;

    return {
      type: 'card-placed',
      playerId: play.playerId,
      nickname: play.nickname,
      card: play.card.toJSON(),
      rowIndex,
      rows: this.rows.map(r => r.map(c => c.toJSON())),
    };
  }

  // Internal: take a row, add penalty, start row with new card
  _takeRowAndPlace(play, rowIndex) {
    const takenCards = [...this.rows[rowIndex]];
    const penalty = takenCards.reduce((sum, c) => sum + c.bullHeads, 0);

    const player = this.players.find(p => p.id === play.playerId);
    player.penalty += penalty;
    player.totalPenalty += penalty;

    // Replace row with the played card
    this.rows[rowIndex] = [play.card];
    this.currentResolveIndex++;

    return {
      type: 'row-taken',
      playerId: play.playerId,
      nickname: play.nickname,
      card: play.card.toJSON(),
      rowIndex,
      takenCards: takenCards.map(c => c.toJSON()),
      penalty,
      roundPenalty: player.penalty,
      totalPenalty: player.totalPenalty,
      rows: this.rows.map(r => r.map(c => c.toJSON())),
    };
  }

  // Internal: end the current turn
  _endTurn() {
    this.turn++;

    // Reset for next turn
    for (const player of this.players) {
      player.hasPlayed = false;
      player.selectedCard = null;
    }
    this.pendingPlays = [];
    this.currentResolveIndex = 0;

    if (this.turn >= this.totalTurns) {
      // All 10 cards played — the round is over. Record each player's round score.
      for (const player of this.players) {
        player.roundScores.push(player.penalty);
      }

      if (this.round >= this.maxRounds) {
        this.state = STATES.GAME_OVER;
        return this._gameOverPayload();
      }

      this.state = STATES.ROUND_END;
      return {
        type: 'round-end',
        round: this.round,
        maxRounds: this.maxRounds,
        scores: this.getScores(),
      };
    }

    this.state = STATES.SELECTING;
    return {
      type: 'turn-end',
      turn: this.turn + 1,
      scores: this.getScores(),
    };
  }

  _gameOverPayload() {
    return {
      type: 'game-over',
      round: this.round,
      maxRounds: this.maxRounds,
      scores: this.getScores(),
    };
  }

  isGameOver() {
    return this.state === STATES.GAME_OVER;
  }
}

module.exports = { Game, STATES };
