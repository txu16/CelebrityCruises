import type { NextFunction, Request, Response } from 'express';

interface HeaderRequest {
  header(name: string): string | string[] | undefined;
}

interface JsonResponse {
  status(code: number): JsonResponse;
  json(payload: unknown): unknown;
}

type AdminMiddleware = (req: HeaderRequest, res: JsonResponse, next: NextFunction) => void;

export function requireAdminToken(expectedToken = process.env.SYNC_ADMIN_TOKEN): AdminMiddleware {
  return (req: HeaderRequest, res: JsonResponse, next: NextFunction): void => {
    if (!expectedToken) {
      res.status(503).json({ error: 'Sync admin token is not configured' });
      return;
    }

    const rawAuthHeader = req.header('authorization') ?? '';
    const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] ?? '' : rawAuthHeader;
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : authHeader;

    if (token !== expectedToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  };
}

export const expressAdminAuth = requireAdminToken() as unknown as (req: Request, res: Response, next: NextFunction) => void;
