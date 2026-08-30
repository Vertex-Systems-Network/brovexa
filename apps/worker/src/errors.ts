export class RetryableWorkError extends Error {
  constructor(public readonly code: string, message = 'Retryable work failure.') {
    super(message);
    this.name = 'RetryableWorkError';
  }
}

export class PermanentWorkError extends Error {
  constructor(public readonly code: string, message = 'Permanent work failure.') {
    super(message);
    this.name = 'PermanentWorkError';
  }
}

export class CancelledWorkError extends Error {
  constructor(public readonly code = 'WORK_CANCELLED', message = 'Work was cancelled.') {
    super(message);
    this.name = 'CancelledWorkError';
  }
}
