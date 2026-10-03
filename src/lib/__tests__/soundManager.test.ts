import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { soundManager, SOUND_STORAGE_KEY } from '../soundManager';

describe('SoundManager', () => {
  let mockAudioContext: any;
  let mockOscillator: any;
  let mockGain: any;
  let mockBufferSource: any;
  let mockBiquadFilter: any;

  beforeEach(() => {
    localStorage.clear();
    soundManager.resetContextForTesting();
    soundManager.setSoundEnabled(true);

    mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    mockBufferSource = {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    mockBiquadFilter = {
      type: 'bandpass',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      Q: {
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    mockAudioContext = {
      state: 'running',
      currentTime: 10,
      sampleRate: 44100,
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      createOscillator: vi.fn(() => ({ ...mockOscillator })),
      createGain: vi.fn(() => ({ ...mockGain })),
      createBufferSource: vi.fn(() => ({ ...mockBufferSource })),
      createBiquadFilter: vi.fn(() => ({ ...mockBiquadFilter })),
      createBuffer: vi.fn(() => ({
        sampleRate: 44100,
        getChannelData: vi.fn(() => new Float32Array(100)),
      })),
    };

    (window as any).AudioContext = vi.fn(() => mockAudioContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('初期状態ではサウンドが有効（true）であること', () => {
    expect(soundManager.isSoundEnabled()).toBe(true);
  });

  it('setSoundEnabled で状態を変更でき、localStorage に永続化されること', () => {
    soundManager.setSoundEnabled(false);
    expect(soundManager.isSoundEnabled()).toBe(false);
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('false');

    soundManager.setSoundEnabled(true);
    expect(soundManager.isSoundEnabled()).toBe(true);
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('true');
  });

  it('toggleSound で状態が正しく反転すること', () => {
    soundManager.setSoundEnabled(true);
    const result1 = soundManager.toggleSound();
    expect(result1).toBe(false);
    expect(soundManager.isSoundEnabled()).toBe(false);

    const result2 = soundManager.toggleSound();
    expect(result2).toBe(true);
    expect(soundManager.isSoundEnabled()).toBe(true);
  });

  it('subscribe で状態変更通知が届くこと', () => {
    const listener = vi.fn();
    const unsubscribe = soundManager.subscribe(listener);

    soundManager.setSoundEnabled(false);
    expect(listener).toHaveBeenCalledWith(false);

    soundManager.setSoundEnabled(true);
    expect(listener).toHaveBeenCalledWith(true);

    unsubscribe();
    soundManager.setSoundEnabled(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('playDrawSound がエラーなく実行され、ノイズバッファまたはオシレーターが起動すること', () => {
    soundManager.playDrawSound();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
  });

  it('playAttackSound がオシレーターとゲインを接続して再生すること', () => {
    soundManager.playAttackSound();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
  });

  it('playHitSound がメジャーコードのアルペジオを再生すること', () => {
    soundManager.playHitSound();
    // 4音のアルペジオ
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(4);
    expect(mockAudioContext.createGain).toHaveBeenCalledTimes(4);
  });

  it('playMissSound がペナルティビープを再生すること', () => {
    soundManager.playMissSound();
    // 2連発ビープ
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);
    expect(mockAudioContext.createGain).toHaveBeenCalledTimes(2);
  });

  it('playTimeWarningSound が警告パルス音を再生すること', () => {
    soundManager.playTimeWarningSound();
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);
    expect(mockAudioContext.createGain).toHaveBeenCalledTimes(1);
  });

  it('playVictorySound が勝利ファンファーレを再生すること', () => {
    soundManager.playVictorySound();
    // 4音アルペジオ + 3和音コード = 7音
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(7);
  });

  it('playDefeatSound が敗北トーンを再生すること', () => {
    soundManager.playDefeatSound();
    // 下降4音
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(4);
  });

  it('ミュート（soundEnabled === false）時は各サウンドが再生されないこと', () => {
    soundManager.setSoundEnabled(false);

    soundManager.playDrawSound();
    soundManager.playAttackSound();
    soundManager.playHitSound();
    soundManager.playMissSound();
    soundManager.playTimeWarningSound();
    soundManager.playVictorySound();
    soundManager.playDefeatSound();

    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    expect(mockAudioContext.createGain).not.toHaveBeenCalled();
  });

  it('AudioContext が suspended の場合に unlockAudio で resume されること', async () => {
    mockAudioContext.state = 'suspended';
    await soundManager.unlockAudio();
    expect(mockAudioContext.resume).toHaveBeenCalled();
  });

  it('AudioContext 非対応またはエラー時もクラッシュせず安全にフォールバックすること', () => {
    delete (window as any).AudioContext;
    delete (window as any).webkitAudioContext;

    expect(() => {
      soundManager.playDrawSound();
      soundManager.playAttackSound();
      soundManager.playHitSound();
      soundManager.playMissSound();
      soundManager.playTimeWarningSound();
      soundManager.playVictorySound();
      soundManager.playDefeatSound();
    }).not.toThrow();
  });
});
