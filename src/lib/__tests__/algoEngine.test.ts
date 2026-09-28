import { describe, it, expect } from 'vitest';
import {
  createDeck,
  compareCards,
  sortCards,
  setupGamePlayers,
  getInitialCardCount,
  isAllOpen,
  checkAttack,
  getNextActivePlayerIndex,
} from '../algoEngine';
import { Card } from '../../types/game';
import { decideMultiCpuAttack, getPossibleNumbersForTarget } from '../cpuAI';

describe('algoEngine multi-player', () => {
  it('handles 2, 3, 4 player initial card counts correctly according to official algo rules', () => {
    expect(getInitialCardCount(2)).toBe(4);
    expect(getInitialCardCount(3)).toBe(3);
    expect(getInitialCardCount(4)).toBe(2);
  });

  it('sets up 3 players with 3 cards each and 15 cards in remaining deck', () => {
    const deck = createDeck();
    const { players, remainingDeck } = setupGamePlayers(deck, 3);

    expect(players).toHaveLength(3);
    expect(players[0].cards).toHaveLength(3);
    expect(players[1].cards).toHaveLength(3);
    expect(players[2].cards).toHaveLength(3);
    expect(remainingDeck).toHaveLength(15); // 24 - 9 = 15
  });

  it('sets up 4 players with 2 cards each and 16 cards in remaining deck', () => {
    const deck = createDeck();
    const { players, remainingDeck } = setupGamePlayers(deck, 4);

    expect(players).toHaveLength(4);
    expect(players[0].cards).toHaveLength(2);
    expect(players[1].cards).toHaveLength(2);
    expect(players[2].cards).toHaveLength(2);
    expect(players[3].cards).toHaveLength(2);
    expect(remainingDeck).toHaveLength(16); // 24 - 8 = 16
  });

  it('skips eliminated players when getting next active player', () => {
    const deck = createDeck();
    const { players } = setupGamePlayers(deck, 3);
    players[1].isEliminated = true; // CPU 1 eliminated

    const next = getNextActivePlayerIndex(0, players);
    expect(next).toBe(2); // Skips player 1, goes to player 2
  });

  it('correctly compares cards with black < white for equal numbers', () => {
    const b3: Card = { id: 'b-3', color: 'black', number: 3, isOpen: false };
    const w3: Card = { id: 'w-3', color: 'white', number: 3, isOpen: false };
    expect(compareCards(b3, w3)).toBeLessThan(0);
    expect(compareCards(w3, b3)).toBeGreaterThan(0);
  });
});

describe('cpuAI multi-player', () => {
  it('decides an attack on valid opponent in multi-player setup', () => {
    const deck = createDeck();
    const { players } = setupGamePlayers(deck, 3);

    const decision = decideMultiCpuAttack(players[1], null, players, 'hard');
    expect(decision.targetPlayerId).toBeTruthy();
    expect(decision.targetPlayerId).not.toBe(players[1].id); // cannot target itself
    expect(decision.guessedNumber).toBeGreaterThanOrEqual(0);
    expect(decision.guessedNumber).toBeLessThanOrEqual(11);
  });
});
