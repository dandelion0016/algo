import { Card, GameState, Player } from '../types/game';
import { compareCards, getNextActivePlayerIndex, isAllOpen, sortCards } from './algoEngine';

/**
 * 自己修復結果インターフェース
 */
export interface ReconciliationResult {
  state: GameState;
  wasRepaired: boolean;
  repairLogs: string[];
}

/**
 * 手札がアルゴの整列ルールに従っているかを検証
 */
function isHandSorted(cards: Card[]): boolean {
  for (let i = 0; i < cards.length - 1; i++) {
    if (compareCards(cards[i], cards[i + 1]) > 0) {
      return false;
    }
  }
  return true;
}

/**
 * ゲーム状態の整合性を検証し、不整合が存在する場合は自動修復（Self-Healing）を行う
 *
 * 修復項目:
 * 1. 手札順序の修復: compareCards による昇順（数字昇順、同数字は黒先白後）に乱れがあれば sortCards で再整列
 * 2. 脱落判定の修復: 伏せカードがないのに isEliminated=false なら true、伏せカードがあるのに isEliminated=true なら false に補正
 * 3. 勝者判定の修復: 生存プレイヤーが1名以下で phase !== 'GAME_OVER' の場合、phase='GAME_OVER' および winner を補正
 * 4. 手番インデックスの修復: activePlayerIndex が脱落プレイヤーを指している場合、getNextActivePlayerIndex で次の生存プレイヤーへ補正
 */
export function validateAndReconcileGameState(state: GameState): ReconciliationResult {
  const repairLogs: string[] = [];
  let wasRepaired = false;

  // 1 & 2. プレイヤー手札順序および脱落判定の修復
  const reconciledPlayers: Player[] = state.players.map((player) => {
    let cards = player.cards;
    let isEliminated = player.isEliminated;
    let playerModified = false;

    // 手札順序の検証
    if (!isHandSorted(cards)) {
      cards = sortCards(cards);
      playerModified = true;
      wasRepaired = true;
      repairLogs.push(
        `Player "${player.name}" (${player.id}) hand cards were improperly sorted. Re-sorted according to algo rules.`
      );
    }

    // 脱落フラグの検証 (伏せカードが0枚、つまり全カードがオープンなら脱落)
    const shouldBeEliminated = isAllOpen(cards);
    if (shouldBeEliminated && !player.isEliminated) {
      isEliminated = true;
      playerModified = true;
      wasRepaired = true;
      repairLogs.push(
        `Player "${player.name}" (${player.id}) has no face-down cards remaining but was not marked eliminated. Updated isEliminated to true.`
      );
    } else if (!shouldBeEliminated && player.isEliminated) {
      isEliminated = false;
      playerModified = true;
      wasRepaired = true;
      repairLogs.push(
        `Player "${player.name}" (${player.id}) still has face-down cards remaining but was marked eliminated. Updated isEliminated to false.`
      );
    }

    if (playerModified) {
      return {
        ...player,
        cards,
        isEliminated,
      };
    }
    return player;
  });

  // 3. 生存プレイヤーおよび勝者判定の修復
  const activePlayers = reconciledPlayers.filter((p) => !p.isEliminated);
  let reconciledPhase = state.phase;
  let reconciledWinner = state.winner;

  if (activePlayers.length <= 1 && state.phase !== 'GAME_OVER') {
    reconciledPhase = 'GAME_OVER';
    reconciledWinner = activePlayers.length === 1 ? activePlayers[0] : null;
    wasRepaired = true;
    repairLogs.push(
      `Game phase was "${state.phase}" with ${activePlayers.length} active player(s). Reconciled phase to "GAME_OVER" and winner to ${
        reconciledWinner ? `"${reconciledWinner.name}" (${reconciledWinner.id})` : 'null'
      }.`
    );
  }

  // 4. 手番インデックスの修復
  let reconciledActivePlayerIndex = state.activePlayerIndex;

  // インデックスの境界値チェック
  if (
    reconciledPlayers.length > 0 &&
    (reconciledActivePlayerIndex < 0 || reconciledActivePlayerIndex >= reconciledPlayers.length)
  ) {
    const fallbackIndex = 0;
    repairLogs.push(
      `activePlayerIndex was out of bounds (${reconciledActivePlayerIndex}). Reset to ${fallbackIndex}.`
    );
    reconciledActivePlayerIndex = fallbackIndex;
    wasRepaired = true;
  }

  // 脱落者を指している場合の修復
  if (
    reconciledPlayers.length > 0 &&
    reconciledPlayers[reconciledActivePlayerIndex]?.isEliminated &&
    activePlayers.length > 0
  ) {
    const nextIndex = getNextActivePlayerIndex(reconciledActivePlayerIndex, reconciledPlayers);
    if (nextIndex !== reconciledActivePlayerIndex) {
      repairLogs.push(
        `activePlayerIndex (${reconciledActivePlayerIndex}) pointed to eliminated player "${reconciledPlayers[reconciledActivePlayerIndex].name}". Shifted to next active player "${reconciledPlayers[nextIndex].name}" (${nextIndex}).`
      );
      reconciledActivePlayerIndex = nextIndex;
      wasRepaired = true;
    }
  }

  if (!wasRepaired) {
    return {
      state,
      wasRepaired: false,
      repairLogs: [],
    };
  }

  return {
    state: {
      ...state,
      players: reconciledPlayers,
      phase: reconciledPhase,
      winner: reconciledWinner,
      activePlayerIndex: reconciledActivePlayerIndex,
    },
    wasRepaired: true,
    repairLogs,
  };
}

/**
 * validateAndReconcileGameState の簡略ラッパー
 * 修復済みの GameState を直接返却する
 */
export function reconcileGameState(state: GameState): GameState {
  return validateAndReconcileGameState(state).state;
}

/**
 * docs/design/backend/error-handling.md との互換性のためのエイリアス
 */
export const sanitizeGameState = reconcileGameState;
