import { Router } from 'express';
import { adminDb } from '../config/firebaseAdmin.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roles.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ status: 'ok', service: 'eng-hub-api', version: '1.0.0' }));

apiRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const identity = req.authUser!;
    const profileSnapshot = await adminDb.collection('users').doc(identity.uid).get();
    const profile = profileSnapshot.data() ?? {};
    const adminSnapshot = identity.email ? await adminDb.collection('admins').doc(identity.email).get() : null;
    const adminRecord = adminSnapshot?.data();
    const role = adminSnapshot?.exists && adminRecord?.active === true && adminRecord.email === identity.email
      ? adminRecord.role
      : 'student';
    return res.json({
      uid: identity.uid,
      email: identity.email,
      displayName: String(profile.displayName ?? identity.name ?? ''),
      photoURL: typeof profile.photoURL === 'string' ? profile.photoURL : null,
      role: ['admin', 'super-admin'].includes(String(role)) ? role : 'student',
    });
  } catch (error) { return next(error); }
});

apiRouter.get('/admin/overview', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const [users, subjects, lectures, exams, tasks] = await Promise.all([
      adminDb.collection('users').count().get(),
      adminDb.collection('subjects').count().get(),
      adminDb.collection('lectures').count().get(),
      adminDb.collection('exams').count().get(),
      adminDb.collection('tasks').count().get(),
    ]);
    return res.json({ users: users.data().count, subjects: subjects.data().count, lectures: lectures.data().count, exams: exams.data().count, tasks: tasks.data().count });
  } catch (error) { return next(error); }
});
