import { Card, CardColor, Player, AttackLog } from '../types/game';
import { getPossibleNumbersForCard } from './candidateAssist';

/**
 * AIヒント推薦結果型
 */
export interface HintResult {
  targetPlayerId: string;
  targetPlayerName: string;
  targetCardIndex: number;
  color: CardColor;
  possibleNumbers: number[];
  isDefinite: boolean;
  adviceText: string;
}

/**
 * カードの位置（日本語表現）を取得
 * 例:
 * - totalCards > 1 かつ 末尾インデックス -> "右端の"
 * - それ以外 -> "左から{index + 1}枚目の"
 */
export function getCardPositionText(index: number, totalCards: number): string {
  if (totalCards > 1 && index === totalCards - 1) {
    return '右端の';
  }
  return `左から${index + 1}枚目の`;
}

/**
 * 推理アドバイス文の生成
 */
export function generateAdviceText(
  playerName: string,
  index: number,
  totalCards: number,
  color: CardColor,
  possibleNumbers: number[]
): string {
  const posText = getCardPositionText(index, totalCards);
  const colorText = color === 'black' ? '黒' : '白';
  const numbersText = `[${possibleNumbers.join(', ')}]`;

  if (possibleNumbers.length === 1) {
    return `${playerName}の${posText}${colorText}カードは ${numbersText} に確定しています！`;
  }

  if (possibleNumbers.length > 1) {
    return `${playerName}の${posText}${colorText}カードは ${numbersText} の${possibleNumbers.length}択に絞り込まれています！`;
  }

  return `${playerName}の${posText}${colorText}カードの候補が見つかりませんでした。`;
}

/**
 * 対戦相手の伏せカードの中から、最も候補数字が少ない（＝正解確率が最も高い）カードをAIが推薦
 *
 * @param players ゲームに参加している全プレイヤー一覧
 * @param drawnCard 現在ドローしているカード（存在する場合）
 * @param logs アタック履歴ログ
 * @returns 最適なヒント推薦結果（対象が存在しない場合は null）
 */
export function getBestHint(
  players: Player[],
  drawnCard?: Card | null,
  logs?: AttackLog[]
): HintResult | null {
  // 対戦相手（脱落しておらず、人間でないプレイヤー）を抽出
  const opponents = players.filter((p) => !p.isHuman && !p.isEliminated);
  if (opponents.length === 0) {
    return null;
  }

  interface CandidateCardInfo {
    player: Player;
    cardIndex: number;
    card: Card;
    possibleNumbers: number[];
  }

  const candidateCards: CandidateCardInfo[] = [];

  for (const opp of opponents) {
    for (let idx = 0; idx < opp.cards.length; idx++) {
      const card = opp.cards[idx];
      // 伏せカードのみ対象
      if (card.isOpen) continue;

      const possibleNumbers = getPossibleNumbersForCard({
        targetIndex: idx,
        targetHand: opp.cards,
        allPlayers: players,
        drawnCard: drawnCard ?? undefined,
        logs,
        targetPlayerId: opp.id,
      });

      if (possibleNumbers.length > 0) {
        candidateCards.push({
          player: opp,
          cardIndex: idx,
          card,
          possibleNumbers,
        });
      }
    }
  }

  if (candidateCards.length === 0) {
    return null;
  }

  // 候補数が最も少ないものを優先ソート（候補1つの確定カードが最優先）
  candidateCards.sort((a, b) => {
    if (a.possibleNumbers.length !== b.possibleNumbers.length) {
      return a.possibleNumbers.length - b.possibleNumbers.length;
    }
    // 候補数が同じ場合はインデックス順（左側優先）
    return a.cardIndex - b.cardIndex;
  });

  const best = candidateCards[0];
  const isDefinite = best.possibleNumbers.length === 1;
  const adviceText = generateAdviceText(
    best.player.name,
    best.cardIndex,
    best.player.cards.length,
    best.card.color,
    best.possibleNumbers
  );

  return {
    targetPlayerId: best.player.id,
    targetPlayerName: best.player.name,
    targetCardIndex: best.cardIndex,
    color: best.card.color,
    possibleNumbers: best.possibleNumbers,
    isDefinite,
    adviceText,
  };
}
