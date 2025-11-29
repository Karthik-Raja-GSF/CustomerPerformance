/**
 * Authentication Error Classes
 *
 * Custom error classes for authentication-related errors.
 * These provide specific error types for different failure scenarios.
 */

/**
 * Base authentication error - user is not authenticated
 */
export class AuthenticationError extends Error {
  public readonly statusCode = 401;

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Token has expired
 */
export class TokenExpiredError extends Error {
  public readonly statusCode = 401;

  constructor(message: string = 'Token has expired') {
    super(message);
    this.name = 'TokenExpiredError';
    Object.setPrototypeOf(this, TokenExpiredError.prototype);
  }
}

/**
 * Token is invalid or malformed
 */
export class InvalidTokenError extends Error {
  public readonly statusCode = 401;

  constructor(message: string = 'Invalid token') {
    super(message);
    this.name = 'InvalidTokenError';
    Object.setPrototypeOf(this, InvalidTokenError.prototype);
  }
}
