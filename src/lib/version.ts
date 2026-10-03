import packageInfo from '../../package.json';

/**
 * アプリケーションのバージョン番号を取得
 * 1. 環境変数 NEXT_PUBLIC_APP_VERSION (CI/CDビルド時に注入)
 * 2. package.json の version (プレフィックス 'v' を付与)
 * 3. フォールバック ('v0.1.0')
 */
export function getAppVersion(): string {
  if (process.env.NEXT_PUBLIC_APP_VERSION && process.env.NEXT_PUBLIC_APP_VERSION.trim() !== '') {
    return process.env.NEXT_PUBLIC_APP_VERSION;
  }
  if (packageInfo && typeof packageInfo.version === 'string' && packageInfo.version.trim() !== '') {
    return `v${packageInfo.version}`;
  }
  return 'v0.1.0';
}
