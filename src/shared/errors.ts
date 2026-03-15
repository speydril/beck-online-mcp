export class BeckError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoveryHint?: string,
  ) {
    super(message);
    this.name = 'BeckError';
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      hint: this.recoveryHint,
    };
  }
}

export class BeckAuthError extends BeckError {
  constructor(message: string, recoveryHint?: string) {
    super(message, 'AUTH_ERROR', recoveryHint ?? 'Check BECK_USERNAME and BECK_PASSWORD env vars.');
    this.name = 'BeckAuthError';
  }
}

export class BeckSessionExpiredError extends BeckError {
  constructor() {
    super('Session expired', 'SESSION_EXPIRED', 'Re-authenticating automatically...');
    this.name = 'BeckSessionExpiredError';
  }
}

export class BeckDocumentNotFoundError extends BeckError {
  constructor(vpath: string) {
    super(`Document not found: ${vpath}`, 'NOT_FOUND', 'Check the vpath is correct.');
    this.name = 'BeckDocumentNotFoundError';
  }
}
