'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { recordAuditEvent } from '../lib/auditLogger';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

/**
 * React ErrorBoundary Component
 *
 * Catches unhandled runtime exceptions in the component tree, preventing whiteouts.
 * Renders a Scandinavian modern fallback recovery UI and sends client crash audit logs (SLI-003).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // SRE / Quality: Record client crash event for SLI-003 monitoring
    try {
      let userId = 'usr_client';
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const storedUser =
          localStorage.getItem('algo_user_id') || localStorage.getItem('algo_session_id');
        if (storedUser) {
          userId = storedUser;
        }
      }

      recordAuditEvent('CLIENT_CRASH', userId, {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
      });
    } catch (loggingError) {
      console.error('[ErrorBoundary] Failed to record audit log for client crash:', loggingError);
    }

    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleResetGame = (): void => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (storageError) {
        console.warn('[ErrorBoundary] Failed to clear local storage:', storageError);
      }
      window.location.href = '/';
    }
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(
          this.state.error ?? new Error('Unknown error'),
          this.resetErrorBoundary
        );
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || '予期せぬエラーが発生しました。';
      const errorStack = this.state.error?.stack || '';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className="min-h-screen bg-algo-sand flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Nordic Accent Header */}
            <div className="bg-gradient-to-r from-algo-yellow-light via-algo-blue-light to-white p-6 border-b border-slate-100 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shadow-sm shrink-0">
                <AlertTriangle className="w-7 h-7 text-amber-500" />
              </div>
              <div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                  システム保護
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                  予期せぬエラーが発生しました
                </h1>
              </div>
            </div>

            {/* Description and Content */}
            <div className="p-6 sm:p-7 space-y-6">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                ゲームの処理中に問題が発生しました。以下のボタンから安全にリカバリできます。
              </p>

              {/* Recovery Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="flex-1 py-3 px-4 rounded-2xl bg-algo-blue hover:bg-algo-blue-dark active:scale-[0.98] text-white font-bold text-sm shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>ページを再読み込み</span>
                </button>
                <button
                  type="button"
                  onClick={this.handleResetGame}
                  className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>ゲームを初期化して再開</span>
                </button>
              </div>

              {/* Error Details Accordion */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 font-semibold transition-colors cursor-pointer py-1"
                >
                  <span>{this.state.showDetails ? 'エラー詳細を非表示' : 'エラー詳細を表示'}</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {this.state.showDetails && (
                  <div className="mt-3 p-4 bg-slate-900 text-slate-200 rounded-2xl text-xs overflow-x-auto whitespace-pre-wrap font-mono border border-slate-800 max-h-56">
                    <div className="text-rose-400 font-bold mb-2 pb-1 border-b border-slate-800">
                      {errorMessage}
                    </div>
                    {errorStack && (
                      <div className="text-slate-400 text-[11px] leading-relaxed">
                        {errorStack}
                      </div>
                    )}
                    {componentStack && (
                      <div className="text-slate-500 text-[10px] mt-2 pt-2 border-t border-slate-800">
                        <div className="text-slate-400 font-semibold mb-1">Component Stack:</div>
                        {componentStack}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Alias for design document compatibility (GameErrorBoundary)
export const GameErrorBoundary = ErrorBoundary;

export default ErrorBoundary;
