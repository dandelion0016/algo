import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAvailableUnknownCardsMulti,
  getPossibleNumbersForTarget,
  decideMultiCpuAttack,
  decideMultiCpuContinue,
} from '../cpuAI';
import { Card, CardColor, Player, AttackLog } from '../../types/game';

describe('cpuAI', () => {
  const createPlayer = (
    id: string,
    isHuman: boolean,
    cards: Card[],
    isEliminated = false
  ): Player => ({
    id,
    name: id,
    isHuman,
    cards,
    isEliminated,
    avatarColor: '',
  });

  describe('getAvailableUnknownCardsMulti', () => {
    it('excludes CPU hand, drawn card, and opponents open cards', () => {
      const cpuPlayer = createPlayer('cpu-1', false, [
        { id: 'b-1', color: 'black', number: 1, isOpen: false },
        { id: 'w-3', color: 'white', number: 3, isOpen: false },
      ]);

      const cpuDrawnCard: Card = { id: 'b-7', color: 'black', number: 7, isOpen: false };

      const opponent1 = createPlayer('player-1', true, [
        { id: 'b-4', color: 'black', number: 4, isOpen: true }, // open -> known
        { id: 'w-5', color: 'white', number: 5, isOpen: false }, // hidden -> unknown
      ]);

      const opponent2 = createPlayer('cpu-2', false, [
        { id: 'w-8', color: 'white', number: 8, isOpen: true }, // open -> known
        { id: 'b-11', color: 'black', number: 11, isOpen: false }, // hidden -> unknown
      ]);

      const allPlayers = [cpuPlayer, opponent1, opponent2];
      const unknownCards = getAvailableUnknownCardsMulti(cpuPlayer, cpuDrawnCard, allPlayers);

      // Known: b-1, w-3 (CPU hand), b-7 (drawn), b-4, w-8 (open) = 5 cards known
      // Unknown: 24 - 5 = 19 cards
      expect(unknownCards).toHaveLength(19);

      // Known cards must NOT be in unknown list
      const knownKeys = ['black-1', 'white-3', 'black-7', 'black-4', 'white-8'];
      for (const key of knownKeys) {
        const [c, n] = key.split('-');
        const found = unknownCards.some((card) => card.color === c && card.number === Number(n));
        expect(found).toBe(false);
      }

      // Opponents' hidden cards MUST be in unknown list
      expect(unknownCards.some((c) => c.color === 'white' && c.number === 5)).toBe(true);
      expect(unknownCards.some((c) => c.color === 'black' && c.number === 11)).toBe(true);
    });

    it('works correctly when drawn card is null', () => {
      const cpuPlayer = createPlayer('cpu-1', false, [
        { id: 'b-0', color: 'black', number: 0, isOpen: false },
      ]);
      const unknownCards = getAvailableUnknownCardsMulti(cpuPlayer, null, [cpuPlayer]);

      // Only b-0 is known, remaining 23 are unknown
      expect(unknownCards).toHaveLength(23);
      expect(unknownCards.some((c) => c.color === 'black' && c.number === 0)).toBe(false);
    });

    it('returns empty array when all 24 cards are known', () => {
      const allCards: Card[] = [];
      for (const color of ['black', 'white'] as CardColor[]) {
        for (let num = 0; num <= 11; num++) {
          allCards.push({
            id: `${color[0]}-${num}`,
            color,
            number: num,
            isOpen: true,
          });
        }
      }
      const playerWithAll = createPlayer('all', false, allCards);
      const unknownCards = getAvailableUnknownCardsMulti(playerWithAll, null, [playerWithAll]);
      expect(unknownCards).toEqual([]);
    });
  });

  describe('getPossibleNumbersForTarget', () => {
    const fullUnknownPool: { color: CardColor; number: number }[] = [];
    for (const color of ['black', 'white'] as CardColor[]) {
      for (let num = 0; num <= 11; num++) {
        fullUnknownPool.push({ color, number: num });
      }
    }

    it('returns empty array if target card is already open', () => {
      const targetHand: Card[] = [
        { id: 'b-2', color: 'black', number: 2, isOpen: true },
      ];
      const result = getPossibleNumbersForTarget(0, targetHand, fullUnknownPool);
      expect(result).toEqual([]);
    });

    it('filters numbers by card color when no bounds are present', () => {
      const targetHand: Card[] = [
        { id: 'b-5', color: 'black', number: 5, isOpen: false },
      ];
      const result = getPossibleNumbersForTarget(0, targetHand, fullUnknownPool);
      // All 0-11 for black
      expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    describe('boundary narrowing with adjacent open cards', () => {
      it('narrows lower bound based on left open card (same color)', () => {
        const targetHand: Card[] = [
          { id: 'b-4', color: 'black', number: 4, isOpen: true }, // left bound
          { id: 'b-?', color: 'black', number: 7, isOpen: false }, // target
        ];
        const result = getPossibleNumbersForTarget(1, targetHand, fullUnknownPool);
        // Left is black 4. For black candidate n, compareCards(b-4, b-n) < 0 => n > 4 (5..11)
        expect(result).toEqual([5, 6, 7, 8, 9, 10, 11]);
      });

      it('narrows lower bound based on left open card with black < white equal number boundary', () => {
        const targetHand: Card[] = [
          { id: 'b-4', color: 'black', number: 4, isOpen: true }, // left bound: black 4
          { id: 'w-?', color: 'white', number: 4, isOpen: false }, // target: white
        ];
        const result = getPossibleNumbersForTarget(1, targetHand, fullUnknownPool);
        // Left is black 4. For white candidate n, compareCards(b-4, w-n) < 0.
        // For n=4: compareCards(b-4, w-4) === -1 < 0, so 4 is valid! (4..11)
        expect(result).toContain(4);
        expect(result).not.toContain(3);
        expect(result).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
      });

      it('narrows upper bound based on right open card (same color)', () => {
        const targetHand: Card[] = [
          { id: 'w-?', color: 'white', number: 5, isOpen: false }, // target
          { id: 'w-8', color: 'white', number: 8, isOpen: true }, // right bound: white 8
        ];
        const result = getPossibleNumbersForTarget(0, targetHand, fullUnknownPool);
        // Right is white 8. For white candidate n, compareCards(w-n, w-8) < 0 => n < 8 (0..7)
        expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      });

      it('narrows upper bound based on right open card with black < white equal number boundary', () => {
        const targetHand: Card[] = [
          { id: 'b-?', color: 'black', number: 8, isOpen: false }, // target: black
          { id: 'w-8', color: 'white', number: 8, isOpen: true }, // right bound: white 8
        ];
        const result = getPossibleNumbersForTarget(0, targetHand, fullUnknownPool);
        // Right is white 8. For black candidate n:
        // For n=8: compareCards(b-8, w-8) === -1 < 0, so 8 is valid! (0..8)
        expect(result).toContain(8);
        expect(result).not.toContain(9);
        expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      });

      it('narrows both lower and upper bounds simultaneously when flanked by open cards', () => {
        const targetHand: Card[] = [
          { id: 'b-3', color: 'black', number: 3, isOpen: true }, // left bound
          { id: 'b-?', color: 'black', number: 5, isOpen: false }, // target (black)
          { id: 'w-7', color: 'white', number: 7, isOpen: true }, // right bound
        ];
        const result = getPossibleNumbersForTarget(1, targetHand, fullUnknownPool);
        // Left is black 3 => black cand must be > 3 (4..)
        // Right is white 7 => black cand must have compareCards(b-n, w-7) < 0 => n <= 7 (..7)
        // Candidates: 4, 5, 6, 7
        expect(result).toEqual([4, 5, 6, 7]);
      });

      it('skips adjacent closed cards to find nearest open cards', () => {
        const targetHand: Card[] = [
          { id: 'b-1', color: 'black', number: 1, isOpen: true }, // open lower bound
          { id: 'w-3', color: 'white', number: 3, isOpen: false }, // closed (skip)
          { id: 'b-?', color: 'black', number: 4, isOpen: false }, // target index 2
          { id: 'w-6', color: 'white', number: 6, isOpen: false }, // closed (skip)
          { id: 'b-9', color: 'black', number: 9, isOpen: true }, // open upper bound
        ];
        const result = getPossibleNumbersForTarget(2, targetHand, fullUnknownPool);
        // Left open is b-1 => black cand > 1 (2..)
        // Right open is b-9 => black cand < 9 (..8)
        expect(result).toEqual([2, 3, 4, 5, 6, 7, 8]);
      });
    });

    describe('past failed attack logs elimination (Hard AI)', () => {
      it('eliminates failed guess numbers from candidates for the specific target card', () => {
        const targetHand: Card[] = [
          { id: 'b-3', color: 'black', number: 3, isOpen: true },
          { id: 'b-?', color: 'black', number: 6, isOpen: false }, // index 1
        ];
        // Candidates before log: 4, 5, 6, 7, 8, 9, 10, 11

        const logs: AttackLog[] = [
          {
            id: 'log-1',
            attackerId: 'cpu-1',
            attackerName: 'CPU',
            targetPlayerId: 'opp-1',
            targetPlayerName: 'Opponent',
            targetCardIndex: 1,
            targetColor: 'black',
            guessedNumber: 4,
            isHit: false, // missed 4
            timestamp: 100,
            message: 'Missed',
          },
          {
            id: 'log-2',
            attackerId: 'cpu-1',
            attackerName: 'CPU',
            targetPlayerId: 'opp-1',
            targetPlayerName: 'Opponent',
            targetCardIndex: 1,
            targetColor: 'black',
            guessedNumber: 5,
            isHit: false, // missed 5
            timestamp: 200,
            message: 'Missed',
          },
        ];

        const result = getPossibleNumbersForTarget(
          1,
          targetHand,
          fullUnknownPool,
          logs,
          'opp-1'
        );

        // 4 and 5 must be eliminated
        expect(result).not.toContain(4);
        expect(result).not.toContain(5);
        expect(result).toEqual([6, 7, 8, 9, 10, 11]);
      });

      it('does NOT eliminate hit logs, logs for other cards, or logs for other players', () => {
        const targetHand: Card[] = [
          { id: 'b-?', color: 'black', number: 5, isOpen: false }, // index 0
          { id: 'b-?', color: 'black', number: 8, isOpen: false }, // index 1
        ];

        const logs: AttackLog[] = [
          {
            id: 'log-1',
            attackerId: 'cpu-1',
            attackerName: 'CPU',
            targetPlayerId: 'opp-1',
            targetPlayerName: 'Opponent',
            targetCardIndex: 0, // different index
            targetColor: 'black',
            guessedNumber: 5,
            isHit: false,
            timestamp: 100,
            message: 'Missed card 0',
          },
          {
            id: 'log-2',
            attackerId: 'cpu-1',
            attackerName: 'CPU',
            targetPlayerId: 'opp-2', // different player
            targetPlayerName: 'Opponent 2',
            targetCardIndex: 1,
            targetColor: 'black',
            guessedNumber: 7,
            isHit: false,
            timestamp: 101,
            message: 'Missed opp-2',
          },
          {
            id: 'log-3',
            attackerId: 'cpu-1',
            attackerName: 'CPU',
            targetPlayerId: 'opp-1',
            targetPlayerName: 'Opponent',
            targetCardIndex: 1,
            targetColor: 'black',
            guessedNumber: 6,
            isHit: true, // HIT log (not failure)
            timestamp: 102,
            message: 'Hit',
          },
        ];

        const result = getPossibleNumbersForTarget(
          1,
          targetHand,
          fullUnknownPool,
          logs,
          'opp-1'
        );

        // Neither 5, 7, nor 6 should be eliminated from card index 1 for opp-1
        expect(result).toContain(5);
        expect(result).toContain(6);
        expect(result).toContain(7);
      });
    });
  });

  describe('decideMultiCpuAttack', () => {
    it('returns empty fallback if there are no eligible opponents', () => {
      const cpu = createPlayer('cpu-1', false, []);
      const decision = decideMultiCpuAttack(cpu, null, [cpu], 'normal');
      expect(decision).toEqual({ targetPlayerId: '', targetCardIndex: 0, guessedNumber: 0 });
    });

    describe('Easy difficulty', () => {
      it('picks a random target card and guesses a random valid candidate', () => {
        const cpu = createPlayer('cpu-1', false, [
          { id: 'b-0', color: 'black', number: 0, isOpen: true },
        ]);
        const opponent = createPlayer('human', true, [
          { id: 'w-5', color: 'white', number: 5, isOpen: false },
        ]);

        const decision = decideMultiCpuAttack(cpu, null, [cpu, opponent], 'easy');

        expect(decision.targetPlayerId).toBe('human');
        expect(decision.targetCardIndex).toBe(0);
        expect(decision.guessedNumber).toBeGreaterThanOrEqual(0);
        expect(decision.guessedNumber).toBeLessThanOrEqual(11);
      });
    });

    describe('Hard difficulty', () => {
      it('prioritizes a confirmed target card (only 1 candidate) above all others', () => {
        const cpu = createPlayer('cpu-1', false, [
          { id: 'b-0', color: 'black', number: 0, isOpen: true },
        ]);

        // Opponent with 2 cards:
        // index 0: black card between black 0 (CPU) and white 2 (open) -> candidates [1] (CONFIRMED!)
        // index 1: white 2 (open)
        // index 2: white card after white 2 -> candidates [3..11] (9 candidates)
        const opponent = createPlayer('opp-1', true, [
          { id: 'b-1', color: 'black', number: 1, isOpen: false }, // index 0 (will have 1 candidate)
          { id: 'w-2', color: 'white', number: 2, isOpen: true }, // index 1 (open bound)
          { id: 'w-5', color: 'white', number: 5, isOpen: false }, // index 2 (multiple candidates)
        ]);

        // Known cards: CPU has b-0, opp has w-2.
        // For opp card 0 (black): upper bound is w-2 => compareCards(b-n, w-2) < 0 => n <= 2 (0, 1, 2)
        // CPU has b-0, so unknown black cards <= 2 are b-1 and b-2.
        // If we also give CPU b-2, then only b-1 remains -> candidates: [1]!
        cpu.cards.push({ id: 'b-2', color: 'black', number: 2, isOpen: true });

        const decision = decideMultiCpuAttack(cpu, null, [cpu, opponent], 'hard');

        // Confirmed card MUST be chosen
        expect(decision.targetPlayerId).toBe('opp-1');
        expect(decision.targetCardIndex).toBe(0);
        expect(decision.guessedNumber).toBe(1);
      });

      it('selects the median candidate when no single-candidate card exists', () => {
        const cpu = createPlayer('cpu-1', false, []);
        // Opponent hand: left bound b-2 (open), target b-? (closed), right bound b-8 (open)
        // Candidate pool for target: [3, 4, 5, 6, 7] (length 5)
        // Median index: Math.floor(5 / 2) = 2 => candidate 5
        const opponent = createPlayer('opp-1', true, [
          { id: 'b-2', color: 'black', number: 2, isOpen: true },
          { id: 'b-6', color: 'black', number: 6, isOpen: false },
          { id: 'b-8', color: 'black', number: 8, isOpen: true },
        ]);

        const decision = decideMultiCpuAttack(cpu, null, [cpu, opponent], 'hard');

        expect(decision.targetPlayerId).toBe('opp-1');
        expect(decision.targetCardIndex).toBe(1);
        expect(decision.guessedNumber).toBe(5);
      });

      it('applies past failed logs to narrow down candidates in Hard difficulty', () => {
        const cpu = createPlayer('cpu-1', false, []);
        // Opponent: b-1 (open), target b-? (closed), b-4 (open)
        // Initial candidates: [2, 3]
        const opponent = createPlayer('opp-1', true, [
          { id: 'b-1', color: 'black', number: 1, isOpen: true },
          { id: 'b-3', color: 'black', number: 3, isOpen: false },
          { id: 'b-4', color: 'black', number: 4, isOpen: true },
        ]);

        // Prior miss on 2 => eliminates 2, leaving [3] as confirmed
        const logs: AttackLog[] = [
          {
            id: 'log-1',
            attackerId: 'cpu-1',
            attackerName: 'CPU',
            targetPlayerId: 'opp-1',
            targetPlayerName: 'Opponent',
            targetCardIndex: 1,
            targetColor: 'black',
            guessedNumber: 2,
            isHit: false,
            timestamp: 100,
            message: 'Missed 2',
          },
        ];

        const decision = decideMultiCpuAttack(cpu, null, [cpu, opponent], 'hard', logs);

        expect(decision.targetPlayerId).toBe('opp-1');
        expect(decision.targetCardIndex).toBe(1);
        expect(decision.guessedNumber).toBe(3);
      });
    });
  });

  describe('decideMultiCpuContinue', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns false if no active opponents exist', () => {
      const cpu = createPlayer('cpu-1', false, []);
      expect(decideMultiCpuContinue(cpu, null, [cpu], 'hard')).toBe(false);
    });

    describe('Easy difficulty', () => {
      it('continues when random > 0.6 and stays when random <= 0.6', () => {
        const cpu = createPlayer('cpu-1', false, []);
        const opponent = createPlayer('opp', true, [
          { id: 'w-5', color: 'white', number: 5, isOpen: false },
        ]);

        vi.spyOn(Math, 'random').mockReturnValue(0.65);
        expect(decideMultiCpuContinue(cpu, null, [cpu, opponent], 'easy')).toBe(true);

        vi.spyOn(Math, 'random').mockReturnValue(0.55);
        expect(decideMultiCpuContinue(cpu, null, [cpu, opponent], 'easy')).toBe(false);
      });
    });

    describe('Normal difficulty', () => {
      it('always continues (100%) when a confirmed card (candidates length === 1) exists', () => {
        // CPU has b-0 and b-2. Opponent has b-? and w-2 (open). Candidate for b-? is only [1].
        const cpu = createPlayer('cpu-1', false, [
          { id: 'b-0', color: 'black', number: 0, isOpen: true },
          { id: 'b-2', color: 'black', number: 2, isOpen: true },
        ]);
        const opponent = createPlayer('opp', true, [
          { id: 'b-1', color: 'black', number: 1, isOpen: false },
          { id: 'w-2', color: 'white', number: 2, isOpen: true },
        ]);

        // Even if random is high (which would normally stay), it continues
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        expect(decideMultiCpuContinue(cpu, null, [cpu, opponent], 'normal')).toBe(true);
      });

      it('uses 25% random threshold when no confirmed card exists', () => {
        const cpu = createPlayer('cpu-1', false, []);
        const opponent = createPlayer('opp', true, [
          { id: 'w-5', color: 'white', number: 5, isOpen: false },
        ]);

        vi.spyOn(Math, 'random').mockReturnValue(0.20); // < 0.25 -> true
        expect(decideMultiCpuContinue(cpu, null, [cpu, opponent], 'normal')).toBe(true);

        vi.spyOn(Math, 'random').mockReturnValue(0.30); // >= 0.25 -> false
        expect(decideMultiCpuContinue(cpu, null, [cpu, opponent], 'normal')).toBe(false);
      });
    });

    describe('Hard difficulty', () => {
      it('continues when a card with <= 2 candidates exists (aggressive continuation)', () => {
        // CPU has b-0 and b-3. Opponent has b-? and w-3 (open). Candidates for b-?: [1, 2] (length 2)
        const cpu = createPlayer('cpu-1', false, [
          { id: 'b-0', color: 'black', number: 0, isOpen: true },
          { id: 'b-3', color: 'black', number: 3, isOpen: true },
        ]);
        const opponent = createPlayer('opp', true, [
          { id: 'b-1', color: 'black', number: 1, isOpen: false },
          { id: 'w-3', color: 'white', number: 3, isOpen: true },
        ]);

        expect(decideMultiCpuContinue(cpu, null, [cpu, opponent], 'hard')).toBe(true);
      });

      it('stays (returns false) when all cards have 3 or more candidates (risk management)', () => {
        const cpu = createPlayer('cpu-1', false, []);
        // Opponent has wide range: candidates are 0..11 (12 candidates)
        const opponent = createPlayer('opp', true, [
          { id: 'w-5', color: 'white', number: 5, isOpen: false },
        ]);

        expect(decideMultiCpuContinue(cpu, null, [cpu, opponent], 'hard')).toBe(false);
      });
    });
  });
});
