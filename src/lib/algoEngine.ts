import { Card, CardColor, Player, PlayerCount, PublicCard } from '../types/game';

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
 * 手札にカードをルール通りの正しい位置に挿入
 */
export function insertCardInOrder(hand: Card[], newCard: Card): Card[] {
  return sortCards([...hand, newCard]);
}

/**
 * 人数に応じた初期手札枚数を取得（アルゴ公式ルール）
 * 2人: 4枚
 * 3人: 3枚
 * 4人: 2枚
 */
export function getInitialCardCount(playerCount: PlayerCount): number {
  switch (playerCount) {
    case 2:
      return 4;
    case 3:
      return 3;
    case 4:
      return 2;
    default:
      return 4;
  }
}

/**
 * プレイヤー初期化情報
 */
const CPU_PROFILES = [
  { name: 'CPU アル', color: 'from-blue-400 to-indigo-500' },
  { name: 'CPU ゴオ', color: 'from-amber-300 to-yellow-500' },
  { name: 'CPU ルウ', color: 'from-emerald-400 to-teal-600' },
];

/**
 * 2〜4人のプレイヤーと初期配札をセットアップ
 */
export function setupGamePlayers(
  deck: Card[],
  playerCount: PlayerCount,
  humanPlayerId: string = 'player'
): {
  players: Player[];
  remainingDeck: Card[];
} {
  const shuffled = shuffleDeck(deck);
  const cardCount = getInitialCardCount(playerCount);

  const players: Player[] = [];
  let cursor = 0;

  // 1. プレイヤー（人間）
  const playerRawCards = shuffled.slice(cursor, cursor + cardCount);
  cursor += cardCount;
  players.push({
    id: humanPlayerId,
    name: 'あなた',
    isHuman: true,
    cards: sortCards(playerRawCards),
    isEliminated: false,
    avatarColor: 'from-sky-400 to-blue-600',
  });

  // 2. CPUプレイヤー
  for (let i = 0; i < playerCount - 1; i++) {
    const cpuCards = shuffled.slice(cursor, cursor + cardCount);
    cursor += cardCount;
    players.push({
      id: `cpu-${i + 1}`,
      name: CPU_PROFILES[i].name,
      isHuman: false,
      cards: sortCards(cpuCards),
      isEliminated: false,
      avatarColor: CPU_PROFILES[i].color,
    });
  }

  const remainingDeck = shuffled.slice(cursor);

  return {
    players,
    remainingDeck,
  };
}

/**
 * 全てのカードがオープン（表向き）になっているか判定
 */
export function isAllOpen(cards: Card[]): boolean {
  return cards.every((c) => c.isOpen);
}

/**
 * アタック正否判定
 */
export function checkAttack(targetCard: Card, guessedNumber: number): boolean {
  return targetCard.number === guessedNumber;
}

/**
 * 次の手番プレイヤーインデックスを取得（脱落者をスキップ）
 */
export function getNextActivePlayerIndex(
  currentIndex: number,
  players: Player[]
): number {
  const total = players.length;
  for (let i = 1; i <= total; i++) {
    const nextIdx = (currentIndex + i) % total;
    if (!players[nextIdx].isEliminated) {
      return nextIdx;
    }
  }
  return currentIndex;
}

/**
 * プレイヤー視点に応じたカードマスキング関数 (Information Hiding)
 * - 表向き(isOpen === true) または 自分所有(isOwner === true)の場合は number をそのまま保持
 * - それ以外（相手の裏向きカード）は number を null に置換して覗き見を防止
 */
export function maskCardForPlayer(card: Card, isOwner: boolean): PublicCard {
  if (card.isOpen || isOwner) {
    return {
      id: card.id,
      color: card.color,
      number: card.number,
      isOpen: card.isOpen,
    };
  }
  return {
    id: card.id,
    color: card.color,
    number: null,
    isOpen: false,
  };
}
