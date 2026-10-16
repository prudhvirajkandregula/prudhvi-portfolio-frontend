import { FieldError } from './models';

/**
 * Represents any failure talking to the backend. Mirrors the ApiError shape
 * from frontend/js/api.js so error messaging / field-error handling is
 * identical to the vanilla frontend.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldError[] | null;
  readonly body: unknown;

  constructor(
    message: string,
    options: { status?: number; fieldErrors?: FieldError[] | null; body?: unknown } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 0;
    this.fieldErrors = options.fieldErrors ?? null;
    this.body = options.body ?? null;
  }
}
