export class ChatLogNotFoundError extends Error {
  statusCode = 404;
  constructor(chatLogId: string) {
    super(`Chat log "${chatLogId}" not found`);
    this.name = "ChatLogNotFoundError";
    Object.setPrototypeOf(this, ChatLogNotFoundError.prototype);
  }
}

export class ChatLogForbiddenError extends Error {
  statusCode = 403;
  constructor() {
    super("You do not have permission to modify this chat log");
    this.name = "ChatLogForbiddenError";
    Object.setPrototypeOf(this, ChatLogForbiddenError.prototype);
  }
}
