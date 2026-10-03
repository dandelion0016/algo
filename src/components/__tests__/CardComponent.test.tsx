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

  describe('Issue #60: ゲーム終了時答え合わせ開示 (isRevealed)', () => {
    const hiddenOpponentCard = {
      id: 'b-7',
      color: 'black' as const,
      number: 7,
      isOpen: false,
    };

    const openOpponentCard = {
      id: 'w-3',
      color: 'white' as const,
      number: 3,
      isOpen: true,
    };

    it('isRevealed: true の場合、相手の伏せカードであっても数字が表示され、答え合わせ開示バッジ（reveal-badge）が表示される', () => {
      const { container } = render(
        <CardComponent
          card={hiddenOpponentCard}
          isOwner={false}
          isRevealed={true}
        />
      );

      // 1. 数字 7 がテキストとして描画されること（「?」ではない）
      expect(container.textContent).toContain('7');
      expect(container.textContent).not.toContain('?');

      // 2. 答え合わせ「開示」バッジが描画されること
      const revealBadge = container.querySelector('[data-testid="reveal-badge"]');
      expect(revealBadge).not.toBeNull();
      expect(revealBadge?.textContent).toBe('開示');

      // 3. testid に数字が含まれること
      expect(container.querySelector('[data-testid="card-black-7"]')).not.toBeNull();

      // 4. aria-label に数字と [開示] が含まれること
      const cardEl = container.querySelector('[data-testid="card-black-7"]');
      expect(cardEl?.getAttribute('aria-label')).toContain('(数字: 7)');
      expect(cardEl?.getAttribute('aria-label')).toContain('[開示]');
    });

    it('isRevealed: true かつカードが既にオープンの場合、OPENバッジが表示され、開示バッジは表示されない', () => {
      const { container } = render(
        <CardComponent
          card={openOpponentCard}
          isOwner={false}
          isRevealed={true}
        />
      );

      expect(container.textContent).toContain('3');
      expect(container.textContent).toContain('OPEN');
      expect(container.querySelector('[data-testid="reveal-badge"]')).toBeNull();
    });

    it('isRevealed: false の場合、伏せカードは「?」表示となり開示バッジは表示されない', () => {
      const { container } = render(
        <CardComponent
          card={hiddenOpponentCard}
          isOwner={false}
          isRevealed={false}
        />
      );

      expect(container.textContent).toContain('?');
      expect(container.textContent).not.toContain('7');
      expect(container.querySelector('[data-testid="reveal-badge"]')).toBeNull();
    });
  });

  describe('Issue #73: カードめくり3Dフリップアニメーション ＆ シャイン光彩エフェクト', () => {
    const hiddenCard: PublicCard = {
      id: 'b-hidden-73',
      color: 'black',
      number: null,
      isOpen: false,
    };

    const openCard: PublicCard = {
      id: 'w-5-73',
      color: 'white',
      number: 5,
      isOpen: true,
    };

    it('カード外枠コンテナに 3D パースペクティブクラス（perspective-1000）が付与されている', () => {
      const { container } = render(
        <CardComponent
          card={hiddenCard}
          isOwner={false}
        />
      );

      const cardElement = container.querySelector('[data-testid="card-element"]');
      expect(cardElement).not.toBeNull();
      expect(cardElement?.className).toContain('perspective-1000');
    });

    it('オープンされたカード（isOpen: true）の場合、animate-card-flip が適用され card-shimmer 要素が描画される', () => {
      const { container } = render(
        <CardComponent
          card={openCard}
          isOwner={false}
        />
      );

      const cardEl = container.querySelector('[data-testid="card-white-5"]');
      expect(cardEl).not.toBeNull();
      expect(cardEl?.className).toContain('animate-card-flip');
      expect(cardEl?.className).toContain('preserve-3d');

      const shimmerEl = container.querySelector('[data-testid="card-shimmer"]');
      expect(shimmerEl).not.toBeNull();
      expect(shimmerEl?.className).toContain('animate-card-shimmer');
      expect(shimmerEl?.getAttribute('aria-hidden')).toBe('true');
    });

    it('答え合わせ開示カード（isRevealed: true）の場合も、animate-card-flip と card-shimmer が適用される', () => {
      const secretCard = {
        id: 'b-9-secret',
        color: 'black' as const,
        number: 9,
        isOpen: false,
      };

      const { container } = render(
        <CardComponent
          card={secretCard}
          isOwner={false}
          isRevealed={true}
        />
      );

      const cardEl = container.querySelector('[data-testid="card-black-9"]');
      expect(cardEl?.className).toContain('animate-card-flip');

      const shimmerEl = container.querySelector('[data-testid="card-shimmer"]');
      expect(shimmerEl).not.toBeNull();
    });

    it('相手の伏せカード（isOpen: false, isRevealed: false）の場合、animate-card-flip は適用されず card-shimmer も描画されない', () => {
      const { container } = render(
        <CardComponent
          card={hiddenCard}
          isOwner={false}
        />
      );

      const cardEl = container.querySelector('[data-testid="card-black-hidden"]');
      expect(cardEl?.className).not.toContain('animate-card-flip');

      const shimmerEl = container.querySelector('[data-testid="card-shimmer"]');
      expect(shimmerEl).toBeNull();
    });
  });

  describe('Issue #66: 新規挿入ハイライト (isNewlyInserted)', () => {
    const hiddenCard: PublicCard = {
      id: 'b-new',
      color: 'black',
      number: null,
      isOpen: false,
    };

    it('isNewlyInserted: true の場合、data-newly-inserted="true" と NEW! バッジが表示される', () => {
      const { container } = render(
        <CardComponent
          card={hiddenCard}
          isOwner={false}
          isNewlyInserted={true}
        />
      );

      const cardEl = container.querySelector('[data-testid="card-black-hidden"]');
      expect(cardEl).not.toBeNull();
      expect(cardEl?.getAttribute('data-newly-inserted')).toBe('true');
      expect(cardEl?.className).toContain('ring-amber-400');
      expect(cardEl?.getAttribute('aria-label')).toContain('[新規挿入]');

      const newBadge = container.querySelector('[data-testid="newly-inserted-badge"]');
      expect(newBadge).not.toBeNull();
      expect(newBadge?.textContent).toBe('NEW!');
    });

    it('isNewlyInserted: false または未指定の場合、NEW! バッジは表示されない', () => {
      const { container } = render(
        <CardComponent
          card={hiddenCard}
          isOwner={false}
          isNewlyInserted={false}
        />
      );

      const cardEl = container.querySelector('[data-testid="card-black-hidden"]');
      expect(cardEl?.getAttribute('data-newly-inserted')).toBeNull();
      expect(container.querySelector('[data-testid="newly-inserted-badge"]')).toBeNull();
      expect(cardEl?.getAttribute('aria-label')).not.toContain('[新規挿入]');
    });
  });
});
