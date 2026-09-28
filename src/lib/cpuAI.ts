import { Card, CardColor, Difficulty, AttackLog } from '../types/game';
import { compareCards } from './algoEngine';

export interface CpuAttackDecision {
  targetIndex: number;
  guessedNumber: number;
}

/**
 * CPUから見た「まだ場・手元に出ていない（未知の）カード一覧」を取得
 */
export function getAvailableUnknownCards(
  cpuHand: Card[],
  cpuDrawnCard: Card | null,
  playerHand: Card[]
): { color: CardColor; number: number }[] {
  // 全24枚のセット
  const allCards: { color: CardColor; number: number }[] = [];
  for (const c of ['black', 'white'] as CardColor[]) {
    for (let n = 0; n <= 11; n++) {
      allCards.push({ color: c, number: n });
    }
  }

  // CPUが知っているカード（自分の手札、引いたカード、相手の表向きカード）
  const knownCards = new Set<string>();
  for (const c of cpuHand) {
    knownCards.add(`${c.color}-${c.number}`);
  }
  if (cpuDrawnCard) {
    knownCards.add(`${cpuDrawnCard.color}-${cpuDrawnCard.number}`);
  }
  for (const c of playerHand) {
    if (c.isOpen) {
      knownCards.add(`${c.color}-${c.number}`);
    }
  }

  return allCards.filter((c) => !knownCards.has(`${c.color}-${c.number}`));
}

/**
 * プレイヤーの手札の特定インデックスのカード（裏向き）について、
 * 並び順ルールおよび既知カードから取りうる数字候補を計算する
 */
export function getPossibleNumbersForTarget(
  targetIndex: number,
  playerHand: Card[],
  availableUnknownCards: { color: CardColor; number: number }[],
  logs: AttackLog[] = []
): number[] {
  const targetCard = playerHand[targetIndex];
  if (targetCard.isOpen) return [];

  const targetColor = targetCard.color;

  // 1. 同色の未知カードから候補を絞る
  let candidates = availableUnknownCards
    .filter((c) => c.color === targetColor)
    .map((c) => c.number);

  // 2. 左側にあるオープンカードによる下限チェック
  for (let i = targetIndex - 1; i >= 0; i--) {
    const leftCard = playerHand[i];
    if (leftCard.isOpen) {
      // targetCard は leftCard より大きくなければならない
      candidates = candidates.filter((candNum) => {
        const dummyTarget: Card = {
          id: 'dummy',
          color: targetColor,
          number: candNum,
          isOpen: false,
        };
        return compareCards(leftCard, dummyTarget) < 0;
      });
      break; // 直近のオープンカードが最も強い制約
    }
  }

  // 3. 右側にあるオープンカードによる上限チェック
  for (let i = targetIndex + 1; i < playerHand.length; i++) {
    const rightCard = playerHand[i];
    if (rightCard.isOpen) {
      // targetCard は rightCard より小さくなければならない
      candidates = candidates.filter((candNum) => {
        const dummyTarget: Card = {
          id: 'dummy',
          color: targetColor,
          number: candNum,
          isOpen: false,
        };
        return compareCards(dummyTarget, rightCard) < 0;
      });
      break; // 直近のオープンカードが最も強い制約
    }
  }

  // 4. 左側の裏向きカード枚数による物理的最小値（最低でも (枚数 - 1) 分のスペースが必要）
  const unopenLeftCount = targetIndex;
  // 右側の裏向きカード枚数による物理的最大値
  const unopenRightCount = playerHand.length - 1 - targetIndex;

  candidates = candidates.filter((num) => {
    // 粗い足切り（0〜11の範囲内での最小スロット確保）
    return num >= Math.floor(unopenLeftCount / 2) && num <= 11 - Math.floor(unopenRightCount / 2);
  });

  // 5. 過去に同じターゲットに対して外した数字を除外
  const failedGuesses = new Set<number>();
  for (const log of logs) {
    if (log.targetIndex === targetIndex && !log.isHit) {
      failedGuesses.add(log.guessedNumber);
    }
  }
  candidates = candidates.filter((num) => !failedGuesses.has(num));

  return candidates;
}

/**
 * CPUのアタック思考メイン関数
 */
export function decideCpuAttack(
  playerHand: Card[],
  cpuHand: Card[],
  cpuDrawnCard: Card | null,
  difficulty: Difficulty,
  logs: AttackLog[] = []
): CpuAttackDecision {
  // プレイヤーの裏向きカードのインデックス一覧
  const closedIndices: number[] = [];
  playerHand.forEach((card, index) => {
    if (!card.isOpen) closedIndices.push(index);
  });

  if (closedIndices.length === 0) {
    return { targetIndex: 0, guessedNumber: 0 };
  }

  const unknownCards = getAvailableUnknownCards(cpuHand, cpuDrawnCard, playerHand);

  // 各裏向きカードの候補を算出
  const targetCandidateMap = new Map<number, number[]>();
  for (const idx of closedIndices) {
    const candidates = getPossibleNumbersForTarget(
      idx,
      playerHand,
      unknownCards,
      difficulty === 'hard' ? logs : []
    );
    // 候補が空（異常系保険）なら未知カードの同色から全選択
    if (candidates.length === 0) {
      const fallback = unknownCards
        .filter((c) => c.color === playerHand[idx].color)
        .map((c) => c.number);
      targetCandidateMap.set(idx, fallback.length > 0 ? fallback : [0]);
    } else {
      targetCandidateMap.set(idx, candidates);
    }
  }

  // 難易度別の選択
  if (difficulty === 'easy') {
    // ランダムに対象を選び、ランダムに予想
    const chosenIdx = closedIndices[Math.floor(Math.random() * closedIndices.length)];
    const candidates = targetCandidateMap.get(chosenIdx) || [0];
    const guessedNumber = candidates[Math.floor(Math.random() * candidates.length)];
    return { targetIndex: chosenIdx, guessedNumber };
  }

  if (difficulty === 'normal') {
    // 最も候補が少ない（確定に近い）カードを優先して狙う
    let bestIdx = closedIndices[0];
    let minCandidateCount = 999;

    for (const idx of closedIndices) {
      const count = targetCandidateMap.get(idx)?.length || 999;
      if (count < minCandidateCount) {
        minCandidateCount = count;
        bestIdx = idx;
      }
    }

    const candidates = targetCandidateMap.get(bestIdx) || [0];
    const guessedNumber = candidates[Math.floor(Math.random() * candidates.length)];
    return { targetIndex: bestIdx, guessedNumber };
  }

  // hard: 確定カード（候補数=1）があれば即座にそれを狙う！
  for (const idx of closedIndices) {
    const cands = targetCandidateMap.get(idx) || [];
    if (cands.length === 1) {
      return { targetIndex: idx, guessedNumber: cands[0] };
    }
  }

  // 確定がない場合、候補数が最小のインデックスを選択
  let bestIdx = closedIndices[0];
  let minCount = 999;

  for (const idx of closedIndices) {
    const count = targetCandidateMap.get(idx)?.length || 999;
    if (count < minCount) {
      minCount = count;
      bestIdx = idx;
    }
  }

  const bestCandidates = targetCandidateMap.get(bestIdx) || [0];
  // 中央値（最もありそうな数字）またはランダム
  const guessedNumber = bestCandidates[Math.floor(bestCandidates.length / 2)];
  return { targetIndex: bestIdx, guessedNumber };
}

/**
 * CPUがアタック的中後に「続けてアタックするか（コンティニュー）」または「ステイするか」を判断
 */
export function decideCpuContinue(
  playerHand: Card[],
  cpuHand: Card[],
  cpuDrawnCard: Card | null,
  difficulty: Difficulty
): boolean {
  // 残り裏向きカードが0枚なら勝利なので継続不要（自動終了）
  const remainingClosed = playerHand.filter((c) => !c.isOpen).length;
  if (remainingClosed === 0) return false;

  if (difficulty === 'easy') {
    // 50% でステイ
    return Math.random() > 0.5;
  }

  // 確定できるカードがあるなら継続する
  const unknownCards = getAvailableUnknownCards(cpuHand, cpuDrawnCard, playerHand);
  for (let i = 0; i < playerHand.length; i++) {
    if (!playerHand[i].isOpen) {
      const cands = getPossibleNumbersForTarget(i, playerHand, unknownCards);
      if (cands.length === 1) {
        return true; // 確実に当てられるならアタック続行！
      }
    }
  }

  if (difficulty === 'hard') {
    // 候補が2つ以下のカードがあれば勝負、そうでなければステイで安全策
    for (let i = 0; i < playerHand.length; i++) {
      if (!playerHand[i].isOpen) {
        const cands = getPossibleNumbersForTarget(i, playerHand, unknownCards);
        if (cands.length <= 2) {
          return true;
        }
      }
    }
    return false; // 安全に伏せて手札にする
  }

  // Normal: 確率30%で継続
  return Math.random() < 0.3;
}
