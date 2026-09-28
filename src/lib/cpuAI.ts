import { Card, CardColor, Difficulty, AttackLog, Player } from '../types/game';
import { compareCards } from './algoEngine';

export interface MultiCpuAttackDecision {
  targetPlayerId: string;
  targetCardIndex: number;
  guessedNumber: number;
}

/**
 * CPUから見て「まだ誰のオープンでもなく、自分の手元にもない未知のカード」を取得
 */
export function getAvailableUnknownCardsMulti(
  cpuPlayer: Player,
  cpuDrawnCard: Card | null,
  allPlayers: Player[]
): { color: CardColor; number: number }[] {
  const allCards: { color: CardColor; number: number }[] = [];
  for (const c of ['black', 'white'] as CardColor[]) {
    for (let n = 0; n <= 11; n++) {
      allCards.push({ color: c, number: n });
    }
  }

  const knownCards = new Set<string>();

  // 1. 自分自身の手札
  for (const c of cpuPlayer.cards) {
    knownCards.add(`${c.color}-${c.number}`);
  }
  // 2. 自分が引いたカード
  if (cpuDrawnCard) {
    knownCards.add(`${cpuDrawnCard.color}-${cpuDrawnCard.number}`);
  }
  // 3. 全プレイヤーのオープンカード
  for (const p of allPlayers) {
    for (const c of p.cards) {
      if (c.isOpen) {
        knownCards.add(`${c.color}-${c.number}`);
      }
    }
  }

  return allCards.filter((c) => !knownCards.has(`${c.color}-${c.number}`));
}

/**
 * 特定プレイヤーの裏向きカードについて、取りうる数字候補を計算
 */
export function getPossibleNumbersForTarget(
  targetIndex: number,
  targetHand: Card[],
  availableUnknownCards: { color: CardColor; number: number }[],
  logs: AttackLog[] = [],
  targetPlayerId: string = ''
): number[] {
  const targetCard = targetHand[targetIndex];
  if (targetCard.isOpen) return [];

  const targetColor = targetCard.color;

  // 1. 同色の未知カード
  let candidates = availableUnknownCards
    .filter((c) => c.color === targetColor)
    .map((c) => c.number);

  // 2. 左側のオープンカードによる下限チェック
  for (let i = targetIndex - 1; i >= 0; i--) {
    const leftCard = targetHand[i];
    if (leftCard.isOpen) {
      candidates = candidates.filter((candNum) => {
        const dummy: Card = {
          id: 'dummy',
          color: targetColor,
          number: candNum,
          isOpen: false,
        };
        return compareCards(leftCard, dummy) < 0;
      });
      break;
    }
  }

  // 3. 右側のオープンカードによる上限チェック
  for (let i = targetIndex + 1; i < targetHand.length; i++) {
    const rightCard = targetHand[i];
    if (rightCard.isOpen) {
      candidates = candidates.filter((candNum) => {
        const dummy: Card = {
          id: 'dummy',
          color: targetColor,
          number: candNum,
          isOpen: false,
        };
        return compareCards(dummy, rightCard) < 0;
      });
      break;
    }
  }

  // 4. 過去にそのカードに対して外した履歴を除外
  const failedGuesses = new Set<number>();
  for (const log of logs) {
    if (
      log.targetPlayerId === targetPlayerId &&
      log.targetCardIndex === targetIndex &&
      !log.isHit
    ) {
      failedGuesses.add(log.guessedNumber);
    }
  }
  candidates = candidates.filter((num) => !failedGuesses.has(num));

  return candidates;
}

/**
 * 2〜4人対戦におけるCPUのアタック決定ロジック
 */
export function decideMultiCpuAttack(
  currentCpu: Player,
  cpuDrawnCard: Card | null,
  allPlayers: Player[],
  difficulty: Difficulty,
  logs: AttackLog[] = []
): MultiCpuAttackDecision {
  // アタック対象となりうる相手プレイヤー一覧（脱落しておらず、伏せカードがあるプレイヤー）
  const opponents = allPlayers.filter(
    (p) => p.id !== currentCpu.id && !p.isEliminated && p.cards.some((c) => !c.isOpen)
  );

  if (opponents.length === 0) {
    return { targetPlayerId: '', targetCardIndex: 0, guessedNumber: 0 };
  }

  const unknownCards = getAvailableUnknownCardsMulti(currentCpu, cpuDrawnCard, allPlayers);

  interface TargetCandidate {
    playerId: string;
    cardIndex: number;
    candidates: number[];
  }

  const allTargetCandidates: TargetCandidate[] = [];

  for (const opp of opponents) {
    opp.cards.forEach((card, idx) => {
      if (!card.isOpen) {
        let cands = getPossibleNumbersForTarget(
          idx,
          opp.cards,
          unknownCards,
          difficulty === 'hard' ? logs : [],
          opp.id
        );
        if (cands.length === 0) {
          // フォールバック
          cands = unknownCards
            .filter((c) => c.color === card.color)
            .map((c) => c.number);
          if (cands.length === 0) cands = [0];
        }
        allTargetCandidates.push({
          playerId: opp.id,
          cardIndex: idx,
          candidates: cands,
        });
      }
    });
  }

  if (allTargetCandidates.length === 0) {
    return {
      targetPlayerId: opponents[0].id,
      targetCardIndex: 0,
      guessedNumber: 0,
    };
  }

  // Easy: ランダムな対象・ランダムな数字
  if (difficulty === 'easy') {
    const picked = allTargetCandidates[Math.floor(Math.random() * allTargetCandidates.length)];
    const guessedNumber = picked.candidates[Math.floor(Math.random() * picked.candidates.length)];
    return {
      targetPlayerId: picked.playerId,
      targetCardIndex: picked.cardIndex,
      guessedNumber,
    };
  }

  // Hard: 確定マス（候補数1）があれば最優先！
  if (difficulty === 'hard') {
    const confirmed = allTargetCandidates.find((tc) => tc.candidates.length === 1);
    if (confirmed) {
      return {
        targetPlayerId: confirmed.playerId,
        targetCardIndex: confirmed.cardIndex,
        guessedNumber: confirmed.candidates[0],
      };
    }
  }

  // Normal & Hard (確定なし): 最も候補数が少ない対象を選ぶ
  allTargetCandidates.sort((a, b) => a.candidates.length - b.candidates.length);
  const bestTarget = allTargetCandidates[0];
  const guessedNumber =
    difficulty === 'hard'
      ? bestTarget.candidates[Math.floor(bestTarget.candidates.length / 2)]
      : bestTarget.candidates[Math.floor(Math.random() * bestTarget.candidates.length)];

  return {
    targetPlayerId: bestTarget.playerId,
    targetCardIndex: bestTarget.cardIndex,
    guessedNumber,
  };
}

/**
 * アタック的中後の継続判定（マルチプレイヤー版）
 */
export function decideMultiCpuContinue(
  currentCpu: Player,
  cpuDrawnCard: Card | null,
  allPlayers: Player[],
  difficulty: Difficulty
): boolean {
  const opponents = allPlayers.filter(
    (p) => p.id !== currentCpu.id && !p.isEliminated && p.cards.some((c) => !c.isOpen)
  );
  if (opponents.length === 0) return false;

  if (difficulty === 'easy') return Math.random() > 0.6;

  // 確定できる相手カードがあるなら継続
  const unknownCards = getAvailableUnknownCardsMulti(currentCpu, cpuDrawnCard, allPlayers);
  for (const opp of opponents) {
    for (let i = 0; i < opp.cards.length; i++) {
      if (!opp.cards[i].isOpen) {
        const cands = getPossibleNumbersForTarget(i, opp.cards, unknownCards);
        if (cands.length === 1) return true;
      }
    }
  }

  if (difficulty === 'hard') {
    for (const opp of opponents) {
      for (let i = 0; i < opp.cards.length; i++) {
        if (!opp.cards[i].isOpen) {
          const cands = getPossibleNumbersForTarget(i, opp.cards, unknownCards);
          if (cands.length <= 2) return true;
        }
      }
    }
    return false;
  }

  return Math.random() < 0.25;
}
