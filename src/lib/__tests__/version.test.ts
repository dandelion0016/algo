import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAppVersion } from '../version';
import packageInfo from '../../../package.json';

describe('getAppVersion', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('環境変数 NEXT_PUBLIC_APP_VERSION が設定されている場合はその値を返すこと', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = 'v1.2.3';
    expect(getAppVersion()).toBe('v1.2.3');
  });

  it('環境変数 NEXT_PUBLIC_APP_VERSION が未定義の場合は package.json の version (vプレフィックス付き) を返すこと', () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    expect(getAppVersion()).toBe(`v${packageInfo.version}`);
  });

  it('環境変数 NEXT_PUBLIC_APP_VERSION が空文字の場合は package.json の version を返すこと', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '   ';
    expect(getAppVersion()).toBe(`v${packageInfo.version}`);
  });

  it('package.json のバージョンに基づくデフォルト値がセマンティックバージョニング形式（vX.Y.Z）であること', () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    const version = getAppVersion();
    expect(version).toMatch(/^v\d+\.\d+\.\d+/);
  });
});
