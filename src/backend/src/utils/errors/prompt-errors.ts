/**
 * Prompt Error Classes
 *
 * Custom error classes for prompt-related errors.
 */

/**
 * Prompt not found error
 */
export class PromptNotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message: string = 'Prompt not found') {
    super(message);
    this.name = 'PromptNotFoundError';
    Object.setPrototypeOf(this, PromptNotFoundError.prototype);
  }
}

/**
 * Cannot delete active prompt error
 */
export class CannotDeleteActivePromptError extends Error {
  public readonly statusCode = 400;

  constructor(message: string = 'Cannot delete active prompt') {
    super(message);
    this.name = 'CannotDeleteActivePromptError';
    Object.setPrototypeOf(this, CannotDeleteActivePromptError.prototype);
  }
}
