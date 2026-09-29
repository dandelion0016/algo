import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  recordAuditEvent,
  getAuditLogs,
  clearAuditLogs,
  maskAuditPayload,
  MAX_AUDIT_LOG_BUFFER_SIZE,
} from '../auditLogger';
import { AuditEventType } from '@/types/audit';

describe('auditLogger', () => {
  beforeEach(() => {
    clearAuditLogs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearAuditLogs();
  });

  describe('recordAuditEvent & 必須フィールドの検証', () => {
    it('必須フィールド（eventId, timestamp, eventType, userId, payload, isMasked）が正しく設定されること', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const startTime = Date.now();
      const eventType: AuditEventType = 'GAME_INIT';
      const userId = 'usr_test123';
      const payload = { playerCount: 2, difficulty: 'hard' };

      const event = recordAuditEvent(eventType, userId, payload);

      expect(event).toBeDefined();
      expect(typeof event.eventId).toBe('string');
      expect(event.eventId.startsWith('evt_')).toBe(true);
      expect(typeof event.timestamp).toBe('number');
      expect(event.timestamp).toBeGreaterThanOrEqual(startTime);
      expect(event.eventType).toBe('GAME_INIT');
      expect(event.userId).toBe('usr_test123');
      expect(event.payload).toEqual({ playerCount: 2, difficulty: 'hard' });
      expect(event.isMasked).toBe(true);

      // console.info に構造化JSONとして出力されたこと
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const loggedJson = consoleSpy.mock.calls[0][0];
      expect(JSON.parse(loggedJson)).toEqual(event);
    });

    it('ペイロードが未指定の場合でも空のオブジェクトで正常に生成されること', () => {
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const event = recordAuditEvent('TURN_START', 'usr_abc');

      expect(event.eventType).toBe('TURN_START');
      expect(event.userId).toBe('usr_abc');
      expect(event.payload).toEqual({});
      expect(event.isMasked).toBe(true);
    });

    it('全ての指定可能な AuditEventType を扱えること', () => {
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const types: AuditEventType[] = [
        'GAME_INIT',
        'TURN_START',
        'DRAW_CARD',
        'ATTACK_ATTEMPT',
        'ATTACK_RESULT',
        'TURN_PASS',
        'TIMEOUT_PENALTY',
        'GAME_OVER',
        'SECURITY_VIOLATION',
      ];

      for (const t of types) {
        const ev = recordAuditEvent(t, 'usr_dummy');
        expect(ev.eventType).toBe(t);
      }
      expect(getAuditLogs().length).toBe(types.length);
    });
  });

  describe('maskAuditPayload & 機密マスキング処理の検証', () => {
    it('未公開（isOpen !== true）のカードの number が null にマスキングされること', () => {
      const payload = {
        openCard: { id: 'b-3', color: 'black', number: 3, isOpen: true },
        closedCard: { id: 'w-7', color: 'white', number: 7, isOpen: false },
        noOpenPropCard: { id: 'b-5', color: 'black', number: 5 }, // isOpen 未定義 (falsy)
      };

      const masked = maskAuditPayload(payload);

      // 公開カードの number はそのまま
      expect(masked.openCard).toEqual({
        id: 'b-3',
        color: 'black',
        number: 3,
        isOpen: true,
      });

      // 未公開カードの number は null に置換
      expect(masked.closedCard).toEqual({
        id: 'w-7',
        color: 'white',
        number: null,
        isOpen: false,
      });

      // isOpen が true ではないカードも null に置換
      expect(masked.noOpenPropCard).toEqual({
        id: 'b-5',
        color: 'black',
        number: null,
      });
    });

    it('手札配列およびネストされたプレイヤー構造内の未公開カードがマスキングされること', () => {
      const payload = {
        players: [
          {
            id: 'usr_p1',
            cards: [
              { id: 'b-1', color: 'black', number: 1, isOpen: true },
              { id: 'w-2', color: 'white', number: 2, isOpen: false },
            ],
          },
          {
            id: 'cpu_1',
            cards: [
              { id: 'b-8', color: 'black', number: 8, isOpen: false },
              { id: 'w-9', color: 'white', number: 9, isOpen: false },
            ],
          },
        ],
        deck: [
          { id: 'b-11', color: 'black', number: 11, isOpen: false },
        ],
      };

      const masked = maskAuditPayload(payload) as typeof payload;

      // プレイヤー1の手札
      expect(masked.players[0].cards[0].number).toBe(1); // 公開
      expect(masked.players[0].cards[1].number).toBeNull(); // 伏せ

      // CPUの手札（すべて伏せ）
      expect(masked.players[1].cards[0].number).toBeNull();
      expect(masked.players[1].cards[1].number).toBeNull();

      // 山札
      expect(masked.deck[0].number).toBeNull();
    });

    it('未公開カードの actualNumber も null にマスキングされること', () => {
      const payload = {
        targetCard: {
          id: 'b-4',
          color: 'black',
          number: 4,
          actualNumber: 4,
          isOpen: false,
        },
      };

      const masked = maskAuditPayload(payload);
      expect(masked.targetCard).toEqual({
        id: 'b-4',
        color: 'black',
        number: null,
        actualNumber: null,
        isOpen: false,
      });
    });

    it('機密キー（password, token, email, secret 等）が [MASKED] に置換されること', () => {
      const payload = {
        username: 'algo_master',
        password: 'my_super_secret_password',
        token: 'jwt.token.string',
        authorization: 'Bearer token_value',
        idToken: 'cognito_id_token',
        refreshToken: 'refresh_secret',
        email: 'user@example.com',
        secret: 'internal_secret_key',
        apiKey: 'api_key_12345',
      };

      const masked = maskAuditPayload(payload);

      expect(masked.username).toBe('algo_master');
      expect(masked.password).toBe('[MASKED]');
      expect(masked.token).toBe('[MASKED]');
      expect(masked.authorization).toBe('[MASKED]');
      expect(masked.idToken).toBe('[MASKED]');
      expect(masked.refreshToken).toBe('[MASKED]');
      expect(masked.email).toBe('[MASKED]');
      expect(masked.secret).toBe('[MASKED]');
      expect(masked.apiKey).toBe('[MASKED]');
    });

    it('IPアドレスの末尾オクテットが部分匿名化されること', () => {
      const payload = {
        clientIp: '203.0.113.195',
        ipAddress: '192.168.1.42',
      };

      const masked = maskAuditPayload(payload);

      expect(masked.clientIp).toBe('203.0.113.***');
      expect(masked.ipAddress).toBe('192.168.1.***');
    });

    it('循環参照を含むオブジェクトでもクラッシュせずに処理できること', () => {
      const circularObj: Record<string, unknown> = { name: 'circular' };
      circularObj.self = circularObj;

      expect(() => maskAuditPayload(circularObj)).not.toThrow();
      const masked = maskAuditPayload(circularObj);
      expect(masked.name).toBe('circular');
      expect(masked.self).toBe('[CIRCULAR]');
    });

    it('元オブジェクトをミューテーション（破壊的変更）しないこと', () => {
      const original = {
        password: 'secret',
        card: { id: 'b-1', number: 1, isOpen: false },
      };
      const copy = JSON.parse(JSON.stringify(original));

      maskAuditPayload(original);

      expect(original).toEqual(copy);
    });
  });

  describe('バッファ管理と FIFO ローテーション & clearAuditLogs', () => {
    it('最大100件のFIFOローテーション動作を検証（101件目以降で最古のログが削除されること）', () => {
      vi.spyOn(console, 'info').mockImplementation(() => {});

      // 105件記録する
      for (let i = 1; i <= 105; i++) {
        recordAuditEvent('DRAW_CARD', `usr_${i}`, { index: i });
      }

      const logs = getAuditLogs();

      // バッファサイズの上限が100件であること
      expect(logs.length).toBe(MAX_AUDIT_LOG_BUFFER_SIZE);
      expect(logs.length).toBe(100);

      // 最初に入った 1..5 は押し出され、6..105 が残っていること (FIFO)
      expect(logs[0].payload.index).toBe(6);
      expect(logs[0].userId).toBe('usr_6');
      expect(logs[99].payload.index).toBe(105);
      expect(logs[99].userId).toBe('usr_105');
    });

    it('clearAuditLogs でバッファが完全にクリアされること', () => {
      vi.spyOn(console, 'info').mockImplementation(() => {});

      recordAuditEvent('GAME_INIT', 'usr_1');
      recordAuditEvent('TURN_START', 'usr_1');
      expect(getAuditLogs().length).toBe(2);

      clearAuditLogs();
      expect(getAuditLogs().length).toBe(0);
      expect(getAuditLogs()).toEqual([]);
    });

    it('getAuditLogs は内部バッファの浅いコピーを返し、返却配列の変更が内部バッファに影響しないこと', () => {
      vi.spyOn(console, 'info').mockImplementation(() => {});

      recordAuditEvent('GAME_INIT', 'usr_1');
      const logs = getAuditLogs();
      logs.pop(); // 外部で変更

      expect(getAuditLogs().length).toBe(1);
    });
  });
});
