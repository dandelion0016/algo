import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GameLog } from '../GameLog';
import { AttackLog, Player } from '../../types/game';

describe('GameLog & Attack Memo Board (Issue #43)', () => {
  const sampleLogs: AttackLog[] = [
    {
      id: 'log-1',
      attackerId: 'player',
      attackerName: 'あなた',
      targetPlayerId: 'cpu-1',
      targetPlayerName: 'CPU 1',
      targetCardIndex: 1,
      targetColor: 'black',
      guessedNumber: 4,
      isHit: false, // ハズレ
      timestamp: 1000,
      message: 'あなたのアタック: CPU 1 の 2番目(黒) に 4 と宣言 -> ハズレ！',
    },
    {
      id: 'log-2',
      attackerId: 'cpu-1',
      attackerName: 'CPU 1',
      targetPlayerId: 'player',
      targetPlayerName: 'あなた',
      targetCardIndex: 0,
      targetColor: 'white',
      guessedNumber: 2,
      isHit: true, // 的中
      timestamp: 2000,
      message: 'CPU 1のアタック: あなた の 1番目(白) に 2 と宣言 -> 的中！',
    },
  ];

  const samplePlayers: Player[] = [
    {
      id: 'player',
      name: 'あなた',
      isHuman: true,
      cards: [],
      isEliminated: false,
      avatarColor: '',
    },
    {
      id: 'cpu-1',
      name: 'CPU 1',
      isHuman: false,
      cards: [
        { id: 'b-1', color: 'black', number: 1, isOpen: true },
        { id: 'b-7', color: 'black', number: null as any, isOpen: false },
      ],
      isEliminated: false,
      avatarColor: '',
    },
  ];

  it('初期状態で対戦ログ一覧とタブボタン（対戦ログ/推理メモ）が描画される', () => {
    const html = renderToString(<GameLog logs={sampleLogs} players={samplePlayers} />);

    expect(html).toContain('data-testid="tab-game-logs"');
    expect(html).toContain('data-testid="tab-memo-board"');
    expect(html).toContain('あなたのアタック');
    expect(html).toContain('#2 黒 ✕4'); // ハズレサマリバッジ
  });

  it('ログが空の場合に空状態のメッセージが表示される', () => {
    const html = renderToString(<GameLog logs={[]} />);

    expect(html).toContain('まだアタック履歴はありません');
  });

  it('initialTab="memo" の場合に推理メモボードが正しく描画される', () => {
    const html = renderToString(
      <GameLog logs={sampleLogs} players={samplePlayers} initialTab="memo" />
    );

    expect(html).toContain('data-testid="attack-memo-board"');
    expect(html).toContain('CPU 1');
    expect(html).toContain('#1');
    expect(html).toContain('OPEN (1)');
    expect(html).toContain('#2');
    expect(html).toContain('伏せ');
    expect(html).toContain('data-testid="memo-failed-cpu-1-1"');
    expect(html).toContain('✕4'); // #2のカードに対して4で外れた
  });
});
