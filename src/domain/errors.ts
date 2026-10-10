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

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
