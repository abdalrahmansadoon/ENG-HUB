import app from '../src/app.js';

// Vercel Node.js Function catch-all. Express receives the original request path,
// so /api/v1/* continues to be handled by the existing versioned router.
export default app;
