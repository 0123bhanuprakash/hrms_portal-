import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// ============================================================
// RFC 7807 Problem Details — https://tools.ietf.org/html/rfc7807
// All error responses follow this structure.
// Content-Type: application/problem+json
// ============================================================

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  request_id?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const response = ctx.getResponse<Response>();

    const requestId: string | undefined = request['requestId'];
    const problem = this.buildProblem(exception, request.url, requestId);

    // Log 5xx errors as errors, 4xx as warnings
    if (problem.status >= 500) {
      this.logger.error(
        `[${requestId ?? 'no-id'}] ${request.method} ${request.url} → ${problem.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${requestId ?? 'no-id'}] ${request.method} ${request.url} → ${problem.status}: ${problem.detail}`,
      );
    }

    response
      .status(problem.status)
      .header('Content-Type', 'application/problem+json')
      .json(problem);
  }

  private buildProblem(
    exception: unknown,
    url: string,
    requestId?: string,
  ): ProblemDetails {
    const isProd = process.env['NODE_ENV'] === 'production';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();

      let title = this.statusToTitle(status);
      let detail = exception.message;
      let code: string | undefined;
      let errors: Record<string, string[]> | undefined;

      if (typeof raw === 'object' && raw !== null) {
        const r = raw as Record<string, unknown>;
        title = (r['error'] as string | undefined) ?? title;
        code = r['code'] as string | undefined;

        if (Array.isArray(r['message'])) {
          // class-validator ValidationPipe errors
          detail = 'Validation failed. Check the errors field for details.';
          errors = this.parseClassValidatorErrors(r['message'] as string[]);
        } else {
          detail = (r['message'] as string | undefined) ?? detail;
        }
      }

      return {
        type: `/errors/${this.slugify(title)}`,
        title,
        status,
        detail,
        instance: url,
        request_id: requestId,
        ...(code && { code }),
        ...(errors && { errors }),
      };
    }

    // Unexpected / unhandled error — 500
    const detail = isProd
      ? 'An unexpected error occurred. Please try again later.'
      : (exception instanceof Error ? exception.message : String(exception));

    return {
      type: '/errors/internal-server-error',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail,
      instance: url,
      request_id: requestId,
    };
  }

  /** Parse class-validator message strings into field → messages map. */
  private parseClassValidatorErrors(messages: string[]): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    for (const message of messages) {
      // class-validator format: "fieldName must be ..."
      const spaceIdx = message.indexOf(' ');
      const field = spaceIdx !== -1 ? message.slice(0, spaceIdx) : 'unknown';
      errors[field] = [...(errors[field] ?? []), message];
    }
    return errors;
  }

  private statusToTitle(status: number): string {
    const map: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      423: 'Locked',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      503: 'Service Unavailable',
    };
    return map[status] ?? 'Error';
  }

  private slugify(text: string): string {
    return text.toLowerCase().replace(/\s+/g, '-');
  }
}
