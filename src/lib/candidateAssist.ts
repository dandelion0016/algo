import { Card, CardColor, Player, PublicCard, AttackLog } from '../types/game';

/**
 * 隣接する2枚のカードの間で必要な最小増分を計算
 * アルゴの基本ソートルール:
 * 1. 数字の小さい順
 * 2. 同じ数字の場合は「黒」が先（左）、「白」が後（右）
 *
 * したがって:
 * - black -> white: 同数が可能 (差 >= 0)
 * - black -> black: 同色同数は存在しない (差 >= 1)
 * - white -> white: 同色同数は存在しない (差 >= 1)
 * - white -> black: 白が左で黒が右の場合、同数なら黒が左になるはずなので同数は不可能 (差 >= 1)
 */
export function getMinStepBetween(colorA: CardColor, colorB: CardColor): number {
  if (colorA === 'black' && colorB === 'white') {
    return 0;
  }
  return 1;
}

/**
 * 手札内のインデックス from から to までの累積最小増分を計算 (from <= to)
 */
export function getMinStepTotal(
  hand: { color: CardColor }[],
  fromIndex: number,
  toIndex: number
): number {
  if (fromIndex >= toIndex) return 0;
  let step = 0;
  for (let i = fromIndex; i < toIndex; i++) {
    step += getMinStepBetween(hand[i].color, hand[i + 1].color);
  }
  return step;
}

/**
 * 特定の色について、既に判明している（自分手札、全オープンカード、ドローカード）数字一覧を抽出
 */
export function getKnownNumbersForColor(
  targetColor: CardColor,
  players?: Player[],
  drawnCard?: Card | null,
  playerHand?: (Card | PublicCard)[]
): number[] {
  const known = new Set<number>();

  // 1. 人間プレイヤーの手札
  if (playerHand) {
    for (const c of playerHand) {
      if (c.color === targetColor && c.number !== null) {
        known.add(c.number);
      }
    }
  }

  // 2. プレイヤー一覧
  if (players) {
    for (const p of players) {
      // 人間プレイヤー本人の手札（伏せでも本人は数字を知っている）
      if (p.isHuman) {
        for (const c of p.cards) {
          if (c.color === targetColor && c.number !== null) {
            known.add(c.number);
          }
        }
      }
      // 全プレイヤーのオープンカード
      for (const c of p.cards) {
        if (c.isOpen && c.color === targetColor && c.number !== null) {
          known.add(c.number);
        }
      }
    }
  }

  // 3. ドローしたカード
  if (drawnCard && drawnCard.color === targetColor && drawnCard.number !== null) {
    known.add(drawnCard.number);
  }

  return Array.from(known).sort((a, b) => a - b);
}

export interface CandidateAssistOptions {
  targetIndex: number;
  targetHand: (Card | PublicCard)[];
  playerHand?: (Card | PublicCard)[];
  allPlayers?: Player[];
  drawnCard?: Card | null;
  knownNumbers?: number[];
  failedGuesses?: number[];
  logs?: AttackLog[];
  targetPlayerId?: string;
}

/**
 * アルゴの鉄則（手札は左から昇順、同数黒左）に基づき、特定の相手伏せカードが取りうる候補数字（0..11）を算出
 *
 * @param options 推理候補計算に必要な情報
 * @returns 厳密に論理的に取りうる候補数字リスト（昇順の number[]）
 */
export function getPossibleNumbersForCard(options: CandidateAssistOptions): number[] {
  const {
    targetIndex,
    targetHand,
    playerHand,
    allPlayers,
    drawnCard,
    knownNumbers: explicitKnownNumbers,
    failedGuesses = [],
    logs,
    targetPlayerId,
  } = options;

  if (!targetHand || targetIndex < 0 || targetIndex >= targetHand.length) {
    return [];
  }

  const targetCard = targetHand[targetIndex];
  // 既にオープンされているカードは確定済み
  if (targetCard.isOpen && targetCard.number !== null) {
    return [targetCard.number];
  }

  const targetColor = targetCard.color;

  // 1. 左側からの下限値 (minPossible)
  // 端点制約: 手札の最小カードは 0 以上。インデックス 0 から targetIndex までの累積最小ステップを加算
  let minPossible = getMinStepTotal(targetHand, 0, targetIndex);

  // 左側にあるオープンカードによる下限チェック
  for (let i = targetIndex - 1; i >= 0; i--) {
    const leftCard = targetHand[i];
    if (leftCard.isOpen && leftCard.number !== null) {
      const stepFromLeft = getMinStepTotal(targetHand, i, targetIndex);
      const lowerBound = leftCard.number + stepFromLeft;
      if (lowerBound > minPossible) {
        minPossible = lowerBound;
      }
      break; // ソート済みのため、最も近いオープンカードで十分
    }
  }

  // 2. 右側からの上限値 (maxPossible)
  // 端点制約: 手札の最大カードは 11 以下。targetIndex から 右端までの累積最小ステップを逆算
  let maxPossible = 11 - getMinStepTotal(targetHand, targetIndex, targetHand.length - 1);

  // 右側にあるオープンカードによる上限チェック
  for (let i = targetIndex + 1; i < targetHand.length; i++) {
    const rightCard = targetHand[i];
    if (rightCard.isOpen && rightCard.number !== null) {
      const stepToRight = getMinStepTotal(targetHand, targetIndex, i);
      const upperBound = rightCard.number - stepToRight;
      if (upperBound < maxPossible) {
        maxPossible = upperBound;
      }
      break; // 最も近いオープンカードで十分
    }
  }

  // 3. 既知数字（確認済み数字）の集約
  const knownSet = new Set<number>(explicitKnownNumbers || []);
  const calculatedKnown = getKnownNumbersForColor(targetColor, allPlayers, drawnCard, playerHand);
  calculatedKnown.forEach((num) => knownSet.add(num));

  // 4. 過去の失敗ログから対象カードに対する外れ数字を除外
  const failedSet = new Set<number>(failedGuesses);
  if (logs && targetPlayerId) {
    const cardFailed = getFailedNumbersForCard(logs, targetPlayerId, targetIndex);
    cardFailed.forEach((num) => failedSet.add(num));
  }

  // 5. minPossible .. maxPossible の範囲から、既知数字・失敗数字を除外
  const candidates: number[] = [];
  const lower = Math.max(0, minPossible);
  const upper = Math.min(11, maxPossible);

  for (let num = lower; num <= upper; num++) {
    if (!knownSet.has(num) && !failedSet.has(num)) {
      candidates.push(num);
    }
  }

  return candidates;
}

/**
 * 過去のアタックログから、特定のプレイヤー・カードインデックスに対する失敗数字リストを抽出
 * （ミスアタック再宣言防止 / Issue #43）
 *
 * @param logs アタック履歴一覧
 * @param targetPlayerId 対象プレイヤーID
 * @param targetCardIndex 対象カードのインデックス (0-indexed)
 * @returns 過去に宣言されて外れた数字の配列（昇順ソート済み、重複なし）
 */
export function getFailedNumbersForCard(
  logs: AttackLog[] | undefined,
  targetPlayerId: string,
  targetCardIndex: number
): number[] {
  if (!logs || logs.length === 0) {
    return [];
  }

  const failed = new Set<number>();
  for (const log of logs) {
    if (
      log.targetPlayerId === targetPlayerId &&
      log.targetCardIndex === targetCardIndex &&
      !log.isHit
    ) {
      failed.add(log.guessedNumber);
    }
  }

  return Array.from(failed).sort((a, b) => a - b);
}

/**
 * 失敗数字リストをカード表示用バッジ文字列にフォーマット（例: "✕3", "✕3,7", "✕1,3.."）
 * カード幅（44px）を超過して隣と重ならないよう、2件は角括弧なし、3件以上は省略表記（Issue #69）
 */
export function formatFailedNumbersBadge(failedNumbers: number[]): string {
  if (!failedNumbers || failedNumbers.length === 0) {
    return '';
  }
  if (failedNumbers.length === 1) {
    return `✕${failedNumbers[0]}`;
  }
  if (failedNumbers.length === 2) {
    return `✕${failedNumbers[0]},${failedNumbers[1]}`;
  }
  return `✕${failedNumbers[0]},${failedNumbers[1]}..`;
}

/**
 * 失敗数字リストの完全な一覧をツールチップ用のテキストにフォーマット（例: "過去の外れ数字: 1, 3, 5, 7"）
 * バッジが省略表記になっても、ホバー等で全数字を確認可能にする（Issue #69）
 */
export function getFailedNumbersTooltip(failedNumbers: number[]): string {
  if (!failedNumbers || failedNumbers.length === 0) {
    return '';
  }
  return `過去の外れ数字: ${failedNumbers.join(', ')}`;
}

/**
 * 候補数字の配列を表示用文字列にフォーマット（例: "3〜6", "5", "なし"）
 */
export function formatCandidateRange(candidates: number[]): string {
  if (!candidates || candidates.length === 0) {
    return 'なし';
  }
  if (candidates.length === 1) {
    return `${candidates[0]}`;
  }
  const min = candidates[0];
  const max = candidates[candidates.length - 1];
  if (min === max) {
    return `${min}`;
  }
  return `${min}〜${max}`;
}
