export type CardColor = 'black' | 'white';

/**
 * 内部保持用カード型 (SecretCard)
 * 所有者またはゲームマスター・判定エンジンのみが保持する真のカード情報
 */
export interface SecretCard {
  id: string;        // 例: "b-3", "w-7"
  color: CardColor;
  number: number;    // 0..11
  isOpen: boolean;   // 表向きかどうか
}

/**
 * 公開・描画用カード型 (PublicCard)
 * 他プレイヤーに開示可能な情報のみを含む。
 * isOpen === false かつ相手カードの場合は number は null にマスキングされる。
 */
export interface PublicCard {
  id: string;        // 例: "b-3", "w-7"
  color: CardColor;
  number: number | null; // 0..11 または 伏せ状態の相手カードは null
  isOpen: boolean;   // 表向きかどうか
}

/**
 * 互換性維持のための Card 型エイリアス（実体は SecretCard）
 */
export type Card = SecretCard;

export type PlayerCount = 2 | 3 | 4;
export type Difficulty = 'easy' | 'normal' | 'hard';
export type TimeLimit = 0 | 15 | 30; // 0 = 制限なし, 15秒, 30秒

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  cards: Card[];
  isEliminated: boolean;
  avatarColor: string;
}

export type GamePhase =
  | 'SETUP'                 // 初期設定（人数・難易度・持ち時間選択）
  | 'PLAYER_TURN_START'     // プレイヤードロー待ち
  | 'PLAYER_SELECT_TARGET'  // 相手の裏向きカードを選択中
  | 'PLAYER_GUESS_NUMBER'   // 数字を予想入力中
  | 'PLAYER_DECIDE_NEXT'    // アタック成功後の継続/ステイ選択
  | 'CPU_ACTING'            // CPU思考・実行中
  | 'GAME_OVER';            // 決着

export interface AttackLog {
  id: string;
  attackerId: string;
  attackerName: string;
  targetPlayerId: string;
  targetPlayerName: string;
  targetCardIndex: number;
  targetColor: CardColor;
  guessedNumber: number;
  isHit: boolean;
  actualNumber?: number;
  drawnCard?: Card;
  timestamp: number;
  message: string;
}

export interface GameState {
  playerCount: PlayerCount;
  difficulty: Difficulty;
  timeLimit: TimeLimit;
  remainingTime: number;
  deck: Card[];
  players: Player[];
  activePlayerIndex: number;
  drawnCard: Card | null;
  phase: GamePhase;
  selectedTarget: {
    playerId: string;
    cardIndex: number;
  } | null;
  logs: AttackLog[];
  winner: Player | null;
}
