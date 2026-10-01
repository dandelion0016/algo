import { describe, it, expect } from 'vitest';
import { Player, Card, AttackLog } from '../../types/game';
import {
  getBestHint,
  getCardPositionText,
  generateAdviceText,
} from '../hintAdvisor';

describe('hintAdvisor', () => {
  const createPlayer = (id: string, name: string, isHuman: boolean, cards: Card[], isEliminated = false): Player => ({
    id,
    name,
    isHuman,
    cards,
    isEliminated,
    avatarColor: 'from-blue-500 to-indigo-600',
  });

  describe('getCardPositionText', () => {
    it('末尾のカードは「右端の」を返す（カード枚数が2枚以上の場合）', () => {
      expect(getCardPositionText(3, 4)).toBe('右端の');
      expect(getCardPositionText(1, 2)).toBe('右端の');
    });

    it('先頭や途中のカードは「左からN枚目の」を返す', () => {
      expect(getCardPositionText(0, 4)).toBe('左から1枚目の');
      expect(getCardPositionText(1, 4)).toBe('左から2枚目の');
      expect(getCardPositionText(2, 4)).toBe('左から3枚目の');
    });

    it('カードが1枚だけの場合は「左から1枚目の」を返す', () => {
      expect(getCardPositionText(0, 1)).toBe('左から1枚目の');
    });
  });

  describe('generateAdviceText', () => {
    it('確定カード（候補1通り）の場合のアドバイス文を生成する', () => {
      const text = generateAdviceText('CPU 1', 1, 4, 'black', [3]);
      expect(text).toBe('CPU 1の左から2枚目の黒カードは [3] に確定しています！');
    });

    it('複数候補の場合のアドバイス文を生成する', () => {
      const text = generateAdviceText('CPU 2', 3, 4, 'white', [10, 11]);
      expect(text).toBe('CPU 2の右端の白カードは [10, 11] の2択に絞り込まれています！');
    });

    it('3択以上の絞り込みメッセージも正しく生成する', () => {
      const text = generateAdviceText('CPU 1', 0, 3, 'black', [0, 1, 2]);
      expect(text).toBe('CPU 1の左から1枚目の黒カードは [0, 1, 2] の3択に絞り込まれています！');
    });

    it('候補が0件のエッジケースメッセージを生成する', () => {
      const text = generateAdviceText('CPU 1', 0, 1, 'black', []);
      expect(text).toBe('CPU 1の左から1枚目の黒カードの候補が見つかりませんでした。');
    });
  });

  describe('getBestHint', () => {
    it('対戦相手がいない場合、または脱落している場合は null を返す', () => {
      const human = createPlayer('p1', 'Player', true, [
        { id: 'b-1', color: 'black', number: 1, isOpen: false },
      ]);
      const eliminatedCpu = createPlayer(
        'c1',
        'CPU 1',
        false,
        [{ id: 'w-2', color: 'white', number: 2, isOpen: true }],
        true
      );

      expect(getBestHint([human])).toBeNull();
      expect(getBestHint([human, eliminatedCpu])).toBeNull();
    });

    it('対戦相手のカードが全てオープンの場合は null を返す', () => {
      const human = createPlayer('p1', 'Player', true, [
        { id: 'b-1', color: 'black', number: 1, isOpen: false },
      ]);
      const cpu = createPlayer('c1', 'CPU 1', false, [
        { id: 'b-2', color: 'black', number: 2, isOpen: true },
        { id: 'w-5', color: 'white', number: 5, isOpen: true },
      ]);

      expect(getBestHint([human, cpu])).toBeNull();
    });

    it('確定カード（候補1通り）が存在する場合、それを最優先で選出する', () => {
      // 人間の手札: 黒0, 黒2, 白4
      // 相手の手札:
      // index 0: 黒1 (オープン: false)
      //   -> 左端で min=0 だが自分の手札に黒0がある。また右側に黒2があるため、候補は [1] のみに確定
      // index 1: 白6 (オープン: false) -> 候補複数
      const human = createPlayer('p1', 'Player', true, [
        { id: 'b-0', color: 'black', number: 0, isOpen: false },
        { id: 'b-2', color: 'black', number: 2, isOpen: false },
        { id: 'w-4', color: 'white', number: 4, isOpen: false },
      ]);

      const cpu = createPlayer('c1', 'CPU 1', false, [
        { id: 'b-1', color: 'black', number: 1, isOpen: false },
        { id: 'w-6', color: 'white', number: 6, isOpen: false },
      ]);

      // open card for upper bound: 相手の手札に黒2をオープンさせるのではなく、
      // 相手の手札自体にオープンカードがある場合をシミュレート
      const cpuWithOpen = createPlayer('c1', 'CPU 1', false, [
        { id: 'b-1', color: 'black', number: 1, isOpen: false },
        { id: 'b-3', color: 'black', number: 3, isOpen: true },
      ]);

      const hint = getBestHint([human, cpuWithOpen]);
      expect(hint).not.toBeNull();
      expect(hint?.targetPlayerId).toBe('c1');
      expect(hint?.targetCardIndex).toBe(0);
      expect(hint?.color).toBe('black');
      expect(hint?.isDefinite).toBe(true);
      expect(hint?.possibleNumbers).toEqual([1]);
      expect(hint?.adviceText).toContain('確定しています！');
    });

    it('確定カードがない場合、候補数字が最少のカードを選出する', () => {
      // CPU手札: 2枚
      // card 0: 黒カード (候補が少ない)
      // card 1: 白カード (候補が多い)
      // 人間が多くの黒カードを持っているため、相手の黒カードの候補が2つに絞られる
      const human = createPlayer('p1', 'Player', true, [
        { id: 'b-3', color: 'black', number: 3, isOpen: false },
        { id: 'b-4', color: 'black', number: 4, isOpen: false },
        { id: 'b-5', color: 'black', number: 5, isOpen: false },
        { id: 'b-6', color: 'black', number: 6, isOpen: false },
        { id: 'b-7', color: 'black', number: 7, isOpen: false },
        { id: 'b-8', color: 'black', number: 8, isOpen: false },
        { id: 'b-9', color: 'black', number: 9, isOpen: false },
        { id: 'b-10', color: 'black', number: 10, isOpen: false },
        { id: 'b-11', color: 'black', number: 11, isOpen: false },
      ]);

      // CPU:
      // card 0: black (残る黒は 0, 1, 2)
      // card 1: white (白は 0..11 ほぼ全て残っている)
      const cpu = createPlayer('c1', 'CPU 1', false, [
        { id: 'b-1', color: 'black', number: 1, isOpen: false },
        { id: 'w-8', color: 'white', number: 8, isOpen: false },
      ]);

      const hint = getBestHint([human, cpu]);
      expect(hint).not.toBeNull();
      expect(hint?.targetCardIndex).toBe(0);
      expect(hint?.color).toBe('black');
      expect(hint?.isDefinite).toBe(false);
      expect(hint?.possibleNumbers.length).toBeLessThan(10);
      expect(hint?.adviceText).toContain('絞り込まれています！');
    });

    it('過去の外れログ（AttackLog）を考慮して候補が絞り込まれ、確定に至る', () => {
      // 人間が黒0を持っている
      // CPU手札: card 0 = 黒1, card 1 = 黒3(OPEN)
      // card 0 の候補は minStep により 0..2。黒0は人間所持なので候補は [1, 2]
      const human = createPlayer('p1', 'Player', true, [
        { id: 'b-0', color: 'black', number: 0, isOpen: false },
      ]);

      const cpu = createPlayer('c1', 'CPU 1', false, [
        { id: 'b-1', color: 'black', number: 1, isOpen: false },
        { id: 'b-3', color: 'black', number: 3, isOpen: true },
      ]);

      // まだ外れログがない場合、候補は [1, 2] (isDefinite = false)
      const initialHint = getBestHint([human, cpu]);
      expect(initialHint?.possibleNumbers).toEqual([1, 2]);
      expect(initialHint?.isDefinite).toBe(false);

      // 過去に「数字 2」をアタックして外れたログがある場合
      const failLog: AttackLog = {
        id: 'log-1',
        attackerId: 'p1',
        attackerName: 'Player',
        targetPlayerId: 'c1',
        targetPlayerName: 'CPU 1',
        targetCardIndex: 0,
        targetColor: 'black',
        guessedNumber: 2,
        isHit: false,
        timestamp: Date.now(),
        message: 'はずれ',
      };

      const hintWithLog = getBestHint([human, cpu], null, [failLog]);
      expect(hintWithLog?.possibleNumbers).toEqual([1]);
      expect(hintWithLog?.isDefinite).toBe(true);
      expect(hintWithLog?.adviceText).toBe('CPU 1の左から1枚目の黒カードは [1] に確定しています！');
    });

    it('ドローしたカード（drawnCard）も考慮して候補から除外される', () => {
      const human = createPlayer('p1', 'Player', true, [
        { id: 'b-0', color: 'black', number: 0, isOpen: false },
      ]);

      const cpu = createPlayer('c1', 'CPU 1', false, [
        { id: 'b-1', color: 'black', number: 1, isOpen: false },
        { id: 'b-3', color: 'black', number: 3, isOpen: true },
      ]);

      // ドローカードが黒2の場合、候補 [1, 2] から 2 が除外されて [1] に確定
      const drawnCard: Card = { id: 'b-2', color: 'black', number: 2, isOpen: false };
      const hint = getBestHint([human, cpu], drawnCard);

      expect(hint?.possibleNumbers).toEqual([1]);
      expect(hint?.isDefinite).toBe(true);
    });

    it('3人対戦で複数の対戦相手がいる場合、全体の中で最少候補の相手・カードを選出する', () => {
      const human = createPlayer('p1', 'Player', true, [
        { id: 'b-0', color: 'black', number: 0, isOpen: false },
        { id: 'w-0', color: 'white', number: 0, isOpen: false },
      ]);

      // cpu1: 候補3つ
      const cpu1 = createPlayer('c1', 'CPU 1', false, [
        { id: 'b-2', color: 'black', number: 2, isOpen: false },
        { id: 'b-5', color: 'black', number: 5, isOpen: true },
      ]);

      // cpu2: 候補1つ（確定: 白0を人間が持っており、右が白2なので白1のみ）
      const cpu2 = createPlayer('c2', 'CPU 2', false, [
        { id: 'w-1', color: 'white', number: 1, isOpen: false },
        { id: 'w-2', color: 'white', number: 2, isOpen: true },
      ]);

      const hint = getBestHint([human, cpu1, cpu2]);
      expect(hint?.targetPlayerId).toBe('c2');
      expect(hint?.targetPlayerName).toBe('CPU 2');
      expect(hint?.targetCardIndex).toBe(0);
      expect(hint?.color).toBe('white');
      expect(hint?.isDefinite).toBe(true);
      expect(hint?.possibleNumbers).toEqual([1]);
    });
  });
});
