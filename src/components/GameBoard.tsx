'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, GameState, Difficulty, PlayerCount, TimeLimit, AttackLog, Player } from '../types/game';
import {
  createDeck,
  setupGamePlayers,
  insertCardInOrder,
  isAllOpen,
  checkAttack,
  getNextActivePlayerIndex,
  maskCardForPlayer,
} from '../lib/algoEngine';
import { decideMultiCpuAttack, decideMultiCpuContinue } from '../lib/cpuAI';
import { CardComponent } from './CardComponent';
import { AttackModal } from './AttackModal';
import { GameLog } from './GameLog';
import { RuleGuideModal } from './RuleGuideModal';
import { SetupModal } from './SetupModal';
import { ConfirmModal } from './ConfirmModal';
import { ResultModal } from './ResultModal';
import { useUserSession } from '../hooks/useUserSession';
import {
  Layers,
  Sparkles,
  Trophy,
  RotateCcw,
  BookOpen,
  Bot,
  User,
  Settings2,
  Clock,
  AlertTriangle,
  Flame,
} from 'lucide-react';

/**
 * 持ち時間タイマー演出のボタンスタイルクラス（4.2節、Issue #15）
 * - PAUSED: アンバー点滅
 * - 残り5秒未満（5秒〜1秒）: ローズレッド点滅（animate-pulse, ring-2 ring-rose-200）
 * - 残り10秒未満（9秒〜6秒）: イエロー/アンバー警告表示
 * - 残り10秒以上: スカイブルー通常表示
 */
export const getTimerColorClass = (remainingTime: number, isTimerPaused: boolean): string => {
  if (isTimerPaused) {
    return 'bg-amber-50 border-amber-300 text-amber-700 ring-2 ring-amber-200 animate-pulse hover:bg-amber-100';
  }
  if (remainingTime <= 5) {
    return 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse ring-2 ring-rose-200 hover:bg-rose-100';
  }
  if (remainingTime < 10) {
    return 'bg-amber-50 border-amber-300 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100';
  }
  return 'bg-algo-blue-light/60 border-algo-blue/30 text-algo-navy hover:bg-algo-blue-light/80';
};

/**
 * タイマープログレスバーのカラークラス
 */
export const getProgressBarColorClass = (remainingTime: number, isTimerPaused: boolean): string => {
  if (isTimerPaused) {
    return 'bg-amber-400';
  }
  if (remainingTime <= 5) {
    return 'bg-rose-500';
  }
  if (remainingTime < 10) {
    return 'bg-amber-400';
  }
  return 'bg-algo-blue';
};

/**
 * 持ち時間に対する残り時間の割合（%）を計算（0〜100）
 */
export const calculateProgressPercentage = (remainingTime: number, timeLimit: number): number => {
  if (timeLimit <= 0) return 100;
  return Math.max(0, Math.min(100, (remainingTime / timeLimit) * 100));
};

/**
 * タイムアップ時の警告メッセージ定数
 */
export const TIME_UP_MESSAGE =
  '⚠️ TIME UP! 制限時間を超過したため、引いたカードが強制オープンされました';

export interface GameBoardProps {
  initialState?: Partial<GameState>;
  initialTimeUpBanner?: string | null;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  initialState,
  initialTimeUpBanner = null,
}) => {
  const { userId } = useUserSession();

  const [gameState, setGameState] = useState<GameState>(() => ({
    playerCount: 2,
    difficulty: 'normal',
    timeLimit: 30,
    remainingTime: 30,
    deck: [],
    players: [],
    activePlayerIndex: 0,
    drawnCard: null,
    phase: 'SETUP',
    selectedTarget: null,
    logs: [],
    winner: null,
    ...initialState,
  }));

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(true);
  const [isManualPaused, setIsManualPaused] = useState(false);
  const [cpuStatusMessage, setCpuStatusMessage] = useState<string>('');
  const [timeUpBanner, setTimeUpBanner] = useState<string | null>(initialTimeUpBanner);

  // HITL確認モーダル状態 (SCR-008)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    actionType: 'RESTART' | 'SETUP' | 'CUSTOM';
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirmCallback?: () => void;
  }>({
    isOpen: false,
    actionType: 'RESTART',
  });

  // 新規ゲーム初期化
  const initializeGame = useCallback(
    (
      count: PlayerCount = gameState.playerCount,
      diff: Difficulty = gameState.difficulty,
      limit: TimeLimit = gameState.timeLimit
    ) => {
      const rawDeck = createDeck();
      const currentUserId = userId || 'player';
      const { players, remainingDeck } = setupGamePlayers(rawDeck, count, currentUserId);

      setGameState({
        playerCount: count,
        difficulty: diff,
        timeLimit: limit,
        remainingTime: limit,
        deck: remainingDeck,
        players,
        activePlayerIndex: 0, // 人間先攻
        drawnCard: null,
        phase: 'PLAYER_TURN_START',
        selectedTarget: null,
        logs: [],
        winner: null,
      });
      setCpuStatusMessage('');
      setIsManualPaused(false);
      setTimeUpBanner(null);
      setIsResultModalOpen(true);
    },
    [gameState.playerCount, gameState.difficulty, gameState.timeLimit, userId]
  );

  // GAME_OVER 遷移時に決着モーダルを自動オープン
  useEffect(() => {
    if (gameState.phase === 'GAME_OVER') {
      setIsResultModalOpen(true);
    }
  }, [gameState.phase]);

  // タイムアップ警告バナーの自動消去タイマー（6秒後に消去）
  useEffect(() => {
    if (timeUpBanner) {
      const timer = setTimeout(() => {
        setTimeUpBanner(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [timeUpBanner]);

  // ゲームが進行中（未決着かつセットアップ以外）かどうかの判定
  const isGameInProgress =
    gameState.phase !== 'SETUP' &&
    gameState.phase !== 'GAME_OVER' &&
    gameState.winner === null;

  // タイマー一時停止（Pause）判定: ルールモーダル、HITL確認モーダル、または手動ポーズ時
  const isTimerPaused = Boolean(
    (isRuleModalOpen || confirmModal.isOpen || isManualPaused) &&
      isGameInProgress &&
      gameState.phase !== 'CPU_ACTING'
  );

  // 新しい手番開始時に手動ポーズ状態を初期化
  useEffect(() => {
    if (gameState.phase === 'PLAYER_TURN_START') {
      setIsManualPaused(false);
    }
  }, [gameState.phase, gameState.activePlayerIndex]);

  // 再戦リクエスト（HITLガード）
  const handleRequestRestart = useCallback(() => {
    if (!isGameInProgress) {
      initializeGame();
      return;
    }

    setConfirmModal({
      isOpen: true,
      actionType: 'RESTART',
      isDestructive: true,
      onConfirmCallback: () => {
        initializeGame();
      },
    });
  }, [isGameInProgress, initializeGame]);

  // 設定画面戻りリクエスト（HITLガード）
  const handleRequestSetup = useCallback(() => {
    if (!isGameInProgress) {
      setGameState((prev) => ({ ...prev, phase: 'SETUP' }));
      return;
    }

    setConfirmModal({
      isOpen: true,
      actionType: 'SETUP',
      isDestructive: false,
      onConfirmCallback: () => {
        setGameState((prev) => ({ ...prev, phase: 'SETUP' }));
      },
    });
  }, [isGameInProgress]);

  // 確認モーダルキャンセル
  const handleCloseConfirmModal = useCallback(() => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // 確認モーダル承認実行
  const handleConfirmModalAction = useCallback(() => {
    setConfirmModal((prev) => {
      if (prev.onConfirmCallback) {
        prev.onConfirmCallback();
      }
      return { ...prev, isOpen: false };
    });
  }, []);

  // マウント後に userId が確定した際、既存の人間プレイヤーの id を更新
  useEffect(() => {
    if (userId) {
      setGameState((prev) => {
        const humanPlayer = prev.players.find((p) => p.isHuman);
        if (humanPlayer && humanPlayer.id !== userId) {
          return {
            ...prev,
            players: prev.players.map((p) => (p.isHuman ? { ...p, id: userId } : p)),
          };
        }
        return prev;
      });
    }
  }, [userId]);

  // プレイヤーが山札からドロー
  const handlePlayerDraw = () => {
    if (gameState.phase !== 'PLAYER_TURN_START') return;

    if (gameState.deck.length === 0) {
      setGameState((prev) => ({
        ...prev,
        drawnCard: null,
        phase: 'PLAYER_SELECT_TARGET',
      }));
      return;
    }

    const drawn = gameState.deck[0];
    const nextDeck = gameState.deck.slice(1);

    setGameState((prev) => ({
      ...prev,
      deck: nextDeck,
      drawnCard: drawn,
      phase: 'PLAYER_SELECT_TARGET',
    }));
  };

  // プレイヤーが相手の伏せカードを選択
  const handleSelectTargetCard = (playerId: string, cardIndex: number) => {
    if (gameState.phase !== 'PLAYER_SELECT_TARGET') return;

    const targetPlayer = gameState.players.find((p) => p.id === playerId);
    if (!targetPlayer || targetPlayer.isEliminated || targetPlayer.cards[cardIndex].isOpen) {
      return;
    }

    setGameState((prev) => ({
      ...prev,
      selectedTarget: { playerId, cardIndex },
      phase: 'PLAYER_GUESS_NUMBER',
    }));
  };

  // プレイヤーが数字を予想してアタック確定
  const handleConfirmGuess = (guessedNumber: number) => {
    if (gameState.phase !== 'PLAYER_GUESS_NUMBER' || !gameState.selectedTarget) return;

    const { playerId, cardIndex } = gameState.selectedTarget;
    const targetPlayer = gameState.players.find((p) => p.id === playerId);
    if (!targetPlayer) return;

    const targetCard = targetPlayer.cards[cardIndex];
    const isHit = checkAttack(targetCard, guessedNumber);

    const humanPlayer = gameState.players.find((p) => p.isHuman);
    const currentUserId = userId || humanPlayer?.id || 'player';

    const log: AttackLog = {
      id: `log-${Date.now()}`,
      attackerId: currentUserId,
      attackerName: humanPlayer?.name || 'あなた',
      targetPlayerId: targetPlayer.id,
      targetPlayerName: targetPlayer.name,
      targetCardIndex: cardIndex,
      targetColor: targetCard.color,
      guessedNumber,
      isHit,
      actualNumber: targetCard.number,
      drawnCard: gameState.drawnCard || undefined,
      timestamp: Date.now(),
      message: isHit
        ? `${targetPlayer.name} の左から ${cardIndex + 1} 番目 [${targetCard.color === 'black' ? '黒' : '白'}] を [${guessedNumber}] と推理して【的中】！`
        : `${targetPlayer.name} の左から ${cardIndex + 1} 番目 [${targetCard.color === 'black' ? '黒' : '白'}] を [${guessedNumber}] と推理して【ハズレ】。`,
    };

    if (isHit) {
      const updatedPlayers = gameState.players.map((p) => {
        if (p.id !== playerId) return p;
        const newCards = p.cards.map((c, i) => (i === cardIndex ? { ...c, isOpen: true } : c));
        return {
          ...p,
          cards: newCards,
          isEliminated: isAllOpen(newCards),
        };
      });

      const activePlayers = updatedPlayers.filter((p) => !p.isEliminated);
      if (activePlayers.length === 1) {
        setGameState((prev) => ({
          ...prev,
          players: updatedPlayers,
          logs: [log, ...prev.logs],
          winner: activePlayers[0],
          phase: 'GAME_OVER',
        }));
        return;
      }

      setGameState((prev) => ({
        ...prev,
        players: updatedPlayers,
        logs: [log, ...prev.logs],
        selectedTarget: null,
        phase: 'PLAYER_DECIDE_NEXT',
      }));
    } else {
      const playerIdx = gameState.players.findIndex((p) => p.isHuman);
      const updatedPlayers = [...gameState.players];
      if (gameState.drawnCard) {
        const openedDrawn: Card = { ...gameState.drawnCard, isOpen: true };
        updatedPlayers[playerIdx] = {
          ...updatedPlayers[playerIdx],
          cards: insertCardInOrder(updatedPlayers[playerIdx].cards, openedDrawn),
        };
      }

      const nextActiveIdx = getNextActivePlayerIndex(0, updatedPlayers);
      const isNextCpu = !updatedPlayers[nextActiveIdx].isHuman;

      setIsManualPaused(false);
      setGameState((prev) => ({
        ...prev,
        players: updatedPlayers,
        drawnCard: null,
        selectedTarget: null,
        activePlayerIndex: nextActiveIdx,
        remainingTime: prev.timeLimit,
        logs: [log, ...prev.logs],
        phase: isNextCpu ? 'CPU_ACTING' : 'PLAYER_TURN_START',
      }));
    }
  };

  // プレイヤーが「続けてアタック」を選択
  const handlePlayerContinue = () => {
    setGameState((prev) => ({
      ...prev,
      phase: 'PLAYER_SELECT_TARGET',
      selectedTarget: null,
    }));
  };

  // プレイヤーが「ステイ（手番終了）」を選択
  const handlePlayerStay = () => {
    setIsManualPaused(false);
    const playerIdx = gameState.players.findIndex((p) => p.isHuman);
    const updatedPlayers = [...gameState.players];
    if (gameState.drawnCard) {
      const closedDrawn: Card = { ...gameState.drawnCard, isOpen: false };
      updatedPlayers[playerIdx] = {
        ...updatedPlayers[playerIdx],
        cards: insertCardInOrder(updatedPlayers[playerIdx].cards, closedDrawn),
      };
    }

    const nextActiveIdx = getNextActivePlayerIndex(0, updatedPlayers);
    const isNextCpu = !updatedPlayers[nextActiveIdx].isHuman;

    setGameState((prev) => ({
      ...prev,
      players: updatedPlayers,
      drawnCard: null,
      activePlayerIndex: nextActiveIdx,
      remainingTime: prev.timeLimit,
      phase: isNextCpu ? 'CPU_ACTING' : 'PLAYER_TURN_START',
    }));
  };

  // 持ち時間カウントダウン処理（プレイヤー手番時のみ）
  useEffect(() => {
    if (
      gameState.timeLimit === 0 ||
      gameState.phase === 'SETUP' ||
      gameState.phase === 'GAME_OVER' ||
      gameState.phase === 'CPU_ACTING' ||
      isTimerPaused
    ) {
      return;
    }

    const interval = setInterval(() => {
      setGameState((prev) => {
        const nextRemainingTime = prev.remainingTime - 1;

        if (nextRemainingTime <= 0) {
          // 時間切れ（0秒到達）強制オープンペナルティ処理
          clearInterval(interval);
          setTimeUpBanner(TIME_UP_MESSAGE);
          const playerIdx = prev.players.findIndex((p) => p.isHuman);
          const updatedPlayers = [...prev.players];

          // まだドローしていなければ山札から引いてオープンペナルティ
          let newDeck = [...prev.deck];
          let penaltyCard = prev.drawnCard;
          if (!penaltyCard && newDeck.length > 0) {
            penaltyCard = newDeck[0];
            newDeck = newDeck.slice(1);
          }

          if (penaltyCard && playerIdx >= 0) {
            const newCards = insertCardInOrder(updatedPlayers[playerIdx].cards, {
              ...penaltyCard,
              isOpen: true,
            });
            const isEliminated = isAllOpen(newCards);
            updatedPlayers[playerIdx] = {
              ...updatedPlayers[playerIdx],
              cards: newCards,
              isEliminated,
            };
          }

          const activePlayers = updatedPlayers.filter((p) => !p.isEliminated);
          const currentHumanId = userId || (playerIdx >= 0 ? prev.players[playerIdx].id : 'player');
          const timeOutLog: AttackLog = {
            id: `log-${Date.now()}`,
            attackerId: currentHumanId,
            attackerName: 'あなた',
            targetPlayerId: '',
            targetPlayerName: '',
            targetCardIndex: 0,
            targetColor: 'black',
            guessedNumber: 0,
            isHit: false,
            timestamp: Date.now(),
            message: '時間切れ！引いたカードがオープンペナルティとなり手番終了。',
          };

          if (activePlayers.length === 1) {
            return {
              ...prev,
              deck: newDeck,
              players: updatedPlayers,
              drawnCard: null,
              selectedTarget: null,
              remainingTime: prev.timeLimit,
              activePlayerIndex: 0,
              logs: [timeOutLog, ...prev.logs],
              winner: activePlayers[0],
              phase: 'GAME_OVER',
            };
          }

          const nextIdx = getNextActivePlayerIndex(0, updatedPlayers);
          return {
            ...prev,
            deck: newDeck,
            players: updatedPlayers,
            drawnCard: null,
            selectedTarget: null,
            remainingTime: prev.timeLimit,
            activePlayerIndex: nextIdx,
            logs: [timeOutLog, ...prev.logs],
            phase: updatedPlayers[nextIdx].isHuman ? 'PLAYER_TURN_START' : 'CPU_ACTING',
          };
        }

        return {
          ...prev,
          remainingTime: nextRemainingTime,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.phase, gameState.timeLimit, userId, isTimerPaused]);

  // CPU手番の自律処理（連続アタックループ対応）
  useEffect(() => {
    if (gameState.phase !== 'CPU_ACTING' || gameState.winner !== null) return;

    const currentCpu = gameState.players[gameState.activePlayerIndex];
    if (!currentCpu || currentCpu.isHuman || currentCpu.isEliminated) return;

    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        timerId = setTimeout(resolve, ms);
      });

    const executeCpuTurn = async () => {
      setCpuStatusMessage(`${currentCpu.name} が山札からドロー中...`);
      await delay(900);
      if (!isMounted) return;

      let currentDeck = [...gameState.deck];
      let cpuDrawn: Card | null = null;
      if (currentDeck.length > 0) {
        cpuDrawn = currentDeck[0];
        currentDeck = currentDeck.slice(1);
      }

      let currentPlayers = [...gameState.players];
      let currentLogs = [...gameState.logs];
      const MAX_ATTACK_COUNT = 10;
      let loopCount = 0;

      while (loopCount < MAX_ATTACK_COUNT) {
        if (!isMounted) return;
        loopCount++;

        setCpuStatusMessage(
          loopCount === 1
            ? `${currentCpu.name} がアタック対象を思考中...`
            : `${currentCpu.name} が連続アタック対象を思考中...`
        );

        // 思考ディレイ: 初回は1200ms、継続時は要件指定の700〜1000ms（800ms）
        await delay(loopCount === 1 ? 1200 : 800);
        if (!isMounted) return;

        const decision = decideMultiCpuAttack(
          currentCpu,
          cpuDrawn,
          currentPlayers,
          gameState.difficulty,
          currentLogs
        );

        const targetPlayer = currentPlayers.find((p) => p.id === decision.targetPlayerId);
        if (!targetPlayer) {
          // 攻撃可能対象が不在の場合は手番交代
          const nextIdx = getNextActivePlayerIndex(gameState.activePlayerIndex, currentPlayers);
          setGameState((prev) => ({
            ...prev,
            deck: currentDeck,
            activePlayerIndex: nextIdx,
            remainingTime: prev.timeLimit,
            phase: prev.players[nextIdx].isHuman ? 'PLAYER_TURN_START' : 'CPU_ACTING',
          }));
          return;
        }

        const targetCard = targetPlayer.cards[decision.targetCardIndex];
        if (!targetCard) {
          return;
        }

        const isHit = checkAttack(targetCard, decision.guessedNumber);

        const log: AttackLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          attackerId: currentCpu.id,
          attackerName: currentCpu.name,
          targetPlayerId: targetPlayer.id,
          targetPlayerName: targetPlayer.name,
          targetCardIndex: decision.targetCardIndex,
          targetColor: targetCard.color,
          guessedNumber: decision.guessedNumber,
          isHit,
          actualNumber: targetCard.number,
          drawnCard: cpuDrawn || undefined,
          timestamp: Date.now(),
          message: isHit
            ? `${currentCpu.name} が ${targetPlayer.name} の左から ${decision.targetCardIndex + 1} 番目 [${targetCard.color === 'black' ? '黒' : '白'}] を [${decision.guessedNumber}] と推理して【的中】！`
            : `${currentCpu.name} が ${targetPlayer.name} の左から ${decision.targetCardIndex + 1} 番目 [${targetCard.color === 'black' ? '黒' : '白'}] を [${decision.guessedNumber}] と推理して【ハズレ】。`,
        };

        currentLogs = [log, ...currentLogs];

        if (isHit) {
          // 的中処理: 被弾カードを開示し脱落判定
          currentPlayers = currentPlayers.map((p) => {
            if (p.id !== targetPlayer.id) return p;
            const newCards = p.cards.map((c, i) =>
              i === decision.targetCardIndex ? { ...c, isOpen: true } : c
            );
            return {
              ...p,
              cards: newCards,
              isEliminated: isAllOpen(newCards),
            };
          });

          // 盤面状態を即座にUIへ反映
          setGameState((prev) => ({
            ...prev,
            deck: currentDeck,
            players: currentPlayers,
            logs: currentLogs,
          }));

          const activePlayers = currentPlayers.filter((p) => !p.isEliminated);
          if (activePlayers.length === 1) {
            setGameState((prev) => ({
              ...prev,
              deck: currentDeck,
              players: currentPlayers,
              logs: currentLogs,
              winner: activePlayers[0],
              phase: 'GAME_OVER',
            }));
            setCpuStatusMessage(`${activePlayers[0].name} の完全勝利！`);
            return;
          }

          // 的中後の継続判定（decideMultiCpuContinue）
          const shouldContinue =
            loopCount < MAX_ATTACK_COUNT &&
            decideMultiCpuContinue(currentCpu, cpuDrawn, currentPlayers, gameState.difficulty);

          if (shouldContinue) {
            // ログに「CPUはさらにアタックを継続します」を記録
            const continueLog: AttackLog = {
              id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              attackerId: currentCpu.id,
              attackerName: currentCpu.name,
              targetPlayerId: '',
              targetPlayerName: '',
              targetCardIndex: 0,
              targetColor: 'black',
              guessedNumber: 0,
              isHit: true,
              timestamp: Date.now(),
              message: 'CPUはさらにアタックを継続します',
            };
            currentLogs = [continueLog, ...currentLogs];

            setGameState((prev) => ({
              ...prev,
              logs: currentLogs,
            }));
            setCpuStatusMessage(`${currentCpu.name} はさらにアタックを継続します...`);

            // 適切なディレイ（700〜1000ms）を挟んで連続アタックループ
            await delay(800);
            continue;
          } else {
            // ステイ (false)
            // ログに「CPUは手札に加えてステイしました」を記録
            const stayLog: AttackLog = {
              id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              attackerId: currentCpu.id,
              attackerName: currentCpu.name,
              targetPlayerId: '',
              targetPlayerName: '',
              targetCardIndex: 0,
              targetColor: 'black',
              guessedNumber: 0,
              isHit: true,
              timestamp: Date.now(),
              message: 'CPUは手札に加えてステイしました',
            };
            currentLogs = [stayLog, ...currentLogs];

            // 引いたカードを手札に伏せて整列挿入し、次のプレイヤーへ手番を遷移
            const cpuIdx = currentPlayers.findIndex((p) => p.id === currentCpu.id);
            if (cpuDrawn && cpuIdx !== -1) {
              currentPlayers[cpuIdx] = {
                ...currentPlayers[cpuIdx],
                cards: insertCardInOrder(currentPlayers[cpuIdx].cards, {
                  ...cpuDrawn,
                  isOpen: false,
                }),
              };
            }

            const nextIdx = getNextActivePlayerIndex(gameState.activePlayerIndex, currentPlayers);
            const isNextHuman = currentPlayers[nextIdx].isHuman;

            setGameState((prev) => ({
              ...prev,
              deck: currentDeck,
              players: currentPlayers,
              logs: currentLogs,
              activePlayerIndex: nextIdx,
              remainingTime: prev.timeLimit,
              phase: isNextHuman ? 'PLAYER_TURN_START' : 'CPU_ACTING',
            }));
            setCpuStatusMessage(`${currentCpu.name} は手札に加えてステイしました。`);
            return;
          }
        } else {
          // ハズレ (isHit === false)
          // 引いたカードを手札にオープンで配置し、次のプレイヤーへ手番を遷移
          const cpuIdx = currentPlayers.findIndex((p) => p.id === currentCpu.id);
          if (cpuDrawn && cpuIdx !== -1) {
            currentPlayers[cpuIdx] = {
              ...currentPlayers[cpuIdx],
              cards: insertCardInOrder(currentPlayers[cpuIdx].cards, {
                ...cpuDrawn,
                isOpen: true,
              }),
            };
          }

          const nextIdx = getNextActivePlayerIndex(gameState.activePlayerIndex, currentPlayers);
          const isNextHuman = currentPlayers[nextIdx].isHuman;

          setGameState((prev) => ({
            ...prev,
            deck: currentDeck,
            players: currentPlayers,
            logs: currentLogs,
            activePlayerIndex: nextIdx,
            remainingTime: prev.timeLimit,
            phase: isNextHuman ? 'PLAYER_TURN_START' : 'CPU_ACTING',
          }));
          setCpuStatusMessage(`${currentCpu.name} の推理はハズレました。`);
          return;
        }
      }

      // ループガード（最大10回）上限到達時のステイ処理
      const stayLog: AttackLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        attackerId: currentCpu.id,
        attackerName: currentCpu.name,
        targetPlayerId: '',
        targetPlayerName: '',
        targetCardIndex: 0,
        targetColor: 'black',
        guessedNumber: 0,
        isHit: true,
        timestamp: Date.now(),
        message: 'CPUは手札に加えてステイしました',
      };
      currentLogs = [stayLog, ...currentLogs];

      const cpuIdx = currentPlayers.findIndex((p) => p.id === currentCpu.id);
      if (cpuDrawn && cpuIdx !== -1) {
        currentPlayers[cpuIdx] = {
          ...currentPlayers[cpuIdx],
          cards: insertCardInOrder(currentPlayers[cpuIdx].cards, {
            ...cpuDrawn,
            isOpen: false,
          }),
        };
      }

      const nextIdx = getNextActivePlayerIndex(gameState.activePlayerIndex, currentPlayers);
      const isNextHuman = currentPlayers[nextIdx].isHuman;

      setGameState((prev) => ({
        ...prev,
        deck: currentDeck,
        players: currentPlayers,
        logs: currentLogs,
        activePlayerIndex: nextIdx,
        remainingTime: prev.timeLimit,
        phase: isNextHuman ? 'PLAYER_TURN_START' : 'CPU_ACTING',
      }));
      setCpuStatusMessage(`${currentCpu.name} は手札に加えてステイしました。`);
    };

    executeCpuTurn();

    return () => {
      isMounted = false;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [gameState.phase, gameState.activePlayerIndex, gameState.winner]);

  // ヒント用：確認済み数字
  const humanPlayer = gameState.players.find((p) => p.isHuman);
  const knownNumbers: number[] = [];
  if (humanPlayer) {
    humanPlayer.cards.forEach((c) => knownNumbers.push(c.number));
  }
  gameState.players.forEach((p) => {
    p.cards.forEach((c) => {
      if (c.isOpen && !knownNumbers.includes(c.number)) {
        knownNumbers.push(c.number);
      }
    });
  });
  if (gameState.drawnCard && !knownNumbers.includes(gameState.drawnCard.number)) {
    knownNumbers.push(gameState.drawnCard.number);
  }

  // 1. セットアップ画面
  if (gameState.phase === 'SETUP') {
    return (
      <div className="min-h-screen py-8 px-4 flex flex-col justify-center items-center">
        <SetupModal
          playerCount={gameState.playerCount}
          difficulty={gameState.difficulty}
          timeLimit={gameState.timeLimit}
          onSelectPlayerCount={(count) => setGameState((prev) => ({ ...prev, playerCount: count }))}
          onSelectDifficulty={(diff) => setGameState((prev) => ({ ...prev, difficulty: diff }))}
          onSelectTimeLimit={(limit) =>
            setGameState((prev) => ({ ...prev, timeLimit: limit, remainingTime: limit }))
          }
          onStartGame={() =>
            initializeGame(gameState.playerCount, gameState.difficulty, gameState.timeLimit)
          }
          onOpenRules={() => setIsRuleModalOpen(true)}
        />
        <RuleGuideModal isOpen={isRuleModalOpen} onClose={() => setIsRuleModalOpen(false)} />
      </div>
    );
  }

  // 2. 対戦盤面
  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const opponents = gameState.players.filter((p) => !p.isHuman);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4">
      {/* Top Header */}
      <header className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="w-full h-3.5 algo-diamond-pattern border-b border-slate-100" />

        <div className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
              <img src="/app-icon.jpg" alt="algo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                algo
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-algo-blue/15 text-algo-blue">
                  {gameState.playerCount}人対戦
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-algo-yellow text-slate-950">
                  {gameState.difficulty === 'easy'
                    ? '初級'
                    : gameState.difficulty === 'normal'
                    ? '中級'
                    : '上級'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {gameState.timeLimit === 0 ? '無制限' : `${gameState.timeLimit}秒`}
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">数字当て論理推理ボードゲーム</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* カウントダウンタイマー表示 ＆ プログレスバー */}
            {gameState.timeLimit > 0 && activePlayer?.isHuman && (
              <div className="flex flex-col gap-1 items-stretch">
                <button
                  type="button"
                  data-testid="timer-display"
                  onClick={() => setIsManualPaused((prev) => !prev)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border font-black text-xs transition-all cursor-pointer select-none ${getTimerColorClass(
                    gameState.remainingTime,
                    isTimerPaused
                  )}`}
                  title={isTimerPaused ? 'クリックでタイマー再開 (Resume)' : 'クリックでタイマー一時停止 (Pause)'}
                  aria-label={
                    isTimerPaused
                      ? 'タイマー一時停止中 (クリックで再開)'
                      : `残り ${gameState.remainingTime} 秒 (クリックで一時停止)`
                  }
                >
                  {isTimerPaused ? (
                    <>
                      <span className="text-xs" aria-hidden="true">⏸️</span>
                      <span className="tracking-wider">PAUSED</span>
                      <span className="text-[11px] text-amber-600 font-bold">({gameState.remainingTime}秒)</span>
                    </>
                  ) : (
                    <>
                      <Clock
                        className={`w-3.5 h-3.5 ${
                          gameState.remainingTime <= 5
                            ? 'text-rose-500'
                            : gameState.remainingTime < 10
                            ? 'text-amber-500'
                            : 'text-algo-blue'
                        }`}
                      />
                      <span>残り {gameState.remainingTime} 秒</span>
                    </>
                  )}
                </button>
                {/* タイマープログレスバー（視覚的ゲージ） */}
                <div
                  data-testid="timer-progress-bar-container"
                  className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"
                  title={`残り時間: ${gameState.remainingTime}/${gameState.timeLimit}秒`}
                >
                  <div
                    data-testid="timer-progress-bar"
                    className={`h-full transition-all duration-300 ease-linear rounded-full ${getProgressBarColorClass(
                      gameState.remainingTime,
                      isTimerPaused
                    )}`}
                    style={{
                      width: `${calculateProgressPercentage(
                        gameState.remainingTime,
                        gameState.timeLimit
                      )}%`,
                    }}
                    role="progressbar"
                    aria-valuenow={gameState.remainingTime}
                    aria-valuemin={0}
                    aria-valuemax={gameState.timeLimit}
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => setIsRuleModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-algo-blue" />
              <span>ルール</span>
            </button>

            <button
              onClick={handleRequestRestart}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>再戦</span>
            </button>

            <button
              onClick={handleRequestSetup}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-2xs"
            >
              <Settings2 className="w-3.5 h-3.5 text-algo-yellow" />
              <span>設定</span>
            </button>
          </div>
        </div>
      </header>

      {/* タイムアップ（0秒到達）警告通知バナー */}
      {timeUpBanner && (
        <div
          data-testid="timeup-banner"
          role="alert"
          className="bg-rose-50 border-2 border-rose-300 text-rose-800 px-4 py-3 rounded-2xl shadow-md flex items-center justify-between gap-3 animate-pulse transition-all"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-bold text-xs sm:text-sm">
              {timeUpBanner}
            </span>
          </div>
          <button
            type="button"
            data-testid="close-timeup-banner"
            onClick={() => setTimeUpBanner(null)}
            className="text-rose-500 hover:text-rose-700 font-black text-sm p-1 rounded-lg hover:bg-rose-100 transition-colors"
            aria-label="通知を閉じる"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Game Field Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left 3 cols: Board Field */}
        <div className="lg:col-span-3 space-y-4">
          {/* Opponents Area */}
          <div className={`grid gap-3 ${opponents.length === 1 ? 'grid-cols-1' : opponents.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {opponents.map((opp) => {
              const isCurrentTurn = activePlayer?.id === opp.id;
              const openCount = opp.cards.filter((c) => c.isOpen).length;

              return (
                <div
                  key={opp.id}
                  className={`bg-white rounded-3xl p-4 border transition-all relative ${
                    opp.isEliminated
                      ? 'border-slate-200 bg-slate-50/60 opacity-60'
                      : isCurrentTurn
                      ? 'border-algo-blue ring-4 ring-algo-blue/20 shadow-md'
                      : 'border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-xl bg-gradient-to-br ${opp.avatarColor} text-white flex items-center justify-center font-bold text-xs shadow-2xs`}
                      >
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-black text-xs text-slate-900 block">{opp.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          ({openCount}/{opp.cards.length} 枚OPEN)
                        </span>
                      </div>
                    </div>

                    {opp.isEliminated ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
                        脱落
                      </span>
                    ) : isCurrentTurn ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-algo-blue text-white font-bold animate-pulse">
                        思考中
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 py-1 min-h-24">
                    {opp.cards.map((card, idx) => (
                      <CardComponent
                        key={card.id}
                        card={maskCardForPlayer(card, false)}
                        isOwner={false}
                        size={opponents.length === 1 ? 'md' : 'sm'}
                        label={`#${idx + 1}`}
                        isEliminated={opp.isEliminated}
                        isSelectable={
                          activePlayer?.isHuman &&
                          gameState.phase === 'PLAYER_SELECT_TARGET' &&
                          !opp.isEliminated &&
                          !card.isOpen
                        }
                        isSelected={
                          gameState.selectedTarget?.playerId === opp.id &&
                          gameState.selectedTarget?.cardIndex === idx
                        }
                        onClick={() => handleSelectTargetCard(opp.id, idx)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Player Attack Notice */}
          {gameState.phase === 'PLAYER_SELECT_TARGET' && (
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-algo-blue-light border border-algo-blue/30 text-algo-navy text-xs font-black shadow-xs animate-attack-pulse">
                <span>👆 推理したい相手の伏せカード（?）をクリックしてください！</span>
              </span>
            </div>
          )}

          {/* Center Table */}
          <section className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-around gap-6">
            {/* Deck Pile */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                onClick={gameState.phase === 'PLAYER_TURN_START' ? handlePlayerDraw : undefined}
                className={`relative w-20 h-28 sm:w-24 sm:h-32 rounded-2xl border-2 flex flex-col items-center justify-center select-none transition-all ${
                  gameState.phase === 'PLAYER_TURN_START'
                    ? 'border-algo-yellow-dark bg-algo-yellow-light/80 shadow-lg shadow-amber-200/50 cursor-pointer hover:scale-105 animate-bounce'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                <Layers className="w-7 h-7 mb-1 text-algo-blue" />
                <span className="text-[10px] font-bold text-slate-500">山札</span>
                <span className="text-lg font-black text-slate-900">{gameState.deck.length} 枚</span>
                {gameState.phase === 'PLAYER_TURN_START' && (
                  <span className="absolute -bottom-2 px-2.5 py-0.5 rounded-full bg-algo-yellow text-slate-950 text-[10px] font-black border border-amber-300 shadow-xs">
                    引く
                  </span>
                )}
              </div>
            </div>

            {/* Drawn Card display */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">引いたカード</span>
              {gameState.drawnCard ? (
                <div className="scale-105 transition-transform animate-card-draw">
                  <CardComponent card={maskCardForPlayer(gameState.drawnCard, true)} isOwner={true} size="md" />
                </div>
              ) : (
                <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400 font-semibold bg-slate-50/50">
                  なし
                </div>
              )}
            </div>

            {/* Turn Guidance */}
            <div className="flex-1 max-w-md text-center md:text-left space-y-2">
              {gameState.phase === 'PLAYER_TURN_START' && (
                <div className="p-3.5 bg-algo-blue-light/50 border border-algo-blue/20 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-algo-blue" />
                      <span>あなたのターン</span>
                    </h4>
                    {gameState.timeLimit > 0 && (
                      <span className="text-xs font-bold text-algo-blue">残り {gameState.remainingTime}秒</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    中央の山札をクリックしてカードを引いてください。
                  </p>
                </div>
              )}

              {gameState.phase === 'PLAYER_SELECT_TARGET' && (
                <div className="p-3.5 bg-algo-blue-light/50 border border-algo-blue/20 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-900 text-sm">アタック対象を選択</h4>
                    {gameState.timeLimit > 0 && (
                      <span className="text-xs font-bold text-algo-blue">残り {gameState.remainingTime}秒</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    相手の手札から推理したい伏せカードをクリックしてください。
                  </p>
                </div>
              )}

              {gameState.phase === 'PLAYER_DECIDE_NEXT' && (
                <div className="p-4 bg-algo-yellow-light/80 border border-algo-yellow-dark/40 rounded-2xl space-y-2.5 shadow-sm">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span>✨ アタック的中！お見事！</span>
                  </h4>
                  <p className="text-xs text-slate-700 font-medium">
                    続けて別のカードにアタックしますか？それともステイして手番を終えますか？
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePlayerContinue}
                      className="flex-1 py-2 rounded-xl bg-gradient-to-r from-algo-blue to-algo-blue-dark text-white font-black text-xs hover:brightness-105 shadow-sm transition-all"
                    >
                      続けてアタック
                    </button>
                    <button
                      onClick={handlePlayerStay}
                      className="flex-1 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-xs hover:bg-slate-50 transition-all shadow-2xs"
                    >
                      ステイ（手札に加える）
                    </button>
                  </div>
                </div>
              )}

              {gameState.phase === 'CPU_ACTING' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-algo-blue" />
                    <span>{activePlayer?.name} の手番</span>
                  </h4>
                  <p className="text-xs text-slate-600 font-medium animate-pulse">{cpuStatusMessage}</p>
                </div>
              )}

              {gameState.phase === 'GAME_OVER' && (
                <div className="p-4 bg-gradient-to-br from-algo-yellow/40 to-algo-blue/20 border border-amber-300 rounded-2xl space-y-2.5 text-center shadow-md">
                  <div className="w-10 h-10 mx-auto rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-base text-slate-900">
                    {gameState.winner?.isHuman
                      ? '🎉 おめでとうございます！あなたの完全勝利！'
                      : `💀 ${gameState.winner?.name} の勝利！`}
                  </h4>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsResultModalOpen(true)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-algo-blue hover:bg-algo-blue-dark text-white font-black text-xs shadow-sm transition-all"
                    >
                      🏆 戦績サマリを表示
                    </button>
                    <button
                      type="button"
                      onClick={() => initializeGame()}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-sm transition-all"
                    >
                      もう一度対戦する
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Player Hand Area */}
          {humanPlayer && (
            <section className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-algo-blue text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    <User className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-sm text-slate-900">{humanPlayer.name} の手札</h3>
                  <span className="text-xs font-semibold text-slate-400">
                    ({humanPlayer.cards.filter((c) => c.isOpen).length}/{humanPlayer.cards.length} 枚OPEN)
                  </span>
                </div>

                {activePlayer?.isHuman && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-algo-yellow text-slate-950 text-xs font-black shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    あなたのターン
                  </span>
                )}
              </div>

              {/* Player Cards */}
              <div className="flex flex-wrap items-center justify-center gap-3 py-2 min-h-28">
                {humanPlayer.cards.map((card, idx) => (
                  <CardComponent
                    key={card.id}
                    card={maskCardForPlayer(card, true)}
                    isOwner={true}
                    size="md"
                    label={`#${idx + 1}`}
                  />
                ))}
              </div>

              <div className="mt-2 text-center">
                <p className="text-[11px] text-slate-400 font-medium">
                  ※ 手札は左から小さい順（同数は黒が左）に並んでいます。「伏せ中」の数字は相手には見えていません。
                </p>
              </div>
            </section>
          )}
        </div>

        {/* Right 1 col: Log & Visuals */}
        <div className="lg:col-span-1 space-y-4">
          <GameLog logs={gameState.logs} />
        </div>
      </div>

      {/* Modals */}
      {gameState.selectedTarget && gameState.phase === 'PLAYER_GUESS_NUMBER' && (
        <AttackModal
          targetPlayerName={
            gameState.players.find((p) => p.id === gameState.selectedTarget?.playerId)?.name || ''
          }
          targetIndex={gameState.selectedTarget.cardIndex}
          targetColor={
            gameState.players.find((p) => p.id === gameState.selectedTarget?.playerId)?.cards[
              gameState.selectedTarget.cardIndex
            ].color || 'black'
          }
          onConfirmGuess={handleConfirmGuess}
          onCancel={() =>
            setGameState((prev) => ({
              ...prev,
              selectedTarget: null,
              phase: 'PLAYER_SELECT_TARGET',
            }))
          }
          disabledNumbers={knownNumbers}
        />
      )}

      <RuleGuideModal isOpen={isRuleModalOpen} onClose={() => setIsRuleModalOpen(false)} />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        actionType={confirmModal.actionType}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel={confirmModal.cancelLabel}
        isDestructive={confirmModal.isDestructive}
        gameStatus={{
          playerCount: gameState.playerCount,
          difficulty: gameState.difficulty,
          remainingHiddenCards: humanPlayer
            ? humanPlayer.cards.filter((c) => !c.isOpen).length
            : 0,
          logCount: gameState.logs.length,
        }}
        onConfirm={handleConfirmModalAction}
        onCancel={handleCloseConfirmModal}
      />

      {/* SCR-006: 決着リザルト＆祝祭演出モーダル */}
      <ResultModal
        isOpen={gameState.phase === 'GAME_OVER' && isResultModalOpen}
        winner={gameState.winner}
        humanPlayer={humanPlayer || null}
        players={gameState.players}
        logs={gameState.logs}
        playerCount={gameState.playerCount}
        difficulty={gameState.difficulty}
        timeLimit={gameState.timeLimit}
        onPlayAgain={() => initializeGame()}
        onReturnSetup={() => setGameState((prev) => ({ ...prev, phase: 'SETUP' }))}
        onClose={() => setIsResultModalOpen(false)}
      />
    </div>
  );
};
