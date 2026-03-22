export class RbacGroupNotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message: string = "Group not found") {
    super(message);
    this.name = "RbacGroupNotFoundError";
    Object.setPrototypeOf(this, RbacGroupNotFoundError.prototype);
  }
}

export class RbacDuplicateKeyError extends Error {
  public readonly statusCode = 409;

  constructor(message: string = "Group key already exists") {
    super(message);
    this.name = "RbacDuplicateKeyError";
    Object.setPrototypeOf(this, RbacDuplicateKeyError.prototype);
  }
}
