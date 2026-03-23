import { Router, type Request, type Response, type NextFunction } from 'express';
import { getUser, getOrgs, searchCommits } from '../lib/github-client.js';

const router = Router();

const TOKEN_PATTERN = /^[a-zA-Z0-9_\-]+$/;

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;

  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!token || !TOKEN_PATTERN.test(token)) return null;

  return token;
}

// Attach validated token to res.locals or 401
function requireToken(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) { res.status(401).json({ error: 'Missing or invalid token.' }); return; }
  res.locals['token'] = token;
  next();
}

router.use(requireToken);

router.get('/user', async (_req, res) => {
  const user = await getUser(res.locals['token'] as string);
  res.json(user);
});

router.get('/orgs', async (_req, res) => {
  const orgs = await getOrgs(res.locals['token'] as string);
  res.json(orgs);
});

router.get('/commits', async (req, res) => {
  const { scope, start, end, username } = req.query;

  if (!scope || !start || !end || !username) {
    res.status(400).json({ error: 'Missing required query params: scope, start, end, username' });
    return;
  }

  const result = await searchCommits(
    res.locals['token'] as string,
    String(username),
    String(scope),
    String(start),
    String(end),
  );

  res.json(result);
});

export default router;
