import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';
import { reportError } from '@repo/supabase';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Single funnel for every request-side failure: records it to error_logs with the
 * stack and request context, then hands off to Nest's default filter so response
 * bodies are unchanged.
 *
 * What gets recorded, and why not everything:
 * - 5xx — always recorded and always alerted. These are our bugs.
 * - 4xx — recorded, not alerted. Plan limits and validation failures are real
 *   product friction worth reading in the dashboard, but they are not pages.
 * - 401/404 — skipped entirely. Expired tokens and scanner traffic, all noise.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private static readonly IGNORED_STATUSES: ReadonlySet<number> = new Set([
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
  ]);

  constructor(private readonly supabaseService: SupabaseService) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'http') {
      const request = host.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
      const status =
        exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      if (status >= HttpStatus.BAD_REQUEST && !AllExceptionsFilter.IGNORED_STATUSES.has(status)) {
        const route = request.route?.path ?? request.url?.split('?')[0] ?? null;
        const errorBody = exception instanceof HttpException ? exception.getResponse() : null;

        // Fire and forget: reporting never blocks or breaks the response.
        void reportError(this.supabaseService.getClient(), {
          source: 'api',
          feature: featureFromUrl(request.url),
          userId: request.user?.id ?? null,
          error: exception,
          route,
          method: request.method ?? null,
          statusCode: status,
          context: {
            url: request.url,
            params: request.params,
            query: request.query,
            userAgent: request.headers?.['user-agent'] ?? null,
            // Which field failed. Without it a 400 reads as an unactionable 'Validation failed'.
            validationErrors:
              errorBody && typeof errorBody === 'object'
                ? (errorBody as { errors?: unknown }).errors
                : undefined,
            // Redacted, never raw: secrets masked, long strings and nested objects
            // collapsed to their shape. A 4xx without the input that caused it is
            // not diagnosable — 'Invalid referral code' cannot be acted on unless
            // the log says which code.
            body: redact(request.body),
          },
        });
      }
    }

    super.catch(exception, host);
  }
}

/** '/api/v1/ideation/123/export' -> 'ideation' */
function featureFromUrl(url?: string): string | null {
  if (!url) return null;
  const segments = url.split('?')[0]!.split('/').filter(Boolean);
  const versionAt = segments.findIndex((s) => /^v\d+$/.test(s));
  return segments[versionAt >= 0 ? versionAt + 1 : 0] ?? null;
}

const SECRET_KEYS = /token|password|secret|key|authorization|credential|otp/i;

/** Keep the shape of the payload, drop anything that looks like a credential or bulk blob. */
export function redact(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  if (Array.isArray(body)) return `[array of ${body.length}]`;

  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([key, value]) => {
      if (SECRET_KEYS.test(key)) return [key, '[redacted]'];
      if (typeof value === 'string' && value.length > 500) return [key, `[string, ${value.length} chars]`];
      if (value && typeof value === 'object') return [key, '[object]'];
      return [key, value];
    }),
  );
}
