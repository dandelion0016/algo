import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateUserId,
  getUserSession,
  getOrCreateUserId,
  USER_ID_COOKIE_NAME,
  USER_ID_STORAGE_KEY,
  USER_ID_COOKIE_MAX_AGE,
} from '../session';

describe('session utility', () => {
  describe('generateUserId', () => {
    it('generates ID matching ^usr_[a-z0-9]{8}$', () => {
      const id = generateUserId();
      expect(id).toMatch(/^usr_[a-z0-9]{8}$/);
      expect(id.length).toBe(12);
    });

    it('generates unique IDs across 500 consecutive calls', () => {
      const ids = new Set<string>();
      const iterations = 500;
      for (let i = 0; i < iterations; i++) {
        ids.add(generateUserId());
      }
      expect(ids.size).toBe(iterations);
    });

    it('works when crypto.getRandomValues is not available (fallback)', () => {
      const originalCrypto = globalThis.crypto;
      // @ts-expect-error Mocking crypto environment
      delete globalThis.crypto;

      const fallbackId = generateUserId();
      expect(fallbackId).toMatch(/^usr_[a-z0-9]{8}$/);

      // Restore crypto
      globalThis.crypto = originalCrypto;
    });
  });

  describe('getUserSession & getOrCreateUserId in browser-like environment', () => {
    let mockCookies: string[] = [];
    let localStorageStore: Record<string, string> = {};

    beforeEach(() => {
      mockCookies = [];
      localStorageStore = {};

      // Mock document and document.cookie
      const mockDocument = {
        get cookie() {
          return mockCookies.join('; ');
        },
        set cookie(val: string) {
          mockCookies.push(val);
        },
      };

      // Mock localStorage
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

      vi.stubGlobal('document', mockDocument);
      vi.stubGlobal('localStorage', mockLocalStorage);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('generates new userId and persists to cookie and localStorage when neither exists', () => {
      const session = getUserSession();

      expect(session.isNew).toBe(true);
      expect(session.userId).toMatch(/^usr_[a-z0-9]{8}$/);

      // Cookie check
      const setCookieCalls = mockCookies;
      expect(setCookieCalls.length).toBeGreaterThan(0);
      const lastCookie = setCookieCalls[setCookieCalls.length - 1];
      expect(lastCookie).toContain(`${USER_ID_COOKIE_NAME}=${session.userId}`);
      expect(lastCookie).toContain('path=/');
      expect(lastCookie).toContain(`max-age=${USER_ID_COOKIE_MAX_AGE}`);
      expect(lastCookie).toContain('SameSite=Lax');

      // LocalStorage check
      expect(localStorageStore[USER_ID_STORAGE_KEY]).toBe(session.userId);
    });

    it('reads existing userId from cookie and syncs to localStorage', () => {
      const existingId = 'usr_abc12345';
      mockCookies.push(`${USER_ID_COOKIE_NAME}=${existingId}`);

      const session = getUserSession();

      expect(session.isNew).toBe(false);
      expect(session.userId).toBe(existingId);
      expect(localStorageStore[USER_ID_STORAGE_KEY]).toBe(existingId);
    });

    it('reads from multiple cookies correctly', () => {
      const existingId = 'usr_multi999';
      mockCookies.push('other_key=hello');
      mockCookies.push(`${USER_ID_COOKIE_NAME}=${existingId}`);
      mockCookies.push('session_token=xyz');

      const session = getUserSession();

      expect(session.isNew).toBe(false);
      expect(session.userId).toBe(existingId);
    });

    it('restores userId from localStorage if cookie is missing and syncs to cookie', () => {
      const storedId = 'usr_stored77';
      localStorageStore[USER_ID_STORAGE_KEY] = storedId;

      const session = getUserSession();

      expect(session.isNew).toBe(false);
      expect(session.userId).toBe(storedId);

      // Cookie should be restored
      const lastCookie = mockCookies[mockCookies.length - 1];
      expect(lastCookie).toContain(`${USER_ID_COOKIE_NAME}=${storedId}`);
    });

    it('returns the same userId consistently on subsequent calls (idempotent)', () => {
      const firstSession = getUserSession();
      expect(firstSession.isNew).toBe(true);

      const secondSession = getUserSession();
      expect(secondSession.isNew).toBe(false);
      expect(secondSession.userId).toBe(firstSession.userId);

      const userIdOnly = getOrCreateUserId();
      expect(userIdOnly).toBe(firstSession.userId);
    });

    it('gracefully handles localStorage exceptions (e.g. quota exceeded / security errors)', () => {
      const throwingLocalStorage = {
        getItem: vi.fn(() => {
          throw new Error('Access denied');
        }),
        setItem: vi.fn(() => {
          throw new Error('Quota exceeded');
        }),
      };
      vi.stubGlobal('localStorage', throwingLocalStorage);

      // Should not throw
      const session = getUserSession();
      expect(session.userId).toMatch(/^usr_[a-z0-9]{8}$/);
    });
  });

  describe('getUserSession in SSR environment (document undefined)', () => {
    it('returns a new generated userId without crashing when document is undefined', () => {
      // Vitest node environment has no document by default unless stubbed
      const session = getUserSession();
      expect(session.isNew).toBe(true);
      expect(session.userId).toMatch(/^usr_[a-z0-9]{8}$/);
    });
  });
});
