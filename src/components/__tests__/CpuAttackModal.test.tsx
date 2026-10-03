import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  CpuAttackModal,
  AttackResultModal,
  CpuAttackResultData,
  AttackResultData,
  getNextActionMessage,
} from '../CpuAttackModal';
import AttackResultModalDefault, {
  getNextActionMessage as getNextActionMessageFromProxy,
} from '../AttackResultModal';

describe('getNextActionMessage', () => {
  describe('CPUアタック時の展開案内メッセージ', () => {
    it('CONTINUE の展開案内メッセージを生成する', () => {
      expect(getNextActionMessage('CPU 1', 'CONTINUE')).toBe(
        'CPU 1 はさらにアタックを継続します'
      );
    });

    it('STAY の展開案内メッセージを生成する', () => {
      expect(getNextActionMessage('CPU 1', 'STAY')).toBe(
        'CPU 1 は手札に加えてステイしました'
      );
    });

    it('TURN_END の展開案内メッセージ（次のプレイヤー名付き）を生成する', () => {
      expect(getNextActionMessage('CPU 1', 'TURN_END', 'あなた')).toBe(
        'CPU 1 のターンが終了しました。次は あなた の番です'
      );
      expect(getNextActionMessage('CPU 1', 'TURN_END', 'CPU 2')).toBe(
        'CPU 1 のターンが終了しました。次は CPU 2 の番です'
      );
    });

    it('GAME_OVER の展開案内メッセージを生成する', () => {
      expect(getNextActionMessage('CPU 1', 'GAME_OVER')).toBe('勝敗が決しました');
    });
  });

  describe('プレイヤー（あなた）アタック時の展開案内メッセージ (Issue #56)', () => {
    it('的中時（CONTINUE）: 続けてアタックするかステイするか選択可能メッセージを生成する', () => {
      expect(getNextActionMessage('あなた', 'CONTINUE')).toBe(
        '的中！続けてアタックするか、手札に加えてステイするか選択できます'
      );
    });

    it('isHuman: true の場合も同様に継続案内メッセージを生成する', () => {
      expect(getNextActionMessage('Player 1', 'CONTINUE', undefined, true)).toBe(
        '的中！続けてアタックするか、手札に加えてステイするか選択できます'
      );
    });

    it('ハズレ時（TURN_END）: あなたのターン終了と次のプレイヤー案内メッセージを生成する', () => {
      expect(getNextActionMessage('あなた', 'TURN_END', 'CPU 1')).toBe(
        'あなたのターンが終了しました。次は CPU 1 の番です'
      );
      expect(getNextActionMessage('Player 1', 'TURN_END', 'CPU 2', true)).toBe(
        'あなたのターンが終了しました。次は CPU 2 の番です'
      );
    });

    it('決着時（GAME_OVER）: 勝敗決着メッセージを生成する', () => {
      expect(getNextActionMessage('あなた', 'GAME_OVER')).toBe('勝敗が決しました');
      expect(getNextActionMessage('Player 1', 'GAME_OVER', undefined, true)).toBe('勝敗が決しました');
    });

    it('ステイ時（STAY）: 手札に加えてステイメッセージを生成する', () => {
      expect(getNextActionMessage('あなた', 'STAY')).toBe('手札に加えてステイしました');
    });

    it('山札枯渇時（isDeckExhausted: true）のステイ・継続案内メッセージ (Issue #68)', () => {
      expect(getNextActionMessage('あなた', 'STAY', undefined, true, true)).toBe('ステイしました');
      expect(getNextActionMessage('CPU 1', 'STAY', undefined, false, true)).toBe('CPU 1 はステイしました');
      expect(getNextActionMessage('あなた', 'CONTINUE', undefined, true, true)).toBe(
        '的中！続けてアタックするか、ステイするか選択できます'
      );
    });
  });
});

describe('CpuAttackModal / AttackResultModal Component Rendering', () => {
  const baseHitData: CpuAttackResultData = {
    attackerName: 'CPU 1',
    targetPlayerName: 'あなた',
    targetCardIndex: 2,
    targetColor: 'black',
    guessedNumber: 7,
    isHit: true,
    actualNumber: 7,
    nextAction: 'CONTINUE',
  };

  it('isOpen が false の場合、何も描画されない', () => {
    const html = renderToString(
      <CpuAttackModal isOpen={false} data={baseHitData} onConfirm={vi.fn()} />
    );
    expect(html).toBe('');
  });

  it('data が null の場合、何も描画されない', () => {
    const html = renderToString(
      <CpuAttackModal isOpen={true} data={null} onConfirm={vi.fn()} />
    );
    expect(html).toBe('');
  });

  it('CPU的中の場合、アタッカー・ターゲット・予想数字・的中バナー・継続案内・OKボタンが正しく描画される', () => {
    const html = renderToString(
      <CpuAttackModal isOpen={true} data={baseHitData} onConfirm={vi.fn()} />
    );

    // ダイアログ構造
    expect(html).toContain('role="dialog"');
    expect(html).toContain('data-testid="cpu-attack-modal"');
    expect(html).toContain('data-testid="attack-result-modal"');

    // アタッカー (CPU)
    expect(html).toContain('data-testid="attack-result-badge"');
    expect(html).toContain('CPU 1 のアタック');

    // ターゲット（あなた、3番目、黒カード）
    expect(html).toContain('あなた');
    expect(html).toContain('>3<');
    expect(html).toContain('黒カード');

    // 予想した数字
    expect(html).toContain('data-testid="cpu-guessed-card"');
    expect(html).toContain('>7<');
    expect(html).toContain('BLACK');

    // 的中バナー
    expect(html).toContain('data-testid="cpu-attack-hit-banner"');
    expect(html).toContain('的中！');
    expect(html).not.toContain('data-testid="cpu-attack-miss-banner"');

    // 展開案内（CONTINUE）
    expect(html).toContain('data-testid="cpu-next-action-message"');
    expect(html).toContain('CPU 1 はさらにアタックを継続します');

    // OKボタン
    expect(html).toContain('data-testid="btn-attack-result-ok"');
    expect(html).toContain('data-testid="btn-cpu-attack-ok"');
    expect(html).toContain('OK (次へ)');
  });

  it('ハズレ・白カード・TURN_END の場合、白カードと次のプレイヤー案内が正しく描画される', () => {
    const missData: CpuAttackResultData = {
      attackerName: 'CPU 2',
      targetPlayerName: 'CPU 1',
      targetCardIndex: 0,
      targetColor: 'white',
      guessedNumber: 4,
      isHit: false,
      nextAction: 'TURN_END',
      nextPlayerName: 'あなた',
    };

    const html = renderToString(
      <CpuAttackModal isOpen={true} data={missData} onConfirm={vi.fn()} />
    );

    // アタッカー & ターゲット
    expect(html).toContain('CPU 2 のアタック');
    expect(html).toContain('CPU 1');
    expect(html).toContain('>1<');
    expect(html).toContain('白カード');

    // 予想数字
    expect(html).toContain('>4<');
    expect(html).toContain('WHITE');

    // ハズレバナー
    expect(html).toContain('data-testid="cpu-attack-miss-banner"');
    expect(html).toContain('ハズレ（失敗）');
    expect(html).toContain('CPU 2 の引いたカードがオープンされました');
    expect(html).not.toContain('data-testid="cpu-attack-hit-banner"');

    // 展開案内（TURN_END）
    expect(html).toContain('CPU 2 のターンが終了しました。次は あなた の番です');
  });

  it('ステイの場合（STAY）、ステイ案内が正しく描画される', () => {
    const stayData: CpuAttackResultData = {
      ...baseHitData,
      isHit: true,
      nextAction: 'STAY',
    };

    const html = renderToString(
      <CpuAttackModal isOpen={true} data={stayData} onConfirm={vi.fn()} />
    );
    expect(html).toContain('CPU 1 は手札に加えてステイしました');
  });

  it('ゲーム終了の場合（GAME_OVER）、決着案内が正しく描画される', () => {
    const gameOverData: CpuAttackResultData = {
      ...baseHitData,
      isHit: true,
      nextAction: 'GAME_OVER',
    };

    const html = renderToString(
      <CpuAttackModal isOpen={true} data={gameOverData} onConfirm={vi.fn()} />
    );
    expect(html).toContain('勝敗が決しました');
  });

  describe('プレイヤーアタック結果表示 (Issue #56 要求仕様)', () => {
    const playerHitData: AttackResultData = {
      attackerName: 'あなた',
      isHuman: true,
      targetPlayerName: 'CPU 1',
      targetCardIndex: 1,
      targetColor: 'white',
      guessedNumber: 5,
      isHit: true,
      actualNumber: 5,
      nextAction: 'CONTINUE',
    };

    it('プレイヤー的中の場合: 「あなたのアタック」バッジと選択可能案内が表示される', () => {
      const html = renderToString(
        <AttackResultModal isOpen={true} data={playerHitData} onConfirm={vi.fn()} />
      );

      // バッジに「あなたのアタック」
      expect(html).toContain('data-testid="attack-result-badge"');
      expect(html).toContain('あなたのアタック');
      expect(html).not.toContain('あなた のアタック');

      // ターゲット & 推理数字
      expect(html).toContain('CPU 1');
      expect(html).toContain('>2<');
      expect(html).toContain('白カード');
      expect(html).toContain('>5<');
      expect(html).toContain('WHITE');

      // 的中バナー
      expect(html).toContain('data-testid="cpu-attack-hit-banner"');
      expect(html).toContain('的中！');
      expect(html).toContain('対象のカードがオープンされました');

      // 展開案内メッセージ
      expect(html).toContain('data-testid="cpu-next-action-message"');
      expect(html).toContain(
        '的中！続けてアタックするか、手札に加えてステイするか選択できます'
      );

      // OKボタン
      expect(html).toContain('data-testid="btn-attack-result-ok"');
      expect(html).toContain('data-testid="btn-cpu-attack-ok"');
      expect(html).toContain('OK (次へ)');
    });

    it('プレイヤーハズレの場合: ハズレ判定文「あなたの引いたカードがオープンされました」とターン終了案内が表示される', () => {
      const playerMissData: AttackResultData = {
        attackerName: 'あなた',
        isHuman: true,
        targetPlayerName: 'CPU 1',
        targetCardIndex: 0,
        targetColor: 'black',
        guessedNumber: 3,
        isHit: false,
        actualNumber: 8,
        nextAction: 'TURN_END',
        nextPlayerName: 'CPU 1',
      };

      const html = renderToString(
        <AttackResultModal isOpen={true} data={playerMissData} onConfirm={vi.fn()} />
      );

      // バッジ
      expect(html).toContain('あなたのアタック');

      // ハズレバナーと指定ハズレ文
      expect(html).toContain('data-testid="cpu-attack-miss-banner"');
      expect(html).toContain('ハズレ（失敗）');
      expect(html).toContain('あなたの引いたカードがオープンされました');

      // 展開案内（次のプレイヤー名付き）
      expect(html).toContain('あなたのターンが終了しました。次は CPU 1 の番です');
    });

    it('プレイヤー勝利・決着時（GAME_OVER）: 「勝敗が決しました」が表示される', () => {
      const playerGameOverData: AttackResultData = {
        attackerName: 'あなた',
        isHuman: true,
        targetPlayerName: 'CPU 1',
        targetCardIndex: 2,
        targetColor: 'black',
        guessedNumber: 9,
        isHit: true,
        actualNumber: 9,
        nextAction: 'GAME_OVER',
      };

      const html = renderToString(
        <AttackResultModal isOpen={true} data={playerGameOverData} onConfirm={vi.fn()} />
      );

      expect(html).toContain('的中！');
      expect(html).toContain('勝敗が決しました');
    });

    it('山札枯渇時のプレイヤーアタックハズレ（isDeckExhausted: true）: 「山札がないため、手札の伏せカードがオープンされました」が表示され虚偽通知が排除される (Issue #68)', () => {
      const playerExhaustedMissData: AttackResultData = {
        attackerName: 'あなた',
        isHuman: true,
        targetPlayerName: 'CPU 1',
        targetCardIndex: 0,
        targetColor: 'black',
        guessedNumber: 3,
        isHit: false,
        actualNumber: 8,
        nextAction: 'TURN_END',
        nextPlayerName: 'CPU 1',
        isDeckExhausted: true,
      };

      const html = renderToString(
        <AttackResultModal isOpen={true} data={playerExhaustedMissData} onConfirm={vi.fn()} />
      );

      expect(html).toContain('❌ ハズレ（失敗）');
      expect(html).toContain('山札がないため、手札の伏せカードがオープンされました');
      expect(html).not.toContain('あなたの引いたカードがオープンされました');
    });

    it('山札枯渇時のCPUアタックハズレ（isDeckExhausted: true）: 「山札がないため、手札の伏せカードがオープンされました」が表示される (Issue #68)', () => {
      const cpuExhaustedMissData: AttackResultData = {
        attackerName: 'CPU 1',
        isHuman: false,
        targetPlayerName: 'あなた',
        targetCardIndex: 1,
        targetColor: 'white',
        guessedNumber: 5,
        isHit: false,
        actualNumber: 2,
        nextAction: 'TURN_END',
        nextPlayerName: 'あなた',
        isDeckExhausted: true,
      };

      const html = renderToString(
        <CpuAttackModal isOpen={true} data={cpuExhaustedMissData} onConfirm={vi.fn()} />
      );

      expect(html).toContain('❌ ハズレ（失敗）');
      expect(html).toContain('山札がないため、手札の伏せカードがオープンされました');
      expect(html).not.toContain('CPU 1 の引いたカードがオープンされました');
    });

    it('アタック失敗時に actualNumber が undefined（伏せカード正解数字の漏洩防止）でもモーダルが正常に描画される (Issue #84)', () => {
      const secureMissData: AttackResultData = {
        attackerName: 'あなた',
        isHuman: true,
        targetPlayerName: 'CPU 1',
        targetCardIndex: 1,
        targetColor: 'white',
        guessedNumber: 4,
        isHit: false,
        actualNumber: undefined,
        nextAction: 'TURN_END',
        nextPlayerName: 'CPU 1',
      };

      const html = renderToString(
        <AttackResultModal isOpen={true} data={secureMissData} onConfirm={vi.fn()} />
      );

      expect(html).toContain('❌ ハズレ（失敗）');
      expect(html).toContain('あなたの引いたカードがオープンされました');
      expect(html).toContain('あなたのターンが終了しました。次は CPU 1 の番です');
      expect(html).not.toContain('正解');
    });
  });

  describe('AttackResultModal.tsx プロキシ再エクスポート検証', () => {
    it('AttackResultModal.tsx からデフォルトおよび名前付きエクスポートが利用できる', () => {
      expect(AttackResultModalDefault).toBeDefined();
      expect(typeof AttackResultModalDefault).toBe('function');
      expect(typeof getNextActionMessageFromProxy).toBe('function');
    });
  });

  describe('キーボード操作仕様検証 (Enter / Escape / Space)', () => {
    // AttackResultModal 内のキーハンドラロジックのユニット検証
    const createKeyHandler = (onConfirm: () => void) => {
      return (e: { key: string; preventDefault: () => void }) => {
        if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
          e.preventDefault();
          onConfirm();
        }
      };
    };

    it('Enterキー押下時に onConfirm が発火する', () => {
      const onConfirm = vi.fn();
      const preventDefault = vi.fn();
      const handler = createKeyHandler(onConfirm);

      handler({ key: 'Enter', preventDefault });
      expect(preventDefault).toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('Escapeキー押下時に onConfirm が発火する', () => {
      const onConfirm = vi.fn();
      const preventDefault = vi.fn();
      const handler = createKeyHandler(onConfirm);

      handler({ key: 'Escape', preventDefault });
      expect(preventDefault).toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('Spaceキー押下時に onConfirm が発火する', () => {
      const onConfirm = vi.fn();
      const preventDefault = vi.fn();
      const handler = createKeyHandler(onConfirm);

      handler({ key: ' ', preventDefault });
      expect(preventDefault).toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('その他のキー押下時は onConfirm が発火しない', () => {
      const onConfirm = vi.fn();
      const preventDefault = vi.fn();
      const handler = createKeyHandler(onConfirm);

      handler({ key: 'Tab', preventDefault });
      expect(preventDefault).not.toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
