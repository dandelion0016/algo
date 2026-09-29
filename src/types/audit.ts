/**
 * 監査イベント種別 (AuditEventType)
 */
export type AuditEventType =
  | 'GAME_INIT'
  | 'TURN_START'
  | 'DRAW_CARD'
  | 'ATTACK_ATTEMPT'
  | 'ATTACK_RESULT'
  | 'TURN_PASS'
  | 'TIMEOUT_PENALTY'
  | 'GAME_OVER'
  | 'SECURITY_VIOLATION';

/**
 * 監査イベントオブジェクト (AuditEvent)
 */
export interface AuditEvent {
  eventId: string;
  timestamp: number;
  eventType: AuditEventType;
  userId: string;
  payload: Record<string, unknown>;
  isMasked: boolean;
}
