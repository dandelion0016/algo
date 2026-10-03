import { Card, CardColor, Player, PublicCard } from '../types/game';

export interface TrackedCard {
  color: CardColor;
  number: number;
  isConfirmed: boolean; // 確定済み（自分の手札、全オープンカード、自分が引いたカード）
  isHighlighted: boolean; // 推理アシスト等のハイライト対象
}

export interface DeckTrackerSummary {
  totalRemaining: number; // 未確定カード総数（0〜24）
  blackRemaining: number; // 黒の未確定カード数（0〜12）
  whiteRemaining: number; // 白の未確定カード数（0〜12）
  totalConfirmed: number; // 確定済みカード総数（0〜24）
  blackConfirmed: number; // 黒の確定済みカード数（0〜12）
  whiteConfirmed: number; // 白の確定済みカード数（0〜12）
}

export interface DeckTrackerState {
  blackCards: TrackedCard[]; // 0..11
  whiteCards: TrackedCard[]; // 0..11
  summary: DeckTrackerSummary;
}

export interface DeckTrackerOptions {
  players: Player[];
  drawnCard?: Card | null;
  highlightedNumbers?: number[];
  highlightColor?: CardColor | null;
}

/**
 * プレイヤー（人間）視点での確定済みカード数字セット（黒・白）を抽出
 * Information Hidingを厳守し、相手の裏向きカードや山札のカードの非公開数字は一切参照しない。
 */
export function getConfirmedCardSets(
  players: Player[],
  drawnCard?: Card | null
): { black: Set<number>; white: Set<number> } {
  const confirmed = {
    black: new Set<number>(),
    white: new Set<number>(),
  };

  // 1. 人間プレイヤー（自分）の手札（表裏問わず自分のカードは数字を知っている）
  const humanPlayer = players.find((p) => p.isHuman);
  if (humanPlayer) {
    humanPlayer.cards.forEach((c) => {
      if (typeof c.number === 'number') {
        confirmed[c.color].add(c.number);
      }
    });
  }

  // 2. 全プレイヤーのオープン済みカード
  players.forEach((p) => {
    p.cards.forEach((c) => {
      if (c.isOpen && typeof c.number === 'number') {
        confirmed[c.color].add(c.number);
      }
    });
  });

  // 3. プレイヤーが引いたカード（drawnCard）
  // プレイヤーが引いたカードは自分視点で確定
  if (drawnCard && typeof drawnCard.number === 'number') {
    confirmed[drawnCard.color].add(drawnCard.number);
  }

  return confirmed;
}

/**
 * 全24枚（黒0..11、白0..11）のカードプール状態を計算する
 */
export function calculateDeckTrackerState(options: DeckTrackerOptions): DeckTrackerState {
  const { players, drawnCard, highlightedNumbers = [], highlightColor = null } = options;

  const confirmedSets = getConfirmedCardSets(players, drawnCard);
  const highlightSet = new Set<number>(highlightedNumbers);

  const blackCards: TrackedCard[] = [];
  const whiteCards: TrackedCard[] = [];

  let blackConfirmed = 0;
  let whiteConfirmed = 0;

  for (let num = 0; num <= 11; num++) {
    // 黒カード
    const isBlackConfirmed = confirmedSets.black.has(num);
    if (isBlackConfirmed) blackConfirmed++;
    const isBlackHighlighted =
      !isBlackConfirmed &&
      highlightSet.has(num) &&
      (highlightColor === null || highlightColor === 'black');

    blackCards.push({
      color: 'black',
      number: num,
      isConfirmed: isBlackConfirmed,
      isHighlighted: isBlackHighlighted,
    });

    // 白カード
    const isWhiteConfirmed = confirmedSets.white.has(num);
    if (isWhiteConfirmed) whiteConfirmed++;
    const isWhiteHighlighted =
      !isWhiteConfirmed &&
      highlightSet.has(num) &&
      (highlightColor === null || highlightColor === 'white');

    whiteCards.push({
      color: 'white',
      number: num,
      isConfirmed: isWhiteConfirmed,
      isHighlighted: isWhiteHighlighted,
    });
  }

  const blackRemaining = 12 - blackConfirmed;
  const whiteRemaining = 12 - whiteConfirmed;
  const totalConfirmed = blackConfirmed + whiteConfirmed;
  const totalRemaining = blackRemaining + whiteRemaining;

  return {
    blackCards,
    whiteCards,
    summary: {
      totalRemaining,
      blackRemaining,
      whiteRemaining,
      totalConfirmed,
      blackConfirmed,
      whiteConfirmed,
    },
  };
}

/**
 * 対象カードの色の未確定残弾数字配列（昇順）を取得 (Issue #113)
 * Information Hidingを厳守し、相手の裏向きカードや山札のカードの非公開数字は一切参照しない。
 */
export function getRemainingDeckNumbers(
  players: Player[],
  color: CardColor,
  drawnCard?: Card | null
): number[] {
  const confirmedSets = getConfirmedCardSets(players, drawnCard);
  const confirmed = confirmedSets[color];
  const remaining: number[] = [];
  for (let num = 0; num <= 11; num++) {
    if (!confirmed.has(num)) {
      remaining.push(num);
    }
  }
  return remaining;
}
