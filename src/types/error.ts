/**
 * RFC 7807 Problem Details for HTTP APIs
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 * @see docs/design/backend/error-handling.md
 */

/**
 * Invalid parameter details for validation errors
 */
export interface InvalidParam {
  name: string;
  reason: string;
}

/**
 * RFC 7807 compliant Problem Details interface
 */
export interface ProblemDetails {
  /**
   * URI reference identifying the problem type
   * @example "https://algo.internal/errors/invalid-action"
   */
  type: string;

  /**
   * Short, human-readable summary of the problem type
   * @example "Invalid Target Selection"
   */
  title: string;

  /**
   * HTTP status code applicable to this problem occurrence
   * @example 400, 404, 408, 409, 422, 500
   */
  status: number;

  /**
   * Human-readable explanation specific to this occurrence of the problem
   */
  detail: string;

  /**
   * URI reference that identifies the specific occurrence of the problem
   * @example "urn:uuid:123e4567-e89b-12d3-a456-426614174000"
   */
  instance: string;

  /**
   * Machine-readable error code
   * @example "ERR_INVALID_CARD_SELECTION"
   */
  errorCode: string;

  /**
   * Backward-compatible alias for errorCode
   */
  code?: string;

  /**
   * Optional array of invalid parameters for validation failures
   */
  invalidParams?: InvalidParam[];

  /**
   * Optional epoch timestamp (ms) when the error occurred
   */
  timestamp?: number;

  /**
   * Optional distributed tracing ID (e.g., W3C TraceContext)
   */
  traceId?: string;
}

/**
 * Options for creating a ProblemDetails object
 */
export interface CreateProblemDetailsOptions {
  type?: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errorCode: string;
  code?: string;
  invalidParams?: InvalidParam[];
  timestamp?: number;
  traceId?: string;
}

/**
 * Standard error codes used across the Algo system
 * @see docs/design/backend/error-handling.md section 2.2
 */
export const ErrorCodes = {
  // 400 Bad Request
  GAME_OUT_OF_TURN: 'GAME_OUT_OF_TURN',
  GAME_PHASE_MISMATCH: 'GAME_PHASE_MISMATCH',
  GAME_INVALID_TARGET: 'GAME_INVALID_TARGET',
  GAME_INVALID_NUMBER: 'GAME_INVALID_NUMBER',
  GAME_TIMEOUT_EXPIRED: 'GAME_TIMEOUT_EXPIRED',

  // 404 Not Found
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

  // 408 Request Timeout
  GAME_TIMEOUT: 'GAME_TIMEOUT',

  // 409 Conflict
  ROOM_FULL: 'ROOM_FULL',
  ROOM_ALREADY_STARTED: 'ROOM_ALREADY_STARTED',

  // 422 Unprocessable Content / Rule Violation
  RULE_VIOLATION: 'ERR_RULE_VIOLATION',

  // 500 Internal Error
  GAME_ENGINE_PANIC: 'GAME_ENGINE_PANIC',
  INTERNAL_GAME_ERROR: 'ERR_INTERNAL_GAME_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes] | string;
