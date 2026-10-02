import { describe, it, expect } from 'vitest';
import {
  createDeck,
  shuffleDeck,
  compareCards,
  sortCards,
  insertCardInOrder,
  getInitialCardCount,
  setupGamePlayers,
  isAllOpen,
  checkAttack,
  getNextActivePlayerIndex,
  maskCardForPlayer,
} from '../algoEngine';
import { Card, Player, PublicCard, SecretCard } from '../../types/game';
import { decideMultiCpuAttack, decideMultiCpuContinue } from '../cpuAI';

describe('algoEngine', () => {
  describe('createDeck', () => {
    it('creates exactly 24 cards: black 0-11 and white 0-11', () => {
      const deck = createDeck();
      expect(deck).toHaveLength(24);

      const blackCards = deck.filter((c) => c.color === 'black');
      const whiteCards = deck.filter((c) => c.color === 'white');

      expect(blackCards).toHaveLength(12);
      expect(whiteCards).toHaveLength(12);

      // Verify numbers 0-11 exist without duplicates
      const blackNumbers = blackCards.map((c) => c.number).sort((a, b) => a - b);
      const whiteNumbers = whiteCards.map((c) => c.number).sort((a, b) => a - b);
      const expected = Array.from({ length: 12 }, (_, i) => i);

      expect(blackNumbers).toEqual(expected);
      expect(whiteNumbers).toEqual(expected);

      // Verify IDs and isOpen: false for all cards
      deck.forEach((card) => {
        expect(card.id).toBe(`${card.color[0]}-${card.number}`);
        expect(card.isOpen).toBe(false);
      });

      // Verify unique IDs
      const idSet = new Set(deck.map((c) => c.id));
      expect(idSet.size).toBe(24);
    });
  });

  describe('shuffleDeck', () => {
    it('returns a new array containing the same 24 cards', () => {
      const deck = createDeck();
      const shuffled = shuffleDeck(deck);

      expect(shuffled).toHaveLength(24);
      expect(shuffled).not.toBe(deck);

      const originalIds = new Set(deck.map((c) => c.id));
      shuffled.forEach((c) => {
        expect(originalIds.has(c.id)).toBe(true);
      });
    });

    it('does not return an identity copy (order differs from initial deck)', () => {
      const deck = createDeck();
      const shuffled = shuffleDeck(deck);

      // Verify that the shuffled deck is not identical to the original order
      const originalIds = deck.map((c) => c.id);
      const shuffledIds = shuffled.map((c) => c.id);
      expect(shuffledIds).not.toEqual(originalIds);

      // Most cards should change position (fixed points in a 24-element shuffle are typically <= 5)
      let samePositionCount = 0;
      for (let i = 0; i < deck.length; i++) {
        if (deck[i].id === shuffled[i].id) {
          samePositionCount++;
        }
      }
      expect(samePositionCount).toBeLessThan(10);
    });

    it('generates diverse permutations and uniform distribution across multiple shuffles', () => {
      const deck = createDeck();
      const iterations = 100;
      const seenPermutations = new Set<string>();
      const firstCardOccurrences: Record<string, number> = {};

      for (let i = 0; i < iterations; i++) {
        const shuffled = shuffleDeck(deck);
        const orderKey = shuffled.map((c) => c.id).join(',');
        seenPermutations.add(orderKey);

        const firstCardId = shuffled[0].id;
        firstCardOccurrences[firstCardId] = (firstCardOccurrences[firstCardId] || 0) + 1;
      }

      // 100 shuffles of 24 cards should produce 100 unique permutations (24! is ~6.2e23)
      expect(seenPermutations.size).toBe(iterations);

      // The first card should vary across multiple different cards (not always the same card or fixed subset)
      const uniqueFirstCards = Object.keys(firstCardOccurrences);
      expect(uniqueFirstCards.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('compareCards', () => {
    it('returns 0 for identical cards', () => {
      const c1: Card = { id: 'b-5', color: 'black', number: 5, isOpen: false };
      const c2: Card = { id: 'b-5', color: 'black', number: 5, isOpen: false };
      expect(compareCards(c1, c2)).toBe(0);
    });

    it('orders by number ascending regardless of color', () => {
      const b2: Card = { id: 'b-2', color: 'black', number: 2, isOpen: false };
      const w5: Card = { id: 'w-5', color: 'white', number: 5, isOpen: false };
      expect(compareCards(b2, w5)).toBeLessThan(0);
      expect(compareCards(w5, b2)).toBeGreaterThan(0);

      const w2: Card = { id: 'w-2', color: 'white', number: 2, isOpen: false };
      const b5: Card = { id: 'b-5', color: 'black', number: 5, isOpen: false };
      expect(compareCards(w2, b5)).toBeLessThan(0);
      expect(compareCards(b5, w2)).toBeGreaterThan(0);
    });

    it('orders black before white for equal numbers across all 0-11 values', () => {
      for (let n = 0; n <= 11; n++) {
        const blackCard: Card = { id: `b-${n}`, color: 'black', number: n, isOpen: false };
        const whiteCard: Card = { id: `w-${n}`, color: 'white', number: n, isOpen: false };

        expect(compareCards(blackCard, whiteCard)).toBe(-1);
        expect(compareCards(whiteCard, blackCard)).toBe(1);
      }
    });

    it('handles boundary comparisons: 0 vs 11, min and max values', () => {
      const b0: Card = { id: 'b-0', color: 'black', number: 0, isOpen: false };
      const w0: Card = { id: 'w-0', color: 'white', number: 0, isOpen: false };
      const b11: Card = { id: 'b-11', color: 'black', number: 11, isOpen: false };
      const w11: Card = { id: 'w-11', color: 'white', number: 11, isOpen: false };

      expect(compareCards(b0, w0)).toBe(-1);
      expect(compareCards(w0, b11)).toBeLessThan(0);
      expect(compareCards(b11, w11)).toBe(-1);
      expect(compareCards(w11, b0)).toBeGreaterThan(0);
    });
  });

  describe('sortCards', () => {
    it('correctly sorts arbitrary unsorted cards in algo order', () => {
      const unsorted: Card[] = [
        { id: 'w-7', color: 'white', number: 7, isOpen: false },
        { id: 'b-7', color: 'black', number: 7, isOpen: false },
        { id: 'w-0', color: 'white', number: 0, isOpen: false },
        { id: 'b-11', color: 'black', number: 11, isOpen: false },
        { id: 'b-0', color: 'black', number: 0, isOpen: false },
      ];

      const sorted = sortCards(unsorted);
      expect(sorted.map((c) => c.id)).toEqual(['b-0', 'w-0', 'b-7', 'w-7', 'b-11']);
      expect(unsorted[0].id).toBe('w-7');
    });
  });

  describe('insertCardInOrder', () => {
    const baseHand: Card[] = [
      { id: 'b-2', color: 'black', number: 2, isOpen: false },
      { id: 'w-4', color: 'white', number: 4, isOpen: false },
      { id: 'b-7', color: 'black', number: 7, isOpen: false },
    ];

    it('inserts at the start when card is smaller than all existing', () => {
      const newCard: Card = { id: 'b-0', color: 'black', number: 0, isOpen: false };
      const result = insertCardInOrder(baseHand, newCard);

      expect(result).toHaveLength(4);
      expect(result.map((c) => c.id)).toEqual(['b-0', 'b-2', 'w-4', 'b-7']);
      expect(baseHand).toHaveLength(3);
    });

    it('inserts at the end when card is larger than all existing', () => {
      const newCard: Card = { id: 'w-10', color: 'white', number: 10, isOpen: false };
      const result = insertCardInOrder(baseHand, newCard);

      expect(result).toHaveLength(4);
      expect(result.map((c) => c.id)).toEqual(['b-2', 'w-4', 'b-7', 'w-10']);
    });

    it('inserts in the middle preserving correct order', () => {
      const newCard: Card = { id: 'b-5', color: 'black', number: 5, isOpen: false };
      const result = insertCardInOrder(baseHand, newCard);

      expect(result.map((c) => c.id)).toEqual(['b-2', 'w-4', 'b-5', 'b-7']);
    });

    it('inserts white after black for equal numbers', () => {
      const newCard: Card = { id: 'w-2', color: 'white', number: 2, isOpen: false };
      const result = insertCardInOrder(baseHand, newCard);

      expect(result.map((c) => c.id)).toEqual(['b-2', 'w-2', 'w-4', 'b-7']);
    });

    it('inserts black before white for equal numbers', () => {
      const newCard: Card = { id: 'b-4', color: 'black', number: 4, isOpen: false };
      const result = insertCardInOrder(baseHand, newCard);

      expect(result.map((c) => c.id)).toEqual(['b-2', 'b-4', 'w-4', 'b-7']);
    });
  });

  describe('getInitialCardCount', () => {
    it('returns 4 cards for 2 players', () => {
      expect(getInitialCardCount(2)).toBe(4);
    });

    it('returns 3 cards for 3 players', () => {
      expect(getInitialCardCount(3)).toBe(3);
    });

    it('returns 3 cards for 4 players (official algo 4-player rules)', () => {
      expect(getInitialCardCount(4)).toBe(3);
    });
  });

  describe('setupGamePlayers', () => {
    it('sets up 2 players with 4 cards each and 16 remaining deck cards', () => {
      const deck = createDeck();
      const { players, remainingDeck } = setupGamePlayers(deck, 2);

      expect(players).toHaveLength(2);
      expect(players[0].cards).toHaveLength(4);
      expect(players[1].cards).toHaveLength(4);
      expect(remainingDeck).toHaveLength(16); // 24 - (2 * 4) = 16

      const totalCards = players.reduce((sum, p) => sum + p.cards.length, 0) + remainingDeck.length;
      expect(totalCards).toBe(24);
    });

    it('sets up 3 players with 3 cards each and 15 remaining deck cards', () => {
      const deck = createDeck();
      const { players, remainingDeck } = setupGamePlayers(deck, 3);

      expect(players).toHaveLength(3);
      expect(players[0].cards).toHaveLength(3);
      expect(players[1].cards).toHaveLength(3);
      expect(players[2].cards).toHaveLength(3);
      expect(remainingDeck).toHaveLength(15); // 24 - (3 * 3) = 15

      const totalCards = players.reduce((sum, p) => sum + p.cards.length, 0) + remainingDeck.length;
      expect(totalCards).toBe(24);
    });

    it('sets up 4 players with 3 cards each and 12 remaining deck cards', () => {
      const deck = createDeck();
      const { players, remainingDeck } = setupGamePlayers(deck, 4);

      expect(players).toHaveLength(4);
      expect(players[0].cards).toHaveLength(3);
      expect(players[1].cards).toHaveLength(3);
      expect(players[2].cards).toHaveLength(3);
      expect(players[3].cards).toHaveLength(3);
      expect(remainingDeck).toHaveLength(12); // 24 - (4 * 3) = 12

      const totalCards = players.reduce((sum, p) => sum + p.cards.length, 0) + remainingDeck.length;
      expect(totalCards).toBe(24);
    });

    it('ensures each player hand is sorted in ascending algo order and closed', () => {
      const deck = createDeck();
      const { players } = setupGamePlayers(deck, 3);

      for (const p of players) {
        expect(p.isEliminated).toBe(false);
        for (let i = 0; i < p.cards.length - 1; i++) {
          expect(compareCards(p.cards[i], p.cards[i + 1])).toBeLessThan(0);
        }
        for (const card of p.cards) {
          expect(card.isOpen).toBe(false);
        }
      }
    });

    it('ensures no duplicate cards across all players and remaining deck', () => {
      const deck = createDeck();
      const { players, remainingDeck } = setupGamePlayers(deck, 4);

      const allIds = [
        ...players.flatMap((p) => p.cards.map((c) => c.id)),
        ...remainingDeck.map((c) => c.id),
      ];

      expect(allIds).toHaveLength(24);
      expect(new Set(allIds).size).toBe(24);
    });

    it('assigns custom humanPlayerId and default player properties correctly', () => {
      const deck = createDeck();
      const customId = 'usr_custom_999';
      const { players } = setupGamePlayers(deck, 3, customId);

      expect(players[0].id).toBe(customId);
      expect(players[0].name).toBe('あなた');
      expect(players[0].isHuman).toBe(true);

      expect(players[1].id).toBe('cpu-1');
      expect(players[1].name).toBe('CPU アル');
      expect(players[1].isHuman).toBe(false);

      expect(players[2].id).toBe('cpu-2');
      expect(players[2].name).toBe('CPU ゴオ');
      expect(players[2].isHuman).toBe(false);
    });
  });

  describe('isAllOpen', () => {
    it('returns true when all cards are open', () => {
      const cards: Card[] = [
        { id: 'b-1', color: 'black', number: 1, isOpen: true },
        { id: 'w-3', color: 'white', number: 3, isOpen: true },
      ];
      expect(isAllOpen(cards)).toBe(true);
    });

    it('returns false when at least one card is closed', () => {
      const cards: Card[] = [
        { id: 'b-1', color: 'black', number: 1, isOpen: true },
        { id: 'w-3', color: 'white', number: 3, isOpen: false },
      ];
      expect(isAllOpen(cards)).toBe(false);
    });

    it('returns false when all cards are closed', () => {
      const cards: Card[] = [
        { id: 'b-1', color: 'black', number: 1, isOpen: false },
        { id: 'w-3', color: 'white', number: 3, isOpen: false },
      ];
      expect(isAllOpen(cards)).toBe(false);
    });

    it('returns true for an empty card array (vacuously true)', () => {
      expect(isAllOpen([])).toBe(true);
    });
  });

  describe('checkAttack', () => {
    it('returns true if guessed number matches the card number', () => {
      const target: Card = { id: 'b-7', color: 'black', number: 7, isOpen: false };
      expect(checkAttack(target, 7)).toBe(true);
    });

    it('returns false if guessed number does not match', () => {
      const target: Card = { id: 'b-7', color: 'black', number: 7, isOpen: false };
      expect(checkAttack(target, 6)).toBe(false);
      expect(checkAttack(target, 8)).toBe(false);
    });
  });

  describe('getNextActivePlayerIndex', () => {
    const makePlayer = (id: string, isEliminated: boolean): Player => ({
      id,
      name: id,
      isHuman: id === 'player',
      cards: [],
      isEliminated,
      avatarColor: '',
    });

    describe('2-player game', () => {
      it('cycles normally when no one is eliminated', () => {
        const players = [makePlayer('p0', false), makePlayer('p1', false)];
        expect(getNextActivePlayerIndex(0, players)).toBe(1);
        expect(getNextActivePlayerIndex(1, players)).toBe(0);
      });

      it('returns self if opponent is eliminated', () => {
        const players = [makePlayer('p0', false), makePlayer('p1', true)];
        expect(getNextActivePlayerIndex(0, players)).toBe(0);
      });
    });

    describe('3-player game', () => {
      it('cycles 0 -> 1 -> 2 -> 0 when all active', () => {
        const players = [makePlayer('p0', false), makePlayer('p1', false), makePlayer('p2', false)];
        expect(getNextActivePlayerIndex(0, players)).toBe(1);
        expect(getNextActivePlayerIndex(1, players)).toBe(2);
        expect(getNextActivePlayerIndex(2, players)).toBe(0);
      });

      it('skips single eliminated player in middle: 0 -> 2', () => {
        const players = [makePlayer('p0', false), makePlayer('p1', true), makePlayer('p2', false)];
        expect(getNextActivePlayerIndex(0, players)).toBe(2);
        expect(getNextActivePlayerIndex(2, players)).toBe(0);
      });

      it('skips last eliminated player: 1 -> 0', () => {
        const players = [makePlayer('p0', false), makePlayer('p1', false), makePlayer('p2', true)];
        expect(getNextActivePlayerIndex(1, players)).toBe(0);
      });

      it('returns surviving player when other two are eliminated', () => {
        const players = [makePlayer('p0', true), makePlayer('p1', false), makePlayer('p2', true)];
        expect(getNextActivePlayerIndex(1, players)).toBe(1);
      });
    });

    describe('4-player game', () => {
      it('cycles 0 -> 1 -> 2 -> 3 -> 0 when all active', () => {
        const players = [
          makePlayer('p0', false),
          makePlayer('p1', false),
          makePlayer('p2', false),
          makePlayer('p3', false),
        ];
        expect(getNextActivePlayerIndex(0, players)).toBe(1);
        expect(getNextActivePlayerIndex(1, players)).toBe(2);
        expect(getNextActivePlayerIndex(2, players)).toBe(3);
        expect(getNextActivePlayerIndex(3, players)).toBe(0);
      });

      it('skips multiple consecutively eliminated players: 0 -> 3 (1 & 2 eliminated)', () => {
        const players = [
          makePlayer('p0', false),
          makePlayer('p1', true),
          makePlayer('p2', true),
          makePlayer('p3', false),
        ];
        expect(getNextActivePlayerIndex(0, players)).toBe(3);
        expect(getNextActivePlayerIndex(3, players)).toBe(0);
      });

      it('cycles across wrap-around with eliminated player at index 0', () => {
        const players = [
          makePlayer('p0', true),
          makePlayer('p1', false),
          makePlayer('p2', false),
          makePlayer('p3', false),
        ];
        expect(getNextActivePlayerIndex(3, players)).toBe(1);
      });
    });
  });

  describe('maskCardForPlayer (Information Hiding)', () => {
    const secretCard: SecretCard = {
      id: 'b-7',
      color: 'black',
      number: 7,
      isOpen: false,
    };

    it('masks number to null for opponent hidden card', () => {
      const masked: PublicCard = maskCardForPlayer(secretCard, false);
      expect(masked.number).toBeNull();
      expect(masked.id).toBe('b-7');
      expect(masked.color).toBe('black');
      expect(masked.isOpen).toBe(false);
    });

    it('preserves number for own hidden card', () => {
      const ownCard: PublicCard = maskCardForPlayer(secretCard, true);
      expect(ownCard.number).toBe(7);
      expect(ownCard.id).toBe('b-7');
      expect(ownCard.color).toBe('black');
      expect(ownCard.isOpen).toBe(false);
    });

    it('preserves number for opponent open card', () => {
      const openCard: SecretCard = { ...secretCard, isOpen: true };
      const masked: PublicCard = maskCardForPlayer(openCard, false);
      expect(masked.number).toBe(7);
      expect(masked.id).toBe('b-7');
      expect(masked.color).toBe('black');
      expect(masked.isOpen).toBe(true);
    });

    it('preserves number for own open card', () => {
      const openCard: SecretCard = { ...secretCard, isOpen: true };
      const masked: PublicCard = maskCardForPlayer(openCard, true);
      expect(masked.number).toBe(7);
      expect(masked.isOpen).toBe(true);
    });
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

  describe('decideMultiCpuContinue (Hit Continuation Decision)', () => {
    it('returns false when all opponents are eliminated', () => {
      const deck = createDeck();
      const { players } = setupGamePlayers(deck, 2);
      players[0].isEliminated = true;

      const shouldContinue = decideMultiCpuContinue(players[1], null, players, 'hard');
      expect(shouldContinue).toBe(false);
    });

    it('returns false when opponent has no hidden cards left', () => {
      const deck = createDeck();
      const { players } = setupGamePlayers(deck, 2);
      players[0].cards.forEach((c) => {
        c.isOpen = true;
      });

      const shouldContinue = decideMultiCpuContinue(players[1], null, players, 'hard');
      expect(shouldContinue).toBe(false);
    });

    it('returns true when a guaranteed card (1 candidate) exists in normal/hard', () => {
      // プレイヤー0の手札を [b-0 (open), b-1 (hidden), b-2 (open)] に設定
      // b-1 の候補は 1 のみ（確定マス）
      const opponent: Player = {
        id: 'usr_p0',
        name: 'Player 0',
        isHuman: true,
        isEliminated: false,
        avatarColor: '',
        cards: [
          { id: 'b-0', color: 'black', number: 0, isOpen: true },
          { id: 'b-1', color: 'black', number: 1, isOpen: false },
          { id: 'b-2', color: 'black', number: 2, isOpen: true },
        ],
      };
      const cpu: Player = {
        id: 'cpu_1',
        name: 'CPU 1',
        isHuman: false,
        isEliminated: false,
        avatarColor: '',
        cards: [{ id: 'w-10', color: 'white', number: 10, isOpen: false }],
      };

      const shouldContinueHard = decideMultiCpuContinue(cpu, null, [opponent, cpu], 'hard');
      expect(shouldContinueHard).toBe(true);

      const shouldContinueNormal = decideMultiCpuContinue(cpu, null, [opponent, cpu], 'normal');
      expect(shouldContinueNormal).toBe(true);
    });
  });
});
