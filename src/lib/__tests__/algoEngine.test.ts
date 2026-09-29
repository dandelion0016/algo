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
  maskCardForPlayer,
} from '../algoEngine';
import { Card, PublicCard, SecretCard, Player } from '../../types/game';
import { decideMultiCpuAttack, decideMultiCpuContinue, getPossibleNumbersForTarget } from '../cpuAI';

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

  it('assigns custom humanPlayerId to human player in setupGamePlayers', () => {
    const deck = createDeck();
    const customId = 'usr_test1234';
    const { players } = setupGamePlayers(deck, 2, customId);

    expect(players[0].id).toBe(customId);
    expect(players[0].isHuman).toBe(true);
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
