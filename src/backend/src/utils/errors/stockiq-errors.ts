/**
 * StockIQ Error Classes
 *
 * Custom error classes for StockIQ integration errors.
 */

/**
 * StockIQ API error (non-200 response)
 */
export class StockIqApiError extends Error {
  public readonly statusCode = 502;

  constructor(
    message: string = "StockIQ API request failed",
    public readonly apiStatusCode?: number,
    public readonly apiErrorMessage?: string
  ) {
    super(message);
    this.name = "StockIqApiError";
    Object.setPrototypeOf(this, StockIqApiError.prototype);
  }
}

/**
 * StockIQ authentication error
 */
export class StockIqAuthError extends Error {
  public readonly statusCode = 401;

  constructor(message: string = "StockIQ authentication failed") {
    super(message);
    this.name = "StockIqAuthError";
    Object.setPrototypeOf(this, StockIqAuthError.prototype);
  }
}

/**
 * Sync already in progress error
 */
export class StockIqSyncInProgressError extends Error {
  public readonly statusCode = 409;

  constructor(message: string = "A sync operation is already in progress") {
    super(message);
    this.name = "StockIqSyncInProgressError";
    Object.setPrototypeOf(this, StockIqSyncInProgressError.prototype);
  }
}

/**
 * StockIQ configuration error
 */
export class StockIqConfigError extends Error {
  public readonly statusCode = 500;

  constructor(message: string = "StockIQ configuration is missing or invalid") {
    super(message);
    this.name = "StockIqConfigError";
    Object.setPrototypeOf(this, StockIqConfigError.prototype);
  }
}
