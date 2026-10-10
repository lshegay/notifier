export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TemplateNotFoundError extends DomainError {
  constructor(public readonly templateId: string) {
    super(`Template with id '${templateId}' not found`);
  }
}

export class ProviderNotFoundError extends DomainError {
  constructor(public readonly providerId: string) {
    super(`Provider with id '${providerId}' not found`);
  }
}

export class UserNotFoundError extends DomainError {
  constructor(public readonly identifier: string) {
    super(`User '${identifier}' not found`);
  }
}

export class UserAlreadyExistsError extends DomainError {
  constructor(public readonly email: string) {
    super(`User with email '${email}' already exists`);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Unauthorized') {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = 'Forbidden') {
    super(message);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
