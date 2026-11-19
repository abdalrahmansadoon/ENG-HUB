import { importPKCS8, SignJWT, createRemoteJWKSet, jwtVerify } from 'jose';

interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  CORS_ORIGINS: string;
}

type Identity = { uid: string; email: string | null; name?: string };
const firebaseKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin');
  const allowed = (env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
  if (!origin || allowed.includes(origin)) return { ...(origin ? { 'access-control-allow-origin': origin, 'vary': 'Origin' } : {}), 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'Authorization,Content-Type' };
  return {};
}
async function identity(request: Request, env: Env): Promise<Identity | null> {
  const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], firebaseKeys, { audience: env.FIREBASE_PROJECT_ID, issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` });
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : null, name: typeof payload.name === 'string' ? payload.name : undefined };
  } catch { return null; }
}
async function firestoreAccessToken(env: Env): Promise<string> {
  const key = await importPKCS8(env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/datastore' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(env.FIREBASE_CLIENT_EMAIL)
    .setSubject(env.FIREBASE_CLIENT_EMAIL)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt().setExpirationTime('1h').sign(key);
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  if (!response.ok) throw new Error('Could not obtain Google access token');
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error('Google access token missing');
  return data.access_token;
}
async function firestoreDocument(env: Env, path: string) {
  const token = await firestoreAccessToken(env);
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Firestore document lookup failed');
  return await response.json() as Record<string, unknown>;
}
function fieldString(doc: Record<string, unknown> | null, key: string): string | null {
  const fields = doc?.fields as Record<string, { stringValue?: string }> | undefined;
  return fields?.[key]?.stringValue ?? null;
}
async function isAdmin(env: Env, email: string, superOnly = false): Promise<boolean> {
  const doc = await firestoreDocument(env, `admins/${encodeURIComponent(email)}`);
  const role = fieldString(doc, 'role');
  return fieldString(doc, 'active') === null ? false :
    (doc?.fields as Record<string, { booleanValue?: boolean }> | undefined)?.active?.booleanValue === true &&
    fieldString(doc, 'email') === email && (superOnly ? role === 'super-admin' : role === 'admin' || role === 'super-admin');
}
async function countCollection(env: Env, collection: string): Promise<number> {
  const token = await firestoreAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runAggregationQuery`;
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: collection }] }, aggregations: [{ count: { } , alias: 'total' }] } }) });
  if (!response.ok) throw new Error(`Firestore count failed for ${collection}`);
  const rows = await response.json() as Array<{ result?: { aggregateFields?: { total?: { integerValue?: string } } } }>;
  return Number(rows[0]?.result?.aggregateFields?.total?.integerValue ?? 0);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(request, env);
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.headers.get('Origin') && !headers['access-control-allow-origin' as keyof typeof headers]) return json({ error: 'origin_not_allowed' }, 403);
    try {
      if (url.pathname === '/api/v1/health' && request.method === 'GET') return json({ status: 'ok', service: 'eng-hub-api', runtime: 'cloudflare-workers', version: '1.0.0' }, 200, headers);
      if (url.pathname === '/api/v1/me' && request.method === 'GET') {
        const user = await identity(request, env);
        if (!user) return json({ error: 'unauthenticated', message: 'سجّل الدخول أولاً.' }, 401, headers);
        const [profile, admin] = await Promise.all([firestoreDocument(env, `users/${user.uid}`), user.email ? isAdmin(env, user.email) : Promise.resolve(false)]);
        return json({ uid: user.uid, email: user.email, displayName: fieldString(profile, 'displayName') ?? user.name ?? '', photoURL: fieldString(profile, 'photoURL'), role: admin ? (fieldString(await firestoreDocument(env, `admins/${encodeURIComponent(user.email!)}`), 'role') ?? 'student') : 'student' }, 200, headers);
      }
      if (url.pathname === '/api/v1/admin/overview' && request.method === 'GET') {
        const user = await identity(request, env);
        if (!user) return json({ error: 'unauthenticated' }, 401, headers);
        if (!user.email || !(await isAdmin(env, user.email))) return json({ error: 'forbidden', message: 'هذه العملية متاحة للمديرين فقط.' }, 403, headers);
        const [users, subjects, lectures, exams, tasks] = await Promise.all(['users','subjects','lectures','exams','tasks'].map(name => countCollection(env, name)));
        return json({ users, subjects, lectures, exams, tasks }, 200, headers);
      }
      return json({ error: 'not_found' }, 404, headers);
    } catch (error) {
      console.error('ENG HUB Worker error', error);
      return json({ error: 'internal_server_error', message: 'حدث خطأ داخلي. حاول مرة أخرى.' }, 500, headers);
    }
  }
};
