export type CardColor = 'black' | 'white';

export interface Card {
  id: string;        // 例: "b-3", "w-7"
  color: CardColor;
  number: number;    // 0..11
  isOpen: boolean;   // 表向きかどうか
}

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
