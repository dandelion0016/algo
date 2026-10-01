import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  CpuAttackModal,
  CpuAttackResultData,
  getNextActionMessage,
} from '../CpuAttackModal';

describe('getNextActionMessage', () => {
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

describe('CpuAttackModal Component Rendering', () => {
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

  it('的中の場合、アタッカー・ターゲット・予想数字・的中バナー・継続案内・OKボタンが正しく描画される', () => {
    const html = renderToString(
      <CpuAttackModal isOpen={true} data={baseHitData} onConfirm={vi.fn()} />
    );

    // ダイアログ構造
    expect(html).toContain('role="dialog"');
    expect(html).toContain('data-testid="cpu-attack-modal"');

    // アタッカー
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
});
