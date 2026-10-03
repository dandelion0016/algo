import { AuditEvent, AuditEventType } from '@/types/audit';

export const MAX_AUDIT_LOG_BUFFER_SIZE = 100;

// 機密情報としてマスキング対象となるキー名（小文字で比較）
const SENSITIVE_KEYS = new Set([
  'password',
  'authorization',
  'token',
  'idtoken',
  'refreshtoken',
  'email',
  'secret',
  'credential',
  'apikey',
  'privatekey',
]);

// IPアドレスのキー名（小文字で比較）
const IP_KEYS = new Set(['ipaddress', 'clientip', 'ip']);

/**
 * 対象オブジェクトがアルゴのカード類似オブジェクトか判定
 */
function isCardLike(obj: unknown): obj is Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }
  const record = obj as Record<string, unknown>;
  const hasNumberProp = 'number' in record;
  const hasIsOpenProp = 'isOpen' in record;
  const hasColorOrId = 'color' in record || 'id' in record;
  return hasNumberProp && (hasIsOpenProp || hasColorOrId);
}

/**
 * 監査ログ用ペイロードを再帰的に走査し、機密情報および未公開カードをマスキングする内部関数
 */
function sanitizeValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // 循環参照対策
  if (seen.has(value)) {
    return '[CIRCULAR]';
  }
  seen.add(value);

  // 配列の場合: 各要素を再帰的に走査
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }

  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  // カードオブジェクト判定: isOpen !== true の場合は number を null にマスキング
  const isCard = isCardLike(record);
  const shouldMaskCardNumber = isCard && record.isOpen !== true;

  for (const [key, val] of Object.entries(record)) {
    const lowerKey = key.toLowerCase();

    // 1. 機密キーの場合: '[MASKED]' に置換
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = '[MASKED]';
      continue;
    }

    // 2. IPアドレスの場合: IPv4は末尾オクテットを .*** に、IPv6は末尾セグメントを :*** に置換
    if (IP_KEYS.has(lowerKey) && typeof val === 'string') {
      if (val.includes(':')) {
        result[key] = val.replace(/:[a-fA-F0-9]*$/, ':***');
      } else {
        result[key] = val.replace(/\.\d+$/, '.***');
      }
      continue;
    }

    // 3. カードの number または actualNumber のマスキング
    if (shouldMaskCardNumber && (key === 'number' || key === 'actualNumber')) {
      result[key] = null;
      continue;
    }

    // 4. その他の値は再帰的にサニタイズ
    result[key] = sanitizeValue(val, seen);
  }

  return result;
}

/**
 * ペイロード内のカードオブジェクト（Card / PublicCard）や手札配列を走査し、
 * 未公開（`isOpen !== true`）の相手カードの `number` や機密情報を `null` または `'[MASKED]'` に置換
 */
export function maskAuditPayload(payload: Record<string, unknown>): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  return sanitizeValue(payload) as Record<string, unknown>;
}

// インメモリバッファ（最大100件）
const auditLogBuffer: AuditEvent[] = [];

/**
 * ユニークなイベントIDを生成
 * 例: evt_${Date.now()}_${random}
 */
function generateEventId(): string {
  const random = Math.random().toString(36).substring(2, 9);
  return `evt_${Date.now()}_${random}`;
}

/**
 * 監査イベントを記録する
 * - ペイロードを自動マスキングしてイベントオブジェクトを生成
 * - インメモリバッファ（最大100件）に保持
 * - 開発環境および本番環境で console.info (構造化JSON) 出力
 */
export function recordAuditEvent(
  eventType: AuditEventType,
  userId: string,
  payload?: Record<string, unknown>
): AuditEvent {
  const maskedPayload = maskAuditPayload(payload ?? {});
  const event: AuditEvent = {
    eventId: generateEventId(),
    timestamp: Date.now(),
    eventType,
    userId,
    payload: maskedPayload,
    isMasked: true,
  };

  // FIFO バッファ追加
  auditLogBuffer.push(event);
  if (auditLogBuffer.length > MAX_AUDIT_LOG_BUFFER_SIZE) {
    auditLogBuffer.shift();
  }

  // 構造化JSON出力
  console.info(JSON.stringify(event));

  return event;
}

/**
 * 保持している監査ログ一覧の取得
 */
export function getAuditLogs(): AuditEvent[] {
  return [...auditLogBuffer];
}

/**
 * バッファのクリア
 */
export function clearAuditLogs(): void {
  auditLogBuffer.length = 0;
}

/**
 * 監査ロガーオブジェクト (Issue #88)
 * 構造化ログ出力と監査イベント記録（セキュリティ違反等）を統合
 */
export const auditLogger = {
  record: recordAuditEvent,
  warn: (message: string, payload?: Record<string, unknown>, userId = 'system'): AuditEvent => {
    console.warn(`[AUDIT_WARN] ${message}`, payload);
    return recordAuditEvent('SECURITY_VIOLATION', userId, { message, ...payload });
  },
  info: (message: string, payload?: Record<string, unknown>, userId = 'system'): AuditEvent => {
    console.info(`[AUDIT_INFO] ${message}`, payload);
    return recordAuditEvent('GAME_INIT', userId, { message, ...payload });
  },
};
