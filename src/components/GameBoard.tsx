'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, GameState, Difficulty, AttackLog, PlayerType } from '../types/game';
import {
  createDeck,
  dealInitialCards,
  insertCardInOrder,
  isAllOpen,
  checkAttack,
} from '../lib/algoEngine';
import { decideCpuAttack, decideCpuContinue } from '../lib/cpuAI';
import { CardComponent } from './CardComponent';
import { AttackModal } from './AttackModal';
import { GameLog } from './GameLog';
import { RuleGuideModal } from './RuleGuideModal';
import {
  Play,
  RotateCcw,
  BookOpen,
  Bot,
  User,
  Layers,
  Sparkles,
  Trophy,
  Frown,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export const GameBoard: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    deck: [],
    playerCards: [],
    cpuCards: [],
    playerDrawnCard: null,
    cpuDrawnCard: null,
    currentTurn: 'player',
    phase: 'INITIAL',
    selectedTargetIndex: null,
    difficulty: 'normal',
    logs: [],
    winner: null,
  });

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [cpuStatusText, setCpuStatusText] = useState<string>('');

  // 新規ゲーム開始
  const startNewGame = useCallback((diff: Difficulty = gameState.difficulty) => {
    const rawDeck = createDeck();
    const { playerCards, cpuCards, remainingDeck } = dealInitialCards(rawDeck);

    // プレイヤー先攻でスタート
    setGameState({
      deck: remainingDeck,
      playerCards,
      cpuCards,
      playerDrawnCard: null,
      cpuDrawnCard: null,
      currentTurn: 'player',
      phase: 'PLAYER_TURN_START',
      selectedTargetIndex: null,
      difficulty: diff,
      logs: [],
      winner: null,
    });
    setCpuStatusText('');
  }, [gameState.difficulty]);

  // 初回起動時にゲーム準備
  useEffect(() => {
    startNewGame('normal');
  }, []);

  // プレイヤーが山札からドロー
  const handlePlayerDraw = () => {
    if (gameState.phase !== 'PLAYER_TURN_START' || gameState.currentTurn !== 'player') return;

    if (gameState.deck.length === 0) {
      // 山札切れの場合はドローなしで直接アタック対象選択へ
      setGameState((prev) => ({
        ...prev,
        playerDrawnCard: null,
        phase: 'PLAYER_SELECT_TARGET',
      }));
      return;
    }

    const drawn = gameState.deck[0];
    const nextDeck = gameState.deck.slice(1);

    setGameState((prev) => ({
      ...prev,
      deck: nextDeck,
      playerDrawnCard: drawn,
      phase: 'PLAYER_SELECT_TARGET',
    }));
  };

  // プレイヤーが相手のカードをクリック
  const handleSelectCpuCard = (index: number) => {
    if (
      gameState.phase !== 'PLAYER_SELECT_TARGET' ||
      gameState.currentTurn !== 'player' ||
      gameState.cpuCards[index].isOpen
    ) {
      return;
    }

    setGameState((prev) => ({
      ...prev,
      selectedTargetIndex: index,
      phase: 'PLAYER_GUESS_NUMBER',
    }));
  };

  // プレイヤーが数字を予想してアタック確定
  const handleConfirmGuess = (guessedNumber: number) => {
    if (
      gameState.phase !== 'PLAYER_GUESS_NUMBER' ||
      gameState.selectedTargetIndex === null
    ) {
      return;
    }

    const targetIdx = gameState.selectedTargetIndex;
    const targetCard = gameState.cpuCards[targetIdx];
    const isHit = checkAttack(targetCard, guessedNumber);

    const log: AttackLog = {
      id: `log-${Date.now()}`,
      attacker: 'player',
      targetIndex: targetIdx,
      targetColor: targetCard.color,
      guessedNumber,
      isHit,
      actualNumber: targetCard.number,
      drawnCard: gameState.playerDrawnCard || undefined,
      timestamp: Date.now(),
      message: isHit
        ? `相手の左から${targetIdx + 1}番目 [${targetCard.color === 'black' ? '黒' : '白'}] を [${guessedNumber}] と推理して【的中】！`
        : `相手の左から${targetIdx + 1}番目 [${targetCard.color === 'black' ? '黒' : '白'}] を [${guessedNumber}] と推理して【ハズレ】…`,
    };

    if (isHit) {
      // 的中：相手の該当カードをオープン
      const updatedCpuCards = gameState.cpuCards.map((c, i) =>
        i === targetIdx ? { ...c, isOpen: true } : c
      );

      // 勝利判定
      if (isAllOpen(updatedCpuCards)) {
        setGameState((prev) => ({
          ...prev,
          cpuCards: updatedCpuCards,
          logs: [log, ...prev.logs],
          winner: 'player',
          phase: 'GAME_OVER',
        }));
        return;
      }

      // まだ勝負がついていない場合：コンティニュー or ステイの選択へ
      setGameState((prev) => ({
        ...prev,
        cpuCards: updatedCpuCards,
        logs: [log, ...prev.logs],
        selectedTargetIndex: null,
        phase: 'PLAYER_DECIDE_NEXT',
      }));
    } else {
      // ハズレ：引いたカードがあればオープンにして自分の手札に加える
      let updatedPlayerCards = [...gameState.playerCards];
      if (gameState.playerDrawnCard) {
        const openedDrawn: Card = { ...gameState.playerDrawnCard, isOpen: true };
        updatedPlayerCards = insertCardInOrder(updatedPlayerCards, openedDrawn);
      }

      setGameState((prev) => ({
        ...prev,
        playerCards: updatedPlayerCards,
        playerDrawnCard: null,
        selectedTargetIndex: null,
        logs: [log, ...prev.logs],
        currentTurn: 'cpu',
        phase: 'CPU_THINKING',
      }));
    }
  };

  // プレイヤーが「続けてアタック」を選択
  const handlePlayerContinueAttack = () => {
    setGameState((prev) => ({
      ...prev,
      phase: 'PLAYER_SELECT_TARGET',
      selectedTargetIndex: null,
    }));
  };

  // プレイヤーが「ステイ（手番終了）」を選択
  const handlePlayerStay = () => {
    let updatedPlayerCards = [...gameState.playerCards];
    if (gameState.playerDrawnCard) {
      // ステイ時は引いたカードを「裏向き」のまま手札に配置
      const closedDrawn: Card = { ...gameState.playerDrawnCard, isOpen: false };
      updatedPlayerCards = insertCardInOrder(updatedPlayerCards, closedDrawn);
    }

    setGameState((prev) => ({
      ...prev,
      playerCards: updatedPlayerCards,
      playerDrawnCard: null,
      currentTurn: 'cpu',
      phase: 'CPU_THINKING',
    }));
  };

  // CPU手番の自律処理
  useEffect(() => {
    if (gameState.phase !== 'CPU_THINKING' || gameState.winner !== null) return;

    let isMounted = true;
    setCpuStatusText('CPUがドロー中...');

    const timer = setTimeout(() => {
      if (!isMounted) return;

      // 1. CPUがドロー
      let currentDeck = [...gameState.deck];
      let cpuDrawn: Card | null = null;
      if (currentDeck.length > 0) {
        cpuDrawn = currentDeck[0];
        currentDeck = currentDeck.slice(1);
      }

      setCpuStatusText('CPUが推理を思考中...');

      const thinkTimer = setTimeout(() => {
        if (!isMounted) return;

        // 2. CPUの推理決定
        const decision = decideCpuAttack(
          gameState.playerCards,
          gameState.cpuCards,
          cpuDrawn,
          gameState.difficulty,
          gameState.logs
        );

        const targetCard = gameState.playerCards[decision.targetIndex];
        const isHit = checkAttack(targetCard, decision.guessedNumber);

        const log: AttackLog = {
          id: `log-${Date.now()}`,
          attacker: 'cpu',
          targetIndex: decision.targetIndex,
          targetColor: targetCard.color,
          guessedNumber: decision.guessedNumber,
          isHit,
          actualNumber: targetCard.number,
          drawnCard: cpuDrawn || undefined,
          timestamp: Date.now(),
          message: isHit
            ? `CPUがあなたの左から${decision.targetIndex + 1}番目 [${targetCard.color === 'black' ? '黒' : '白'}] を [${decision.guessedNumber}] と推理して【的中】！`
            : `CPUがあなたの左から${decision.targetIndex + 1}番目 [${targetCard.color === 'black' ? '黒' : '白'}] を [${decision.guessedNumber}] と推理して【ハズレ】。`,
        };

        if (isHit) {
          // 的中
          const updatedPlayerCards = gameState.playerCards.map((c, i) =>
            i === decision.targetIndex ? { ...c, isOpen: true } : c
          );

          if (isAllOpen(updatedPlayerCards)) {
            // CPU勝利
            setGameState((prev) => ({
              ...prev,
              deck: currentDeck,
              playerCards: updatedPlayerCards,
              logs: [log, ...prev.logs],
              winner: 'cpu',
              phase: 'GAME_OVER',
            }));
            setCpuStatusText('CPUの勝利！');
            return;
          }

          // 継続するかステイするか
          const shouldContinue = decideCpuContinue(
            updatedPlayerCards,
            gameState.cpuCards,
            cpuDrawn,
            gameState.difficulty
          );

          if (shouldContinue) {
            // CPUがさらにアタック（今回は簡潔に1手番1的中後ステイ、または次回さらに発展可能）
            // ステイして伏せカードに追加
            let updatedCpuCards = [...gameState.cpuCards];
            if (cpuDrawn) {
              updatedCpuCards = insertCardInOrder(updatedCpuCards, {
                ...cpuDrawn,
                isOpen: false,
              });
            }
            setGameState((prev) => ({
              ...prev,
              deck: currentDeck,
              playerCards: updatedPlayerCards,
              cpuCards: updatedCpuCards,
              logs: [log, ...prev.logs],
              currentTurn: 'player',
              phase: 'PLAYER_TURN_START',
            }));
            setCpuStatusText('CPUは的中後にステイしました。あなたのターンです。');
          } else {
            // ステイ
            let updatedCpuCards = [...gameState.cpuCards];
            if (cpuDrawn) {
              updatedCpuCards = insertCardInOrder(updatedCpuCards, {
                ...cpuDrawn,
                isOpen: false,
              });
            }
            setGameState((prev) => ({
              ...prev,
              deck: currentDeck,
              playerCards: updatedPlayerCards,
              cpuCards: updatedCpuCards,
              logs: [log, ...prev.logs],
              currentTurn: 'player',
              phase: 'PLAYER_TURN_START',
            }));
            setCpuStatusText('CPUは的中後にステイしました。あなたのターンです。');
          }
        } else {
          // ハズレ：CPUの引いたカードが表向きでCPU手札に追加
          let updatedCpuCards = [...gameState.cpuCards];
          if (cpuDrawn) {
            updatedCpuCards = insertCardInOrder(updatedCpuCards, {
              ...cpuDrawn,
              isOpen: true,
            });
          }

          setGameState((prev) => ({
            ...prev,
            deck: currentDeck,
            cpuCards: updatedCpuCards,
            logs: [log, ...prev.logs],
            currentTurn: 'player',
            phase: 'PLAYER_TURN_START',
          }));
          setCpuStatusText('CPUの推理はハズレました。あなたのターンです。');
        }
      }, 1500);

      return () => clearTimeout(thinkTimer);
    }, 1000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [gameState.phase, gameState.winner]);

  // プレイヤーが既に確認できている数字（ヒント用：自分の手札＋場に出ているオープンカード）
  const knownNumbers: number[] = [];
  gameState.playerCards.forEach((c) => knownNumbers.push(c.number));
  gameState.cpuCards.forEach((c) => {
    if (c.isOpen) knownNumbers.push(c.number);
  });
  if (gameState.playerDrawnCard) {
    knownNumbers.push(gameState.playerDrawnCard.number);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-zinc-950 text-xl shadow-lg shadow-amber-500/20">
            A
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              algo <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Web対戦</span>
            </h1>
            <p className="text-xs text-zinc-400">数字当て論理推理ボードゲーム</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Difficulty Selector */}
          <div className="flex items-center bg-zinc-800 rounded-xl p-1 border border-zinc-700 text-xs">
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((diff) => (
              <button
                key={diff}
                onClick={() => startNewGame(diff)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  gameState.difficulty === diff
                    ? 'bg-amber-500 text-zinc-950 shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {diff === 'easy' ? '初級' : diff === 'normal' ? '中級' : '上級'}
              </button>
            ))}
          </div>

          {/* Rule Modal Button */}
          <button
            onClick={() => setIsRuleModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-700 text-xs font-semibold transition-all"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>ルール</span>
          </button>

          {/* Restart Button */}
          <button
            onClick={() => startNewGame(gameState.difficulty)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-700 text-xs font-semibold transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>リセット</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Game Field & Log */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 cols: Board Field */}
        <div className="lg:col-span-3 space-y-6">
          {/* CPU Area */}
          <section className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Bot className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-zinc-200">CPUの手札 (相手)</h3>
                <span className="text-xs text-zinc-500">
                  ({gameState.cpuCards.filter((c) => c.isOpen).length}/{gameState.cpuCards.length} 枚オープン)
                </span>
              </div>
              {gameState.currentTurn === 'cpu' && (
                <span className="flex items-center gap-1.5 text-xs text-purple-400 font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                  CPUのターン
                </span>
              )}
            </div>

            {/* CPU Cards Row */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 py-2 min-h-32">
              {gameState.cpuCards.map((card, idx) => (
                <CardComponent
                  key={card.id}
                  card={card}
                  isOwner={false}
                  isSelected={gameState.selectedTargetIndex === idx}
                  isSelectable={
                    gameState.currentTurn === 'player' &&
                    gameState.phase === 'PLAYER_SELECT_TARGET' &&
                    !card.isOpen
                  }
                  onClick={() => handleSelectCpuCard(idx)}
                  label={`#${idx + 1}`}
                />
              ))}
            </div>

            {gameState.phase === 'PLAYER_SELECT_TARGET' && (
              <div className="mt-3 text-center">
                <p className="text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl py-2 px-4 inline-block animate-pulse">
                  👆 推理したい相手の伏せカード（?）をクリックしてください！
                </p>
              </div>
            )}
          </section>

          {/* Center Table: Deck, Drawn Card, Status */}
          <section className="bg-gradient-to-b from-zinc-900/90 to-zinc-900/40 border border-zinc-800 rounded-2xl p-6 shadow-inner flex flex-col md:flex-row items-center justify-around gap-6">
            {/* Deck Pile */}
            <div className="flex flex-col items-center gap-2">
              <div
                onClick={
                  gameState.phase === 'PLAYER_TURN_START' && gameState.currentTurn === 'player'
                    ? handlePlayerDraw
                    : undefined
                }
                className={`relative w-20 h-28 sm:w-24 sm:h-32 rounded-xl border-2 flex flex-col items-center justify-center select-none shadow-xl transition-all ${
                  gameState.phase === 'PLAYER_TURN_START' && gameState.currentTurn === 'player'
                    ? 'border-amber-400 bg-gradient-to-br from-amber-500/20 to-zinc-800 cursor-pointer hover:scale-105 hover:shadow-amber-500/20 animate-bounce'
                    : 'border-zinc-700 bg-zinc-800/80 text-zinc-500'
                }`}
              >
                <Layers className="w-8 h-8 mb-1 text-amber-400/80" />
                <span className="text-xs font-bold">山札</span>
                <span className="text-lg font-black text-white">{gameState.deck.length} 枚</span>
                {gameState.phase === 'PLAYER_TURN_START' && gameState.currentTurn === 'player' && (
                  <span className="absolute -bottom-2.5 px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-black uppercase tracking-wider">
                    引く
                  </span>
                )}
              </div>
            </div>

            {/* Drawn Card display */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-zinc-400 font-semibold">引いたカード</span>
              {gameState.playerDrawnCard ? (
                <div className="scale-105 transition-transform animate-in zoom-in-75">
                  <CardComponent
                    card={gameState.playerDrawnCard}
                    isOwner={true}
                    size="md"
                  />
                </div>
              ) : (
                <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg border-2 border-dashed border-zinc-800 flex items-center justify-center text-xs text-zinc-600">
                  なし
                </div>
              )}
            </div>

            {/* Action & Status Guidance */}
            <div className="flex-1 max-w-sm text-center md:text-left space-y-2">
              {gameState.phase === 'PLAYER_TURN_START' && (
                <div>
                  <h4 className="font-bold text-amber-400 text-sm">あなたのターン</h4>
                  <p className="text-xs text-zinc-300 mt-1">
                    まずは中央の山札をクリックしてカードを引いてください。
                  </p>
                </div>
              )}

              {gameState.phase === 'PLAYER_SELECT_TARGET' && (
                <div>
                  <h4 className="font-bold text-amber-400 text-sm">アタック対象を選択</h4>
                  <p className="text-xs text-zinc-300 mt-1">
                    上のCPU手札から、推理したい伏せカードをクリックしてください。
                  </p>
                </div>
              )}

              {gameState.phase === 'PLAYER_DECIDE_NEXT' && (
                <div className="space-y-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <h4 className="font-bold text-amber-400 text-sm">✨ アタック的中！</h4>
                  <p className="text-xs text-zinc-300">
                    続けて他のカードを推理しますか？それともステイして手番を終えますか？
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePlayerContinueAttack}
                      className="flex-1 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-bold text-xs hover:brightness-110 transition-all"
                    >
                      続けてアタック
                    </button>
                    <button
                      onClick={handlePlayerStay}
                      className="flex-1 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-xs hover:bg-zinc-700 transition-all"
                    >
                      ステイ (終了)
                    </button>
                  </div>
                </div>
              )}

              {gameState.phase === 'CPU_THINKING' && (
                <div className="space-y-2">
                  <h4 className="font-bold text-purple-400 text-sm flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    CPUの手番
                  </h4>
                  <p className="text-xs text-zinc-300">{cpuStatusText}</p>
                </div>
              )}

              {gameState.phase === 'GAME_OVER' && (
                <div className="space-y-2">
                  <h4 className="font-black text-lg text-white">
                    {gameState.winner === 'player' ? '🎉 あなたの勝利！' : '💀 CPUの勝利'}
                  </h4>
                  <button
                    onClick={() => startNewGame(gameState.difficulty)}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-bold text-xs shadow-md"
                  >
                    もう一度対戦する
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Player Area */}
          <section className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-zinc-200">あなたの手札</h3>
                <span className="text-xs text-zinc-500">
                  ({gameState.playerCards.filter((c) => c.isOpen).length}/{gameState.playerCards.length} 枚オープン)
                </span>
              </div>
              {gameState.currentTurn === 'player' && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400 font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  あなたのターン
                </span>
              )}
            </div>

            {/* Player Cards Row */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 py-2 min-h-32">
              {gameState.playerCards.map((card, idx) => (
                <CardComponent
                  key={card.id}
                  card={card}
                  isOwner={true}
                  label={`#${idx + 1}`}
                />
              ))}
            </div>

            <div className="mt-3 text-center">
              <p className="text-[11px] text-zinc-500">
                ※ 手札は左から小さい順（同数は黒が左）に並んでいます。「(伏せ)」は相手には見えていません。
              </p>
            </div>
          </section>
        </div>

        {/* Right 1 col: Log & Help */}
        <div className="lg:col-span-1 space-y-6">
          <GameLog logs={gameState.logs} />
        </div>
      </div>

      {/* Modals */}
      {gameState.selectedTargetIndex !== null &&
        gameState.phase === 'PLAYER_GUESS_NUMBER' && (
          <AttackModal
            targetIndex={gameState.selectedTargetIndex}
            targetColor={gameState.cpuCards[gameState.selectedTargetIndex].color}
            onConfirmGuess={handleConfirmGuess}
            onCancel={() =>
              setGameState((prev) => ({
                ...prev,
                selectedTargetIndex: null,
                phase: 'PLAYER_SELECT_TARGET',
              }))
            }
            disabledNumbers={knownNumbers}
          />
        )}

      <RuleGuideModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
      />
    </div>
  );
};
