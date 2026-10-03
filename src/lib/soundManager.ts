/**
 * Web Audio API によるプログラマティック効果音（SE）マネージャー
 * 外部音声ファイルのダウンロードを行わず、OscillatorNode / GainNode / BiquadFilterNode 等を用いた
 * ゼロレイテンシかつ完全オフライン動作のシンセ合成音を提供します。
 */

export const SOUND_STORAGE_KEY = 'algo_sound_enabled';

type SoundChangeListener = (enabled: boolean) => void;

export class SoundManager {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private listeners: Set<SoundChangeListener> = new Set();
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    this.soundEnabled = this.loadInitialSoundState();
  }

  /**
   * テスト用: キャッシュされた AudioContext と状態をリセット
   */
  public resetContextForTesting(): void {
    this.audioCtx = null;
    this.noiseBuffer = null;
    this.listeners.clear();
  }

  /**
   * localStorage からサウンド有効状態を復元（SSRや例外時はデフォルト true）
   */
  private loadInitialSoundState(): boolean {
    if (typeof window === 'undefined') {
      return true;
    }
    try {
      const stored = localStorage.getItem(SOUND_STORAGE_KEY);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  }

  /**
   * サウンド有効状態の変更リスナー登録
   */
  public subscribe(listener: SoundChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.soundEnabled);
      } catch (err) {
        console.error('Error in sound listener callback', err);
      }
    });
  }

  /**
   * サウンドが有効かどうかを取得
   */
  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  /**
   * サウンド有効状態を設定
   */
  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
      } catch {
        // localStorage restricted fallback
      }
    }
    this.notifyListeners();
  }

  /**
   * サウンド有効状態を反転（トグル）
   */
  public toggleSound(): boolean {
    const next = !this.soundEnabled;
    this.setSoundEnabled(next);
    return next;
  }

  /**
   * AudioContext インスタンスの遅延取得（ブラウザ互換＆自動再生ポリシー対応）
   */
  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      if (!this.audioCtx) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }

      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {
          // ユーザーインタラクション前の resume はブラウザポリシーで保留される場合がある
        });
      }

      return this.audioCtx;
    } catch (e) {
      console.warn('AudioContext initialization failed', e);
      return null;
    }
  }

  /**
   * ユーザー操作イベント時に AudioContext を安全にアンロック
   */
  public async unlockAudio(): Promise<void> {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore resume failure
      }
    }
  }

  /**
   * カード擦れ音用のホワイトノイズバッファを取得/生成（0.15秒）
   */
  private getNoiseBuffer(ctx: AudioContext): AudioBuffer | null {
    try {
      if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
        return this.noiseBuffer;
      }
      const bufferSize = Math.floor(ctx.sampleRate * 0.15);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
      return buffer;
    } catch {
      return null;
    }
  }

  /**
   * 1. カードドロー音 (Draw)
   * ペーパースライド風ノイズ/短音（ホワイトノイズ + バンドパスフィルター + 短エンベロープ）
   */
  public playDrawSound(): void {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const noise = this.getNoiseBuffer(ctx);

      if (noise) {
        const source = ctx.createBufferSource();
        source.buffer = noise;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        filter.Q.setValueAtTime(2.0, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        source.start(now);
        source.stop(now + 0.12);
      } else {
        // フォールバック: 短いサイン波スイープ
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch (e) {
      console.warn('playDrawSound failed', e);
    }
  }

  /**
   * 2. アタック決定音 (Attack / Select)
   * 相手カードに数字を宣言した際の短いクリック・低音アタックトーン
   */
  public playAttackSound(): void {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.09);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {
      console.warn('playAttackSound failed', e);
    }
  }

  /**
   * 3. 推理的中音 (Hit / Critical)
   * 推理が当たった瞬間の爽快なベル・アルペジオ（明るいメジャーコード: C6 -> E6 -> G6 -> C7）
   */
  public playHitSound(): void {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // C6 (1046.5Hz), E6 (1318.5Hz), G6 (1568.0Hz), C7 (2093.0Hz)
      const notes = [1046.5, 1318.5, 1568.0, 2093.0];
      const step = 0.045; // 45ms ごとのアルペジオ

      notes.forEach((freq, idx) => {
        const noteStart = now + idx * step;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.001, noteStart);
        gain.gain.linearRampToValueAtTime(0.18, noteStart + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 0.22);
      });
    } catch (e) {
      console.warn('playHitSound failed', e);
    }
  }

  /**
   * 4. ハズレ・ペナルティ音 (Miss / Penalty)
   * 推理を外した際の鈍いウッドトーン・ブザートーン（ブブッ）
   */
  public playMissSound(): void {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // 2連発の鈍い低音ビープ
      const pulses = [0, 0.1];

      pulses.forEach((pulseOffset) => {
        const startTime = now + pulseOffset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, startTime);
        osc.frequency.exponentialRampToValueAtTime(90, startTime + 0.08);

        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.08);
      });
    } catch (e) {
      console.warn('playMissSound failed', e);
    }
  }

  /**
   * 5. タイマー警告音 (Tick-Tock / Pulse)
   * 残り時間5秒以下になった際の緊迫したパルス音（ピッ）
   */
  public playTimeWarningSound(): void {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      console.warn('playTimeWarningSound failed', e);
    }
  }

  /**
   * 6. 勝利ファンファーレ (Victory)
   * 決着時のリザルトモーダル表示時の勝利アルペジオ＆コード
   */
  public playVictorySound(): void {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // C5 -> E5 -> G5 -> C6 -> E6 の上昇ファンファーレ
      const arpeggio = [
        { freq: 523.25, time: 0 },
        { freq: 659.25, time: 0.1 },
        { freq: 783.99, time: 0.2 },
        { freq: 1046.5, time: 0.3 },
      ];

      arpeggio.forEach(({ freq, time }) => {
        const startTime = now + time;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });

      // 最後の華やかな和音（C6 + E6 + G6）
      const chordStart = now + 0.42;
      const chordFreqs = [1046.5, 1318.5, 1568.0];
      chordFreqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, chordStart);

        gain.gain.setValueAtTime(0.1, chordStart);
        gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(chordStart);
        osc.stop(chordStart + 0.7);
      });
    } catch (e) {
      console.warn('playVictorySound failed', e);
    }
  }

  /**
   * 7. 敗北トーン (Defeat)
   * 落ち着いた敗北コード（下降マイナートーン）
   */
  public playDefeatSound(): void {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // 下降トーン: G4 -> Eb4 -> D4 -> C4
      const notes = [
        { freq: 392.0, time: 0 },
        { freq: 311.13, time: 0.14 },
        { freq: 293.66, time: 0.28 },
        { freq: 261.63, time: 0.42 },
      ];

      notes.forEach(({ freq, time }) => {
        const startTime = now + time;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.08, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });
    } catch (e) {
      console.warn('playDefeatSound failed', e);
    }
  }
}

export const soundManager = new SoundManager();
