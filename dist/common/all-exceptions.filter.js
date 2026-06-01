"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
let AllExceptionsFilter = class AllExceptionsFilter {
    logger = new common_1.Logger('Exception');
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest();
        const isHttp = exception instanceof common_1.HttpException;
        const status = isHttp ? exception.getStatus() : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let body;
        if (isHttp) {
            const resp = exception.getResponse();
            if (typeof resp === 'object' && resp !== null && 'errors' in resp && Array.isArray(resp.errors)) {
                body = resp;
            }
            else {
                const message = typeof resp === 'string'
                    ? resp
                    : resp?.message ?? exception.message;
                body = {
                    errors: [{
                            code: `http_${status}`,
                            message: Array.isArray(message) ? message.join('; ') : String(message),
                        }],
                };
            }
        }
        else {
            const err = exception;
            this.logger.error(`Unhandled ${req.method} ${req.url} — ${err?.message ?? exception}`, err?.stack);
            body = {
                errors: [{
                        code: 'internal_server_error',
                        message: process.env.NODE_ENV === 'production'
                            ? 'An unexpected error occurred.'
                            : (err?.message ?? String(exception)),
                    }],
            };
        }
        res.status(status).json(body);
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map