'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getAppVersion } from '../lib/version';
import { Card, GameState, Difficulty, PlayerCount, TimeLimit, AttackLog, Player, CardColor } from '../types/game';
import {
  createDeck,
  setupGamePlayers,
  insertCardInOrder,
  insertCardInOrderWithIndex,
  isAllOpen,
  checkAttack,
  getNextActivePlayerIndex,
  maskCardForPlayer,
} from '../lib/algoEngine';
import { getPossibleNumbersForCard, formatCandidateRange, getFailedNumbersForCard } from '../lib/candidateAssist';
import { decideMultiCpuAttack, decideMultiCpuContinue } from '../lib/cpuAI';
import { CardComponent } from './CardComponent';
import { AttackModal } from './AttackModal';
import { GameLog } from './GameLog';
import { RuleGuideModal } from './RuleGuideModal';
import { SetupModal } from './SetupModal';
import { ConfirmModal } from './ConfirmModal';
import { ResultModal } from './ResultModal';
import { TutorialPromptModal } from './TutorialPromptModal';
import { TutorialModal } from './TutorialModal';
import {
  AttackResultModal,
  AttackResultData,
  CpuAttackModal,
  CpuAttackResultData,
} from './CpuAttackModal';
import { HintModal } from './HintModal';
import { LethalCutIn } from './LethalCutIn';
import { StatsModal } from './StatsModal';
import { DeckTracker } from './DeckTracker';
import { calculateDeckTrackerState, getRemainingDeckNumbers } from '../lib/deckTracker';
import { getBestHint, HintResult } from '../lib/hintAdvisor';
import { useUserSession } from '../hooks/useUserSession';
import { auditLogger } from '../lib/auditLogger';
import { soundManager } from '../lib/soundManager';
import { haptics } from '../lib/haptics';
import {
  getStoredStats,
  recordMatchResult,
  resetStats,
  PlayerStats,
} from '../lib/statsManager';
import {
  getStoredAchievements,
  checkAndUnlockAchievements,
  Achievement,
} from '../lib/achievementManager';
import {
  Layers,
  Sparkles,
  Trophy,
  RotateCcw,
  BookOpen,
  GraduationCap,
  Bot,
  User,
  Settings2,
  Clock,
  AlertTriangle,
  Flame,
  ScrollText,
  X,
  Lightbulb,
  Volume2,
  VolumeX,
  Target,
  Eye,
  FastForward,
  Menu,
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
  'TIME UP! 制限時間を超過したため、引いたカードが強制オープンされました';

export const TIME_UP_AUTO_DRAW_MESSAGE =
  'タイムアップ！カードが自動ドローされ、オープンされました';

export const TIME_UP_NO_DECK_MESSAGE =
  'TIME UP! 制限時間を超過し山札がないため、手札の伏せカードが強制オープンされました';

/**
 * プレイヤー脱落時の通知メッセージ定数 (Issue #61)
 */
export const ELIMINATION_MESSAGE =
  '手札がすべてオープンされ、脱落しました！観戦モードに移行します';

/**
 * ターゲットカードの色（黒または白）に応じた確認済み数字（既知数字）のリストを抽出する (Issue #38)
 * - 自分の手札のうち、ターゲットと同色のカードの数字
 * - 全プレイヤーのオープン済みカードのうち、ターゲットと同色のカードの数字
 * - 自分が引いたカード（drawnCard）のうち、ターゲットと同色のカードの数字
 *
 * @param targetColor アタック対象カードの色 ('black' | 'white')
 * @param players ゲームに参加しているプレイヤー一覧
 * @param drawnCard プレイヤーが引いたカード（存在する場合）
 * @returns ターゲットと同色で既に確認済みの重複のない数字配列
 */
export const getKnownNumbersForColor = (
  targetColor: CardColor,
  players: Player[],
  drawnCard?: Card | null
): number[] => {
  const knownNumbers: number[] = [];

  // 1. 人間プレイヤー（自分）の同色手札の数字
  const humanPlayer = players.find((p) => p.isHuman);
  if (humanPlayer) {
    humanPlayer.cards.forEach((c) => {
      if (c.color === targetColor && !knownNumbers.includes(c.number)) {
        knownNumbers.push(c.number);
      }
    });
  }

  // 2. 全プレイヤーのオープン済み同色カードの数字
  players.forEach((p) => {
    p.cards.forEach((c) => {
      if (c.isOpen && c.color === targetColor && !knownNumbers.includes(c.number)) {
        knownNumbers.push(c.number);
      }
    });
  });

  // 3. プレイヤーが引いたカード（drawnCard）の同色の数字
  if (drawnCard && drawnCard.color === targetColor && !knownNumbers.includes(drawnCard.number)) {
    knownNumbers.push(drawnCard.number);
  }

  return knownNumbers;
};

export interface GameBoardProps {
  initialState?: Partial<GameState>;
  initialTimeUpBanner?: string | null;
  initialHintCount?: number;
  initialActiveHint?: HintResult | null;
  initialIsHintModalOpen?: boolean;
  initialIsRuleModalOpen?: boolean;
  initialIsTutorialOpen?: boolean;
  initialRecentlyInsertedCard?: { playerId: string; cardId: string } | null;
  initialIsMobileMenuOpen?: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  initialState,
  initialTimeUpBanner = null,
  initialHintCount = 3,
  initialActiveHint = null,
  initialIsHintModalOpen = false,
  initialIsRuleModalOpen = false,
  initialIsTutorialOpen = false,
  initialRecentlyInsertedCard = null,
  initialIsMobileMenuOpen = false,
}) => {
  const { userId } = useUserSession();

  const [gameState, setGameState] = useState<GameState>(() => ({
    playerCount: 2,
    difficulty: 'easy',
    timeLimit: 0,
    remainingTime: 0,
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

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(initialIsRuleModalOpen);
  const [isTutorialOpen, setIsTutorialOpen] = useState(initialIsTutorialOpen);
  const [isTutorialPromptOpen, setIsTutorialPromptOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(true);
  const [isManualPaused, setIsManualPaused] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  const [playerStats, setPlayerStats] = useState<PlayerStats>(() => getStoredStats());
  const [playerAchievements, setPlayerAchievements] = useState<Achievement[]>(() =>
    getStoredAchievements()
  );
  const [newlyUnlockedToast, setNewlyUnlockedToast] = useState<Achievement | null>(null);

  const playerTurnsCountRef = useRef<number>(0);
  const wasInClutchRef = useRef<boolean>(false);
  const consecutiveHitsInTurnRef = useRef<number>(0);
  const maxConsecutiveHitsInTurnRef = useRef<number>(0);
  const hasRecordedGameOverRef = useRef<boolean>(false);
  const hasTurnStartedForHumanRef = useRef<boolean>(false);

  const handleResetStats = useCallback(() => {
    const freshStats = resetStats();
    setPlayerStats(freshStats);
  }, []);

  const handleConfirmGuessRef = useRef<(num: number) => Promise<void>>((() => {}) as any);

  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      (window as any).__algoGameState = gameState;
      (window as any).__setGameState = setGameState;
      (window as any).__algoHandleConfirmGuess = (num: number) => handleConfirmGuessRef.current(num);
    }
  }, [gameState]);
  const [cpuStatusMessage, setCpuStatusMessage] = useState<string>('');
  const [timeUpBanner, setTimeUpBanner] = useState<string | null>(initialTimeUpBanner);
  const [isMobileLogOpen, setIsMobileLogOpen] = useState(false);
  const [isMobileTrackerOpen, setIsMobileTrackerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(initialIsMobileMenuOpen);

  // モバイル残弾トラッカー・モバイルログ・モバイルメニューのEscapeキー対応 (Issue #116, #118)
  useEffect(() => {
    if (!isMobileTrackerOpen && !isMobileLogOpen && !isMobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMobileTrackerOpen) setIsMobileTrackerOpen(false);
        if (isMobileLogOpen) setIsMobileLogOpen(false);
        if (isMobileMenuOpen) setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileTrackerOpen, isMobileLogOpen, isMobileMenuOpen]);
  // CPUが手札に挿入した直後のカード追跡用 (Issue #66)
  const [recentlyInsertedCard, setRecentlyInsertedCard] = useState<{
    playerId: string;
    cardId: string;
  } | null>(initialRecentlyInsertedCard);
  // 初心者向け推理候補アシストの有効状態（Issue #42: デフォルト true）
  const [isAssistEnabled, setIsAssistEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('algo_assist_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleAssist = useCallback(() => {
    setIsAssistEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('algo_assist_enabled', String(next));
      } catch {}
      return next;
    });
  }, []);

  // リーサル（決着ヒット）ダイナミックK.O.演出ステート (Issue #73)
  const [isLethalCutInActive, setIsLethalCutInActive] = useState(false);
  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const [lethalWinnerName, setLethalWinnerName] = useState<string>('');

  const triggerLethalKo = useCallback((winnerName: string) => {
    setIsScreenShaking(true);
    setLethalWinnerName(winnerName);
    setIsLethalCutInActive(true);

    // 画面揺れは 550ms で収束
    setTimeout(() => {
      setIsScreenShaking(false);
    }, 550);
  }, []);

  const handleLethalCutInComplete = useCallback(() => {
    setIsLethalCutInActive(false);
  }, []);

  // 効果音・サウンドの有効状態（Issue #63, #71: デフォルト true）
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => soundManager.isSoundEnabled());

  useEffect(() => {
    const unsubscribe = soundManager.subscribe((enabled) => {
      setIsSoundEnabled(enabled);
    });
    return unsubscribe;
  }, []);

  const handleToggleSound = useCallback(() => {
    soundManager.unlockAudio();
    soundManager.toggleSound();
  }, []);

  // 観戦モード・自動観戦・スキップ状態 (Issue #61)
  const [isAutoSpectate, setIsAutoSpectate] = useState<boolean>(true);
  const [isSkippingToResult, setIsSkippingToResult] = useState<boolean>(false);
  const isSkippingToResultRef = useRef<boolean>(false);
  const [isEliminationDismissed, setIsEliminationDismissed] = useState<boolean>(false);
  // 推理結果確認モーダル用状態と非同期リゾルバ (CPU & プレイヤー)
  const [attackResult, setAttackResult] = useState<AttackResultData | null>(null);
  const attackResolverRef = useRef<(() => void) | null>(null);

  const waitForAttackOk = useCallback((data: AttackResultData) => {
    if (isSkippingToResultRef.current) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      attackResolverRef.current = resolve;
      setAttackResult(data);
    });
  }, []);

  const handleAttackOk = useCallback(() => {
    setAttackResult(null);
    if (attackResolverRef.current) {
      const resolve = attackResolverRef.current;
      attackResolverRef.current = null;
      resolve();
    }
  }, []);

  // 決着まで一括スキップハンドラ (Issue #61)
  const handleSkipToResult = useCallback(() => {
    isSkippingToResultRef.current = true;
    setIsSkippingToResult(true);
    if (attackResolverRef.current) {
      const resolve = attackResolverRef.current;
      attackResolverRef.current = null;
      setAttackResult(null);
      resolve();
    }
  }, []);

  // CPUアタック処理との後方互換エイリアス
  const cpuAttackResult = attackResult;
  const waitForCpuAttackOk = waitForAttackOk;
  const handleCpuAttackOk = handleAttackOk;

  // 初回アクセス時のチュートリアル確認モーダル表示チェック
  useEffect(() => {
    try {
      const isCompleted = localStorage.getItem('algo_tutorial_completed') === 'true';
      const isSkipped = localStorage.getItem('algo_tutorial_skip_prompt') === 'true';
      if (!isCompleted && !isSkipped) {
        setIsTutorialPromptOpen(true);
      }
    } catch (e) {
      // fallback if localStorage is disabled or restricted
    }
  }, []);

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

  // 初心者向けAIヒント機能 (Issue #44)
  const [hintCount, setHintCount] = useState<number>(initialHintCount);
  const [activeHint, setActiveHint] = useState<HintResult | null>(initialActiveHint);
  const [isHintModalOpen, setIsHintModalOpen] = useState<boolean>(initialIsHintModalOpen);

  // 新規ゲーム初期化
  const initializeGame = useCallback(
    (
      count: PlayerCount = gameState.playerCount,
      diff: Difficulty = gameState.difficulty,
      limit: TimeLimit = gameState.timeLimit
    ) => {
      // アタック結果待機中であればリセット解除
      setAttackResult(null);
      if (attackResolverRef.current) {
        const resolve = attackResolverRef.current;
        attackResolverRef.current = null;
        resolve();
      }

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
      setIsLethalCutInActive(false);
      setIsScreenShaking(false);
      setHintCount(3);
      setActiveHint(null);
      setIsHintModalOpen(false);
      playerTurnsCountRef.current = 0;
      wasInClutchRef.current = false;
      consecutiveHitsInTurnRef.current = 0;
      maxConsecutiveHitsInTurnRef.current = 0;
      hasRecordedGameOverRef.current = false;
      hasTurnStartedForHumanRef.current = false;
      setRecentlyInsertedCard(null);
      // 観戦・スキップ状態のリセット (Issue #61)
      setIsSkippingToResult(false);
      isSkippingToResultRef.current = false;
      setIsEliminationDismissed(false);
    },
    [gameState.playerCount, gameState.difficulty, gameState.timeLimit, userId]
  );

  // GAME_OVER 遷移時に決着モーダルを自動オープン ＆ 通算戦績・アチーブメントの自動記録 ＆ 勝敗SE・ハプティクス再生 (Issue #63, #71, #72)
  useEffect(() => {
    if (gameState.phase === 'GAME_OVER' && gameState.winner) {
      setIsResultModalOpen(true);

      if (!hasRecordedGameOverRef.current) {
        hasRecordedGameOverRef.current = true;

        if (gameState.winner.isHuman) {
          soundManager.playVictorySound();
          haptics.vibrateSuccess();
        } else {
          soundManager.playDefeatSound();
          haptics.vibrateFailure();
        }

        const humanPlayer = gameState.players.find((p) => p.isHuman);
        const isHumanWin = Boolean(humanPlayer && gameState.winner.id === humanPlayer.id);

        const humanAttacks = gameState.logs.filter((l) => l.attackerId === humanPlayer?.id);
        const attacksCount = humanAttacks.length;
        const hitsCount = humanAttacks.filter((l) => l.isHit).length;
        const missesCount = humanAttacks.filter((l) => !l.isHit).length;

        // 1. 通算戦績の記録
        const updatedStats = recordMatchResult({
          isWin: isHumanWin,
          difficulty: gameState.difficulty,
          turns: playerTurnsCountRef.current,
          attacks: attacksCount,
          hits: hitsCount,
        });
        setPlayerStats(updatedStats);

        // 2. アチーブメント判定
        const { updatedAchievements, newlyUnlocked } = checkAndUnlockAchievements({
          isWin: isHumanWin,
          difficulty: gameState.difficulty,
          timeLimit: gameState.timeLimit,
          turns: playerTurnsCountRef.current,
          playerAttacks: attacksCount,
          playerHits: hitsCount,
          playerMisses: missesCount,
          maxConsecutiveHitsInSingleTurn: maxConsecutiveHitsInTurnRef.current,
          wasInClutch: wasInClutchRef.current,
          stats: updatedStats,
        });
        setPlayerAchievements(updatedAchievements);
        if (newlyUnlocked.length > 0) {
          setNewlyUnlockedToast(newlyUnlocked[0]);
        }
      }
    }
  }, [
    gameState.phase,
    gameState.winner,
    gameState.players,
    gameState.difficulty,
    gameState.timeLimit,
    gameState.logs,
  ]);

  // アチーブメント解除トーストの自動消去（6秒後）
  useEffect(() => {
    if (newlyUnlockedToast) {
      const timer = setTimeout(() => {
        setNewlyUnlockedToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [newlyUnlockedToast]);

  // 人間プレイヤーの手番開始（ターン数カウント）の監視
  useEffect(() => {
    if (
      gameState.phase === 'PLAYER_TURN_START' ||
      (gameState.deck.length === 0 &&
        gameState.phase === 'PLAYER_SELECT_TARGET' &&
        gameState.activePlayerIndex === 0)
    ) {
      if (!hasTurnStartedForHumanRef.current) {
        hasTurnStartedForHumanRef.current = true;
        playerTurnsCountRef.current += 1;
        consecutiveHitsInTurnRef.current = 0;
      }
    } else if (gameState.phase === 'CPU_ACTING') {
      hasTurnStartedForHumanRef.current = false;
      consecutiveHitsInTurnRef.current = 0;
    }
  }, [gameState.phase, gameState.activePlayerIndex, gameState.deck.length]);

  // 人間プレイヤーの残り手札が1枚（ピンチ状態）になったかどうかの監視
  useEffect(() => {
    const human = gameState.players.find((p) => p.isHuman);
    if (human && !human.isEliminated) {
      const unrevealed = human.cards.filter((c) => !c.isOpen);
      if (unrevealed.length === 1) {
        wasInClutchRef.current = true;
      }
    }
  }, [gameState.players]);

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

  // 人間プレイヤーの脱落状態・観戦モード判定 (Issue #61)
  const isHumanEliminated = Boolean(
    gameState.players.find((p) => p.isHuman)?.isEliminated
  );
  const isSpectating =
    isHumanEliminated &&
    gameState.phase !== 'SETUP' &&
    gameState.phase !== 'GAME_OVER' &&
    gameState.winner === null;

  const isTimedMatch = gameState.timeLimit > 0;

  // 情報閲覧モーダル（ルール・ヒント・チュートリアル）が開いているか
  const isInformationModalOpen = Boolean(
    isRuleModalOpen || isHintModalOpen || isTutorialOpen || isTutorialPromptOpen
  );

  // タイマー一時停止（Pause）判定:
  // 持ち時間制（isTimedMatch）の場合、情報閲覧モーダル（ルール、ヒント、チュートリアル）ではタイマーを停止させずカウントダウンを継続する。
  // 明示的なゲーム中断（手動ポーズ isManualPaused、離脱確認 confirmModal.isOpen）のみでタイマーを停止させる（Issue #86 タイマーストール防止）。
  // 時間無制限モード（!isTimedMatch）では、情報閲覧モーダル表示中もポーズ状態として扱う。
  const isTimerPaused = Boolean(
    (isManualPaused ||
      confirmModal.isOpen ||
      (!isTimedMatch && isInformationModalOpen)) &&
      isGameInProgress &&
      gameState.phase !== 'CPU_ACTING'
  );

  // 新しい手番開始時に手動ポーズ状態を初期化＆山札切れ時の自動アタック選択遷移 (Issue #68)
  useEffect(() => {
    if (gameState.phase === 'PLAYER_TURN_START') {
      setIsManualPaused(false);
      if (gameState.deck.length === 0 && !gameState.winner) {
        setGameState((prev) => ({
          ...prev,
          drawnCard: null,
          phase: 'PLAYER_SELECT_TARGET',
        }));
      }
    }
  }, [gameState.phase, gameState.activePlayerIndex, gameState.deck.length, gameState.winner]);

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

  // AIヒント機能の実行ハンドラ (Issue #44)
  const handleRequestHint = useCallback(() => {
    if (hintCount <= 0) return;
    const hint = getBestHint(gameState.players, gameState.drawnCard, gameState.logs);
    setActiveHint(hint);
    setHintCount((prev) => Math.max(0, prev - 1));
    setIsHintModalOpen(true);
  }, [hintCount, gameState.players, gameState.drawnCard, gameState.logs]);

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

    soundManager.playDrawSound();
    haptics.vibrateLight();

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

    const humanPlayer = gameState.players.find((p) => p.isHuman);
    const currentUserId = userId || humanPlayer?.id || 'player';

    // 自分自身の手札をアタック対象に指定することを拒否 (Issue #88: Self-Attack Exploit防止)
    if (targetPlayer.isHuman || targetPlayer.id === currentUserId) {
      return;
    }

    setGameState((prev) => ({
      ...prev,
      selectedTarget: { playerId, cardIndex },
      phase: 'PLAYER_GUESS_NUMBER',
    }));
  };

  // プレイヤーが数字を予想してアタック確定 (Issue #56: 結果確認モーダル表示と確認待機)
  const handleConfirmGuess = async (guessedNumber: number) => {
    if (gameState.phase !== 'PLAYER_GUESS_NUMBER' || !gameState.selectedTarget) return;

    const { playerId, cardIndex } = gameState.selectedTarget;
    const targetPlayer = gameState.players.find((p) => p.id === playerId);
    if (!targetPlayer) return;

    const humanPlayer = gameState.players.find((p) => p.isHuman);
    const currentUserId = userId || humanPlayer?.id || 'player';

    // 防御的プログラミング（多層防御）: ターゲットが自分自身である場合は不正操作として即座に中断（拒否）し、セキュリティ監査ログを記録 (Issue #88)
    if (targetPlayer.isHuman || targetPlayer.id === currentUserId) {
      auditLogger.warn(
        'Self-attack attempt detected and blocked',
        {
          attackerId: currentUserId,
          targetPlayerId: targetPlayer.id,
          cardIndex,
          guessedNumber,
        },
        currentUserId
      );
      return;
    }

    const targetCard = targetPlayer.cards[cardIndex];
    if (!targetCard) return;

    // 防御的プログラミング（多層防御）: 入力バリデーション (Issue #85)
    // 1. guessedNumber が整数かつ 0〜11 の範囲内であること
    if (
      typeof guessedNumber !== 'number' ||
      !Number.isInteger(guessedNumber) ||
      guessedNumber < 0 ||
      guessedNumber > 11
    ) {
      auditLogger.warn(
        'INVALID_ATTACK_INPUT: guessedNumber must be an integer between 0 and 11',
        {
          attackerId: currentUserId,
          targetPlayerId: targetPlayer.id,
          cardIndex,
          guessedNumber,
        },
        currentUserId
      );
      return;
    }

    // 2. ターゲットカードと同色ですでに判明している数字（disabledNumbers相当）ではないこと
    const knownNumbers = getKnownNumbersForColor(
      targetCard.color,
      gameState.players,
      gameState.drawnCard
    );
    if (knownNumbers.includes(guessedNumber)) {
      auditLogger.warn(
        'INVALID_ATTACK_INPUT: guessedNumber is already known for target card color',
        {
          attackerId: currentUserId,
          targetPlayerId: targetPlayer.id,
          cardIndex,
          targetColor: targetCard.color,
          guessedNumber,
          knownNumbers,
        },
        currentUserId
      );
      return;
    }

    const isHit = checkAttack(targetCard, guessedNumber);

    soundManager.playAttackSound();
    haptics.vibrateLight();

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
      actualNumber: isHit ? targetCard.number : undefined,
      drawnCard: gameState.drawnCard || undefined,
      timestamp: Date.now(),
      message: isHit
        ? `${targetPlayer.name} の左から ${cardIndex + 1} 番目 [${targetCard.color === 'black' ? '黒' : '白'}] を [${guessedNumber}] と推理して【的中】！`
        : `${targetPlayer.name} の左から ${cardIndex + 1} 番目 [${targetCard.color === 'black' ? '黒' : '白'}] を [${guessedNumber}] と推理して【ハズレ】。`,
    };

    if (isHit) {
      consecutiveHitsInTurnRef.current += 1;
      if (consecutiveHitsInTurnRef.current > maxConsecutiveHitsInTurnRef.current) {
        maxConsecutiveHitsInTurnRef.current = consecutiveHitsInTurnRef.current;
      }
      if (consecutiveHitsInTurnRef.current >= 3) {
        const { updatedAchievements, newlyUnlocked } = checkAndUnlockAchievements({
          isWin: false,
          difficulty: gameState.difficulty,
          timeLimit: gameState.timeLimit,
          turns: playerTurnsCountRef.current,
          playerAttacks: 0,
          playerHits: 0,
          playerMisses: 0,
          maxConsecutiveHitsInSingleTurn: maxConsecutiveHitsInTurnRef.current,
          wasInClutch: false,
          stats: playerStats,
        });
        setPlayerAchievements(updatedAchievements);
        if (newlyUnlocked.length > 0) {
          setNewlyUnlockedToast(newlyUnlocked[0]);
        }
      }
      soundManager.playHitSound();
      haptics.vibrateSuccess();

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
      const isGameOver = activePlayers.length === 1;

      // 決着時（リーサルヒット）のダイナミックK.O.演出発動 (Issue #73)
      if (isGameOver) {
        triggerLethalKo(humanPlayer?.name || 'あなた');
      }

      // 盤面の被弾カードを即座に開示しログを追記
      setGameState((prev) => ({
        ...prev,
        players: updatedPlayers,
        logs: [log, ...prev.logs],
      }));

      // 推理結果確認モーダルを表示してOKを待機 (Issue #56)
      await waitForAttackOk({
        attackerName: humanPlayer?.name || 'あなた',
        isHuman: true,
        targetPlayerName: targetPlayer.name,
        targetCardIndex: cardIndex,
        targetColor: targetCard.color,
        guessedNumber,
        isHit: true,
        actualNumber: targetCard.number,
        nextAction: isGameOver ? 'GAME_OVER' : 'CONTINUE',
      });

      if (isGameOver) {
        setGameState((prev) => ({
          ...prev,
          winner: activePlayers[0],
          phase: 'GAME_OVER',
        }));
      } else {
        setGameState((prev) => ({
          ...prev,
          selectedTarget: null,
          phase: 'PLAYER_DECIDE_NEXT',
        }));
      }
    } else {
      consecutiveHitsInTurnRef.current = 0;
      soundManager.playMissSound();
      haptics.vibrateFailure();
      const playerIdx = gameState.players.findIndex((p) => p.isHuman);
      const isDeckExhausted = !gameState.drawnCard;

      // ペナルティ適用後のシミュレーション（勝敗判定用）
      const simulatedPlayers = [...gameState.players];
      if (playerIdx >= 0) {
        if (gameState.drawnCard) {
          const openedDrawn: Card = { ...gameState.drawnCard, isOpen: true };
          const newCards = insertCardInOrder(simulatedPlayers[playerIdx].cards, openedDrawn);
          simulatedPlayers[playerIdx] = {
            ...simulatedPlayers[playerIdx],
            cards: newCards,
            isEliminated: isAllOpen(newCards),
          };
        } else {
          // 山札0枚時のペナルティ: 自分の手札の最初の伏せカードをオープン (Issue #68)
          const firstClosedIdx = simulatedPlayers[playerIdx].cards.findIndex((c) => !c.isOpen);
          if (firstClosedIdx !== -1) {
            const newCards = simulatedPlayers[playerIdx].cards.map((c, i) =>
              i === firstClosedIdx ? { ...c, isOpen: true } : c
            );
            simulatedPlayers[playerIdx] = {
              ...simulatedPlayers[playerIdx],
              cards: newCards,
              isEliminated: isAllOpen(newCards),
            };
          }
        }
      }

      const activePlayersAfterPenalty = simulatedPlayers.filter((p) => !p.isEliminated);
      const isGameOver = activePlayersAfterPenalty.length === 1;

      const nextActiveIdx = getNextActivePlayerIndex(
        playerIdx >= 0 ? playerIdx : 0,
        simulatedPlayers
      );
      const nextPlayer = simulatedPlayers[nextActiveIdx];

      // ログ追記（山札切れ時は手札オープンされた旨を明記）
      const missSuffix = isDeckExhausted
        ? '山札がないため、手札の伏せカードがオープンされました。'
        : '';
      const updatedLog: AttackLog = {
        ...log,
        message: missSuffix ? `${log.message} ${missSuffix}` : log.message,
      };

      setGameState((prev) => ({
        ...prev,
        logs: [updatedLog, ...prev.logs],
      }));

      // 推理結果確認モーダルを表示してOKを待機 (Issue #56, #68)
      await waitForAttackOk({
        attackerName: humanPlayer?.name || 'あなた',
        isHuman: true,
        targetPlayerName: targetPlayer.name,
        targetCardIndex: cardIndex,
        targetColor: targetCard.color,
        guessedNumber,
        isHit: false,
        actualNumber: undefined,
        nextAction: isGameOver ? 'GAME_OVER' : 'TURN_END',
        nextPlayerName: isGameOver ? undefined : (nextPlayer ? nextPlayer.name : undefined),
        isDeckExhausted,
      });

      // OK押下後にカードをオープンして手番交代またはゲーム終了 (Issue #56, #68)
      setIsManualPaused(false);
      setActiveHint(null);
      setGameState((prev) => {
        const pIdx = prev.players.findIndex((p) => p.isHuman);
        const updatedPlayers = [...prev.players];
        if (prev.drawnCard && pIdx >= 0) {
          const openedDrawn: Card = { ...prev.drawnCard, isOpen: true };
          const newCards = insertCardInOrder(updatedPlayers[pIdx].cards, openedDrawn);
          updatedPlayers[pIdx] = {
            ...updatedPlayers[pIdx],
            cards: newCards,
            isEliminated: isAllOpen(newCards),
          };
        } else if (!prev.drawnCard && pIdx >= 0) {
          // 山札0枚時のペナルティ: 自分の手札の最初の伏せカードをオープン
          const firstClosedIdx = updatedPlayers[pIdx].cards.findIndex((c) => !c.isOpen);
          if (firstClosedIdx !== -1) {
            const newCards = updatedPlayers[pIdx].cards.map((c, i) =>
              i === firstClosedIdx ? { ...c, isOpen: true } : c
            );
            updatedPlayers[pIdx] = {
              ...updatedPlayers[pIdx],
              cards: newCards,
              isEliminated: isAllOpen(newCards),
            };
          }
        }

        const activePlayers = updatedPlayers.filter((p) => !p.isEliminated);
        if (activePlayers.length === 1) {
          return {
            ...prev,
            players: updatedPlayers,
            drawnCard: null,
            selectedTarget: null,
            winner: activePlayers[0],
            phase: 'GAME_OVER',
          };
        }

        const nextIdx = getNextActivePlayerIndex(pIdx >= 0 ? pIdx : 0, updatedPlayers);
        const isNextCpu = !updatedPlayers[nextIdx].isHuman;

        return {
          ...prev,
          players: updatedPlayers,
          drawnCard: null,
          selectedTarget: null,
          activePlayerIndex: nextIdx,
          remainingTime: prev.timeLimit,
          phase: isNextCpu
            ? 'CPU_ACTING'
            : (prev.deck.length === 0 ? 'PLAYER_SELECT_TARGET' : 'PLAYER_TURN_START'),
        };
      });
    }
  };
  handleConfirmGuessRef.current = handleConfirmGuess;

  // プレイヤーが「続けてアタック」を選択
  const handlePlayerContinue = () => {
    setGameState((prev) => ({
      ...prev,
      remainingTime: prev.timeLimit,
      phase: 'PLAYER_SELECT_TARGET',
      selectedTarget: null,
    }));
  };

  // プレイヤーが「ステイ（手番終了）」を選択
  const handlePlayerStay = () => {
    setIsManualPaused(false);
    setActiveHint(null);
    consecutiveHitsInTurnRef.current = 0;
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
      phase: isNextCpu
        ? 'CPU_ACTING'
        : (gameState.deck.length === 0 ? 'PLAYER_SELECT_TARGET' : 'PLAYER_TURN_START'),
    }));
  };

  // 持ち時間カウントダウン処理（プレイヤー手番時のみ）
  useEffect(() => {
    if (
      gameState.timeLimit === 0 ||
      gameState.phase === 'SETUP' ||
      gameState.phase === 'GAME_OVER' ||
      gameState.phase === 'CPU_ACTING' ||
      gameState.phase === 'PLAYER_DECIDE_NEXT' ||
      attackResult !== null ||
      isTimerPaused
    ) {
      return;
    }

    const interval = setInterval(() => {
      setGameState((prev) => {
        const nextRemainingTime = prev.remainingTime - 1;

        // 制限時間5秒以下の警告音・ハプティクス (Issue #63, #71)
        if (nextRemainingTime <= 5 && nextRemainingTime > 0) {
          soundManager.playTimeWarningSound();
          haptics.vibrateWarning();
        }

        if (nextRemainingTime <= 0) {
          // 時間切れ（0秒到達）強制オープンペナルティ処理
          clearInterval(interval);
          const playerIdx = prev.players.findIndex((p) => p.isHuman);
          const updatedPlayers = [...prev.players];

          // まだドローしていなければ山札から引いてオープンペナルティ
          let newDeck = [...prev.deck];
          let penaltyCard = prev.drawnCard;
          const wasAutoDrawn = !penaltyCard && newDeck.length > 0;

          if (wasAutoDrawn) {
            penaltyCard = newDeck[0];
            newDeck = newDeck.slice(1);
            setTimeUpBanner(TIME_UP_AUTO_DRAW_MESSAGE);
          } else if (!penaltyCard && newDeck.length === 0) {
            setTimeUpBanner(TIME_UP_NO_DECK_MESSAGE);
          } else {
            setTimeUpBanner(TIME_UP_MESSAGE);
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
          } else if (!penaltyCard && playerIdx >= 0) {
            // 山札0枚時のタイムアップペナルティ: 手札の最初の伏せカードをオープン (Issue #68)
            const firstClosedIdx = updatedPlayers[playerIdx].cards.findIndex((c) => !c.isOpen);
            if (firstClosedIdx !== -1) {
              const newCards = updatedPlayers[playerIdx].cards.map((c, i) =>
                i === firstClosedIdx ? { ...c, isOpen: true } : c
              );
              updatedPlayers[playerIdx] = {
                ...updatedPlayers[playerIdx],
                cards: newCards,
                isEliminated: isAllOpen(newCards),
              };
            }
          }

          const activePlayers = updatedPlayers.filter((p) => !p.isEliminated);
          const currentHumanId = userId || (playerIdx >= 0 ? prev.players[playerIdx].id : 'player');
          let logMsg = '時間切れ！引いたカードがオープンペナルティとなり手番終了。';
          if (wasAutoDrawn) {
            logMsg = '時間切れ！カードが自動ドローされ、オープンペナルティとなり手番終了。';
          } else if (!penaltyCard) {
            logMsg = '時間切れ！山札がないため手札の伏せカードがオープンペナルティとなり手番終了。';
          }

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
            message: logMsg,
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
            phase: updatedPlayers[nextIdx].isHuman
              ? (newDeck.length === 0 ? 'PLAYER_SELECT_TARGET' : 'PLAYER_TURN_START')
              : 'CPU_ACTING',
          };
        }

        return {
          ...prev,
          remainingTime: nextRemainingTime,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.phase, gameState.timeLimit, userId, isTimerPaused, attackResult]);

  // CPU手番の自律処理（連続アタックループ対応）
  useEffect(() => {
    if (gameState.phase !== 'CPU_ACTING' || gameState.winner !== null) return;

    const currentCpu = gameState.players[gameState.activePlayerIndex];
    if (!currentCpu || currentCpu.isHuman || currentCpu.isEliminated) return;

    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const delay = (ms: number) => {
      if (isSkippingToResultRef.current) return Promise.resolve();
      return new Promise<void>((resolve) => {
        timerId = setTimeout(resolve, ms);
      });
    };

    const executeCpuTurn = async () => {
      let currentDeck = [...gameState.deck];
      if (currentDeck.length > 0) {
        setCpuStatusMessage(`${currentCpu.name} が山札からドロー中...`);
      } else {
        setCpuStatusMessage(`${currentCpu.name} の手番（山札なし）...`);
      }
      await delay(900);
      if (!isMounted) return;

      let cpuDrawn: Card | null = null;
      if (currentDeck.length > 0) {
        cpuDrawn = currentDeck[0];
        currentDeck = currentDeck.slice(1);
        soundManager.playDrawSound();
        setGameState((prev) => ({
          ...prev,
          deck: currentDeck,
          drawnCard: cpuDrawn,
        }));
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
            phase: prev.players[nextIdx].isHuman
              ? (currentDeck.length === 0 ? 'PLAYER_SELECT_TARGET' : 'PLAYER_TURN_START')
              : 'CPU_ACTING',
          }));
          return;
        }

        const targetCard = targetPlayer.cards[decision.targetCardIndex];
        if (!targetCard) {
          return;
        }

        const isHit = checkAttack(targetCard, decision.guessedNumber);
        soundManager.playAttackSound();

        const isCpuDeckExhausted = !cpuDrawn;
        const missLogSuffix = isCpuDeckExhausted
          ? '山札がないため、手札の伏せカードがオープンされました。'
          : '';

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
          actualNumber: isHit ? targetCard.number : undefined,
          drawnCard: cpuDrawn || undefined,
          timestamp: Date.now(),
          message: isHit
            ? `${currentCpu.name} が ${targetPlayer.name} の左から ${decision.targetCardIndex + 1} 番目 [${targetCard.color === 'black' ? '黒' : '白'}] を [${decision.guessedNumber}] と推理して【的中】！`
            : `${currentCpu.name} が ${targetPlayer.name} の左から ${decision.targetCardIndex + 1} 番目 [${targetCard.color === 'black' ? '黒' : '白'}] を [${decision.guessedNumber}] と推理して【ハズレ】。${missLogSuffix ? ' ' + missLogSuffix : ''}`,
        };

        currentLogs = [log, ...currentLogs];

        if (isHit) {
          soundManager.playHitSound();
          if (targetPlayer.isHuman) {
            haptics.vibrateWarning();
          }
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
            triggerLethalKo(currentCpu.name);
            await waitForCpuAttackOk({
              attackerName: currentCpu.name,
              targetPlayerName: targetPlayer.name,
              targetCardIndex: decision.targetCardIndex,
              targetColor: targetCard.color,
              guessedNumber: decision.guessedNumber,
              isHit: true,
              actualNumber: targetCard.number,
              nextAction: 'GAME_OVER',
            });
            if (!isMounted) return;

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

            await waitForCpuAttackOk({
              attackerName: currentCpu.name,
              targetPlayerName: targetPlayer.name,
              targetCardIndex: decision.targetCardIndex,
              targetColor: targetCard.color,
              guessedNumber: decision.guessedNumber,
              isHit: true,
              actualNumber: targetCard.number,
              nextAction: 'CONTINUE',
            });
            if (!isMounted) return;

            setCpuStatusMessage(`${currentCpu.name} はさらにアタックを継続します...`);

            // 適切なディレイ（700〜1000ms）を挟んで連続アタックループ
            await delay(800);
            continue;
          } else {
            // ステイ (false)
            // 引いたカードを手札に伏せて整列挿入し、次のプレイヤーへ手番を遷移
            const cpuIdx = currentPlayers.findIndex((p) => p.id === currentCpu.id);
            let insertedIdx = -1;
            if (cpuDrawn && cpuIdx !== -1) {
              const { newHand, insertedIndex } = insertCardInOrderWithIndex(currentPlayers[cpuIdx].cards, {
                ...cpuDrawn,
                isOpen: false,
              });
              currentPlayers[cpuIdx] = {
                ...currentPlayers[cpuIdx],
                cards: newHand,
              };
              insertedIdx = insertedIndex;
              setRecentlyInsertedCard({ playerId: currentCpu.id, cardId: cpuDrawn.id });
            }

            // ログに「CPU {名前} が山札から [{黒/白}] を引き、左から {N} 番目に挿入しました」を記録 (Issue #66)
            const colorText = cpuDrawn ? (cpuDrawn.color === 'black' ? '黒' : '白') : '';
            const stayMessage = cpuDrawn
              ? `${currentCpu.name} が山札から [${colorText}] を引き、左から ${insertedIdx + 1} 番目に挿入しました。`
              : `${currentCpu.name} はステイしました`;

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
              message: stayMessage,
            };
            currentLogs = [stayLog, ...currentLogs];

            const nextIdx = getNextActivePlayerIndex(gameState.activePlayerIndex, currentPlayers);
            const nextPlayer = currentPlayers[nextIdx];
            const nextPlayerName = nextPlayer ? (nextPlayer.isHuman ? 'あなた' : nextPlayer.name) : undefined;

            // 盤面を更新（drawnCard を null にリセットして手札へ移動）
            setGameState((prev) => ({
              ...prev,
              deck: currentDeck,
              drawnCard: null,
              players: currentPlayers,
              logs: currentLogs,
            }));

            await waitForCpuAttackOk({
              attackerName: currentCpu.name,
              targetPlayerName: targetPlayer.name,
              targetCardIndex: decision.targetCardIndex,
              targetColor: targetCard.color,
              guessedNumber: decision.guessedNumber,
              isHit: true,
              actualNumber: targetCard.number,
              nextAction: 'STAY',
              nextPlayerName,
              isDeckExhausted: !cpuDrawn,
            });
            if (!isMounted) return;

            const isNextHuman = currentPlayers[nextIdx].isHuman;

            setGameState((prev) => ({
              ...prev,
              deck: currentDeck,
              players: currentPlayers,
              logs: currentLogs,
              activePlayerIndex: nextIdx,
              remainingTime: prev.timeLimit,
              phase: isNextHuman
                ? (currentDeck.length === 0 ? 'PLAYER_SELECT_TARGET' : 'PLAYER_TURN_START')
                : 'CPU_ACTING',
            }));
            setCpuStatusMessage(
              cpuDrawn
                ? `${currentCpu.name} は手札に加えてステイしました。`
                : `${currentCpu.name} はステイしました。`
            );
            return;
          }
        } else {
          // ハズレ (isHit === false)
          soundManager.playMissSound();
          const cpuIdx = currentPlayers.findIndex((p) => p.id === currentCpu.id);
          let insertedIdx = -1;
          if (cpuDrawn && cpuIdx !== -1) {
            const { newHand, insertedIndex } = insertCardInOrderWithIndex(currentPlayers[cpuIdx].cards, {
              ...cpuDrawn,
              isOpen: true,
            });
            currentPlayers[cpuIdx] = {
              ...currentPlayers[cpuIdx],
              cards: newHand,
              isEliminated: isAllOpen(newHand),
            };
            insertedIdx = insertedIndex;
            setRecentlyInsertedCard({ playerId: currentCpu.id, cardId: cpuDrawn.id });

            // ログに山札から引いたカードの挿入を明記 (Issue #66)
            const colorText = cpuDrawn.color === 'black' ? '黒' : '白';
            const insertLog: AttackLog = {
              id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              attackerId: currentCpu.id,
              attackerName: currentCpu.name,
              targetPlayerId: '',
              targetPlayerName: '',
              targetCardIndex: 0,
              targetColor: cpuDrawn.color,
              guessedNumber: 0,
              isHit: false,
              actualNumber: cpuDrawn.number,
              drawnCard: cpuDrawn,
              timestamp: Date.now(),
              message: `${currentCpu.name} が山札から [${colorText}] を引き、左から ${insertedIdx + 1} 番目に挿入しました。`,
            };
            currentLogs = [insertLog, ...currentLogs];
          } else if (!cpuDrawn && cpuIdx !== -1) {
            // 山札0枚ペナルティ: 手札の最初の伏せカードをオープン (Issue #68)
            const firstClosedIdx = currentPlayers[cpuIdx].cards.findIndex((c) => !c.isOpen);
            if (firstClosedIdx !== -1) {
              const newCards = currentPlayers[cpuIdx].cards.map((c, i) =>
                i === firstClosedIdx ? { ...c, isOpen: true } : c
              );
              currentPlayers[cpuIdx] = {
                ...currentPlayers[cpuIdx],
                cards: newCards,
                isEliminated: isAllOpen(newCards),
              };
            }
          }

          const activePlayers = currentPlayers.filter((p) => !p.isEliminated);
          const isGameOver = activePlayers.length === 1;

          const nextIdx = getNextActivePlayerIndex(gameState.activePlayerIndex, currentPlayers);
          const nextPlayer = currentPlayers[nextIdx];
          const nextPlayerName = nextPlayer ? (nextPlayer.isHuman ? 'あなた' : nextPlayer.name) : undefined;

          // カードがオープンされた盤面を即座にUIへ反映（drawnCard を null にリセットして手札へ移動）
          setGameState((prev) => ({
            ...prev,
            deck: currentDeck,
            drawnCard: null,
            players: currentPlayers,
            logs: currentLogs,
          }));

          await waitForCpuAttackOk({
            attackerName: currentCpu.name,
            targetPlayerName: targetPlayer.name,
            targetCardIndex: decision.targetCardIndex,
            targetColor: targetCard.color,
            guessedNumber: decision.guessedNumber,
            isHit: false,
            actualNumber: undefined,
            nextAction: isGameOver ? 'GAME_OVER' : 'TURN_END',
            nextPlayerName: isGameOver ? undefined : nextPlayerName,
            isDeckExhausted: !cpuDrawn,
          });
          if (!isMounted) return;

          if (isGameOver) {
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

          const isNextHuman = currentPlayers[nextIdx].isHuman;

          setGameState((prev) => ({
            ...prev,
            deck: currentDeck,
            players: currentPlayers,
            logs: currentLogs,
            activePlayerIndex: nextIdx,
            remainingTime: prev.timeLimit,
            phase: isNextHuman
              ? (currentDeck.length === 0 ? 'PLAYER_SELECT_TARGET' : 'PLAYER_TURN_START')
              : 'CPU_ACTING',
          }));
          setCpuStatusMessage(
            !cpuDrawn
              ? `${currentCpu.name} の推理はハズレました（山札なしのため手札をオープン）。`
              : `${currentCpu.name} の推理はハズレました。`
          );
          return;
        }
      }

      // ループガード（最大10回）上限到達時のステイ処理
      const cpuIdx = currentPlayers.findIndex((p) => p.id === currentCpu.id);
      let insertedIdx = -1;
      if (cpuDrawn && cpuIdx !== -1) {
        const { newHand, insertedIndex } = insertCardInOrderWithIndex(currentPlayers[cpuIdx].cards, {
          ...cpuDrawn,
          isOpen: false,
        });
        currentPlayers[cpuIdx] = {
          ...currentPlayers[cpuIdx],
          cards: newHand,
        };
        insertedIdx = insertedIndex;
        setRecentlyInsertedCard({ playerId: currentCpu.id, cardId: cpuDrawn.id });
      }

      const colorText = cpuDrawn ? (cpuDrawn.color === 'black' ? '黒' : '白') : '';
      const stayMessage = cpuDrawn
        ? `${currentCpu.name} が山札から [${colorText}] を引き、左から ${insertedIdx + 1} 番目に挿入しました。`
        : `${currentCpu.name} はステイしました`;

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
        message: stayMessage,
      };
      currentLogs = [stayLog, ...currentLogs];

      const nextIdx = getNextActivePlayerIndex(gameState.activePlayerIndex, currentPlayers);
      const nextPlayer = currentPlayers[nextIdx];
      const nextPlayerName = nextPlayer ? (nextPlayer.isHuman ? 'あなた' : nextPlayer.name) : undefined;

      setGameState((prev) => ({
        ...prev,
        deck: currentDeck,
        drawnCard: null,
        players: currentPlayers,
        logs: currentLogs,
      }));

      await waitForCpuAttackOk({
        attackerName: currentCpu.name,
        targetPlayerName: '相手',
        targetCardIndex: 0,
        targetColor: 'black',
        guessedNumber: 0,
        isHit: true,
        nextAction: 'STAY',
        nextPlayerName,
        isDeckExhausted: !cpuDrawn,
      });
      if (!isMounted) return;

      const isNextHuman = currentPlayers[nextIdx].isHuman;

      setGameState((prev) => ({
        ...prev,
        deck: currentDeck,
        players: currentPlayers,
        logs: currentLogs,
        activePlayerIndex: nextIdx,
        remainingTime: prev.timeLimit,
        phase: isNextHuman
          ? (currentDeck.length === 0 ? 'PLAYER_SELECT_TARGET' : 'PLAYER_TURN_START')
          : 'CPU_ACTING',
      }));
      setCpuStatusMessage(
        cpuDrawn
          ? `${currentCpu.name} は手札に加えてステイしました。`
          : `${currentCpu.name} はステイしました。`
      );
    };

    executeCpuTurn();

    return () => {
      isMounted = false;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [gameState.phase, gameState.activePlayerIndex, gameState.winner]);

  // ターゲットカード情報およびターゲット色に応じた確認済み数字（Issue #38）
  const humanPlayer = gameState.players.find((p) => p.isHuman);
  const selectedTargetPlayer = gameState.selectedTarget
    ? gameState.players.find((p) => p.id === gameState.selectedTarget?.playerId)
    : null;
  const selectedTargetCard =
    selectedTargetPlayer && gameState.selectedTarget
      ? selectedTargetPlayer.cards[gameState.selectedTarget.cardIndex]
      : null;
  const selectedTargetColor: CardColor = selectedTargetCard?.color || 'black';
  const targetKnownNumbers = getKnownNumbersForColor(
    selectedTargetColor,
    gameState.players,
    gameState.drawnCard
  );

  // 残弾デッキトラッカー用計算（Issue #65）
  // 選択中ターゲットカードの推理候補数字（アシスト連動）
  const trackerHighlightNumbers =
    selectedTargetPlayer && gameState.selectedTarget
      ? getPossibleNumbersForCard({
          targetIndex: gameState.selectedTarget.cardIndex,
          targetHand: selectedTargetPlayer.cards,
          allPlayers: gameState.players,
          drawnCard: gameState.drawnCard,
          logs: gameState.logs,
          targetPlayerId: selectedTargetPlayer.id,
        })
      : [];
  const trackerHighlightColor = selectedTargetCard?.color || null;

  const trackerState = calculateDeckTrackerState({
    players: gameState.players,
    drawnCard: gameState.drawnCard,
    highlightedNumbers: trackerHighlightNumbers,
    highlightColor: trackerHighlightColor,
  });

  // 1. セットアップ画面
  if (gameState.phase === 'SETUP') {
    return (
      <div className="min-h-full flex-1 flex flex-col justify-center items-center p-1.5 sm:p-4 lg:py-8 overflow-y-auto lg:overflow-visible overscroll-contain">
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
          onOpenTutorial={() => setIsTutorialOpen(true)}
          onOpenStats={() => setIsStatsModalOpen(true)}
          isSoundEnabled={isSoundEnabled}
          isSoundMuted={!isSoundEnabled}
          onToggleSound={handleToggleSound}
        />
        <RuleGuideModal
          isOpen={isRuleModalOpen}
          onClose={() => setIsRuleModalOpen(false)}
          isTimedMatch={isTimedMatch}
        />
        <TutorialPromptModal
          isOpen={isTutorialPromptOpen}
          onStartTutorial={() => {
            setIsTutorialPromptOpen(false);
            setIsTutorialOpen(true);
          }}
          onSkip={() => setIsTutorialPromptOpen(false)}
        />
        <TutorialModal
          isOpen={isTutorialOpen}
          onClose={() => setIsTutorialOpen(false)}
          onComplete={() => setIsTutorialOpen(false)}
          isTimedMatch={isTimedMatch}
        />
        <StatsModal
          isOpen={isStatsModalOpen}
          onClose={() => setIsStatsModalOpen(false)}
          stats={playerStats}
          achievements={playerAchievements}
          onResetStats={handleResetStats}
        />
      </div>
    );
  }

  // 2. 対戦盤面
  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const opponents = gameState.players.filter((p) => !p.isHuman);
  const activeCardSize = opponents.length === 1 ? 'sm' : 'xs';
  const isGameOver = gameState.phase === 'GAME_OVER';

  const isHumanTurn = Boolean(
    activePlayer?.isHuman &&
      !isGameOver &&
      gameState.phase !== 'CPU_ACTING'
  );
  const isHintDisabled = !isHumanTurn || hintCount <= 0;

  return (
    <div
      data-testid="board-outer-container"
      className={`w-full max-w-7xl mx-auto px-1.5 sm:px-4 lg:px-6 py-1 sm:py-2 lg:py-2.5 min-h-full flex-1 flex flex-col justify-between overflow-y-auto lg:overflow-visible overscroll-contain gap-1 sm:gap-2 lg:gap-2.5 ${
        isScreenShaking ? 'animate-shake' : ''
      }`}
    >
      {/* 新規アチーブメント解除トースト通知 */}
      {newlyUnlockedToast && (
        <div
          data-testid="achievement-toast"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900/95 text-white border-2 border-amber-400 rounded-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-200 max-w-sm w-full mx-auto"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-2xl shrink-0">
            {newlyUnlockedToast.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>実績解除！</span>
            </div>
            <p className="text-xs sm:text-sm font-black truncate">
              {newlyUnlockedToast.title}{' '}
              <span className="font-normal text-[11px] text-slate-400">
                ({newlyUnlockedToast.nameEn})
              </span>
            </p>
            <p className="text-[11px] text-slate-300 truncate">
              {newlyUnlockedToast.description}
            </p>
          </div>
          <button
            type="button"
            data-testid="close-achievement-toast"
            aria-label="閉じる"
            onClick={() => setNewlyUnlockedToast(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Top Header */}
      <header className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-sm overflow-hidden shrink-0">
        <div className="w-full h-1 sm:h-2 algo-diamond-pattern border-b border-slate-100" />

        <div className="p-1.5 sm:p-2 lg:p-2.5 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2.5">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-2xl overflow-hidden shadow-sm border border-slate-200 shrink-0">
              <img src="/app-icon.jpg" alt="algo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1 sm:gap-2">
                algo
                <span className="text-[8px] sm:text-[10px] font-bold px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full bg-algo-blue/15 text-algo-blue whitespace-nowrap">
                  {gameState.playerCount}人対戦
                </span>
                <span className="text-[8px] sm:text-[10px] font-bold px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full bg-algo-yellow text-slate-950 whitespace-nowrap">
                  {gameState.difficulty === 'easy'
                    ? '初級'
                    : gameState.difficulty === 'normal'
                    ? '中級'
                    : '上級'}
                </span>
                <span className="text-[8px] sm:text-[10px] font-bold px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                  {gameState.timeLimit === 0 ? '無制限' : `${gameState.timeLimit}秒`}
                </span>
                <span data-testid="gameboard-version-badge" className="text-[8px] sm:text-[10px] font-medium font-mono px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap">
                  {getAppVersion()}
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">数字当て論理推理ボードゲーム</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 max-w-full overflow-x-auto no-scrollbar py-0.5 shrink-0">
            {/* カウントダウンタイマー表示 ＆ プログレスバー */}
            {gameState.timeLimit > 0 && activePlayer?.isHuman && (
              <div className="flex flex-col gap-0.5 sm:gap-1 items-stretch shrink-0">
                <button
                  type="button"
                  data-testid="timer-display"
                  onClick={() => setIsManualPaused((prev) => !prev)}
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 py-0.5 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border font-black text-[10px] sm:text-xs transition-all cursor-pointer select-none whitespace-nowrap shrink-0 ${getTimerColorClass(
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
                      <span className="text-[9px] sm:text-[11px] text-amber-600 font-bold">({gameState.remainingTime}秒)</span>
                    </>
                  ) : (
                    <>
                      <Clock
                        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
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
                  className="w-full h-1 sm:h-1.5 bg-slate-100 rounded-full overflow-hidden"
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

            {/* AIヒントボタン (Issue #44) */}
            <button
              type="button"
              data-testid="btn-get-hint"
              onClick={handleRequestHint}
              disabled={isHintDisabled}
              aria-label={`AIヒント: 残り${hintCount}回`}
              className={`flex items-center gap-1 px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border text-[10px] sm:text-xs font-bold transition-all shadow-2xs whitespace-nowrap shrink-0 ${
                isHintDisabled
                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                  : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 ring-1 ring-amber-200 cursor-pointer shadow-xs active:scale-95'
              }`}
              title={
                hintCount <= 0
                  ? 'ヒントは使い切りました（残り0回）'
                  : !isHumanTurn
                  ? 'あなたのターン中に使用できます'
                  : `AIヒントを使用（残り${hintCount}回）`
              }
            >
              <Lightbulb className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${!isHintDisabled ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>{`💡 ヒント（残り${hintCount}回）`}</span>
            </button>

            <button
              type="button"
              data-testid="btn-toggle-assist"
              onClick={toggleAssist}
              aria-label={`初心者アシスト表示: ${isAssistEnabled ? 'ON' : 'OFF'}`}
              aria-pressed={isAssistEnabled}
              className={`flex items-center gap-1 px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border text-[10px] sm:text-xs font-bold transition-all shadow-2xs whitespace-nowrap shrink-0 ${
                isAssistEnabled
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 ring-1 ring-emerald-200'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
              title={isAssistEnabled ? '初心者アシストON（クリックでOFF）' : '初心者アシストOFF（クリックでON）'}
            >
              <span className="text-xs" aria-hidden="true">🔰</span>
              <span>アシスト {isAssistEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* サウンドON/OFFトグルボタン (Issue #63, #71, #118: モバイル時はメニュー内に格納) */}
            <button
              type="button"
              data-testid="btn-sound-toggle"
              onClick={handleToggleSound}
              aria-label={`サウンド効果音: ${isSoundEnabled ? 'ON' : 'OFF'}`}
              aria-pressed={isSoundEnabled}
              className={`hidden lg:flex items-center gap-1 px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border text-[10px] sm:text-xs font-bold transition-all shadow-2xs whitespace-nowrap shrink-0 ${
                isSoundEnabled
                  ? 'border-algo-blue/40 bg-algo-blue-light/30 text-algo-navy hover:bg-algo-blue-light/50 ring-1 ring-algo-blue/20'
                  : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
              title={isSoundEnabled ? 'サウンドON（クリックでミュート）' : 'サウンドOFF（クリックでON）'}
            >
              {isSoundEnabled ? (
                <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-algo-blue" />
              ) : (
                <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
              )}
              <span>サウンド {isSoundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              data-testid="btn-header-tutorial"
              onClick={() => setIsTutorialOpen(true)}
              className="hidden lg:flex items-center gap-1 px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-algo-blue/30 bg-algo-blue-light/30 hover:bg-algo-blue-light/60 text-algo-navy text-[10px] sm:text-xs font-bold transition-all shadow-2xs whitespace-nowrap shrink-0"
            >
              <GraduationCap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-algo-blue" />
              <span>チュートリアル</span>
            </button>

            <button
              data-testid="btn-open-rules"
              onClick={() => setIsRuleModalOpen(true)}
              className="hidden lg:flex items-center gap-1 px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] sm:text-xs font-bold transition-all shadow-2xs whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-algo-blue" />
              <span>ルール</span>
            </button>

            <button
              type="button"
              data-testid="btn-open-stats"
              onClick={() => setIsStatsModalOpen(true)}
              className="hidden lg:flex items-center gap-1 px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10px] sm:text-xs font-bold transition-all shadow-2xs whitespace-nowrap shrink-0"
              title="通算戦績・アチーブメントを表示"
            >
              <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />
              <span>戦績</span>
            </button>

            <button
              data-testid="btn-restart-game"
              onClick={handleRequestRestart}
              className="hidden lg:flex items-center gap-1 px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] sm:text-xs font-bold transition-all shadow-2xs whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-600" />
              <span>再戦</span>
            </button>

            <button
              data-testid="btn-open-settings"
              onClick={handleRequestSetup}
              className="hidden lg:flex items-center gap-1 px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[10px] sm:text-xs font-bold transition-all shadow-2xs whitespace-nowrap shrink-0"
            >
              <Settings2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-algo-yellow" />
              <span>設定</span>
            </button>

            {/* ゲーム終了時にリザルトモーダルを閉じた場合の再表示ボタン (Issue #60) */}
            {isGameOver && !isResultModalOpen && (
              <button
                type="button"
                data-testid="btn-reopen-result"
                onClick={() => setIsResultModalOpen(true)}
                className="hidden lg:flex items-center gap-1 px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] sm:text-xs font-black transition-all shadow-2xs whitespace-nowrap shrink-0"
              >
                <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-950" />
                <span>結果を見る</span>
              </button>
            )}

            {/* モバイル専用 残弾トラッカー表示トグルボタン (lg未満で表示) (Issue #65, Issue #116) */}
            <button
              type="button"
              data-testid="btn-open-deck-tracker-mobile"
              onClick={() => setIsMobileTrackerOpen((prev) => !prev)}
              className="flex items-center gap-1 px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] sm:text-xs font-bold transition-all shadow-2xs lg:hidden relative whitespace-nowrap shrink-0"
              aria-label={`残弾トラッカーを開く (残弾 ${trackerState.summary.totalRemaining}/24枚)`}
            >
              <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-algo-blue shrink-0" />
              <span>残弾</span>
              <span className="ml-0.5 px-1 py-0.2 rounded-full bg-algo-blue/15 text-algo-blue text-[9px] font-black">
                {trackerState.summary.totalRemaining}/24
              </span>
            </button>

            {/* モバイル専用 ログ表示トグルボタン (lg未満で表示) */}
            <button
              type="button"
              data-testid="btn-toggle-log"
              onClick={() => setIsMobileLogOpen((prev) => !prev)}
              className="flex items-center gap-1 px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] sm:text-xs font-bold transition-all shadow-2xs lg:hidden relative whitespace-nowrap shrink-0"
              aria-label={`対戦ログを開く (${gameState.logs.length}件)`}
            >
              <ScrollText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-algo-blue" />
              <span>ログ</span>
              {gameState.logs.length > 0 && (
                <span className="ml-0.5 px-1 py-0.2 rounded-full bg-algo-blue/15 text-algo-blue text-[9px] font-black">
                  {gameState.logs.length}
                </span>
              )}
            </button>

            {/* モバイル専用 「☰ メニュー」ボタン (lg未満で表示) (Issue #118) */}
            <button
              type="button"
              data-testid="btn-open-mobile-menu"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="メニューを開く"
              className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-[10px] sm:text-xs font-bold transition-all shadow-2xs lg:hidden relative whitespace-nowrap shrink-0 active:scale-95"
            >
              <Menu className="w-3.5 h-3.5 text-slate-700 shrink-0" />
              <span>メニュー</span>
            </button>
          </div>
        </div>
      </header>

      {/* タイムアップ（0秒到達）警告通知バナー */}
      {timeUpBanner && (
        <div
          data-testid="timeup-banner"
          role="alert"
          className="bg-rose-50 border-2 border-rose-300 text-rose-800 px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl shadow-md flex items-center justify-between gap-2 sm:gap-3 animate-pulse transition-all shrink-0"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 shrink-0" />
            <span className="font-bold text-xs sm:text-sm">
              {timeUpBanner}
            </span>
          </div>
          <button
            type="button"
            data-testid="close-timeup-banner"
            onClick={() => setTimeUpBanner(null)}
            className="text-rose-500 hover:text-rose-700 font-black text-xs sm:text-sm p-1 rounded-lg hover:bg-rose-100 transition-colors"
            aria-label="通知を閉じる"
          >
            ✕
          </button>
        </div>
      )}

      {/* プレイヤー脱落通知バナー（観戦モード案内） (Issue #61) */}
      {isSpectating && !isEliminationDismissed && (
        <div
          data-testid="elimination-banner"
          role="alert"
          className="bg-purple-50 border-2 border-purple-300 text-purple-900 px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl shadow-md flex items-center justify-between gap-2 sm:gap-3 shrink-0 animate-fade-in"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base sm:text-lg">💥</span>
            <span className="font-bold text-xs sm:text-sm">
              {ELIMINATION_MESSAGE}
            </span>
            <div className="flex items-center gap-1.5 ml-1">
              <button
                type="button"
                data-testid="banner-toggle-auto-advance"
                onClick={() => setIsAutoSpectate((prev) => !prev)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors cursor-pointer ${
                  isAutoSpectate
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-100'
                }`}
              >
                {isAutoSpectate ? '自動観戦: ON' : '自動観戦: OFF'}
              </button>
              <button
                type="button"
                data-testid="banner-skip-to-result"
                onClick={handleSkipToResult}
                className="text-[11px] font-black px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white shadow-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
              >
                <FastForward className="w-3 h-3" />
                <span>決着までスキップ</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-elimination-banner"
            onClick={() => setIsEliminationDismissed(true)}
            className="text-purple-500 hover:text-purple-700 font-black text-xs sm:text-sm p-1 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer"
            aria-label="通知を閉じる"
          >
            ✕
          </button>
        </div>
      )}

      {/* ゲームオーバー時の全手札開示（答え合わせ）バナー (Issue #60) */}
      {isGameOver && (
        <div
          data-testid="game-over-reveal-banner"
          className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl shadow-xs flex items-center justify-between gap-2 shrink-0"
        >
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>【ゲーム終了】全プレイヤーの手札の答え合わせが開示されています</span>
          </div>
          {!isResultModalOpen && (
            <button
              type="button"
              onClick={() => setIsResultModalOpen(true)}
              className="text-xs font-black text-amber-800 underline hover:text-amber-950 shrink-0 cursor-pointer"
            >
              結果をもう一度見る
            </button>
          )}
        </div>
      )}

      {/* Main Game Field Grid */}
      <div className="flex-1 min-h-0 flex flex-col justify-start gap-1.5 sm:gap-2.5 lg:grid lg:grid-cols-4 lg:gap-4 lg:justify-normal">
        {/* Left 3 cols: Board Field */}
        <div className="flex-1 min-h-0 flex flex-col justify-start gap-1 sm:gap-2 lg:col-span-3 lg:space-y-2 lg:justify-normal">
          {/* Opponents Area: 2人(相手1人) / 3人(縦2人) / 4人(縦3人) 全モード縦積みスタック */}
          <div className={`flex flex-col ${opponents.length >= 3 ? 'gap-1 sm:gap-1.5' : 'gap-1 sm:gap-1.5 lg:gap-2'}`}>
            {opponents.map((opp) => {
              const isCurrentTurn = activePlayer?.id === opp.id;
              const openCount = opp.cards.filter((c) => c.isOpen).length;

              return (
                <div
                  key={opp.id}
                  data-testid={`player-hand-${opp.id}`}
                  className={`bg-white rounded-xl sm:rounded-2xl border transition-all relative ${
                    opponents.length >= 3
                      ? 'p-1.5 sm:p-2.5 lg:p-2 shadow-2xs'
                      : opponents.length === 2
                      ? 'p-1.5 sm:p-2.5 lg:p-2.5 shadow-2xs'
                      : 'p-2 sm:p-3 lg:p-3.5 shadow-xs'
                  } ${
                    opp.isEliminated
                      ? 'border-slate-200 bg-slate-50/60 opacity-60'
                      : isCurrentTurn
                      ? 'border-algo-blue ring-2 sm:ring-4 ring-algo-blue/20 shadow-md'
                      : 'border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2">
                    {/* Left: Player Info & Status */}
                    <div className="flex items-center justify-between sm:justify-start sm:w-36 lg:w-44 shrink-0 gap-1 sm:gap-1.5">
                      <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                        <div
                          className={`${
                            opponents.length > 1
                              ? 'w-4 h-4 sm:w-5 sm:h-5 text-[10px]'
                              : 'w-5 h-5 sm:w-6 sm:h-6 text-xs'
                          } rounded-lg bg-gradient-to-br ${opp.avatarColor} text-white flex items-center justify-center font-bold shadow-2xs shrink-0`}
                        >
                          <Bot className={opponents.length > 1 ? 'w-2.5 h-2.5 sm:w-3.5 sm:h-3.5' : 'w-3 h-3 sm:w-4 sm:h-4'} />
                        </div>
                        <div className="min-w-0">
                          <span className="font-black text-[10px] sm:text-xs text-slate-900 block leading-tight truncate">{opp.name}</span>
                          <span className="text-[8px] sm:text-[9.5px] text-slate-400 font-semibold block leading-none">
                            ({openCount}/{opp.cards.length} 枚OPEN)
                          </span>
                        </div>
                      </div>

                      {opp.isEliminated ? (
                        <span className="text-[8px] sm:text-[10px] px-1 py-0.2 sm:px-2 sm:py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold shrink-0">
                          脱落
                        </span>
                      ) : isCurrentTurn ? (
                        <span className="text-[8px] sm:text-[10px] px-1 py-0.2 sm:px-2 sm:py-0.5 rounded-full bg-algo-blue text-white font-bold animate-pulse shrink-0">
                          思考中
                        </span>
                      ) : null}
                    </div>

                    {/* Center: Cards */}
                    <div
                      data-testid={`cards-container-${opp.id}`}
                      className="items-center py-0.5 flex flex-nowrap overflow-x-auto no-scrollbar justify-center gap-1 sm:gap-2 min-w-0 flex-1"
                    >
                      {opp.cards.map((card, idx) => {
                        const candidateHint =
                          !isGameOver && isAssistEnabled && !card.isOpen && !opp.isEliminated
                            ? formatCandidateRange(
                                getPossibleNumbersForCard({
                                  targetIndex: idx,
                                  targetHand: opp.cards,
                                  allPlayers: gameState.players,
                                  drawnCard: gameState.drawnCard,
                                  logs: gameState.logs,
                                  targetPlayerId: opp.id,
                                })
                              )
                            : undefined;

                        const failedNumbers = !isGameOver ? getFailedNumbersForCard(gameState.logs, opp.id, idx) : undefined;
                        const isHintTarget = Boolean(
                          !isGameOver &&
                          activeHint &&
                          activeHint.targetPlayerId === opp.id &&
                          activeHint.targetCardIndex === idx &&
                          !card.isOpen &&
                          !opp.isEliminated
                        );

                        return (
                          <CardComponent
                            key={card.id}
                            card={isGameOver ? card : maskCardForPlayer(card, false)}
                            isOwner={false}
                            isRevealed={isGameOver}
                            size={activeCardSize}
                            label={`#${idx + 1}`}
                            testId={`opponent-card-${idx}`}
                            candidateHint={candidateHint}
                            failedGuesses={failedNumbers}
                            isEliminated={opp.isEliminated}
                            isHintTarget={isHintTarget}
                            isNewlyInserted={
                              !isGameOver &&
                              recentlyInsertedCard?.playerId === opp.id &&
                              recentlyInsertedCard?.cardId === card.id
                            }
                            isSelectable={
                              !isGameOver &&
                              activePlayer?.isHuman &&
                              gameState.phase === 'PLAYER_SELECT_TARGET' &&
                              !opp.isEliminated &&
                              !card.isOpen
                            }
                            isSelected={
                              !isGameOver &&
                              gameState.selectedTarget?.playerId === opp.id &&
                              gameState.selectedTarget?.cardIndex === idx
                            }
                            onClick={() => handleSelectTargetCard(opp.id, idx)}
                          />
                        );
                      })}
                    </div>

                    {/* Right: Dummy spacer for perfect centering on desktop */}
                    <div className="hidden sm:block shrink-0 sm:w-36 lg:w-44" aria-hidden="true" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Player Attack Notice */}
          {gameState.phase === 'PLAYER_SELECT_TARGET' && (
            <div className="text-center my-0 sm:my-0.5 shrink-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-4 sm:py-1 rounded-lg sm:rounded-2xl bg-algo-blue-light border border-algo-blue/30 text-algo-navy text-[10px] sm:text-xs font-black shadow-xs animate-attack-pulse">
                <span>👆 推理したい相手の伏せカード（?）をクリック！</span>
              </span>
            </div>
          )}

          {/* Deck & Action Bar (自手札直上配置・コンパクトバー形式で中央のデッドスペースを解消) */}
          <section
            data-testid="deck-action-bar"
            className="bg-white rounded-xl sm:rounded-2xl p-1 sm:px-3 sm:py-1.5 border border-slate-200 shadow-xs flex items-center justify-between gap-1.5 sm:gap-3 shrink-0"
          >
            {/* 1. 山札 (Deck Pile) */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div
                data-testid="btn-draw-card"
                role={gameState.phase === 'PLAYER_TURN_START' && gameState.deck.length > 0 ? 'button' : undefined}
                tabIndex={gameState.phase === 'PLAYER_TURN_START' && gameState.deck.length > 0 ? 0 : undefined}
                aria-label={`山札 (残り${gameState.deck.length}枚)${
                  gameState.phase === 'PLAYER_TURN_START' && gameState.deck.length > 0 ? ' - クリックしてドロー' : ''
                }`}
                onKeyDown={
                  gameState.phase === 'PLAYER_TURN_START' && gameState.deck.length > 0
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handlePlayerDraw();
                        }
                      }
                    : undefined
                }
                onClick={gameState.phase === 'PLAYER_TURN_START' && gameState.deck.length > 0 ? handlePlayerDraw : undefined}
                className={`relative w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-14 rounded-lg sm:rounded-xl border flex flex-col items-center justify-center select-none transition-all ${
                  gameState.phase === 'PLAYER_TURN_START' && gameState.deck.length > 0
                    ? 'border-algo-yellow-dark bg-algo-yellow-light/80 shadow-md shadow-amber-200/50 cursor-pointer hover:scale-105 animate-bounce'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-algo-blue mb-0.5" />
                <span className="text-[7.5px] sm:text-[9px] font-bold text-slate-500 leading-none">山札</span>
                <span className="text-[11px] sm:text-xs lg:text-sm font-black text-slate-900 leading-tight">
                  {gameState.deck.length}枚
                </span>
                {gameState.phase === 'PLAYER_TURN_START' && gameState.deck.length > 0 && (
                  <span className="absolute -bottom-1 px-1.5 py-0.2 rounded-full bg-algo-yellow text-slate-950 text-[7.5px] sm:text-[9px] font-black border border-amber-300 shadow-2xs">
                    引く
                  </span>
                )}
              </div>
            </div>

            {/* 2. 引いたカード (Drawn Card Slot) */}
            <div data-testid="drawn-card-area" className="flex flex-col items-center justify-center shrink-0">
              <span className="text-[7.5px] sm:text-[9px] font-bold text-slate-400 mb-0.5 leading-none">引いたカード</span>
              {gameState.drawnCard ? (
                <div className="flex flex-col items-center gap-0.5 animate-card-draw">
                  <CardComponent
                    card={
                      isGameOver
                        ? gameState.drawnCard
                        : maskCardForPlayer(gameState.drawnCard, Boolean(activePlayer?.isHuman))
                    }
                    isOwner={Boolean(activePlayer?.isHuman)}
                    isRevealed={isGameOver}
                    size="xs"
                    testId="drawn-card"
                  />
                  {!activePlayer?.isHuman && (
                    <span
                      data-testid="cpu-drawn-card-badge"
                      className="text-[7.5px] sm:text-[9px] font-bold px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full bg-slate-800 text-white shadow-2xs whitespace-nowrap"
                    >
                      {activePlayer?.name} が引いたカード [{gameState.drawnCard.color === 'black' ? '黒' : '白'}]
                    </span>
                  )}
                </div>
              ) : (
                <div className="w-8 h-12 sm:w-9 sm:h-14 rounded-md sm:rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-[9px] sm:text-[10px] text-slate-400 font-semibold bg-slate-50/50">
                  なし
                </div>
              )}
            </div>

            {/* 3. 手番ステータス・ガイダンス ＆ 操作ボタン */}
            <div data-testid="status-message" className="flex-1 min-w-0 text-left">
              {gameState.phase === 'PLAYER_TURN_START' && (
                <div className="p-1 sm:p-1.5 bg-algo-blue-light/50 border border-algo-blue/20 rounded-lg sm:rounded-xl">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-black text-slate-900 text-[10px] sm:text-xs flex items-center gap-1 truncate">
                      <Sparkles className="w-3 h-3 text-algo-blue shrink-0" />
                      <span>あなたのターン</span>
                    </h4>
                    {gameState.timeLimit > 0 && (
                      <span className="text-[8.5px] sm:text-[10px] font-bold text-algo-blue shrink-0">残り {gameState.remainingTime}秒</span>
                    )}
                  </div>
                  <p className="text-[9px] sm:text-[10.5px] text-slate-600 font-medium leading-tight truncate sm:whitespace-normal">
                    {gameState.deck.length === 0
                      ? '山札がありません。相手の伏せカードを選んでアタックしてください。'
                      : '山札をクリックしてカードを引いてください。'}
                  </p>
                </div>
              )}

              {gameState.phase === 'PLAYER_SELECT_TARGET' && (
                <div className="p-1 sm:p-1.5 bg-algo-blue-light/50 border border-algo-blue/20 rounded-lg sm:rounded-xl">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-black text-slate-900 text-[10px] sm:text-xs truncate">アタック対象を選択</h4>
                    {gameState.timeLimit > 0 && (
                      <span className="text-[8.5px] sm:text-[10px] font-bold text-algo-blue shrink-0">残り {gameState.remainingTime}秒</span>
                    )}
                  </div>
                  <p className="text-[9px] sm:text-[10.5px] text-slate-600 font-medium leading-tight truncate sm:whitespace-normal">
                    {gameState.deck.length === 0 && !gameState.drawnCard
                      ? '山札がありません。相手の伏せカードを選んでアタックしてください。'
                      : '相手の伏せカード（?）をクリック。'}
                  </p>
                </div>
              )}

              {gameState.phase === 'PLAYER_DECIDE_NEXT' && (
                <div className="p-1 sm:p-1.5 bg-algo-yellow-light/80 border border-algo-yellow-dark/40 rounded-lg sm:rounded-xl shadow-2xs">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h4 className="font-black text-slate-900 text-[10px] sm:text-xs flex items-center gap-1 truncate">
                      <Flame className="w-3 h-3 text-amber-500 shrink-0" />
                      <span>的中！続けてアタック？</span>
                    </h4>
                  </div>
                  <div className="flex gap-1 sm:gap-2">
                    <button
                      type="button"
                      data-testid="btn-continue-attack"
                      onClick={handlePlayerContinue}
                      className="flex-1 py-1 px-1.5 sm:px-2 rounded-md sm:rounded-lg bg-gradient-to-r from-algo-blue to-algo-blue-dark text-white font-black text-[9px] sm:text-xs hover:brightness-105 shadow-2xs transition-all text-center whitespace-nowrap"
                    >
                      続けてアタック
                    </button>
                    <button
                      type="button"
                      data-testid="btn-stay"
                      onClick={handlePlayerStay}
                      className="flex-1 py-1 px-1.5 sm:px-2 rounded-md sm:rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-[9px] sm:text-xs hover:bg-slate-50 transition-all shadow-2xs text-center whitespace-nowrap"
                    >
                      ステイ
                    </button>
                  </div>
                </div>
              )}

              {gameState.phase === 'CPU_ACTING' && (
                <div className="p-1 sm:p-1.5 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl">
                  <h4 className="font-black text-slate-900 text-[10px] sm:text-xs flex items-center gap-1 truncate">
                    <Bot className="w-3 h-3 text-algo-blue shrink-0" />
                    <span>{activePlayer?.name} の手番</span>
                  </h4>
                  <p className="text-[9px] sm:text-[10.5px] text-slate-600 font-medium animate-pulse leading-tight truncate sm:whitespace-normal">
                    {cpuStatusMessage}
                  </p>
                </div>
              )}

              {gameState.phase === 'GAME_OVER' && (
                <div className="p-1 sm:p-1.5 bg-gradient-to-br from-algo-yellow/40 to-algo-blue/20 border border-amber-300 rounded-lg sm:rounded-xl flex items-center justify-between gap-1 sm:gap-2">
                  <div className="min-w-0">
                    <h4 className="font-black text-[10px] sm:text-xs text-slate-900 truncate">
                      {gameState.winner?.isHuman ? '🎉 完全勝利！' : `💀 ${gameState.winner?.name} の勝利`}
                    </h4>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsResultModalOpen(true)}
                      className="py-1 px-1.5 sm:px-2 rounded-md bg-algo-blue hover:bg-algo-blue-dark text-white font-black text-[9px] sm:text-xs shadow-2xs whitespace-nowrap"
                    >
                      戦績サマリを表示
                    </button>
                    <button
                      type="button"
                      onClick={() => initializeGame()}
                      className="py-1 px-1.5 sm:px-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-black text-[9px] sm:text-xs shadow-2xs whitespace-nowrap"
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
            <section
              data-testid={`player-hand-${humanPlayer.id}`}
              className={`bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden shrink-0 ${
                opponents.length >= 3
                  ? 'p-1.5 sm:p-2.5 lg:p-2 shadow-2xs'
                  : opponents.length === 2
                  ? 'p-1.5 sm:p-2.5 lg:p-2.5 shadow-2xs'
                  : 'p-2 sm:p-3 lg:p-3.5 shadow-xs'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2">
                {/* Left: Player Info & Status */}
                <div className="flex items-center justify-between sm:justify-start sm:w-36 lg:w-44 shrink-0 gap-1 sm:gap-1.5">
                  <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                    <div
                      className={`${
                        opponents.length > 1
                          ? 'w-4 h-4 sm:w-5 sm:h-5 text-[10px]'
                          : 'w-5 h-5 sm:w-6 sm:h-6 text-xs'
                      } rounded-lg bg-algo-blue text-white flex items-center justify-center font-bold shadow-2xs shrink-0`}
                    >
                      <User className={opponents.length > 1 ? 'w-2.5 h-2.5 sm:w-3.5 sm:h-3.5' : 'w-3 h-3 sm:w-4 sm:h-4'} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-black text-[10px] sm:text-xs text-slate-900 block leading-tight truncate">
                        {humanPlayer.name} の手札
                      </span>
                      <span className="text-[8px] sm:text-[9.5px] text-slate-400 font-semibold block leading-none">
                        ({humanPlayer.cards.filter((c) => c.isOpen).length}/{humanPlayer.cards.length} 枚OPEN)
                      </span>
                    </div>
                  </div>

                  {activePlayer?.isHuman && (
                    <span className="flex items-center gap-1 px-1 py-0.2 sm:px-2 sm:py-0.5 rounded-full bg-algo-yellow text-slate-950 text-[8px] sm:text-[10px] font-black shadow-2xs whitespace-nowrap shrink-0">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-amber-500 animate-ping" />
                      自ターン
                    </span>
                  )}
                </div>

                {/* Center: Cards */}
                <div
                  data-testid={`cards-container-${humanPlayer.id}`}
                  className="items-center py-0.5 flex flex-nowrap overflow-x-auto no-scrollbar justify-center gap-1 sm:gap-2 min-w-0 flex-1"
                >
                  {humanPlayer.cards.map((card, idx) => (
                    <CardComponent
                      key={card.id}
                      card={maskCardForPlayer(card, true)}
                      isOwner={true}
                      isRevealed={isGameOver}
                      size={activeCardSize}
                      label={`#${idx + 1}`}
                      testId={`player-card-${idx}`}
                    />
                  ))}
                </div>

                {/* Right: Dummy spacer for perfect centering on desktop */}
                <div className="hidden sm:block shrink-0 sm:w-36 lg:w-44" aria-hidden="true" />
              </div>
            </section>
          )}
        </div>

        {/* Right 1 col: Log & Visuals (Desktop) */}
        <div className="hidden lg:block lg:col-span-1 space-y-4">
          <DeckTracker
            players={gameState.players}
            drawnCard={gameState.drawnCard}
            highlightedNumbers={trackerHighlightNumbers}
            highlightColor={trackerHighlightColor}
            isCollapsible={true}
            defaultCollapsed={false}
          />
          <GameLog logs={gameState.logs} players={gameState.players} />
        </div>
      </div>

      {/* Mobile Deck Tracker Drawer / Bottom Sheet (Issue #65, Issue #116) */}
      {isMobileTrackerOpen && (
        <div
          data-testid="mobile-tracker-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="モバイル残弾トラッカー"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs lg:hidden animate-fade-in"
          onClick={() => setIsMobileTrackerOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl p-4 shadow-2xl animate-slide-up max-h-[85vh] flex flex-col overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <Target className="w-4 h-4 text-algo-blue shrink-0" />
                <h3 className="text-sm font-black text-slate-800 whitespace-nowrap">残弾トラッカー</h3>
                <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                  残り {trackerState.summary.totalRemaining}/24枚
                </span>
                {trackerHighlightNumbers.length > 0 && (
                  <span
                    className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold shrink-0 animate-fade-in"
                    title="推理候補ハイライト中"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>候補連動</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                data-testid="btn-close-deck-tracker-mobile"
                onClick={() => setIsMobileTrackerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                aria-label="トラッカーを閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <DeckTracker
                players={gameState.players}
                drawnCard={gameState.drawnCard}
                highlightedNumbers={trackerHighlightNumbers}
                highlightColor={trackerHighlightColor}
                isCollapsible={false}
                hideHeader={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Log Drawer / Bottom Sheet */}
      {isMobileLogOpen && (
        <div
          data-testid="mobile-log-drawer"
          role="dialog"
          aria-label="モバイル対戦ログ"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs lg:hidden animate-fade-in"
          onClick={() => setIsMobileLogOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl p-4 max-h-[80vh] flex flex-col shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-algo-blue" />
                <h3 className="text-sm font-black text-slate-800">対戦ログ ({gameState.logs.length}件)</h3>
              </div>
              <button
                type="button"
                data-testid="close-mobile-log"
                onClick={() => setIsMobileLogOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="ログを閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <GameLog logs={gameState.logs} players={gameState.players} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu Drawer / Bottom Sheet (Issue #118) */}
      {isMobileMenuOpen && (
        <div
          data-testid="modal-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="モバイルメニュー"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs lg:hidden animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl p-4 sm:p-5 shadow-2xl animate-slide-up max-h-[85vh] flex flex-col overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Title and Close Button */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Menu className="w-5 h-5 text-algo-navy" />
                <h3 className="text-base font-black text-slate-800 tracking-tight">メニュー</h3>
              </div>
              <button
                type="button"
                data-testid="btn-close-mobile-menu"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                aria-label="メニューを閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Menu Items List */}
            <div className="space-y-2 py-1 overflow-y-auto">
              {/* 🔊 サウンド（ミュート/解除トグル、現在の状態表示） */}
              <button
                type="button"
                data-testid="mobile-menu-sound-toggle"
                onClick={() => {
                  handleToggleSound();
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border text-sm font-bold transition-all text-left ${
                  isSoundEnabled
                    ? 'border-algo-blue/30 bg-algo-blue-light/30 text-algo-navy hover:bg-algo-blue-light/50'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isSoundEnabled ? (
                    <Volume2 className="w-5 h-5 text-algo-blue shrink-0" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                  <div>
                    <span className="block font-black text-slate-800">効果音サウンド</span>
                    <span className="text-xs font-medium text-slate-500">
                      {isSoundEnabled ? '現在: ON (効果音あり)' : '現在: OFF (ミュート中)'}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-black shrink-0 ${
                    isSoundEnabled
                      ? 'bg-algo-blue text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isSoundEnabled ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* 🏆 戦績＆アチーブメント */}
              <button
                type="button"
                data-testid="mobile-menu-stats"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsStatsModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-sm font-bold transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <Trophy className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <span className="block font-black text-amber-950">戦績＆アチーブメント</span>
                    <span className="text-xs font-medium text-amber-700">通算戦績・勝率・獲得実績</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-600 shrink-0">表示 →</span>
              </button>

              {/* 📖 ルールガイド */}
              <button
                type="button"
                data-testid="mobile-menu-rules"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsRuleModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-bold transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-algo-blue shrink-0" />
                  <div>
                    <span className="block font-black text-slate-800">ルールガイド</span>
                    <span className="text-xs font-medium text-slate-500">基本ルール・カード並び順の確認</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-400 shrink-0">表示 →</span>
              </button>

              {/* 🎓 チュートリアル */}
              <button
                type="button"
                data-testid="mobile-menu-tutorial"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsTutorialOpen(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-algo-blue/30 bg-algo-blue-light/20 hover:bg-algo-blue-light/40 text-algo-navy text-sm font-bold transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-5 h-5 text-algo-blue shrink-0" />
                  <div>
                    <span className="block font-black text-slate-800">チュートリアル</span>
                    <span className="text-xs font-medium text-slate-500">遊び方のステップバイステップ解説</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-algo-blue shrink-0">開く →</span>
              </button>

              {/* ゲーム終了時の結果再表示 */}
              {isGameOver && !isResultModalOpen && (
                <button
                  type="button"
                  data-testid="mobile-menu-reopen-result"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsResultModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-black transition-all text-left shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-slate-950 shrink-0" />
                    <div>
                      <span className="block font-black">対戦結果を見る</span>
                      <span className="text-xs font-bold text-amber-950">勝敗とスコアを再確認</span>
                    </div>
                  </div>
                  <span className="text-xs font-black shrink-0">表示 →</span>
                </button>
              )}

              <div className="pt-2 border-t border-slate-100 flex gap-2">
                {/* 🔄 最初からやり直す */}
                <button
                  type="button"
                  data-testid="mobile-menu-restart"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleRequestRestart();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  <span>やり直す</span>
                </button>

                {/* ⚙ タイトル画面へ戻る */}
                <button
                  type="button"
                  data-testid="mobile-menu-settings"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleRequestSetup();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all"
                >
                  <Settings2 className="w-4 h-4 text-algo-yellow" />
                  <span>タイトルへ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {gameState.selectedTarget && gameState.phase === 'PLAYER_GUESS_NUMBER' && !attackResult && (
        <AttackModal
          targetPlayerName={selectedTargetPlayer?.name || ''}
          targetIndex={gameState.selectedTarget.cardIndex}
          targetColor={selectedTargetColor}
          onConfirmGuess={handleConfirmGuess}
          onCancel={() =>
            setGameState((prev) => ({
              ...prev,
              selectedTarget: null,
              phase: 'PLAYER_SELECT_TARGET',
            }))
          }
          disabledNumbers={targetKnownNumbers}
          failedNumbers={
            selectedTargetPlayer
              ? getFailedNumbersForCard(
                  gameState.logs,
                  selectedTargetPlayer.id,
                  gameState.selectedTarget.cardIndex
                )
              : []
          }
          possibleNumbers={
            selectedTargetPlayer
              ? getPossibleNumbersForCard({
                  targetIndex: gameState.selectedTarget.cardIndex,
                  targetHand: selectedTargetPlayer.cards,
                  allPlayers: gameState.players,
                  drawnCard: gameState.drawnCard,
                  logs: gameState.logs,
                  targetPlayerId: selectedTargetPlayer.id,
                })
              : undefined
          }
          assistEnabled={isAssistEnabled}
          remainingDeckNumbers={
            selectedTargetColor
              ? getRemainingDeckNumbers(gameState.players, selectedTargetColor, gameState.drawnCard)
              : undefined
          }
        />
      )}

      <RuleGuideModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        isTimedMatch={isTimedMatch}
      />
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onComplete={() => setIsTutorialOpen(false)}
        isTimedMatch={isTimedMatch}
      />

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

      {/* 推理結果確認モーダル (CPU & プレイヤー) */}
      <AttackResultModal
        isOpen={attackResult !== null && !isSkippingToResult}
        data={attackResult}
        onConfirm={handleAttackOk}
        isSpectating={isSpectating}
        isAutoAdvance={isAutoSpectate}
        onToggleAutoAdvance={() => setIsAutoSpectate((prev) => !prev)}
        onSkipToResult={handleSkipToResult}
        autoAdvanceDelayMs={1500}
      />

      {/* SCR-006: 決着リザルト＆祝祭演出モーダル */}
      <ResultModal
        isOpen={gameState.phase === 'GAME_OVER' && isResultModalOpen && !attackResult}
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

      {/* AIヒントアドバイザーモーダル (Issue #44) */}
      <HintModal
        isOpen={isHintModalOpen}
        onClose={() => setIsHintModalOpen(false)}
        hint={activeHint}
        remainingHints={hintCount}
        canSelectTarget={activePlayer?.isHuman && gameState.phase === 'PLAYER_SELECT_TARGET'}
        onSelectTarget={(targetPlayerId, cardIndex) => {
          handleSelectTargetCard(targetPlayerId, cardIndex);
        }}
        isTimedMatch={isTimedMatch}
      />

      {/* リーサル（決着ヒット）ダイナミックK.O.演出 (Issue #73) */}
      <LethalCutIn
        isActive={isLethalCutInActive}
        winnerName={lethalWinnerName}
        onComplete={handleLethalCutInComplete}
      />

      {/* 通算戦績＆アチーブメントモーダル (Issue #72) */}
      <StatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        stats={playerStats}
        achievements={playerAchievements}
        onResetStats={handleResetStats}
      />
    </div>
  );
};
