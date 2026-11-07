'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';

export type Language = 'ja' | 'en';

export const LANGUAGE_STORAGE_KEY = 'algo_language';

/**
 * 初期言語の自動判定 (Issue #162)
 * 1. localStorage 'algo_language' が 'ja' | 'en' なら最優先
 * 2. なければブラウザ言語 (navigator.languages / navigator.language) をチェック
 *    - 'ja', 'ja-JP' 等で始まる、またはタイムゾーンが 'Asia/Tokyo' の場合は 'ja'
 *    - それ以外（海外からのアクセス）の場合はデフォルト 'en'
 * 3. SSR/ビルド時フォールバック対応 (typeof window === 'undefined' 時は 'ja')
 */
export function detectInitialLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'ja';
  }

  try {
    const stored = window.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'ja' || stored === 'en') {
      return stored;
    }
  } catch {
    // localStorage アクセス不可（プライベートブラウズ等）はスルー
  }

  try {
    // ブラウザ言語判定
    const navLanguages = window.navigator?.languages || [];
    const primaryNavLang = window.navigator?.language || '';
    const allLanguages = [...navLanguages, primaryNavLang].map((l) =>
      (l || '').toLowerCase()
    );

    const isJapaneseLang = allLanguages.some((l) => l.startsWith('ja'));
    if (isJapaneseLang) {
      return 'ja';
    }

    // タイムゾーン判定（日本標準時 Asia/Tokyo なら日本語）
    const timeZone = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone;
    if (timeZone === 'Asia/Tokyo') {
      return 'ja';
    }

    // 日本以外からのアクセスは英語をデフォルト
    return 'en';
  } catch {
    return 'ja';
  }
}

/**
 * 永続化ストレージへの言語保存
 */
export function setStoredLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(LANGUAGE_STORAGE_KEY, lang);
    if (document?.documentElement) {
      document.documentElement.lang = lang;
    }
  } catch {
    // エラーハンドリング
  }
}

/**
 * 永続化ストレージからの言語取得
 */
export function getStoredLanguage(): Language | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'ja' || stored === 'en') {
      return stored;
    }
  } catch {
    // エラーハンドリング
  }
  return null;
}

/**
 * 型安全な翻訳辞書定義
 */
export const translations = {
  ja: {
    common: {
      appName: 'algo',
      webMatch: 'Web対戦',
      guestId: 'ゲストID',
      you: 'あなた',
      player: 'プレイヤー',
      cpu: 'AI対戦相手',
      close: '閉じる',
      cancel: 'キャンセル',
      confirm: '確定',
      back: '戻る',
      next: '次へ',
      finish: '終了',
      on: 'ON',
      off: 'OFF',
      black: '黒',
      white: '白',
      deck: '山札',
      remaining: '残り',
      cards: '枚',
      turn: '手番',
      vs: 'vs',
      loading: '読み込み中...',
      none: 'なし',
      notice: '通知',
    },
    header: {
      hint: (remaining: number) => `💡 ヒント（残り${remaining}回）`,
      assist: (on: boolean) => `アシスト ${on ? 'ON' : 'OFF'}`,
      assistAria: (on: boolean) => `初心者アシスト表示: ${on ? 'ON' : 'OFF'}`,
      assistTitle: (on: boolean) => (on ? '初心者アシストON（クリックでOFF）' : '初心者アシストOFF（クリックでON）'),
      sound: (on: boolean) => `サウンド ${on ? 'ON' : 'OFF'}`,
      soundAria: (on: boolean) => `サウンド効果音: ${on ? 'ON' : 'OFF'}`,
      soundTitle: (on: boolean) => (on ? 'サウンドON（クリックでミュート）' : 'サウンドOFF（クリックでON）'),
      tutorial: 'チュートリアル',
      rules: 'ルール',
      stats: '戦績',
      statsTitle: '通算戦績・アチーブメントを表示',
      rematch: '再戦',
      settings: '設定',
      viewResult: '結果を見る',
      menu: 'メニュー',
      menuOpen: 'メニューを開く',
      menuClose: 'メニューを閉じる',
      language: '言語切替',
      languageTitle: '言語を英語/日本語に切り替えます',
    },
    setup: {
      title: 'algo',
      subtitle: '白と黒の数字を推理する、東大数学科・ピーターフランクル氏考案の頭脳派ゲーム',
      playerCountLabel: '対戦人数を選択 (2〜4人)',
      playerCount2Sub: '初期手札 各4枚 (タイマン)',
      playerCount3Sub: '初期手札 各3枚 (三つ巴)',
      playerCount4Sub: '初期手札 各3枚 (4人乱戦)',
      p2Label: '2人対戦',
      p2Sub: 'あなた vs CPU 1体',
      p3Label: '3人対戦',
      p3Sub: 'あなた vs CPU 2体',
      p4Label: '4人対戦',
      p4Sub: 'あなた vs CPU 3体',
      rosterTitle: '対戦相手構成',
      remainingDeck: '🎴 残り山札:',
      handCount: (count: number) => `手札${count}枚`,
      playerHandDesc: (name: string, handCount: number) => `${name}（手札${handCount}枚）`,
      humanRole: 'プレイヤー',
      cpuRole: 'AI対戦相手',
      timeLimitLabel: '持ち時間（ターン制限）を選択',
      timeLimitUnlimited: '無制限（じっくり思考）',
      timeLimitSeconds: (sec: number) => `${sec}秒 / 手番`,
      sec15Label: '15秒 (早打ち)',
      sec15Sub: '瞬発力勝負・スリリング',
      sec30Label: '30秒 (標準)',
      sec30Sub: 'バランス重視・推奨',
      sec0Label: '無制限',
      sec0Sub: '時間制限なし・初心者向け',
      difficultyLabel: 'CPU難易度を選択',
      diffEasyDesc: '初級：気楽に推理',
      diffNormalDesc: '中級：論理的消去法',
      diffHardDesc: '上級：完全消去法',
      diffEasy: '初級 (Easy)',
      diffNormal: '中級 (Normal)',
      diffHard: '上級 (Hard)',
      startMatch: '対戦開始',
      rulesBtn: '📖 ルール確認',
      tutorialBtn: '🎓 遊び方ガイド',
      statsBtn: '🏆 戦績・実績',
      footerGuide: 'アルゴ解説・攻略',
      footerPrivacy: 'プライバシーポリシー',
      footerTerms: '利用規約',
      footerContact: 'お問い合わせ',
    },
    board: {
      drawFromDeck: '山札からカードを引く',
      drawCardPrompt: '山札からカードを1枚引いてください',
      attackPrompt: '相手の伏せカードを選んで推理アタック！',
      continueOrStayPrompt: 'アタック的中！続けてアタックするか、手札に加えてステイします',
      continueAttack: '続けてアタック',
      stay: 'ステイ（手札に加える）',
      stayNoDeck: 'ステイ（ターン終了）',
      spectatingTitle: '観戦モード中',
      spectatingDesc: 'あなたの手札は全開示されました。他のプレイヤーの戦局を見守りましょう',
      autoAdvance: '自動進行',
      autoAdvanceOn: '自動進行: ON',
      autoAdvanceOff: '自動進行: OFF',
      skipToResult: '結果までスキップ',
      deckRemaining: '山札残り',
      cardsUnit: '枚',
      emptyDeck: '山札なし',
      yourHand: 'あなたの手札',
      drawnCard: '引いたカード',
      cardOrderHint: '※左から小さい順（同数は黒が先）',
      timeUpMessage: 'TIME UP! 制限時間を超過したため、引いたカードが強制オープンされました',
      timeUpAutoDrawMessage: 'タイムアップ！カードが自動ドローされ、オープンされました',
      timeUpNoDeckMessage: 'TIME UP! 制限時間を超過し山札がないため、手札の伏せカードが強制オープンされました',
      eliminationMessage: '手札がすべてオープンされ、脱落しました！観戦モードに移行します',
      currentTurn: (name: string) => `${name} のターン`,
      yourTurn: 'あなたのターン',
      winnerBanner: (name: string) => `🏆 勝者: ${name}！`,
      timerTitle: (isPaused: boolean, sec: number) => (isPaused ? 'タイマー停止中' : `残り持ち時間: ${sec}秒`),
      timerSeconds: (sec: number) => `${sec}秒`,
      timerUnlimited: '無制限',
      toggleLogAria: (isOpen: boolean) => (isOpen ? '対戦ログを閉じる' : '対戦ログを開く'),
      toggleLogTitle: (isOpen: boolean) => (isOpen ? '対戦ログを閉じる' : '対戦ログを表示'),
      closeBannerAria: '通知を閉じる',
    },
    attackModal: {
      title: 'アタック（数字の推理）',
      target: 'ターゲット',
      cardPosition: (index: number) => `左から ${index + 1} 番目の`,
      blackCard: '黒カード',
      whiteCard: '白カード',
      candidateRange: '推理候補範囲:',
      candidateCount: (count: number) => `(${count}通り)`,
      remainingDeck: '未確定の残弾:',
      noRemainingDeck: 'なし',
      failedGuesses: '過去の外れ宣言:',
      failedBadge: '✕ハズレ済',
      candidateOut: '候補外',
      confirmedBadge: '確認済',
      cancel: 'キャンセル',
      confirm: 'アタック実行',
      selectNumberPrompt: '数字を選んでアタックを実行',
      attackWithNumber: (num: number) => `数字 ${num} でアタックを実行`,
      numButtonAria: (num: number, isFailed: boolean, isKnown: boolean) =>
        `数字 ${num}${isFailed ? ' (✕ハズレ済)' : isKnown ? ' (確認済)' : ''}`,
      closeAria: 'モーダルを閉じる',
    },
    attackResult: {
      hit: '的中！ HIT!',
      miss: 'ハズレ... MISS',
      revealedCard: 'めくられたカード',
      actualCard: '実際のカード',
      guessedCard: '推理した数字',
      keepAttacking: '続けてアタック',
      endTurn: 'ターン終了',
      stay: 'ステイ',
      nextTurn: '次へ進む',
      resultTitle: '推理結果',
      spectatorTitle: '観戦モード',
      spectatingDesc: '自動進行または手動でゲームを展開できます',
      cpuAttacking: (name: string) => `${name} が推理中...`,
      playerAttacking: (name: string) => `${name} のアタック！`,
      cpuGuess: (attacker: string, target: string, index: number, color: string, num: number) =>
        `${attacker} は ${target} の左から${index + 1}番目の${color}を「${num}」と推理！`,
      correct: '的中！',
      incorrect: 'ハズレ...',
    },
    deckTracker: {
      title: '残弾トラッカー',
      remainingLabel: '残弾:',
      activeAssist: '候補連動',
      activeAssistTitle: '推理候補ハイライト中',
      remainingSummary: (rem: number) => `残弾: ${rem} / 24`,
      remainingBlackWhite: (b: number, w: number) => `黒${b} 白${w}`,
      confirmed: '確定済み',
      candidate: '推理候補',
      remaining: '未確定',
      expand: 'トラッカーを展開',
      collapse: 'トラッカーを折りたたむ',
      cardBadgeAria: (color: string, num: number, status: string) => `${color}${num} (${status})`,
      summaryTitle: (bRem: number, wRem: number, conf: number) =>
        `未確定: 黒${bRem}枚 / 白${wRem}枚 (確定: ${conf}枚)`,
    },
    card: {
      hidden: '伏せ中',
      revealed: '開示',
      range: '候補: ',
      rangeTooltip: (range: string) => `候補数字: ${range}`,
    },
    result: {
      victory: 'VICTORY!',
      defeat: 'DEFEAT...',
      spectateEnd: 'MATCH FINISHED',
      rank1: '1位 (完全勝利)',
      rank2: '2位 (健闘)',
      rank3: '3位',
      rank4: '4位',
      rankBadge: (rank: number) => `${rank}位`,
      handReveal: '手札の答え合わせ',
      combatStats: '戦績サマリ',
      hitRate: '的中率',
      attacks: 'アタック回数',
      turns: 'ターン数',
      surviving: '生存手札',
      rematch: 'もう一度遊ぶ',
      backToSetup: '設定に戻る',
      reviewTitle: '最終結果 & 盤面レビュー',
      winnerDesc: (name: string) => `勝者: ${name}`,
      congrats: 'おめでとうございます！すべての対戦相手を出し抜きました！',
      betterLuck: '惜しくも敗退しました。次こそは完全推理を目指しましょう！',
      openAllCards: 'すべてのカードが開示されました',
    },
    stats: {
      title: '戦績＆アチーブメント',
      overview: '通算成績',
      totalGames: '総対戦数',
      totalWins: '総勝利数',
      winRate: '通算勝率',
      currentStreak: '現在の連勝',
      maxStreak: '最多連勝記録',
      achievementsTitle: 'トロフィー＆アチーブメント',
      progress: (unlocked: number, total: number) => `達成率: ${unlocked} / ${total}`,
      resetStats: '戦績リセット',
      resetConfirmTitle: '戦績と実績をリセットしますか？',
      resetConfirmDesc: 'これまでに記録された戦績およびトロフィーの獲得状況がすべて初期化されます。この操作は取り消せません。',
      close: '閉じる',
      unlocked: '獲得済み',
      locked: '未達成',
    },
    rules: {
      title: 'algo（アルゴ）公式ルールガイド',
      subtitle: '数学的論理思考で相手の伏せカードを暴くカードゲーム',
      close: '閉じる',
      tabBasics: '基本ルール',
      tabSorting: 'カードの並び順',
      tabAttack: 'アタックと推理',
      tabTips: '推理のコツ・定石',
    },
    tutorial: {
      title: 'アルゴの遊び方チュートリアル',
      skip: 'チュートリアルを終了',
      next: '次へ進む',
      back: '前へ戻る',
      finish: 'ゲームを始める',
    },
    hint: {
      title: 'ヒントアドバイザー',
      recommended: 'おすすめの推理',
      reason: '理由・思考プロセス',
      remainingHints: (rem: number) => `残りヒント回数: ${rem}回`,
      noHintAvailable: '利用可能なヒントはありません',
      close: '閉じる',
      applyHint: 'このヒントを採用して選択',
    },
    lethal: {
      title: '勝負あり！',
      subtitle: '相手の最後の伏せカードを暴け！',
      banner: 'FINISH BLOW',
    },
    log: {
      title: '対戦ログ',
      empty: 'まだログはありません',
      clear: 'ログ消去',
    },
    confirm: {
      restartTitle: 'ゲームをリセットして最初からやり直しますか？',
      restartDesc: '進行中のゲームデータは破棄され、初期状態に戻ります。',
      setupTitle: '現在の対戦を終了して設定画面に戻りますか？',
      setupDesc: '進行中のゲームは破棄されます。',
      resetStatsTitle: '通算戦績をすべてリセットしますか？',
      resetStatsDesc: '記録された対戦データや実績がすべて初期化されます。',
      confirmBtn: 'はい、実行します',
      cancelBtn: 'いいえ、戻ります',
    },
    error: {
      title: '予期せぬエラーが発生しました',
      description: '申し訳ありません。ゲームの実行中に問題が発生しました。',
      reload: 'ゲームを再読み込み',
      backToTitle: 'タイトルに戻る',
    },
    mobileMenu: {
      title: 'メニュー',
      soundTitle: '効果音サウンド',
      soundOnDesc: '現在: ON (効果音あり)',
      soundOffDesc: '現在: OFF (ミュート中)',
      statsTitle: '戦績＆アチーブメント',
      statsDesc: '通算戦績・勝率・獲得実績',
      rulesTitle: 'ルールガイド',
      rulesDesc: '遊び方・基本ルール解説',
      tutorialTitle: 'チュートリアル',
      tutorialDesc: '初心者向けステップガイド',
      restartTitle: '現在のゲームを再戦',
      restartDesc: '同じ設定でリスタート',
      settingsTitle: '対戦設定に戻る',
      settingsDesc: '人数・難易度・持ち時間の変更',
      languageTitle: '表示言語の切り替え',
      languageDesc: '日本語 / English の切り替え',
      viewAction: '表示 →',
      closeAria: 'メニューを閉じる',
    },
  },
  en: {
    common: {
      appName: 'algo',
      webMatch: 'Web Battle',
      guestId: 'Guest ID',
      you: 'You',
      player: 'Player',
      cpu: 'AI Opponent',
      close: 'Close',
      cancel: 'Cancel',
      confirm: 'Confirm',
      back: 'Back',
      next: 'Next',
      finish: 'Finish',
      on: 'ON',
      off: 'OFF',
      black: 'Black',
      white: 'White',
      deck: 'Deck',
      remaining: 'Remaining',
      cards: 'cards',
      turn: 'Turn',
      vs: 'vs',
      loading: 'Loading...',
      none: 'None',
      notice: 'Notice',
    },
    header: {
      hint: (remaining: number) => `💡 Hint (${remaining} left)`,
      assist: (on: boolean) => `Assist ${on ? 'ON' : 'OFF'}`,
      assistAria: (on: boolean) => `Beginner Assist: ${on ? 'ON' : 'OFF'}`,
      assistTitle: (on: boolean) => (on ? 'Assist ON (Click to turn off)' : 'Assist OFF (Click to turn on)'),
      sound: (on: boolean) => `Sound ${on ? 'ON' : 'OFF'}`,
      soundAria: (on: boolean) => `Sound Effects: ${on ? 'ON' : 'OFF'}`,
      soundTitle: (on: boolean) => (on ? 'Sound ON (Click to mute)' : 'Sound OFF (Click to unmute)'),
      tutorial: 'Tutorial',
      rules: 'Rules',
      stats: 'Stats',
      statsTitle: 'View Career Stats & Achievements',
      rematch: 'Rematch',
      settings: 'Settings',
      viewResult: 'View Result',
      menu: 'Menu',
      menuOpen: 'Open Menu',
      menuClose: 'Close Menu',
      language: 'Language',
      languageTitle: 'Toggle language between English and Japanese',
    },
    setup: {
      title: 'algo',
      subtitle: 'Deduce hidden black & white cards in this strategic math-based mind game by Dr. Peter Frankl',
      playerCountLabel: 'Select Number of Players (2-4)',
      playerCount2Sub: 'Starting Hand: 4 cards each (1v1 Duel)',
      playerCount3Sub: 'Starting Hand: 3 cards each (3-Way Battle)',
      playerCount4Sub: 'Starting Hand: 3 cards each (4-Way Free-for-all)',
      p2Label: '2 Players',
      p2Sub: 'You vs 1 CPU',
      p3Label: '3 Players',
      p3Sub: 'You vs 2 CPUs',
      p4Label: '4 Players',
      p4Sub: 'You vs 3 CPUs',
      rosterTitle: 'Match Lineup',
      remainingDeck: '🎴 Remaining Deck:',
      handCount: (count: number) => `${count} cards`,
      playerHandDesc: (name: string, handCount: number) => `${name} (${handCount} cards)`,
      humanRole: 'Player',
      cpuRole: 'AI Opponent',
      timeLimitLabel: 'Select Turn Time Limit',
      timeLimitUnlimited: 'Unlimited (Deep Thought)',
      timeLimitSeconds: (sec: number) => `${sec}s / turn`,
      sec15Label: '15s (Blitz)',
      sec15Sub: 'Fast-paced & thrilling',
      sec30Label: '30s (Standard)',
      sec30Sub: 'Balanced & recommended',
      sec0Label: 'Unlimited',
      sec0Sub: 'No timer • Great for beginners',
      difficultyLabel: 'Select CPU Difficulty',
      diffEasyDesc: 'Random guessing • Casual practice',
      diffNormalDesc: 'Logical deduction with slips • Standard',
      diffHardDesc: 'Flawless elimination • Master AI',
      diffEasy: 'Novice (Easy)',
      diffNormal: 'Adept (Normal)',
      diffHard: 'Master (Hard)',
      startMatch: 'Start Battle',
      rulesBtn: '📖 How to Play',
      tutorialBtn: '🎓 Step-by-Step Guide',
      statsBtn: '🏆 Stats & Trophies',
      footerGuide: 'Game Guide',
      footerPrivacy: 'Privacy Policy',
      footerTerms: 'Terms of Service',
      footerContact: 'Contact Us',
    },
    board: {
      drawFromDeck: 'Draw a card from the deck',
      drawCardPrompt: 'Draw a card from the deck to begin your turn',
      attackPrompt: "Select an opponent's hidden card and attack!",
      continueOrStayPrompt: 'Hit! Attack again, or keep the card and stay',
      continueAttack: 'Keep Attacking',
      stay: 'Stay (Keep in Hand)',
      stayNoDeck: 'Stay (End Turn)',
      spectatingTitle: 'Spectator Mode',
      spectatingDesc: 'All your cards are revealed. Watching the remaining match unfold.',
      autoAdvance: 'Auto-Play',
      autoAdvanceOn: 'Auto-Play: ON',
      autoAdvanceOff: 'Auto-Play: OFF',
      skipToResult: 'Skip to Result',
      deckRemaining: 'Remaining Deck',
      cardsUnit: 'cards',
      emptyDeck: 'Deck Empty',
      yourHand: 'Your Hand',
      drawnCard: 'Drawn Card',
      cardOrderHint: '*Sorted low to high (Black precedes White on ties)',
      timeUpMessage: 'TIME UP! Time limit exceeded. Drawn card was revealed!',
      timeUpAutoDrawMessage: 'TIME UP! Card was auto-drawn and revealed!',
      timeUpNoDeckMessage: 'TIME UP! Time limit exceeded with empty deck. A hidden card was revealed!',
      eliminationMessage: 'All your cards are revealed! You have been eliminated — entering Spectator Mode.',
      currentTurn: (name: string) => `${name}'s Turn`,
      yourTurn: 'Your Turn',
      winnerBanner: (name: string) => `🏆 Winner: ${name}!`,
      timerTitle: (isPaused: boolean, sec: number) => (isPaused ? 'Timer Paused' : `Time remaining: ${sec}s`),
      timerSeconds: (sec: number) => `${sec}s`,
      timerUnlimited: 'Unlimited',
      toggleLogAria: (isOpen: boolean) => (isOpen ? 'Close battle log' : 'Open battle log'),
      toggleLogTitle: (isOpen: boolean) => (isOpen ? 'Close battle log' : 'Show battle log'),
      closeBannerAria: 'Close notice',
    },
    attackModal: {
      title: 'Attack (Deduce Number)',
      target: 'Target',
      cardPosition: (index: number) => `Card #${index + 1} from left:`,
      blackCard: 'Black Card',
      whiteCard: 'White Card',
      candidateRange: 'Possible Range:',
      candidateCount: (count: number) => `(${count} options)`,
      remainingDeck: 'Unrevealed Pool:',
      noRemainingDeck: 'None',
      failedGuesses: 'Previous Misses:',
      failedBadge: '✕ Missed',
      candidateOut: 'Excluded',
      confirmedBadge: 'Known',
      cancel: 'Cancel',
      confirm: 'Attack',
      selectNumberPrompt: 'Select a number to attack',
      attackWithNumber: (num: number) => `Attack with number ${num}`,
      numButtonAria: (num: number, isFailed: boolean, isKnown: boolean) =>
        `Number ${num}${isFailed ? ' (✕ Missed)' : isKnown ? ' (Known)' : ''}`,
      closeAria: 'Close modal',
    },
    attackResult: {
      hit: 'HIT! Deduction Correct!',
      miss: 'MISS! Deduction Failed',
      revealedCard: 'Revealed Card',
      actualCard: 'Actual Card',
      guessedCard: 'Guessed Number',
      keepAttacking: 'Keep Attacking',
      endTurn: 'End Turn',
      stay: 'Stay',
      nextTurn: 'Continue',
      resultTitle: 'Attack Result',
      spectatorTitle: 'Spectator Mode',
      spectatingDesc: 'Watch moves advance automatically or proceed manually',
      cpuAttacking: (name: string) => `${name} is deducing...`,
      playerAttacking: (name: string) => `${name}'s Attack!`,
      cpuGuess: (attacker: string, target: string, index: number, color: string, num: number) =>
        `${attacker} deduced ${target}'s #${index + 1} ${color} card as "${num}"!`,
      correct: 'Hit!',
      incorrect: 'Miss...',
    },
    deckTracker: {
      title: 'Card Tracker',
      remainingLabel: 'Remaining:',
      activeAssist: 'Linked',
      activeAssistTitle: 'Candidate numbers highlighted',
      remainingSummary: (rem: number) => `Remaining: ${rem} / 24`,
      remainingBlackWhite: (b: number, w: number) => `B:${b} W:${w}`,
      confirmed: 'Revealed',
      candidate: 'Candidate',
      remaining: 'Hidden',
      expand: 'Expand tracker',
      collapse: 'Collapse tracker',
      cardBadgeAria: (color: string, num: number, status: string) => `${color}${num} (${status})`,
      summaryTitle: (bRem: number, wRem: number, conf: number) =>
        `Unrevealed: Black ${bRem} / White ${wRem} (Revealed: ${conf})`,
    },
    card: {
      hidden: 'HIDDEN',
      revealed: 'REVEALED',
      range: 'Range: ',
      rangeTooltip: (range: string) => `Candidate Range: ${range}`,
    },
    result: {
      victory: 'VICTORY!',
      defeat: 'DEFEAT...',
      spectateEnd: 'MATCH FINISHED',
      rank1: '1st Place (Winner)',
      rank2: '2nd Place',
      rank3: '3rd Place',
      rank4: '4th Place',
      rankBadge: (rank: number) => `#${rank}`,
      handReveal: 'Hand Reveal & Review',
      combatStats: 'Combat Stats',
      hitRate: 'Hit Rate',
      attacks: 'Total Attacks',
      turns: 'Total Turns',
      surviving: 'Surviving Cards',
      rematch: 'Play Again',
      backToSetup: 'Back to Setup',
      reviewTitle: 'Final Results & Board Review',
      winnerDesc: (name: string) => `Winner: ${name}`,
      congrats: 'Congratulations! You outsmarted all your opponents!',
      betterLuck: 'Defeated this time. Hone your deduction and try again!',
      openAllCards: 'All cards have been revealed',
    },
    stats: {
      title: 'Career Stats & Achievements',
      overview: 'Career Overview',
      totalGames: 'Total Matches',
      totalWins: 'Total Wins',
      winRate: 'Win Rate',
      currentStreak: 'Current Win Streak',
      maxStreak: 'Max Win Streak',
      achievementsTitle: 'Trophies & Achievements',
      progress: (unlocked: number, total: number) => `Progress: ${unlocked} / ${total}`,
      resetStats: 'Reset Stats',
      resetConfirmTitle: 'Reset all career stats and achievements?',
      resetConfirmDesc: 'All recorded match history and earned trophies will be permanently wiped. This action cannot be undone.',
      close: 'Close',
      unlocked: 'Unlocked',
      locked: 'Locked',
    },
    rules: {
      title: 'algo Official Rulebook',
      subtitle: 'A card game of mathematical deduction to reveal opponents’ hidden cards',
      close: 'Close',
      tabBasics: 'Basic Rules',
      tabSorting: 'Card Order',
      tabAttack: 'Attacking & Guessing',
      tabTips: 'Strategy & Tips',
    },
    tutorial: {
      title: 'algo Step-by-Step Tutorial',
      skip: 'Skip Tutorial',
      next: 'Next',
      back: 'Back',
      finish: 'Start Game',
    },
    hint: {
      title: 'Hint Advisor',
      recommended: 'Recommended Deduction',
      reason: 'Reasoning & Logic',
      remainingHints: (rem: number) => `Hints remaining: ${rem}`,
      noHintAvailable: 'No hints available at this moment',
      close: 'Close',
      applyHint: 'Apply this hint',
    },
    lethal: {
      title: 'LETHAL BLOW!',
      subtitle: 'Reveal their final hidden card to win!',
      banner: 'FINISH BLOW',
    },
    log: {
      title: 'Battle Log',
      empty: 'No moves recorded yet',
      clear: 'Clear Log',
    },
    confirm: {
      restartTitle: 'Restart match from the beginning?',
      restartDesc: 'Current match progress will be discarded.',
      setupTitle: 'Return to match setup?',
      setupDesc: 'Current match will be terminated.',
      resetStatsTitle: 'Reset all career stats?',
      resetStatsDesc: 'All match history and achievements will be permanently cleared.',
      confirmBtn: 'Yes, proceed',
      cancelBtn: 'No, cancel',
    },
    error: {
      title: 'An unexpected error has occurred',
      description: 'We apologize for the inconvenience. A problem occurred while running the game.',
      reload: 'Reload Game',
      backToTitle: 'Back to Title',
    },
    mobileMenu: {
      title: 'Menu',
      soundTitle: 'Sound Effects',
      soundOnDesc: 'Current: ON (Enabled)',
      soundOffDesc: 'Current: OFF (Muted)',
      statsTitle: 'Stats & Achievements',
      statsDesc: 'Career stats, win rate & trophies',
      rulesTitle: 'Rule Guide',
      rulesDesc: 'How to play & core rules',
      tutorialTitle: 'Tutorial',
      tutorialDesc: 'Beginner step-by-step walkthrough',
      restartTitle: 'Rematch Current Battle',
      restartDesc: 'Restart with current settings',
      settingsTitle: 'Change Battle Settings',
      settingsDesc: 'Players, difficulty & time limit',
      languageTitle: 'Display Language',
      languageDesc: 'Toggle Japanese / English',
      viewAction: 'View →',
      closeAria: 'Close menu',
    },
  },
} as const;

export type Translations = typeof translations.ja;

export interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const defaultI18nContext: I18nContextType = {
  language: 'ja',
  setLanguage: () => {},
  t: translations.ja,
};

export const I18nContext = createContext<I18nContextType>(defaultI18nContext);

export interface I18nProviderProps {
  children?: ReactNode;
  initialLanguage?: Language;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  initialLanguage,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (initialLanguage) return initialLanguage;
    return detectInitialLanguage();
  });

  useEffect(() => {
    // クライアントマウント時に言語設定を同期（initialLanguage が明示指定されている場合は上書きしない）
    if (initialLanguage) return;
    const detected = detectInitialLanguage();
    setLanguageState(detected);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = detected;
    }
  }, [initialLanguage]);

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    setStoredLanguage(newLang);
  };

  const t = useMemo(() => {
    return (translations[language] || translations.ja) as Translations;
  }, [language]);

  const contextValue = useMemo<I18nContextType>(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, t]
  );

  return React.createElement(
    I18nContext.Provider,
    { value: contextValue },
    children
  );
};

/**
 * 多言語翻訳フック
 * Provider の外側で呼ばれた場合でも安全にフォールバック（detectInitialLanguage）で動作
 */
export function useI18n(): I18nContextType {
  try {
    // React レンダリング外（プレーン関数呼び出し）での Invalid Hook Call 警告防止
    const anyReact = React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: { H?: unknown };
      __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: { ReactCurrentDispatcher?: { current?: unknown } };
    };
    const hasDispatcher =
      anyReact?.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?.H ||
      anyReact?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher?.current;

    if (!hasDispatcher) {
      const detected = detectInitialLanguage();
      return {
        language: detected,
        setLanguage: setStoredLanguage,
        t: (translations[detected] || translations.ja) as Translations,
      };
    }

    const ctx = useContext(I18nContext);
    if (!ctx || ctx === defaultI18nContext) {
      // Provider外での呼び出し（単体テスト等）時のフォールバック
      const detected = detectInitialLanguage();
      return {
        language: detected,
        setLanguage: setStoredLanguage,
        t: (translations[detected] || translations.ja) as Translations,
      };
    }
    return ctx;
  } catch {
    // プレーン関数としてのコンポーネント直接呼び出し時等のフォールバック
    const detected = detectInitialLanguage();
    return {
      language: detected,
      setLanguage: setStoredLanguage,
      t: (translations[detected] || translations.ja) as Translations,
    };
  }
}

export const useTranslation = useI18n;
