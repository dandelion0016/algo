import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DeckTracker } from '../DeckTracker';
import { Player, Card } from '../../types/game';

describe('DeckTracker Component', () => {
  const mockHumanPlayer: Player = {
    id: 'player-1',
    name: '自分',
    isHuman: true,
    cards: [
      { id: 'b-1', color: 'black', number: 1, isOpen: false },
      { id: 'b-4', color: 'black', number: 4, isOpen: false },
      { id: 'w-7', color: 'white', number: 7, isOpen: false },
    ],
    isEliminated: false,
    avatarColor: 'blue',
  };

  const mockCpuPlayer: Player = {
    id: 'cpu-1',
    name: 'CPU 1',
    isHuman: false,
    cards: [
      { id: 'b-8', color: 'black', number: 8, isOpen: false }, // 伏せカード（残弾扱い）
      { id: 'w-2', color: 'white', number: 2, isOpen: true },  // 表向きカード（確定扱い）
    ],
    isEliminated: false,
    avatarColor: 'purple',
  };

  it('初期レンダリングで24枚すべてのカードバッジが表示されること', () => {
    render(<DeckTracker players={[]} />);

    expect(screen.getByTestId('deck-tracker')).toBeInTheDocument();
    expect(screen.getByText('残弾トラッカー')).toBeInTheDocument();

    // 0..11 の黒カード
    for (let i = 0; i <= 11; i++) {
      const card = screen.getByTestId(`tracker-card-black-${i}`);
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-status', 'remaining');
    }

    // 0..11 の白カード
    for (let i = 0; i <= 11; i++) {
      const card = screen.getByTestId(`tracker-card-white-${i}`);
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-status', 'remaining');
    }

    // サマリ確認
    const summary = screen.getByTestId('tracker-summary');
    expect(summary).toHaveTextContent('24');
  });

  it('自分の手札と相手のオープンカードが確定扱い（confirmed）となり、相手の伏せカードは未確定のままであること', () => {
    render(<DeckTracker players={[mockHumanPlayer, mockCpuPlayer]} />);

    // 自分のカード: 黒1, 黒4, 白7 は確定済み
    expect(screen.getByTestId('tracker-card-black-1')).toHaveAttribute(
      'data-status',
      'confirmed'
    );
    expect(screen.getByTestId('tracker-card-black-4')).toHaveAttribute(
      'data-status',
      'confirmed'
    );
    expect(screen.getByTestId('tracker-card-white-7')).toHaveAttribute(
      'data-status',
      'confirmed'
    );

    // 相手のオープンカード: 白2 は確定済み
    expect(screen.getByTestId('tracker-card-white-2')).toHaveAttribute(
      'data-status',
      'confirmed'
    );

    // 相手の伏せカード: 黒8 は未確定のまま（Information Hiding 厳守）
    expect(screen.getByTestId('tracker-card-black-8')).toHaveAttribute(
      'data-status',
      'remaining'
    );

    // サマリ: 確定4枚、残弾20枚
    const summary = screen.getByTestId('tracker-summary');
    expect(summary).toHaveTextContent('20');
  });

  it('ドローカード（drawnCard）が確定扱いになること', () => {
    const drawnCard: Card = { id: 'b-9', color: 'black', number: 9, isOpen: false };
    render(
      <DeckTracker
        players={[mockHumanPlayer]}
        drawnCard={drawnCard}
      />
    );

    expect(screen.getByTestId('tracker-card-black-9')).toHaveAttribute(
      'data-status',
      'confirmed'
    );
  });

  it('折りたたみボタンをクリックすると、カードグリッドの表示/非表示が切り替わること', () => {
    render(<DeckTracker players={[mockHumanPlayer]} />);

    expect(screen.getByTestId('tracker-content')).toBeInTheDocument();

    const toggleBtn = screen.getByTestId('tracker-toggle-btn');
    fireEvent.click(toggleBtn);

    // 折りたたまれ、コンテンツが非表示になること
    expect(screen.queryByTestId('tracker-content')).not.toBeInTheDocument();

    // もう一度クリックで再展開
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('tracker-content')).toBeInTheDocument();
  });

  it('推理候補ハイライトが指定された場合、対象の未確定カードがハイライトされること', () => {
    render(
      <DeckTracker
        players={[mockHumanPlayer]}
        highlightedNumbers={[2, 3, 4]}
        highlightColor="black"
      />
    );

    // 候補連動バッジが表示されること
    expect(screen.getByTestId('tracker-assist-active')).toBeInTheDocument();

    // 黒2, 3 は未確定かつ候補に含まれるのでハイライト
    expect(screen.getByTestId('tracker-card-black-2')).toHaveAttribute(
      'data-highlighted',
      'true'
    );
    expect(screen.getByTestId('tracker-card-black-3')).toHaveAttribute(
      'data-highlighted',
      'true'
    );

    // 黒4 は自分の手札で確定済みなのでハイライトされない
    expect(screen.getByTestId('tracker-card-black-4')).toHaveAttribute(
      'data-highlighted',
      'false'
    );

    // 白は highlightColor が black のためハイライトされない
    expect(screen.getByTestId('tracker-card-white-2')).toHaveAttribute(
      'data-highlighted',
      'false'
    );
  });

  it('タイトルが「残弾トラッカー」として表示され、whitespace-nowrap が付与されていること (Issue #115)', () => {
    render(<DeckTracker players={[]} />);

    const titleElement = screen.getByRole('heading', { level: 3 });
    expect(titleElement).toHaveTextContent('残弾トラッカー');
    expect(titleElement.className).toContain('whitespace-nowrap');
  });
});
