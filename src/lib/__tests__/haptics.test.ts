import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  haptics,
  isHapticsSupported,
  vibrate,
  vibrateLight,
  vibrateSuccess,
  vibrateFailure,
  vibrateWarning,
} from '../haptics';

describe('haptics', () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('navigator.vibrate が存在する場合、isHapticsSupported は true を返すこと', () => {
    Object.defineProperty(global, 'navigator', {
      value: { vibrate: vi.fn().mockReturnValue(true) },
      writable: true,
      configurable: true,
    });

    expect(isHapticsSupported()).toBe(true);
    expect(haptics.isSupported()).toBe(true);
  });

  it('navigator.vibrate が存在しない場合、isHapticsSupported は false を返し vibrate は何もしないこと', () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });

    expect(isHapticsSupported()).toBe(false);
    expect(vibrate(15)).toBe(false);
  });

  it('vibrate が指定されたパターンで navigator.vibrate を呼び出すこと', () => {
    const mockVibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(global, 'navigator', {
      value: { vibrate: mockVibrate },
      writable: true,
      configurable: true,
    });

    const result = vibrate(50);
    expect(result).toBe(true);
    expect(mockVibrate).toHaveBeenCalledWith(50);
  });

  it('vibrateLight が軽い振動パターン（15ms）で呼び出されること', () => {
    const mockVibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(global, 'navigator', {
      value: { vibrate: mockVibrate },
      writable: true,
      configurable: true,
    });

    vibrateLight();
    expect(mockVibrate).toHaveBeenCalledWith(15);
  });

  it('vibrateSuccess が成功パターン [20, 50, 40] で呼び出されること', () => {
    const mockVibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(global, 'navigator', {
      value: { vibrate: mockVibrate },
      writable: true,
      configurable: true,
    });

    vibrateSuccess();
    expect(mockVibrate).toHaveBeenCalledWith([20, 50, 40]);
  });

  it('vibrateFailure が失敗パターン [60, 40, 60] で呼び出されること', () => {
    const mockVibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(global, 'navigator', {
      value: { vibrate: mockVibrate },
      writable: true,
      configurable: true,
    });

    vibrateFailure();
    expect(mockVibrate).toHaveBeenCalledWith([60, 40, 60]);
  });

  it('vibrateWarning が警告パターン 30 で呼び出されること', () => {
    const mockVibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(global, 'navigator', {
      value: { vibrate: mockVibrate },
      writable: true,
      configurable: true,
    });

    vibrateWarning();
    expect(mockVibrate).toHaveBeenCalledWith(30);
  });

  it('navigator.vibrate が例外をスローしても安全に false を返しクラッシュしないこと', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        vibrate: vi.fn(() => {
          throw new Error('NotAllowedError');
        }),
      },
      writable: true,
      configurable: true,
    });

    expect(() => vibrate(100)).not.toThrow();
    expect(vibrate(100)).toBe(false);
  });
});
