/**
 * モバイル端末向け触覚フィードバック（Haptics）モジュール
 * Web Vibration API (navigator.vibrate) を安全にラップし、非対応環境やエラー時も安全にフォールバックします。
 */

/**
 * 端末が Vibration API に対応しているか判定
 */
export const isHapticsSupported = (): boolean => {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
};

/**
 * 指定されたパターンでバイブレーションを実行
 * @param pattern 振動時間（ミリ秒）または [振動, 停止, 振動...] の配列
 * @returns 実行成功フラグ（非対応時は false）
 */
export const vibrate = (pattern: number | number[]): boolean => {
  if (!isHapticsSupported()) {
    return false;
  }
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
};

/**
 * 軽いフィードバック（カードドロー、ボタンタップ、カード選択等）
 */
export const vibrateLight = (): boolean => {
  return vibrate(15);
};

/**
 * 成功・的中フィードバック（推理的中、勝利等）
 */
export const vibrateSuccess = (): boolean => {
  return vibrate([20, 50, 40]);
};

/**
 * 失敗・ペナルティフィードバック（推理ハズレ、敗北等）
 */
export const vibrateFailure = (): boolean => {
  return vibrate([60, 40, 60]);
};

/**
 * 警告フィードバック（残り時間5秒以下のカウントダウン等）
 */
export const vibrateWarning = (): boolean => {
  return vibrate(30);
};

export const haptics = {
  isSupported: isHapticsSupported,
  vibrate,
  vibrateLight,
  vibrateSuccess,
  vibrateFailure,
  vibrateWarning,
};
