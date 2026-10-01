import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CardComponent } from '../CardComponent';
import { PublicCard } from '../../types/game';

describe('CardComponent (Issue #43: failed-guesses-badge)', () => {
  const hiddenCard: PublicCard = {
    id: 'b-hidden',
    color: 'black',
    number: null,
    isOpen: false,
  };

  const openCard: PublicCard = {
    id: 'b-5',
    color: 'black',
    number: 5,
    isOpen: true,
  };

  it('伏せカードかつ failedGuesses が存在する場合、failed-guesses-badge が描画される', () => {
    const html = renderToString(
      <CardComponent
        card={hiddenCard}
        isOwner={false}
        failedGuesses={[3]}
      />
    );

    expect(html).toContain('data-testid="failed-guesses-badge"');
    expect(html).toContain('✕3');
  });

  it('複数失敗数字がある場合、✕[3, 7] の形式でバッジが表示される', () => {
    const html = renderToString(
      <CardComponent
        card={hiddenCard}
        isOwner={false}
        failedGuesses={[3, 7]}
      />
    );

    expect(html).toContain('data-testid="failed-guesses-badge"');
    expect(html).toContain('✕[3, 7]');
  });

  it('failedGuesses が空配列の場合は failed-guesses-badge は表示されない', () => {
    const html = renderToString(
      <CardComponent
        card={hiddenCard}
        isOwner={false}
        failedGuesses={[]}
      />
    );

    expect(html).not.toContain('data-testid="failed-guesses-badge"');
  });

  it('オープン済みカードの場合は failed-guesses-badge は表示されない', () => {
    const html = renderToString(
      <CardComponent
        card={openCard}
        isOwner={false}
        failedGuesses={[3, 7]}
      />
    );

    expect(html).not.toContain('data-testid="failed-guesses-badge"');
  });
});
