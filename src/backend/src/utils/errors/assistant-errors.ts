export class NoActivePromptError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "NoActivePromptError";
    Object.setPrototypeOf(this, NoActivePromptError.prototype);
  }
}

export class UnsupportedModelError extends Error {
  statusCode = 400;
  constructor(modelId: string) {
    super(`Model "${modelId}" is not supported`);
    this.name = "UnsupportedModelError";
    Object.setPrototypeOf(this, UnsupportedModelError.prototype);
  }
}

export class BedrockInvocationError extends Error {
  statusCode = 500;
  constructor(message: string) {
    super(message);
    this.name = "BedrockInvocationError";
    Object.setPrototypeOf(this, BedrockInvocationError.prototype);
  }
}

export class AssistantQueryError extends Error {
  statusCode = 500;
  constructor(message: string) {
    super(message);
    this.name = "AssistantQueryError";
    Object.setPrototypeOf(this, AssistantQueryError.prototype);
  }
}
