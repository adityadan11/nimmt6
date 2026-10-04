// Card.js — Card data with bull head values
class Card {
  constructor(number) {
    this.number = number;
    this.bullHeads = Card.getBullHeads(number);
  }

  static getBullHeads(number) {
    if (number === 55) return 7;
    if (number % 11 === 0) return 5;
    if (number % 10 === 0) return 3;
    if (number % 5 === 0) return 2;
    return 1;
  }

  toJSON() {
    return { number: this.number, bullHeads: this.bullHeads };
  }
}

// Generate a full deck of 104 cards
function createDeck() {
  const deck = [];
  for (let i = 1; i <= 104; i++) {
    deck.push(new Card(i));
  }
  return deck;
}

// Fisher-Yates shuffle
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

module.exports = { Card, createDeck, shuffleDeck };
