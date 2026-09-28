export type CardColor = 'black' | 'white';

export interface Card {
  id: string;        // 例: "b-3", "w-7"
  color: CardColor;
  number: number;    // 0..11
  isOpen: boolean;   // 表向きかどうか
}

export type PlayerType = 'player' | 'cpu';

export type GamePhase =
  | 'INITIAL'              // ゲーム開始準備
  | 'PLAYER_TURN_START'    // プレイヤーターン開始（ドロー待ち）
  | 'PLAYER_SELECT_TARGET' // 相手の裏向きカードを選択中
  | 'PLAYER_GUESS_NUMBER'  // 数字を予想入力中
  | 'PLAYER_DECIDE_NEXT'   // アタック成功後の継続/ステイ選択
  | 'CPU_THINKING'         // CPU思考中
  | 'ROUND_RESOLVE'        // アタック結果の演出・確認
  | 'GAME_OVER';           // 決着

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface AttackLog {
  id: string;
  attacker: PlayerType;
  targetIndex: number;
  targetColor: CardColor;
  guessedNumber: number;
  isHit: boolean;
  actualNumber?: number;
  drawnCard?: Card;
  timestamp: number;
  message: string;
}

export interface GameState {
  deck: Card[];
  playerCards: Card[];
  cpuCards: Card[];
  playerDrawnCard: Card | null;
  cpuDrawnCard: Card | null;
  currentTurn: PlayerType;
  phase: GamePhase;
  selectedTargetIndex: number | null;
  difficulty: Difficulty;
  logs: AttackLog[];
  winner: PlayerType | null;
}
