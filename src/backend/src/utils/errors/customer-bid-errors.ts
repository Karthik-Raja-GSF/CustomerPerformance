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
