import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAppVersion } from '../version';

describe('getAppVersion', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns NEXT_PUBLIC_APP_VERSION if set', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = 'v1.2.3';
    expect(getAppVersion()).toBe('v1.2.3');
  });

  it('returns default version if env var is not set', () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    expect(getAppVersion()).toBe('v0.0.0-dev');
  });
});
