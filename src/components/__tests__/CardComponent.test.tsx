import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { render } from '@testing-library/react';
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

  it('2件の失敗数字がある場合、コンパクトな ✕3,7 の形式でバッジが表示されツールチップが付与される', () => {
    const html = renderToString(
      <CardComponent
        card={hiddenCard}
        isOwner={false}
        failedGuesses={[3, 7]}
      />
    );

    expect(html).toContain('data-testid="failed-guesses-badge"');
    expect(html).toContain('✕3,7');
    expect(html).toContain('title="過去の外れ数字: 3, 7"');
    expect(html).toContain('max-w-[48px]');
    expect(html).toContain('truncate');
  });

  it('3件以上の失敗数字がある場合、✕1,3.. の省略形式でバッジが表示され完全な全件ツールチップが付与される', () => {
    const html = renderToString(
      <CardComponent
        card={hiddenCard}
        isOwner={false}
        failedGuesses={[1, 3, 5, 7]}
      />
    );

    expect(html).toContain('data-testid="failed-guesses-badge"');
    expect(html).toContain('✕1,3..');
    expect(html).toContain('title="過去の外れ数字: 1, 3, 5, 7"');
    expect(html).toContain('max-w-[48px]');
    expect(html).toContain('truncate');
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

  it('isHintTarget が true の場合、data-hint-target="true" と hint-target-badge が描画される', () => {
    const html = renderToString(
      <CardComponent
        card={hiddenCard}
        isOwner={false}
        isHintTarget={true}
      />
    );

    expect(html).toContain('data-hint-target="true"');
    expect(html).toContain('data-testid="hint-target-badge"');
  });

  it('isHintTarget が false または未指定の場合、data-hint-target は付与されない', () => {
    const html = renderToString(
      <CardComponent
        card={hiddenCard}
        isOwner={false}
        isHintTarget={false}
      />
    );

    expect(html).not.toContain('data-hint-target="true"');
    expect(html).not.toContain('data-testid="hint-target-badge"');
  });

  describe('Information Hiding (DOM非漏洩テスト)', () => {
    it('相手の伏せカード（isOwner: false, isOpen: false）を描画した際、DOMに card.number の数字や data-card-number 属性が一切出力されない', () => {
      // 内部Cardオブジェクト（秘密の数字 7 を保持）が誤って渡された場合でも非漏洩
      const secretCard = {
        id: 'b-7',
        color: 'black' as const,
        number: 7,
        isOpen: false,
      };

      const { container } = render(
        <CardComponent
          card={secretCard}
          isOwner={false}
        />
      );

      const html = container.innerHTML;

      // 1. テキストコンテンツに数字 7 が含まれないこと（伏せカードなので「?」が表示されること）
      expect(container.textContent).not.toContain('7');
      expect(container.textContent).toContain('?');

      // 2. DOMの属性（data-testid, aria-label, etc）を含め、HTML全体に数字 "7" が漏洩していないこと
      expect(html).not.toContain('card-black-7');
      expect(html).toContain('card-black-hidden');

      // 3. data-card-number 属性が一切出力されていないこと
      expect(container.querySelector('[data-card-number]')).toBeNull();
      expect(html).not.toContain('data-card-number');

      // 4. aria-label にも秘密の数字が含まれず「伏せカード」となっていること
      const cardEl = container.querySelector('[data-testid="card-black-hidden"]');
      expect(cardEl).not.toBeNull();
      expect(cardEl?.getAttribute('aria-label')).toContain('伏せカード');
      expect(cardEl?.getAttribute('aria-label')).not.toContain('7');
    });

    it('自分の伏せカード（isOwner: true, isOpen: false）の場合は数字が表示され、伏せ中バッジがつく', () => {
      const secretCard = {
        id: 'w-4',
        color: 'white' as const,
        number: 4,
        isOpen: false,
      };

      const { container } = render(
        <CardComponent
          card={secretCard}
          isOwner={true}
        />
      );

      expect(container.textContent).toContain('4');
      expect(container.textContent).toContain('伏せ中');
      expect(container.querySelector('[data-testid="card-white-4"]')).not.toBeNull();
    });
  });
});
