import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface AuthPayload {
  userId: string;
  email: string;
}

interface PreviewTokenPayload {
  kind: 'blueprint-preview';
  blueprintId: string;
}

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Narrows a verified JWT payload to a real user session.
 *
 * Preview tokens are signed with the same secret, so a valid signature alone is
 * not proof of a user session — without this check `{kind:'blueprint-preview'}`
 * would pass as a bearer credential with `userId === undefined`.
 */
function toAuthPayload(payload: unknown): AuthPayload | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const candidate = payload as Record<string, unknown>;
  // Any `kind` field means this is a special-purpose token, not a user session.
  if ('kind' in candidate) return null;
  if (typeof candidate.userId !== 'string' || candidate.userId.length === 0) return null;
  if (typeof candidate.email !== 'string') return null;
  return { userId: candidate.userId, email: candidate.email };
}

/**
 * Required auth middleware — rejects requests without a valid token.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = toAuthPayload(jwt.verify(token, JWT_SECRET));
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth middleware — attaches user if token is present, but doesn't reject.
 * This allows routes to work for both logged-in and anonymous users.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = toAuthPayload(jwt.verify(token, JWT_SECRET));
      // Non-user tokens (e.g. preview links) continue as anonymous.
      if (payload) req.user = payload;
    } catch {
      // Invalid token — continue as anonymous
    }
  }
  next();
}

/**
 * Generate a JWT token for a user.
 */
export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/** Create a short-lived, URL-safe token for opening a private preview link. */
export function generatePreviewToken(blueprintId: string): string {
  return jwt.sign({ kind: 'blueprint-preview', blueprintId } satisfies PreviewTokenPayload, JWT_SECRET, {
    expiresIn: '1h',
  });
}

export function isValidPreviewToken(token: string, blueprintId: string): boolean {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as Partial<PreviewTokenPayload>;
    return payload.kind === 'blueprint-preview' && payload.blueprintId === blueprintId;
  } catch {
    return false;
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}
