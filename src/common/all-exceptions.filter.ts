import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Catch-all filter: turns every uncaught error into a uniform JSON shape so
 * the mobile apps and admin panel never see HTML stack traces or wildly
 * different error formats per endpoint.
 *
 * Shape:
 *   { errors: [{ code, message }] }
 *
 * This matches what the rest of the API already returns from
 * `BadRequestException`/`UnauthorizedException`, so existing clients don't
 * need any change.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Preserve existing { errors: [...] } payloads when the handler already
    // threw them; otherwise wrap whatever we got.
    let body: { errors: Array<{ code: string; message: string }> };
    if (isHttp) {
      const resp = exception.getResponse();
      if (typeof resp === 'object' && resp !== null && 'errors' in resp && Array.isArray((resp as { errors: unknown }).errors)) {
        body = resp as { errors: Array<{ code: string; message: string }> };
      } else {
        const message = typeof resp === 'string'
          ? resp
          : (resp as { message?: string | string[] })?.message ?? exception.message;
        body = {
          errors: [{
            code: `http_${status}`,
            message: Array.isArray(message) ? message.join('; ') : String(message),
          }],
        };
      }
    } else {
      const err = exception as Error;
      this.logger.error(
        `Unhandled ${req.method} ${req.url} — ${err?.message ?? exception}`,
        err?.stack,
      );
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
}
