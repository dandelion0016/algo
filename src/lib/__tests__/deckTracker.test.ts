import { describe, it, expect } from 'vitest';
import { Player, Card } from '../../types/game';
import { calculateDeckTrackerState, getConfirmedCardSets, getRemainingDeckNumbers } from '../deckTracker';

describe('deckTracker', () => {
  const createMockPlayer = (
    id: string,
    name: string,
    isHuman: boolean,
    cards: Card[]
  ): Player => ({
    id,
    name,
    isHuman,
    cards,
    isEliminated: false,
    avatarColor: 'blue',
  });

  describe('getConfirmedCardSets', () => {
    it('初期状態（カードなし）では確定済みセットは空であること', () => {
      const confirmed = getConfirmedCardSets([]);
      expect(confirmed.black.size).toBe(0);
      expect(confirmed.white.size).toBe(0);
    });

    it('人間プレイヤーの手札は裏向き・表向きに関わらず確定済みとなること', () => {
      const human = createMockPlayer('p1', 'Player 1', true, [
        { id: 'b-0', color: 'black', number: 0, isOpen: false },
        { id: 'b-5', color: 'black', number: 5, isOpen: true },
        { id: 'w-2', color: 'white', number: 2, isOpen: false },
      ]);

      const confirmed = getConfirmedCardSets([human]);
      expect(confirmed.black.has(0)).toBe(true);
      expect(confirmed.black.has(5)).toBe(true);
      expect(confirmed.black.has(1)).toBe(false);
      expect(confirmed.white.has(2)).toBe(true);
      expect(confirmed.white.has(3)).toBe(false);
    });

    it('相手プレイヤーの裏向きカードは非公開（未確定）として扱われ、オープンカードのみ確定済みとなること（Information Hiding）', () => {
      const cpu = createMockPlayer('cpu1', 'CPU 1', false, [
        { id: 'b-3', color: 'black', number: 3, isOpen: false }, // 裏向き
        { id: 'w-8', color: 'white', number: 8, isOpen: true },  // 表向き
      ]);

      const confirmed = getConfirmedCardSets([cpu]);
      // 相手の裏向きカード b-3 は確定扱いに含まれてはならない
      expect(confirmed.black.has(3)).toBe(false);
      // 相手の表向きカード w-8 は確定扱い
      expect(confirmed.white.has(8)).toBe(true);
    });

    it('引いたカード（drawnCard）は確定済みとなること', () => {
      const drawnCard: Card = { id: 'w-10', color: 'white', number: 10, isOpen: false };
      const confirmed = getConfirmedCardSets([], drawnCard);
      expect(confirmed.white.has(10)).toBe(true);
      expect(confirmed.black.size).toBe(0);
    });
  });

  describe('calculateDeckTrackerState', () => {
    it('全24枚（黒0..11, 白0..11）のカードプールが正確に生成されること', () => {
      const state = calculateDeckTrackerState({ players: [] });
      expect(state.blackCards).toHaveLength(12);
      expect(state.whiteCards).toHaveLength(12);
      expect(state.summary.totalRemaining).toBe(24);
      expect(state.summary.blackRemaining).toBe(12);
      expect(state.summary.whiteRemaining).toBe(12);
      expect(state.summary.totalConfirmed).toBe(0);

      // 全て未確定
      state.blackCards.forEach((c, idx) => {
        expect(c.color).toBe('black');
        expect(c.number).toBe(idx);
        expect(c.isConfirmed).toBe(false);
        expect(c.isHighlighted).toBe(false);
      });
      state.whiteCards.forEach((c, idx) => {
        expect(c.color).toBe('white');
        expect(c.number).toBe(idx);
        expect(c.isConfirmed).toBe(false);
        expect(c.isHighlighted).toBe(false);
      });
    });

    it('人間手札・相手オープン・ドローカードが反映され、残弾サマリが正しく計算されること', () => {
      const human = createMockPlayer('p1', 'Player 1', true, [
        { id: 'b-1', color: 'black', number: 1, isOpen: false },
        { id: 'b-2', color: 'black', number: 2, isOpen: false },
        { id: 'w-5', color: 'white', number: 5, isOpen: false },
      ]);
      const cpu = createMockPlayer('cpu1', 'CPU 1', false, [
        { id: 'b-7', color: 'black', number: 7, isOpen: false }, // 裏向き（残弾扱い）
        { id: 'w-1', color: 'white', number: 1, isOpen: true },  // オープン（確定扱い）
      ]);
      const drawnCard: Card = { id: 'w-11', color: 'white', number: 11, isOpen: false };

      const state = calculateDeckTrackerState({
        players: [human, cpu],
        drawnCard,
      });

      // 確定カード: 黒1, 黒2 (計2枚) / 白5, 白1, 白11 (計3枚) => 合計5枚
      expect(state.summary.blackConfirmed).toBe(2);
      expect(state.summary.whiteConfirmed).toBe(3);
      expect(state.summary.totalConfirmed).toBe(5);

      // 未確定カード: 黒10枚 / 白9枚 => 合計19枚
      expect(state.summary.blackRemaining).toBe(10);
      expect(state.summary.whiteRemaining).toBe(9);
      expect(state.summary.totalRemaining).toBe(19);

      // 個別カードの状態確認
      expect(state.blackCards[1].isConfirmed).toBe(true);
      expect(state.blackCards[2].isConfirmed).toBe(true);
      expect(state.blackCards[7].isConfirmed).toBe(false); // CPUの裏向きなので未確定
      expect(state.whiteCards[1].isConfirmed).toBe(true);
      expect(state.whiteCards[5].isConfirmed).toBe(true);
      expect(state.whiteCards[11].isConfirmed).toBe(true);
      expect(state.whiteCards[0].isConfirmed).toBe(false);
    });

    it('アシストハイライトが指定された色と数字の未確定カードのみに適用されること', () => {
      const human = createMockPlayer('p1', 'Player 1', true, [
        { id: 'w-3', color: 'white', number: 3, isOpen: false },
      ]);

      const state = calculateDeckTrackerState({
        players: [human],
        highlightedNumbers: [2, 3, 4],
        highlightColor: 'white',
      });

      // 白2, 4 は未確定かつ候補に含まれるためハイライトされる
      expect(state.whiteCards[2].isHighlighted).toBe(true);
      expect(state.whiteCards[4].isHighlighted).toBe(true);
      // 白3 は候補に含まれるが、既に確定済み（自分の手札）なのでハイライトされない
      expect(state.whiteCards[3].isConfirmed).toBe(true);
      expect(state.whiteCards[3].isHighlighted).toBe(false);
      // 白1 は候補に含まれないのでハイライトされない
      expect(state.whiteCards[1].isHighlighted).toBe(false);
      // 黒は highlightColor が white なので一切ハイライトされない
      expect(state.blackCards[2].isHighlighted).toBe(false);
      expect(state.blackCards[4].isHighlighted).toBe(false);
    });

    it('highlightColor が null の場合、両色で該当数字の未確定カードがハイライトされること', () => {
      const state = calculateDeckTrackerState({
        players: [],
        highlightedNumbers: [0, 11],
        highlightColor: null,
      });

      expect(state.blackCards[0].isHighlighted).toBe(true);
      expect(state.blackCards[11].isHighlighted).toBe(true);
      expect(state.whiteCards[0].isHighlighted).toBe(true);
      expect(state.whiteCards[11].isHighlighted).toBe(true);
      expect(state.blackCards[1].isHighlighted).toBe(false);
    });
  });

  describe('getRemainingDeckNumbers (Issue #113)', () => {
    it('初期状態では0から11までの全12個の数字が昇順で返されること', () => {
      const remainingBlack = getRemainingDeckNumbers([], 'black');
      const remainingWhite = getRemainingDeckNumbers([], 'white');

      expect(remainingBlack).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(remainingWhite).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    it('人間手札・オープンカード・ドローカードの数字が除外された昇順未確定数字配列が返されること', () => {
      const human = createMockPlayer('p1', 'Player 1', true, [
        { id: 'b-0', color: 'black', number: 0, isOpen: false },
        { id: 'b-5', color: 'black', number: 5, isOpen: true },
        { id: 'w-2', color: 'white', number: 2, isOpen: false },
      ]);
      const cpu = createMockPlayer('cpu1', 'CPU 1', false, [
        { id: 'b-7', color: 'black', number: 7, isOpen: false }, // 裏向き（残弾として残る）
        { id: 'b-9', color: 'black', number: 9, isOpen: true },  // オープン（確定除外）
        { id: 'w-4', color: 'white', number: 4, isOpen: true },  // オープン（確定除外）
      ]);
      const drawnCard: Card = { id: 'b-11', color: 'black', number: 11, isOpen: false };

      const remainingBlack = getRemainingDeckNumbers([human, cpu], 'black', drawnCard);
      // 除外: 0 (human), 5 (human), 9 (cpu open), 11 (drawn) -> 残り: 1, 2, 3, 4, 6, 7, 8, 10
      expect(remainingBlack).toEqual([1, 2, 3, 4, 6, 7, 8, 10]);

      const remainingWhite = getRemainingDeckNumbers([human, cpu], 'white', drawnCard);
      // 除外: 2 (human), 4 (cpu open) -> 残り: 0, 1, 3, 5, 6, 7, 8, 9, 10, 11
      expect(remainingWhite).toEqual([0, 1, 3, 5, 6, 7, 8, 9, 10, 11]);
    });
  });
});
