'use client';

import { useState, useEffect } from 'react';
import { getUserSession } from '../lib/session';

export interface UserSessionState {
  userId: string;
  isNew: boolean;
  isLoading: boolean;
}

/**
 * ゲストユーザーセッション管理用カスタムフック
 * クライアントサイドマウント時に Cookie / localStorage からセッションを取得または新規発行
 */
export function useUserSession(): UserSessionState {
  const [session, setSession] = useState<UserSessionState>({
    userId: '',
    isNew: false,
    isLoading: true,
  });

  useEffect(() => {
    const userSession = getUserSession();
    setSession({
      userId: userSession.userId,
      isNew: userSession.isNew,
      isLoading: false,
    });
  }, []);

  return session;
}
