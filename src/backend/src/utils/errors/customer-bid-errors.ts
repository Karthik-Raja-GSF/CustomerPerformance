/**
 * Customer Bid Error Classes
 *
 * Custom error classes for customer bid API errors.
 */

/**
 * Customer bid query validation error
 */
export class CustomerBidQueryError extends Error {
  public readonly statusCode = 400;

  constructor(message: string = "Invalid customer bid query parameters") {
    super(message);
    this.name = "CustomerBidQueryError";
    Object.setPrototypeOf(this, CustomerBidQueryError.prototype);
  }
}

/**
 * Customer bid database error
 */
export class CustomerBidDatabaseError extends Error {
  public readonly statusCode = 500;

  constructor(
    message: string = "Database error while fetching customer bids",
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "CustomerBidDatabaseError";
    Object.setPrototypeOf(this, CustomerBidDatabaseError.prototype);
  }
}

/**
 * Customer bid not found error
 */
export class CustomerBidNotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message: string = "Customer bid record not found") {
    super(message);
    this.name = "CustomerBidNotFoundError";
    Object.setPrototypeOf(this, CustomerBidNotFoundError.prototype);
  }
}

/**
 * Customer bid sync already in progress error
 */
export class CustomerBidSyncInProgressError extends Error {
  public readonly statusCode = 409;

  constructor(
    message: string = "A sync operation is already in progress. Please wait for it to complete."
  ) {
    super(message);
    this.name = "CustomerBidSyncInProgressError";
    Object.setPrototypeOf(this, CustomerBidSyncInProgressError.prototype);
  }
}
