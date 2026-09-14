"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancelledWorkError = exports.PermanentWorkError = exports.RetryableWorkError = void 0;
class RetryableWorkError extends Error {
    code;
    constructor(code, message = 'Retryable work failure.') {
        super(message);
        this.code = code;
        this.name = 'RetryableWorkError';
    }
}
exports.RetryableWorkError = RetryableWorkError;
class PermanentWorkError extends Error {
    code;
    constructor(code, message = 'Permanent work failure.') {
        super(message);
        this.code = code;
        this.name = 'PermanentWorkError';
    }
}
exports.PermanentWorkError = PermanentWorkError;
class CancelledWorkError extends Error {
    code;
    constructor(code = 'WORK_CANCELLED', message = 'Work was cancelled.') {
        super(message);
        this.code = code;
        this.name = 'CancelledWorkError';
    }
}
exports.CancelledWorkError = CancelledWorkError;
//# sourceMappingURL=errors.js.map