import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ConfirmModal, ConfirmModalProps } from '../ConfirmModal';

describe('ConfirmModal Component (SCR-008: HITL確認モーダル)', () => {
  const defaultProps: ConfirmModalProps = {
    isOpen: true,
    actionType: 'RESTART',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  describe('表示・非表示の制御 (Visibility)', () => {
    it('isOpenがfalseの場合は何もレンダリングされない', () => {
      const html = renderToString(<ConfirmModal {...defaultProps} isOpen={false} />);
      expect(html).toBe('');
    });

    it('isOpenがtrueの場合はモーダル本体がレンダリングされる', () => {
      const html = renderToString(<ConfirmModal {...defaultProps} isOpen={true} />);
      expect(html).toContain('data-testid="modal-confirm"');
      expect(html).toContain('backdrop-blur-sm');
      expect(html).toContain('現在ゲームが進行中です！');
    });
  });

  describe('RESTART アクション時のデフォルト表示', () => {
    it('再戦時のデフォルトタイトル、メッセージ、承認ラベルが正しく表示される', () => {
      const html = renderToString(<ConfirmModal {...defaultProps} actionType="RESTART" />);

      expect(html).toContain('対戦の中断・再戦の確認');
      expect(html).toContain('現在の対戦状況は破棄されます。同じ設定で最初からやり直しますか？');
      expect(html).toContain('対戦を破棄して再戦');
      expect(html).toContain('ゲームに戻る (キャンセル)');
      // 破壊的スタイルのクラス（bg-rose-600）が含まれる
      expect(html).toContain('bg-rose-600');
    });
  });

  describe('SETUP アクション時のデフォルト表示', () => {
    it('設定戻り時のデフォルトタイトル、メッセージ、承認ラベルが正しく表示される', () => {
      const html = renderToString(<ConfirmModal {...defaultProps} actionType="SETUP" />);

      expect(html).toContain('対戦の中断・設定変更の確認');
      expect(html).toContain('現在の対戦状況は破棄されます。人数や難易度の設定画面に戻りますか？');
      expect(html).toContain('対戦を終了して設定へ');
      expect(html).toContain('ゲームに戻る (キャンセル)');
      // 非破壊的（Navy/Slate-900）スタイルのクラスが含まれる
      expect(html).toContain('bg-slate-900');
    });
  });

  describe('CUSTOM アクションおよびカスタムProps指定', () => {
    it('カスタムのタイトル・メッセージ・ラベルが優先してレンダリングされる', () => {
      const html = renderToString(
        <ConfirmModal
          {...defaultProps}
          actionType="CUSTOM"
          title="カスタムタイトル"
          message="カスタムメッセージです。"
          confirmLabel="今すぐ実行"
          cancelLabel="やめる"
        />
      );

      expect(html).toContain('カスタムタイトル');
      expect(html).toContain('カスタムメッセージです。');
      expect(html).toContain('今すぐ実行');
      expect(html).toContain('やめる');
    });

    it('isDestructiveフラグの明示指定によりボタンスタイルが切り替わる', () => {
      // SETUPだがisDestructive=trueを指定
      const htmlDestructive = renderToString(
        <ConfirmModal {...defaultProps} actionType="SETUP" isDestructive={true} />
      );
      expect(htmlDestructive).toContain('bg-rose-600');

      // RESTARTだがisDestructive=falseを指定
      const htmlNonDestructive = renderToString(
        <ConfirmModal {...defaultProps} actionType="RESTART" isDestructive={false} />
      );
      expect(htmlNonDestructive).toContain('bg-slate-900');
    });
  });

  describe('対戦ステータス表示 (gameStatus)', () => {
    it('gameStatusが渡された場合は対戦形式・残り伏せカード・経過ログ数が表示される', () => {
      const gameStatus = {
        playerCount: 2,
        difficulty: 'normal',
        remainingHiddenCards: 3,
        logCount: 6,
      };

      const html = renderToString(
        <ConfirmModal {...defaultProps} gameStatus={gameStatus} />
      );

      expect(html).toContain('data-testid="confirm-modal-status"');
      expect(html).toContain('現在の対戦ステータス');
      expect(html).toContain('2人 (CPU:中級)');
      expect(html).toContain('3枚');
      expect(html).toContain('6手番');
    });

    it('gameStatusが渡されない場合はステータスエリアが表示されない', () => {
      const html = renderToString(<ConfirmModal {...defaultProps} gameStatus={undefined} />);
      expect(html).not.toContain('data-testid="confirm-modal-status"');
      expect(html).not.toContain('現在の対戦ステータス');
    });

    it('難易度表記が正しくフォーマットされる (easy -> 初級, hard -> 上級)', () => {
      const htmlEasy = renderToString(
        <ConfirmModal
          {...defaultProps}
          gameStatus={{
            playerCount: 3,
            difficulty: 'easy',
            remainingHiddenCards: 1,
            logCount: 12,
          }}
        />
      );
      expect(htmlEasy).toContain('3人 (CPU:初級)');

      const htmlHard = renderToString(
        <ConfirmModal
          {...defaultProps}
          gameStatus={{
            playerCount: 4,
            difficulty: 'hard',
            remainingHiddenCards: 2,
            logCount: 20,
          }}
        />
      );
      expect(htmlHard).toContain('4人 (CPU:上級)');
    });
  });

  describe('data-testid および UIアクセシビリティ属性', () => {
    it('必須のdata-testid属性がすべて付与されている', () => {
      const html = renderToString(<ConfirmModal {...defaultProps} />);

      expect(html).toContain('data-testid="modal-confirm"');
      expect(html).toContain('data-testid="btn-confirm-action"');
      expect(html).toContain('data-testid="btn-cancel-action"');
      expect(html).toContain('data-testid="btn-close-modal"');
      expect(html).toContain('data-confirm-reset-btn="true"');
    });
  });

  describe('コールバック関数 (onConfirm / onCancel) の動作検証', () => {
    it('ConfirmModalコンポーネントツリー内の各ボタンにonConfirm/onCancelが正しく設定されている', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      const element = ConfirmModal({
        ...defaultProps,
        onConfirm,
        onCancel,
      });

      // ルートオーバーレイのクリックでonCancelが発火
      expect(element).not.toBeNull();
      if (!element || !React.isValidElement(element)) return;

      const elementProps = element.props as any;
      expect(elementProps.onClick).toBe(onCancel);
      elementProps.onClick();
      expect(onCancel).toHaveBeenCalledTimes(1);

      // モーダル本体のstopPropagation確認
      const modalBox = elementProps.children as any;
      const stopPropagationMock = vi.fn();
      modalBox.props.onClick({ stopPropagation: stopPropagationMock });
      expect(stopPropagationMock).toHaveBeenCalledTimes(1);

      // モーダルコンテンツ内の要素探索
      const content = modalBox.props.children[1]; // [ヘッダーバー, p-5 sm:p-6コンテナ]
      const [header, , , actions] = content.props.children;

      // 閉じるボタン (btn-close-modal)
      const closeBtn = header.props.children[1];
      expect(closeBtn.props['data-testid']).toBe('btn-close-modal');
      closeBtn.props.onClick();
      expect(onCancel).toHaveBeenCalledTimes(2);

      // キャンセルボタン (btn-cancel-action)
      const cancelBtn = actions.props.children[0];
      expect(cancelBtn.props['data-testid']).toBe('btn-cancel-action');
      cancelBtn.props.onClick();
      expect(onCancel).toHaveBeenCalledTimes(3);

      // 承認ボタン (btn-confirm-action)
      const confirmBtn = actions.props.children[1];
      expect(confirmBtn.props['data-testid']).toBe('btn-confirm-action');
      confirmBtn.props.onClick();
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
