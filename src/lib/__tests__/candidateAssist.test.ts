import { describe, it, expect } from 'vitest';
import {
  getMinStepBetween,
  getMinStepTotal,
  getKnownNumbersForColor,
  getPossibleNumbersForCard,
  formatCandidateRange,
  getFailedNumbersForCard,
  formatFailedNumbersBadge,
} from '../candidateAssist';
import { Card, Player, AttackLog } from '../../types/game';

describe('candidateAssist', () => {
  describe('getMinStepBetween & getMinStepTotal', () => {
    it('黒から白への隣接は同数が可能なので最小ステップは0', () => {
      expect(getMinStepBetween('black', 'white')).toBe(0);
    });

    it('黒から黒、白から白、白から黒への隣接は最小ステップが1', () => {
      expect(getMinStepBetween('black', 'black')).toBe(1);
      expect(getMinStepBetween('white', 'white')).toBe(1);
      expect(getMinStepBetween('white', 'black')).toBe(1);
    });

    it('getMinStepTotal が手札列の最小増分を正しく累積する', () => {
      // black -> white -> black -> white
      // steps: (b->w)=0, (w->b)=1, (b->w)=0 => total 1
      const hand = [
        { color: 'black' as const },
        { color: 'white' as const },
        { color: 'black' as const },
        { color: 'white' as const },
      ];
      expect(getMinStepTotal(hand, 0, 3)).toBe(1);
      expect(getMinStepTotal(hand, 1, 2)).toBe(1);
      expect(getMinStepTotal(hand, 0, 1)).toBe(0);
      expect(getMinStepTotal(hand, 2, 2)).toBe(0);
    });
  });

  describe('getKnownNumbersForColor', () => {
    it('プレイヤー手札・他者オープン・ドローカードから同色の数字を漏れなく抽出する', () => {
      const players: Player[] = [
        {
          id: 'player',
          name: 'あなた',
          isHuman: true,
          isEliminated: false,
          avatarColor: '',
          cards: [
            { id: 'b-2', color: 'black', number: 2, isOpen: false },
            { id: 'w-5', color: 'white', number: 5, isOpen: false },
          ],
        },
        {
          id: 'cpu-1',
          name: 'CPU 1',
          isHuman: false,
          isEliminated: false,
          avatarColor: '',
          cards: [
            { id: 'b-7', color: 'black', number: 7, isOpen: true },
            { id: 'b-9', color: 'black', number: 9, isOpen: false }, // 伏せは抽出されない
            { id: 'w-8', color: 'white', number: 8, isOpen: true },
          ],
        },
      ];

      const drawnCard: Card = { id: 'b-4', color: 'black', number: 4, isOpen: false };

      const knownBlack = getKnownNumbersForColor('black', players, drawnCard);
      expect(knownBlack).toEqual([2, 4, 7]);

      const knownWhite = getKnownNumbersForColor('white', players, drawnCard);
      expect(knownWhite).toEqual([5, 8]);
    });
  });

  describe('getPossibleNumbersForCard', () => {
    it('左右にオープンカードがない場合の端点制約（伏せカードの枚数間隔）', () => {
      // 相手手札: [黒?, 黒?, 黒?] (すべて伏せ)
      // インデックス0 (黒): 0..9 (右に2枚黒があるので 11-2=9 が上限)
      // インデックス1 (黒): 1..10
      // インデックス2 (黒): 2..11 (左に2枚黒があるので 0+2=2 が下限)
      const targetHand = [
        { id: 'b-?', color: 'black' as const, number: null, isOpen: false },
        { id: 'b-?', color: 'black' as const, number: null, isOpen: false },
        { id: 'b-?', color: 'black' as const, number: null, isOpen: false },
      ];

      const cands0 = getPossibleNumbersForCard({ targetIndex: 0, targetHand });
      expect(cands0[0]).toBe(0);
      expect(cands0[cands0.length - 1]).toBe(9);

      const cands1 = getPossibleNumbersForCard({ targetIndex: 1, targetHand });
      expect(cands1[0]).toBe(1);
      expect(cands1[cands1.length - 1]).toBe(10);

      const cands2 = getPossibleNumbersForCard({ targetIndex: 2, targetHand });
      expect(cands2[0]).toBe(2);
      expect(cands2[cands2.length - 1]).toBe(11);
    });

    it('同色オープンカードによる下限・上限の狭まり', () => {
      // 手札: [黒3(OPEN), 黒?, 黒8(OPEN)]
      // 対象: 1番目（黒?）
      // 下限: 3 + 1 = 4
      // 上限: 8 - 1 = 7
      // 候補: [4, 5, 6, 7]
      const targetHand = [
        { id: 'b-3', color: 'black' as const, number: 3, isOpen: true },
        { id: 'b-?', color: 'black' as const, number: null, isOpen: false },
        { id: 'b-8', color: 'black' as const, number: 8, isOpen: true },
      ];

      const candidates = getPossibleNumbersForCard({ targetIndex: 1, targetHand });
      expect(candidates).toEqual([4, 5, 6, 7]);
    });

    it('黒から白（同数可能）および白から黒（同数不可）のルール考慮', () => {
      // パターンA: [黒4(OPEN), 白?]
      // 黒 -> 白 なので同数可能 => 白は 4 以上 11 以下
      const handA = [
        { id: 'b-4', color: 'black' as const, number: 4, isOpen: true },
        { id: 'w-?', color: 'white' as const, number: null, isOpen: false },
      ];
      const candsA = getPossibleNumbersForCard({ targetIndex: 1, targetHand: handA });
      expect(candsA[0]).toBe(4);

      // パターンB: [白4(OPEN), 黒?]
      // 白 -> 黒 なので同数不可 => 黒は 5 以上 11 以下
      const handB = [
        { id: 'w-4', color: 'white' as const, number: 4, isOpen: true },
        { id: 'b-?', color: 'black' as const, number: null, isOpen: false },
      ];
      const candsB = getPossibleNumbersForCard({ targetIndex: 1, targetHand: handB });
      expect(candsB[0]).toBe(5);

      // パターンC: [黒?, 白4(OPEN)]
      // 黒 -> 白 なので同数可能 => 黒は 4 以下 (0..4)
      const handC = [
        { id: 'b-?', color: 'black' as const, number: null, isOpen: false },
        { id: 'w-4', color: 'white' as const, number: 4, isOpen: true },
      ];
      const candsC = getPossibleNumbersForCard({ targetIndex: 0, targetHand: handC });
      expect(candsC[candsC.length - 1]).toBe(4);

      // パターンD: [白?, 黒4(OPEN)]
      // 白 -> 黒 なので同数不可 => 白は 3 以下 (0..3)
      const handD = [
        { id: 'w-?', color: 'white' as const, number: null, isOpen: false },
        { id: 'b-4', color: 'black' as const, number: 4, isOpen: true },
      ];
      const candsD = getPossibleNumbersForCard({ targetIndex: 0, targetHand: handD });
      expect(candsD[candsD.length - 1]).toBe(3);
    });

    it('既知カード（手札やオープンカード）が候補から正しく除外される', () => {
      // 手札: [黒2(OPEN), 黒?, 黒7(OPEN)] => 候補 [3, 4, 5, 6]
      // 自分の手札に 黒4、ドローカードに 黒5 がある場合 => 候補は [3, 6]
      const targetHand = [
        { id: 'b-2', color: 'black' as const, number: 2, isOpen: true },
        { id: 'b-?', color: 'black' as const, number: null, isOpen: false },
        { id: 'b-7', color: 'black' as const, number: 7, isOpen: true },
      ];

      const candidates = getPossibleNumbersForCard({
        targetIndex: 1,
        targetHand,
        playerHand: [{ id: 'b-4', color: 'black', number: 4, isOpen: false }],
        drawnCard: { id: 'b-5', color: 'black', number: 5, isOpen: false },
      });

      expect(candidates).toEqual([3, 6]);
    });

    it('過去ログのハズレ履歴（失敗アタック）が候補から除外される', () => {
      const targetHand = [
        { id: 'b-1', color: 'black' as const, number: 1, isOpen: true },
        { id: 'b-?', color: 'black' as const, number: null, isOpen: false },
        { id: 'b-5', color: 'black' as const, number: 5, isOpen: true },
      ];

      const logs: AttackLog[] = [
        {
          id: 'log-1',
          attackerId: 'player',
          attackerName: 'あなた',
          targetPlayerId: 'cpu-1',
          targetPlayerName: 'CPU 1',
          targetCardIndex: 1,
          targetColor: 'black',
          guessedNumber: 3,
          isHit: false, // 3でアタックして外れた
          timestamp: 1000,
          message: 'アタック失敗',
        },
      ];

      const candidates = getPossibleNumbersForCard({
        targetIndex: 1,
        targetHand,
        targetPlayerId: 'cpu-1',
        logs,
      });

      expect(candidates).toEqual([2, 4]);
    });

    it('既にオープン済みのカードを指定した場合はその確定値のみを返す', () => {
      const targetHand = [
        { id: 'b-5', color: 'black' as const, number: 5, isOpen: true },
      ];
      expect(getPossibleNumbersForCard({ targetIndex: 0, targetHand })).toEqual([5]);
    });

    it('無効なインデックスや手札の場合は空配列を返す', () => {
      expect(getPossibleNumbersForCard({ targetIndex: -1, targetHand: [] })).toEqual([]);
      expect(getPossibleNumbersForCard({ targetIndex: 5, targetHand: [] })).toEqual([]);
    });
  });

  describe('formatCandidateRange', () => {
    it('空配列なら "なし" を返す', () => {
      expect(formatCandidateRange([])).toBe('なし');
    });

    it('要素が1つならその数字を文字列で返す', () => {
      expect(formatCandidateRange([5])).toBe('5');
    });

    it('最小と最大が等しいなら単一の数字を返す', () => {
      expect(formatCandidateRange([7, 7])).toBe('7');
    });

    it('複数要素なら "min〜max" を返す', () => {
      expect(formatCandidateRange([3, 4, 5, 6])).toBe('3〜6');
      expect(formatCandidateRange([1, 9])).toBe('1〜9');
    });
  });

  describe('getFailedNumbersForCard (Issue #43: 失敗数字抽出ロジック)', () => {
    it('ログが空またはundefinedの場合は空配列を返す', () => {
      expect(getFailedNumbersForCard(undefined, 'cpu-1', 0)).toEqual([]);
      expect(getFailedNumbersForCard([], 'cpu-1', 0)).toEqual([]);
    });

    it('対象プレイヤー・対象カードの失敗数字（isHit === false）のみを抽出し、昇順ソート＆重複排除する', () => {
      const logs: AttackLog[] = [
        {
          id: 'log-1',
          attackerId: 'player',
          attackerName: 'あなた',
          targetPlayerId: 'cpu-1',
          targetPlayerName: 'CPU 1',
          targetCardIndex: 1,
          targetColor: 'black',
          guessedNumber: 7,
          isHit: false, // 失敗
          timestamp: 1000,
          message: 'ハズレ',
        },
        {
          id: 'log-2',
          attackerId: 'player',
          attackerName: 'あなた',
          targetPlayerId: 'cpu-1',
          targetPlayerName: 'CPU 1',
          targetCardIndex: 1,
          targetColor: 'black',
          guessedNumber: 3,
          isHit: false, // 失敗
          timestamp: 2000,
          message: 'ハズレ',
        },
        {
          id: 'log-3',
          attackerId: 'cpu-2',
          attackerName: 'CPU 2',
          targetPlayerId: 'cpu-1',
          targetPlayerName: 'CPU 1',
          targetCardIndex: 1,
          targetColor: 'black',
          guessedNumber: 3, // 重複宣言
          isHit: false,
          timestamp: 3000,
          message: 'ハズレ',
        },
        {
          id: 'log-4',
          attackerId: 'player',
          attackerName: 'あなた',
          targetPlayerId: 'cpu-1',
          targetPlayerName: 'CPU 1',
          targetCardIndex: 1,
          targetColor: 'black',
          guessedNumber: 5,
          isHit: true, // 的中ログは含めない
          timestamp: 4000,
          message: '的中',
        },
        {
          id: 'log-5',
          attackerId: 'player',
          attackerName: 'あなた',
          targetPlayerId: 'cpu-1',
          targetPlayerName: 'CPU 1',
          targetCardIndex: 0, // 別カード
          targetColor: 'black',
          guessedNumber: 2,
          isHit: false,
          timestamp: 5000,
          message: 'ハズレ',
        },
        {
          id: 'log-6',
          attackerId: 'player',
          attackerName: 'あなた',
          targetPlayerId: 'cpu-2', // 別プレイヤー
          targetPlayerName: 'CPU 2',
          targetCardIndex: 1,
          guessedNumber: 4,
          isHit: false,
          targetColor: 'white',
          timestamp: 6000,
          message: 'ハズレ',
        },
      ];

      const failedNums = getFailedNumbersForCard(logs, 'cpu-1', 1);
      // 7と3（重複3は排除）が昇順で [3, 7] となる
      expect(failedNums).toEqual([3, 7]);
    });
  });

  describe('formatFailedNumbersBadge (Issue #43: 失敗数字バッジ文字列生成)', () => {
    it('空配列なら空文字を返す', () => {
      expect(formatFailedNumbersBadge([])).toBe('');
    });

    it('単一の失敗数字なら "✕3" の形式で返す', () => {
      expect(formatFailedNumbersBadge([3])).toBe('✕3');
      expect(formatFailedNumbersBadge([11])).toBe('✕11');
    });

    it('複数の失敗数字なら "✕[3, 7]" の形式で返す', () => {
      expect(formatFailedNumbersBadge([3, 7])).toBe('✕[3, 7]');
      expect(formatFailedNumbersBadge([2, 5, 8])).toBe('✕[2, 5, 8]');
    });
  });
});
