import { describe, it, expect } from 'vitest';
import {
  createProblemDetails,
  createRuleViolationError,
  createNotFoundError,
  createTimeoutError,
  createInternalGameError,
  isProblemDetails,
  generateUuid,
  formatErrorType,
  DEFAULT_ERROR_TYPE_PREFIX,
} from '../problemDetails';
import { ErrorCodes, ProblemDetails } from '../../types/error';

describe('problemDetails', () => {
  describe('generateUuid', () => {
    it('generates a valid UUID string', () => {
      const uuid = generateUuid();
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidPattern);
    });

    it('generates unique UUIDs consecutively', () => {
      const uuids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        uuids.add(generateUuid());
      }
      expect(uuids.size).toBe(50);
    });
  });

  describe('formatErrorType', () => {
    it('converts error codes into kebab-case URI paths', () => {
      expect(formatErrorType('ERR_RULE_VIOLATION')).toBe(
        `${DEFAULT_ERROR_TYPE_PREFIX}rule-violation`
      );
      expect(formatErrorType('GAME_OUT_OF_TURN')).toBe(
        `${DEFAULT_ERROR_TYPE_PREFIX}game-out-of-turn`
      );
      expect(formatErrorType('ROOM_NOT_FOUND')).toBe(
        `${DEFAULT_ERROR_TYPE_PREFIX}room-not-found`
      );
    });

    it('respects custom prefix if provided', () => {
      expect(
        formatErrorType('GAME_INVALID_TARGET', 'https://algo-game.example.com/errors/')
      ).toBe('https://algo-game.example.com/errors/game-invalid-target');
    });
  });

  describe('createProblemDetails', () => {
    it('creates RFC 7807 problem details with required fields and defaults', () => {
      const problem = createProblemDetails({
        status: 400,
        title: 'Bad Request',
        detail: 'The provided move is invalid.',
        errorCode: 'ERR_INVALID_MOVE',
      });

      expect(problem.status).toBe(400);
      expect(problem.title).toBe('Bad Request');
      expect(problem.detail).toBe('The provided move is invalid.');
      expect(problem.errorCode).toBe('ERR_INVALID_MOVE');
      expect(problem.code).toBe('ERR_INVALID_MOVE');
      expect(problem.type).toBe(`${DEFAULT_ERROR_TYPE_PREFIX}invalid-move`);
      expect(problem.instance).toMatch(/^urn:uuid:[0-9a-f-]+$/i);
      expect(typeof problem.timestamp).toBe('number');
      expect(problem.invalidParams).toBeUndefined();
      expect(problem.traceId).toBeUndefined();
    });

    it('applies explicit options correctly', () => {
      const customTimestamp = 1759060800000;
      const customInstance = 'urn:uuid:00000000-0000-0000-0000-000000000001';
      const customType = 'https://custom.algo/errors/custom-error';
      const customTraceId = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

      const problem = createProblemDetails({
        status: 422,
        title: 'Custom Title',
        detail: 'Custom Detail',
        errorCode: 'CUSTOM_CODE',
        type: customType,
        instance: customInstance,
        code: 'ALIAS_CODE',
        timestamp: customTimestamp,
        traceId: customTraceId,
        invalidParams: [{ name: 'cardIndex', reason: 'Must be between 0 and 3' }],
      });

      expect(problem.status).toBe(422);
      expect(problem.title).toBe('Custom Title');
      expect(problem.detail).toBe('Custom Detail');
      expect(problem.errorCode).toBe('CUSTOM_CODE');
      expect(problem.code).toBe('ALIAS_CODE');
      expect(problem.type).toBe(customType);
      expect(problem.instance).toBe(customInstance);
      expect(problem.timestamp).toBe(customTimestamp);
      expect(problem.traceId).toBe(customTraceId);
      expect(problem.invalidParams).toEqual([
        { name: 'cardIndex', reason: 'Must be between 0 and 3' },
      ]);
    });
  });

  describe('createRuleViolationError', () => {
    it('creates a 422 Rule Violation error with default error code', () => {
      const err = createRuleViolationError('Cannot attack already revealed card');

      expect(err.status).toBe(422);
      expect(err.title).toBe('Rule Violation');
      expect(err.detail).toBe('Cannot attack already revealed card');
      expect(err.errorCode).toBe(ErrorCodes.RULE_VIOLATION);
      expect(err.code).toBe(ErrorCodes.RULE_VIOLATION);
      expect(err.type).toBe(`${DEFAULT_ERROR_TYPE_PREFIX}rule-violation`);
      expect(err.instance).toMatch(/^urn:uuid:[0-9a-f-]+$/i);
    });

    it('creates a 422 Rule Violation error with custom error code', () => {
      const err = createRuleViolationError(
        'Out of turn move attempt',
        ErrorCodes.GAME_OUT_OF_TURN
      );

      expect(err.status).toBe(422);
      expect(err.errorCode).toBe(ErrorCodes.GAME_OUT_OF_TURN);
      expect(err.type).toBe(`${DEFAULT_ERROR_TYPE_PREFIX}game-out-of-turn`);
    });
  });

  describe('createNotFoundError', () => {
    it('creates a 404 Room Not Found error when resource is Room', () => {
      const err = createNotFoundError('Room', 'room-404');

      expect(err.status).toBe(404);
      expect(err.title).toBe('Room Not Found');
      expect(err.detail).toBe("Room with id 'room-404' was not found.");
      expect(err.errorCode).toBe(ErrorCodes.ROOM_NOT_FOUND);
      expect(err.code).toBe(ErrorCodes.ROOM_NOT_FOUND);
      expect(err.type).toBe(`${DEFAULT_ERROR_TYPE_PREFIX}room-not-found`);
      expect(err.invalidParams).toEqual([
        {
          name: 'id',
          reason: "Room 'room-404' does not exist or has expired.",
        },
      ]);
      expect(err.instance).toMatch(/^urn:uuid:[0-9a-f-]+$/i);
    });

    it('creates a 404 error for arbitrary resource', () => {
      const err = createNotFoundError('Player Card', 'c-99');

      expect(err.status).toBe(404);
      expect(err.title).toBe('Player Card Not Found');
      expect(err.detail).toBe("Player Card with id 'c-99' was not found.");
      expect(err.errorCode).toBe('PLAYER_CARD_NOT_FOUND');
      expect(err.invalidParams).toHaveLength(1);
    });
  });

  describe('createTimeoutError', () => {
    it('creates a 408 Request Timeout error', () => {
      const err = createTimeoutError('Turn deliberation limit (15s) exceeded.');

      expect(err.status).toBe(408);
      expect(err.title).toBe('Turn Timeout');
      expect(err.detail).toBe('Turn deliberation limit (15s) exceeded.');
      expect(err.errorCode).toBe(ErrorCodes.GAME_TIMEOUT_EXPIRED);
      expect(err.code).toBe(ErrorCodes.GAME_TIMEOUT_EXPIRED);
      expect(err.type).toBe(`${DEFAULT_ERROR_TYPE_PREFIX}game-timeout-expired`);
      expect(err.instance).toMatch(/^urn:uuid:[0-9a-f-]+$/i);
    });
  });

  describe('createInternalGameError', () => {
    it('creates a 500 Internal Game Error', () => {
      const err = createInternalGameError('Deck state corruption detected: card duplicated.');

      expect(err.status).toBe(500);
      expect(err.title).toBe('Internal Game Error');
      expect(err.detail).toBe('Deck state corruption detected: card duplicated.');
      expect(err.errorCode).toBe(ErrorCodes.GAME_ENGINE_PANIC);
      expect(err.code).toBe(ErrorCodes.GAME_ENGINE_PANIC);
      expect(err.type).toBe(`${DEFAULT_ERROR_TYPE_PREFIX}game-engine-panic`);
      expect(err.instance).toMatch(/^urn:uuid:[0-9a-f-]+$/i);
    });
  });

  describe('instance uniqueness', () => {
    it('ensures each generated error has a globally unique instance identifier', () => {
      const instances = new Set<string>();
      const total = 100;

      for (let i = 0; i < total; i++) {
        const err =
          i % 4 === 0
            ? createRuleViolationError(`Rule error ${i}`)
            : i % 4 === 1
            ? createNotFoundError('Room', `id-${i}`)
            : i % 4 === 2
            ? createTimeoutError(`Timeout error ${i}`)
            : createInternalGameError(`Internal error ${i}`);

        expect(err.instance).toMatch(/^urn:uuid:[0-9a-f-]{36}$/i);
        instances.add(err.instance);
      }

      expect(instances.size).toBe(total);
    });
  });

  describe('isProblemDetails type guard', () => {
    it('returns true for valid problem details produced by factories', () => {
      expect(isProblemDetails(createRuleViolationError('test'))).toBe(true);
      expect(isProblemDetails(createNotFoundError('Room', '123'))).toBe(true);
      expect(isProblemDetails(createTimeoutError('test'))).toBe(true);
      expect(isProblemDetails(createInternalGameError('test'))).toBe(true);
    });

    it('returns true for manual conforming ProblemDetails objects', () => {
      const manualObj: ProblemDetails = {
        type: 'https://algo.internal/errors/invalid-action',
        title: 'Invalid Action',
        status: 400,
        detail: 'Cannot perform this action now.',
        instance: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        errorCode: 'ERR_INVALID_ACTION',
        code: 'ERR_INVALID_ACTION',
        timestamp: 1759060800000,
        traceId: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        invalidParams: [{ name: 'phase', reason: 'Expected DRAW phase' }],
      };
      expect(isProblemDetails(manualObj)).toBe(true);
    });

    it('returns false for non-object, null, or undefined values', () => {
      expect(isProblemDetails(null)).toBe(false);
      expect(isProblemDetails(undefined)).toBe(false);
      expect(isProblemDetails('error string')).toBe(false);
      expect(isProblemDetails(123)).toBe(false);
      expect(isProblemDetails(true)).toBe(false);
    });

    it('returns false when any required field is missing or has wrong type', () => {
      const base: Record<string, unknown> = {
        type: 'https://algo.internal/errors/test',
        title: 'Test',
        status: 400,
        detail: 'Test detail',
        instance: 'urn:uuid:test',
        errorCode: 'ERR_TEST',
      };

      const requiredKeys = ['type', 'title', 'status', 'detail', 'instance', 'errorCode'];

      for (const key of requiredKeys) {
        const missingKeyObj = { ...base };
        delete missingKeyObj[key];
        expect(isProblemDetails(missingKeyObj)).toBe(false);

        const wrongTypeObj = {
          ...base,
          [key]: key === 'status' ? '400' : 123,
        };
        expect(isProblemDetails(wrongTypeObj)).toBe(false);
      }
    });

    it('returns false when optional fields have invalid types', () => {
      const validBase: ProblemDetails = {
        type: 'https://algo.internal/errors/test',
        title: 'Test',
        status: 400,
        detail: 'Test detail',
        instance: 'urn:uuid:test',
        errorCode: 'ERR_TEST',
      };

      // Invalid code
      expect(isProblemDetails({ ...validBase, code: 123 })).toBe(false);

      // Invalid timestamp
      expect(isProblemDetails({ ...validBase, timestamp: '2026-09-30' })).toBe(false);

      // Invalid traceId
      expect(isProblemDetails({ ...validBase, traceId: 999 })).toBe(false);

      // Invalid invalidParams (not an array)
      expect(isProblemDetails({ ...validBase, invalidParams: 'invalid' })).toBe(false);

      // Invalid invalidParams items
      expect(
        isProblemDetails({
          ...validBase,
          invalidParams: [{ name: 123, reason: 'test' }],
        })
      ).toBe(false);

      expect(
        isProblemDetails({
          ...validBase,
          invalidParams: [{ name: 'foo' }],
        })
      ).toBe(false);
    });
  });
});
