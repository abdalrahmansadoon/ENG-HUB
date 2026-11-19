import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../config/firebaseAdmin.js';

export type AuthenticatedRequest = Request & {
  authUser?: { uid: string; email: string | null; name?: string };
};

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'unauthenticated', message: 'سجّل الدخول أولاً.' });
  try {
    const decoded = await adminAuth.verifyIdToken(match[1], true);
    req.authUser = { uid: decoded.uid, email: decoded.email ?? null, name: decoded.name };
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid_token', message: 'انتهت صلاحية الجلسة. سجّل الدخول مجدداً.' });
  }
}
