import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  status: number,
  code: string,
  message: string
): asserts condition {
  if (!condition) throw new AppError(status, code, message);
}
export function errorResponse(error: unknown, requestId: string) {
  if (error instanceof AppError)
    return Response.json(
      { error: { code: error.code, message: error.message }, requestId },
      { status: error.status }
    );
  if (error instanceof ZodError)
    return Response.json(
      {
        error: {
          code: 'VALIDATION',
          message: 'اطلاعات واردشده معتبر نیست.',
          fields: error.flatten().fieldErrors,
        },
        requestId,
      },
      { status: 422 }
    );
  if (error instanceof SyntaxError)
    return Response.json(
      { error: { code: 'INVALID_JSON', message: 'بدنه درخواست معتبر نیست.' }, requestId },
      { status: 400 }
    );
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    return Response.json(
      { error: { code: 'CONFLICT', message: 'این اطلاعات قبلاً ثبت شده است.' }, requestId },
      { status: 409 }
    );
  // Never serialize request bodies, PII, database URLs, or raw provider errors.
  console.error(
    JSON.stringify({
      level: 'error',
      requestId,
      type: error instanceof Error ? error.constructor.name : 'UnknownError',
    })
  );
  return Response.json(
    { error: { code: 'INTERNAL', message: 'خطای موقت در سرویس. دوباره تلاش کنید.' }, requestId },
    { status: 500 }
  );
}
