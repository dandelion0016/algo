import { describe, expect, it } from 'vitest';
import { Card, GameState, Player } from '../../types/game';
import {
  reconcileGameState,
  sanitizeGameState,
  validateAndReconcileGameState,
} from '../stateReconciliation';

describe('stateReconciliation', () => {
  // テスト用ヘルパー: サンプルの健全なGameStateを生成
  const createHealthyState = (): GameState => {
    const player1Cards: Card[] = [
      { id: 'b-0', color: 'black', number: 0, isOpen: false },
      { id: 'w-2', color: 'white', number: 2, isOpen: false },
      { id: 'b-5', color: 'black', number: 5, isOpen: true },
      { id: 'w-9', color: 'white', number: 9, isOpen: false },
    ];
    const player2Cards: Card[] = [
      { id: 'b-1', color: 'black', number: 1, isOpen: false },
      { id: 'w-3', color: 'white', number: 3, isOpen: true },
      { id: 'b-7', color: 'black', number: 7, isOpen: false },
      { id: 'w-11', color: 'white', number: 11, isOpen: false },
    ];

    const players: Player[] = [
      {
        id: 'player-1',
        name: 'Player 1',
        isHuman: true,
        cards: player1Cards,
        isEliminated: false,
        avatarColor: 'from-blue-400 to-indigo-500',
      },
      {
        id: 'cpu-1',
        name: 'CPU 1',
        isHuman: false,
        cards: player2Cards,
        isEliminated: false,
        avatarColor: 'from-amber-300 to-yellow-500',
      },
    ];

    return {
      playerCount: 2,
      difficulty: 'normal',
      timeLimit: 30,
      remainingTime: 30,
      deck: [],
      players,
      activePlayerIndex: 0,
      drawnCard: null,
      phase: 'PLAYER_TURN_START',
      selectedTarget: null,
      logs: [],
      winner: null,
    };
  };

  describe('整合状態での検証 (No repair needed)', () => {
    it('健全な状態では wasRepaired が false かつ repairLogs が空であること', () => {
      const state = createHealthyState();
      const result = validateAndReconcileGameState(state);

      expect(result.wasRepaired).toBe(false);
      expect(result.repairLogs).toHaveLength(0);
      expect(result.state).toBe(state); // 参照同一性を維持
    });
  });

  describe('手札順序破壊時の自動整列 (Hand order repair)', () => {
    it('カードの数字が降順・乱順の場合、アルゴの昇順ルールに従って自動整列されること', () => {
      const state = createHealthyState();
      // 手札を逆順に破壊: 9w, 5b, 2w, 0b
      state.players[0].cards = [
        { id: 'w-9', color: 'white', number: 9, isOpen: false },
        { id: 'b-5', color: 'black', number: 5, isOpen: true },
        { id: 'w-2', color: 'white', number: 2, isOpen: false },
        { id: 'b-0', color: 'black', number: 0, isOpen: false },
      ];

      const result = validateAndReconcileGameState(state);

      expect(result.wasRepaired).toBe(true);
      expect(result.repairLogs.length).toBeGreaterThanOrEqual(1);
      expect(result.repairLogs[0]).toContain('hand cards were improperly sorted');

      // 整列後の手札が 0b, 2w, 5b, 9w になっていること
      const sortedIds = result.state.players[0].cards.map((c) => c.id);
      expect(sortedIds).toEqual(['b-0', 'w-2', 'b-5', 'w-9']);
      // オープン状態が保持されていること
      expect(result.state.players[0].cards[2].isOpen).toBe(true);
    });

    it('同数字で白が黒より先になっている場合、黒先白後のルールに従って自動整列されること', () => {
      const state = createHealthyState();
      // 3w, 3b (同一番号で白先黒後という不正な順序)
      state.players[0].cards = [
        { id: 'w-3', color: 'white', number: 3, isOpen: false },
        { id: 'b-3', color: 'black', number: 3, isOpen: false },
      ];

      const result = validateAndReconcileGameState(state);

      expect(result.wasRepaired).toBe(true);
      const sortedIds = result.state.players[0].cards.map((c) => c.id);
      expect(sortedIds).toEqual(['b-3', 'w-3']);
    });
  });

  describe('脱落フラグ不整合時の自己修復 (Elimination flag repair)', () => {
    it('伏せカードが1枚もないのに isEliminated === false の場合、true に更新されること', () => {
      const state = createHealthyState();
      // 全カードをオープンにする
      state.players[0].cards = state.players[0].cards.map((c) => ({ ...c, isOpen: true }));
      state.players[0].isEliminated = false;

      const result = validateAndReconcileGameState(state);

      expect(result.wasRepaired).toBe(true);
      expect(result.state.players[0].isEliminated).toBe(true);
      expect(result.repairLogs.some((log) => log.includes('Updated isEliminated to true'))).toBe(true);
    });

    it('伏せカードが残っているのに isEliminated === true の場合、false に補正されること', () => {
      const state = createHealthyState();
      // 伏せカードが存在するが脱落フラグが誤って立っている
      state.players[0].isEliminated = true;

      const result = validateAndReconcileGameState(state);

      expect(result.wasRepaired).toBe(true);
      expect(result.state.players[0].isEliminated).toBe(false);
      expect(result.repairLogs.some((log) => log.includes('Updated isEliminated to false'))).toBe(true);
    });

    it('手札が空（0枚）のプレイヤーは全オープン判定となり isEliminated が true になること', () => {
      const state = createHealthyState();
      state.players[0].cards = [];
      state.players[0].isEliminated = false;

      const result = validateAndReconcileGameState(state);

      expect(result.wasRepaired).toBe(true);
      expect(result.state.players[0].isEliminated).toBe(true);
    });
  });

  describe('手番インデックス脱落者指定時の生存者補正 (Active player index repair)', () => {
    it('activePlayerIndex が脱落プレイヤーを指している場合、次の生存プレイヤーへ自動補正されること', () => {
      const state = createHealthyState();
      // 3人対戦を作成
      state.playerCount = 3;
      state.players.push({
        id: 'cpu-2',
        name: 'CPU 2',
        isHuman: false,
        cards: [{ id: 'b-8', color: 'black', number: 8, isOpen: false }],
        isEliminated: false,
        avatarColor: 'from-emerald-400 to-teal-600',
      });

      // プレイヤー0を脱落させる（全オープン＋isEliminated: true）
      state.players[0].cards.forEach((c) => (c.isOpen = true));
      state.players[0].isEliminated = true;

      // 手番インデックスが脱落者(0)を指している
      state.activePlayerIndex = 0;

      const result = validateAndReconcileGameState(state);

      expect(result.wasRepaired).toBe(true);
      expect(result.state.activePlayerIndex).toBe(1); // 次の生存プレイヤー(CPU 1)へ補正
      expect(result.repairLogs.some((log) => log.includes('Shifted to next active player'))).toBe(true);
    });

    it('複数の脱落者が連続している場合、生存しているプレイヤーまでスキップして補正されること', () => {
      const state = createHealthyState();
      state.playerCount = 4;
      state.players.push(
        {
          id: 'cpu-2',
          name: 'CPU 2',
          isHuman: false,
          cards: [{ id: 'b-8', color: 'black', number: 8, isOpen: false }],
          isEliminated: false,
          avatarColor: 'from-emerald-400 to-teal-600',
        },
        {
          id: 'cpu-3',
          name: 'CPU 3',
          isHuman: false,
          cards: [{ id: 'w-10', color: 'white', number: 10, isOpen: false }],
          isEliminated: false,
          avatarColor: 'from-purple-400 to-pink-600',
        }
      );

      // プレイヤー0とプレイヤー1を脱落
      state.players[0].cards.forEach((c) => (c.isOpen = true));
      state.players[0].isEliminated = true;
      state.players[1].cards.forEach((c) => (c.isOpen = true));
      state.players[1].isEliminated = true;

      state.activePlayerIndex = 0;

      const result = validateAndReconcileGameState(state);

      expect(result.wasRepaired).toBe(true);
      expect(result.state.activePlayerIndex).toBe(2); // CPU 2 へスキップ
    });

    it('activePlayerIndex が負数または範囲外の場合、0 または有効なインデックスに補正されること', () => {
      const state = createHealthyState();
      state.activePlayerIndex = 99;

      const result = validateAndReconcileGameState(state);

      expect(result.wasRepaired).toBe(true);
      expect(result.state.activePlayerIndex).toBe(0);
      expect(result.repairLogs.some((log) => log.includes('activePlayerIndex was out of bounds'))).toBe(true);
    });
  });

  describe('勝者サバイバル決着の自己修復 (Game over & winner repair)', () => {
    it('生存プレイヤーが1名のみで phase !== GAME_OVER の場合、phase=GAME_OVER かつ winner が補正されること', () => {
      const state = createHealthyState();
      // プレイヤー0を脱落させる
      state.players[0].cards.forEach((c) => (c.isOpen = true));
      state.players[0].isEliminated = true;

      // 生存者はプレイヤー1 (cpu-1) のみ
      state.phase = 'PLAYER_TURN_START';
      state.winner = null;

      const result = validateAndReconcileGameState(state);

      expect(result.wasRepaired).toBe(true);
      expect(result.state.phase).toBe('GAME_OVER');
      expect(result.state.winner).not.toBeNull();
      expect(result.state.winner?.id).toBe('cpu-1');
      expect(result.repairLogs.some((log) => log.includes('Reconciled phase to "GAME_OVER"'))).toBe(true);
    });

    it('全員が脱落している異常状態の場合、phase=GAME_OVER かつ winner=null になること', () => {
      const state = createHealthyState();
      state.players[0].cards.forEach((c) => (c.isOpen = true));
      state.players[0].isEliminated = true;
      state.players[1].cards.forEach((c) => (c.isOpen = true));
      state.players[1].isEliminated = true;

      state.phase = 'CPU_ACTING';
      state.winner = null;

      const result = validateAndReconcileGameState(state);

      expect(result.wasRepaired).toBe(true);
      expect(result.state.phase).toBe('GAME_OVER');
      expect(result.state.winner).toBeNull();
    });

    it('既に GAME_OVER フェーズの場合は勝者再補正を行わないこと', () => {
      const state = createHealthyState();
      state.players[0].cards.forEach((c) => (c.isOpen = true));
      state.players[0].isEliminated = true;
      state.phase = 'GAME_OVER';
      state.winner = state.players[1];
      state.activePlayerIndex = 1;

      const result = validateAndReconcileGameState(state);

      expect(result.wasRepaired).toBe(false);
      expect(result.state.phase).toBe('GAME_OVER');
      expect(result.state.winner?.id).toBe('cpu-1');
    });
  });

  describe('複合不整合の包括的自己修復 (Multi-anomaly self-healing)', () => {
    it('手札順序乱れ、脱落判定不整合、手番脱落者、勝者未決着が同時に発生していても1回で全て完全修復されること', () => {
      const state = createHealthyState();

      // 1. プレイヤー0: 乱順手札 ＋ 伏せカードがあるのに脱落フラグtrue
      state.players[0].cards = [
        { id: 'w-8', color: 'white', number: 8, isOpen: false },
        { id: 'b-2', color: 'black', number: 2, isOpen: false },
      ];
      state.players[0].isEliminated = true;

      // 2. プレイヤー1: 全カードオープンなのに脱落フラグfalse
      state.players[1].cards = [
        { id: 'b-4', color: 'black', number: 4, isOpen: true },
        { id: 'w-6', color: 'white', number: 6, isOpen: true },
      ];
      state.players[1].isEliminated = false;

      // 3. activePlayerIndex が脱落予定のプレイヤー1(インデックス1)を指している
      state.activePlayerIndex = 1;
      state.phase = 'PLAYER_SELECT_TARGET';
      state.winner = null;

      const result = validateAndReconcileGameState(state);

      expect(result.wasRepaired).toBe(true);
      // ログが複数記録されていること
      expect(result.repairLogs.length).toBeGreaterThanOrEqual(4);

      // プレイヤー0の検証: 手札が b-2, w-8 にソートされ、isEliminated は false に復元
      expect(result.state.players[0].cards.map((c) => c.id)).toEqual(['b-2', 'w-8']);
      expect(result.state.players[0].isEliminated).toBe(false);

      // プレイヤー1の検証: 全オープンなので isEliminated は true に更新
      expect(result.state.players[1].isEliminated).toBe(true);

      // 生存者がプレイヤー0のみになったため GAME_OVER となり勝者がプレイヤー0に設定される
      expect(result.state.phase).toBe('GAME_OVER');
      expect(result.state.winner?.id).toBe('player-1');

      // 手番インデックスが生存プレイヤー0へ補正されること
      expect(result.state.activePlayerIndex).toBe(0);

      // 修復後のステートを再度自己修復にかけた場合、これ以上修復が発生しないこと（冪等性・Idempotency）
      const secondPass = validateAndReconcileGameState(result.state);
      expect(secondPass.wasRepaired).toBe(false);
      expect(secondPass.repairLogs).toHaveLength(0);
    });
  });

  describe('ヘルパー・エイリアス関数 (reconcileGameState, sanitizeGameState)', () => {
    it('reconcileGameState は修復済み GameState を直接返すこと', () => {
      const state = createHealthyState();
      state.players[0].cards = [
        { id: 'w-10', color: 'white', number: 10, isOpen: false },
        { id: 'b-1', color: 'black', number: 1, isOpen: false },
      ];

      const repairedState = reconcileGameState(state);
      expect(repairedState.players[0].cards.map((c) => c.id)).toEqual(['b-1', 'w-10']);
    });

    it('sanitizeGameState は reconcileGameState と同一の挙動を示すこと', () => {
      const state = createHealthyState();
      state.players[0].cards = [
        { id: 'w-10', color: 'white', number: 10, isOpen: false },
        { id: 'b-1', color: 'black', number: 1, isOpen: false },
      ];

      const sanitizedState = sanitizeGameState(state);
      expect(sanitizedState.players[0].cards.map((c) => c.id)).toEqual(['b-1', 'w-10']);
    });
  });
});
