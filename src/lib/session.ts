export const USER_ID_COOKIE_NAME = 'algo_user_id';
export const USER_ID_STORAGE_KEY = 'algo_user_id';
export const USER_ID_COOKIE_MAX_AGE = 31536000; // 1 year (365 days)

export interface UserSession {
  userId: string;
  isNew: boolean;
}

/**
 * プレフィックス 'usr_' + 8文字のランダム小文字英数字 [a-z0-9] を生成
 * 例: usr_a1b2c3d4
 */
export function generateUserId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 8; i++) {
      randomPart += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 8; i++) {
      randomPart += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return `usr_${randomPart}`;
}

/**
 * Cookie文字列から指定した名前のCookie値を取得
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(`${name}=`)) {
      const value = trimmed.slice(name.length + 1);
      return value ? decodeURIComponent(value) : null;
    }
  }
  return null;
}

/**
 * Cookieに値を保存
 */
function setCookie(name: string, value: string, maxAge: number = USER_ID_COOKIE_MAX_AGE): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * localStorageから値を取得
 */
function getStorage(key: string): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * localStorageに値を保存
 */
function setStorage(key: string, value: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or access denial errors
  }
}

/**
 * ユーザーセッションを取得または新規発行
 * Cookie -> localStorage の順で確認し、存在しない場合は新規生成
 * 取得/生成されたIDはCookieおよびlocalStorageの両方に同期保存される
 */
export function getUserSession(): UserSession {
  if (typeof document === 'undefined') {
    // SSR / サーバー環境フォールバック
    return {
      userId: generateUserId(),
      isNew: true,
    };
  }

  // 1. document.cookie から algo_user_id を取得
  let userId = getCookie(USER_ID_COOKIE_NAME);

  // 2. Cookieになければ localStorage をチェック
  if (!userId) {
    userId = getStorage(USER_ID_STORAGE_KEY);
  }

  // 3. 既存のIDが見つかった場合
  if (userId) {
    // 同期を維持するために双方に保存
    setCookie(USER_ID_COOKIE_NAME, userId);
    setStorage(USER_ID_STORAGE_KEY, userId);
    return {
      userId,
      isNew: false,
    };
  }

  // 4. 存在しない場合は新規発行
  const newUserId = generateUserId();
  setCookie(USER_ID_COOKIE_NAME, newUserId);
  setStorage(USER_ID_STORAGE_KEY, newUserId);

  return {
    userId: newUserId,
    isNew: true,
  };
}

/**
 * ユーザーIDを取得または新規発行
 */
export function getOrCreateUserId(): string {
  return getUserSession().userId;
}
