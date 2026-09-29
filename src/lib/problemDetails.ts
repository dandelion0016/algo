/**
 * RFC 7807 Problem Details Factory & Utility functions
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 * @see docs/design/backend/error-handling.md
 */

import {
  CreateProblemDetailsOptions,
  ErrorCodes,
  ProblemDetails,
} from '../types/error';

export const DEFAULT_ERROR_TYPE_PREFIX = 'https://algo.internal/errors/';

/**
 * Generates a RFC 4122 v4 UUID string with environment fallback.
 */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Helper to slugify an errorCode into a URI path segment.
 * @example "ERR_RULE_VIOLATION" -> "rule-violation"
 * @example "GAME_OUT_OF_TURN" -> "game-out-of-turn"
 */
export function formatErrorType(
  errorCode: string,
  prefix: string = DEFAULT_ERROR_TYPE_PREFIX
): string {
  const slug = errorCode
    .toLowerCase()
    .replace(/^err_/, '')
    .replace(/_/g, '-');
  return `${prefix}${slug}`;
}

/**
 * Base factory function to create an RFC 7807 compliant ProblemDetails object.
 */
export function createProblemDetails(
  options: CreateProblemDetailsOptions
): ProblemDetails {
  const instance = options.instance ?? `urn:uuid:${generateUuid()}`;
  const type =
    options.type ?? formatErrorType(options.errorCode, DEFAULT_ERROR_TYPE_PREFIX);
  const code = options.code ?? options.errorCode;
  const timestamp = options.timestamp ?? Date.now();

  const problemDetails: ProblemDetails = {
    type,
    title: options.title,
    status: options.status,
    detail: options.detail,
    instance,
    errorCode: options.errorCode,
    code,
    timestamp,
  };

  if (options.invalidParams !== undefined) {
    problemDetails.invalidParams = options.invalidParams;
  }

  if (options.traceId !== undefined) {
    problemDetails.traceId = options.traceId;
  }

  return problemDetails;
}

/**
 * Creates a Rule Violation error (HTTP 422 Unprocessable Content).
 * Used when an action violates game rules or game logic invariants.
 */
export function createRuleViolationError(
  detail: string,
  code: string = ErrorCodes.RULE_VIOLATION
): ProblemDetails {
  return createProblemDetails({
    status: 422,
    title: 'Rule Violation',
    detail,
    errorCode: code,
    code,
  });
}

/**
 * Creates a Resource Not Found error (HTTP 404 Not Found).
 * Used when a targeted room, player, or card is not found.
 */
export function createNotFoundError(
  resource: string,
  id: string
): ProblemDetails {
  const isRoom = resource.toLowerCase() === 'room';
  const errorCode = isRoom
    ? ErrorCodes.ROOM_NOT_FOUND
    : `${resource.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`;

  return createProblemDetails({
    status: 404,
    title: `${resource} Not Found`,
    detail: `${resource} with id '${id}' was not found.`,
    errorCode,
    code: errorCode,
    invalidParams: [
      {
        name: 'id',
        reason: `${resource} '${id}' does not exist or has expired.`,
      },
    ],
  });
}

/**
 * Creates a Timeout error (HTTP 408 Request Timeout).
 * Used when a player turn timer expires or action deadline is exceeded.
 */
export function createTimeoutError(detail: string): ProblemDetails {
  return createProblemDetails({
    status: 408,
    title: 'Turn Timeout',
    detail,
    errorCode: ErrorCodes.GAME_TIMEOUT_EXPIRED,
    code: ErrorCodes.GAME_TIMEOUT_EXPIRED,
  });
}

/**
 * Creates an Internal Game Error (HTTP 500 Internal Server Error).
 * Used when unexpected state corruption or internal panic occurs.
 */
export function createInternalGameError(detail: string): ProblemDetails {
  return createProblemDetails({
    status: 500,
    title: 'Internal Game Error',
    detail,
    errorCode: ErrorCodes.GAME_ENGINE_PANIC,
    code: ErrorCodes.GAME_ENGINE_PANIC,
  });
}

/**
 * Type guard function to verify if an unknown object satisfies RFC 7807 ProblemDetails.
 */
export function isProblemDetails(obj: unknown): obj is ProblemDetails {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // Required RFC 7807 and Algo ProblemDetails fields
  if (
    typeof candidate.type !== 'string' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.status !== 'number' ||
    typeof candidate.detail !== 'string' ||
    typeof candidate.instance !== 'string' ||
    typeof candidate.errorCode !== 'string'
  ) {
    return false;
  }

  // Validate optional 'code'
  if (candidate.code !== undefined && typeof candidate.code !== 'string') {
    return false;
  }

  // Validate optional 'timestamp'
  if (
    candidate.timestamp !== undefined &&
    typeof candidate.timestamp !== 'number'
  ) {
    return false;
  }

  // Validate optional 'traceId'
  if (candidate.traceId !== undefined && typeof candidate.traceId !== 'string') {
    return false;
  }

  // Validate optional 'invalidParams'
  if (candidate.invalidParams !== undefined) {
    if (!Array.isArray(candidate.invalidParams)) {
      return false;
    }
    const isValidParams = candidate.invalidParams.every(
      (param) =>
        typeof param === 'object' &&
        param !== null &&
        typeof (param as { name?: unknown }).name === 'string' &&
        typeof (param as { reason?: unknown }).reason === 'string'
    );
    if (!isValidParams) {
      return false;
    }
  }

  return true;
}
