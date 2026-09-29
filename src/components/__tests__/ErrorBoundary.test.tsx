import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorBoundary, GameErrorBoundary } from '../ErrorBoundary';
import { clearAuditLogs, getAuditLogs } from '../../lib/auditLogger';

describe('ErrorBoundary (React エラーバウンダリ & クラッシュリカバリ基盤)', () => {
  let localStorageStore: Record<string, string> = {};
  let sessionStorageStore: Record<string, string> = {};
  let reloadMock = vi.fn();
  let mockLocation = { href: 'http://localhost:3000/game', reload: reloadMock };

  beforeEach(() => {
    clearAuditLogs();
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    localStorageStore = {};
    sessionStorageStore = {};
    reloadMock = vi.fn();
    mockLocation = {
      href: 'http://localhost:3000/game',
      reload: reloadMock,
    };

    const mockLocalStorage = {
      getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageStore[key];
      }),
      clear: vi.fn(() => {
        localStorageStore = {};
      }),
    };

    const mockSessionStorage = {
      getItem: vi.fn((key: string) => sessionStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        sessionStorageStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete sessionStorageStore[key];
      }),
      clear: vi.fn(() => {
        sessionStorageStore = {};
      }),
    };

    const mockWindow = {
      location: mockLocation,
      localStorage: mockLocalStorage,
      sessionStorage: mockSessionStorage,
    };

    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('sessionStorage', mockSessionStorage);
  });

  afterEach(() => {
    clearAuditLogs();
    vi.unstubAllGlobals();
  });

  describe('正常系のレンダリング', () => {
    it('エラーが発生しない場合、子コンポーネントが正常に描画されること', () => {
      const boundary = new ErrorBoundary({
        children: <div id="game-canvas">Algo Game Running</div>,
      });

      const rendered = boundary.render();
      const html = renderToString(rendered);

      expect(html).toContain('id="game-canvas"');
      expect(html).toContain('Algo Game Running');
      expect(html).not.toContain('予期せぬエラーが発生しました');
    });
  });

  describe('getDerivedStateFromError', () => {
    it('例外オブジェクトを受け取った際に hasError: true と error を返すこと', () => {
      const testError = new Error('テスト用致命的エラー');
      const state = ErrorBoundary.getDerivedStateFromError(testError);

      expect(state).toEqual({
        hasError: true,
        error: testError,
      });
    });
  });

  describe('componentDidCatch & クラッシュ監査ログ記録 (SLI-003)', () => {
    it('例外発生時に recordAuditEvent (CLIENT_CRASH) を記録すること', () => {
      const boundary = new ErrorBoundary({
        children: <div>Child</div>,
      });

      const testError = new Error('State Inconsistency Error');
      const errorInfo = { componentStack: '\n    at GameBoard\n    at ErrorBoundary' };

      boundary.componentDidCatch(testError, errorInfo);

      const logs = getAuditLogs();
      expect(logs).toHaveLength(1);

      const crashEvent = logs[0];
      expect(crashEvent.eventType).toBe('CLIENT_CRASH');
      expect(crashEvent.payload.name).toBe('Error');
      expect(crashEvent.payload.message).toBe('State Inconsistency Error');
      expect(crashEvent.payload.componentStack).toContain('GameBoard');
    });

    it('localStorage に algo_user_id が保存されている場合、その userId でクラッシュログを記録すること', () => {
      localStorageStore['algo_user_id'] = 'usr_test_player_789';

      const boundary = new ErrorBoundary({
        children: <div>Child</div>,
      });

      const testError = new Error('Memory allocation failure');
      boundary.componentDidCatch(testError, { componentStack: '' });

      const logs = getAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe('usr_test_player_789');
    });

    it('onError コールバックプロパティが渡された場合、エラーとスタック情報を引数に呼び出すこと', () => {
      const onErrorMock = vi.fn();
      const boundary = new ErrorBoundary({
        children: <div>Child</div>,
        onError: onErrorMock,
      });

      const testError = new Error('Custom handler error');
      const errorInfo = { componentStack: 'at Child' };

      boundary.componentDidCatch(testError, errorInfo);

      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock).toHaveBeenCalledWith(testError, errorInfo);
    });

    it('ログ記録処理で例外が発生した場合でもクラッシュせずフォールバック処理を継続できること', () => {
      const mockStorageWithError = {
        getItem: vi.fn(() => {
          throw new Error('Storage access denied');
        }),
      };
      vi.stubGlobal('localStorage', mockStorageWithError);

      const boundary = new ErrorBoundary({
        children: <div>Child</div>,
      });

      expect(() => {
        boundary.componentDidCatch(new Error('Storage failure test'), { componentStack: '' });
      }).not.toThrow();
    });
  });

  describe('フォールバックUIの描画 (北欧モダンデザイン & リカバリ操作)', () => {
    it('意図的に例外を送出する子コンポーネント配置時、エラー発生でフォールバックUIが描画されること', () => {
      const ThrowingChild: React.FC = () => {
        throw new Error('意図的に送出されたゲームエンジンクラッシュ');
      };

      const boundary = new ErrorBoundary({
        children: <ThrowingChild />,
      });

      // エラー発生シミュレーション
      const caughtError = new Error('意図的に送出されたゲームエンジンクラッシュ');
      const errorState = ErrorBoundary.getDerivedStateFromError(caughtError);
      boundary.state = {
        ...boundary.state,
        ...errorState,
        errorInfo: { componentStack: '\n    at ThrowingChild' },
      };

      const html = renderToString(boundary.render());

      // タイトルと説明文の検証
      expect(html).toContain('予期せぬエラーが発生しました');
      expect(html).toContain(
        'ゲームの処理中に問題が発生しました。以下のボタンから安全にリカバリできます。'
      );
      // 北欧モダンカードのスタイリング要素の存在確認
      expect(html).toContain('bg-algo-sand');
      expect(html).toContain('rounded-3xl');
      expect(html).toContain('システム保護');
    });

    it('「ページを再読み込み」ボタンと「ゲームを初期化して再開」ボタンが存在すること', () => {
      const boundary = new ErrorBoundary({
        children: <div>Child</div>,
      });

      boundary.state = {
        hasError: true,
        error: new Error('Critical UI Error'),
        errorInfo: null,
        showDetails: false,
      };

      const html = renderToString(boundary.render());

      // リカバリボタンの文言を検証
      expect(html).toContain('ページを再読み込み');
      expect(html).toContain('ゲームを初期化して再開');
      expect(html).toContain('エラー詳細を表示');
    });

    it('「エラー詳細を表示」がトグルされた際にエラーメッセージとスタックが表示されること', () => {
      const testError = new Error('カード枚数不整合例外: Expected 24 cards, found 23');
      testError.stack = 'Error: カード枚数不整合例外\n    at checkIntegrity (algoEngine.ts:120)';

      const boundary = new ErrorBoundary({
        children: <div>Child</div>,
      });

      boundary.state = {
        hasError: true,
        error: testError,
        errorInfo: { componentStack: '\n    at GameBoard (GameBoard.tsx:50)' },
        showDetails: true, // 詳細表示 ON
      };

      const html = renderToString(boundary.render());

      expect(html).toContain('エラー詳細を非表示');
      expect(html).toContain('カード枚数不整合例外: Expected 24 cards, found 23');
      expect(html).toContain('checkIntegrity');
      expect(html).toContain('Component Stack:');
      expect(html).toContain('GameBoard.tsx');
    });
  });

  describe('リカバリアクション & 状態遷移', () => {
    it('handleReload 呼び出し時に window.location.reload が実行されること', () => {
      const boundary = new ErrorBoundary({ children: <div>Child</div> });
      boundary.handleReload();

      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it('handleResetGame 呼び出し時に localStorage/sessionStorage がクリアされルートへリダイレクトされること', () => {
      localStorageStore['key1'] = 'val1';
      sessionStorageStore['key2'] = 'val2';

      const boundary = new ErrorBoundary({ children: <div>Child</div> });
      boundary.handleResetGame();

      expect(localStorageStore).toEqual({});
      expect(sessionStorageStore).toEqual({});
      expect(mockLocation.href).toBe('/');
    });

    it('toggleDetails メソッドで showDetails フラグがトグルされること', () => {
      const boundary = new ErrorBoundary({ children: <div>Child</div> });
      boundary.setState = (updater) => {
        const nextState = typeof updater === 'function' ? updater(boundary.state, boundary.props) : updater;
        boundary.state = { ...boundary.state, ...nextState };
      };

      expect(boundary.state.showDetails).toBe(false);

      boundary.toggleDetails();
      expect(boundary.state.showDetails).toBe(true);

      boundary.toggleDetails();
      expect(boundary.state.showDetails).toBe(false);
    });

    it('resetErrorBoundary メソッドでエラー状態が初期化されること', () => {
      const boundary = new ErrorBoundary({ children: <div>Child</div> });
      boundary.setState = (updater) => {
        const nextState = typeof updater === 'function' ? updater(boundary.state, boundary.props) : updater;
        boundary.state = { ...boundary.state, ...nextState };
      };

      boundary.state = {
        hasError: true,
        error: new Error('Temp error'),
        errorInfo: { componentStack: 'stack' },
        showDetails: true,
      };

      boundary.resetErrorBoundary();

      expect(boundary.state).toEqual({
        hasError: false,
        error: null,
        errorInfo: null,
        showDetails: false,
      });
    });
  });

  describe('カスタム fallback プロパティのサポート', () => {
    it('ReactNode のカスタム fallback が指定された場合、それが優先して描画されること', () => {
      const boundary = new ErrorBoundary({
        children: <div>Child</div>,
        fallback: <div id="custom-fallback">Custom Crash View</div>,
      });

      boundary.state = {
        hasError: true,
        error: new Error('Crash'),
        errorInfo: null,
        showDetails: false,
      };

      const html = renderToString(boundary.render());
      expect(html).toContain('id="custom-fallback"');
      expect(html).toContain('Custom Crash View');
      expect(html).not.toContain('予期せぬエラーが発生しました');
    });

    it('関数のカスタム fallback が指定された場合、error と reset 関数が渡されて描画されること', () => {
      const fallbackFn = vi.fn((err: Error, reset: () => void) => (
        <div>
          <span>Error: {err.message}</span>
          <button onClick={reset}>Reset</button>
        </div>
      ));

      const boundary = new ErrorBoundary({
        children: <div>Child</div>,
        fallback: fallbackFn,
      });

      const err = new Error('Function fallback error');
      boundary.state = {
        hasError: true,
        error: err,
        errorInfo: null,
        showDetails: false,
      };

      const html = renderToString(boundary.render());
      expect(fallbackFn).toHaveBeenCalledWith(err, boundary.resetErrorBoundary);
      expect(html).toContain('Function fallback error');
      expect(html).toContain('Reset');
    });
  });

  describe('GameErrorBoundary エイリアス', () => {
    it('GameErrorBoundary が ErrorBoundary と同一のクラスであること', () => {
      expect(GameErrorBoundary).toBe(ErrorBoundary);
    });
  });
});
