import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_ADSENSE_CLIENT_ID, getAdSenseConfig, isValidAdSenseClientId } from '../adsense';

describe('adsense library', () => {
  const originalClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const originalSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_SETUP;

  afterEach(() => {
    if (originalClientId === undefined) {
      delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
    } else {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = originalClientId;
    }
    if (originalSlot === undefined) {
      delete process.env.NEXT_PUBLIC_ADSENSE_SLOT_SETUP;
    } else {
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_SETUP = originalSlot;
    }
  });

  describe('DEFAULT_ADSENSE_CLIENT_ID', () => {
    it('正式なパブリッシャーID ca-pub-3337160908225388 が定義されている', () => {
      expect(DEFAULT_ADSENSE_CLIENT_ID).toBe('ca-pub-3337160908225388');
      expect(isValidAdSenseClientId(DEFAULT_ADSENSE_CLIENT_ID)).toBe(true);
    });
  });

  describe('isValidAdSenseClientId', () => {
    it('正しい ca-pub-xxxxxxxxxxxxxxxx 形式のIDを true と判定する', () => {
      expect(isValidAdSenseClientId('ca-pub-1234567890123456')).toBe(true);
      expect(isValidAdSenseClientId('  ca-pub-9876543210987654  ')).toBe(true);
      expect(isValidAdSenseClientId('ca-pub-3337160908225388')).toBe(true);
    });

    it('未設定・空文字・不正なプレフィックスや桁数のIDを false と判定する', () => {
      expect(isValidAdSenseClientId()).toBe(false);
      expect(isValidAdSenseClientId('')).toBe(false);
      expect(isValidAdSenseClientId('pub-1234567890123456')).toBe(false);
      expect(isValidAdSenseClientId('ca-pub-12345')).toBe(false);
      expect(isValidAdSenseClientId('ca-pub-1234567890123456-extra')).toBe(false);
    });
  });

  describe('getAdSenseConfig', () => {
    it('クライアントID未設定・空文字時は DEFAULT_ADSENSE_CLIENT_ID にフォールバックし enabled: true を返す', () => {
      delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
      delete process.env.NEXT_PUBLIC_ADSENSE_SLOT_SETUP;

      const configDefault = getAdSenseConfig();
      expect(configDefault).toEqual({
        clientId: 'ca-pub-3337160908225388',
        slotSetup: '',
        enabled: true,
        scriptSrc:
          'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3337160908225388',
      });

      const configEmptyEnv = getAdSenseConfig({ clientId: '' });
      expect(configEmptyEnv).toEqual({
        clientId: 'ca-pub-3337160908225388',
        slotSetup: '',
        enabled: true,
        scriptSrc:
          'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3337160908225388',
      });
    });

    it('不正な形式のクライアントIDが明示指定された場合は enabled: false かつ scriptSrc: null を返す', () => {
      const configInvalid = getAdSenseConfig({ clientId: 'invalid-client-id' });
      expect(configInvalid).toEqual({
        clientId: '',
        slotSetup: '',
        enabled: false,
        scriptSrc: null,
      });
    });

    it('有効なクライアントIDとスロットが指定された場合はその値で enabled: true と scriptSrc を返す', () => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-1122334455667788';
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_SETUP = '9988776655';

      const config = getAdSenseConfig();
      expect(config).toEqual({
        clientId: 'ca-pub-1122334455667788',
        slotSetup: '9988776655',
        enabled: true,
        scriptSrc:
          'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1122334455667788',
      });
    });
  });
});
