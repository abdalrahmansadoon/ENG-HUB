import type { NextFunction, Response } from 'express';
import { adminDb } from '../config/firebaseAdmin.js';
import type { AuthenticatedRequest } from './auth.js';

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const email = req.authUser?.email;
  if (!email) return res.status(403).json({ error: 'forbidden', message: 'لا يوجد بريد موثّق لهذا الحساب.' });
  try {
    const snapshot = await adminDb.collection('admins').doc(email).get();
    const record = snapshot.data();
    if (!snapshot.exists || record?.active !== true || record.email !== email || !['admin', 'super-admin'].includes(record.role)) {
      return res.status(403).json({ error: 'forbidden', message: 'هذه العملية متاحة للمديرين فقط.' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const email = req.authUser?.email;
  if (!email) return res.status(403).json({ error: 'forbidden' });
  try {
    const snapshot = await adminDb.collection('admins').doc(email).get();
    const record = snapshot.data();
    if (!snapshot.exists || record?.active !== true || record.email !== email || record.role !== 'super-admin') {
      return res.status(403).json({ error: 'forbidden', message: 'هذه العملية متاحة للمدير الأعلى فقط.' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
