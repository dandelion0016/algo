import { describe, it, expect } from 'vitest';
import {
  createDeck,
  compareCards,
  sortCards,
  dealInitialCards,
  isAllOpen,
  checkAttack,
} from '../algoEngine';
import { Card } from '../../types/game';
import { decideCpuAttack, getPossibleNumbersForTarget } from '../cpuAI';

describe('algoEngine', () => {
  it('creates full 24-card deck (12 black, 12 white, 0-11)', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(24);

    const blackCards = deck.filter((c) => c.color === 'black');
    const whiteCards = deck.filter((c) => c.color === 'white');
    expect(blackCards).toHaveLength(12);
    expect(whiteCards).toHaveLength(12);

    for (let i = 0; i <= 11; i++) {
      expect(blackCards.some((c) => c.number === i)).toBe(true);
      expect(whiteCards.some((c) => c.number === i)).toBe(true);
    }
  });

  it('correctly compares cards with black < white for equal numbers', () => {
    const b3: Card = { id: 'b-3', color: 'black', number: 3, isOpen: false };
    const w3: Card = { id: 'w-3', color: 'white', number: 3, isOpen: false };
    const b4: Card = { id: 'b-4', color: 'black', number: 4, isOpen: false };

    expect(compareCards(b3, w3)).toBeLessThan(0); // b3 < w3
    expect(compareCards(w3, b3)).toBeGreaterThan(0); // w3 > b3
    expect(compareCards(w3, b4)).toBeLessThan(0); // w3 < b4
  });

  it('sorts hand cards strictly in ascending order with black before white on tie', () => {
    const cards: Card[] = [
      { id: 'w-7', color: 'white', number: 7, isOpen: false },
      { id: 'b-3', color: 'black', number: 3, isOpen: false },
      { id: 'w-3', color: 'white', number: 3, isOpen: false },
      { id: 'b-0', color: 'black', number: 0, isOpen: false },
    ];

    const sorted = sortCards(cards);
    expect(sorted.map((c) => `${c.color[0]}${c.number}`)).toEqual(['b0', 'b3', 'w3', 'w7']);
  });

  it('deals 4 cards to player and CPU, leaving 16 in deck', () => {
    const deck = createDeck();
    const { playerCards, cpuCards, remainingDeck } = dealInitialCards(deck);

    expect(playerCards).toHaveLength(4);
    expect(cpuCards).toHaveLength(4);
    expect(remainingDeck).toHaveLength(16);

    // 両者ソートされているか
    for (let i = 0; i < 3; i++) {
      expect(compareCards(playerCards[i], playerCards[i + 1])).toBeLessThan(0);
      expect(compareCards(cpuCards[i], cpuCards[i + 1])).toBeLessThan(0);
    }
  });

  it('detects when all cards are open', () => {
    const cards: Card[] = [
      { id: 'b-1', color: 'black', number: 1, isOpen: true },
      { id: 'w-2', color: 'white', number: 2, isOpen: true },
    ];
    expect(isAllOpen(cards)).toBe(true);

    cards[0].isOpen = false;
    expect(isAllOpen(cards)).toBe(false);
  });

  it('validates attack accurately', () => {
    const target: Card = { id: 'b-5', color: 'black', number: 5, isOpen: false };
    expect(checkAttack(target, 5)).toBe(true);
    expect(checkAttack(target, 4)).toBe(false);
  });
});

describe('cpuAI', () => {
  it('bounds candidate numbers between open neighbors', () => {
    const playerHand: Card[] = [
      { id: 'b-2', color: 'black', number: 2, isOpen: true },
      { id: 'w-?', color: 'white', number: 5, isOpen: false }, // target index 1
      { id: 'b-8', color: 'black', number: 8, isOpen: true },
    ];

    const unknownCards = [
      { color: 'white' as const, number: 1 },
      { color: 'white' as const, number: 3 },
      { color: 'white' as const, number: 5 },
      { color: 'white' as const, number: 9 },
    ];

    const candidates = getPossibleNumbersForTarget(1, playerHand, unknownCards);
    // w1 is less than b2 -> invalid
    // w3 and w5 are between b2 and b8 -> valid
    // w9 is greater than b8 -> invalid
    expect(candidates).toEqual([3, 5]);
  });

  it('decides an attack with valid target and number', () => {
    const playerHand: Card[] = [
      { id: 'b-1', color: 'black', number: 1, isOpen: false },
      { id: 'w-4', color: 'white', number: 4, isOpen: true },
    ];
    const cpuHand: Card[] = [
      { id: 'b-8', color: 'black', number: 8, isOpen: false },
    ];

    const decision = decideCpuAttack(playerHand, cpuHand, null, 'hard');
    expect(decision.targetIndex).toBe(0);
    expect(decision.guessedNumber).toBeGreaterThanOrEqual(0);
    expect(decision.guessedNumber).toBeLessThanOrEqual(11);
  });
});
