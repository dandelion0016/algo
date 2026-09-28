import { Card, CardColor } from '../types/game';

/**
 * 24枚のアルゴデッキを生成（黒0〜11、白0〜11）
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  const colors: CardColor[] = ['black', 'white'];

  for (const color of colors) {
    for (let num = 0; num <= 11; num++) {
      deck.push({
        id: `${color[0]}-${num}`,
        color,
        number: num,
        isOpen: false,
      });
    }
  }

  return deck;
}

/**
 * デッキのシャッフル (Fisher-Yates)
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * アルゴの基本ソートルール比較関数
 * 1. 数字の小さい順
 * 2. 同じ数字の場合は「黒」が先（左）、「白」が後（右）
 */
export function compareCards(a: Card, b: Card): number {
  if (a.number !== b.number) {
    return a.number - b.number;
  }
  if (a.color === 'black' && b.color === 'white') return -1;
  if (a.color === 'white' && b.color === 'black') return 1;
  return 0;
}

/**
 * 手札をアルゴの基本ルールに従って整列
 */
export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort(compareCards);
}

/**
 * ゲーム開始時の初期配札
 * プレイヤーとCPUに4枚ずつ配り、それぞれ整列。残りを山札として返す。
 */
export function dealInitialCards(deck: Card[]): {
  playerCards: Card[];
  cpuCards: Card[];
  remainingDeck: Card[];
} {
  const shuffled = shuffleDeck(deck);
  const playerRaw = shuffled.slice(0, 4);
  const cpuRaw = shuffled.slice(4, 8);
  const remainingDeck = shuffled.slice(8);

  return {
    playerCards: sortCards(playerRaw),
    cpuCards: sortCards(cpuRaw),
    remainingDeck,
  };
}

/**
 * 手札にカードをルール通りの正しい位置に挿入
 */
export function insertCardInOrder(hand: Card[], newCard: Card): Card[] {
  return sortCards([...hand, newCard]);
}

/**
 * 全てのカードがオープン（表向き）になっているか判定（勝敗判定用）
 */
export function isAllOpen(cards: Card[]): boolean {
  return cards.every((c) => c.isOpen);
}

/**
 * 指定インデックスのカードがアタック予想数字と一致するか判定
 */
export function checkAttack(
  targetCard: Card,
  guessedNumber: number
): boolean {
  return targetCard.number === guessedNumber;
}
